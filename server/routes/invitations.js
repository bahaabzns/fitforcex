const express = require('express');
const router = express.Router();
const { createId } = require('@paralleldrive/cuid2');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const { DEFAULT_PERMISSIONS } = require('../lib/defaultPermissions');
const { checkSeatLimit } = require('../lib/seatLimits');

router.use(authMiddleware);

// Get pending invitations for the current user
router.get('/me', async (req, res, next) => {
    try {
        const { rows } = await pool.query(
            `SELECT wi.id, wi.role, wi.message, wi.created_at,
                    w.id   AS workspace_id,
                    w.slug AS workspace_slug,
                    w.name AS workspace_name,
                    u.fname AS invited_by_fname,
                    u.lname AS invited_by_lname
             FROM workspace_invitations wi
             JOIN workspaces w ON w.id  = wi.workspace_id
             JOIN users u      ON u.id  = wi.invited_by_user_id
             WHERE wi.invited_user_id = $1 AND wi.status = 'pending'
             ORDER BY wi.created_at DESC`,
            [req.user.userId]
        );

        const invitations = rows.map(r => ({
            id: r.id,
            role: r.role,
            message: r.message,
            createdAt: r.created_at,
            workspace: { id: r.workspace_id, slug: r.workspace_slug, name: r.workspace_name },
            invitedBy: { fname: r.invited_by_fname, lname: r.invited_by_lname },
        }));

        res.json(invitations);
    } catch (err) {
        next(err);
    }
});

// Accept an invitation
router.post('/:id/accept', async (req, res, next) => {
    const invitationId = req.params.id;

    try {
        const { rows: invRows } = await pool.query(
            `SELECT * FROM workspace_invitations
             WHERE id = $1 AND invited_user_id = $2 AND status = 'pending'`,
            [invitationId, req.user.userId]
        );
        if (!invRows.length) return res.status(404).json({ message: 'Invitation not found or already responded' });
        const invitation = invRows[0];

        // Re-check seat limit in case plan was downgraded since invite was sent
        await checkSeatLimit(invitation.workspace_id);

        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const { rows: memberRows } = await client.query(
                `INSERT INTO workspace_members (workspace_id, user_id, role, permissions, id)
                 VALUES ($1, $2, $3, $4, $5)
                 RETURNING id, workspace_id, user_id, role, permissions, joined_at`,
                [invitation.workspace_id, req.user.userId, invitation.role,
                 JSON.stringify(DEFAULT_PERMISSIONS[invitation.role]), createId()]
            );

            await client.query(
                `UPDATE workspace_invitations SET status = 'accepted', responded_at = NOW()
                 WHERE id = $1`,
                [invitationId]
            );

            await client.query(
                `INSERT INTO workspace_audit_log (workspace_id, actor_user_id, action, target_type, target_id, id)
                 VALUES ($1, $2, 'member_added', 'workspace_member', $3, $4)`,
                [invitation.workspace_id, req.user.userId, memberRows[0].id, createId()]
            );

            await client.query('COMMIT');

            const { rows: wsRows } = await pool.query(
                'SELECT id, slug, name FROM workspaces WHERE id = $1',
                [invitation.workspace_id]
            );

            res.json({ member: memberRows[0], workspace: wsRows[0] });
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        } finally {
            client.release();
        }
    } catch (err) {
        if (err.status) return res.status(err.status).json({ message: err.message });
        if (err.code === '23505') return res.status(409).json({ message: 'You are already a member of this workspace' });
        next(err);
    }
});

// Decline an invitation
router.post('/:id/decline', async (req, res, next) => {
    const invitationId = req.params.id;

    try {
        const { rows } = await pool.query(
            `UPDATE workspace_invitations SET status = 'declined', responded_at = NOW()
             WHERE id = $1 AND invited_user_id = $2 AND status = 'pending'
             RETURNING id`,
            [invitationId, req.user.userId]
        );
        if (!rows.length) return res.status(404).json({ message: 'Invitation not found or already responded' });
        res.json({ message: 'Invitation declined' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
