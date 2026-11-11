'use client';

import { useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import api from '@/lib/axios';
import Modal from '@/app/components/Modal';
import LandingPricing from '@/app/components/LandingPricing';
import ManualPaymentPanel from '@/app/components/ManualPaymentPanel';
import GatewayPaymentPending from '@/app/components/GatewayPaymentPending';
import PaymentMethodPicker, { isWalletPhoneValid } from '@/app/components/PaymentMethodPicker';
import { pickLocalized } from '@/lib/utils';
import { flattenVariations, pickBestFit } from '@/lib/upgradeFit';
import { trackUpgradeEvent } from '@/lib/upgradeTracking';

const DEFAULT_PAYMENT_METHOD = 'card';

function headingFor(reason, limit, t) {
    if (reason === 'client_limit') return { title: t('limitTitle', { limit }), subtitle: t('limitSubtitle') };
    if (reason === 'expired') return { title: t('expiredTitle'), subtitle: t('expiredSubtitle') };
    return { title: t('modalTitle'), subtitle: t('defaultSubtitle') };
}

function formatPrice(variation) {
    return `${Number(variation.price_monthly).toLocaleString('en-EG')} ${variation.currency}`;
}

// Step 2: what they're about to pay for, and how.
function PaymentStep({ choice, locale, t, method, onMethodChange, walletPhone, onWalletPhoneChange, showMethods, onShowMethods, error, tBilling }) {
    const planName = pickLocalized(locale, choice.plan.display_name, choice.plan.display_name_ar);
    const sizeLabel = pickLocalized(locale, choice.variation.label_en, choice.variation.label_ar);
    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3 rounded-lg border border-primary bg-primary/5 p-3">
                <div className="flex min-w-0 flex-col">
                    <span className="text-sm font-semibold text-foreground">{planName}</span>
                    <span className="text-xs text-muted-foreground">{sizeLabel}</span>
                </div>
                <span className="text-end text-sm font-semibold tabular-nums text-foreground">
                    {formatPrice(choice.variation)}
                    <span className="block text-[11px] font-normal text-muted-foreground">{t('perMonth')}</span>
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
                    className="self-start text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                    {t('changeMethod')}
                </button>
            )}

            {error && (
                <p className="rounded-lg border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>
            )}
        </div>
    );
}

// Plan comparison identical to the landing page pricing section (same cards, same size dropdown),
// with the best fit for the coach's client count pre-selected; picking a plan moves straight to
// payment. Checkout (create-invoice) and the manual / Fawry / wallet result panels are the
// subscription page's own, so payment behaves the same wherever the coach starts from.
export default function UpgradeModal({ open, onClose, onPaid, source, reason, limit, subscription, isOwner }) {
    const t = useTranslations('upgrade');
    const tBilling = useTranslations('billing');
    const locale = useLocale();

    const [plans, setPlans] = useState(null);
    const [choice, setChoice] = useState(null); // { plan, variation } once a plan card was picked
    const [method, setMethod] = useState(DEFAULT_PAYMENT_METHOD);
    const [showMethods, setShowMethods] = useState(false);
    const [walletPhone, setWalletPhone] = useState('');
    const [paying, setPaying] = useState(false);
    const [error, setError] = useState('');
    const [manualPayment, setManualPayment] = useState(null);
    const [gatewayPending, setGatewayPending] = useState(null);

    const clientCount = subscription?.clientCount ?? 0;
    const currentVariationId = subscription?.variationId ?? null;

    const recommended = useMemo(() => {
        if (!plans) return null;
        const best = pickBestFit(flattenVariations(plans), { clientCount, currentVariationId });
        return best ? { planId: best.planId, variationId: best.variationId } : null;
    }, [plans, clientCount, currentVariationId]);

    function resetAndClose() {
        setChoice(null);
        setShowMethods(false);
        setError('');
        setManualPayment(null);
        setGatewayPending(null);
        onClose();
    }

    function handleChoosePlan(planId, variationId, plan) {
        const variation = (plan.variations ?? []).find(v => v.id === variationId);
        if (!variation || !(Number(variation.price_monthly) > 0)) return; // the free card is not an upgrade
        trackUpgradeEvent({ eventType: 'plan_selected', source, planId, variationId });
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
    const onPlansStep = isOwner && !choice;

    function renderBody() {
        if (!isOwner) return <p className="text-sm text-muted-foreground">{t('ownerOnly')}</p>;
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
        return (
            <LandingPricing
                isInline
                currentPlanId={subscription?.planId}
                recommended={recommended}
                onPlansLoaded={setPlans}
                onCtaClick={handleChoosePlan}
            />
        );
    }

    function renderFooter() {
        if (awaitingPayment) {
            return (
                <button type="button" onClick={resetAndClose} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90">
                    {tBilling('done')}
                </button>
            );
        }
        if (choice) {
            return (
                <div className="flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={() => { setChoice(null); setError(''); }}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
                    >
                        {t('back')}
                    </button>
                    <button
                        type="button"
                        onClick={handlePay}
                        disabled={paying}
                        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-40"
                    >
                        {paying ? tBilling('processing') : t('upgradeFor', { price: formatPrice(choice.variation) })}
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
            size="xl"
            sheetOnMobile
            footer={renderFooter()}
        >
            <div className="flex flex-col gap-4">
                {onPlansStep && <p className="text-sm text-muted-foreground">{subtitle}</p>}
                {renderBody()}
            </div>
        </Modal>
    );
}
