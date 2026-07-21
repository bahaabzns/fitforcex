import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { Prisma } from '@prisma/client';
import pool from '../../db';
import { prisma } from '../../lib/prisma';
import { recordEvent } from '../../lib/events';
import { resolveWritableVersion, sealVersionForAssignment } from './forms.service';
import { isValidQuestionType, isMetricConvertibleType, normalizeQuestionOptions } from './questionTypes';
import { fetchAndParseGoogleForm, parseGoogleFormHtml } from './googleFormsImport';

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
            await pool.query(`ALTER TABLE form_requests ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ`);
            await pool.query(`ALTER TABLE form_requests ADD COLUMN IF NOT EXISTS archived_by TEXT`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_form_requests_ws_archived ON form_requests (workspace_id, archived_at)`);
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
        // Builder Save Workflow — the sealed/unsealed badge needs to know the
        // current version's number and seal state; both are additive fields
        // that already existed on form_versions, just not projected here before.
        const rows = await prisma.$queryRaw<FormRow[]>`
            SELECT f.*, COUNT(fvq.id)::int AS question_count,
                   fv.version_number AS current_version_number,
                   fv.sealed_at AS current_version_sealed_at
            FROM forms f
            LEFT JOIN form_version_questions fvq ON fvq.form_version_id = f.current_version_id
            LEFT JOIN form_versions fv ON fv.id = f.current_version_id
            WHERE f.workspace_id = ${req.user!.workspaceId}
            GROUP BY f.id, fv.version_number, fv.sealed_at
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
                    status:         'active',
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

// Google Forms Import — pure read/parse, no DB writes. Nothing is created
// here; the client feeds the returned structure into the same local-draft
// state a manually-built form uses, then persists it through the existing
// createForm + save-draft endpoints, so tenant scoping happens there as usual.
//
// Accepts either `url` (the normal path — server fetches the public page
// itself) or `html` (fallback for forms Google sign-in-gates from an
// anonymous fetch, e.g. any form with a File Upload question — the coach
// views the page themselves while signed into Google, where the wall
// doesn't block them, and pastes the page source instead).
export async function importGoogleFormPreview(req: Request, res: Response, next: NextFunction) {
    const { url, html } = req.body as { url?: unknown; html?: unknown };
    try {
        if (typeof html === 'string' && html.trim()) {
            return res.json(parseGoogleFormHtml(html));
        }
        if (typeof url === 'string' && url.trim()) {
            const parsed = await fetchAndParseGoogleForm(url.trim());
            return res.json(parsed);
        }
        return res.status(400).json({ error: 'A Google Form link or pasted page source is required' });
    } catch (err) {
        next(err);
    }
}

// Builder Save Workflow — projects the same version_number/sealed_at fields
// getForms adds to its list query onto a single already-loaded form row, so
// updateForm/saveDraft responses can refresh the sealed/unsealed badge too.
async function attachVersionInfo<T extends { current_version_id: string | null }>(form: T) {
    if (!form.current_version_id) return { ...form, current_version_number: null, current_version_sealed_at: null };
    const version = await prisma.form_versions.findFirst({
        where:  { id: form.current_version_id },
        select: { version_number: true, sealed_at: true },
    });
    return { ...form, current_version_number: version?.version_number ?? null, current_version_sealed_at: version?.sealed_at ?? null };
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
        const formRow = await prisma.forms.findFirst({ where: { id: req.params.id as string } });
        const form = formRow ? await attachVersionInfo(formRow) : formRow;

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
                reason: 'submissions',
                submissionCount,
            });
        }

        // package_default_forms.form_id is onDelete: Restrict (schema.prisma)
        // — deleteMany below would otherwise throw a raw FK violation. Same
        // "archive instead" offramp as the submissions case above.
        const packageDefaultCount = await prisma.package_default_forms.count({ where: { form_id: form.id } });
        if (packageDefaultCount > 0) {
            return res.status(409).json({
                error: `This form is a default on ${packageDefaultCount} package variation(s). Archive it instead of deleting, or remove it from those packages first.`,
                reason: 'package_default',
                packageDefaultCount,
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
    const { label_en, label_ar, type, metric_id, options } = req.body as Record<string, unknown>;
    const questionType = (type as string | undefined) || 'text';
    if (!isValidQuestionType(questionType)) {
        return res.status(400).json({ error: `Unknown question type: ${questionType}` });
    }
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
            options:   normalizeQuestionOptions(questionType, options),
        };

        const newQuestionId = createId();
        const question = await prisma.form_version_questions.create({
            data: {
                id:              newQuestionId,
                form_version_id: versionId,
                label_en:        (label_en as string | undefined) || 'Question',
                label_ar:        (label_ar as string | undefined) || null,
                type:            questionType,
                order_index:     orderIndex,
                min_value:       defaults.min_value,
                max_value:       defaults.max_value,
                options:         defaults.options ?? Prisma.DbNull,
                metric_id:       resolvedMetricId,
                // Question lineage tracking — a brand-new question is the
                // root of its own lineage. See forms.service.ts's
                // forkVersion for how this propagates forward on a fork.
                origin_question_id: newQuestionId,
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
    if (type !== undefined && !isValidQuestionType(type)) {
        return res.status(400).json({ error: `Unknown question type: ${type}` });
    }
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
                // "attachment" always normalizes its allowedCategory (a
                // server-enforced upload constraint, not just stored JSON);
                // every other type keeps the original pass-through so
                // untyped free-form options aren't disturbed.
                options:        resolvedType === 'attachment'
                    ? (normalizeQuestionOptions('attachment', options !== undefined ? options : existing.options) ?? Prisma.DbNull)
                    : (options !== undefined ? (options != null ? options as Prisma.InputJsonValue : Prisma.DbNull) : (existing.options ?? Prisma.DbNull)),
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

type DraftQuestionInput = {
    id?: string | null;
    label_en?: string;
    label_ar?: string | null;
    type?: string;
    required?: boolean;
    placeholder_en?: string | null;
    placeholder_ar?: string | null;
    options?: unknown;
    options_ar?: unknown;
    min_value?: number | null;
    max_value?: number | null;
    metric_id?: string | null;
};

/**
 * Builder Save Workflow (Phase 2) — the builder now edits locally and calls
 * this once on Save, instead of firing one request per field edit. A single
 * batched write is required (not just a UX nicety): resolveWritableVersion
 * forks at most once per call and reassigns every question a fresh id when
 * it does, so replaying many small per-field requests from stale client-held
 * ids after a fork would need fragile client-side id reconciliation. Doing
 * the whole diff (deletes, updates, creates, reorder) inside one
 * resolveWritableVersion call sidesteps that entirely — this mirrors the
 * same shape useTrainingPlan.js's save-plan-draft endpoint already uses:
 * send the full desired state, get back the authoritative persisted state.
 */
export async function saveDraft(req: Request, res: Response, next: NextFunction) {
    const { form, questions, deletedIds } = req.body as {
        form?: Record<string, unknown>;
        questions?: DraftQuestionInput[];
        deletedIds?: string[];
    };
    const formId = req.params.id as string;
    const incomingQuestions = questions || [];

    for (const q of incomingQuestions) {
        const qType = q.type || 'text';
        if (!isValidQuestionType(qType)) {
            return res.status(400).json({ error: `Unknown question type: ${qType}` });
        }
    }

    try {
        // Checked BEFORE resolveWritableVersion, against the ids exactly as
        // the client sent them (mirrors deleteQuestion's identical ordering
        // rationale — a blocked delete shouldn't create a needless fork) —
        // AND across each question's full lineage (origin_question_id), not
        // just its own id: an answer recorded against an earlier, already-
        // forked version of "the same" question has a different question_id
        // than the one the client is holding, so checking the given id alone
        // would silently miss it and let the delete through.
        if ((deletedIds || []).length > 0) {
            const targetRows = await prisma.form_version_questions.findMany({
                where: { id: { in: deletedIds } },
                select: { id: true, origin_question_id: true },
            });
            const originIds = [...new Set(targetRows.map((r) => r.origin_question_id))];
            if (originIds.length > 0) {
                const answeredRows = await prisma.form_responses.findMany({
                    where: { form_version_questions: { origin_question_id: { in: originIds } } },
                    select: { form_version_questions: { select: { origin_question_id: true } } },
                });
                const answeredOrigins = new Set(
                    answeredRows.map((r) => r.form_version_questions?.origin_question_id).filter((id): id is string => Boolean(id))
                );
                const blockedIds = targetRows.filter((r) => answeredOrigins.has(r.origin_question_id)).map((r) => r.id);
                if (blockedIds.length > 0) {
                    return res.status(409).json({
                        error: `${blockedIds.length} question(s) have recorded answers and cannot be deleted without losing client history.`,
                        blockedQuestionIds: blockedIds,
                    });
                }
            }
        }

        const { versionId, isNewVersion, questionIdMap } = await resolveWritableVersion(formId, req.user!.workspaceId, req.user!.userId);
        const translatedDeletedIds = (deletedIds || []).map((id) => questionIdMap.get(id) ?? id);

        // Uniqueness within the submitted batch — the batch represents the
        // version's full desired question set, so this is the same rule
        // createQuestion/updateQuestion enforce, just checked in bulk up front.
        const metricIdsUsed = incomingQuestions
            .filter((q) => (q.type || 'text') === 'metric' && q.metric_id)
            .map((q) => q.metric_id as string);
        const duplicateMetricId = metricIdsUsed.find((id, idx) => metricIdsUsed.indexOf(id) !== idx);
        if (duplicateMetricId) {
            return res.status(409).json({ error: 'This metric is already tracked by another question in this form' });
        }
        if (metricIdsUsed.length > 0) {
            const ownedMetrics = await prisma.metrics.findMany({
                where: { id: { in: [...new Set(metricIdsUsed)] }, workspace_id: req.user!.workspaceId, deleted_at: null },
                select: { id: true },
            });
            const ownedIds = new Set(ownedMetrics.map((m) => m.id));
            if (metricIdsUsed.some((id) => !ownedIds.has(id))) {
                return res.status(400).json({ error: 'Metric not found' });
            }
        }

        await prisma.$transaction(async (tx) => {
            if (translatedDeletedIds.length > 0) {
                await tx.form_version_questions.deleteMany({
                    where: { id: { in: translatedDeletedIds }, form_version_id: versionId },
                });
            }

            let orderIndex = 0;
            for (const q of incomingQuestions) {
                const qType = q.type || 'text';
                const isMetricType = qType === 'metric';
                const resolvedMetricId = isMetricType ? (q.metric_id || null) : null;
                const existingId = q.id ? (questionIdMap.get(q.id) ?? q.id) : null;

                const dataFields = {
                    label_en:       q.label_en || 'Question',
                    label_ar:       q.label_ar ?? null,
                    type:           qType,
                    required:       Boolean(q.required),
                    order_index:    orderIndex++,
                    placeholder_en: q.placeholder_en ?? null,
                    placeholder_ar: q.placeholder_ar ?? null,
                    options:        qType === 'attachment'
                        ? (normalizeQuestionOptions('attachment', q.options) ?? Prisma.DbNull)
                        : (q.options != null ? (q.options as Prisma.InputJsonValue) : Prisma.DbNull),
                    options_ar:     q.options_ar != null ? (q.options_ar as Prisma.InputJsonValue) : Prisma.DbNull,
                    min_value:      qType === 'scale' ? (q.min_value ?? 1)  : (q.min_value ?? null),
                    max_value:      qType === 'scale' ? (q.max_value ?? 10) : (q.max_value ?? null),
                    metric_id:      resolvedMetricId,
                };

                if (existingId) {
                    await tx.form_version_questions.update({ where: { id: existingId }, data: dataFields });
                } else {
                    // Question lineage tracking — a brand-new question is
                    // the root of its own lineage (see createQuestion's
                    // identical note above).
                    const newQuestionId = createId();
                    await tx.form_version_questions.create({
                        data: { id: newQuestionId, form_version_id: versionId, origin_question_id: newQuestionId, ...dataFields },
                    });
                }
            }

            if (form) {
                const safePostAction = form.postAction !== undefined ? normalizePostAction(form.postAction) : undefined;
                const safeFormType   = form.formType   !== undefined ? normalizeFormType(form.formType)    : undefined;
                await tx.forms.updateMany({
                    where: { id: formId, workspace_id: req.user!.workspaceId },
                    data: {
                        title_en:       (form.title_en       as string | undefined) ?? undefined,
                        title_ar:       (form.title_ar       as string | undefined) ?? undefined,
                        description_en: (form.description_en as string | undefined) ?? undefined,
                        description_ar: (form.description_ar as string | undefined) ?? undefined,
                        post_action:    safePostAction,
                        form_type:      safeFormType,
                        updated_at:     new Date(),
                    },
                });
            } else {
                await tx.forms.updateMany({ where: { id: formId }, data: { updated_at: new Date() } });
            }
        });

        const freshQuestions = await prisma.form_version_questions.findMany({
            where:   { form_version_id: versionId },
            orderBy: [{ order_index: 'asc' }, { id: 'asc' }],
        });
        const formRow = await prisma.forms.findFirst({
            where: { id: formId, workspace_id: req.user!.workspaceId },
        });

        res.json({
            form:      formRow ? await attachVersionInfo(formRow) : null,
            questions: freshQuestions,
            versionChanged: isNewVersion,
        });
    } catch (err) {
        next(err);
    }
}

/**
 * "Track as Metric" (Phase 4) — read-only preview of how many historical
 * answers would be backfilled if this question were tracked. Counts across
 * the question's full lineage (origin_question_id, see
 * migrations/043_form_version_questions_lineage.js), not just the current
 * version's question id, so the count is accurate even if the form has been
 * forked since some of those answers were submitted. No resolveWritableVersion
 * here — this is a pure read against the id the builder already holds for
 * the current version, nothing to fork.
 */
export async function getMetricTrackingPreview(req: Request, res: Response, next: NextFunction) {
    try {
        const question = await prisma.form_version_questions.findFirst({
            where: {
                id: req.params.qid as string,
                form_versions: { form_id: req.params.id as string, forms: { workspace_id: req.user!.workspaceId } },
            },
            select: { id: true, type: true, origin_question_id: true },
        });
        if (!question) return res.status(404).json({ error: 'Question not found' });

        const count = await prisma.form_responses.count({
            where: {
                metric_id: null,
                form_version_questions: { origin_question_id: question.origin_question_id },
            },
        });
        res.json({ count, convertible: isMetricConvertibleType(question.type) });
    } catch (err) {
        next(err);
    }
}

/**
 * "Track as Metric" (Phase 4) — links an existing, previously-untracked
 * question to a metric and automatically backfills every past answer in its
 * lineage that isn't already linked to a metric. Backfill is automatic, not
 * opt-in: the coach's intent in choosing this action is unambiguous, and the
 * preview endpoint above is what they see (and can cancel from) before
 * calling this. Not reversible via the API — see DEBT.md if an "untrack"
 * action becomes needed.
 */
export async function trackQuestionAsMetric(req: Request, res: Response, next: NextFunction) {
    const { metric_id } = req.body as Record<string, unknown>;
    const formId = req.params.id as string;
    if (!metric_id || typeof metric_id !== 'string') {
        return res.status(400).json({ error: 'metric_id is required' });
    }

    try {
        const { versionId, isNewVersion, questionIdMap } = await resolveWritableVersion(formId, req.user!.workspaceId, req.user!.userId);
        const qid = questionIdMap.get(req.params.qid as string) ?? (req.params.qid as string);

        const existing = await prisma.form_version_questions.findFirst({
            where: { id: qid, form_version_id: versionId },
        });
        if (!existing) return res.status(404).json({ error: 'Question not found' });

        if (!isMetricConvertibleType(existing.type)) {
            return res.status(400).json({ error: `Questions of type "${existing.type}" cannot be tracked as a metric` });
        }

        const metric = await prisma.metrics.findFirst({
            where: { id: metric_id, workspace_id: req.user!.workspaceId, deleted_at: null },
        });
        if (!metric) return res.status(400).json({ error: 'Metric not found' });

        const duplicate = await prisma.form_version_questions.findFirst({
            where: { form_version_id: versionId, metric_id, id: { not: qid } },
        });
        if (duplicate) return res.status(409).json({ error: 'This metric is already tracked by another question in this form' });

        const { updatedQuestion, backfilledCount } = await prisma.$transaction(async (tx) => {
            const updated = await tx.form_version_questions.update({
                where: { id: qid },
                data:  { metric_id },
            });
            // Cross-version backfill — every past answer in this question's
            // lineage (across every fork it's survived) that isn't already
            // linked to a metric. See origin_question_id's doc comment on
            // the schema for why this can't be scoped to just this version's id.
            const backfill = await tx.form_responses.updateMany({
                where: {
                    metric_id: null,
                    form_version_questions: { origin_question_id: existing.origin_question_id },
                },
                data: { metric_id },
            });
            return { updatedQuestion: updated, backfilledCount: backfill.count };
        });

        await prisma.forms.updateMany({ where: { id: formId }, data: { updated_at: new Date() } });

        res.json({ question: updatedQuestion, backfilledCount, versionChanged: isNewVersion });
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
type ResponseRow = { question_id: string | null; answer: string | null };

// Coach Portal answer viewer (Phase 3) — the viewer used to guess whether an
// answer was an image by regex-sniffing the URL string, which mis-renders
// any non-image attachment whose URL happens to look like one and silently
// falls back to plain text for anything that doesn't. Rendering must be
// decided by the question's type, never the answer's content, so every
// response returned to the coach carries its question's `type` and (for
// metric-typed questions) the linked metric's `type` ("number" | "image").
async function enrichResponsesWithQuestionInfo<T extends ResponseRow>(responses: T[]) {
    const questions = await prisma.form_version_questions.findMany({
        where:  { id: { in: responses.map((r) => r.question_id).filter((id): id is string => id !== null) } },
        select: { id: true, label_en: true, label_ar: true, type: true, order_index: true, metric_id: true },
    });
    const metricIds = questions.map((q) => q.metric_id).filter((id): id is string => id !== null);
    const metrics = metricIds.length > 0
        ? await prisma.metrics.findMany({ where: { id: { in: metricIds } }, select: { id: true, type: true } })
        : [];
    const metricTypeMap = new Map(metrics.map((m) => [m.id, m.type]));
    const questionMap = new Map(questions.map((q) => [
        q.id,
        { ...q, metric_type: q.metric_id ? (metricTypeMap.get(q.metric_id) ?? null) : null },
    ]));

    return responses
        .map((r) => ({ ...r, ...questionMap.get(r.question_id ?? '') }))
        .sort((a, b) => ((a as { order_index?: number }).order_index ?? 0) - ((b as { order_index?: number }).order_index ?? 0));
}

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
                   fr.archived_at,
                   f.id AS form_id,
                   f.title_en AS form_title_en, f.title_ar AS form_title_ar,
                   f.description_en AS form_description_en, f.description_ar AS form_description_ar,
                   f.post_action AS form_post_action, f.form_type
            FROM form_requests fr
            JOIN forms f ON f.id = fr.form_id
            WHERE fr.client_id = ${req.params.client_id} AND fr.workspace_id = ${req.user!.workspaceId}
            ORDER BY COALESCE(fr.scheduled_at, fr.requested_at) DESC
        `;

        // Batched, not per-row — see the identical note in getQueue above.
        const answerableIds = rows
            .filter((row) => row.status !== 'pending' && row.status !== 'scheduled' && row.status !== 'sent')
            .map((row) => row.id as string);

        const allResponses = answerableIds.length > 0
            ? await prisma.form_responses.findMany({
                where:  { request_id: { in: answerableIds } },
                select: { request_id: true, answer: true, question_id: true },
            })
            : [];
        // Forms Versioning Phase 3 — join against form_version_questions,
        // the immutable snapshot each response actually belongs to, so a
        // historical answer always renders under the label/type it was
        // originally asked with, regardless of later form edits.
        const enrichedResponses = await enrichResponsesWithQuestionInfo(allResponses);

        const responsesByRequestId = new Map<string, typeof enrichedResponses>();
        for (const r of enrichedResponses) {
            const list = responsesByRequestId.get(r.request_id as string) ?? [];
            list.push(r);
            responsesByRequestId.set(r.request_id as string, list);
        }

        const requests = rows.map((row) => ({
            ...row,
            post_action: row.post_action || row.form_post_action || 'nothing',
            responses: responsesByRequestId.get(row.id as string) ?? [],
            is_archived: !!row.archived_at,
        }));

        res.json(requests);
    } catch (err) {
        next(err);
    }
}

export async function getQueue(req: Request, res: Response, next: NextFunction) {
    try {
        await activateDueScheduledRequests(req.user!.workspaceId);

        // Archived submissions are hidden from the active queue by default;
        // ?archived=true flips to the archived view (see archiveQueue below).
        const wantsArchived = req.query.archived === 'true';
        const archivedFilter = wantsArchived
            ? Prisma.sql`fr.archived_at IS NOT NULL`
            : Prisma.sql`fr.archived_at IS NULL`;

        const rows = await prisma.$queryRaw<RequestRow[]>`
            SELECT fr.id, fr.status, fr.requested_at, fr.submitted_at, fr.form_id,
                   fr.scheduled_at, fr.post_action, fr.action_taken_at, fr.assigned_to,
                   fr.archived_at,
                   f.title_en AS form_title_en, f.title_ar AS form_title_ar,
                   f.form_type, f.post_action AS form_post_action,
                   c.id AS client_id, c.client_code, c.fname, c.lname, c.email,
                   au.fname AS assignee_fname, au.lname AS assignee_lname,
                   c.current_package AS client_package,
                   NULL::text AS subscription_status
            FROM form_requests fr
            JOIN forms f ON f.id = fr.form_id
            JOIN clients c ON c.id = fr.client_id
            LEFT JOIN users au ON au.id = fr.assigned_to
            WHERE fr.workspace_id = ${req.user!.workspaceId}
              AND ${archivedFilter}
            ORDER BY fr.requested_at DESC
        `;

        // Batched, not per-row: firing one findMany() per queue row (the old
        // approach) meant a workspace with N submitted/reviewed requests opened
        // N+ concurrent Prisma queries on every page load — fine at small scale,
        // but it exhausted the connection pool once historical data pushed the
        // queue past a few dozen rows (a production incident, not hypothetical).
        const answerableIds = rows
            .filter((row) => row.status !== 'pending' && row.status !== 'scheduled' && row.status !== 'sent')
            .map((row) => row.id as string);

        const allResponses = answerableIds.length > 0
            ? await prisma.form_responses.findMany({
                where:  { request_id: { in: answerableIds } },
                select: { request_id: true, question_id: true, answer: true },
            })
            : [];
        // Forms Versioning Phase 3 — join against form_version_questions, the
        // immutable snapshot each response actually belongs to, so a historical
        // answer always renders under the label/type it was originally asked with,
        // regardless of later form edits.
        const enrichedResponses = await enrichResponsesWithQuestionInfo(allResponses);

        const responsesByRequestId = new Map<string, typeof enrichedResponses>();
        for (const r of enrichedResponses) {
            const list = responsesByRequestId.get(r.request_id as string) ?? [];
            list.push(r);
            responsesByRequestId.set(r.request_id as string, list);
        }

        const queueItems = rows.map((row) => {
            if (row.status === 'pending' || row.status === 'scheduled' || row.status === 'sent') {
                return {
                    id: row.id, clientId: row.client_id, clientCode: row.client_code,
                    clientName: `${row.fname} ${row.lname}`.trim(), clientEmail: row.email,
                    clientPackage: row.client_package, subscriptionStatus: row.subscription_status,
                    formId: row.form_id, formTitle_en: row.form_title_en, formTitle_ar: row.form_title_ar,
                    formType: row.form_type || 'check-in',
                    postAction: normalizePostAction(row.post_action || row.form_post_action),
                    requestedAt: row.requested_at, scheduledAt: row.scheduled_at, submittedAt: null, actionTakenAt: null,
                    // 'sent' means the scheduler dispatched it to the client but nothing has
                    // come back yet — same "awaiting" bucket as pending, not a distinct status
                    // the frontend needs to know about.
                    status: row.status === 'scheduled' ? 'scheduled' : 'awaiting',
                    assignedTo: row.assigned_to ?? null,
                    assignedToName: row.assigned_to ? `${row.assignee_fname ?? ''} ${row.assignee_lname ?? ''}`.trim() : null,
                    answers: {}, responses: [],
                    isArchived: !!row.archived_at, archivedAt: row.archived_at ?? null,
                };
            }

            const requestResponses = responsesByRequestId.get(row.id as string) ?? [];
            const answers: Record<string, unknown> = {};
            for (const r of requestResponses) { if (r.question_id) answers[r.question_id] = r.answer; }

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
                responses: requestResponses,
                isArchived: !!row.archived_at, archivedAt: row.archived_at ?? null,
            };
        });

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

// Archives (or restores) submitted/reviewed requests — the reversible counterpart to
// cancelQueue's hard delete, which only ever applies to pending/scheduled requests that
// were never submitted. Archiving just hides a completed submission from the active
// queue; every response row is preserved.
export async function archiveQueue(req: Request, res: Response, next: NextFunction) {
    const { ids, action } = req.body as { ids?: unknown[]; action?: string };
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'ids array is required' });
    }

    const actionType = action === 'restore' ? 'restore' : 'archive';

    try {
        if (actionType === 'restore') {
            await prisma.form_requests.updateMany({
                where: { workspace_id: req.user!.workspaceId, id: { in: ids.map(String) }, archived_at: { not: null } },
                data:  { archived_at: null, archived_by: null },
            });
        } else {
            await prisma.form_requests.updateMany({
                where: {
                    workspace_id: req.user!.workspaceId,
                    id:           { in: ids.map(String) },
                    status:       { in: ['submitted', 'reviewed'] },
                },
                data: { archived_at: new Date(), archived_by: req.user!.userId },
            });
        }

        const updated = await prisma.form_requests.findMany({
            where:  { workspace_id: req.user!.workspaceId, id: { in: ids.map(String) } },
            select: { id: true },
        });
        res.json({ updatedIds: updated.map(r => r.id) });
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
