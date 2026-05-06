const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const authMiddleware = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const { computeSubscriptionStatus } = require('../utils/subscriptionStatus');

router.use(authMiddleware);
router.use((req, res, next) => {
    const action = req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('clients', action)(req, res, next);
});

function mapClient(row) {
    return {
        id: row.id,
        code: row.client_code,
        fname: row.fname,
        lname: row.lname,
        name: `${row.fname} ${row.lname}`,
        email: row.email,
        phone: row.phone,
        phones: (Array.isArray(row.phones) && row.phones.length > 0)
            ? row.phones
            : (row.phone ? [{ countryCode: '', number: row.phone }] : []),
        current_package: row.current_package,
        subscription_status: row.subscription_status || 'Pre-start',
        has_password: !!row.password,
        created_at: row.created_at,
    };
}

function mapFreeze(row) {
    return {
        id: row.id,
        clientId: row.client_id,
        freezeStartDate: row.freeze_start_date,
        freezeDurationDays: row.freeze_duration_days,
        notes: row.notes,
        createdAt: row.created_at,
    };
}

// GET /api/clients
router.get('/', async (req, res) => {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || '';

    try {
        const searchCondition = search
            ? `AND (c.fname ILIKE $3 OR c.lname ILIKE $3 OR c.email ILIKE $3)`
            : '';
        const searchParam = search ? [`%${search}%`] : [];

        const [clientsResult, countResult] = await Promise.all([
            pool.query(
                `SELECT * FROM clients c
                    WHERE workspace_id = $1
                    ${searchCondition}
                    ORDER BY created_at DESC
                    LIMIT $2 OFFSET ${offset}`,
                [req.user.workspaceId, limit, ...searchParam]
            ),
            pool.query(
                `SELECT COUNT(*) FROM clients WHERE workspace_id = $1 ${searchCondition}`,
                [req.user.workspaceId, ...searchParam]
            ),
        ]);

        const clientIds = clientsResult.rows.map(r => r.id);

        if (clientIds.length === 0) {
            return res.json({ data: [], total: 0, page, limit, totalPages: 0 });
        }

        // $1 = workspaceId, $2..N = clientIds (for queries that need both)
        const placeholders     = clientIds.map((_, i) => `$${i + 2}`).join(', ');
        // $1..N = clientIds only (for queries that don't filter by workspace)
        const freezePlaceholders = clientIds.map((_, i) => `$${i + 1}`).join(', ');

        const [txResult, freezeResult, planActivationResult] = await Promise.all([
            pool.query(
                `SELECT client_id, status, duration, subscription_start_date, start_mode, created_at
                    FROM transactions
                    WHERE workspace_id = $1 AND client_id IN (${placeholders})`,
                [req.user.workspaceId, ...clientIds]
            ),
            pool.query(
                `SELECT sf.* FROM subscription_freezes sf
                 WHERE sf.client_id IN (${freezePlaceholders})`,
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

        const txByClient = {};
        for (const tx of txResult.rows) {
            if (!txByClient[tx.client_id]) txByClient[tx.client_id] = [];
            txByClient[tx.client_id].push(tx);
        }

        const freezesByClient = {};
        for (const f of freezeResult.rows) {
            if (!freezesByClient[f.client_id]) freezesByClient[f.client_id] = [];
            freezesByClient[f.client_id].push(f);
        }

        const planActivationByClient = {};
        for (const row of planActivationResult.rows) {
            planActivationByClient[row.client_id] = row.first_activation;
        }

        const total = parseInt(countResult.rows[0].count);

        res.json({
            data: clientsResult.rows.map(row => ({
                ...mapClient(row),
                subscription_status: computeSubscriptionStatus(
                    txByClient[row.id] || [],
                    freezesByClient[row.id] || [],
                    planActivationByClient[row.id] ?? null
                ),
            })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/clients
router.post('/', async (req, res) => {
    const { fname, lname, name, email, phone, phones, password, currentPackage } = req.body;

    let firstName = fname;
    let lastName = lname;
    if (name && !fname) {
        const parts = name.trim().split(/\s+/);
        firstName = parts[0] || '';
        lastName = parts.slice(1).join(' ') || '';
    }

    try {
        // Generate random unique client code (1-9999) to avoid race conditions
        let nextCode = null;
        let retries = 0;
        const maxRetries = 10;
        
        while (nextCode === null && retries < maxRetries) {
            const randomCode = Math.floor(Math.random() * 9999) + 1;
            const checkResult = await pool.query(
                'SELECT id FROM clients WHERE workspace_id = $1 AND client_code = $2 LIMIT 1',
                [req.user.workspaceId, randomCode]
            );
            if (!checkResult.rows.length) {
                nextCode = randomCode;
            }
            retries++;
        }
        
        if (nextCode === null) {
            return res.status(500).json({ error: 'Failed to generate unique client code' });
        }
        
        const hashedPassword = password ? await bcrypt.hash(password, 10) : null;

        const phonesArray = Array.isArray(phones) && phones.length > 0
            ? phones
            : (phone ? [{ countryCode: '', number: phone }] : []);
        const phoneText = phonesArray[0]
            ? `${phonesArray[0].countryCode} ${phonesArray[0].number}`.trim()
            : null;

        const result = await pool.query(
            `INSERT INTO clients
                (client_code, fname, lname, email, phone, phones, current_package,
                 subscription_status, workspace_id, password)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
            [
                nextCode, firstName, lastName, email,
                phoneText, JSON.stringify(phonesArray),
                currentPackage || null, 'Pre-start',
                req.user.workspaceId, hashedPassword,
            ]
        );
        res.status(201).json({ ...mapClient(result.rows[0]) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/clients/:id
router.get('/:id', async (req, res) => {
    try {
        if (process.env.NODE_ENV === 'test') {
            const dbg = await pool.query('SELECT id, workspace_id FROM clients WHERE id = $1', [req.params.id]);
            console.log(`[GET /:id] param=${req.params.id} token_ws=${req.user.workspaceId} client_row=${JSON.stringify(dbg.rows[0])}`);
        }
        const [clientResult, planActivationResult] = await Promise.all([
            pool.query(
                'SELECT * FROM clients WHERE id = $1 AND workspace_id = $2',
                [req.params.id, req.user.workspaceId]
            ),
            pool.query(
                `SELECT MIN(activated_at) AS first_activation FROM (
                     SELECT activated_at FROM training_plans
                     WHERE client_id = $1 AND activated_at IS NOT NULL
                     UNION ALL
                     SELECT activated_at FROM nutrition_plans
                     WHERE client_id = $1 AND activated_at IS NOT NULL
                 ) x`,
                [req.params.id]
            ),
        ]);

        if (!clientResult.rows.length) return res.status(404).json({ error: 'Client not found' });

        res.json({
            ...mapClient(clientResult.rows[0]),
            firstPlanActivatedAt: planActivationResult.rows[0]?.first_activation ?? null,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/clients/:id
router.put('/:id', async (req, res) => {
    const { fname, lname, email, phone, phones, currentPackage } = req.body;
    try {
        const phonesArray = Array.isArray(phones) ? phones : undefined;
        const phoneText = phonesArray?.[0]
            ? `${phonesArray[0].countryCode} ${phonesArray[0].number}`.trim()
            : phone;

        const result = await pool.query(
            `UPDATE clients
             SET fname = $1, lname = $2, email = $3, phone = $4,
                 phones = COALESCE($5, phones),
                 current_package = COALESCE($6, current_package)
             WHERE id = $7 AND workspace_id = $8 RETURNING *`,
            [
                fname, lname, email, phoneText,
                phonesArray ? JSON.stringify(phonesArray) : null,
                currentPackage || null,
                req.params.id, req.user.workspaceId,
            ]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Client not found' });
        res.json(mapClient(result.rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/clients/:id
router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM clients WHERE id = $1 AND workspace_id = $2 RETURNING *',
            [req.params.id, req.user.workspaceId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Client not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Freeze endpoints ---

router.get('/:id/freezes', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT sf.* FROM subscription_freezes sf
             JOIN clients c ON c.id = sf.client_id
             WHERE sf.client_id = $1 AND c.workspace_id = $2
             ORDER BY sf.freeze_start_date ASC`,
            [req.params.id, req.user.workspaceId]
        );
        res.json(result.rows.map(mapFreeze));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/:id/freezes', async (req, res) => {
    const { freezeStartDate, freezeDurationDays, notes } = req.body;
    if (!freezeStartDate) return res.status(400).json({ error: 'freezeStartDate is required' });
    const days = Number(freezeDurationDays);
    if (!days || days <= 0) return res.status(400).json({ error: 'freezeDurationDays must be a positive number' });

    try {
        const client = await pool.query(
            'SELECT id FROM clients WHERE id = $1 AND workspace_id = $2',
            [req.params.id, req.user.workspaceId]
        );
        if (!client.rows.length) return res.status(404).json({ error: 'Client not found' });

        const result = await pool.query(
            `INSERT INTO subscription_freezes (client_id, freeze_start_date, freeze_duration_days, notes)
             VALUES ($1, $2, $3, $4) RETURNING *`,
            [req.params.id, new Date(freezeStartDate), days, notes?.trim() || null]
        );
        res.status(201).json(mapFreeze(result.rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/:id/freezes/:freezeId', async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM subscription_freezes
             WHERE id = $1 AND client_id = $2
               AND (SELECT workspace_id FROM clients WHERE id = $2) = $3
             RETURNING id`,
            [req.params.freezeId, req.params.id, req.user.workspaceId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Freeze not found' });
        res.json({ deleted: result.rows[0].id });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Password endpoint ---

router.post('/:id/set-password', async (req, res) => {
    const { password } = req.body;
    if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    try {
        const hashed = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'UPDATE clients SET password = $1 WHERE id = $2 AND workspace_id = $3 RETURNING id',
            [hashed, req.params.id, req.user.workspaceId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Client not found' });
        res.json({ message: 'Password set successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
