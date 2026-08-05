"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import Modal, { ModalFooter } from "@/app/components/Modal";
import { FieldLabel } from "@/app/components/Field";
import { Button } from "@heroui/react/button";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { TextArea } from "@heroui/react/textarea";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";
import { Checkbox } from "@heroui/react/checkbox";
import ProofDropZone from "@/app/components/ProofDropZone";
import NewFeatureTooltip from "@/app/components/NewFeatureTooltip";
import { EXERCISE_CATEGORIES, DEFAULT_CATEGORY, CATEGORY_CONFIG } from "@/utils/exerciseTrackingTypes";

// i18n keys per category / per selectable metric — see exerciseTrackingTypes.js
// for the shared category -> metric checklist config.
const CATEGORY_LABEL_KEY = {
    sets_reps: "categorySetsReps",
    time_based: "categoryTimeBased",
};
const METRIC_LABEL_KEY = {
    tempo: "metricTempo",
    rir: "metricRir",
    rpe: "metricRpe",
    duration_seconds: "metricDuration",
    distance_km: "metricDistance",
    incline_percent: "metricIncline",
    speed_kmh: "metricSpeed",
};

const emptyForm = {
    name_en: "",
    name_ar: "",
    muscle_group: "",
    equipment: "",
    youtube_url: "",
    instructions_en: "",
    instructions_ar: "",
    tracking_type: DEFAULT_CATEGORY,
    tracked_metrics: [],
};

/**
 * Standalone modal for creating or editing a single exercise.
 *
 * Props:
 *   open            – boolean
 *   onClose         – () => void
 *   initialValues   – partial form values to pre-fill (e.g. { name_en: "Squat" })
 *   muscleGroups    – array from /api/training/muscle-groups
 *   equipments      – array from /api/training/equipments
 *   exerciseToEdit  – full exercise row when editing; null/undefined for create
 *   onCreated       – (exercise) => void   called after successful create
 *   onUpdated       – (exercise) => void   called after successful update
 */
export default function ExerciseFormModal({
    open,
    onClose,
    initialValues,
    muscleGroups = [],
    equipments = [],
    exerciseToEdit,
    onCreated,
    onUpdated,
}) {
    const t = useTranslations("exercises");
    const tCommon = useTranslations("common");

    const isEditing = !!exerciseToEdit;

    const [form, setForm] = useState(() => ({
        ...emptyForm,
        ...(exerciseToEdit ?? initialValues ?? {}),
    }));
    const [videoFile, setVideoFile] = useState(null);
    const [thumbnailFile, setThumbnailFile] = useState(null);
    const [submitting, setSubmitting] = useState(false);

    // Reset form whenever the modal opens (the modal instance stays mounted between opens,
    // so this can't rely on a fresh useState initializer picking up exerciseToEdit)
    useEffect(() => {
        if (open) {
            setForm({ ...emptyForm, ...(exerciseToEdit ?? initialValues ?? {}) });
            setVideoFile(null);
            setThumbnailFile(null);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, exerciseToEdit]);

    const setField = (name) => (val) =>
        setForm((prev) => ({ ...prev, [name]: val }));

    async function handleSubmit(e) {
        e.preventDefault();
        setSubmitting(true);
        try {
            const body = new FormData();
            Object.entries(form).forEach(([key, value]) => {
                if (key === "tracked_metrics") return; // array field, appended below (one field per selected metric)
                body.append(key, value || "");
            });
            (form.tracked_metrics ?? []).forEach((metric) => body.append("tracked_metrics", metric));
            if (videoFile) body.append("video", videoFile);
            if (thumbnailFile) body.append("thumbnail", thumbnailFile);

            if (isEditing) {
                const res = await api.put(
                    `/api/training/exercise-library/${exerciseToEdit.id}`,
                    body,
                    { headers: { "Content-Type": "multipart/form-data" } },
                );
                onUpdated?.(res.data);
            } else {
                const res = await api.post("/api/training/exercise-library", body, {
                    headers: { "Content-Type": "multipart/form-data" },
                });
                onCreated?.(res.data);
            }
            onClose();
        } catch (err) {
            console.error("Failed to save exercise:", err);
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={isEditing ? t("editTitle") : t("addTitle")}
            wide
        >
            <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-1 py-1">
                <div className="flex gap-2">
                    <div className="flex flex-1 flex-col gap-1.5">
                        <FieldLabel required>{t("labelNameEn")}</FieldLabel>
                        <TextField
                            variant="secondary"
                            fullWidth
                            isRequired
                            aria-label={t("labelNameEn")}
                            value={form.name_en}
                            onChange={setField("name_en")}
                        >
                            <Input type="text" placeholder={t("placeholderNameEn")} />
                        </TextField>
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5">
                        <FieldLabel>{t("labelNameAr")}</FieldLabel>
                        <TextField
                            variant="secondary"
                            fullWidth
                            aria-label={t("labelNameAr")}
                            value={form.name_ar}
                            onChange={setField("name_ar")}
                        >
                            <Input type="text" placeholder={t("placeholderNameAr")} dir="rtl" />
                        </TextField>
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <FieldLabel hint={t("trackingTypeHint")}>{t("selectTrackingType")}</FieldLabel>
                    <Select
                        variant="secondary"
                        fullWidth
                        placeholder={t("selectTrackingType")}
                        aria-label={t("selectTrackingType")}
                        value={form.tracking_type}
                        onChange={(category) => setForm((prev) => ({
                            ...prev,
                            tracking_type: category,
                            // Sets & Reps and Time-Based have disjoint metric
                            // checklists — a selection from the old category
                            // (e.g. "tempo") is meaningless for the new one.
                            tracked_metrics: [],
                        }))}
                    >
                        <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                            <ListBox>
                                {EXERCISE_CATEGORIES.map((category) => (
                                    <ListBox.Item key={category} id={category} textValue={t(CATEGORY_LABEL_KEY[category])}>
                                        {t(CATEGORY_LABEL_KEY[category])}
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                ))}
                            </ListBox>
                        </Select.Popover>
                    </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                    <div className="inline-flex items-center gap-1.5">
                        <FieldLabel hint={t("selectMetricsHint")}>{t("selectMetrics")}</FieldLabel>
                        <NewFeatureTooltip
                            featureKey="exercise_metrics_checklist_hint"
                            active
                            message={t("metricsChecklistHint")}
                            dismissLabel={t("metricsChecklistHintDismiss")}
                            badgeLabel={t("metricsChecklistNewFeature")}
                            triggerClassName="w-1.5 h-1.5 rounded-full bg-primary animate-pulse cursor-pointer"
                        />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-2">
                        {(CATEGORY_CONFIG[form.tracking_type] ?? CATEGORY_CONFIG[DEFAULT_CATEGORY]).selectableMetrics.map((metric) => (
                            <Checkbox
                                key={metric}
                                variant="secondary"
                                isSelected={form.tracked_metrics.includes(metric)}
                                onChange={(isSelected) => setForm((prev) => ({
                                    ...prev,
                                    tracked_metrics: isSelected
                                        ? [...prev.tracked_metrics, metric]
                                        : prev.tracked_metrics.filter((m) => m !== metric),
                                }))}
                            >
                                <Checkbox.Control>
                                    <Checkbox.Indicator />
                                </Checkbox.Control>
                                <Checkbox.Content>{t(METRIC_LABEL_KEY[metric])}</Checkbox.Content>
                            </Checkbox>
                        ))}
                    </div>
                </div>

                <div className="flex gap-2">
                    <div className="flex-1">
                        <Select
                            variant="secondary"
                            fullWidth
                            placeholder={t("selectMuscleGroup")}
                            aria-label={t("selectMuscleGroup")}
                            value={form.muscle_group}
                            onChange={setField("muscle_group")}
                        >
                            <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    {muscleGroups.map((g) => (
                                        <ListBox.Item key={g.id} id={g.name_en} textValue={g.name_en}>
                                            {g.name_en}{g.name_ar ? ` / ${g.name_ar}` : ""}
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                    </div>
                    <div className="flex-1">
                        <Select
                            variant="secondary"
                            fullWidth
                            placeholder={t("selectEquipment")}
                            aria-label={t("selectEquipment")}
                            value={form.equipment}
                            onChange={setField("equipment")}
                        >
                            <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    {equipments.map((g) => (
                                        <ListBox.Item key={g.id} id={g.name_en} textValue={g.name_en}>
                                            {g.name_en}{g.name_ar ? ` / ${g.name_ar}` : ""}
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                    </div>
                </div>

                <TextField
                    variant="secondary"
                    fullWidth
                    aria-label={t("placeholderYoutube")}
                    value={form.youtube_url}
                    onChange={setField("youtube_url")}
                >
                    <Input type="text" placeholder={t("placeholderYoutube")} />
                </TextField>

                <div className="flex gap-2">
                    <div className="flex flex-1 flex-col gap-1.5">
                        <FieldLabel>{t("labelVideo")}</FieldLabel>
                        <ProofDropZone
                            file={videoFile}
                            onChange={setVideoFile}
                            accept="video/*"
                            label={t("videoDropLabel")}
                            hint={t("videoDropHint")}
                            removeLabel={t("removeFile")}
                        />
                    </div>

                    <div className="flex flex-1 flex-col gap-1.5">
                        <FieldLabel>{t("labelThumbnail")}</FieldLabel>
                        <ProofDropZone
                            file={thumbnailFile}
                            onChange={setThumbnailFile}
                            accept="image/*,.gif"
                            label={t("thumbnailDropLabel")}
                            hint={t("thumbnailDropHint")}
                            removeLabel={t("removeFile")}
                        />
                    </div>
                </div>

                <div className="flex gap-2">
                    <div className="flex flex-1 flex-col gap-1.5">
                        <FieldLabel>{t("labelInstructionsEn")}</FieldLabel>
                        <TextField variant="secondary" fullWidth value={form.instructions_en} onChange={setField("instructions_en")}>
                            <TextArea rows={4} placeholder={t("placeholderInstructionsEn")} className="min-h-24 resize-none" />
                        </TextField>
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5">
                        <FieldLabel>{t("labelInstructionsAr")}</FieldLabel>
                        <TextField variant="secondary" fullWidth value={form.instructions_ar} onChange={setField("instructions_ar")}>
                            <TextArea rows={4} placeholder={t("placeholderInstructionsAr")} dir="rtl" className="min-h-24 resize-none" />
                        </TextField>
                    </div>
                </div>

                <ModalFooter>
                    <Button type="button" variant="ghost" onClick={onClose}>
                        {tCommon("cancel")}
                    </Button>
                    <Button type="submit" variant="primary" isDisabled={submitting}>
                        {isEditing ? t("submitEdit") : t("submitCreate")}
                    </Button>
                </ModalFooter>
            </form>
        </Modal>
    );
}
