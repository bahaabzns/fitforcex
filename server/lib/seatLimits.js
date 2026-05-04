const pool = require('../db');

async function checkSeatLimit(workspaceId) {
    const { rows } = await pool.query(`
        SELECT p.max_team_seats,
               COUNT(DISTINCT wm.id) FILTER (WHERE wm.is_active = TRUE) AS active_members,
               COUNT(DISTINCT wi.id) FILTER (WHERE wi.status = 'pending')  AS pending_invitations
        FROM workspace_subscriptions ws
        JOIN plans p ON p.id = ws.plan_id
        LEFT JOIN workspace_members wm    ON wm.workspace_id = $1
        LEFT JOIN workspace_invitations wi ON wi.workspace_id = $1
        WHERE ws.workspace_id = $1
        GROUP BY p.max_team_seats
    `, [workspaceId]);

    if (!rows.length) throw { status: 500, message: 'Subscription not found for workspace' };
    const { max_team_seats, active_members, pending_invitations } = rows[0];
    if (max_team_seats === null) return;  // unlimited
    const used = parseInt(active_members) + parseInt(pending_invitations);
    if (used >= parseInt(max_team_seats)) {
        throw { status: 403, message: `Your plan allows ${max_team_seats} team seat(s). Upgrade to add more.` };
    }
}

async function checkWorkspaceLimit(userId) {
    const { rows } = await pool.query(`
        SELECT p.max_workspaces,
               COUNT(w.id) AS owned_count
        FROM workspaces w
        JOIN workspace_subscriptions ws ON ws.workspace_id = w.id
        JOIN plans p ON p.id = ws.plan_id
        WHERE w.owner_id = $1 AND w.archived_at IS NULL
        GROUP BY p.max_workspaces
        ORDER BY p.max_workspaces ASC NULLS LAST
        LIMIT 1
    `, [userId]);

    if (!rows.length) return;  // no workspaces yet — allow
    const { max_workspaces, owned_count } = rows[0];
    if (max_workspaces === null) return;  // unlimited
    if (parseInt(owned_count) >= parseInt(max_workspaces)) {
        throw { status: 403, message: `Your plan allows ${max_workspaces} workspace(s). Upgrade to create more.` };
    }
}

module.exports = { checkSeatLimit, checkWorkspaceLimit };
