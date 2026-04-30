const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { computeSubscriptionStatus } = require('../utils/subscriptionStatus');

router.use(authMiddleware);

const VALID_STATUSES = ['completed', 'refunded'];
const VALID_TYPES = ['subscription', 'session', 'one-time', 'other'];
const VALID_START_MODES = ['on_first_plan', 'custom', 'queued'];

// Multer setup for proof-of-transaction images
const uploadDir = path.join(__dirname, '../uploads/transactions');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `proof_${Date.now()}_${Math.random().toString(36).slice(2)}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf'];
        cb(null, allowed.includes(path.extname(file.originalname).toLowerCase()));
    },
});

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
        await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES clients(id) ON DELETE SET NULL`);
        await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS duration INTEGER`);
        await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS proof_image TEXT`);
        await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS subscription_start_date DATE`);
        await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS start_mode TEXT NOT NULL DEFAULT 'on_first_plan'`);
    } catch (err) {
        console.error('transactions bootstrap error:', err.message);
    }
})();

function mapRow(row) {
    return {
        id: row.id,
        clientId: row.client_id,
        clientName: row.client_name,
        packageVariation: row.package_variation,
        paymentMethod: row.payment_method,
        amount: Number(row.amount),
        currency: row.currency,
        duration: row.duration,
        type: row.type,
        status: row.status,
        notes: row.notes,
        proofImage: row.proof_image,
        date: row.transaction_date,
        createdAt: row.created_at,
        subscriptionStartDate: row.subscription_start_date ?? null,
        startMode: row.start_mode || 'on_first_plan',
    };
}

// Fetch first plan activation date for a client
async function getFirstPlanActivation(clientId) {
    const result = await pool.query(
        `SELECT MIN(activated_at) AS first_activation FROM (
            SELECT activated_at FROM training_plans  WHERE client_id = $1 AND activated_at IS NOT NULL
            UNION ALL
            SELECT activated_at FROM nutrition_plans WHERE client_id = $1 AND activated_at IS NOT NULL
        ) x`,
        [clientId]
    );
    return result.rows[0]?.first_activation ?? null;
}

// POST /api/transactions/upload-proof
router.post('/upload-proof', upload.single('proof'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    res.json({ path: `/uploads/transactions/${req.file.filename}` });
});

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
            'SELECT * FROM transactions WHERE coach_id = $1 ORDER BY created_at DESC',
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
    const {
        clientName, clientId, packageVariation, paymentMethod, amount, currency,
        duration, type, status, notes, date, proofImage, subscriptionStartDate,
    } = req.body;

    if (!clientName?.trim()) return res.status(400).json({ error: 'Client name is required' });
    if (!paymentMethod?.trim()) return res.status(400).json({ error: 'Payment method is required' });
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Amount must be a positive number' });
    if (!currency?.trim()) return res.status(400).json({ error: 'Currency is required' });
    if (type && !VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid type' });
    if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    try {
        // Auto-determine start_mode:
        // - subscriptionStartDate provided → custom
        // - client has active subscription  → queued
        // - otherwise                       → on_first_plan
        let startMode = 'on_first_plan';
        let finalSubStartDate = null;

        if (subscriptionStartDate) {
            startMode = 'custom';
            finalSubStartDate = new Date(subscriptionStartDate);
        } else if (clientId) {
            const [existingTxResult, existingFreezesResult, planActivation] = await Promise.all([
                pool.query(
                    `SELECT client_id, status, duration, subscription_start_date, start_mode, created_at
                     FROM transactions WHERE client_id = $1 AND coach_id = $2`,
                    [clientId, req.user.id]
                ),
                pool.query('SELECT * FROM subscription_freezes WHERE client_id = $1', [clientId]),
                getFirstPlanActivation(clientId),
            ]);

            const currentStatus = computeSubscriptionStatus(
                existingTxResult.rows,
                existingFreezesResult.rows,
                planActivation
            );
            if (currentStatus === 'Active') startMode = 'queued';
        }

        const result = await pool.query(
            `INSERT INTO transactions
                (coach_id, client_id, client_name, package_variation, payment_method, amount, currency,
                 duration, type, status, notes, proof_image, transaction_date, subscription_start_date, start_mode)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
            [
                req.user.id,
                clientId || null,
                clientName.trim(),
                packageVariation?.trim() || null,
                paymentMethod.trim(),
                amt,
                currency.trim(),
                duration ? Number(duration) : null,
                type || 'subscription',
                status || 'completed',
                notes?.trim() || null,
                proofImage || null,
                date ? new Date(date) : new Date(),
                finalSubStartDate,
                startMode,
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
    const {
        id, clientName, clientId, packageVariation, paymentMethod, amount, currency,
        duration, type, status, notes, date, proofImage, subscriptionStartDate,
    } = req.body;

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

        // Re-derive start_mode when subscription_start_date changes
        let newStartMode = cur.start_mode || 'on_first_plan';
        let newSubStartDate = subscriptionStartDate !== undefined
            ? (subscriptionStartDate ? new Date(subscriptionStartDate) : null)
            : cur.subscription_start_date;

        if (subscriptionStartDate !== undefined) {
            newStartMode = subscriptionStartDate ? 'custom' : cur.start_mode === 'queued' ? 'queued' : 'on_first_plan';
        }

        const result = await pool.query(
            `UPDATE transactions
             SET client_id = $1, client_name = $2, package_variation = $3, payment_method = $4,
                 amount = $5, currency = $6, duration = $7, type = $8, status = $9,
                 notes = $10, proof_image = $11, transaction_date = $12,
                 subscription_start_date = $13, start_mode = $14
             WHERE id = $15 AND coach_id = $16
             RETURNING *`,
            [
                clientId   !== undefined ? (clientId || null)                       : cur.client_id,
                clientName !== undefined ? clientName.trim()                        : cur.client_name,
                packageVariation !== undefined ? (packageVariation?.trim() || null) : cur.package_variation,
                paymentMethod !== undefined ? paymentMethod.trim()                  : cur.payment_method,
                amt,
                currency   !== undefined ? currency.trim()                          : cur.currency,
                duration   !== undefined ? (duration ? Number(duration) : null)     : cur.duration,
                type       !== undefined ? type                                     : cur.type,
                status     !== undefined ? status                                   : cur.status,
                notes      !== undefined ? (notes?.trim() || null)                  : cur.notes,
                proofImage !== undefined ? (proofImage || null)                     : cur.proof_image,
                date       !== undefined ? new Date(date)                           : cur.transaction_date,
                newSubStartDate,
                newStartMode,
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
