"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import api from "@/lib/axios";
import { ChevronLeft, ChevronRight, Dumbbell, LineChart as LineChartIcon, Trash2 } from "lucide-react";
import { Card } from "@heroui/react/card";
import { Button } from "@heroui/react/button";
import { Modal } from "@heroui/react/modal";
import { Skeleton } from "@heroui/react/skeleton";
import { formatDuration } from "@/utils/workout";
import { useDateFormatter } from "@/utils/useDateFormatter";
import { usePageTitle } from "@/hooks/usePageTitle";
import TriggerInsightBannerGroup from "@/app/components/insights/TriggerInsightBannerGroup";
import NewFeatureTooltip from "@/app/components/NewFeatureTooltip";

export default function TrainingHistoryPage() {
    const t = useTranslations("portal.training");
    const tCommon = useTranslations("common");
    usePageTitle(t('workoutHistoryTitle'));
    const locale = useLocale();
    const isRTL = locale === 'ar';
    const { formatFullDateTime } = useDateFormatter();
    const router = useRouter();

    const [logs, setLogs]       = useState([]);
    const [loading, setLoading] = useState(true);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [deleting, setDeleting]         = useState(false);

    useEffect(() => {
        api.get("/api/client-portal/workout-logs")
            .then(res => setLogs(res.data ?? []))
            .catch(() => router.replace("/portal/training"))
            .finally(() => setLoading(false));
    }, [router]);

    async function confirmDelete() {
        setDeleting(true);
        try {
            await api.delete(`/api/client-portal/workout-logs/${deleteTarget.id}`);
            setLogs(prev => prev.filter(log => log.id !== deleteTarget.id));
            setDeleteTarget(null);
        } catch {
            window.alert(t("deleteLogFailed"));
        } finally {
            setDeleting(false);
        }
    }

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
                    {isRTL ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />} {t("backToPlan")}
                </Link>
                <Link href="/portal/training/progress" className="flex items-center gap-1 text-sm text-primary hover:opacity-80">
                    <LineChartIcon className="w-4 h-4" /> {t("progress")}
                </Link>
            </div>

            <h1 className="text-2xl font-bold text-foreground">{t("history")}</h1>

            <TriggerInsightBannerGroup
                basePath="/api/client-portal"
                events={["first_workout_logged", "workout_logs_10x"]}
            />

            {logs.length === 0 ? (
                <Card>
                    <Card.Content className="p-6 flex flex-col items-center justify-center py-16 gap-3 text-center">
                        <Dumbbell className="w-12 h-12 text-muted-foreground/30" />
                        <p className="text-base font-medium text-muted-foreground">{t("noLogs")}</p>
                        <p className="text-sm text-muted-foreground/70">{t("noLogsHint")}</p>
                    </Card.Content>
                </Card>
            ) : (
                <div className="flex flex-col gap-2">
                    {logs.map((log, idx) => (
                        <Card key={log.id} className="px-4 py-4 gap-0 hover:border-primary/40 transition-colors">
                            <Card.Content
                                className="flex flex-row items-center gap-3 cursor-pointer"
                                onClick={() => router.push(`/portal/training/history/${log.id}`)}
                            >
                                <div className="shrink-0 rounded-full p-2.5 bg-primary/10 text-primary">
                                    <Dumbbell size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{log.day_name || t("workout")}</p>
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">{formatFullDateTime(log.start_time || log.date)}</p>
                                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                                        {formatDuration(log.duration_seconds)} · {log.total_volume} {t("volumeUnit")} · {log.total_sets} {t("setsShort")}
                                    </p>
                                </div>
                                <span title={t("deleteLog")} onClick={(e) => e.stopPropagation()}>
                                    <NewFeatureTooltip
                                        featureKey="delete_log_hint"
                                        active={idx === 0}
                                        message={t("deleteLogHint")}
                                        dismissLabel={t("deleteLogHintDismiss")}
                                        badgeLabel={t("deleteLogNewFeature")}
                                        onTriggerClick={() => setDeleteTarget(log)}
                                        triggerClassName="shrink-0 w-8 h-8 flex items-center justify-center rounded-full text-muted-foreground hover:bg-default hover:text-danger transition-colors cursor-pointer"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </NewFeatureTooltip>
                                </span>
                                {isRTL
                                    ? <ChevronLeft size={16} className="text-muted-foreground shrink-0" />
                                    : <ChevronRight size={16} className="text-muted-foreground shrink-0" />}
                            </Card.Content>
                        </Card>
                    ))}
                </div>
            )}

            {/* Delete confirmation */}
            <Modal isOpen={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
                <Modal.Backdrop>
                    <Modal.Container className="max-w-sm">
                        <Modal.Dialog>
                            <Modal.Header>
                                <Modal.Heading>{t("deleteLog")}</Modal.Heading>
                                <Modal.CloseTrigger />
                            </Modal.Header>
                            <Modal.Body>
                                <p className="text-sm text-muted-foreground">{t("deleteLogConfirm")}</p>
                            </Modal.Body>
                            <Modal.Footer className="flex justify-end gap-2 pt-2">
                                <Button size="sm" variant="ghost" onClick={() => setDeleteTarget(null)}>
                                    {tCommon("cancel")}
                                </Button>
                                <Button size="sm" variant="danger" onClick={confirmDelete} isDisabled={deleting}>
                                    {t("deleteLog")}
                                </Button>
                            </Modal.Footer>
                        </Modal.Dialog>
                    </Modal.Container>
                </Modal.Backdrop>
            </Modal>
        </div>
    );
}
