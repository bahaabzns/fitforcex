import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import pool from '../../db';

const router = Router();

router.get('/', authMiddleware, async (req, res, next) => {
    const wsId = req.user!.workspaceId;
    try {
        const [userRes, statsRes, recentRes, pendingFormsRes] = await Promise.all([
            pool.query(
                'SELECT id, fname, lname, email FROM users WHERE id = $1',
                [req.user!.userId]
            ),
            pool.query(
                `SELECT
                    COUNT(*) FILTER (WHERE subscription_status = 'Active')  AS active_clients,
                    COUNT(*) FILTER (WHERE subscription_status = 'Expired') AS expired_clients,
                    COUNT(*)                                                  AS total_clients
                 FROM clients
                 WHERE workspace_id = $1`,
                [wsId]
            ),
            pool.query(
                `SELECT id, fname, lname, email, subscription_status, created_at
                 FROM clients
                 WHERE workspace_id = $1
                 ORDER BY created_at DESC
                 LIMIT 5`,
                [wsId]
            ),
            pool.query(
                `SELECT COUNT(*) AS count
                 FROM form_requests fr
                 JOIN clients c ON c.id = fr.client_id
                 WHERE c.workspace_id = $1 AND fr.status = 'pending'`,
                [wsId]
            ),
        ]);

        const user    = userRes.rows[0]    as Record<string, unknown>;
        const stats   = statsRes.rows[0]   as Record<string, string>;
        const pending = pendingFormsRes.rows[0] as Record<string, string>;

        res.json({
            fname: user.fname,
            lname: user.lname,
            email: user.email,
            stats: {
                totalClients:   parseInt(stats.total_clients),
                activeClients:  parseInt(stats.active_clients),
                expiredClients: parseInt(stats.expired_clients),
                pendingForms:   parseInt(pending.count),
            },
            recentClients: recentRes.rows,
        });
    } catch (err) {
        next(err);
    }
});

export default router;
