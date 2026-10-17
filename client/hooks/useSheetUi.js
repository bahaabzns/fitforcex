"use client";

import { useEffect } from "react";

const SHEET_UI_ATTRIBUTE = "data-sheet-ui";

/**
 * Opt a page into the phone bottom-sheet UI: while it is mounted, every HeroUI
 * modal and select/menu popover it opens renders as a bottom sheet below 768px
 * (rules live in globals.css under `html[data-sheet-ui]`). Modals and popovers
 * portal to <body>, so a flag on <html> is the only scope that reaches them.
 * Desktop and tablet are unaffected.
 */
export function useSheetUi() {
    useEffect(() => {
        const root = document.documentElement;
        root.setAttribute(SHEET_UI_ATTRIBUTE, "");
        return () => root.removeAttribute(SHEET_UI_ATTRIBUTE);
    }, []);
}
