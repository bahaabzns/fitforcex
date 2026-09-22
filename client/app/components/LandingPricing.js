'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Tabs } from "@heroui/react";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Separator } from "@heroui/react/separator";
import { Skeleton } from "@heroui/react/skeleton";
import { CheckCircle2 } from 'lucide-react';
import { pickLocalized } from "@/lib/utils";

// Plans with an "unlimited"-style feature get a highlighted row treatment,
// matching the old design's emphasis on the "no caps" selling point.
function isUnlimitedFeature(feature) {
    return /∞|unlimited|غير محدود/i.test(feature);
}

function BillingPeriodToggle({ discounts, selected, onSelect, locale, t }) {
    return (
        <div className="flex justify-center">
            <Tabs
                selectedKey={selected?.period_key}
                onSelectionChange={(key) => onSelect(discounts.find(d => d.period_key === key))}
            >
                <Tabs.ListContainer>
                    <Tabs.List
                        aria-label="Billing period"
                        className="w-fit *:h-6 *:w-fit *:px-3 *:text-sm *:font-normal *:data-[selected=true]:text-accent-foreground"
                    >
                        {discounts.map(d => {
                            const label = pickLocalized(locale, d.label, d.label_ar);
                            const saveLabel = pickLocalized(locale, d.save_label, d.save_label_ar);
                            return (
                                <Tabs.Tab key={d.period_key} id={d.period_key}>
                                    <span className="flex items-center gap-1.5">
                                        {label}
                                        {saveLabel && (
                                            <span className="text-xs font-semibold text-primary bg-primary/15 rounded-full px-1.5 py-0.5 leading-none in-data-[selected=true]:bg-white/25 in-data-[selected=true]:text-white">
                                                {saveLabel}
                                            </span>
                                        )}
                                    </span>
                                    <Tabs.Indicator className="bg-accent" />
                                </Tabs.Tab>
                            );
                        })}
                    </Tabs.List>
                </Tabs.ListContainer>
            </Tabs>
        </div>
    );
}

function VariationDropdown({ variations, selectedId, onSelect, locale, t }) {
    if (variations.length <= 1) return null;
    return (
        <select
            aria-label="Plan variation"
            value={selectedId ?? ''}
            onChange={e => onSelect(e.target.value)}
            className="w-full px-3 py-2 text-sm font-medium text-foreground bg-white/5 border border-white/10 rounded-lg outline-none hover:border-primary/40 transition-colors cursor-pointer [&>option]:bg-neutral-900 [&>option]:text-white"
        >
            {variations.map(v => (
                <option key={v.id} value={v.id}>
                    {pickLocalized(locale, v.label_en, v.label_ar)} — {v.price_monthly != null ? `${Number(v.price_monthly).toLocaleString('en-EG')} ${v.currency}` : t('customPricing')}
                </option>
            ))}
        </select>
    );
}

export default function LandingPricing({ onCtaClick, currentPlanId, isInline = false }) {
    const t = useTranslations("landing.pricing");
    const tNav = useTranslations("landing.nav");
    const tHero = useTranslations("landing.hero");
    const locale = useLocale();
    const [plans, setPlans] = useState([]);
    const [discounts, setDiscounts] = useState([]);
    const [selectedPeriod, setSelectedPeriod] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    // Which variation is selected per plan (planId -> variationId) — the dropdown on each
    // card. Defaults to the variation the admin marked `is_default`.
    const [selectedVariations, setSelectedVariations] = useState({});

    useEffect(() => {
        const plansUrl = `${process.env.NEXT_PUBLIC_API_URL}/api/plans${isInline ? '?billing=true' : ''}`;
        Promise.all([
            fetch(plansUrl).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/plans/billing-discounts`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
        ])
        .then(([plansData, discountsData]) => {
            setPlans(plansData);
            setDiscounts(discountsData);
            setSelectedPeriod(discountsData[0] ?? null);
            // Initialise each plan's dropdown to its default variation (or the first one).
            const initialVariations = {};
            plansData.forEach(p => {
                const variations = Array.isArray(p.variations) ? p.variations : [];
                const def = variations.find(v => v.is_default) ?? variations[0];
                if (def) initialVariations[p.id] = def.id;
            });
            setSelectedVariations(initialVariations);
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    }, []);

    const discount     = selectedPeriod?.discount_percent ?? 0;
    const months       = selectedPeriod?.months ?? 1;

    return (
        <section id="pricing" className={isInline ? "" : "py-16 md:py-24 px-6"}>
            <div className={isInline ? "flex flex-col gap-6" : "mx-auto max-w-7xl flex flex-col gap-14"}>

                {!isInline && (
                    <div className="text-center flex flex-col gap-4">
                        <Chip color="accent" size="sm" className="mx-auto">{tNav("pricing")}</Chip>
                        <h2 className="text-4xl sm:text-5xl font-bold text-white">{t("title")}</h2>
                        <p className="text-white/50 max-w-lg mx-auto leading-relaxed">
                            {t("subtitle")}
                        </p>
                    </div>
                )}
                {isInline && <div />}

                {loading && (
                    <div className="flex flex-col gap-6">
                        <Skeleton className="h-12 w-96 rounded-full mx-auto" />
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {[1, 2, 3].map(i => (
                                <Skeleton key={i} className="h-120 rounded-2xl" />
                            ))}
                        </div>
                    </div>
                )}

                {!loading && error && (
                    <p className="text-center text-white/40 text-sm">
                        {t("loadError")}
                    </p>
                )}

                {!loading && !error && (
                    <>
                        {discounts.length > 1 && (
                            <BillingPeriodToggle
                                discounts={discounts}
                                selected={selectedPeriod}
                                onSelect={setSelectedPeriod}
                                locale={locale}
                                t={t}
                            />
                        )}

                        <div className={`grid grid-cols-1 md:grid-cols-3 gap-6 ${isInline ? "items-stretch" : "items-center"}`}>
                            {plans.map((plan) => {
                                const variations = Array.isArray(plan.variations) ? plan.variations : [];
                                const selectedVariationId = selectedVariations[plan.id] ?? variations.find(v => v.is_default)?.id ?? variations[0]?.id;
                                const variation  = variations.find(v => v.id === selectedVariationId) ?? variations[0] ?? null;

                                const periodKey  = selectedPeriod?.period_key;
                                const ctaHref    = `/register?plan=${encodeURIComponent(plan.name)}`
                                    + (periodKey ? `&period=${encodeURIComponent(periodKey)}` : '')
                                    + (variation ? `&variation=${encodeURIComponent(variation.id)}` : '');
                                const base       = variation?.price_monthly ? Number(variation.price_monthly) : null;
                                const effective  = base != null ? Math.round(base * (1 - discount / 100)) : null;
                                const periodTotal= effective != null ? effective * months : null;
                                const priceDisplay = effective != null ? effective.toLocaleString('en-EG') : null;
                                const periodLabel  = months > 1 && periodTotal != null
                                    ? t('billedEvery', { amount: periodTotal.toLocaleString('en-EG'), currency: variation?.currency, months })
                                    : null;
                                const localizedFeatures = pickLocalized(locale, plan.features, plan.features_ar);
                                const features = Array.isArray(localizedFeatures) ? localizedFeatures : [];
                                const displayName = pickLocalized(locale, plan.display_name, plan.display_name_ar);
                                const subtitle = pickLocalized(locale, plan.subtitle, plan.subtitle_ar);
                                const featuresHeader = pickLocalized(locale, plan.features_header, plan.features_header_ar);
                                const featuresSubheader = pickLocalized(locale, plan.features_subheader, plan.features_subheader_ar);
                                const ctaText = pickLocalized(locale, plan.cta_text, plan.cta_text_ar);
                                const isCurrentPlan = currentPlanId === plan.id;

                                return (
                                    <div
                                        key={plan.id}
                                        className={`h-full${plan.is_popular && !isInline ? " md:-mt-4 md:mb-4" : ""}`}
                                    >
                                        <Card
                                            className="flex flex-col h-full"
                                            style={
                                                plan.is_popular
                                                    ? {
                                                          border: "1px solid oklch(0.72 0.18 249 / 0.5)",
                                                          boxShadow: "0 0 0 1px oklch(0.72 0.18 249 / 0.15), 0 24px 60px rgba(0,0,0,0.4), 0 0 50px oklch(0.72 0.18 249 / 0.12)",
                                                      }
                                                    : isCurrentPlan
                                                        ? {
                                                              border: "1px solid oklch(0.72 0.18 249 / 0.35)",
                                                              background: "oklch(0.72 0.18 249 / 0.04)",
                                                          }
                                                        : undefined
                                            }
                                        >
                                            <div
                                                aria-hidden="true"
                                                className="h-1.5 w-full rounded-t-2xl"
                                                style={{
                                                    background: plan.is_popular
                                                        ? "linear-gradient(90deg, var(--color-primary), color-mix(in oklch, var(--color-primary) 60%, white))"
                                                        : "color-mix(in oklch, var(--color-primary) 25%, transparent)",
                                                }}
                                            />
                                            <Card.Header className="flex flex-col gap-3 pb-0">
                                                {plan.is_popular && (
                                                    <Chip color="accent" size="sm" className="self-start">{t("mostPopular")}</Chip>
                                                )}
                                                <div className="flex flex-col gap-1">
                                                    <h3 className="text-xl font-bold text-foreground">{displayName}</h3>
                                                    {subtitle && (
                                                        <p className="text-sm text-foreground/50 leading-snug">{subtitle}</p>
                                                    )}
                                                </div>

                                                <VariationDropdown
                                                    variations={variations}
                                                    selectedId={variation?.id}
                                                    onSelect={id => setSelectedVariations(s => ({ ...s, [plan.id]: id }))}
                                                    locale={locale}
                                                    t={t}
                                                />

                                                <div className="flex flex-col gap-0.5 pt-1">
                                                    <div className="flex items-end gap-1.5">
                                                        {priceDisplay ? (
                                                            <>
                                                                <span className="text-4xl font-extrabold text-foreground leading-none">
                                                                    {priceDisplay}
                                                                </span>
                                                                <div className="flex flex-col leading-tight pb-0.5">
                                                                    <span className="text-sm font-semibold text-foreground/70">{variation?.currency}</span>
                                                                    <span className="text-xs text-foreground/40">{t('perMonth')}</span>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <span className="text-3xl font-bold text-foreground leading-none">{t('customPricing')}</span>
                                                        )}
                                                    </div>
                                                    {periodLabel && (
                                                        <p className="text-xs text-foreground/30">{periodLabel}</p>
                                                    )}
                                                    {(() => {
                                                        const seats = variation?.max_team_seats ?? plan.max_team_seats;
                                                        if (seats == null) return <p className="text-xs text-foreground/40">{t('unlimitedTeamSeats')}</p>;
                                                        return <p className="text-xs text-foreground/40">{t('teamSeatsIncluded', { count: seats })}</p>;
                                                    })()}
                                                </div>
                                            </Card.Header>

                                            <Card.Content className="flex flex-col gap-4 flex-1">
                                                <Separator />

                                                <p className="text-xs font-semibold uppercase tracking-widest text-foreground/40">
                                                    {featuresHeader}
                                                </p>

                                                {featuresSubheader && (
                                                    <p className="text-xs font-bold text-primary -mt-2">
                                                        {featuresSubheader}
                                                    </p>
                                                )}

                                                <ul className="flex flex-col gap-3">
                                                    {features.map((f) => {
                                                        const highlighted = isUnlimitedFeature(f);
                                                        return (
                                                            <li
                                                                key={f}
                                                                className={`flex items-start gap-2.5 ${highlighted ? "-m-1 rounded-lg border p-2" : ""}`}
                                                                style={highlighted ? {
                                                                    background: "color-mix(in oklch, var(--color-primary) 10%, transparent)",
                                                                    borderColor: "color-mix(in oklch, var(--color-primary) 30%, transparent)",
                                                                } : undefined}
                                                            >
                                                                <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                                                <span className={`text-sm leading-snug ${highlighted ? "font-semibold text-primary" : "text-foreground/65"}`}>{f}</span>
                                                            </li>
                                                        );
                                                    })}
                                                </ul>
                                            </Card.Content>

                                            <Card.Footer className="flex flex-col gap-2">
                                                {onCtaClick ? (
                                                    <button
                                                        onClick={() => onCtaClick(plan.id, variation?.id, plan)}
                                                        className={`button button--${isCurrentPlan ? "secondary" : plan.cta_variant} button--md button--full-width`}
                                                    >
                                                        {isCurrentPlan ? `✓ ${t("currentPlan")}` : ctaText}
                                                    </button>
                                                ) : (
                                                    <Link
                                                        href={ctaHref}
                                                        className={`button button--${plan.cta_variant} button--md button--full-width`}
                                                    >
                                                        {ctaText}
                                                    </Link>
                                                )}
                                                {effective === 0 && (
                                                    <p className="text-center text-xs text-foreground/40">
                                                        ✓ {tHero("noCreditCard")}
                                                    </p>
                                                )}
                                            </Card.Footer>
                                        </Card>
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

            </div>
        </section>
    );
}
