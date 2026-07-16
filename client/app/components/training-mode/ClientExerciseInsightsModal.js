"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Modal } from "@heroui/react/modal";
import { ScrollShadow } from "@/app/components/ScrollShadow";
import { Chip } from "@heroui/react/chip";
import { Spinner } from "@heroui/react/spinner";
import LineChart from "@/app/components/charts/LineChart";
import api from "@/lib/axios";
import { useDateFormatter } from "@/utils/useDateFormatter";

const METRICS = [
    { key: "top_weight",   labelKey: "metricWeight" },
    { key: "est_1rm",      labelKey: "metricOneRm" },
    { key: "total_volume", labelKey: "metricVolume" },
];

function SectionLabel({ children }) {
    return <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">{children}</p>;
}

// Client-portal counterpart to the coach's ExerciseInsightsModal — same shared
// stats service (see server exercise-insights route), scoped to the logged-in
// client's own data. Trimmed to what a client should see: no coach-only
// insight cards, observations, or workspace-role checks.
export default function ClientExerciseInsightsModal({ open, onClose, exercise }) {
    const t = useTranslations("portal.training");
    const { formatDate } = useDateFormatter();

    const [insights, setInsights] = useState(null);
    const [loading, setLoading]   = useState(false);
    const [error, setError]       = useState(false);
    const [metric, setMetric]     = useState(METRICS[0].key);

    useEffect(() => {
        if (!open || !exercise) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reset before the fetch below re-populates; same pattern as ExerciseInsightsModal.js
        setLoading(true);
        setError(false);
        setInsights(null);
        setMetric(METRICS[0].key);

        const params = {};
        if (exercise.exercise_library_id) params.exercise_library_id = exercise.exercise_library_id;
        else params.exercise_id = exercise.exercise_id;

        api.get("/api/client-portal/workout-logs/exercise-insights", { params })
            .then(({ data }) => setInsights(data))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [open, exercise]);

    const chartData = (insights?.progressPoints ?? []).map(p => ({
        label: formatDate(p.date),
        value: p[metric],
    }));

    const pr = insights?.personalRecords ?? null;
    const prChips = pr ? [
        { label: t("metricWeight"),    value: pr.heaviest_weight ? `${pr.heaviest_weight.value} ${t("volumeUnit")}` : null },
        { label: t("prBestSet"),       value: pr.best_set ? `${pr.best_set.weight} ${t("volumeUnit")} × ${pr.best_set.reps}${pr.best_set.rir != null ? ` · ${t("rir")} ${pr.best_set.rir}` : ""}` : null },
        { label: t("prHighestVolume"), value: pr.highest_volume ? `${Math.round(pr.highest_volume.value).toLocaleString()} ${t("volumeUnit")}` : null },
        { label: t("metricOneRm"),     value: pr.est_1rm ? `${pr.est_1rm.value} ${t("volumeUnit")}` : null },
    ].filter(c => c.value !== null) : [];

    const isEmpty = !loading && !error && insights && (insights.progressPoints ?? []).length === 0;

    return (
        <Modal isOpen={open} onOpenChange={(o) => !o && onClose()}>
            <Modal.Backdrop>
                <Modal.Container className="max-w-2xl w-full">
                    <Modal.Dialog>
                        <Modal.Header>
                            <Modal.Heading>{exercise?.name ?? t("progress")}</Modal.Heading>
                            <Modal.CloseTrigger />
                        </Modal.Header>
                        <Modal.Body>
                            <ScrollShadow className="max-h-[75vh]" hideScrollBar>
                                <div className="flex flex-col gap-5 pb-2">
                                    {loading && (
                                        <div className="flex items-center justify-center py-16">
                                            <Spinner size="lg" />
                                        </div>
                                    )}

                                    {!loading && error && (
                                        <p className="text-center text-sm text-muted-foreground py-12">{t("insightsLoadError")}</p>
                                    )}

                                    {isEmpty && (
                                        <p className="text-center text-sm text-muted-foreground py-12">{t("noLogsForExercise")}</p>
                                    )}

                                    {!loading && !error && insights && !isEmpty && (
                                        <>
                                            {/* Metric toggle + chart */}
                                            <div className="flex flex-col gap-3">
                                                <div className="flex gap-1 p-1 rounded-lg bg-default/60">
                                                    {METRICS.map(m => (
                                                        <button
                                                            key={m.key}
                                                            onClick={() => setMetric(m.key)}
                                                            className={`flex-1 text-xs font-semibold py-1.5 px-2 rounded-md transition-colors cursor-pointer ${
                                                                metric === m.key
                                                                    ? "bg-background text-foreground shadow-sm"
                                                                    : "text-muted-foreground hover:text-foreground"
                                                            }`}
                                                        >
                                                            {t(m.labelKey)}
                                                        </button>
                                                    ))}
                                                </div>
                                                <LineChart data={chartData} height={200} valueLabel={t("volumeUnit")} formatValue={(v) => v} />
                                            </div>

                                            {/* Personal Records */}
                                            {prChips.length > 0 && (
                                                <div>
                                                    <SectionLabel>{t("personalRecords")}</SectionLabel>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {prChips.map(chip => (
                                                            <div key={chip.label} className="p-3 rounded-xl bg-app-surface-card">
                                                                <p className="text-xs text-muted-foreground">{chip.label}</p>
                                                                <p className="text-sm font-semibold text-foreground truncate">{chip.value}</p>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Workout History */}
                                            {insights.recentSessions?.length > 0 && (
                                                <div>
                                                    <SectionLabel>{t("workoutHistoryTitle")}</SectionLabel>
                                                    <div className="flex flex-col">
                                                        {insights.recentSessions.map((session, i) => (
                                                            <div key={i} className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-default/40 transition-colors">
                                                                <p className="text-sm text-muted-foreground">{formatDate(session.date)}</p>
                                                                {session.best_set ? (
                                                                    <div className="flex items-center gap-2">
                                                                        <p className="text-sm font-semibold text-foreground">
                                                                            {session.best_set.weight} {t("volumeUnit")} × {session.best_set.reps}
                                                                        </p>
                                                                        {session.best_set.rir != null && (
                                                                            <Chip size="sm" variant="soft">{t("rir")} {session.best_set.rir}</Chip>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <p className="text-sm text-muted-foreground">—</p>
                                                                )}
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
