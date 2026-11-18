import { TtlCache } from '../../src/lib/ttlCache';

function makeClock(startMs = 1_000) {
    let nowMs = startMs;
    return {
        now:     () => nowMs,
        advance: (ms: number) => { nowMs += ms; },
    };
}

function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!:  (reason: unknown) => void;
    const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
}

describe('TtlCache', () => {
    it('returns the cached value without loading again before the TTL ends', async () => {
        const clock = makeClock();
        const cache = new TtlCache<number>({ ttlMs: 30_000, maxEntries: 10, now: clock.now });
        const load  = jest.fn().mockResolvedValue(42);

        const first  = await cache.getOrLoad('a', load);
        clock.advance(29_999);
        const second = await cache.getOrLoad('a', load);

        expect(first).toBe(42);
        expect(second).toBe(42);
        expect(load).toHaveBeenCalledTimes(1);
    });

    it('loads again once the TTL has passed', async () => {
        const clock = makeClock();
        const cache = new TtlCache<number>({ ttlMs: 30_000, maxEntries: 10, now: clock.now });
        const load  = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);

        await cache.getOrLoad('a', load);
        clock.advance(30_000);
        const refreshed = await cache.getOrLoad('a', load);

        expect(refreshed).toBe(2);
        expect(load).toHaveBeenCalledTimes(2);
    });

    it('shares one load between concurrent callers for the same key', async () => {
        const cache = new TtlCache<string>({ ttlMs: 30_000, maxEntries: 10 });
        const gate  = deferred<string>();
        const load  = jest.fn().mockReturnValue(gate.promise);

        const callers = [cache.getOrLoad('a', load), cache.getOrLoad('a', load), cache.getOrLoad('a', load)];
        gate.resolve('shared');

        await expect(Promise.all(callers)).resolves.toEqual(['shared', 'shared', 'shared']);
        expect(load).toHaveBeenCalledTimes(1);
    });

    it('does not cache a failed load and lets the next call retry', async () => {
        const cache = new TtlCache<number>({ ttlMs: 30_000, maxEntries: 10 });
        const load  = jest.fn().mockRejectedValueOnce(new Error('db down')).mockResolvedValueOnce(7);

        await expect(cache.getOrLoad('a', load)).rejects.toThrow('db down');
        await expect(cache.getOrLoad('a', load)).resolves.toBe(7);
        expect(load).toHaveBeenCalledTimes(2);
    });

    it('loads fresh after delete()', async () => {
        const cache = new TtlCache<number>({ ttlMs: 30_000, maxEntries: 10 });
        const load  = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);

        await cache.getOrLoad('a', load);
        cache.delete('a');

        await expect(cache.getOrLoad('a', load)).resolves.toBe(2);
    });

    it('does not store the result of a load that was invalidated while it ran', async () => {
        const cache = new TtlCache<string>({ ttlMs: 30_000, maxEntries: 10 });
        const gate  = deferred<string>();
        const slowLoad = () => gate.promise;

        const pending = cache.getOrLoad('a', slowLoad);
        cache.delete('a');           // e.g. the session was revoked mid-load
        gate.resolve('stale');
        await pending;

        const freshLoad = jest.fn().mockResolvedValue('fresh');
        await expect(cache.getOrLoad('a', freshLoad)).resolves.toBe('fresh');
        expect(freshLoad).toHaveBeenCalledTimes(1);
    });

    it('deleteWhere removes only the matching keys', async () => {
        const cache = new TtlCache<number>({ ttlMs: 30_000, maxEntries: 10 });
        await cache.getOrLoad('ws1:a', async () => 1);
        await cache.getOrLoad('ws1:b', async () => 2);
        await cache.getOrLoad('ws2:a', async () => 3);

        cache.deleteWhere((key) => key.startsWith('ws1:'));

        const reload = jest.fn().mockResolvedValue(9);
        await expect(cache.getOrLoad('ws1:a', reload)).resolves.toBe(9);
        await expect(cache.getOrLoad('ws2:a', reload)).resolves.toBe(3);
        expect(reload).toHaveBeenCalledTimes(1);
    });

    it('never grows past maxEntries and drops the oldest entries first', async () => {
        const cache = new TtlCache<number>({ ttlMs: 30_000, maxEntries: 2 });
        await cache.getOrLoad('a', async () => 1);
        await cache.getOrLoad('b', async () => 2);
        await cache.getOrLoad('c', async () => 3);

        expect(cache.size).toBe(2);
        const reloadOldest = jest.fn().mockResolvedValue(10);
        await expect(cache.getOrLoad('a', reloadOldest)).resolves.toBe(10);
        expect(reloadOldest).toHaveBeenCalledTimes(1);
    });

    it('is a pass-through when ttlMs is 0 (nothing stored, nothing shared)', async () => {
        const cache = new TtlCache<number>({ ttlMs: 0, maxEntries: 10 });
        const load  = jest.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);

        await expect(cache.getOrLoad('a', load)).resolves.toBe(1);
        await expect(cache.getOrLoad('a', load)).resolves.toBe(2);
        expect(cache.size).toBe(0);
    });
});
