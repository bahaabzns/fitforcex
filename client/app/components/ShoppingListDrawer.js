"use client";

import { useEffect, useMemo, useState } from "react";
import { ShoppingCart, X, Minus, Plus } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";

function buildShoppingList(cycles, cycleDays, isRTL) {
    const totals = {};
    for (const cycle of cycles) {
        const days = cycleDays[cycle.id] ?? 0;
        if (days === 0) continue;
        for (const meal of (cycle.meals ?? [])) {
            for (const item of (meal.items ?? [])) {
                const name = (isRTL && item.name_ar) || item.name || item.name_ar || '';
                const key = `${name}||${item.serving_unit}`;
                if (!totals[key]) {
                    totals[key] = { name, serving_unit: item.serving_unit, amount: 0 };
                }
                totals[key].amount += item.amount * days;
            }
        }
    }
    return Object.values(totals).sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    );
}

export default function ShoppingListDrawer({ plan, isOpen, onClose }) {
    const t = useTranslations('portal.shoppingList');
    const isRTL = useLocale() === 'ar';

    const [cycleDays, setCycleDays] = useState({});

    useEffect(() => {
        if (!plan?.cycles) return;
        setCycleDays(prev => {
            const next = {};
            for (const cycle of plan.cycles) {
                next[cycle.id] = prev[cycle.id] ?? 1;
            }
            return next;
        });
    }, [plan]);

    useEffect(() => {
        document.body.style.overflow = isOpen ? 'hidden' : '';
        return () => { document.body.style.overflow = ''; };
    }, [isOpen]);

    function adjustDays(cycleId, delta) {
        setCycleDays(prev => ({
            ...prev,
            [cycleId]: Math.max(0, Math.min(14, (prev[cycleId] ?? 1) + delta)),
        }));
    }

    const shoppingList = useMemo(
        () => (plan?.cycles ? buildShoppingList(plan.cycles, cycleDays, isRTL) : []),
        [plan, cycleDays, isRTL]
    );

    if (!plan) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className={`fixed inset-0 bg-black/50 transition-opacity duration-300 ${
                    isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
                }`}
                style={{ zIndex: 55 }}
                onClick={onClose}
            />

            {/* Drawer panel */}
            <div
                className={`fixed bottom-0 left-0 right-0 bg-background rounded-t-3xl shadow-xl transition-transform duration-300 ease-out flex flex-col max-h-[85dvh] ${
                    isOpen ? 'translate-y-0' : 'translate-y-full'
                }`}
                style={{ zIndex: 60 }}
            >
                {/* Handle + header */}
                <div className="shrink-0 flex flex-col items-center px-6 pt-3 pb-3 border-b border-border">
                    <div className="w-10 h-1 rounded-full bg-border mb-3" />
                    <div className="w-full flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5 text-primary" />
                            <h2 className="text-base font-bold text-foreground">{t('title')}</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-1.5 rounded-full hover:bg-secondary transition-colors cursor-pointer"
                        >
                            <X className="w-4 h-4 text-muted-foreground" />
                        </button>
                    </div>
                </div>

                {/* Scrollable body */}
                <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-6">

                    {/* Days per cycle */}
                    <div className="flex flex-col gap-2">
                        <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
                            {t('cyclesTitle')}
                        </span>
                        <div className="flex flex-col">
                            {plan.cycles.map(cycle => (
                                <div
                                    key={cycle.id}
                                    className="flex items-center justify-between gap-3 py-2.5 border-b border-border last:border-0"
                                >
                                    <span className="text-sm font-medium text-foreground truncate">{cycle.name}</span>
                                    <div className="flex items-center gap-2 shrink-0" dir="ltr">
                                        <button
                                            onClick={() => adjustDays(cycle.id, -1)}
                                            disabled={(cycleDays[cycle.id] ?? 1) === 0}
                                            className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <Minus className="w-3 h-3" />
                                        </button>
                                        <span className="w-7 text-center text-sm font-bold text-foreground tabular-nums">
                                            {cycleDays[cycle.id] ?? 1}
                                        </span>
                                        <button
                                            onClick={() => adjustDays(cycle.id, 1)}
                                            disabled={(cycleDays[cycle.id] ?? 1) >= 14}
                                            className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-muted-foreground hover:bg-secondary transition-colors cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                        >
                                            <Plus className="w-3 h-3" />
                                        </button>
                                        <span className="text-xs text-muted-foreground w-8">{t('days')}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Items to buy */}
                    <div className="flex flex-col gap-2">
                        <span className="text-[11px] font-semibold text-muted-foreground/60 uppercase tracking-widest">
                            {t('itemsTitle')}
                        </span>
                        {shoppingList.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-6">{t('empty')}</p>
                        ) : (
                            <div className="flex flex-col divide-y divide-border">
                                {shoppingList.map(item => {
                                    const display = parseFloat(item.amount.toFixed(1));
                                    return (
                                        <div
                                            key={`${item.name}||${item.serving_unit}`}
                                            className="flex items-center justify-between gap-3 py-2.5"
                                        >
                                            <span dir="auto" className="text-sm text-foreground">{item.name}</span>
                                            <span dir="ltr" className="text-sm font-semibold text-primary shrink-0 tabular-nums">
                                                {display}{item.serving_unit}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                </div>
            </div>
        </>
    );
}
