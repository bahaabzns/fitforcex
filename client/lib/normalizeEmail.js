/**
 * Normalizes an email before it's sent to the API: trims whitespace and
 * lowercases. The backend also compares case-insensitively (for accounts
 * created before this rule existed), but normalizing here keeps what the
 * user typed and what gets sent/stored consistent.
 */
export function normalizeEmail(email) {
    return (email || '').trim().toLowerCase();
}
