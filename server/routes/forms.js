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

// ── Form Requests (coach → client) ────────────────────────────────────────────

// POST /api/forms/requests — coach requests one or more forms from a client
router.post('/requests', async (req, res) => {
    const { form_ids, client_id } = req.body;
    if (!form_ids || !Array.isArray(form_ids) || form_ids.length === 0) {
        return res.status(400).json({ error: 'form_ids array is required' });
    }
    if (!client_id) return res.status(400).json({ error: 'client_id is required' });
    try {
        // Verify client belongs to this workspace
        const clientCheck = await pool.query(
            'SELECT id FROM clients WHERE id = $1 AND coach_id = $2',
            [client_id, req.user.id]
        );
        if (clientCheck.rows.length === 0) return res.status(403).json({ error: 'Client not found' });

        const inserted = [];
        for (const form_id of form_ids) {
            // Verify form belongs to this workspace
            const formCheck = await pool.query(
                'SELECT id FROM forms WHERE id = $1 AND workspace_id = $2',
                [form_id, req.user.id]
            );
            if (formCheck.rows.length === 0) continue;

            const result = await pool.query(
                `INSERT INTO form_requests (form_id, client_id, workspace_id)
                 VALUES ($1, $2, $3) RETURNING *`,
                [form_id, client_id, req.user.id]
            );
            inserted.push(result.rows[0]);
        }
        res.status(201).json(inserted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/forms/requests/client/:client_id — get all form requests for a client
router.get('/requests/client/:client_id', async (req, res) => {
    try {
        const clientCheck = await pool.query(
            'SELECT id FROM clients WHERE id = $1 AND coach_id = $2',
            [req.params.client_id, req.user.id]
        );
        if (clientCheck.rows.length === 0) return res.status(403).json({ error: 'Client not found' });

        const result = await pool.query(
            `SELECT fr.id, fr.status, fr.requested_at, fr.submitted_at,
                    f.id AS form_id, f.title AS form_title, f.description AS form_description
             FROM form_requests fr
             JOIN forms f ON f.id = fr.form_id
             WHERE fr.client_id = $1 AND fr.workspace_id = $2
             ORDER BY fr.requested_at DESC`,
            [req.params.client_id, req.user.id]
        );

        // For submitted ones, also attach responses with question labels
        const requests = await Promise.all(result.rows.map(async (req_row) => {
            if (req_row.status === 'pending') return { ...req_row, responses: [] };
            const responses = await pool.query(
                `SELECT fr.answer, fq.label, fq.type, fq.order_index
                 FROM form_responses fr
                 JOIN form_questions fq ON fq.id = fr.question_id
                 WHERE fr.request_id = $1
                 ORDER BY fq.order_index ASC, fq.id ASC`,
                [req_row.id]
            );
            return { ...req_row, responses: responses.rows };
        }));

        res.json(requests);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/forms/queue — coach queue across all clients
router.get('/queue', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT fr.id, fr.status, fr.requested_at, fr.submitted_at, fr.form_id,
                    f.title AS form_title,
                    c.id AS client_id, c.client_code, c.fname, c.lname, c.email,
                    NULL::text AS client_package,
                    NULL::text AS subscription_status
             FROM form_requests fr
             JOIN forms f ON f.id = fr.form_id
             JOIN clients c ON c.id = fr.client_id
             WHERE fr.workspace_id = $1
             ORDER BY fr.requested_at DESC`,
            [req.user.id]
        );

        const queueItems = await Promise.all(result.rows.map(async (row) => {
            if (row.status === 'pending') {
                return {
                    id: row.id,
                    clientId: row.client_id,
                    clientCode: row.client_code,
                    clientName: `${row.fname} ${row.lname}`.trim(),
                    clientEmail: row.email,
                    clientPackage: row.client_package,
                    subscriptionStatus: row.subscription_status,
                    formId: row.form_id,
                    formTitle: row.form_title,
                    requestedAt: row.requested_at,
                    submittedAt: null,
                    actionTakenAt: null,
                    status: 'awaiting',
                    answers: {},
                    responses: [],
                };
            }

            const responsesResult = await pool.query(
                `SELECT fr.question_id, fr.answer, fq.label, fq.type, fq.order_index
                 FROM form_responses fr
                 JOIN form_questions fq ON fq.id = fr.question_id
                 WHERE fr.request_id = $1
                 ORDER BY fq.order_index ASC, fq.id ASC`,
                [row.id]
            );

            const answers = {};
            for (const response of responsesResult.rows) {
                answers[response.question_id] = response.answer;
            }

            return {
                id: row.id,
                clientId: row.client_id,
                clientCode: row.client_code,
                clientName: `${row.fname} ${row.lname}`.trim(),
                clientEmail: row.email,
                clientPackage: row.client_package,
                subscriptionStatus: row.subscription_status,
                formId: row.form_id,
                formTitle: row.form_title,
                requestedAt: row.requested_at,
                submittedAt: row.submitted_at,
                actionTakenAt: row.status === 'reviewed' ? row.submitted_at : null,
                status: row.status === 'reviewed' ? 'action-done' : 'need-action',
                answers,
                responses: responsesResult.rows,
            };
        }));

        res.json(queueItems);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/forms/queue/review — mark queue items as reviewed
router.patch('/queue/review', async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids array is required' });
    }

    try {
        const result = await pool.query(
            `UPDATE form_requests
             SET status = 'reviewed'
             WHERE workspace_id = $1
               AND id::text = ANY($2::text[])
               AND status <> 'pending'
             RETURNING id`,
            [req.user.id, ids.map(String)]
        );

        res.json({ updatedIds: result.rows.map(r => r.id) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/forms/requests/:request_id — cancel a pending request
router.delete('/requests/:request_id', async (req, res) => {
    try {
        const result = await pool.query(
            `DELETE FROM form_requests
             WHERE id = $1 AND workspace_id = $2 AND status = 'pending'
             RETURNING *`,
            [req.params.request_id, req.user.id]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Request not found or already submitted' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
