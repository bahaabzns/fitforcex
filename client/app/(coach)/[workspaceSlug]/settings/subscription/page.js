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
    const [walletRedirectUrl, setWalletRedirectUrl] = useState(null);
    const [fawryReferenceCode, setFawryReferenceCode] = useState(null);
    const [iframePayId, setIframePayId] = useState(null);
    const [payStatus, setPayStatus] = useState(null);
    const [availableAddons, setAvailableAddons] = useState([]);
    const [buyingAddon, setBuyingAddon] = useState(null);
    const [pendingUpgrade, setPendingUpgrade] = useState(null);
    // Plan just clicked, awaiting a Card/Wallet choice before create-invoice is called.
    const [methodChoice, setMethodChoice] = useState(null); // { planId, variationId }
    const [checkoutMethod, setCheckoutMethod] = useState('card');
    const [walletPhone, setWalletPhone] = useState('');

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

    function closeCheckout() {
        setIframeUrl(null);
        setWalletRedirectUrl(null);
        setFawryReferenceCode(null);
        setIframePayId(null);
        setPayStatus(null);
    }

    // Card opens an embedded iframe overlay; wallet OTP pages generally refuse to render in an
    // iframe (carrier restriction), so that flow opens a new tab instead and this page just
    // shows a "waiting for confirmation" panel while the same polling effect runs in the
    // background. Fawry has no URL at all — just a cash-payment reference code to display.
    function openCheckout({ paymentUrl, referenceCode, paymentId }, method) {
        setPayStatus(null);
        setIframeUrl(null);
        setWalletRedirectUrl(null);
        setFawryReferenceCode(null);
        if (method === 'wallet') {
            setWalletRedirectUrl(paymentUrl);
            window.open(paymentUrl, '_blank', 'noopener,noreferrer');
        } else if (method === 'fawry') {
            setFawryReferenceCode(referenceCode);
        } else {
            setIframeUrl(paymentUrl);
        }
        setIframePayId(paymentId);
    }

    async function handlePay(planId, variationId, method = 'card', walletPhoneNumber) {
        setPaying(planId);
        setError("");
        try {
            const res = await api.post("/api/billing/create-invoice", { planId, variationId, paymentMethod: method, walletPhoneNumber });
            if (res.data.creditApplied != null) {
                // Tier change with unused value to credit — confirm the discounted amount
                // before opening the checkout. A plain renewal skips this entirely.
                setPendingUpgrade({ ...res.data, method });
            } else {
                openCheckout(res.data, method);
            }
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

    function confirmUpgrade() {
        openCheckout(pendingUpgrade, pendingUpgrade.method);
        setPendingUpgrade(null);
    }

    function cancelUpgrade() {
        // The already-created workspace_payments row is simply left pending and never
        // activated — same as any other abandoned checkout today.
        setPendingUpgrade(null);
    }

    async function handleBuyAddon(addonId) {
        // Add-ons are card-only for now — no wallet method choice for this smaller purchase.
        setBuyingAddon(addonId);
        setError("");
        try {
            const res = await api.post("/api/billing/create-addon-invoice", { addonId });
            setCheckoutMethod('card');
            openCheckout(res.data, 'card');
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
            key: "gateway_status",
            label: t("columnStatus"),
            filterType: "multi",
            options: ["paid", "pending", "failed", "refunded"],
            sortable: true,
            render: (row) => (
                <Chip size="sm" className={STATUS_CHIP[row.gateway_status] ?? "bg-secondary text-muted-foreground"}>
                    {t(row.gateway_status)}
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
                onCtaClick={(planId, variationId) => { setCheckoutMethod('card'); setWalletPhone(''); setMethodChoice({ planId, variationId }); }}
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

            {/* Upgrade confirmation overlay — shown only for a tier change with credit to apply */}
            {pendingUpgrade && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-background rounded-xl shadow-xl flex flex-col w-full max-w-md p-6 gap-4">
                        <p className="text-base font-semibold text-foreground">{t("confirmUpgradeTitle")}</p>

                        <div className="flex flex-col gap-2 text-sm">
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">{t("currentPlanLabel")}</span>
                                <span className="font-medium text-foreground">
                                    {subscription?.planDisplay}{subscription?.variationLabel ? ` · ${subscription.variationLabel}` : ""}
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-muted-foreground">{t("newPlanLabel")}</span>
                                <span className="font-medium text-foreground">
                                    {pendingUpgrade.planDisplay}{pendingUpgrade.variationLabel ? ` · ${pendingUpgrade.variationLabel}` : ""}
                                </span>
                            </div>
                        </div>

                        <div className="rounded-lg border border-primary/30 bg-primary/5 px-3 py-2.5 flex flex-col gap-1">
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{t("creditAppliedLabel")}</span>
                                <span className="font-medium text-foreground">
                                    -{Number(pendingUpgrade.creditApplied).toLocaleString()} {pendingUpgrade.currency ?? ""}
                                </span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                                <span className="text-muted-foreground">{t("amountToPayLabel")}</span>
                                <span className="font-bold text-foreground">
                                    {Number(pendingUpgrade.amountCharged).toLocaleString()} {pendingUpgrade.currency ?? ""}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 mt-1">
                            <button
                                onClick={cancelUpgrade}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
                            >
                                {t("cancelButton")}
                            </button>
                            <button
                                onClick={confirmUpgrade}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                            >
                                {t("confirmUpgradeButton")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Card/Wallet choice — shown after clicking a plan CTA, before create-invoice runs */}
            {methodChoice && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-background rounded-xl shadow-xl flex flex-col w-full max-w-sm p-6 gap-4">
                        <p className="text-base font-semibold text-foreground">{t("chooseMethodTitle")}</p>

                        <div className="flex flex-col gap-2">
                            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer p-2.5 rounded-lg border border-border has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                <input type="radio" name="paymethod" checked={checkoutMethod === 'card'} onChange={() => setCheckoutMethod('card')} />
                                {t("payWithCard")}
                            </label>
                            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer p-2.5 rounded-lg border border-border has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                <input type="radio" name="paymethod" checked={checkoutMethod === 'wallet'} onChange={() => setCheckoutMethod('wallet')} />
                                {t("payWithWallet")}
                            </label>
                            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer p-2.5 rounded-lg border border-border has-[:checked]:border-primary has-[:checked]:bg-primary/5">
                                <input type="radio" name="paymethod" checked={checkoutMethod === 'fawry'} onChange={() => setCheckoutMethod('fawry')} />
                                {t("payWithFawry")}
                            </label>
                        </div>

                        {checkoutMethod === 'wallet' && (
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-muted-foreground">{t("walletPhoneLabel")}</label>
                                <input
                                    type="tel"
                                    value={walletPhone}
                                    onChange={(e) => setWalletPhone(e.target.value)}
                                    placeholder="01xxxxxxxxx"
                                    className="px-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors"
                                />
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-2 mt-1">
                            <button
                                onClick={() => setMethodChoice(null)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary transition-colors"
                            >
                                {t("cancelButton")}
                            </button>
                            <button
                                onClick={() => {
                                    const { planId, variationId } = methodChoice;
                                    setMethodChoice(null);
                                    handlePay(planId, variationId, checkoutMethod, walletPhone.trim());
                                }}
                                disabled={checkoutMethod === 'wallet' && !walletPhone.trim()}
                                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                            >
                                {t("continueButton")}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Payment overlay — an embedded iframe for card, a "waiting" panel for wallet
                (wallet OTP pages generally refuse to render inside an iframe), and a plain
                reference-code display for Fawry (cash payment, no redirect of any kind) */}
            {(iframeUrl || walletRedirectUrl || fawryReferenceCode) && (
                <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
                    <div className="bg-background rounded-xl shadow-xl flex flex-col w-full max-w-2xl" style={{ height: "80vh" }}>
                        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
                            <p className="text-sm font-semibold text-foreground">{t("completePayment")}</p>
                            <button onClick={closeCheckout} className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none">✕</button>
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
                                    {subscription?.expiresAt && (
                                        <p className="text-sm font-semibold text-green-600 mt-2">
                                            {t("renewedUntil", { date: formatDate(subscription.expiresAt) })}
                                        </p>
                                    )}
                                </div>
                                <button
                                    onClick={closeCheckout}
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
                                    onClick={closeCheckout}
                                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                                >
                                    {t("close")}
                                </button>
                            </div>
                        ) : walletRedirectUrl ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
                                <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-primary animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xl font-bold text-foreground">{t("waitingForWallet")}</p>
                                    <p className="text-sm text-muted-foreground mt-1">{t("waitingForWalletHint")}</p>
                                </div>
                                <button
                                    onClick={() => window.open(walletRedirectUrl, '_blank', 'noopener,noreferrer')}
                                    className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-secondary transition-colors"
                                >
                                    {t("reopenWalletPage")}
                                </button>
                            </div>
                        ) : fawryReferenceCode ? (
                            <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
                                <div className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center">
                                    <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                    </svg>
                                </div>
                                <div>
                                    <p className="text-xl font-bold text-foreground">{t("fawryReferenceTitle")}</p>
                                    <p className="text-sm text-muted-foreground mt-1">{t("fawryReferenceHint")}</p>
                                </div>
                                <p className="text-3xl font-extrabold text-foreground tracking-widest tabular-nums bg-secondary/40 border border-border rounded-lg px-6 py-3">
                                    {fawryReferenceCode}
                                </p>
                            </div>
                        ) : (
                            <iframe
                                src={iframeUrl}
                                className="flex-1 w-full rounded-b-xl border-0"
                                title={t("completePayment")}
                            />
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
