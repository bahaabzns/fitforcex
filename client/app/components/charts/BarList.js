'use client';

import ChartTooltip from './ChartTooltip';
import { useChartTooltip } from './useChartTooltip';

const BAR_THICKNESS_PX = 12;
const BAR_GAP_PX = 4;
const LABEL_WIDTH_PX = 150;

// Ranked horizontal bars on one baseline. Each row can hold several parts (e.g. "signed up" and
// "subscribed" for the same source); parts stack with a small gap and share one scale.
export default function BarList({ rows, formatValue = String, emptyText = 'Nothing to show yet.' }) {
    const { wrapperRef, tooltip, bind } = useChartTooltip();
    const maxValue = Math.max(0, ...rows.flatMap(row => row.parts.map(part => part.value)));

    if (rows.length === 0 || maxValue === 0) {
        return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
    }

    return (
        <div ref={wrapperRef} className="relative flex flex-col gap-3">
            {rows.map(row => (
                <div
                    key={row.key}
                    tabIndex={0}
                    aria-label={`${row.label}: ${row.parts.map(part => `${part.label} ${formatValue(part.value)}`).join(', ')}`}
                    className="viz-mark flex items-center gap-3 rounded-md"
                    {...bind({ title: row.label, rows: row.parts.map(part => ({ label: part.label, value: formatValue(part.value), color: part.color })) })}
                >
                    <div className="shrink-0" style={{ width: LABEL_WIDTH_PX }}>
                        <p className="truncate text-sm text-foreground">{row.label}</p>
                        {row.note && <p className="truncate text-xs text-muted-foreground">{row.note}</p>}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col" style={{ gap: BAR_GAP_PX }}>
                        {row.parts.map(part => (
                            <div key={part.key} className="flex items-center gap-2">
                                <div
                                    className="viz-bar"
                                    style={{
                                        height: BAR_THICKNESS_PX,
                                        width: `${(part.value / maxValue) * 100}%`,
                                        minWidth: part.value > 0 ? 3 : 0,
                                        background: part.color,
                                        borderRadius: '0 4px 4px 0',
                                    }}
                                />
                                <span className="text-xs tabular-nums text-muted-foreground">{formatValue(part.value)}</span>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
            <ChartTooltip tooltip={tooltip} />
        </div>
    );
}
