"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import Modal from "@/app/components/Modal";
import DataTable from "@/app/components/DataTable";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";

const inputCls = "w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";

const initialState = {
    name: "",
    muscle_group: "",
    equipment: "",
    youtube_url: "",
    instructions: "",
};

export default function ExerciseLibraryPage() {
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

    const muscleGroupOptions = muscleGroups.map((g) => g.name);
    const equipmentOptions = equipments.map((g) => g.name);

    const columns = [
        {
            key: "thumbnail_path",
            label: "Thumbnail",
            render: (row) =>
                row.thumbnail_path ? (
                    <img
                        src={`http://localhost:4000${row.thumbnail_path}`}
                        alt={row.name}
                        className="w-12 h-12 object-cover rounded"
                    />
                ) : (
                    <div className="w-12 h-12 bg-secondary rounded flex items-center justify-center text-muted-foreground text-xs">—</div>
                ),
        },
        { key: "name", label: "Name", filterType: "text", sortable: true },
        { key: "muscle_group", label: "Muscle Group", filterType: "multi", options: muscleGroupOptions, sortable: true },
        { key: "equipment", label: "Equipment", filterType: "multi", options: equipmentOptions, sortable: true },
        {
            key: "instructions",
            label: "Instructions",
            render: (row) => (
                <span className="text-sm text-muted-foreground line-clamp-2">{row.instructions || "—"}</span>
            ),
        },
        {
            key: "actions",
            label: "Actions",
            cardPriority: "hidden",
            render: (row) => (
                <div className="flex gap-2">
                    <button onClick={() => setEditing(row)} className="inline-flex items-center justify-center rounded-md border border-border bg-background text-foreground hover:bg-muted px-3 py-1 text-sm transition-colors cursor-pointer">Edit</button>
                    <button onClick={() => handleDelete(row.id)} className="inline-flex items-center justify-center rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 px-3 py-1 text-sm transition-colors cursor-pointer">Delete</button>
                </div>
            ),
        },
    ];

    return (
        <div className="p-8 flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold">Exercise Library</h1>
                <p className="text-sm text-muted-foreground mt-1">Create exercises with media, instructions, and categories.</p>
            </div>

            <Modal open={showForm} onClose={() => { setShowForm(false); resetForm(); }} title="Add Exercise">
                <ExerciseForm
                    value={form}
                    onChange={setForm}
                    muscleGroups={muscleGroups}
                    equipments={equipments}
                    onSubmit={handleCreate}
                    onVideoChange={setVideoFile}
                    onThumbnailChange={setThumbnailFile}
                    submitLabel="Create Exercise"
                />
            </Modal>

            <Modal open={!!editing} onClose={() => { setEditing(null); resetForm(); }} title="Edit Exercise">
                <ExerciseForm
                    value={editing || initialState}
                    onChange={setEditing}
                    muscleGroups={muscleGroups}
                    equipments={equipments}
                    onSubmit={handleUpdate}
                    onVideoChange={setVideoFile}
                    onThumbnailChange={setThumbnailFile}
                    submitLabel="Save Changes"
                />
            </Modal>

            <DataTable
                columns={columns}
                data={items}
                rowKey="id"
                scrollable
                quickSearch={{ fields: ["name", "muscle_group", "equipment"], placeholder: "Search exercises..." }}
                toolbarEnd={<Button variant="primary" onClick={() => setShowForm(true)}>+ Add Exercise</Button>}
            />
        </div>
    );
}

function ExerciseForm({ value, onChange, muscleGroups, equipments, onSubmit, onVideoChange, onThumbnailChange, submitLabel }) {
    const inputCls = "w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";
    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <input
                className={inputCls}
                placeholder="Exercise name"
                value={value?.name || ""}
                onChange={(e) => onChange((prev) => ({ ...prev, name: e.target.value }))}
            />
            <select
                className={inputCls}
                value={value?.muscle_group || ""}
                onChange={(e) => onChange((prev) => ({ ...prev, muscle_group: e.target.value }))}
            >
                <option value="">Select muscle group</option>
                {muscleGroups.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
            </select>
            <select
                className={inputCls}
                value={value?.equipment || ""}
                onChange={(e) => onChange((prev) => ({ ...prev, equipment: e.target.value }))}
            >
                <option value="">Select equipment</option>
                {equipments.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
            </select>
            <input
                className={inputCls}
                placeholder="YouTube URL (optional)"
                value={value?.youtube_url || ""}
                onChange={(e) => onChange((prev) => ({ ...prev, youtube_url: e.target.value }))}
            />
            <div>
                <label className="text-xs text-muted-foreground">Video upload (max 5MB)</label>
                <input type="file" accept="video/*" className={inputCls} onChange={(e) => onVideoChange(e.target.files?.[0] || null)} />
            </div>
            <div>
                <label className="text-xs text-muted-foreground">Thumbnail upload (images/gif)</label>
                <input type="file" accept="image/*,.gif" className={inputCls} onChange={(e) => onThumbnailChange(e.target.files?.[0] || null)} />
            </div>
            <textarea
                className={`${inputCls} min-h-24`}
                placeholder="General instructions"
                value={value?.instructions || ""}
                onChange={(e) => onChange((prev) => ({ ...prev, instructions: e.target.value }))}
            />
            <Button type="submit" variant="primary" fullWidth>{submitLabel}</Button>
        </form>
    );
}
