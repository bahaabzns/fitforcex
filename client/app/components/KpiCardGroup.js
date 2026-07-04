"use client";

import { Card } from "@heroui/react/card";
import { Separator } from "@heroui/react/separator";

// ============================================================
// KpiCardGroup — a Card housing several KPI stats side by side,
// separated by vertical dividers. Used for "family of related
// numbers" summaries (e.g. per-status or per-currency totals)
// where each stat doesn't warrant its own Card.
// ============================================================

function KpiStat({ label, value, unit, caption }) {
    return (
        <div className="flex flex-col justify-center px-5 py-3.5">
            <p className="text-sm font-medium text-muted-foreground truncate mb-2">{label}</p>
            <p className="text-2xl font-bold text-foreground tabular-nums leading-none tracking-tight">
                {value}{unit ? ` ${unit}` : ""}
            </p>
            {caption && (
                <p className="text-xs text-muted-foreground mt-1.5">{caption}</p>
            )}
        </div>
    );
}

export default function KpiCardGroup({ items, className = "" }) {
    if (!items || items.length === 0) return null;

    return (
        <Card className={`rounded-xl ${className}`}>
            <Card.Content className="p-0 overflow-hidden flex flex-row h-full">
                {items.flatMap((item, i) => [
                    i > 0 && <Separator key={`sep-${item.key}`} orientation="vertical" className="self-stretch h-auto" />,
                    <KpiStat key={item.key} label={item.label} value={item.value} unit={item.unit} caption={item.caption} />,
                ]).filter(Boolean)}
            </Card.Content>
        </Card>
    );
}
