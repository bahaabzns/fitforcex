'use client';

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import api from "@/lib/axios";
import { redirectToDashboard, redirectToWorkspace } from "@/lib/coachSlug";
import { useTranslations } from "next-intl";
import { TextField } from "@heroui/react/textfield";
import { Label } from "@heroui/react/label";
import { Input } from "@heroui/react/input";
import { Button } from "@heroui/react/button";
import { Autocomplete } from "@heroui/react/autocomplete";
import { EmptyState } from "@heroui/react/empty-state";
import { SearchField } from "@heroui/react/search-field";
import { ListBox } from "@heroui/react/list-box";
import { useFilter } from "@heroui/react/rac";
import { Skeleton } from "@heroui/react/skeleton";
import { ChevronsUpDown } from 'lucide-react';
import { usePageTitle } from "@/hooks/usePageTitle";
import Stepper from "@/app/components/Stepper";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const COUNTRY_CODES = [
    { code: "+93", name: "Afghanistan" }, { code: "+355", name: "Albania" }, { code: "+213", name: "Algeria" },
    { code: "+376", name: "Andorra" }, { code: "+244", name: "Angola" }, { code: "+54", name: "Argentina" },
    { code: "+374", name: "Armenia" }, { code: "+61", name: "Australia" }, { code: "+43", name: "Austria" },
    { code: "+994", name: "Azerbaijan" }, { code: "+973", name: "Bahrain" }, { code: "+880", name: "Bangladesh" },
    { code: "+375", name: "Belarus" }, { code: "+32", name: "Belgium" }, { code: "+55", name: "Brazil" },
    { code: "+1", name: "Canada / USA" }, { code: "+86", name: "China" }, { code: "+57", name: "Colombia" },
    { code: "+385", name: "Croatia" }, { code: "+357", name: "Cyprus" }, { code: "+420", name: "Czech Republic" },
    { code: "+45", name: "Denmark" }, { code: "+20", name: "Egypt" }, { code: "+358", name: "Finland" },
    { code: "+33", name: "France" }, { code: "+995", name: "Georgia" }, { code: "+49", name: "Germany" },
    { code: "+233", name: "Ghana" }, { code: "+30", name: "Greece" }, { code: "+36", name: "Hungary" },
    { code: "+354", name: "Iceland" }, { code: "+91", name: "India" }, { code: "+62", name: "Indonesia" },
    { code: "+98", name: "Iran" }, { code: "+964", name: "Iraq" }, { code: "+353", name: "Ireland" },
    { code: "+972", name: "Israel" }, { code: "+39", name: "Italy" }, { code: "+81", name: "Japan" },
    { code: "+962", name: "Jordan" }, { code: "+7", name: "Kazakhstan / Russia" }, { code: "+254", name: "Kenya" },
    { code: "+965", name: "Kuwait" }, { code: "+961", name: "Lebanon" }, { code: "+218", name: "Libya" },
    { code: "+60", name: "Malaysia" }, { code: "+960", name: "Maldives" }, { code: "+52", name: "Mexico" },
    { code: "+212", name: "Morocco" }, { code: "+31", name: "Netherlands" }, { code: "+64", name: "New Zealand" },
    { code: "+234", name: "Nigeria" }, { code: "+47", name: "Norway" }, { code: "+968", name: "Oman" },
    { code: "+92", name: "Pakistan" }, { code: "+970", name: "Palestine" }, { code: "+507", name: "Panama" },
    { code: "+63", name: "Philippines" }, { code: "+48", name: "Poland" }, { code: "+351", name: "Portugal" },
    { code: "+974", name: "Qatar" }, { code: "+40", name: "Romania" }, { code: "+250", name: "Rwanda" },
    { code: "+966", name: "Saudi Arabia" }, { code: "+221", name: "Senegal" }, { code: "+381", name: "Serbia" },
    { code: "+65", name: "Singapore" }, { code: "+27", name: "South Africa" }, { code: "+82", name: "South Korea" },
    { code: "+34", name: "Spain" }, { code: "+94", name: "Sri Lanka" }, { code: "+249", name: "Sudan" },
    { code: "+46", name: "Sweden" }, { code: "+41", name: "Switzerland" }, { code: "+963", name: "Syria" },
    { code: "+886", name: "Taiwan" }, { code: "+255", name: "Tanzania" }, { code: "+66", name: "Thailand" },
    { code: "+216", name: "Tunisia" }, { code: "+90", name: "Turkey" }, { code: "+256", name: "Uganda" },
    { code: "+380", name: "Ukraine" }, { code: "+971", name: "United Arab Emirates" }, { code: "+44", name: "United Kingdom" },
    { code: "+998", name: "Uzbekistan" }, { code: "+58", name: "Venezuela" },
    { code: "+84", name: "Vietnam" }, { code: "+967", name: "Yemen" }, { code: "+260", name: "Zambia" },
    { code: "+263", name: "Zimbabwe" },
];

// Checkmark / clock icons shared by the confirmation step — same markup used by
// settings/subscription's payment overlay, kept local here since this is the only other
// place that needs them.
function CheckmarkBadge() {
    return (
        <div className="w-16 h-16 rounded-full bg-green-500/15 flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
        </div>
    );
}
function ClockBadge() {
    return (
        <div className="w-16 h-16 rounded-full bg-yellow-500/15 flex items-center justify-center">
            <svg className="w-8 h-8 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
        </div>
    );
}

export default function RegisterPage() {
    const t = useTranslations('auth');
    const tCheckout = useTranslations('checkout');
    const tCommon = useTranslations('common');
    const searchParams = useSearchParams();
    const router = useRouter();
    const planSlug = searchParams.get('plan');
    const periodKey = searchParams.get('period');
    const variationIdParam = searchParams.get('variation');
    const isNarrow = useMediaQuery("(max-width: 639px)");

    // Wizard step (only meaningful while planSlug is set — a plain/no-plan signup never
    // advances past the details form). 0 = details, 1 = payment, 2 = confirmation.
    const [step, setStep] = useState(0);
    usePageTitle(step === 0 ? t('createAccount') : step === 1 ? tCheckout('title') : t('stepConfirm'));

    const [formData, setFormData] = useState({
        fname: '', lname: '', email: '', password: '',
        countryCode: '+20', phoneNumber: '',
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const [checkingAuth, setCheckingAuth] = useState(true);
    const { contains } = useFilter({ sensitivity: "base" });

    const [registered, setRegistered] = useState(null); // { slug } — set once step 0 succeeds

    // Plan/variation resolved from the query string for the payment step's summary card —
    // same lookup LandingPricing.js/the old checkout page used against the public /api/plans.
    const [planLoading, setPlanLoading] = useState(!!planSlug);
    const [plan, setPlan] = useState(null);
    const [variation, setVariation] = useState(null);
    const [period, setPeriod] = useState(null);

    const [checkoutMethod, setCheckoutMethod] = useState('card');
    const [walletPhone, setWalletPhone] = useState('');
    const [paying, setPaying] = useState(false);
    const [payError, setPayError] = useState('');
    const [iframeUrl, setIframeUrl] = useState(null);
    const [walletRedirectUrl, setWalletRedirectUrl] = useState(null);
    const [fawryReferenceCode, setFawryReferenceCode] = useState(null);
    const [paymentId, setPaymentId] = useState(null);
    const [payStatus, setPayStatus] = useState(null); // null | 'confirmed' | 'processing'

    useEffect(() => {
        const checkAuth = async () => {
            try {
                const me = await api.get('/api/auth/me');
                const slug = me.data?.currentWorkspace?.slug;
                if (slug) {
                    // Logged in → the coach app lives on the `my.` subdomain.
                    redirectToDashboard(slug);
                    return;
                }
                setCheckingAuth(false);
            } catch {
                // Not authenticated, allow registration
                setCheckingAuth(false);
            }
        };
        checkAuth();
    }, []);

    useEffect(() => {
        if (!planSlug) { setPlanLoading(false); return; }
        Promise.all([
            api.get('/api/plans'),
            api.get('/api/plans/billing-discounts'),
        ]).then(([plansRes, discountsRes]) => {
            const foundPlan = plansRes.data.find((p) => p.name === planSlug);
            if (foundPlan) {
                const variations = Array.isArray(foundPlan.variations) ? foundPlan.variations : [];
                const foundVariation = variations.find((v) => v.id === variationIdParam)
                    ?? variations.find((v) => v.is_default) ?? variations[0] ?? null;
                setPlan(foundPlan);
                setVariation(foundVariation);
                if (periodKey) setPeriod(discountsRes.data.find((d) => d.period_key === periodKey) ?? null);
            }
        }).catch(() => { /* falls back to a plain signup below */ })
          .finally(() => setPlanLoading(false));
    }, [planSlug, variationIdParam, periodKey]);

    // Whether the wizard actually has a real plan to sell — false if the query string was
    // missing/stale, in which case registration behaves exactly like a plain signup.
    const hasPlan = !!(planSlug && plan && variation);

    useEffect(() => {
        function onMessage(e) { if (e.data === 'payment_confirmed') setPayStatus('confirmed'); }
        window.addEventListener('message', onMessage);
        return () => window.removeEventListener('message', onMessage);
    }, []);

    useEffect(() => {
        if (!paymentId) return;
        let attempts = 0;
        const id = setInterval(async () => {
            try {
                const res = await api.get(`/api/billing/payment-status/${paymentId}`);
                if (res.data.status === "paid") {
                    clearInterval(id);
                    setPayStatus("confirmed");
                } else if (attempts++ > 60) {
                    clearInterval(id);
                    setPayStatus("processing");
                }
            } catch { /* keep polling */ }
        }, 3000);
        return () => clearInterval(id);
    }, [paymentId]);

    // Once the checkout resolves (confirmed, or given up and left to the webhook), advance to
    // the confirmation step — nothing left to do on the payment step itself.
    useEffect(() => {
        if (payStatus === 'confirmed' || payStatus === 'processing') setStep(2);
    }, [payStatus]);

    const set = (field) => (val) => setFormData(prev => ({ ...prev, [field]: val }));

    async function handleDetailsSubmit(e) {
        e.preventDefault();
        setError('');
        if (!formData.phoneNumber.trim()) {
            setError(t('phoneRequired'));
            return;
        }
        setLoading(true);
        const phone = `${formData.countryCode}${formData.phoneNumber.trim()}`;
        try {
            const res = await api.post('/api/auth/register', {
                fname: formData.fname,
                lname: formData.lname,
                email: formData.email,
                password: formData.password,
                phone,
            });
            const slug = res.data?.workspace_slug;
            if (!slug) { router.push('/login'); return; }

            if (hasPlan) {
                // Register auto-logs the coach in via an httpOnly cookie scoped to the API
                // host — every subsequent /api call (billing included) already authenticates
                // with it regardless of which frontend host is displayed, so payment can stay
                // right here instead of redirecting into the workspace first.
                setRegistered({ slug });
                setStep(1);
                return;
            }
            redirectToWorkspace(slug, 'dashboard?welcome=1');
        } catch (err) {
            setError(err.response?.data?.message || t('registrationFailed'));
        } finally {
            setLoading(false);
        }
    }

    async function handlePay() {
        if (checkoutMethod === 'wallet' && !walletPhone.trim()) return;
        setPaying(true);
        setPayError('');
        try {
            const res = await api.post('/api/billing/create-invoice', {
                planId: plan.id,
                variationId: variation.id,
                paymentMethod: checkoutMethod,
                walletPhoneNumber: checkoutMethod === 'wallet' ? walletPhone.trim() : undefined,
            });
            setPayStatus(null);
            setIframeUrl(null);
            setWalletRedirectUrl(null);
            setFawryReferenceCode(null);
            if (checkoutMethod === 'wallet') {
                setWalletRedirectUrl(res.data.paymentUrl);
                window.open(res.data.paymentUrl, '_blank', 'noopener,noreferrer');
            } else if (checkoutMethod === 'fawry') {
                setFawryReferenceCode(res.data.referenceCode);
            } else {
                setIframeUrl(res.data.paymentUrl);
            }
            setPaymentId(res.data.paymentId);
        } catch (err) {
            setPayError(err.response?.data?.error || tCheckout('payFailed'));
        } finally {
            setPaying(false);
        }
    }

    function goToWorkspace() {
        redirectToWorkspace(registered.slug, 'dashboard?welcome=1');
    }

    if (checkingAuth) {
        return (
            <div className="auth-wrapper">
                <div className="auth-card flex flex-col items-center justify-center gap-4">
                    <div className="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                    <p className="text-center text-muted-foreground">{tCommon('loading')}</p>
                </div>
            </div>
        );
    }

    const detailsForm = (
        <form className="auth-form" onSubmit={handleDetailsSubmit}>
            <div className="grid grid-cols-2 gap-3">
                <TextField variant="secondary" fullWidth isRequired value={formData.fname} onChange={set('fname')}>
                    <Label>{t('firstName')}</Label>
                    <Input type="text" placeholder="John" />
                </TextField>
                <TextField variant="secondary" fullWidth isRequired value={formData.lname} onChange={set('lname')}>
                    <Label>{t('lastName')}</Label>
                    <Input type="text" placeholder="Doe" />
                </TextField>
            </div>
            <TextField variant="secondary" fullWidth isRequired value={formData.email} onChange={set('email')}>
                <Label>{t('email')}</Label>
                <Input type="email" placeholder="you@example.com" />
            </TextField>
            <TextField variant="secondary" fullWidth isRequired value={formData.password} onChange={set('password')}>
                <Label>{t('password')}</Label>
                <Input type="password" placeholder="••••••••" />
            </TextField>

            <div className="flex flex-col gap-1.5">
                <Label>{t('phoneNumber')} <span className="text-destructive">*</span></Label>
                <div className="flex gap-2">
                    <Autocomplete
                        variant="secondary"
                        value={formData.countryCode}
                        onChange={(code) => { if (code) setFormData(prev => ({ ...prev, countryCode: code })); }}
                    >
                        <Autocomplete.Trigger className="w-28">
                            <Autocomplete.Value>
                                {({ isPlaceholder }) => isPlaceholder ? '+?' : formData.countryCode}
                            </Autocomplete.Value>
                            <Autocomplete.Indicator className="size-3">
                                <ChevronsUpDown />
                            </Autocomplete.Indicator>
                        </Autocomplete.Trigger>
                        <Autocomplete.Popover>
                            <Autocomplete.Filter filter={contains}>
                                <SearchField autoFocus name="search" variant="secondary">
                                    <SearchField.Group>
                                        <SearchField.SearchIcon />
                                        <SearchField.Input placeholder={t('searchCountry')} />
                                        <SearchField.ClearButton />
                                    </SearchField.Group>
                                </SearchField>
                                <ListBox renderEmptyState={() => <EmptyState>{t('noResults')}</EmptyState>}>
                                    {COUNTRY_CODES.map((c) => (
                                        <ListBox.Item key={c.code} id={c.code} textValue={`${c.name} ${c.code}`}>
                                            <span className="w-10 shrink-0 text-muted-foreground">{c.code}</span>
                                            <span className="flex-1">{c.name}</span>
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Autocomplete.Filter>
                        </Autocomplete.Popover>
                    </Autocomplete>
                    <Input
                        type="tel"
                        variant="secondary"
                        value={formData.phoneNumber}
                        onChange={(e) => setFormData(prev => ({ ...prev, phoneNumber: e.target.value }))}
                        placeholder="1012345678"
                        fullWidth
                    />
                </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" color="primary" fullWidth isDisabled={loading} className="mt-2">
                {loading ? t('creatingAccount') : hasPlan ? t('continueToPayment') : t('register')}
            </Button>
            {!planSlug && (
                <p className="auth-link">
                    {t('hasAccount')}{" "}
                    <a href="/login">{t('loginHere')}</a>
                </p>
            )}
        </form>
    );

    // Plain signup (no plan on the query string) — original single-card layout, unchanged.
    if (!planSlug) {
        return (
            <div className="auth-wrapper">
                <div className="auth-card">
                    <h1 className="auth-title">{t('createAccount')}</h1>
                    {detailsForm}
                </div>
            </div>
        );
    }

    const discount = period?.discount_percent ?? 0;
    const months = period?.months ?? 1;
    const base = variation?.price_monthly != null ? Number(variation.price_monthly) : null;
    const effective = base != null ? Math.round(base * (1 - discount / 100)) : null;
    const periodTotal = effective != null && months > 1 ? effective * months : null;

    const STEPS = [
        { key: 'details', title: t('stepDetails') },
        { key: 'payment', title: t('stepPayment') },
        { key: 'confirm', title: t('stepConfirm') },
    ];

    return (
        <div className="auth-wrapper py-10">
            <div className="w-full max-w-3xl px-4 flex flex-col sm:flex-row gap-6 sm:gap-8">
                <div className="w-full sm:w-48 sm:shrink-0 sm:pt-2">
                    <Stepper steps={STEPS} current={step} orientation={isNarrow ? "horizontal" : "vertical"} />
                </div>

                <div className="auth-card max-w-none flex-1 min-w-0">
                    {step === 0 && (
                        <>
                            <h1 className="auth-title">{t('createAccount')}</h1>
                            {planLoading ? (
                                <Skeleton className="h-5 w-40 rounded mx-auto mb-4" />
                            ) : (
                                <p className="mb-4 text-sm text-primary/70 text-center">
                                    {t('selectedPlan', { plan: plan?.display_name ?? planSlug })}
                                </p>
                            )}
                            {detailsForm}
                        </>
                    )}

                    {step === 1 && (
                        <div className="flex flex-col gap-5">
                            <h1 className="auth-title mb-0!">{tCheckout('title')}</h1>

                            <div className="rounded-lg border border-border bg-secondary/20 px-4 py-3 flex flex-col gap-1">
                                <div className="flex items-center justify-between">
                                    <span className="text-sm font-medium text-foreground">
                                        {plan.display_name}{variation.label ? ` · ${variation.label}` : ''}
                                    </span>
                                    <span className="text-lg font-bold text-foreground">
                                        {effective != null ? (
                                            <>{effective.toLocaleString()} <span className="text-xs font-normal text-muted-foreground">{variation.currency} / {tCheckout('perMonth')}</span></>
                                        ) : tCheckout('customPricing')}
                                    </span>
                                </div>
                                {periodTotal != null && (
                                    <p className="text-xs text-muted-foreground">{tCheckout('billedEvery', { amount: periodTotal.toLocaleString(), currency: variation.currency, months })}</p>
                                )}
                            </div>

                            {!(iframeUrl || walletRedirectUrl || fawryReferenceCode) ? (
                                <>
                                    <div className="flex flex-col gap-2">
                                        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer p-2.5 rounded-lg border border-border has-checked:border-primary has-checked:bg-primary/5">
                                            <input type="radio" name="checkoutMethod" checked={checkoutMethod === 'card'} onChange={() => setCheckoutMethod('card')} />
                                            {tCheckout('payWithCard')}
                                        </label>
                                        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer p-2.5 rounded-lg border border-border has-checked:border-primary has-checked:bg-primary/5">
                                            <input type="radio" name="checkoutMethod" checked={checkoutMethod === 'wallet'} onChange={() => setCheckoutMethod('wallet')} />
                                            {tCheckout('payWithWallet')}
                                        </label>
                                        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer p-2.5 rounded-lg border border-border has-checked:border-primary has-checked:bg-primary/5">
                                            <input type="radio" name="checkoutMethod" checked={checkoutMethod === 'fawry'} onChange={() => setCheckoutMethod('fawry')} />
                                            {tCheckout('payWithFawry')}
                                        </label>
                                    </div>

                                    {checkoutMethod === 'wallet' && (
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs font-medium text-muted-foreground">{tCheckout('walletPhoneLabel')}</label>
                                            <input
                                                type="tel"
                                                value={walletPhone}
                                                onChange={(e) => setWalletPhone(e.target.value)}
                                                placeholder="01xxxxxxxxx"
                                                className="px-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors"
                                            />
                                        </div>
                                    )}

                                    {payError && <p className="text-sm text-destructive">{payError}</p>}

                                    <Button
                                        color="primary" fullWidth
                                        isDisabled={paying || (checkoutMethod === 'wallet' && !walletPhone.trim())}
                                        onClick={handlePay}
                                    >
                                        {paying ? tCheckout('processing') : tCheckout('payNow')}
                                    </Button>
                                </>
                            ) : iframeUrl ? (
                                <iframe src={iframeUrl} className="w-full rounded-lg border border-border" style={{ height: 480 }} title={tCheckout('completePayment')} />
                            ) : walletRedirectUrl ? (
                                <div className="flex flex-col items-center gap-3 text-center py-6">
                                    <div className="w-14 h-14 rounded-full bg-primary/15 flex items-center justify-center">
                                        <svg className="w-7 h-7 text-primary animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
                                        </svg>
                                    </div>
                                    <p className="text-base font-semibold text-foreground">{tCheckout('waitingForWallet')}</p>
                                    <p className="text-sm text-muted-foreground">{tCheckout('waitingForWalletHint')}</p>
                                    <button
                                        onClick={() => window.open(walletRedirectUrl, '_blank', 'noopener,noreferrer')}
                                        className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-secondary transition-colors"
                                    >
                                        {tCheckout('reopenWalletPage')}
                                    </button>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-3 text-center py-6">
                                    <p className="text-base font-semibold text-foreground">{tCheckout('fawryReferenceTitle')}</p>
                                    <p className="text-sm text-muted-foreground">{tCheckout('fawryReferenceHint')}</p>
                                    <p className="text-3xl font-extrabold text-foreground tracking-widest tabular-nums bg-secondary/40 border border-border rounded-lg px-6 py-3">
                                        {fawryReferenceCode}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    {step === 2 && (
                        <div className="flex flex-col items-center gap-4 text-center py-6">
                            {payStatus === 'confirmed' ? (
                                <>
                                    <CheckmarkBadge />
                                    <div>
                                        <p className="text-xl font-bold text-foreground">{tCheckout('paymentConfirmed')}</p>
                                        <p className="text-sm text-muted-foreground mt-1">{tCheckout('subscriptionActivated')}</p>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <ClockBadge />
                                    <div>
                                        <p className="text-xl font-bold text-foreground">{tCheckout('paymentProcessing')}</p>
                                        <p className="text-sm text-muted-foreground mt-1">{tCheckout('subscriptionActivatingSoon')}</p>
                                    </div>
                                </>
                            )}
                            <Button color="primary" fullWidth onClick={goToWorkspace}>
                                {t('enterWorkspace')}
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
