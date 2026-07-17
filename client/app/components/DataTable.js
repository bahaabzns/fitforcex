"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, ChevronsUpDown, ListFilter } from 'lucide-react';
import { Table } from "@heroui/react/table";
import { Checkbox } from "@heroui/react/checkbox";
import { Pagination } from "@heroui/react/pagination";
import { Button } from "@heroui/react/button";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";
import { DateField } from "@heroui/react/date-field";
import { DateRangePicker } from "@heroui/react/date-range-picker";
import { RangeCalendar } from "@heroui/react/range-calendar";
import { SearchField } from "@heroui/react/search-field";
import { Kbd } from "@heroui/react/kbd";
import { Description } from "@heroui/react/description";
import { parseDate } from "@internationalized/date";
import { useTranslations, useLocale } from "next-intl";
import EmptyState from "./EmptyState";

// ============================================================
// DataTable — Reusable filterable/sortable table using HeroUI
// ============================================================
// Props (same external API as before):
//   columns  — array of column definitions
//   data     — array of row objects
//   rowKey   — string: which field to use as React key / row id
//   dateParser — optional: (dateString) => Date
//   selectable — boolean
//   selectedKeys — Set (controlled)
//   onSelectionChange — (newSet) => void
//   renderExpandedRow — (row) => <tr>...</tr> | null
//   renderMobileExpanded — (row) => JSX
//   scrollable — boolean
//   defaultSort / defaultSortDirection
//   emptyState — first-time (no data at all) config: { icon, title, description, action }.
//                action = { label, onPress, icon }. Omit for tables the user can't
//                populate themselves. Search/filter empties are handled automatically.

// Action columns use either key convention across the app. They get no visible
// header and their buttons sit flush-right, revealed on row hover.
const isActionsColumn = (key) => key === "_actions" || key === "actions";

// The text/multi/dateRange filter body for one column, shared between the
// "Other Filters" dropdown's per-column flyout and each pinned filter button
// below — same controls, just a different value/onChange wiring per caller.
function renderFilterFields(col, value, onChange) {
    if (col.filterType === "text") {
        return (
            <SearchField
                autoFocus
                value={value ?? ""}
                onChange={onChange}
                aria-label={`Search ${col.label}`}
                fullWidth
            >
                <SearchField.Group>
                    <SearchField.SearchIcon />
                    <SearchField.Input placeholder={`Search ${col.label.toLowerCase()}...`} />
                    <SearchField.ClearButton />
                </SearchField.Group>
            </SearchField>
        );
    }

    if (col.filterType === "multi") {
        return (
            <div className="flex flex-col gap-0.5 max-h-48 overflow-y-auto">
                {col.options.map(option => (
                    <label
                        key={option ?? "__null__"}
                        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-default cursor-pointer text-sm select-none"
                    >
                        <input
                            type="checkbox"
                            checked={(value ?? []).includes(option)}
                            onChange={e => {
                                const next = e.target.checked
                                    ? [...(value ?? []), option]
                                    : (value ?? []).filter(v => v !== option);
                                onChange(next);
                            }}
                            className="rounded"
                        />
                        {col.optionLabel ? col.optionLabel(option) : option}
                    </label>
                ))}
            </div>
        );
    }

    if (col.filterType === "dateRange") {
        return (
            <DateRangePicker
                value={
                    (value?.from && value?.to)
                        ? { start: parseDate(value.from), end: parseDate(value.to) }
                        : null
                }
                onChange={(range) => {
                    onChange({ from: range?.start?.toString() ?? "", to: range?.end?.toString() ?? "" });
                }}
            >
                <DateField.Group fullWidth>
                    <DateField.Input slot="start">
                        {(segment) => <DateField.Segment segment={segment} />}
                    </DateField.Input>
                    <DateRangePicker.RangeSeparator />
                    <DateField.Input slot="end">
                        {(segment) => <DateField.Segment segment={segment} />}
                    </DateField.Input>
                    <DateField.Suffix>
                        <DateRangePicker.Trigger>
                            <DateRangePicker.TriggerIndicator />
                        </DateRangePicker.Trigger>
                    </DateField.Suffix>
                </DateField.Group>
                <DateRangePicker.Popover>
                    <RangeCalendar aria-label={col.label}>
                        <RangeCalendar.Header>
                            <RangeCalendar.YearPickerTrigger>
                                <RangeCalendar.YearPickerTriggerHeading />
                                <RangeCalendar.YearPickerTriggerIndicator />
                            </RangeCalendar.YearPickerTrigger>
                            <RangeCalendar.NavButton slot="previous" />
                            <RangeCalendar.NavButton slot="next" />
                        </RangeCalendar.Header>
                        <RangeCalendar.Grid>
                            <RangeCalendar.GridHeader>
                                {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
                            </RangeCalendar.GridHeader>
                            <RangeCalendar.GridBody>
                                {(date) => <RangeCalendar.Cell date={date} />}
                            </RangeCalendar.GridBody>
                        </RangeCalendar.Grid>
                        <RangeCalendar.YearPickerGrid>
                            <RangeCalendar.YearPickerGridBody>
                                {({ year }) => <RangeCalendar.YearPickerCell year={year} />}
                            </RangeCalendar.YearPickerGridBody>
                        </RangeCalendar.YearPickerGrid>
                    </RangeCalendar>
                </DateRangePicker.Popover>
            </DateRangePicker>
        );
    }

    return null;
}

// A single-column filter, pinned into the toolbar next to "Other Filters" so
// it's reachable in one click instead of two. Reads/writes straight from the
// shared filterRules (via upsertFilter) — no local draft state needed since,
// unlike the general dropdown, each instance is permanently scoped to one column.
function PinnedFilterButton({ col, filterRules, upsertFilter }) {
    const [open, setOpen] = useState(false);
    const existingRule = filterRules.find(r => r.colKey === col.key);
    const defaultValue = col.filterType === "multi" ? [] : col.filterType === "dateRange" ? { from: "", to: "" } : "";
    const value = existingRule?.value ?? defaultValue;
    const Icon = col.icon;

    return (
        <div className="relative">
            {open && <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />}
            <Button
                size="sm"
                variant="secondary"
                onClick={() => setOpen(v => !v)}
                className={existingRule ? "ring-1 ring-primary/50 text-primary" : ""}
            >
                {Icon && <Icon size={14} />}
                {col.label}
            </Button>
            {open && (
                <div className="absolute z-20 top-full mt-1 bg-card border border-border rounded-xl shadow-md p-3 flex flex-col gap-3 min-w-56">
                    {renderFilterFields(col, value, (next) => upsertFilter(col.key, next))}
                </div>
            )}
        </div>
    );
}

export default function DataTable({
    columns,
    data,
    rowKey,
    dateParser,
    onFilteredDataChange,
    selectable,
    selectedKeys,
    onSelectionChange,
    renderExpandedRow,
    renderMobileExpanded,
    scrollable,
    defaultSort,
    defaultSortDirection,
    quickSearch,
    toolbarEnd,
    rowClassName,
    emptyState,
    // Opt-in: when set, search/filter/sort/page-size are snapshotted to
    // sessionStorage under this key and restored on mount, so navigating away
    // and back (e.g. a full remount) doesn't reset the coach's view. Scoped to
    // the tab (not localStorage) since a stale filter shouldn't outlive it.
    persistKey,
    // Opt-in: a rowKey value to auto-jump to (paging-wise) once it's present
    // in the filtered/sorted data — used to surface a row that was just acted
    // on from elsewhere (e.g. "mark as done") without fighting the coach's
    // current filters.
    highlightKey,
    // Optional override for the general filter button's label — defaults to the
    // shared "Filter" translation. Callers that pin some columns out of it (see
    // `pinned` on a column) typically rename it to something like "Other Filters".
    filterButtonLabel,
}) {
    const t = useTranslations('filter');
    const locale = useLocale();
    const isRtl = locale === 'ar';
    // RTL mode swaps which corners are rounded; this must match HeroUI's own table radius or the border visually misaligns
    const CORNER_RADIUS = 'var(--radius-2xl)';

    // ── Persisted view state (opt-in via persistKey) ────────────
    // Read once via useState's lazy initializer (not a ref read during
    // render) — sessionStorage is a sync API and this only needs to seed the
    // useState values below.
    const [persisted] = useState(() => {
        if (!persistKey || typeof window === "undefined") return null;
        try {
            return JSON.parse(sessionStorage.getItem(`datatable:${persistKey}`)) ?? null;
        } catch {
            return null;
        }
    });

    // ── Quick search ──────────────────────────────────────────
    const [quickSearchValue, setQuickSearchValue] = useState(() => persisted?.quickSearchValue ?? "");
    const [searchFocused, setSearchFocused] = useState(false);
    const searchContainerRef = useRef(null);

    useEffect(() => {
        if (!quickSearch) return;
        function handleKeyDown(e) {
            if (e.ctrlKey && e.key === "k") {
                e.preventDefault();
                searchContainerRef.current?.querySelector("input")?.focus();
            }
        }
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [!!quickSearch]);

    // ── Filters ──────────────────────────────────────────────
    // Each rule: { id: string, colKey: string, value: any }
    const [filterRules, setFilterRules]     = useState(() => persisted?.filterRules ?? []);
    const [addFilterOpen, setAddFilterOpen] = useState(false);
    const [pendingColKey, setPendingColKey] = useState(null);
    const [pendingValue, setPendingValue]   = useState(null);

    useEffect(() => {
        if (!pendingColKey) { setPendingValue(null); return; }
        const col = columns.find(c => c.key === pendingColKey);
        const existing = filterRules.find(r => r.colKey === pendingColKey);
        if (existing) { setPendingValue(existing.value); return; }
        if (col.filterType === "text")      setPendingValue("");
        if (col.filterType === "multi")     setPendingValue([]);
        if (col.filterType === "dateRange") setPendingValue({ from: "", to: "" });
    }, [pendingColKey]);

    const hasActiveFilters = filterRules.length > 0;
    const pendingCol = pendingColKey ? columns.find(c => c.key === pendingColKey) : null;

    function summarizeFilter(rule, col) {
        if (col.filterType === "text")      return `"${rule.value}"`;
        if (col.filterType === "multi")     return rule.value.map(v => col.optionLabel ? col.optionLabel(v) : v).join(", ");
        if (col.filterType === "dateRange") {
            const { from, to } = rule.value;
            if (from && to) return `${from} – ${to}`;
            if (from) return `from ${from}`;
            return `until ${to}`;
        }
        return String(rule.value);
    }

    function upsertFilter(colKey, value) {
        const isEmpty =
            (typeof value === "string" && value === "") ||
            (Array.isArray(value) && value.length === 0) ||
            (typeof value === "object" && !Array.isArray(value) && !value?.from && !value?.to);
        if (isEmpty) {
            setFilterRules(rs => rs.filter(r => r.colKey !== colKey));
        } else {
            setFilterRules(rs => {
                const exists = rs.some(r => r.colKey === colKey);
                if (exists) return rs.map(r => r.colKey === colKey ? { ...r, value } : r);
                return [...rs, { id: String(Date.now() + Math.random()), colKey, value }];
            });
        }
    }

    // ── Sort ──────────────────────────────────────────────────
    const [sortKey, setSortKey]             = useState(() => persisted?.sortKey ?? defaultSort ?? null);
    const [sortDirection, setSortDirection] = useState(() => persisted?.sortDirection ?? defaultSortDirection ?? "asc");

    const sortDescriptor = sortKey
        ? { column: sortKey, direction: sortDirection === "asc" ? "ascending" : "descending" }
        : undefined;

    function handleSortChange(descriptor) {
        const col = String(descriptor.column);
        if (sortKey === col) {
            if (sortDirection === "asc") {
                setSortDirection("desc");
            } else {
                setSortKey(null);
                setSortDirection("asc");
            }
        } else {
            setSortKey(col);
            setSortDirection("asc");
        }
    }

    // ── Filtered + sorted data ────────────────────────────────
    const baseData = quickSearch && quickSearchValue
        ? data.filter(row => {
            const q = quickSearchValue.toLowerCase();
            return quickSearch.fields.some(field =>
                String(row[field] ?? "").toLowerCase().includes(q)
            );
        })
        : data;

    const filteredData = baseData.filter(row => {
        for (const rule of filterRules) {
            const col = columns.find(c => c.key === rule.colKey);
            if (!col) continue;
            if (col.filterType === "text") {
                if (rule.value && !String(row[col.key]).toLowerCase().includes(rule.value.toLowerCase())) return false;
            }
            if (col.filterType === "multi") {
                const cellVal = col.filterValue ? col.filterValue(row) : row[col.key];
                if (rule.value.length > 0 && !rule.value.includes(cellVal)) return false;
            }
            if (col.filterType === "dateRange" && dateParser) {
                if (rule.value.from || rule.value.to) {
                    const rowDate = dateParser(row[col.key]);
                    if (rule.value.from && rowDate < new Date(rule.value.from)) return false;
                    if (rule.value.to) {
                        const toDate = new Date(rule.value.to);
                        toDate.setHours(23, 59, 59, 999);
                        if (rowDate > toDate) return false;
                    }
                }
            }
        }
        return true;
    });

    // Opt-in per column: sort by a derived value (e.g. an assignee's display
    // name) instead of the raw cell value (e.g. their id), when the two differ.
    const sortCol = sortKey ? columns.find(c => c.key === sortKey) : null;

    const sortedData = sortKey
        ? [...filteredData].sort((a, b) => {
            const valA = sortCol?.sortValue ? sortCol.sortValue(a) : a[sortKey];
            const valB = sortCol?.sortValue ? sortCol.sortValue(b) : b[sortKey];
            if (valA == null && valB == null) return 0;
            if (valA == null) return 1;
            if (valB == null) return -1;
            let result;
            if (typeof valA === "number" && typeof valB === "number") {
                result = valA - valB;
            } else {
                result = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: "base" });
            }
            return sortDirection === "asc" ? result : -result;
        })
        : filteredData;

    const filteredIds = sortedData.map(row => row[rowKey]).join(",");
    useEffect(() => {
        if (onFilteredDataChange) onFilteredDataChange(sortedData);
    }, [filteredIds]);

    // ── Pagination ────────────────────────────────────────────
    const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
    const [pageSize, setPageSize]       = useState(() => persisted?.pageSize ?? 10);
    const [currentPage, setCurrentPage] = useState(() => persisted?.currentPage ?? 1);
    const [prevFilterId, setPrevFilterId]   = useState(filteredIds);
    const [prevPageSize, setPrevPageSize]   = useState(pageSize);
    if (filteredIds !== prevFilterId || pageSize !== prevPageSize) {
        setCurrentPage(1);
        setPrevFilterId(filteredIds);
        setPrevPageSize(pageSize);
    }

    const totalPages   = Math.max(1, Math.ceil(sortedData.length / pageSize));
    const safePage     = Math.min(currentPage, totalPages);
    const paginatedData = sortedData.slice((safePage - 1) * pageSize, safePage * pageSize);

    useEffect(() => {
        if (!persistKey || typeof window === "undefined") return;
        sessionStorage.setItem(`datatable:${persistKey}`, JSON.stringify({
            quickSearchValue, filterRules, sortKey, sortDirection, pageSize, currentPage: safePage,
        }));
    }, [persistKey, quickSearchValue, filterRules, sortKey, sortDirection, pageSize, safePage]);

    // ── Highlight / scroll-to (opt-in via highlightKey) ─────────
    // Auto-jump to whichever page currently contains the row, so a row
    // surfaced from elsewhere (e.g. "just marked done") is visible without
    // the coach having to hunt for it — but only if it survives their current
    // filters; we deliberately don't clear filters to force it into view.
    // Adjusted during render (not an effect) to match the pageReset pattern
    // above — avoids an extra commit for a value derived from props/state.
    // Seeded with a sentinel (not highlightKey itself) so the very first
    // render — where highlightKey typically already has its target value —
    // still counts as a "change" and triggers the jump.
    const [prevHighlightKey, setPrevHighlightKey] = useState(() => Symbol("unset"));
    if (highlightKey !== prevHighlightKey) {
        if (highlightKey != null) {
            const idx = sortedData.findIndex(row => row[rowKey] === highlightKey);
            if (idx !== -1) setCurrentPage(Math.floor(idx / pageSize) + 1);
        }
        setPrevHighlightKey(highlightKey);
    }

    function buildPageList() {
        const pages = [];
        const show = (p) => pages.push({ type: "page", value: p });
        const dots = ()  => pages.push({ type: "dots" });
        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) show(i);
        } else {
            show(1);
            if (safePage > 3) dots();
            const start = Math.max(2, safePage - 1);
            const end   = Math.min(totalPages - 1, safePage + 1);
            for (let i = start; i <= end; i++) show(i);
            if (safePage < totalPages - 2) dots();
            show(totalPages);
        }
        return pages;
    }

    // ── Selection ─────────────────────────────────────────────
    function handleSelectionChange(selection) {
        if (!onSelectionChange) return;
        if (selection === "all") {
            onSelectionChange(new Set(sortedData.map(row => row[rowKey])));
        } else {
            onSelectionChange(new Set(selection));
        }
    }

    // ── Mobile expanded cards ─────────────────────────────────
    const [expandedCards, setExpandedCards] = useState(new Set());
    function toggleCard(key) {
        setExpandedCards(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key); else next.add(key);
            return next;
        });
    }

    // Columns marked `hidden` still participate in filtering (the Filter menu
    // reads from the full `columns` list) but are excluded from the actual
    // table/card rendering below — a "filter-only" column with no visible cell.
    const visibleColumns = columns.filter(c => !c.hidden);

    const primaryCols   = visibleColumns.filter((col, i) => col.cardPriority === "primary"   || (!col.cardPriority && i < 3));
    const secondaryCols = visibleColumns.filter((col, i) => col.cardPriority === "secondary" || (!col.cardPriority && i >= 3)).filter(col => col.cardPriority !== "hidden");

    // ── Render ────────────────────────────────────────────────
    return (
        <div>
            {/* ── Toolbar row 1: search + filter + toolbarEnd ── */}
            <div className="flex items-center gap-2 mt-4">
                {quickSearch && (
                    <div ref={searchContainerRef}>
                        <SearchField
                            value={quickSearchValue}
                            onChange={setQuickSearchValue}
                            onClear={() => {
                                setQuickSearchValue("");
                                searchContainerRef.current?.querySelector("input")?.blur();
                            }}
                            aria-label="Quick search"
                            fullWidth
                        >
                            <SearchField.Group>
                                <SearchField.SearchIcon />
                                <SearchField.Input
                                    className="py-2"
                                    placeholder={quickSearch.placeholder ?? "Search..."}
                                    onFocus={() => setSearchFocused(true)}
                                    onBlur={() => setSearchFocused(false)}
                                />
                                <div className="flex items-center gap-1 pe-2 shrink-0">
                                    {(searchFocused || quickSearchValue) ? (
                                        <Kbd>
                                            <Kbd.Content>Esc</Kbd.Content>
                                        </Kbd>
                                    ) : (
                                        <Kbd>
                                            <Kbd.Content>Ctrl</Kbd.Content>
                                            <Kbd.Content> + K</Kbd.Content>
                                        </Kbd>
                                    )}
                                </div>
                            </SearchField.Group>
                            {quickSearch.description && (
                                <Description>{quickSearch.description}</Description>
                            )}
                        </SearchField>
                    </div>
                )}

                {/* Pinned filters — opt-in per column (col.pinned), reachable in one
                    click instead of living inside the general dropdown below. */}
                {columns.filter(c => c.filterType && c.pinned).map(col => (
                    <PinnedFilterButton key={col.key} col={col} filterRules={filterRules} upsertFilter={upsertFilter} />
                ))}

                {/* Filter — every remaining (non-pinned) filterable column */}
                {columns.some(c => c.filterType && !c.pinned) && (
                    <div className="relative">
                        {addFilterOpen && (
                            <div className="fixed inset-0 z-10" onClick={() => { setAddFilterOpen(false); setPendingColKey(null); }} />
                        )}
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setAddFilterOpen(v => !v)}
                        >
                            <ListFilter size={14} />
                            {filterButtonLabel ?? t('filterButton')}
                        </Button>
                        {addFilterOpen && (
                            <div className="absolute z-20 top-full mt-1 bg-card border border-border rounded-xl shadow-md p-2 flex flex-col gap-1 min-w-48">
                                {columns.filter(c => c.filterType && !c.pinned).map(col => (
                                    <div key={col.key} className="relative">
                                        <button
                                            className={`w-full text-start text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center justify-between ${pendingColKey === col.key ? "bg-primary/10 text-primary" : "hover:bg-default"}`}
                                            onClick={() => { setPendingColKey(pendingColKey === col.key ? null : col.key); setPendingValue(null); }}
                                        >
                                            {col.label}
                                            <ChevronRight size={14} className="text-muted-foreground shrink-0 rtl:rotate-180" />
                                        </button>

                                        {pendingColKey === col.key && pendingValue !== null && (
                                            <div className="absolute z-30 ltr:left-full rtl:right-full top-0 ltr:ml-1 rtl:mr-1 bg-card border border-border rounded-xl shadow-md p-3 flex flex-col gap-3 min-w-56">
                                                {renderFilterFields(col, pendingValue, (next) => { setPendingValue(next); upsertFilter(col.key, next); })}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {toolbarEnd && <div className="ms-auto">{toolbarEnd}</div>}
            </div>

            {/* ── Toolbar row 2: active filter chips ── */}
            {hasActiveFilters && (
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                    {filterRules.map(rule => {
                        const col = columns.find(c => c.key === rule.colKey);
                        if (!col) return null;
                        return (
                            <div key={rule.id} className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm border border-primary/20">
                                <span className="font-medium">{col.label}:</span>
                                <span>{summarizeFilter(rule, col)}</span>
                                <button
                                    className="ms-0.5 hover:text-destructive transition-colors leading-none"
                                    onClick={() => setFilterRules(rs => rs.filter(r => r.id !== rule.id))}
                                >✕</button>
                            </div>
                        );
                    })}
                    <Button size="sm" variant="ghost" onClick={() => setFilterRules([])}>
                        {t('clearAll')}
                    </Button>
                </div>
            )}


            {/* ── Desktop: HeroUI Table ── */}
            <div className={`hidden md:block mt-4 ${scrollable ? "overflow-x-auto" : ""}`}>
                <Table>
                    <Table.ScrollContainer>
                        <Table.Content
                            aria-label="Data table"
                            selectionMode={selectable ? "multiple" : "none"}
                            selectedKeys={selectedKeys}
                            onSelectionChange={handleSelectionChange}
                            sortDescriptor={sortDescriptor}
                            onSortChange={handleSortChange}
                        >
                            <Table.Header>
                                {selectable && (
                                    <Table.Column className="w-10 pe-0">
                                        <Checkbox aria-label="Select all" slot="selection">
                                            <Checkbox.Control>
                                                <Checkbox.Indicator />
                                            </Checkbox.Control>
                                        </Checkbox>
                                    </Table.Column>
                                )}
                                {visibleColumns.map((col, i) => (
                                    <Table.Column
                                        key={col.key}
                                        id={col.key}
                                        allowsSorting={!!col.sortable}
                                        isRowHeader={i === 0}
                                        style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                                        // Unlike the body cell below, .table__column has no background of its
                                        // own — only the shared .table__header container does — so a sticky
                                        // header cell truly needs its own bg to stay opaque over what scrolls
                                        // underneath it. bg-surface-secondary matches .table__header exactly
                                        // (table.css); no hover state exists on header cells to conflict with.
                                        // A pinned actions column reads left-aligned, like every other column
                                        // header — the flush-right treatment is only for the (non-pinned) body
                                        // buttons, via a plain "actions" column elsewhere in the app.
                                        // isolate: sticky cells nested inside .table-root's grid+overflow-clip
                                        // ancestor can fail to get their own compositing layer, letting scrolled
                                        // content bleed through a fully opaque declared background — isolate
                                        // forces the browser to paint this cell as its own layer.
                                        className={`${isActionsColumn(col.key) && !col.stickyEnd ? "text-end" : ""} ${col.stickyEnd ? "sticky isolate ltr:right-0 rtl:left-0 z-20 bg-surface-secondary ltr:border-l rtl:border-r border-separator" : ""}`}
                                    >
                                        {isActionsColumn(col.key)
                                            ? col.label
                                            : col.sortable
                                                ? ({ sortDirection: sd }) => (
                                                    <span className="flex items-center justify-between gap-1">
                                                        {col.label}
                                                        {sd === "ascending"  && <ChevronUp size={13} className="text-primary shrink-0" />}
                                                        {sd === "descending" && <ChevronDown size={13} className="text-primary shrink-0" />}
                                                        {!sd && <ChevronsUpDown size={13} className="text-muted-foreground shrink-0 opacity-50" />}
                                                    </span>
                                                )
                                                : col.label
                                        }
                                    </Table.Column>
                                ))}
                            </Table.Header>

                            <Table.Body>
                                {paginatedData.map((row, rowIdx) => {
                                    const isFirstRow = rowIdx === 0;
                                    const isLastRow  = rowIdx === paginatedData.length - 1;
                                    return (
                                        <React.Fragment key={row[rowKey]}>
                                            <Table.Row
                                                id={row[rowKey]}
                                                className={`group ${rowClassName ? rowClassName(row) : ""}`}
                                            >
                                                {selectable && (() => {
                                                    const s = {};
                                                    if (isRtl) {
                                                        if (isFirstRow) { s.borderTopLeftRadius = 0; s.borderTopRightRadius = CORNER_RADIUS; }
                                                        if (isLastRow)  { s.borderBottomLeftRadius = 0; s.borderBottomRightRadius = CORNER_RADIUS; }
                                                    }
                                                    return (
                                                        <Table.Cell className="pe-0" style={Object.keys(s).length ? s : undefined}>
                                                            <Checkbox
                                                                aria-label={`Select row ${row[rowKey]}`}
                                                                slot="selection"
                                                                variant="secondary"
                                                            >
                                                                <Checkbox.Control>
                                                                    <Checkbox.Indicator />
                                                                </Checkbox.Control>
                                                            </Checkbox>
                                                        </Table.Cell>
                                                    );
                                                })()}
                                                {visibleColumns.map((col, colIdx) => {
                                                    const isFirstCol = !selectable && colIdx === 0;
                                                    const isLastCol  = colIdx === visibleColumns.length - 1;
                                                    const isActionsCol = isActionsColumn(col.key);
                                                    const baseStyle  = col.width ? { width: col.width, minWidth: col.width } : {};
                                                    const extra = {};
                                                    if (isRtl) {
                                                        if (isFirstRow && isFirstCol) { extra.borderTopLeftRadius = 0; extra.borderTopRightRadius = CORNER_RADIUS; }
                                                        if (isFirstRow && isLastCol)  { extra.borderTopRightRadius = 0; extra.borderTopLeftRadius = CORNER_RADIUS; }
                                                        if (isLastRow  && isFirstCol) { extra.borderBottomLeftRadius = 0; extra.borderBottomRightRadius = CORNER_RADIUS; }
                                                        if (isLastRow  && isLastCol)  { extra.borderBottomRightRadius = 0; extra.borderBottomLeftRadius = CORNER_RADIUS; }
                                                    }
                                                    // The sticky cell's rest/hover/selected backgrounds are plain CSS
                                                    // (see [data-sticky-end] rules in globals.css), not JS state —
                                                    // an earlier version tracked hover in React state and computed
                                                    // this inline, which meant the sticky cell's background could
                                                    // only update on the next React commit. Measured with a Playwright
                                                    // long-task trace: a single row's re-render (its HeroUI <Select>,
                                                    // its Tooltips) blocked the main thread for ~850ms after
                                                    // mouseenter, so the JS-driven cell visibly lagged ~850ms behind
                                                    // the native cells, whose bg-surface/40 hover tint is applied by
                                                    // the browser's :hover engine and never touches JS at all. Using
                                                    // real :hover/[data-selected] CSS for the sticky cell too removes
                                                    // that dependency entirely — both now update on the same paint,
                                                    // regardless of how long React takes to re-render anything else.
                                                    const cellStyle = { ...baseStyle, ...extra };
                                                    return (
                                                        <Table.Cell
                                                            key={col.key}
                                                            style={Object.keys(cellStyle).length ? cellStyle : undefined}
                                                            data-sticky-end={col.stickyEnd ? "true" : undefined}
                                                            // z-20 (not z-10): a focused/hovered control in a neighboring
                                                            // cell (e.g. the Assigned select) can get its own elevated
                                                            // stacking context, which was winning over a lower z-index
                                                            // here and bleeding through the pinned column on hover.
                                                            // isolate: forces this cell onto its own compositing layer —
                                                            // .table-root's grid+overflow-clip ancestor can otherwise
                                                            // let scrolled content bleed through a sticky cell's fully
                                                            // opaque declared background (a real browser quirk, not a
                                                            // color mismatch — verified --surface has no alpha channel).
                                                            // border-separator-tertiary/50 (not border-separator): every
                                                            // other border in the table body — .table__cell's own
                                                            // border-b — uses --color-separator-tertiary, a color-mix of
                                                            // --surface/--surface-foreground at 50% alpha, NOT a
                                                            // translucent version of the unrelated --separator token.
                                                            // border-separator is a distinct, unrelated hue (see
                                                            // theme.css) at full opacity — using it here read as a
                                                            // harder, differently-colored line next to the table's soft
                                                            // separator-tertiary grid. (The header sticky divider below
                                                            // keeps plain border-separator: .table__column::after, its
                                                            // native divider, uses that same full-opacity token, so it
                                                            // already matches its own context.)
                                                            className={`${isActionsCol ? "text-end" : ""} ${col.stickyEnd ? "sticky isolate ltr:right-0 rtl:left-0 z-20 ltr:border-l rtl:border-r border-separator-tertiary/50" : ""}`}
                                                            onPointerDown={(e) => e.stopPropagation()}
                                                        >
                                                            {isActionsCol
                                                                // Buttons sit flush-right and, by default, fade in on row
                                                                // hover (only the buttons fade, not the cell bg, so the
                                                                // row's hover highlight shows through behind them) —
                                                                // opt out per column with `alwaysVisibleActions: true`.
                                                                ? <div className={`flex justify-end ${col.alwaysVisibleActions ? "" : "opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"}`}>{col.render ? col.render(row) : row[col.key]}</div>
                                                                : (col.render ? col.render(row) : row[col.key])}
                                                        </Table.Cell>
                                                    );
                                                })}
                                            </Table.Row>
                                            {renderExpandedRow && renderExpandedRow(row)}
                                        </React.Fragment>
                                    );
                                })}
                            </Table.Body>
                        </Table.Content>
                    </Table.ScrollContainer>
                </Table>

                {/* Footer — sibling of <Table>, visually continues the card */}
                <div className="flex items-stretch py-2">
                    {/* LEFT — numbered page navigation */}
                    <div className="flex items-center gap-1 px-3">
                        <Button
                            size="sm"
                            variant="ghost"
                            isIconOnly
                            isDisabled={safePage === 1}
                            className="rounded-full"
                            onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
                        >
                            <ChevronLeft size={15} />
                        </Button>
                        {buildPageList().map((item, idx) =>
                            item.type === "dots" ? (
                                <span key={`dots-${idx}`} className="px-1 text-muted-foreground text-sm">…</span>
                            ) : (
                                <Button
                                    key={item.value}
                                    size="sm"
                                    isIconOnly
                                    variant={item.value === safePage ? "primary" : "ghost"}
                                    className="rounded-full"
                                    onPress={() => setCurrentPage(item.value)}
                                >
                                    {item.value}
                                </Button>
                            )
                        )}
                        <Button
                            size="sm"
                            variant="ghost"
                            isIconOnly
                            isDisabled={safePage === totalPages}
                            className="rounded-full"
                            onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        >
                            <ChevronRight size={15} />
                        </Button>
                    </div>

                    {/* RIGHT group starts — Rows per page */}
                    <div className="flex items-center ms-auto border-e border-separator">
                        <Select
                            value={String(pageSize)}
                            onChange={(val) => setPageSize(Number(val))}
                            size="sm"
                        >
                            <Select.Trigger className="border-0! bg-transparent! shadow-none! min-h-0! py-1! px-3! gap-2 items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                                <span className="text-sm leading-none">{t('rowsPerPage')}</span>
                                <Select.Value className="text-sm font-medium leading-none" />
                                <ChevronsUpDown size={13} className="shrink-0" />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    {PAGE_SIZE_OPTIONS.map(size => (
                                        <ListBox.Item key={String(size)} id={String(size)} textValue={String(size)}>
                                            {size}
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                    </div>

                    {/* RIGHT — selection count + Previous / Next */}
                    <div className="flex items-center gap-3 px-3">
                        {selectable && (
                            <span className="text-sm text-muted-foreground">
                                {t('selectedCount', { n: selectedKeys?.size ?? 0, total: sortedData.length })}
                            </span>
                        )}
                        <Button
                            size="sm"
                            variant="secondary"
                            isDisabled={safePage === 1}
                            onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
                        >
                            {t('previous')}
                        </Button>
                        <Button
                            size="sm"
                            variant="secondary"
                            isDisabled={safePage === totalPages}
                            onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        >
                            {t('next')}
                        </Button>
                    </div>
                </div>
            </div>

            {/* ── Mobile cards ── */}
            <div className="md:hidden mt-4 flex flex-col gap-3">
                {paginatedData.map(row => {
                    const key       = row[rowKey];
                    const isExpanded = expandedCards.has(key);
                    const isSelected = selectable && selectedKeys?.has(key);

                    return (
                        <div
                            key={key}
                            className={`bg-card border rounded-xl p-4 transition-colors ${
                                isSelected ? "border-primary/40 bg-primary/5" : "border-border"
                            } ${rowClassName ? rowClassName(row) : ""}`}
                        >
                            <div className="flex items-start gap-3">
                                {selectable && (
                                    <Checkbox
                                        isSelected={isSelected || false}
                                        onChange={() => {
                                            if (!onSelectionChange) return;
                                            const next = new Set(selectedKeys);
                                            if (next.has(key)) next.delete(key); else next.add(key);
                                            onSelectionChange(next);
                                        }}
                                        aria-label={`Select row ${key}`}
                                        className="mt-1 shrink-0"
                                    >
                                        <Checkbox.Control>
                                            <Checkbox.Indicator />
                                        </Checkbox.Control>
                                    </Checkbox>
                                )}
                                <div className="flex-1 min-w-0">
                                    {primaryCols.map(col => (
                                        <div key={col.key} className="flex items-baseline gap-2 mb-1.5 last:mb-0">
                                            <span className="text-muted-foreground text-xs font-medium shrink-0">{col.label}</span>
                                            <span className="text-sm text-foreground truncate">
                                                {col.render ? col.render(row) : row[col.key]}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {isExpanded && secondaryCols.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-border flex flex-col gap-1.5">
                                    {secondaryCols.map(col => (
                                        <div key={col.key} className="flex items-baseline gap-2">
                                            <span className="text-muted-foreground text-xs font-medium shrink-0">{col.label}</span>
                                            <span className="text-sm text-foreground">
                                                {col.render ? col.render(row) : row[col.key]}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {secondaryCols.length > 0 && (
                                <Button
                                    onClick={() => toggleCard(key)}
                                    className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                                >
                                    <svg className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path d="M19 9l-7 7-7-7" />
                                    </svg>
                                    {isExpanded ? t('showLess') : t('showMore', { count: secondaryCols.length })}
                                </Button>
                            )}

                            {renderMobileExpanded && renderMobileExpanded(row)}
                        </div>
                    );
                })}
            </div>

            {sortedData.length === 0 && (
                data.length === 0 ? (
                    // First-time: no data exists at all. Prominent state + creation CTA
                    // when the page supplies one; a quiet placeholder otherwise.
                    <EmptyState
                        variant="firstTime"
                        icon={emptyState?.icon}
                        title={emptyState?.title ?? t('emptyTitle')}
                        description={emptyState?.description}
                        action={emptyState?.action}
                        secondaryAction={emptyState?.secondaryAction}
                    />
                ) : (
                    // Data exists but search/filter matched nothing → recovery only.
                    <EmptyState
                        variant={quickSearchValue ? "search" : "filter"}
                        title={quickSearchValue ? t('searchEmptyTitle') : t('filterEmptyTitle')}
                        description={quickSearchValue ? t('searchEmptyHint') : t('filterEmptyHint')}
                        action={{
                            label: quickSearchValue && hasActiveFilters
                                ? t('clearAll')
                                : quickSearchValue ? t('clearSearch') : t('clearFilters'),
                            onPress: () => { setQuickSearchValue(""); setFilterRules([]); },
                        }}
                    />
                )
            )}
        </div>
    );
}
