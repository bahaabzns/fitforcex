"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil, Trash2, Dumbbell } from "lucide-react";
import api from "@/lib/axios";
import DataTable from "@/app/components/DataTable";
import ImagePreview from "@/app/components/ImagePreview";
import ExerciseFormModal from "@/app/components/training/ExerciseFormModal";
import { Button } from "@heroui/react/button";
import { Tooltip } from "@heroui/react/tooltip";
import { Skeleton } from "@heroui/react/skeleton";
import { usePageTitle } from "@/hooks/usePageTitle";
import TriggerInsightBanner from "@/app/components/insights/TriggerInsightBanner";

export default function ExerciseLibraryPage() {
    const t = useTranslations("exercises");
    usePageTitle(t('pageTitle'));
    const [items, setItems] = useState([]);
    const [muscleGroups, setMuscleGroups] = useState([]);
    const [equipments, setEquipments] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function load() {
            try {
                const [libraryRes, groupsRes, equipRes] = await Promise.all([
                    api.get("/api/training/exercise-library"),
                    api.get("/api/training/muscle-groups"),
                    api.get("/api/training/equipments"),
                ]);
                setItems(libraryRes.data ?? []);
                setMuscleGroups(groupsRes.data ?? []);
                setEquipments(equipRes.data ?? []);
            } catch (error) {
                console.error("Failed to load exercise library:", error);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    async function handleDelete(id) {
        try {
            await api.delete(`/api/training/exercise-library/${id}`);
            setItems((prev) => prev.filter((item) => item.id !== id));
        } catch (error) {
            console.error("Failed to delete exercise:", error);
        }
    }

    if (loading) {
        return (
            <div className="p-8 flex flex-col gap-4">
                <Skeleton className="h-9 w-48 rounded-lg" />
                {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
        );
    }

    const muscleGroupOptions = muscleGroups.map((g) => g.name_en);
    const equipmentOptions = equipments.map((g) => g.name_en);

    const columns = [
        {
            key: "thumbnail_path",
            label: t("columnThumbnail"),
            render: (row) =>
                row.thumbnail_path ? (
                    <ImagePreview src={row.thumbnail_path} alt={row.name_en} title={row.name_en}>
                        <div className="relative w-12 h-12 rounded bg-secondary overflow-hidden">
                            <img
                                src={row.thumbnail_path}
                                alt={row.name_en}
                                className="absolute inset-0 w-full h-full object-cover"
                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                            />
                        </div>
                    </ImagePreview>
                ) : (
                    <div className="relative w-12 h-12 rounded bg-secondary flex items-center justify-center shrink-0 text-muted-foreground overflow-hidden">
                        <span className="text-xs">—</span>
                    </div>
                ),
        },
        { key: "name_en", label: t("columnNameEn"), filterType: "text", sortable: true },
        { key: "name_ar", label: t("columnNameAr"), render: (row) => <span dir="rtl">{row.name_ar || "—"}</span> },
        { key: "muscle_group", label: t("columnMuscleGroup"), filterType: "multi", options: muscleGroupOptions, sortable: true },
        { key: "equipment", label: t("columnEquipment"), filterType: "multi", options: equipmentOptions, sortable: true },
        {
            key: "instructions_en",
            label: t("columnInstructions"),
            render: (row) => (
                <span className="text-sm text-muted-foreground line-clamp-2">{row.instructions_en || "—"}</span>
            ),
        },
        {
            key: "actions",
            label: t("columnActions"),
            cardPriority: "hidden",
            render: (row) => (
                <div className="flex items-center gap-1">
                    <Tooltip>
                        <Button isIconOnly size="sm" variant="ghost" aria-label={t("editButton")} onClick={() => setEditing(row)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Tooltip.Content>{t("editButton")}</Tooltip.Content>
                    </Tooltip>
                    <Tooltip>
                        <Button isIconOnly size="sm" variant="ghost" aria-label={t("deleteButton")} className="text-destructive hover:text-red-700" onClick={() => handleDelete(row.id)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <Tooltip.Content>{t("deleteButton")}</Tooltip.Content>
                    </Tooltip>
                </div>
            ),
        },
    ];

    return (
        <div className="p-8 flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold">{t("pageTitle")}</h1>
                <p className="text-sm text-muted-foreground mt-1">{t("pageSubtitle")}</p>
            </div>

            <TriggerInsightBanner
                triggerEvent="first_custom_exercise_added"
                checkUrl="/api/insights/prompts/for-trigger/first_custom_exercise_added"
                respondUrlPrefix="/api/insights/prompts"
                dismissUrlPrefix="/api/insights/prompts"
            />

            <ExerciseFormModal
                open={showForm}
                onClose={() => setShowForm(false)}
                muscleGroups={muscleGroups}
                equipments={equipments}
                onCreated={(exercise) => setItems((prev) => [exercise, ...prev])}
            />

            <ExerciseFormModal
                open={!!editing}
                onClose={() => setEditing(null)}
                exerciseToEdit={editing}
                muscleGroups={muscleGroups}
                equipments={equipments}
                onUpdated={(exercise) =>
                    setItems((prev) => prev.map((item) => (item.id === exercise.id ? exercise : item)))
                }
            />

            <DataTable
                columns={columns}
                data={items}
                rowKey="id"
                scrollable
                quickSearch={{ fields: ["name_en", "name_ar", "muscle_group", "equipment"], placeholder: t("searchPlaceholder") }}
                emptyState={{
                    icon: Dumbbell,
                    title: t("emptyTitle"),
                    description: t("emptyHint"),
                    action: { label: t("addButton"), onPress: () => setShowForm(true) },
                }}
                toolbarEnd={<Button variant="primary" onClick={() => setShowForm(true)}>{t("addButton")}</Button>}
            />
        </div>
    );
}
