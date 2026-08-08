import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { Prisma } from '@prisma/client';
import * as paymob from '../../lib/paymob';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import pool from '../../db';
import { formatPlanVariationLabel } from '../../lib/planVariationLabel';
import { checkVariationSwitchAllowed } from '../../lib/planVariationSwitch';
import { getEffectiveLimits } from '../../lib/seatLimits';
import { getWorkspaceAccessStatus } from '../../middleware/subscriptionAccessGate';

// Paymob's "Transaction Response Callback" — the browser-side redirect after a card payment,
// fixed per integration in the Paymob dashboard (unlike Fawaterak's old per-request successUrl).
// Paymob appends its own flat query params (merchant_order_id, success, hmac, source_data.*, …);
// `order` arrives as a bare id, not nested, so it's normalized to `{ order: { id } }` to match
// the shape verifyWebhookHmac expects from the server-to-server webhook body.
export async function handleCallback(req: Request, res: Response) {
    const query = req.query as Record<string, string>;
    const { merchant_order_id: paymentId, success, hmac, order } = query;
    const normalized = { ...query, order: { id: order } };

    if (!paymentId || !hmac || !paymob.verifyWebhookHmac(normalized, hmac)) {
        return res.status(400).send('<p>Invalid request.</p>');
    }

    try {
        const payment = await prisma.workspace_payments.findUnique({
            where: { id: paymentId },
            select: { workspace_id: true },
        });
        if (payment && success === 'true') {
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
                    select: { id: true, name: true, display_name: true, display_name_ar: true, duration_days: true, trial_days: true },
                },
                plan_variations: {
                    select: { id: true, max_clients: true, max_team_seats: true, price_monthly: true },
                },
            },
        });

        if (!sub) return res.status(404).json({ error: 'Subscription not found' });

        const expiresAt     = sub.expires_at ? new Date(sub.expires_at) : null;
        const daysRemaining = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000)) : null;

        const [payments, addons, effectiveLimits, accessStatus] = await Promise.all([
            prisma.workspace_payments.findMany({
                where: { workspace_id: req.user!.workspaceId },
                select: {
                    id: true, amount: true, currency: true, duration_days: true,
                    gateway_status: true, created_at: true, paid_at: true,
                    plans: { select: { display_name: true, display_name_ar: true } },
                    plan_variations: { select: { max_clients: true, max_team_seats: true } },
                    addons: { select: { label: true, label_ar: true } },
                },
                orderBy: { created_at: 'desc' },
                take: 20,
            }),
            prisma.workspace_addons.findMany({
                where:  { workspace_id: req.user!.workspaceId, status: 'active' },
                select: { id: true, dimension: true, units: true, quantity: true, unit_price_locked: true, currency: true, purchased_at: true, addons: { select: { label: true, label_ar: true } } },
                orderBy: { purchased_at: 'asc' },
            }),
            getEffectiveLimits(req.user!.workspaceId),
            getWorkspaceAccessStatus(req.user!.workspaceId),
        ]);

        const plan      = sub.plans;
        const variation = sub.plan_variations;
        res.json({
            subscription: {
                status:         sub.status,
                // inGoodStanding/isReadOnly are computed live from expires_at (payments are
                // the only source of truth) — the same computation subscriptionAccessGate.ts
                // enforces with. `status` above is legacy display text; these two drive actual
                // UI behavior (banners, disabling actions) and always agree with the backend.
                inGoodStanding: accessStatus.inGoodStanding,
                isReadOnly:     accessStatus.isReadOnly,
                readOnlyAt:     accessStatus.readOnlyAt,
                planId:         plan.id,
                planName:       plan.name,
                planDisplay:    plan.display_name,
                planDisplayAr:  plan.display_name_ar,
                variationId:    variation?.id ?? null,
                variationLabel:   variation ? formatPlanVariationLabel(variation, 'en') : null,
                variationLabelAr: variation ? formatPlanVariationLabel(variation, 'ar') : null,
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
                labelAr:      a.addons?.label_ar ?? null,
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
                plan_display_ar:   p.addons ? p.addons.label_ar : p.plans.display_name_ar,
                variation_label:     p.plan_variations ? formatPlanVariationLabel(p.plan_variations, 'en') : null,
                variation_label_ar:  p.plan_variations ? formatPlanVariationLabel(p.plan_variations, 'ar') : null,
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
            labelAr:       r.addons.label_ar,
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

type PaymentMethod = 'card' | 'wallet' | 'fawry' | 'manual';

function resolvePaymentMethod(raw: string | undefined): PaymentMethod {
    if (raw === 'wallet') return 'wallet';
    if (raw === 'fawry')  return 'fawry';
    if (raw === 'manual') return 'manual';
    return 'card';
}

// No 0/O/1/I/L — a reference code a coach has to read aloud or type into WhatsApp shouldn't
// be ambiguous. 6 chars from a 32-symbol alphabet is ~1-in-a-billion collision odds per pair,
// and the retry loop below covers the rest.
const REF_CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function generateReferenceCode(): string {
    let code = '';
    for (let i = 0; i < 6; i++) code += REF_CODE_ALPHABET[Math.floor(Math.random() * REF_CODE_ALPHABET.length)];
    return code;
}

// Manual-transfer (InstaPay/wallet) has no gateway of its own — this short code is what the
// coach mentions when sending payment proof over WhatsApp, and what an admin searches for to
// match it back to this row before confirming it (admin.controller.ts::updatePaymentStatus /
// createManualPayment already handle the "mark paid, activate subscription" half). Retries on
// the rare unique-constraint collision — same pattern as transactions.controller.ts's
// nextTransactionCode.
async function assignManualReferenceCode(paymentId: string): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
        const referenceCode = generateReferenceCode();
        try {
            await prisma.workspace_payments.update({ where: { id: paymentId }, data: { reference_code: referenceCode } });
            return referenceCode;
        } catch (err) {
            if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && attempt < 4) continue;
            throw err;
        }
    }
    throw new Error('Failed to generate a unique reference code');
}

function buildWhatsAppUrl(referenceCode: string, planLabel: string, amount: number, currency: string): string {
    const message = `Hi! I've sent a manual payment for FitForce.\nPlan: ${planLabel}\nAmount: ${amount} ${currency}\nReference: ${referenceCode}\n\n(Attaching my payment screenshot.)`;
    return `https://wa.me/${env.WHATSAPP_VERIFICATION_NUMBER}?text=${encodeURIComponent(message)}`;
}

// All the info the manual-checkout screen needs in one place — every contact/account value is
// env-configured (§12: no admin-panel settings UI for these yet, deliberately, per DEBT.md-style
// scope call); a blank one is simply omitted rather than shown as an empty field.
function buildManualPaymentInfo(referenceCode: string, amount: number, currency: string, planLabel: string) {
    return {
        amount, currency,
        instapayHandle:  env.INSTAPAY_HANDLE || null,
        beneficiaryName: env.MANUAL_PAYMENT_BENEFICIARY_NAME || null,
        wallets: [
            { provider: 'vodafone_cash', number: env.WALLET_VODAFONE_CASH },
            { provider: 'etisalat_cash', number: env.WALLET_ETISALAT_CASH },
            { provider: 'orange_cash',   number: env.WALLET_ORANGE_CASH },
            { provider: 'we_pay',        number: env.WALLET_WE_PAY },
        ].filter((w): w is { provider: string; number: string } => !!w.number),
        referenceCode,
        whatsappUrl: buildWhatsAppUrl(referenceCode, planLabel, amount, currency),
    };
}

// Dispatches to the right Paymob checkout and normalizes the three shapes (iframe URL / wallet
// redirect URL / Fawry cash reference code) into one result the caller can persist + return
// without needing to know which method produced it. Shared by createInvoice and
// createAddonInvoice — both branch on the same three methods.
async function runCheckout(
    method: PaymentMethod,
    checkoutBase: { amount: number; currency: string; merchantOrderId: string; coachName: string; coachEmail: string; coachPhone?: string },
    walletPhoneNumber?: string
): Promise<{ orderId: string; paymentUrl?: string; referenceCode?: string }> {
    if (method === 'wallet') {
        const { orderId, redirectUrl } = await paymob.createWalletCheckout({ ...checkoutBase, walletPhoneNumber: walletPhoneNumber!.trim() });
        return { orderId, paymentUrl: redirectUrl };
    }
    if (method === 'fawry') {
        const { orderId, referenceCode } = await paymob.createFawryCheckout(checkoutBase);
        return { orderId, referenceCode };
    }
    const { orderId, iframeUrl } = await paymob.createCardCheckout(checkoutBase);
    return { orderId, paymentUrl: iframeUrl };
}

export async function createInvoice(req: Request, res: Response, next: NextFunction) {
    const { planId, variationId, paymentMethod, walletPhoneNumber } = req.body as {
        planId?: string; variationId?: string; paymentMethod?: string; walletPhoneNumber?: string;
    };
    if (!planId || !variationId) return res.status(400).json({ error: 'planId and variationId are required' });
    const method = resolvePaymentMethod(paymentMethod);
    if (method === 'wallet' && !walletPhoneNumber?.trim()) {
        return res.status(400).json({ error: 'walletPhoneNumber is required for wallet payments' });
    }

    try {
        const [plan, variation, coach] = await Promise.all([
            prisma.plans.findFirst({ where: { id: planId, is_active: true } }),
            prisma.plan_variations.findFirst({ where: { id: variationId, plan_id: planId, is_active: true } }),
            prisma.users.findUnique({ where: { id: req.user!.userId }, select: { fname: true, lname: true, email: true, phone: true } }),
        ]);
        if (!plan) return res.status(404).json({ error: 'Plan not found' });
        if (!variation) return res.status(404).json({ error: 'Plan variation not found' });
        if (!coach) return res.status(404).json({ error: 'Coach account not found' });

        await checkVariationSwitchAllowed(req.user!.workspaceId, {
            max_clients:    variation.max_clients,
            max_team_seats: variation.max_team_seats ?? plan.max_team_seats,
        });

        // Renewing the same variation charges the workspace's locked-in price, not the
        // variation's current public price (decision 5) — switching to a different
        // variation/plan always uses the target's current public price.
        const currentSub = await prisma.workspace_subscriptions.findUnique({
            where:  { workspace_id: req.user!.workspaceId },
            select: {
                plan_id: true, variation_id: true, locked_price_monthly: true, locked_currency: true, expires_at: true,
                plans: { select: { duration_days: true } },
            },
        });
        const isRenewal = currentSub?.variation_id === variation.id && currentSub.locked_price_monthly != null;
        const amount    = isRenewal ? Number(currentSub!.locked_price_monthly) : (Number(variation.price_monthly) || 0);
        const currency  = isRenewal ? (currentSub!.locked_currency || variation.currency) : variation.currency;

        // Tier change (different plan or variation) with unused value left on the current
        // subscription: credit it against the new price rather than banking it silently at
        // whatever tier ends up active (the bug this feature fixes — see
        // docs/billing-architecture-audit.md finding F-04). No credit for a plain renewal,
        // a workspace with no prior subscription, or one that's already expired.
        let creditApplied: number | null = null;
        let finalAmount = amount;
        const now = new Date();
        if (!isRenewal && currentSub?.locked_price_monthly != null && currentSub.expires_at && new Date(currentSub.expires_at) > now) {
            if (currentSub.locked_currency && currentSub.locked_currency !== variation.currency) {
                return res.status(400).json({ error: 'Cannot switch to a plan priced in a different currency' });
            }
            const remainingCredit = computeRemainingCreditValue(
                Number(currentSub.locked_price_monthly),
                currentSub.plans.duration_days,
                new Date(currentSub.expires_at),
                now
            );
            creditApplied = Math.round(Math.min(remainingCredit, amount) * 100) / 100;
            finalAmount   = Math.round(Math.max(0, amount - creditApplied) * 100) / 100;
        }

        const paymentId = createId();
        await prisma.workspace_payments.create({
            data: {
                id:             paymentId,
                workspace_id:   req.user!.workspaceId,
                plan_id:        plan.id,
                variation_id:   variation.id,
                amount:         finalAmount,
                currency,
                duration_days:  plan.duration_days,
                gateway_status: 'pending',
                payment_method: method,
                credit_applied: creditApplied,
            },
        });

        // Manual transfer has no gateway to call — just a reference code and the static
        // payment instructions; the payment sits 'pending' until an admin confirms it
        // (see admin.controller.ts).
        if (method === 'manual') {
            const referenceCode = await assignManualReferenceCode(paymentId);
            return res.json({
                paymentId, paymentMethod: method,
                paymentUrl: null, referenceCode: null,
                manualPayment:  buildManualPaymentInfo(referenceCode, finalAmount, currency, plan.display_name),
                creditApplied,
                amountCharged:  finalAmount,
                listPrice:      creditApplied != null ? amount : null,
                currency,
                planDisplay:      plan.display_name,
                planDisplayAr:    plan.display_name_ar,
                variationLabel:   formatPlanVariationLabel(variation, 'en'),
                variationLabelAr: formatPlanVariationLabel(variation, 'ar'),
            });
        }

        const coachName = `${coach.fname ?? ''} ${coach.lname ?? ''}`.trim() || coach.email;
        const checkoutBase = { amount: finalAmount, currency, merchantOrderId: paymentId, coachName, coachEmail: coach.email, coachPhone: coach.phone ?? undefined };
        const checkout = await runCheckout(method, checkoutBase, walletPhoneNumber);

        // Fawry has no URL to store, only a reference code — reuse gateway_payment_url as the
        // generic "however the customer completes this" display value (DEBT.md notes this is
        // a repurposed field name, not a schema change).
        await prisma.workspace_payments.update({
            where: { id: paymentId },
            data:  { gateway_payment_url: checkout.paymentUrl ?? checkout.referenceCode, gateway_reference_id: checkout.orderId },
        });

        res.json({
            paymentId, paymentMethod: method,
            paymentUrl:     checkout.paymentUrl ?? null,
            referenceCode:  checkout.referenceCode ?? null,
            manualPayment:  null,
            creditApplied,
            amountCharged:  finalAmount,
            listPrice:      creditApplied != null ? amount : null,
            currency,
            planDisplay:      plan.display_name,
            planDisplayAr:    plan.display_name_ar,
            variationLabel:   formatPlanVariationLabel(variation, 'en'),
            variationLabelAr: formatPlanVariationLabel(variation, 'ar'),
        });
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
    const { addonId, paymentMethod, walletPhoneNumber } = req.body as {
        addonId?: string; paymentMethod?: string; walletPhoneNumber?: string;
    };
    if (!addonId) return res.status(400).json({ error: 'addonId is required' });
    const method = resolvePaymentMethod(paymentMethod);
    if (method === 'wallet' && !walletPhoneNumber?.trim()) {
        return res.status(400).json({ error: 'walletPhoneNumber is required for wallet payments' });
    }

    try {
        const [addon, coach] = await Promise.all([
            prisma.addons.findFirst({ where: { id: addonId, is_active: true } }),
            prisma.users.findUnique({ where: { id: req.user!.userId }, select: { fname: true, lname: true, email: true, phone: true } }),
        ]);
        if (!addon) return res.status(404).json({ error: 'Add-on not found' });
        if (!coach) return res.status(404).json({ error: 'Coach account not found' });

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

        const paymentId = createId();
        await prisma.workspace_payments.create({
            data: {
                id:             paymentId,
                workspace_id:   req.user!.workspaceId,
                plan_id:        sub.plan_id,
                addon_id:       addon.id,
                amount:         Number(addon.price_monthly),
                currency:       addon.currency,
                // Reused as "billing cycle length" for the extension math on this purchase —
                // not "days this add-on lasts" (add-ons don't expire independently of the
                // subscription); see applyPayment's add-on branch.
                duration_days:  sub.plans.duration_days,
                gateway_status: 'pending',
                payment_method: method,
            },
        });

        if (method === 'manual') {
            const referenceCode = await assignManualReferenceCode(paymentId);
            return res.json({
                paymentId, paymentMethod: method,
                paymentUrl: null, referenceCode: null,
                manualPayment: buildManualPaymentInfo(referenceCode, Number(addon.price_monthly), addon.currency, addon.label),
            });
        }

        const coachName = `${coach.fname ?? ''} ${coach.lname ?? ''}`.trim() || coach.email;
        const checkoutBase = { amount: Number(addon.price_monthly), currency: addon.currency, merchantOrderId: paymentId, coachName, coachEmail: coach.email, coachPhone: coach.phone ?? undefined };
        const checkout = await runCheckout(method, checkoutBase, walletPhoneNumber);

        await prisma.workspace_payments.update({
            where: { id: paymentId },
            data:  { gateway_payment_url: checkout.paymentUrl ?? checkout.referenceCode, gateway_reference_id: checkout.orderId },
        });

        res.json({
            paymentId, paymentMethod: method,
            paymentUrl: checkout.paymentUrl ?? null,
            referenceCode: checkout.referenceCode ?? null,
            manualPayment: null,
        });
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
                id: true, gateway_status: true, gateway_reference_id: true,
                amount: true, currency: true, paid_at: true,
                plans: { select: { display_name: true, display_name_ar: true } },
                addons: { select: { label: true, label_ar: true } },
            },
        });

        if (!paymentRow) return res.status(404).json({ error: 'Payment not found' });

        let currentStatus = paymentRow.gateway_status;
        if (currentStatus === 'pending' && paymentRow.gateway_reference_id) {
            try {
                const txStatus = await paymob.getTransactionStatus(paymentRow.gateway_reference_id);
                if (txStatus?.success) {
                    await applyPayment(paymentRow.id, req.user!.workspaceId);
                    currentStatus = 'paid';
                }
            } catch {
                // Paymob unreachable — webhook will arrive shortly
            }
        }

        res.json({
            paymentId:   paymentRow.id,
            status:      currentStatus,
            planDisplay:   paymentRow.addons ? paymentRow.addons.label : paymentRow.plans.display_name,
            planDisplayAr: paymentRow.addons ? paymentRow.addons.label_ar : paymentRow.plans.display_name_ar,
            amount:      paymentRow.amount,
            currency:    paymentRow.currency,
            paidAt:      paymentRow.paid_at,
        });
    } catch (err) { next(err); }
}

// Idempotent: FOR UPDATE + paid_at IS NULL guard prevents double-application.
// Kept as raw pool because: SELECT FOR UPDATE row locking + interval/balance arithmetic.
//
// `startDate` is an admin-only override (manual payment entry, see admin.controller.ts:
// createManualPayment) for backdating/scheduling a subscription's effective start. `addonQuantity`
// is likewise admin-only (manual add-on grants of more than one unit in a single purchase) —
// self-serve always buys one unit per payment row and leaves it at the default.
//
// Both the self-serve and admin-manual branches now special-case a TIER CHANGE (payment's
// plan/variation differs from whatever the subscription is currently on): re-derived here at
// activation time, not trusted from invoice-creation time, so it reflects reality even if the
// workspace's plan changed again in between. A plain renewal (same plan+variation) keeps the
// original behavior unchanged in both branches: starts_at set once via COALESCE and never
// updated again, expires_at extends from whichever is later — now or the current expiry.
export async function applyPayment(paymentId: string, workspaceId: string, startDate?: Date, addonQuantity: number = 1, actorLabel?: string): Promise<void> {
    // Either signal implies an admin-triggered application — startDate (backdating, only
    // admin manual payments pass it) or an explicit actorLabel (admin manual add-ons, which
    // have no startDate concept of their own). Self-serve (webhook/callback/poll) passes neither.
    const actorType: 'admin' | 'coach' = (startDate || actorLabel) ? 'admin' : 'coach';
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
            `UPDATE workspace_payments SET gateway_status = 'paid', paid_at = NOW() WHERE id = $1`,
            [paymentId]
        );

        if (payment.addon_id) {
            await applyAddonPurchase(dbClient, payment, workspaceId, addonQuantity, actorType, actorLabel);
        } else if (startDate) {
            // Admin manual payment. Read the current subscription (joined to its plan's cycle
            // length) to detect a tier change and credit any unused value as EXTRA DAYS — there's
            // no "list price" here to discount from (the admin typed in whatever amount was
            // actually collected), unlike the self-serve branch below.
            const { rows: subRows } = await dbClient.query(`
                SELECT ws.plan_id, ws.variation_id, ws.locked_price_monthly, ws.expires_at, p.duration_days AS old_cycle_days
                FROM workspace_subscriptions ws JOIN plans p ON p.id = ws.plan_id
                WHERE ws.workspace_id = $1 FOR UPDATE
            `, [workspaceId]);
            const oldSub = subRows[0] as Record<string, unknown> | undefined;
            const isTierChange = !!oldSub && (oldSub.plan_id !== payment.plan_id || oldSub.variation_id !== payment.variation_id) && oldSub.locked_price_monthly != null;

            let extraDays = 0;
            if (isTierChange) {
                const remainingCredit = computeRemainingCreditValue(
                    Number(oldSub!.locked_price_monthly),
                    Number(oldSub!.old_cycle_days),
                    oldSub!.expires_at ? new Date(oldSub!.expires_at as string) : null,
                    startDate
                );
                const newDailyRate = Number(payment.duration_days) > 0 ? Number(payment.amount) / Number(payment.duration_days) : 0;
                extraDays = newDailyRate > 0 ? remainingCredit / newDailyRate : 0;
            }

            const { rows: updatedRows } = await dbClient.query(`
                UPDATE workspace_subscriptions
                SET plan_id   = $1, variation_id = $2, locked_price_monthly = $3, locked_currency = $4,
                    status = 'active',
                    starts_at = $5,
                    expires_at = $5::timestamptz + (($6::float8 + $7::float8) || ' days')::INTERVAL
                WHERE workspace_id = $8
                RETURNING plan_id, variation_id, locked_price_monthly, locked_currency, starts_at, expires_at
            `, [payment.plan_id, payment.variation_id, payment.amount, payment.currency, startDate, payment.duration_days, extraDays, workspaceId]);
            await logSubscriptionEvent(dbClient, {
                workspaceId, paymentId, eventType: 'admin_manual', actorType: 'admin', actorLabel,
                previousExpiresAt: oldSub?.expires_at ? new Date(oldSub.expires_at as string) : null,
                result: updatedRows[0] as Record<string, unknown>,
            });
        } else {
            // Self-serve. Detect a tier change against the CURRENT subscription (re-derived here,
            // not trusted from invoice-creation time — see the function doc comment above).
            const { rows: subRows } = await dbClient.query(`
                SELECT plan_id, variation_id, expires_at FROM workspace_subscriptions WHERE workspace_id = $1 FOR UPDATE
            `, [workspaceId]);
            const oldSub = subRows[0] as Record<string, unknown> | undefined;
            const isTierChange = !!oldSub && (oldSub.plan_id !== payment.plan_id || oldSub.variation_id !== payment.variation_id);
            const previousExpiresAt = oldSub?.expires_at ? new Date(oldSub.expires_at as string) : null;

            if (isTierChange) {
                // Immediate upgrade (Option A): fresh cycle starting now — no extra days, since
                // createInvoice already applied the credit as a cash discount on `payment.amount`
                // before checkout; banking bonus days too would double-credit the same value.
                // `locked_price_monthly` is re-derived from the catalog (like resyncSubscriptionPrice
                // does at admin.controller.ts:561-566), NOT `payment.amount` — the ongoing
                // recurring rate is the new variation's real price, not this one-time discounted charge.
                const { rows: variationRows } = await dbClient.query(`
                    SELECT price_monthly, currency FROM plan_variations WHERE id = $1
                `, [payment.variation_id]);
                const newVariation = variationRows[0] as Record<string, unknown> | undefined;
                const lockedPrice = newVariation ? newVariation.price_monthly : payment.amount;
                const lockedCurrency = newVariation ? newVariation.currency : payment.currency;

                const { rows: updatedRows } = await dbClient.query(`
                    UPDATE workspace_subscriptions
                    SET plan_id   = $1, variation_id = $2, locked_price_monthly = $3, locked_currency = $4,
                        status = 'active',
                        starts_at = NOW(),
                        expires_at = NOW() + ($5 || ' days')::INTERVAL
                    WHERE workspace_id = $6
                    RETURNING plan_id, variation_id, locked_price_monthly, locked_currency, starts_at, expires_at
                `, [payment.plan_id, payment.variation_id, lockedPrice, lockedCurrency, payment.duration_days, workspaceId]);
                await logSubscriptionEvent(dbClient, {
                    workspaceId, paymentId, eventType: 'plan_changed', actorType, actorLabel,
                    previousExpiresAt,
                    result: updatedRows[0] as Record<string, unknown>,
                });
            } else {
                const { rows: updatedRows } = await dbClient.query(`
                    UPDATE workspace_subscriptions
                    SET plan_id   = $1, variation_id = $2, locked_price_monthly = $3, locked_currency = $4,
                        status = 'active',
                        starts_at = COALESCE(starts_at, NOW()),
                        expires_at = GREATEST(NOW(), COALESCE(expires_at, NOW())) + ($5 || ' days')::INTERVAL
                    WHERE workspace_id = $6
                    RETURNING plan_id, variation_id, locked_price_monthly, locked_currency, starts_at, expires_at
                `, [payment.plan_id, payment.variation_id, payment.amount, payment.currency, payment.duration_days, workspaceId]);
                await logSubscriptionEvent(dbClient, {
                    workspaceId, paymentId, eventType: 'renewed', actorType, actorLabel,
                    previousExpiresAt,
                    result: updatedRows[0] as Record<string, unknown>,
                });
            }
        }

        await dbClient.query('COMMIT');
    } catch (err) {
        await dbClient.query('ROLLBACK');
        throw err;
    } finally {
        dbClient.release();
    }
}

// Appends a row to workspace_subscription_events recording the ACTUAL resulting period a
// write to workspace_subscriptions just produced — see admin.controller.ts:getPayments, which
// joins against this instead of guessing a payment's period from paid_at + duration_days (that
// guess disagrees with reality for renewals and admin overrides, since both extend/override
// from whatever the subscription's prior state was, not from the payment's own paid_at).
async function logSubscriptionEvent(
    dbClient: import('pg').PoolClient,
    opts: {
        workspaceId: string;
        paymentId: string | null;
        eventType: string;
        actorType: 'coach' | 'admin' | 'system';
        actorLabel?: string;
        previousExpiresAt: Date | null;
        result: Record<string, unknown>;
    }
): Promise<void> {
    await dbClient.query(`
        INSERT INTO workspace_subscription_events
            (id, workspace_id, payment_id, event_type, plan_id, variation_id, locked_price_monthly,
             locked_currency, starts_at, expires_at, previous_expires_at, actor_type, actor_label)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
    `, [
        createId(), opts.workspaceId, opts.paymentId, opts.eventType,
        opts.result.plan_id, opts.result.variation_id, opts.result.locked_price_monthly,
        opts.result.locked_currency, opts.result.starts_at, opts.result.expires_at,
        opts.previousExpiresAt, opts.actorType, opts.actorLabel ?? null,
    ]);
}

// The currency value of whatever time is left, unused, on a subscription at its OLD
// (locked) rate. Shared by self-serve tier-change invoicing (createInvoice), admin
// manual tier-change payments (applyPayment's startDate branch), and add-on purchases
// (applyAddonPurchase) — the three places that need to bank unused value rather than
// silently forfeiting it (self-serve/manual) or ignoring it (a manual tier change today).
function computeRemainingCreditValue(oldPriceMonthly: number, oldCycleDays: number, expiresAt: Date | null, asOf: Date): number {
    if (!expiresAt) return 0;
    const remainingDays = Math.max(0, (expiresAt.getTime() - asOf.getTime()) / 86400000);
    const dailyRate = oldCycleDays > 0 ? oldPriceMonthly / oldCycleDays : 0;
    return dailyRate * remainingDays;
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
    quantity: number = 1,
    actorType: 'coach' | 'admin' = 'coach',
    actorLabel?: string,
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
    const remainingBalance = computeRemainingCreditValue(oldPrice, cycleDays, sub.expires_at ? new Date(sub.expires_at) : null, new Date(now));
    const newPrice         = oldPrice + addonPrice;
    const newBalance       = remainingBalance + addonPrice;
    const dailyRateNew     = newPrice / cycleDays;
    const newRemainingDays = dailyRateNew > 0 ? newBalance / dailyRateNew : 0;
    const newExpiresAt     = new Date(now + newRemainingDays * 86400000);

    // unit_price_locked is per-unit — payment.amount is the total for `quantity` units.
    await dbClient.query(`
        INSERT INTO workspace_addons
            (id, workspace_id, addon_id, dimension, units, quantity, unit_price_locked, currency, status, workspace_payment_id)
        SELECT $1, $2, id, dimension, units, $6, $3, currency, 'active', $4
        FROM addons WHERE id = $5
    `, [createId(), workspaceId, addonPrice / quantity, payment.id, payment.addon_id, quantity]);

    const { rows: updatedRows } = await dbClient.query(`
        UPDATE workspace_subscriptions
        SET locked_price_monthly = $1, expires_at = $2
        WHERE workspace_id = $3
        RETURNING plan_id, variation_id, locked_price_monthly, locked_currency, starts_at, expires_at
    `, [newPrice, newExpiresAt, workspaceId]);

    await logSubscriptionEvent(dbClient, {
        workspaceId, paymentId: payment.id as string, eventType: 'addon_purchased', actorType, actorLabel,
        previousExpiresAt: sub.expires_at ? new Date(sub.expires_at) : null,
        result: updatedRows[0] as Record<string, unknown>,
    });
}
