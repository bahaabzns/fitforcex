const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');

router.use(authMiddleware);
router.use((req, res, next) => {
    const action = req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('forms', action)(req, res, next);
});

let schemaReadyPromise;

function normalizePostAction(value) {
    const allowed = ['nothing', 'nutrition-plan', 'workout-plan'];
    return allowed.includes(value) ? value : 'nothing';
}

function normalizeFormType(value) {
    const allowed = ['assessment', 'check-in'];
    return allowed.includes(value) ? value : 'check-in';
}

async function ensureFormsQueueSchema() {
    if (!schemaReadyPromise) {
        schemaReadyPromise = (async () => {
            await pool.query(`ALTER TABLE forms ADD COLUMN IF NOT EXISTS post_action TEXT NOT NULL DEFAULT 'nothing'`);
            await pool.query(`ALTER TABLE forms ADD COLUMN IF NOT EXISTS form_type TEXT NOT NULL DEFAULT 'check-in'`);

            await pool.query(`ALTER TABLE form_requests ADD COLUMN IF NOT EXISTS post_action TEXT NOT NULL DEFAULT 'nothing'`);
            await pool.query(`ALTER TABLE form_requests ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ`);
            await pool.query(`ALTER TABLE form_requests ADD COLUMN IF NOT EXISTS action_taken_at TIMESTAMPTZ`);
        })();
    }

    await schemaReadyPromise;
}

async function activateDueScheduledRequests(workspaceId) {
    await pool.query(
        `UPDATE form_requests
         SET status = 'pending',
             requested_at = COALESCE(requested_at, NOW())
         WHERE workspace_id = $1
           AND status = 'scheduled'
           AND scheduled_at IS NOT NULL
           AND scheduled_at <= NOW()`,
        [workspaceId]
    );
}

router.use(async (req, res, next) => {
    try {
        await ensureFormsQueueSchema();
        next();
    } catch (err) {
        next(err);
    }
});

// ── Forms ──────────────────────────────────────────────────────────────────────

router.get('/', async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT f.*, COUNT(fq.id)::int AS question_count
             FROM forms f
             LEFT JOIN form_questions fq ON fq.form_id = f.id
             WHERE f.workspace_id = $1
             GROUP BY f.id
             ORDER BY f.created_at DESC`,
            [req.user.workspaceId]
        );
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

router.post('/', async (req, res, next) => {
    const { title_en, title_ar, description_en, description_ar, postAction, formType } = req.body;
    const safePostAction = normalizePostAction(postAction);
    const safeFormType = normalizeFormType(formType);
    try {
        const result = await pool.query(
            `INSERT INTO forms (workspace_id, title_en, title_ar, description_en, description_ar, post_action, form_type)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *, 0 AS question_count`,
            [req.user.workspaceId, title_en || 'Untitled Form', title_ar || null, description_en || null, description_ar || null, safePostAction, safeFormType]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

router.put('/:id', async (req, res, next) => {
    const { title_en, title_ar, description_en, description_ar, status, postAction, formType } = req.body;
    const safePostAction = postAction !== undefined ? normalizePostAction(postAction) : undefined;
    const safeFormType = formType !== undefined ? normalizeFormType(formType) : undefined;
    try {
        const result = await pool.query(
            `UPDATE forms
             SET title_en       = COALESCE($1, title_en),
                 title_ar       = COALESCE($2, title_ar),
                 description_en = COALESCE($3, description_en),
                 description_ar = COALESCE($4, description_ar),
                 status         = COALESCE($5, status),
                 post_action    = COALESCE($6, post_action),
                 form_type      = COALESCE($7, form_type),
                 updated_at     = NOW()
             WHERE id = $8 AND workspace_id = $9
             RETURNING *`,
            [title_en, title_ar, description_en, description_ar, status, safePostAction, safeFormType, req.params.id, req.user.workspaceId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Form not found' });
        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

router.delete('/:id', async (req, res, next) => {
    try {
        const result = await pool.query(
            'DELETE FROM forms WHERE id = $1 AND workspace_id = $2 RETURNING *',
            [req.params.id, req.user.workspaceId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Form not found' });
        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

// ── Questions ──────────────────────────────────────────────────────────────────

router.get('/:id/questions', async (req, res, next) => {
    try {
        // Verify form belongs to this coach
        const form = await pool.query(
            'SELECT id FROM forms WHERE id = $1 AND workspace_id = $2',
            [req.params.id, req.user.workspaceId]
        );
        if (form.rows.length === 0) return res.status(404).json({ error: 'Form not found' });

        const result = await pool.query(
            'SELECT * FROM form_questions WHERE form_id = $1 ORDER BY order_index ASC, id ASC',
            [req.params.id]
        );
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

router.post('/:id/questions', async (req, res, next) => {
    const { label_en, label_ar, type } = req.body;
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
            `INSERT INTO form_questions (form_id, label_en, label_ar, type, order_index, min_value, max_value, options)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
             RETURNING *`,
            [req.params.id, label_en || 'Question', label_ar || null, type || 'text', orderIndex,
             defaults.min_value, defaults.max_value,
             defaults.options !== null ? JSON.stringify(defaults.options) : null]
        );

        // Update form updated_at
        await pool.query('UPDATE forms SET updated_at = NOW() WHERE id = $1', [req.params.id]);

        res.status(201).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

router.put('/:id/questions/:qid', async (req, res, next) => {
    const { label_en, label_ar, type, required, placeholder_en, placeholder_ar, options, options_ar, min_value, max_value } = req.body;
    try {
        const result = await pool.query(
            `UPDATE form_questions
             SET label_en       = COALESCE($1, label_en),
                 label_ar       = COALESCE($2, label_ar),
                 type           = COALESCE($3, type),
                 required       = COALESCE($4, required),
                 placeholder_en = COALESCE($5, placeholder_en),
                 placeholder_ar = COALESCE($6, placeholder_ar),
                 options        = COALESCE($7, options),
                 options_ar     = COALESCE($8, options_ar),
                 min_value      = COALESCE($9, min_value),
                 max_value      = COALESCE($10, max_value)
             WHERE id = $11 AND form_id = $12
             RETURNING *`,
            [label_en, label_ar,
             type, required,
             placeholder_en, placeholder_ar,
             options !== undefined ? JSON.stringify(options) : undefined,
             options_ar !== undefined ? JSON.stringify(options_ar) : undefined,
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

router.delete('/:id/questions/:qid', async (req, res, next) => {
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

router.put('/:id/questions/reorder', async (req, res, next) => {
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
        next(err);
    }
});

// ── Form Requests (coach → client) ────────────────────────────────────────────

// POST /api/forms/requests — coach requests one or more forms from a client
router.post('/requests', async (req, res, next) => {
    const { form_ids, client_id, mode, scheduled_at } = req.body;
    const requestMode = mode === 'schedule' ? 'schedule' : 'now';

    if (!form_ids || !Array.isArray(form_ids) || form_ids.length === 0) {
        return res.status(400).json({ error: 'form_ids array is required' });
    }
    if (!client_id) return res.status(400).json({ error: 'client_id is required' });

    let scheduledAt = null;
    if (requestMode === 'schedule') {
        if (!scheduled_at) return res.status(400).json({ error: 'scheduled_at is required when mode is schedule' });
        scheduledAt = new Date(scheduled_at);
        if (Number.isNaN(scheduledAt.getTime())) return res.status(400).json({ error: 'scheduled_at is invalid' });
        if (scheduledAt.getTime() <= Date.now()) return res.status(400).json({ error: 'scheduled_at must be in the future' });
    }

    try {
        // Verify client belongs to this workspace
        const clientCheck = await pool.query(
            'SELECT id FROM clients WHERE id = $1 AND workspace_id = $2',
            [client_id, req.user.workspaceId]
        );
        if (clientCheck.rows.length === 0) return res.status(403).json({ error: 'Client not found' });

        const inserted = [];
        for (const form_id of form_ids) {
            // Verify form belongs to this workspace
            const formCheck = await pool.query(
                'SELECT id, post_action FROM forms WHERE id = $1 AND workspace_id = $2',
                [form_id, req.user.workspaceId]
            );
            if (formCheck.rows.length === 0) continue;

            const formPostAction = normalizePostAction(formCheck.rows[0].post_action);
            const initialStatus = requestMode === 'schedule' ? 'scheduled' : 'pending';

            const result = await pool.query(
                `INSERT INTO form_requests (form_id, client_id, workspace_id, status, scheduled_at, post_action)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [form_id, client_id, req.user.workspaceId, initialStatus, scheduledAt, formPostAction]
            );
            inserted.push(result.rows[0]);
        }
        res.status(201).json(inserted);
    } catch (err) {
        next(err);
    }
});

// GET /api/forms/requests/client/:client_id — get all form requests for a client
router.get('/requests/client/:client_id', async (req, res, next) => {
    try {
        await activateDueScheduledRequests(req.user.workspaceId);

        const clientCheck = await pool.query(
            'SELECT id FROM clients WHERE id = $1 AND workspace_id = $2',
            [req.params.client_id, req.user.workspaceId]
        );
        if (clientCheck.rows.length === 0) return res.status(403).json({ error: 'Client not found' });

        const result = await pool.query(
            `SELECT fr.id, fr.status, fr.requested_at, fr.submitted_at, fr.scheduled_at, fr.post_action,
                    f.id AS form_id,
                    f.title_en AS form_title_en, f.title_ar AS form_title_ar,
                    f.description_en AS form_description_en, f.description_ar AS form_description_ar,
                    f.post_action AS form_post_action, f.form_type
             FROM form_requests fr
             JOIN forms f ON f.id = fr.form_id
             WHERE fr.client_id = $1 AND fr.workspace_id = $2
             ORDER BY COALESCE(fr.scheduled_at, fr.requested_at) DESC`,
            [req.params.client_id, req.user.workspaceId]
        );

        // For submitted ones, also attach responses with question labels
        const requests = await Promise.all(result.rows.map(async (req_row) => {
            if (req_row.status === 'pending' || req_row.status === 'scheduled') {
                return {
                    ...req_row,
                    post_action: req_row.post_action || req_row.form_post_action || 'nothing',
                    responses: [],
                };
            }
            const responses = await pool.query(
                `SELECT fr.answer, fq.label_en, fq.label_ar, fq.type, fq.order_index
                 FROM form_responses fr
                 JOIN form_questions fq ON fq.id = fr.question_id
                 WHERE fr.request_id = $1
                 ORDER BY fq.order_index ASC, fq.id ASC`,
                [req_row.id]
            );
            return {
                ...req_row,
                post_action: req_row.post_action || req_row.form_post_action || 'nothing',
                responses: responses.rows,
            };
        }));

        res.json(requests);
    } catch (err) {
        next(err);
    }
});

// GET /api/forms/queue — coach queue across all clients
router.get('/queue', async (req, res, next) => {
    try {
        await activateDueScheduledRequests(req.user.workspaceId);

        const result = await pool.query(
            `SELECT fr.id, fr.status, fr.requested_at, fr.submitted_at, fr.form_id,
                    fr.scheduled_at, fr.post_action, fr.action_taken_at,
                    f.title_en AS form_title_en, f.title_ar AS form_title_ar,
                    f.form_type, f.post_action AS form_post_action,
                    c.id AS client_id, c.client_code, c.fname, c.lname, c.email,
                    NULL::text AS client_package,
                    NULL::text AS subscription_status
             FROM form_requests fr
             JOIN forms f ON f.id = fr.form_id
             JOIN clients c ON c.id = fr.client_id
             WHERE fr.workspace_id = $1
             ORDER BY fr.requested_at DESC`,
            [req.user.workspaceId]
        );

        const queueItems = await Promise.all(result.rows.map(async (row) => {
            if (row.status === 'pending' || row.status === 'scheduled') {
                return {
                    id: row.id,
                    clientId: row.client_id,
                    clientCode: row.client_code,
                    clientName: `${row.fname} ${row.lname}`.trim(),
                    clientEmail: row.email,
                    clientPackage: row.client_package,
                    subscriptionStatus: row.subscription_status,
                    formId: row.form_id,
                    formTitle_en: row.form_title_en,
                    formTitle_ar: row.form_title_ar,
                    formType: row.form_type || 'check-in',
                    postAction: normalizePostAction(row.post_action || row.form_post_action),
                    requestedAt: row.requested_at,
                    scheduledAt: row.scheduled_at,
                    submittedAt: null,
                    actionTakenAt: null,
                    status: row.status === 'scheduled' ? 'scheduled' : 'awaiting',
                    answers: {},
                    responses: [],
                };
            }

            const responsesResult = await pool.query(
                `SELECT fr.question_id, fr.answer, fq.label_en, fq.label_ar, fq.type, fq.order_index
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
                formTitle_en: row.form_title_en,
                formTitle_ar: row.form_title_ar,
                formType: row.form_type || 'check-in',
                postAction: normalizePostAction(row.post_action || row.form_post_action),
                requestedAt: row.requested_at,
                scheduledAt: row.scheduled_at,
                submittedAt: row.submitted_at,
                actionTakenAt: row.action_taken_at,
                status: row.status === 'reviewed' ? 'action-done' : 'need-action',
                answers,
                responses: responsesResult.rows,
            };
        }));

        res.json(queueItems);
    } catch (err) {
        next(err);
    }
});

// PATCH /api/forms/queue/review — mark queue items as reviewed
router.patch('/queue/review', async (req, res, next) => {
    const { ids, action } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids array is required' });
    }

    const actionType = action === 'undo' ? 'undo' : 'review';

    try {
        let result;
        if (actionType === 'undo') {
            result = await pool.query(
                `UPDATE form_requests
                 SET status = 'submitted',
                     action_taken_at = NULL
                 WHERE workspace_id = $1
                   AND id::text = ANY($2::text[])
                   AND status = 'reviewed'
                 RETURNING id`,
                [req.user.workspaceId, ids.map(String)]
            );
        } else {
            result = await pool.query(
                `UPDATE form_requests
                 SET status = 'reviewed',
                     action_taken_at = NOW()
                 WHERE workspace_id = $1
                   AND id::text = ANY($2::text[])
                   AND status = 'submitted'
                 RETURNING id`,
                [req.user.workspaceId, ids.map(String)]
            );
        }

        res.json({ updatedIds: result.rows.map(r => r.id) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/forms/requests/:request_id — cancel a pending request
router.delete('/requests/:request_id', async (req, res, next) => {
    try {
        const result = await pool.query(
            `DELETE FROM form_requests
             WHERE id = $1 AND workspace_id = $2 AND status IN ('pending', 'scheduled')
             RETURNING *`,
            [req.params.request_id, req.user.workspaceId]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: 'Request not found or already submitted/reviewed' });
        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
