"use client";

import React, { useState, useEffect, useRef } from "react";

// ============================================================
// DataTable — A reusable, filterable table component
// ============================================================
//
// Props:
//   columns  — array of column definitions (see below)
//   data     — array of row objects
//   rowKey   — string: which field to use as React key (e.g. "code")
//   dateParser — optional function: (dateString) => Date object
//   selectable — boolean: show checkboxes for row selection
//   selectedKeys — Set: currently selected row keys (controlled)
//   onSelectionChange — (newSet) => void: callback when selection changes
//
// Column definition shape:
//   {
//     key: "fieldName",              — maps to row[key]
//     label: "Display Label",        — shown in the header
//     filterType: "text" | "multi" | "dateRange" | null,
//     options: ["A", "B"],           — required for "multi" type
//     render: (row) => <JSX>,        — optional custom cell renderer
//     sortable: true | false,        — enables click-to-sort on this column
//     cardPriority: "primary" | "secondary" | "hidden",
//                                    — controls mobile card display:
//                                      "primary"   = always visible (default for first 3)
//                                      "secondary" = shown when card expanded
//                                      "hidden"    = never shown on mobile
//   }
//
// If render is not provided, the cell shows row[key] as plain text.
// If filterType is null/undefined, no filter appears for that column.
// If sortable is true, clicking the header sorts by that column.

export default function DataTable({ columns, data, rowKey, dateParser, onFilteredDataChange, selectable, selectedKeys, onSelectionChange, renderExpandedRow, renderMobileExpanded, scrollable }) {

    // --- FILTER STATE ---
    // Build initial filters dynamically from columns config
    // "text" → "", "multi" → [], "dateRange" → { from: "", to: "" }
    function buildInitialFilters() {
        const initial = {};
        columns.forEach(col => {
            if (col.filterType === "text") initial[col.key] = "";
            if (col.filterType === "multi") initial[col.key] = [];
            if (col.filterType === "dateRange") initial[col.key] = { from: "", to: "" };
        });
        return initial;
    }

    const initialFilters = buildInitialFilters();
    const [filters, setFilters] = useState(initialFilters);
    const [showFilters, setShowFilters] = useState(false);
    const [openDropdown, setOpenDropdown] = useState(null);
    const dropdownRef = useRef(null);

    // --- SORT STATE ---
    // sortKey: which column key we're sorting by (null = no sort)
    // sortDirection: "asc" or "desc"
    const [sortKey, setSortKey] = useState(null);
    const [sortDirection, setSortDirection] = useState("asc");

    // --- CLICK OUTSIDE TO CLOSE DROPDOWN ---
    useEffect(() => {
        function handleClickOutside(e) {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpenDropdown(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- FILTER HELPERS ---
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

    // Check if any filter is active
    const hasActiveFilters = columns.some(col => {
        if (!col.filterType) return false;
        const val = filters[col.key];
        if (col.filterType === "text") return val !== "";
        if (col.filterType === "multi") return val.length > 0;
        if (col.filterType === "dateRange") return val.from !== "" || val.to !== "";
        return false;
    });

    // --- SORT HELPERS ---
    // Cycle: no sort → asc → desc → no sort
    function handleSort(key) {
        if (sortKey === key) {
            if (sortDirection === "asc") {
                setSortDirection("desc");
            } else {
                // Was desc — reset to no sort
                setSortKey(null);
                setSortDirection("asc");
            }
        } else {
            // Different column — start ascending
            setSortKey(key);
            setSortDirection("asc");
        }
    }

    // --- FILTERING LOGIC ---
    const filteredData = data.filter(row => {
        for (const col of columns) {
            if (!col.filterType) continue;
            const filterVal = filters[col.key];

            if (col.filterType === "text") {
                if (filterVal && !String(row[col.key]).toLowerCase().includes(filterVal.toLowerCase())) {
                    return false;
                }
            }

            if (col.filterType === "multi") {
                const cellVal = col.filterValue ? col.filterValue(row) : row[col.key];
                if (filterVal.length > 0 && !filterVal.includes(cellVal)) {
                    return false;
                }
            }

            if (col.filterType === "dateRange" && dateParser) {
                if (filterVal.from || filterVal.to) {
                    const rowDate = dateParser(row[col.key]);
                    if (filterVal.from && rowDate < new Date(filterVal.from)) return false;
                    if (filterVal.to && rowDate > new Date(filterVal.to)) return false;
                }
            }
        }
        return true;
    });

    // --- SORTING LOGIC (applied after filtering) ---
    const sortedData = sortKey
        ? [...filteredData].sort((a, b) => {
            const valA = a[sortKey];
            const valB = b[sortKey];

            // Handle nulls/undefined — push them to the end
            if (valA == null && valB == null) return 0;
            if (valA == null) return 1;
            if (valB == null) return -1;

            let result;
            // Numbers: compare numerically
            if (typeof valA === "number" && typeof valB === "number") {
                result = valA - valB;
            } else {
                // Everything else: compare as strings
                result = String(valA).localeCompare(String(valB), undefined, { numeric: true, sensitivity: "base" });
            }

            return sortDirection === "asc" ? result : -result;
        })
        : filteredData;

    // Notify parent when filtered data changes (compare by length + IDs to avoid infinite loops)
    const filteredIds = sortedData.map(row => row[rowKey]).join(",");
    useEffect(() => {
        if (onFilteredDataChange) onFilteredDataChange(sortedData);
    }, [filteredIds]);

    // --- PAGINATION STATE ---
    const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
    const [pageSize, setPageSize] = useState(10);
    const [currentPage, setCurrentPage] = useState(1);
    // Track previous filter/sort/pageSize to auto-reset page
    const [prevFilterId, setPrevFilterId] = useState(filteredIds);
    const [prevPageSize, setPrevPageSize] = useState(pageSize);
    if (filteredIds !== prevFilterId || pageSize !== prevPageSize) {
        setCurrentPage(1);
        setPrevFilterId(filteredIds);
        setPrevPageSize(pageSize);
    }

    const totalPages = Math.max(1, Math.ceil(sortedData.length / pageSize));
    const safePage = Math.min(currentPage, totalPages);
    const paginatedData = sortedData.slice((safePage - 1) * pageSize, safePage * pageSize);

    // --- MOBILE CARD EXPANSION ---
    const [expandedCards, setExpandedCards] = useState(new Set());

    function toggleCard(key) {
        setExpandedCards(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    }

    // Derive primary / secondary columns for card layout
    const primaryCols = columns.filter((col, i) =>
        col.cardPriority === "primary" || (!col.cardPriority && i < 3)
    );
    const secondaryCols = columns.filter((col, i) =>
        col.cardPriority === "secondary" || (!col.cardPriority && i >= 3)
    ).filter(col => col.cardPriority !== "hidden");

    // --- RENDER ---
    return (
        <div>
            {/* Filter controls */}
            <div className="flex items-center gap-2 mt-4 flex-wrap">
                <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                        showFilters
                            ? "bg-[#007AFF] text-white"
                            : "bg-[#F0F0F5] text-[#1D1D1F] hover:bg-[#D2D2D7]"
                    }`}
                >
                    {showFilters ? "Hide Filters" : "Show Filters"}
                </button>
                {hasActiveFilters && (
                    <button
                        onClick={clearFilters}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-[#FF3B30] border border-red-200 hover:bg-red-100 transition-colors"
                    >
                        Clear Filters ✕
                    </button>
                )}
                <div className="flex items-center gap-3 ml-auto">
                    <div className="flex items-center gap-1.5">
                        <span className="text-[#86868B] text-xs">Rows:</span>
                        {PAGE_SIZE_OPTIONS.map(size => (
                            <button
                                key={size}
                                onClick={() => setPageSize(size)}
                                className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                                    pageSize === size
                                        ? "bg-[#007AFF] text-white"
                                        : "bg-[#F0F0F5] text-[#86868B] hover:bg-[#D2D2D7]"
                                }`}
                            >
                                {size}
                            </button>
                        ))}
                    </div>
                    <span className="text-[#86868B] text-xs">
                        {(currentPage - 1) * pageSize + 1}–{Math.min(currentPage * pageSize, sortedData.length)} of {sortedData.length}
                    </span>
                </div>
            </div>

            {/* Mobile filter panel */}
            {showFilters && (
                <div className="md:hidden mt-3 p-3 bg-white rounded-lg border border-[#D2D2D7] flex flex-col gap-3">
                    {columns.map(col => {
                        if (!col.filterType) return null;
                        return (
                            <div key={col.key}>
                                <label className="text-[#86868B] text-xs font-medium mb-1 block">{col.label}</label>
                                {col.filterType === "text" && (
                                    <input
                                        value={filters[col.key]}
                                        onChange={(e) => setFilters({ ...filters, [col.key]: e.target.value })}
                                        type="text"
                                        placeholder={`Search ${col.label.toLowerCase()}...`}
                                        className="w-full px-3 py-2 rounded-lg bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] text-sm placeholder-[#86868B] focus:outline-none focus:border-[#007AFF]"
                                    />
                                )}
                                {col.filterType === "multi" && (
                                    <div className="flex flex-wrap gap-1.5">
                                        {col.options.map(option => (
                                            <button
                                                key={option}
                                                onClick={() => toggleMultiFilter(col.key, option)}
                                                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                                                    filters[col.key].includes(option)
                                                        ? "bg-[#007AFF] text-white"
                                                        : "bg-[#F0F0F5] text-[#86868B] hover:bg-[#D2D2D7]"
                                                }`}
                                            >
                                                {option}
                                            </button>
                                        ))}
                                    </div>
                                )}
                                {col.filterType === "dateRange" && (
                                    <div className="flex gap-2">
                                        <input
                                            type="date"
                                            value={filters[col.key].from}
                                            onChange={(e) => setFilters({ ...filters, [col.key]: { ...filters[col.key], from: e.target.value } })}
                                            className="flex-1 px-2 py-1.5 rounded-lg bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] text-xs focus:outline-none focus:border-[#007AFF]"
                                        />
                                        <input
                                            type="date"
                                            value={filters[col.key].to}
                                            onChange={(e) => setFilters({ ...filters, [col.key]: { ...filters[col.key], to: e.target.value } })}
                                            className="flex-1 px-2 py-1.5 rounded-lg bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] text-xs focus:outline-none focus:border-[#007AFF]"
                                        />
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* ===== DESKTOP TABLE (hidden on mobile) ===== */}
            <div className={`hidden md:block ${scrollable ? "overflow-x-auto" : ""}`}>
                <table className={`${scrollable ? "w-max min-w-full" : "w-full"} mt-4`}>
                    <thead className="border-b border-[#D2D2D7]">
                        <tr>
                            {selectable && (
                                <th className="px-4 py-3 w-10">
                                    <input
                                        type="checkbox"
                                        checked={sortedData.length > 0 && sortedData.every(row => selectedKeys?.has(row[rowKey]))}
                                        onChange={(e) => {
                                            if (!onSelectionChange) return;
                                            const next = new Set(selectedKeys);
                                            if (e.target.checked) {
                                                sortedData.forEach(row => next.add(row[rowKey]));
                                            } else {
                                                sortedData.forEach(row => next.delete(row[rowKey]));
                                            }
                                            onSelectionChange(next);
                                        }}
                                        className="accent-[#007AFF] w-4 h-4 cursor-pointer"
                                    />
                                </th>
                            )}
                            {columns.map(col => (
                                <th
                                    key={col.key}
                                    className={`text-left text-sm text-[#86868B] font-medium px-4 py-3 whitespace-nowrap ${
                                        col.sortable ? "cursor-pointer select-none hover:text-[#1D1D1F] transition-colors" : ""
                                    }`}
                                    style={col.width ? { width: col.width, minWidth: col.width } : undefined}
                                    onClick={col.sortable ? () => handleSort(col.key) : undefined}
                                >
                                    <span className="inline-flex items-center gap-1">
                                        {col.label}
                                        {col.sortable && sortKey === col.key && (
                                            <span className="text-[#007AFF]">
                                                {sortDirection === "asc" ? "▲" : "▼"}
                                            </span>
                                        )}
                                        {col.sortable && sortKey !== col.key && (
                                            <span className="text-[#D2D2D7]">⇅</span>
                                        )}
                                    </span>
                                </th>
                            ))}
                        </tr>

                        {showFilters && (
                            <tr className="bg-[#F5F5F7]">
                                {selectable && <th className="px-4 py-3" />}
                                {columns.map(col => (
                                    <th key={col.key} className="text-left text-sm text-[#86868B] font-medium px-4 py-3">
                                        {col.filterType === "text" && (
                                            <input
                                                value={filters[col.key]}
                                                onChange={(e) => setFilters({ ...filters, [col.key]: e.target.value })}
                                                type="text"
                                                placeholder={`Search ${col.label.toLowerCase()}...`}
                                                className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#D2D2D7] text-[#1D1D1F] text-xs placeholder-[#86868B] focus:outline-none focus:border-[#007AFF]"
                                            />
                                        )}
                                        {col.filterType === "multi" && (
                                            <div className="relative" ref={openDropdown === col.key ? dropdownRef : null}>
                                                <button
                                                    onClick={() => setOpenDropdown(openDropdown === col.key ? null : col.key)}
                                                    className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white border border-[#D2D2D7] text-[#1D1D1F] hover:bg-[#F0F0F5] transition-colors"
                                                >
                                                    {col.label}{filters[col.key].length > 0 ? ` (${filters[col.key].length})` : ""} ▼
                                                </button>
                                                {openDropdown === col.key && (
                                                    <div className="absolute top-full left-0 mt-1 z-10 bg-white border border-[#D2D2D7] rounded-lg shadow-md p-2 flex flex-col gap-1 min-w-30 animate-[fadeIn_150ms_ease-out]">
                                                        {col.options.map(option => (
                                                            <button
                                                                key={option}
                                                                onClick={() => toggleMultiFilter(col.key, option)}
                                                                className={`px-3 py-1.5 rounded-lg text-xs font-medium text-left transition-colors ${
                                                                    filters[col.key].includes(option)
                                                                        ? "bg-[#007AFF] text-white"
                                                                        : "bg-[#F0F0F5] text-[#1D1D1F] hover:bg-[#D2D2D7]"
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
                                            <div className="flex flex-col gap-1">
                                                <input
                                                    type="date"
                                                    value={filters[col.key].from}
                                                    onChange={(e) => setFilters({ ...filters, [col.key]: { ...filters[col.key], from: e.target.value } })}
                                                    className="px-2 py-1.5 rounded-lg bg-white border border-[#D2D2D7] text-[#1D1D1F] text-xs focus:outline-none focus:border-[#007AFF]"
                                                />
                                                <input
                                                    type="date"
                                                    value={filters[col.key].to}
                                                    onChange={(e) => setFilters({ ...filters, [col.key]: { ...filters[col.key], to: e.target.value } })}
                                                    className="px-2 py-1.5 rounded-lg bg-white border border-[#D2D2D7] text-[#1D1D1F] text-xs focus:outline-none focus:border-[#007AFF]"
                                                />
                                            </div>
                                        )}
                                    </th>
                                ))}
                            </tr>
                        )}
                    </thead>

                    <tbody>
                        {paginatedData.map(row => (
                            <React.Fragment key={row[rowKey]}>
                            <tr className={`border-b border-[#D2D2D7] transition-colors ${
                                selectable && selectedKeys?.has(row[rowKey])
                                    ? "bg-[#007AFF]/5"
                                    : "hover:bg-[#F5F5F7]"
                            }`}>
                                {selectable && (
                                    <td className="px-4 py-3">
                                        <input
                                            type="checkbox"
                                            checked={selectedKeys?.has(row[rowKey]) || false}
                                            onChange={() => {
                                                if (!onSelectionChange) return;
                                                const next = new Set(selectedKeys);
                                                if (next.has(row[rowKey])) next.delete(row[rowKey]);
                                                else next.add(row[rowKey]);
                                                onSelectionChange(next);
                                            }}
                                            className="accent-[#007AFF] w-4 h-4 cursor-pointer"
                                        />
                                    </td>
                                )}
                                {columns.map(col => (
                                    <td key={col.key} className="px-4 py-3 text-sm text-[#1D1D1F]" style={col.width ? { width: col.width, minWidth: col.width } : undefined}>
                                        {col.render ? col.render(row) : row[col.key]}
                                    </td>
                                ))}
                            </tr>
                            {renderExpandedRow && renderExpandedRow(row)}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* ===== MOBILE CARDS (hidden on desktop) ===== */}
            <div className="md:hidden mt-4 flex flex-col gap-3">
                {paginatedData.map(row => {
                    const key = row[rowKey];
                    const isExpanded = expandedCards.has(key);
                    const isSelected = selectable && selectedKeys?.has(key);

                    return (
                        <div
                            key={key}
                            className={`bg-white border rounded-xl p-4 transition-colors ${
                                isSelected ? "border-[#007AFF]/40 bg-[#007AFF]/5" : "border-[#D2D2D7]"
                            }`}
                        >
                            {/* Card header: selection + primary fields */}
                            <div className="flex items-start gap-3">
                                {selectable && (
                                    <input
                                        type="checkbox"
                                        checked={isSelected || false}
                                        onChange={() => {
                                            if (!onSelectionChange) return;
                                            const next = new Set(selectedKeys);
                                            if (next.has(key)) next.delete(key);
                                            else next.add(key);
                                            onSelectionChange(next);
                                        }}
                                        className="accent-[#007AFF] w-4 h-4 mt-1 cursor-pointer shrink-0"
                                    />
                                )}
                                <div className="flex-1 min-w-0">
                                    {primaryCols.map(col => (
                                        <div key={col.key} className="flex items-baseline gap-2 mb-1.5 last:mb-0">
                                            <span className="text-[#86868B] text-xs font-medium shrink-0">{col.label}</span>
                                            <span className="text-sm text-[#1D1D1F] truncate">
                                                {col.render ? col.render(row) : row[col.key]}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Expanded secondary fields */}
                            {isExpanded && secondaryCols.length > 0 && (
                                <div className="mt-3 pt-3 border-t border-[#D2D2D7] flex flex-col gap-1.5">
                                    {secondaryCols.map(col => (
                                        <div key={col.key} className="flex items-baseline gap-2">
                                            <span className="text-[#86868B] text-xs font-medium shrink-0">{col.label}</span>
                                            <span className="text-sm text-[#1D1D1F]">
                                                {col.render ? col.render(row) : row[col.key]}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* Expand toggle */}
                            {secondaryCols.length > 0 && (
                                <button
                                    onClick={() => toggleCard(key)}
                                    className="mt-2 text-xs text-[#86868B] hover:text-[#1D1D1F] transition-colors flex items-center gap-1"
                                >
                                    <svg className={`w-3 h-3 transition-transform ${isExpanded ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path d="M19 9l-7 7-7-7" />
                                    </svg>
                                    {isExpanded ? "Show less" : `+${secondaryCols.length} more`}
                                </button>
                            )}

                            {/* Custom mobile expanded content (e.g. submission answers) */}
                            {renderMobileExpanded && renderMobileExpanded(row)}
                        </div>
                    );
                })}
            </div>

            {sortedData.length === 0 && (
                <p className="text-[#86868B] mt-6">No results match the current filters.</p>
            )}

            {/* ===== PAGINATION NAVIGATION ===== */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#D2D2D7]">
                    <button
                        onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                        disabled={currentPage === 1}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#F0F0F5] text-[#1D1D1F] hover:bg-[#D2D2D7] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        ← Previous
                    </button>

                    <div className="flex items-center gap-1">
                        {(() => {
                            const pages = [];
                            const show = (p) => pages.push({ type: "page", value: p });
                            const dots = () => pages.push({ type: "dots" });

                            if (totalPages <= 7) {
                                for (let i = 1; i <= totalPages; i++) show(i);
                            } else {
                                show(1);
                                if (currentPage > 3) dots();
                                const start = Math.max(2, currentPage - 1);
                                const end = Math.min(totalPages - 1, currentPage + 1);
                                for (let i = start; i <= end; i++) show(i);
                                if (currentPage < totalPages - 2) dots();
                                show(totalPages);
                            }

                            return pages.map((item, idx) =>
                                item.type === "dots" ? (
                                    <span key={`dots-${idx}`} className="px-1 text-[#86868B] text-xs">…</span>
                                ) : (
                                    <button
                                        key={item.value}
                                        onClick={() => setCurrentPage(item.value)}
                                        className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                                            currentPage === item.value
                                                ? "bg-[#007AFF] text-white"
                                                : "bg-[#F0F0F5] text-[#86868B] hover:bg-[#D2D2D7]"
                                        }`}
                                    >
                                        {item.value}
                                    </button>
                                )
                            );
                        })()}
                    </div>

                    <button
                        onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                        disabled={currentPage === totalPages}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-[#F0F0F5] text-[#1D1D1F] hover:bg-[#D2D2D7] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        Next →
                    </button>
                </div>
            )}
        </div>
    );
}
