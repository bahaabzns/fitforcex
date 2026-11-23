'use client';

import { useId } from 'react';
import { Users } from 'lucide-react';
import { pickLocalized } from '@/lib/utils';

// The landing page's plan card (app/components/lp/LpPricing.js) with its own `lp-*` styles from
// landing.css: same glass card, price block, client-count slider and buttons. Differences for an
// existing coach: no billing-period switch (checkout charges the monthly price), a "Best fit"
// badge, and a button that picks the plan instead of linking to sign-up.

export const capacityOf = (variation) => (variation.max_clients == null ? Infinity : variation.max_clients);

// Sizes a coach can actually move to: paid, and big enough for the clients they already have.
export function selectableVariations(plan, clientCount) {
    return (Array.isArray(plan.variations) ? plan.variations : [])
        .filter(variation => Number(variation.price_monthly) > 0 && capacityOf(variation) >= clientCount)
        .sort((a, b) => capacityOf(a) - capacityOf(b) || Number(a.price_monthly) - Number(b.price_monthly));
}

// "Up to 100 clients" with only the number highlighted; "Unlimited clients" is highlighted whole.
function ClientsLabel({ label, count }) {
    if (count == null) return <b>{label}</b>;
    const [before, after] = label.split(count);
    return <>{before}<b>{count}</b>{after}</>;
}

export default function UpgradePlanCard({ plan, variations, variation, onPickVariation, isRecommended, isCurrent, renewLabel = null, onChoose, t, tUpgrade, locale, format }) {
    const sliderId = useId();
    const variationIndex = Math.max(0, variations.findIndex(v => v.id === variation.id));
    const sliderPercent = variations.length > 1 ? (variationIndex / (variations.length - 1)) * 100 : 0;
    const tierLabel = (v) => (v.max_clients == null ? t('unlimitedClients') : format(v.max_clients));
    const clientsCount = variation.max_clients == null ? null : format(variation.max_clients);
    const clientsLabel = variation.max_clients == null ? t('unlimitedClients') : t('upTo', { count: format(variation.max_clients) });
    const seats = variation.max_team_seats;
    const badge = isRecommended ? tUpgrade('bestFit') : plan.is_popular ? t('featured') : null;

    return (
        <article className={`lp-glass lp-plan ${isRecommended ? 'lp-glass--blue' : ''}`}>
            <span className="lp-plan__badge" aria-hidden={!badge} style={badge ? undefined : { visibility: 'hidden' }}>{badge ?? t('featured')}</span>
            <div>
                <h3>{pickLocalized(locale, plan.display_name, plan.display_name_ar)}</h3>
                <p className="lp-plan__sub">{pickLocalized(locale, plan.subtitle, plan.subtitle_ar)}</p>
            </div>

            <div className="lp-plan__price">
                <span className="lp-plan__amount">{format(variation.price_monthly)}</span>
                <span className="lp-plan__unit">{variation.currency} {t('perMonth').replace(/^EGP\s*/, '')}</span>
            </div>

            {variations.length > 1 ? (
                <div className="lp-range">
                    <div className="lp-range__head">
                        <label htmlFor={sliderId}>{t('variantLabel')}</label>
                        <strong className="lp-plan__clients"><ClientsLabel label={clientsLabel} count={clientsCount} /></strong>
                    </div>
                    <input
                        id={sliderId}
                        type="range"
                        min={0}
                        max={variations.length - 1}
                        step={1}
                        value={variationIndex}
                        aria-valuetext={clientsLabel}
                        style={{ '--pct': `${sliderPercent}%` }}
                        onChange={(event) => onPickVariation(plan.id, variations[Number(event.target.value)].id)}
                    />
                    <div className="lp-range__ends" aria-hidden="true">
                        <span>{tierLabel(variations[0])}</span>
                        <span>{tierLabel(variations[variations.length - 1])}</span>
                    </div>
                </div>
            ) : (
                <div className="lp-plan__meta">
                    <span className="lp-plan__clients">
                        <Users size={20} aria-hidden="true" />
                        <span><ClientsLabel label={clientsLabel} count={clientsCount} /></span>
                    </span>
                </div>
            )}
            <div className="lp-plan__meta">
                <span>{seats == null ? t('unlimitedSeats') : t('seats', { count: seats })}</span>
            </div>

            <div className="lp-plan__actions">
                <button
                    type="button"
                    disabled={isCurrent && !renewLabel}
                    onClick={() => onChoose(plan, variation)}
                    className={`lp-btn lp-btn--full ${isRecommended ? 'lp-btn--primary' : 'lp-btn--glass'}`}
                    style={isCurrent && !renewLabel ? { opacity: 0.5, cursor: 'default' } : undefined}
                >
                    {isCurrent ? (renewLabel ?? tUpgrade('currentPlan')) : t('choose')}
                </button>
            </div>
        </article>
    );
}
