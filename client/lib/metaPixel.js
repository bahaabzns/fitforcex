'use client';

// Meta Pixel — requires NEXT_PUBLIC_META_PIXEL_ID to be set to the same
// numeric ID as the server's META_PIXEL_ID (see server/.env.example). Left
// unset, every call here silently no-ops.

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID || '';

let pixelReady = false;
let callQueue = [];

function isValidPixelId() {
    return /^\d{10,20}$/.test(PIXEL_ID);
}

export function initMetaPixel() {
    if (typeof window === 'undefined' || pixelReady || !isValidPixelId()) return;

    if (window.fbq) {
        pixelReady = true;
        drainQueue();
        return;
    }

    (function (f, b, e, v, n, t, s) {
        if (f.fbq) return;
        n = f.fbq = function () {
            n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        if (!f._fbq) f._fbq = n;
        n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
        t = b.createElement(e); t.async = true; t.src = v;
        s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');

    window.fbq('init', PIXEL_ID);
    pixelReady = true;
    drainQueue();
}

function drainQueue() {
    const queued = callQueue;
    callQueue = [];
    queued.forEach(fn => fn());
}

export function trackPixelEvent(eventName, params, eventId) {
    if (typeof window === 'undefined') return;
    if (!pixelReady) {
        callQueue.push(() => trackPixelEvent(eventName, params, eventId));
        return;
    }
    if (!window.fbq) return;
    try {
        const options = eventId ? { eventID: eventId } : undefined;
        window.fbq('track', eventName, params || {}, options);
    } catch {
        // never let a tracking failure affect the page
    }
}
