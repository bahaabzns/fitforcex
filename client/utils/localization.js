/**
 * Returns the localized value of a field from a DB object.
 * Falls back to the English value if the Arabic version is missing.
 *
 * @param {object} item     - DB row (e.g. { name_en: 'Chest Press', name_ar: 'ضغط الصدر' })
 * @param {string} field    - Base field name without language suffix (e.g. 'name', 'instructions')
 * @param {string} locale   - Active locale: 'en' or 'ar'
 * @returns {string}
 */
export function getLocalizedField(item, field, locale) {
    if (!item) return '';
    if (locale === 'ar' && item[`${field}_ar`]) return item[`${field}_ar`];
    return item[`${field}_en`] ?? '';
}
