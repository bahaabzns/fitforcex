"use client";

import { useEffect } from "react";

const DEFAULT_BRAND = "FitForce";

// Client Portal swaps this for the coach's workspace name (see PortalBrandStyle), so the
// browser tab reads "Home · Coach Name" instead of "Home · FitForce".
let currentBrand = DEFAULT_BRAND;

function formatTitle(title) {
    return title ? `${title} · ${currentBrand}` : currentBrand;
}

/** Re-brands the tab title; titles set before the brand arrived are rewritten in place. */
export function setDocumentBrand(name) {
    const next = name?.trim() || DEFAULT_BRAND;
    if (typeof document !== "undefined") {
        const separator = " · ";
        const index = document.title.lastIndexOf(separator);
        const pageTitle = index >= 0 ? document.title.slice(0, index) : (document.title === currentBrand ? "" : document.title);
        currentBrand = next;
        document.title = formatTitle(pageTitle);
    } else {
        currentBrand = next;
    }
}

export function usePageTitle(title) {
    useEffect(() => {
        document.title = formatTitle(title);
    }, [title]);
}
