import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { Prisma } from '@prisma/client';
import pool from '../../db';
import { prisma } from '../../lib/prisma';

let schemaReadyPromise: Promise<void> | undefined;

export function normalizePostAction(value: unknown): string {
    const allowed = ['nothing', 'nutrition-plan', 'workout-plan'];
    return allowed.includes(value as string) ? (value as string) : 'nothing';
}

export function normalizeFormType(value: unknown): string {
    const allowed = ['assessment', 'check-in'];
    return allowed.includes(value as string) ? (value as string) : 'check-in';
}

// DDL — kept as raw pool (ALTER TABLE cannot run inside Prisma)
export async function ensureFormsQueueSchema(): Promise<void> {
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

async function activateDueScheduledRequests(workspaceId: string): Promise<void> {
    await prisma.$executeRaw`
        UPDATE form_requests
        SET status = 'pending',
            requested_at = COALESCE(requested_at, NOW())
        WHERE workspace_id = ${workspaceId}
          AND status = 'scheduled'
          AND scheduled_at IS NOT NULL
          AND scheduled_at <= NOW()
    `;
}

type FormRow = Record<string, unknown>;

export async function getForms(req: Request, res: Response, next: NextFunction) {
    try {
        const rows = await prisma.$queryRaw<FormRow[]>`
            SELECT f.*, COUNT(fq.id)::int AS question_count
            FROM forms f
            LEFT JOIN form_questions fq ON fq.form_id = f.id
            WHERE f.workspace_id = ${req.user!.workspaceId}
            GROUP BY f.id
            ORDER BY f.created_at DESC
        `;
        res.json(rows);
    } catch (err) {
        next(err);
    }
}

export async function createForm(req: Request, res: Response, next: NextFunction) {
    const { title_en, title_ar, description_en, description_ar, postAction, formType } = req.body as Record<string, unknown>;
    const safePostAction = normalizePostAction(postAction);
    const safeFormType   = normalizeFormType(formType);
    try {
        const form = await prisma.forms.create({
            data: {
                id:             createId(),
                workspace_id:   req.user!.workspaceId as string,
                title_en:       (title_en as string | undefined) || 'Untitled Form',
                title_ar:       (title_ar as string | undefined) || null,
                description_en: (description_en as string | undefined) || null,
                description_ar: (description_ar as string | undefined) || null,
                post_action:    safePostAction,
                form_type:      safeFormType,
            },
        });
        res.status(201).json({ ...form, question_count: 0 });
    } catch (err) {
        next(err);
    }
}

export async function updateForm(req: Request, res: Response, next: NextFunction) {
    const { title_en, title_ar, description_en, description_ar, status, postAction, formType } = req.body as Record<string, unknown>;
    const safePostAction = postAction !== undefined ? normalizePostAction(postAction) : undefined;
    const safeFormType   = formType   !== undefined ? normalizeFormType(formType)    : undefined;
    try {
        const updated = await prisma.forms.updateMany({
            where: { id: req.params.id as string, workspace_id: req.user!.workspaceId },
            data: {
                title_en:       (title_en       as string | undefined) ?? undefined,
                title_ar:       (title_ar       as string | undefined) ?? undefined,
                description_en: (description_en as string | undefined) ?? undefined,
                description_ar: (description_ar as string | undefined) ?? undefined,
                status:         (status         as string | undefined) ?? undefined,
                post_action:    safePostAction,
                form_type:      safeFormType,
                updated_at:     new Date(),
            },
        });
        if (updated.count === 0) return res.status(404).json({ error: 'Form not found' });
        const form = await prisma.forms.findFirst({ where: { id: req.params.id as string } });
        res.json(form);
    } catch (err) {
        next(err);
    }
}

export async function deleteForm(req: Request, res: Response, next: NextFunction) {
    try {
        const deleted = await prisma.forms.deleteMany({
            where: { id: req.params.id as string, workspace_id: req.user!.workspaceId },
        });
        if (deleted.count === 0) return res.status(404).json({ error: 'Form not found' });
        res.json({ deleted: req.params.id });
    } catch (err) {
        next(err);
    }
}

export async function getQuestions(req: Request, res: Response, next: NextFunction) {
    try {
        const form = await prisma.forms.findFirst({
            where:  { id: req.params.id as string, workspace_id: req.user!.workspaceId },
            select: { id: true },
        });
        if (!form) return res.status(404).json({ error: 'Form not found' });

        const questions = await prisma.form_questions.findMany({
            where:   { form_id: req.params.id as string },
            orderBy: [{ order_index: 'asc' }, { id: 'asc' }],
        });
        res.json(questions);
    } catch (err) {
        next(err);
    }
}

export async function createQuestion(req: Request, res: Response, next: NextFunction) {
    const { label_en, label_ar, type, metric_id } = req.body as Record<string, unknown>;
    const questionType = (type as string | undefined) || 'text';
    const isMetricType = questionType === 'metric';

    // Non-metric types must never carry a metric_id.
    // Metric type may be created without a metric_id (coach picks it in the editor).
    const resolvedMetricId = isMetricType ? ((metric_id as string | undefined) || null) : null;

    try {
        if (resolvedMetricId) {
            const metric = await prisma.metrics.findFirst({
                where: { id: resolvedMetricId, workspace_id: req.user!.workspaceId, deleted_at: null },
            });
            if (!metric) return res.status(400).json({ error: 'Metric not found' });

            const duplicate = await prisma.form_questions.findFirst({
                where: { form_id: req.params.id as string, metric_id: resolvedMetricId },
            });
            if (duplicate) return res.status(409).json({ error: 'This metric is already tracked by another question in this form' });
        }

        const agg = await prisma.form_questions.aggregate({
            where:   { form_id: req.params.id as string },
            _max:    { order_index: true },
        });
        const orderIndex = (agg._max.order_index ?? -1) + 1;

        const defaults = {
            min_value: questionType === 'scale' ? 1 : null,
            max_value: questionType === 'scale' ? 10 : null,
            options:   ['select', 'multiselect'].includes(questionType) ? ([] as Prisma.InputJsonValue) : null,
        };

        const question = await prisma.form_questions.create({
            data: {
                id:          createId(),
                form_id:     req.params.id as string,
                label_en:    (label_en as string | undefined) || 'Question',
                label_ar:    (label_ar as string | undefined) || null,
                type:        questionType,
                order_index: orderIndex,
                min_value:   defaults.min_value,
                max_value:   defaults.max_value,
                options:     defaults.options ?? Prisma.DbNull,
                metric_id:   resolvedMetricId,
            },
        });

        await prisma.forms.updateMany({
            where: { id: req.params.id as string },
            data:  { updated_at: new Date() },
        });
        res.status(201).json(question);
    } catch (err) {
        next(err);
    }
}

export async function updateQuestion(req: Request, res: Response, next: NextFunction) {
    const { label_en, label_ar, type, required, placeholder_en, placeholder_ar, options, options_ar, min_value, max_value, metric_id } = req.body as Record<string, unknown>;
    try {
        const existing = await prisma.form_questions.findFirst({
            where: { id: req.params.qid as string, form_id: req.params.id as string },
        });
        if (!existing) return res.status(404).json({ error: 'Question not found' });

        const resolvedType = (type as string | undefined) ?? existing.type;
        const isMetricType = resolvedType === 'metric';

        // Derive metric_id: metric questions require one; switching away clears it.
        let resolvedMetricId: string | null = existing.metric_id;

        if (!isMetricType) {
            // Changing to or staying as non-metric — always clear the metric link.
            resolvedMetricId = null;
        } else if (metric_id !== undefined && metric_id !== null) {
            // Metric type with a new metric_id being set.
            const metric = await prisma.metrics.findFirst({
                where: { id: metric_id as string, workspace_id: req.user!.workspaceId, deleted_at: null },
            });
            if (!metric) return res.status(400).json({ error: 'Metric not found' });

            const duplicate = await prisma.form_questions.findFirst({
                where: { form_id: req.params.id as string, metric_id: metric_id as string, id: { not: req.params.qid as string } },
            });
            if (duplicate) return res.status(409).json({ error: 'This metric is already tracked by another question in this form' });

            resolvedMetricId = metric_id as string;
        }

        const updated = await prisma.form_questions.update({
            where: { id: req.params.qid as string },
            data: {
                label_en:       label_en       !== undefined ? (label_en       as string) : existing.label_en,
                label_ar:       label_ar       !== undefined ? (label_ar       as string | null) : existing.label_ar,
                type:           type           !== undefined ? (type           as string) : existing.type,
                required:       required       !== undefined ? (required       as boolean) : existing.required,
                placeholder_en: placeholder_en !== undefined ? (placeholder_en as string | null) : existing.placeholder_en,
                placeholder_ar: placeholder_ar !== undefined ? (placeholder_ar as string | null) : existing.placeholder_ar,
                options:        options    !== undefined ? (options    != null ? options    as Prisma.InputJsonValue : Prisma.DbNull) : (existing.options    ?? Prisma.DbNull),
                options_ar:     options_ar !== undefined ? (options_ar != null ? options_ar as Prisma.InputJsonValue : Prisma.DbNull) : (existing.options_ar ?? Prisma.DbNull),
                min_value:      min_value  !== undefined ? (min_value  as number | null) : existing.min_value,
                max_value:      max_value  !== undefined ? (max_value  as number | null) : existing.max_value,
                metric_id:      resolvedMetricId,
            },
        });

        await prisma.forms.updateMany({
            where: { id: req.params.id as string },
            data:  { updated_at: new Date() },
        });
        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function deleteQuestion(req: Request, res: Response, next: NextFunction) {
    try {
        const deleted = await prisma.form_questions.deleteMany({
            where: { id: req.params.qid as string, form_id: req.params.id as string },
        });
        if (deleted.count === 0) return res.status(404).json({ error: 'Question not found' });

        await prisma.forms.updateMany({
            where: { id: req.params.id as string },
            data:  { updated_at: new Date() },
        });
        res.json({ deleted: req.params.qid });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function reorderQuestions(req: Request, res: Response, next: NextFunction) {
    const { order } = req.body as { order?: Array<{ id: string; order_index: number }> };
    try {
        await prisma.$transaction(
            (order || []).map(({ id, order_index }) =>
                prisma.form_questions.updateMany({
                    where: { id, form_id: req.params.id as string },
                    data:  { order_index },
                })
            )
        );
        await prisma.forms.updateMany({
            where: { id: req.params.id as string },
            data:  { updated_at: new Date() },
        });
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
}

export async function createRequests(req: Request, res: Response, next: NextFunction) {
    const { form_ids, client_id, mode, scheduled_at } = req.body as Record<string, unknown>;
    const requestMode = mode === 'schedule' ? 'schedule' : 'now';

    if (!form_ids || !Array.isArray(form_ids) || form_ids.length === 0) {
        return res.status(400).json({ error: 'form_ids array is required' });
    }
    if (!client_id) return res.status(400).json({ error: 'client_id is required' });

    let scheduledAt: Date | null = null;
    if (requestMode === 'schedule') {
        if (!scheduled_at) return res.status(400).json({ error: 'scheduled_at is required when mode is schedule' });
        scheduledAt = new Date(scheduled_at as string);
        if (Number.isNaN(scheduledAt.getTime())) return res.status(400).json({ error: 'scheduled_at is invalid' });
        if (scheduledAt.getTime() <= Date.now()) return res.status(400).json({ error: 'scheduled_at must be in the future' });
    }

    try {
        const clientCheck = await prisma.clients.findFirst({
            where:  { id: client_id as string, workspace_id: req.user!.workspaceId },
            select: { id: true },
        });
        if (!clientCheck) return res.status(403).json({ error: 'Client not found' });

        const inserted = [];
        for (const form_id of form_ids) {
            const formCheck = await prisma.forms.findFirst({
                where:  { id: form_id as string, workspace_id: req.user!.workspaceId },
                select: { id: true, post_action: true },
            });
            if (!formCheck) continue;

            const formPostAction = normalizePostAction(formCheck.post_action);
            const initialStatus  = requestMode === 'schedule' ? 'scheduled' : 'pending';

            const request = await prisma.form_requests.create({
                data: {
                    id:           createId(),
                    form_id:      form_id as string,
                    client_id:    client_id as string,
                    workspace_id: req.user!.workspaceId,
                    status:       initialStatus,
                    scheduled_at: scheduledAt,
                    post_action:  formPostAction,
                },
            });
            inserted.push(request);
        }
        res.status(201).json(inserted);
    } catch (err) {
        next(err);
    }
}

type RequestRow = Record<string, unknown>;

export async function getRequestsByClient(req: Request, res: Response, next: NextFunction) {
    try {
        await activateDueScheduledRequests(req.user!.workspaceId);

        const clientCheck = await prisma.clients.findFirst({
            where:  { id: req.params.client_id as string, workspace_id: req.user!.workspaceId },
            select: { id: true },
        });
        if (!clientCheck) return res.status(403).json({ error: 'Client not found' });

        const rows = await prisma.$queryRaw<RequestRow[]>`
            SELECT fr.id, fr.status, fr.requested_at, fr.submitted_at, fr.scheduled_at, fr.post_action,
                   f.id AS form_id,
                   f.title_en AS form_title_en, f.title_ar AS form_title_ar,
                   f.description_en AS form_description_en, f.description_ar AS form_description_ar,
                   f.post_action AS form_post_action, f.form_type
            FROM form_requests fr
            JOIN forms f ON f.id = fr.form_id
            WHERE fr.client_id = ${req.params.client_id} AND fr.workspace_id = ${req.user!.workspaceId}
            ORDER BY COALESCE(fr.scheduled_at, fr.requested_at) DESC
        `;

        const requests = await Promise.all(rows.map(async (row) => {
            if (row.status === 'pending' || row.status === 'scheduled') {
                return { ...row, post_action: row.post_action || row.form_post_action || 'nothing', responses: [] };
            }
            const responses = await prisma.form_responses.findMany({
                where:   { request_id: row.id as string },
                select:  { answer: true, question_id: true },
            });
            const questionsForResponse = await prisma.form_questions.findMany({
                where:   { id: { in: responses.map(r => r.question_id).filter((id): id is string => id !== null) } },
                select:  { id: true, label_en: true, label_ar: true, type: true, order_index: true },
            });
            const questionMap = new Map(questionsForResponse.map(q => [q.id, q]));
            return {
                ...row,
                post_action: row.post_action || row.form_post_action || 'nothing',
                responses: responses.map(r => ({ ...r, ...questionMap.get(r.question_id ?? '') }))
                    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
            };
        }));

        res.json(requests);
    } catch (err) {
        next(err);
    }
}

export async function getQueue(req: Request, res: Response, next: NextFunction) {
    try {
        await activateDueScheduledRequests(req.user!.workspaceId);

        const rows = await prisma.$queryRaw<RequestRow[]>`
            SELECT fr.id, fr.status, fr.requested_at, fr.submitted_at, fr.form_id,
                   fr.scheduled_at, fr.post_action, fr.action_taken_at, fr.assigned_to,
                   f.title_en AS form_title_en, f.title_ar AS form_title_ar,
                   f.form_type, f.post_action AS form_post_action,
                   c.id AS client_id, c.client_code, c.fname, c.lname, c.email,
                   au.fname AS assignee_fname, au.lname AS assignee_lname,
                   NULL::text AS client_package,
                   NULL::text AS subscription_status
            FROM form_requests fr
            JOIN forms f ON f.id = fr.form_id
            JOIN clients c ON c.id = fr.client_id
            LEFT JOIN users au ON au.id = fr.assigned_to
            WHERE fr.workspace_id = ${req.user!.workspaceId}
            ORDER BY fr.requested_at DESC
        `;

        const queueItems = await Promise.all(rows.map(async (row) => {
            if (row.status === 'pending' || row.status === 'scheduled') {
                return {
                    id: row.id, clientId: row.client_id, clientCode: row.client_code,
                    clientName: `${row.fname} ${row.lname}`.trim(), clientEmail: row.email,
                    clientPackage: row.client_package, subscriptionStatus: row.subscription_status,
                    formId: row.form_id, formTitle_en: row.form_title_en, formTitle_ar: row.form_title_ar,
                    formType: row.form_type || 'check-in',
                    postAction: normalizePostAction(row.post_action || row.form_post_action),
                    requestedAt: row.requested_at, scheduledAt: row.scheduled_at, submittedAt: null, actionTakenAt: null,
                    status: row.status === 'scheduled' ? 'scheduled' : 'awaiting',
                    assignedTo: row.assigned_to ?? null,
                    assignedToName: row.assigned_to ? `${row.assignee_fname ?? ''} ${row.assignee_lname ?? ''}`.trim() : null,
                    answers: {}, responses: [],
                };
            }

            const responses = await prisma.form_responses.findMany({
                where:  { request_id: row.id as string },
                select: { question_id: true, answer: true },
            });
            const questions = await prisma.form_questions.findMany({
                where:   { id: { in: responses.map(r => r.question_id).filter((id): id is string => id !== null) } },
                select:  { id: true, label_en: true, label_ar: true, type: true, order_index: true },
            });
            const questionMap = new Map(questions.map(q => [q.id, q]));

            const answers: Record<string, unknown> = {};
            for (const r of responses) { if (r.question_id) answers[r.question_id] = r.answer; }

            return {
                id: row.id, clientId: row.client_id, clientCode: row.client_code,
                clientName: `${row.fname} ${row.lname}`.trim(), clientEmail: row.email,
                clientPackage: row.client_package, subscriptionStatus: row.subscription_status,
                formId: row.form_id, formTitle_en: row.form_title_en, formTitle_ar: row.form_title_ar,
                formType: row.form_type || 'check-in',
                postAction: normalizePostAction(row.post_action || row.form_post_action),
                requestedAt: row.requested_at, scheduledAt: row.scheduled_at,
                submittedAt: row.submitted_at, actionTakenAt: row.action_taken_at,
                status: row.status === 'reviewed' ? 'action-done' : 'need-action',
                assignedTo: row.assigned_to ?? null,
                assignedToName: row.assigned_to ? `${row.assignee_fname ?? ''} ${row.assignee_lname ?? ''}`.trim() : null,
                answers,
                responses: responses.map(r => ({ ...r, ...questionMap.get(r.question_id ?? '') }))
                    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)),
            };
        }));

        res.json(queueItems);
    } catch (err) {
        next(err);
    }
}

export async function reviewQueue(req: Request, res: Response, next: NextFunction) {
    const { ids, action } = req.body as { ids?: unknown[]; action?: string };
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids array is required' });
    }

    const actionType = action === 'undo' ? 'undo' : 'review';

    try {
        if (actionType === 'undo') {
            await prisma.form_requests.updateMany({
                where: { workspace_id: req.user!.workspaceId, id: { in: ids.map(String) }, status: 'reviewed' },
                data:  { status: 'submitted', action_taken_at: null },
            });
        } else {
            await prisma.form_requests.updateMany({
                where: { workspace_id: req.user!.workspaceId, id: { in: ids.map(String) }, status: 'submitted' },
                data:  { status: 'reviewed', action_taken_at: new Date() },
            });
        }

        const updated = await prisma.form_requests.findMany({
            where:  { workspace_id: req.user!.workspaceId, id: { in: ids.map(String) } },
            select: { id: true },
        });
        res.json({ updatedIds: updated.map(r => r.id) });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function assignQueue(req: Request, res: Response, next: NextFunction) {
    const { ids, assignedTo } = req.body as { ids?: unknown[]; assignedTo?: string | null };
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids array is required' });
    }

    try {
        // Unassign when assignedTo is null/empty; otherwise verify the assignee is a
        // member of this workspace before storing their user id.
        let assigneeId: string | null = null;
        if (assignedTo) {
            const member = await prisma.workspace_members.findFirst({
                where:  { workspace_id: req.user!.workspaceId, user_id: assignedTo },
                select: { id: true },
            });
            const owner = await prisma.workspaces.findFirst({
                where:  { id: req.user!.workspaceId, owner_id: assignedTo },
                select: { id: true },
            });
            if (!member && !owner) {
                return res.status(400).json({ error: 'Assignee is not a member of this workspace' });
            }
            assigneeId = assignedTo;
        }

        const idList = ids.map(String);
        // Raw UPDATE so the new `assigned_to` column is reachable without depending
        // on a freshly regenerated Prisma client.
        const updated = await prisma.$queryRaw<{ id: string }[]>`
            UPDATE form_requests
            SET assigned_to = ${assigneeId}
            WHERE workspace_id = ${req.user!.workspaceId}
              AND id IN (${Prisma.join(idList)})
            RETURNING id
        `;
        res.json({ updatedIds: updated.map(r => r.id), assignedTo: assigneeId });
    } catch (err) {
        next(err);
    }
}

export async function deleteRequest(req: Request, res: Response, next: NextFunction) {
    try {
        const deleted = await prisma.form_requests.deleteMany({
            where: {
                id:           req.params.request_id as string,
                workspace_id: req.user!.workspaceId,
                status:       { in: ['pending', 'scheduled'] },
            },
        });
        if (deleted.count === 0) return res.status(404).json({ error: 'Request not found or already submitted/reviewed' });
        res.json({ deleted: req.params.request_id });
    } catch (err) {
        next(err);
    }
}
