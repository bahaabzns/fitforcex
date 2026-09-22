"use client";

import { useEffect } from "react";

const BRAND = "FitForce";

export function usePageTitle(title) {
    useEffect(() => {
        document.title = title ? `${title} · ${BRAND}` : BRAND;
    }, [title]);
}
