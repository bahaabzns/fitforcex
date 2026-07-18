"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocale, useTranslations } from "next-intl";
import { TrendingUp, ChevronDown, ChevronUp, Camera } from "lucide-react";
import api from "@/lib/axios";
import AreaChart from "@/app/components/charts/AreaChart";
import { DateRangePicker } from "@heroui/react/date-range-picker";
import { RangeCalendar } from "@heroui/react/range-calendar";
import { DateField } from "@heroui/react/date-field";
import { Skeleton } from "@heroui/react/skeleton";
import { Tabs } from "@heroui/react";
import { toStartOfDay, toEndOfDay, filterByRange, rangeForDays, PRESETS, deltaInfo } from "@/utils/chartDateRange";
import { usePageTitle } from "@/hooks/usePageTitle";

function MetricChart({ metric, locale, startDate, endDate }) {
    const filtered  = useMemo(() => filterByRange(metric.history, startDate, endDate), [metric.history, startDate, endDate]);
    const chartData = useMemo(() => filtered.map(h => ({
        label: new Date(h.date).toLocaleDateString(locale, { day: "numeric", month: "short" }),
        value: parseFloat(h.value) || 0,
    })), [filtered, locale]);
    const info = deltaInfo(filtered);
    const nums = useMemo(() => filtered.map(h => parseFloat(h.value)).filter(v => !isNaN(v)), [filtered]);

    return (
        <AreaChart
            data={chartData}
            height={180}
            formatValue={v => v.toFixed(1)}
            label={metric.name}
            title={metric.name}
            currentValue={nums.length > 0 ? nums[nums.length - 1] : null}
            startValue={nums.length > 1 ? nums[0] : null}
            unit={metric.unit || null}
            readingsCount={filtered.length}
            delta={info?.delta ?? null}
        />
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

    const onMouseMove = useCallback((e) => { if (dragging.current) updatePosition(e.clientX); }, [updatePosition]);
    const onMouseUp   = useCallback(() => { dragging.current = false; }, []);
    const onTouchMove = useCallback((e) => { e.preventDefault(); updatePosition(e.touches[0].clientX); }, [updatePosition]);

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
            className="relative overflow-hidden rounded-xl select-none"
            style={{ cursor: 'col-resize' }}
            onTouchMove={onTouchMove}
            onTouchStart={(e) => updatePosition(e.touches[0].clientX)}
        >
            <img src={after.value} alt="after" className="w-full block max-h-[420px] object-cover" draggable={false} />

            <div className="absolute inset-0 overflow-hidden" style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}>
                <img src={before.value} alt="before" className="w-full h-full object-cover absolute inset-0" draggable={false} />
            </div>

            <div
                className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_6px_rgba(0,0,0,0.6)] z-10"
                style={{ left: `${position}%` }}
                onMouseDown={(e) => { e.preventDefault(); dragging.current = true; }}
                onTouchStart={(e) => updatePosition(e.touches[0].clientX)}
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
        <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
                <Camera size={18} className="shrink-0 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">{metric.name}</p>
                <span className="text-xs text-muted-foreground">{photos.length} photo{photos.length !== 1 ? "s" : ""}</span>
                <div className="ml-auto flex items-center gap-2">
                    {compareMode ? (
                        <>
                            <span className="text-xs text-muted-foreground">{selected.length}/2</span>
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
                <div className="mb-3 py-3 rounded-xl bg-primary/5 border border-primary/20 text-center">
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
                                    className={`w-24 h-32 object-cover rounded-lg border-2 transition-colors ${
                                        isSelected ? "border-primary" : "border-border"
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
                <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
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
        <div className="rounded-xl border border-border bg-card overflow-hidden">
            <button
                className="cursor-pointer w-full flex items-center justify-between gap-4 px-4 py-3"
                onClick={() => setOpen(v => !v)}
            >
                <div className="flex-1 min-w-0 text-left">
                    <p className="text-sm font-medium text-foreground truncate">{entry.formTitle}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(entry.submittedAt).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                </div>
                {open ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
            </button>
            {open && (
                <div className="border-t border-border px-4 py-3 flex flex-col gap-2.5">
                    {entry.answers.map((a, i) => (
                        <div key={i} className="flex items-start justify-between gap-3">
                            <span className="text-xs text-muted-foreground truncate pt-0.5">{a.label || a.metricName || "—"}</span>
                            {a.metricType === "image" ? (
                                <img src={a.answer} alt={a.metricName || "photo"} className="w-12 h-16 object-cover rounded-lg border border-border shrink-0" />
                            ) : (
                                <span className="text-sm font-semibold text-foreground shrink-0">{a.answer}</span>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function ProgressSection({ locale }) {
    const [data, setData]       = useState(null);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState(rangeForDays(90));
    const [activePreset, setActivePreset] = useState("90d");

    useEffect(() => {
        api.get("/api/client-portal/transformation")
            .then(res => setData(res.data))
            .catch(() => setData({ metrics: [], timeline: [] }))
            .finally(() => setLoading(false));
    }, []);

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
            <div className="flex flex-col gap-4">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
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
            <div className="rounded-xl border border-border bg-card flex flex-col items-center gap-3 text-center px-6 py-10">
                <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <TrendingUp size={24} className="text-primary" />
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed max-w-xs">
                    Your transformation data will appear here after you submit a check-in form with body measurements.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-5">
            {/* Timeframe bar — right-aligned so the presets stay anchored while the date pill grows/shrinks to the left */}
            <div className="flex flex-wrap items-center justify-end gap-2">
                {/* Date range picker */}
                <DateRangePicker value={dateRange} onChange={handlePickerChange}>
                    <DateField.Group>
                        <DateField.Input slot="start">
                            {(segment) => <DateField.Segment segment={segment} />}
                        </DateField.Input>
                        <DateRangePicker.RangeSeparator />
                        <DateField.Input slot="end">
                            {(segment) => <DateField.Segment segment={segment} />}
                        </DateField.Input>
                        <DateField.Suffix>
                            <DateRangePicker.Trigger>
                                <DateRangePicker.TriggerIndicator />
                            </DateRangePicker.Trigger>
                        </DateField.Suffix>
                    </DateField.Group>
                    <DateRangePicker.Popover>
                        <RangeCalendar aria-label="Date range">
                            <RangeCalendar.Header>
                                <RangeCalendar.YearPickerTrigger>
                                    <RangeCalendar.YearPickerTriggerHeading />
                                    <RangeCalendar.YearPickerTriggerIndicator />
                                </RangeCalendar.YearPickerTrigger>
                                <RangeCalendar.NavButton slot="previous" />
                                <RangeCalendar.NavButton slot="next" />
                            </RangeCalendar.Header>
                            <RangeCalendar.Grid>
                                <RangeCalendar.GridHeader>
                                    {(day) => <RangeCalendar.HeaderCell>{day}</RangeCalendar.HeaderCell>}
                                </RangeCalendar.GridHeader>
                                <RangeCalendar.GridBody>
                                    {(date) => <RangeCalendar.Cell date={date} />}
                                </RangeCalendar.GridBody>
                            </RangeCalendar.Grid>
                            <RangeCalendar.YearPickerGrid>
                                <RangeCalendar.YearPickerGridBody>
                                    {({ year }) => <RangeCalendar.YearPickerCell year={year} />}
                                </RangeCalendar.YearPickerGridBody>
                            </RangeCalendar.YearPickerGrid>
                        </RangeCalendar>
                    </DateRangePicker.Popover>
                </DateRangePicker>

                {/* Quick range presets */}
                <Tabs
                    selectedKey={activePreset}
                    onSelectionChange={(key) => applyPreset(PRESETS.find(p => p.label === key))}
                >
                    <Tabs.ListContainer>
                        <Tabs.List
                            aria-label="Timeframe"
                            className="w-fit *:h-6 *:w-fit *:px-3 *:text-sm *:font-normal *:data-[selected=true]:text-accent-foreground"
                        >
                            {PRESETS.map(p => (
                                <Tabs.Tab key={p.label} id={p.label}>
                                    {p.label}
                                    <Tabs.Indicator className="bg-accent" />
                                </Tabs.Tab>
                            ))}
                        </Tabs.List>
                    </Tabs.ListContainer>
                </Tabs>
            </div>

            {/* Numeric Metric Charts */}
            {numericMetrics.length > 0 && (
                <section className="flex flex-col gap-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Measurements</h3>
                    {numericMetrics.map(m => (
                        <MetricChart key={m.id} metric={m} locale={locale} startDate={startDate} endDate={endDate} />
                    ))}
                </section>
            )}

            {/* Photo Metric Galleries */}
            {imageMetrics.length > 0 && (
                <section className="flex flex-col gap-3">
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progress Photos</h3>
                    {imageMetrics.map(m => (
                        <PhotoGallery key={m.id} metric={m} locale={locale} startDate={startDate} endDate={endDate} />
                    ))}
                </section>
            )}

            {/* Submission Timeline */}
            {timeline.length > 0 && (
                <section>
                    <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Submission History</h3>
                    <div className="flex flex-col gap-2">
                        {timeline.map(entry => (
                            <TimelineEntry key={entry.submissionId} entry={entry} locale={locale} />
                        ))}
                    </div>
                </section>
            )}
        </div>
    );
}

export default function ClientHomePage() {
    const t = useTranslations('portal.home');
    const locale = useLocale();
    usePageTitle(t('title'));

    return (
        <div className="max-w-lg mx-auto px-4 pt-5 pb-20 flex flex-col gap-6">
            <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>

            <section className="flex flex-col gap-3">
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Progress</h2>
                <ProgressSection locale={locale} />
            </section>
        </div>
    );
}
