'use client';

import { Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@heroui/react/button';
import { useUpgrade } from './UpgradeProvider';
import { getUpgradeState } from '@/lib/upgradeState';
import { UPGRADE_SOURCE } from '@/lib/upgradeTracking';

// Always-visible top bar entry point. Free and expired workspaces see "Upgrade"; paid ones only
// see "Renew" in the last days of their plan, and nothing otherwise. Team members never see it
// (only the owner can pay).
export default function UpgradeButton() {
    const t = useTranslations('upgrade');
    const { subscription, isOwner, openUpgrade } = useUpgrade();
    const state = getUpgradeState(subscription);

    if (!isOwner || !state?.topbarMode) return null;

    const isRenew = state.topbarMode === 'renew';
    return (
        <Button
            size="sm"
            variant="primary"
            onClick={() => openUpgrade({ source: UPGRADE_SOURCE.TOPBAR, reason: state.isExpired ? 'expired' : 'default' })}
            data-guide="upgrade-button"
        >
            <Zap size={14} aria-hidden="true" />
            <span>{isRenew ? t('renewButton') : t('upgradeButton')}</span>
        </Button>
    );
}
