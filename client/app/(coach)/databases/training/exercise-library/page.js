"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import Modal from "@/app/components/Modal";

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
    const [search, setSearch] = useState("");
    const [filterGroup, setFilterGroup] = useState("");
    const [filterEquipment, setFilterEquipment] = useState("");

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

    if (loading) return <div className="p-4 text-sm text-gray-500">Loading...</div>;

    const filtered = items.filter((item) => {
        const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
        const matchGroup = !filterGroup || item.muscle_group === filterGroup;
        const matchEquipment = !filterEquipment || item.equipment === filterEquipment;
        return matchSearch && matchGroup && matchEquipment;
    });

    return (
        <div>
            <div className="flex items-center justify-between gap-3 mb-5">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Exercise Library</h1>
                    <p className="text-sm text-gray-500 mt-1">Create exercises with media, instructions, and categories.</p>
                </div>
                <button onClick={() => setShowForm(true)} className="btn btn-primary">+ Add Exercise</button>
            </div>

            <div className="flex flex-wrap gap-2 mb-4">
                <input
                    className="input-field max-w-xs"
                    placeholder="Search exercises..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <select
                    className="input-field max-w-45"
                    value={filterGroup}
                    onChange={(e) => setFilterGroup(e.target.value)}
                >
                    <option value="">All muscle groups</option>
                    {muscleGroups.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
                </select>
                <select
                    className="input-field max-w-45"
                    value={filterEquipment}
                    onChange={(e) => setFilterEquipment(e.target.value)}
                >
                    <option value="">All equipment</option>
                    {equipments.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
                </select>
            </div>

            {filtered.length === 0 && (
                <div className="text-center py-16 text-gray-400 text-sm">
                    {items.length === 0 ? "No exercises yet. Add one to get started." : "No exercises match your filters."}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                {filtered.map((item) => (
                    <div key={item.id} className="card">
                        {item.thumbnail_path && (
                            <img src={`http://localhost:4000${item.thumbnail_path}`} alt={item.name} className="w-full h-36 object-cover rounded-lg mb-3" />
                        )}
                        <h3 className="font-semibold text-gray-900">{item.name}</h3>
                        <p className="text-xs text-gray-500 mt-1">{item.muscle_group || "No group"} · {item.equipment || "No equipment"}</p>
                        {item.instructions && (
                            <p className="text-xs text-gray-600 mt-2 line-clamp-3">{item.instructions}</p>
                        )}
                        <div className="mt-3 flex gap-2">
                            <button onClick={() => setEditing(item)} className="btn btn-secondary text-xs px-3 py-1">Edit</button>
                            <button onClick={() => handleDelete(item.id)} className="btn btn-danger text-xs px-3 py-1">Delete</button>
                        </div>
                    </div>
                ))}
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
            <button className="btn btn-primary" type="submit">{submitLabel}</button>
        </form>
    );
}
