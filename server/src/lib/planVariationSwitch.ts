import { getWorkspaceUsageCounts } from './seatLimits';

type VariationLimits = {
    max_clients: number | null;
    max_team_seats: number | null;
    max_workspaces: number | null;
};

/** Blocks switching (upgrade OR downgrade) to a variation whose limits the workspace's
 *  current usage already exceeds — no over-limit states are ever created. The coach must
 *  reduce usage (e.g. remove clients) before switching to a smaller variation. */
export async function checkVariationSwitchAllowed(
    workspaceId: string,
    ownerId: string,
    targetVariation: VariationLimits,
): Promise<void> {
    const { clientCount, seatCount, workspaceCount } = await getWorkspaceUsageCounts(workspaceId, ownerId);

    if (targetVariation.max_clients != null && clientCount > targetVariation.max_clients) {
        throw { status: 409, message: `client_limit_exceeded:${targetVariation.max_clients}` };
    }
    if (targetVariation.max_team_seats != null && seatCount > targetVariation.max_team_seats) {
        throw { status: 409, message: `seat_limit_exceeded:${targetVariation.max_team_seats}` };
    }
    if (targetVariation.max_workspaces != null && workspaceCount > targetVariation.max_workspaces) {
        throw { status: 409, message: `workspace_limit_exceeded:${targetVariation.max_workspaces}` };
    }
}
