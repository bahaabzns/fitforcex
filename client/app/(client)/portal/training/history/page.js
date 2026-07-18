"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import { ChevronLeft, Dumbbell, LineChart as LineChartIcon } from "lucide-react";
import { Card } from "@heroui/react/card";
import { Skeleton } from "@heroui/react/skeleton";
import { formatDuration } from "@/utils/workout";
import { useDateFormatter } from "@/utils/useDateFormatter";
import { usePageTitle } from "@/hooks/usePageTitle";

export default function TrainingHistoryPage() {
    const t = useTranslations("portal.training");
    usePageTitle(t('workoutHistoryTitle'));
    const { formatDate } = useDateFormatter();
    const router = useRouter();

    const [logs, setLogs]       = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        api.get("/api/client-portal/workout-logs")
            .then(res => setLogs(res.data ?? []))
            .catch(() => router.replace("/portal/training"))
            .finally(() => setLoading(false));
    }, [router]);

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto p-6 flex flex-col gap-4">
                <Skeleton className="h-8 w-40 rounded-lg" />
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto px-6 pt-5 pb-6 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <Link href="/portal/training" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
                    <ChevronLeft className="w-4 h-4" /> {t("backToPlan")}
                </Link>
                <Link href="/portal/training/progress" className="flex items-center gap-1 text-sm text-primary hover:opacity-80">
                    <LineChartIcon className="w-4 h-4" /> {t("progress")}
                </Link>
            </div>

            <h1 className="text-2xl font-bold text-foreground">{t("history")}</h1>

            {logs.length === 0 ? (
                <Card>
                    <Card.Content className="p-6 flex flex-col items-center justify-center py-16 gap-3 text-center">
                        <Dumbbell className="w-12 h-12 text-muted-foreground/30" />
                        <p className="text-base font-medium text-muted-foreground">{t("noLogs")}</p>
                        <p className="text-sm text-muted-foreground/70">{t("noLogsHint")}</p>
                    </Card.Content>
                </Card>
            ) : (
                <div className="flex flex-col gap-3">
                    {logs.map(log => (
                        <Link key={log.id} href={`/portal/training/history/${log.id}`}>
                            <Card className="hover:border-primary/40 transition-colors cursor-pointer">
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
                                </Card.Content>
                            </Card>
                        </Link>
                    ))}
                </div>
            )}
        </div>
    );
}
