"use client";

import { useEffect, useRef } from "react";
import { startVisiblePolling } from "@/lib/visiblePolling";

/**
 * Calls `callback` every `intervalMs` while the tab is visible (see lib/visiblePolling.js
 * for why and how). `callback` may change on every render; the latest one is always called.
 * Pass `immediate: false` when the caller already loads its own initial data.
 */
export function useVisiblePolling(callback, intervalMs, { immediate = true } = {}) {
    const callbackRef = useRef(callback);

    useEffect(() => {
        callbackRef.current = callback;
    }, [callback]);

    useEffect(
        () => startVisiblePolling({ getCallback: () => callbackRef.current, intervalMs, immediate }),
        [intervalMs, immediate],
    );
}
