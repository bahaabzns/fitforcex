const express = require('express');
const router = express.Router();
const pool = require('../db');
const bcrypt = require('bcrypt');
const authMiddleware = require('../middleware/auth');

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
    } catch (err) {
        console.error('clients bootstrap error:', err.message);
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
        subscription_status: row.subscription_status || 'Active',
        plain_password: row.plain_password,
        created_at: row.created_at,
    };
}

router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM clients WHERE coach_id = $1 ORDER BY client_code ASC',
            [req.user.id]
        );
        res.json(result.rows.map(mapClient));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/', async (req, res) => {
    // Accepts both old format {fname, lname} and new format {name}
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

        // Normalise phones array
        const phonesArray = Array.isArray(phones) && phones.length > 0
            ? phones
            : (phone ? [{ countryCode: '', number: phone }] : []);
        const phoneText = phonesArray[0]
            ? `${phonesArray[0].countryCode} ${phonesArray[0].number}`.trim()
            : null;

        const result = await pool.query(
            `INSERT INTO clients
                (client_code, fname, lname, email, phone, phones, current_package, subscription_status, coach_id, password, plain_password)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
            [
                nextCode, firstName, lastName, email,
                phoneText, JSON.stringify(phonesArray),
                currentPackage || null, 'Active',
                req.user.id, hashedPassword, password || null,
            ]
        );
        res.status(201).json(mapClient(result.rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM clients WHERE id = $1 AND coach_id = $2',
            [req.params.id, req.user.id]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Client not found' });
        res.json(mapClient(result.rows[0]));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/:id', async (req, res) => {
    const { fname, lname, email, phone, phones, currentPackage, subscriptionStatus } = req.body;
    try {
        const phonesArray = Array.isArray(phones) ? phones : undefined;
        const phoneText = phonesArray?.[0]
            ? `${phonesArray[0].countryCode} ${phonesArray[0].number}`.trim()
            : phone;

        const result = await pool.query(
            `UPDATE clients
             SET fname = $1, lname = $2, email = $3, phone = $4,
                 phones = COALESCE($5, phones),
                 current_package = COALESCE($6, current_package),
                 subscription_status = COALESCE($7, subscription_status)
             WHERE id = $8 AND coach_id = $9 RETURNING *`,
            [
                fname, lname, email, phoneText,
                phonesArray ? JSON.stringify(phonesArray) : null,
                currentPackage || null,
                subscriptionStatus || null,
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
