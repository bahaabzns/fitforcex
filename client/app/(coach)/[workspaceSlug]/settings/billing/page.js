"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import { Tabs } from "@heroui/react";
import { Chip } from "@heroui/react/chip";
import { Skeleton } from "@heroui/react/skeleton";
import { Download } from "lucide-react";
import LandingPricing from "@/app/components/LandingPricing";
import DataTable from "@/app/components/DataTable";

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

export default function BillingPage() {
    const t = useTranslations("billing");
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [paying, setPaying] = useState(false);
    const [error, setError] = useState("");
    const [iframeUrl, setIframeUrl] = useState(null);
    const [iframePayId, setIframePayId] = useState(null);
    const [payStatus, setPayStatus] = useState(null);
    const [activeTab, setActiveTab] = useState("plans");

    function loadBilling() {
        return Promise.all([
            api.get("/api/billing/subscription"),
        ]).then(([subRes]) => {
            setData(subRes.data);
        }).catch(() => setError(t("loadFailed")))
          .finally(() => setLoading(false));
    }

    useEffect(() => {
        loadBilling();
    }, []);

    useEffect(() => {
        function onMessage(e) {
            if (e.data === 'payment_confirmed') {
                setPayStatus('confirmed');
                loadBilling();
            }
        }
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, []);

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
                } else if (attempts++ > 60) {
                    clearInterval(id);
                    setPayStatus("processing");
                }
            } catch { /* keep polling */ }
        }, 3000);
        return () => clearInterval(id);
    }, [iframePayId]);

    function closeIframe() {
        setIframeUrl(null);
        setIframePayId(null);
        setPayStatus(null);
    }

    async function handlePay(planId) {
        setPaying(planId);
        setError("");
        try {
            const res = await api.post("/api/billing/create-invoice", { planId });
            setIframeUrl(res.data.paymentUrl);
            setIframePayId(res.data.paymentId);
            setPayStatus(null);
        } catch (err) {
            setError(err.response?.data?.error || t("paymentFailed"));
        } finally {
            setPaying(false);
        }
    }

    if (loading) return (
        <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
    );

    if (error && !data) return <ErrorMsg msg={error} />;

    const { subscription, payments } = data ?? {};
    const isExpired = subscription?.daysRemaining === 0;
    const isExpiring = !isExpired && subscription?.daysRemaining !== null && subscription.daysRemaining <= 7;
    const isFreePlan = subscription?.daysRemaining === null && (subscription?.priceMonthly === null || subscription?.priceMonthly === undefined)
        || subscription?.planDisplay?.toLowerCase() === 'free';

    const paymentColumns = [
        {
            key: "created_at",
            label: t("columnDate"),
            sortable: true,
            render: (row) => new Date(row.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        },
        {
            key: "plan_display",
            label: t("columnPlan"),
            sortable: true,
            render: (row) => (
                <div className="flex flex-col gap-0.5">
                    <span className="font-medium text-foreground">{row.plan_display}</span>
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
        <div className="flex flex-col gap-4 w-full">
            {/* Header + horizontal tabs */}
            <div className="flex flex-row gap-4">
                <div className="flex flex-col flex-1 gap-1">
                    <h1 className="text-3xl font-bold text-foreground">{t("pageTitle")}</h1>
                    <p className="text-sm text-muted-foreground mt-1">{t("pageSubtitle")}</p>
                </div>

                {/* Current plan banner */}
                <div className={`rounded-lg border px-4 py-3 flex items-center justify-between gap-4 flex-wrap ${
                    isExpired ? "border-destructive/30 bg-destructive/5" :
                    isExpiring ? "border-orange-500/30 bg-orange-500/5" :
                    "border-border bg-secondary/30"
                }`}>
                    <div className="flex items-center gap-3 flex-wrap">
                        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t("currentPlan")}</span>
                        <span className="text-sm font-bold text-foreground">{subscription?.planDisplay ?? "—"}</span>
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
                    {isFreePlan ? (
                        <button
                            onClick={() => setActiveTab("plans")}
                            className="button button--primary button--sm shrink-0"
                        >
                            {t("upgradePlan")}
                        </button>
                    ) : (isExpired || isExpiring) ? (
                        <button
                            onClick={() => setActiveTab("plans")}
                            className={`button button--sm shrink-0 ${isExpired ? "button--primary" : "button--outline"}`}
                        >
                            {isExpired ? t("renewNow") : t("renewEarly")}
                        </button>
                    ) : null}
                </div>
            </div>

            <Tabs
                selectedKey={activeTab}
                onSelectionChange={setActiveTab}
            >
                <Tabs.ListContainer className="w-max">
                    <Tabs.List aria-label="Billing sections">
                        <Tabs.Tab id="plans" className="whitespace-nowrap">
                            {t("tabPlans")}
                            <Tabs.Indicator />
                        </Tabs.Tab>
                        <Tabs.Tab id="history" className="whitespace-nowrap">
                            {t("tabHistory")}
                            <Tabs.Indicator />
                        </Tabs.Tab>
                    </Tabs.List>
                </Tabs.ListContainer>

                <Tabs.Panel className="pt-4 flex flex-col gap-4" id="plans">
                    <LandingPricing
                        isInline={true}
                        currentPlanId={subscription?.planId}
                        onCtaClick={(planId) => handlePay(planId)}
                    />
                </Tabs.Panel>

                <Tabs.Panel className="pt-4" id="history">
                    <DataTable
                        columns={paymentColumns}
                        data={payments ?? []}
                        rowKey="id"
                        dateParser={(str) => new Date(str)}
                        defaultSort="created_at"
                        defaultSortDirection="desc"
                    />
                </Tabs.Panel>
            </Tabs>

            {error && <ErrorMsg msg={error} />}

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
