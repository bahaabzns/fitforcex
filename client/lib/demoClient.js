import api from "@/lib/axios";

const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN || "localhost";

// The client portal login lives on the workspace subdomain: https://<slug>.<root>/portal
// (same host rule the legacy /portal/<slug> redirect uses). Browser-only: reads the current protocol and port.
export function portalLoginUrl(workspaceSlug) {
    const { protocol, port } = window.location;
    const host = port ? `${workspaceSlug}.${ROOT_DOMAIN}:${port}` : `${workspaceSlug}.${ROOT_DOMAIN}`;
    return `${protocol}//${host}/portal`;
}

// The demo client's login travels to the portal login page as `demo_email` / `demo_password` in the link the sidebar
// opens while the coach is trying the demo. The login page only accepts it for the reserved demo address (a real
// client's email never ends this way), fills the two fields and removes the values from the address bar.
export const DEMO_EMAIL_DOMAIN = "@fitforce.demo";

export function demoPortalHref(portalLink, demoLogin) {
    if (!portalLink || !demoLogin) return portalLink;
    const params = new URLSearchParams({ demo_email: demoLogin.email, demo_password: demoLogin.password });
    return `${portalLink}?${params.toString()}`;
}

export function readDemoPrefill(search) {
    const params = new URLSearchParams(search);
    const email = params.get('demo_email');
    const password = params.get('demo_password');
    return email && password && email.toLowerCase().endsWith(DEMO_EMAIL_DOMAIN) ? { email, password } : null;
}

// Closing or acting on the demo welcome counts as "seen" so it never shows again. A failed write only means it could
// show once more, so it never blocks the coach.
export async function markDemoWelcomeSeen() {
    try {
        await api.post('/api/demo-client/welcome-seen');
    } catch {
        // ignore
    }
}
