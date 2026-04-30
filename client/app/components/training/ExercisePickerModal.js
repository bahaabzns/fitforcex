"use client";
import { useState, useEffect } from "react";
import api from "@/lib/axios";

export default function ExercisePickerModal({ open, onClose, onSelect }) {
    const [items, setItems] = useState([]);
    const [muscleGroups, setMuscleGroups] = useState([]);
    const [equipments, setEquipments] = useState([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState("");
    const [filterGroup, setFilterGroup] = useState("");
    const [filterEquipment, setFilterEquipment] = useState("");

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

    // Reset filters when closed
    useEffect(() => {
        if (!open) {
            setSearch("");
            setFilterGroup("");
            setFilterEquipment("");
        }
    }, [open]);

    if (!open) return null;

    const filtered = items.filter((item) => {
        const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
        const matchGroup = !filterGroup || item.muscle_group === filterGroup;
        const matchEquipment = !filterEquipment || item.equipment === filterEquipment;
        return matchSearch && matchGroup && matchEquipment;
    });

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-8 px-4"
            onClick={onClose}
        >
            <div
                className="bg-white border border-[#D2D2D7] rounded-2xl w-full max-w-2xl shadow-xl my-auto"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-semibold text-gray-900">Add Exercise</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-gray-100">
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Filters */}
                <div className="px-6 py-3 border-b border-gray-100 flex flex-wrap gap-2">
                    <input
                        className="input-field flex-1 min-w-35"
                        placeholder="Search exercises..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                    <select
                        className="input-field w-40"
                        value={filterGroup}
                        onChange={(e) => setFilterGroup(e.target.value)}
                    >
                        <option value="">All muscle groups</option>
                        {muscleGroups.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
                    </select>
                    <select
                        className="input-field w-40"
                        value={filterEquipment}
                        onChange={(e) => setFilterEquipment(e.target.value)}
                    >
                        <option value="">All equipment</option>
                        {equipments.map((g) => <option key={g.id} value={g.name}>{g.name}</option>)}
                    </select>
                </div>

                {/* Results */}
                <div className="px-6 py-4 max-h-120 overflow-y-auto">
                    {loading && (
                        <div className="text-center py-10 text-sm text-gray-400">Loading exercises...</div>
                    )}
                    {!loading && filtered.length === 0 && (
                        <div className="text-center py-10 text-sm text-gray-400">
                            {items.length === 0
                                ? "No exercises in your library yet. Add exercises in Databases → Exercise Library."
                                : "No exercises match your search."}
                        </div>
                    )}
                    {!loading && (
                        <div className="flex flex-col gap-2">
                            {filtered.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => { onSelect(item); onClose(); }}
                                    className="flex items-center gap-3 w-full text-left rounded-xl border border-gray-200 p-3 hover:border-blue-300 hover:bg-blue-50 transition-colors cursor-pointer"
                                >
                                    {item.thumbnail_path ? (
                                        <img
                                            src={`http://localhost:4000${item.thumbnail_path}`}
                                            alt={item.name}
                                            className="w-12 h-12 object-cover rounded-lg shrink-0"
                                        />
                                    ) : (
                                        <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center shrink-0 text-gray-400">
                                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                                            </svg>
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm text-gray-900 truncate">{item.name}</p>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {[item.muscle_group, item.equipment].filter(Boolean).join(" · ") || "No category"}
                                        </p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
