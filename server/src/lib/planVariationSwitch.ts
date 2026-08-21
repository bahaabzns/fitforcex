import { getWorkspaceUsageCounts } from './seatLimits';

type VariationLimits = {
    max_clients: number | null;
    max_team_seats: number | null;
};

/** Blocks switching (upgrade OR downgrade) to a variation whose limits the workspace's
 *  current usage already exceeds — no over-limit states are ever created. The coach must
 *  reduce usage (e.g. remove clients) before switching to a smaller variation. Deliberately
 *  compares against the *destination's bare* limits (not boosted by the workspace's current
 *  add-ons) — a plan that doesn't support add-ons must still fit real usage. */
export async function checkVariationSwitchAllowed(
    workspaceId: string,
    targetVariation: VariationLimits,
): Promise<void> {
    const { clientCount, seatCount } = await getWorkspaceUsageCounts(workspaceId);

    if (targetVariation.max_clients != null && clientCount > targetVariation.max_clients) {
        throw { status: 409, message: `client_limit_exceeded:${targetVariation.max_clients}` };
    }
    if (targetVariation.max_team_seats != null && seatCount > targetVariation.max_team_seats) {
        throw { status: 409, message: `seat_limit_exceeded:${targetVariation.max_team_seats}` };
    }
}
