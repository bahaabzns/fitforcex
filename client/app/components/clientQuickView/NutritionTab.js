"use client";

import { useCallback, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Surface } from "@heroui/react";
import api from "@/lib/axios";
import { hydratePlan } from "@/hooks/useNutritionPlan";
import LeftPanel from "@/app/components/nutrition/LeftPanel";
import MiddlePanel from "@/app/components/nutrition/MiddlePanel";
import RightPanel from "@/app/components/nutrition/RightPanel";
import ThreePanelLayout from "./ThreePanelLayout";
import { AsyncSection, NOOP, sortPlans, useQuickViewFetch } from "./shared";

function HintSurface({ children }) {
    return (
        <Surface variant="default" className="w-full flex flex-col overflow-hidden flex-1 p-4 rounded-2xl">
            <p className="text-muted-foreground text-sm text-center flex justify-center items-center h-full">{children}</p>
        </Surface>
    );
}

/** The coach's nutrition builder (plans → cycles/meals → foods), view-only. */
export default function NutritionTab({ clientId }) {
    const t = useTranslations("nutrition");
    const tQuickView = useTranslations("clientQuickView");
    const [pickedPlanId, setPickedPlanId] = useState(null);
    const [selectedCycleIndex, setSelectedCycleIndex] = useState(0);
    const [selectedMealId, setSelectedMealId] = useState(null);
    const [sortOrder, setSortOrder] = useState("created_desc");

    const load = useCallback(async () => {
        const { data: summaries } = await api.get(`/api/nutrition/plans?clientId=${clientId}`);
        return Promise.all(
            (summaries ?? []).map(async (plan) => {
                const { data: detail } = await api.get(`/api/nutrition/plans/${plan.id}`);
                return hydratePlan({ ...detail, cycle_count: detail?.cycles?.length ?? 0, last_edited_by_name: plan.last_edited_by_name });
            })
        );
    }, [clientId]);
    const { data: plans, loading, error, reload } = useQuickViewFetch(load);

    const sortedPlans = useMemo(() => sortPlans(plans ?? [], sortOrder), [plans, sortOrder]);
    // Open on the plan the client is following, like a coach would want.
    const selectedPlan = sortedPlans.find((p) => String(p.id) === String(pickedPlanId))
        ?? sortedPlans.find((p) => p.status === "active")
        ?? null;
    const cycleIndex = Math.min(selectedCycleIndex, Math.max(0, (selectedPlan?.cycles?.length ?? 1) - 1));
    const selectedMeal = selectedPlan?.cycles?.[cycleIndex]?.meals?.find((m) => String(m.id) === String(selectedMealId)) ?? null;
    const hasCycles = !!selectedPlan && selectedPlan.cycles.length > 0;

    return (
        <AsyncSection loading={loading} error={error} onRetry={reload} isEmpty={!!plans && plans.length === 0} emptyTitle={tQuickView("noNutritionPlans")}>
            <ThreePanelLayout
                hasMiddle={hasCycles}
                hasRight={!!selectedMeal}
                onCloseRight={() => setSelectedMealId(null)}
                left={({ goToStep }) => (
                    <LeftPanel
                        readOnly
                        plans={sortedPlans}
                        selectedPlan={selectedPlan}
                        handleSelectedPlan={(plan) => {
                            setPickedPlanId(plan.id);
                            setSelectedCycleIndex(0);
                            setSelectedMealId(null);
                            goToStep(1);
                        }}
                        sortOrder={sortOrder}
                        setSortOrder={setSortOrder}
                        selectedCycleIndex={cycleIndex}
                        clientId={clientId}
                    />
                )}
                middle={({ goToStep }) => hasCycles ? (
                    <MiddlePanel
                        readOnly
                        selectedPlan={selectedPlan}
                        selectedCycleIndex={cycleIndex}
                        setSelectedCycleIndex={setSelectedCycleIndex}
                        selectedMeal={selectedMeal}
                        setSelectedMeal={(meal) => {
                            setSelectedMealId(meal?.id ?? null);
                            if (meal) goToStep(2);
                        }}
                    />
                ) : (
                    <HintSurface>{selectedPlan ? tQuickView("noCycles") : t("selectPlanHint")}</HintSurface>
                )}
                right={() => selectedMeal ? (
                    <RightPanel
                        readOnly
                        selectedMeal={selectedMeal}
                        setSelectedMeal={NOOP}
                        clientId={clientId}
                    />
                ) : (
                    <HintSurface>{t("selectMealHint")}</HintSurface>
                )}
            />
        </AsyncSection>
    );
}
