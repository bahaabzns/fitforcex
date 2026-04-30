const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const authMiddleware = require('../middleware/auth');
const { computeSubscriptionStatus } = require('../utils/subscriptionStatus');

router.use(authMiddleware);

;(async () => {
    try {
        await pool.query(`
            ALTER TABLE clients
                ADD COLUMN IF NOT EXISTS phones JSONB DEFAULT '[]',
                ADD COLUMN IF NOT EXISTS current_package TEXT,
                ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'Active',
                ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS subscription_freezes (
                id                   SERIAL PRIMARY KEY,
                client_id            INTEGER NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
                freeze_start_date    DATE NOT NULL,
                freeze_duration_days INTEGER NOT NULL,
                notes                TEXT,
                created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
    } catch (err) {
        console.error('clients bootstrap error:', err.message);
    }
    // Columns needed for subscription status computation — run independently so a missing
    // table (transactions/training_plans/nutrition_plans) doesn't block the others.
    for (const sql of [
        `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS subscription_start_date DATE`,
        `ALTER TABLE transactions ADD COLUMN IF NOT EXISTS start_mode TEXT NOT NULL DEFAULT 'on_first_plan'`,
        `ALTER TABLE training_plans ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ`,
        `ALTER TABLE nutrition_plans ADD COLUMN IF NOT EXISTS activated_at TIMESTAMPTZ`,
    ]) {
        try { await pool.query(sql); } catch { /* table may not exist yet — own route will create it */ }
    }
})();

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
        plain_password: row.plain_password,
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
    try {
        const [clientsResult, txResult, freezeResult, planActivationResult] = await Promise.all([
            pool.query(
                'SELECT * FROM clients WHERE coach_id = $1 ORDER BY created_at DESC',
                [req.user.id]
            ),
            pool.query(
                `SELECT client_id, status, duration, subscription_start_date, start_mode, created_at
                 FROM transactions WHERE coach_id = $1 AND client_id IS NOT NULL`,
                [req.user.id]
            ),
            pool.query(
                `SELECT sf.* FROM subscription_freezes sf
                 INNER JOIN clients c ON c.id = sf.client_id
                 WHERE c.coach_id = $1`,
                [req.user.id]
            ),
            pool.query(
                `SELECT client_id, MIN(activated_at) AS first_activation
                 FROM (
                     SELECT client_id, activated_at FROM training_plans
                     WHERE coach_id = $1 AND activated_at IS NOT NULL
                     UNION ALL
                     SELECT client_id, activated_at FROM nutrition_plans
                     WHERE coach_id = $1 AND activated_at IS NOT NULL
                 ) combined
                 GROUP BY client_id`,
                [req.user.id]
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

        res.json(clientsResult.rows.map(row => ({
            ...mapClient(row),
            subscription_status: computeSubscriptionStatus(
                txByClient[row.id] || [],
                freezesByClient[row.id] || [],
                planActivationByClient[row.id] ?? null
            ),
        })));
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
        const codeResult = await pool.query(
            'SELECT COALESCE(MAX(client_code), 0) + 1 AS next_code FROM clients WHERE coach_id = $1',
            [req.user.id]
        );
        const nextCode = codeResult.rows[0].next_code;
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
                 subscription_status, coach_id, password, plain_password)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
            [
                nextCode, firstName, lastName, email,
                phoneText, JSON.stringify(phonesArray),
                currentPackage || null, 'Pre-start',
                req.user.id, hashedPassword, password || null,
            ]
        );
        res.status(201).json(mapClient(result.rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/clients/:id
router.get('/:id', async (req, res) => {
    try {
        const [clientResult, planActivationResult] = await Promise.all([
            pool.query(
                'SELECT * FROM clients WHERE id = $1 AND coach_id = $2',
                [req.params.id, req.user.id]
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
             WHERE id = $7 AND coach_id = $8 RETURNING *`,
            [
                fname, lname, email, phoneText,
                phonesArray ? JSON.stringify(phonesArray) : null,
                currentPackage || null,
                req.params.id, req.user.id,
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
            'DELETE FROM clients WHERE id = $1 AND coach_id = $2 RETURNING *',
            [req.params.id, req.user.id]
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
             WHERE sf.client_id = $1 AND c.coach_id = $2
             ORDER BY sf.freeze_start_date ASC`,
            [req.params.id, req.user.id]
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
            'SELECT id FROM clients WHERE id = $1 AND coach_id = $2',
            [req.params.id, req.user.id]
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
               AND (SELECT coach_id FROM clients WHERE id = $2) = $3
             RETURNING id`,
            [req.params.freezeId, req.params.id, req.user.id]
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
            'UPDATE clients SET password = $1, plain_password = $2 WHERE id = $3 AND coach_id = $4 RETURNING id',
            [hashed, password, req.params.id, req.user.id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Client not found' });
        res.json({ message: 'Password set successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
