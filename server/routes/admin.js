const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const adminAuthMiddleware = require('../middleware/adminAuth');
const { loginLimiter } = require('../middleware/rateLimit');

// ── Auth ──────────────────────────────────────────────────────────────────────

router.post('/login', loginLimiter, async (req, res, next) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    try {
        const result = await pool.query('SELECT * FROM admins WHERE email = $1', [email]);
        if (result.rows.length === 0) return res.status(401).json({ message: 'Invalid email or password' });

        const admin = result.rows[0];
        const match = await bcrypt.compare(password, admin.password);
        if (!match) return res.status(401).json({ message: 'Invalid email or password' });

        const token = jwt.sign(
            { adminId: admin.id, isAdmin: true },
            process.env.ADMIN_JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.cookie('admin_token', token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'Strict',
            maxAge: 8 * 60 * 60 * 1000, // 8 hours
        })
           .status(200)
           .json({ message: 'Admin login successful', admin: { id: admin.id, email: admin.email, fname: admin.fname, lname: admin.lname } });
    } catch (err) {
        next(err);
    }
});

router.get('/me', adminAuthMiddleware, async (req, res, next) => {
    try {
        const result = await pool.query(
            'SELECT id, email, fname, lname, created_at FROM admins WHERE id = $1',
            [req.admin.adminId]
        );
        if (result.rows.length === 0) return res.status(404).json({ message: 'Admin not found' });
        res.status(200).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

router.post('/logout', adminAuthMiddleware, (req, res) => {
    res.clearCookie('admin_token').status(200).json({ message: 'Logged out' });
});

// ── Stats ─────────────────────────────────────────────────────────────────────

router.get('/stats', adminAuthMiddleware, async (req, res, next) => {
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
            totalUsers: parseInt(usersResult.rows[0].total_users),
            totalWorkspaces: parseInt(workspacesResult.rows[0].total_workspaces),
            archivedWorkspaces: parseInt(workspacesResult.rows[0].archived),
            planBreakdown: planBreakdown.rows,
            recentRegistrations: recent.rows,
        });
    } catch (err) {
        next(err);
    }
});

// ── Users ─────────────────────────────────────────────────────────────────────

router.get('/users', adminAuthMiddleware, async (req, res, next) => {
    const { search = '', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

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
        `, [searchParam, parseInt(limit), offset]);

        const { rows: countRows } = await pool.query(
            `SELECT COUNT(*) FROM users WHERE fname ILIKE $1 OR lname ILIKE $1 OR email ILIKE $1`,
            [searchParam]
        );

        res.json({ users: rows, total: parseInt(countRows[0].count), page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        next(err);
    }
});

router.get('/users/:id', adminAuthMiddleware, async (req, res, next) => {
    try {
        const { rows } = await pool.query(`
            SELECT id, fname, lname, email, created_at, is_admin, default_workspace_id
            FROM users WHERE id = $1
        `, [req.params.id]);

        if (!rows.length) return res.status(404).json({ message: 'User not found' });

        const user = rows[0];

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

router.get('/workspaces', adminAuthMiddleware, async (req, res, next) => {
    const { search = '', plan = '', archived = 'false', page = 1, limit = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const showArchived = archived === 'true';

    try {
        const conditions = ['(w.slug ILIKE $1 OR w.name ILIKE $1)'];
        const params = [`%${search}%`];

        if (!showArchived) {
            conditions.push('w.archived_at IS NULL');
        }
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
        `, [...params, parseInt(limit), offset]);

        const { rows: countRows } = await pool.query(`
            SELECT COUNT(DISTINCT w.id)
            FROM workspaces w
            JOIN workspace_subscriptions ws ON ws.workspace_id = w.id
            JOIN plans p ON p.id = ws.plan_id
            WHERE ${where}
        `, params);

        res.json({ workspaces: rows, total: parseInt(countRows[0].count), page: parseInt(page), limit: parseInt(limit) });
    } catch (err) {
        next(err);
    }
});

router.get('/workspaces/:id', adminAuthMiddleware, async (req, res, next) => {
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

router.put('/workspaces/:id/subscription', adminAuthMiddleware, async (req, res, next) => {
    const { planId, notes } = req.body;
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

router.post('/workspaces/:id/restore', adminAuthMiddleware, async (req, res, next) => {
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

router.post('/workspaces/:id/archive', adminAuthMiddleware, async (req, res, next) => {
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

router.get('/plans', adminAuthMiddleware, async (req, res, next) => {
    try {
        const { rows } = await pool.query(`
            SELECT p.*,
                   COUNT(ws.id) AS workspace_count
            FROM plans p
            LEFT JOIN workspace_subscriptions ws ON ws.plan_id = p.id
            GROUP BY p.id
            ORDER BY p.id
        `);
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

router.post('/plans', adminAuthMiddleware, async (req, res, next) => {
    const { name, display_name, max_team_seats, max_workspaces, price_monthly, features, trial_days, payment_link } = req.body;
    if (!name || !display_name) return res.status(400).json({ message: 'name and display_name are required' });

    try {
        const { rows } = await pool.query(`
            INSERT INTO plans (name, display_name, max_team_seats, max_workspaces, price_monthly, features, trial_days, payment_link)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [name.trim(), display_name.trim(), max_team_seats ?? null, max_workspaces ?? null, price_monthly ?? null, features ? JSON.stringify(features) : '{}', trial_days ?? null, payment_link?.trim() || null]);
        res.status(201).json(rows[0]);
    } catch (err) {
        if (err.code === '23505') return res.status(409).json({ message: 'A plan with this name already exists' });
        req.log.error({ err }, 'Error creating plan');
        next(err);
    }
});

router.put('/plans/:id', adminAuthMiddleware, async (req, res, next) => {
    const { display_name, max_team_seats, max_workspaces, price_monthly, features, is_active, is_default, trial_days, payment_link } = req.body;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (is_default === true) {
            await client.query(`UPDATE plans SET is_default = FALSE WHERE is_default = TRUE AND id != $1`, [req.params.id]);
        }

        const { rows } = await client.query(`
            UPDATE plans
            SET display_name   = COALESCE($1, display_name),
                max_team_seats = $2,
                max_workspaces = $3,
                price_monthly  = $4,
                features       = COALESCE($5::jsonb, features),
                is_active      = COALESCE($6, is_active),
                is_default     = CASE WHEN $7::boolean IS NOT NULL THEN $7::boolean ELSE is_default END,
                trial_days     = $8,
                payment_link   = COALESCE($10, payment_link)
            WHERE id = $9
            RETURNING *
        `, [display_name ?? null, max_team_seats ?? null, max_workspaces ?? null, price_monthly ?? null,
            features ? JSON.stringify(features) : null, is_active ?? null,
            is_default != null ? is_default : null, trial_days ?? null, req.params.id,
            payment_link !== undefined ? (payment_link?.trim() || null) : null]);

        if (!rows.length) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Plan not found' }); }

        await client.query('COMMIT');
        res.json(rows[0]);
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
});

router.delete('/plans/:id', adminAuthMiddleware, async (req, res, next) => {
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

        const plan = rows[0];
        if (plan.is_default) return res.status(409).json({ message: 'Cannot delete the default plan. Set another plan as default first.' });
        if (parseInt(plan.workspace_count) > 0) return res.status(409).json({ message: `Cannot delete: ${plan.workspace_count} workspace(s) are on this plan. Reassign them first.` });

        await pool.query('DELETE FROM plans WHERE id = $1', [req.params.id]);
        res.status(204).end();
    } catch (err) {
        next(err);
    }
});

// ── Payments ──────────────────────────────────────────────────────────────────

// GET /api/admin/payments/stats
router.get('/payments/stats', adminAuthMiddleware, async (req, res, next) => {
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

// GET /api/admin/payments
router.get('/payments', adminAuthMiddleware, async (req, res, next) => {
    const { page = 1, limit = 25, status = '', search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
        const conditions = ['1=1'];
        const params     = [];

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
                wp.id,
                wp.amount,
                wp.currency,
                wp.duration_days,
                wp.fawaterak_status,
                wp.fawaterak_invoice_id,
                wp.created_at,
                wp.paid_at,
                w.id   AS workspace_id,
                w.name AS workspace_name,
                w.slug AS workspace_slug,
                p.display_name AS plan_display,
                u.fname AS owner_fname,
                u.lname AS owner_lname,
                u.email AS owner_email
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
            total:      parseInt(countRows[0].count),
            page:       parseInt(page),
            limit:      parseInt(limit),
            totalPages: Math.ceil(parseInt(countRows[0].count) / parseInt(limit)),
        });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
