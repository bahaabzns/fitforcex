'use client';

import ChartTooltip from './ChartTooltip';
import { useChartTooltip } from './useChartTooltip';

const COLUMN_MAX_WIDTH_PX = 24;
const SEGMENT_GAP_PX = 2;
const Y_AXIS_WIDTH_PX = 30;
const TOTAL_LABEL_MAX_CATEGORIES = 8;

// Round the axis top to a tidy number (1, 2, 5 × 10ⁿ) so gridlines read as 0 / half / top.
function niceMax(value) {
    if (value <= 4) return Math.max(2, Math.ceil(value / 2) * 2);
    const magnitude = 10 ** Math.floor(Math.log10(value));
    const step = [1, 2, 5, 10].find(multiple => multiple * magnitude >= value);
    return step * magnitude;
}

/**
 * Vertical columns, optionally stacked. A category may carry its own `color` (single-series
 * emphasis: highlight the ones that matter, grey the rest). `onSelect(categoryKey)` makes the
 * columns clickable filters.
 */
export default function ColumnChart({
    categories, series, stacked = false, height = 176, onSelect, selectedKey,
    formatValue = String, emptyText = 'Nothing to show yet.',
}) {
    const { wrapperRef, tooltip, bind } = useChartTooltip();
    const totals = categories.map(category => series.reduce((sum, item) => sum + (category.values[item.key] ?? 0), 0));
    const axisMax = niceMax(Math.max(0, ...totals));

    if (categories.length === 0 || Math.max(0, ...totals) === 0) {
        return <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>;
    }

    const showTotals = categories.length <= TOTAL_LABEL_MAX_CATEGORIES;
    const ticks = [axisMax, axisMax / 2, 0];

    return (
        <div ref={wrapperRef} className="relative">
            <div className="flex">
                <div className="relative shrink-0" style={{ width: Y_AXIS_WIDTH_PX, height }}>
                    {ticks.map(tick => (
                        <span key={tick} className="absolute right-2 -translate-y-1/2 text-[11px] tabular-nums text-muted-foreground" style={{ top: `${100 - (tick / axisMax) * 100}%` }}>
                            {formatValue(tick)}
                        </span>
                    ))}
                </div>
                <div className="relative flex-1" style={{ height }}>
                    {ticks.map(tick => (
                        <div
                            key={tick}
                            className="absolute inset-x-0"
                            style={{ top: `${100 - (tick / axisMax) * 100}%`, borderTop: `1px solid ${tick === 0 ? 'var(--viz-baseline)' : 'var(--viz-grid)'}` }}
                        />
                    ))}
                    <div className="absolute inset-0 flex items-end">
                        {categories.map((category, index) => (
                            <Column
                                key={category.key}
                                category={category}
                                series={series}
                                stacked={stacked}
                                total={totals[index]}
                                axisMax={axisMax}
                                showTotal={showTotals}
                                isSelected={selectedKey === category.key}
                                onSelect={onSelect}
                                formatValue={formatValue}
                                bind={bind}
                            />
                        ))}
                    </div>
                </div>
            </div>
            <div className="flex" style={{ paddingLeft: Y_AXIS_WIDTH_PX }}>
                {categories.map(category => (
                    <span key={category.key} className="flex-1 truncate px-0.5 pt-2 text-center text-[11px] text-muted-foreground">{category.label}</span>
                ))}
            </div>
            <ChartTooltip tooltip={tooltip} />
        </div>
    );
}

function Column({ category, series, stacked, total, axisMax, showTotal, isSelected, onSelect, formatValue, bind }) {
    const visibleSeries = series.filter(item => (category.values[item.key] ?? 0) > 0);
    const isClickable = typeof onSelect === 'function';
    const Wrapper = isClickable ? 'button' : 'div';
    const tooltipContent = {
        title: category.label,
        rows: [
            ...series.map(item => ({ label: item.label, value: formatValue(category.values[item.key] ?? 0), color: category.color ?? item.color })),
            ...(stacked && series.length > 1 ? [{ label: 'Total', value: formatValue(total) }] : []),
        ],
    };

    return (
        <Wrapper
            {...(isClickable ? { type: 'button', onClick: () => onSelect(category.key), 'aria-pressed': isSelected } : { tabIndex: 0 })}
            aria-label={`${category.label}: ${formatValue(total)}`}
            className={`viz-mark flex h-full flex-1 items-end justify-center rounded-sm px-0.5 ${isSelected ? 'bg-primary/10' : ''}`}
            {...bind(tooltipContent)}
        >
            <div
                className="relative flex flex-col-reverse"
                style={{ width: '100%', maxWidth: COLUMN_MAX_WIDTH_PX, height: `${(total / axisMax) * 100}%`, gap: SEGMENT_GAP_PX }}
            >
                {showTotal && total > 0 && (
                    <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-[11px] font-medium tabular-nums text-foreground">{formatValue(total)}</span>
                )}
                {(stacked ? visibleSeries : series.slice(0, 1)).map((item, position, list) => {
                    const value = stacked ? category.values[item.key] : total;
                    const isTop = position === list.length - 1;
                    return (
                        <div
                            key={item.key}
                            className="viz-bar"
                            style={{
                                flex: `${value} 1 0`,
                                minHeight: 2,
                                background: category.color ?? item.color,
                                // square at the baseline, 4px rounded at the data end
                                borderRadius: isTop ? '4px 4px 0 0' : 0,
                            }}
                        />
                    );
                })}
            </div>
        </Wrapper>
    );
}
