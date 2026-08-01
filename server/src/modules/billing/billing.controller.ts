import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { createId } from '@paralleldrive/cuid2';
import { getInvoiceStatus } from '../../lib/fawaterak';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import pool from '../../db';
import { formatPlanVariationLabel } from '../../lib/planVariationLabel';
import { checkVariationSwitchAllowed } from '../../lib/planVariationSwitch';
import { getEffectiveLimits } from '../../lib/seatLimits';

export async function handleCallback(req: Request, res: Response) {
    const { p: paymentId, sig } = req.query as { p?: string; sig?: string };
    if (!paymentId || !sig || !env.JWT_SECRET) {
        return res.status(400).send('<p>Invalid request.</p>');
    }
    const expected = crypto.createHmac('sha256', env.JWT_SECRET).update(String(paymentId)).digest('hex');
    if (sig !== expected) {
        return res.status(400).send('<p>Invalid signature.</p>');
    }
    try {
        const payment = await prisma.workspace_payments.findUnique({
            where: { id: paymentId },
            select: { workspace_id: true },
        });
        if (payment) {
            await applyPayment(paymentId, payment.workspace_id);
            console.log('[Callback] Payment', paymentId, '→ activated via success redirect');
        }
    } catch (err) {
        console.error('[Callback] applyPayment error:', (err as Error).message);
    }
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<script>window.parent.postMessage('payment_confirmed','*')</script>
<p style="font-family:sans-serif;text-align:center;padding:2rem;color:#16a34a">Payment confirmed!</p>
</body></html>`);
}

export async function getSubscription(req: Request, res: Response, next: NextFunction) {
    try {
        const sub = await prisma.workspace_subscriptions.findUnique({
            where: { workspace_id: req.user!.workspaceId },
            include: {
                plans: {
                    select: { id: true, name: true, display_name: true, duration_days: true, trial_days: true },
                },
                plan_variations: {
                    select: { id: true, max_clients: true, max_team_seats: true, price_monthly: true },
                },
            },
        });

        if (!sub) return res.status(404).json({ error: 'Subscription not found' });

        const expiresAt     = sub.expires_at ? new Date(sub.expires_at) : null;
        const daysRemaining = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000)) : null;

        const [payments, addons, effectiveLimits] = await Promise.all([
            prisma.workspace_payments.findMany({
                where: { workspace_id: req.user!.workspaceId },
                select: {
                    id: true, amount: true, currency: true, duration_days: true,
                    fawaterak_status: true, created_at: true, paid_at: true,
                    plans: { select: { display_name: true } },
                    plan_variations: { select: { max_clients: true, max_team_seats: true } },
                    addons: { select: { label: true } },
                },
                orderBy: { created_at: 'desc' },
                take: 20,
            }),
            prisma.workspace_addons.findMany({
                where:  { workspace_id: req.user!.workspaceId, status: 'active' },
                select: { id: true, dimension: true, units: true, quantity: true, unit_price_locked: true, currency: true, purchased_at: true, addons: { select: { label: true } } },
                orderBy: { purchased_at: 'asc' },
            }),
            getEffectiveLimits(req.user!.workspaceId),
        ]);

        const plan      = sub.plans;
        const variation = sub.plan_variations;
        res.json({
            subscription: {
                status:         sub.status,
                planId:         plan.id,
                planName:       plan.name,
                planDisplay:    plan.display_name,
                variationId:    variation?.id ?? null,
                variationLabel: variation ? formatPlanVariationLabel(variation) : null,
                // Locked price = what this workspace actually pays, snapshotted at checkout —
                // deliberately not the live plan_variations.price_monthly (see decision 5:
                // editing a variation's public price never retroactively reprices existing
                // subscribers without an explicit admin resync).
                priceMonthly:   sub.locked_price_monthly ?? variation?.price_monthly ?? null,
                durationDays:   plan.duration_days,
                maxClients:     effectiveLimits.maxClients,
                maxTeamSeats:   effectiveLimits.maxTeamSeats,
                trialDays:      plan.trial_days,
                startsAt:       sub.starts_at,
                expiresAt:      sub.expires_at,
                daysRemaining,
            },
            addons: addons.map(a => ({
                id:           a.id,
                label:        a.addons?.label ?? `+${a.units} ${a.dimension}`,
                dimension:    a.dimension,
                units:        a.units,
                quantity:     a.quantity,
                priceMonthly: a.unit_price_locked,
                currency:     a.currency,
                purchasedAt:  a.purchased_at,
            })),
            payments: payments.map(p => ({
                ...p,
                plan_display:      p.addons ? p.addons.label : p.plans.display_name,
                variation_label:   p.plan_variations ? formatPlanVariationLabel(p.plan_variations) : null,
                plans:             undefined,
                plan_variations:   undefined,
                addons:            undefined,
            })),
        });
    } catch (err) { next(err); }
}

export async function getPlans(_req: Request, res: Response, next: NextFunction) {
    try {
        const plans = await prisma.plans.findMany({
            where: { is_active: true },
            select: { id: true, name: true, display_name: true, duration_days: true, features: true },
        });
        res.json(plans);
    } catch (err) { next(err); }
}

// Which add-ons the workspace's current plan may buy (plan_addon_rules is an allowlist — a
// plan with no rule row for a given add-on cannot buy it at all), plus how many units of each
// are already active, so the frontend can grey out an add-on once its admin-configured cap
// (if any) is reached.
export async function getAvailableAddons(req: Request, res: Response, next: NextFunction) {
    try {
        const sub = await prisma.workspace_subscriptions.findUnique({
            where:  { workspace_id: req.user!.workspaceId },
            select: { plan_id: true },
        });
        if (!sub) return res.status(404).json({ error: 'Subscription not found' });

        const rules = await prisma.plan_addon_rules.findMany({
            where:  { plan_id: sub.plan_id, addons: { is_active: true } },
            select: { max_units: true, addons: true },
        });
        if (!rules.length) return res.json([]);

        const purchased = await prisma.workspace_addons.groupBy({
            by:     ['addon_id'],
            where:  { workspace_id: req.user!.workspaceId, status: 'active' },
            _sum:   { quantity: true },
        });
        const purchasedMap = new Map(purchased.map(p => [p.addon_id, p._sum.quantity ?? 0]));

        res.json(rules.map(r => ({
            id:            r.addons.id,
            key:           r.addons.key,
            label:         r.addons.label,
            dimension:     r.addons.dimension,
            units:         r.addons.units,
            priceMonthly:  r.addons.price_monthly,
            currency:      r.addons.currency,
            maxUnits:      r.max_units,
            unitsOwned:    purchasedMap.get(r.addons.id) ?? 0,
            atCap:         r.max_units != null && (purchasedMap.get(r.addons.id) ?? 0) >= r.max_units,
        })));
    } catch (err) { next(err); }
}

export async function createInvoice(req: Request, res: Response, next: NextFunction) {
    const { planId, variationId } = req.body as { planId?: string; variationId?: string };
    if (!planId || !variationId) return res.status(400).json({ error: 'planId and variationId are required' });

    try {
        const [plan, variation] = await Promise.all([
            prisma.plans.findFirst({ where: { id: planId, is_active: true } }),
            prisma.plan_variations.findFirst({ where: { id: variationId, plan_id: planId, is_active: true } }),
        ]);
        if (!plan) return res.status(404).json({ error: 'Plan not found' });
        if (!variation) return res.status(404).json({ error: 'Plan variation not found' });

        await checkVariationSwitchAllowed(req.user!.workspaceId, {
            max_clients:    variation.max_clients,
            max_team_seats: variation.max_team_seats ?? plan.max_team_seats,
        });

        const paymentLink = variation.payment_link || plan.payment_link;
        if (!paymentLink) {
            return res.status(400).json({ error: 'No payment link configured for this variation. Contact support.' });
        }

        // Renewing the same variation charges the workspace's locked-in price, not the
        // variation's current public price (decision 5) — switching to a different
        // variation/plan always uses the target's current public price.
        const currentSub = await prisma.workspace_subscriptions.findUnique({
            where:  { workspace_id: req.user!.workspaceId },
            select: { variation_id: true, locked_price_monthly: true, locked_currency: true },
        });
        const isRenewal = currentSub?.variation_id === variation.id && currentSub.locked_price_monthly != null;
        const amount    = isRenewal ? Number(currentSub!.locked_price_monthly) : (Number(variation.price_monthly) || 0);
        const currency  = isRenewal ? (currentSub!.locked_currency || variation.currency) : variation.currency;

        const paymentId = createId();
        await prisma.workspace_payments.create({
            data: {
                id:               paymentId,
                workspace_id:     req.user!.workspaceId,
                plan_id:          plan.id,
                variation_id:     variation.id,
                amount,
                currency,
                duration_days:    plan.duration_days,
                fawaterak_status: 'pending',
            },
        });

        const sig = crypto.createHmac('sha256', env.JWT_SECRET).update(String(paymentId)).digest('hex');
        const callbackUrl = `${env.SERVER_URL}/api/billing/callback?p=${paymentId}&sig=${sig}`;
        const sep = paymentLink.includes('?') ? '&' : '?';
        const paymentUrl = `${paymentLink}${sep}customerRef=${paymentId}&successUrl=${encodeURIComponent(callbackUrl)}`;

        await prisma.workspace_payments.update({
            where: { id: paymentId },
            data:  { fawaterak_payment_url: paymentUrl },
        });

        res.json({ paymentUrl, paymentId });
    } catch (err) {
        const httpErr = err as { status?: number; message?: string };
        if (httpErr.status) return res.status(httpErr.status).json({ error: httpErr.message });
        next(err);
    }
}

// Add-ons only ever raise a limit — there is no downgrade-style guard here, only an
// admin-configured cap on how many units of one add-on a plan may buy (plan_addon_rules).
// A plan needs an explicit rule row to buy ANY add-on at all — allowlist, not denylist, so a
// new plan never accidentally inherits add-on support it wasn't meant to have.
export async function createAddonInvoice(req: Request, res: Response, next: NextFunction) {
    const { addonId } = req.body as { addonId?: string };
    if (!addonId) return res.status(400).json({ error: 'addonId is required' });

    try {
        const addon = await prisma.addons.findFirst({ where: { id: addonId, is_active: true } });
        if (!addon) return res.status(404).json({ error: 'Add-on not found' });

        const sub = await prisma.workspace_subscriptions.findUnique({
            where:  { workspace_id: req.user!.workspaceId },
            select: { plan_id: true, plans: { select: { duration_days: true } } },
        });
        if (!sub) return res.status(500).json({ error: 'Subscription not found for workspace' });

        const rule = await prisma.plan_addon_rules.findUnique({
            where: { plan_id_addon_id: { plan_id: sub.plan_id, addon_id: addon.id } },
        });
        if (!rule) return res.status(403).json({ error: 'Your plan does not support this add-on.' });

        if (rule.max_units != null) {
            const { _sum } = await prisma.workspace_addons.aggregate({
                where: { workspace_id: req.user!.workspaceId, addon_id: addon.id, status: 'active' },
                _sum:  { quantity: true },
            });
            if ((_sum.quantity ?? 0) + 1 > rule.max_units) {
                return res.status(409).json({ error: `addon_limit_reached:${rule.max_units}` });
            }
        }

        const paymentLink = addon.payment_link;
        if (!paymentLink) {
            return res.status(400).json({ error: 'No payment link configured for this add-on. Contact support.' });
        }

        const paymentId = createId();
        await prisma.workspace_payments.create({
            data: {
                id:               paymentId,
                workspace_id:     req.user!.workspaceId,
                plan_id:          sub.plan_id,
                addon_id:         addon.id,
                amount:           Number(addon.price_monthly),
                currency:         addon.currency,
                // Reused as "billing cycle length" for the extension math on this purchase —
                // not "days this add-on lasts" (add-ons don't expire independently of the
                // subscription); see applyPayment's add-on branch.
                duration_days:    sub.plans.duration_days,
                fawaterak_status: 'pending',
            },
        });

        const sig = crypto.createHmac('sha256', env.JWT_SECRET).update(String(paymentId)).digest('hex');
        const callbackUrl = `${env.SERVER_URL}/api/billing/callback?p=${paymentId}&sig=${sig}`;
        const sep = paymentLink.includes('?') ? '&' : '?';
        const paymentUrl = `${paymentLink}${sep}customerRef=${paymentId}&successUrl=${encodeURIComponent(callbackUrl)}`;

        await prisma.workspace_payments.update({
            where: { id: paymentId },
            data:  { fawaterak_payment_url: paymentUrl },
        });

        res.json({ paymentUrl, paymentId });
    } catch (err) {
        const httpErr = err as { status?: number; message?: string };
        if (httpErr.status) return res.status(httpErr.status).json({ error: httpErr.message });
        next(err);
    }
}

export async function getPaymentStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const paymentRow = await prisma.workspace_payments.findFirst({
            where: { id: req.params.paymentId as string, workspace_id: req.user!.workspaceId },
            select: {
                id: true, fawaterak_status: true, fawaterak_invoice_id: true,
                amount: true, currency: true, paid_at: true,
                plans: { select: { display_name: true } },
                addons: { select: { label: true } },
            },
        });

        if (!paymentRow) return res.status(404).json({ error: 'Payment not found' });

        let currentStatus = paymentRow.fawaterak_status;
        if (currentStatus === 'pending' && paymentRow.fawaterak_invoice_id) {
            try {
                const fawData = await getInvoiceStatus(paymentRow.fawaterak_invoice_id) as Record<string, unknown> | null;
                if (fawData?.status === 'paid') {
                    await applyPayment(paymentRow.id, req.user!.workspaceId);
                    currentStatus = 'paid';
                }
            } catch {
                // Fawaterak unreachable — webhook will arrive shortly
            }
        }

        res.json({
            paymentId:   paymentRow.id,
            status:      currentStatus,
            planDisplay: paymentRow.addons ? paymentRow.addons.label : paymentRow.plans.display_name,
            amount:      paymentRow.amount,
            currency:    paymentRow.currency,
            paidAt:      paymentRow.paid_at,
        });
    } catch (err) { next(err); }
}

// Idempotent: FOR UPDATE + paid_at IS NULL guard prevents double-application.
// Kept as raw pool because: SELECT FOR UPDATE row locking + interval/balance arithmetic.
export async function applyPayment(paymentId: string, workspaceId: string): Promise<void> {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');

        const { rows } = await dbClient.query(`
            SELECT id, plan_id, variation_id, addon_id, amount, currency, duration_days, paid_at
            FROM workspace_payments
            WHERE id = $1 AND workspace_id = $2 FOR UPDATE
        `, [paymentId, workspaceId]);

        if (!rows.length || (rows[0] as Record<string, unknown>).paid_at !== null) {
            await dbClient.query('COMMIT');
            return;
        }
        const payment = rows[0] as Record<string, unknown>;

        await dbClient.query(
            `UPDATE workspace_payments SET fawaterak_status = 'paid', paid_at = NOW() WHERE id = $1`,
            [paymentId]
        );

        if (payment.addon_id) {
            await applyAddonPurchase(dbClient, payment, workspaceId);
        } else {
            await dbClient.query(`
                UPDATE workspace_subscriptions
                SET plan_id   = $1, variation_id = $2, locked_price_monthly = $3, locked_currency = $4,
                    status = 'active',
                    starts_at = COALESCE(starts_at, NOW()),
                    expires_at = GREATEST(NOW(), COALESCE(expires_at, NOW())) + ($5 || ' days')::INTERVAL
                WHERE workspace_id = $6
            `, [payment.plan_id, payment.variation_id, payment.amount, payment.currency, payment.duration_days, workspaceId]);
        }

        await dbClient.query('COMMIT');
    } catch (err) {
        await dbClient.query('ROLLBACK');
        throw err;
    } finally {
        dbClient.release();
    }
}

// Billing-cycle extension (founder decision 12, in place of proration): the add-on is charged
// in full and activated immediately — no partial invoice, no refund. The portion of that
// full price which "overpays" for the remainder of the current cycle is converted into extra
// subscription time at the new (base + add-on) daily rate, so the next renewal date simply
// moves later instead of a separate mid-cycle charge ever being issued.
//
// Modeled as a prepaid balance rather than "days elapsed in the current N-day cycle" so it
// stays correct even when `expires_at` is already further out than one cycle (e.g. a workspace
// that bought an earlier add-on and is still carrying banked time from it).
async function applyAddonPurchase(
    dbClient: import('pg').PoolClient,
    payment: Record<string, unknown>,
    workspaceId: string,
): Promise<void> {
    const { rows } = await dbClient.query(`
        SELECT locked_price_monthly, expires_at FROM workspace_subscriptions
        WHERE workspace_id = $1 FOR UPDATE
    `, [workspaceId]);
    if (!rows.length) throw { status: 500, message: 'Subscription not found for workspace' };
    const sub = rows[0] as { locked_price_monthly: string | null; expires_at: Date | null };

    const cycleDays        = Number(payment.duration_days) || 30;
    const addonPrice       = Number(payment.amount);
    const oldPrice         = Number(sub.locked_price_monthly ?? 0);
    const now              = Date.now();
    const remainingDays    = sub.expires_at ? Math.max(0, (new Date(sub.expires_at).getTime() - now) / 86400000) : 0;
    const dailyRateOld     = oldPrice / cycleDays;
    const remainingBalance = dailyRateOld * remainingDays;
    const newPrice         = oldPrice + addonPrice;
    const newBalance       = remainingBalance + addonPrice;
    const dailyRateNew     = newPrice / cycleDays;
    const newRemainingDays = dailyRateNew > 0 ? newBalance / dailyRateNew : 0;
    const newExpiresAt     = new Date(now + newRemainingDays * 86400000);

    await dbClient.query(`
        INSERT INTO workspace_addons
            (id, workspace_id, addon_id, dimension, units, quantity, unit_price_locked, currency, status, workspace_payment_id)
        SELECT $1, $2, id, dimension, units, 1, $3, currency, 'active', $4
        FROM addons WHERE id = $5
    `, [createId(), workspaceId, payment.amount, payment.id, payment.addon_id]);

    await dbClient.query(`
        UPDATE workspace_subscriptions
        SET locked_price_monthly = $1, expires_at = $2
        WHERE workspace_id = $3
    `, [newPrice, newExpiresAt, workspaceId]);
}
