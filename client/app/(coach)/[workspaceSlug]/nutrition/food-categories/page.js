'use client';
import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Pencil, Trash2, Tags, Merge, Undo2, Lightbulb, X } from "lucide-react";
import api from "@/lib/axios";
import DataTable from "@/app/components/DataTable";
import Modal, { ModalFooter } from "@/app/components/Modal";
import { FieldLabel } from "@/app/components/Field";
import { Button } from "@heroui/react/button";
import { Tooltip } from "@heroui/react/tooltip";
import { Skeleton } from "@heroui/react/skeleton";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { Separator } from "@heroui/react/separator";
import ActionBar from "@/app/components/ActionBar";
import { usePageTitle } from "@/hooks/usePageTitle";
import MergeCategoriesModal from "@/app/components/nutrition/MergeCategoriesModal";
import { findApplicableSuggestions } from "@/lib/foodCategoryMergeSuggestions";

const MERGES_API = "/api/nutrition/food-categories/merges";

export default function FoodCategoriesPage() {
    const t = useTranslations("foodCategories");
    const tCommon = useTranslations("common");
    const locale = useLocale();
    usePageTitle(t('pageTitle'));
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [newNameEn, setNewNameEn] = useState('');
    const [newNameAr, setNewNameAr] = useState('');
    const [editingItem, setEditingItem] = useState(null);

    // Merge categories
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [mergeOpen, setMergeOpen] = useState(false);
    const [mergeInitialTarget, setMergeInitialTarget] = useState(null);
    const [latestMerge, setLatestMerge] = useState(null); // newest merge that can still be undone
    const [undoOpen, setUndoOpen] = useState(false);
    const [undoing, setUndoing] = useState(false);
    const [undoError, setUndoError] = useState('');
    const [undoResult, setUndoResult] = useState(null); // { restored, skipped } once an undo has run
    const [suggestionsHidden, setSuggestionsHidden] = useState(false);

    const fetchCategories = async () => {
        try {
            const response = await api.get('/api/nutrition/food-categories');
            setCategories(response.data);
        } catch (error) {
            console.error('Error fetching food categories:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchLatestMerge = async () => {
        try {
            const response = await api.get(MERGES_API);
            setLatestMerge(response.data.find(m => m.can_undo) ?? null);
        } catch (error) {
            // Undo is a convenience — the page works without it.
            setLatestMerge(null);
        }
    };

    useEffect(() => { fetchCategories(); fetchLatestMerge(); }, []);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!newNameEn.trim()) return;
        try {
            await api.post('/api/nutrition/food-categories', { name_en: newNameEn.trim(), name_ar: newNameAr.trim() || null });
            setNewNameEn('');
            setNewNameAr('');
            setShowForm(false);
            await fetchCategories();
        } catch (error) {
            console.error('Error adding food category:', error);
        }
    };

    const handleUpdate = async (e) => {
        e.preventDefault();
        try {
            await api.put(`/api/nutrition/food-categories/${editingItem.id}`, { name_en: editingItem.name_en, name_ar: editingItem.name_ar || null });
            setEditingItem(null);
            await fetchCategories();
        } catch (error) {
            console.error('Error updating food category:', error);
        }
    };

    const handleDelete = async (id) => {
        try {
            await api.delete(`/api/nutrition/food-categories/${id}`);
            setCategories(categories.filter(c => c.id !== id));
        } catch (error) {
            console.error('Error deleting food category:', error);
        }
    };

    const selectedCategories = categories.filter(c => selectedIds.has(c.id));
    const suggestions = suggestionsHidden ? [] : findApplicableSuggestions(categories);

    const openMerge = (initialTarget = null) => { setMergeInitialTarget(initialTarget); setMergeOpen(true); };

    const openSuggestion = (suggestion) => {
        setSelectedIds(new Set(suggestion.categories.map(c => c.id)));
        openMerge({ name_en: suggestion.name_en, name_ar: suggestion.name_ar });
    };

    // The "Last merge" line (fed by fetchLatestMerge) is the confirmation that a merge happened.
    const handleMerged = async () => {
        setMergeOpen(false);
        setSelectedIds(new Set());
        await Promise.all([fetchCategories(), fetchLatestMerge()]);
    };

    const openUndo = () => { setUndoError(''); setUndoResult(null); setUndoOpen(true); };

    const handleUndo = async () => {
        setUndoing(true);
        setUndoError('');
        try {
            const response = await api.post(`${MERGES_API}/${latestMerge.id}/undo`);
            const { restored_items, skipped_edited, skipped_deleted } = response.data;
            // Stay in the dialog and show what happened — skipped items matter to the coach.
            setUndoResult({ restored: restored_items, skipped: skipped_edited + skipped_deleted });
            setSelectedIds(new Set());
            await Promise.all([fetchCategories(), fetchLatestMerge()]);
        } catch (error) {
            setUndoError(error?.response?.status === 403 ? t("mergeNoPermission") : (error?.response?.data?.error || t("undoError")));
        } finally {
            setUndoing(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8 flex flex-col gap-4">
                <Skeleton className="h-9 w-44 rounded-lg" />
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
            </div>
        );
    }

    const categoryColumns = [
        { key: "name_en", label: t("columnNameEn"), sortable: true },
        { key: "name_ar", label: t("columnNameAr"), render: (row) => <span dir="rtl">{row.name_ar || "—"}</span> },
        { key: "food_item_count", label: t("columnFoodItems"), sortable: true },
        { key: "actions", label: t("columnActions"), cardPriority: "hidden", render: (row) => (
            <div className="flex items-center gap-1">
                <Tooltip>
                    <Button isIconOnly size="sm" variant="ghost" aria-label={t("editButton")} onClick={() => setEditingItem(row)}>
                        <Pencil className="h-4 w-4" />
                    </Button>
                    <Tooltip.Content>{t("editButton")}</Tooltip.Content>
                </Tooltip>
                <Tooltip>
                    <Button isIconOnly size="sm" variant="ghost" aria-label={t("deleteButton")} className="text-destructive hover:text-red-700" onClick={() => handleDelete(row.id)}>
                        <Trash2 className="h-4 w-4" />
                    </Button>
                    <Tooltip.Content>{t("deleteButton")}</Tooltip.Content>
                </Tooltip>
            </div>
        )},
    ];

    return (
        <div className="p-8 flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold">{t("pageTitle")}</h1>
                <p className="text-sm text-muted-foreground mt-1">{t("pageSubtitle")}</p>
            </div>

            {suggestions.length > 0 && (
                <section className="rounded-lg border border-border p-4 flex flex-col gap-3" aria-label={t("suggestionsTitle")}>
                    <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2">
                            <Lightbulb className="h-4 w-4 mt-0.5 shrink-0" />
                            <div>
                                <h2 className="text-sm font-semibold">{t("suggestionsTitle")}</h2>
                                <p className="text-xs text-muted-foreground">{t("suggestionsHint")}</p>
                            </div>
                        </div>
                        <Button isIconOnly size="sm" variant="ghost" aria-label={t("suggestionsHide")} onClick={() => setSuggestionsHidden(true)}><X className="h-4 w-4" /></Button>
                    </div>
                    <ul className="flex flex-col gap-2">
                        {suggestions.map(suggestion => (
                            <li key={suggestion.key} className="flex flex-wrap items-center justify-between gap-2 text-sm">
                                <span>{t("suggestionLine", { names: suggestion.categories.map(c => c.name_en).join(" + "), target: suggestion.name_en })}</span>
                                <Button size="sm" variant="secondary" onClick={() => openSuggestion(suggestion)}>{t("suggestionReview")}</Button>
                            </li>
                        ))}
                    </ul>
                </section>
            )}

            {latestMerge && (
                <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg border border-border px-4 py-2.5">
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <p className="text-sm">
                            <span className="font-semibold">{t("lastMergeLabel")}:</span>{" "}
                            {t("lastMergeSummary", {
                                sources: latestMerge.source_categories.map(c => c.name_en).join(", "),
                                target: latestMerge.target_name_en,
                                count: latestMerge.items_moved,
                            })}
                            <span className="text-muted-foreground">
                                {[
                                    latestMerge.performed_by_name && t("lastMergeBy", { name: latestMerge.performed_by_name }),
                                    new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(new Date(latestMerge.created_at)),
                                ].filter(Boolean).map(part => ` · ${part}`).join("")}
                            </span>
                        </p>
                        <p className="text-xs text-muted-foreground">{t("mergedReloadHint")}</p>
                    </div>
                    <Button size="sm" variant="secondary" onClick={openUndo}>
                        <Undo2 className="h-4 w-4" />{t("undoShort")}
                    </Button>
                </div>
            )}

            <MergeCategoriesModal
                open={mergeOpen}
                onClose={() => setMergeOpen(false)}
                selected={selectedCategories}
                initialTarget={mergeInitialTarget}
                onMerged={handleMerged}
            />

            <Modal open={undoOpen} onClose={() => setUndoOpen(false)} title={t("undoTitle")}>
                {undoResult ? (
                    <div className="flex flex-col gap-4 px-1 py-1" aria-live="polite">
                        <p className="text-sm font-medium">{t("undoDone", { count: undoResult.restored })}</p>
                        {undoResult.skipped > 0 && <p className="text-sm">{t("undoSkipped", { count: undoResult.skipped })}</p>}
                        <p className="text-xs text-muted-foreground">{t("mergedReloadHint")}</p>
                        <ModalFooter>
                            <Button type="button" variant="primary" onClick={() => setUndoOpen(false)}>{tCommon("close")}</Button>
                        </ModalFooter>
                    </div>
                ) : (
                    <div className="flex flex-col gap-4 px-1 py-1">
                        <p className="text-sm">
                            {latestMerge && t("undoBody", {
                                target: latestMerge.target_name_en,
                                sources: latestMerge.source_categories.map(c => c.name_en).join(", "),
                                count: latestMerge.items_moved,
                            })}
                        </p>
                        <p className="text-xs text-muted-foreground">{t("undoNote")}</p>
                        {undoError && <p role="alert" className="text-sm text-destructive">{undoError}</p>}
                        <ModalFooter>
                            <Button type="button" variant="ghost" onClick={() => setUndoOpen(false)}>{tCommon("cancel")}</Button>
                            <Button type="button" variant="primary" onClick={handleUndo} isDisabled={undoing}>{undoing ? t("undoing") : t("undoConfirm")}</Button>
                        </ModalFooter>
                    </div>
                )}
            </Modal>

            <Modal open={showForm} onClose={() => { setShowForm(false); setNewNameEn(''); setNewNameAr(''); }} title={t("addTitle")}>
                <form onSubmit={handleAdd} className="flex flex-col gap-5 px-1 py-1">
                    <div className="flex gap-2">
                        <div className="flex flex-1 flex-col gap-1.5">
                            <FieldLabel required>{t("labelNameEn")}</FieldLabel>
                            <TextField variant="secondary" fullWidth isRequired aria-label={t("labelNameEn")} value={newNameEn} onChange={setNewNameEn}>
                                <Input type="text" placeholder={t("placeholderNameEn")} autoFocus />
                            </TextField>
                        </div>
                        <div className="flex flex-1 flex-col gap-1.5">
                            <FieldLabel>{t("labelNameAr")}</FieldLabel>
                            <TextField variant="secondary" fullWidth aria-label={t("labelNameAr")} value={newNameAr} onChange={setNewNameAr}>
                                <Input type="text" placeholder={t("placeholderNameAr")} dir="rtl" />
                            </TextField>
                        </div>
                    </div>
                    <ModalFooter>
                        <Button type="button" variant="ghost" onClick={() => { setShowForm(false); setNewNameEn(''); setNewNameAr(''); }}>{tCommon("cancel")}</Button>
                        <Button type="submit" variant="primary">{t("submitAdd")}</Button>
                    </ModalFooter>
                </form>
            </Modal>

            <Modal open={!!editingItem} onClose={() => setEditingItem(null)} title={t("editTitle")}>
                <form onSubmit={handleUpdate} className="flex flex-col gap-5 px-1 py-1">
                    <div className="flex gap-2">
                        <div className="flex flex-1 flex-col gap-1.5">
                            <FieldLabel required>{t("labelNameEn")}</FieldLabel>
                            <TextField variant="secondary" fullWidth isRequired aria-label={t("labelNameEn")} value={editingItem?.name_en || ''} onChange={(val) => setEditingItem({ ...editingItem, name_en: val })}>
                                <Input type="text" autoFocus />
                            </TextField>
                        </div>
                        <div className="flex flex-1 flex-col gap-1.5">
                            <FieldLabel>{t("labelNameAr")}</FieldLabel>
                            <TextField variant="secondary" fullWidth aria-label={t("labelNameAr")} value={editingItem?.name_ar || ''} onChange={(val) => setEditingItem({ ...editingItem, name_ar: val })}>
                                <Input type="text" dir="rtl" />
                            </TextField>
                        </div>
                    </div>
                    <ModalFooter>
                        <Button type="button" variant="ghost" onClick={() => setEditingItem(null)}>{tCommon("cancel")}</Button>
                        <Button type="submit" variant="primary">{t("submitEdit")}</Button>
                    </ModalFooter>
                </form>
            </Modal>

            <DataTable
                columns={categoryColumns}
                data={categories}
                rowKey="id"
                selectable
                selectedKeys={selectedIds}
                onSelectionChange={setSelectedIds}
                mobileListView
                quickSearch={{ fields: ["name_en", "name_ar"], placeholder: t("searchPlaceholder") }}
                emptyState={{
                    icon: Tags,
                    title: t("emptyTitle"),
                    description: t("emptyHint"),
                    action: { label: t("addButton"), onPress: () => setShowForm(true) },
                }}
                toolbarEnd={(
                    <div className="flex flex-wrap items-center gap-2">
                        <Button variant="primary" onClick={() => setShowForm(!showForm)}>{t("addButton")}</Button>
                    </div>
                )}
            />

            {/* Floating bulk action bar — same component/pattern as the Clients and Plans Queue tables. */}
            <ActionBar isOpen={selectedIds.size > 0} aria-label={t("selectedBar", { count: selectedIds.size })}>
                <ActionBar.Prefix>
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-default px-1.5 text-xs font-semibold text-foreground">
                        {selectedIds.size}
                    </span>
                </ActionBar.Prefix>
                <Separator orientation="vertical" className="h-6" />
                <ActionBar.Content>
                    <Button variant="ghost" size="sm" isDisabled={selectedIds.size < 2} onClick={() => openMerge()}>
                        <Merge className="w-4 h-4" />
                        <span className="action-bar__label">{selectedIds.size < 2 ? t("mergeNeedTwo") : t("mergeButton")}</span>
                    </Button>
                </ActionBar.Content>
                <Separator orientation="vertical" className="h-6" />
                <ActionBar.Suffix>
                    <Tooltip>
                        <Button isIconOnly variant="ghost" size="sm" aria-label={t("clearSelection")} onClick={() => setSelectedIds(new Set())}>
                            <X className="w-4 h-4" />
                        </Button>
                        <Tooltip.Content>{t("clearSelection")}</Tooltip.Content>
                    </Tooltip>
                </ActionBar.Suffix>
            </ActionBar>
        </div>
    );
}
