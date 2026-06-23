"use client";

import { useMemo } from "react";
import { useLocale } from "next-intl";
import { formatDate as formatDateRaw, formatDateTime as formatDateTimeRaw } from "./date";

/**
 * Binds the shared date formatters ([date.js](./date.js)) to the app's current
 * locale, so components can render `formatDate(value)` / `formatDateTime(value)`
 * without threading the locale through every call. Output switches between
 * English and Arabic automatically when the active locale changes.
 *
 * @returns {{ formatDate: (value: any) => string, formatDateTime: (value: any) => string }}
 */
export function useDateFormatter() {
    const locale = useLocale();
    return useMemo(
        () => ({
            formatDate: (value) => formatDateRaw(value, locale),
            formatDateTime: (value) => formatDateTimeRaw(value, locale),
        }),
        [locale],
    );
}
