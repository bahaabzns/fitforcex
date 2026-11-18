import { env } from '../config/env';
import { TtlCache } from './ttlCache';

// Live-computed subscription status per client (before the "Archived" override, which depends
// on the caller's archived_at). The clients list, messenger list, dashboard and portal checks all
// recompute it from every transaction, freeze and plan of every client they show, so with big
// workspaces the same heavy computation repeated on every refetch and poll.
//
// Cleared by every write that can change a status (see clientAccessCache.ts, which fans out to
// here, and planEngine.ts for plan activation); the TTL is the backstop for anything else.
const CLIENT_STATUS_CACHE_MAX_ENTRIES = 100_000;

export const clientStatusCache = new TtlCache<string>({
    ttlMs:      env.CLIENT_STATUS_CACHE_TTL_MS,
    maxEntries: CLIENT_STATUS_CACHE_MAX_ENTRIES,
});

export function clientStatusKey(workspaceId: string, clientId: string): string {
    return `${workspaceId}:${clientId}`;
}

export function invalidateClientStatus(workspaceId: string, clientId: string): void {
    clientStatusCache.delete(clientStatusKey(workspaceId, clientId));
}

export function invalidateWorkspaceClientStatuses(workspaceId: string): void {
    const prefix = `${workspaceId}:`;
    clientStatusCache.deleteWhere((key) => key.startsWith(prefix));
}
