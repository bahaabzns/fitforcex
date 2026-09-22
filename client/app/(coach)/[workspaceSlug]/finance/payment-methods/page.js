"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { ChevronRight, ListFilter, Pencil, Plus, Power, Trash2, CreditCard } from "lucide-react";
import Modal, { ModalFooter } from "@/app/components/Modal";
import EmptyState from "@/app/components/EmptyState";
import { FieldLabel } from "@/app/components/Field";
import api from "@/lib/axios";
import { useDateFormatter } from "@/utils/useDateFormatter";
import { Button } from "@heroui/react/button";
import { Table } from "@heroui/react/table";
import { SearchField } from "@heroui/react/search-field";
import { Tooltip } from "@heroui/react/tooltip";
import { Skeleton } from "@heroui/react/skeleton";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { usePageTitle } from "@/hooks/usePageTitle";

const TYPES = ["cash", "card", "wallet", "bank_transfer"];

// Row action items that stay hidden until the row is hovered or an action is focused.
// table-row-actions: same marker class DataTable.js uses — picks up the
// [data-real-hover] reveal rule in globals.css (see the comment there for
// why plain group-hover isn't enough: react-aria disables its own hover
// tracking for rows that aren't selectable/actionable, which this tree
// table isn't, and neither is @media (hover: hover) reliable on its own).
const HOVER_ACTIONS = "table-row-actions flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100";

export default function PaymentMethodsPage() {
    const { formatDate } = useDateFormatter();
    const t = useTranslations('paymentMethods');
    const tCommon = useTranslations('common');
    const tFilter = useTranslations('filter');
    usePageTitle(t('title'));

    const TYPE_LABELS = {
        cash:          t('typeCash'),
        card:          t('typeCard'),
        wallet:        t('typeWallet'),
        bank_transfer: t('typeBankTransfer'),
    };

    const [methods, setMethods] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    // Which type groups are expanded to reveal their methods (react-aria tree keys).
    const [expandedTypes, setExpandedTypes] = useState(() => new Set());
    // Status filter (no name filter — methods are searched by name instead).
    const [filtersOpen, setFiltersOpen] = useState(false);
    const [pendingFilterKey, setPendingFilterKey] = useState(null);
    const [statusFilter, setStatusFilter] = useState([]); // [] = all; subset of ["active","inactive"]

    // Create modal (new method) + edit modal (existing method, name + type)
    const [showForm, setShowForm] = useState(false);
    const [formName, setFormName] = useState("");
    const [formType, setFormType] = useState("cash");
    const [editingMethod, setEditingMethod] = useState(null); // { id, name, type } | null
    const [error, setError] = useState("");

    const searchRef = useRef(null);

    useEffect(() => {
        api.get("/api/payment-methods")
            .then(res => setMethods(res.data ?? []))
            .catch(() => setMethods([]))
            .finally(() => setLoading(false));
    }, []);

    // Ctrl+K focuses the quick search (matches the shared DataTable shortcut).
    useEffect(() => {
        function onKeyDown(e) {
            if (e.ctrlKey && (e.key === "k" || e.key === "K")) {
                e.preventDefault();
                searchRef.current?.querySelector("input")?.focus();
            }
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, []);

    // ── Filtering ─────────────────────────────────────────────
    const query = search.trim().toLowerCase();

    function methodPassesFilters(m) {
        if (statusFilter.length > 0) {
            if (m.active && !statusFilter.includes("active")) return false;
            if (!m.active && !statusFilter.includes("inactive")) return false;
        }
        return true;
    }

    function clearFilters() {
        setStatusFilter([]);
    }

    const filterChips = [];
    if (statusFilter.length > 0) {
        filterChips.push({
            key: "status",
            label: t('statusFilterLabel'),
            value: statusFilter.map(s => s === "active" ? t('active') : t('inactive')).join(", "),
            clear: () => setStatusFilter([]),
        });
    }

    // Tree rows: each payment-method type is a parent row whose children are the
    // (visible) methods of that type. Empty types drop out.
    const treeRows = TYPES
        .map(type => {
            const typeMethods = methods.filter(m =>
                m.type === type &&
                methodPassesFilters(m) &&
                (!query || m.name.toLowerCase().includes(query)));
            return { type, typeMethods };
        })
        .filter(({ typeMethods }) => typeMethods.length > 0)
        .map(({ type, typeMethods }) => ({
            id: `type-${type}`,
            kind: "type",
            type,
            name: TYPE_LABELS[type],
            children: typeMethods.map(m => ({
                id: `method-${m.id}`,
                kind: "method",
                name: m.name,
                method: m,
                children: [],
            })),
        }));

    // ── Actions ───────────────────────────────────────────────
    async function handleToggleActive(id, currentActive) {
        try {
            const res = await api.put("/api/payment-methods", { id, active: !currentActive });
            setMethods(prev => prev.map(m => m.id === res.data.id ? res.data : m));
        } catch (err) {
            setError(err.response?.data?.error || t('errorUpdate'));
        }
    }

    function startEditMethod(m) {
        setError("");
        setEditingMethod({ id: m.id, name: m.name, type: m.type });
    }

    async function handleSaveMethod(e) {
        e.preventDefault();
        if (!editingMethod) return;
        if (!editingMethod.name?.trim()) { setError(t('errorNameRequired')); return; }
        try {
            const res = await api.put("/api/payment-methods", {
                id: editingMethod.id,
                name: editingMethod.name.trim(),
                type: editingMethod.type,
            });
            setMethods(prev => prev.map(m => m.id === res.data.id ? res.data : m));
            setEditingMethod(null);
            setError("");
        } catch (err) {
            setError(err.response?.data?.error || t('errorSave'));
        }
    }

    async function handleDelete(id) {
        try {
            await api.delete(`/api/payment-methods?id=${id}`);
            setMethods(prev => prev.filter(m => m.id !== id));
        } catch (err) {
            setError(err.response?.data?.error || t('errorDelete'));
        }
    }

    function openCreate(type) {
        setError("");
        setFormName("");
        setFormType(type ?? "cash");
        setShowForm(true);
    }

    async function handleSubmit(e) {
        e.preventDefault();
        setError("");
        if (!formName.trim()) { setError(t('errorNameRequired')); return; }
        try {
            const res = await api.post("/api/payment-methods", { name: formName.trim(), type: formType });
            setMethods(prev => [...prev, res.data]);
            setFormName("");
            setFormType("cash");
            setShowForm(false);
        } catch (err) {
            setError(err.response?.data?.error || t('errorCreate'));
        }
    }

    function toggleActiveButton(isActive, onToggle) {
        const label = isActive ? tCommon('deactivate') : tCommon('activate');
        return (
            <Tooltip>
                <Button isIconOnly size="sm" variant="ghost" aria-label={label} className={isActive ? "text-green-600 hover:text-green-700" : "text-muted-foreground hover:text-foreground"} onClick={onToggle}>
                    <Power className="h-4 w-4" />
                </Button>
                <Tooltip.Content>{label}</Tooltip.Content>
            </Tooltip>
        );
    }

    function typeActions(type) {
        return (
            <div className="flex items-center gap-1 justify-end">
                <span className={HOVER_ACTIONS}>
                    <Tooltip>
                        <Button isIconOnly size="sm" variant="ghost" aria-label={t('newMethod')} onClick={() => openCreate(type)}>
                            <Plus className="h-4 w-4" />
                        </Button>
                        <Tooltip.Content>{t('newMethod')}</Tooltip.Content>
                    </Tooltip>
                </span>
            </div>
        );
    }

    function methodActions(m) {
        return (
            <div className="flex items-center gap-1 justify-end">
                {/* Visible only when the row is hovered (or an action is focused). */}
                <span className={HOVER_ACTIONS}>
                    <Tooltip>
                        <Button isIconOnly size="sm" variant="ghost" aria-label={tCommon('edit')} onClick={() => startEditMethod(m)}>
                            <Pencil className="h-4 w-4" />
                        </Button>
                        <Tooltip.Content>{tCommon('edit')}</Tooltip.Content>
                    </Tooltip>
                    <Tooltip>
                        <Button isIconOnly size="sm" variant="ghost" aria-label={tCommon('delete')} className="text-destructive hover:text-red-700" onClick={() => handleDelete(m.id)}>
                            <Trash2 className="h-4 w-4" />
                        </Button>
                        <Tooltip.Content>{tCommon('delete')}</Tooltip.Content>
                    </Tooltip>
                </span>
                {toggleActiveButton(m.active, () => handleToggleActive(m.id, m.active))}
            </div>
        );
    }

    // Single render fn for both type (parent) and method (child) rows.
    function renderTreeRow(row) {
        const isType = row.kind === "type";
        const m = row.method;
        return (
            <Table.Row
                id={row.id}
                textValue={row.name}
                className="group"
                // See DataTable.js's identical handlers for why: react-aria's
                // own [data-hovered] tracking is disabled for non-selectable,
                // non-actionable rows (this tree table is neither), so we set
                // our own attribute directly on the DOM node instead.
                onPointerEnter={(e) => { if (e.pointerType !== "touch") e.currentTarget.setAttribute("data-real-hover", "true"); }}
                onPointerLeave={(e) => { if (e.pointerType !== "touch") e.currentTarget.removeAttribute("data-real-hover"); }}
            >
                <Table.Cell textValue={row.name}>
                    {({ hasChildItems, isExpanded, isTreeColumn }) => (
                        <span className="flex items-center gap-1.5">
                            {hasChildItems && isTreeColumn ? (
                                <Button isIconOnly slot="chevron" size="sm" variant="ghost" aria-label={isExpanded ? tCommon('collapse') : tCommon('expand')}>
                                    <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-90" : "rtl:rotate-180"}`} />
                                </Button>
                            ) : null}
                            <span className={isType ? "font-medium text-accent" : "text-foreground"}>{row.name}</span>
                            {isType && (
                                <span className="text-xs text-muted-foreground">· {t('methodCount', { count: row.children.length })}</span>
                            )}
                        </span>
                    )}
                </Table.Cell>
                <Table.Cell>{isType ? null : formatDate(m.created_at)}</Table.Cell>
                <Table.Cell className="text-end">{isType ? typeActions(row.type) : methodActions(m)}</Table.Cell>
                <Table.Collection items={row.children}>{renderTreeRow}</Table.Collection>
            </Table.Row>
        );
    }

    // Type picker shared by the create + edit modals.
    function typePicker(value, onChange) {
        return (
            <div className="flex gap-2 flex-wrap">
                {TYPES.map(typeKey => (
                    <Button
                        key={typeKey}
                        type="button"
                        onClick={() => onChange(typeKey)}
                        className={`px-3 py-1.5 text-sm font-medium border ${
                            value === typeKey
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-background text-muted-foreground hover:border-primary hover:text-primary"
                        }`}
                    >
                        {TYPE_LABELS[typeKey]}
                    </Button>
                ))}
            </div>
        );
    }

    if (loading) {
        return (
            <div className="p-8 flex flex-col gap-6">
                <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
                <div className="flex flex-col gap-2">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
                </div>
            </div>
        );
    }

    return (
        <div className="p-8 flex flex-col gap-6">
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
                <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
            </div>

            {/* Toggle/delete errors (create + edit errors render inside their modals) */}
            {!showForm && !editingMethod && error && <p className="text-destructive text-sm">{error}</p>}

            {/* New Method Modal */}
            <Modal open={showForm} onClose={() => { setShowForm(false); setError(""); }} title={t('newMethodTitle')}>
                <form onSubmit={handleSubmit} className="flex flex-col gap-5 px-4 py-1">
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel required>{t('nameLabel')}</FieldLabel>
                        <TextField variant="secondary" fullWidth aria-label={t('nameLabel')} value={formName} onChange={setFormName}>
                            <Input type="text" placeholder={t('namePlaceholder')} autoFocus />
                        </TextField>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel required>{t('typeLabel')}</FieldLabel>
                        {typePicker(formType, setFormType)}
                    </div>

                    {error && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                            <p className="text-destructive text-xs">{error}</p>
                        </div>
                    )}

                    <ModalFooter>
                        <Button type="button" variant="ghost" onClick={() => { setShowForm(false); setError(""); }}>
                            {tCommon('cancel')}
                        </Button>
                        <Button type="submit" variant="primary">
                            {t('createMethod')}
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>

            {/* Edit Method Modal — name + type (active is toggled from the table) */}
            <Modal open={!!editingMethod} onClose={() => { setEditingMethod(null); setError(""); }} title={t('editMethodTitle')}>
                <form onSubmit={handleSaveMethod} className="flex flex-col gap-5 px-4 py-1">
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel required>{t('nameLabel')}</FieldLabel>
                        <TextField variant="secondary" fullWidth aria-label={t('nameLabel')} value={editingMethod?.name ?? ""} onChange={(val) => setEditingMethod(em => ({ ...em, name: val }))}>
                            <Input type="text" placeholder={t('namePlaceholder')} />
                        </TextField>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel required>{t('typeLabel')}</FieldLabel>
                        {typePicker(editingMethod?.type ?? "cash", (typeKey) => setEditingMethod(em => ({ ...em, type: typeKey })))}
                    </div>

                    {error && (
                        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
                            <p className="text-destructive text-xs">{error}</p>
                        </div>
                    )}

                    <ModalFooter>
                        <Button type="button" variant="ghost" onClick={() => { setEditingMethod(null); setError(""); }}>
                            {tCommon('cancel')}
                        </Button>
                        <Button type="submit" variant="primary">
                            {t('save')}
                        </Button>
                    </ModalFooter>
                </form>
            </Modal>

            {/* Toolbar: quick search + filter + New Method */}
            <div className="flex items-center gap-2">
                <div ref={searchRef} className="max-w-xs w-full">
                    <SearchField
                        value={search}
                        onChange={setSearch}
                        onClear={() => setSearch("")}
                        aria-label={t('searchPlaceholder')}
                        fullWidth
                    >
                        <SearchField.Group>
                            <SearchField.SearchIcon />
                            <SearchField.Input className="py-2" placeholder={t('searchPlaceholder')} />
                            <SearchField.ClearButton />
                        </SearchField.Group>
                    </SearchField>
                </div>

                {/* Filter — same pattern as the shared DataTable: field list → side sub-panel */}
                <div className="relative">
                    {filtersOpen && <div className="fixed inset-0 z-10" onClick={() => { setFiltersOpen(false); setPendingFilterKey(null); }} />}
                    <Button size="sm" variant="secondary" onClick={() => setFiltersOpen(o => !o)}>
                        <ListFilter size={14} />
                        {tFilter('filterButton')}
                    </Button>
                    {filtersOpen && (
                        <div className="absolute z-20 top-full mt-1 bg-card border border-border rounded-xl shadow-md p-2 flex flex-col gap-1 min-w-48">
                            <div className="relative">
                                <button
                                    className={`w-full text-left text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center justify-between ${pendingFilterKey === "status" ? "bg-primary/10 text-primary" : "hover:bg-default"}`}
                                    onClick={() => setPendingFilterKey(pendingFilterKey === "status" ? null : "status")}
                                >
                                    {t('statusFilterLabel')}
                                    <ChevronRight size={14} className="text-muted-foreground shrink-0 rtl:rotate-180" />
                                </button>
                                {pendingFilterKey === "status" && (
                                    <div className="absolute z-30 ltr:left-full rtl:right-full top-0 ltr:ml-1 rtl:mr-1 bg-card border border-border rounded-xl shadow-md p-2 flex flex-col gap-0.5 min-w-44">
                                        {[["active", t('active')], ["inactive", t('inactive')]].map(([value, label]) => (
                                            <label key={value} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-default cursor-pointer text-sm select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={statusFilter.includes(value)}
                                                    onChange={(e) => setStatusFilter(prev => e.target.checked ? [...prev, value] : prev.filter(s => s !== value))}
                                                    className="rounded"
                                                />
                                                {label}
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                <div className="ms-auto">
                    <Button variant="primary" onClick={() => openCreate()}>
                        {t('newMethod')}
                    </Button>
                </div>
            </div>

            {/* Active filter chips */}
            {filterChips.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap">
                    {filterChips.map(chip => (
                        <div key={chip.key} className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm border border-primary/20">
                            <span className="font-medium">{chip.label}:</span>
                            <span>{chip.value}</span>
                            <button className="ml-0.5 hover:text-destructive transition-colors leading-none" onClick={chip.clear}>✕</button>
                        </div>
                    ))}
                    <Button size="sm" variant="ghost" onClick={clearFilters}>
                        {tFilter('clearAll')}
                    </Button>
                </div>
            )}

            {/* Expandable table — types as parent rows, methods as children */}
            <Table>
                <Table.ScrollContainer>
                    <Table.Content
                        aria-label={t('title')}
                        treeColumn="name"
                        expandedKeys={expandedTypes}
                        onExpandedChange={setExpandedTypes}
                    >
                        <Table.Header>
                            <Table.Column isRowHeader id="name">{t('nameLabel')}</Table.Column>
                            <Table.Column id="created">{t('createdLabel')}</Table.Column>
                            <Table.Column id="actions"><span className="sr-only">{tCommon('edit')}</span></Table.Column>
                        </Table.Header>
                        <Table.Body items={treeRows}>{renderTreeRow}</Table.Body>
                    </Table.Content>
                </Table.ScrollContainer>
            </Table>

            {treeRows.length === 0 && (
                methods.length === 0 ? (
                    <EmptyState
                        variant="firstTime"
                        icon={CreditCard}
                        title={t('emptyTitle')}
                        description={t('emptyHint')}
                        action={{ label: t('newMethod'), onPress: () => openCreate() }}
                    />
                ) : (
                    <EmptyState
                        variant={search ? "search" : "filter"}
                        title={search ? tFilter('searchEmptyTitle') : tFilter('filterEmptyTitle')}
                        description={search ? tFilter('searchEmptyHint') : tFilter('filterEmptyHint')}
                        action={{
                            label: search && filterChips.length > 0
                                ? tFilter('clearAll')
                                : search ? tFilter('clearSearch') : tFilter('clearFilters'),
                            onPress: () => { setSearch(""); clearFilters(); },
                        }}
                    />
                )
            )}
        </div>
    );
}
