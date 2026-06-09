import { Router, Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcrypt';
import { PoolClient } from 'pg';
import jwt from 'jsonwebtoken';
import adminAuthMiddleware from '../../middleware/adminAuth';
import { loginLimiter } from '../../middleware/rateLimit';
import { applyPayment } from '../billing/index';
import { env } from '../../config/env';
import pool from '../../db';

const router = Router();

type Row = Record<string, unknown>;

// ── Auth ──────────────────────────────────────────────────────────────────────

router.post('/login', loginLimiter, async (req: Request, res: Response, next: NextFunction) => {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    try {
        const result = await pool.query('SELECT * FROM admins WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(401).json({ message: 'Invalid email or password' });

        const admin = result.rows[0] as Row;
        const match = await bcrypt.compare(password, admin.password as string);
        if (!match) return res.status(401).json({ message: 'Invalid email or password' });

        const token = jwt.sign(
            { adminId: admin.id, isAdmin: true },
            env.ADMIN_JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.cookie('admin_token', token, {
            httpOnly: true,
            secure:   env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge:   8 * 60 * 60 * 1000,
        })
           .status(200)
           .json({ message: 'Admin login successful', admin: { id: admin.id, email: admin.email, fname: admin.fname, lname: admin.lname } });
    } catch (err) {
        next(err);
    }
});

router.get('/me', adminAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await pool.query(
            'SELECT id, email, fname, lname, created_at FROM admins WHERE id = $1',
            [(req.admin as Row).adminId]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: 'Admin not found' });
        res.status(200).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

router.post('/logout', adminAuthMiddleware, (req: Request, res: Response) => {
    res.clearCookie('admin_token').status(200).json({ message: 'Logged out' });
});

// ── Stats ─────────────────────────────────────────────────────────────────────

router.get('/stats', adminAuthMiddleware, async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const [usersResult, workspacesResult, planBreakdown, recent] = await Promise.all([
            pool.query('SELECT COUNT(*) AS total_users FROM users'),
            pool.query('SELECT COUNT(*) AS total_workspaces, COUNT(*) FILTER (WHERE archived_at IS NOT NULL) AS archived FROM workspaces'),
            pool.query(`
                SELECT p.name AS plan, p.display_name, COUNT(ws.id) AS count
                FROM plans p
                LEFT JOIN workspace_subscriptions ws ON ws.plan_id = p.id
                GROUP BY p.id, p.name, p.display_name
                ORDER BY p.id
            `),
            pool.query(`
                SELECT u.id, u.fname, u.lname, u.email, u.created_at,
                       w.name AS workspace_name, w.slug AS workspace_slug
                FROM users u
                LEFT JOIN workspaces w ON w.owner_id = u.id AND w.archived_at IS NULL
                ORDER BY u.created_at DESC
                LIMIT 10
            `),
        ]);

        res.json({
            totalUsers:           parseInt((usersResult.rows[0] as Row).total_users as string),
            totalWorkspaces:      parseInt((workspacesResult.rows[0] as Row).total_workspaces as string),
            archivedWorkspaces:   parseInt((workspacesResult.rows[0] as Row).archived as string),
            planBreakdown:        planBreakdown.rows,
            recentRegistrations:  recent.rows,
        });
    } catch (err) {
        next(err);
    }
});

// ── Users ─────────────────────────────────────────────────────────────────────

router.get('/users', adminAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    const { search = '', page = 1, limit = 20 } = req.query as Record<string, string>;
    const offset = (parseInt(page as string) - 1) * parseInt(limit as string);

    try {
        const searchParam = `%${search}%`;
        const { rows } = await pool.query(`
            SELECT u.id, u.fname, u.lname, u.email, u.created_at, u.is_admin,
                   COUNT(DISTINCT w.id) FILTER (WHERE w.archived_at IS NULL) AS workspace_count,
                   COUNT(DISTINCT wm.workspace_id) AS member_count
            FROM users u
            LEFT JOIN workspaces w ON w.owner_id = u.id
            LEFT JOIN workspace_members wm ON wm.user_id = u.id
            WHERE u.fname ILIKE $1 OR u.lname ILIKE $1 OR u.email ILIKE $1
            GROUP BY u.id
            ORDER BY u.created_at DESC
            LIMIT $2 OFFSET $3
        `, [searchParam, parseInt(limit as string), offset]);

        const { rows: countRows } = await pool.query(
            `SELECT COUNT(*) FROM users WHERE fname ILIKE $1 OR lname ILIKE $1 OR email ILIKE $1`,
            [searchParam]
        );

        res.json({ users: rows, total: parseInt((countRows[0] as Row).count as string), page: parseInt(page as string), limit: parseInt(limit as string) });
    } catch (err) {
        next(err);
    }
});

router.get('/users/:id', adminAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { rows } = await pool.query(`
            SELECT id, fname, lname, email, created_at, is_admin, default_workspace_id
            FROM users WHERE id = $1
        `, [req.params.id]);

        if (!rows.length) return res.status(404).json({ message: 'User not found' });
        const user = rows[0] as Row;

        const { rows: workspaces } = await pool.query(`
            SELECT w.id, w.slug, w.name, w.archived_at, w.created_at,
                   'owner' AS role,
                   p.display_name AS plan
            FROM workspaces w
            JOIN workspace_subscriptions ws ON ws.workspace_id = w.id
            JOIN plans p ON p.id = ws.plan_id
            WHERE w.owner_id = $1

            UNION ALL

            SELECT w.id, w.slug, w.name, w.archived_at, w.created_at,
                   wm.role,
                   p.display_name AS plan
            FROM workspace_members wm
            JOIN workspaces w ON w.id = wm.workspace_id
            JOIN workspace_subscriptions ws ON ws.workspace_id = w.id
            JOIN plans p ON p.id = ws.plan_id
            WHERE wm.user_id = $1
            ORDER BY created_at DESC
        `, [user.id]);

        res.json({ ...user, workspaces });
    } catch (err) {
        next(err);
    }
});

// ── Workspaces ────────────────────────────────────────────────────────────────

router.get('/workspaces', adminAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    const { search = '', plan = '', archived = 'false', page = 1, limit = 20 } = req.query as Record<string, string>;
    const offset      = (parseInt(page as string) - 1) * parseInt(limit as string);
    const showArchived = archived === 'true';

    try {
        const conditions: string[] = ['(w.slug ILIKE $1 OR w.name ILIKE $1)'];
        const params: unknown[]   = [`%${search}%`];

        if (!showArchived) conditions.push('w.archived_at IS NULL');
        if (plan) {
            params.push(plan);
            conditions.push(`p.name = $${params.length}`);
        }

        const where = conditions.join(' AND ');

        const { rows } = await pool.query(`
            SELECT w.id, w.slug, w.name, w.archived_at, w.created_at,
                   u.fname AS owner_fname, u.lname AS owner_lname, u.email AS owner_email,
                   p.name AS plan, p.display_name AS plan_display,
                   COUNT(DISTINCT wm.id) AS member_count,
                   COUNT(DISTINCT c.id) AS client_count
            FROM workspaces w
            JOIN users u ON u.id = w.owner_id
            JOIN workspace_subscriptions ws ON ws.workspace_id = w.id
            JOIN plans p ON p.id = ws.plan_id
            LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.is_active = TRUE
            LEFT JOIN clients c ON c.workspace_id = w.id
            WHERE ${where}
            GROUP BY w.id, u.id, p.id
            ORDER BY w.created_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `, [...params, parseInt(limit as string), offset]);

        const { rows: countRows } = await pool.query(`
            SELECT COUNT(DISTINCT w.id)
            FROM workspaces w
            JOIN workspace_subscriptions ws ON ws.workspace_id = w.id
            JOIN plans p ON p.id = ws.plan_id
            WHERE ${where}
        `, params);

        res.json({ workspaces: rows, total: parseInt((countRows[0] as Row).count as string), page: parseInt(page as string), limit: parseInt(limit as string) });
    } catch (err) {
        next(err);
    }
});

router.get('/workspaces/:id', adminAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { rows } = await pool.query(`
            SELECT w.id, w.slug, w.name, w.archived_at, w.created_at, w.slug_customized,
                   u.id AS owner_id, u.fname AS owner_fname, u.lname AS owner_lname, u.email AS owner_email,
                   p.id AS plan_id, p.name AS plan, p.display_name AS plan_display,
                   ws.status AS subscription_status, ws.starts_at, ws.expires_at,
                   COUNT(DISTINCT wm.id) AS member_count,
                   COUNT(DISTINCT c.id) AS client_count
            FROM workspaces w
            JOIN users u ON u.id = w.owner_id
            JOIN workspace_subscriptions ws ON ws.workspace_id = w.id
            JOIN plans p ON p.id = ws.plan_id
            LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.is_active = TRUE
            LEFT JOIN clients c ON c.workspace_id = w.id
            WHERE w.id = $1
            GROUP BY w.id, u.id, p.id, ws.id
        `, [req.params.id]);

        if (!rows.length) return res.status(404).json({ message: 'Workspace not found' });

        const { rows: members } = await pool.query(`
            SELECT wm.id, wm.role, wm.is_active, wm.joined_at,
                   u.id AS user_id, u.fname, u.lname, u.email
            FROM workspace_members wm
            JOIN users u ON u.id = wm.user_id
            WHERE wm.workspace_id = $1
            ORDER BY wm.joined_at
        `, [req.params.id]);

        res.json({ ...rows[0], members });
    } catch (err) {
        next(err);
    }
});

router.put('/workspaces/:id/subscription', adminAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    const { planId, notes } = req.body as { planId?: string; notes?: string };
    if (!planId) return res.status(400).json({ message: 'planId is required' });

    try {
        const { rows: planRows } = await pool.query('SELECT id FROM plans WHERE id = $1', [planId]);
        if (!planRows.length) return res.status(404).json({ message: 'Plan not found' });

        await pool.query(`
            UPDATE workspace_subscriptions
            SET plan_id = $1, notes = $2, status = 'active'
            WHERE workspace_id = $3
        `, [planId, notes || null, req.params.id]);

        res.json({ message: 'Subscription updated' });
    } catch (err) {
        next(err);
    }
});

router.post('/workspaces/:id/restore', adminAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { rowCount } = await pool.query(
            'UPDATE workspaces SET archived_at = NULL WHERE id = $1 AND archived_at IS NOT NULL',
            [req.params.id]
        );
        if (!rowCount) return res.status(400).json({ message: 'Workspace is not archived or does not exist' });
        res.json({ message: 'Workspace restored' });
    } catch (err) {
        next(err);
    }
});

router.post('/workspaces/:id/archive', adminAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { rowCount } = await pool.query(
            'UPDATE workspaces SET archived_at = NOW() WHERE id = $1 AND archived_at IS NULL',
            [req.params.id]
        );
        if (!rowCount) return res.status(400).json({ message: 'Workspace is already archived or does not exist' });
        res.json({ message: 'Workspace archived' });
    } catch (err) {
        next(err);
    }
});

// ── Plans ─────────────────────────────────────────────────────────────────────

router.get('/plans', adminAuthMiddleware, async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const { rows: plans } = await pool.query(`
            SELECT p.*,
                   COUNT(ws.id) AS workspace_count
            FROM plans p
            LEFT JOIN workspace_subscriptions ws ON ws.plan_id = p.id
            GROUP BY p.id
            ORDER BY p.id
        `);

        if (plans.length === 0) return res.json([]);

        const planIds = plans.map((p: Row) => p.id);
        const { rows: links } = await pool.query(`
            SELECT ppl.plan_id, bd.period_key, ppl.payment_link
            FROM plan_period_links ppl
            JOIN billing_discounts bd ON bd.id = ppl.billing_discount_id
            WHERE ppl.plan_id = ANY($1)
        `, [planIds]);

        const linkMap: Record<string, Record<string, string>> = {};
        (links as Row[]).forEach(({ plan_id, period_key, payment_link }) => {
            if (!linkMap[plan_id as string]) linkMap[plan_id as string] = {};
            linkMap[plan_id as string][period_key as string] = (payment_link as string) ?? '';
        });

        res.json(plans.map((p: Row) => ({ ...p, period_links: linkMap[p.id as string] ?? {} })));
    } catch (err) {
        next(err);
    }
});

async function upsertPeriodLinks(dbClient: PoolClient, planId: string, periodLinks: unknown): Promise<void> {
    if (!periodLinks || typeof periodLinks !== 'object') return;
    for (const [periodKey, link] of Object.entries(periodLinks as Record<string, unknown>)) {
        const url = typeof link === 'string' ? link.trim() || null : null;
        await dbClient.query(`
            INSERT INTO plan_period_links (plan_id, billing_discount_id, payment_link, id)
            SELECT $1, bd.id, $2, $4
            FROM billing_discounts bd
            WHERE bd.period_key = $3
            ON CONFLICT (plan_id, billing_discount_id)
            DO UPDATE SET payment_link = EXCLUDED.payment_link
        `, [planId, url, periodKey, createId()]);
    }
}

router.post('/plans', adminAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    const {
        name, display_name, max_team_seats, max_workspaces, price_monthly, features, trial_days, payment_link,
        subtitle, is_popular, cta_text, cta_variant, features_header, features_subheader,
        has_team_counter, sort_order, currency, show_on_landing,
        price_per_seat, min_seat_count, max_seat_count,
        period_links, max_clients,
    } = req.body as Record<string, unknown>;
    if (!name || !display_name) return res.status(400).json({ message: 'name and display_name are required' });

    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        const { rows } = await dbClient.query(`
            INSERT INTO plans (
                name, display_name, max_team_seats, max_workspaces, price_monthly, features, trial_days, payment_link,
                subtitle, is_popular, cta_text, cta_variant, features_header, features_subheader,
                has_team_counter, sort_order, currency, show_on_landing,
                price_per_seat, min_seat_count, max_seat_count, max_clients, id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
            RETURNING *
        `, [
            (name as string).trim(), (display_name as string).trim(),
            max_team_seats ?? null, max_workspaces ?? null, price_monthly ?? null,
            features ? JSON.stringify(features) : '[]', trial_days ?? null, (payment_link as string | undefined)?.trim() || null,
            (subtitle as string | undefined)?.trim() || null,
            is_popular ?? false,
            (cta_text as string | undefined)?.trim() || 'Get Started',
            (cta_variant as string | undefined)?.trim() || 'outline',
            (features_header as string | undefined)?.trim() || "What's included:",
            (features_subheader as string | undefined)?.trim() || null,
            has_team_counter ?? false,
            sort_order ?? 0,
            (currency as string | undefined)?.trim() || 'LE',
            show_on_landing ?? true,
            price_per_seat ?? null,
            min_seat_count ?? 1,
            max_seat_count ?? 20,
            max_clients ?? null,
            createId(),
        ]);
        await upsertPeriodLinks(dbClient, (rows[0] as Row).id as string, period_links);
        await dbClient.query('COMMIT');
        res.status(201).json(rows[0]);
    } catch (err) {
        await dbClient.query('ROLLBACK');
        const pgErr = err as { code?: string };
        if (pgErr.code === '23505') return res.status(409).json({ message: 'A plan with this name already exists' });
        console.error({ err }, 'Error creating plan');
        next(err);
    } finally {
        dbClient.release();
    }
});

router.put('/plans/:id', adminAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    const {
        display_name, max_team_seats, max_workspaces, price_monthly, features, is_active, is_default, trial_days, payment_link,
        subtitle, is_popular, cta_text, cta_variant, features_header, features_subheader,
        has_team_counter, sort_order, currency, show_on_landing,
        price_per_seat, min_seat_count, max_seat_count,
        period_links, max_clients,
    } = req.body as Record<string, unknown>;

    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');

        if (is_default === true) {
            await dbClient.query(`UPDATE plans SET is_default = FALSE WHERE is_default = TRUE AND id != $1`, [req.params.id]);
        }

        const { rows } = await dbClient.query(`
            UPDATE plans
            SET display_name      = COALESCE($1, display_name),
                max_team_seats    = $2,
                max_workspaces    = $3,
                price_monthly     = $4,
                features          = COALESCE($5::jsonb, features),
                is_active         = COALESCE($6, is_active),
                is_default        = CASE WHEN $7::boolean IS NOT NULL THEN $7::boolean ELSE is_default END,
                trial_days        = $8,
                payment_link      = COALESCE($10, payment_link),
                subtitle          = COALESCE($11, subtitle),
                is_popular        = COALESCE($12, is_popular),
                cta_text          = COALESCE($13, cta_text),
                cta_variant       = COALESCE($14, cta_variant),
                features_header   = COALESCE($15, features_header),
                features_subheader= $16,
                has_team_counter  = COALESCE($17, has_team_counter),
                sort_order        = COALESCE($18, sort_order),
                currency          = COALESCE($19, currency),
                show_on_landing   = COALESCE($20, show_on_landing),
                price_per_seat    = $21,
                min_seat_count    = COALESCE($22, min_seat_count),
                max_seat_count    = COALESCE($23, max_seat_count),
                max_clients       = $24
            WHERE id = $9
            RETURNING *
        `, [
            display_name ?? null,
            max_team_seats ?? null, max_workspaces ?? null, price_monthly ?? null,
            features ? JSON.stringify(features) : null,
            is_active ?? null,
            is_default != null ? is_default : null,
            trial_days ?? null,
            req.params.id,
            payment_link !== undefined ? ((payment_link as string | undefined)?.trim() || null) : null,
            subtitle !== undefined ? ((subtitle as string | undefined)?.trim() || null) : null,
            is_popular ?? null,
            cta_text !== undefined ? ((cta_text as string | undefined)?.trim() || null) : null,
            cta_variant !== undefined ? ((cta_variant as string | undefined)?.trim() || null) : null,
            features_header !== undefined ? ((features_header as string | undefined)?.trim() || null) : null,
            features_subheader !== undefined ? ((features_subheader as string | undefined)?.trim() || null) : null,
            has_team_counter ?? null,
            sort_order ?? null,
            currency !== undefined ? ((currency as string | undefined)?.trim() || null) : null,
            show_on_landing ?? null,
            price_per_seat !== undefined ? (price_per_seat ?? null) : null,
            min_seat_count ?? null,
            max_seat_count ?? null,
            max_clients !== undefined ? (max_clients ?? null) : null,
        ]);

        if (!rows.length) { await dbClient.query('ROLLBACK'); return res.status(404).json({ message: 'Plan not found' }); }

        await upsertPeriodLinks(dbClient, req.params.id as string, period_links);
        await dbClient.query('COMMIT');
        res.json(rows[0]);
    } catch (err) {
        await dbClient.query('ROLLBACK');
        next(err);
    } finally {
        dbClient.release();
    }
});

router.delete('/plans/:id', adminAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { rows } = await pool.query(
            `SELECT p.id, p.is_default, COUNT(ws.id) AS workspace_count
             FROM plans p
             LEFT JOIN workspace_subscriptions ws ON ws.plan_id = p.id
             WHERE p.id = $1
             GROUP BY p.id`,
            [req.params.id]
        );

        if (!rows.length) return res.status(404).json({ message: 'Plan not found' });
        const plan = rows[0] as Row;
        if (plan.is_default) return res.status(409).json({ message: 'Cannot delete the default plan. Set another plan as default first.' });
        if (parseInt(plan.workspace_count as string) > 0) return res.status(409).json({ message: `Cannot delete: ${plan.workspace_count} workspace(s) are on this plan. Reassign them first.` });

        await pool.query('DELETE FROM plans WHERE id = $1', [req.params.id]);
        res.status(204).end();
    } catch (err) {
        next(err);
    }
});

// ── Billing Discounts ─────────────────────────────────────────────────────────

router.get('/billing-discounts', adminAuthMiddleware, async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const { rows } = await pool.query('SELECT * FROM billing_discounts ORDER BY sort_order ASC');
        res.json(rows);
    } catch (err) { next(err); }
});

router.put('/billing-discounts/:id', adminAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    const { label, save_label, discount_percent, months, sort_order, is_active } = req.body as Record<string, unknown>;
    try {
        const { rows } = await pool.query(`
            UPDATE billing_discounts
            SET label            = COALESCE($1, label),
                save_label       = $2,
                discount_percent = COALESCE($3, discount_percent),
                months           = COALESCE($4, months),
                sort_order       = COALESCE($5, sort_order),
                is_active        = COALESCE($6, is_active)
            WHERE id = $7
            RETURNING *
        `, [
            (label as string | undefined)?.trim() || null,
            save_label !== undefined ? ((save_label as string | undefined)?.trim() || null) : null,
            discount_percent ?? null,
            months ?? null,
            sort_order ?? null,
            is_active ?? null,
            req.params.id,
        ]);
        if (!rows.length) return res.status(404).json({ message: 'Billing period not found' });
        res.json(rows[0]);
    } catch (err) { next(err); }
});

// ── Payments ──────────────────────────────────────────────────────────────────

router.get('/payments/stats', adminAuthMiddleware, async (_req: Request, res: Response, next: NextFunction) => {
    try {
        const { rows } = await pool.query(`
            SELECT
                COUNT(*) FILTER (WHERE fawaterak_status = 'paid')    AS total_paid,
                COUNT(*) FILTER (WHERE fawaterak_status = 'pending') AS total_pending,
                COUNT(*) FILTER (WHERE fawaterak_status = 'failed')  AS total_failed,
                COALESCE(SUM(amount) FILTER (WHERE fawaterak_status = 'paid'), 0) AS total_revenue
            FROM workspace_payments
        `);
        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
});

router.get('/payments', adminAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    const { page = '1', limit = '25', status = '', search = '' } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
        const conditions: string[] = ['1=1'];
        const params: unknown[]   = [];

        if (status) {
            params.push(status);
            conditions.push(`wp.fawaterak_status = $${params.length}`);
        }
        if (search) {
            params.push(`%${search}%`);
            conditions.push(`(w.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
        }

        const where = conditions.join(' AND ');

        const { rows } = await pool.query(`
            SELECT
                wp.id, wp.amount, wp.currency, wp.duration_days, wp.fawaterak_status,
                wp.fawaterak_invoice_id, wp.created_at, wp.paid_at,
                w.id   AS workspace_id, w.name AS workspace_name, w.slug AS workspace_slug,
                p.display_name AS plan_display,
                u.fname AS owner_fname, u.lname AS owner_lname, u.email AS owner_email
            FROM workspace_payments wp
            JOIN workspaces w ON w.id = wp.workspace_id
            JOIN plans p      ON p.id = wp.plan_id
            JOIN users u      ON u.id = w.owner_id
            WHERE ${where}
            ORDER BY wp.created_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `, [...params, parseInt(limit), offset]);

        const { rows: countRows } = await pool.query(`
            SELECT COUNT(*)
            FROM workspace_payments wp
            JOIN workspaces w ON w.id = wp.workspace_id
            JOIN users u      ON u.id = w.owner_id
            WHERE ${where}
        `, params);

        res.json({
            payments:   rows,
            total:      parseInt((countRows[0] as Row).count as string),
            page:       parseInt(page),
            limit:      parseInt(limit),
            totalPages: Math.ceil(parseInt((countRows[0] as Row).count as string) / parseInt(limit)),
        });
    } catch (err) {
        next(err);
    }
});

router.post('/payments/:id/mark-paid', adminAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { rows } = await pool.query(
            'SELECT id, workspace_id, fawaterak_status FROM workspace_payments WHERE id = $1',
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ message: 'Payment not found' });
        if ((rows[0] as Row).fawaterak_status === 'paid') return res.status(409).json({ message: 'Already paid' });

        await applyPayment((rows[0] as Row).id as string, (rows[0] as Row).workspace_id as string);
        res.json({ message: 'Payment marked as paid and subscription activated' });
    } catch (err) {
        next(err);
    }
});

const ALLOWED_STATUSES = ['paid', 'pending', 'failed', 'refunded'];
router.patch('/payments/:id/status', adminAuthMiddleware, async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { status } = req.body as { status?: string };
        if (!ALLOWED_STATUSES.includes(status!)) {
            return res.status(400).json({ message: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` });
        }

        const { rows } = await pool.query(
            'SELECT id, workspace_id, fawaterak_status FROM workspace_payments WHERE id = $1',
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ message: 'Payment not found' });

        const payment = rows[0] as Row;
        if (payment.fawaterak_status === status) {
            return res.json({ message: 'Status unchanged' });
        }

        if (status === 'paid') {
            await applyPayment(payment.id as string, payment.workspace_id as string);
        } else {
            await pool.query(
                'UPDATE workspace_payments SET fawaterak_status = $1, paid_at = NULL WHERE id = $2',
                [status, payment.id]
            );
        }

        res.json({ message: `Payment status updated to ${status}` });
    } catch (err) {
        next(err);
    }
});

export default router;
