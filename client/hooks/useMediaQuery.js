"use client";

import { useEffect, useState } from "react";

/**
 * Subscribe to a CSS media query.
 *
 * Returns false on the server and first client render (matchMedia is
 * unavailable during SSR), then syncs to the real match after mount. This
 * means responsive branches default to the wide layout until hydration —
 * an intentional, flash-free default for desktop-first builder screens.
 */
export function useMediaQuery(query) {
    const [matches, setMatches] = useState(false);

    useEffect(() => {
        const mql = window.matchMedia(query);
        const update = () => setMatches(mql.matches);
        update();
        mql.addEventListener("change", update);
        return () => mql.removeEventListener("change", update);
    }, [query]);

    return matches;
}
