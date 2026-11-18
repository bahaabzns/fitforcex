import { env } from '../../config/env';
import { TtlCache } from '../../lib/ttlCache';

export interface CachedSession {
    revoked_at: Date | null;
    expires_at: Date;
}

// authMiddleware looks the session up on every coach request to honour logout/revoke.
// The row rarely changes, so it is cached briefly by token hash. Logout in this
// process clears the entry at once (revokeSession). If the API is ever run as several
// processes, a revoke on one would take up to SESSION_CACHE_TTL_MS to reach the others.
const SESSION_CACHE_MAX_ENTRIES = 10000;

const cache = new TtlCache<CachedSession | null>({
    ttlMs:      env.SESSION_CACHE_TTL_MS,
    maxEntries: SESSION_CACHE_MAX_ENTRIES,
});

export async function getCachedSession(
    tokenHash: string,
    loadSession: () => Promise<CachedSession | null>,
): Promise<CachedSession | null> {
    const session = await cache.getOrLoad(tokenHash, loadSession);
    // A missing row is not remembered: it would hide a session created moments later.
    if (!session) cache.delete(tokenHash);
    return session;
}

export function invalidateSession(tokenHash: string): void {
    cache.delete(tokenHash);
}
