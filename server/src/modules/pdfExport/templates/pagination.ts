// Pure, Puppeteer-free pagination helpers for trainingPlan.ts/nutritionPlan.ts
// — deliberately dependency-free so this piece of the PDF pipeline (unlike
// the rest of it, which can only be verified with a real Puppeteer render)
// can have real, fast unit tests. See server/tests/unit/pdfExport.pagination.test.ts.

export function ptToPx(pt: number): number {
    // Mirrors the 96px/inch conversion pdfExport.controller.ts already names
    // COVER_IMAGE_PIXELS_PER_INCH for cover-image pixel validation. Kept as
    // its own constant here rather than imported cross-module — cover-image
    // validation and page-content measurement are otherwise unrelated
    // concerns; the two are meant to stay numerically identical (both derive
    // from the same physical page size), not coupled by an import.
    const PIXELS_PER_INCH = 96;
    const POINTS_PER_INCH = 72;
    return Math.round((pt / POINTS_PER_INCH) * PIXELS_PER_INCH);
}

export type ChunkBudgets = {
    // Height budget (pt) available for the first page of a group — smaller
    // than `rest` whenever that first page also carries extra fixed content
    // (e.g. a day heading + optional notes) that continuation pages don't.
    first: number;
    // Height budget (pt) available for every page after the first.
    rest: number;
};

// Greedy bin-packing that preserves item order and never splits an item
// across a page — the one constraint that actually matters here (an "item"
// is one exercise or one meal; splitting one mid-content is exactly the bug
// this pagination rework exists to prevent). Bin-packing optimization
// doesn't apply once order is fixed: this is just "keep adding to the
// current page while it fits, otherwise start a new one."
export function chunkByHeight<T>(items: T[], heights: number[], budgets: ChunkBudgets): T[][] {
    if (items.length !== heights.length) {
        throw new Error(`chunkByHeight: items.length (${items.length}) !== heights.length (${heights.length})`);
    }
    if (items.length === 0) return [];

    const groups: T[][] = [];
    let currentGroup: T[] = [];
    let currentHeight = 0;

    for (let i = 0; i < items.length; i++) {
        const budget = groups.length === 0 ? budgets.first : budgets.rest;
        const height = heights[i];
        // Only ever compares against a non-empty accumulator — a single item
        // taller than its own page's budget still lands on a page by itself
        // (this line simply can't fire for it), rather than being dropped or
        // causing an infinite loop.
        const wouldOverflow = currentGroup.length > 0 && currentHeight + height > budget;

        if (wouldOverflow) {
            groups.push(currentGroup);
            currentGroup = [];
            currentHeight = 0;
        }

        currentGroup.push(items[i]);
        currentHeight += height;
    }
    groups.push(currentGroup);
    return groups;
}
