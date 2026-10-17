"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-react";
import { Table } from "@heroui/react/table";

// Empty values sort last, whichever direction is chosen.
const isEmpty = (value) => value === null || value === undefined;

function compareValues(a, b) {
    if (typeof a === "string" || typeof b === "string") return String(a).localeCompare(String(b));
    return a - b;
}

/**
 * The Team Workload tables, on HeroUI's Table (the same primitives the app's DataTable is built on):
 * sortable column headers, a header that stays opaque while the body scrolls, and optionally clickable rows.
 *
 *   columns    [{ key, label, sortable?, sortValue?(row), render(row) }]; `label` may be any node
 *   rows       sortable rows, each with a unique `id`
 *   footerRows rows kept at the bottom whatever the sort (totals, "unassigned", ...)
 *   onRowClick (row) => void; a row with `clickable: false` is skipped
 *   isSelected (row) => boolean to highlight a row
 *   scroll     "both" (default) scrolls vertically too, so the caller decides the height; "x" only scrolls sideways
 *
 * `defaultSort` is { key, direction: "ascending" | "descending" }.
 */
export default function OpsTable({
    ariaLabel, columns, rows, footerRows = [], defaultSort = null, onRowClick, isSelected, scroll = "both",
}) {
    const [sort, setSort] = useState(defaultSort ? { column: defaultSort.key, direction: defaultSort.direction ?? "descending" } : null);

    const sortedRows = useMemo(() => {
        const column = sort ? columns.find((col) => col.key === sort.column) : null;
        if (!column?.sortable) return rows;
        const valueOf = (row) => (column.sortValue ? column.sortValue(row) : row[column.key]);
        const direction = sort.direction === "ascending" ? 1 : -1;
        return [...rows].sort((left, right) => {
            const a = valueOf(left);
            const b = valueOf(right);
            if (isEmpty(a) && isEmpty(b)) return 0;
            if (isEmpty(a)) return 1;
            if (isEmpty(b)) return -1;
            return compareValues(a, b) * direction;
        });
    }, [rows, columns, sort]);

    return (
        <div className={scroll === "both" ? "h-full min-w-0 max-w-full" : "min-w-0 max-w-full"}>
            {/* With scroll="both" the table fills the height it is given and scrolls INSIDE it: HeroUI's scroll
                container is the scroller, so the sticky header below stays pinned while only the rows move. */}
            <Table className={scroll === "both" ? "h-full" : ""}>
                <Table.ScrollContainer className={scroll === "both" ? "h-full overflow-auto" : "overflow-x-auto"}>
                    <Table.Content aria-label={ariaLabel} sortDescriptor={sort ?? undefined} onSortChange={setSort}>
                        <Table.Header>
                            {columns.map((col, index) => (
                                <Table.Column
                                    key={col.key}
                                    id={col.key}
                                    allowsSorting={!!col.sortable}
                                    isRowHeader={index === 0}
                                    // The header needs its own opaque background and layer: rows scroll underneath it.
                                    className={`sticky top-0 isolate bg-surface-secondary ${index === 0 ? "start-0 z-20" : "z-10"}`}
                                    data-sticky-start={index === 0 ? "true" : undefined}
                                >
                                    {col.sortable
                                        ? ({ sortDirection }) => (
                                            <span className="flex items-center justify-between gap-1">
                                                {col.label}
                                                {sortDirection === "ascending" && <ChevronUp size={13} className="text-primary shrink-0" />}
                                                {sortDirection === "descending" && <ChevronDown size={13} className="text-primary shrink-0" />}
                                                {!sortDirection && <ChevronsUpDown size={13} className="text-muted-foreground shrink-0 opacity-50" />}
                                            </span>
                                        )
                                        : col.label}
                                </Table.Column>
                            ))}
                        </Table.Header>
                        <Table.Body>
                            {[...sortedRows, ...footerRows].map((row) => {
                                const clickable = !!onRowClick && row.clickable !== false;
                                return (
                                    <Table.Row
                                        data-ops-active={isSelected?.(row) ? "true" : undefined}
                                        key={row.id}
                                        id={row.id}
                                        // onAction, not onClick: react-aria rows only respond to presses through their own action handler
                                        onAction={clickable ? () => onRowClick(row) : undefined}
                                        className={`${clickable ? "cursor-pointer" : ""}`}
                                    >
                                        {columns.map((col, index) => (
                                            // The first column is pinned to the start edge so the name stays visible while the
                                            // other columns scroll sideways (opaque background: see [data-sticky-start] in globals.css).
                                            <Table.Cell
                                                key={col.key}
                                                className={index === 0 ? "sticky start-0 z-1" : ""}
                                                data-sticky-start={index === 0 ? "true" : undefined}
                                            >
                                                {col.render(row)}
                                            </Table.Cell>
                                        ))}
                                    </Table.Row>
                                );
                            })}
                        </Table.Body>
                    </Table.Content>
                </Table.ScrollContainer>
            </Table>
        </div>
    );
}
