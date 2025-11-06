'use client';

declare global {
  interface Window {
    fbq?: (action: string, eventName?: string, parameters?: Record<string, any>) => void;
    _ff_fbqQueue?: Array<() => void>;
  }
}

export type PixelInitOptions = {
  pixelId?: string;
  autoPageView?: boolean; // default false; page views can be tracked manually
};

const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || '';

let pixelInitialized = false;

export function initMetaPixel(options: PixelInitOptions = {}): void {
  if (typeof window === 'undefined') return;
  if (pixelInitialized) return;

  const pixelId = (options.pixelId || FB_PIXEL_ID || '').trim();
  if (!pixelId || !/^\d{15,16}$/.test(pixelId)) {
    return; // invalid or missing id → no-op
  }

  if (window.fbq) {
    pixelInitialized = true;
    return;
  }

  // Queue any calls until script is ready
  window._ff_fbqQueue = [];

  (function(f: any, b: any, e: any, v: any, n?: any, t?: any, s?: any) {
    if (f.fbq) return;
    n = f.fbq = function() {
      if (n.callMethod) {
        n.callMethod.apply(n, arguments);
      } else {
        (n.queue = n.queue || []).push(arguments);
      }
    };
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = '2.0';
    n.queue = [];
    t = b.createElement(e);
    t.async = true;
    t.src = v;
    s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

  window.fbq!('init', pixelId);
  if (options.autoPageView) {
    window.fbq!('track', 'PageView');
  }

  pixelInitialized = true;

  // Drain queued calls if any were enqueued before fbq was ready
  const q = window._ff_fbqQueue;
  if (q && Array.isArray(q)) {
    try { q.forEach(fn => fn()); } catch {}
    window._ff_fbqQueue = [];
  }
}

export function track(eventName: string, params?: Record<string, any>): void {
  if (typeof window === 'undefined') return;
  if (!window.fbq) {
    // Enqueue until initialized
    (window._ff_fbqQueue = window._ff_fbqQueue || []).push(() => track(eventName, params));
    return;
  }
  try {
    if (params) {
      window.fbq('track', eventName, params);
    } else {
      window.fbq('track', eventName);
    }
  } catch {}
}

export function trackCustom(eventName: string, params?: Record<string, any>): void {
  if (typeof window === 'undefined') return;
  if (!window.fbq) {
    (window._ff_fbqQueue = window._ff_fbqQueue || []).push(() => trackCustom(eventName, params));
    return;
  }
  try {
    if (params) {
      window.fbq('trackCustom', eventName, params);
    } else {
      window.fbq('trackCustom', eventName);
    }
  } catch {}
}

export function isPixelEnabled(): boolean {
  return !!(process.env.NEXT_PUBLIC_FB_PIXEL_ID && /^\d{15,16}$/.test(process.env.NEXT_PUBLIC_FB_PIXEL_ID));
}


