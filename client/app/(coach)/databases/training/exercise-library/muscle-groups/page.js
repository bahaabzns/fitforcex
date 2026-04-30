"use client";
import { useState, useEffect } from "react";
import api from "@/lib/axios";
import Modal from "@/app/components/Modal";

export default function MuscleGroupsPage() {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [newName, setNewName] = useState("");
    const [editing, setEditing] = useState(null);

    async function load() {
        try {
            const res = await api.get("/api/training/muscle-groups");
            setGroups(res.data ?? []);
        } catch (err) {
            console.error("Failed to load muscle groups:", err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    async function handleAdd(e) {
        e.preventDefault();
        if (!newName.trim()) return;
        try {
            const res = await api.post("/api/training/muscle-groups", { name: newName.trim() });
            setGroups((prev) => [...prev, res.data]);
            setNewName("");
            setShowForm(false);
        } catch (err) {
            console.error("Failed to add muscle group:", err);
        }
    }

    async function handleUpdate(e) {
        e.preventDefault();
        if (!editing) return;
        try {
            const res = await api.put(`/api/training/muscle-groups/${editing.id}`, { name: editing.name });
            setGroups((prev) => prev.map((g) => (g.id === editing.id ? res.data : g)));
            setEditing(null);
        } catch (err) {
            console.error("Failed to update muscle group:", err);
        }
    }

    async function handleDelete(id) {
        try {
            await api.delete(`/api/training/muscle-groups/${id}`);
            setGroups((prev) => prev.filter((g) => g.id !== id));
        } catch (err) {
            console.error("Failed to delete muscle group:", err);
        }
    }

    if (loading) return <div className="p-4 text-sm text-gray-500">Loading...</div>;

    return (
        <div>
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Muscle Groups</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage muscle group categories for your exercise library.</p>
                </div>
                <button onClick={() => setShowForm(true)} className="btn btn-primary">+ Add Muscle Group</button>
            </div>

            {groups.length === 0 ? (
                <div className="text-center py-16 text-gray-400 text-sm">No muscle groups yet. Add one to get started.</div>
            ) : (
                <div className="flex flex-col gap-2">
                    {groups.map((group) => (
                        <div key={group.id} className="card flex items-center justify-between gap-3">
                            <div>
                                <p className="font-semibold text-gray-900 text-sm">{group.name}</p>
                                <p className="text-xs text-gray-400">{group.exercise_count ?? 0} exercise{group.exercise_count !== 1 ? "s" : ""}</p>
                            </div>
                            <div className="flex gap-2 shrink-0">
                                <button onClick={() => setEditing(group)} className="btn btn-secondary text-xs px-3 py-1">Edit</button>
                                <button onClick={() => handleDelete(group.id)} className="btn btn-danger text-xs px-3 py-1">Delete</button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <Modal open={showForm} onClose={() => { setShowForm(false); setNewName(""); }} title="Add Muscle Group">
                <form onSubmit={handleAdd} className="flex flex-col gap-4">
                    <input
                        className="input-field"
                        placeholder="Muscle group name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        required
                        autoFocus
                    />
                    <button type="submit" className="btn btn-primary">Add Muscle Group</button>
                </form>
            </Modal>

            <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Muscle Group">
                <form onSubmit={handleUpdate} className="flex flex-col gap-4">
                    <input
                        className="input-field"
                        value={editing?.name ?? ""}
                        onChange={(e) => setEditing((prev) => ({ ...prev, name: e.target.value }))}
                        required
                        autoFocus
                    />
                    <button type="submit" className="btn btn-primary">Save Changes</button>
                </form>
            </Modal>
        </div>
    );
}
