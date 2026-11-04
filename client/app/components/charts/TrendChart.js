'use client';

import { useEffect, useRef, useState } from 'react';
import ChartTooltip from './ChartTooltip';

const HEIGHT_PX = 220;
const MARGIN = { top: 14, right: 64, bottom: 26, left: 30 };
const LINE_WIDTH_PX = 2;
const END_DOT_RADIUS_PX = 4;
const SURFACE_RING_PX = 2;
const TOOLTIP_WIDTH_PX = 190;
const MIN_END_LABEL_GAP_PX = 14;

function niceMax(value) {
    if (value <= 4) return Math.max(2, Math.ceil(value / 2) * 2);
    const magnitude = 10 ** Math.floor(Math.log10(value));
    return [1, 2, 5, 10].find(multiple => multiple * magnitude >= value) * magnitude;
}

function useElementWidth() {
    const ref = useRef(null);
    const [width, setWidth] = useState(0);
    useEffect(() => {
        const node = ref.current;
        if (!node) return undefined;
        const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)));
        observer.observe(node);
        return () => observer.disconnect();
    }, []);
    return [ref, width];
}

/**
 * Line chart for change over time. `labels` are the x positions; each series has one value per label.
 * A hairline crosshair snaps to the nearest week and one tooltip lists every series at that point.
 * Arrow keys move it, so the readout isn't pointer-only.
 */
export default function TrendChart({ labels, series, formatLabel = String, emptyText = 'Nothing to show yet.' }) {
    const [wrapperRef, width] = useElementWidth();
    const [activeIndex, setActiveIndex] = useState(null);

    const peak = Math.max(0, ...series.flatMap(item => item.values));
    const isEmpty = labels.length < 2 || peak === 0;

    const axisMax = niceMax(peak);
    const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
    const innerHeight = HEIGHT_PX - MARGIN.top - MARGIN.bottom;
    const xAt = index => MARGIN.left + (index / (labels.length - 1)) * innerWidth;
    const yAt = value => MARGIN.top + innerHeight - (value / axisMax) * innerHeight;
    const ticks = [axisMax, axisMax / 2, 0];
    // Show roughly one x label per ~70px so they never collide.
    const labelEvery = Math.max(1, Math.ceil(labels.length / Math.max(1, Math.floor(innerWidth / 70))));

    const nearestIndex = clientX => {
        const bounds = wrapperRef.current.getBoundingClientRect();
        const ratio = (clientX - bounds.left - MARGIN.left) / innerWidth;
        return Math.min(labels.length - 1, Math.max(0, Math.round(ratio * (labels.length - 1))));
    };

    const onKeyDown = event => {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        event.preventDefault();
        const step = event.key === 'ArrowRight' ? 1 : -1;
        setActiveIndex(current => Math.min(labels.length - 1, Math.max(0, (current ?? labels.length - 1) + step)));
    };

    // End labels are skipped when two lines finish too close together to name both.
    const endLabels = series
        .map(item => ({ item, y: yAt(item.values[item.values.length - 1]) }))
        .sort((a, b) => a.y - b.y)
        .filter((entry, position, list) => position === 0 || entry.y - list[position - 1].y >= MIN_END_LABEL_GAP_PX);

    const tooltip = activeIndex === null ? null : {
        x: Math.min(Math.max(0, xAt(activeIndex) + 12), Math.max(0, width - TOOLTIP_WIDTH_PX)),
        y: MARGIN.top,
        content: {
            title: formatLabel(labels[activeIndex]),
            rows: series.map(item => ({ label: item.label, value: item.values[activeIndex], color: item.color })),
        },
    };

    return (
        <div ref={wrapperRef} className="relative" style={{ height: isEmpty ? undefined : HEIGHT_PX }}>
            {isEmpty && <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>}
            {!isEmpty && width > 0 && (
                <svg
                    width={width}
                    height={HEIGHT_PX}
                    role="img"
                    tabIndex={0}
                    aria-label={`Trend over ${labels.length} weeks: ${series.map(item => item.label).join(' and ')}. Use the arrow keys to read each week.`}
                    onPointerMove={event => setActiveIndex(nearestIndex(event.clientX))}
                    onPointerLeave={() => setActiveIndex(null)}
                    onKeyDown={onKeyDown}
                    onBlur={() => setActiveIndex(null)}
                    className="outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                >
                    {ticks.map(tick => (
                        <g key={tick}>
                            <line x1={MARGIN.left} x2={width - MARGIN.right} y1={yAt(tick)} y2={yAt(tick)} stroke={tick === 0 ? 'var(--viz-baseline)' : 'var(--viz-grid)'} strokeWidth="1" />
                            <text x={MARGIN.left - 8} y={yAt(tick)} textAnchor="end" dominantBaseline="middle" fontSize="11" fill="var(--viz-muted)">{tick}</text>
                        </g>
                    ))}

                    {labels.map((label, index) => index % labelEvery === 0 && (
                        <text key={label} x={xAt(index)} y={HEIGHT_PX - 6} textAnchor="middle" fontSize="11" fill="var(--viz-muted)">{formatLabel(label)}</text>
                    ))}

                    {activeIndex !== null && (
                        <line x1={xAt(activeIndex)} x2={xAt(activeIndex)} y1={MARGIN.top} y2={MARGIN.top + innerHeight} stroke="var(--viz-baseline)" strokeWidth="1" />
                    )}

                    {series.map(item => (
                        <polyline
                            key={item.key}
                            fill="none"
                            stroke={item.color}
                            strokeWidth={LINE_WIDTH_PX}
                            strokeLinejoin="round"
                            strokeLinecap="round"
                            points={item.values.map((value, index) => `${xAt(index)},${yAt(value)}`).join(' ')}
                        />
                    ))}

                    {series.map(item => {
                        const index = activeIndex ?? item.values.length - 1;
                        return (
                            <circle
                                key={item.key}
                                cx={xAt(index)}
                                cy={yAt(item.values[index])}
                                r={END_DOT_RADIUS_PX}
                                fill={item.color}
                                stroke="var(--viz-surface)"
                                strokeWidth={SURFACE_RING_PX}
                            />
                        );
                    })}

                    {activeIndex === null && endLabels.map(({ item, y }) => (
                        <text key={item.key} x={xAt(labels.length - 1) + 10} y={y} dominantBaseline="middle" fontSize="11" fill="var(--viz-ink-2)">{item.label}</text>
                    ))}
                </svg>
            )}
            <ChartTooltip tooltip={tooltip} />
        </div>
    );
}
