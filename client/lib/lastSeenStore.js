// Persisted "have I seen this?" state backing the bottom-nav unread dots.
// Shared by every module (Nutrition/Training/Forms) instead of each one
// inventing its own storage — direct web analog of the mobile app's
// LastSeenStore (shared_preferences there, localStorage here).

const PLAN_KEY_PREFIX = "ff_last_seen_plan_";
const IDS_KEY_PREFIX  = "ff_last_seen_ids_";

// Fired whenever a module marks itself seen, so the nav can recheck badges
// immediately instead of waiting for its next poll tick.
export const NAV_BADGES_REFRESH_EVENT = "ff:nav-badges-refresh";

function notifyRefresh() {
    if (typeof window !== "undefined") window.dispatchEvent(new Event(NAV_BADGES_REFRESH_EVENT));
}

// A plan's identity for "have I seen this?" purposes: its id plus
// activated_at. Changes on activation/restart (a coach publishing a new
// plan), not on ordinary content edits to the same active plan.
export function planKey(id, activatedAt) {
    return `${id}|${activatedAt ?? ""}`;
}

export function getSeenPlanKey(moduleName) {
    try {
        return localStorage.getItem(`${PLAN_KEY_PREFIX}${moduleName}`);
    } catch {
        return null;
    }
}

export function setSeenPlanKey(moduleName, key) {
    try {
        localStorage.setItem(`${PLAN_KEY_PREFIX}${moduleName}`, key);
    } catch { /* storage unavailable — badge just won't clear this session */ }
    notifyRefresh();
}

export function getSeenIds(moduleName) {
    try {
        const raw = JSON.parse(localStorage.getItem(`${IDS_KEY_PREFIX}${moduleName}`) || "[]");
        return new Set(Array.isArray(raw) ? raw : []);
    } catch {
        return new Set();
    }
}

export function setSeenIds(moduleName, ids) {
    try {
        localStorage.setItem(`${IDS_KEY_PREFIX}${moduleName}`, JSON.stringify([...ids]));
    } catch { /* storage unavailable — badge just won't clear this session */ }
    notifyRefresh();
}
