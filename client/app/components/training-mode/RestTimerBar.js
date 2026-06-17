"use client";

import { useTranslations } from "next-intl";
import { formatClock } from "@/utils/workout";

// Floating countdown shown after a set is marked done. Presentational only —
// the parent owns the timer and passes the remaining seconds.
export default function RestTimerBar({ remaining, target, onAdd, onSkip }) {
    const t = useTranslations("portal.training");
    const done = remaining <= 0;
    const pct  = target > 0 ? Math.max(0, Math.min(100, (remaining / target) * 100)) : 0;

    return (
        <div className="fixed inset-x-0 bottom-16 z-40 px-4 pointer-events-none">
            <div className="max-w-4xl mx-auto pointer-events-auto rounded-2xl border border-border bg-background shadow-lg overflow-hidden">
                <div className="h-1 bg-secondary">
                    <div
                        className={`h-full transition-[width] duration-1000 ease-linear ${done ? "bg-green-500" : "bg-primary"}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
                <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("rest")}</span>
                    <span className={`text-lg font-bold tabular-nums ${done ? "text-green-600" : "text-foreground"}`}>
                        {done ? t("restDone") : formatClock(remaining)}
                    </span>
                    <div className="ms-auto flex items-center gap-2">
                        <button
                            onClick={() => onAdd(15)}
                            className="rounded-full border border-border px-3 py-1 text-xs font-medium text-foreground hover:bg-default cursor-pointer"
                        >
                            +15s
                        </button>
                        <button
                            onClick={onSkip}
                            className="rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:opacity-90 cursor-pointer"
                        >
                            {t("skip")}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
