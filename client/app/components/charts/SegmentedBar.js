'use client';

import { Legend } from './ChartCard';
import ChartTooltip from './ChartTooltip';
import { useChartTooltip } from './useChartTooltip';

const BAR_HEIGHT_PX = 28;
const SEGMENT_GAP_PX = 2;
// A block narrower than this prints no number — the legend, tooltip and table carry it instead.
const MIN_PERCENT_FOR_INLINE_LABEL = 9;

// One whole split into a few parts (≤ 6), read at a glance. parts: [{ key, label, value, color, onFill? }] — onFill overrides the in-block label colour.
export default function SegmentedBar({ parts, onSelect, selectedKey, emptyText = 'Nothing to show yet.' }) {
    const { wrapperRef, tooltip, bind } = useChartTooltip();
    const total = parts.reduce((sum, part) => sum + part.value, 0);

    if (total === 0) {
        return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
    }

    const isClickable = typeof onSelect === 'function';
    const Segment = isClickable ? 'button' : 'div';

    return (
        <div ref={wrapperRef} className="relative flex flex-col gap-3">
            <div className="flex" style={{ height: BAR_HEIGHT_PX, gap: SEGMENT_GAP_PX }}>
                {parts.filter(part => part.value > 0).map(part => {
                    const percent = Math.round((part.value / total) * 100);
                    return (
                        <Segment
                            key={part.key}
                            {...(isClickable ? { type: 'button', onClick: () => onSelect(part.key), 'aria-pressed': selectedKey === part.key } : { tabIndex: 0 })}
                            aria-label={`${part.label}: ${part.value} (${percent}%)`}
                            className={`viz-mark viz-segment flex items-center overflow-hidden rounded px-2 text-xs font-semibold ${selectedKey === part.key ? 'ring-2 ring-foreground/60' : ''}`}
                            style={{ flex: `${part.value} 1 0`, background: part.color, color: part.onFill ?? 'var(--viz-on-fill)' }}
                            {...bind({ title: part.label, rows: [{ label: 'coaches', value: part.value, color: part.color }, { label: 'of all coaches', value: `${percent}%` }] })}
                        >
                            {percent >= MIN_PERCENT_FOR_INLINE_LABEL ? `${percent}%` : ''}
                        </Segment>
                    );
                })}
            </div>
            <Legend items={parts.map(part => ({ label: `${part.label} · ${part.value}`, color: part.color }))} />
            <ChartTooltip tooltip={tooltip} />
        </div>
    );
}
