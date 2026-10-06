'use client';

import { useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import api from "@/lib/axios";

// Shown after create-invoice for gateway methods that finish OUTSIDE the browser: Fawry
// (a cash code taken to an outlet) and Meeza mobile wallets (a QR / reference completed in
// the wallet app). Polls payment-status — which asks the gateway directly — so the screen
// resolves to paid/failed even when no webhook can reach this server. Translation keys exist
// in both the "checkout" and "subscriptionPlans" namespaces; the caller passes its own `t`.

const POLL_INTERVAL_MS = 5000;
const POLL_LIMIT_MS = 15 * 60 * 1000; // the code/QR outlives this; stop polling quietly

export default function GatewayPaymentPending({ paymentId, method, referenceCode, qrPayload, onPaid, t }) {
    const [outcome, setOutcome] = useState('pending'); // 'pending' | 'paid' | 'failed'
    const onPaidRef = useRef(onPaid);
    useEffect(() => { onPaidRef.current = onPaid; }, [onPaid]);

    useEffect(() => {
        const startedAt = Date.now();
        const timer = setInterval(async () => {
            if (Date.now() - startedAt > POLL_LIMIT_MS) { clearInterval(timer); return; }
            try {
                const res = await api.get(`/api/billing/payment-status/${paymentId}`);
                if (res.data.status === 'paid') {
                    clearInterval(timer);
                    setOutcome('paid');
                    onPaidRef.current?.();
                } else if (res.data.status === 'failed') {
                    clearInterval(timer);
                    setOutcome('failed');
                }
            } catch {
                // transient — try again on the next tick
            }
        }, POLL_INTERVAL_MS);
        return () => clearInterval(timer);
    }, [paymentId]);

    const isWallet = method === 'wallet';

    return (
        <div className="flex flex-col gap-3">
            <p className="text-base font-semibold text-foreground">
                {isWallet ? t('walletQrTitle') : t('fawryReferenceTitle')}
            </p>

            {isWallet && qrPayload && (
                <div className="self-center rounded-lg bg-white p-3">
                    <QRCodeSVG value={qrPayload} size={176} />
                </div>
            )}

            {referenceCode && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
                    <p className="text-xs text-muted-foreground">{t('referenceNumberLabel')}</p>
                    <p className="text-lg font-bold tracking-widest text-foreground" dir="ltr">{referenceCode}</p>
                </div>
            )}

            <p className="text-xs text-muted-foreground">{isWallet ? t('walletQrHint') : t('fawryReferenceHint')}</p>

            {outcome === 'pending' && <p className="text-xs font-medium text-muted-foreground">{t('waitingForPayment')}</p>}
            {outcome === 'paid' && <p className="text-sm font-semibold text-emerald-500">{t('paymentConfirmed')}</p>}
            {outcome === 'failed' && <p className="text-sm font-semibold text-destructive">{t('paymentFailedRetry')}</p>}
        </div>
    );
}
