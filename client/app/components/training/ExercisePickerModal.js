"use client";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import Modal from "@/app/components/Modal";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { Button } from "@heroui/react/button";

export default function ExercisePickerModal({ open, onClose, onAddExercises }) {
    const t = useTranslations('training');
    const tFilter = useTranslations('filter');
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
        const matchSearch = !search || item.name_en.toLowerCase().includes(search.toLowerCase()) || (item.name_ar && item.name_ar.includes(search));
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
        <Modal open={open} onClose={onClose} title={t('addExercises')} wide>
            <div className="flex flex-col" style={{ maxHeight: "70vh" }}>

                {/* Search + results count */}
                <div className="flex gap-3 mb-3 items-center">
                    <TextField value={search} onChange={setSearch} className="flex-1">
                        <Input type="text" placeholder={tFilter('searchExercises')} autoFocus />
                    </TextField>
                    <span className="text-sm text-muted-foreground shrink-0">
                        {filtered.length} {tFilter('results')}
                    </span>
                </div>

                {/* Muscle group pills */}
                <div className="flex gap-2 flex-wrap mb-2">
                    {["", ...muscleGroups.map((g) => g.name_en)].map((group) => (
                        <Button
                            key={group}
                            onClick={() => setFilterGroup(group)}
                            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                                filterGroup === group
                                    ? "bg-primary border-primary text-white"
                                    : "border-border text-muted-foreground hover:border-border"
                            }`}
                        >
                            {group || tFilter('allMuscles')}
                        </Button>
                    ))}
                </div>

                {/* Equipment pills */}
                <div className="flex gap-2 flex-wrap mb-4">
                    {["", ...equipments.map((e) => e.name_en)].map((equip) => (
                        <Button
                            key={equip}
                            onClick={() => setFilterEquipment(equip)}
                            className={`text-xs px-3 py-1 rounded-full border transition-colors ${
                                filterEquipment === equip
                                    ? "bg-violet-500 border-violet-500 text-white"
                                    : "border-border text-muted-foreground hover:border-border"
                            }`}
                        >
                            {equip || tFilter('allEquipment')}
                        </Button>
                    ))}
                </div>

                {/* Table */}
                <div className="flex-1 overflow-y-auto min-h-0">
                    {loading ? (
                        <div className="text-center py-10 text-sm text-muted-foreground">{t('loadingExercises')}</div>
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
                                    <th className="p-2">{t('exerciseCol')}</th>
                                    <th className="p-2">{t('muscleGroupCol')}</th>
                                    <th className="p-2">{t('equipmentCol')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filtered.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="text-center py-12 text-muted-foreground">
                                            {items.length === 0
                                                ? t('noExercisesInLibrary')
                                                : t('noExercisesMatch')}
                                        </td>
                                    </tr>
                                )}
                                {filtered.map((item) => (
                                    <tr
                                        key={item.id}
                                        className={`border-b cursor-pointer transition-colors hover:bg-default ${selectedIds.has(item.id) ? "bg-primary/10" : ""}`}
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
                                                        alt={item.name_en}
                                                        className="w-8 h-8 object-cover rounded-md shrink-0"
                                                    />
                                                ) : (
                                                    <div className="w-8 h-8 rounded-md bg-secondary flex items-center justify-center shrink-0 text-muted-foreground">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                                                        </svg>
                                                    </div>
                                                )}
                                                <span className="font-medium text-foreground">{item.name_en}</span>
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
                                                ? <span className="text-xs px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-600">{item.equipment}</span>
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
                    <span className="text-sm text-muted-foreground">{selectedIds.size} {tFilter('selected')}</span>
                    <div className="flex gap-3">
                        <Button
                            variant="outline"
                            onClick={() => setSelectedIds(new Set())}
                            disabled={selectedIds.size === 0}
                        >
                            {tFilter('resetSelection')}
                        </Button>
                        <Button
                            onClick={handleConfirm}
                            disabled={selectedIds.size === 0}
                        >
                            {tFilter('addSelected')}
                        </Button>
                    </div>
                </div>
            </div>
        </Modal>
    );
}
