const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../db');
const jwt = require('jsonwebtoken');
const { loginLimiter } = require('../middleware/rateLimit');
const authMiddleware = require('../middleware/auth');
const requireOwner = require('../middleware/requireOwner');

// ── helpers ───────────────────────────────────────────────────────────────────

function normalizeSlug(raw) {
    return raw
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

async function buildToken(userId) {
    // Fetch the user's default workspace + role
    const { rows } = await pool.query(
        `SELECT w.id AS workspace_id, w.owner_id,
                wm.role, wm.permissions
         FROM users u
         JOIN workspaces w ON w.id = u.default_workspace_id
         LEFT JOIN workspace_members wm
               ON wm.workspace_id = w.id AND wm.user_id = u.id
         WHERE u.id = $1 AND w.archived_at IS NULL`,
        [userId]
    );

    if (!rows.length) {
        // Fallback: user's own workspace (id = userId) from migration
        const fallback = await pool.query(
            `SELECT id AS workspace_id, owner_id FROM workspaces WHERE owner_id = $1 AND archived_at IS NULL LIMIT 1`,
            [userId]
        );
        if (!fallback.rows.length) throw new Error('No accessible workspace found');
        const ws = fallback.rows[0];
        return { workspaceId: ws.workspace_id, role: 'owner', permissions: null };
    }

    const ws = rows[0];
    const isOwner = ws.owner_id === userId;
    return {
        workspaceId: ws.workspace_id,
        role: isOwner ? 'owner' : ws.role,
        permissions: isOwner ? null : ws.permissions,
    };
}

// ── routes ────────────────────────────────────────────────────────────────────

router.get('/test', (req, res) => {
    res.status(200).json({ message: 'Auth route is working!' });
});

router.post('/register', async (req, res) => {
    try {
        const { fname, lname, email, password } = req.body;
        const hashed = await bcrypt.hash(password, 10);

        const rawSlug = email?.split('@')?.[0] || `${fname}-${lname}`;
        const normalizedSlug = normalizeSlug(rawSlug) || `coach-${Date.now()}`;

        const { rows: slugRows } = await pool.query(
            'SELECT slug FROM workspaces WHERE slug = $1',
            [normalizedSlug]
        );
        const slug = slugRows.length > 0 ? `${normalizedSlug}-${Date.now()}` : normalizedSlug;

        // Insert user
        const userResult = await pool.query(
            'INSERT INTO users (fname, lname, email, password) VALUES ($1, $2, $3, $4) RETURNING id, fname, lname, email',
            [fname, lname, email, hashed]
        );
        const user = userResult.rows[0];

        // Create workspace for the new user
        const wsResult = await pool.query(
            `INSERT INTO workspaces (slug, name, owner_id, slug_customized, created_at)
             VALUES ($1, $2, $3, FALSE, NOW()) RETURNING id`,
            [slug, `${fname}'s Workspace`, user.id]
        );
        const workspaceId = wsResult.rows[0].id;

        // Set default workspace
        await pool.query(
            'UPDATE users SET default_workspace_id = $1 WHERE id = $2',
            [workspaceId, user.id]
        );

        // Seed free plan subscription
        await pool.query(
            `INSERT INTO workspace_subscriptions (workspace_id, plan_id)
             VALUES ($1, (SELECT id FROM plans WHERE name = 'free'))`,
            [workspaceId]
        );

        console.log('Registration successful:', user);
        res.status(201).json({
            id: user.id,
            fname: user.fname,
            lname: user.lname,
            email: user.email,
            workspace_slug: slug,
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Registration failed' });
    }
});

router.post('/login', loginLimiter, async (req, res) => {
    const { email, password } = req.body;

    try {
        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const user = result.rows[0];
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const { workspaceId, role, permissions } = await buildToken(user.id);

        const token = jwt.sign(
            { userId: user.id, workspaceId, role, permissions },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 })
            .status(200)
            .json({ message: 'Login successful', token });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Login failed' });
    }
});

router.get('/me', async (req, res) => {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Not authenticated' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        const { rows } = await pool.query(
            'SELECT id, fname, lname, email, default_workspace_id FROM users WHERE id = $1',
            [decoded.userId]
        );
        if (!rows.length) return res.status(404).json({ message: 'User not found' });

        const user = rows[0];
        const { workspaceId, role, permissions } = await buildToken(user.id);

        res.status(200).json({
            userId: user.id,
            fname: user.fname,
            lname: user.lname,
            email: user.email,
            currentWorkspace: { id: workspaceId, role, permissions },
            defaultWorkspaceId: user.default_workspace_id,
        });

    } catch {
        res.status(401).json({ message: 'Expired or invalid token' });
    }
});

// Workspace slug customization (owner-only; slug now lives on workspaces table)
router.put('/workspace-slug', authMiddleware, requireOwner, async (req, res) => {
    const { new_slug } = req.body;
    if (!new_slug?.trim()) return res.status(400).json({ message: 'Slug is required' });

    try {
        const wsCheck = await pool.query(
            'SELECT slug_customized FROM workspaces WHERE id = $1',
            [req.user.workspaceId]
        );
        if (!wsCheck.rows.length) return res.status(404).json({ message: 'Workspace not found' });
        if (wsCheck.rows[0].slug_customized) {
            return res.status(403).json({ message: 'Slug customization is only allowed once' });
        }

        const normalized = normalizeSlug(new_slug);
        if (!normalized) return res.status(400).json({ message: 'Slug must contain alphanumeric characters' });

        const conflict = await pool.query(
            'SELECT id FROM workspaces WHERE slug = $1 AND id != $2',
            [normalized, req.user.workspaceId]
        );
        if (conflict.rows.length) return res.status(409).json({ message: 'Slug is already taken' });

        const result = await pool.query(
            'UPDATE workspaces SET slug = $1, slug_customized = TRUE WHERE id = $2 RETURNING id, slug, slug_customized',
            [normalized, req.user.workspaceId]
        );
        res.status(200).json(result.rows[0]);

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update slug' });
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('token').status(200).json({ message: 'Logged out successfully' });
});

module.exports = router;
