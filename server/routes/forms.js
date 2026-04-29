const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

router.use(authMiddleware);

// ── Forms ──────────────────────────────────────────────────────────────────────

router.get('/', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT f.*, COUNT(fq.id)::int AS question_count
             FROM forms f
             LEFT JOIN form_questions fq ON fq.form_id = f.id
             WHERE f.workspace_id = $1
             GROUP BY f.id
             ORDER BY f.created_at DESC`,
            [req.user.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/', async (req, res) => {
    const { title, description } = req.body;
    try {
        const result = await pool.query(
            `INSERT INTO forms (workspace_id, title, description)
             VALUES ($1, $2, $3)
             RETURNING *, 0 AS question_count`,
            [req.user.id, title || 'Untitled Form', description || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/:id', async (req, res) => {
    const { title, description, status } = req.body;
    try {
        const result = await pool.query(
            `UPDATE forms
             SET title = COALESCE($1, title),
                 description = COALESCE($2, description),
                 status = COALESCE($3, status),
                 updated_at = NOW()
             WHERE id = $4 AND workspace_id = $5
             RETURNING *`,
            [title, description, status, req.params.id, req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Form not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM forms WHERE id = $1 AND workspace_id = $2 RETURNING *',
            [req.params.id, req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Form not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── Questions ──────────────────────────────────────────────────────────────────

router.get('/:id/questions', async (req, res) => {
    try {
        // Verify form belongs to this coach
        const form = await pool.query(
            'SELECT id FROM forms WHERE id = $1 AND workspace_id = $2',
            [req.params.id, req.user.id]
        );
        if (form.rows.length === 0) return res.status(404).json({ error: 'Form not found' });

        const result = await pool.query(
            'SELECT * FROM form_questions WHERE form_id = $1 ORDER BY order_index ASC, id ASC',
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/:id/questions', async (req, res) => {
    const { label, type } = req.body;
    try {
        // Get next order_index
        const countResult = await pool.query(
            'SELECT COALESCE(MAX(order_index), -1) + 1 AS next_index FROM form_questions WHERE form_id = $1',
            [req.params.id]
        );
        const orderIndex = countResult.rows[0].next_index;

        // Set sensible defaults based on type
        const defaults = {
            min_value: type === 'scale' ? 1 : null,
            max_value: type === 'scale' ? 10 : null,
            options: ['select', 'multiselect'].includes(type) ? [] : null,
        };

        const result = await pool.query(
            `INSERT INTO form_questions (form_id, label, type, order_index, min_value, max_value, options)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [req.params.id, label || 'Question', type || 'text', orderIndex,
             defaults.min_value, defaults.max_value,
             defaults.options !== null ? JSON.stringify(defaults.options) : null]
        );

        // Update form updated_at
        await pool.query('UPDATE forms SET updated_at = NOW() WHERE id = $1', [req.params.id]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/:id/questions/:qid', async (req, res) => {
    const { label, type, required, placeholder, options, min_value, max_value } = req.body;
    try {
        const result = await pool.query(
            `UPDATE form_questions
             SET label       = COALESCE($1, label),
                 type        = COALESCE($2, type),
                 required    = COALESCE($3, required),
                 placeholder = COALESCE($4, placeholder),
                 options     = COALESCE($5, options),
                 min_value   = COALESCE($6, min_value),
                 max_value   = COALESCE($7, max_value)
             WHERE id = $8 AND form_id = $9
             RETURNING *`,
            [label, type, required, placeholder,
             options !== undefined ? JSON.stringify(options) : undefined,
             min_value, max_value,
             req.params.qid, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Question not found' });

        await pool.query('UPDATE forms SET updated_at = NOW() WHERE id = $1', [req.params.id]);

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/:id/questions/:qid', async (req, res) => {
    try {
        const result = await pool.query(
            'DELETE FROM form_questions WHERE id = $1 AND form_id = $2 RETURNING *',
            [req.params.qid, req.params.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Question not found' });

        await pool.query('UPDATE forms SET updated_at = NOW() WHERE id = $1', [req.params.id]);

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/:id/questions/reorder', async (req, res) => {
    // req.body.order = [{ id, order_index }, ...]
    const { order } = req.body;
    try {
        await Promise.all(
            order.map(({ id, order_index }) =>
                pool.query('UPDATE form_questions SET order_index = $1 WHERE id = $2 AND form_id = $3',
                    [order_index, id, req.params.id])
            )
        );
        await pool.query('UPDATE forms SET updated_at = NOW() WHERE id = $1', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
