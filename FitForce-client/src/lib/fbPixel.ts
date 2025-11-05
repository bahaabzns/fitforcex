'use client';

export const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || '748502508209787';

declare global {
	interface Window {
		fbq?: (action: string, eventName?: string, parameters?: Record<string, any>) => void;
	}
}

export const pageview = (): void => {
	if (typeof window === 'undefined' || !window.fbq) return;
	window.fbq('track', 'PageView');
};

export const event = (name: string, data?: Record<string, any>): void => {
	if (typeof window === 'undefined' || !window.fbq) return;
	if (data) {
		window.fbq('track', name, data);
	} else {
		window.fbq('track', name);
	}
};


