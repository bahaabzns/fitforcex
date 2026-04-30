"use client";
import { useState, useEffect } from "react";
import api from "@/lib/axios";
import Modal from "@/app/components/Modal";
import DataTable from "@/app/components/DataTable";

export default function EquipmentPage() {
    const [equipments, setEquipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [newName, setNewName] = useState("");
    const [editing, setEditing] = useState(null);

    async function load() {
        try {
            const res = await api.get("/api/training/equipments");
            setEquipments(res.data ?? []);
        } catch (err) {
            console.error("Failed to load equipments:", err);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => { load(); }, []);

    async function handleAdd(e) {
        e.preventDefault();
        if (!newName.trim()) return;
        try {
            const res = await api.post("/api/training/equipments", { name: newName.trim() });
            setEquipments((prev) => [...prev, res.data]);
            setNewName("");
            setShowForm(false);
        } catch (err) {
            console.error("Failed to add equipment:", err);
        }
    }

    async function handleUpdate(e) {
        e.preventDefault();
        if (!editing) return;
        try {
            const res = await api.put(`/api/training/equipments/${editing.id}`, { name: editing.name });
            setEquipments((prev) => prev.map((g) => (g.id === editing.id ? res.data : g)));
            setEditing(null);
        } catch (err) {
            console.error("Failed to update equipment:", err);
        }
    }

    async function handleDelete(id) {
        try {
            await api.delete(`/api/training/equipments/${id}`);
            setEquipments((prev) => prev.filter((g) => g.id !== id));
        } catch (err) {
            console.error("Failed to delete equipment:", err);
        }
    }

    if (loading) return <div className="p-8">Loading...</div>;

    const columns = [
        { key: "name", label: "Name", filterType: "text", sortable: true },
        { key: "exercise_count", label: "Exercises", sortable: true },
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
                    <h1 className="text-3xl font-bold">Equipment</h1>
                    <p className="text-sm text-gray-500 mt-1">Manage equipment categories for your exercise library.</p>
                </div>
                <button onClick={() => setShowForm(true)} className="btn-primary px-4 shrink-0">+ Add Equipment</button>
            </div>

            <Modal open={showForm} onClose={() => { setShowForm(false); setNewName(""); }} title="Add Equipment">
                <form onSubmit={handleAdd} className="flex flex-col gap-4">
                    <input
                        className="input-field"
                        placeholder="Equipment name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        required
                        autoFocus
                    />
                    <button type="submit" className="btn-primary px-4">Add Equipment</button>
                </form>
            </Modal>

            <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Equipment">
                <form onSubmit={handleUpdate} className="flex flex-col gap-4">
                    <input
                        className="input-field"
                        value={editing?.name ?? ""}
                        onChange={(e) => setEditing((prev) => ({ ...prev, name: e.target.value }))}
                        required
                        autoFocus
                    />
                    <button type="submit" className="btn-primary px-4">Save Changes</button>
                </form>
            </Modal>

            <DataTable columns={columns} data={equipments} rowKey="id" />
        </div>
    );
}
