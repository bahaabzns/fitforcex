"use client";
import { useState, useEffect } from "react";
import api from "@/lib/axios";
import Modal from "@/app/components/Modal";
import DataTable from "@/app/components/DataTable";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";

const inputCls = "w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";

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

    if (loading) {
        return (
            <div className="p-8 flex flex-col gap-4">
                <Skeleton className="h-9 w-48 rounded-lg" />
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
        );
    }

    const columns = [
        { key: "name", label: "Name", filterType: "text", sortable: true },
        { key: "exercise_count", label: "Exercises", sortable: true },
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
        <div className="p-8">
            <div className="flex items-center mb-6 gap-4">
                <div className="flex-1">
                    <h1 className="text-3xl font-bold">Muscle Groups</h1>
                    <p className="text-sm text-muted-foreground mt-1">Manage muscle group categories for your exercise library.</p>
                </div>
                <Button onClick={() => setShowForm(true)} variant="primary" className="shrink-0">+ Add Muscle Group</Button>
            </div>

            <Modal open={showForm} onClose={() => { setShowForm(false); setNewName(""); }} title="Add Muscle Group">
                <form onSubmit={handleAdd} className="flex flex-col gap-4">
                    <input
                        className={inputCls}
                        placeholder="Muscle group name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        required
                        autoFocus
                    />
                    <Button type="submit" variant="primary" fullWidth>Add Muscle Group</Button>
                </form>
            </Modal>

            <Modal open={!!editing} onClose={() => setEditing(null)} title="Edit Muscle Group">
                <form onSubmit={handleUpdate} className="flex flex-col gap-4">
                    <input
                        className={inputCls}
                        value={editing?.name ?? ""}
                        onChange={(e) => setEditing((prev) => ({ ...prev, name: e.target.value }))}
                        required
                        autoFocus
                    />
                    <Button type="submit" variant="primary" fullWidth>Save Changes</Button>
                </form>
            </Modal>

            <DataTable columns={columns} data={groups} rowKey="id" />
        </div>
    );
}
