import { createId } from '@paralleldrive/cuid2';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';

type TxClient = Prisma.TransactionClient;
type VersionRow = { id: string; version_number: number; sealed_at: Date | null };

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
 */
export async function resolveWritableVersion(formId: string, actorUserId: string | null): Promise<WritableVersionResult> {
    return prisma.$transaction(async (tx) => {
        const form = await tx.forms.findUniqueOrThrow({
            where: { id: formId },
            select: { current_version_id: true },
        });

        if (form.current_version_id) {
            const rows = await tx.$queryRaw<VersionRow[]>`
                SELECT id, version_number, sealed_at FROM form_versions WHERE id = ${form.current_version_id} FOR UPDATE
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
 * The `sealed_at = null` guard in the UPDATE (not a prior read-then-write)
 * makes two simultaneous first-assignments race-safe without needing a
 * row lock: whichever caller's UPDATE lands first seals it; the other's
 * UPDATE simply affects zero rows and both callers proceed with the same
 * version id.
 */
export async function sealVersionForAssignment(formId: string, actorUserId: string | null = null): Promise<{ versionId: string }> {
    return prisma.$transaction(async (tx) => {
        const form = await tx.forms.findUniqueOrThrow({
            where: { id: formId },
            select: { current_version_id: true },
        });

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
