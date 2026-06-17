"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import api from "@/lib/axios";
import { ChevronDown, Dumbbell } from "lucide-react";
import { Card } from "@heroui/react/card";
import { Skeleton } from "@heroui/react/skeleton";
import LineChart from "@/app/components/charts/LineChart";
import { formatDuration } from "@/utils/workout";

const METRICS = [
    { key: "top_weight",   labelKey: "metricWeight" },
    { key: "est_1rm",      labelKey: "metricOneRm" },
    { key: "total_volume", labelKey: "metricVolume" },
];

export default function ClientWorkoutLogsPage() {
    const t = useTranslations("workoutLogs");
    const locale = useLocale();
    const { id } = useParams();

    const [view, setView]       = useState("sessions");
    const [logs, setLogs]       = useState([]);
    const [loading, setLoading] = useState(true);

    const [expandedId, setExpandedId] = useState(null);
    const [details, setDetails]       = useState({}); // logId -> detail

    const [exercises, setExercises] = useState([]);
    const [selected, setSelected]   = useState(null);
    const [series, setSeries]       = useState([]);
    const [metric, setMetric]       = useState(METRICS[0].key);

    useEffect(() => {
        Promise.all([
            api.get(`/api/clients/${id}/workout-logs`),
            api.get(`/api/clients/${id}/logged-exercises`),
        ])
            .then(([logsRes, exRes]) => {
                setLogs(logsRes.data ?? []);
                const list = (exRes.data ?? []).map(ex => ({
                    key: ex.exercise_library_id || ex.name,
                    name: ex.name,
                    exercise_library_id: ex.exercise_library_id ?? null,
                    exercise_id: ex.exercise_id,
                }));
                setExercises(list);
                if (list.length > 0) setSelected(list[0]);
            })
            .catch(() => { /* surfaced by route error boundary if needed */ })
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => {
        if (!selected) return;
        api.get(`/api/clients/${id}/exercise-progress`, {
            params: { exercise_library_id: selected.exercise_library_id ?? undefined, exercise_id: selected.exercise_id },
        })
            .then(res => setSeries(res.data ?? []))
            .catch(() => setSeries([]));
    }, [id, selected]);

    function toggleExpand(logId) {
        if (expandedId === logId) { setExpandedId(null); return; }
        setExpandedId(logId);
        if (!details[logId]) {
            api.get(`/api/clients/${id}/workout-logs/${logId}`)
                .then(res => setDetails(prev => ({ ...prev, [logId]: res.data })))
                .catch(() => { /* ignore */ });
        }
    }

    const chartData = useMemo(() => series.map(point => ({
        label: new Date(point.date).toLocaleDateString(locale, { day: "numeric", month: "short" }),
        value: point[metric],
    })), [series, metric, locale]);

    function formatDate(value) {
        return new Date(value).toLocaleDateString(locale, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
    }

    if (loading) {
        return (
            <div className="flex flex-col gap-3">
                <Skeleton className="h-10 rounded-full w-64" />
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto flex flex-col gap-4">
            {/* View toggle */}
            <div className="flex gap-2">
                <button
                    onClick={() => setView("sessions")}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer ${view === "sessions" ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-default"}`}
                >
                    {t("sessions")}
                </button>
                <button
                    onClick={() => setView("progress")}
                    className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer ${view === "progress" ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-default"}`}
                >
                    {t("progress")}
                </button>
            </div>

            {view === "sessions" ? (
                logs.length === 0 ? (
                    <Card>
                        <Card.Content className="p-6 flex flex-col items-center justify-center py-16 gap-3 text-center">
                            <Dumbbell className="w-12 h-12 text-muted-foreground/30" />
                            <p className="text-base font-medium text-muted-foreground">{t("noLogs")}</p>
                        </Card.Content>
                    </Card>
                ) : (
                    <div className="flex flex-col gap-3 max-w-3xl">
                        {logs.map(log => (
                            <Card key={log.id}>
                                <button onClick={() => toggleExpand(log.id)} className="w-full text-start cursor-pointer">
                                    <Card.Content className="px-4 py-3 flex items-center gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="font-semibold text-sm text-foreground truncate">{log.day_name || t("workout")}</p>
                                            <p className="text-xs text-muted-foreground">{formatDate(log.date)}</p>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-muted-foreground tabular-nums shrink-0">
                                            <span>{formatDuration(log.duration_seconds)}</span>
                                            <span>{log.total_volume} {t("volumeUnit")}</span>
                                            <span>{log.total_sets} {t("setsShort")}</span>
                                        </div>
                                        <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${expandedId === log.id ? "rotate-180" : ""}`} />
                                    </Card.Content>
                                </button>

                                {expandedId === log.id && (
                                    <div className="px-4 pb-3 flex flex-col gap-3 border-t border-border pt-3">
                                        {!details[log.id] ? (
                                            <Skeleton className="h-16 rounded-lg" />
                                        ) : (
                                            (details[log.id].exercises ?? []).map((exercise, exIdx) => (
                                                <div key={exIdx} className="flex flex-col gap-1">
                                                    <span className="text-sm font-medium text-foreground">{exercise.name}</span>
                                                    <div className="grid grid-cols-4 gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
                                                        <span>{t("set")}</span><span>{t("weight")}</span><span>{t("repsShort")}</span><span>{t("rir")}</span>
                                                    </div>
                                                    <div className="flex flex-col divide-y divide-border">
                                                        {(exercise.sets ?? []).map((set, sIdx) => (
                                                            <div key={sIdx} className={`grid grid-cols-4 gap-2 py-1 text-sm ${set.completed ? "text-foreground" : "text-muted-foreground/50"}`}>
                                                                <span className="text-muted-foreground text-xs">{sIdx + 1}</span>
                                                                <span>{set.weight != null ? set.weight : "—"}</span>
                                                                <span>{set.reps != null ? set.reps : "—"}</span>
                                                                <span>{set.rir != null ? set.rir : "—"}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                    {exercise.note && <p dir="auto" className="text-xs text-muted-foreground italic">{exercise.note}</p>}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </Card>
                        ))}
                    </div>
                )
            ) : (
                exercises.length === 0 ? (
                    <Card>
                        <Card.Content className="p-6 text-center text-sm text-muted-foreground py-16">{t("noLogs")}</Card.Content>
                    </Card>
                ) : (
                    <div className="flex flex-col gap-4 max-w-3xl">
                        <div className="overflow-x-auto scrollbar-hide -mx-1 px-1">
                            <div className="flex gap-2 w-max">
                                {exercises.map(ex => (
                                    <button
                                        key={ex.key}
                                        onClick={() => setSelected(ex)}
                                        className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer ${selected?.key === ex.key ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground hover:bg-default"}`}
                                    >
                                        {ex.name}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex gap-2">
                            {METRICS.map(m => (
                                <button
                                    key={m.key}
                                    onClick={() => setMetric(m.key)}
                                    className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${metric === m.key ? "bg-secondary border-border text-foreground" : "border-transparent text-muted-foreground hover:bg-default"}`}
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
                    </div>
                )
            )}
        </div>
    );
}
