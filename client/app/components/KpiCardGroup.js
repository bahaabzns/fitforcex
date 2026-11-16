"use client";

import { Card } from "@heroui/react/card";
import InfoTooltip from "@/app/components/InfoTooltip";
import NumberWithUnit from "@/app/components/NumberWithUnit";

// ============================================================
// KpiCardGroup — a Card housing a family of related numbers
// (per-status or per-currency totals) so each stat doesn't need
// its own Card. An optional title says what the group is.
//
// Phone: a list — each row has the label on one side and the figure
// on the other, so a long figure never has to share a narrow column.
// From sm up: a two-column grid of stats, divided by thin lines; a
// lone last stat spans the full width.
// ============================================================

// The dividers are drawn on the stats themselves: a line above every stat but the first (the rows),
// and from sm up a line beside every second stat (the two columns) with the second one sharing the
// first one's row.
const STAT_DIVIDERS = "border-border [&:not(:first-child)]:border-t sm:[&:nth-child(2)]:border-t-0 sm:[&:nth-child(2n)]:border-s sm:last:odd:col-span-2";

function KpiStat({ label, value, unit, caption, hint }) {
    return (
        <div className={`flex min-w-0 items-baseline justify-between gap-3 px-4 py-3 sm:flex-col sm:items-stretch sm:justify-center sm:gap-0 sm:px-5 sm:py-3.5 ${STAT_DIVIDERS}`}>
            <div className="flex min-w-0 items-center gap-1 sm:mb-2">
                <p className="truncate text-sm font-medium text-muted-foreground">{label}</p>
                {hint && <InfoTooltip text={hint} />}
            </div>
            <div className="shrink-0 text-end sm:text-start">
                <p className="text-xl font-bold leading-none tracking-tight text-foreground tabular-nums sm:text-2xl">
                    <NumberWithUnit value={`${value}${unit ? ` ${unit}` : ""}`} />
                </p>
                {caption && <p className="mt-1.5 text-xs text-muted-foreground">{caption}</p>}
            </div>
        </div>
    );
}

export default function KpiCardGroup({ items, title, className = "" }) {
    if (!items || items.length === 0) return null;

    return (
        <Card className={`rounded-xl ${className}`}>
            <Card.Content className="flex h-full flex-col overflow-hidden p-0">
                {title && (
                    <p className="border-b border-border px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:px-5">
                        {title}
                    </p>
                )}
                <div className="grid flex-1 grid-cols-1 content-stretch sm:grid-cols-2">
                    {items.map((item) => (
                        <KpiStat key={item.key} label={item.label} value={item.value} unit={item.unit} caption={item.caption} hint={item.hint} />
                    ))}
                </div>
            </Card.Content>
        </Card>
    );
}
