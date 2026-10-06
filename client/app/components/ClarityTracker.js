'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { initClarity, setClarityTag } from '@/lib/clarity';

// Path allowlist of exclusions — the operator admin panel is never recorded.
const EXCLUDED_PATHS = ['/admin'];

function isExcludedPath(pathname) {
    return EXCLUDED_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`));
}

function getAreaTag(pathname) {
    if (pathname.startsWith('/portal')) return 'client-portal';
    if (['/', '/login', '/register', '/forgot-password', '/reset-password'].includes(pathname)) return 'public';
    return 'coach-app';
}

export default function ClarityTracker() {
    const pathname = usePathname();

    useEffect(() => {
        if (isExcludedPath(pathname)) return;
        initClarity();
        setClarityTag('area', getAreaTag(pathname));
    }, [pathname]);

    return null;
}
