'use client';

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@heroui/react/button";
import api from "@/lib/axios";
import AppModal from "@/app/components/Modal";

// Shown on the dashboard right after a gateway payment is confirmed (the billing success page
// redirects here with ?payment_confirmed=<paymentId>). The id is only used to look up what was
// bought — payment-status is workspace-scoped and owner-only, so a pasted/foreign id simply
// yields the generic message below, never someone else's data.
export default function PaymentConfirmedModal({ paymentId, onClose }) {
    const t = useTranslations('dashboard');
    const [payment, setPayment] = useState(null);

    useEffect(() => {
        let cancelled = false;
        api.get(`/api/billing/payment-status/${paymentId}`)
            .then(res => { if (!cancelled) setPayment(res.data); })
            .catch(() => {}); // generic message is fine without the plan name
        return () => { cancelled = true; };
    }, [paymentId]);

    const planName = payment?.planDisplay;

    return (
        <AppModal open onClose={onClose} title={t('paymentConfirmedTitle')}>
            <div className="flex flex-col items-center gap-4 text-center py-2">
                <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
                    <CheckCircle2 className="w-8 h-8 text-green-600" aria-hidden="true" />
                </div>
                <p className="text-sm text-muted-foreground">
                    {planName ? t('paymentConfirmedBody', { plan: planName }) : t('paymentConfirmedBodyGeneric')}
                </p>
                <Button variant="primary" fullWidth onClick={onClose}>{t('paymentConfirmedContinue')}</Button>
            </div>
        </AppModal>
    );
}
