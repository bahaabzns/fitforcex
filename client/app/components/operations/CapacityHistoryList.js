"use client";

import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { ScrollShadow } from "@heroui/react/scroll-shadow";
import { Skeleton } from "@heroui/react/skeleton";
import api from "@/lib/axios";
import { useDateFormatter } from "@/utils/useDateFormatter";
import { formatDaysOff, sameDaysOff } from "@/app/components/operations/weekdays";

// Every change to one person's daily limit or days off, newest first: when, who made it, and what
// changed, as a small timeline: one dot per change, the date and author on top, then one row per field
// ("Plans per day: 10 → 20"). Stacks cleanly on a phone. Used inside the edit sheet / modal.
export default function CapacityHistoryList({ userId, maxHeightClass = "max-h-60" }) {
    const t = useTranslations("operations");
    const locale = useLocale();
    const { formatDateTime } = useDateFormatter();
    const [entries, setEntries] = useState(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        let cancelled = false;
        api.get(`/api/operations/capacity/history/${userId}`)
            .then((res) => { if (!cancelled) setEntries(res.data); })
            .catch(() => { if (!cancelled) setError(true); });
        return () => { cancelled = true; };
    }, [userId]);

    const showLimit = (value) => (value === null ? t("capacityNotSet") : t("capacityPerDay", { count: value }));
    const showDaysOff = (days) => formatDaysOff(locale, days) || t("daysOffNone");

    if (error) return <p className="text-sm text-destructive">{t("historyLoadFailed")}</p>;
    if (entries === null) {
        return <div className="flex flex-col gap-2">{[1, 2].map((i) => <Skeleton key={i} className="h-10 rounded-lg" />)}</div>;
    }
    if (entries.length === 0) return <p className="text-sm text-muted-foreground">{t("historyEmpty")}</p>;

    // One "field: before → after" row; the arrow flips in right-to-left layouts.
    const changeRow = (label, before, after) => (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-lg bg-default/40 px-3 py-2 text-sm">
            <span className="text-xs font-medium text-muted-foreground">{label}</span>
            <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                <span className="text-muted-foreground">{before}</span>
                <ArrowRight size={13} className="shrink-0 text-muted-foreground rtl:rotate-180" aria-hidden="true" />
                <span className="font-semibold text-foreground">{after}</span>
            </span>
        </div>
    );

    return (
        <ScrollShadow className={`${maxHeightClass} overflow-x-hidden`}>
            <ul className="flex flex-col">
                {entries.map((entry, index) => (
                    <li key={entry.id} className={`relative min-w-0 ps-5 ${index === entries.length - 1 ? "" : "pb-4"}`}>
                        <span className="absolute start-0 top-1.5 size-2 rounded-full bg-primary" aria-hidden="true" />
                        {index !== entries.length - 1 && <span className="absolute start-[3.5px] top-4 bottom-0 w-px bg-border" aria-hidden="true" />}
                        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                            <p className="text-sm font-medium text-foreground">{formatDateTime(entry.changedAt)}</p>
                            {entry.changedByName && <p className="min-w-0 wrap-break-word text-xs text-muted-foreground">{t("historyBy", { name: entry.changedByName })}</p>}
                        </div>
                        <div className="mt-2 flex flex-col gap-1.5">
                            {entry.previousCapacity !== entry.newCapacity && changeRow(t("capacityLabel"), showLimit(entry.previousCapacity), showLimit(entry.newCapacity))}
                            {!sameDaysOff(entry.previousDaysOff, entry.newDaysOff) && changeRow(t("daysOffLabel"), showDaysOff(entry.previousDaysOff), showDaysOff(entry.newDaysOff))}
                        </div>
                    </li>
                ))}
            </ul>
        </ScrollShadow>
    );
}
