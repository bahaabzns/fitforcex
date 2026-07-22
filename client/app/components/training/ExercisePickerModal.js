"use client";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import Modal from "@/app/components/Modal";
import ExerciseFormModal from "@/app/components/training/ExerciseFormModal";
import { SearchField } from "@heroui/react/search-field";
import { Button } from "@heroui/react/button";
import { Chip } from "@heroui/react/chip";
import { Table } from "@heroui/react/table";
import { Checkbox } from "@heroui/react/checkbox";
import { Separator } from "@heroui/react/separator";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";
import { Pagination } from "@heroui/react/pagination";

const PAGE_SIZE = 10;

function getPageNumbers(currentPage, totalPages) {
    if (totalPages <= 7) {
        return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages = [1];
    if (currentPage > 3) pages.push("ellipsis");
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);
    if (currentPage < totalPages - 2) pages.push("ellipsis");
    pages.push(totalPages);
    return pages;
}

export default function ExercisePickerModal({ open, onClose, onAddExercises, single = false, title, confirmLabel }) {
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
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [page, setPage] = useState(1);

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
            setPage(1);
        }
    }, [open]);

    useEffect(() => { setPage(1); }, [search, filterGroup, filterEquipment]);

    const filtered = items.filter((item) => {
        const matchSearch = !search || item.name_en.toLowerCase().includes(search.toLowerCase()) || (item.name_ar && item.name_ar.includes(search));
        const matchGroup = !filterGroup || item.muscle_group === filterGroup;
        const matchEquipment = !filterEquipment || item.equipment === filterEquipment;
        return matchSearch && matchGroup && matchEquipment;
    });

    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pageItems = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const pageIdSet = new Set(pageItems.map(item => String(item.id)));
    const visibleSelectedKeys = new Set([...selectedIds].filter(id => pageIdSet.has(id)));

    const handleTableSelectionChange = (keys) => {
        if (single) {
            setSelectedIds(keys === "all" ? new Set() : new Set(keys));
            return;
        }
        setSelectedIds(prev => {
            const outsidePage = new Set([...prev].filter(id => !pageIdSet.has(id)));
            if (keys === "all") {
                return new Set([...outsidePage, ...pageIdSet]);
            }
            return new Set([...outsidePage, ...keys]);
        });
    };

    const handleConfirm = () => {
        const selectedItems = items.filter((item) => selectedIds.has(String(item.id)));
        onAddExercises(selectedItems);
    };

    const handleExerciseCreated = (created) => {
        setItems((prev) => [created, ...prev]);
        setSelectedIds((prev) => single ? new Set([String(created.id)]) : new Set([...prev, String(created.id)]));
        setShowCreateForm(false);
    };

    return (
        <Modal open={open} onClose={onClose} title={title ?? t('addExercises')} wide>
            <div className="flex flex-col gap-3 p-2">

                {/* Search row: field + muscle group dropdown + equipment dropdown + result count */}
                <div className="flex gap-2 items-center">
                    <SearchField
                        value={search}
                        onChange={setSearch}
                        variant="secondary"
                        className="flex-1"
                        aria-label={tFilter('searchExercises')}
                    >
                        <SearchField.Group>
                            <SearchField.SearchIcon />
                            <SearchField.Input placeholder={tFilter('searchExercises')} autoFocus />
                            <SearchField.ClearButton />
                        </SearchField.Group>
                    </SearchField>

                    <Select
                        size="sm"
                        variant="secondary"
                        value={filterGroup}
                        onChange={setFilterGroup}
                        aria-label="Muscle group filter"
                    >
                        <Select.Trigger className="min-w-36">
                            <Select.Value placeholder={tFilter('allMuscles')} />
                            <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                            <ListBox>
                                <ListBox.Item key="__all__" id="" textValue={tFilter('allMuscles')}>
                                    {tFilter('allMuscles')}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                                {muscleGroups.map(g => (
                                    <ListBox.Item key={g.name_en} id={g.name_en} textValue={g.name_en}>
                                        {g.name_en}
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                ))}
                            </ListBox>
                        </Select.Popover>
                    </Select>

                    <Select
                        size="sm"
                        variant="secondary"
                        value={filterEquipment}
                        onChange={setFilterEquipment}
                        aria-label="Equipment filter"
                    >
                        <Select.Trigger className="min-w-36">
                            <Select.Value placeholder={tFilter('allEquipment')} />
                            <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                            <ListBox>
                                <ListBox.Item key="__all__" id="" textValue={tFilter('allEquipment')}>
                                    {tFilter('allEquipment')}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                                {equipments.map(e => (
                                    <ListBox.Item key={e.name_en} id={e.name_en} textValue={e.name_en}>
                                        {e.name_en}
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                ))}
                            </ListBox>
                        </Select.Popover>
                    </Select>

                    <span className="text-sm text-muted-foreground shrink-0">
                        {filtered.length} {tFilter('results')}
                    </span>
                </div>

                {/* Table */}
                {loading ? (
                    <div className="py-12 text-center text-sm text-muted-foreground">{t('loadingExercises')}</div>
                ) : filtered.length === 0 ? (
                    <div className="py-12 text-muted-foreground flex flex-col items-center gap-3 text-center text-sm">
                        <span>
                            {items.length === 0
                                ? t('noExercisesInLibrary')
                                : t('noExercisesMatch')}
                        </span>
                        {search.trim() && (
                            <Button variant="primary" onPress={() => setShowCreateForm(true)}>
                                {t('createExerciseNamed', { name: search.trim() })}
                            </Button>
                        )}
                    </div>
                ) : (
                    <Table>
                        <Table.ScrollContainer>
                            <Table.Content
                                aria-label={title ?? t('addExercises')}
                                selectionMode={single ? "single" : "multiple"}
                                selectionBehavior="toggle"
                                selectedKeys={visibleSelectedKeys}
                                onSelectionChange={handleTableSelectionChange}
                            >
                                <Table.Header>
                                    <Table.Column id="select" className="w-8 p-2">
                                        {!single && (
                                            <Checkbox aria-label="Select all" slot="selection">
                                                <Checkbox.Control>
                                                    <Checkbox.Indicator />
                                                </Checkbox.Control>
                                            </Checkbox>
                                        )}
                                    </Table.Column>
                                    <Table.Column id="exercise" isRowHeader>{t('exerciseCol')}</Table.Column>
                                    <Table.Column id="muscleGroup">{t('muscleGroupCol')}</Table.Column>
                                    <Table.Column id="equipment">{t('equipmentCol')}</Table.Column>
                                </Table.Header>
                                <Table.Body>
                                    {pageItems.map(item => (
                                        <Table.Row
                                            key={String(item.id)}
                                            id={String(item.id)}
                                            className="cursor-pointer"
                                        >
                                            <Table.Cell className="p-2">
                                                <Checkbox
                                                    aria-label={`Select ${item.name_en}`}
                                                    slot="selection"
                                                >
                                                    <Checkbox.Control>
                                                        <Checkbox.Indicator />
                                                    </Checkbox.Control>
                                                </Checkbox>
                                            </Table.Cell>
                                            <Table.Cell className="p-2 font-medium">
                                                <div className="flex items-center gap-2">
                                                    <div className="relative w-8 h-8 rounded-md bg-secondary flex items-center justify-center shrink-0 text-muted-foreground overflow-hidden">
                                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                                            <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.348a1.125 1.125 0 010 1.971l-11.54 6.347a1.125 1.125 0 01-1.667-.985V5.653z" />
                                                        </svg>
                                                        {item.thumbnail_path && (
                                                            <img
                                                                src={item.thumbnail_path}
                                                                alt={item.name_en}
                                                                className="absolute inset-0 w-full h-full object-cover"
                                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                            />
                                                        )}
                                                    </div>
                                                    {item.name_en}
                                                </div>
                                            </Table.Cell>
                                            <Table.Cell className="p-2">
                                                {item.muscle_group ? (
                                                    <Chip size="sm" variant="soft" color="default">
                                                        <Chip.Label>{item.muscle_group}</Chip.Label>
                                                    </Chip>
                                                ) : (
                                                    <span className="text-muted-foreground/40">—</span>
                                                )}
                                            </Table.Cell>
                                            <Table.Cell className="p-2">
                                                {item.equipment ? (
                                                    <Chip size="sm" variant="soft" color="secondary">
                                                        <Chip.Label>{item.equipment}</Chip.Label>
                                                    </Chip>
                                                ) : (
                                                    <span className="text-muted-foreground/40">—</span>
                                                )}
                                            </Table.Cell>
                                        </Table.Row>
                                    ))}
                                </Table.Body>
                            </Table.Content>
                        </Table.ScrollContainer>
                    </Table>
                )}

                {/* Pagination */}
                {totalPages > 1 && (
                    <Pagination className="justify-center" size="sm">
                        <Pagination.Content>
                            <Pagination.Item>
                                <Pagination.Previous isDisabled={safePage === 1} onPress={() => setPage(p => p - 1)}>
                                    <Pagination.PreviousIcon />
                                    <span>Previous</span>
                                </Pagination.Previous>
                            </Pagination.Item>
                            {getPageNumbers(safePage, totalPages).map((p, i) =>
                                p === "ellipsis" ? (
                                    <Pagination.Item key={`ellipsis-${i}`}>
                                        <Pagination.Ellipsis />
                                    </Pagination.Item>
                                ) : (
                                    <Pagination.Item key={p}>
                                        <Pagination.Link isActive={p === safePage} onPress={() => setPage(p)}>
                                            {p}
                                        </Pagination.Link>
                                    </Pagination.Item>
                                )
                            )}
                            <Pagination.Item>
                                <Pagination.Next isDisabled={safePage === totalPages} onPress={() => setPage(p => p + 1)}>
                                    <span>Next</span>
                                    <Pagination.NextIcon />
                                </Pagination.Next>
                            </Pagination.Item>
                        </Pagination.Content>
                    </Pagination>
                )}

                {/* Footer */}
                <Separator />
                <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">
                        {selectedIds.size} {tFilter('selected')}
                    </span>
                    <div className="flex gap-3">
                        <Button
                            variant="secondary"
                            onPress={() => setSelectedIds(new Set())}
                            isDisabled={selectedIds.size === 0}
                        >
                            {tFilter('resetSelection')}
                        </Button>
                        <Button
                            variant="primary"
                            onPress={handleConfirm}
                            isDisabled={selectedIds.size === 0}
                        >
                            {confirmLabel ?? tFilter('addSelected')}
                        </Button>
                    </div>
                </div>
            </div>

        <ExerciseFormModal
            open={showCreateForm}
            onClose={() => setShowCreateForm(false)}
            initialValues={{ name_en: search.trim() }}
            muscleGroups={muscleGroups}
            equipments={equipments}
            onCreated={handleExerciseCreated}
        />
        </Modal>
    );
}
