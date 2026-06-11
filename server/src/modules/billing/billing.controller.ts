import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { createId } from '@paralleldrive/cuid2';
import { getInvoiceStatus } from '../../lib/fawaterak';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import pool from '../../db';

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
                    select: {
                        id: true, name: true, display_name: true,
                        price_monthly: true, duration_days: true,
                        max_team_seats: true, max_workspaces: true, trial_days: true,
                    },
                },
            },
        });

        if (!sub) return res.status(404).json({ error: 'Subscription not found' });

        const expiresAt     = sub.expires_at ? new Date(sub.expires_at) : null;
        const daysRemaining = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000)) : null;

        const payments = await prisma.workspace_payments.findMany({
            where: { workspace_id: req.user!.workspaceId },
            select: {
                id: true, amount: true, currency: true, duration_days: true,
                fawaterak_status: true, created_at: true, paid_at: true,
                plans: { select: { display_name: true } },
            },
            orderBy: { created_at: 'desc' },
            take: 20,
        });

        const plan = sub.plans;
        res.json({
            subscription: {
                status:        sub.status,
                planId:        plan.id,
                planName:      plan.name,
                planDisplay:   plan.display_name,
                priceMonthly:  plan.price_monthly,
                durationDays:  plan.duration_days,
                maxTeamSeats:  plan.max_team_seats,
                maxWorkspaces: plan.max_workspaces,
                trialDays:     plan.trial_days,
                startsAt:      sub.starts_at,
                expiresAt:     sub.expires_at,
                daysRemaining,
            },
            payments: payments.map(p => ({
                ...p,
                plan_display: p.plans.display_name,
                plans: undefined,
            })),
        });
    } catch (err) { next(err); }
}

export async function getPlans(_req: Request, res: Response, next: NextFunction) {
    try {
        const plans = await prisma.plans.findMany({
            where: { is_active: true },
            select: {
                id: true, name: true, display_name: true,
                price_monthly: true, duration_days: true,
                max_team_seats: true, max_workspaces: true, features: true,
            },
            orderBy: { price_monthly: 'asc' },
        });
        res.json(plans);
    } catch (err) { next(err); }
}

export async function createInvoice(req: Request, res: Response, next: NextFunction) {
    const { planId } = req.body as { planId?: string };
    if (!planId) return res.status(400).json({ error: 'planId is required' });

    try {
        const plan = await prisma.plans.findFirst({
            where: { id: planId, is_active: true },
        });
        if (!plan) return res.status(404).json({ error: 'Plan not found' });

        if (!plan.payment_link) {
            return res.status(400).json({ error: 'No payment link configured for this plan. Contact support.' });
        }

        const paymentId = createId();
        await prisma.workspace_payments.create({
            data: {
                id:               paymentId,
                workspace_id:     req.user!.workspaceId,
                plan_id:          plan.id,
                amount:           Number(plan.price_monthly) || 0,
                currency:         'EGP',
                duration_days:    plan.duration_days,
                fawaterak_status: 'pending',
            },
        });

        const sig = crypto.createHmac('sha256', env.JWT_SECRET).update(String(paymentId)).digest('hex');
        const callbackUrl = `${env.SERVER_URL}/api/billing/callback?p=${paymentId}&sig=${sig}`;
        const sep = plan.payment_link.includes('?') ? '&' : '?';
        const paymentUrl = `${plan.payment_link}${sep}customerRef=${paymentId}&successUrl=${encodeURIComponent(callbackUrl)}`;

        await prisma.workspace_payments.update({
            where: { id: paymentId },
            data:  { fawaterak_payment_url: paymentUrl },
        });

        res.json({ paymentUrl, paymentId });
    } catch (err) { next(err); }
}

export async function getPaymentStatus(req: Request, res: Response, next: NextFunction) {
    try {
        const paymentRow = await prisma.workspace_payments.findFirst({
            where: { id: req.params.paymentId as string, workspace_id: req.user!.workspaceId },
            select: {
                id: true, fawaterak_status: true, fawaterak_invoice_id: true,
                amount: true, currency: true, paid_at: true,
                plans: { select: { display_name: true } },
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
            planDisplay: paymentRow.plans.display_name,
            amount:      paymentRow.amount,
            currency:    paymentRow.currency,
            paidAt:      paymentRow.paid_at,
        });
    } catch (err) { next(err); }
}

// Idempotent: FOR UPDATE + paid_at IS NULL guard prevents double-application.
// Kept as raw pool because: SELECT FOR UPDATE row locking + interval arithmetic.
export async function applyPayment(paymentId: string, workspaceId: string): Promise<void> {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');

        const { rows } = await dbClient.query(`
            SELECT id, plan_id, duration_days, paid_at FROM workspace_payments
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

        await dbClient.query(`
            UPDATE workspace_subscriptions
            SET plan_id   = $1, status = 'active',
                starts_at = COALESCE(starts_at, NOW()),
                expires_at = GREATEST(NOW(), COALESCE(expires_at, NOW())) + ($2 || ' days')::INTERVAL
            WHERE workspace_id = $3
        `, [payment.plan_id, payment.duration_days, workspaceId]);

        await dbClient.query('COMMIT');
    } catch (err) {
        await dbClient.query('ROLLBACK');
        throw err;
    } finally {
        dbClient.release();
    }
}
