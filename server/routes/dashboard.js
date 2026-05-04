const express = require('express');
const authMiddleware = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const pool = require('../db');

const router = express.Router();

router.get('/', authMiddleware, requirePermission('clients', 'read'), async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, fname, lname, email FROM users WHERE id = $1',
            [req.user.userId]
        );
        return res.status(200).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        return res.status(500).json({ message: 'Server error' });
    }
});

module.exports = router;
