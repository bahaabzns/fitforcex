import { Router } from 'express';
import crypto from 'crypto';
import { createId } from '@paralleldrive/cuid2';
import authMiddleware from '../../middleware/auth';
import { getInvoiceStatus } from '../../lib/fawaterak';
import { env } from '../../config/env';
import pool from '../../db';

const router = Router();

// No authMiddleware — Fawaterak redirects the iframe here after payment.
router.get('/callback', async (req, res) => {
    const { p: paymentId, sig } = req.query as { p?: string; sig?: string };
    if (!paymentId || !sig || !env.JWT_SECRET) {
        return res.status(400).send('<p>Invalid request.</p>');
    }
    const expected = crypto.createHmac('sha256', env.JWT_SECRET).update(String(paymentId)).digest('hex');
    if (sig !== expected) {
        return res.status(400).send('<p>Invalid signature.</p>');
    }
    try {
        const { rows } = await pool.query('SELECT workspace_id FROM workspace_payments WHERE id = $1', [paymentId]);
        if (rows.length) {
            await applyPayment(paymentId, (rows[0] as Record<string, string>).workspace_id);
            console.log('[Callback] Payment', paymentId, '→ activated via success redirect');
        }
    } catch (err) {
        console.error('[Callback] applyPayment error:', (err as Error).message);
    }
    res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>
<script>window.parent.postMessage('payment_confirmed','*')</script>
<p style="font-family:sans-serif;text-align:center;padding:2rem;color:#16a34a">Payment confirmed!</p>
</body></html>`);
});

router.use(authMiddleware);

router.use((req, res, next) => {
    if (!req.user!.isOwner) {
        return res.status(403).json({ error: 'Only the workspace owner can manage billing' });
    }
    next();
});

router.get('/subscription', async (req, res, next) => {
    try {
        const { rows } = await pool.query(`
            SELECT
                ws.status, ws.starts_at, ws.expires_at,
                p.id AS plan_id, p.name AS plan_name, p.display_name AS plan_display,
                p.price_monthly, p.duration_days, p.max_team_seats, p.max_workspaces, p.trial_days
            FROM workspace_subscriptions ws
            JOIN plans p ON p.id = ws.plan_id
            WHERE ws.workspace_id = $1
        `, [req.user!.workspaceId]);

        if (!rows.length) return res.status(404).json({ error: 'Subscription not found' });

        const sub = rows[0] as Record<string, unknown>;
        const expiresAt      = sub.expires_at ? new Date(sub.expires_at as string) : null;
        const daysRemaining  = expiresAt ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000)) : null;

        const { rows: payments } = await pool.query(`
            SELECT wp.id, wp.amount, wp.currency, wp.duration_days, wp.fawaterak_status, wp.created_at, wp.paid_at,
                   p.display_name AS plan_display
            FROM workspace_payments wp
            JOIN plans p ON p.id = wp.plan_id
            WHERE wp.workspace_id = $1
            ORDER BY wp.created_at DESC LIMIT 20
        `, [req.user!.workspaceId]);

        res.json({
            subscription: {
                status:        sub.status,
                planId:        sub.plan_id,
                planName:      sub.plan_name,
                planDisplay:   sub.plan_display,
                priceMonthly:  sub.price_monthly,
                durationDays:  sub.duration_days,
                maxTeamSeats:  sub.max_team_seats,
                maxWorkspaces: sub.max_workspaces,
                trialDays:     sub.trial_days,
                startsAt:      sub.starts_at,
                expiresAt:     sub.expires_at,
                daysRemaining,
            },
            payments,
        });
    } catch (err) { next(err); }
});

router.get('/plans', async (_req, res, next) => {
    try {
        const { rows } = await pool.query(`
            SELECT id, name, display_name, price_monthly, duration_days, max_team_seats, max_workspaces, features
            FROM plans WHERE is_active = TRUE ORDER BY price_monthly ASC NULLS FIRST
        `);
        res.json(rows);
    } catch (err) { next(err); }
});

router.post('/create-invoice', async (req, res, next) => {
    const { planId } = req.body as { planId?: string };
    if (!planId) return res.status(400).json({ error: 'planId is required' });

    try {
        const { rows: planRows } = await pool.query('SELECT * FROM plans WHERE id = $1 AND is_active = TRUE', [planId]);
        if (!planRows.length) return res.status(404).json({ error: 'Plan not found' });
        const plan = planRows[0] as Record<string, unknown>;

        if (!plan.payment_link) {
            return res.status(400).json({ error: 'No payment link configured for this plan. Contact support.' });
        }

        const { rows: pmtRows } = await pool.query(`
            INSERT INTO workspace_payments (workspace_id, plan_id, amount, currency, duration_days, fawaterak_status, id)
            VALUES ($1, $2, $3, 'EGP', $4, 'pending', $5) RETURNING id
        `, [req.user!.workspaceId, plan.id, Number(plan.price_monthly) || 0, plan.duration_days, createId()]);
        const paymentId = (pmtRows[0] as Record<string, string>).id;

        const sig = crypto.createHmac('sha256', env.JWT_SECRET).update(String(paymentId)).digest('hex');
        const callbackUrl = `${env.SERVER_URL}/api/billing/callback?p=${paymentId}&sig=${sig}`;
        const sep = (plan.payment_link as string).includes('?') ? '&' : '?';
        const paymentUrl = `${plan.payment_link}${sep}customerRef=${paymentId}&successUrl=${encodeURIComponent(callbackUrl)}`;

        await pool.query('UPDATE workspace_payments SET fawaterak_payment_url = $1 WHERE id = $2', [paymentUrl, paymentId]);
        res.json({ paymentUrl, paymentId });
    } catch (err) { next(err); }
});

router.get('/payment-status/:paymentId', async (req, res, next) => {
    try {
        const { rows } = await pool.query(`
            SELECT wp.id, wp.fawaterak_status, wp.fawaterak_invoice_id,
                   wp.amount, wp.currency, wp.paid_at, p.display_name AS plan_display
            FROM workspace_payments wp
            JOIN plans p ON p.id = wp.plan_id
            WHERE wp.id = $1 AND wp.workspace_id = $2
        `, [req.params.paymentId, req.user!.workspaceId]);

        if (!rows.length) return res.status(404).json({ error: 'Payment not found' });
        const payment = rows[0] as Record<string, unknown>;

        if (payment.fawaterak_status === 'pending' && payment.fawaterak_invoice_id) {
            try {
                const fawData = await getInvoiceStatus(payment.fawaterak_invoice_id as string) as Record<string, unknown> | null;
                if (fawData?.status === 'paid') {
                    await applyPayment(payment.id as string, req.user!.workspaceId);
                    payment.fawaterak_status = 'paid';
                }
            } catch {
                // Fawaterak unreachable — webhook will arrive shortly
            }
        }

        res.json({
            paymentId:   payment.id,
            status:      payment.fawaterak_status,
            planDisplay: payment.plan_display,
            amount:      payment.amount,
            currency:    payment.currency,
            paidAt:      payment.paid_at,
        });
    } catch (err) { next(err); }
});

// Idempotent: the FOR UPDATE + paid_at IS NULL guard prevents double-application.
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

export default router;
