import { describe, it, expect } from 'vitest';
import { getUpgradeState, isBannerSnoozed, buildSnooze, BANNER_STAGE } from './upgradeState';

const NOW = new Date('2026-11-11T12:00:00Z').getTime();
const inDays = (days) => new Date(NOW + days * 24 * 60 * 60 * 1000).toISOString();

const freePlan = { priceMonthly: null, expiresAt: null, maxClients: 3, clientCount: 2, isReadOnly: false };
const paidPlan = { priceMonthly: '300', expiresAt: inDays(20), maxClients: 10, clientCount: 4, isReadOnly: false };

describe('getUpgradeState', () => {
    it('shows the Upgrade button and meter link for a free workspace', () => {
        const state = getUpgradeState(freePlan, NOW);
        expect(state.isFree).toBe(true);
        expect(state.topbarMode).toBe('upgrade');
        expect(state.meter.showUpgradeLink).toBe(true);
        expect(state.bannerStage).toBeNull();
    });

    it('moves the meter from ok to warning at two thirds and to full at the limit', () => {
        expect(getUpgradeState({ ...freePlan, clientCount: 1 }, NOW).meter.level).toBe('ok');
        expect(getUpgradeState({ ...freePlan, clientCount: 2 }, NOW).meter.level).toBe('warning');
        expect(getUpgradeState({ ...freePlan, clientCount: 3 }, NOW).meter.level).toBe('full');
    });

    it('stays quiet for a healthy paid plan', () => {
        const state = getUpgradeState(paidPlan, NOW);
        expect(state.topbarMode).toBeNull();
        expect(state.bannerStage).toBeNull();
        expect(state.meter.showUpgradeLink).toBe(false);
    });

    it('offers Renew and the ending banner in the last 7 days of a paid plan', () => {
        const state = getUpgradeState({ ...paidPlan, expiresAt: inDays(5) }, NOW);
        expect(state.topbarMode).toBe('renew');
        expect(state.bannerStage).toBe(BANNER_STAGE.ENDING);
        expect(state.daysLeft).toBe(5);
    });

    it('treats the final day as its own, more urgent stage', () => {
        expect(getUpgradeState({ ...paidPlan, expiresAt: inDays(1) }, NOW).bannerStage).toBe(BANNER_STAGE.LAST_DAY);
    });

    it('shows the expired stage once the plan end has passed, even inside the grace days', () => {
        const state = getUpgradeState({ ...paidPlan, expiresAt: inDays(-1) }, NOW);
        expect(state.isExpired).toBe(true);
        expect(state.bannerStage).toBe(BANNER_STAGE.EXPIRED);
        expect(state.topbarMode).toBe('renew');
    });

    it('returns null before the subscription has loaded', () => {
        expect(getUpgradeState(null, NOW)).toBeNull();
    });

    it('has no meter for an unlimited plan', () => {
        expect(getUpgradeState({ ...paidPlan, maxClients: null }, NOW).meter).toBeNull();
    });
});

describe('banner snooze', () => {
    it('keeps a closed banner hidden for 3 days at the ending stage', () => {
        const snooze = buildSnooze(BANNER_STAGE.ENDING, NOW);
        expect(isBannerSnoozed(snooze, BANNER_STAGE.ENDING, NOW + 2 * 24 * 60 * 60 * 1000)).toBe(true);
        expect(isBannerSnoozed(snooze, BANNER_STAGE.ENDING, NOW + 4 * 24 * 60 * 60 * 1000)).toBe(false);
    });

    it('brings the banner back immediately when it becomes more urgent', () => {
        const snooze = buildSnooze(BANNER_STAGE.ENDING, NOW);
        expect(isBannerSnoozed(snooze, BANNER_STAGE.LAST_DAY, NOW + 1000)).toBe(false);
        expect(isBannerSnoozed(snooze, BANNER_STAGE.EXPIRED, NOW + 1000)).toBe(false);
    });

    it('shows the banner when nothing was ever closed or the stored value is junk', () => {
        expect(isBannerSnoozed(null, BANNER_STAGE.ENDING, NOW)).toBe(false);
        expect(isBannerSnoozed({ stage: 'ending', until: 'soon' }, BANNER_STAGE.ENDING, NOW)).toBe(false);
    });
});
