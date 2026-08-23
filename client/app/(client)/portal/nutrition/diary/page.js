"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import api from "@/lib/axios";
import { ChevronLeft, ChevronRight, ChevronDown, BookOpen } from "lucide-react";
import { Card } from "@heroui/react/card";
import { Skeleton } from "@heroui/react/skeleton";
import { useDateFormatter } from "@/utils/useDateFormatter";
import { usePageTitle } from "@/hooks/usePageTitle";
import { localizedFoodName } from "@/utils/foodLocalization";
import { adherenceColor } from "@/utils/adherence";

export default function FoodDiaryHistoryPage() {
    const t = useTranslations("portal.dashboard.foodDiary");
    const locale = useLocale();
    const isRTL = locale === 'ar';
    const { formatDate } = useDateFormatter();
    const router = useRouter();

    const [entries, setEntries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [expandedId, setExpandedId] = useState(null);

    useEffect(() => {
        api.get("/api/client-portal/food-diary/history")
            .then(res => setEntries(res.data ?? []))
            .catch(() => router.replace("/portal/nutrition"))
            .finally(() => setLoading(false));
    }, [router]);

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto p-6 flex flex-col gap-4">
                <Skeleton className="h-8 w-40 rounded-lg" />
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-6 pt-5 pb-6 flex flex-col gap-4">
            <Link href="/portal/nutrition" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />} {t("back")}
            </Link>

            <div>
                <h1 className="text-2xl font-bold text-foreground">{t("historyTitle")}</h1>
                <p className="text-sm text-muted-foreground mt-1">{t("historyDescription")}</p>
            </div>

            {entries.length === 0 ? (
                <Card>
                    <Card.Content className="p-6 flex flex-col items-center justify-center py-16 gap-3 text-center">
                        <BookOpen className="w-12 h-12 text-muted-foreground/30" />
                        <p className="text-sm text-muted-foreground">{t("noEntries")}</p>
                    </Card.Content>
                </Card>
            ) : (
                <div className="flex flex-col gap-2">
                    {entries.map((entry) => {
                        const isExpanded = expandedId === entry.id;
                        return (
                            <Card key={entry.id} className="px-4 py-3 gap-0">
                                <button
                                    onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                                    className="w-full flex items-center gap-3 cursor-pointer"
                                >
                                    <div className="flex-1 min-w-0 text-start">
                                        <p className="text-sm font-medium text-foreground">{formatDate(entry.date)}</p>
                                        <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">
                                            {Math.round(entry.total_calories)} {t("calories")}
                                        </p>
                                    </div>
                                    <div className={`text-sm font-semibold shrink-0 ${adherenceColor(entry.adherence)}`}>
                                        {entry.adherence !== null ? `${entry.adherence}%` : t("noGoalSet")}
                                    </div>
                                    <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                </button>

                                {isExpanded && (
                                    <div className="mt-3 pt-3 border-t border-border flex flex-col gap-3">
                                        <div className="grid grid-cols-4 gap-2 text-center" dir="ltr">
                                            {[
                                                [t("calories"), entry.total_calories, entry.goal_calories],
                                                [t("protein"), entry.total_protein, entry.goal_protein],
                                                [t("carbs"), entry.total_carbs, entry.goal_carbs],
                                                [t("fats"), entry.total_fats, entry.goal_fats],
                                            ].map(([label, value, goal]) => (
                                                <div key={label} className="flex flex-col">
                                                    <span className="text-[10px] text-muted-foreground/70 uppercase tracking-wide">{label}</span>
                                                    <span className="text-xs font-medium text-foreground">
                                                        {goal ? t("goalOf", { value: Math.round(value), goal }) : Math.round(value)}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="flex flex-col divide-y divide-border">
                                            {entry.items.map((item) => {
                                                const eaten = Number(item.amount_eaten) || 0;
                                                const prescribed = Number(item.prescribed_amount) || 0;
                                                const checked = prescribed > 0 && eaten >= prescribed;
                                                return (
                                                    <div key={item.meal_item_id} className={`py-1.5 flex items-center justify-between gap-2 ${checked ? '' : 'opacity-50'}`}>
                                                        <span dir="auto" translate="no" className="text-xs text-foreground truncate">
                                                            {localizedFoodName(item.name_en, item.name_ar, isRTL)}
                                                        </span>
                                                        <span dir="ltr" className="text-[11px] text-muted-foreground shrink-0">
                                                            {eaten}/{item.prescribed_amount}{item.serving_unit}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
