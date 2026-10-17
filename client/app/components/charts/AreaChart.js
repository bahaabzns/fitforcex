"use client";

import { useEffect, useId, useRef, useState } from "react";
import { ChevronUp, ChevronDown, Minus } from "lucide-react";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Switch } from "@heroui/react/switch";
import NumberWithUnit from "@/app/components/NumberWithUnit";
import { useLocale } from "next-intl";

const PAD = { top: 20, right: 16, bottom: 32, left: 48 };
const Y_TICKS = 4;

// Catmull-Rom → cubic-bezier smooth path for a series of (x, y) coordinates.
export function smoothPath(pts, xFor, yFor) {
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
    // Optional dashed horizontal line, e.g. an average: { value: number, label: string }.
    referenceLine = null,
    // Optional second series drawn as a smooth line with its own area fill, one value per entry of
    // `data` (same order): { values: number[], label: string, color?: string }. It shares the Y scale.
    overlay       = null,
    // Extra figures shown beside the main value in the card header: [{ label, value }].
    headerStats   = [],
    // Colour of the main series (line, fill, hover dot); any CSS colour.
    color         = "var(--color-primary)",
}) {
    const containerRef = useRef(null);
    const [width, setWidth] = useState(0);
    const [hoverIdx, setHoverIdx] = useState(null);
    // The plot itself stays left-to-right (time runs one way); only the tooltip text follows the language.
    const tooltipDir = useLocale() === "ar" ? "rtl" : "ltr";
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

        const overlayValues = overlay && overlay.values.length === points.length ? overlay.values : null;
        const vals   = overlayValues ? [...points.map(p => p.value), ...overlayValues] : points.map(p => p.value);
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

        // Same smoothing and area treatment as the main series, in the overlay's own colour.
        const overlayColor = overlay?.color ?? "var(--color-accent)";
        const overlayLine = overlayValues ? smoothPath(overlayValues.map(v => ({ value: v })), xFor, yFor) : null;
        const overlayArea = overlayLine
            ? `${overlayLine} L ${xFor(points.length - 1).toFixed(1)} ${bottomY} L ${xFor(0).toFixed(1)} ${bottomY} Z`
            : null;

        const yTicks = Array.from(
            { length: Y_TICKS + 1 },
            (_, i) => yMin + ((yMax - yMin) * i) / Y_TICKS
        );

        const xStep = Math.max(1, Math.ceil(points.length / 8));
        // Regular ticks, plus always the last point; a regular tick too close to the last one is dropped so
        // the two labels never overlap.
        const showXLabel = (i) => i === points.length - 1 || (i % xStep === 0 && points.length - 1 - i > xStep / 2);

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
        const tipTop = Math.max(PAD.top, hovY - (overlayValues ? 90 : 68));

        chartBody = (
            <div ref={containerRef} className="w-full relative select-none" dir="ltr">
                {width > 0 && (
                    <svg
                        width={width}
                        height={height}
                        // Pointer events cover mouse and touch; pan-y keeps vertical page scrolling working on a phone
                        // while a sideways drag moves the marker.
                        onPointerMove={handleMouseMove}
                        onPointerDown={handleMouseMove}
                        onPointerLeave={() => setHoverIdx(null)}
                        style={{ display: "block", touchAction: "pan-y" }}
                    >
                        <defs>
                            <linearGradient
                                id={uid}
                                x1="0" y1={PAD.top}
                                x2="0" y2={bottomY}
                                gradientUnits="userSpaceOnUse"
                            >
                                <stop offset="0%"   stopColor={color} stopOpacity="0.28" />
                                <stop offset="100%" stopColor={color} stopOpacity="0.02" />
                            </linearGradient>
                            {overlayArea && (
                                <linearGradient
                                    id={`${uid}-overlay`}
                                    x1="0" y1={PAD.top}
                                    x2="0" y2={bottomY}
                                    gradientUnits="userSpaceOnUse"
                                >
                                    <stop offset="0%"   stopColor={overlayColor} stopOpacity="0.28" />
                                    <stop offset="100%" stopColor={overlayColor} stopOpacity="0.02" />
                                </linearGradient>
                            )}
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

                        {/* Overlay area fill (drawn first so the main series stays on top) */}
                        {overlayArea && <path d={overlayArea} fill={`url(#${uid}-overlay)`} />}

                        {/* Gradient area fill */}
                        <path d={areaPath} fill={`url(#${uid})`} />

                        {/* Reference line (e.g. daily average) */}
                        {referenceLine && Number.isFinite(referenceLine.value) && (() => {
                            const y = Math.min(bottomY, Math.max(PAD.top, yFor(referenceLine.value)));
                            return (
                                <g>
                                    <line
                                        x1={PAD.left} y1={y} x2={width - PAD.right} y2={y}
                                        stroke="var(--color-foreground)" strokeOpacity="0.55"
                                        strokeWidth="1.5" strokeDasharray="5 4"
                                    />
                                    <text
                                        x={width - PAD.right} y={y - 6}
                                        textAnchor="end" fontSize="11" fontWeight="600"
                                        fill="var(--color-foreground)" fillOpacity="0.75"
                                    >
                                        {referenceLine.label}
                                    </text>
                                </g>
                            );
                        })()}

                        {/* Overlay series line (e.g. team capacity) */}
                        {overlayLine && (
                            <path
                                d={overlayLine}
                                fill="none"
                                stroke={overlayColor}
                                strokeWidth="2.5"
                                strokeLinejoin="round"
                                strokeLinecap="round"
                            />
                        )}

                        {/* Smooth line */}
                        <path
                            d={linePath}
                            fill="none"
                            stroke={color}
                            strokeWidth="2.5"
                            strokeLinejoin="round"
                            strokeLinecap="round"
                        />

                        {/* X-axis labels */}
                        {points.map((p, i) =>
                            showXLabel(i) ? (
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
                                    fill={color}
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
                        dir={tooltipDir}
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
                                style={{ backgroundColor: color }}
                            />
                            <span className="text-xs text-muted-foreground flex-1 truncate">{label}</span>
                            <span className="text-xs font-bold text-foreground">
                                {formatValue(hovered.value)}
                            </span>
                        </div>
                        {overlayValues && (
                            <div className="flex items-center gap-1.5 mt-1">
                                <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: overlay.color ?? "var(--color-accent)" }}
                                />
                                <span className="text-xs text-muted-foreground flex-1 truncate">{overlay.label}</span>
                                <span className="text-xs font-bold text-foreground">
                                    {formatValue(overlayValues[hoverIdx])}
                                </span>
                            </div>
                        )}
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
                        <div className="flex flex-wrap items-stretch gap-2 sm:gap-3 flex-1 min-w-0">
                        <div className={`min-w-0 ${headerStats.length > 0 ? "flex-1 basis-36 rounded-xl bg-default/40 px-3 py-2.5 sm:px-4 sm:py-3" : ""}`}>
                            {/* Row 1: metric name, with a swatch matching its line on the chart */}
                            <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                                {headerStats.length > 0 && <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />}
                                <span className="leading-tight">{title}</span>
                            </p>
                            {/* Row 2: current value (primary emphasis) */}
                            <p className="text-xl sm:text-2xl font-bold text-foreground leading-none tracking-tight">
                                {currentValue != null
                                    ? <NumberWithUnit value={`${formatValue(currentValue)}${unit ? ` ${unit}` : ""}`} />
                                    : "—"}
                            </p>
                            {/* Row 3: supporting metadata */}
                            {metaParts.length > 0 && (
                                <p className="text-xs text-muted-foreground mt-1.5">
                                    {metaParts.join(" • ")}
                                </p>
                            )}
                        </div>
                        {headerStats.map((stat) => (
                            <div key={stat.label} className="min-w-0 flex-1 basis-36 rounded-xl bg-default/40 px-3 py-2.5 sm:px-4 sm:py-3">
                                <p className="flex items-center gap-2 text-sm font-medium text-muted-foreground mb-2">
                                    {/* Swatch matches the line this number is drawn as: solid colour, or dashed grey for the average */}
                                    <span
                                        className="h-0 w-3.5 shrink-0 border-t-2"
                                        style={{ borderColor: stat.color ?? "currentColor", borderStyle: stat.dashed ? "dashed" : "solid" }}
                                        aria-hidden="true"
                                    />
                                    <span className="flex-1 leading-tight">{stat.label}</span>
                                    {/* Optional switch: shows or hides this number's line on the chart */}
                                    {stat.toggle && (
                                        <Switch size="sm" isSelected={stat.toggle.isSelected} onChange={stat.toggle.onChange} aria-label={stat.toggle.ariaLabel}>
                                            <Switch.Control><Switch.Thumb /></Switch.Control>
                                        </Switch>
                                    )}
                                </p>
                                <p className="text-xl sm:text-2xl font-bold text-foreground leading-none tracking-tight"><NumberWithUnit value={stat.value} /></p>
                            </div>
                        ))}
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
