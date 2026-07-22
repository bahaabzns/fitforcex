import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import api from "@/lib/axios";

function makeTempId(prefix) {
    return `tmp-${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePlan(plan) {
    const days = (plan.days ?? []).map((day, dayIdx) => ({
        ...day,
        day_order: dayIdx + 1,
        exercises: (day.exercises ?? []).map((exercise, exIdx) => ({
            ...exercise,
            exercise_order: exIdx + 1,
            // The linked library exercise owns the name; prefer it over a stale
            // stored value so the builder and a future re-save stay consistent.
            name: exercise.library_name_en || exercise.name,
            sets: (exercise.sets ?? []).map((set, setIdx) => ({ ...set, set_order: setIdx + 1 })),
        })),
    }));

    return {
        ...plan,
        days,
        day_count: days.length,
    };
}

export function useTrainingPlan(clientId) {
    const [plans, setPlans] = useState([]);
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [selectedDayId, setSelectedDayId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [sortOrder, setSortOrder] = useState("created_desc");
    const [dirtyPlanIds, setDirtyPlanIds] = useState(() => new Set());
    const [hasDeletedPlans, setHasDeletedPlans] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState("idle");
    const [focusPlanNameSignal, setFocusPlanNameSignal] = useState(0);
    const [newlyCreatedDayId, setNewlyCreatedDayId] = useState(null);
    const saveStatusTimeoutRef = useRef(null);

    const isDirty = dirtyPlanIds.size > 0 || hasDeletedPlans;

    const markPlanDirty = useCallback((planId) => {
        if (!planId) return;
        setDirtyPlanIds((prev) => {
            const next = new Set(prev);
            next.add(String(planId));
            return next;
        });
        setSaveStatus("idle");
    }, []);

    const clearPlanDirty = useCallback((planId) => {
        if (!planId) return;
        setDirtyPlanIds((prev) => {
            const next = new Set(prev);
            next.delete(String(planId));
            return next;
        });
    }, []);

    const fetchClientPlans = useCallback(async (preserve = null, { silent = false } = {}) => {
        if (!clientId) {
            setPlans([]);
            setSelectedPlan(null);
            setSelectedDayId(null);
            setLoading(false);
            return;
        }

        try {
            if (!silent) setLoading(true);
            const summaryRes = await api.get(`/api/training/plans?clientId=${clientId}`);
            const summaries = summaryRes.data ?? [];

            const detailed = await Promise.all(
                summaries.map(async (plan) => {
                    const detail = await api.get(`/api/training/plans/${plan.id}`);
                    return normalizePlan(detail.data);
                })
            );

            setPlans(detailed);

            setSelectedPlan((prev) => {
                const preferredId = preserve?.planId ?? prev?.id;
                const preferredName = preserve?.planName ?? prev?.name;
                if (!preferredId && !preferredName) return detailed[0] ?? null;
                const byId = detailed.find((p) => String(p.id) === String(preferredId));
                if (byId) return byId;
                return detailed.find((p) => p.name === preferredName) ?? detailed[0] ?? null;
            });

            setSelectedDayId((prevDayId) => {
                const preferredDayId = preserve?.dayId ?? prevDayId;
                if (!preferredDayId) return null;
                const allDays = detailed.flatMap((p) => p.days ?? []);
                if (allDays.some((d) => String(d.id) === String(preferredDayId))) return preferredDayId;
                // Day ID changed (e.g. tmp → real after first save) — fall back to name match within the plan
                if (preserve?.dayName) {
                    const planDays = detailed.find((p) => String(p.id) === String(preserve?.planId))?.days ?? allDays;
                    const byName = planDays.find((d) => d.name === preserve.dayName);
                    if (byName) return byName.id;
                }
                return null;
            });

            setDirtyPlanIds(new Set());
            setHasDeletedPlans(false);
        } catch (error) {
            console.error("Error fetching training plans:", error);
        } finally {
            if (!silent) setLoading(false);
        }
    }, [clientId]);

    useEffect(() => {
        fetchClientPlans();
    }, [fetchClientPlans]);

    useEffect(() => {
        return () => {
            if (saveStatusTimeoutRef.current) clearTimeout(saveStatusTimeoutRef.current);
        };
    }, []);

    const applyPlanUpdate = useCallback((nextPlan) => {
        const normalized = normalizePlan({ ...nextPlan, updated_at: new Date().toISOString() });
        setPlans((prev) => prev.map((p) => (String(p.id) === String(normalized.id) ? normalized : p)));
        setSelectedPlan(normalized);
    }, []);

    const handleSelectedPlan = useCallback((plan) => {
        const found = plans.find((p) => String(p.id) === String(plan.id));
        if (!found) return;
        setSelectedPlan(found);
        // Don't auto-open a day — leave the right panel closed until the user
        // picks a day from the middle panel.
        setSelectedDayId(null);
    }, [plans]);

    const handleSelectDay = useCallback((dayId) => {
        setSelectedDayId(dayId);
    }, []);

    const handleDeletePlan = useCallback((planId) => {
        setPlans((prev) => prev.filter((p) => String(p.id) !== String(planId)));
        setSelectedPlan((prev) => {
            if (!prev || String(prev.id) !== String(planId)) return prev;
            const remaining = plans.filter((p) => String(p.id) !== String(planId));
            return remaining[0] ?? null;
        });
        setDirtyPlanIds((prev) => {
            const next = new Set(prev);
            next.delete(String(planId));
            return next;
        });
        setHasDeletedPlans(true);
        markPlanDirty("__deleted__");
    }, [plans, markPlanDirty]);

    const handleDuplicatePlan = useCallback((planId) => {
        const source = plans.find((p) => String(p.id) === String(planId));
        if (!source) return;
        const now = new Date().toISOString();
        const newPlan = normalizePlan({
            ...source,
            id: makeTempId("plan"),
            name: `Copy of ${source.name}`,
            status: "inactive",
            created_at: now,
            updated_at: now,
            days: (source.days ?? []).map((d) => ({
                ...d,
                id: makeTempId("day"),
                exercises: (d.exercises ?? []).map((e) => ({
                    ...e,
                    id: makeTempId("exercise"),
                    sets: (e.sets ?? []).map((s) => ({ ...s, id: makeTempId("set") })),
                })),
            })),
        });
        setPlans((prev) => [newPlan, ...prev]);
        setSelectedPlan(newPlan);
        setSelectedDayId(newPlan.days[0]?.id ?? null);
        markPlanDirty(newPlan.id);
        setFocusPlanNameSignal((s) => s + 1);
    }, [plans, markPlanDirty]);

    const handleLoadPlan = useCallback(async (sourcePlanId) => {
        try {
            const { data } = await api.get(`/api/training/plans/${sourcePlanId}`);
            const now = new Date().toISOString();
            const loaded = normalizePlan({
                ...data,
                id: makeTempId("plan"),
                name: data.name,
                client_id: clientId,
                status: "inactive",
                notes: data.notes ?? "",
                created_at: now,
                updated_at: now,
                created_by: null,
                days: (data.days ?? []).map((d) => ({
                    ...d,
                    id: makeTempId("day"),
                    exercises: (d.exercises ?? []).map((e) => ({
                        ...e,
                        id: makeTempId("exercise"),
                        sets: (e.sets ?? []).map((s) => ({ ...s, id: makeTempId("set") })),
                    })),
                })),
            });
            setPlans((prev) => [loaded, ...prev]);
            setSelectedPlan(loaded);
            setSelectedDayId(loaded.days[0]?.id ?? null);
            markPlanDirty(loaded.id);
            return true;
        } catch (error) {
            console.error("Error loading training plan:", error);
            return false;
        }
    }, [clientId, markPlanDirty]);

    const handleCreatePlan = useCallback(() => {
        const now = new Date().toISOString();
        const newPlan = normalizePlan({
            id: makeTempId("plan"),
            name: "New Training Plan",
            client_id: clientId,
            status: "inactive",
            notes: "",
            created_at: now,
            updated_at: now,
            days: [
                {
                    id: makeTempId("day"),
                    name: "Day 1",
                    notes: "",
                    exercises: [],
                },
            ],
        });

        setPlans((prev) => [newPlan, ...prev]);
        setSelectedPlan(newPlan);
        setSelectedDayId(newPlan.days[0]?.id ?? null);
        markPlanDirty(newPlan.id);
        setFocusPlanNameSignal((s) => s + 1);
    }, [clientId, markPlanDirty]);

    const handleRenamePlan = useCallback((planId, name) => {
        const target = plans.find((p) => String(p.id) === String(planId));
        if (!target) return;
        applyPlanUpdate({ ...target, name });
        markPlanDirty(planId);
    }, [plans, applyPlanUpdate, markPlanDirty]);

    const handleUpdatePlanNotes = useCallback((planId, notes) => {
        const target = plans.find((p) => String(p.id) === String(planId));
        if (!target) return;
        applyPlanUpdate({ ...target, notes });
        markPlanDirty(planId);
    }, [plans, applyPlanUpdate, markPlanDirty]);

    const handleCreateDay = useCallback(() => {
        if (!selectedPlan) return;
        const day = {
            id: makeTempId("day"),
            name: `Day ${(selectedPlan.days?.length ?? 0) + 1}`,
            notes: "",
            exercises: [],
        };
        const nextPlan = { ...selectedPlan, days: [...(selectedPlan.days ?? []), day] };
        applyPlanUpdate(nextPlan);
        setSelectedDayId(day.id);
        setNewlyCreatedDayId(day.id);
        markPlanDirty(selectedPlan.id);
    }, [selectedPlan, applyPlanUpdate, markPlanDirty]);

    const handleRenameDay = useCallback((dayId, name) => {
        if (!selectedPlan) return;
        const nextPlan = {
            ...selectedPlan,
            days: (selectedPlan.days ?? []).map((d) => (String(d.id) === String(dayId) ? { ...d, name } : d)),
        };
        applyPlanUpdate(nextPlan);
        markPlanDirty(selectedPlan.id);
    }, [selectedPlan, applyPlanUpdate, markPlanDirty]);

    const handleUpdateDayNotes = useCallback((dayId, notes) => {
        if (!selectedPlan) return;
        const nextPlan = {
            ...selectedPlan,
            days: (selectedPlan.days ?? []).map((d) => (String(d.id) === String(dayId) ? { ...d, notes } : d)),
        };
        applyPlanUpdate(nextPlan);
        markPlanDirty(selectedPlan.id);
    }, [selectedPlan, applyPlanUpdate, markPlanDirty]);

    const handleDeleteDay = useCallback((dayId) => {
        if (!selectedPlan) return;
        const nextDays = (selectedPlan.days ?? []).filter((d) => String(d.id) !== String(dayId));
        const nextPlan = { ...selectedPlan, days: nextDays };
        applyPlanUpdate(nextPlan);
        setSelectedDayId((prev) => {
            if (String(prev) !== String(dayId)) return prev;
            return nextDays[0]?.id ?? null;
        });
        markPlanDirty(selectedPlan.id);
    }, [selectedPlan, applyPlanUpdate, markPlanDirty]);

    const handleDuplicateDay = useCallback((dayId) => {
        if (!selectedPlan) return;
        const source = (selectedPlan.days ?? []).find((d) => String(d.id) === String(dayId));
        if (!source) return;
        const newDay = {
            ...source,
            id: makeTempId("day"),
            name: `Copy of ${source.name}`,
            exercises: (source.exercises ?? []).map((e) => ({
                ...e,
                id: makeTempId("exercise"),
                sets: (e.sets ?? []).map((s) => ({ ...s, id: makeTempId("set") })),
            })),
        };
        const idx = (selectedPlan.days ?? []).findIndex((d) => String(d.id) === String(dayId));
        const nextDays = [...(selectedPlan.days ?? [])];
        nextDays.splice(idx + 1, 0, newDay);
        applyPlanUpdate({ ...selectedPlan, days: nextDays });
        setSelectedDayId(newDay.id);
        setNewlyCreatedDayId(newDay.id);
        markPlanDirty(selectedPlan.id);
    }, [selectedPlan, applyPlanUpdate, markPlanDirty]);

    const handleClosePlan = useCallback(() => {
        setSelectedPlan(null);
        setSelectedDayId(null);
    }, []);

    const handleCloseDay = useCallback(() => {
        setSelectedDayId(null);
    }, []);

    const handleDeleteSet = useCallback((dayId, exerciseId, setId) => {
        if (!selectedPlan) return;
        const nextPlan = {
            ...selectedPlan,
            days: (selectedPlan.days ?? []).map((d) => {
                if (String(d.id) !== String(dayId)) return d;
                return {
                    ...d,
                    exercises: (d.exercises ?? []).map((e) => {
                        if (String(e.id) !== String(exerciseId)) return e;
                        return { ...e, sets: (e.sets ?? []).filter((s) => String(s.id) !== String(setId)) };
                    }),
                };
            }),
        };
        applyPlanUpdate(nextPlan);
        markPlanDirty(selectedPlan.id);
    }, [selectedPlan, applyPlanUpdate, markPlanDirty]);

    const handleUpdateExerciseNotes = useCallback((dayId, exerciseId, notes) => {
        if (!selectedPlan) return;
        const nextPlan = {
            ...selectedPlan,
            days: (selectedPlan.days ?? []).map((d) => {
                if (String(d.id) !== String(dayId)) return d;
                return {
                    ...d,
                    exercises: (d.exercises ?? []).map((e) =>
                        String(e.id) === String(exerciseId) ? { ...e, notes } : e
                    ),
                };
            }),
        };
        applyPlanUpdate(nextPlan);
        markPlanDirty(selectedPlan.id);
    }, [selectedPlan, applyPlanUpdate, markPlanDirty]);

    const handleAddExercise = useCallback((dayId, libraryItem = null) => {
        if (!selectedPlan) return;
        const nextPlan = {
            ...selectedPlan,
            days: (selectedPlan.days ?? []).map((d) => {
                if (String(d.id) !== String(dayId)) return d;
                return {
                    ...d,
                    exercises: [
                        ...(d.exercises ?? []),
                        {
                            id: makeTempId("exercise"),
                            name: libraryItem?.name_en ?? `Exercise ${(d.exercises?.length ?? 0) + 1}`,
                            library_name_en: libraryItem?.name_en ?? null,
                            library_name_ar: libraryItem?.name_ar ?? null,
                            equipment: libraryItem?.equipment ?? "",
                            notes: "",
                            exercise_library_id: libraryItem?.id ?? null,
                            thumbnail_path: libraryItem?.thumbnail_path ?? null,
                            video_path: libraryItem?.video_path ?? null,
                            youtube_url: libraryItem?.youtube_url ?? null,
                            muscle_group: libraryItem?.muscle_group ?? null,
                            sets: [
                                { id: makeTempId("set"), reps: "8-12", rest_seconds: 90, tempo: "-", rir: 2 },
                            ],
                        },
                    ],
                };
            }),
        };

        applyPlanUpdate(nextPlan);
        markPlanDirty(selectedPlan.id);
    }, [selectedPlan, applyPlanUpdate, markPlanDirty]);

    const handleAddMultipleExercises = useCallback((dayId, libraryItems) => {
        if (!selectedPlan || !libraryItems?.length) return;
        const nextPlan = {
            ...selectedPlan,
            days: (selectedPlan.days ?? []).map((d) => {
                if (String(d.id) !== String(dayId)) return d;
                const newExercises = libraryItems.map((item) => ({
                    id: makeTempId("exercise"),
                    name: item.name_en,
                    library_name_en: item.name_en ?? null,
                    library_name_ar: item.name_ar ?? null,
                    equipment: item.equipment ?? "",
                    notes: "",
                    exercise_library_id: item.id ?? null,
                    thumbnail_path: item.thumbnail_path ?? null,
                    video_path: item.video_path ?? null,
                    youtube_url: item.youtube_url ?? null,
                    muscle_group: item.muscle_group ?? null,
                    sets: [
                        { id: makeTempId("set"), reps: "8-12", rest_seconds: 90, tempo: "-", rir: 2 },
                    ],
                }));
                return { ...d, exercises: [...(d.exercises ?? []), ...newExercises] };
            }),
        };
        applyPlanUpdate(nextPlan);
        markPlanDirty(selectedPlan.id);
    }, [selectedPlan, applyPlanUpdate, markPlanDirty]);

    const handleReplaceExercise = useCallback((dayId, exerciseId, libraryItem) => {
        if (!selectedPlan || !libraryItem) return;
        const nextPlan = {
            ...selectedPlan,
            days: (selectedPlan.days ?? []).map((d) => {
                if (String(d.id) !== String(dayId)) return d;
                return {
                    ...d,
                    exercises: (d.exercises ?? []).map((e) => {
                        if (String(e.id) !== String(exerciseId)) return e;
                        return {
                            ...e,
                            name: libraryItem.name_en,
                            library_name_en: libraryItem.name_en ?? null,
                            library_name_ar: libraryItem.name_ar ?? null,
                            equipment: libraryItem.equipment ?? "",
                            exercise_library_id: libraryItem.id ?? null,
                            thumbnail_path: libraryItem.thumbnail_path ?? null,
                            video_path: libraryItem.video_path ?? null,
                            youtube_url: libraryItem.youtube_url ?? null,
                            muscle_group: libraryItem.muscle_group ?? null,
                        };
                    }),
                };
            }),
        };
        applyPlanUpdate(nextPlan);
        markPlanDirty(selectedPlan.id);
    }, [selectedPlan, applyPlanUpdate, markPlanDirty]);

    const handleDeleteExercise = useCallback((dayId, exerciseId) => {
        if (!selectedPlan) return;
        const nextPlan = {
            ...selectedPlan,
            days: (selectedPlan.days ?? []).map((d) => {
                if (String(d.id) !== String(dayId)) return d;
                return { ...d, exercises: (d.exercises ?? []).filter((e) => String(e.id) !== String(exerciseId)) };
            }),
        };
        applyPlanUpdate(nextPlan);
        markPlanDirty(selectedPlan.id);
    }, [selectedPlan, applyPlanUpdate, markPlanDirty]);

    const handleAddSet = useCallback((dayId, exerciseId) => {
        if (!selectedPlan) return;
        const nextPlan = {
            ...selectedPlan,
            days: (selectedPlan.days ?? []).map((d) => {
                if (String(d.id) !== String(dayId)) return d;
                return {
                    ...d,
                    exercises: (d.exercises ?? []).map((e) => {
                        if (String(e.id) !== String(exerciseId)) return e;
                        const existingSets = e.sets ?? [];
                        const lastSet = existingSets[existingSets.length - 1];
                        const newSet = lastSet
                            ? { ...lastSet, id: makeTempId("set") }
                            : { id: makeTempId("set"), reps: "", rest_seconds: null, tempo: "", rir: null };
                        return { ...e, sets: [...existingSets, newSet] };
                    }),
                };
            }),
        };
        applyPlanUpdate(nextPlan);
        markPlanDirty(selectedPlan.id);
    }, [selectedPlan, applyPlanUpdate, markPlanDirty]);

    const handleDuplicateSet = useCallback((dayId, exerciseId, setId) => {
        if (!selectedPlan) return;
        const nextPlan = {
            ...selectedPlan,
            days: (selectedPlan.days ?? []).map((d) => {
                if (String(d.id) !== String(dayId)) return d;
                return {
                    ...d,
                    exercises: (d.exercises ?? []).map((e) => {
                        if (String(e.id) !== String(exerciseId)) return e;
                        const sets = e.sets ?? [];
                        const idx = sets.findIndex((s) => String(s.id) === String(setId));
                        if (idx === -1) return e;
                        const copy = { ...sets[idx], id: makeTempId("set") };
                        const next = [...sets];
                        next.splice(idx + 1, 0, copy);
                        return { ...e, sets: next };
                    }),
                };
            }),
        };
        applyPlanUpdate(nextPlan);
        markPlanDirty(selectedPlan.id);
    }, [selectedPlan, applyPlanUpdate, markPlanDirty]);

    const handleApplySetsToAll = useCallback((dayId, exerciseId) => {
        if (!selectedPlan) return;
        const day = (selectedPlan.days ?? []).find((d) => String(d.id) === String(dayId));
        const source = (day?.exercises ?? []).find((e) => String(e.id) === String(exerciseId));
        if (!source?.sets?.length) return;
        const nextPlan = {
            ...selectedPlan,
            days: (selectedPlan.days ?? []).map((d) => {
                if (String(d.id) !== String(dayId)) return d;
                return {
                    ...d,
                    exercises: (d.exercises ?? []).map((e) => {
                        if (String(e.id) === String(exerciseId)) return e;
                        return {
                            ...e,
                            sets: source.sets.map((s) => ({
                                ...s,
                                id: makeTempId("set"),
                            })),
                        };
                    }),
                };
            }),
        };
        applyPlanUpdate(nextPlan);
        markPlanDirty(selectedPlan.id);
    }, [selectedPlan, applyPlanUpdate, markPlanDirty]);

    const handleUpdateSetField = useCallback((dayId, exerciseId, setId, field, value) => {
        if (!selectedPlan) return;
        const nextPlan = {
            ...selectedPlan,
            days: (selectedPlan.days ?? []).map((d) => {
                if (String(d.id) !== String(dayId)) return d;
                return {
                    ...d,
                    exercises: (d.exercises ?? []).map((e) => {
                        if (String(e.id) !== String(exerciseId)) return e;
                        return {
                            ...e,
                            sets: (e.sets ?? []).map((s) => (String(s.id) === String(setId) ? { ...s, [field]: value } : s)),
                        };
                    }),
                };
            }),
        };
        applyPlanUpdate(nextPlan);
        markPlanDirty(selectedPlan.id);
    }, [selectedPlan, applyPlanUpdate, markPlanDirty]);

    // Package Lifecycle Phase 3b: `durationChoice` ('restart'|'extend') comes
    // from the Continue/Restart prompt, required only when `target` is
    // currently active (§12.5).
    //
    // Post-review refinement: `restartOptions` ({ cycleDays, checkInForms })
    // -- see the identical note in useNutritionPlan.js's handleSaveSelectedPlan.
    const handleSaveSelectedPlan = useCallback(async (planId = selectedPlan?.id, durationChoice = undefined, restartOptions = undefined) => {
        if (!clientId || !planId || isSaving) return { success: false };

        const target = plans.find((p) => String(p.id) === String(planId));
        if (!target) return { success: false };
        const isTempId = String(planId).startsWith("tmp-");
        if (!isTempId && !dirtyPlanIds.has(String(planId))) return { success: true, newPlanId: planId, unchanged: true };

        try {
            setIsSaving(true);
            setSaveStatus("saving");
            const activePlan = plans.find((p) => p.status === "active");

            const response = await api.post("/api/training/plans/save-plan-draft", {
                clientId,
                activePlanId: activePlan?.id ?? null,
                plan: target,
                ...(target.status === "active" && durationChoice ? { durationChoice } : {}),
                ...(target.status === "active" && durationChoice === "restart" && restartOptions
                    ? { cycleDays: restartOptions.cycleDays, checkInForms: restartOptions.checkInForms }
                    : {}),
            });

            const oldPlanId = response.data?.oldPlanId ?? planId;
            const newPlanId = response.data?.newPlanId ?? planId;

            const selectedDay = (target.days ?? []).find((d) => String(d.id) === String(selectedDayId));
            await fetchClientPlans({
                planId: newPlanId,
                planName: target.name,
                dayId: selectedDayId,
                dayName: selectedDay?.name,
            }, { silent: true });

            clearPlanDirty(oldPlanId);
            clearPlanDirty(newPlanId);
            setSaveStatus("saved");
            if (saveStatusTimeoutRef.current) clearTimeout(saveStatusTimeoutRef.current);
            saveStatusTimeoutRef.current = setTimeout(() => {
                setSaveStatus("idle");
                saveStatusTimeoutRef.current = null;
            }, 1800);

            return { success: true, oldPlanId, newPlanId };
        } catch (error) {
            console.error("Error saving training plan draft:", error);
            setSaveStatus("idle");
            return { success: false };
        } finally {
            setIsSaving(false);
        }
    }, [clientId, selectedPlan, selectedDayId, isSaving, plans, dirtyPlanIds, fetchClientPlans, clearPlanDirty]);

    const handleSaveAllDrafts = useCallback(async () => {
        if (!clientId || isSaving || !isDirty) return;
        try {
            setIsSaving(true);
            setSaveStatus("saving");
            const activePlan = plans.find((p) => p.status === "active");
            await api.post("/api/training/plans/save-draft", {
                clientId,
                activePlanId: activePlan?.id ?? null,
                plans,
            });

            await fetchClientPlans({
                planId: selectedPlan?.id,
                planName: selectedPlan?.name,
                dayId: selectedDayId,
            }, { silent: true });

            setSaveStatus("saved");
            if (saveStatusTimeoutRef.current) clearTimeout(saveStatusTimeoutRef.current);
            saveStatusTimeoutRef.current = setTimeout(() => {
                setSaveStatus("idle");
                saveStatusTimeoutRef.current = null;
            }, 1800);
        } catch (error) {
            console.error("Error saving all training drafts:", error);
            setSaveStatus("idle");
        } finally {
            setIsSaving(false);
        }
    }, [clientId, isSaving, isDirty, plans, fetchClientPlans, selectedPlan, selectedDayId]);

    // Package Lifecycle Phase 3b: `activationOptions` ({ cycleDays, checkInForms })
    // comes from the Configure Activation modal.
    const handleActivatePlan = useCallback(async (planId, activationOptions = {}) => {
        if (!planId || isSaving) return;

        let resolvedPlanId = planId;
        const needsSave = dirtyPlanIds.has(String(planId)) || String(planId).startsWith("tmp-");
        if (needsSave) {
            const saveResult = await handleSaveSelectedPlan(planId);
            if (!saveResult?.success) return;
            resolvedPlanId = saveResult.newPlanId ?? planId;
        }

        const previousStatuses = plans.map((p) => ({ id: p.id, status: p.status }));

        setPlans((prev) => prev.map((p) => ({ ...p, status: String(p.id) === String(resolvedPlanId) ? "active" : "inactive" })));
        setSelectedPlan((prev) => (prev ? { ...prev, status: String(prev.id) === String(resolvedPlanId) ? "active" : "inactive" } : prev));

        try {
            setIsSaving(true);
            await api.post(`/api/training/plans/${resolvedPlanId}/activate`, {
                cycleDays: activationOptions.cycleDays ?? null,
                checkInForms: activationOptions.checkInForms ?? [],
                reviewOffsetDays: activationOptions.reviewOffsetDays ?? null,
            });
            // Package Lifecycle Phase 3b: refetch so activated_at/cycle_days/
            // cycle_end_at (not touched by the optimistic status-only update
            // above) reach local state -- matches handleSaveSelectedPlan's
            // own refetch-after-write pattern in this hook.
            await fetchClientPlans({
                planId: resolvedPlanId,
                planName: selectedPlan?.name,
                dayId: selectedDayId,
            }, { silent: true });
        } catch (error) {
            console.error("Error activating training plan:", error);
            setPlans((prev) => prev.map((p) => {
                const original = previousStatuses.find((s) => String(s.id) === String(p.id));
                return original ? { ...p, status: original.status } : p;
            }));
            setSelectedPlan((prev) => {
                if (!prev) return prev;
                const original = previousStatuses.find((s) => String(s.id) === String(prev.id));
                return original ? { ...prev, status: original.status } : prev;
            });
        } finally {
            setIsSaving(false);
        }
    }, [isSaving, dirtyPlanIds, handleSaveSelectedPlan, plans, fetchClientPlans, selectedPlan, selectedDayId]);

    const handleReorderDays = useCallback((fromIndex, toIndex) => {
        if (!selectedPlan || fromIndex == null || toIndex == null || fromIndex === toIndex) return;
        const days = [...(selectedPlan.days ?? [])];
        const [moved] = days.splice(fromIndex, 1);
        days.splice(toIndex, 0, moved);
        applyPlanUpdate({ ...selectedPlan, days });
        markPlanDirty(selectedPlan.id);
    }, [selectedPlan, applyPlanUpdate, markPlanDirty]);

    const handleReorderExercises = useCallback((dayId, fromIndex, toIndex) => {
        if (!selectedPlan || fromIndex === toIndex) return;
        const nextPlan = {
            ...selectedPlan,
            days: (selectedPlan.days ?? []).map((d) => {
                if (String(d.id) !== String(dayId)) return d;
                const exercises = [...(d.exercises ?? [])];
                const [moved] = exercises.splice(fromIndex, 1);
                exercises.splice(toIndex, 0, moved);
                return { ...d, exercises };
            }),
        };
        applyPlanUpdate(nextPlan);
        markPlanDirty(selectedPlan.id);
    }, [selectedPlan, applyPlanUpdate, markPlanDirty]);

    const sortedPlans = useMemo(() => {
        const cloned = [...plans];
        return cloned.sort((a, b) => {
            if (sortOrder === "created_desc") return new Date(b.created_at) - new Date(a.created_at);
            if (sortOrder === "created_asc") return new Date(a.created_at) - new Date(b.created_at);
            if (sortOrder === "updated_desc") return new Date(b.updated_at) - new Date(a.updated_at);
            return 0;
        });
    }, [plans, sortOrder]);

    // A null selectedDayId means no day is open (initial load or the close
    // button) — show nothing. Only fall back to the first day when the id is
    // set but stale (its day was just deleted), so the panel never goes blank
    // while days remain.
    const selectedDay = selectedDayId == null
        ? null
        : (selectedPlan?.days?.find((d) => String(d.id) === String(selectedDayId)) ?? selectedPlan?.days?.[0] ?? null);

    return {
        plans,
        selectedPlan,
        selectedDay,
        selectedDayId,
        loading,
        sortOrder,
        sortedPlans,
        dirtyPlanIds: Array.from(dirtyPlanIds),
        hasDeletedPlans,
        isDirty,
        isSaving,
        saveStatus,
        setSortOrder,
        setSelectedPlan,
        handleSelectedPlan,
        handleSelectDay,
        handleCreatePlan,
        handleLoadPlan,
        handleRenamePlan,
        handleUpdatePlanNotes,
        handleCreateDay,
        handleDeleteDay,
        handleDuplicateDay,
        handleRenameDay,
        handleUpdateDayNotes,
        handleAddExercise,
        handleAddMultipleExercises,
        handleReplaceExercise,
        handleDeleteExercise,
        handleUpdateExerciseNotes,
        handleAddSet,
        handleDuplicateSet,
        handleApplySetsToAll,
        handleDeleteSet,
        handleUpdateSetField,
        handleSaveSelectedPlan,
        handleSaveAllDrafts,
        handleActivatePlan,
        handleDeletePlan,
        handleDuplicatePlan,
        handleReorderDays,
        handleReorderExercises,
        handleClosePlan,
        handleCloseDay,
        focusPlanNameSignal,
        newlyCreatedDayId,
    };
}
