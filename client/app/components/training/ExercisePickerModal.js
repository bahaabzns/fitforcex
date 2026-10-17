"use client";
import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import api from "@/lib/axios";
import Modal, { ModalFooter } from "@/app/components/Modal";
import ExerciseFormModal from "@/app/components/training/ExerciseFormModal";
import { SearchField } from "@heroui/react/search-field";
import { Button } from "@heroui/react/button";
import { Chip } from "@heroui/react/chip";
import { Table } from "@heroui/react/table";
import { Checkbox } from "@heroui/react/checkbox";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";
import { Pagination } from "@heroui/react/pagination";
import { getPageNumbers } from "@/utils/pagination";
import { useMediaQuery } from "@/hooks/useMediaQuery";

const PAGE_SIZE = 10;

export default function ExercisePickerModal({ open, onClose, onAddExercises, single = false, title, confirmLabel }) {
    // Phone: the 4-column table is wider than the sheet, so rows collapse to name + chips.
    const isMobile = useMediaQuery("(max-width: 767px)");
    const t = useTranslations('training');
    const tFilter = useTranslations('filter');
    const isRTL = useLocale() === 'ar';
    const localizedExerciseName = (item) => (isRTL && item?.name_ar) || item?.name_en || item?.name_ar || '';
    const [items, setItems] = useState([]);
    const [muscleGroups, setMuscleGroups] = useState([]);
    const [equipments, setEquipments] = useState([]);
    // exercise_library.muscle_group/equipment store the lookup's name_en as a
    // plain string (not a FK) — translate for display via these maps while
    // keeping the underlying value (and filter keys) in English.
    const muscleGroupNameAr = new Map(muscleGroups.map(g => [g.name_en, g.name_ar]));
    const equipmentNameAr = new Map(equipments.map(e => [e.name_en, e.name_ar]));
    const localizedMuscleGroup = (name) => (isRTL && muscleGroupNameAr.get(name)) || name || '';
    const localizedEquipment = (name) => (isRTL && equipmentNameAr.get(name)) || name || '';
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
        const selectedItems = items
            .filter((item) => selectedIds.has(String(item.id)))
            .map((item) => ({
                ...item,
                muscle_group_ar: item.muscle_group ? muscleGroupNameAr.get(item.muscle_group) ?? null : null,
                equipment_ar:    item.equipment ? equipmentNameAr.get(item.equipment) ?? null : null,
            }));
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
                <div className="flex flex-wrap gap-2 items-center">
                    <SearchField
                        value={search}
                        onChange={setSearch}
                        variant="secondary"
                        className="flex-1 max-md:basis-full"
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
                        className="max-md:flex-1 max-md:min-w-0"
                    >
                        <Select.Trigger className="min-w-36 max-md:min-w-0">
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
                                        {localizedMuscleGroup(g.name_en)}
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
                        className="max-md:flex-1 max-md:min-w-0"
                    >
                        <Select.Trigger className="min-w-36 max-md:min-w-0">
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
                                        {localizedEquipment(e.name_en)}
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                ))}
                            </ListBox>
                        </Select.Popover>
                    </Select>

                    <span className="text-sm text-muted-foreground shrink-0 max-md:basis-full">
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
                                    {!isMobile && <Table.Column id="muscleGroup">{t('muscleGroupCol')}</Table.Column>}
                                    {!isMobile && <Table.Column id="equipment">{t('equipmentCol')}</Table.Column>}
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
                                                    aria-label={`Select ${localizedExerciseName(item)}`}
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
                                                                alt={localizedExerciseName(item)}
                                                                className="absolute inset-0 w-full h-full object-cover"
                                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="min-w-0">
                                                        <div>{localizedExerciseName(item)}</div>
                                                        {isMobile && (item.muscle_group || item.equipment) && (
                                                            <div className="mt-1 flex flex-wrap gap-1">
                                                                {item.muscle_group && (
                                                                    <Chip size="sm" variant="soft" color="default">
                                                                        <Chip.Label>{localizedMuscleGroup(item.muscle_group)}</Chip.Label>
                                                                    </Chip>
                                                                )}
                                                                {item.equipment && (
                                                                    <Chip size="sm" variant="soft" color="secondary">
                                                                        <Chip.Label>{localizedEquipment(item.equipment)}</Chip.Label>
                                                                    </Chip>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </Table.Cell>
                                            {!isMobile && <Table.Cell className="p-2">
                                                {item.muscle_group ? (
                                                    <Chip size="sm" variant="soft" color="default">
                                                        <Chip.Label>{localizedMuscleGroup(item.muscle_group)}</Chip.Label>
                                                    </Chip>
                                                ) : (
                                                    <span className="text-muted-foreground/40">—</span>
                                                )}
                                            </Table.Cell>}
                                            {!isMobile && <Table.Cell className="p-2">
                                                {item.equipment ? (
                                                    <Chip size="sm" variant="soft" color="secondary">
                                                        <Chip.Label>{localizedEquipment(item.equipment)}</Chip.Label>
                                                    </Chip>
                                                ) : (
                                                    <span className="text-muted-foreground/40">—</span>
                                                )}
                                            </Table.Cell>}
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
                                    <span className="max-md:hidden">Previous</span>
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
                                    <span className="max-md:hidden">Next</span>
                                    <Pagination.NextIcon />
                                </Pagination.Next>
                            </Pagination.Item>
                        </Pagination.Content>
                    </Pagination>
                )}

                {/* Footer — pinned to the bottom of the sheet on phones (see .modal-sticky-footer) */}
                <ModalFooter className="justify-between! border-t border-border pt-3">
                    <span className="text-sm text-muted-foreground max-md:basis-full">
                        {selectedIds.size} {tFilter('selected')}
                    </span>
                    <div className="flex gap-2 max-md:w-full max-md:[&>button]:flex-1">
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
                </ModalFooter>
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
