'use client';

import { useEffect, useMemo, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Skeleton } from '@heroui/react/skeleton';
import api from '@/lib/axios';
import Modal from '@/app/components/Modal';
import ManualPaymentPanel from '@/app/components/ManualPaymentPanel';
import GatewayPaymentPending from '@/app/components/GatewayPaymentPending';
import PaymentMethodPicker, { isWalletPhoneValid } from '@/app/components/PaymentMethodPicker';
import { flattenVariations, listUpgradeOptions, pickBestFit } from '@/lib/upgradeFit';
import { trackUpgradeEvent } from '@/lib/upgradeTracking';

const DEFAULT_PAYMENT_METHOD = 'card';

function formatPrice(option) {
    return `${option.price.toLocaleString()} ${option.currency}`;
}

function PlanOption({ option, selected, isBestFit, onSelect, locale, t }) {
    const planName = locale === 'ar' && option.planNameAr ? option.planNameAr : option.planName;
    const label = locale === 'ar' && option.labelAr ? option.labelAr : option.labelEn;
    return (
        <label
            className={`flex cursor-pointer items-center gap-3 rounded-lg border p-3 transition-colors ${selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-secondary/40'}`}
        >
            <input type="radio" name="upgrade-plan" checked={selected} onChange={onSelect} />
            <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    {planName}
                    {isBestFit && (
                        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">{t('bestFit')}</span>
                    )}
                </span>
                <span className="text-xs text-muted-foreground">{label}</span>
            </span>
            <span className="text-end text-sm font-semibold tabular-nums text-foreground">
                {formatPrice(option)}
                <span className="block text-[11px] font-normal text-muted-foreground">{t('perMonth')}</span>
            </span>
        </label>
    );
}

function headingFor(reason, limit, t) {
    if (reason === 'client_limit') return { title: t('limitTitle', { limit }), subtitle: t('limitSubtitle') };
    if (reason === 'expired') return { title: t('expiredTitle'), subtitle: t('expiredSubtitle') };
    return { title: t('modalTitle'), subtitle: t('defaultSubtitle') };
}

// Short plan comparison with the best fit pre-selected, then straight to payment. Reuses the
// subscription page's checkout (create-invoice) and its manual / Fawry / wallet result panels,
// so the payment behaviour is identical wherever the coach starts from.
export default function UpgradeModal({ open, onClose, onPaid, source, reason, limit, subscription, isOwner }) {
    const t = useTranslations('upgrade');
    const tBilling = useTranslations('billing');
    const locale = useLocale();

    const [options, setOptions] = useState(null); // null = loading
    const [loadFailed, setLoadFailed] = useState(false);
    const [selectedId, setSelectedId] = useState(null);
    const [method, setMethod] = useState(DEFAULT_PAYMENT_METHOD);
    const [showMethods, setShowMethods] = useState(false);
    const [walletPhone, setWalletPhone] = useState('');
    const [paying, setPaying] = useState(false);
    const [error, setError] = useState('');
    const [manualPayment, setManualPayment] = useState(null);
    const [gatewayPending, setGatewayPending] = useState(null);

    // Plans are fetched when the modal opens, not on every page load.
    useEffect(() => {
        if (!open || !isOwner || options) return;
        let cancelled = false;
        api.get('/api/plans')
            .then(res => { if (!cancelled) setOptions(flattenVariations(res.data)); })
            .catch(() => { if (!cancelled) setLoadFailed(true); });
        return () => { cancelled = true; };
    }, [open, isOwner, options]);

    const clientCount = subscription?.clientCount ?? 0;
    const currentVariationId = subscription?.variationId ?? null;

    const upgradeOptions = useMemo(
        () => (options ? listUpgradeOptions(options, currentVariationId) : []),
        [options, currentVariationId],
    );
    const bestFit = useMemo(
        () => (options ? pickBestFit(options, { clientCount, currentVariationId }) : null),
        [options, clientCount, currentVariationId],
    );
    const selected = upgradeOptions.find(option => option.variationId === (selectedId ?? bestFit?.variationId)) ?? null;

    function resetAndClose() {
        setSelectedId(null);
        setShowMethods(false);
        setError('');
        setManualPayment(null);
        setGatewayPending(null);
        onClose();
    }

    function handleSelect(option) {
        setSelectedId(option.variationId);
        trackUpgradeEvent({ eventType: 'plan_selected', source, planId: option.planId, variationId: option.variationId });
    }

    async function handlePay() {
        if (!selected) return;
        if (method === 'wallet' && !isWalletPhoneValid(walletPhone)) {
            setError(tBilling('walletPhoneInvalid'));
            return;
        }
        setPaying(true);
        setError('');
        try {
            const res = await api.post('/api/billing/create-invoice', {
                planId: selected.planId,
                variationId: selected.variationId,
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

    function renderBody() {
        if (!isOwner) return <p className="text-sm text-muted-foreground">{t('ownerOnly')}</p>;
        if (manualPayment) return <ManualPaymentPanel info={manualPayment} t={tBilling} />;
        if (gatewayPending) return <GatewayPaymentPending {...gatewayPending} onPaid={onPaid} t={tBilling} />;
        if (loadFailed) return <p className="text-sm text-destructive">{t('loadFailed')}</p>;
        if (!options) return <Skeleton className="h-40 w-full rounded-lg" />;
        if (upgradeOptions.length === 0) return <p className="text-sm text-muted-foreground">{t('noPlans')}</p>;

        return (
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                    {upgradeOptions.map(option => (
                        <PlanOption
                            key={option.variationId}
                            option={option}
                            selected={option.variationId === selected?.variationId}
                            isBestFit={option.variationId === bestFit?.variationId}
                            onSelect={() => handleSelect(option)}
                            locale={locale}
                            t={t}
                        />
                    ))}
                </div>

                {showMethods ? (
                    <PaymentMethodPicker
                        method={method} onMethodChange={setMethod}
                        walletPhone={walletPhone} onWalletPhoneChange={setWalletPhone}
                        t={tBilling}
                    />
                ) : (
                    <button
                        type="button"
                        onClick={() => setShowMethods(true)}
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

    const canPay = isOwner && !awaitingPayment && Boolean(selected);

    return (
        <Modal
            open={open}
            onClose={resetAndClose}
            title={title}
            sheetOnMobile
            footer={(
                <div className="flex items-center justify-end gap-2">
                    <button
                        type="button"
                        onClick={resetAndClose}
                        className="rounded-lg px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary"
                    >
                        {awaitingPayment ? tBilling('done') : tBilling('cancelButton')}
                    </button>
                    {canPay && (
                        <button
                            type="button"
                            onClick={handlePay}
                            disabled={paying}
                            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:pointer-events-none disabled:opacity-40"
                        >
                            {paying ? tBilling('processing') : t('upgradeFor', { price: formatPrice(selected) })}
                        </button>
                    )}
                </div>
            )}
        >
            <div className="flex flex-col gap-4">
                {!awaitingPayment && isOwner && <p className="text-sm text-muted-foreground">{subtitle}</p>}
                {renderBody()}
            </div>
        </Modal>
    );
}
