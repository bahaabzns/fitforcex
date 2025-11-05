'use client';

import { useEffect, useMemo } from 'react';
import { FB_PIXEL_ID, event } from './fbPixel';

export function useFbPixel() {
	useEffect(() => {
		if (typeof window === 'undefined') return;
		if ((window as any).fbq || !FB_PIXEL_ID) return; // Script init handled in layout
	}, []);

	return useMemo(() => ({
		signUp: () => event('CompleteRegistration'),
		subscribe: (plan: string, value?: number, trial?: boolean) =>
			event('Subscribe', {
				plan_name: plan,
				...(typeof value === 'number' ? { value } : {}),
				...(typeof trial === 'boolean' ? { trial } : {}),
			}),
	}), []);
}


