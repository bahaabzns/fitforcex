'use client';

import { useEffect, useId, useMemo, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { Check, Minus, Users } from "lucide-react";
import { pickLocalized } from "@/lib/utils";
import { LANDING_SECTIONS, WHATSAPP_URL } from "@/lib/landingConfig";

const API_URL = process.env.NEXT_PUBLIC_API_URL;

function useFormatters() {
    const locale = useLocale();
    // Latin digits in both languages, matching the app and checkout.
    return { locale, format: (value) => Number(value).toLocaleString("en-US") };
}

// Plans and billing periods come from the API so the page can never disagree with checkout.
function usePricingData() {
    const [plans, setPlans] = useState([]);
    const [discounts, setDiscounts] = useState([]);
    const [status, setStatus] = useState("loading");
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        const read = (path) => fetch(`${API_URL}${path}`).then((response) => {
            if (!response.ok) throw new Error(`Pricing request failed: ${path}`);
            return response.json();
        });
        Promise.all([read("/api/plans"), read("/api/plans/billing-discounts")])
            .then(([plansData, discountsData]) => {
                setPlans(plansData);
                setDiscounts(discountsData);
                setStatus("ready");
            })
            .catch(() => setStatus("error"));
    }, [attempt]);

    const retry = () => { setStatus("loading"); setAttempt((n) => n + 1); };
    return { plans, discounts, status, retry };
}

// "Up to 100 clients" with only the number highlighted; "Unlimited clients" is highlighted whole.
function ClientsLabel({ label, count }) {
    if (count == null) return <b>{label}</b>;
    const [before, after] = label.split(count);
    return <>{before}<b>{count}</b>{after}</>;
}

function PlanCard({ plan, variation, onPickVariation, period, t, locale, format }) {
    const sliderId = useId();
    const variations = Array.isArray(plan.variations) ? plan.variations : [];
    const variationIndex = Math.max(0, variations.findIndex((v) => v.id === variation?.id));
    const sliderPercent = variations.length > 1 ? (variationIndex / (variations.length - 1)) * 100 : 0;
    const tierLabel = (v) => (v?.max_clients == null ? t("unlimitedClients") : format(v.max_clients));
    const discount = period?.discount_percent ?? 0;
    const months = period?.months ?? 1;
    const base = variation?.price_monthly != null ? Number(variation.price_monthly) : null;
    const monthly = base != null ? Math.round(base * (1 - discount / 100)) : null;
    const seats = variation?.max_team_seats;
    const clientsCount = variation?.max_clients == null ? null : format(variation.max_clients);
    const clientsLabel = variation?.max_clients == null ? t("unlimitedClients") : t("upTo", { count: format(variation.max_clients) });

    // The same params checkout reads, so the button lands on the plan, period and tier shown on the card.
    const checkoutHref = `/register?plan=${encodeURIComponent(plan.name)}`
        + (period?.period_key ? `&period=${encodeURIComponent(period.period_key)}` : "")
        + (variation ? `&variation=${encodeURIComponent(variation.id)}` : "");

    return (
        <article className={`lp-glass lp-plan ${plan.is_popular ? "lp-glass--blue" : ""}`}>
            <span className="lp-plan__badge" aria-hidden={!plan.is_popular} style={plan.is_popular ? undefined : { visibility: "hidden" }}>{t("featured")}</span>
            <div>
                <h3>{pickLocalized(locale, plan.display_name, plan.display_name_ar)}</h3>
                <p className="lp-plan__sub">{pickLocalized(locale, plan.subtitle, plan.subtitle_ar)}</p>
            </div>

            <div>
                <div className="lp-plan__price">
                    {discount > 0 && base != null && <span className="lp-plan__was">{format(base)}</span>}
                    <span className="lp-plan__amount">{monthly != null ? format(monthly) : "—"}</span>
                    <span className="lp-plan__unit">{t("perMonth")}</span>
                </div>
                {discount > 0 && <span className="lp-plan__save">{t("saveChip", { percent: discount })}</span>}
                {months > 1 && monthly != null && (
                    <p className="lp-plan__sub">{t("billedEvery", { amount: format(monthly * months), months })}</p>
                )}
            </div>

            {variations.length > 1 ? (
                <div className="lp-range">
                    <div className="lp-range__head">
                        <label htmlFor={sliderId}>{t("variantLabel")}</label>
                        <strong className="lp-plan__clients"><ClientsLabel label={clientsLabel} count={clientsCount} /></strong>
                    </div>
                    <input
                        id={sliderId}
                        type="range"
                        min={0}
                        max={variations.length - 1}
                        step={1}
                        value={variationIndex}
                        aria-valuetext={clientsLabel}
                        style={{ "--pct": `${sliderPercent}%` }}
                        onChange={(event) => onPickVariation(plan.id, variations[Number(event.target.value)].id)}
                    />
                    <div className="lp-range__ends" aria-hidden="true">
                        <span>{tierLabel(variations[0])}</span>
                        <span>{tierLabel(variations[variations.length - 1])}</span>
                    </div>
                </div>
            ) : (
                <div className="lp-plan__meta">
                    <span className="lp-plan__clients">
                        <Users size={20} aria-hidden="true" />
                        <span><ClientsLabel label={clientsLabel} count={clientsCount} /></span>
                    </span>
                </div>
            )}
            <div className="lp-plan__meta">
                <span>{seats == null ? t("unlimitedSeats") : t("seats", { count: seats })}</span>
            </div>

            <div className="lp-plan__actions">
            <Link href={checkoutHref} className={`lp-btn lp-btn--full ${plan.is_popular ? "lp-btn--primary" : "lp-btn--glass"}`}>{t("choose")}</Link>
            <p className="lp-plan__later"><Link href="/register">{t("orStartFree")}</Link></p>
            </div>
        </article>
    );
}

function ComparisonTable({ plans, selections, t, locale, format }) {
    const names = plans.map((plan) => pickLocalized(locale, plan.display_name, plan.display_name_ar));
    const featureSets = plans.map((plan) => new Set(pickLocalized(locale, plan.features, plan.features_ar) || []));
    // Features every plan has are already in the "all plans include" line, so the table keeps only
    // the rows that actually differ between plans.
    const allFeatures = [...new Set(plans.flatMap((plan) => pickLocalized(locale, plan.features, plan.features_ar) || []))]
        .filter((feature) => !featureSets.every((set) => set.has(feature)));
    const variationOf = (plan) => plan.variations.find((v) => v.id === selections[plan.id]) ?? plan.variations[0];

    return (
        <div className="lp-glass lp-table-wrap">
            <div className="lp-table-scroll">
                <table className="lp-table">
                    <caption className="sr-only">{t("compareTitle")}</caption>
                    <thead>
                        <tr>
                            <th scope="col">{t("feature")}</th>
                            {plans.map((plan, i) => <th key={plan.id} scope="col" className={plan.is_popular ? "is-featured" : ""}>{names[i]}</th>)}
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <th scope="row">{t("clients")}</th>
                            {plans.map((plan) => {
                                const max = variationOf(plan)?.max_clients;
                                return <td key={plan.id} className={`lp-table__strong ${plan.is_popular ? "is-featured" : ""}`}>{max == null ? t("unlimitedClients") : format(max)}</td>;
                            })}
                        </tr>
                        <tr>
                            <th scope="row">{t("teamSeats")}</th>
                            {plans.map((plan) => {
                                const seats = variationOf(plan)?.max_team_seats;
                                return <td key={plan.id} className={`lp-table__strong ${plan.is_popular ? "is-featured" : ""}`}>{seats == null ? t("unlimitedSeats") : format(seats)}</td>;
                            })}
                        </tr>
                        {allFeatures.map((feature) => (
                            <tr key={feature}>
                                <th scope="row">{feature}</th>
                                {plans.map((plan, i) => (
                                    <td key={plan.id} className={plan.is_popular ? "is-featured" : ""}>
                                        {featureSets[i].has(feature)
                                            ? <><Check size={18} aria-hidden="true" /><span className="sr-only">{t("included")}</span></>
                                            : <><Minus size={18} className="lp-dash" aria-hidden="true" /><span className="sr-only">{t("notIncluded")}</span></>}
                                    </td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function LpPricing() {
    const t = useTranslations("lp.pricing");
    const { locale, format } = useFormatters();
    const { plans, discounts, status, retry } = usePricingData();
    const [periodKey, setPeriodKey] = useState(null);
    const [picked, setPicked] = useState({});

    const period = discounts.find((d) => d.period_key === periodKey) ?? discounts[0] ?? null;
    const selections = useMemo(() => {
        const map = {};
        plans.forEach((plan) => {
            const variations = Array.isArray(plan.variations) ? plan.variations : [];
            const fallback = variations.find((v) => v.is_default) ?? variations[0];
            map[plan.id] = picked[plan.id] ?? fallback?.id;
        });
        return map;
    }, [plans, picked]);

    return (
        <section id={LANDING_SECTIONS.pricing} className="lp-section lp-pricing-sec" style={{ scrollMarginTop: 90 }}>
            <div className="lp-glow lp-glow--soft lp-pricing-sec__glow" aria-hidden="true" />
            <div className="lp-container lp-above">
                <div className="lp-head lp-head--center">
                    <h2 className="lp-h2">{t("title")}</h2>
                    <p className="lp-lead">{t("subtitle")}</p>
                </div>

                {status === "loading" && (
                    <div className="lp-plans" aria-busy="true">
                        {[1, 2, 3].map((n) => <div key={n} className="lp-skeleton" />)}
                    </div>
                )}

                {status === "error" && (
                    <div className="lp-glass lp-panel" style={{ alignItems: "center", textAlign: "center" }}>
                        <p>{t("loadError")}</p>
                        <div className="lp-cta__actions">
                            <button type="button" className="lp-btn lp-btn--primary" onClick={retry}>{t("retry")}</button>
                            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="lp-btn lp-btn--wa">{t("talk")}</a>
                        </div>
                    </div>
                )}

                {status === "ready" && (
                    <>
                        {discounts.length > 1 && (
                            <div style={{ display: "flex", justifyContent: "center", marginBottom: 32 }}>
                                <div className="lp-switch" role="group" aria-label={t("billing")}>
                                    {discounts.map((d) => (
                                        <button key={d.period_key} type="button" aria-pressed={period?.period_key === d.period_key} onClick={() => setPeriodKey(d.period_key)}>
                                            <span>{pickLocalized(locale, d.label, d.label_ar)}</span>
                                            {d.discount_percent > 0 && <em dir="ltr">-{d.discount_percent}%</em>}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="lp-plans">
                            {plans.map((plan) => (
                                <PlanCard
                                    key={plan.id}
                                    plan={plan}
                                    variation={plan.variations.find((v) => v.id === selections[plan.id]) ?? plan.variations[0]}
                                    onPickVariation={(planId, variationId) => setPicked((current) => ({ ...current, [planId]: variationId }))}
                                    period={period}
                                    t={t}
                                    locale={locale}
                                    format={format}
                                />
                            ))}
                        </div>

                        <section className="lp-compare" aria-labelledby="lp-compare-title">
                            <h3 id="lp-compare-title">{t("compare")}</h3>
                            <ComparisonTable plans={plans} selections={selections} t={t} locale={locale} format={format} />
                            <p className="lp-shared">{t("shared")}</p>
                        </section>

                        <p className="lp-note">
                            <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer">{t("enterprise")}</a>
                        </p>
                    </>
                )}
            </div>
        </section>
    );
}
