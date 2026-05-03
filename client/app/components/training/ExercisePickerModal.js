"use client";
import { useState, useEffect } from "react";
import api from "@/lib/axios";
import Modal from "@/app/components/Modal";

export default function ExercisePickerModal({ open, onClose, onAddExercises }) {
    const [items, setItems] = useState([]);
    const [muscleGroups, setMuscleGroups] = useState([]);
    const [equipments, setEquipments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [filterGroup, setFilterGroup] = useState("");
    const [filterEquipment, setFilterEquipment] = useState("");
    const [selectedIds, setSelectedIds] = useState(new Set());

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        Promise.all([
            api.get("/api/training/exercise-library"),
            api.get("/api/training/muscle-groups"),
            api.get("/api/training/equipments"),
        ])
            .then(([libRes, groupsRes, equipRes]) => {
                setItems(libRes.data ?? []);
                setMuscleGroups(groupsRes.data ?? []);
                setEquipments(equipRes.data ?? []);
            })
            .catch((err) => console.error("Failed to load exercise library:", err))
            .finally(() => setLoading(false));
    }, [open]);

    useEffect(() => {
        if (!open) {
            setSearch("");
            setFilterGroup("");
            setFilterEquipment("");
            setSelectedIds(new Set());
        }
    }, [open]);

    const filtered = items.filter((item) => {
        const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
        const matchGroup = !filterGroup || item.muscle_group === filterGroup;
        const matchEquipment = !filterEquipment || item.equipment === filterEquipment;
        return matchSearch && matchGroup && matchEquipment;
    });

    const toggleItem = (id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const allFilteredSelected = filtered.length > 0 && filtered.every((item) => selectedIds.has(item.id));
    const toggleSelectAll = () => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (allFilteredSelected) {
                filtered.forEach((item) => next.delete(item.id));
            } else {
                filtered.forEach((item) => next.add(item.id));
            }
            return next;
        });
    };

    const handleConfirm = () => {
        const selectedItems = items.filter((item) => selectedIds.has(item.id));
        onAddExercises(selectedItems);
    };

    return (
        <Modal open={open} onClose={onClose} title="Add Exercises" wide>
            <div className="flex flex-col" style={{ maxHeight: "70vh" }}>

                {/* Search + results count */}
                <div className="flex gap-3 mb-3 items-center">
                    <input
                        type="text"
                        className="input-field flex-1"
                        placeholder="Search exercises..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                    <span className="text-sm text-muted-foreground shrink-0">
                        {filtered.length} result{filtered.length !== 1 ? "s" : ""}
                    </span>
                </div>

                {/* Muscle group pills */}
                <div className="flex gap-2 flex-wrap mb-2">
                    {["", ...muscleGroups.map((g) => g.name)].map((group) => (
                        <button
                            key={group}
                            onClick={() => setFilterGroup(group)}
                            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                                filterGroup === group
                                    ? "bg-primary border-primary text-white"
                                    : "border-border text-muted-foreground hover:border-border"
                            }`}
                        >
                            {group || "All muscles"}
                        </button>
                    ))}
                </div>

                {/* Equipment pills */}
                <div className="flex gap-2 flex-wrap mb-4">
                    {["", ...equipments.map((e) => e.name)].map((equip) => (
                        <button
                            key={equip}
                            onClick={() => setFilterEquipment(equip)}
                            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                                filterEquipment === equip
                                    ? "bg-violet-500 border-violet-500 text-white"
                                    : "border-border text-muted-foreground hover:border-border"
                            }`}
                        >
                            {equip || "All equipment"}
                        </button>
                    ))}
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto min-h-0">
                    {loading ? (
                        <div className="text-center py-10 text-sm text-muted-foreground">Loading exercises...</div>
                    ) : (
                        <table className="w-full text-sm">
                            <thead className="sticky top-0 bg-card shadow-sm">
                                <tr className="border-b-2 border-border text-left text-muted-foreground">
                                    <th className="p-2 w-8">
                                        <div
                                            className={`w-5 h-5 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                                                allFilteredSelected
                                                    ? "bg-primary border-primary"
                                                    : "border-border bg-card hover:border-primary/40"
                                            }`}
                                            onClick={toggleSelectAll}
                                        >
                                            {allFilteredSelected && (
                                                <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                                                    <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                </svg>
                                            )}
                                        </div>
                                    </th>
                                    <th className="p-2">Exercise</th>
                                    <th className="p-2">Muscle Group</th>
                                    <th className="p-2">Equipment</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="text-center py-12 text-muted-foreground">
                                            {items.length === 0
                                                ? "No exercises in your library yet. Add exercises in Databases → Exercise Library."
                                                : "No exercises match your search."}
                                        </td>
                                    </tr>
                                )}
                                {filtered.map((item) => (
                                    <tr
                                        key={item.id}
                                        className={`border-b cursor-pointer transition-colors hover:bg-accent ${selectedIds.has(item.id) ? "bg-primary/10" : ""}`}
                                        onClick={() => toggleItem(item.id)}
                                    >
                                        <td className="p-2">
                                            <div
                                                className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                                                    selectedIds.has(item.id)
                                                        ? "bg-primary border-primary"
                                                        : "border-border bg-card"
                                                }`}
                                            >
                                                {selectedIds.has(item.id) && (
                                                    <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                                                        <path d="M1 4L4 7.5L10 1" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                                                    </svg>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-2">
                                            <div className="flex items-center gap-2">
                                                {item.thumbnail_path ? (
                                                    <img
                                                        src={`http://localhost:4000${item.thumbnail_path}`}
                                                        alt={item.name}
                                                        className="w-8 h-8 object-cover rounded-md shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center shrink-0 text-muted-foreground">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                                                        </svg>
                                                    </div>
                                                )}
                                                <span className="font-medium text-foreground">{item.name}</span>
                                            </div>
                                        </td>
                                        <td className="p-2">
                                            {item.muscle_group
                                                ? <span className="text-xs px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{item.muscle_group}</span>
                                                : <span className="text-muted-foreground/40">—</span>
                                            }
                                        </td>
                                        <td className="p-2">
                                            {item.equipment
                                                ? <span className="text-xs px-2 py-0.5 rounded-full bg-violet-50 text-violet-600">{item.equipment}</span>
                                                : <span className="text-muted-foreground/40">—</span>
                                            }
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="flex justify-between items-center mt-4 pt-4 border-t">
                    <span className="text-sm text-muted-foreground">{selectedIds.size} exercise{selectedIds.size !== 1 ? "s" : ""} selected</span>
                    <div className="flex gap-3">
                        <button
                            className="btn btn-secondary"
                            onClick={() => setSelectedIds(new Set())}
                            disabled={selectedIds.size === 0}
                        >
                            Reset Selection
                        </button>
                        <button
                            className="btn btn-primary px-4"
                            onClick={handleConfirm}
                            disabled={selectedIds.size === 0}
                        >
                            Add Selected
                        </button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
