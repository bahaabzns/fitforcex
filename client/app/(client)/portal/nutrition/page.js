"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import { ChevronLeft, ChevronRight, ChevronDown, Check, ShoppingCart } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { calcCycle, calcItem, calcMeal } from "@/lib/nutritionCalc";
import { Skeleton } from "@heroui/react/skeleton";
import { Card } from "@heroui/react/card";
import ShoppingListDrawer from "@/app/components/ShoppingListDrawer";
import MacrosDonut from "@/app/components/nutrition/MacrosDonut";
import { usePageTitle } from "@/hooks/usePageTitle";
import { planKey, setSeenPlanKey } from "@/lib/lastSeenStore";

export default function ClientDashboardPage() {
    const t         = useTranslations('portal.dashboard');
    const tShopping = useTranslations('portal.shoppingList');
    usePageTitle(t('title'));
    const locale = useLocale();
    const isRTL  = locale === 'ar';

    const [plan, setPlan]                         = useState(null);
    const [activeCycleIndex, setActiveCycleIndex] = useState(0);
    const [loading, setLoading]                   = useState(true);
    const [noplan, setNoPlan]                     = useState(false);
    const [showLeftShadow, setShowLeftShadow]     = useState(false);
    const [showRightShadow, setShowRightShadow]   = useState(false);
    const [expandedMeals, setExpandedMeals]       = useState(new Set());
    const [checkedItems, setCheckedItems]         = useState(new Set());
    const [noteExpanded, setNoteExpanded]         = useState(false);
    const [isPageScrolled, setIsPageScrolled]     = useState(false);
    const [showShoppingList, setShowShoppingList] = useState(false);
    const tabsScrollRef = useRef(null);
    const router = useRouter();

    function updateTabShadows() {
        const el = tabsScrollRef.current;
        if (!el) return;
        // Force dir="ltr" on container so scrollLeft is always 0 → max (left → right)
        setShowLeftShadow(el.scrollLeft > 0);
        setShowRightShadow(el.scrollLeft < el.scrollWidth - el.clientWidth - 1);
    }

    useEffect(() => {
        const el = tabsScrollRef.current;
        if (!el) return;
        el.addEventListener('scroll', updateTabShadows);
        const ro = new ResizeObserver(updateTabShadows);
        ro.observe(el);
        return () => { el.removeEventListener('scroll', updateTabShadows); ro.disconnect(); };
    }, [plan]);

    useEffect(() => {
        async function load() {
            try {
                const [, planRes] = await Promise.all([
                    api.get("/api/client-portal/me"),
                    api.get("/api/client-portal/active-plan").catch(e => {
                        if (e.response?.status === 404) return null;
                        throw e;
                    }),
                ]);
                if (!planRes) {
                    setNoPlan(true);
                } else {
                    setPlan(planRes.data);
                    // Clears the bottom-nav Nutrition dot — a plan is "seen" once
                    // this page has loaded it, same as the mobile app.
                    setSeenPlanKey('nutrition', planKey(planRes.data.id, planRes.data.activated_at));
                }
            } catch {
                const slug = localStorage.getItem('portal_slug');
                router.push(slug ? `/portal/${slug}` : '/portal');
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [router]);

    useEffect(() => {
        function handleScroll() { setIsPageScrolled(window.scrollY > 4); }
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    function switchCycle(i) {
        setActiveCycleIndex(i);
    }

    function toggleMeal(id) {
        setExpandedMeals(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    function toggleItem(id) {
        setCheckedItems(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    }

    // Scroll helpers — account for RTL by reading document dir
    function scrollTabsBack() {
        tabsScrollRef.current?.scrollBy({ left: -120, behavior: 'smooth' });
    }
    function scrollTabsForward() {
        tabsScrollRef.current?.scrollBy({ left: 120, behavior: 'smooth' });
    }

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
                <Skeleton className="h-8 w-48 rounded-lg mx-auto" />
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-10 rounded-full w-64 mx-auto" />
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
                <Skeleton className="h-16 rounded-xl" />
            </div>
        );
    }

    const cycle = plan?.cycles?.[activeCycleIndex] ?? null;

    const donut = (() => {
        if (!cycle) return null;
        const totals   = calcCycle(cycle);
        const macroCal = totals.carbs * 4 + totals.protein * 4 + totals.fats * 9;
        return { totals, empty: macroCal === 0 };
    })();

    // Format "C 25g" or "25g ك" depending on locale
    function macro(abbr, value) {
        return isRTL ? `${value}g ${abbr}` : `${abbr} ${value}g`;
    }

    return (
        <div className="max-w-4xl mx-auto flex flex-col">

            {/* ── Sticky header ── */}
            <div className={`sticky top-14 z-30 bg-background px-6 pt-5 pb-4 flex flex-col gap-4 border-b transition-colors duration-200 ${isPageScrolled ? 'border-border' : 'border-transparent'}`}>
                <h1 className="text-2xl font-bold text-foreground text-center">
                    {plan ? plan.name : t('title')}
                </h1>

                {donut && !noplan && (
                    donut.empty ? (
                        <p className="text-sm text-muted-foreground text-center py-2">{t('noNutritionData')}</p>
                    ) : (
                        <MacrosDonut
                            totals={donut.totals}
                            labels={{ carbs: t('macroCarbs'), fat: t('macroFat'), protein: t('macroProtein'), kcal: t('kcal') }}
                        />
                    )
                )}

                {/* Cycle tabs — sticky so they stay visible while scrolling through meals */}
                {!noplan && plan && plan.cycles.length > 1 && (
                    <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1">
                            <button
                                onClick={isRTL ? scrollTabsForward : scrollTabsBack}
                                className={`shrink-0 p-1 rounded-full transition-opacity text-muted-foreground hover:text-foreground ${
                                    (isRTL ? showRightShadow : showLeftShadow) ? 'opacity-100 cursor-pointer' : 'opacity-0 pointer-events-none'
                                }`}
                            >
                                {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
                            </button>

                            <div className="relative flex-1 min-w-0">
                                <div
                                    className={`absolute start-0 top-0 bottom-0 w-8 pointer-events-none z-10 transition-opacity duration-200 ${(isRTL ? showRightShadow : showLeftShadow) ? 'opacity-100' : 'opacity-0'}`}
                                    style={{ background: `linear-gradient(to ${isRTL ? 'left' : 'right'}, var(--color-background), transparent)` }}
                                />
                                <div
                                    className={`absolute end-0 top-0 bottom-0 w-8 pointer-events-none z-10 transition-opacity duration-200 ${(isRTL ? showLeftShadow : showRightShadow) ? 'opacity-100' : 'opacity-0'}`}
                                    style={{ background: `linear-gradient(to ${isRTL ? 'right' : 'left'}, var(--color-background), transparent)` }}
                                />
                                <div ref={tabsScrollRef} className="overflow-x-auto scrollbar-hide pb-1 w-full" dir="ltr">
                                    <div className={`flex gap-2 w-max ${!showLeftShadow && !showRightShadow ? 'mx-auto' : ''} ${isRTL ? 'flex-row-reverse' : ''}`}>
                                        {plan.cycles.map((c, i) => (
                                            <button
                                                key={c.id}
                                                onClick={() => switchCycle(i)}
                                                className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
                                                    activeCycleIndex === i
                                                        ? "bg-primary border-primary text-primary-foreground"
                                                        : "border-border text-muted-foreground hover:bg-default"
                                                }`}
                                            >
                                                {c.name}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            <button
                                onClick={isRTL ? scrollTabsBack : scrollTabsForward}
                                className={`shrink-0 p-1 rounded-full transition-opacity text-muted-foreground hover:text-foreground ${
                                    (isRTL ? showLeftShadow : showRightShadow) ? 'opacity-100 cursor-pointer' : 'opacity-0 pointer-events-none'
                                }`}
                            >
                                {isRTL ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* ── Scrollable content ── */}
            <div className="px-6 pt-4 pb-6 flex flex-col gap-4">

                {noplan || !plan ? (
                    <Card>
                        <Card.Content className="p-6 flex flex-col items-center justify-center py-16 gap-3 text-center">
                            <svg className="w-12 h-12 text-muted-foreground/30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-base font-medium text-muted-foreground">{t('noActivePlan')}</p>
                            <p className="text-sm text-muted-foreground/70">{t('noActivePlanHint')}</p>
                        </Card.Content>
                    </Card>
                ) : cycle && (
                    <>
                        {/* Coach note — collapsible */}
                        {cycle.note && (
                            <div className="border border-yellow-500/40 overflow-hidden" style={{ borderRadius: 'min(32px, var(--radius-3xl))' }}>
                                <button
                                    onClick={() => setNoteExpanded(p => !p)}
                                    className="w-full flex items-start justify-between gap-3 px-4 py-3 cursor-pointer bg-yellow-500/10 hover:bg-yellow-500/15 transition-colors"
                                >
                                    <div className="flex flex-col items-start gap-0.5 min-w-0 text-start">
                                        <span className="text-xs font-bold text-yellow-600 uppercase tracking-wide">{t('coachNote')}</span>
                                        {!noteExpanded && (
                                            <span dir="auto" className="text-xs text-yellow-600/70 truncate w-full">{cycle.note.split('\n')[0]}</span>
                                        )}
                                    </div>
                                    <ChevronDown className={`shrink-0 mt-0.5 w-3.5 h-3.5 text-yellow-600 transition-transform duration-200 ${noteExpanded ? 'rotate-180' : ''}`} />
                                </button>
                                {noteExpanded && (
                                    <p dir="auto" className="text-sm text-yellow-600 whitespace-pre-wrap px-4 py-3 bg-yellow-500/5">{cycle.note}</p>
                                )}
                            </div>
                        )}

                        {/* Meals */}
                        {cycle.meals.length === 0 ? (
                            <Card>
                                <Card.Content className="p-6 flex flex-col items-center justify-center py-12 gap-2 text-center">
                                    <p className="text-sm text-muted-foreground">{t('noMeals')}</p>
                                </Card.Content>
                            </Card>
                        ) : (
                            <div className="flex flex-col gap-3">
                                {/* Meals separator */}
                                <div className="flex items-center gap-3">
                                    <div className="flex-1 h-px bg-border" />
                                    <span className="text-[11px] font-medium text-muted-foreground/50 tracking-widest uppercase">{t('meals')}</span>
                                    <div className="flex-1 h-px bg-border" />
                                </div>

                                {cycle.meals.map((meal) => {
                                    const mealTotals = calcMeal(meal);
                                    const isExpanded = expandedMeals.has(meal.id);

                                    return (
                                        <Card key={meal.id}>
                                            {/* Tappable header */}
                                            <button onClick={() => toggleMeal(meal.id)} className="w-full cursor-pointer">
                                                <div className="px-3 pt-2 pb-0.5 flex items-center justify-between gap-2">
                                                    <span className="text-sm font-semibold text-foreground truncate">{meal.name}</span>
                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                        {!isExpanded && (
                                                            <span className="text-[10px] text-muted-foreground/50">
                                                                {meal.items.length} {meal.items.length === 1 ? t('item') : t('items')}
                                                            </span>
                                                        )}
                                                        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isExpanded ? 'rotate-180' : ''}`} />
                                                    </div>
                                                </div>
                                                <div className="px-3 pb-2 flex gap-2 text-[11px]" dir="ltr">
                                                    <span className="text-muted-foreground/70">{Math.round(mealTotals.calories)} {t('kcal')}</span>
                                                    <span className="text-primary/80">{macro(t('carbsAbbr'), Math.round(mealTotals.carbs))}</span>
                                                    <span className="text-amber-500/80">{macro(t('fatAbbr'), Math.round(mealTotals.fats))}</span>
                                                    <span className="text-orange-500/80">{macro(t('proteinAbbr'), Math.round(mealTotals.protein))}</span>
                                                </div>
                                            </button>

                                            {/* Expandable body */}
                                            {isExpanded && (
                                                <Card.Content className="px-3 pb-2 pt-0 bg-secondary/10 rounded-b-xl">
                                                    {meal.note && (
                                                        <div className="border-s-2 border-amber-500/60 ps-3 mb-3">
                                                            <p dir="auto" className="text-xs text-muted-foreground">{meal.note}</p>
                                                        </div>
                                                    )}

                                                    <div className="flex flex-col divide-y divide-border">
                                                        {meal.items.map(item => {
                                                            const it      = calcItem(item);
                                                            const checked = checkedItems.has(item.id);
                                                            return (
                                                                <div key={item.id} className={`py-2 transition-opacity ${checked ? 'opacity-40' : ''}`}>
                                                                    <div className="flex items-start gap-2">
                                                                        <button
                                                                            onClick={() => toggleItem(item.id)}
                                                                            className={`shrink-0 mt-0.5 w-4 h-4 rounded border transition-colors cursor-pointer flex items-center justify-center ${
                                                                                checked ? 'bg-primary border-primary' : 'border-border hover:border-primary'
                                                                            }`}
                                                                        >
                                                                            {checked && <Check className="w-2.5 h-2.5 text-primary-foreground" />}
                                                                        </button>
                                                                        <div className="flex flex-1 items-start justify-between gap-2 min-w-0">
                                                                            <div className="flex flex-col min-w-0">
                                                                                <span dir="auto" className={`text-xs font-medium text-foreground truncate ${checked ? 'line-through' : ''}`}>{item.name}</span>
                                                                                <span dir="ltr" className="text-[11px] text-muted-foreground">{item.amount}{item.serving_unit}</span>
                                                                            </div>
                                                                            <div className="flex flex-col items-end rtl:items-start text-[11px] shrink-0" dir="ltr">
                                                                                <span className="text-muted-foreground">{Math.round(it.calories)} {t('kcal')}</span>
                                                                                <div className="flex gap-1">
                                                                                    <span className="text-primary">{macro(t('carbsAbbr'), Math.round(it.carbs))}</span>
                                                                                    <span className="text-amber-500">{macro(t('fatAbbr'), Math.round(it.fats))}</span>
                                                                                    <span className="text-orange-500">{macro(t('proteinAbbr'), Math.round(it.protein))}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    {item.alternatives?.length > 0 && (
                                                                        <div className="mt-2 ms-7 ps-3 border-s-2 border-border">
                                                                            <span className="text-[10px] text-muted-foreground/50 mb-0.5 block">{t('alternatives')}</span>
                                                                            {item.alternatives.map(alt => (
                                                                                <div key={alt.id} className="flex flex-col py-1">
                                                                                    <span dir="auto" className="text-xs text-foreground">{alt.name}</span>
                                                                                    <span dir="ltr" className="text-xs text-muted-foreground">{alt.amount}{alt.serving_unit}</span>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            );
                                                        })}
                                                    </div>
                                                </Card.Content>
                                            )}
                                        </Card>
                                    );
                                })}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Floating shopping list trigger — visible when a plan is loaded */}
            {plan && !noplan && (
                <button
                    onClick={() => setShowShoppingList(true)}
                    className="fixed left-1/2 -translate-x-1/2 flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground rounded-full shadow-lg text-sm font-semibold cursor-pointer hover:opacity-90 active:scale-95 transition-all"
                    style={{ bottom: '4.5rem', zIndex: 30 }}
                >
                    <ShoppingCart className="w-4 h-4" />
                    {tShopping('button')}
                </button>
            )}

            <ShoppingListDrawer
                plan={plan}
                isOpen={showShoppingList}
                onClose={() => setShowShoppingList(false)}
            />
        </div>
    );
}
