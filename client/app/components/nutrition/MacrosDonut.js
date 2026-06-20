import { useState, useEffect } from "react";

// Donut nutrition-facts card styled after the HeroUI PieChart donut: a
// segmented ring with rounded caps and clean gaps between slices, a hover
// tooltip on each slice, and a grow-in animation. The calorie total sits in
// the ring center with a carb / fat / protein breakdown beside it. Shared by
// the client portal (cycle totals) and the coach nutrition builder (meal +
// cycle totals).
//
// `totals`  — { calories, carbs, protein, fats }
// `labels`  — { carbs, fat, protein, kcal } localized strings (the caller owns
//             i18n so the component stays namespace-agnostic).
// `goals`   — optional { calories, carbs, protein, fats } targets. Any field may
//             be null/0. When a target is present it is shown inline as
//             `current / target`, so the cycle card surfaces its goals in the
//             same card the meal uses. Omit `goals` for a plain current-only card.
export default function MacrosDonut({ totals, labels, goals }) {
    const [ringAnimated, setRingAnimated] = useState(false);
    const [hovered, setHovered] = useState(null);

    // Grow the ring in on mount; later totals changes animate via the
    // stroke-dasharray CSS transition below, so no reset is needed.
    useEffect(() => {
        const timer = setTimeout(() => setRingAnimated(true), 50);
        return () => clearTimeout(timer);
    }, []);

    const carbCal    = totals.carbs   * 4;
    const proteinCal = totals.protein * 4;
    const fatCal     = totals.fats    * 9;
    const macroCal   = carbCal + proteinCal + fatCal;
    const isEmpty    = macroCal === 0;

    const carbPct    = isEmpty ? 0 : Math.round((carbCal / macroCal) * 100);
    const fatPct     = isEmpty ? 0 : Math.round((fatCal  / macroCal) * 100);
    const proteinPct = isEmpty ? 0 : 100 - carbPct - fatPct;

    const macros = [
        { label: labels.carbs,   value: Math.round(totals.carbs),   pct: carbPct,    color: "var(--primary)", textColor: "text-primary",    target: goals?.carbs   },
        { label: labels.fat,     value: Math.round(totals.fats),    pct: fatPct,     color: "#f59e0b",        textColor: "text-amber-500",  target: goals?.fats    },
        { label: labels.protein, value: Math.round(totals.protein), pct: proteinPct, color: "#f97316",        textColor: "text-orange-500", target: goals?.protein },
    ];

    // Geometry — a large, thin, seamless ring: slices are full-length (no
    // padding) so their rounded caps overlap into a continuous ring with no
    // gaps, while still showing rounded ends at the slice boundaries.
    const cx = 40, cy = 40, r = 34, sw = 6;
    const circ = 2 * Math.PI * r;
    let accDeg = 0;
    const segments = macros.map((m) => {
        const rotation = -90 + accDeg;
        const len      = ringAnimated ? (m.pct / 100) * circ : 0;
        accDeg += (m.pct / 100) * 360;
        return { ...m, len, rotation };
    });

    return (
        <div className="flex items-center gap-4" dir="ltr">
            {/* Donut ring */}
            <div className="relative shrink-0 w-24 h-24">
                <svg viewBox="0 0 80 80" className="w-24 h-24 overflow-visible">
                    {/* Track */}
                    <circle cx={cx} cy={cy} r={r} fill="none" strokeWidth={sw} className="stroke-secondary" />
                    {segments.map((seg, i) => (
                        <circle
                            key={seg.label}
                            cx={cx} cy={cy} r={r}
                            fill="none"
                            stroke={seg.color}
                            strokeWidth={sw}
                            strokeLinecap="round"
                            strokeDasharray={`${seg.len} ${circ}`}
                            transform={`rotate(${seg.rotation} ${cx} ${cy})`}
                            onMouseEnter={() => setHovered(i)}
                            onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
                            className="cursor-default"
                            style={{
                                transition: `stroke-dasharray 0.6s ease ${i * 0.15}s, opacity 0.15s ease`,
                                opacity: hovered === null || hovered === i ? 1 : 0.3,
                            }}
                        />
                    ))}
                </svg>

                {/* Center content */}
                <div className="absolute inset-0 flex flex-col items-center justify-center leading-none pointer-events-none">
                    <span className="text-xl font-bold text-foreground">{Math.round(totals.calories)}</span>
                    <span className="text-[11px] font-medium text-muted-foreground">
                        {goals?.calories ? `/ ${Math.round(goals.calories)} ${labels.kcal}` : labels.kcal}
                    </span>
                </div>

                {/* Hover tooltip — mirrors the HeroUI PieChart slice tooltip */}
                {hovered !== null && (
                    <div className="absolute left-1/2 top-[64%] -translate-x-1/2 z-20 flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-border bg-card px-2 py-1 text-xs shadow-md pointer-events-none">
                        <span className="h-2 w-2 rounded-full" style={{ background: macros[hovered].color }} />
                        <span className="text-muted-foreground">{macros[hovered].label}</span>
                        <span className="font-semibold text-foreground">
                            {macros[hovered].value}{macros[hovered].target ? `/${Math.round(macros[hovered].target)}` : ""}g
                        </span>
                    </div>
                )}
            </div>

            {/* Macro columns */}
            <div className="flex flex-1 justify-around">
                {macros.map((m, i) => (
                    <div
                        key={m.label}
                        className="flex flex-col items-center gap-0.5 transition-opacity"
                        style={{ opacity: hovered === null || hovered === i ? 1 : 0.4 }}
                        onMouseEnter={() => setHovered(i)}
                        onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
                    >
                        <span className={`text-xs font-semibold ${m.textColor}`}>{m.pct}%</span>
                        <span className="text-base font-bold text-foreground">
                            {m.value}
                            {m.target
                                ? <span className="text-xs font-normal text-muted-foreground">/{Math.round(m.target)}g</span>
                                : <span className="text-xs font-normal text-muted-foreground">g</span>}
                        </span>
                        <span className="text-xs text-muted-foreground">{m.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
