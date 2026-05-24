"use client";

import { useState, useEffect } from "react";
import api from "@/lib/axios";
import { Chip } from "@heroui/react/chip";
import { Skeleton } from "@heroui/react/skeleton";
import LandingPricing from "@/app/components/LandingPricing";

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
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [paying, setPaying] = useState(false);
    const [error, setError] = useState("");
    const [iframeUrl, setIframeUrl] = useState(null);
    const [iframePayId, setIframePayId] = useState(null);
    const [payStatus, setPayStatus] = useState(null);
    const [showAllPayments, setShowAllPayments] = useState(false);
    const [activeTab, setActiveTab] = useState("plans");

    function loadBilling() {
        return Promise.all([
            api.get("/api/billing/subscription"),
        ]).then(([subRes]) => {
            setData(subRes.data);
        }).catch(() => setError("Failed to load billing info."))
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
            setError(err.response?.data?.error || "Failed to start payment. Please try again.");
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

    return (
        <div className="flex flex-col gap-6 w-full">
            <div>
                <h1 className="text-3xl font-bold text-foreground">Billing & Plans</h1>
                <p className="text-sm text-muted-foreground mt-1">Manage your subscription and view payment history.</p>
            </div>

            {/* Current plan card */}
            <div className="rounded-lg border border-border p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between gap-4">
                    <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Current Plan</p>
                        <p className="text-2xl font-bold text-foreground mt-1">{subscription?.planDisplay ?? "—"}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        {isFreePlan && (
                            <span className="text-xs font-medium text-muted-foreground bg-secondary/70 border border-border rounded-full px-2.5 py-0.5">
                                No credit card needed
                            </span>
                        )}
                        <Chip size="sm" className={
                            subscription?.status === "active"
                                ? "bg-green-500/15 text-green-600"
                                : "bg-red-500/15 text-red-600"
                        }>
                            {subscription?.status ?? "unknown"}
                        </Chip>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-secondary/50 p-3">
                        <p className="text-xs text-muted-foreground">Days Remaining</p>
                        {subscription?.daysRemaining === null ? (
                            <div className="mt-0.5">
                                <p className="text-xl font-bold text-foreground">∞</p>
                                <p className="text-xs text-muted-foreground mt-0.5">No expiration</p>
                            </div>
                        ) : (
                            <p className={`text-xl font-bold mt-0.5 ${
                                isExpired ? "text-destructive" : isExpiring ? "text-orange-500" : "text-foreground"
                            }`}>
                                {subscription.daysRemaining}
                            </p>
                        )}
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-3">
                        <p className="text-xs text-muted-foreground">
                            {isFreePlan ? "Expires" : "Next Billing"}
                        </p>
                        <p className="text-sm font-medium text-foreground mt-0.5">
                            {isFreePlan
                                ? "Never"
                                : subscription?.expiresAt
                                    ? new Date(subscription.expiresAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
                                    : "—"}
                        </p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-3">
                        <p className="text-xs text-muted-foreground">Team Seats</p>
                        <p className="text-sm font-medium text-foreground mt-0.5">
                            {subscription?.maxTeamSeats ?? "∞"}
                        </p>
                    </div>
                </div>

                {(isExpired || isExpiring) && (
                    <p className={`text-sm rounded-lg px-3 py-2 border ${
                        isExpired
                            ? "bg-destructive/10 text-destructive border-destructive/20"
                            : "bg-orange-500/10 text-orange-600 border-orange-500/20"
                    }`}>
                        {isExpired
                            ? "Your subscription has expired. Renew below to restore access."
                            : `Your subscription expires in ${subscription.daysRemaining} days. Renew now to avoid interruption.`}
                    </p>
                )}

                {isFreePlan && (
                    <div className="mt-1 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <p className="text-sm text-foreground/80">
                            Unlock team features, branded app, and more with a paid plan
                        </p>
                        <button
                            onClick={() => document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' })}
                            className="button button--primary button--md shrink-0"
                        >
                            Upgrade Plan
                        </button>
                    </div>
                )}
            </div>

            {/* Navigation Tabs */}
            <Tabs
                className="w-full"
                selectedKey={activeTab}
                onSelectionChange={setActiveTab}
            >
                <Tabs.ListContainer>
                    <Tabs.List aria-label="Billing sections">
                        <Tabs.Tab id="plans" key="plans">
                            Available Plans
                            <Tabs.Indicator />
                        </Tabs.Tab>
                        <Tabs.Tab id="history" key="history">
                            Payment History
                            <Tabs.Indicator />
                        </Tabs.Tab>
                    </Tabs.List>
                </Tabs.ListContainer>
                <Tabs.Panel className="pt-6" id="plans" key="plans">
                    {/* Plans - using LandingPricing component */}
                    <LandingPricing
                        isInline={true}
                        currentPlanId={subscription?.planId}
                        onCtaClick={(planId) => handlePay(planId)}
                    />
                </Tabs.Panel>
                <Tabs.Panel className="pt-6" id="history" key="history">
                    {/* Payment history */}
                    {payments?.length > 0 ? (
                        <div>
                            <div className="rounded-lg border border-border overflow-hidden">
                                {(showAllPayments ? payments : payments.slice(0, 3)).map((p, idx) => (
                                    <div key={p.id} className={`flex items-center justify-between px-4 py-3 ${idx > 0 ? "border-t border-border" : ""}`}>
                                        <div>
                                            <p className="text-sm font-medium text-foreground">{p.plan_display}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {new Date(p.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                                {" · "}{p.duration_days} days
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-semibold text-foreground">
                                                {Number(p.amount).toLocaleString()} {p.currency}
                                            </span>
                                            <Chip size="sm" className={STATUS_CHIP[p.fawaterak_status] ?? "bg-secondary text-muted-foreground"}>
                                                {p.fawaterak_status}
                                            </Chip>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            {payments.length > 3 && (
                                <button
                                    onClick={() => setShowAllPayments(prev => !prev)}
                                    className="mt-2 w-full text-sm text-muted-foreground hover:text-foreground transition-colors py-2 rounded-lg hover:bg-secondary/50"
                                >
                                    {showAllPayments
                                        ? "Show less"
                                        : `Show all ${payments.length} payments`}
                                </button>
                            )}
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground">No payment history yet.</p>
                    )}
                </Tabs.Panel>
            </Tabs>

            {error && <ErrorMsg msg={error} />}

            {/* Payment iframe overlay */}
            {iframeUrl && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-background rounded-xl shadow-xl flex flex-col w-full max-w-2xl" style={{ height: "80vh" }}>
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                            <p className="text-sm font-semibold text-foreground">Complete Payment</p>
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
                                    <p className="text-xl font-bold text-foreground">Payment Confirmed!</p>
                                    <p className="text-sm text-muted-foreground mt-1">Your subscription has been activated.</p>
                                </div>
                                <button
                                    onClick={closeIframe}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                                >
                                    Done
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
                                    <p className="text-xl font-bold text-foreground">Payment Processing</p>
                                    <p className="text-sm text-muted-foreground mt-1">Your subscription will activate shortly.</p>
                                </div>
                                <button
                                    onClick={closeIframe}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                                >
                                    Close
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
