'use client';

import api from '@/lib/axios';

// Anonymous visitor tracking for the admin Conversions page. A random id lives in a first-party
// cookie; every public-page visit is reported to the server, and the register page sends the same
// id so the pre-signup history is attached to the new coach's workspace.

const VISITOR_COOKIE = 'ffx_vid';
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readCookie(name) {
    const match = document.cookie.split('; ').find(part => part.startsWith(`${name}=`));
    return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

// Returns the existing id, or mints one. Null when the browser can't give us a safe random id —
// tracking is skipped rather than weakened.
export function getVisitorId() {
    if (typeof document === 'undefined') return null;

    const existing = readCookie(VISITOR_COOKIE);
    if (existing && UUID_PATTERN.test(existing)) return existing;

    if (typeof crypto === 'undefined' || !crypto.randomUUID) return null;
    const created = crypto.randomUUID();
    document.cookie = `${VISITOR_COOKIE}=${created}; path=/; max-age=${ONE_YEAR_SECONDS}; SameSite=Lax`;
    return created;
}

// "my.site.com" and "site.com" are the same site — compare the last two host labels.
function sameSite(hostA, hostB) {
    const tail = host => host.split('.').slice(-2).join('.');
    return tail(hostA) === tail(hostB);
}

// A referrer from our own pages is just navigation, not where the visitor came from.
function externalReferrer() {
    if (!document.referrer) return null;
    try {
        const { hostname } = new URL(document.referrer);
        return sameSite(hostname, window.location.hostname) ? null : document.referrer;
    } catch {
        return null;
    }
}

export function trackVisit(path) {
    const visitorId = getVisitorId();
    if (!visitorId) return;

    const params = new URLSearchParams(window.location.search);
    api.post('/api/track/visit', {
        visitorId,
        path,
        referrer: externalReferrer(),
        utmSource: params.get('utm_source'),
        utmMedium: params.get('utm_medium'),
        utmCampaign: params.get('utm_campaign'),
        hasFbclid: params.has('fbclid'),
    }).catch(() => {
        // never let a tracking failure affect the page
    });
}
