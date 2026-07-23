// Persists the in-progress Training Mode session across a refresh, and lets
// the day-preview page (client-portal/training) know a session is running in
// the background after the client minimizes it — single source of truth for
// the storage key so both pages agree on its shape.

const STORAGE_KEY = "ff_training_session";

export function getActiveTrainingSession() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    } catch {
        return null;
    }
}

export function saveTrainingSession(session) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch { /* storage unavailable — session just won't resume after a refresh */ }
}

export function clearTrainingSession() {
    try {
        localStorage.removeItem(STORAGE_KEY);
    } catch { /* ignore */ }
}
