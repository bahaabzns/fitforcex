"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Surface } from "@heroui/react";
import api from "@/lib/axios";
import { normalizePlan } from "@/hooks/useTrainingPlan";
import LeftPanel from "@/app/components/training/LeftPanel";
import MiddlePanel from "@/app/components/training/MiddlePanel";
import RightPanel from "@/app/components/training/RightPanel";
import ThreePanelLayout from "./ThreePanelLayout";
import { AsyncSection, sortPlans, useQuickViewFetch } from "./shared";

function HintSurface({ children }) {
    return (
        <Surface variant="default" className="w-full flex flex-col overflow-hidden flex-1 p-4 rounded-2xl">
            <p className="text-muted-foreground text-sm text-center flex justify-center items-center h-full">{children}</p>
        </Surface>
    );
}

/** The coach's training builder (plans → days → exercises and sets), view-only. */
export default function TrainingTab({ clientId }) {
    const t = useTranslations("training");
    const tQuickView = useTranslations("clientQuickView");
    const [pickedPlanId, setPickedPlanId] = useState(null);
    const [selectedDayId, setSelectedDayId] = useState(null);
    const [sortOrder, setSortOrder] = useState("created_desc");

    const load = useCallback(async () => {
        const { data: summaries } = await api.get(`/api/training/plans?clientId=${clientId}`);
        return Promise.all(
            (summaries ?? []).map(async (plan) => {
                const { data: detail } = await api.get(`/api/training/plans/${plan.id}`);
                return normalizePlan(detail);
            })
        );
    }, [clientId]);
    const { data: plans, loading, error, reload } = useQuickViewFetch(load);

    const sortedPlans = useMemo(() => sortPlans(plans ?? [], sortOrder), [plans, sortOrder]);
    // Open on the plan the client is following, like a coach would want.
    const selectedPlan = sortedPlans.find((p) => String(p.id) === String(pickedPlanId))
        ?? sortedPlans.find((p) => p.status === "active")
        ?? null;
    const selectedDay = selectedPlan?.days?.find((d) => String(d.id) === String(selectedDayId)) ?? null;

    return (
        <AsyncSection loading={loading} error={error} onRetry={reload} isEmpty={!!plans && plans.length === 0} emptyTitle={tQuickView("noTrainingPlans")}>
            <ThreePanelLayout
                hasMiddle={!!selectedPlan}
                hasRight={!!selectedDay}
                onCloseRight={() => setSelectedDayId(null)}
                left={({ goToStep }) => (
                    <LeftPanel
                        readOnly
                        plans={sortedPlans}
                        selectedPlan={selectedPlan}
                        handleSelectedPlan={(plan) => {
                            setPickedPlanId(plan.id);
                            setSelectedDayId(null);
                            goToStep(1);
                        }}
                        sortOrder={sortOrder}
                        setSortOrder={setSortOrder}
                        clientId={clientId}
                    />
                )}
                middle={({ goToStep }) => selectedPlan ? (
                    <MiddlePanel
                        readOnly
                        selectedPlan={selectedPlan}
                        selectedDayId={selectedDayId}
                        handleSelectDay={(dayId) => {
                            setSelectedDayId(dayId);
                            goToStep(2);
                        }}
                        focusPlanNameSignal={0}
                    />
                ) : (
                    <HintSurface>{t("selectPlanHint")}</HintSurface>
                )}
                right={() => (
                    <RightPanel
                        readOnly
                        selectedDay={selectedDay}
                        clientId={clientId}
                        planName={selectedPlan?.name}
                    />
                )}
            />
        </AsyncSection>
    );
}
