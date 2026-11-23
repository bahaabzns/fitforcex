'use client';

import '@/app/landing.css';
import { useLocale, useTranslations } from 'next-intl';
import { pickLocalized } from '@/lib/utils';

// An add-on (+10 clients, +1 team seat, ...) as one of the landing page's pricing cards, so the
// Subscription page reads as a single design: same glass card, price block and buttons as the
// plan cards above it.
export default function AddonCard({ addon, isBuying, onBuy }) {
    const t = useTranslations('upgrade');
    const locale = useLocale();

    const hasCap = addon.maxUnits != null;
    const buttonLabel = isBuying ? '…' : addon.atCap ? t('addonMaxReached') : t('addonBuy');

    return (
        <article className="lp-glass lp-plan">
            <div>
                <h3>{pickLocalized(locale, addon.label, addon.labelAr)}</h3>
                {hasCap && (
                    <p className="lp-plan__sub">{t('addonBought', { owned: addon.unitsOwned, max: addon.maxUnits })}</p>
                )}
            </div>

            <div className="lp-plan__price">
                {/* Latin digits in both languages, matching the landing page and checkout. */}
                <span className="lp-plan__amount">{Number(addon.priceMonthly).toLocaleString('en-US')}</span>
                <span className="lp-plan__unit">{addon.currency} {t('perMonth')}</span>
            </div>

            <div className="lp-plan__actions">
                <button
                    type="button"
                    onClick={() => onBuy(addon.id)}
                    disabled={addon.atCap || isBuying}
                    className="lp-btn lp-btn--glass lp-btn--full"
                    style={addon.atCap || isBuying ? { opacity: 0.5, cursor: 'default' } : undefined}
                >
                    {buttonLabel}
                </button>
            </div>
        </article>
    );
}
