"use client";

import { useState, useEffect } from "react";
import { useLocale } from "next-intl";
import { getLocalizedField } from "@/utils/localization";
import { Modal } from "@heroui/react/modal";
import { ScrollShadow } from "@heroui/react/scroll-shadow";
import LineChart from "@/app/components/charts/LineChart";
import api from "@/lib/axios";

const DumbbellIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M6.5 6.5v11M17.5 6.5v11M4 9v6M20 9v6M6.5 12h11"/>
    </svg>
);

const METRICS = [
    { key: "est_1rm",      label: "Est. 1RM", field: "est_1rm",      unit: "kg",  fmt: v => v },
    { key: "top_weight",   label: "Weight",   field: "top_weight",   unit: "kg",  fmt: v => v },
    { key: "total_volume", label: "Volume",   field: "total_volume", unit: "kg",  fmt: v => Math.round(v).toLocaleString() },
    { key: "total_reps",   label: "Reps",     field: "total_reps",   unit: "reps", fmt: v => v },
];

function shortDate(dateStr, showYear = false) {
    const [y, m, d] = dateStr.split("-").map(Number);
    const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
    const thisYear = new Date().getFullYear();
    return showYear || y !== thisYear
        ? `${months[m - 1]} ${d}, ${y}`
        : `${months[m - 1]} ${d}`;
}

function daysAgo(dateStr) {
    const [ly, lm, ld] = dateStr.split("-").map(Number);
    const [ty, tm, td] = new Date().toISOString().slice(0, 10).split("-").map(Number);
    const days = Math.round((new Date(ty, tm - 1, td) - new Date(ly, lm - 1, ld)) / 86400000);
    if (days === 0) return "today";
    if (days === 1) return "yesterday";
    return `${days} days ago`;
}

function SectionLabel({ children }) {
    return (
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
            {children}
        </p>
    );
}

function buildInsightCards(ins) {
    if (!ins) return [];
    const cards = [];

    if (ins.strength_change_pct !== null) {
        const pct = ins.strength_change_pct;
        cards.push({
            icon: pct >= 0 ? "⬆️" : "⬇️",
            value: `${pct >= 0 ? "+" : ""}${pct}% strength`,
            label: `in last ${ins.strength_change_weeks} weeks`,
            trend: pct >= 0 ? "up" : "down",
        });
    }

    if (ins.total_sessions > 0) {
        cards.push({ icon: "🔥", value: `${ins.total_sessions} sessions`, label: "total logged" });
    }

    if (ins.is_plateau) {
        cards.push({ icon: "⚠️", value: "Plateau detected", label: `last ${ins.plateau_sessions_checked} workouts flat` });
    }

    if (ins.consistency_pct !== null) {
        cards.push({ icon: "📈", value: `${ins.consistency_pct}% consistency`, label: "last 8 weeks" });
    }

    return cards;
}

export default function ExerciseInsightsModal({ open, onClose, exercise, clientId, planName }) {
    const locale = useLocale();
    const [insights, setInsights] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [activeMetric, setActiveMetric] = useState("est_1rm");

    useEffect(() => {
        if (!open || !exercise || !clientId) return;
        setLoading(true);
        setError(false);
        setInsights(null);

        const params = new URLSearchParams();
        if (exercise.exercise_library_id) {
            params.set("exercise_library_id", exercise.exercise_library_id);
        } else {
            params.set("exercise_id", exercise.id);
        }

        api.get(`/api/clients/${clientId}/exercise-insights?${params}`)
            .then(({ data }) => setInsights(data))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [open, exercise?.id, clientId]);

    const exerciseName = exercise
        ? (getLocalizedField(exercise, "library_name", locale) || exercise.name || "")
        : "";
    const meta = exercise
        ? [exercise.muscle_group, exercise.equipment].filter(Boolean).join(" · ")
        : "";

    const metric     = METRICS.find(m => m.key === activeMetric) ?? METRICS[0];
    const chartData  = (insights?.progressPoints ?? []).map(p => ({
        label: shortDate(p.date),
        value: p[metric.field],
    }));

    const lastSession = insights?.recentSessions?.[0] ?? null;
    const pr          = insights?.personalRecords ?? null;
    const ins         = insights?.insights ?? null;
    const timeline    = insights?.timeline ?? null;
    const insightCards = buildInsightCards(ins);

    const prChips = pr ? [
        { icon: "🏆", label: "Heaviest Weight", value: pr.heaviest_weight ? `${pr.heaviest_weight.value} kg` : null },
        { icon: "🏆", label: "Best Set",         value: pr.best_set ? `${pr.best_set.weight} kg × ${pr.best_set.reps}` : null },
        { icon: "🏆", label: "Highest Volume",   value: pr.highest_volume ? `${Math.round(pr.highest_volume.value).toLocaleString()} kg` : null },
        { icon: "🏆", label: "Estimated 1RM",    value: pr.est_1rm ? `${pr.est_1rm.value} kg` : null },
    ].filter(c => c.value !== null) : [];

    return (
        <Modal isOpen={open} onOpenChange={(o) => !o && onClose()}>
            <Modal.Backdrop>
                <Modal.Container className="max-w-2xl w-full">
                    <Modal.Dialog>
                        <Modal.Header>
                            <Modal.Heading>{exerciseName || "Exercise Insights"}</Modal.Heading>
                            <Modal.CloseTrigger />
                        </Modal.Header>
                        <Modal.Body>
                            <ScrollShadow className="max-h-[80vh]" hideScrollBar>
                                <div className="flex flex-col gap-5 pb-2">

                                    {/* Exercise meta */}
                                    {(meta || exercise?.thumbnail_path) && (
                                        <div className="flex items-center gap-3 -mt-1">
                                            <div className="relative w-10 h-10 rounded-lg bg-foreground/10 flex items-center justify-center text-muted-foreground shrink-0 overflow-hidden">
                                                <DumbbellIcon />
                                                {exercise?.thumbnail_path && (
                                                    <img
                                                        src={exercise.thumbnail_path}
                                                        alt={exerciseName}
                                                        className="absolute inset-0 w-full h-full object-cover"
                                                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                                                    />
                                                )}
                                            </div>
                                            {meta && <p className="text-sm text-muted-foreground">{meta}</p>}
                                        </div>
                                    )}

                                    {/* Loading */}
                                    {loading && (
                                        <div className="flex items-center justify-center py-12">
                                            <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
                                        </div>
                                    )}

                                    {/* Error */}
                                    {!loading && error && (
                                        <p className="text-center text-sm text-muted-foreground py-12">
                                            Could not load insights — try again later.
                                        </p>
                                    )}

                                    {/* Content */}
                                    {!loading && !error && insights && (
                                    <>
                                        {/* No data */}
                                        {insights.progressPoints?.length === 0 && (
                                            <p className="text-center text-sm text-muted-foreground py-6">
                                                No sessions logged for this exercise yet.
                                            </p>
                                        )}

                                        {/* Last session banner */}
                                        {lastSession && (
                                            <div className="flex items-center justify-between px-4 py-3 rounded-xl bg-primary/10 border border-primary/20">
                                                <div>
                                                    <p className="text-xs text-muted-foreground">Last session</p>
                                                    <p className="text-sm font-semibold text-foreground">
                                                        {lastSession.best_set
                                                            ? `${lastSession.best_set.weight} kg × ${lastSession.best_set.reps} reps`
                                                            : "—"}
                                                    </p>
                                                </div>
                                                <p className="text-xs text-muted-foreground">{daysAgo(lastSession.date)}</p>
                                            </div>
                                        )}

                                        {/* Metric toggle + chart */}
                                        {insights.progressPoints?.length > 0 && (
                                            <div className="flex flex-col gap-3">
                                                <div className="flex gap-1 p-1 rounded-lg bg-default/60">
                                                    {METRICS.map(m => (
                                                        <button
                                                            key={m.key}
                                                            onClick={() => setActiveMetric(m.key)}
                                                            className={`flex-1 text-xs font-semibold py-1.5 px-2 rounded-md transition-colors cursor-pointer ${
                                                                activeMetric === m.key
                                                                    ? "bg-background text-foreground shadow-sm"
                                                                    : "text-muted-foreground hover:text-foreground"
                                                            }`}
                                                        >
                                                            {m.label}
                                                        </button>
                                                    ))}
                                                </div>
                                                <LineChart
                                                    data={chartData}
                                                    height={200}
                                                    formatValue={metric.fmt}
                                                    valueLabel={metric.unit}
                                                />
                                            </div>
                                        )}

                                        {/* Personal Records */}
                                        {prChips.length > 0 && (
                                            <div>
                                                <SectionLabel>Personal Records</SectionLabel>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {prChips.map(chip => (
                                                        <div key={chip.label} className="flex items-start gap-2 p-3 rounded-xl bg-app-surface-card">
                                                            <span className="text-base leading-none mt-0.5">{chip.icon}</span>
                                                            <div className="min-w-0">
                                                                <p className="text-xs text-muted-foreground">{chip.label}</p>
                                                                <p className="text-sm font-semibold text-foreground truncate">{chip.value}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Coach Insights */}
                                        {insightCards.length > 0 && (
                                            <div>
                                                <SectionLabel>Coach Insights</SectionLabel>
                                                <div className="grid grid-cols-2 gap-2">
                                                    {insightCards.map(card => (
                                                        <div key={card.label} className="flex items-start gap-2 p-3 rounded-xl bg-app-surface-card">
                                                            <span className="text-base leading-none mt-0.5">{card.icon}</span>
                                                            <div>
                                                                <p className={`text-sm font-semibold ${
                                                                    card.trend === "up" ? "text-emerald-500" :
                                                                    card.trend === "down" ? "text-destructive" :
                                                                    "text-foreground"
                                                                }`}>
                                                                    {card.value}
                                                                </p>
                                                                <p className="text-xs text-muted-foreground">{card.label}</p>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Workout History */}
                                        {insights.recentSessions?.length > 0 && (
                                            <div>
                                                <SectionLabel>Workout History</SectionLabel>
                                                <div className="flex flex-col">
                                                    {insights.recentSessions.map((session, i) => (
                                                        <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-default/40 transition-colors">
                                                            <p className="text-sm text-muted-foreground">{shortDate(session.date)}</p>
                                                            <p className="text-sm font-semibold text-foreground">
                                                                {session.best_set
                                                                    ? `${session.best_set.weight} × ${session.best_set.reps}`
                                                                    : "—"}
                                                            </p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* Timeline */}
                                        {timeline && timeline.total_sessions > 0 && (
                                            <div>
                                                <SectionLabel>Exercise Timeline</SectionLabel>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {[
                                                        {
                                                            label: "Started",
                                                            value: timeline.first_session_date
                                                                ? shortDate(timeline.first_session_date, true)
                                                                : "—",
                                                        },
                                                        { label: "Sessions",  value: `${timeline.total_sessions}` },
                                                        { label: "Program",   value: planName || "—" },
                                                    ].map(item => (
                                                        <div key={item.label} className="text-center p-3 rounded-xl bg-app-surface-card">
                                                            <p className="text-sm font-semibold text-foreground">{item.value}</p>
                                                            <p className="text-xs text-muted-foreground mt-0.5">{item.label}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                    )}
                                </div>
                            </ScrollShadow>
                        </Modal.Body>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
