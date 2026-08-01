import pool from '../db';

// Every workspace_subscriptions row is backfilled with a variation_id (see
// backfill-plan-variations.ts), so pv.max_clients is the live source of truth for the client
// limit. The COALESCE onto p.max_clients is a defensive fallback for the (expected-empty)
// window before that backfill has run against a given environment. Team-seat count is a flat
// per-plan allotment (plans.max_team_seats) — variations no longer carry it (see founder
// pricing decisions: TeamForce variations differ only by client limit + price).
const LIMIT_JOIN = `
    FROM workspace_subscriptions ws
    JOIN plans p ON p.id = ws.plan_id
    LEFT JOIN plan_variations pv ON pv.id = ws.variation_id
`;

/** Sum of active add-on units purchased for a workspace, for one limit dimension
 *  ('clients' | 'team_seats') — null base limits (unlimited) never need this, so callers only
 *  add it onto a non-null numeric base. */
async function getActiveAddonUnits(workspaceId: string, dimension: string): Promise<number> {
    const { rows } = await pool.query(`
        SELECT COALESCE(SUM(quantity * units), 0) AS total_units
        FROM workspace_addons
        WHERE workspace_id = $1 AND dimension = $2 AND status = 'active'
    `, [workspaceId, dimension]);
    return parseInt((rows[0] as { total_units: string }).total_units);
}

export async function checkSeatLimit(workspaceId: string): Promise<void> {
    const { rows } = await pool.query(`
        SELECT p.max_team_seats,
               COUNT(DISTINCT wm.id) FILTER (WHERE wm.is_active = TRUE) AS active_members,
               COUNT(DISTINCT wi.id) FILTER (WHERE wi.status = 'pending')  AS pending_invitations
        ${LIMIT_JOIN}
        LEFT JOIN workspace_members wm     ON wm.workspace_id = $1
        LEFT JOIN workspace_invitations wi ON wi.workspace_id = $1
        WHERE ws.workspace_id = $1
        GROUP BY p.max_team_seats
    `, [workspaceId]);

    if (!rows.length) throw { status: 500, message: 'Subscription not found for workspace' };
    const { max_team_seats, active_members, pending_invitations } = rows[0] as Record<string, string | null>;
    if (max_team_seats === null) return;

    const addonUnits = await getActiveAddonUnits(workspaceId, 'team_seats');
    const effectiveMax = parseInt(max_team_seats) + addonUnits;
    const used = parseInt(active_members ?? '0') + parseInt(pending_invitations ?? '0') + 1;
    if (used >= effectiveMax) {
        throw { status: 403, message: `Your plan allows ${effectiveMax} team seat(s). Upgrade or buy a team-member add-on to add more.` };
    }
}

export async function checkClientLimit(workspaceId: string): Promise<void> {
    // Every client counts against the limit except deleted ones — intentional, to stop
    // freezing/expiring/archiving a client from being used as a way to dodge the plan cap.
    const { rows } = await pool.query(`
        SELECT COALESCE(pv.max_clients, p.max_clients) AS max_clients,
               COUNT(c.id) AS active_clients
        ${LIMIT_JOIN}
        LEFT JOIN clients c ON c.workspace_id = $1 AND c.deleted_at IS NULL
        WHERE ws.workspace_id = $1
        GROUP BY pv.max_clients, p.max_clients
    `, [workspaceId]);

    if (!rows.length) throw { status: 500, message: 'Subscription not found for workspace' };
    const { max_clients, active_clients } = rows[0] as Record<string, string | null>;
    if (max_clients === null) return;

    const addonUnits = await getActiveAddonUnits(workspaceId, 'clients');
    const effectiveMax = parseInt(max_clients) + addonUnits;
    if (parseInt(active_clients ?? '0') >= effectiveMax) {
        throw { status: 403, message: `client_limit_reached:${effectiveMax}` };
    }
}

/** Effective limits for display (e.g. the subscription settings page) — base plan/variation
 *  limit plus active add-on units, same math `checkClientLimit`/`checkSeatLimit` enforce with,
 *  but without the "used" counts those need for the actual over-limit check. */
export async function getEffectiveLimits(workspaceId: string): Promise<{
    maxClients: number | null; maxTeamSeats: number | null;
}> {
    const { rows } = await pool.query(`
        SELECT COALESCE(pv.max_clients, p.max_clients) AS max_clients, p.max_team_seats
        ${LIMIT_JOIN}
        WHERE ws.workspace_id = $1
    `, [workspaceId]);
    if (!rows.length) return { maxClients: null, maxTeamSeats: null };

    const { max_clients, max_team_seats } = rows[0] as Record<string, string | null>;
    const [clientAddonUnits, seatAddonUnits] = await Promise.all([
        max_clients !== null ? getActiveAddonUnits(workspaceId, 'clients') : Promise.resolve(0),
        max_team_seats !== null ? getActiveAddonUnits(workspaceId, 'team_seats') : Promise.resolve(0),
    ]);

    return {
        maxClients:   max_clients !== null ? parseInt(max_clients) + clientAddonUnits : null,
        maxTeamSeats: max_team_seats !== null ? parseInt(max_team_seats) + seatAddonUnits : null,
    };
}

/** Raw usage counts for a workspace, independent of any plan/variation/add-on — used by the
 *  plan-switch downgrade guard (see planVariationSwitch.ts) to compare against a *target*
 *  variation's bare limits (a downgrade destination that doesn't support add-ons must still
 *  fit the workspace's real usage, not usage minus its current add-on-boosted capacity). */
export async function getWorkspaceUsageCounts(workspaceId: string): Promise<{
    clientCount: number; seatCount: number;
}> {
    const { rows } = await pool.query(`
        SELECT
            (SELECT COUNT(*) FROM clients c WHERE c.workspace_id = $1 AND c.deleted_at IS NULL) AS client_count,
            (SELECT COUNT(DISTINCT wm.id) FROM workspace_members wm WHERE wm.workspace_id = $1 AND wm.is_active = TRUE)
                + (SELECT COUNT(DISTINCT wi.id) FROM workspace_invitations wi WHERE wi.workspace_id = $1 AND wi.status = 'pending')
                + 1 AS seat_count
    `, [workspaceId]);

    const row = rows[0] as Record<string, string>;
    return {
        clientCount: parseInt(row.client_count),
        seatCount:   parseInt(row.seat_count),
    };
}
