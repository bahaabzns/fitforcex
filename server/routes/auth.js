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

// Fetch JWT payload fields for a specific workspace.
// Throws { status, message } if the user doesn't have access.
async function buildTokenForWorkspace(userId, workspaceId) {
    const { rows } = await pool.query(
        `SELECT w.id AS workspace_id, w.slug, w.name, w.owner_id,
                wm.role, wm.permissions, wm.is_active
         FROM workspaces w
         LEFT JOIN workspace_members wm
               ON wm.workspace_id = w.id AND wm.user_id = $1
         WHERE w.id = $2 AND w.archived_at IS NULL`,
        [userId, workspaceId]
    );

    if (!rows.length) throw { status: 403, message: 'Workspace not found or archived' };
    const ws = rows[0];
    const isOwner = ws.owner_id === userId;

    if (!isOwner && !ws.role) throw { status: 403, message: 'You do not have access to this workspace' };
    if (!isOwner && !ws.is_active) throw { status: 403, message: 'Your membership in this workspace is inactive' };

    return {
        workspaceId: ws.workspace_id,
        slug: ws.slug,
        name: ws.name,
        role: isOwner ? 'owner' : ws.role,
        permissions: isOwner ? null : ws.permissions,
    };
}

// Build token context for a user's default (or fallback) workspace.
async function buildToken(userId) {
    const { rows: userRows } = await pool.query(
        'SELECT default_workspace_id FROM users WHERE id = $1',
        [userId]
    );
    const defaultWorkspaceId = userRows[0]?.default_workspace_id;

    if (defaultWorkspaceId) {
        try {
            return await buildTokenForWorkspace(userId, defaultWorkspaceId);
        } catch {
            // default workspace may have been archived — fall through to any owned workspace
        }
    }

    const { rows: fallback } = await pool.query(
        'SELECT id FROM workspaces WHERE owner_id = $1 AND archived_at IS NULL ORDER BY created_at LIMIT 1',
        [userId]
    );
    if (!fallback.rows?.length && !fallback.length) {
        const anyWorkspace = fallback.rows ?? fallback;
        if (!anyWorkspace.length) throw new Error('No accessible workspace found');
    }

    const wsId = (fallback.rows ?? fallback)[0]?.id;
    if (!wsId) throw new Error('No accessible workspace found');
    return await buildTokenForWorkspace(userId, wsId);
}

// All workspaces the user can access (owned + active memberships).
async function fetchUserWorkspaces(userId) {
    const { rows: owned } = await pool.query(
        `SELECT w.id, w.slug, w.name, 'owner' AS role, NULL::jsonb AS permissions
         FROM workspaces w
         WHERE w.owner_id = $1 AND w.archived_at IS NULL
         ORDER BY w.created_at`,
        [userId]
    );

    const { rows: member } = await pool.query(
        `SELECT w.id, w.slug, w.name, wm.role, wm.permissions
         FROM workspace_members wm
         JOIN workspaces w ON w.id = wm.workspace_id
         WHERE wm.user_id = $1 AND wm.is_active = TRUE AND w.archived_at IS NULL
         ORDER BY wm.joined_at`,
        [userId]
    );

    return [...owned, ...member];
}

async function fetchPendingInvitationsCount(userId) {
    const { rows } = await pool.query(
        `SELECT COUNT(*) AS count FROM workspace_invitations
         WHERE invited_user_id = $1 AND status = 'pending'`,
        [userId]
    );
    return parseInt(rows[0].count);
}

function issueToken(payload) {
    return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });
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

        const userResult = await pool.query(
            'INSERT INTO users (fname, lname, email, password) VALUES ($1, $2, $3, $4) RETURNING id, fname, lname, email',
            [fname, lname, email, hashed]
        );
        const user = userResult.rows[0];

        const wsResult = await pool.query(
            `INSERT INTO workspaces (slug, name, owner_id, slug_customized, created_at)
             VALUES ($1, $2, $3, FALSE, NOW()) RETURNING id`,
            [slug, `${fname}'s Workspace`, user.id]
        );
        const workspaceId = wsResult.rows[0].id;

        await pool.query(
            'UPDATE users SET default_workspace_id = $1 WHERE id = $2',
            [workspaceId, user.id]
        );

        await pool.query(
            `INSERT INTO workspace_subscriptions (workspace_id, plan_id)
             VALUES ($1, (SELECT id FROM plans WHERE name = 'free'))`,
            [workspaceId]
        );

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

        const wsContext = await buildToken(user.id);
        const [workspaces, pendingInvitationsCount] = await Promise.all([
            fetchUserWorkspaces(user.id),
            fetchPendingInvitationsCount(user.id),
        ]);

        const token = issueToken({
            userId: user.id,
            workspaceId: wsContext.workspaceId,
            role: wsContext.role,
            permissions: wsContext.permissions,
        });

        res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 })
            .status(200)
            .json({
                message: 'Login successful',
                token,
                selectedWorkspace: {
                    id: wsContext.workspaceId,
                    slug: wsContext.slug,
                    name: wsContext.name,
                    role: wsContext.role,
                },
                workspaces,
                pendingInvitationsCount,
            });

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

        const [wsContext, workspaces, pendingInvitationsCount] = await Promise.all([
            buildTokenForWorkspace(user.id, decoded.workspaceId),
            fetchUserWorkspaces(user.id),
            fetchPendingInvitationsCount(user.id),
        ]);

        res.status(200).json({
            userId: user.id,
            fname: user.fname,
            lname: user.lname,
            email: user.email,
            currentWorkspace: {
                id: wsContext.workspaceId,
                slug: wsContext.slug,
                name: wsContext.name,
                role: wsContext.role,
                permissions: wsContext.permissions,
            },
            workspaces,
            pendingInvitationsCount,
            defaultWorkspaceId: user.default_workspace_id,
        });

    } catch {
        res.status(401).json({ message: 'Expired or invalid token' });
    }
});

// Issue a new JWT scoped to a different workspace the user has access to.
router.post('/switch-workspace', authMiddleware, async (req, res) => {
    const { workspaceId } = req.body;
    if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });

    try {
        const wsContext = await buildTokenForWorkspace(req.user.userId, parseInt(workspaceId));

        const token = issueToken({
            userId: req.user.userId,
            workspaceId: wsContext.workspaceId,
            role: wsContext.role,
            permissions: wsContext.permissions,
        });

        res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 })
            .status(200)
            .json({
                token,
                workspace: {
                    id: wsContext.workspaceId,
                    slug: wsContext.slug,
                    name: wsContext.name,
                    role: wsContext.role,
                },
            });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ message: err.message });
        console.error(err);
        res.status(500).json({ message: 'Failed to switch workspace' });
    }
});

// Set the user's default workspace (used on login).
router.put('/default-workspace', authMiddleware, async (req, res) => {
    const { workspaceId } = req.body;
    if (!workspaceId) return res.status(400).json({ message: 'workspaceId is required' });

    try {
        // Verify user has access to this workspace
        await buildTokenForWorkspace(req.user.userId, parseInt(workspaceId));

        await pool.query(
            'UPDATE users SET default_workspace_id = $1 WHERE id = $2',
            [workspaceId, req.user.userId]
        );

        res.json({ message: 'Default workspace updated' });
    } catch (err) {
        if (err.status) return res.status(err.status).json({ message: err.message });
        console.error(err);
        res.status(500).json({ message: 'Failed to update default workspace' });
    }
});

// Workspace slug customization (kept for backwards compatibility; also available at PUT /api/workspaces/:id/slug)
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

// Update personal profile (name and/or password)
router.patch('/profile', authMiddleware, async (req, res) => {
    const { fname, lname, currentPassword, newPassword } = req.body;

    if (!fname?.trim() && !lname?.trim() && !newPassword) {
        return res.status(400).json({ message: 'Nothing to update' });
    }

    try {
        const { rows } = await pool.query(
            'SELECT id, fname, lname, password FROM users WHERE id = $1',
            [req.user.userId]
        );
        if (!rows.length) return res.status(404).json({ message: 'User not found' });
        const user = rows[0];

        const updates = {};
        const params = [];

        if (fname?.trim()) updates.fname = fname.trim();
        if (lname?.trim() !== undefined) updates.lname = lname.trim();

        if (newPassword) {
            if (!currentPassword) {
                return res.status(400).json({ message: 'Current password is required to set a new one' });
            }
            const valid = await bcrypt.compare(currentPassword, user.password);
            if (!valid) return res.status(401).json({ message: 'Current password is incorrect' });
            updates.password = await bcrypt.hash(newPassword, 10);
        }

        if (!Object.keys(updates).length) {
            return res.status(400).json({ message: 'Nothing to update' });
        }

        const setClauses = Object.keys(updates).map((k, i) => { params.push(updates[k]); return `${k} = $${i + 1}`; });
        params.push(req.user.userId);
        const { rows: updated } = await pool.query(
            `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING id, fname, lname, email`,
            params
        );

        res.json(updated[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update profile' });
    }
});

module.exports = router;
