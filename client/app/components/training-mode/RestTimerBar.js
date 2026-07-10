"use client";

import { useTranslations } from "next-intl";
import { Button } from "@heroui/react/button";
import { ProgressBar } from "@heroui/react/progress-bar";
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
                <ProgressBar value={pct} size="sm" color={done ? "success" : "accent"} aria-label={t("rest")} className="gap-0">
                    <ProgressBar.Track>
                        <ProgressBar.Fill className="transition-[width] duration-1000 ease-linear" />
                    </ProgressBar.Track>
                </ProgressBar>
                <div className="flex items-center gap-3 px-4 py-2.5">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t("rest")}</span>
                    <span className={`text-lg font-bold tabular-nums ${done ? "text-success" : "text-foreground"}`}>
                        {done ? t("restDone") : formatClock(remaining)}
                    </span>
                    <div className="ms-auto flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={() => onAdd(15)}>+15s</Button>
                        <Button variant="primary" size="sm" onClick={onSkip}>{t("skip")}</Button>
                    </div>
                </div>
            </div>
        </div>
    );
}
