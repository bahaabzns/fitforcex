// Decides what upgrade prompts a workspace should see. Pure, so the "don't be annoying" rules
// (when a banner is due, when it stays snoozed) are readable and testable in one place.

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const ENDING_SOON_DAYS = 7;
export const LAST_DAY_THRESHOLD_DAYS = 1;
export const METER_WARNING_RATIO = 2 / 3;
export const METER_UPGRADE_LINK_RATIO = 0.8;

// How long a closed banner stays away. Tighter as the deadline gets closer.
export const SNOOZE_DAYS = { ending: 3, lastDay: 1, expired: 1 };

export const BANNER_STAGE = { ENDING: 'ending', LAST_DAY: 'lastDay', EXPIRED: 'expired' };

/** Everything the buttons, meter and banners need, derived from the /billing/subscription payload. */
export function getUpgradeState(subscription, now = Date.now()) {
    if (!subscription) return null;

    const expiresAtMs = subscription.expiresAt ? new Date(subscription.expiresAt).getTime() : null;
    const isExpired = Boolean(subscription.isReadOnly) || (expiresAtMs !== null && expiresAtMs <= now);
    const daysLeft = expiresAtMs === null ? null : Math.max(0, Math.ceil((expiresAtMs - now) / MS_PER_DAY));
    const isFree = !(Number(subscription.priceMonthly) > 0);
    const endingSoon = !isFree && !isExpired && daysLeft !== null && daysLeft <= ENDING_SOON_DAYS;

    const limit = subscription.maxClients ?? null;
    const used = subscription.clientCount ?? 0;
    const ratio = limit ? used / limit : 0;

    let bannerStage = null;
    if (isExpired && !isFree) bannerStage = BANNER_STAGE.EXPIRED;
    else if (endingSoon) bannerStage = daysLeft <= LAST_DAY_THRESHOLD_DAYS ? BANNER_STAGE.LAST_DAY : BANNER_STAGE.ENDING;

    return {
        isFree,
        isExpired,
        daysLeft,
        endingSoon,
        bannerStage,
        meter: limit === null ? null : {
            used, limit, ratio,
            level: ratio >= 1 ? 'full' : ratio >= METER_WARNING_RATIO ? 'warning' : 'ok',
            showUpgradeLink: ratio >= METER_UPGRADE_LINK_RATIO || isFree,
        },
        // Free and expired workspaces always get the button; paid ones only near the end.
        topbarMode: isExpired || endingSoon ? 'renew' : isFree ? 'upgrade' : null,
    };
}

/**
 * A closed banner comes back after its snooze — or straight away if things got more urgent since
 * (e.g. closed with 5 days left, now it's the last day).
 */
export function isBannerSnoozed(snooze, stage, now = Date.now()) {
    if (!snooze || snooze.stage !== stage) return false;
    return typeof snooze.until === 'number' && snooze.until > now;
}

export function buildSnooze(stage, now = Date.now()) {
    return { stage, until: now + SNOOZE_DAYS[stage] * MS_PER_DAY };
}
