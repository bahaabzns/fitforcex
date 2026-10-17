"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "forms-builder-content-lang";
const DEFAULT_LANG = "en";
const listeners = new Set();
let currentLang = DEFAULT_LANG;
let hasHydrated = false;

function readStoredLang() {
    try {
        return window.localStorage.getItem(STORAGE_KEY) === "ar" ? "ar" : DEFAULT_LANG;
    } catch {
        return DEFAULT_LANG;
    }
}

function subscribe(listener) {
    // Read storage lazily on the client so SSR and first render agree on "en".
    if (!hasHydrated) {
        hasHydrated = true;
        currentLang = readStoredLang();
    }
    listeners.add(listener);
    return () => listeners.delete(listener);
}

function setContentLang(lang) {
    currentLang = lang;
    try {
        window.localStorage.setItem(STORAGE_KEY, lang);
    } catch {
        // storage blocked — keep the in-memory choice
    }
    listeners.forEach((listener) => listener());
}

/**
 * Which language the forms builder edits right now ("en" | "ar"). Shared by
 * every builder panel (module-level store) so one switch drives them all.
 */
export function useContentLang() {
    const lang = useSyncExternalStore(subscribe, () => currentLang, () => DEFAULT_LANG);
    return [lang, setContentLang];
}
