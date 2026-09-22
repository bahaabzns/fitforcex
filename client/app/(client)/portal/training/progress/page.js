"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import api from "@/lib/axios";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@heroui/react/card";
import { Skeleton } from "@heroui/react/skeleton";
import LineChart from "@/app/components/charts/LineChart";
import { usePageTitle } from "@/hooks/usePageTitle";

const METRICS = [
    { key: "top_weight",   labelKey: "metricWeight",  unitKey: "volumeUnit" },
    { key: "est_1rm",      labelKey: "metricOneRm",   unitKey: "volumeUnit" },
    { key: "total_volume", labelKey: "metricVolume",  unitKey: "volumeUnit" },
];

export default function TrainingProgressPage() {
    const t = useTranslations("portal.training");
    usePageTitle(t('progress'));
    const locale = useLocale();
    const isRTL = locale === 'ar';
    const router = useRouter();

    const [exercises, setExercises] = useState([]);   // unique plan exercises
    const [selected, setSelected]   = useState(null);
    const [series, setSeries]       = useState([]);
    const [metric, setMetric]       = useState(METRICS[0].key);
    const [loading, setLoading]     = useState(true);

    // Build the exercise picker from everything the client has actually logged.
    useEffect(() => {
        api.get("/api/client-portal/workout-logs/exercises")
            .then(res => {
                const list = (res.data ?? []).map(ex => ({
                    key: ex.exercise_library_id || ex.name,
                    name: ex.name,
                    exercise_library_id: ex.exercise_library_id ?? null,
                    exercise_id: ex.exercise_id,
                }));
                setExercises(list);
                if (list.length > 0) setSelected(list[0]);
            })
            .catch(() => router.replace("/portal/training"))
            .finally(() => setLoading(false));
    }, [router]);

    // Load the progress series for the selected exercise.
    useEffect(() => {
        if (!selected) return;
        let active = true;
        api.get("/api/client-portal/workout-logs/exercise-progress", {
            params: { exercise_library_id: selected.exercise_library_id ?? undefined, exercise_id: selected.exercise_id },
        })
            .then(res => { if (active) setSeries(res.data ?? []); })
            .catch(() => { if (active) setSeries([]); });
        return () => { active = false; };
    }, [selected]);

    const chartData = useMemo(() => series.map(point => ({
        label: new Date(point.date).toLocaleDateString(locale, { day: "numeric", month: "short" }),
        value: point[metric],
    })), [series, metric, locale]);

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto p-6 flex flex-col gap-4">
                <Skeleton className="h-8 w-40 rounded-lg" />
                <Skeleton className="h-10 rounded-full" />
                <Skeleton className="h-56 rounded-xl" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-6 pt-5 pb-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <Link href="/portal/training/history" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />} {t("history")}
                </Link>
            </div>

            <h1 className="text-2xl font-bold text-foreground">{t("progress")}</h1>

            {exercises.length === 0 ? (
                <Card>
                    <Card.Content className="p-6 text-center text-sm text-muted-foreground py-16">{t("noExercisesForProgress")}</Card.Content>
                </Card>
            ) : (
                <>
                    {/* Exercise picker */}
                    <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
                        <div className="flex gap-2 w-max">
                            {exercises.map(ex => (
                                <button
                                    key={ex.key}
                                    onClick={() => setSelected(ex)}
                                    className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
                                        selected?.key === ex.key ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-default"
                                    }`}
                                >
                                    {ex.name}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Metric toggle */}
                    <div className="flex gap-2">
                        {METRICS.map(m => (
                            <button
                                key={m.key}
                                onClick={() => setMetric(m.key)}
                                className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
                                    metric === m.key ? "bg-secondary border-border text-foreground" : "border-transparent text-muted-foreground hover:bg-default"
                                }`}
                            >
                                {t(m.labelKey)}
                            </button>
                        ))}
                    </div>

                    <Card>
                        <Card.Content className="px-4 py-4">
                            {chartData.length === 0 ? (
                                <p className="text-center text-sm text-muted-foreground py-20">{t("noLogsForExercise")}</p>
                            ) : (
                                <LineChart data={chartData} valueLabel={t("volumeUnit")} formatValue={(v) => v} />
                            )}
                        </Card.Content>
                    </Card>
                </>
            )}
        </div>
    );
}
