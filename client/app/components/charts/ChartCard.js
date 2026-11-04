'use client';

import { useState } from 'react';
import { Table2, BarChart3 } from 'lucide-react';
import './charts.css';

export function Legend({ items }) {
    return (
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
            {items.map(item => (
                <li key={item.label} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: item.color }} />
                    {item.label}
                </li>
            ))}
        </ul>
    );
}

function DataTable({ table }) {
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b border-border text-xs text-muted-foreground">
                        {table.columns.map(column => <th key={column} className="py-1.5 pr-4 font-medium">{column}</th>)}
                    </tr>
                </thead>
                <tbody>
                    {table.rows.map((row, rowIndex) => (
                        <tr key={rowIndex} className="border-b border-border/60 last:border-0">
                            {row.map((cell, cellIndex) => (
                                <td key={cellIndex} className="py-1.5 pr-4 tabular-nums text-foreground">{cell}</td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

// One frame for every chart: title + plain-language subtitle, an optional legend, and a table twin
// so every number is reachable without hovering.
export default function ChartCard({ title, subtitle, legend, table, children, className = '' }) {
    const [showTable, setShowTable] = useState(false);

    return (
        <section className={`viz-root flex flex-col gap-4 rounded-xl border border-border bg-card p-5 ${className}`}>
            <header className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-sm font-semibold text-foreground">{title}</h2>
                    {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
                </div>
                {table && (
                    <button
                        type="button"
                        onClick={() => setShowTable(current => !current)}
                        aria-pressed={showTable}
                        className="flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-default hover:text-foreground"
                    >
                        {showTable ? <BarChart3 size={13} /> : <Table2 size={13} />}
                        {showTable ? 'Chart' : 'Table'}
                    </button>
                )}
            </header>
            {legend && !showTable && <Legend items={legend} />}
            {showTable && table ? <DataTable table={table} /> : children}
        </section>
    );
}
