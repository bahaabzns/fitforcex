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

// "2/3 free clients used" with a bar and an Upgrade link. Quiet by default; the bar changes
// colour as the coach nears the limit, and paid plans only get the link when nearly full.
export default function UsageMeter() {
    const t = useTranslations('upgrade');
    const { subscription, isOwner, openUpgrade } = useUpgrade();
    const state = getUpgradeState(subscription);

    if (!isOwner || !state?.meter) return null;

    const { used, limit, ratio, level, showUpgradeLink } = state.meter;
    const label = t(state.isFree ? 'clientsUsedFree' : 'clientsUsed', { used, limit });

    return (
        <div className="mx-3 mb-2 flex flex-col gap-1.5 rounded-lg border border-border bg-card/50 px-3 py-2" data-guide="usage-meter">
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-muted-foreground">{label}</span>
                {showUpgradeLink && (
                    <button
                        type="button"
                        onClick={() => openUpgrade({ source: UPGRADE_SOURCE.SIDEBAR_METER, reason: level === 'full' ? 'client_limit' : 'default', limit })}
                        className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
                    >
                        {t('meterUpgrade')}
                    </button>
                )}
            </div>
            <div
                className="h-1.5 overflow-hidden rounded-full bg-secondary"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={limit}
                aria-valuenow={Math.min(used, limit)}
                aria-label={label}
            >
                <div className={`h-full rounded-full transition-all ${LEVEL_BAR_CLASS[level]}`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
            </div>
        </div>
    );
}
