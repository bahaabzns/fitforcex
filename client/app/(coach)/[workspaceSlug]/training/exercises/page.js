"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import Modal, { ModalFooter } from "@/app/components/Modal";
import { FieldLabel } from "@/app/components/Field";
import DataTable from "@/app/components/DataTable";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";

// Native file inputs and textareas have no HeroUI equivalent here, so they keep
// this shared input styling for visual consistency with the converted fields.
const inputCls = "w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";

const initialState = {
    name_en: "",
    name_ar: "",
    muscle_group: "",
    equipment: "",
    youtube_url: "",
    instructions_en: "",
    instructions_ar: "",
};

export default function ExerciseLibraryPage() {
    const t = useTranslations("exercises");
    const [items, setItems] = useState([]);
    const [muscleGroups, setMuscleGroups] = useState([]);
    const [equipments, setEquipments] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editing, setEditing] = useState(null);
    const [form, setForm] = useState(initialState);
    const [videoFile, setVideoFile] = useState(null);
    const [thumbnailFile, setThumbnailFile] = useState(null);
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

    function resetForm() {
        setForm(initialState);
        setVideoFile(null);
        setThumbnailFile(null);
    }

    async function handleCreate(e) {
        e.preventDefault();
        try {
            const body = new FormData();
            Object.entries(form).forEach(([key, value]) => body.append(key, value || ""));
            if (videoFile) body.append("video", videoFile);
            if (thumbnailFile) body.append("thumbnail", thumbnailFile);

            const res = await api.post("/api/training/exercise-library", body, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setItems((prev) => [res.data, ...prev]);
            setShowForm(false);
            resetForm();
        } catch (error) {
            console.error("Failed to create exercise:", error);
        }
    }

    async function handleUpdate(e) {
        e.preventDefault();
        if (!editing) return;
        try {
            const body = new FormData();
            Object.entries(editing).forEach(([key, value]) => {
                if (["id", "coach_id", "created_at", "updated_at", "video_path", "thumbnail_path"].includes(key)) return;
                body.append(key, value ?? "");
            });
            if (videoFile) body.append("video", videoFile);
            if (thumbnailFile) body.append("thumbnail", thumbnailFile);

            const res = await api.put(`/api/training/exercise-library/${editing.id}`, body, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setItems((prev) => prev.map((item) => (item.id === editing.id ? res.data : item)));
            setEditing(null);
            resetForm();
        } catch (error) {
            console.error("Failed to update exercise:", error);
        }
    }

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
            render: (row) => (
                <div className="relative w-12 h-12 rounded bg-secondary flex items-center justify-center shrink-0 text-muted-foreground overflow-hidden">
                    <span className="text-xs">—</span>
                    {row.thumbnail_path && (
                        <img
                            src={row.thumbnail_path}
                            alt={row.name_en}
                            className="absolute inset-0 w-full h-full object-cover"
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                    )}
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
                <div className="flex gap-2">
                    <button onClick={() => setEditing(row)} className="inline-flex items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted px-3 py-1 text-sm transition-colors cursor-pointer">{t("editButton")}</button>
                    <button onClick={() => handleDelete(row.id)} className="inline-flex items-center justify-center rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 px-3 py-1 text-sm transition-colors cursor-pointer">{t("deleteButton")}</button>
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

            <Modal open={showForm} onClose={() => { setShowForm(false); resetForm(); }} title={t("addTitle")}>
                <ExerciseForm
                    value={form}
                    onChange={setForm}
                    muscleGroups={muscleGroups}
                    equipments={equipments}
                    onSubmit={handleCreate}
                    onCancel={() => { setShowForm(false); resetForm(); }}
                    onVideoChange={setVideoFile}
                    onThumbnailChange={setThumbnailFile}
                    submitLabel={t("submitCreate")}
                />
            </Modal>

            <Modal open={!!editing} onClose={() => { setEditing(null); resetForm(); }} title={t("editTitle")}>
                <ExerciseForm
                    value={editing || initialState}
                    onChange={setEditing}
                    muscleGroups={muscleGroups}
                    equipments={equipments}
                    onSubmit={handleUpdate}
                    onCancel={() => { setEditing(null); resetForm(); }}
                    onVideoChange={setVideoFile}
                    onThumbnailChange={setThumbnailFile}
                    submitLabel={t("submitEdit")}
                />
            </Modal>

            <DataTable
                columns={columns}
                data={items}
                rowKey="id"
                scrollable
                quickSearch={{ fields: ["name_en", "name_ar", "muscle_group", "equipment"], placeholder: t("searchPlaceholder") }}
                toolbarEnd={<Button variant="primary" onClick={() => setShowForm(true)}>{t("addButton")}</Button>}
            />
        </div>
    );
}

function ExerciseForm({ value, onChange, muscleGroups, equipments, onSubmit, onCancel, onVideoChange, onThumbnailChange, submitLabel }) {
    const t = useTranslations("exercises");
    const tCommon = useTranslations("common");
    const setField = (name) => (val) => onChange((prev) => ({ ...prev, [name]: val }));
    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-5 px-1 py-1">
            <div className="flex gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                    <FieldLabel required>{t("labelNameEn")}</FieldLabel>
                    <TextField variant="secondary" fullWidth isRequired aria-label={t("labelNameEn")} value={value?.name_en || ""} onChange={setField("name_en")}>
                        <Input type="text" placeholder={t("placeholderNameEn")} />
                    </TextField>
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                    <FieldLabel>{t("labelNameAr")}</FieldLabel>
                    <TextField variant="secondary" fullWidth aria-label={t("labelNameAr")} value={value?.name_ar || ""} onChange={setField("name_ar")}>
                        <Input type="text" placeholder={t("placeholderNameAr")} dir="rtl" />
                    </TextField>
                </div>
            </div>
            <Select variant="secondary" fullWidth placeholder={t("selectMuscleGroup")} aria-label={t("selectMuscleGroup")} value={value?.muscle_group || ""} onChange={setField("muscle_group")}>
                <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                    <ListBox>
                        {muscleGroups.map((g) => (
                            <ListBox.Item key={g.id} id={g.name_en} textValue={g.name_en}>
                                {g.name_en}{g.name_ar ? ` / ${g.name_ar}` : ''}
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                        ))}
                    </ListBox>
                </Select.Popover>
            </Select>
            <Select variant="secondary" fullWidth placeholder={t("selectEquipment")} aria-label={t("selectEquipment")} value={value?.equipment || ""} onChange={setField("equipment")}>
                <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                    <ListBox>
                        {equipments.map((g) => (
                            <ListBox.Item key={g.id} id={g.name_en} textValue={g.name_en}>
                                {g.name_en}{g.name_ar ? ` / ${g.name_ar}` : ''}
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                        ))}
                    </ListBox>
                </Select.Popover>
            </Select>
            <TextField variant="secondary" fullWidth aria-label={t("placeholderYoutube")} value={value?.youtube_url || ""} onChange={setField("youtube_url")}>
                <Input type="text" placeholder={t("placeholderYoutube")} />
            </TextField>
            <div className="flex flex-col gap-1.5">
                <FieldLabel>{t("labelVideo")}</FieldLabel>
                <input type="file" accept="video/*" className={inputCls} onChange={(e) => onVideoChange(e.target.files?.[0] || null)} />
            </div>
            <div className="flex flex-col gap-1.5">
                <FieldLabel>{t("labelThumbnail")}</FieldLabel>
                <input type="file" accept="image/*,.gif" className={inputCls} onChange={(e) => onThumbnailChange(e.target.files?.[0] || null)} />
            </div>
            <div className="flex gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                    <FieldLabel>{t("labelInstructionsEn")}</FieldLabel>
                    <textarea
                        className={`${inputCls} min-h-24`}
                        placeholder={t("placeholderInstructionsEn")}
                        value={value?.instructions_en || ""}
                        onChange={(e) => onChange((prev) => ({ ...prev, instructions_en: e.target.value }))}
                    />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                    <FieldLabel>{t("labelInstructionsAr")}</FieldLabel>
                    <textarea
                        className={`${inputCls} min-h-24`}
                        placeholder={t("placeholderInstructionsAr")}
                        value={value?.instructions_ar || ""}
                        onChange={(e) => onChange((prev) => ({ ...prev, instructions_ar: e.target.value }))}
                        dir="rtl"
                    />
                </div>
            </div>
            <ModalFooter>
                <Button type="button" variant="ghost" onClick={onCancel}>{tCommon("cancel")}</Button>
                <Button type="submit" variant="primary">{submitLabel}</Button>
            </ModalFooter>
        </form>
    );
}
