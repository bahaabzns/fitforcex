const express = require('express');

const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../db');
const jwt = require('jsonwebtoken');

;(async () => {
    try {
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS coach_slug TEXT UNIQUE`);
        await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS slug_customized BOOLEAN DEFAULT FALSE`);
    } catch (err) {
        console.error('auth bootstrap error:', err.message);
    }
})();

router.get('/test', (req, res) => {
    res.status(200).json({message: 'Auth route is working!'});
})



router.post('/register', async (req, res) => {
    try {
        const { fname, lname, email, password } = req.body;
        const hashed = await bcrypt.hash(password, 10);

        const rawSlug = email?.split('@')?.[0] || `${fname}-${lname}`;
        const normalizedSlug = rawSlug
            .toString()
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '') || `coach-${Date.now()}`;

        const slugResult = await pool.query(
            'SELECT coach_slug FROM users WHERE coach_slug = $1',
            [normalizedSlug]
        );
        const coachSlug = slugResult.rows.length > 0
            ? `${normalizedSlug}-${Date.now()}`
            : normalizedSlug;

        const result = await pool.query(
            'INSERT INTO users (fname, lname, email, password, coach_slug) VALUES ($1, $2, $3, $4, $5) RETURNING id, fname, lname, email, coach_slug',
            [fname, lname, email, hashed, coachSlug]
        )

        console.log('Registration successful:', result.rows[0]);
        res.status(201).json({
            id: result.rows[0].id,
            fname: result.rows[0].fname,
            lname: result.rows[0].lname,
            email: result.rows[0].email,
            coach_slug: result.rows[0].coach_slug,
            slug_customized: result.rows[0].slug_customized,
        });

    } catch (err) {
        console.log(err);
        res.status(500).json({message: 'Registration failed'});
    }
    
});




router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE email = $1',
            [email]
        )

        if (result.rows.length === 0 ) {
            return res.status(401).json({message: 'Invalid email or password'});
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);

        if (!match) {
            return res.status(401).json({message: 'Invalid email or password'});
        }

        const token = jwt.sign({
            id: user.id,
        }, process.env.JWT_SECRET, {expiresIn: '1h'});

        res.cookie('token', token, {
            httpOnly: true,
            maxAge: 7*24*60*60*1000, // 7 days
        }).status(200).json({
            message: 'Login successful',
            token,
            coach_slug: user.coach_slug,
            slug_customized: user.slug_customized,
        });


    } catch (err) {
        console.log(err);
        res.status(500).json({message: 'Login failed'});
    }
});


router.get('/me', async (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({message: 'Not authenticated'});
    }

    try {
        const decode = jwt.verify(token, process.env.JWT_SECRET);
        const user = await pool.query('SELECT id, fname, lname, email, coach_slug, slug_customized FROM users WHERE id = $1', 
            [decode.id]
        )

        if (user.rows.length === 0) {
            return res.status(404).json({message: 'User not found'});
        }

        res.status(200).json(user.rows[0]);

    } catch (err) {
        console.log(err);
        res.status(401).json({message: 'Expired or invalid token'});
    }
});

router.put('/coach-slug', async (req, res) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({ message: 'Not authenticated' });
    }

    const { new_slug } = req.body;
    if (!new_slug || new_slug.trim().length === 0) {
        return res.status(400).json({ message: 'Slug is required' });
    }

    try {
        const decode = jwt.verify(token, process.env.JWT_SECRET);

        // Check if already customized
        const userCheck = await pool.query(
            'SELECT slug_customized FROM users WHERE id = $1',
            [decode.id]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }

        if (userCheck.rows[0].slug_customized) {
            return res.status(403).json({ message: 'Slug customization is only allowed once' });
        }

        // Normalize the slug
        const normalized = new_slug
            .toString()
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/(^-|-$)/g, '');

        if (normalized.length === 0) {
            return res.status(400).json({ message: 'Slug must contain alphanumeric characters' });
        }

        // Check if slug is taken
        const slugCheck = await pool.query(
            'SELECT id FROM users WHERE coach_slug = $1 AND id != $2',
            [normalized, decode.id]
        );

        if (slugCheck.rows.length > 0) {
            return res.status(409).json({ message: 'Slug is already taken' });
        }

        // Update slug and mark as customized
        const result = await pool.query(
            'UPDATE users SET coach_slug = $1, slug_customized = TRUE WHERE id = $2 RETURNING id, fname, lname, email, coach_slug, slug_customized',
            [normalized, decode.id]
        );

        res.status(200).json(result.rows[0]);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update slug' });
    }
});


router.post('/logout', (req, res) => {
    res.clearCookie('token').status(200).json({message: 'Logged out successfully'});
});


module.exports = router;
