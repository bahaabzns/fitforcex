import { env } from '../../config/env';
import { TtlCache } from '../../lib/ttlCache';
import { invalidateClientStatus, invalidateWorkspaceClientStatuses } from '../../lib/clientStatusCache';
import type { EffectiveAccess } from './subscriptionPolicies.service';

// Every client-portal request recomputes the client's effective access (about eight
// queries across transactions, freezes, plans, packages and policies). The answer only
// changes when a payment, freeze, policy or archive change happens, so it is cached
// briefly per client. Writes in this process clear the entry immediately; the TTL is the
// backstop for changes that reach the database some other way (e.g. a plan activation).
//
// Kept free of any import of the service module's values so the service can call the
// invalidate helpers below without creating an import cycle.
const CLIENT_ACCESS_CACHE_MAX_ENTRIES = 5000;

const cache = new TtlCache<EffectiveAccess>({
    ttlMs:      env.CLIENT_ACCESS_CACHE_TTL_MS,
    maxEntries: CLIENT_ACCESS_CACHE_MAX_ENTRIES,
});

function cacheKey(workspaceId: string, clientId: string): string {
    return `${workspaceId}:${clientId}`;
}

export function getCachedClientAccess(
    clientId: string,
    workspaceId: string,
    loadAccess: () => Promise<EffectiveAccess>,
): Promise<EffectiveAccess> {
    return cache.getOrLoad(cacheKey(workspaceId, clientId), loadAccess);
}

// Everything that changes what a client may do also changes (or may change) the live status that
// lists and dashboards show, so both caches are cleared together from the same call sites.
export function invalidateClientAccess(workspaceId: string, clientId: string): void {
    cache.delete(cacheKey(workspaceId, clientId));
    invalidateClientStatus(workspaceId, clientId);
}

/** For workspace-wide changes (coach edits a subscription policy, any transaction write, plan activation). */
export function invalidateWorkspaceClientAccess(workspaceId: string): void {
    const prefix = `${workspaceId}:`;
    cache.deleteWhere((key) => key.startsWith(prefix));
    invalidateWorkspaceClientStatuses(workspaceId);
}
