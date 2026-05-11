const express = require('express');
const router = express.Router();
const path = require('path');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const { makeUploader, createSignedUrl } = require('../lib/storage');
const { computeSubscriptionStatus } = require('../utils/subscriptionStatus');

router.use(authMiddleware);
router.use((req, res, next) => {
    const action = req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('finance', action)(req, res, next);
});

const VALID_STATUSES = ['completed', 'refunded'];
const VALID_TYPES = ['subscription', 'session', 'one-time', 'other'];
const VALID_START_MODES = ['on_first_plan', 'custom', 'queued'];

const upload = makeUploader(
    'transactions',
    ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf'],
    { maxSize: 5 * 1024 * 1024 }
);

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

// Compute per-transaction subscription status for all transactions grouped by client.
// Returns { [txId]: 'Active'|'Pre-start'|'Expired'|'Frozen'|'Refunded' }
function computePerTxStatuses(txByClient, freezesByClient, planActivationByClient) {
    const result = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const [clientId, allTxs] of Object.entries(txByClient)) {
        const freezes = freezesByClient[clientId] || [];
        const firstActivation = planActivationByClient[clientId] ?? null;

        for (const tx of allTxs) {
            if (tx.status === 'refunded') { result[tx.id] = 'Refunded'; }
        }

        const completed = allTxs
            .filter(tx => tx.status === 'completed' && tx.duration && Number(tx.duration) > 0)
            .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

        let prevEnd = null;
        for (const tx of completed) {
            let start;
            const mode = tx.start_mode || 'on_first_plan';

            if (mode === 'custom' && tx.subscription_start_date) {
                start = new Date(tx.subscription_start_date);
            } else if (prevEnd !== null) {
                start = new Date(prevEnd);
            } else if (firstActivation) {
                start = new Date(firstActivation);
            } else {
                result[tx.id] = 'Pre-start';
                continue;
            }
            start.setHours(0, 0, 0, 0);

            let endMs = start.getTime() + Number(tx.duration) * 86400000;
            for (const freeze of freezes) {
                const fs = new Date(freeze.freeze_start_date);
                fs.setHours(0, 0, 0, 0);
                if (fs >= start && fs.getTime() < endMs) {
                    endMs += Number(freeze.freeze_duration_days) * 86400000;
                }
            }

            prevEnd = new Date(endMs);

            if (today < start) {
                result[tx.id] = 'Pre-start';
            } else if (today >= prevEnd) {
                result[tx.id] = 'Expired';
            } else {
                let frozen = false;
                for (const freeze of freezes) {
                    const fs = new Date(freeze.freeze_start_date);
                    fs.setHours(0, 0, 0, 0);
                    const fe = new Date(fs.getTime() + Number(freeze.freeze_duration_days) * 86400000);
                    if (today >= fs && today < fe) { frozen = true; break; }
                }
                result[tx.id] = frozen ? 'Frozen' : 'Active';
            }
        }
    }
    return result;
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

// GET /api/transactions/proof/:filename — authenticated, ownership-checked
router.get('/proof/:filename', async (req, res, next) => {
    const filename = path.basename(req.params.filename);
    const dbPath = `/api/transactions/proof/${filename}`;
    const s3Key  = `transactions/${filename}`;
    try {
        const result = await pool.query(
            'SELECT id FROM transactions WHERE proof_image = $1 AND workspace_id = $2',
            [dbPath, req.user.workspaceId]
        );
        if (!result.rows.length) return res.status(403).json({ error: 'Forbidden' });
        const url = await createSignedUrl(s3Key);
        res.redirect(url);
    } catch (err) {
        next(err);
    }
});

// POST /api/transactions/upload-proof
router.post('/upload-proof', upload.single('proof'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const filename = path.basename(req.file.key);
    res.json({ path: `/api/transactions/proof/${filename}` });
});

// GET /api/transactions/by-client/:clientId
router.get('/by-client/:clientId', async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT * FROM transactions
             WHERE workspace_id = $1 AND (client_id = $2 OR (client_id IS NULL AND client_name ILIKE (
                 SELECT CONCAT(fname, ' ', lname) FROM clients WHERE id = $2 AND workspace_id = $1 LIMIT 1
             )))
             ORDER BY transaction_date DESC`,
            [req.user.workspaceId, req.params.clientId]
        );
        res.json(result.rows.map(mapRow));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/transactions
router.get('/', async (req, res, next) => {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    try {
        const [txResult, countResult] = await Promise.all([
            pool.query(
                `SELECT * FROM transactions
                 WHERE workspace_id = $1
                 ORDER BY created_at DESC
                 LIMIT $2 OFFSET $3`,
                [req.user.workspaceId, limit, offset]
            ),
            pool.query(
                'SELECT COUNT(*) FROM transactions WHERE workspace_id = $1',
                [req.user.workspaceId]
            ),
        ]);

        const clientIds = [...new Set(txResult.rows.map(r => r.client_id).filter(Boolean))];

        let txStatuses = {};
        if (clientIds.length > 0) {
            const placeholders       = clientIds.map((_, i) => `$${i + 2}`).join(', ');
            const freezePlaceholders = clientIds.map((_, i) => `$${i + 1}`).join(', ');

            const [allClientTxResult, freezeResult, planActivationResult] = await Promise.all([
                pool.query(
                    `SELECT client_id, status, duration, subscription_start_date, start_mode, created_at
                     FROM transactions WHERE workspace_id = $1 AND client_id IN (${placeholders})`,
                    [req.user.workspaceId, ...clientIds]
                ),
                pool.query(
                    `SELECT sf.* FROM subscription_freezes sf WHERE sf.client_id IN (${freezePlaceholders})`,
                    clientIds
                ),
                pool.query(
                    `SELECT client_id, MIN(activated_at) AS first_activation
                     FROM (
                         SELECT client_id, activated_at FROM training_plans
                         WHERE workspace_id = $1 AND client_id IN (${placeholders}) AND activated_at IS NOT NULL
                         UNION ALL
                         SELECT client_id, activated_at FROM nutrition_plans
                         WHERE workspace_id = $1 AND client_id IN (${placeholders}) AND activated_at IS NOT NULL
                     ) combined
                     GROUP BY client_id`,
                    [req.user.workspaceId, ...clientIds]
                ),
            ]);

            const freezesByClient = {};
            for (const f of freezeResult.rows) {
                if (!freezesByClient[f.client_id]) freezesByClient[f.client_id] = [];
                freezesByClient[f.client_id].push(f);
            }
            const planActivationByClient = {};
            for (const row of planActivationResult.rows) {
                planActivationByClient[row.client_id] = row.first_activation;
            }
            const txByClient = {};
            for (const tx of allClientTxResult.rows) {
                if (tx.client_id == null) continue;
                if (!txByClient[tx.client_id]) txByClient[tx.client_id] = [];
                txByClient[tx.client_id].push(tx);
            }

            txStatuses = computePerTxStatuses(txByClient, freezesByClient, planActivationByClient);
        }

        const total = parseInt(countResult.rows[0].count);

        res.json({
            data: txResult.rows.map(row => ({
                ...mapRow(row),
                subscriptionStatus: txStatuses[row.id] ?? null,
            })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (err) {
        next(err);
    }
});


// POST /api/transactions
router.post('/', async (req, res, next) => {
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
                     FROM transactions WHERE client_id = $1 AND workspace_id = $2`,
                    [clientId, req.user.workspaceId]
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
                (workspace_id, client_id, client_name, package_variation, payment_method, amount, currency,
                 duration, type, status, notes, proof_image, transaction_date, subscription_start_date, start_mode)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) RETURNING *`,
            [
                req.user.workspaceId,
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
        next(err);
    }
});

// PUT /api/transactions
router.put('/:id', async (req, res, next) => {
    const id = parseInt(req.params.id);
    const {
        clientName, clientId, packageVariation, paymentMethod, amount, currency,
        duration, type, status, notes, date, proofImage, subscriptionStartDate,
    } = req.body;

    if (!id) return res.status(400).json({ error: 'id is required' });
    if (type !== undefined && !VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid type' });
    if (status !== undefined && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    try {
        const existing = await pool.query(
            'SELECT * FROM transactions WHERE id = $1 AND workspace_id = $2',
            [id, req.user.workspaceId]
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
                WHERE id = $15 AND workspace_id = $16
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
                req.user.workspaceId,
            ]
        );
        res.json(mapRow(result.rows[0]));
    } catch (err) {
        next(err);
    }
});

// DELETE /api/transactions?id=X
router.delete('/:id', async (req, res, next) => {
    const id = parseInt(req.params.id);
    
    if (!id) return res.status(400).json({ error: 'id is required' });

    try {
        const result = await pool.query(
            'DELETE FROM transactions WHERE id = $1 AND workspace_id = $2 RETURNING id',
            [id, req.user.workspaceId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Transaction not found' });
        res.json({ deleted: result.rows[0].id });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
