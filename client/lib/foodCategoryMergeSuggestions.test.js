import { describe, test, expect } from "vitest";
import { findApplicableSuggestions, categoriesLookRelated, MERGE_SUGGESTIONS } from "./foodCategoryMergeSuggestions";

const cat = (id, name_en) => ({ id, name_en });

describe("findApplicableSuggestions", () => {
    test("suggests a group only when the coach has at least two of its categories", () => {
        const categories = [cat("1", "Beef Products"), cat("2", "Poultry Products"), cat("3", "Carb"), cat("4", "Fruits and Fruit Juices")];

        const result = findApplicableSuggestions(categories);

        expect(result.map((s) => s.key)).toEqual(["protein"]);
        expect(result[0].categories.map((c) => c.id)).toEqual(["1", "2"]);
    });

    test("returns nothing when no group has two matches", () => {
        expect(findApplicableSuggestions([cat("1", "Beef Products"), cat("2", "Carb"), cat("3", "Sweets")])).toEqual([]);
        expect(findApplicableSuggestions([])).toEqual([]);
    });

    test("matches names case-insensitively with whitespace collapsed", () => {
        const result = findApplicableSuggestions([cat("1", "  vegetable "), cat("2", "VEGETABLES   and Vegetable Products")]);
        expect(result.map((s) => s.key)).toEqual(["vegetables"]);
    });

    test("does not suggest coach-made categories that merely sound similar", () => {
        expect(findApplicableSuggestions([cat("1", "Meat"), cat("2", "Fish")])).toEqual([]);
    });

    test("every suggestion carries EN + AR target names and at least two members", () => {
        for (const suggestion of MERGE_SUGGESTIONS) {
            expect(suggestion.name_en).toBeTruthy();
            expect(suggestion.name_ar).toBeTruthy();
            expect(suggestion.members.length).toBeGreaterThanOrEqual(2);
        }
    });

    test("a category belongs to at most one suggestion", () => {
        const all = MERGE_SUGGESTIONS.flatMap((s) => s.members.map((m) => m.toLowerCase()));
        expect(new Set(all).size).toBe(all.length);
    });
});

describe("categoriesLookRelated", () => {
    test("is true when all selected categories belong to one suggestion group", () => {
        expect(categoriesLookRelated([cat("1", "Beef Products"), cat("2", "Protein")])).toBe(true);
    });

    test("counts the group's own target name as a member", () => {
        expect(categoriesLookRelated([cat("1", "Protein Sources"), cat("2", "Protein")])).toBe(true);
    });

    test("is false when the selection spans groups or includes unknown names", () => {
        expect(categoriesLookRelated([cat("1", "Beef Products"), cat("2", "Fruits and Fruit Juices")])).toBe(false);
        expect(categoriesLookRelated([cat("1", "Beef Products"), cat("2", "My Custom")])).toBe(false);
    });
});
