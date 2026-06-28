"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useLocale } from "next-intl";
import { TrendingUp, TrendingDown, Minus, ChevronDown, ChevronUp, Calendar } from "lucide-react";
import api from "@/lib/axios";
import LineChart from "@/app/components/charts/LineChart";
import { DateRangePicker } from "@heroui/react/date-range-picker";
import { RangeCalendar } from "@heroui/react/range-calendar";
import { DateInputGroup } from "@heroui/react/date-input-group";
import { today, getLocalTimeZone } from "@internationalized/date";

const tz = getLocalTimeZone();

function toStartOfDay(calDate) {
    return calDate.toDate(tz);
}

function toEndOfDay(calDate) {
    const d = calDate.toDate(tz);
    d.setHours(23, 59, 59, 999);
    return d;
}

function filterByRange(history, startDate, endDate) {
    return history.filter(h => {
        const t = new Date(h.date).getTime();
        if (startDate && t < startDate.getTime()) return false;
        if (endDate && t > endDate.getTime()) return false;
        return true;
    });
}

function rangeForDays(days) {
    const end = today(tz);
    return { start: end.subtract({ days }), end };
}

const PRESETS = [
    { label: "30d", days: 30 },
    { label: "90d", days: 90 },
    { label: "6m",  days: 180 },
    { label: "All", days: null },
];

function formatValue(v, unit) {
    const n = parseFloat(v);
    if (isNaN(n)) return v;
    return unit ? `${n} ${unit}` : String(n);
}

function deltaInfo(history) {
    const nums = history.map(h => parseFloat(h.value)).filter(v => !isNaN(v));
    if (nums.length < 2) return null;
    return { first: nums[0], last: nums[nums.length - 1], delta: nums[nums.length - 1] - nums[0] };
}

function DeltaBadge({ delta, unit }) {
    if (delta === null || delta === undefined) return null;
    const abs  = Math.abs(delta);
    const sign = delta > 0 ? "+" : delta < 0 ? "−" : "";
    const cls  = delta > 0
        ? "text-emerald-600 bg-emerald-500/10"
        : delta < 0 ? "text-red-500 bg-red-500/10"
        : "text-muted-foreground bg-secondary";
    const Icon = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus;
    return (
        <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cls}`}>
            <Icon size={11} />
            {sign}{abs.toFixed(1)}{unit ? ` ${unit}` : ""}
        </span>
    );
}

function MetricChart({ metric, locale, startDate, endDate }) {
    const filtered  = useMemo(() => filterByRange(metric.history, startDate, endDate), [metric.history, startDate, endDate]);
    const chartData = useMemo(() => filtered.map(h => ({
        label: new Date(h.date).toLocaleDateString(locale, { day: "numeric", month: "short" }),
        value: parseFloat(h.value) || 0,
    })), [filtered, locale]);
    const info = deltaInfo(filtered);

    return (
        <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{metric.icon || "📊"}</span>
                <div>
                    <p className="text-sm font-semibold text-foreground">{metric.name}</p>
                    {metric.unit && <p className="text-xs text-muted-foreground">{metric.unit}</p>}
                </div>
                {info && <DeltaBadge delta={info.delta} unit={metric.unit} />}
            </div>

            {info && (
                <div className="flex gap-4 mb-3 text-xs text-muted-foreground">
                    <span>Start: <strong className="text-foreground">{formatValue(String(info.first), metric.unit)}</strong></span>
                    <span>Now: <strong className="text-foreground">{formatValue(String(info.last), metric.unit)}</strong></span>
                    <span className="text-muted-foreground/50">{filtered.length} readings</span>
                </div>
            )}

            {chartData.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">No data in this range</p>
            ) : (
                <LineChart
                    data={chartData}
                    height={180}
                    formatValue={v => v.toFixed(1)}
                    valueLabel={metric.unit ?? ""}
                />
            )}
        </div>
    );
}

function ComparisonSlider({ before, after, locale }) {
    const [position, setPosition] = useState(50);
    const containerRef = useRef(null);
    const dragging = useRef(false);

    const updatePosition = useCallback((clientX) => {
        const rect = containerRef.current?.getBoundingClientRect();
        if (!rect) return;
        const pct = Math.max(2, Math.min(98, ((clientX - rect.left) / rect.width) * 100));
        setPosition(pct);
    }, []);

    const onMouseMove  = useCallback((e) => { if (dragging.current) updatePosition(e.clientX); }, [updatePosition]);
    const onMouseUp    = useCallback(() => { dragging.current = false; }, []);
    const onTouchMove  = useCallback((e) => { e.preventDefault(); updatePosition(e.touches[0].clientX); }, [updatePosition]);

    useEffect(() => {
        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup',   onMouseUp);
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup',   onMouseUp);
        };
    }, [onMouseMove, onMouseUp]);

    const fmtDate = (d) => new Date(d).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });

    return (
        <div
            ref={containerRef}
            className="relative overflow-hidden rounded-lg select-none"
            style={{ cursor: 'col-resize' }}
            onTouchMove={onTouchMove}
            onTouchStart={(e) => updatePosition(e.touches[0].clientX)}
        >
            <img src={after.value} alt="after" className="w-full block max-h-[480px] object-cover" draggable={false} />

            <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
                <img src={before.value} alt="before" className="w-full h-full object-cover absolute inset-0" draggable={false} />
            </div>

            <div
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_6px_rgba(0,0,0,0.6)] z-10"
                style={{ left: `${position}%` }}
                onMouseDown={(e) => { e.preventDefault(); dragging.current = true; }}
                onTouchStart={(e) => { updatePosition(e.touches[0].clientX); }}
            >
                <div
                    className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white shadow-lg flex items-center justify-center gap-0.5 z-20"
                    onMouseDown={(e) => { e.preventDefault(); dragging.current = true; }}
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
                        <polyline points="15 18 9 12 15 6"/><polyline points="9 18 3 12 9 6"/>
                    </svg>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground -ml-1">
                        <polyline points="9 18 15 12 9 6"/><polyline points="15 18 21 12 15 6"/>
                    </svg>
                </div>
            </div>

            <div className="absolute bottom-2 left-2 bg-black/60 text-white text-[10px] font-medium px-2 py-1 rounded-md pointer-events-none z-10">{fmtDate(before.date)}</div>
            <div className="absolute bottom-2 right-2 bg-black/60 text-white text-[10px] font-medium px-2 py-1 rounded-md pointer-events-none z-10">{fmtDate(after.date)}</div>
            <div className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded pointer-events-none z-10">Before</div>
            <div className="absolute top-2 right-2 bg-primary/80 text-white text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded pointer-events-none z-10">After</div>
        </div>
    );
}

function PhotoGallery({ metric, locale, startDate, endDate }) {
    const [lightbox, setLightbox] = useState(null);
    const [compareMode, setCompareMode] = useState(false);
    const [selected, setSelected] = useState([]);

    const photos = useMemo(
        () => filterByRange([...metric.history].reverse(), startDate, endDate),
        [metric.history, startDate, endDate]
    );

    // When dateRange changes, reset compare state
    useEffect(() => {
        setCompareMode(false);
        setSelected([]);
        setLightbox(null);
    }, [startDate, endDate]);

    function toggleSelect(photo) {
        setSelected(prev => {
            const already = prev.findIndex(p => p === photo);
            if (already !== -1) return prev.filter((_, i) => i !== already);
            if (prev.length >= 2) return [prev[1], photo];
            return [...prev, photo];
        });
    }

    function enterCompare() {
        // Auto-select: oldest photo as "before", newest as "after"
        if (photos.length >= 2) {
            setSelected([photos[photos.length - 1], photos[0]]);
        } else {
            setSelected([]);
        }
        setCompareMode(true);
    }

    function exitCompare() {
        setCompareMode(false);
        setSelected([]);
    }

    const canCompare = photos.length >= 2;

    return (
        <div className="rounded-lg border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
                <span className="text-lg">{metric.icon || "📷"}</span>
                <p className="text-sm font-semibold text-foreground">{metric.name}</p>
                <span className="text-xs text-muted-foreground">{photos.length} photo{photos.length !== 1 ? "s" : ""}</span>
                <div className="ml-auto flex items-center gap-2">
                    {compareMode ? (
                        <>
                            <span className="text-xs text-muted-foreground">{selected.length}/2 selected</span>
                            <button onClick={exitCompare} className="cursor-pointer text-xs px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:bg-default transition-colors">Exit</button>
                        </>
                    ) : (
                        canCompare && (
                            <button onClick={enterCompare} className="cursor-pointer text-xs px-2.5 py-1 rounded-lg border border-border text-muted-foreground hover:bg-default transition-colors">Compare</button>
                        )
                    )}
                </div>
            </div>

            {compareMode && selected.length === 2 && (
                <div className="mb-3">
                    <ComparisonSlider before={selected[0]} after={selected[1]} locale={locale} />
                    <p className="text-[10px] text-muted-foreground text-center mt-1.5">Drag the handle to compare</p>
                </div>
            )}

            {compareMode && selected.length < 2 && (
                <div className="mb-3 py-3 rounded-lg bg-primary/5 border border-primary/20 text-center">
                    <p className="text-xs text-primary">
                        {selected.length === 0 ? "Select a before photo" : "Now select an after photo"}
                    </p>
                </div>
            )}

            {photos.length === 0 ? (
                <p className="py-8 text-center text-sm text-muted-foreground">No photos in this range</p>
            ) : (
                <div className="flex gap-2 overflow-x-auto pb-1">
                    {photos.map((h, i) => {
                        const selIdx = selected.indexOf(h);
                        const isSelected = selIdx !== -1;
                        return (
                            <button
                                key={i}
                                onClick={() => compareMode ? toggleSelect(h) : setLightbox(h)}
                                className="cursor-pointer shrink-0 flex flex-col gap-1 relative"
                            >
                                <img
                                    src={h.value}
                                    alt={metric.name}
                                    className={`w-28 h-36 object-cover rounded-lg border-2 transition-colors ${
                                        isSelected
                                            ? "border-primary shadow-[0_0_0_2px_var(--primary)]"
                                            : "border-border hover:border-primary/50"
                                    }`}
                                    draggable={false}
                                />
                                {isSelected && (
                                    <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-primary text-white text-[10px] font-bold flex items-center justify-center shadow">
                                        {selIdx + 1}
                                    </span>
                                )}
                                <span className="text-[10px] text-muted-foreground text-center">
                                    {new Date(h.date).toLocaleDateString(locale, { day: "numeric", month: "short" })}
                                </span>
                            </button>
                        );
                    })}
                </div>
            )}

            {lightbox && !compareMode && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
                    <img src={lightbox.value} alt={metric.name} className="max-w-full max-h-full rounded-xl object-contain" />
                    <span className="absolute top-4 right-4 text-white text-xs bg-black/50 px-2 py-1 rounded-lg">
                        {new Date(lightbox.date).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                </div>
            )}
        </div>
    );
}

function TimelineEntry({ entry, locale }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
            <button
                className="cursor-pointer w-full flex items-center justify-between gap-4 px-4 py-3 hover:bg-default transition-colors"
                onClick={() => setOpen(v => !v)}
            >
                <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-foreground truncate">{entry.formTitle}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(entry.submittedAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-muted-foreground">{entry.answers.length} metric{entry.answers.length !== 1 ? "s" : ""}</span>
                    {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                </div>
            </button>
            {open && (
                <div className="border-t border-border px-4 py-3 flex flex-col gap-2">
                    {entry.answers.map((a, i) => (
                        <div key={i} className="flex items-center justify-between gap-3">
                            <span className="text-xs text-muted-foreground truncate">{a.label || a.metricName || "—"}</span>
                            {a.metricType === "image" ? (
                                <a href={a.answer} target="_blank" rel="noopener noreferrer">
                                    <img src={a.answer} alt={a.metricName || "photo"} className="w-14 object-cover rounded border border-border hover:border-primary/60 transition-colors" style={{ height: "4.5rem" }} />
                                </a>
                            ) : (
                                <span className="text-xs font-medium text-foreground shrink-0">{a.answer}</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function ClientTransformationPage() {
    const { id } = useParams();
    const locale  = useLocale();
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(null);
    const [dateRange, setDateRange] = useState(rangeForDays(90));
    const [activePreset, setActivePreset] = useState("90d");

    useEffect(() => {
        api.get(`/api/clients/${id}/transformation`)
            .then(res => setData(res.data))
            .catch(() => setError("Failed to load transformation data."))
            .finally(() => setLoading(false));
    }, [id]);

    const startDate = useMemo(() => dateRange ? toStartOfDay(dateRange.start) : null, [dateRange]);
    const endDate   = useMemo(() => dateRange ? toEndOfDay(dateRange.end) : null, [dateRange]);

    function applyPreset(preset) {
        setActivePreset(preset.label);
        setDateRange(preset.days === null ? null : rangeForDays(preset.days));
    }

    function handlePickerChange(range) {
        setDateRange(range);
        setActivePreset(null);
    }

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-sm text-destructive">{error}</p>
            </div>
        );
    }

    const numericMetrics = (data?.metrics ?? []).filter(m => m.type === "number");
    const imageMetrics   = (data?.metrics ?? []).filter(m => m.type === "image");
    const allTimeline    = data?.timeline ?? [];

    const timeline = allTimeline.filter(entry => {
        const t = new Date(entry.submittedAt).getTime();
        if (startDate && t < startDate.getTime()) return false;
        if (endDate && t > endDate.getTime()) return false;
        return true;
    });

    if (numericMetrics.length === 0 && imageMetrics.length === 0 && allTimeline.length === 0) {
        return (
            <div className="h-full flex flex-col items-center justify-center gap-3 text-center py-16">
                <TrendingUp size={40} className="text-muted-foreground/30" />
                <p className="text-sm font-medium text-muted-foreground">No transformation data yet</p>
                <p className="text-xs text-muted-foreground/70">
                    Data appears here once the client submits a form with tracked metric questions.
                </p>
            </div>
        );
    }

    return (
        <div className="h-full overflow-y-auto">
            <div className="flex flex-col gap-5 pb-6">

                {/* Timeframe bar */}
                <div className="flex flex-wrap items-center gap-3 pt-1">
                    {/* Preset chips */}
                    <div className="flex gap-1">
                        {PRESETS.map(p => (
                            <button
                                key={p.label}
                                onClick={() => applyPreset(p)}
                                className={`cursor-pointer px-2.5 py-1 text-xs rounded-lg border transition-colors ${
                                    activePreset === p.label
                                        ? "bg-primary text-primary-foreground border-primary"
                                        : "border-border text-muted-foreground hover:bg-default"
                                }`}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {/* Date range picker */}
                    <DateRangePicker value={dateRange} onChange={handlePickerChange}>
                        <DateRangePicker.Trigger className="cursor-pointer">
                            <DateRangePicker.TriggerIndicator>
                                <Calendar size={14} className="text-muted-foreground" />
                            </DateRangePicker.TriggerIndicator>
                            <DateInputGroup slot="start">
                                <DateInputGroup.Input>
                                    <DateInputGroup.Segment segment="month" />
                                    <DateInputGroup.Segment segment="literal" />
                                    <DateInputGroup.Segment segment="day" />
                                    <DateInputGroup.Segment segment="literal" />
                                    <DateInputGroup.Segment segment="year" />
                                </DateInputGroup.Input>
                            </DateInputGroup>
                            <DateRangePicker.RangeSeparator>–</DateRangePicker.RangeSeparator>
                            <DateInputGroup slot="end">
                                <DateInputGroup.Input>
                                    <DateInputGroup.Segment segment="month" />
                                    <DateInputGroup.Segment segment="literal" />
                                    <DateInputGroup.Segment segment="day" />
                                    <DateInputGroup.Segment segment="literal" />
                                    <DateInputGroup.Segment segment="year" />
                                </DateInputGroup.Input>
                            </DateInputGroup>
                        </DateRangePicker.Trigger>
                        <DateRangePicker.Popover>
                            <RangeCalendar>
                                <RangeCalendar.Header>
                                    <RangeCalendar.NavButton slot="previous" />
                                    <RangeCalendar.Heading />
                                    <RangeCalendar.NavButton slot="next" />
                                </RangeCalendar.Header>
                                <RangeCalendar.Grid>
                                    <RangeCalendar.GridHeader>
                                        {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
                                    </RangeCalendar.GridHeader>
                                    <RangeCalendar.GridBody>
                                        {(date) => (
                                            <RangeCalendar.Cell date={date}>
                                                <RangeCalendar.CellIndicator />
                                            </RangeCalendar.Cell>
                                        )}
                                    </RangeCalendar.GridBody>
                                </RangeCalendar.Grid>
                            </RangeCalendar>
                        </DateRangePicker.Popover>
                    </DateRangePicker>
                </div>

                {/* Numeric Metric Charts */}
                {numericMetrics.length > 0 && (
                    <section>
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Measurements</h2>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                            {numericMetrics.map(m => (
                                <MetricChart key={m.id} metric={m} locale={locale} startDate={startDate} endDate={endDate} />
                            ))}
                        </div>
                    </section>
                )}

                {/* Photo Metric Galleries */}
                {imageMetrics.length > 0 && (
                    <section>
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Progress Photos</h2>
                        <div className="flex flex-col gap-4">
                            {imageMetrics.map(m => (
                                <PhotoGallery key={m.id} metric={m} locale={locale} startDate={startDate} endDate={endDate} />
                            ))}
                        </div>
                    </section>
                )}

                {/* Submission Timeline */}
                {timeline.length > 0 && (
                    <section>
                        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">Submission History</h2>
                        <div className="flex flex-col gap-2">
                            {timeline.map(entry => (
                                <TimelineEntry key={entry.submissionId} entry={entry} locale={locale} />
                            ))}
                        </div>
                    </section>
                )}

                {numericMetrics.length > 0 && timeline.length === 0 && imageMetrics.every(m => filterByRange([...m.history].reverse(), startDate, endDate).length === 0) && (
                    <p className="text-center text-sm text-muted-foreground py-4">No submissions in this timeframe</p>
                )}

            </div>
        </div>
    );
}
