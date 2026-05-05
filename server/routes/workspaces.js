const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const requireOwner = require('../middleware/requireOwner');
const requirePermission = require('../middleware/requirePermission');
const { DEFAULT_PERMISSIONS, VALID_ROLES } = require('../lib/defaultPermissions');
const { checkSeatLimit, checkWorkspaceLimit } = require('../lib/seatLimits');

router.use(authMiddleware);

function normalizeSlug(raw) {
    return raw
        .toString()
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
}

// Ensures the :id param matches the user's current workspace context from their JWT.
function sameWorkspace(req, res, next) {
    if (parseInt(req.params.id) !== req.user.workspaceId) {
        return res.status(403).json({ message: 'You do not have access to this workspace' });
    }
    next();
}

// ── Create workspace ──────────────────────────────────────────────────────────

router.post('/', async (req, res) => {
    const { name, slug } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: 'Workspace name is required' });

    try {
        await checkWorkspaceLimit(req.user.userId);

        const rawSlug = slug?.trim() || name;
        let normalizedSlug = normalizeSlug(rawSlug) || `workspace-${Date.now()}`;

        const { rows: conflict } = await pool.query(
            'SELECT id FROM workspaces WHERE slug = $1',
            [normalizedSlug]
        );
        if (conflict.length) normalizedSlug = `${normalizedSlug}-${Date.now()}`;

        const { rows } = await pool.query(
            `INSERT INTO workspaces (slug, name, owner_id, slug_customized, created_at)
             VALUES ($1, $2, $3, $4, NOW()) RETURNING id, slug, name, owner_id, created_at`,
            [normalizedSlug, name.trim(), req.user.userId, !!slug?.trim()]
        );
        const workspace = rows[0];

        await pool.query(
            `INSERT INTO workspace_subscriptions (workspace_id, plan_id)
             VALUES ($1, (SELECT id FROM plans WHERE name = 'free'))`,
            [workspace.id]
        );

        res.status(201).json(workspace);
    } catch (err) {
        if (err.status) return res.status(err.status).json({ message: err.message });
        console.error(err);
        res.status(500).json({ message: 'Failed to create workspace' });
    }
});

// ── Get workspace details ─────────────────────────────────────────────────────

router.get('/:id', sameWorkspace, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT w.id, w.slug, w.name, w.owner_id, w.slug_customized, w.created_at,
                    p.name AS plan_name, p.display_name AS plan_display_name,
                    p.max_team_seats, p.max_workspaces,
                    u.fname AS owner_fname, u.lname AS owner_lname, u.email AS owner_email,
                    (SELECT COUNT(*) FROM workspace_members wm
                     WHERE wm.workspace_id = w.id AND wm.is_active = TRUE) AS member_count,
                    (SELECT COUNT(*) FROM clients c WHERE c.workspace_id = w.id) AS client_count
             FROM workspaces w
             JOIN workspace_subscriptions ws ON ws.workspace_id = w.id
             JOIN plans p ON p.id = ws.plan_id
             JOIN users u ON u.id = w.owner_id
             WHERE w.id = $1 AND w.archived_at IS NULL`,
            [req.user.workspaceId]
        );
        if (!rows.length) return res.status(404).json({ message: 'Workspace not found' });
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch workspace' });
    }
});

// ── Update slug ───────────────────────────────────────────────────────────────

router.put('/:id/slug', sameWorkspace, requireOwner, async (req, res) => {
    const { slug } = req.body;
    if (!slug?.trim()) return res.status(400).json({ message: 'Slug is required' });

    try {
        const { rows: wsRows } = await pool.query(
            'SELECT slug_customized FROM workspaces WHERE id = $1',
            [req.user.workspaceId]
        );
        if (!wsRows.length) return res.status(404).json({ message: 'Workspace not found' });
        if (wsRows[0].slug_customized) {
            return res.status(403).json({ message: 'Slug customization is only allowed once' });
        }

        const normalized = normalizeSlug(slug.trim());
        if (!normalized) return res.status(400).json({ message: 'Slug must contain alphanumeric characters' });

        const { rows: conflict } = await pool.query(
            'SELECT id FROM workspaces WHERE slug = $1 AND id != $2',
            [normalized, req.user.workspaceId]
        );
        if (conflict.length) return res.status(409).json({ message: 'Slug is already taken' });

        const { rows } = await pool.query(
            `UPDATE workspaces SET slug = $1, slug_customized = TRUE
             WHERE id = $2 RETURNING id, slug, slug_customized`,
            [normalized, req.user.workspaceId]
        );
        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update slug' });
    }
});

// ── Archive workspace (soft delete) ──────────────────────────────────────────

router.delete('/:id', sameWorkspace, requireOwner, async (req, res) => {
    try {
        const { rows } = await pool.query(
            `UPDATE workspaces SET archived_at = NOW()
             WHERE id = $1 AND owner_id = $2 AND archived_at IS NULL
             RETURNING id`,
            [req.user.workspaceId, req.user.userId]
        );
        if (!rows.length) return res.status(404).json({ message: 'Workspace not found or already archived' });

        await pool.query(
            `INSERT INTO workspace_audit_log (workspace_id, actor_user_id, action, target_type, target_id)
             VALUES ($1, $2, 'workspace_archived', 'workspace', $1)`,
            [req.user.workspaceId, req.user.userId]
        );

        res.json({ message: 'Workspace archived' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to archive workspace' });
    }
});

// ── Team members ──────────────────────────────────────────────────────────────

router.get('/:id/members', sameWorkspace, requirePermission('team', 'read'), async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT wm.id, wm.user_id, wm.role, wm.permissions, wm.is_active, wm.joined_at,
                    u.fname, u.lname, u.email
             FROM workspace_members wm
             JOIN users u ON u.id = wm.user_id
             WHERE wm.workspace_id = $1
             ORDER BY wm.joined_at`,
            [req.user.workspaceId]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch members' });
    }
});

// Direct add — owner-only, bypasses invitation flow
router.post('/:id/members', sameWorkspace, requireOwner, async (req, res) => {
    const { email, role } = req.body;
    if (!email?.trim()) return res.status(400).json({ message: 'Email is required' });
    if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }

    try {
        await checkSeatLimit(req.user.workspaceId);

        const { rows: userRows } = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email.trim().toLowerCase()]
        );
        if (!userRows.length) return res.status(400).json({ message: 'This email is not registered on FitForce' });
        const targetUserId = userRows[0].id;

        if (targetUserId === req.user.userId) return res.status(400).json({ message: 'You cannot add yourself' });

        const { rows: wsRows } = await pool.query('SELECT owner_id FROM workspaces WHERE id = $1', [req.user.workspaceId]);
        if (wsRows[0].owner_id === targetUserId) {
            return res.status(400).json({ message: 'This person is already the workspace owner' });
        }

        const { rows: existing } = await pool.query(
            'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
            [req.user.workspaceId, targetUserId]
        );
        if (existing.length) return res.status(409).json({ message: 'This person is already in your workspace' });

        const { rows } = await pool.query(
            `INSERT INTO workspace_members (workspace_id, user_id, role, permissions)
             VALUES ($1, $2, $3, $4)
             RETURNING id, workspace_id, user_id, role, permissions, is_active, joined_at`,
            [req.user.workspaceId, targetUserId, role, JSON.stringify(DEFAULT_PERMISSIONS[role])]
        );

        await pool.query(
            `INSERT INTO workspace_audit_log (workspace_id, actor_user_id, action, target_type, target_id)
             VALUES ($1, $2, 'member_added', 'workspace_member', $3)`,
            [req.user.workspaceId, req.user.userId, rows[0].id]
        );

        res.status(201).json(rows[0]);
    } catch (err) {
        if (err.status) return res.status(err.status).json({ message: err.message });
        if (err.code === '23505') return res.status(409).json({ message: 'This person is already in your workspace' });
        console.error(err);
        res.status(500).json({ message: 'Failed to add member' });
    }
});

// Update member role (owner: any role; manager: can't touch managers)
router.put('/:id/members/:memberId', sameWorkspace, async (req, res) => {
    const { role } = req.body;
    if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }

    const memberId = parseInt(req.params.memberId);

    try {
        const { rows: memberRows } = await pool.query(
            'SELECT id, user_id, role FROM workspace_members WHERE id = $1 AND workspace_id = $2',
            [memberId, req.user.workspaceId]
        );
        if (!memberRows.length) return res.status(404).json({ message: 'Member not found' });
        const member = memberRows[0];

        if (member.user_id === req.user.userId) {
            return res.status(403).json({ message: 'You cannot modify your own role' });
        }

        if (!req.user.isOwner) {
            if (!req.user.permissions?.team?.write) {
                return res.status(403).json({ message: 'Insufficient permissions' });
            }
            if (member.role === 'manager' || role === 'manager') {
                return res.status(403).json({ message: 'Managers cannot assign or modify the manager role' });
            }
        }

        const { rows } = await pool.query(
            `UPDATE workspace_members SET role = $1, permissions = $2
             WHERE id = $3 RETURNING id, role, permissions`,
            [role, JSON.stringify(DEFAULT_PERMISSIONS[role]), memberId]
        );

        await pool.query(
            `INSERT INTO workspace_audit_log (workspace_id, actor_user_id, action, target_type, target_id, metadata)
             VALUES ($1, $2, 'role_changed', 'workspace_member', $3, $4)`,
            [req.user.workspaceId, req.user.userId, memberId,
             JSON.stringify({ old_role: member.role, new_role: role })]
        );

        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update member role' });
    }
});

// Update member permissions (owner-only fine-grained override)
router.put('/:id/members/:memberId/permissions', sameWorkspace, requireOwner, async (req, res) => {
    const { permissions } = req.body;
    if (!permissions || typeof permissions !== 'object') {
        return res.status(400).json({ message: 'Permissions object is required' });
    }

    const memberId = parseInt(req.params.memberId);

    try {
        const { rows: memberRows } = await pool.query(
            'SELECT id FROM workspace_members WHERE id = $1 AND workspace_id = $2',
            [memberId, req.user.workspaceId]
        );
        if (!memberRows.length) return res.status(404).json({ message: 'Member not found' });

        const { rows } = await pool.query(
            'UPDATE workspace_members SET permissions = $1 WHERE id = $2 RETURNING id, role, permissions',
            [JSON.stringify(permissions), memberId]
        );

        await pool.query(
            `INSERT INTO workspace_audit_log (workspace_id, actor_user_id, action, target_type, target_id)
             VALUES ($1, $2, 'permissions_updated', 'workspace_member', $3)`,
            [req.user.workspaceId, req.user.userId, memberId]
        );

        res.json(rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to update permissions' });
    }
});

// Remove member (owner: any; manager: can't remove managers)
router.delete('/:id/members/:memberId', sameWorkspace, async (req, res) => {
    const memberId = parseInt(req.params.memberId);

    try {
        const { rows: memberRows } = await pool.query(
            'SELECT id, user_id, role FROM workspace_members WHERE id = $1 AND workspace_id = $2',
            [memberId, req.user.workspaceId]
        );
        if (!memberRows.length) return res.status(404).json({ message: 'Member not found' });
        const member = memberRows[0];

        if (member.user_id === req.user.userId) {
            return res.status(400).json({ message: 'You cannot remove yourself' });
        }

        if (!req.user.isOwner) {
            if (!req.user.permissions?.team?.delete) {
                return res.status(403).json({ message: 'Insufficient permissions' });
            }
            if (member.role === 'manager') {
                return res.status(403).json({ message: 'Managers cannot remove other managers' });
            }
        }

        await pool.query('DELETE FROM workspace_members WHERE id = $1', [memberId]);

        await pool.query(
            `INSERT INTO workspace_audit_log (workspace_id, actor_user_id, action, target_type, target_id)
             VALUES ($1, $2, 'member_removed', 'workspace_member', $3)`,
            [req.user.workspaceId, req.user.userId, memberId]
        );

        res.json({ message: 'Member removed' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to remove member' });
    }
});

// ── Invitations (workspace-scoped) ────────────────────────────────────────────

router.get('/:id/invitations', sameWorkspace, requirePermission('team', 'read'), async (req, res) => {
    try {
        const { rows } = await pool.query(
            `SELECT wi.id, wi.invited_user_id, wi.role, wi.message, wi.status, wi.created_at,
                    u.fname, u.lname, u.email,
                    inv.fname AS invited_by_fname, inv.lname AS invited_by_lname
             FROM workspace_invitations wi
             JOIN users u   ON u.id  = wi.invited_user_id
             JOIN users inv ON inv.id = wi.invited_by_user_id
             WHERE wi.workspace_id = $1
             ORDER BY wi.created_at DESC`,
            [req.user.workspaceId]
        );
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to fetch invitations' });
    }
});

router.post('/:id/invitations', sameWorkspace, async (req, res) => {
    const { email, role, message } = req.body;
    if (!email?.trim()) return res.status(400).json({ message: 'Email is required' });
    if (!VALID_ROLES.includes(role)) {
        return res.status(400).json({ message: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` });
    }

    if (!req.user.isOwner && !req.user.permissions?.team?.write) {
        return res.status(403).json({ message: 'Insufficient permissions' });
    }

    try {
        await checkSeatLimit(req.user.workspaceId);

        const { rows: userRows } = await pool.query(
            'SELECT id FROM users WHERE email = $1',
            [email.trim().toLowerCase()]
        );
        if (!userRows.length) return res.status(400).json({ message: 'This email is not registered on FitForce' });
        const targetUserId = userRows[0].id;

        if (targetUserId === req.user.userId) return res.status(400).json({ message: 'You cannot invite yourself' });

        const { rows: wsRows } = await pool.query('SELECT owner_id FROM workspaces WHERE id = $1', [req.user.workspaceId]);
        if (wsRows[0].owner_id === targetUserId) {
            return res.status(400).json({ message: 'This person is already the workspace owner' });
        }

        const { rows: existingMember } = await pool.query(
            'SELECT id FROM workspace_members WHERE workspace_id = $1 AND user_id = $2 AND is_active = TRUE',
            [req.user.workspaceId, targetUserId]
        );
        if (existingMember.length) return res.status(409).json({ message: 'This person is already in your workspace' });

        const { rows: existingInvite } = await pool.query(
            `SELECT id FROM workspace_invitations WHERE workspace_id = $1 AND invited_user_id = $2 AND status = 'pending'`,
            [req.user.workspaceId, targetUserId]
        );
        if (existingInvite.length) return res.status(409).json({ message: 'A pending invitation already exists for this user' });

        const { rows } = await pool.query(
            `INSERT INTO workspace_invitations (workspace_id, invited_by_user_id, invited_user_id, role, message)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, workspace_id, invited_user_id, role, message, status, created_at`,
            [req.user.workspaceId, req.user.userId, targetUserId, role, message || null]
        );

        await pool.query(
            `INSERT INTO workspace_audit_log (workspace_id, actor_user_id, action, target_type, target_id)
             VALUES ($1, $2, 'invite_sent', 'invitation', $3)`,
            [req.user.workspaceId, req.user.userId, rows[0].id]
        );

        res.status(201).json(rows[0]);
    } catch (err) {
        if (err.status) return res.status(err.status).json({ message: err.message });
        if (err.code === '23505') return res.status(409).json({ message: 'A pending invitation already exists for this user' });
        console.error(err);
        res.status(500).json({ message: 'Failed to send invitation' });
    }
});

router.delete('/:id/invitations/:invitationId', sameWorkspace, async (req, res) => {
    if (!req.user.isOwner && !req.user.permissions?.team?.write) {
        return res.status(403).json({ message: 'Insufficient permissions' });
    }

    const invitationId = parseInt(req.params.invitationId);

    try {
        const { rows: invRows } = await pool.query(
            'SELECT id, status FROM workspace_invitations WHERE id = $1 AND workspace_id = $2',
            [invitationId, req.user.workspaceId]
        );
        if (!invRows.length) return res.status(404).json({ message: 'Invitation not found' });
        if (invRows[0].status !== 'pending') {
            return res.status(400).json({ message: 'Cannot cancel an invitation that has already been responded to' });
        }

        await pool.query('DELETE FROM workspace_invitations WHERE id = $1', [invitationId]);

        await pool.query(
            `INSERT INTO workspace_audit_log (workspace_id, actor_user_id, action, target_type, target_id)
             VALUES ($1, $2, 'invite_cancelled', 'invitation', $3)`,
            [req.user.workspaceId, req.user.userId, invitationId]
        );

        res.json({ message: 'Invitation cancelled' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to cancel invitation' });
    }
});

// ── Transfer ownership ────────────────────────────────────────────────────────

router.post('/:id/transfer-ownership', sameWorkspace, requireOwner, async (req, res) => {
    const { memberId, ownerPassword } = req.body;
    if (!memberId) return res.status(400).json({ message: 'Member ID is required' });
    if (!ownerPassword) return res.status(400).json({ message: 'Owner password is required' });

    try {
        const { rows: ownerRows } = await pool.query(
            'SELECT password FROM users WHERE id = $1',
            [req.user.userId]
        );
        if (!ownerRows.length) return res.status(404).json({ message: 'Owner not found' });
        const valid = await bcrypt.compare(ownerPassword, ownerRows[0].password);
        if (!valid) return res.status(401).json({ message: 'Incorrect password' });

        const { rows: memberRows } = await pool.query(
            'SELECT id, user_id, role FROM workspace_members WHERE id = $1 AND workspace_id = $2 AND is_active = TRUE',
            [memberId, req.user.workspaceId]
        );
        if (!memberRows.length) return res.status(400).json({ message: 'Member not found or is inactive' });
        const targetUserId = memberRows[0].user_id;

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            await client.query(
                'UPDATE workspaces SET owner_id = $1 WHERE id = $2',
                [targetUserId, req.user.workspaceId]
            );

            await client.query(
                'DELETE FROM workspace_members WHERE user_id = $1 AND workspace_id = $2',
                [targetUserId, req.user.workspaceId]
            );

            await client.query(
                `INSERT INTO workspace_members (workspace_id, user_id, role, permissions)
                 VALUES ($1, $2, 'manager', $3)`,
                [req.user.workspaceId, req.user.userId, JSON.stringify(DEFAULT_PERMISSIONS.manager)]
            );

            await client.query(
                `INSERT INTO workspace_audit_log (workspace_id, actor_user_id, action, target_type, target_id, metadata)
                 VALUES ($1, $2, 'ownership_transferred', 'workspace', $1, $3)`,
                [req.user.workspaceId, req.user.userId,
                 JSON.stringify({ old_owner: req.user.userId, new_owner: targetUserId })]
            );

            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }

        res.json({ message: 'Ownership transferred successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Failed to transfer ownership' });
    }
});

module.exports = router;
