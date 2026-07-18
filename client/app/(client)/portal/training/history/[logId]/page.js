"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import { ChevronLeft } from "lucide-react";
import { Card } from "@heroui/react/card";
import { Skeleton } from "@heroui/react/skeleton";
import { formatDuration } from "@/utils/workout";
import { useDateFormatter } from "@/utils/useDateFormatter";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function WorkoutLogDetailPage() {
    const t = useTranslations("portal.training");
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
                <ChevronLeft className="w-4 h-4" /> {t("history")}
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

            {(log.exercises ?? []).map((exercise, exIdx) => (
                <Card key={exIdx}>
                    <Card.Content className="px-4 py-3 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-primary">#{exIdx + 1}</span>
                            <span className="font-semibold text-sm text-foreground">{exercise.name}</span>
                        </div>

                        <div className="grid grid-cols-4 gap-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground/60">
                            <span>{t("set")}</span>
                            <span>{t("weight")}</span>
                            <span>{t("repsShort")}</span>
                            <span>{t("rir")}</span>
                        </div>
                        <div className="flex flex-col divide-y divide-border">
                            {(exercise.sets ?? []).map((set, sIdx) => (
                                <div key={sIdx} className={`grid grid-cols-4 gap-2 py-1.5 text-sm ${set.completed ? "text-foreground" : "text-muted-foreground/50"}`}>
                                    <span className="text-muted-foreground text-xs">{sIdx + 1}</span>
                                    <span>{set.weight != null ? set.weight : "—"}</span>
                                    <span>{set.reps != null ? set.reps : "—"}</span>
                                    <span>{set.rir != null ? set.rir : "—"}</span>
                                </div>
                            ))}
                        </div>

                        {exercise.note && <p dir="auto" className="text-xs text-muted-foreground italic">{exercise.note}</p>}
                    </Card.Content>
                </Card>
            ))}
        </div>
    );
}
