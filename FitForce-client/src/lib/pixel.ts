'use client';

import { APP_CONFIG } from './config';

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

export type ServerSideEventData = {
  event_name: string;
  action_source: 'web' | 'app' | 'email' | 'other' | 'system';
  event_time?: number;
  event_source_url?: string;
  user_data?: {
    em?: string[]; // hashed emails
    ph?: string[]; // hashed phones
    fn?: string[]; // hashed first names
    ln?: string[]; // hashed last names
    external_id?: string[];
    client_user_agent?: string;
    client_ip_address?: string;
  };
  custom_data?: Record<string, any>;
};

const FB_PIXEL_ID = process.env.NEXT_PUBLIC_FB_PIXEL_ID || '';
const isDevelopment = process.env.NODE_ENV === 'development';

let pixelInitialized = false;

// Logging utility for development
function log(message: string, data?: any) {
  if (isDevelopment) {
    console.log(`[Meta Pixel] ${message}`, data || '');
  }
}

function logError(message: string, error?: any) {
  if (isDevelopment) {
    console.error(`[Meta Pixel Error] ${message}`, error || '');
  }
}

export function initMetaPixel(options: PixelInitOptions = {}): void {
  if (typeof window === 'undefined') return;
  if (pixelInitialized) {
    log('Pixel already initialized');
    return;
  }

  const pixelId = (options.pixelId || FB_PIXEL_ID || '').trim();
  if (!pixelId || !/^\d{15,16}$/.test(pixelId)) {
    logError('Invalid or missing Pixel ID', { pixelId, provided: !!options.pixelId });
    return; // invalid or missing id → no-op
  }

  if (window.fbq) {
    log('Pixel already loaded, marking as initialized');
    pixelInitialized = true;
    return;
  }

  log('Initializing Meta Pixel', { pixelId, autoPageView: options.autoPageView });

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
    log('Auto PageView tracked');
  }

  pixelInitialized = true;
  log('Pixel initialized successfully');

  // Drain queued calls if any were enqueued before fbq was ready
  const q = window._ff_fbqQueue;
  if (q && Array.isArray(q)) {
    try { 
      q.forEach(fn => fn()); 
      log(`Drained ${q.length} queued events`);
    } catch (err) {
      logError('Error draining queued events', err);
    }
    window._ff_fbqQueue = [];
  }
}

export function track(eventName: string, params?: Record<string, any>): void {
  if (typeof window === 'undefined') return;
  if (!window.fbq) {
    // Enqueue until initialized
    log(`Queueing event: ${eventName} (pixel not ready)`);
    (window._ff_fbqQueue = window._ff_fbqQueue || []).push(() => track(eventName, params));
    return;
  }
  try {
    if (params) {
      window.fbq('track', eventName, params);
      log(`Tracked event: ${eventName}`, params);
    } else {
      window.fbq('track', eventName);
      log(`Tracked event: ${eventName}`);
    }
  } catch (err) {
    logError(`Error tracking event: ${eventName}`, err);
  }
}

export function trackCustom(eventName: string, params?: Record<string, any>): void {
  if (typeof window === 'undefined') return;
  if (!window.fbq) {
    log(`Queueing custom event: ${eventName} (pixel not ready)`);
    (window._ff_fbqQueue = window._ff_fbqQueue || []).push(() => trackCustom(eventName, params));
    return;
  }
  try {
    if (params) {
      window.fbq('trackCustom', eventName, params);
      log(`Tracked custom event: ${eventName}`, params);
    } else {
      window.fbq('trackCustom', eventName);
      log(`Tracked custom event: ${eventName}`);
    }
  } catch (err) {
    logError(`Error tracking custom event: ${eventName}`, err);
  }
}

/**
 * Send event to server-side Conversions API
 * This complements client-side tracking for better accuracy and privacy compliance
 */
export async function trackServerSide(eventData: ServerSideEventData): Promise<void> {
  if (typeof window === 'undefined') return;
  
  try {
    const response = await fetch(`${APP_CONFIG.apiUrl}/api/meta/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        ...eventData,
        event_source_url: eventData.event_source_url || (typeof window !== 'undefined' ? window.location.href : undefined),
        user_data: {
          ...eventData.user_data,
          client_user_agent: eventData.user_data?.client_user_agent || (typeof navigator !== 'undefined' ? navigator.userAgent : undefined),
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logError(`Server-side tracking failed: ${eventData.event_name}`, {
        status: response.status,
        error: errorText,
      });
      return;
    }

    log(`Server-side event tracked: ${eventData.event_name}`, eventData);
  } catch (err) {
    logError(`Error sending server-side event: ${eventData.event_name}`, err);
  }
}

/**
 * Track event on both client-side and server-side
 * This is the recommended method for important conversion events
 */
export async function trackDual(
  eventName: string,
  params?: Record<string, any>,
  serverSideData?: Partial<ServerSideEventData>
): Promise<void> {
  // Client-side tracking
  track(eventName, params);

  // Server-side tracking
  if (serverSideData || params) {
    await trackServerSide({
      event_name: eventName,
      action_source: 'web',
      custom_data: params || {},
      ...serverSideData,
    });
  }
}

export function isPixelEnabled(): boolean {
  return !!(process.env.NEXT_PUBLIC_FB_PIXEL_ID && /^\d{15,16}$/.test(process.env.NEXT_PUBLIC_FB_PIXEL_ID));
}


