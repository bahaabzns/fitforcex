'use client';

import { useEffect, useState } from 'react';
import { useParams, usePathname } from 'next/navigation';
import { Clock, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useUpgrade } from './UpgradeProvider';
import { BANNER_STAGE, buildSnooze, getUpgradeState, isBannerSnoozed } from '@/lib/upgradeState';
import { trackUpgradeEvent, UPGRADE_SOURCE } from '@/lib/upgradeTracking';

// Only the home-base pages carry the banner, so it never nags on every screen.
const BANNER_PAGES = /\/(dashboard|clients)\/?$/;

const snoozeKey = (slug) => `ffx_plan_banner_snooze:${slug}`;
const shownKey = (slug, stage) => `ffx_plan_banner_shown:${slug}:${stage}`;

function readSnooze(slug) {
    try { return JSON.parse(window.localStorage.getItem(snoozeKey(slug))); } catch { return null; }
}

function writeSnooze(slug, snooze) {
    try { window.localStorage.setItem(snoozeKey(slug), JSON.stringify(snooze)); } catch { /* private mode: it just comes back sooner */ }
}

function alreadyCountedThisSession(slug, stage) {
    try {
        if (window.sessionStorage.getItem(shownKey(slug, stage))) return true;
        window.sessionStorage.setItem(shownKey(slug, stage), '1');
    } catch { /* tracking is best-effort */ }
    return false;
}

// Plan is about to end (or just ended). Closing it hides it for a few days — shorter as the
// deadline gets closer — and it returns at once if it becomes more urgent. The fully
// read-only state has its own non-dismissible banner.
export default function PlanEndingBanner() {
    const t = useTranslations('upgrade');
    const { workspaceSlug } = useParams();
    const pathname = usePathname();
    const { subscription, isOwner, openUpgrade } = useUpgrade();
    const [snooze, setSnooze] = useState(() => (typeof window === 'undefined' ? null : readSnooze(workspaceSlug)));

    const state = getUpgradeState(subscription);
    const stage = state?.bannerStage ?? null;
    const visible = Boolean(
        isOwner && stage && !subscription?.isReadOnly
        && BANNER_PAGES.test(pathname) && !isBannerSnoozed(snooze, stage),
    );

    useEffect(() => {
        if (visible && !alreadyCountedThisSession(workspaceSlug, stage)) {
            trackUpgradeEvent({ eventType: 'shown', source: UPGRADE_SOURCE.EXPIRY_BANNER });
        }
    }, [visible, workspaceSlug, stage]);

    if (!visible) return null;

    const message = stage === BANNER_STAGE.EXPIRED ? t('expiredBanner')
        : stage === BANNER_STAGE.LAST_DAY ? t('lastDayBanner')
        : t('endingBanner', { count: state.daysLeft });

    function close() {
        const next = buildSnooze(stage);
        writeSnooze(workspaceSlug, next);
        setSnooze(next);
    }

    return (
        <div className="flex shrink-0 items-center gap-2.5 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-amber-700 dark:text-amber-400">
            <Clock size={15} className="shrink-0" aria-hidden="true" />
            <span>{message}</span>
            <button
                type="button"
                onClick={() => openUpgrade({ source: UPGRADE_SOURCE.EXPIRY_BANNER, reason: state.isExpired ? 'expired' : 'default' })}
                className="ms-auto shrink-0 font-semibold underline underline-offset-2"
            >
                {t('renewButton')}
            </button>
            <button type="button" onClick={close} aria-label={t('bannerClose')} className="shrink-0 rounded p-1 hover:bg-amber-500/20">
                <X size={14} />
            </button>
        </div>
    );
}
