const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

const VALID_STATUSES = ['completed', 'refunded'];
const VALID_TYPES = ['subscription', 'session', 'one-time', 'other'];

;(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS transactions (
                id                SERIAL PRIMARY KEY,
                coach_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                client_name       TEXT NOT NULL,
                package_variation TEXT,
                payment_method    TEXT NOT NULL,
                amount            NUMERIC(12,2) NOT NULL,
                currency          TEXT NOT NULL DEFAULT 'EGP',
                type              TEXT NOT NULL DEFAULT 'subscription',
                status            TEXT NOT NULL DEFAULT 'completed',
                notes             TEXT,
                transaction_date  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        await pool.query(`
            ALTER TABLE transactions
                ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL
        `);
    } catch (err) {
        console.error('transactions bootstrap error:', err.message);
    }
})();

function mapRow(row) {
    return {
        id: row.id,
        clientName: row.client_name,
        packageVariation: row.package_variation,
        paymentMethod: row.payment_method,
        amount: Number(row.amount),
        currency: row.currency,
        type: row.type,
        status: row.status,
        notes: row.notes,
        date: row.transaction_date,
    };
}

// GET /api/transactions/by-client/:clientId
router.get('/by-client/:clientId', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT * FROM transactions
             WHERE coach_id = $1 AND (client_id = $2 OR (client_id IS NULL AND client_name ILIKE (
                 SELECT CONCAT(fname, ' ', lname) FROM clients WHERE id = $2 AND coach_id = $1 LIMIT 1
             )))
             ORDER BY transaction_date DESC`,
            [req.user.id, req.params.clientId]
        );
        res.json(result.rows.map(mapRow));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/transactions
router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM transactions WHERE coach_id = $1 ORDER BY transaction_date DESC',
            [req.user.id]
        );
        res.json(result.rows.map(mapRow));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/transactions
router.post('/', async (req, res) => {
    const { clientName, clientId, packageVariation, paymentMethod, amount, currency, type, status, notes, date } = req.body;
    if (!clientName?.trim()) return res.status(400).json({ error: 'Client name is required' });
    if (!paymentMethod?.trim()) return res.status(400).json({ error: 'Payment method is required' });
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Amount must be a positive number' });
    if (!currency?.trim()) return res.status(400).json({ error: 'Currency is required' });
    if (type && !VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid type' });
    if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    try {
        const result = await pool.query(
            `INSERT INTO transactions (coach_id, client_id, client_name, package_variation, payment_method, amount, currency, type, status, notes, transaction_date)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
            [
                req.user.id,
                clientId || null,
                clientName.trim(),
                packageVariation?.trim() || null,
                paymentMethod.trim(),
                amt,
                currency.trim(),
                type || 'subscription',
                status || 'completed',
                notes?.trim() || null,
                date ? new Date(date) : new Date(),
            ]
        );
        res.status(201).json(mapRow(result.rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/transactions
router.put('/', async (req, res) => {
    const { id, clientName, packageVariation, paymentMethod, amount, currency, type, status, notes, date } = req.body;
    if (!id) return res.status(400).json({ error: 'id is required' });
    if (type !== undefined && !VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid type' });
    if (status !== undefined && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    try {
        const existing = await pool.query(
            'SELECT * FROM transactions WHERE id = $1 AND coach_id = $2',
            [id, req.user.id]
        );
        if (!existing.rows.length) return res.status(404).json({ error: 'Transaction not found' });

        const cur = existing.rows[0];
        const amt = amount !== undefined ? Number(amount) : Number(cur.amount);
        if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Amount must be a positive number' });

        const result = await pool.query(
            `UPDATE transactions
             SET client_name = $1, package_variation = $2, payment_method = $3,
                 amount = $4, currency = $5, type = $6, status = $7, notes = $8, transaction_date = $9
             WHERE id = $10 AND coach_id = $11
             RETURNING *`,
            [
                clientName  !== undefined ? clientName.trim()                  : cur.client_name,
                packageVariation !== undefined ? (packageVariation?.trim() || null) : cur.package_variation,
                paymentMethod !== undefined ? paymentMethod.trim()             : cur.payment_method,
                amt,
                currency    !== undefined ? currency.trim()                    : cur.currency,
                type        !== undefined ? type                               : cur.type,
                status      !== undefined ? status                             : cur.status,
                notes       !== undefined ? (notes?.trim() || null)            : cur.notes,
                date        !== undefined ? new Date(date)                     : cur.transaction_date,
                id,
                req.user.id,
            ]
        );
        res.json(mapRow(result.rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/transactions?id=X
router.delete('/', async (req, res) => {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'id is required' });

    try {
        const result = await pool.query(
            'DELETE FROM transactions WHERE id = $1 AND coach_id = $2 RETURNING id',
            [id, req.user.id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Transaction not found' });
        res.json({ deleted: result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
