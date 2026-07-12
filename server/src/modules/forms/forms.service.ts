import { createId } from '@paralleldrive/cuid2';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

type TxClient = Prisma.TransactionClient;
type VersionRow = { id: string; version_number: number; sealed_at: Date | null };
type FormRow = { id: string; current_version_id: string | null; status: string };

/**
 * Thrown by resolveWritableVersion/sealVersionForAssignment when formId
 * doesn't resolve inside the given workspace — either it doesn't exist, or
 * it belongs to a different tenant. Deliberately indistinguishable between
 * the two (404, not 403) so a caller can't use this endpoint to enumerate
 * which form ids exist in other workspaces. Carries `.status` so it maps
 * straight through the global error handler (see app.ts) when a controller
 * does `catch (err) { next(err); }`.
 */
export class FormNotFoundError extends Error {
    status = 404;
    constructor(message = 'Form not found') {
        super(message);
        this.name = 'FormNotFoundError';
    }
}

/**
 * Thrown by sealVersionForAssignment when the form has been archived.
 * Archiving means "stop offering this for new assignments" (see
 * docs/forms-versioning-implementation-plan.md Phase 5) — every caller that
 * commits a form to a client (coach-initiated createRequests, package/plan
 * activation, the scheduler's dispatch tick) goes through this one function,
 * so the rule is enforced here once rather than duplicated at each call site.
 * 409, not 404: the form exists and is visible to this workspace, it's just
 * not in an assignable state — matches deleteForm's existing 409 convention
 * for "exists but blocked" responses.
 */
export class FormArchivedError extends Error {
    status = 409;
    constructor(message = 'This form has been archived and can no longer be assigned') {
        super(message);
        this.name = 'FormArchivedError';
    }
}

export interface WritableVersionResult {
    versionId: string;
    isNewVersion: boolean;
    /**
     * Old form_version_questions.id -> new id, populated only when this call
     * forked an existing sealed version (clones get fresh ids). Callers that
     * received a question id from the client (updateQuestion, deleteQuestion,
     * reorderQuestions) must translate through this map before using it,
     * since a fork silently invalidates every question id in the version it
     * replaced — not just the one being edited.
     */
    questionIdMap: Map<string, string>;
}

/**
 * Forms Versioning Phase 2 — the one place that decides whether a question
 * edit mutates the form's current (still-unsealed) version in place, or
 * forks a new version because the current one has already been assigned to
 * at least one client (sealed_at IS NOT NULL).
 *
 * Uses a row lock (`FOR UPDATE`) inside a transaction so two concurrent
 * edits racing right after a seal can't both decide to fork — a pessimistic
 * lock rather than optimistic retry, because forks are rare (only the first
 * edit after a seal) and cheap, so lock contention is a non-issue. See
 * docs/forms-versioning-implementation-plan.md, Phase 2 "Transactions &
 * Concurrency".
 *
 * Post-review fix: `workspaceId` is required and checked before any read or
 * write touches the form, here rather than duplicated in every caller, so
 * every write path through this module is tenant-scoped by construction —
 * see docs/forms-versioning-implementation-plan.md's Release-Readiness
 * Review addendum for why this was centralized here specifically.
 *
 * Post-review fix #2 (found by an automated concurrency test, not by
 * reasoning — see tests/integration/formsVersioning.test.ts): the lock used
 * to be taken on the `form_versions` row `current_version_id` pointed at,
 * read via a prior, unlocked `forms` read. Two concurrent callers could
 * both capture the same (soon-to-be-stale) `current_version_id` before
 * either committed, both queue on the FOR UPDATE for that same version row,
 * and — since neither ever re-checks whether `forms.current_version_id`
 * moved while it waited — both compute `version_number = parent + 1` off
 * the SAME parent, forking two sibling versions with the same number and
 * crashing on the `@@unique([form_id, version_number])` constraint. Fixed
 * by locking the `forms` row itself first: the pointer that can change is
 * what needs the lock, not the row it happened to point at when read.
 * `resolveWritableVersion` and `sealVersionForAssignment` now take this
 * exact same lock, in the same order, so every combination of concurrent
 * edit/assign calls for one form is fully serialized against every other.
 */
export async function resolveWritableVersion(formId: string, workspaceId: string, actorUserId: string | null): Promise<WritableVersionResult> {
    return prisma.$transaction(async (tx) => {
        const form = await lockForm(tx, formId, workspaceId);
        if (!form) throw new FormNotFoundError();

        if (form.current_version_id) {
            const rows = await tx.$queryRaw<VersionRow[]>`
                SELECT id, version_number, sealed_at FROM form_versions WHERE id = ${form.current_version_id}
            `;
            const current = rows[0];
            if (current && !current.sealed_at) {
                return { versionId: current.id, isNewVersion: false, questionIdMap: new Map() };
            }
            if (current) {
                const { versionId, questionIdMap } = await forkVersion(tx, formId, current, actorUserId);
                return { versionId, isNewVersion: true, questionIdMap };
            }
        }

        // Defensive fallback — every form should already have a current
        // version (createForm and the Phase 1 backfill both guarantee one).
        // Create version 1 rather than throw, so a form that somehow
        // slipped through isn't permanently unwritable.
        const versionId = createId();
        await tx.form_versions.create({
            data: { id: versionId, form_id: formId, version_number: 1, created_by: actorUserId },
        });
        await tx.forms.update({ where: { id: formId }, data: { current_version_id: versionId } });
        return { versionId, isNewVersion: true, questionIdMap: new Map() };
    });
}

/**
 * Locks the `forms` row (tenant-scoped) and returns its version-resolution
 * fields, or `null` if it doesn't exist in this workspace. Shared by
 * resolveWritableVersion and sealVersionForAssignment so both lock the same
 * row, in the same way, before either reads current_version_id — see the
 * "Post-review fix #2" note above for why the lock has to be here, not on
 * form_versions.
 */
async function lockForm(tx: TxClient, formId: string, workspaceId: string): Promise<FormRow | null> {
    const rows = await tx.$queryRaw<FormRow[]>`
        SELECT id, current_version_id, status FROM forms
        WHERE id = ${formId} AND workspace_id = ${workspaceId}
        FOR UPDATE
    `;
    return rows[0] ?? null;
}

async function forkVersion(
    tx: TxClient,
    formId: string,
    current: VersionRow,
    actorUserId: string | null
): Promise<{ versionId: string; questionIdMap: Map<string, string> }> {
    const newVersionId = createId();
    await tx.form_versions.create({
        data: { id: newVersionId, form_id: formId, version_number: current.version_number + 1, created_by: actorUserId },
    });

    const questions = await tx.form_version_questions.findMany({ where: { form_version_id: current.id } });
    const questionIdMap = new Map<string, string>();
    if (questions.length > 0) {
        const clones = questions.map((q) => ({ oldId: q.id, newId: createId(), source: q }));
        await tx.form_version_questions.createMany({
            data: clones.map(({ newId, source: q }) => ({
                id:             newId,
                form_version_id: newVersionId,
                label_en:       q.label_en,
                label_ar:       q.label_ar,
                type:           q.type,
                required:       q.required,
                order_index:    q.order_index,
                options:        q.options    != null ? (q.options    as Prisma.InputJsonValue) : Prisma.DbNull,
                options_ar:     q.options_ar != null ? (q.options_ar as Prisma.InputJsonValue) : Prisma.DbNull,
                placeholder_en: q.placeholder_en,
                placeholder_ar: q.placeholder_ar,
                min_value:      q.min_value,
                max_value:      q.max_value,
                metric_id:      q.metric_id,
                // Question lineage tracking — propagate the source's root
                // forward (never regenerate) so every clone born from the
                // same original question, across any number of forks,
                // keeps pointing at one shared root. See
                // migrations/043_form_version_questions_lineage.js.
                origin_question_id: q.origin_question_id,
            })),
        });
        for (const { oldId, newId } of clones) questionIdMap.set(oldId, newId);
    }

    await tx.forms.update({ where: { id: formId }, data: { current_version_id: newVersionId } });
    return { versionId: newVersionId, questionIdMap };
}

/**
 * Called exactly where a form is actually committed to a client — a coach
 * assigning it (`createRequests`) or the scheduler dispatching a due
 * check-in. Seals the form's current version if it's still a fresh, unused
 * draft; a no-op if it's already sealed. Returns the (now guaranteed
 * sealed) version id to pin on the new `form_requests` row.
 *
 * Post-review fix: now takes the same `forms`-row lock as
 * resolveWritableVersion (via the shared `lockForm` helper) instead of a
 * lock-free read + `sealed_at = null` guarded UPDATE. The guarded UPDATE
 * alone was race-safe against a second simultaneous *seal*, but not against
 * a concurrent *edit*: without the lock, this function could read a stale
 * `current_version_id` that a concurrent fork was about to replace, and
 * seal the now-superseded old version instead of the one the coach's edit
 * just created — the new assignment would silently carry the old wording.
 * Sharing the same lock as resolveWritableVersion (same row, same order)
 * closes this and makes every edit/assign combination for one form fully
 * serialized. See resolveWritableVersion's doc comment for the full trace
 * (found by an automated concurrency test, not by reasoning).
 *
 * `workspaceId` is required and checked before touching the form — see the
 * identical note on resolveWritableVersion above. Also rejects an archived
 * form (FormArchivedError) — see that class's doc comment.
 */
export async function sealVersionForAssignment(formId: string, workspaceId: string, actorUserId: string | null = null): Promise<{ versionId: string }> {
    return prisma.$transaction(async (tx) => {
        const form = await lockForm(tx, formId, workspaceId);
        if (!form) throw new FormNotFoundError();
        if (form.status === 'archived') throw new FormArchivedError();

        if (!form.current_version_id) {
            const versionId = createId();
            await tx.form_versions.create({
                data: { id: versionId, form_id: formId, version_number: 1, sealed_at: new Date(), created_by: actorUserId },
            });
            await tx.forms.update({ where: { id: formId }, data: { current_version_id: versionId } });
            return { versionId };
        }

        await tx.form_versions.updateMany({
            where: { id: form.current_version_id, sealed_at: null },
            data:  { sealed_at: new Date() },
        });
        return { versionId: form.current_version_id };
    });
}
