'use client';

import '@/app/landing.css';
import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import api from '@/lib/axios';
import { flattenVariations, pickBestFit } from '@/lib/upgradeFit';
import UpgradePlanCard, { selectableVariations } from './UpgradePlanCards';

// Latin digits in both languages, matching the landing page and checkout.
const formatNumber = (value) => Number(value).toLocaleString('en-US');

// The landing page's pricing cards for a coach who is already signed in: loads the public plans,
// hides sizes that are free or too small for their current clients, pre-selects the best fit, and
// reports the chosen plan + size through onChoose(plan, variation). Used by the upgrade popup and
// the Subscription settings page so both look and behave the same.
//
// `renewLabel`: when set, the card for the coach's current size stays clickable as a renewal
// (labelled with it) instead of being disabled as "your current plan".
export default function PlanPicker({ subscription, onChoose, renewLabel = null }) {
    const t = useTranslations('upgrade');
    const tPricing = useTranslations('lp.pricing');
    const locale = useLocale();

    const [plans, setPlans] = useState(null); // null = loading
    const [loadFailed, setLoadFailed] = useState(false);
    const [picked, setPicked] = useState({}); // planId -> variationId the coach moved the slider to

    useEffect(() => {
        let cancelled = false;
        api.get('/api/plans')
            .then(res => { if (!cancelled) setPlans(res.data); })
            .catch(() => { if (!cancelled) setLoadFailed(true); });
        return () => { cancelled = true; };
    }, []);

    const clientCount = subscription?.clientCount ?? 0;
    const currentVariationId = subscription?.variationId ?? null;

    // Plans that still have at least one size the coach can move to.
    const offers = useMemo(() => (plans ?? [])
        .map(plan => ({ plan, variations: selectableVariations(plan, clientCount) }))
        .filter(offer => offer.variations.length > 0), [plans, clientCount]);

    const recommended = useMemo(() => {
        const flat = flattenVariations(offers.map(offer => ({ ...offer.plan, variations: offer.variations })));
        const best = pickBestFit(flat, { clientCount, currentVariationId });
        return best ? { planId: best.planId, variationId: best.variationId } : null;
    }, [offers, clientCount, currentVariationId]);

    if (loadFailed) return <p className="text-sm" style={{ color: 'var(--lp-red)' }}>{t('loadFailed')}</p>;
    if (!plans) return <div className="lp-plans" aria-busy="true">{[1, 2, 3].map(n => <div key={n} className="lp-skeleton" />)}</div>;
    if (offers.length === 0) return <p className="text-sm" style={{ color: 'var(--lp-text-2)' }}>{t('noPlans')}</p>;

    return (
        <div className="lp-plans">
            {offers.map(({ plan, variations }) => {
                const isRecommended = recommended?.planId === plan.id;
                const selectedId = picked[plan.id] ?? (isRecommended ? recommended.variationId : null);
                const variation = variations.find(v => v.id === selectedId) ?? variations[0];
                return (
                    <UpgradePlanCard
                        key={plan.id}
                        plan={plan}
                        variations={variations}
                        variation={variation}
                        onPickVariation={(planId, variationId) => setPicked(current => ({ ...current, [planId]: variationId }))}
                        isRecommended={isRecommended}
                        isCurrent={variation.id === currentVariationId}
                        renewLabel={renewLabel}
                        onChoose={onChoose}
                        t={tPricing}
                        tUpgrade={t}
                        locale={locale}
                        format={formatNumber}
                    />
                );
            })}
        </div>
    );
}
