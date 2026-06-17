"use client";

import { useEffect, useRef, useState } from "react";

// Dependency-free responsive line chart for workout progress.
// Renders a single series of { label, value } points as an SVG line with axes,
// gridlines, and a hover tooltip. Themed via CSS variables so it follows dark mode.
// The plot itself stays LTR (time flows left→right) even in RTL layouts.

const PADDING = { top: 16, right: 16, bottom: 28, left: 40 };
const Y_TICKS = 4;

export default function LineChart({ data = [], height = 220, formatValue = (v) => v, valueLabel = "" }) {
    const containerRef = useRef(null);
    const [width, setWidth] = useState(0);
    const [hoverIndex, setHoverIndex] = useState(null);

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const update = () => setWidth(el.clientWidth);
        update();
        const ro = new ResizeObserver(update);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const points = Array.isArray(data) ? data.filter(p => p && p.value != null) : [];

    if (points.length === 0) {
        return (
            <div ref={containerRef} className="w-full flex items-center justify-center text-sm text-muted-foreground" style={{ height }}>
                —
            </div>
        );
    }

    const innerWidth  = Math.max(0, width - PADDING.left - PADDING.right);
    const innerHeight = height - PADDING.top - PADDING.bottom;

    const values = points.map(p => p.value);
    const rawMax = Math.max(...values);
    const rawMin = Math.min(...values);
    // Pad the range a touch; collapse to a sane band when all values are equal.
    const span   = rawMax - rawMin || Math.abs(rawMax) || 1;
    const yMax   = rawMax + span * 0.1;
    const yMin   = Math.max(0, rawMin - span * 0.1);

    const xFor = (i) => points.length === 1
        ? PADDING.left + innerWidth / 2
        : PADDING.left + (innerWidth * i) / (points.length - 1);
    const yFor = (v) => PADDING.top + innerHeight * (1 - (v - yMin) / (yMax - yMin || 1));

    const linePath = points
        .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.value).toFixed(1)}`)
        .join(" ");

    const yTickValues = Array.from({ length: Y_TICKS + 1 }, (_, i) => yMin + ((yMax - yMin) * i) / Y_TICKS);

    // Show at most ~6 x labels to avoid crowding.
    const xLabelStep = Math.max(1, Math.ceil(points.length / 6));

    function handleMove(e) {
        if (!width) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        let nearest = 0;
        let best = Infinity;
        for (let i = 0; i < points.length; i++) {
            const d = Math.abs(xFor(i) - x);
            if (d < best) { best = d; nearest = i; }
        }
        setHoverIndex(nearest);
    }

    const hovered = hoverIndex != null ? points[hoverIndex] : null;

    return (
        <div ref={containerRef} className="w-full" style={{ position: "relative" }} dir="ltr">
            {width > 0 && (
                <svg
                    width={width}
                    height={height}
                    onMouseMove={handleMove}
                    onMouseLeave={() => setHoverIndex(null)}
                    style={{ display: "block", touchAction: "none" }}
                >
                    {/* Horizontal gridlines + y labels */}
                    {yTickValues.map((v, i) => {
                        const y = yFor(v);
                        return (
                            <g key={i}>
                                <line
                                    x1={PADDING.left} y1={y} x2={width - PADDING.right} y2={y}
                                    stroke="var(--color-border)" strokeWidth="1"
                                />
                                <text
                                    x={PADDING.left - 6} y={y + 3} textAnchor="end"
                                    fontSize="10" fill="var(--color-muted-foreground)"
                                >
                                    {formatValue(Math.round(v * 10) / 10)}
                                </text>
                            </g>
                        );
                    })}

                    {/* Area-ish baseline + the line */}
                    <path d={linePath} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

                    {/* Dots */}
                    {points.map((p, i) => (
                        <circle
                            key={i}
                            cx={xFor(i)} cy={yFor(p.value)} r={hoverIndex === i ? 4 : 2.5}
                            fill="var(--color-primary)"
                        />
                    ))}

                    {/* X labels */}
                    {points.map((p, i) => (
                        (i % xLabelStep === 0 || i === points.length - 1) ? (
                            <text
                                key={i}
                                x={xFor(i)} y={height - 8} textAnchor="middle"
                                fontSize="10" fill="var(--color-muted-foreground)"
                            >
                                {p.label}
                            </text>
                        ) : null
                    ))}

                    {/* Hover guide */}
                    {hovered && (
                        <line
                            x1={xFor(hoverIndex)} y1={PADDING.top} x2={xFor(hoverIndex)} y2={PADDING.top + innerHeight}
                            stroke="var(--color-primary)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5"
                        />
                    )}
                </svg>
            )}

            {/* Tooltip */}
            {hovered && (
                <div
                    className="pointer-events-none absolute rounded-lg border border-border bg-background px-2 py-1 text-xs shadow-sm"
                    style={{
                        left: Math.min(Math.max(xFor(hoverIndex), 50), width - 50),
                        top: 4,
                        transform: "translateX(-50%)",
                        whiteSpace: "nowrap",
                    }}
                >
                    <span className="font-semibold text-foreground">{formatValue(hovered.value)}{valueLabel ? ` ${valueLabel}` : ""}</span>
                    <span className="text-muted-foreground"> · {hovered.label}</span>
                </div>
            )}
        </div>
    );
}
