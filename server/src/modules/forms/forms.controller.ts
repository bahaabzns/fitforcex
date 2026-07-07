import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { Prisma } from '@prisma/client';
import pool from '../../db';
import { prisma } from '../../lib/prisma';
import { recordEvent } from '../../lib/events';
import { resolveWritableVersion, sealVersionForAssignment } from './forms.service';

let schemaReadyPromise: Promise<void> | undefined;

export function normalizePostAction(value: unknown): string {
    const allowed = ['nothing', 'nutrition-plan', 'workout-plan'];
    return allowed.includes(value as string) ? (value as string) : 'nothing';
}

export function normalizeFormType(value: unknown): string {
    const allowed = ['assessment', 'check-in'];
    return allowed.includes(value as string) ? (value as string) : 'check-in';
}

const FORM_STATUSES = ['draft', 'active', 'archived'];
export function normalizeStatus(value: unknown): string | undefined {
    return FORM_STATUSES.includes(value as string) ? (value as string) : undefined;
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
        // Forms Versioning Phase 3 — the list's question_count reflects the
        // CURRENT version's question set (form_version_questions), not the
        // now-frozen form_questions table.
        const rows = await prisma.$queryRaw<FormRow[]>`
            SELECT f.*, COUNT(fvq.id)::int AS question_count
            FROM forms f
            LEFT JOIN form_version_questions fvq ON fvq.form_version_id = f.current_version_id
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
        const formId    = createId();
        const versionId = createId();
        // Forms Versioning Phase 2 — every form is born version-aware: a
        // fresh, unsealed version 1 with zero questions. This means
        // resolveWritableVersion never has to special-case "no version yet"
        // for anything created through this path.
        const form = await prisma.$transaction(async (tx) => {
            const created = await tx.forms.create({
                data: {
                    id:             formId,
                    workspace_id:   req.user!.workspaceId as string,
                    title_en:       (title_en as string | undefined) || 'Untitled Form',
                    title_ar:       (title_ar as string | undefined) || null,
                    description_en: (description_en as string | undefined) || null,
                    description_ar: (description_ar as string | undefined) || null,
                    post_action:    safePostAction,
                    form_type:      safeFormType,
                },
            });
            await tx.form_versions.create({
                data: { id: versionId, form_id: formId, version_number: 1, created_by: req.user!.userId },
            });
            return tx.forms.update({ where: { id: formId }, data: { current_version_id: versionId } });
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
    const safeStatus     = status     !== undefined ? normalizeStatus(status)        : undefined;
    try {
        const updated = await prisma.forms.updateMany({
            where: { id: req.params.id as string, workspace_id: req.user!.workspaceId },
            data: {
                title_en:       (title_en       as string | undefined) ?? undefined,
                title_ar:       (title_ar       as string | undefined) ?? undefined,
                description_en: (description_en as string | undefined) ?? undefined,
                description_ar: (description_ar as string | undefined) ?? undefined,
                status:         safeStatus,
                post_action:    safePostAction,
                form_type:      safeFormType,
                updated_at:     new Date(),
            },
        });
        if (updated.count === 0) return res.status(404).json({ error: 'Form not found' });
        const form = await prisma.forms.findFirst({ where: { id: req.params.id as string } });

        // Forms Versioning Phase 5 — archiving doesn't touch package
        // defaults or schedules (never destructive), but the coach should
        // know if they just retired a form other automation still depends
        // on, rather than discover it silently later.
        let warning: string | undefined;
        if (safeStatus === 'archived') {
            const packageCount = await prisma.package_default_forms.count({ where: { form_id: req.params.id as string } });
            if (packageCount > 0) {
                warning = `This form is a default on ${packageCount} package variation(s). New activations will keep offering it unless you update those packages.`;
            }
        }

        res.json(warning ? { ...form, warning } : form);
    } catch (err) {
        next(err);
    }
}

// Forms Versioning Phase 0 — a form with any history (client assignments) is
// never hard-deleted: the DB cascade would silently wipe every submission,
// metric, and scheduled check-in tied to it (see
// docs/forms-architecture-investigation.md). Archiving via updateForm's
// status field is the sanctioned retirement path instead.
export async function deleteForm(req: Request, res: Response, next: NextFunction) {
    try {
        const form = await prisma.forms.findFirst({
            where:  { id: req.params.id as string, workspace_id: req.user!.workspaceId },
            select: { id: true },
        });
        if (!form) return res.status(404).json({ error: 'Form not found' });

        const submissionCount = await prisma.form_requests.count({ where: { form_id: form.id } });
        if (submissionCount > 0) {
            return res.status(409).json({
                error: `This form has ${submissionCount} client submission(s)/assignment(s). Archive it instead of deleting.`,
                submissionCount,
            });
        }

        await prisma.forms.deleteMany({ where: { id: form.id, workspace_id: req.user!.workspaceId } });
        res.json({ deleted: req.params.id });
    } catch (err) {
        next(err);
    }
}

export async function getQuestions(req: Request, res: Response, next: NextFunction) {
    try {
        const form = await prisma.forms.findFirst({
            where:  { id: req.params.id as string, workspace_id: req.user!.workspaceId },
            select: { id: true, current_version_id: true },
        });
        if (!form) return res.status(404).json({ error: 'Form not found' });

        // Forms Versioning Phase 2 — the builder always shows the form's
        // current version (the live, editable draft), never a sealed
        // historical one.
        const questions = form.current_version_id
            ? await prisma.form_version_questions.findMany({
                  where:   { form_version_id: form.current_version_id },
                  orderBy: [{ order_index: 'asc' }, { id: 'asc' }],
              })
            : [];
        res.json(questions);
    } catch (err) {
        next(err);
    }
}

export async function createQuestion(req: Request, res: Response, next: NextFunction) {
    const { label_en, label_ar, type, metric_id } = req.body as Record<string, unknown>;
    const questionType = (type as string | undefined) || 'text';
    const isMetricType = questionType === 'metric';
    const formId = req.params.id as string;

    // Non-metric types must never carry a metric_id.
    // Metric type may be created without a metric_id (coach picks it in the editor).
    const resolvedMetricId = isMetricType ? ((metric_id as string | undefined) || null) : null;

    try {
        // Forms Versioning Phase 2 — resolve the writable version FIRST: if
        // the current version is sealed (already assigned), this forks a
        // new one and every existing question gets a new id. The duplicate
        // check and order_index below must run against the (possibly new)
        // resolved version, not the version that existed before this call.
        const { versionId, isNewVersion } = await resolveWritableVersion(formId, req.user!.workspaceId, req.user!.userId);

        if (resolvedMetricId) {
            const metric = await prisma.metrics.findFirst({
                where: { id: resolvedMetricId, workspace_id: req.user!.workspaceId, deleted_at: null },
            });
            if (!metric) return res.status(400).json({ error: 'Metric not found' });

            const duplicate = await prisma.form_version_questions.findFirst({
                where: { form_version_id: versionId, metric_id: resolvedMetricId },
            });
            if (duplicate) return res.status(409).json({ error: 'This metric is already tracked by another question in this form' });
        }

        const agg = await prisma.form_version_questions.aggregate({
            where: { form_version_id: versionId },
            _max:  { order_index: true },
        });
        const orderIndex = (agg._max.order_index ?? -1) + 1;

        const defaults = {
            min_value: questionType === 'scale' ? 1 : null,
            max_value: questionType === 'scale' ? 10 : null,
            options:   ['select', 'multiselect'].includes(questionType) ? ([] as Prisma.InputJsonValue) : null,
        };

        const question = await prisma.form_version_questions.create({
            data: {
                id:              createId(),
                form_version_id: versionId,
                label_en:        (label_en as string | undefined) || 'Question',
                label_ar:        (label_ar as string | undefined) || null,
                type:            questionType,
                order_index:     orderIndex,
                min_value:       defaults.min_value,
                max_value:       defaults.max_value,
                options:         defaults.options ?? Prisma.DbNull,
                metric_id:       resolvedMetricId,
            },
        });

        await prisma.forms.updateMany({
            where: { id: formId },
            data:  { updated_at: new Date() },
        });
        // versionChanged tells the builder every other question id it holds
        // for this form is now stale (a fork silently reassigns all of
        // them) and it must refetch the full list, not just patch this one in.
        res.status(201).json({ ...question, versionChanged: isNewVersion });
    } catch (err) {
        next(err);
    }
}

export async function updateQuestion(req: Request, res: Response, next: NextFunction) {
    const { label_en, label_ar, type, required, placeholder_en, placeholder_ar, options, options_ar, min_value, max_value, metric_id } = req.body as Record<string, unknown>;
    const formId = req.params.id as string;
    try {
        // Forms Versioning Phase 2 — resolve (and possibly fork) BEFORE
        // looking up the question: if the current version was sealed, the
        // qid the client sent belongs to the now-superseded version and
        // must be translated to its clone in the new one.
        const { versionId, isNewVersion, questionIdMap } = await resolveWritableVersion(formId, req.user!.workspaceId, req.user!.userId);
        const qid = questionIdMap.get(req.params.qid as string) ?? (req.params.qid as string);

        const existing = await prisma.form_version_questions.findFirst({
            where: { id: qid, form_version_id: versionId },
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

            const duplicate = await prisma.form_version_questions.findFirst({
                where: { form_version_id: versionId, metric_id: metric_id as string, id: { not: qid } },
            });
            if (duplicate) return res.status(409).json({ error: 'This metric is already tracked by another question in this form' });

            resolvedMetricId = metric_id as string;
        }

        const updated = await prisma.form_version_questions.update({
            where: { id: qid },
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
            where: { id: formId },
            data:  { updated_at: new Date() },
        });
        res.json({ ...updated, versionChanged: isNewVersion });
    } catch (err) {
        // Routes through the global error handler so FormNotFoundError's
        // .status (404) is respected rather than always collapsing to 500 —
        // matches the pattern already used by createQuestion/reorderQuestions.
        next(err);
    }
}

export async function deleteQuestion(req: Request, res: Response, next: NextFunction) {
    const formId = req.params.id as string;
    try {
        // Forms Versioning Phase 0/2 — check for recorded answers BEFORE
        // resolving/forking the version: a blocked delete shouldn't create
        // a needless new version. Note this checks form_responses, which
        // (as of this phase's migration 037) references form_version_questions
        // directly, so the requested qid is checked as-is here, prior to any
        // fork-driven id translation.
        const answerCount = await prisma.form_responses.count({ where: { question_id: req.params.qid as string } });
        if (answerCount > 0) {
            return res.status(409).json({
                error: `This question has ${answerCount} recorded answer(s). It cannot be deleted without losing client history.`,
                answerCount,
            });
        }

        const { versionId, isNewVersion, questionIdMap } = await resolveWritableVersion(formId, req.user!.workspaceId, req.user!.userId);
        const qid = questionIdMap.get(req.params.qid as string) ?? (req.params.qid as string);

        const deleted = await prisma.form_version_questions.deleteMany({
            where: { id: qid, form_version_id: versionId },
        });
        if (deleted.count === 0) return res.status(404).json({ error: 'Question not found' });

        await prisma.forms.updateMany({
            where: { id: formId },
            data:  { updated_at: new Date() },
        });
        res.json({ deleted: req.params.qid, versionChanged: isNewVersion });
    } catch (err) {
        // Routes through the global error handler so FormNotFoundError's
        // .status (404) is respected rather than always collapsing to 500 —
        // matches the pattern already used by createQuestion/reorderQuestions.
        next(err);
    }
}

export async function reorderQuestions(req: Request, res: Response, next: NextFunction) {
    const { order } = req.body as { order?: Array<{ id: string; order_index: number }> };
    const formId = req.params.id as string;
    try {
        const { versionId, isNewVersion, questionIdMap } = await resolveWritableVersion(formId, req.user!.workspaceId, req.user!.userId);
        await prisma.$transaction(
            (order || []).map(({ id, order_index }) =>
                prisma.form_version_questions.updateMany({
                    where: { id: questionIdMap.get(id) ?? id, form_version_id: versionId },
                    data:  { order_index },
                })
            )
        );
        await prisma.forms.updateMany({
            where: { id: formId },
            data:  { updated_at: new Date() },
        });
        res.json({ success: true, versionChanged: isNewVersion });
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
            // Forms Versioning Phase 5/Post-review fix — archived forms are
            // excluded here (not just by the frontend picker) so a stale
            // page or a direct API call can't assign one. Skipped silently,
            // matching this loop's existing behavior for an invalid/missing
            // form_id, rather than failing the whole batch partway through
            // (sealVersionForAssignment's own FormArchivedError check below
            // remains as a backstop for any other caller of this module).
            const formCheck = await prisma.forms.findFirst({
                where:  { id: form_id as string, workspace_id: req.user!.workspaceId, status: { not: 'archived' } },
                select: { id: true, post_action: true },
            });
            if (!formCheck) continue;

            const formPostAction = normalizePostAction(formCheck.post_action);
            const initialStatus  = requestMode === 'schedule' ? 'scheduled' : 'pending';

            // Forms Versioning Phase 2 — the row exists from this moment on
            // (even a "scheduled" one just waits to flip pending later), so
            // this is the assignment moment: seal the current version now so
            // this request permanently answers exactly this wording, even
            // if the coach edits the form again before the client responds.
            const { versionId } = await sealVersionForAssignment(formCheck.id, req.user!.workspaceId, req.user!.userId);

            const request = await prisma.form_requests.create({
                data: {
                    id:              createId(),
                    form_id:         form_id as string,
                    form_version_id: versionId,
                    client_id:       client_id as string,
                    workspace_id:    req.user!.workspaceId,
                    status:          initialStatus,
                    scheduled_at:    scheduledAt,
                    post_action:     formPostAction,
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
            // Forms Versioning Phase 3 — join against form_version_questions,
            // the immutable snapshot each response actually belongs to, so a
            // historical answer always renders under the label/type it was
            // originally asked with, regardless of later form edits.
            const questionsForResponse = await prisma.form_version_questions.findMany({
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
            // Forms Versioning Phase 3 — see the identical note in
            // getRequestsByClient above.
            const questions = await prisma.form_version_questions.findMany({
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
            const toReview = await prisma.form_requests.findMany({
                where:  { workspace_id: req.user!.workspaceId, id: { in: ids.map(String) }, status: 'submitted' },
                select: { id: true, client_id: true },
            });

            await prisma.form_requests.updateMany({
                where: { workspace_id: req.user!.workspaceId, id: { in: toReview.map(request => request.id) }, status: 'submitted' },
                data:  { status: 'reviewed', action_taken_at: new Date() },
            });

            // Notify each client their check-in was reviewed.
            await Promise.all(toReview.filter(request => request.client_id).map(request => recordEvent({
                workspaceId: req.user!.workspaceId,
                type:        'checkin.reviewed',
                importance:  'info',
                title:       'Your coach reviewed your check-in',
                recipients:  [{ type: 'client', id: request.client_id as string }],
                actor:       { type: 'user', id: req.user!.userId },
                entity:      { type: 'form_request', id: request.id },
            })));
        }

        const updated = await prisma.form_requests.findMany({
            where:  { workspace_id: req.user!.workspaceId, id: { in: ids.map(String) } },
            select: { id: true },
        });
        res.json({ updatedIds: updated.map(r => r.id) });
    } catch (err) {
        // Routes through the global error handler so FormNotFoundError's
        // .status (404) is respected rather than always collapsing to 500 —
        // matches the pattern already used by createQuestion/reorderQuestions.
        next(err);
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
        const updated = await prisma.$queryRaw<{ id: string; client_id: string }[]>`
            UPDATE form_requests
            SET assigned_to = ${assigneeId}
            WHERE workspace_id = ${req.user!.workspaceId}
              AND id IN (${Prisma.join(idList)})
            RETURNING id, client_id
        `;

        // Notify the assignee, unless the coach assigned it to themselves.
        if (assigneeId && assigneeId !== req.user!.userId) {
            await Promise.all(updated.map(row => recordEvent({
                workspaceId: req.user!.workspaceId,
                type:        'checkin.assigned',
                importance:  'actionable',
                title:       'A check-in was assigned to you for review',
                recipients:  [{ type: 'user', id: assigneeId as string }],
                actor:       { type: 'user', id: req.user!.userId },
                entity:      { type: 'form_request', id: row.id },
                metadata:    { clientId: row.client_id },
            })));
        }

        res.json({ updatedIds: updated.map(r => r.id), assignedTo: assigneeId });
    } catch (err) {
        next(err);
    }
}

export async function cancelQueue(req: Request, res: Response, next: NextFunction) {
    const { ids } = req.body as { ids?: unknown[] };
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids array is required' });
    }

    try {
        // Mirrors deleteRequest's single-item rule: only pending/scheduled requests
        // (not yet submitted) can be cancelled.
        const deleted = await prisma.form_requests.deleteMany({
            where: {
                id:           { in: ids.map(String) },
                workspace_id: req.user!.workspaceId,
                status:       { in: ['pending', 'scheduled'] },
            },
        });
        res.json({ deletedCount: deleted.count });
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
