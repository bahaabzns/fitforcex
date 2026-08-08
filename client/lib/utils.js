import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

/**
 * Picks the Arabic value of a bilingual field when the current locale is "ar" and an Arabic
 * value actually exists, falling back to the English value otherwise — the same "server
 * always returns both, client picks, blank Arabic silently falls back" convention already used
 * ad hoc throughout the app (e.g. clients/page.js's formTitle, workout-logs' exercise names).
 * Works for both plain strings and arrays (e.g. a plan's `features`/`features_ar` bullet list).
 */
export function pickLocalized(locale, en, ar) {
  return locale === "ar" && ar ? ar : en;
}
