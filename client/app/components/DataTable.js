"use client";

import React, { useState, useEffect, useRef } from "react";
import { Table } from "@heroui/react/table";
import { Checkbox } from "@heroui/react/checkbox";
import { Pagination } from "@heroui/react/pagination";
import { Button } from "@heroui/react/button";

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
}) {
    // ── Filters ──────────────────────────────────────────────
    function buildInitialFilters() {
        const initial = {};
        columns.forEach(col => {
            if (col.filterType === "text")      initial[col.key] = "";
            if (col.filterType === "multi")     initial[col.key] = [];
            if (col.filterType === "dateRange") initial[col.key] = { from: "", to: "" };
        });
        return initial;
    }

    const [filters, setFilters]         = useState(buildInitialFilters);
    const [showFilters, setShowFilters] = useState(false);
    const [openDropdown, setOpenDropdown] = useState(null);
    const dropdownRef = useRef(null);

    useEffect(() => {
        function handler(e) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target))
                setOpenDropdown(null);
        }
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    function toggleMultiFilter(key, value) {
        setFilters(prev => {
            const current = prev[key];
            const updated = current.includes(value)
                ? current.filter(v => v !== value)
                : [...current, value];
            return { ...prev, [key]: updated };
        });
    }

    function clearFilters() {
        setFilters(buildInitialFilters());
        setOpenDropdown(null);
    }

    const hasActiveFilters = columns.some(col => {
        if (!col.filterType) return false;
        const val = filters[col.key];
        if (col.filterType === "text")      return val !== "";
        if (col.filterType === "multi")     return val.length > 0;
        if (col.filterType === "dateRange") return val.from !== "" || val.to !== "";
        return false;
    });

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
    const filteredData = data.filter(row => {
        for (const col of columns) {
            if (!col.filterType) continue;
            const filterVal = filters[col.key];
            if (col.filterType === "text") {
                if (filterVal && !String(row[col.key]).toLowerCase().includes(filterVal.toLowerCase())) return false;
            }
            if (col.filterType === "multi") {
                const cellVal = col.filterValue ? col.filterValue(row) : row[col.key];
                if (filterVal.length > 0 && !filterVal.includes(cellVal)) return false;
            }
            if (col.filterType === "dateRange" && dateParser) {
                if (filterVal.from || filterVal.to) {
                    const rowDate = dateParser(row[col.key]);
                    if (filterVal.from && rowDate < new Date(filterVal.from)) return false;
                    if (filterVal.to   && rowDate > new Date(filterVal.to))   return false;
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
                <Button
                    size="sm"
                    variant={showFilters ? "primary" : "secondary"}
                    onClick={() => setShowFilters(v => !v)}
                >
                    {showFilters ? "Hide Filters" : "Show Filters"}
                </Button>
                {hasActiveFilters && (
                    <Button size="sm" variant="danger-soft" onClick={clearFilters}>
                        Clear Filters ✕
                    </Button>
                )}
                <div className="flex items-center gap-3 ml-auto">
                    <div className="flex items-center gap-1.5">
                        <span className="text-muted-foreground text-xs">Rows:</span>
                        {PAGE_SIZE_OPTIONS.map(size => (
                            <Button
                                key={size}
                                size="sm"
                                variant={pageSize === size ? "primary" : "ghost"}
                                onClick={() => setPageSize(size)}
                            >
                                {size}
                            </Button>
                        ))}
                    </div>
                </div>
            </div>

            {/* ── Filter panel ── */}
            {showFilters && (
                <div className="mt-3 p-4 bg-card rounded-xl border border-border flex flex-wrap gap-4">
                    {columns.map(col => {
                        if (!col.filterType) return null;
                        return (
                            <div key={col.key} className="flex flex-col gap-1.5 min-w-36">
                                <label className="text-muted-foreground text-xs font-medium">{col.label}</label>
                                {col.filterType === "text" && (
                                    <input
                                        value={filters[col.key]}
                                        onChange={(e) => setFilters({ ...filters, [col.key]: e.target.value })}
                                        type="text"
                                        placeholder={`Search ${col.label.toLowerCase()}...`}
                                        className="px-3 py-1.5 rounded-lg bg-background border border-input text-foreground text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                                    />
                                )}
                                {col.filterType === "multi" && (
                                    <div className="relative" ref={openDropdown === col.key ? dropdownRef : null}>
                                        <button
                                            onClick={() => setOpenDropdown(openDropdown === col.key ? null : col.key)}
                                            className="px-3 py-1.5 rounded-lg text-sm bg-background border border-input text-foreground hover:bg-accent transition-colors"
                                        >
                                            {col.label}{filters[col.key].length > 0 ? ` (${filters[col.key].length})` : ""} ▼
                                        </button>
                                        {openDropdown === col.key && (
                                            <div className="absolute top-full left-0 mt-1 z-10 bg-popover border border-border rounded-lg shadow-md p-2 flex flex-col gap-1 min-w-36">
                                                {col.options.map(option => (
                                                    <button
                                                        key={option}
                                                        onClick={() => toggleMultiFilter(col.key, option)}
                                                        className={`px-3 py-1.5 rounded-lg text-xs font-medium text-left transition-colors ${
                                                            filters[col.key].includes(option)
                                                                ? "bg-primary text-primary-foreground"
                                                                : "bg-secondary text-foreground hover:bg-secondary/80"
                                                        }`}
                                                    >
                                                        {option}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                                {col.filterType === "dateRange" && (
                                    <div className="flex gap-2">
                                        <input
                                            type="date"
                                            value={filters[col.key].from}
                                            onChange={(e) => setFilters({ ...filters, [col.key]: { ...filters[col.key], from: e.target.value } })}
                                            className="flex-1 px-2 py-1.5 rounded-lg bg-background border border-input text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                        <input
                                            type="date"
                                            value={filters[col.key].to}
                                            onChange={(e) => setFilters({ ...filters, [col.key]: { ...filters[col.key], to: e.target.value } })}
                                            className="flex-1 px-2 py-1.5 rounded-lg bg-background border border-input text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-ring"
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
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
                                        isRowHeader={!selectable && i === 0}
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

                    <Table.Footer>
                        <Pagination size="sm">
                            <Pagination.Summary>
                                {sortedData.length === 0
                                    ? "No results"
                                    : `${(safePage - 1) * pageSize + 1} to ${Math.min(safePage * pageSize, sortedData.length)} of ${sortedData.length} results`
                                }
                            </Pagination.Summary>
                            {totalPages > 1 && (
                                <Pagination.Content>
                                    <Pagination.Item>
                                        <Pagination.Previous
                                            isDisabled={safePage === 1}
                                            onPress={() => setCurrentPage(p => Math.max(1, p - 1))}
                                        >
                                            <Pagination.PreviousIcon />
                                            Prev
                                        </Pagination.Previous>
                                    </Pagination.Item>
                                    {buildPageList().map((item, idx) =>
                                        item.type === "dots" ? (
                                            <Pagination.Item key={`dots-${idx}`}>
                                                <Pagination.Ellipsis />
                                            </Pagination.Item>
                                        ) : (
                                            <Pagination.Item key={item.value}>
                                                <Pagination.Link
                                                    isActive={item.value === safePage}
                                                    onPress={() => setCurrentPage(item.value)}
                                                >
                                                    {item.value}
                                                </Pagination.Link>
                                            </Pagination.Item>
                                        )
                                    )}
                                    <Pagination.Item>
                                        <Pagination.Next
                                            isDisabled={safePage === totalPages}
                                            onPress={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                        >
                                            Next
                                            <Pagination.NextIcon />
                                        </Pagination.Next>
                                    </Pagination.Item>
                                </Pagination.Content>
                            )}
                        </Pagination>
                    </Table.Footer>
                </Table>
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
                                    <input
                                        type="checkbox"
                                        checked={isSelected || false}
                                        onChange={() => {
                                            if (!onSelectionChange) return;
                                            const next = new Set(selectedKeys);
                                            if (next.has(key)) next.delete(key); else next.add(key);
                                            onSelectionChange(next);
                                        }}
                                        className="accent-primary w-4 h-4 mt-1 cursor-pointer shrink-0"
                                    />
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
                                <button
                                    onClick={() => toggleCard(key)}
                                    className="mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                                >
                                    <svg className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path d="M19 9l-7 7-7-7" />
                                    </svg>
                                    {isExpanded ? "Show less" : `+${secondaryCols.length} more`}
                                </button>
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
