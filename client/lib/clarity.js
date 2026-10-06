'use client';

// Microsoft Clarity — requires NEXT_PUBLIC_CLARITY_PROJECT_ID (the ID in the
// Clarity dashboard URL: clarity.microsoft.com/projects/view/<id>). Left unset,
// every call here silently no-ops. Text/input masking is configured in the
// Clarity dashboard (Settings → Masking), not here.

const PROJECT_ID = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID || '';

let clarityReady = false;

function isValidProjectId() {
    return /^[a-z0-9]{8,12}$/.test(PROJECT_ID);
}

export function initClarity() {
    if (typeof window === 'undefined' || clarityReady || !isValidProjectId()) return;

    (function (c, l, a, r, i, t, y) {
        if (c[a]) return;
        c[a] = function () { (c[a].q = c[a].q || []).push(arguments); };
        t = l.createElement(r); t.async = 1; t.src = 'https://www.clarity.ms/tag/' + i;
        y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
    })(window, document, 'clarity', 'script', PROJECT_ID);

    clarityReady = true;
}

// Custom tags make recordings filterable (e.g. role=coach, area=builder).
export function setClarityTag(key, value) {
    if (typeof window === 'undefined' || !window.clarity) return;
    try {
        window.clarity('set', key, value);
    } catch {
        // never let a tracking failure affect the page
    }
}
