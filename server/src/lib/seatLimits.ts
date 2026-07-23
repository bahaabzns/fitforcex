import pool from '../db';

// Every workspace_subscriptions row is backfilled with a variation_id (see
// backfill-plan-variations.ts), so pv.max_* is the live source of truth. The
// COALESCE onto p.max_* is a defensive fallback for the (expected-empty) window
// before that backfill has run against a given environment.
const LIMIT_JOIN = `
    FROM workspace_subscriptions ws
    JOIN plans p ON p.id = ws.plan_id
    LEFT JOIN plan_variations pv ON pv.id = ws.variation_id
`;

export async function checkSeatLimit(workspaceId: string): Promise<void> {
    const { rows } = await pool.query(`
        SELECT COALESCE(pv.max_team_seats, p.max_team_seats) AS max_team_seats,
               COUNT(DISTINCT wm.id) FILTER (WHERE wm.is_active = TRUE) AS active_members,
               COUNT(DISTINCT wi.id) FILTER (WHERE wi.status = 'pending')  AS pending_invitations
        ${LIMIT_JOIN}
        LEFT JOIN workspace_members wm     ON wm.workspace_id = $1
        LEFT JOIN workspace_invitations wi ON wi.workspace_id = $1
        WHERE ws.workspace_id = $1
        GROUP BY pv.max_team_seats, p.max_team_seats
    `, [workspaceId]);

    if (!rows.length) throw { status: 500, message: 'Subscription not found for workspace' };
    const { max_team_seats, active_members, pending_invitations } = rows[0] as Record<string, string | null>;
    if (max_team_seats === null) return;
    const used = parseInt(active_members ?? '0') + parseInt(pending_invitations ?? '0') + 1;
    if (used >= parseInt(max_team_seats)) {
        throw { status: 403, message: `Your plan allows ${max_team_seats} team seat(s). Upgrade to add more.` };
    }
}

export async function checkWorkspaceLimit(userId: string, currentWorkspaceId: string): Promise<void> {
    const { rows } = await pool.query(`
        SELECT COALESCE(pv.max_workspaces, p.max_workspaces) AS max_workspaces,
               (SELECT COUNT(*) FROM workspaces WHERE owner_id = $1 AND archived_at IS NULL) AS owned_count
        ${LIMIT_JOIN}
        WHERE ws.workspace_id = $2
    `, [userId, currentWorkspaceId]);

    if (!rows.length) return;
    const { max_workspaces, owned_count } = rows[0] as Record<string, string | null>;
    if (max_workspaces === null) return;
    if (parseInt(owned_count ?? '0') >= parseInt(max_workspaces)) {
        throw { status: 403, message: `Your plan allows ${max_workspaces} workspace(s). Upgrade to create more.` };
    }
}

export async function checkClientLimit(workspaceId: string): Promise<void> {
    const { rows } = await pool.query(`
        SELECT COALESCE(pv.max_clients, p.max_clients) AS max_clients,
               COUNT(c.id) AS active_clients
        ${LIMIT_JOIN}
        LEFT JOIN clients c ON c.workspace_id = $1
        WHERE ws.workspace_id = $1
        GROUP BY pv.max_clients, p.max_clients
    `, [workspaceId]);

    if (!rows.length) throw { status: 500, message: 'Subscription not found for workspace' };
    const { max_clients, active_clients } = rows[0] as Record<string, string | null>;
    if (max_clients === null) return;
    if (parseInt(active_clients ?? '0') >= parseInt(max_clients)) {
        throw { status: 403, message: `client_limit_reached:${max_clients}` };
    }
}

/** Raw usage counts for a workspace, independent of any plan/variation — used by the
 *  plan-switch downgrade guard (see planVariationSwitch.ts) to compare against a *target*
 *  variation's limits rather than the workspace's current one. */
export async function getWorkspaceUsageCounts(workspaceId: string, ownerId: string): Promise<{
    clientCount: number; seatCount: number; workspaceCount: number;
}> {
    const { rows } = await pool.query(`
        SELECT
            (SELECT COUNT(*) FROM clients c WHERE c.workspace_id = $1) AS client_count,
            (SELECT COUNT(DISTINCT wm.id) FROM workspace_members wm WHERE wm.workspace_id = $1 AND wm.is_active = TRUE)
                + (SELECT COUNT(DISTINCT wi.id) FROM workspace_invitations wi WHERE wi.workspace_id = $1 AND wi.status = 'pending')
                + 1 AS seat_count,
            (SELECT COUNT(*) FROM workspaces w WHERE w.owner_id = $2 AND w.archived_at IS NULL) AS workspace_count
    `, [workspaceId, ownerId]);

    const row = rows[0] as Record<string, string>;
    return {
        clientCount:    parseInt(row.client_count),
        seatCount:      parseInt(row.seat_count),
        workspaceCount: parseInt(row.workspace_count),
    };
}
