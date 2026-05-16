"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight, ChevronsUpDown } from "lucide-react";
import { Table } from "@heroui/react/table";
import { Checkbox } from "@heroui/react/checkbox";
import { Pagination } from "@heroui/react/pagination";
import { Button } from "@heroui/react/button";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";
import { DateField } from "@heroui/react/date-field";
import { DateRangePicker } from "@heroui/react/date-range-picker";
import { RangeCalendar } from "@heroui/react/range-calendar";
import { SearchField } from "@heroui/react/search-field";
import { Kbd } from "@heroui/react/kbd";
import { Description } from "@heroui/react/description";
import { parseDate } from "@internationalized/date";

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
}) {
    // ── Quick search ──────────────────────────────────────────
    const [quickSearchValue, setQuickSearchValue] = useState("");
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
    const [filterRules, setFilterRules]     = useState([]);
    const [addFilterOpen, setAddFilterOpen] = useState(false);
    const [pendingColKey, setPendingColKey] = useState(null);
    const [pendingValue, setPendingValue]   = useState(null);

    useEffect(() => {
        if (!pendingColKey) { setPendingValue(null); return; }
        const col = columns.find(c => c.key === pendingColKey);
        if (col.filterType === "text")      setPendingValue("");
        if (col.filterType === "multi")     setPendingValue([]);
        if (col.filterType === "dateRange") setPendingValue({ from: "", to: "" });
    }, [pendingColKey]);

    const hasActiveFilters = filterRules.length > 0;
    const pendingCol = pendingColKey ? columns.find(c => c.key === pendingColKey) : null;

    function summarizeFilter(rule, col) {
        if (col.filterType === "text")      return `"${rule.value}"`;
        if (col.filterType === "multi")     return rule.value.join(", ");
        if (col.filterType === "dateRange") {
            const { from, to } = rule.value;
            if (from && to) return `${from} – ${to}`;
            if (from) return `from ${from}`;
            return `until ${to}`;
        }
        return String(rule.value);
    }

    function applyPendingFilter() {
        if (pendingColKey === null || pendingValue === null) return;
        const isEmpty =
            (typeof pendingValue === "string" && pendingValue === "") ||
            (Array.isArray(pendingValue) && pendingValue.length === 0) ||
            (typeof pendingValue === "object" && !Array.isArray(pendingValue) && !pendingValue.from && !pendingValue.to);
        if (!isEmpty) {
            setFilterRules(rs => [...rs, { id: String(Date.now() + Math.random()), colKey: pendingColKey, value: pendingValue }]);
        }
        setPendingColKey(null);
    }

    // ── Sort ──────────────────────────────────────────────────
    const [sortKey, setSortKey]             = useState(defaultSort ?? null);
    const [sortDirection, setSortDirection] = useState(defaultSortDirection ?? "asc");

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

    const sortedData = sortKey
        ? [...filteredData].sort((a, b) => {
            const valA = a[sortKey];
            const valB = b[sortKey];
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
    const [pageSize, setPageSize]       = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
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

    const primaryCols   = columns.filter((col, i) => col.cardPriority === "primary"   || (!col.cardPriority && i < 3));
    const secondaryCols = columns.filter((col, i) => col.cardPriority === "secondary" || (!col.cardPriority && i >= 3)).filter(col => col.cardPriority !== "hidden");

    // ── Render ────────────────────────────────────────────────
    return (
        <div>
            {/* ── Toolbar ── */}
            <div className="flex items-center gap-2 mt-4 flex-wrap">
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
                                    placeholder={quickSearch.placeholder ?? "Search..."}
                                    onFocus={() => setSearchFocused(true)}
                                    onBlur={() => setSearchFocused(false)}
                                />
                                <div className="flex items-center gap-1 pr-2 shrink-0">
                                    {(searchFocused || quickSearchValue) ? (
                                        <Kbd>
                                            <Kbd.Abbr keyValue="escape" />
                                        </Kbd>
                                    ) : (
                                        <Kbd>
                                            <Kbd.Abbr keyValue="ctrl" />
                                            <Kbd.Content>K</Kbd.Content>
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

                {/* + Add filter */}
                {columns.some(c => c.filterType) && (
                    <div className="relative">
                        {addFilterOpen && (
                            <div className="fixed inset-0 z-10" onClick={() => setAddFilterOpen(false)} />
                        )}
                        <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => setAddFilterOpen(v => !v)}
                        >
                            + Add filter
                        </Button>
                        {addFilterOpen && (
                            <div className="absolute z-20 top-full mt-1 bg-popover border border-border rounded-xl shadow-md p-2 flex flex-col gap-1 min-w-40">
                                {columns.filter(c => c.filterType).map(col => (
                                    <button
                                        key={col.key}
                                        className="text-left text-sm px-3 py-1.5 rounded-lg hover:bg-accent transition-colors"
                                        onClick={() => { setPendingColKey(col.key); setAddFilterOpen(false); }}
                                    >
                                        {col.label}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Active filter chips */}
                {filterRules.map(rule => {
                    const col = columns.find(c => c.key === rule.colKey);
                    if (!col) return null;
                    return (
                        <div key={rule.id} className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm border border-primary/20">
                            <span className="font-medium">{col.label}:</span>
                            <span>{summarizeFilter(rule, col)}</span>
                            <button
                                className="ml-0.5 hover:text-destructive transition-colors leading-none"
                                onClick={() => setFilterRules(rs => rs.filter(r => r.id !== rule.id))}
                            >✕</button>
                        </div>
                    );
                })}

                {hasActiveFilters && (
                    <Button size="sm" variant="ghost" onClick={() => setFilterRules([])}>
                        Clear all
                    </Button>
                )}
            </div>

            {/* ── Pending filter value entry ── */}
            {pendingCol && pendingValue !== null && (
                <div className="mt-3 p-4 bg-card rounded-xl border border-border flex flex-wrap items-end gap-4">
                    <div className="flex flex-col gap-1.5 min-w-36">
                        <label className="text-muted-foreground text-xs font-medium">{pendingCol.label}</label>
                        {pendingCol.filterType === "text" && (
                            <TextField value={pendingValue} onChange={setPendingValue}>
                                <Input type="text" placeholder={`Search ${pendingCol.label.toLowerCase()}...`} />
                            </TextField>
                        )}
                        {pendingCol.filterType === "multi" && (
                            <Select
                                selectionMode="multiple"
                                value={pendingValue}
                                onChange={(keys) => setPendingValue(keys)}
                                placeholder={`Filter ${pendingCol.label.toLowerCase()}...`}
                                className="min-w-36"
                            >
                                <Select.Trigger>
                                    <Select.Value />
                                    <Select.Indicator />
                                </Select.Trigger>
                                <Select.Popover>
                                    <ListBox>
                                        {pendingCol.options.map(option => (
                                            <ListBox.Item key={option} id={option} textValue={option}>
                                                {option}
                                                <ListBox.ItemIndicator />
                                            </ListBox.Item>
                                        ))}
                                    </ListBox>
                                </Select.Popover>
                            </Select>
                        )}
                        {pendingCol.filterType === "dateRange" && (
                            <DateRangePicker
                                value={
                                    pendingValue.from && pendingValue.to
                                        ? { start: parseDate(pendingValue.from), end: parseDate(pendingValue.to) }
                                        : null
                                }
                                onChange={(range) => setPendingValue({
                                    from: range?.start?.toString() ?? "",
                                    to: range?.end?.toString() ?? "",
                                })}
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
                                    <RangeCalendar aria-label={pendingCol.label}>
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
                                                {({year}) => <RangeCalendar.YearPickerCell year={year} />}
                                            </RangeCalendar.YearPickerGridBody>
                                        </RangeCalendar.YearPickerGrid>
                                    </RangeCalendar>
                                </DateRangePicker.Popover>
                            </DateRangePicker>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button size="sm" variant="primary" onClick={applyPendingFilter}>Apply</Button>
                        <Button size="sm" variant="ghost" onClick={() => setPendingColKey(null)}>Cancel</Button>
                    </div>
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
                                    <Table.Column className="w-10 pr-0">
                                        <Checkbox aria-label="Select all" slot="selection">
                                            <Checkbox.Control>
                                                <Checkbox.Indicator />
                                            </Checkbox.Control>
                                        </Checkbox>
                                    </Table.Column>
                                )}
                                {columns.map((col, i) => (
                                    <Table.Column
                                        key={col.key}
                                        id={col.key}
                                        allowsSorting={!!col.sortable}
                                        isRowHeader={i === 0}
                                        style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                                        className={col.key === "_actions" ? "text-end" : ""}
                                    >
                                        {col.sortable
                                            ? ({ sortDirection: sd }) => (
                                                <span className="flex items-center justify-between gap-1">
                                                    {col.label}
                                                    {sd === "ascending"  && <span className="text-primary text-[10px]">▲</span>}
                                                    {sd === "descending" && <span className="text-primary text-[10px]">▼</span>}
                                                    {!sd && <span className="text-border text-[10px] opacity-60">⇅</span>}
                                                </span>
                                            )
                                            : col.label
                                        }
                                    </Table.Column>
                                ))}
                            </Table.Header>

                            <Table.Body>
                                {paginatedData.map(row => (
                                    <React.Fragment key={row[rowKey]}>
                                        <Table.Row id={row[rowKey]}>
                                            {selectable && (
                                                <Table.Cell className="pr-0">
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
                                            )}
                                            {columns.map(col => (
                                                <Table.Cell
                                                    key={col.key}
                                                    style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                                                    className={col.key === "_actions" ? "text-end" : ""}
                                                >
                                                    {col.render ? col.render(row) : row[col.key]}
                                                </Table.Cell>
                                            ))}
                                        </Table.Row>
                                        {renderExpandedRow && renderExpandedRow(row)}
                                    </React.Fragment>
                                ))}
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
                    <div className="flex items-center ml-auto border-r border-separator">
                        <Select
                            value={String(pageSize)}
                            onChange={(val) => setPageSize(Number(val))}
                            size="sm"
                        >
                            <Select.Trigger className="border-0! bg-transparent! shadow-none! min-h-0! py-1! px-3! gap-2 items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                                <span className="text-sm leading-none">Rows per page</span>
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
                                {selectedKeys?.size ?? 0} of {sortedData.length} selected
                            </span>
                        )}
                        <Button
                            size="sm"
                            variant="secondary"
                            isDisabled={safePage === 1}
                            onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
                        >
                            Previous
                        </Button>
                        <Button
                            size="sm"
                            variant="secondary"
                            isDisabled={safePage === totalPages}
                            onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        >
                            Next
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
                            }`}
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
                                    {isExpanded ? "Show less" : `+${secondaryCols.length} more`}
                                </Button>
                            )}

                            {renderMobileExpanded && renderMobileExpanded(row)}
                        </div>
                    );
                })}
            </div>

            {sortedData.length === 0 && (
                <p className="text-muted-foreground mt-6 text-sm">No results match the current filters.</p>
            )}
        </div>
    );
}
