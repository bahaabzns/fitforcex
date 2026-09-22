'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { initMetaPixel, trackPixelEvent } from '@/lib/metaPixel';

// Path allowlist — mirrors CLAUDE.md's "path allowlists over per-route
// opt-outs" pattern (§3). Only the public marketing/auth funnel is tracked;
// the coach dashboard, client portal, and admin panel never load the pixel.
const TRACKED_PATHS = [
    '/', '/login', '/register', '/forgot-password', '/reset-password',
    '/verify-email-required', '/check-mail',
];

function isTrackedPath(pathname) {
    return TRACKED_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`));
}

export default function MetaPixelTracker() {
    const pathname = usePathname();

    useEffect(() => {
        if (!isTrackedPath(pathname)) return;
        initMetaPixel();
        trackPixelEvent('PageView');
    }, [pathname]);

    return null;
}
