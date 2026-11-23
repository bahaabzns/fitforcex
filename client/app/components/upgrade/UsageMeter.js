'use client';

import { useTranslations } from 'next-intl';
import { useUpgrade } from './UpgradeProvider';
import { getUpgradeState } from '@/lib/upgradeState';
import { UPGRADE_SOURCE } from '@/lib/upgradeTracking';

const LEVEL_BAR_CLASS = {
    ok: 'bg-primary',
    warning: 'bg-amber-500',
    full: 'bg-destructive',
};

const CARD_CLASS = 'mx-3 mb-2 flex flex-col gap-1.5 rounded-lg border border-border bg-card/50 px-3 py-2';

// "2/3 free clients used" with a bar. Quiet by default; the bar changes colour as the coach nears
// the limit. Free plans (and paid plans at 80%+) turn the whole card into the Upgrade button.
export default function UsageMeter() {
    const t = useTranslations('upgrade');
    const { subscription, isOwner, openUpgrade } = useUpgrade();
    const state = getUpgradeState(subscription);

    if (!isOwner || !state?.meter) return null;

    const { used, limit, ratio, level, showUpgradeLink } = state.meter;
    const label = t(state.isFree ? 'clientsUsedFree' : 'clientsUsed', { used, limit });

    const content = (
        <>
            <div className="flex w-full items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{label}</span>
                {showUpgradeLink && <span className="text-xs font-semibold text-primary">{t('meterUpgrade')}</span>}
            </div>
            <div
                className="h-1.5 w-full overflow-hidden rounded-full bg-secondary"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={limit}
                aria-valuenow={Math.min(used, limit)}
                aria-label={label}
            >
                <div className={`h-full rounded-full transition-all ${LEVEL_BAR_CLASS[level]}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
            </div>
        </>
    );

    if (!showUpgradeLink) return <div className={CARD_CLASS} data-guide="usage-meter">{content}</div>;

    return (
        <button
            type="button"
            onClick={() => openUpgrade({ source: UPGRADE_SOURCE.SIDEBAR_METER, reason: level === 'full' ? 'client_limit' : 'default', limit })}
            className={`${CARD_CLASS} w-[calc(100%-1.5rem)] cursor-pointer text-start transition-colors hover:border-primary/50 hover:bg-primary/5`}
            data-guide="usage-meter"
        >
            {content}
        </button>
    );
}
