const express = require('express');
const router = express.Router();
const { createId } = require('@paralleldrive/cuid2');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// ── GET /api/messenger/threads ────────────────────────────────────────────────
// All threads for this workspace, each with latest message + unread count.
router.get('/threads', async (req, res, next) => {
    try {
        const { rows } = await pool.query(`
            SELECT
                t.id,
                t.client_id,
                t.status,
                t.updated_at,
                c.fname,
                c.lname,
                c.profile_image,
                (
                    SELECT body FROM messages m
                    WHERE m.thread_id = t.id
                    ORDER BY m.created_at DESC LIMIT 1
                ) AS latest_message,
                (
                    SELECT created_at FROM messages m
                    WHERE m.thread_id = t.id
                    ORDER BY m.created_at DESC LIMIT 1
                ) AS latest_message_at,
                (
                    SELECT COUNT(*) FROM messages m
                    WHERE m.thread_id = t.id AND m.sender_type = 'client' AND m.read_by_team_at IS NULL
                )::int AS unread_count
            FROM threads t
            JOIN clients c ON c.id = t.client_id
            WHERE t.workspace_id = $1
            ORDER BY COALESCE(
                (SELECT created_at FROM messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1),
                t.created_at
            ) DESC
        `, [req.user.workspaceId]);

        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// ── POST /api/messenger/threads ───────────────────────────────────────────────
// Create a thread for a client, or return the existing one.
router.post('/threads', async (req, res, next) => {
    const { clientId } = req.body;
    if (!clientId) return res.status(400).json({ error: 'clientId is required' });

    try {
        const clientCheck = await pool.query(
            'SELECT id FROM clients WHERE id = $1 AND workspace_id = $2',
            [clientId, req.user.workspaceId]
        );
        if (!clientCheck.rows.length) return res.status(404).json({ error: 'Client not found' });

        const { rows } = await pool.query(`
            INSERT INTO threads (id, workspace_id, client_id)
            VALUES ($1, $2, $3)
            ON CONFLICT (workspace_id, client_id) DO UPDATE SET updated_at = threads.updated_at
            RETURNING *
        `, [createId(), req.user.workspaceId, clientId]);

        res.status(201).json(rows[0]);
    } catch (err) {
        next(err);
    }
});

// ── GET /api/messenger/threads/:threadId/messages ─────────────────────────────
// All messages in a thread. Marks client messages as read by team.
router.get('/threads/:threadId/messages', async (req, res, next) => {
    try {
        const threadCheck = await pool.query(
            'SELECT id FROM threads WHERE id = $1 AND workspace_id = $2',
            [req.params.threadId, req.user.workspaceId]
        );
        if (!threadCheck.rows.length) return res.status(404).json({ error: 'Thread not found' });

        await pool.query(`
            UPDATE messages
            SET read_by_team_at = NOW()
            WHERE thread_id = $1 AND sender_type = 'client' AND read_by_team_at IS NULL
        `, [req.params.threadId]);

        const { rows } = await pool.query(`
            SELECT id, sender_type, sender_id, body, read_by_team_at, read_by_client_at, created_at
            FROM messages
            WHERE thread_id = $1
            ORDER BY created_at ASC
        `, [req.params.threadId]);

        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// ── POST /api/messenger/threads/:threadId/messages ────────────────────────────
// Send a message as the coach team.
router.post('/threads/:threadId/messages', async (req, res, next) => {
    const { body } = req.body;
    if (!body || !body.trim()) return res.status(400).json({ error: 'Message body is required' });

    try {
        const threadCheck = await pool.query(
            'SELECT id FROM threads WHERE id = $1 AND workspace_id = $2',
            [req.params.threadId, req.user.workspaceId]
        );
        if (!threadCheck.rows.length) return res.status(404).json({ error: 'Thread not found' });

        const { rows } = await pool.query(`
            INSERT INTO messages (id, thread_id, sender_type, sender_id, body, read_by_team_at)
            VALUES ($1, $2, 'team', $3, $4, NOW())
            RETURNING *
        `, [createId(), req.params.threadId, req.user.userId, body.trim()]);

        await pool.query(
            'UPDATE threads SET updated_at = NOW() WHERE id = $1',
            [req.params.threadId]
        );

        res.status(201).json(rows[0]);
    } catch (err) {
        next(err);
    }
});

// ── PATCH /api/messenger/threads/:threadId/status ─────────────────────────────
// Open or close a thread.
router.patch('/threads/:threadId/status', async (req, res, next) => {
    const { status } = req.body;
    if (!['open', 'closed'].includes(status)) {
        return res.status(400).json({ error: 'status must be open or closed' });
    }

    try {
        const { rows } = await pool.query(`
            UPDATE threads SET status = $1, updated_at = NOW()
            WHERE id = $2 AND workspace_id = $3
            RETURNING *
        `, [status, req.params.threadId, req.user.workspaceId]);

        if (!rows.length) return res.status(404).json({ error: 'Thread not found' });
        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
