"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import { useDateFormatter } from "@/utils/useDateFormatter";
import { Chip } from "@heroui/react/chip";
import { Skeleton } from "@heroui/react/skeleton";
import { Separator } from "@heroui/react/separator";
import { Download } from "lucide-react";
import LandingPricing from "@/app/components/LandingPricing";
import DataTable from "@/app/components/DataTable";
import SettingsPageHeader from "../_components/SettingsPageHeader";
import { usePageTitle } from "@/hooks/usePageTitle";
import TriggerInsightBanner from "@/app/components/insights/TriggerInsightBanner";

const STATUS_CHIP = {
    paid:     "bg-green-500/15 text-green-600",
    pending:  "bg-yellow-500/15 text-yellow-600",
    failed:   "bg-red-500/15 text-red-600",
    refunded: "bg-orange-500/15 text-orange-600",
};

function ErrorMsg({ msg }) {
    if (!msg) return null;
    return (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            {msg}
        </p>
    );
}

export default function SubscriptionPage() {
    const { formatDate } = useDateFormatter();
    const t = useTranslations("billing");
    const tNav = useTranslations("nav");
    const tPlans = useTranslations("subscriptionPlans");
    const tHistory = useTranslations("paymentHistory");
    usePageTitle(tNav("subscription"));
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [paying, setPaying] = useState(false);
    const [error, setError] = useState("");
    const [iframeUrl, setIframeUrl] = useState(null);
    const [iframePayId, setIframePayId] = useState(null);
    const [payStatus, setPayStatus] = useState(null);
    const [availableAddons, setAvailableAddons] = useState([]);
    const [buyingAddon, setBuyingAddon] = useState(null);

    const loadBilling = useCallback(() => {
        return api.get("/api/billing/subscription").then(res => {
            setData(res.data);
        }).catch(() => setError(t("loadFailed")))
          .finally(() => setLoading(false));
    }, [t]);

    const loadAddons = useCallback(() => {
        return api.get("/api/billing/addons").then(res => setAvailableAddons(res.data)).catch(() => {});
    }, []);

    useEffect(() => {
        loadBilling();
        loadAddons();
    }, [loadBilling, loadAddons]);

    useEffect(() => {
        function onMessage(e) {
            if (e.data === 'payment_confirmed') {
                setPayStatus('confirmed');
                loadBilling();
                loadAddons();
            }
        }
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, [loadBilling, loadAddons]);

    useEffect(() => {
        if (!iframePayId) return;
        let attempts = 0;
        const id = setInterval(async () => {
            try {
                const res = await api.get(`/api/billing/payment-status/${iframePayId}`);
                if (res.data.status === "paid") {
                    clearInterval(id);
                    setPayStatus("confirmed");
                    loadBilling();
                    loadAddons();
                } else if (attempts++ > 60) {
                    clearInterval(id);
                    setPayStatus("processing");
                }
            } catch { /* keep polling */ }
        }, 3000);
        return () => clearInterval(id);
    }, [iframePayId, loadBilling, loadAddons]);

    function closeIframe() {
        setIframeUrl(null);
        setIframePayId(null);
        setPayStatus(null);
    }

    async function handlePay(planId, variationId) {
        setPaying(planId);
        setError("");
        try {
            const res = await api.post("/api/billing/create-invoice", { planId, variationId });
            setIframeUrl(res.data.paymentUrl);
            setIframePayId(res.data.paymentId);
            setPayStatus(null);
        } catch (err) {
            const message = err.response?.data?.error || "";
            const limitMatch = message.match(/^(client|seat)_limit_exceeded:(\d+)$/);
            if (limitMatch) {
                const [, kind, limit] = limitMatch;
                const kindLabel = kind === "client" ? "clients" : "team seats";
                setError(`You currently have more ${kindLabel} than this plan allows (max ${limit}). Reduce usage before switching.`);
            } else {
                setError(message || t("paymentFailed"));
            }
        } finally {
            setPaying(false);
        }
    }

    async function handleBuyAddon(addonId) {
        setBuyingAddon(addonId);
        setError("");
        try {
            const res = await api.post("/api/billing/create-addon-invoice", { addonId });
            setIframeUrl(res.data.paymentUrl);
            setIframePayId(res.data.paymentId);
            setPayStatus(null);
        } catch (err) {
            const message = err.response?.data?.error || "";
            const capMatch = message.match(/^addon_limit_reached:(\d+)$/);
            setError(capMatch ? `You've reached the maximum of ${capMatch[1]} for this add-on.` : (message || t("paymentFailed")));
        } finally {
            setBuyingAddon(null);
        }
    }

    const paymentColumns = [
        {
            key: "created_at",
            label: t("columnDate"),
            sortable: true,
            render: (row) => formatDate(row.created_at),
        },
        {
            key: "plan_display",
            label: t("columnPlan"),
            sortable: true,
            render: (row) => (
                <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-foreground">
                        {row.plan_display}{row.variation_label ? ` · ${row.variation_label}` : ""}
                    </span>
                    <span className="text-xs text-muted-foreground">{t("columnDays", { count: row.duration_days })}</span>
                </div>
            ),
        },
        {
            key: "amount",
            label: t("columnAmount"),
            sortable: true,
            render: (row) => (
                <span className="font-semibold tabular-nums text-foreground">
                    {Number(row.amount).toLocaleString()} {row.currency}
                </span>
            ),
        },
        {
            key: "fawaterak_status",
            label: t("columnStatus"),
            filterType: "multi",
            options: ["paid", "pending", "failed", "refunded"],
            sortable: true,
            render: (row) => (
                <Chip size="sm" className={STATUS_CHIP[row.fawaterak_status] ?? "bg-secondary text-muted-foreground"}>
                    {t(row.fawaterak_status)}
                </Chip>
            ),
        },
        {
            key: "_invoice",
            label: t("columnInvoice"),
            render: (row) => (
                <a
                    href={`${process.env.NEXT_PUBLIC_API_URL}/api/billing/invoice/${row.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors inline-flex"
                    title={t("downloadInvoice")}
                >
                    <Download className="h-4 w-4" />
                </a>
            ),
        },
    ];

    if (loading) return (
        <div className="flex flex-col gap-8">
            <SettingsPageHeader title={tNav("subscription")} description={tPlans("pageSubtitle")} />
            <div className="flex flex-col gap-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
        </div>
    );

    if (error && !data) return <ErrorMsg msg={error} />;

    const { subscription, payments } = data ?? {};
    const isExpired = subscription?.daysRemaining === 0;
    const isExpiring = !isExpired && subscription?.daysRemaining !== null && subscription.daysRemaining <= 7;

    const seatCount = subscription?.maxTeamSeats;
    const seatsDisplay = seatCount
        ? t("seatsLabel", { count: seatCount })
        : t("unlimitedSeats");

    const expirationDisplay = subscription?.daysRemaining === null
        ? t("noExpiration")
        : isExpired
            ? t("expired")
            : t("daysRemaining", { count: subscription.daysRemaining });

    const subscriptionStatusDisplay = subscription?.status === "active"
        ? t("statusActive")
        : subscription?.status
            ? t("statusInactive")
            : t("statusUnknown");

    return (
        <div className="flex flex-col gap-8">
            <div className="flex flex-row gap-4">
                <div className="flex-1">
                    <SettingsPageHeader title={tNav("subscription")} description={tPlans("pageSubtitle")} />
                </div>

                {/* Current plan banner */}
                <div className={`rounded-lg border px-4 py-3 flex items-center gap-4 flex-wrap self-start ${
                    isExpired ? "border-destructive/30 bg-destructive/5" :
                    isExpiring ? "border-orange-500/30 bg-orange-500/5" :
                    "border-border bg-secondary/30"
                }`}>
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("currentPlan")}</span>
                    <span className="text-sm font-bold text-foreground">
                        {subscription?.planDisplay ?? "—"}
                        {subscription?.variationLabel && (
                            <span className="font-normal text-muted-foreground"> · {subscription.variationLabel}</span>
                        )}
                    </span>
                    <span className="text-border">·</span>
                    <Chip size="sm" className={
                        subscription?.status === "active"
                            ? "bg-green-500/15 text-green-600"
                            : "bg-red-500/15 text-red-600"
                    }>
                        {subscriptionStatusDisplay}
                    </Chip>
                    <span className="text-border">·</span>
                    <span className="text-sm text-muted-foreground">{seatsDisplay}</span>
                    <span className="text-border">·</span>
                    <span className={`text-sm ${isExpired ? "text-destructive font-medium" : isExpiring ? "text-orange-500 font-medium" : "text-muted-foreground"}`}>
                        {expirationDisplay}
                    </span>
                </div>
            </div>

            <TriggerInsightBanner
                triggerEvent="first_workspace_subscription_paid"
                checkUrl="/api/insights/prompts/for-trigger/first_workspace_subscription_paid"
                respondUrlPrefix="/api/insights/prompts"
                dismissUrlPrefix="/api/insights/prompts"
            />

            <LandingPricing
                isInline={true}
                currentPlanId={subscription?.planId}
                onCtaClick={(planId, variationId) => handlePay(planId, variationId)}
            />

            {error && <ErrorMsg msg={error} />}

            {availableAddons.length > 0 && (
                <div className="flex flex-col gap-3">
                    <h2 className="text-lg font-semibold text-foreground">Add-ons</h2>
                    {data?.addons?.length > 0 && (
                        <div className="flex flex-col gap-1.5 mb-1">
                            {data.addons.map(a => (
                                <p key={a.id} className="text-sm text-muted-foreground">
                                    ✓ {a.label} <span className="text-xs">(active since {formatDate(a.purchasedAt)})</span>
                                </p>
                            ))}
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {availableAddons.map(a => (
                            <div key={a.id} className="rounded-lg border border-border bg-secondary/20 px-4 py-3 flex flex-col gap-2">
                                <div>
                                    <p className="text-sm font-semibold text-foreground">{a.label}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {Number(a.priceMonthly).toLocaleString()} {a.currency} / mo
                                        {a.maxUnits != null && ` · ${a.unitsOwned}/${a.maxUnits} bought`}
                                    </p>
                                </div>
                                <button
                                    onClick={() => handleBuyAddon(a.id)}
                                    disabled={a.atCap || buyingAddon === a.id}
                                    className="button button--outline button--sm self-start disabled:opacity-40 disabled:pointer-events-none"
                                >
                                    {buyingAddon === a.id ? "…" : a.atCap ? "Max reached" : "Buy"}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <Separator className="bg-border" />

            <div className="flex flex-col gap-4">
                <h2 className="text-lg font-semibold text-foreground">{tHistory("pageTitle")}</h2>
                <DataTable
                    columns={paymentColumns}
                    data={payments ?? []}
                    rowKey="id"
                    dateParser={(str) => new Date(str)}
                    defaultSort="created_at"
                    defaultSortDirection="desc"
                />
            </div>

            {/* Payment iframe overlay */}
            {iframeUrl && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-background rounded-xl shadow-xl flex flex-col w-full max-w-2xl" style={{ height: "80vh" }}>
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                            <p className="text-sm font-semibold text-foreground">{t("completePayment")}</p>
                            <button onClick={closeIframe} className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none">✕</button>
                        </div>

                        {payStatus === "confirmed" ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
                                <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xl font-bold text-foreground">{t("paymentConfirmed")}</p>
                                    <p className="text-sm text-muted-foreground mt-1">{t("subscriptionActivated")}</p>
                                </div>
                                <button
                                    onClick={closeIframe}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                                >
                                    {t("done")}
                                </button>
                            </div>
                        ) : payStatus === "processing" ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
                                <div className="w-16 h-16 rounded-full bg-yellow-500/15 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xl font-bold text-foreground">{t("paymentProcessing")}</p>
                                    <p className="text-sm text-muted-foreground mt-1">{t("subscriptionActivatingSoon")}</p>
                                </div>
                                <button
                                    onClick={closeIframe}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                                >
                                    {t("close")}
                                </button>
                            </div>
                        ) : (
                            <iframe
                                src={iframeUrl}
                                className="flex-1 w-full rounded-b-xl border-0"
                                title="Fawaterak Payment"
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
