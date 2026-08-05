import { chunkByHeight, ptToPx } from '../../src/modules/pdfExport/templates/pagination';

describe('ptToPx', () => {
    test('converts points to pixels at 96px/inch, 72pt/inch', () => {
        expect(ptToPx(72)).toBe(96);
        expect(ptToPx(36)).toBe(48);
    });

    test('rounds to the nearest whole pixel', () => {
        expect(ptToPx(1)).toBe(Math.round((1 / 72) * 96));
    });
});

describe('chunkByHeight', () => {
    test('returns an empty array for no items', () => {
        expect(chunkByHeight([], [], { first: 100, rest: 100 })).toEqual([]);
    });

    test('places a single item that fits on one page', () => {
        expect(chunkByHeight(['a'], [50], { first: 100, rest: 100 })).toEqual([['a']]);
    });

    test('packs items onto one page while they fit the budget', () => {
        // ARRANGE — 3 items of 30pt each, budget 100pt (all 3 fit: 90 <= 100)
        const items = ['a', 'b', 'c'];
        const heights = [30, 30, 30];

        // ACT
        const result = chunkByHeight(items, heights, { first: 100, rest: 100 });

        // ASSERT
        expect(result).toEqual([['a', 'b', 'c']]);
    });

    test('starts a new page once the next item would overflow the budget', () => {
        // ARRANGE — 3 items of 40pt each, budget 100pt: 2 fit (80 <= 100), a 3rd would be 120 > 100
        const items = ['a', 'b', 'c'];
        const heights = [40, 40, 40];

        // ACT
        const result = chunkByHeight(items, heights, { first: 100, rest: 100 });

        // ASSERT
        expect(result).toEqual([['a', 'b'], ['c']]);
    });

    test('an item landing exactly on the budget boundary stays on the current page', () => {
        // 50 + 50 === 100, not > 100, so both belong on the first page.
        const result = chunkByHeight(['a', 'b'], [50, 50], { first: 100, rest: 100 });
        expect(result).toEqual([['a', 'b']]);
    });

    test('uses the smaller "first" budget only for the first page, "rest" for every page after', () => {
        // ARRANGE — first page budget 50pt (e.g. a day heading + notes ate
        // into it), later pages get the full 100pt budget.
        const items = ['a', 'b', 'c', 'd'];
        const heights = [40, 40, 40, 40];

        // ACT
        const result = chunkByHeight(items, heights, { first: 50, rest: 100 });

        // ASSERT — page 1: only "a" fits under the reduced 50pt budget;
        // page 2 onward uses the full 100pt budget (2 items each).
        expect(result).toEqual([['a'], ['b', 'c'], ['d']]);
    });

    test('a single item taller than its own page budget is placed alone, not dropped or infinite-looped', () => {
        const items = ['huge', 'normal'];
        const heights = [500, 30];

        const result = chunkByHeight(items, heights, { first: 100, rest: 100 });

        expect(result).toEqual([['huge'], ['normal']]);
    });

    test('a very long list is chunked correctly (weird: many small items)', () => {
        const items = Array.from({ length: 50 }, (_, i) => i);
        const heights = Array(50).fill(10);

        const result = chunkByHeight(items, heights, { first: 100, rest: 100 });

        // 10 items per page (100 / 10), 50 items -> 5 full pages
        expect(result).toHaveLength(5);
        expect(result.every((group) => group.length === 10)).toBe(true);
        expect(result.flat()).toEqual(items);
    });

    test('throws when items and heights arrays have mismatched lengths', () => {
        expect(() => chunkByHeight(['a', 'b'], [10], { first: 100, rest: 100 })).toThrow();
    });
});
