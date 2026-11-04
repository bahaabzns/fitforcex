'use client';

// Values lead, labels follow. Everything is rendered as React text (never HTML), so names that come
// from data (sources, campaigns) can't inject markup.
export default function ChartTooltip({ tooltip }) {
    if (!tooltip) return null;
    const { title, rows = [] } = tooltip.content;

    return (
        <div className="viz-tooltip" style={{ left: tooltip.x, top: tooltip.y }} role="status">
            {title && <p className="mb-1 font-medium text-foreground">{title}</p>}
            {rows.map(row => (
                <div key={row.label} className="flex items-center gap-2 py-0.5">
                    {row.color && <span aria-hidden="true" className="inline-block h-0.5 w-3 shrink-0 rounded" style={{ background: row.color }} />}
                    <span className="text-sm font-semibold text-foreground">{row.value}</span>
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                </div>
            ))}
        </div>
    );
}
