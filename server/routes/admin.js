const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const adminAuthMiddleware = require('../middleware/adminAuth');
const { loginLimiter } = require('../middleware/rateLimit');

router.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const result = await pool.query(
            'SELECT * FROM admins WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const admin = result.rows[0];
        const match = await bcrypt.compare(password, admin.password);

        if (!match) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { adminId: admin.id, isAdmin: true },
            process.env.ADMIN_JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.cookie('admin_token', token, {
            httpOnly: true,
            maxAge: 8 * 60 * 60 * 1000,
        }).status(200).json({
            message: 'Admin login successful',
            admin: { id: admin.id, email: admin.email, fname: admin.fname, lname: admin.lname },
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Login failed' });
    }
});

router.get('/me', adminAuthMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, email, fname, lname, created_at FROM admins WHERE id = $1',
            [req.admin.adminId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Admin not found' });
        }

        res.status(200).json(result.rows[0]);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch admin' });
    }
});

router.post('/logout', adminAuthMiddleware, (req, res) => {
    res.clearCookie('admin_token').status(200).json({ message: 'Logged out' });
});

module.exports = router;
