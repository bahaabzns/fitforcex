"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronUp, ChevronDown, Minus } from "lucide-react";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";

const PAD = { top: 20, right: 16, bottom: 32, left: 48 };
const Y_TICKS = 4;

// Catmull-Rom → cubic-bezier smooth path for a series of (x, y) coordinates.
function smoothPath(pts, xFor, yFor) {
    if (pts.length < 2) {
        return pts
            .map((p, i) => `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.value).toFixed(1)}`)
            .join(" ");
    }
    const c = pts.map((p, i) => ({ x: xFor(i), y: yFor(p.value) }));
    let d = `M ${c[0].x.toFixed(1)} ${c[0].y.toFixed(1)}`;
    for (let i = 1; i < c.length; i++) {
        const p0 = c[Math.max(0, i - 2)];
        const p1 = c[i - 1];
        const p2 = c[i];
        const p3 = c[Math.min(c.length - 1, i + 1)];
        const cp1x = (p1.x + (p2.x - p0.x) / 6).toFixed(1);
        const cp1y = (p1.y + (p2.y - p0.y) / 6).toFixed(1);
        const cp2x = (p2.x - (p3.x - p1.x) / 6).toFixed(1);
        const cp2y = (p2.y - (p3.y - p1.y) / 6).toFixed(1);
        d += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`;
    }
    return d;
}

function DeltaChip({ delta, unit, formatFn }) {
    const abs   = Math.abs(delta);
    const sign  = delta > 0 ? "+" : delta < 0 ? "−" : "";
    const color = delta > 0 ? "success" : delta < 0 ? "danger" : "default";
    const Icon  = delta > 0 ? ChevronUp : delta < 0 ? ChevronDown : Minus;
    return (
        <Chip size="sm" color={color} variant="soft">
            <Icon size={10} />
            <Chip.Label>{sign}{formatFn(abs)}{unit ? ` ${unit}` : ""}</Chip.Label>
        </Chip>
    );
}

export default function AreaChart({
    data          = [],
    height        = 240,
    formatValue   = (v) => String(v),
    label         = "Value",
    // Header props — when provided, renders a HeroUI Card with a styled metric header
    title         = null,
    icon          = null,
    currentValue  = null,
    startValue    = null,
    unit          = null,
    readingsCount = null,
    delta         = null,
}) {
    const containerRef = useRef(null);
    const [width, setWidth] = useState(0);
    const [hoverIdx, setHoverIdx] = useState(null);
    const rawId = useId();
    const uid = `ac-${rawId.replace(/:/g, "")}`;

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return;
        const sync = () => setWidth(el.clientWidth);
        sync();
        const ro = new ResizeObserver(sync);
        ro.observe(el);
        return () => ro.disconnect();
    }, []);

    const points = Array.isArray(data) ? data.filter(p => p?.value != null) : [];

    // ── Build chart body JSX inline so the ref assignment stays at component level ──
    let chartBody;

    if (points.length === 0) {
        chartBody = (
            <div
                ref={containerRef}
                className="w-full flex items-center justify-center text-sm text-muted-foreground"
                style={{ height }}
            >
                —
            </div>
        );
    } else {
        const innerW  = Math.max(0, width - PAD.left - PAD.right);
        const innerH  = height - PAD.top - PAD.bottom;
        const bottomY = PAD.top + innerH;

        const vals   = points.map(p => p.value);
        const rawMax = Math.max(...vals);
        const rawMin = Math.min(...vals);
        const span   = rawMax - rawMin || Math.abs(rawMax) || 1;
        const yMax   = rawMax + span * 0.1;
        const yMin   = Math.max(0, rawMin - span * 0.15);

        const xFor = (i) =>
            points.length === 1
                ? PAD.left + innerW / 2
                : PAD.left + (innerW * i) / (points.length - 1);

        const yFor = (v) =>
            PAD.top + innerH * (1 - (v - yMin) / (yMax - yMin || 1));

        const linePath = smoothPath(points, xFor, yFor);
        const areaPath =
            `${linePath}` +
            ` L ${xFor(points.length - 1).toFixed(1)} ${bottomY}` +
            ` L ${xFor(0).toFixed(1)} ${bottomY} Z`;

        const yTicks = Array.from(
            { length: Y_TICKS + 1 },
            (_, i) => yMin + ((yMax - yMin) * i) / Y_TICKS
        );

        const xStep = Math.max(1, Math.ceil(points.length / 8));

        function handleMouseMove(e) {
            if (!width) return;
            const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
            let best = Infinity, nearest = 0;
            for (let i = 0; i < points.length; i++) {
                const d = Math.abs(xFor(i) - x);
                if (d < best) { best = d; nearest = i; }
            }
            setHoverIdx(nearest);
        }

        const hovered = hoverIdx != null ? points[hoverIdx] : null;
        const hovX    = hoverIdx != null ? xFor(hoverIdx) : 0;
        const hovY    = hovered ? yFor(hovered.value) : 0;

        const TIP_W = 152;
        let tipLeft = hovX - TIP_W / 2;
        if (tipLeft + TIP_W > width - PAD.right) tipLeft = width - PAD.right - TIP_W;
        if (tipLeft < PAD.left) tipLeft = PAD.left;
        const tipTop = Math.max(PAD.top, hovY - 68);

        chartBody = (
            <div ref={containerRef} className="w-full relative select-none" dir="ltr">
                {width > 0 && (
                    <svg
                        width={width}
                        height={height}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={() => setHoverIdx(null)}
                        style={{ display: "block", touchAction: "none" }}
                    >
                        <defs>
                            <linearGradient
                                id={uid}
                                x1="0" y1={PAD.top}
                                x2="0" y2={bottomY}
                                gradientUnits="userSpaceOnUse"
                            >
                                <stop offset="0%"   stopColor="var(--color-primary)" stopOpacity="0.28" />
                                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0.02" />
                            </linearGradient>
                        </defs>

                        {/* Horizontal grid lines + Y labels */}
                        {yTicks.map((v, i) => {
                            const y = yFor(v);
                            return (
                                <g key={i}>
                                    <line
                                        x1={PAD.left} y1={y}
                                        x2={width - PAD.right} y2={y}
                                        stroke="var(--color-border)" strokeWidth="1"
                                    />
                                    <text
                                        x={PAD.left - 8} y={y + 4}
                                        textAnchor="end" fontSize="11"
                                        fill="var(--color-muted-foreground)"
                                    >
                                        {formatValue(Math.round(v * 10) / 10)}
                                    </text>
                                </g>
                            );
                        })}

                        {/* Gradient area fill */}
                        <path d={areaPath} fill={`url(#${uid})`} />

                        {/* Smooth line */}
                        <path
                            d={linePath}
                            fill="none"
                            stroke="var(--color-primary)"
                            strokeWidth="2.5"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                        />

                        {/* X-axis labels */}
                        {points.map((p, i) =>
                            i % xStep === 0 || i === points.length - 1 ? (
                                <text
                                    key={i}
                                    x={xFor(i)} y={height - 8}
                                    textAnchor="middle" fontSize="11"
                                    fill="var(--color-muted-foreground)"
                                >
                                    {p.label}
                                </text>
                            ) : null
                        )}

                        {/* Hover: dashed vertical guide + dot */}
                        {hovered && (
                            <g>
                                <line
                                    x1={hovX} y1={PAD.top}
                                    x2={hovX} y2={bottomY}
                                    stroke="var(--color-muted-foreground)"
                                    strokeWidth="1"
                                    strokeDasharray="4 3"
                                    opacity="0.5"
                                />
                                <circle
                                    cx={hovX} cy={hovY} r={5}
                                    fill="var(--color-primary)"
                                    stroke="var(--color-background)"
                                    strokeWidth="2.5"
                                />
                            </g>
                        )}
                    </svg>
                )}

                {/* Tooltip */}
                {hovered && (
                    <div
                        className="pointer-events-none absolute rounded-xl px-3 py-2.5 shadow-lg"
                        style={{
                            left: tipLeft,
                            top: tipTop,
                            width: TIP_W,
                            background: "var(--color-surface-secondary, var(--color-card))",
                            border: "1px solid var(--color-border)",
                        }}
                    >
                        <p className="text-xs font-semibold text-foreground mb-1.5 truncate">
                            {hovered.label}
                        </p>
                        <div className="flex items-center gap-1.5">
                            <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: "var(--color-primary)" }}
                            />
                            <span className="text-xs text-muted-foreground flex-1 truncate">{label}</span>
                            <span className="text-xs font-bold text-foreground">
                                {formatValue(hovered.value)}
                            </span>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ── Card mode: rendered when header props are provided ─────────────────────
    if (title != null) {
        const metaParts = [];
        if (startValue != null) {
            metaParts.push(`Started at ${formatValue(startValue)}${unit ? ` ${unit}` : ""}`);
        }
        if (readingsCount != null && readingsCount > 0) {
            metaParts.push(`${readingsCount} reading${readingsCount !== 1 ? "s" : ""}`);
        }

        return (
            <Card>
                <Card.Header>
                    <div className="flex items-start justify-between gap-3 w-full">
                        <div className="flex-1 min-w-0">
                            {/* Row 1: metric name */}
                            <p className="text-sm font-medium text-muted-foreground truncate mb-2">{title}</p>
                            {/* Row 2: current value (primary emphasis) */}
                            <p className="text-2xl font-bold text-foreground leading-none tracking-tight">
                                {currentValue != null
                                    ? `${formatValue(currentValue)}${unit ? ` ${unit}` : ""}`
                                    : "—"}
                            </p>
                            {/* Row 3: supporting metadata */}
                            {metaParts.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1.5">
                                    {metaParts.join(" • ")}
                                </p>
                            )}
                        </div>
                        {/* Top-right: trend chip */}
                        {delta != null && (
                            <DeltaChip delta={delta} unit={unit} formatFn={formatValue} />
                        )}
                    </div>
                </Card.Header>
                <Card.Content className="pt-0">
                    {chartBody}
                </Card.Content>
            </Card>
        );
    }

    // ── Plain mode: original behaviour, no Card wrapper ───────────────────────
    return chartBody;
}
