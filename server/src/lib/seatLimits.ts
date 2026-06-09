import pool from '../db';

export async function checkSeatLimit(workspaceId: string): Promise<void> {
    const { rows } = await pool.query(`
        SELECT p.max_team_seats,
               COUNT(DISTINCT wm.id) FILTER (WHERE wm.is_active = TRUE) AS active_members,
               COUNT(DISTINCT wi.id) FILTER (WHERE wi.status = 'pending')  AS pending_invitations
        FROM workspace_subscriptions ws
        JOIN plans p ON p.id = ws.plan_id
        LEFT JOIN workspace_members wm     ON wm.workspace_id = $1
        LEFT JOIN workspace_invitations wi ON wi.workspace_id = $1
        WHERE ws.workspace_id = $1
        GROUP BY p.max_team_seats
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
        SELECT p.max_workspaces,
               (SELECT COUNT(*) FROM workspaces WHERE owner_id = $1 AND archived_at IS NULL) AS owned_count
        FROM workspace_subscriptions ws
        JOIN plans p ON p.id = ws.plan_id
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
        SELECT p.max_clients,
               COUNT(c.id) AS active_clients
        FROM workspace_subscriptions ws
        JOIN plans p ON p.id = ws.plan_id
        LEFT JOIN clients c ON c.workspace_id = $1
        WHERE ws.workspace_id = $1
        GROUP BY p.max_clients
    `, [workspaceId]);

    if (!rows.length) throw { status: 500, message: 'Subscription not found for workspace' };
    const { max_clients, active_clients } = rows[0] as Record<string, string | null>;
    if (max_clients === null) return;
    if (parseInt(active_clients ?? '0') >= parseInt(max_clients)) {
        throw { status: 403, message: `client_limit_reached:${max_clients}` };
    }
}
