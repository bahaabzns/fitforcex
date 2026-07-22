"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { ClipboardList, Utensils, Dumbbell, CreditCard, ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@heroui/react/card";
import api from "@/lib/axios";
import { getLocalizedField } from "@/utils/localization";
import Typography from "@/app/components/Typography";

const KIND_ICON = {
    pending_form: ClipboardList,
    plan_update:  Utensils,
    subscription: CreditCard,
};

function iconFor(item) {
    if (item.kind === "plan_update" && item.href === "/portal/training") return Dumbbell;
    return KIND_ICON[item.kind] ?? ClipboardList;
}

// The server freezes title/subtitle as plain English strings at write time
// (notification titles, synthesized subscription copy) — there's no title_ar
// to read for these kinds, so the fixed set of known kind/href combinations
// is translated here instead. Only pending_form carries genuinely dynamic,
// coach-authored text, which is already localized via getLocalizedField.
function titleFor(item, t) {
    if (item.kind === "subscription") return t("subscriptionExpiringSoon");
    if (item.kind === "plan_update") {
        return item.href === "/portal/training" ? t("trainingPlanAssigned") : t("nutritionPlanAssigned");
    }
    return item.title_en;
}

function subtitleFor(item, t) {
    if (item.kind === "subscription") return t("renewNowSubtitle");
    if (item.kind === "pending_form") return t("checkinFormReady");
    if (item.kind === "plan_update") {
        return item.href === "/portal/training" ? t("newTrainingPlanSubtitle") : t("newNutritionPlanSubtitle");
    }
    return item.subtitle;
}

/**
 * "Needs your attention" strip for the client portal home page: pending
 * check-in forms, a coach's plan activation/restart, and a subscription in
 * its grace period. Reads GET /action-items, which already resolves each of
 * these from data other endpoints own — this component just renders it.
 * Hidden entirely when there's nothing to show.
 */
export default function ActionNeeded() {
    const [items, setItems]     = useState([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const t = useTranslations("portal.home");
    const locale = useLocale();
    const isRTL = locale === 'ar';

    useEffect(() => {
        api.get("/api/client-portal/action-items")
            .then(res => setItems(res.data ?? []))
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, []);

    if (loading || items.length === 0) return null;

    async function handleClick(item) {
        if (item.kind === "plan_update") {
            api.patch(`/api/client-portal/notifications/${item.id}/read`).catch(() => {});
        }
        if (/^https?:\/\//.test(item.href)) {
            window.open(item.href, "_blank", "noopener,noreferrer");
        } else {
            router.push(item.href);
        }
    }

    return (
        <section className="flex flex-col gap-2">
            <Typography as="h2" type="body-sm" weight="semibold" color="muted" className="uppercase tracking-wider">
                {t("actionNeeded")}
            </Typography>
            <div className="flex flex-col gap-1.5">
                {items.map(item => {
                    const Icon = iconFor(item);
                    const title = item.kind === "pending_form" ? getLocalizedField(item, "title", locale) : titleFor(item, t);
                    const subtitle = subtitleFor(item, t);
                    return (
                        <Card key={item.id} className="px-3 py-2 gap-0">
                            <Card.Content
                                className="flex flex-row items-center gap-2.5 cursor-pointer"
                                onClick={() => handleClick(item)}
                            >
                                <div className={`shrink-0 rounded-full p-1.5 ${item.kind === "subscription" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                                    <Icon size={14} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{title}</p>
                                    {subtitle && (
                                        <p className="text-xs text-muted-foreground truncate">{subtitle}</p>
                                    )}
                                </div>
                                {isRTL
                                    ? <ChevronLeft size={16} className="text-muted-foreground shrink-0" />
                                    : <ChevronRight size={16} className="text-muted-foreground shrink-0" />}
                            </Card.Content>
                        </Card>
                    );
                })}
            </div>
        </section>
    );
}
