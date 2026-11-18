/**
 * Small in-process cache with a time-to-live, a size cap and in-flight de-duplication.
 *
 * Why it exists: a few per-request database lookups (session check, client access
 * computation) run on every poll and return the same answer for seconds at a time.
 * Single API process only — if the API is ever scaled out, entries are per-process,
 * so the TTL (not invalidation) becomes the staleness bound across instances.
 *
 * A ttlMs of 0 (or less) disables the cache entirely: every call loads fresh and
 * nothing is stored. Tests rely on that so existing behaviour is unchanged.
 */

export interface TtlCacheOptions {
    ttlMs:      number;
    maxEntries: number;
    /** Injectable clock so tests can move time without real waiting. */
    now?:       () => number;
}

interface CacheEntry<V> {
    value:     V;
    expiresAt: number;
}

export class TtlCache<V> {
    private readonly entries  = new Map<string, CacheEntry<V>>();
    private readonly inFlight = new Map<string, Promise<V>>();
    private readonly ttlMs:      number;
    private readonly maxEntries: number;
    private readonly now:        () => number;

    // Bumped on every invalidation. A load that started before an invalidation must
    // not store its (possibly stale) result, so it compares this counter when it ends.
    private invalidationCount = 0;

    constructor({ ttlMs, maxEntries, now = Date.now }: TtlCacheOptions) {
        this.ttlMs      = ttlMs;
        this.maxEntries = maxEntries;
        this.now        = now;
    }

    get size(): number {
        return this.entries.size;
    }

    /**
     * Counts invalidations. Read it before a slow batch load and pass it to set(): a result that
     * was loaded before an invalidation is then dropped instead of re-caching stale data.
     */
    get epoch(): number {
        return this.invalidationCount;
    }

    /** Synchronous lookup for batch callers that load their own misses. */
    get(key: string): V | undefined {
        if (this.ttlMs <= 0) return undefined;
        const cached = this.entries.get(key);
        return cached && cached.expiresAt > this.now() ? cached.value : undefined;
    }

    /** Stores a value; ignored when disabled or when an invalidation happened after `loadedAtEpoch`. */
    set(key: string, value: V, loadedAtEpoch?: number): void {
        if (this.ttlMs <= 0) return;
        if (loadedAtEpoch !== undefined && loadedAtEpoch !== this.invalidationCount) return;
        this.store(key, value);
    }

    async getOrLoad(key: string, load: () => Promise<V>): Promise<V> {
        if (this.ttlMs <= 0) return load();

        const cached = this.entries.get(key);
        if (cached && cached.expiresAt > this.now()) return cached.value;

        const pending = this.inFlight.get(key);
        if (pending) return pending;

        const startedAtInvalidation = this.invalidationCount;
        const loading = load()
            .then((value) => {
                if (startedAtInvalidation === this.invalidationCount) this.store(key, value);
                return value;
            })
            .finally(() => {
                this.inFlight.delete(key);
            });

        this.inFlight.set(key, loading);
        return loading;
    }

    delete(key: string): void {
        this.invalidationCount++;
        this.entries.delete(key);
        this.inFlight.delete(key);
    }

    deleteWhere(shouldDelete: (key: string) => boolean): void {
        this.invalidationCount++;
        for (const key of [...this.entries.keys()]) {
            if (shouldDelete(key)) this.entries.delete(key);
        }
        for (const key of [...this.inFlight.keys()]) {
            if (shouldDelete(key)) this.inFlight.delete(key);
        }
    }

    clear(): void {
        this.invalidationCount++;
        this.entries.clear();
        this.inFlight.clear();
    }

    private store(key: string, value: V): void {
        // Re-inserting moves the key to the end, so Map order stays oldest-first.
        this.entries.delete(key);
        this.entries.set(key, { value, expiresAt: this.now() + this.ttlMs });
        if (this.entries.size > this.maxEntries) this.evictOverflow();
    }

    private evictOverflow(): void {
        const nowMs = this.now();
        for (const [key, entry] of this.entries) {
            if (entry.expiresAt <= nowMs) this.entries.delete(key);
        }
        for (const key of this.entries.keys()) {
            if (this.entries.size <= this.maxEntries) break;
            this.entries.delete(key);
        }
    }
}
