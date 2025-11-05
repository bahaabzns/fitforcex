'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

declare global {
	interface Window {
		fbq?: (action: string, eventName?: string, parameters?: Record<string, any>) => void;
	}
}

export default function PixelTracker() {
	const pathname = usePathname();

	useEffect(() => {
		// PageView is tracked automatically by useMetaPixel hook
		// This component ensures PageView fires on route changes
		if (typeof window === 'undefined' || !window.fbq) return;
		
		try {
			window.fbq('track', 'PageView');
		} catch (error) {
			console.error('Failed to track PageView:', error);
		}
	}, [pathname]);

	return null;
}


