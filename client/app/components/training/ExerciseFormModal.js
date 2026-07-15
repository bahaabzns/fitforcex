"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import Modal, { ModalFooter } from "@/app/components/Modal";
import { FieldLabel } from "@/app/components/Field";
import { Button } from "@heroui/react/button";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";

const inputCls = "w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";

const emptyForm = {
    name_en: "",
    name_ar: "",
    muscle_group: "",
    equipment: "",
    youtube_url: "",
    instructions_en: "",
    instructions_ar: "",
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
            Object.entries(form).forEach(([key, value]) => body.append(key, value || ""));
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

                <TextField
                    variant="secondary"
                    fullWidth
                    aria-label={t("placeholderYoutube")}
                    value={form.youtube_url}
                    onChange={setField("youtube_url")}
                >
                    <Input type="text" placeholder={t("placeholderYoutube")} />
                </TextField>

                <div className="flex flex-col gap-1.5">
                    <FieldLabel>{t("labelVideo")}</FieldLabel>
                    <input
                        type="file"
                        accept="video/*"
                        className={inputCls}
                        onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                    />
                </div>

                <div className="flex flex-col gap-1.5">
                    <FieldLabel>{t("labelThumbnail")}</FieldLabel>
                    <input
                        type="file"
                        accept="image/*,.gif"
                        className={inputCls}
                        onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)}
                    />
                </div>

                <div className="flex gap-2">
                    <div className="flex flex-1 flex-col gap-1.5">
                        <FieldLabel>{t("labelInstructionsEn")}</FieldLabel>
                        <textarea
                            className={`${inputCls} min-h-24`}
                            placeholder={t("placeholderInstructionsEn")}
                            value={form.instructions_en}
                            onChange={(e) =>
                                setForm((prev) => ({ ...prev, instructions_en: e.target.value }))
                            }
                        />
                    </div>
                    <div className="flex flex-1 flex-col gap-1.5">
                        <FieldLabel>{t("labelInstructionsAr")}</FieldLabel>
                        <textarea
                            className={`${inputCls} min-h-24`}
                            placeholder={t("placeholderInstructionsAr")}
                            value={form.instructions_ar}
                            onChange={(e) =>
                                setForm((prev) => ({ ...prev, instructions_ar: e.target.value }))
                            }
                            dir="rtl"
                        />
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
