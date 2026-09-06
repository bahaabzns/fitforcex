"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import api from "@/lib/axios";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";
import { ProgressBar } from "@heroui/react/progress-bar";
import { useDateFormatter } from "@/utils/useDateFormatter";
import { usePageTitle } from "@/hooks/usePageTitle";

function subStatusColor(status) {
    switch (status) {
        case "Active":    return "bg-green-500/15 text-green-600";
        case "Expired":   return "bg-destructive/10 text-destructive";
        case "Frozen":    return "bg-accent/15 text-accent";
        case "Pre-start": return "bg-yellow-500/15 text-yellow-600";
        case "Refunded":  return "bg-purple-500/15 text-purple-600";
        default:          return "bg-secondary text-muted-foreground";
    }
}

export default function ClientSubscriptionPage() {
    const t = useTranslations('portal.subscription');
    usePageTitle(t('title'));
    const locale = useLocale();
    const isRTL = locale === 'ar';
    const { formatDate } = useDateFormatter();

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("/api/client-portal/subscription")
            .then(res => setData(res.data))
            .finally(() => setLoading(false));
    }, []);

    const statusLabels = {
        Active:     t('statusActive'),
        Expired:    t('statusExpired'),
        Frozen:     t('statusFrozen'),
        "Pre-start": t('statusPreStart'),
        Refunded:   t('statusRefunded'),
    };

    function periodRow() {
        if (!data) return null;
        if (data.status === 'Frozen' && data.frozenUntil) return { label: t('frozenUntil'), value: formatDate(data.frozenUntil) };
        if (data.status === 'Pre-start' && data.currentPeriodStart) return { label: t('startsOn'), value: formatDate(data.currentPeriodStart) };
        if (data.status === 'Expired' && data.currentPeriodEnd) return { label: t('expiredOn'), value: formatDate(data.currentPeriodEnd) };
        if (data.currentPeriodEnd) return { label: t('renewsOn'), value: formatDate(data.currentPeriodEnd) };
        return null;
    }

    const dr = periodRow();
    const showRenewCta = data && (data.status === 'Expired' || data.status === 'Frozen');

    const showProgress = data
        && (data.status === 'Active' || data.status === 'Frozen')
        && data.currentPeriodStart && data.currentPeriodEnd;
    let totalDays = 0, daysRemaining = 0, percentElapsed = 0;
    if (showProgress) {
        const DAY_MS = 86400000;
        const start = new Date(data.currentPeriodStart).setHours(0, 0, 0, 0);
        // totalCoverageEnd extends past currentPeriodEnd by however many days the
        // client has already paid ahead (a queued renewal on file) — falls back to
        // currentPeriodEnd when there's no queued renewal, so the total still just
        // reflects the current period in the common case.
        const end   = new Date(data.totalCoverageEnd ?? data.currentPeriodEnd).setHours(0, 0, 0, 0);
        const today = new Date().setHours(0, 0, 0, 0);
        totalDays = Math.max(0, Math.round((end - start) / DAY_MS));
        daysRemaining = Math.min(totalDays, Math.max(0, Math.round((end - today) / DAY_MS)));
        percentElapsed = totalDays > 0 ? ((totalDays - daysRemaining) / totalDays) * 100 : 0;
    }

    return (
        <div className="max-w-lg mx-auto p-6 flex flex-col gap-5">
            <Link href="/portal/profile" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground w-fit">
                {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />} {t('backToProfile')}
            </Link>

            {loading ? (
                <Skeleton className="h-28 rounded-2xl" />
            ) : !data?.plan ? (
                <div className="rounded-2xl bg-secondary p-6 text-center">
                    <p className="text-sm text-muted-foreground">{t('noSubscription')}</p>
                </div>
            ) : (
                <Card>
                    <Card.Content className="p-5 flex flex-col gap-3">
                        <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                                <h1 className="text-lg font-bold text-foreground truncate">{data.plan.name}</h1>
                                {data.plan.price != null && (
                                    <p className="text-sm text-muted-foreground">
                                        {Number(data.plan.price).toLocaleString()} {data.plan.currency}
                                        {data.plan.durationDays ? ` / ${t('durationDays', { count: data.plan.durationDays })}` : ''}
                                    </p>
                                )}
                            </div>
                            {data.status && statusLabels[data.status] && (
                                <Chip size="sm" className={`shrink-0 ${subStatusColor(data.status)}`}>
                                    {statusLabels[data.status]}
                                </Chip>
                            )}
                        </div>

                        {dr && (
                            <div className="flex items-center justify-between border-t border-border pt-3">
                                <span className="text-sm text-muted-foreground">{dr.label}</span>
                                <span className="text-sm font-medium text-foreground">{dr.value}</span>
                            </div>
                        )}

                        {showProgress && (
                            <div className="flex flex-col gap-1.5">
                                <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                                    <span>{t('daysRemainingLabel', { remaining: daysRemaining, total: totalDays })}</span>
                                    <span>{Math.round(percentElapsed)}%</span>
                                </div>
                                <ProgressBar
                                    value={percentElapsed}
                                    size="sm"
                                    aria-label={t('daysRemainingLabel', { remaining: daysRemaining, total: totalDays })}
                                >
                                    <ProgressBar.Track>
                                        <ProgressBar.Fill />
                                    </ProgressBar.Track>
                                </ProgressBar>
                            </div>
                        )}

                        {showRenewCta && (
                            <Button
                                variant="primary"
                                fullWidth
                                isDisabled={!data.renewalLink}
                                onClick={() => data.renewalLink && window.open(data.renewalLink, "_blank", "noopener,noreferrer")}
                            >
                                {t('renewCta')}
                            </Button>
                        )}
                    </Card.Content>
                </Card>
            )}

            {/* Payment history */}
            <div className="flex flex-col gap-0.5">
                <p className="px-1 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('paymentHistory')}
                </p>

                {loading ? (
                    <div className="flex flex-col gap-2">
                        <Skeleton className="h-14 rounded-2xl" />
                        <Skeleton className="h-14 rounded-2xl" />
                    </div>
                ) : !data?.transactions?.length ? (
                    <p className="px-4 py-3 text-sm text-muted-foreground">{t('noPaymentHistory')}</p>
                ) : (
                    <div className="flex flex-col gap-2">
                        {data.transactions.map(tx => (
                            <div key={tx.id} className="flex items-center justify-between px-4 py-3 rounded-2xl bg-secondary">
                                <div className="flex flex-col gap-0.5 min-w-0">
                                    <span className="text-sm font-medium text-foreground truncate">{tx.packageVariation || "—"}</span>
                                    <span className="text-xs text-muted-foreground">{formatDate(tx.date)}</span>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0">
                                    <span className="text-sm font-medium text-foreground whitespace-nowrap">
                                        {Number(tx.amount).toLocaleString()} {tx.currency}
                                    </span>
                                    {tx.subscriptionStatus && statusLabels[tx.subscriptionStatus] && (
                                        <Chip size="sm" className={subStatusColor(tx.subscriptionStatus)}>
                                            {statusLabels[tx.subscriptionStatus]}
                                        </Chip>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
