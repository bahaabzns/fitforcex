'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

declare global {
	interface Window {
		fbq?: (action: string, eventName?: string, parameters?: Record<string, any>) => void;
	}
}

export default function PixelTracker() {
	const pathname = usePathname();
	const isInitialMount = useRef(true);

	useEffect(() => {
		// PageView is tracked automatically by the Meta Pixel script on initial load
		// Only track PageView on route changes (not on initial mount)
		if (isInitialMount.current) {
			isInitialMount.current = false;
			return; // Skip initial mount - PageView already tracked by script
		}

		if (typeof window === 'undefined' || !window.fbq) return;
		
		// Track PageView on route changes only
		try {
			window.fbq('track', 'PageView');
		} catch (error) {
			console.error('Failed to track PageView:', error);
		}
	}, [pathname]);

	return null;
}


