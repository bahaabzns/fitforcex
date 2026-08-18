import { describe, test, expect } from "vitest";
import { localizedFoodName } from "./foodLocalization";

describe("localizedFoodName — LTR (English) page", () => {
    test("returns the English name when both are present", () => {
        expect(localizedFoodName("Chicken Breast", "صدر فراخ", false)).toBe("Chicken Breast");
    });

    test("falls back to the Arabic name when English is missing", () => {
        expect(localizedFoodName(null, "صدر فراخ", false)).toBe("صدر فراخ");
    });

    test("returns an empty string when both are missing", () => {
        expect(localizedFoodName(null, null, false)).toBe("");
        expect(localizedFoodName(undefined, undefined, false)).toBe("");
    });
});

describe("localizedFoodName — RTL (Arabic) page", () => {
    test("returns the Arabic name when present", () => {
        expect(localizedFoodName("Chicken Breast", "صدر فراخ", true)).toBe("صدر فراخ");
    });

    test("marks the English fallback instead of silently showing plain English text", () => {
        // This is the bug: a bare `food?.name` fallback here is visually
        // indistinguishable from a real Arabic term, and can trigger a
        // browser's own translate feature on an otherwise-Arabic page.
        expect(localizedFoodName("Chicken Breast", null, true)).toBe("Chicken Breast (EN)");
        expect(localizedFoodName("Chicken Breast", "", true)).toBe("Chicken Breast (EN)");
    });

    test("returns an empty string when both are missing", () => {
        expect(localizedFoodName(null, null, true)).toBe("");
    });

    test("weird: does not crash on non-string values", () => {
        expect(() => localizedFoodName(0, undefined, true)).not.toThrow();
    });
});
