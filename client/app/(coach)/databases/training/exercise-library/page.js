"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import Modal from "@/app/components/Modal";
import DataTable from "@/app/components/DataTable";

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

    if (loading) return <div className="p-8">Loading...</div>;

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
                    <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center text-gray-300 text-xs">—</div>
                ),
        },
        { key: "name", label: "Name", filterType: "text", sortable: true },
        { key: "muscle_group", label: "Muscle Group", filterType: "multi", options: muscleGroupOptions, sortable: true },
        { key: "equipment", label: "Equipment", filterType: "multi", options: equipmentOptions, sortable: true },
        {
            key: "instructions",
            label: "Instructions",
            render: (row) => (
                <span className="text-sm text-gray-500 line-clamp-2">{row.instructions || "—"}</span>
            ),
        },
        {
            key: "actions",
            label: "Actions",
            cardPriority: "hidden",
            render: (row) => (
                <div className="flex gap-2">
                    <button onClick={() => setEditing(row)} className="btn-secondary px-3 py-1 text-sm">Edit</button>
                    <button onClick={() => handleDelete(row.id)} className="btn-danger px-3 py-1 text-sm">Delete</button>
                </div>
            ),
        },
    ];

    return (
        <div className="p-8">
            <div className="flex items-center mb-6 gap-4">
                <div className="flex-1">
                    <h1 className="text-3xl font-bold">Exercise Library</h1>
                    <p className="text-sm text-gray-500 mt-1">Create exercises with media, instructions, and categories.</p>
                </div>
                <button onClick={() => setShowForm(true)} className="btn-primary px-4 shrink-0">+ Add Exercise</button>
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

            <DataTable columns={columns} data={items} rowKey="id" scrollable />
        </div>
    );
}

function ExerciseForm({ value, onChange, muscleGroups, equipments, onSubmit, onVideoChange, onThumbnailChange, submitLabel }) {
    return (
        <form onSubmit={onSubmit} className="flex flex-col gap-3">
            <input
                className="input-field"
                placeholder="Exercise name"
                value={value?.name || ""}
                onChange={(e) => onChange((prev) => ({ ...prev, name: e.target.value }))}
            />
            <select
                className="input-field"
                value={value?.muscle_group || ""}
                onChange={(e) => onChange((prev) => ({ ...prev, muscle_group: e.target.value }))}
            >
                <option value="">Select muscle group</option>
                {muscleGroups.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
            </select>
            <select
                className="input-field"
                value={value?.equipment || ""}
                onChange={(e) => onChange((prev) => ({ ...prev, equipment: e.target.value }))}
            >
                <option value="">Select equipment</option>
                {equipments.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
            </select>
            <input
                className="input-field"
                placeholder="YouTube URL (optional)"
                value={value?.youtube_url || ""}
                onChange={(e) => onChange((prev) => ({ ...prev, youtube_url: e.target.value }))}
            />
            <div>
                <label className="text-xs text-gray-500">Video upload (max 5MB)</label>
                <input type="file" accept="video/*" className="input-field" onChange={(e) => onVideoChange(e.target.files?.[0] || null)} />
            </div>
            <div>
                <label className="text-xs text-gray-500">Thumbnail upload (images/gif)</label>
                <input type="file" accept="image/*,.gif" className="input-field" onChange={(e) => onThumbnailChange(e.target.files?.[0] || null)} />
            </div>
            <textarea
                className="input-field min-h-24"
                placeholder="General instructions"
                value={value?.instructions || ""}
                onChange={(e) => onChange((prev) => ({ ...prev, instructions: e.target.value }))}
            />
            <button className="btn-primary px-4" type="submit">{submitLabel}</button>
        </form>
    );
}
