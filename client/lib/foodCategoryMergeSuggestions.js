// Suggested category merges for the coach's Food Categories page.
//
// A STATIC, hand-edited list — to add, remove or retune a suggestion just edit
// MERGE_SUGGESTIONS below. Nothing else needs to change. Each entry lists the default-library
// category names ("members") that belong together and the name (EN + AR) they would be
// merged into. A suggestion only shows when the coach has at least MIN_MEMBERS_TO_SUGGEST of
// its members; a click pre-fills the merge dialog, the coach still reviews and confirms.
// Names are matched case-insensitively with whitespace collapsed.

export const MIN_MEMBERS_TO_SUGGEST = 2;

export const MERGE_SUGGESTIONS = [
    {
        key: "protein",
        name_en: "Protein Sources",
        name_ar: "مصادر البروتين",
        members: ["Beef Products", "Poultry Products", "Finfish and Shellfish Products", "Protein"],
    },
    {
        key: "carb",
        name_en: "Carb Sources",
        name_ar: "مصادر الكربوهيدرات",
        members: ["Carb", "Cereal Grains and Pasta", "Baked Products"],
    },
    {
        key: "fat",
        name_en: "Fat Sources",
        name_ar: "مصادر الدهون",
        members: ["Fat", "Fats and Oils", "Nut and Seed Products"],
    },
    {
        key: "vegetables",
        name_en: "Vegetables",
        name_ar: "الخضروات",
        members: ["Vegetable", "Vegetables and Vegetable Products"],
    },
    {
        key: "dairy",
        name_en: "Dairy",
        name_ar: "الألبان",
        members: ["Dairy", "Dairy and Egg Products"],
    },
];

export function normalizeCategoryName(name) {
    return String(name ?? "").replace(/\s+/g, " ").trim().toLowerCase();
}

// Suggestions the coach can act on right now, each with the ids of their matching categories.
export function findApplicableSuggestions(categories, suggestions = MERGE_SUGGESTIONS) {
    return suggestions
        .map((suggestion) => {
            const memberNames = new Set(suggestion.members.map(normalizeCategoryName));
            const matching = categories.filter((category) => memberNames.has(normalizeCategoryName(category.name_en)));
            return { ...suggestion, categories: matching };
        })
        .filter((suggestion) => suggestion.categories.length >= MIN_MEMBERS_TO_SUGGEST);
}

// True when every selected category belongs to one suggestion group (the group's own
// target name counts as a member, so re-merging into "Protein Sources" isn't flagged).
// Used only for a soft warning in the dialog — it never blocks a merge.
export function categoriesLookRelated(selected, suggestions = MERGE_SUGGESTIONS) {
    if (selected.length < 2) return true;
    return suggestions.some((suggestion) => {
        const names = new Set([suggestion.name_en, ...suggestion.members].map(normalizeCategoryName));
        return selected.every((category) => names.has(normalizeCategoryName(category.name_en)));
    });
}
