/**
 * Shared, app-wide, locale-aware date presentation.
 *
 * Every user-facing date in the UI is rendered through this module so the
 * format is consistent and unambiguous for international users. We use a fixed
 * `D MMM YYYY` shape (e.g. "4 Mar 2024") rather than locale-numeric output like
 * "3/4/2024", which reads differently depending on the reader's region.
 *
 * Localized: month names and AM/PM markers come from `Intl` for the active
 * locale (English → "Mar" / "PM", Arabic → "مارس" / "م"), so nothing is
 * hardcoded per language. Digits stay Western (4, 2024) in every locale, and we
 * assemble the parts ourselves so the `D MMM YYYY` ordering holds regardless of
 * how a given locale would natively order them.
 *
 * These are pure functions that take an explicit locale. In React components,
 * call them through the `useDateFormatter()` hook, which binds them to the
 * app's current locale automatically. See [useDateFormatter.js](./useDateFormatter.js).
 *
 * Presentation only: never use these helpers to derive values sent to the API,
 * stored in the DB, or fed into date pickers — those stay as raw ISO / Date.
 *
 * @see DECISIONS.md — "Unified date display format" / "Localized date display"
 */

const DEFAULT_LOCALE = "en";

// Force Western (Latin) digits in every locale — including Arabic — so dates
// read "4 مارس 2024", not "٤ مارس ٢٠٢٤". The `-nu-latn` Unicode extension only
// touches the numbering system; month names and AM/PM markers still localize.
function intlLocale(locale) {
    return `${locale || DEFAULT_LOCALE}-u-nu-latn`;
}

function isArabic(locale) {
    return (locale || DEFAULT_LOCALE).startsWith("ar");
}

/**
 * Coerce any accepted input into a valid Date, or null if it can't be parsed.
 * Accepts a Date, an ISO string, or an epoch number.
 * @param {Date|string|number|null|undefined} value
 * @returns {Date|null}
 */
function toValidDate(value) {
    if (value === null || value === undefined || value === "") return null;
    const date = value instanceof Date ? value : new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
}

/** Run an Intl formatter and return its parts keyed by type. */
function partsOf(date, locale, options) {
    const parts = new Intl.DateTimeFormat(intlLocale(locale), options).formatToParts(date);
    const map = {};
    for (const part of parts) map[part.type] = part.value;
    return map;
}

/**
 * Format a date as `D MMM YYYY`, localized — e.g. "4 Mar 2024" / "4 مارس 2024".
 * Returns an empty string for missing/invalid input so callers can render
 * inline without guarding.
 * @param {Date|string|number|null|undefined} value
 * @param {string} [locale] - active app locale ("en" | "ar")
 * @returns {string}
 */
export function formatDate(value, locale = DEFAULT_LOCALE) {
    const date = toValidDate(value);
    if (!date) return "";
    const { day, month, year } = partsOf(date, locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
    });
    return `${day} ${month} ${year}`;
}

/**
 * Buckets a date into "Today" / "Yesterday" / a full weekday date, localized —
 * e.g. "Today", "Yesterday", "Tuesday, Mar 4". Used to group lists (messenger,
 * notifications) into day bands without re-deriving the same date math twice.
 * @param {Date|string|number|null|undefined} value
 * @param {string} locale - active app locale ("en" | "ar")
 * @param {{ today: string, yesterday: string }} labels - pre-translated labels
 * @returns {string}
 */
export function getDateLabel(value, locale, labels) {
    const date = toValidDate(value);
    if (!date) return '';
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return labels.today;
    if (date.toDateString() === yesterday.toDateString()) return labels.yesterday;
    return date.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' });
}

/**
 * Format a date-time as `D MMM YYYY, h:mm A`, localized —
 * e.g. "4 Mar 2024, 3:45 PM" / "4 مارس 2024، 3:45 م".
 * Returns an empty string for missing/invalid input.
 * @param {Date|string|number|null|undefined} value
 * @param {string} [locale] - active app locale ("en" | "ar")
 * @returns {string}
 */
export function formatDateTime(value, locale = DEFAULT_LOCALE) {
    const date = toValidDate(value);
    if (!date) return "";
    const { day, month, year, hour, minute, dayPeriod } = partsOf(date, locale, {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
    });
    // Normalize the English marker to upper case ("pm" → "PM"); Arabic letters
    // (ص / م) are caseless, so this is a no-op for them.
    const meridiem = (dayPeriod || "").toUpperCase();
    const separator = isArabic(locale) ? "،" : ",";
    return `${day} ${month} ${year}${separator} ${hour}:${minute} ${meridiem}`;
}
