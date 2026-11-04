'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { isTrackedPath } from '@/lib/trackedPaths';
import { trackVisit } from '@/lib/visitorTracking';

export default function VisitorTracker() {
    const pathname = usePathname();

    useEffect(() => {
        if (!isTrackedPath(pathname)) return;
        trackVisit(pathname);
    }, [pathname]);

    return null;
}
