// Path allowlist — mirrors CLAUDE.md's "path allowlists over per-route
// opt-outs" pattern (§3). Only the public marketing/auth funnel is tracked;
// the coach dashboard, client portal, and admin panel never load trackers.
const TRACKED_PATHS = [
    '/', '/login', '/register', '/forgot-password', '/reset-password',
    '/verify-email-required', '/check-mail',
];

export function isTrackedPath(pathname) {
    return TRACKED_PATHS.some(path => pathname === path || pathname.startsWith(`${path}/`));
}
