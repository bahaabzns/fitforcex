const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

const VALID_TYPES = ['cash', 'card', 'wallet', 'bank_transfer'];

;(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS payment_methods (
                id         SERIAL PRIMARY KEY,
                coach_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name       TEXT NOT NULL,
                type       TEXT NOT NULL,
                active     BOOLEAN NOT NULL DEFAULT true,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
    } catch (err) {
        console.error('payment_methods bootstrap error:', err.message);
    }
})();

// GET /api/payment-methods
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM payment_methods WHERE coach_id = $1 ORDER BY created_at ASC',
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/payment-methods
router.post('/', async (req, res) => {
    const { name, type } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid type' });

    try {
        const result = await pool.query(
            'INSERT INTO payment_methods (coach_id, name, type) VALUES ($1, $2, $3) RETURNING *',
            [req.user.id, name.trim(), type]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/payment-methods
router.put('/', async (req, res) => {
    const { id, name, type, active } = req.body;
    if (!id) return res.status(400).json({ error: 'id is required' });
    if (type !== undefined && !VALID_TYPES.includes(type))
        return res.status(400).json({ error: 'Invalid type' });

    try {
        const existing = await pool.query(
            'SELECT * FROM payment_methods WHERE id = $1 AND coach_id = $2',
            [id, req.user.id]
        );
        if (!existing.rows.length) return res.status(404).json({ error: 'Payment method not found' });

        const cur = existing.rows[0];
        const result = await pool.query(
            `UPDATE payment_methods
             SET name = $1, type = $2, active = $3
             WHERE id = $4 AND coach_id = $5
             RETURNING *`,
            [
                name   !== undefined ? name.trim()  : cur.name,
                type   !== undefined ? type          : cur.type,
                active !== undefined ? active        : cur.active,
                id,
                req.user.id,
            ]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/payment-methods?id=X
router.delete('/', async (req, res) => {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id is required' });

    try {
        const result = await pool.query(
            'DELETE FROM payment_methods WHERE id = $1 AND coach_id = $2 RETURNING id',
            [id, req.user.id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Payment method not found' });
        res.json({ deleted: result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
