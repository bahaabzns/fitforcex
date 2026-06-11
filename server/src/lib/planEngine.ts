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
    pool:           Pool;
    tableName:      string;
    planId:         string | number;
    coachId:        string;
    clientIdColumn?: string;
    workspaceColumn?: string;
}

export async function activateSinglePlan({
    pool,
    tableName,
    planId,
    coachId,
    clientIdColumn = 'client_id',
    workspaceColumn = 'workspace_id',
}: ActivateSinglePlanParams): Promise<PlainRecord | null> {
    assertSafeIdentifier(tableName, 'table');
    assertSafeIdentifier(clientIdColumn, 'client id column');
    assertSafeIdentifier(workspaceColumn, 'workspace column');

    const planResult = await pool.query(
        `SELECT * FROM ${tableName} WHERE id = $1 AND ${workspaceColumn} = $2`,
        [planId, coachId]
    );
    if (planResult.rows.length === 0) return null;

    const plan = planResult.rows[0] as PlainRecord;

    await pool.query(
        `UPDATE ${tableName}
         SET status = 'inactive'
         WHERE ${clientIdColumn} = $1 AND ${workspaceColumn} = $2 AND id != $3`,
        [plan[clientIdColumn], coachId, plan.id]
    );

    const updated = await pool.query(
        `UPDATE ${tableName}
         SET status = 'active', updated_at = NOW(),
             activated_at = COALESCE(activated_at, NOW())
         WHERE id = $1
         RETURNING *`,
        [plan.id]
    );

    return serializePlanRow(updated.rows[0] as PlainRecord);
}

interface SaveSinglePlanDraftParams {
    pool:                      Pool;
    plan:                      PlainRecord;
    clientId:                  string;
    coachId:                   string;
    activePlanId?:             string | number | null;
    loadExistingPlan:          (p: { dbClient: PoolClient; planId: number; clientId: string; coachId: string }) => Promise<PlainRecord | null>;
    deleteExistingPlanTree:    (p: { dbClient: PoolClient; planId: number; clientId: string; coachId: string }) => Promise<void>;
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
    const parsedPlanId   = Number(rawPlanId);
    const hasPersistentPlanId = !rawPlanId.startsWith('tmp-') && Number.isInteger(parsedPlanId);

    const txResult = await withTransaction(pool, async (dbClient) => {
        let existingCreatedAt: unknown = null;

        if (hasPersistentPlanId) {
            const existing = await loadExistingPlan({ dbClient, planId: parsedPlanId, clientId, coachId });
            if (!existing) throw createHttpError(404, 'Plan not found for this client');
            existingCreatedAt = existing.created_at;
            await deleteExistingPlanTree({ dbClient, planId: parsedPlanId, clientId, coachId });
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
