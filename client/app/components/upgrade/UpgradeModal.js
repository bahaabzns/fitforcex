'use client';

import '@/app/landing.css';
import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import api from '@/lib/axios';
import Modal from '@/app/components/Modal';
import ManualPaymentPanel from '@/app/components/ManualPaymentPanel';
import GatewayPaymentPending from '@/app/components/GatewayPaymentPending';
import PaymentMethodPicker, { isWalletPhoneValid } from '@/app/components/PaymentMethodPicker';
import { pickLocalized } from '@/lib/utils';
import { flattenVariations, pickBestFit } from '@/lib/upgradeFit';
import { trackUpgradeEvent } from '@/lib/upgradeTracking';
import UpgradePlanCard, { selectableVariations } from './UpgradePlanCards';

const DEFAULT_PAYMENT_METHOD = 'card';

// The dialog itself wears the landing page's look: `lp` brings its colours, fonts and buttons
// (landing.css), `lp-embed` drops its full-page sizing, `dark` makes the app's own controls
// (close button, payment method picker) light-on-dark to match.
const DIALOG_CLASS = 'lp lp-embed dark max-w-6xl';

// Latin digits in both languages, matching the landing page and checkout.
const formatNumber = (value) => Number(value).toLocaleString('en-US');

function headingFor(reason, limit, t) {
    if (reason === 'client_limit') return { title: t('limitTitle', { limit }), subtitle: t('limitSubtitle') };
    if (reason === 'expired') return { title: t('expiredTitle'), subtitle: t('expiredSubtitle') };
    return { title: t('modalTitle'), subtitle: t('defaultSubtitle') };
}

// Step 2: what they're about to pay for, and how.
function PaymentStep({ choice, locale, t, tBilling, method, onMethodChange, walletPhone, onWalletPhoneChange, showMethods, onShowMethods, error }) {
    const planName = pickLocalized(locale, choice.plan.display_name, choice.plan.display_name_ar);
    const sizeLabel = pickLocalized(locale, choice.variation.label_en, choice.variation.label_ar);
    return (
        <div className="flex flex-col gap-4">
            <div className="lp-glass lp-glass--blue flex items-center justify-between gap-3 p-4">
                <div className="flex min-w-0 flex-col">
                    <span className="lp-display text-base">{planName}</span>
                    <span className="text-sm" style={{ color: 'var(--lp-text-3)' }}>{sizeLabel}</span>
                </div>
                <span className="text-end">
                    <span className="lp-display text-xl">{formatNumber(choice.variation.price_monthly)}</span>
                    <span className="block text-xs" style={{ color: 'var(--lp-text-3)' }}>{choice.variation.currency} / {t('perMonth')}</span>
                </span>
            </div>

            {showMethods ? (
                <PaymentMethodPicker
                    method={method} onMethodChange={onMethodChange}
                    walletPhone={walletPhone} onWalletPhoneChange={onWalletPhoneChange}
                    t={tBilling}
                />
            ) : (
                <button
                    type="button"
                    onClick={onShowMethods}
                    className="self-start text-sm underline underline-offset-4"
                    style={{ color: 'var(--lp-text-2)' }}
                >
                    {t('changeMethod')}
                </button>
            )}

            {error && (
                <p className="rounded-lg border px-3 py-2 text-sm" style={{ color: 'var(--lp-red)', borderColor: 'rgba(255,156,156,0.35)', background: 'rgba(255,156,156,0.08)' }}>{error}</p>
            )}
        </div>
    );
}

// Plan comparison in the landing page's pricing design, with the best fit for the coach's client
// count pre-selected; picking a plan moves straight to payment. Checkout (create-invoice) and the
// manual / Fawry / wallet result panels are the subscription page's own, so payment behaves the
// same wherever the coach starts from.
export default function UpgradeModal({ open, onClose, onPaid, source, reason, limit, subscription, isOwner }) {
    const t = useTranslations('upgrade');
    const tPricing = useTranslations('lp.pricing');
    const tBilling = useTranslations('billing');
    const locale = useLocale();

    const [plans, setPlans] = useState(null); // null = loading
    const [loadFailed, setLoadFailed] = useState(false);
    const [picked, setPicked] = useState({}); // planId -> variationId the coach moved the slider to
    const [choice, setChoice] = useState(null); // { plan, variation } once a plan card was chosen
    const [method, setMethod] = useState(DEFAULT_PAYMENT_METHOD);
    const [showMethods, setShowMethods] = useState(false);
    const [walletPhone, setWalletPhone] = useState('');
    const [paying, setPaying] = useState(false);
    const [error, setError] = useState('');
    const [manualPayment, setManualPayment] = useState(null);
    const [gatewayPending, setGatewayPending] = useState(null);

    // Plans are fetched when the modal first opens, not on every page load.
    useEffect(() => {
        if (!open || !isOwner || plans) return;
        let cancelled = false;
        api.get('/api/plans')
            .then(res => { if (!cancelled) setPlans(res.data); })
            .catch(() => { if (!cancelled) setLoadFailed(true); });
        return () => { cancelled = true; };
    }, [open, isOwner, plans]);

    const clientCount = subscription?.clientCount ?? 0;
    const currentVariationId = subscription?.variationId ?? null;

    // Plans that still have at least one size the coach can move to.
    const offers = useMemo(() => (plans ?? [])
        .map(plan => ({ plan, variations: selectableVariations(plan, clientCount) }))
        .filter(offer => offer.variations.length > 0), [plans, clientCount]);

    const recommended = useMemo(() => {
        const best = pickBestFit(flattenVariations(offers.map(offer => ({ ...offer.plan, variations: offer.variations }))), { clientCount, currentVariationId });
        return best ? { planId: best.planId, variationId: best.variationId } : null;
    }, [offers, clientCount, currentVariationId]);

    function resetAndClose() {
        setChoice(null);
        setShowMethods(false);
        setError('');
        setManualPayment(null);
        setGatewayPending(null);
        onClose();
    }

    function handleChoosePlan(plan, variation) {
        trackUpgradeEvent({ eventType: 'plan_selected', source, planId: plan.id, variationId: variation.id });
        setError('');
        setChoice({ plan, variation });
    }

    async function handlePay() {
        if (!choice) return;
        if (method === 'wallet' && !isWalletPhoneValid(walletPhone)) {
            setError(tBilling('walletPhoneInvalid'));
            return;
        }
        setPaying(true);
        setError('');
        try {
            const res = await api.post('/api/billing/create-invoice', {
                planId: choice.plan.id,
                variationId: choice.variation.id,
                paymentMethod: method,
                walletPhoneNumber: method === 'wallet' ? walletPhone.trim() : undefined,
                source,
                // Where the coach goes back to after paying: the page they started from.
                returnTo: `${window.location.pathname}${window.location.search}`,
            });
            if (res.data.manualPayment) {
                setManualPayment(res.data.manualPayment);
            } else if (res.data.paymentUrl) {
                window.location.assign(res.data.paymentUrl);
                return;
            } else if (res.data.referenceCode || res.data.qrPayload) {
                setGatewayPending({ paymentId: res.data.paymentId, method, referenceCode: res.data.referenceCode, qrPayload: res.data.qrPayload });
            }
        } catch (err) {
            setError(err.response?.data?.error || tBilling('paymentFailed'));
        } finally {
            setPaying(false);
        }
    }

    const { title, subtitle } = headingFor(reason, limit, t);
    const awaitingPayment = Boolean(manualPayment || gatewayPending);
    const onPlansStep = isOwner && !choice && !awaitingPayment;

    function renderPlans() {
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
                            onChoose={handleChoosePlan}
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

    function renderBody() {
        if (!isOwner) return <p className="text-sm" style={{ color: 'var(--lp-text-2)' }}>{t('ownerOnly')}</p>;
        if (manualPayment) return <ManualPaymentPanel info={manualPayment} t={tBilling} />;
        if (gatewayPending) return <GatewayPaymentPending {...gatewayPending} onPaid={onPaid} t={tBilling} />;
        if (choice) {
            return (
                <PaymentStep
                    choice={choice} locale={locale} t={t} tBilling={tBilling}
                    method={method} onMethodChange={setMethod}
                    walletPhone={walletPhone} onWalletPhoneChange={setWalletPhone}
                    showMethods={showMethods} onShowMethods={() => setShowMethods(true)}
                    error={error}
                />
            );
        }
        return renderPlans();
    }

    function renderFooter() {
        if (awaitingPayment) {
            return <button type="button" onClick={resetAndClose} className="lp-btn lp-btn--primary">{tBilling('done')}</button>;
        }
        if (choice) {
            return (
                <div className="flex items-center justify-end gap-2">
                    <button type="button" onClick={() => { setChoice(null); setError(''); }} className="lp-btn lp-btn--glass">{t('back')}</button>
                    <button type="button" onClick={handlePay} disabled={paying} className="lp-btn lp-btn--primary" style={paying ? { opacity: 0.5 } : undefined}>
                        {paying ? tBilling('processing') : t('upgradeFor', { price: `${formatNumber(choice.variation.price_monthly)} ${choice.variation.currency}` })}
                    </button>
                </div>
            );
        }
        return null;
    }

    return (
        <Modal
            open={open}
            onClose={resetAndClose}
            title={title}
            dialogClassName={DIALOG_CLASS}
            sheetOnMobile
            footer={renderFooter()}
        >
            <div className="flex flex-col gap-5">
                {onPlansStep && <p style={{ color: 'var(--lp-text-2)' }}>{subtitle}</p>}
                {renderBody()}
            </div>
        </Modal>
    );
}
