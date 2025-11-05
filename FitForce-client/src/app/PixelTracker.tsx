'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { pageview } from '@/lib/fbPixel';

export default function PixelTracker() {
	const pathname = usePathname();

	useEffect(() => {
		if (process.env.NODE_ENV !== 'production') return;
		pageview();
	}, [pathname]);

	return null;
}


