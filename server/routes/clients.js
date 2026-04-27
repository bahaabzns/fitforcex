const express = require('express');

const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM clients WHERE coach_id = $1 ORDER BY client_code ASC', [req.user.id]);
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});



router.post('/', async (req, res) => {
    const { fname, lname, email, phone } = req.body;
    try {
        const codeResult = await pool.query('SELECT COALESCE(MAX(client_code), 0) + 1 AS next_code FROM clients WHERE coach_id = $1', [req.user.id]);
        const nextCode = codeResult.rows[0].next_code;

        const result = await pool.query(
            'INSERT INTO clients (client_code, fname, lname, email, phone, coach_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
            [nextCode, fname, lname, email, phone, req.user.id]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});


router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM clients WHERE id =$1 AND coach_id = $2', [req.params.id, req.user.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/:id', async (req, res) => {
    const { fname, lname, email, phone } = req.body;
    try {
        const result = await pool.query(
            'UPDATE clients SET fname = $1, lname = $2, email = $3, phone = $4 WHERE id = $5 AND coach_id = $6 RETURNING *',
            [fname, lname, email, phone, req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        return res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM clients WHERE id = $1 AND coach_id = $2 RETURNING *', [req.params.id, req.user.id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Client not found' });
        }

        return res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;