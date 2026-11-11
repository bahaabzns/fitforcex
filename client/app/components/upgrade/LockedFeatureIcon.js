'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Modal from '@/app/components/Modal';
import { useUpgrade } from './UpgradeProvider';
import { UPGRADE_SOURCE } from '@/lib/upgradeTracking';

// One entry per plan-gated feature (keys match CAPABILITIES on the server). Adding a gated
// feature = add its strings + its tracking source here.
const FEATURES = {
    custom_branding: { titleKey: 'lockBrandingTitle', bodyKey: 'lockBrandingBody', source: UPGRADE_SOURCE.LOCK_BRANDING },
};

// Small lock next to a feature the plan doesn't include. Clicking it explains the feature and
// names the plans that include it, with a button into the upgrade modal. Renders nothing when
// the feature is unlocked, or for team members (they can't buy anyway).
export default function LockedFeatureIcon({ featureKey }) {
    const t = useTranslations('upgrade');
    const locale = useLocale();
    const { subscription, isOwner, openUpgrade } = useUpgrade();
    const [open, setOpen] = useState(false);

    const feature = FEATURES[featureKey];
    const access = subscription?.featureAccess?.[featureKey];
    if (!isOwner || !feature || !access || access.unlocked) return null;

    const planNames = (access.plans ?? [])
        .map(plan => (locale === 'ar' && plan.display_name_ar ? plan.display_name_ar : plan.display_name))
        .join(', ');

    // The icon sits inside a tab/link — stop the click so it opens the explainer instead of navigating.
    function handleIconClick(event) {
        event.preventDefault();
        event.stopPropagation();
        setOpen(true);
    }

    function seePlans() {
        setOpen(false);
        openUpgrade({ source: feature.source });
    }

    return (
        <>
            <span
                role="button"
                tabIndex={0}
                aria-label={t('lockAria', { feature: t(feature.titleKey) })}
                onClick={handleIconClick}
                onPointerDown={(event) => event.stopPropagation()}
                onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') handleIconClick(event); }}
                className="ms-1.5 inline-flex cursor-pointer items-center text-muted-foreground hover:text-foreground"
            >
                <Lock size={12} aria-hidden="true" />
            </span>
            <Modal
                open={open}
                onClose={() => setOpen(false)}
                title={t(feature.titleKey)}
                footer={(
                    <button
                        type="button"
                        onClick={seePlans}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                    >
                        {t('lockSeePlans')}
                    </button>
                )}
            >
                <div className="flex flex-col gap-2 text-sm">
                    <p className="text-muted-foreground">{t(feature.bodyKey)}</p>
                    <p className="font-medium text-foreground">
                        {planNames ? t('lockIncludedIn', { plans: planNames }) : t('lockHigherPlan')}
                    </p>
                </div>
            </Modal>
        </>
    );
}
