"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useLocale } from "next-intl";
import { smoothPath } from "@/app/components/charts/AreaChart";

const PAD = { top: 6, right: 4, bottom: 4, left: 4 };

// A compact, axis-less area chart for stat cards: smooth line, gradient fill, and a hover tooltip
// showing the day and its value. `color` is any CSS colour. data: [{ label, value }].
export default function MiniAreaChart({ data, color = "var(--color-primary)", height = 64, formatValue = (v) => String(v), ariaLabel }) {
    const containerRef = useRef(null);
    const [width, setWidth] = useState(0);
    const [hoverIdx, setHoverIdx] = useState(null);
    const tooltipDir = useLocale() === "ar" ? "rtl" : "ltr";
    const gradientId = `mini-${useId().replace(/:/g, "")}`;

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return undefined;
        const sync = () => setWidth(el.clientWidth);
        sync();
        const observer = new ResizeObserver(sync);
        observer.observe(el);
        return () => observer.disconnect();
    }, []);

    const points = (data ?? []).filter((p) => p?.value != null);
    const innerW = Math.max(0, width - PAD.left - PAD.right);
    const innerH = height - PAD.top - PAD.bottom;
    const values = points.map((p) => p.value);
    const rawMin = Math.min(...values);
    const rawMax = Math.max(...values);
    const span = rawMax - rawMin || Math.abs(rawMax) || 1;
    // A little headroom so the line never touches the card edge.
    const yMin = rawMin - span * 0.15;
    const yMax = rawMax + span * 0.15;

    const xFor = (i) => (points.length === 1 ? PAD.left + innerW / 2 : PAD.left + (innerW * i) / (points.length - 1));
    const yFor = (v) => PAD.top + innerH * (1 - (v - yMin) / (yMax - yMin || 1));

    const hasChart = width > 0 && points.length > 1;
    const linePath = hasChart ? smoothPath(points, xFor, yFor) : "";
    const bottomY = PAD.top + innerH;
    const areaPath = hasChart ? `${linePath} L ${xFor(points.length - 1).toFixed(1)} ${bottomY} L ${xFor(0).toFixed(1)} ${bottomY} Z` : "";

    function handleMove(e) {
        const x = e.clientX - e.currentTarget.getBoundingClientRect().left;
        let best = Infinity;
        let nearest = 0;
        for (let i = 0; i < points.length; i++) {
            const distance = Math.abs(xFor(i) - x);
            if (distance < best) { best = distance; nearest = i; }
        }
        setHoverIdx(nearest);
    }

    const hovered = hoverIdx !== null ? points[hoverIdx] : null;
    const TIP_W = 112;
    const tipLeft = hovered ? Math.min(Math.max(xFor(hoverIdx) - TIP_W / 2, 0), Math.max(0, width - TIP_W)) : 0;

    return (
        <div ref={containerRef} className="relative w-full select-none" style={{ height }} dir="ltr">
            {hasChart && (
                <svg
                    width={width} height={height}
                    role="img" aria-label={ariaLabel}
                    onPointerMove={handleMove} onPointerDown={handleMove} onPointerLeave={() => setHoverIdx(null)}
                    style={{ display: "block", touchAction: "pan-y" }}
                >
                    <defs>
                        <linearGradient id={gradientId} x1="0" y1={PAD.top} x2="0" y2={bottomY} gradientUnits="userSpaceOnUse">
                            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
                            <stop offset="100%" stopColor={color} stopOpacity="0" />
                        </linearGradient>
                    </defs>
                    <path d={areaPath} fill={`url(#${gradientId})`} />
                    <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
                    {hovered && (
                        <g>
                            <line x1={xFor(hoverIdx)} y1={PAD.top} x2={xFor(hoverIdx)} y2={bottomY} stroke="var(--color-muted-foreground)" strokeWidth="1" strokeDasharray="3 3" opacity="0.5" />
                            <circle cx={xFor(hoverIdx)} cy={yFor(hovered.value)} r={4} fill={color} stroke="var(--color-background)" strokeWidth="2" />
                        </g>
                    )}
                </svg>
            )}
            {hovered && (
                <div
                    className="pointer-events-none absolute z-10 rounded-lg px-2.5 py-1.5 shadow-lg text-xs"
                    dir={tooltipDir}
                    style={{
                        left: tipLeft, width: TIP_W, bottom: height + 4,
                        background: "var(--color-surface-secondary, var(--color-card))",
                        border: "1px solid var(--color-border)",
                    }}
                >
                    <p className="font-semibold text-foreground truncate">{hovered.label}</p>
                    <p className="text-muted-foreground">{formatValue(hovered.value)}</p>
                </div>
            )}
        </div>
    );
}
