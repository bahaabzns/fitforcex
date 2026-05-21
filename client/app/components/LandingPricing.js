'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Separator } from "@heroui/react/separator";
import { Skeleton } from "@heroui/react/skeleton";
import { CheckCircle2 } from "lucide-react";

function BillingPeriodToggle({ discounts, selected, onSelect }) {
    return (
        <div className="flex justify-center">
            <div className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1">
                {discounts.map(d => {
                    const isActive = selected?.period_key === d.period_key;
                    return (
                        <button
                            key={d.period_key}
                            onClick={() => onSelect(d)}
                            className={`
                                flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all
                                ${isActive
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-foreground/60 hover:text-foreground hover:bg-white/5'}
                            `}
                        >
                            {d.label}
                            {d.save_label && (
                                <span className={`text-xs font-semibold ${isActive ? 'text-primary-foreground/80' : 'text-primary'}`}>
                                    {d.save_label}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}

function TeamMemberCounter({ value, onChange, min, max, pricePerSeat, currency }) {
    const extraSeats = Math.max(0, value - min);
    const extraCost  = pricePerSeat ? extraSeats * Number(pricePerSeat) : 0;

    return (
        <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground/70">Team Members</span>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => onChange(Math.max(min, value - 1))}
                        className="h-7 w-7 rounded-full border border-white/15 bg-white/5 text-foreground/60 hover:bg-white/10 hover:text-foreground flex items-center justify-center font-bold transition-colors disabled:opacity-30"
                        disabled={value <= min}
                        aria-label="Decrease team members"
                    >
                        −
                    </button>
                    <span className="w-5 text-center font-bold text-foreground">{value}</span>
                    <button
                        onClick={() => onChange(Math.min(max, value + 1))}
                        className="h-7 w-7 rounded-full border border-white/15 bg-white/5 text-foreground/60 hover:bg-white/10 hover:text-foreground flex items-center justify-center font-bold transition-colors disabled:opacity-30"
                        disabled={value >= max}
                        aria-label="Increase team members"
                    >
                        +
                    </button>
                </div>
            </div>
            {pricePerSeat && extraCost > 0 && (
                <p className="text-xs text-foreground/40">
                    +{extraCost.toLocaleString('en-EG')} {currency} / mo for {extraSeats} extra seat{extraSeats !== 1 ? 's' : ''}
                </p>
            )}
        </div>
    );
}

export default function LandingPricing() {
    const [plans, setPlans] = useState([]);
    const [discounts, setDiscounts] = useState([]);
    const [selectedPeriod, setSelectedPeriod] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    // Per-plan team member counts, keyed by plan id
    const [seatCounts, setSeatCounts] = useState({});

    useEffect(() => {
        Promise.all([
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/plans`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
            fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/plans/billing-discounts`).then(r => { if (!r.ok) throw new Error(); return r.json(); }),
        ])
        .then(([plansData, discountsData]) => {
            setPlans(plansData);
            setDiscounts(discountsData);
            setSelectedPeriod(discountsData[0] ?? null);
            // Initialise each plan's counter to its min_seat_count
            const initial = {};
            plansData.forEach(p => { if (p.has_team_counter) initial[p.id] = p.min_seat_count ?? 1; });
            setSeatCounts(initial);
        })
        .catch(() => setError(true))
        .finally(() => setLoading(false));
    }, []);

    function setSeats(planId, val) {
        setSeatCounts(s => ({ ...s, [planId]: val }));
    }

    const discount     = selectedPeriod?.discount_percent ?? 0;
    const months       = selectedPeriod?.months ?? 1;

    return (
        <section id="pricing" className="py-16 md:py-24 px-6">
            <div className="mx-auto max-w-7xl flex flex-col gap-14">

                <div className="text-center flex flex-col gap-4">
                    <Chip color="accent" size="sm" className="mx-auto">Pricing</Chip>
                    <h2 className="text-4xl sm:text-5xl font-bold text-white">Choose Your Plan</h2>
                    <p className="text-white/50 max-w-lg mx-auto leading-relaxed">
                        Start free, scale as you grow. No hidden fees, cancel anytime.
                    </p>
                </div>

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
                        Could not load pricing. Please refresh.
                    </p>
                )}

                {!loading && !error && (
                    <>
                        {discounts.length > 1 && (
                            <BillingPeriodToggle
                                discounts={discounts}
                                selected={selectedPeriod}
                                onSelect={setSelectedPeriod}
                            />
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                            {plans.map((plan) => {
                                const periodKey  = selectedPeriod?.period_key;
                                const ctaHref    = `/register?plan=${encodeURIComponent(plan.name)}`
                                    + (periodKey ? `&period=${encodeURIComponent(periodKey)}` : '');
                                const base       = plan.price_monthly ? Number(plan.price_monthly) : null;
                                const teamCount  = seatCounts[plan.id] ?? (plan.min_seat_count ?? 1);
                                const extraSeats = Math.max(0, teamCount - (plan.min_seat_count ?? 1));
                                const seatAdd    = plan.price_per_seat ? extraSeats * Number(plan.price_per_seat) : 0;
                                const effective  = base != null ? Math.round((base + seatAdd) * (1 - discount / 100)) : null;
                                const periodTotal= effective != null ? effective * months : null;
                                const priceDisplay = effective != null ? effective.toLocaleString('en-EG') : null;
                                const periodLabel  = months > 1 && periodTotal != null
                                    ? `billed ${periodTotal.toLocaleString('en-EG')} ${plan.currency} every ${months} mo`
                                    : null;
                                const features = Array.isArray(plan.features) ? plan.features : [];

                                return (
                                    <div
                                        key={plan.id}
                                        className={plan.is_popular ? "md:-mt-4 md:mb-4" : ""}
                                    >
                                        <Card
                                            className="flex flex-col h-full"
                                            style={
                                                plan.is_popular
                                                    ? {
                                                          border: "1px solid oklch(0.72 0.18 249 / 0.5)",
                                                          boxShadow: "0 0 0 1px oklch(0.72 0.18 249 / 0.15), 0 24px 60px rgba(0,0,0,0.4), 0 0 50px oklch(0.72 0.18 249 / 0.12)",
                                                      }
                                                    : undefined
                                            }
                                        >
                                            <Card.Header className="flex flex-col gap-3 pb-0">
                                                {plan.is_popular && (
                                                    <Chip color="accent" size="sm" className="self-start">Most Popular</Chip>
                                                )}
                                                <div className="flex flex-col gap-1">
                                                    <h3 className="text-xl font-bold text-foreground">{plan.display_name}</h3>
                                                    {plan.subtitle && (
                                                        <p className="text-sm text-foreground/50 leading-snug">{plan.subtitle}</p>
                                                    )}
                                                </div>
                                                <div className="flex flex-col gap-0.5 pt-1">
                                                    <div className="flex items-end gap-1.5">
                                                        {priceDisplay ? (
                                                            <>
                                                                <span className="text-4xl font-extrabold text-foreground leading-none">
                                                                    {priceDisplay}
                                                                </span>
                                                                <div className="flex flex-col leading-tight pb-0.5">
                                                                    <span className="text-sm font-semibold text-foreground/70">{plan.currency}</span>
                                                                    <span className="text-xs text-foreground/40">/ month</span>
                                                                </div>
                                                            </>
                                                        ) : (
                                                            <span className="text-3xl font-bold text-foreground leading-none">Custom pricing</span>
                                                        )}
                                                    </div>
                                                    {periodLabel && (
                                                        <p className="text-xs text-foreground/30">{periodLabel}</p>
                                                    )}
                                                </div>
                                            </Card.Header>

                                            <Card.Content className="flex flex-col gap-4 flex-1">
                                                <Separator />

                                                {plan.has_team_counter && (
                                                    <TeamMemberCounter
                                                        value={teamCount}
                                                        onChange={val => setSeats(plan.id, val)}
                                                        min={plan.min_seat_count ?? 1}
                                                        max={plan.max_seat_count ?? 20}
                                                        pricePerSeat={plan.price_per_seat}
                                                        currency={plan.currency}
                                                    />
                                                )}

                                                <p className="text-xs font-semibold uppercase tracking-widest text-foreground/40">
                                                    {plan.features_header}
                                                </p>

                                                {plan.features_subheader && (
                                                    <p className="text-xs font-bold text-primary -mt-2">
                                                        {plan.features_subheader}
                                                    </p>
                                                )}

                                                <ul className="flex flex-col gap-3">
                                                    {features.map((f) => (
                                                        <li key={f} className="flex items-start gap-2.5">
                                                            <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                                            <span className="text-sm text-foreground/65 leading-snug">{f}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </Card.Content>

                                            <Card.Footer className="flex flex-col gap-2">
                                                <Link
                                                    href={ctaHref}
                                                    className={`button button--${plan.cta_variant} button--md button--full-width`}
                                                >
                                                    {plan.cta_text}
                                                </Link>
                                                {priceDisplay && (
                                                    <p className="text-center text-xs text-foreground/40">
                                                        ✓ No credit card needed, cancel any time
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
