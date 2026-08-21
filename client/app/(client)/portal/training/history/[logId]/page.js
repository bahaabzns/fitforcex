"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import api from "@/lib/axios";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@heroui/react/card";
import { Skeleton } from "@heroui/react/skeleton";
import { formatDuration, formatClock } from "@/utils/workout";
import { loggedFieldsFor } from "@/utils/exerciseTrackingTypes";
import { useDateFormatter } from "@/utils/useDateFormatter";
import { usePageTitle } from "@/hooks/usePageTitle";

// tracking_type + tracked_metrics are snapshotted onto each logged exercise
// at submission time (see loggedExerciseSchema in clientPortal.controller.ts)
// so history always renders what was actually prescribed then, even if the
// coach later changes the catalog exercise's type/metrics. History only ever
// shows loggedFieldsFor — tempo/rir/rpe are prescribed *targets*, and a
// completed log has no "prescribed" data to show a target from, only what
// was actually logged.
const FIELD_LABEL_KEY = { weight: "weight", reps: "repsShort", duration_seconds: "duration", distance_km: "distance", incline_percent: "incline", speed_kmh: "speed" };
function formatFieldValue(field, value) {
    if (value == null) return "—";
    return field === "duration_seconds" ? formatClock(value) : String(value);
}
// Total columns = "Set" + fields.length; every value column is equal-width,
// so grid-cols-N (a standard Tailwind utility, safe to select dynamically —
// unlike arbitrary bracket values) is all that's needed, indexed by count.
const HISTORY_GRID_COLS_BY_TOTAL = ["grid-cols-1", "grid-cols-2", "grid-cols-3", "grid-cols-4", "grid-cols-5"];

export default function WorkoutLogDetailPage() {
    const t = useTranslations("portal.training");
    const locale = useLocale();
    const isRTL = locale === 'ar';
    const { formatDate } = useDateFormatter();
    const router = useRouter();
    const { logId } = useParams();

    const [log, setLog]         = useState(null);
    usePageTitle(log?.day_name || t('workout'));
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get(`/api/client-portal/workout-logs/${logId}`)
            .then(res => setLog(res.data))
            .catch(() => router.replace("/portal/training/history"))
            .finally(() => setLoading(false));
    }, [logId, router]);

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto p-6 flex flex-col gap-4">
                <Skeleton className="h-8 w-48 rounded-lg" />
                <Skeleton className="h-40 rounded-xl" />
            </div>
        );
    }
    if (!log) return null;

    const formattedDate = formatDate(log.date);

    return (
        <div className="max-w-4xl mx-auto px-6 pt-5 pb-6 flex flex-col gap-4">
            <Link href="/portal/training/history" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />} {t("history")}
            </Link>

            <div>
                <h1 className="text-2xl font-bold text-foreground">{log.day_name || t("workout")}</h1>
                <p className="text-sm text-muted-foreground">{formattedDate}</p>
                <div className="flex items-center gap-4 text-xs text-muted-foreground tabular-nums mt-1">
                    <span>{formatDuration(log.duration_seconds)}</span>
                    <span>{log.total_volume} {t("volumeUnit")}</span>
                    <span>{log.total_sets} {t("setsShort")}</span>
                </div>
            </div>

            {(log.exercises ?? []).map((exercise, exIdx) => {
                const fields = loggedFieldsFor(exercise);
                // index = fields.length: total columns = "Set" (1) + fields.length,
                // and HISTORY_GRID_COLS_BY_TOTAL[0] is already "grid-cols-1" (Set only).
                const gridCols = HISTORY_GRID_COLS_BY_TOTAL[fields.length] ?? HISTORY_GRID_COLS_BY_TOTAL[HISTORY_GRID_COLS_BY_TOTAL.length - 1];
                return (
                <Card key={exIdx}>
                    <Card.Content className="px-4 py-3 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary">#{exIdx + 1}</span>
                            <span className="font-semibold text-sm text-foreground">
                                {(isRTL && exercise.library_name_ar) || exercise.library_name_en || exercise.name}
                            </span>
                        </div>

                        <div className={`grid ${gridCols} gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60`}>
                            <span>{t("set")}</span>
                            {fields.map((field) => <span key={field}>{t(FIELD_LABEL_KEY[field])}</span>)}
                        </div>
                        <div className="flex flex-col divide-y divide-border">
                            {(exercise.sets ?? []).map((set, sIdx) => (
                                <div key={sIdx} className={`grid ${gridCols} gap-2 py-1.5 text-sm ${set.completed ? "text-foreground" : "text-muted-foreground/50"}`}>
                                    <span className="text-muted-foreground text-xs">{sIdx + 1}</span>
                                    {fields.map((field) => <span key={field}>{formatFieldValue(field, set[field])}</span>)}
                                </div>
                            ))}
                        </div>

                        {exercise.note && <p dir="auto" className="text-xs text-muted-foreground italic">{exercise.note}</p>}
                    </Card.Content>
                </Card>
                );
            })}
        </div>
    );
}
