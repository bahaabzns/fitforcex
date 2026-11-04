'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { initMetaPixel, trackPixelEvent } from '@/lib/metaPixel';
import { isTrackedPath } from '@/lib/trackedPaths';

export default function MetaPixelTracker() {
    const pathname = usePathname();

    useEffect(() => {
        if (!isTrackedPath(pathname)) return;
        initMetaPixel();
        trackPixelEvent('PageView');
    }, [pathname]);

    return null;
}
