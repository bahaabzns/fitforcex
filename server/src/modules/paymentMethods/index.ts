import { Router } from 'express';
import { createId } from '@paralleldrive/cuid2';
import authMiddleware from '../../middleware/auth';
import requirePermission from '../../middleware/requirePermission';
import pool from '../../db';

const router = Router();

const VALID_TYPES = ['cash', 'card', 'wallet', 'bank_transfer'];

router.use(authMiddleware);
router.use((req, res, next) => {
    const action = req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('finance', action)(req, res, next);
});

router.get('/', async (req, res, next) => {
    try {
        const result = await pool.query(
            'SELECT * FROM payment_methods WHERE workspace_id = $1 ORDER BY created_at ASC',
            [req.user!.workspaceId]
        );
        res.json(result.rows);
    } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
    const { name, type } = req.body as { name?: string; type?: string };
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!VALID_TYPES.includes(type!)) return res.status(400).json({ error: 'Invalid type' });

    try {
        const result = await pool.query(
            'INSERT INTO payment_methods (workspace_id, name, type, id) VALUES ($1, $2, $3, $4) RETURNING *',
            [req.user!.workspaceId, name.trim(), type, createId()]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
});

router.put('/', async (req, res, next) => {
    const { id, name, type, active } = req.body as { id?: string; name?: string; type?: string; active?: boolean };
    if (!id) return res.status(400).json({ error: 'id is required' });
    if (type !== undefined && !VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid type' });

    try {
        const existing = await pool.query(
            'SELECT * FROM payment_methods WHERE id = $1 AND workspace_id = $2',
            [id, req.user!.workspaceId]
        );
        if (!existing.rows.length) return res.status(404).json({ error: 'Payment method not found' });

        const cur = existing.rows[0] as Record<string, unknown>;
        const result = await pool.query(
            `UPDATE payment_methods SET name = $1, type = $2, active = $3
             WHERE id = $4 AND workspace_id = $5 RETURNING *`,
            [
                name   !== undefined ? name.trim() : cur.name,
                type   !== undefined ? type         : cur.type,
                active !== undefined ? active       : cur.active,
                id, req.user!.workspaceId,
            ]
        );
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

router.delete('/', async (req, res, next) => {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: 'id is required' });

    try {
        const result = await pool.query(
            'DELETE FROM payment_methods WHERE id = $1 AND workspace_id = $2 RETURNING id',
            [id, req.user!.workspaceId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Payment method not found' });
        res.json({ deleted: result.rows[0].id });
    } catch (err) { next(err); }
});

export default router;
