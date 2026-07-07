import { Pool, PoolClient } from 'pg';
import { createId } from '@paralleldrive/cuid2';
import { sealVersionForAssignment } from '../modules/forms/forms.service';

type PlainRecord = Record<string, unknown>;

export function toIsoDateOrNull(value: unknown): string | null {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value as string);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function serializePlanRow<T extends PlainRecord>(row: T | null): T | null {
    if (!row) return row;
    return {
        ...row,
        created_at: toIsoDateOrNull(row.created_at),
        updated_at: toIsoDateOrNull(row.updated_at),
    } as T;
}

export function serializePlanRows<T extends PlainRecord>(rows: T[] | null | undefined): T[] {
    return (rows ?? []).map(serializePlanRow) as T[];
}

export function normalizeOrderedList<T extends PlainRecord>(items: T[] | null | undefined, orderKey: string): T[] {
    if (!Array.isArray(items)) return [];
    return items.map((item, index) => ({
        ...(item ?? {}),
        [orderKey]: index + 1,
    })) as T[];
}

export async function insertOrderedChildren<T extends PlainRecord>({
    items,
    orderKey,
    insert,
}: {
    items:    T[];
    orderKey: string;
    insert:   (item: T) => Promise<T>;
}): Promise<T[]> {
    const ordered = normalizeOrderedList(items, orderKey);
    const insertedRows: T[] = [];
    for (const item of ordered) {
        const inserted = await insert(item);
        insertedRows.push(inserted);
    }
    return insertedRows;
}

export async function withTransaction<T>(pool: Pool, work: (client: PoolClient) => Promise<T>): Promise<T> {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        const result = await work(dbClient);
        await dbClient.query('COMMIT');
        return result;
    } catch (error) {
        await dbClient.query('ROLLBACK');
        throw error;
    } finally {
        dbClient.release();
    }
}

export async function replaceClientPlansTransactional<T>(
    { pool, work }: { pool: Pool; work: (client: PoolClient) => Promise<T> }
): Promise<T> {
    return withTransaction(pool, work);
}

export function assertSafeIdentifier(identifier: string, label: string): void {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
        throw new Error(`Invalid ${label} identifier: ${identifier}`);
    }
}

export function createHttpError(status: number, message: string): Error & { status: number } {
    const err = new Error(message) as Error & { status: number };
    err.status = status;
    return err;
}

interface ActivateSinglePlanParams {
    db:             Pool | PoolClient; // Pool for the standalone activate endpoint; PoolClient when called inside an existing transaction (savePlanDraft)
    tableName:      string;
    planId:         string | number;
    coachId:        string;
    clientIdColumn?: string;
    workspaceColumn?: string;
    /** Package Lifecycle Phase 3b. Resolved by the caller (package default or
     *  coach override in the Configure Activation modal). `undefined` leaves
     *  the plan's existing cycle_days untouched; `null` clears it. */
    cycleDays?: number | null;
    /** Package Lifecycle Phase 4. Snapshotted the same way as cycleDays --
     *  read fresh from the package at the moment of activation, then held
     *  stable so the daily review-due scheduler check doesn't depend on the
     *  client's *current* package possibly having changed since. */
    reviewOffsetDays?: number | null;
    /** Only consulted when the plan already has a non-null activated_at --
     *  i.e. this is an edit of an already-active plan, not a first activation.
     *  'extend' (default-safe): keep the existing activated_at/cycle_end_at.
     *  'restart': stamp a fresh activated_at and recompute cycle_end_at. */
    updateMode?: 'restart' | 'extend';
}

/**
 * The single place a plan (nutrition or training) transitions to Active.
 * Deactivates every sibling plan for the client, then either preserves the
 * plan's existing activation/cycle-end dates ("extend") or stamps fresh ones
 * ("restart") -- see Business Logic §12.4-12.5 in the Package Lifecycle plan.
 * A plan with no prior activated_at (never activated before) always takes
 * the "restart" branch trivially, regardless of updateMode -- there is
 * nothing to extend from.
 */
export async function activateSinglePlan({
    db,
    tableName,
    planId,
    coachId,
    clientIdColumn = 'client_id',
    workspaceColumn = 'workspace_id',
    cycleDays,
    reviewOffsetDays,
    updateMode,
}: ActivateSinglePlanParams): Promise<PlainRecord | null> {
    assertSafeIdentifier(tableName, 'table');
    assertSafeIdentifier(clientIdColumn, 'client id column');
    assertSafeIdentifier(workspaceColumn, 'workspace column');

    const planResult = await db.query(
        `SELECT * FROM ${tableName} WHERE id = $1 AND ${workspaceColumn} = $2`,
        [planId, coachId]
    );
    if (planResult.rows.length === 0) return null;

    const plan = planResult.rows[0] as PlainRecord;

    await db.query(
        `UPDATE ${tableName}
         SET status = 'inactive'
         WHERE ${clientIdColumn} = $1 AND ${workspaceColumn} = $2 AND id != $3`,
        [plan[clientIdColumn], coachId, plan.id]
    );

    const hasPriorActivation   = plan.activated_at != null;
    const resolvedCycleDays    = cycleDays !== undefined ? cycleDays : (plan.cycle_days as number | null);
    const resolvedReviewOffset = reviewOffsetDays !== undefined ? reviewOffsetDays : (plan.review_offset_days as number | null);

    let activatedAt: Date;
    let cycleEndAt: Date | null;
    let clearReviewNotified = false;

    if (hasPriorActivation && updateMode === 'extend') {
        activatedAt = new Date(plan.activated_at as string | Date);
        cycleEndAt  = plan.cycle_end_at
            ? new Date(plan.cycle_end_at as string | Date)
            : (resolvedCycleDays ? new Date(activatedAt.getTime() + resolvedCycleDays * 86400000) : null);
    } else {
        activatedAt = new Date();
        cycleEndAt  = resolvedCycleDays ? new Date(Date.now() + resolvedCycleDays * 86400000) : null;
        if (hasPriorActivation) clearReviewNotified = true; // a real restart, not a first-time activation
    }

    const updated = await db.query(
        `UPDATE ${tableName}
         SET status = 'active', updated_at = NOW(),
             activated_at = $2, cycle_days = $3, cycle_end_at = $4, review_offset_days = $5
             ${clearReviewNotified ? ', review_notified_at = NULL' : ''}
         WHERE id = $1
         RETURNING *`,
        [plan.id, activatedAt, resolvedCycleDays, cycleEndAt, resolvedReviewOffset]
    );

    return serializePlanRow(updated.rows[0] as PlainRecord);
}

/**
 * Package Lifecycle — reconciles a client's scheduled check-ins for one
 * plan against a NEW desired form set and due date. Called on plan restart
 * (the Configure Activation modal re-opened with the coach free to change
 * duration and/or check-in forms, not just confirm the same ones) — shared
 * by nutrition and training's savePlanDraft so the reconciliation rules
 * live in exactly one place, matching activateSinglePlan's pattern above.
 *
 * Three-way diff against what's already scheduled (paused_at IS NULL, i.e.
 * still live):
 *  - Still selected  -> retarget the SAME check_in_schedules/form_requests
 *    row to the new due date. Never re-created, so this can't duplicate a
 *    scheduled request no matter how many times a plan is restarted.
 *  - No longer selected -> cancel: delete the still-'scheduled' (not yet
 *    delivered) form_requests row and its schedule row. A request that's
 *    already moved past 'scheduled' (delivered, answered, etc.) is left
 *    alone — restarting a plan must never retroactively erase a client's
 *    submitted history, only affect what hasn't happened yet.
 *  - Newly selected -> a fresh schedule+request pair, sealed exactly like
 *    first activation (sealVersionForAssignment pins the wording the
 *    client will actually see, same "assignment moment" convention used
 *    everywhere else a check-in is committed to a client).
 *
 * `checkInForms === undefined` (the coach's save didn't go through the
 * reconfigure flow) preserves the pre-existing behavior exactly: every
 * currently-scheduled form is treated as "still selected" and only its due
 * date moves — no adds, no removals.
 */
export async function reconcileCheckInSchedules({
    dbClient,
    sourcePlanType,
    sourcePlanId,
    clientId,
    workspaceId,
    cycleEndAt,
    checkInForms,
    actorUserId,
}: {
    dbClient: PoolClient;
    sourcePlanType: 'nutrition' | 'training';
    sourcePlanId: string;
    clientId: string;
    workspaceId: string;
    cycleEndAt: Date;
    checkInForms?: Array<{ formId: string }>;
    actorUserId: string | null;
}): Promise<void> {
    const existing = await dbClient.query(
        `SELECT id, form_id, form_request_id FROM check_in_schedules
         WHERE source_plan_type = $1 AND client_id = $2 AND paused_at IS NULL`,
        [sourcePlanType, clientId]
    );
    const existingRows = existing.rows as { id: string; form_id: string; form_request_id: string | null }[];
    const existingFormIds = new Set(existingRows.map((r) => r.form_id));
    const desiredFormIds = checkInForms !== undefined
        ? new Set(checkInForms.map((f) => f.formId).filter(Boolean))
        : existingFormIds;

    for (const row of existingRows) {
        if (desiredFormIds.has(row.form_id)) {
            await dbClient.query(`UPDATE check_in_schedules SET next_due_at = $2 WHERE id = $1`, [row.id, cycleEndAt]);
            if (row.form_request_id) {
                await dbClient.query(
                    `UPDATE form_requests SET scheduled_at = $2 WHERE id = $1 AND status = 'scheduled'`,
                    [row.form_request_id, cycleEndAt]
                );
            }
        } else {
            if (row.form_request_id) {
                await dbClient.query(`DELETE FROM form_requests WHERE id = $1 AND status = 'scheduled'`, [row.form_request_id]);
            }
            await dbClient.query(`DELETE FROM check_in_schedules WHERE id = $1`, [row.id]);
        }
    }

    const toAdd = [...desiredFormIds].filter((id) => !existingFormIds.has(id));
    for (const formId of toAdd) {
        const { versionId } = await sealVersionForAssignment(formId, workspaceId, actorUserId);
        const requestId = createId();
        await dbClient.query(
            `INSERT INTO form_requests (id, form_id, form_version_id, client_id, workspace_id, status, scheduled_at)
             VALUES ($1, $2, $3, $4, $5, 'scheduled', $6)`,
            [requestId, formId, versionId, clientId, workspaceId, cycleEndAt]
        );
        await dbClient.query(
            `INSERT INTO check_in_schedules (id, workspace_id, client_id, form_id, next_due_at, source_plan_type, source_plan_id, form_request_id)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [createId(), workspaceId, clientId, formId, cycleEndAt, sourcePlanType, sourcePlanId, requestId]
        );
    }
}

interface SaveSinglePlanDraftParams {
    pool:                      Pool;
    plan:                      PlainRecord;
    clientId:                  string;
    coachId:                   string;
    activePlanId?:             string | number | null;
    loadExistingPlan:          (p: { dbClient: PoolClient; planId: string; clientId: string; coachId: string }) => Promise<PlainRecord | null>;
    deleteExistingPlanTree:    (p: { dbClient: PoolClient; planId: string; clientId: string; coachId: string }) => Promise<void>;
    insertPlanTree:            (p: { dbClient: PoolClient; plan: PlainRecord; clientId: string; coachId: string; createdAt: string; updatedAt: string }) => Promise<PlainRecord>;
    activatePlanInTransaction: (p: { dbClient: PoolClient; planId: unknown; clientId: string; coachId: string }) => Promise<void>;
    fetchSavedPlan:            (p: { planId: unknown; clientId: string; coachId: string }) => Promise<PlainRecord>;
}

export async function saveSinglePlanDraft({
    pool,
    plan,
    clientId,
    coachId,
    activePlanId = null,
    loadExistingPlan,
    deleteExistingPlanTree,
    insertPlanTree,
    activatePlanInTransaction,
    fetchSavedPlan,
}: SaveSinglePlanDraftParams): Promise<{ oldPlanId: unknown; newPlanId: unknown; savedPlan: PlainRecord | null }> {
    if (!plan || typeof plan !== 'object') {
        throw createHttpError(400, 'plan object is required');
    }

    const oldPlanId      = plan.id;
    const rawPlanId      = String(plan.id ?? '');
    // Persisted plans use cuid string ids; only unsaved client-side drafts use
    // `tmp-` ids. (IDs migrated int→cuid, so an integer check here misclassified
    // every saved plan as new and re-inserted it, duplicating the plan.)
    const hasPersistentPlanId = rawPlanId !== '' && !rawPlanId.startsWith('tmp-');

    const txResult = await withTransaction(pool, async (dbClient) => {
        let existingCreatedAt: unknown = null;

        if (hasPersistentPlanId) {
            const existing = await loadExistingPlan({ dbClient, planId: rawPlanId, clientId, coachId });
            if (!existing) throw createHttpError(404, 'Plan not found for this client');
            existingCreatedAt = existing.created_at;
            await deleteExistingPlanTree({ dbClient, planId: rawPlanId, clientId, coachId });
        }

        const createdAt = toIsoDateOrNull(plan.created_at) || toIsoDateOrNull(existingCreatedAt) || new Date().toISOString();
        const updatedAt = new Date().toISOString();

        const insertedPlan = await insertPlanTree({ dbClient, plan, clientId, coachId, createdAt, updatedAt });

        const shouldActivate = plan.status === 'active' || String(activePlanId ?? '') === String(oldPlanId ?? '');
        if (shouldActivate) {
            await activatePlanInTransaction({ dbClient, planId: insertedPlan.id, clientId, coachId });
        }

        return { oldPlanId, newPlanId: insertedPlan.id };
    });

    const savedPlan = await fetchSavedPlan({ planId: txResult.newPlanId, clientId, coachId });

    return {
        oldPlanId:  txResult.oldPlanId,
        newPlanId:  txResult.newPlanId,
        savedPlan:  serializePlanRow(savedPlan),
    };
}
