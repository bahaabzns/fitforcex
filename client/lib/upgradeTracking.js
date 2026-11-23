import api from '@/lib/axios';

// Every surface that can start an upgrade. Must match UPGRADE_SOURCES on the server
// (server/src/modules/billing/upgradeEvents.service.ts) — the server rejects anything else.
export const UPGRADE_SOURCE = {
    TOPBAR: 'topbar',
    SIDEBAR_METER: 'sidebar_meter',
    LIMIT_POPUP: 'limit_popup',
    LOCK_BRANDING: 'lock_branding',
    EXPIRY_BANNER: 'expiry_banner',
    SUBSCRIPTION_PAGE: 'subscription_page',
};

// Fire-and-forget: measuring must never slow down or break the upgrade flow itself.
export function trackUpgradeEvent({ eventType, source, planId, variationId }) {
    api.post('/api/billing/upgrade-events', { eventType, source, planId, variationId }).catch(() => {});
}
