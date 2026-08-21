/**
 * Localized display name for a food/food-category value, given its English
 * and Arabic forms and whether the page is currently RTL.
 *
 * Deliberately NOT the same as getLocalizedField (localization.js) — that
 * helper expects `${field}_en`/`${field}_ar` keys on one object, but food
 * data reaches these call sites under two different shapes depending on
 * which endpoint it came from (nutrition/food-swap queries alias the column
 * as plain `name`/`name_ar`; the food-swap-search endpoint returns camelCase
 * `name`/`nameAr`) — callers pass the two values explicitly instead of an
 * object, so either shape works without this helper needing to know about it.
 *
 * On an Arabic page with no Arabic value, this used to silently fall back to
 * the English text with no indication — visually indistinguishable from a
 * real (if unusual) Arabic term, and exactly the kind of mixed-language
 * content that can make a browser's own translate feature kick in and
 * mistranslate it. Marking the fallback makes it unambiguous which food
 * items still need an Arabic name filled in, regardless of what triggered
 * a specific report.
 */
export function localizedFoodName(nameEn, nameAr, isRTL) {
    if (isRTL) {
        if (nameAr) return nameAr;
        if (nameEn) return `${nameEn} (EN)`;
        return '';
    }
    return nameEn || nameAr || '';
}
