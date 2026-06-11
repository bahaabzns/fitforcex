function toIsoDateOrNull(value) {
    if (!value) return null;
    const d = value instanceof Date ? value : new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function serializePlanRow(row) {
    if (!row) return row;
    return {
        ...row,
        created_at: toIsoDateOrNull(row.created_at),
        updated_at: toIsoDateOrNull(row.updated_at),
    };
}

function serializePlanRows(rows) {
    return (rows ?? []).map(serializePlanRow);
}

function normalizeOrderedList(items, orderKey) {
    if (!Array.isArray(items)) return [];
    return items.map((item, index) => ({
        ...(item ?? {}),
        [orderKey]: index + 1,
    }));
}

async function insertOrderedChildren({
    items,
    orderKey,
    insert,
}) {
    const ordered = normalizeOrderedList(items, orderKey);
    const insertedRows = [];

    for (const item of ordered) {
        const inserted = await insert(item);
        insertedRows.push(inserted);
    }

    return insertedRows;
}

async function withTransaction(pool, work) {
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

async function replaceClientPlansTransactional({ pool, work }) {
    return withTransaction(pool, work);
}

function assertSafeIdentifier(identifier, label) {
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(identifier)) {
        throw new Error(`Invalid ${label} identifier: ${identifier}`);
    }
}

async function activateSinglePlan({
    pool,
    tableName,
    planId,
    coachId,
    clientIdColumn = 'client_id',
    workspaceColumn = 'workspace_id',
}) {
    assertSafeIdentifier(tableName, 'table');
    assertSafeIdentifier(clientIdColumn, 'client id column');
    assertSafeIdentifier(workspaceColumn, 'workspace column');

    const planResult = await pool.query(
        `SELECT * FROM ${tableName} WHERE id = $1 AND ${workspaceColumn} = $2`,
        [planId, coachId]
    );

    if (planResult.rows.length === 0) {
        return null;
    }

    const plan = planResult.rows[0];

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

    return serializePlanRow(updated.rows[0]);
}

function createHttpError(status, message) {
    const err = new Error(message);
    err.status = status;
    return err;
}

async function saveSinglePlanDraft({
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
}) {
    if (!plan || typeof plan !== 'object') {
        throw createHttpError(400, 'plan object is required');
    }

    const oldPlanId = plan.id;
    const rawPlanId = String(plan.id ?? '');
    const parsedPlanId = Number(rawPlanId);
    const hasPersistentPlanId = !rawPlanId.startsWith('tmp-') && Number.isInteger(parsedPlanId);

    const txResult = await withTransaction(pool, async (dbClient) => {
        let existingCreatedAt = null;

        if (hasPersistentPlanId) {
            const existing = await loadExistingPlan({
                dbClient,
                planId: parsedPlanId,
                clientId,
                coachId,
            });

            if (!existing) {
                throw createHttpError(404, 'Plan not found for this client');
            }

            existingCreatedAt = existing.created_at;
            await deleteExistingPlanTree({
                dbClient,
                planId: parsedPlanId,
                clientId,
                coachId,
            });
        }

        const createdAt = toIsoDateOrNull(plan.created_at) || toIsoDateOrNull(existingCreatedAt) || new Date().toISOString();
        const updatedAt = new Date().toISOString();

        const insertedPlan = await insertPlanTree({
            dbClient,
            plan,
            clientId,
            coachId,
            createdAt,
            updatedAt,
        });

        const shouldActivate = plan.status === 'active' || String(activePlanId ?? '') === String(oldPlanId ?? '');
        if (shouldActivate) {
            await activatePlanInTransaction({
                dbClient,
                planId: insertedPlan.id,
                clientId,
                coachId,
            });
        }

        return {
            oldPlanId,
            newPlanId: insertedPlan.id,
        };
    });

    const savedPlan = await fetchSavedPlan({
        planId: txResult.newPlanId,
        clientId,
        coachId,
    });

    return {
        oldPlanId: txResult.oldPlanId,
        newPlanId: txResult.newPlanId,
        savedPlan: serializePlanRow(savedPlan),
    };
}

module.exports = {
    toIsoDateOrNull,
    serializePlanRow,
    serializePlanRows,
    normalizeOrderedList,
    insertOrderedChildren,
    withTransaction,
    replaceClientPlansTransactional,
    activateSinglePlan,
    saveSinglePlanDraft,
    createHttpError,
};
