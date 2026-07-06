import { Pool, PoolClient } from 'pg';

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

    const hasPriorActivation = plan.activated_at != null;
    const resolvedCycleDays  = cycleDays !== undefined ? cycleDays : (plan.cycle_days as number | null);

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
             activated_at = $2, cycle_days = $3, cycle_end_at = $4
             ${clearReviewNotified ? ', review_notified_at = NULL' : ''}
         WHERE id = $1
         RETURNING *`,
        [plan.id, activatedAt, resolvedCycleDays, cycleEndAt]
    );

    return serializePlanRow(updated.rows[0] as PlainRecord);
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
