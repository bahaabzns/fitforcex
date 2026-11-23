import { describe, test, expect, vi, afterEach } from 'vitest';
import { openQueueWithFilters } from './queueDrilldown';
import { plansQueuePersistKey } from '../plansQueue/persistKey';

// The drill-down seeds the Plans Queue table's saved view before navigating. It only works if the entry it
// writes is the one the table reads, so both go through plansQueuePersistKey.

afterEach(() => { vi.unstubAllGlobals(); });

function openWith(options) {
    const setItem = vi.fn();
    vi.stubGlobal('sessionStorage', { setItem });
    const router = { push: vi.fn() };
    openQueueWithFilters(router, 'acme', options);
    return { setItem, router };
}

describe('openQueueWithFilters', () => {
    test('writes the saved view under the key the Main queue table reads', () => {
        const { setItem } = openWith({ assignedTo: 'u1' });

        expect(setItem).toHaveBeenCalledTimes(1);
        expect(setItem.mock.calls[0][0]).toBe(`datatable:${plansQueuePersistKey({ isMainView: true, workspaceSlug: 'acme' })}`);
    });

    test('turns each option into a filter rule on the matching column, starting at page 1', () => {
        const { setItem } = openWith({ assignedTo: null, packageName: 'Gold', action: 'nutrition', type: 'check-in' });

        const saved = JSON.parse(setItem.mock.calls[0][1]);
        expect(saved.currentPage).toBe(1);
        expect(saved.filterRules.map(({ colKey, value }) => [colKey, value])).toEqual([
            ['assignedTo', [null]],
            ['clientPackage', ['Gold']],
            ['postAction', ['nutrition-plan']],
            ['formType', ['check-in']],
        ]);
    });

    test('opens the queue for that workspace', () => {
        const { router } = openWith({ action: 'workout' });

        expect(router.push).toHaveBeenCalledWith('/acme/plans-queue');
    });

    test('still opens the queue when storage is unavailable', () => {
        vi.stubGlobal('sessionStorage', { setItem: () => { throw new Error('blocked'); } });
        const router = { push: vi.fn() };

        openQueueWithFilters(router, 'acme', { action: 'workout' });

        expect(router.push).toHaveBeenCalledWith('/acme/plans-queue');
    });
});

describe('plansQueuePersistKey', () => {
    test('keeps Main and History views apart, per workspace', () => {
        const keys = new Set([
            plansQueuePersistKey({ isMainView: true, workspaceSlug: 'a' }),
            plansQueuePersistKey({ isMainView: false, workspaceSlug: 'a' }),
            plansQueuePersistKey({ isMainView: true, workspaceSlug: 'b' }),
        ]);

        expect(keys.size).toBe(3);
    });
});
