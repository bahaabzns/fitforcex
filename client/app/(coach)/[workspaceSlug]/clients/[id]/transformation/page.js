"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useLocale } from "next-intl";
import { TrendingUp } from "lucide-react";
import api from "@/lib/axios";
import AreaChart from "@/app/components/charts/AreaChart";
import { usePageHeaderActions } from "@/app/contexts/pageHeaderActions";
import { DateRangePicker } from "@heroui/react/date-range-picker";
import { RangeCalendar } from "@heroui/react/range-calendar";
import { DateField } from "@heroui/react/date-field";
import { today, getLocalTimeZone } from "@internationalized/date";
import { Button } from "@heroui/react/button";
import { Tabs } from "@heroui/react";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Skeleton } from "@heroui/react/skeleton";

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

function MetricChart({ metric, locale, startDate, endDate }) {
    const filtered  = useMemo(() => filterByRange(metric.history, startDate, endDate), [metric.history, startDate, endDate]);
    const chartData = useMemo(() => filtered.map(h => ({
        label: new Date(h.date).toLocaleDateString(locale, { day: "numeric", month: "short" }),
        value: parseFloat(h.value) || 0,
    })), [filtered, locale]);
    const info = deltaInfo(filtered);
    const nums = useMemo(
        () => filtered.map(h => parseFloat(h.value)).filter(v => !isNaN(v)),
        [filtered]
    );
    const currentValue = nums.length > 0 ? nums[nums.length - 1] : null;
    const startValue   = nums.length > 1 ? nums[0] : null;

    return (
        <AreaChart
            data={chartData}
            height={180}
            formatValue={v => v.toFixed(1)}
            label={metric.name}
            title={metric.name}
            currentValue={currentValue}
            startValue={startValue}
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
            <img src={after.value} alt="after" className="w-full block max-h-120 object-cover" draggable={false} />

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
    const [lightbox, setLightbox]       = useState(null);
    const [compareMode, setCompareMode] = useState(false);
    const [selected, setSelected]       = useState([]);

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
        <Card>
            <Card.Header>
                <div className="flex items-center gap-2 w-full">
                    <span className="text-lg">{metric.icon || "📷"}</span>
                    <p className="text-sm font-semibold text-foreground flex-1 min-w-0 truncate">{metric.name}</p>
                    <Chip size="sm" variant="soft">
                        <Chip.Label>{photos.length} photo{photos.length !== 1 ? "s" : ""}</Chip.Label>
                    </Chip>
                    <div className="flex items-center gap-2 shrink-0">
                        {compareMode ? (
                            <>
                                <span className="text-xs text-muted-foreground">{selected.length}/2 selected</span>
                                <Button size="sm" variant="outline" onClick={exitCompare}>Exit</Button>
                            </>
                        ) : (
                            canCompare && (
                                <Button size="sm" variant="outline" onClick={enterCompare}>Compare</Button>
                            )
                        )}
                    </div>
                </div>
            </Card.Header>
            <Card.Content className="pt-0">
                {compareMode && selected.length === 2 && (
                    <div className="mb-4">
                        <ComparisonSlider before={selected[0]} after={selected[1]} locale={locale} />
                        <p className="text-[10px] text-muted-foreground text-center mt-1.5">Drag the handle to compare</p>
                    </div>
                )}

                {compareMode && selected.length < 2 && (
                    <div className="mb-4 py-3 rounded-xl bg-primary/5 border border-primary/20 text-center">
                        <p className="text-xs text-primary">
                            {selected.length === 0 ? "Select a before photo" : "Now select an after photo"}
                        </p>
                    </div>
                )}

                {photos.length === 0 ? (
                    <p className="py-8 text-center text-sm text-muted-foreground">No photos in this range</p>
                ) : (
                    <div className="flex gap-3 overflow-x-auto pb-1">
                        {photos.map((h, i) => {
                            const selIdx    = selected.indexOf(h);
                            const isSelected = selIdx !== -1;
                            return (
                                <button
                                    key={i}
                                    onClick={() => compareMode ? toggleSelect(h) : setLightbox(h)}
                                    className="cursor-pointer shrink-0 flex flex-col gap-1.5 relative"
                                >
                                    <img
                                        src={h.value}
                                        alt={metric.name}
                                        className={`w-28 rounded-xl border-2 transition-all ${
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
            </Card.Content>

            {lightbox && !compareMode && (
                <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={() => setLightbox(null)}>
                    <img src={lightbox.value} alt={metric.name} className="max-w-full max-h-full rounded-xl object-contain" />
                    <span className="absolute top-4 right-4 text-white text-xs bg-black/50 px-2 py-1 rounded-lg">
                        {new Date(lightbox.date).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                </div>
            )}
        </Card>
    );
}


export default function ClientTransformationPage() {
    const { id }   = useParams();
    const locale   = useLocale();
    const [data, setData]           = useState(null);
    const [loading, setLoading]     = useState(true);
    const [error, setError]         = useState(null);
    const [dateRange, setDateRange] = useState(rangeForDays(90));
    const [activePreset, setActivePreset] = useState("90d");
    const setPageHeaderActions = usePageHeaderActions();

    useEffect(() => {
        api.get(`/api/clients/${id}/transformation`)
            .then(res => setData(res.data))
            .catch(() => setError("Failed to load transformation data."))
            .finally(() => setLoading(false));
    }, [id]);

    const startDate = useMemo(() => dateRange ? toStartOfDay(dateRange.start) : null, [dateRange]);
    const endDate   = useMemo(() => dateRange ? toEndOfDay(dateRange.end) : null, [dateRange]);

    // Callback ref: updates maskImage on scroll/resize so shadows only appear when needed.
    const scrollCleanupRef = useRef(null);
    const scrollMaskRef = useCallback((el) => {
        if (scrollCleanupRef.current) { scrollCleanupRef.current(); scrollCleanupRef.current = null; }
        if (!el) return;
        function update() {
            const { scrollTop, scrollHeight, clientHeight } = el;
            const top    = scrollTop > 0;
            const bottom = scrollTop + clientHeight < scrollHeight - 1;
            if (!top && !bottom) el.style.maskImage = "none";
            else if (!top)       el.style.maskImage = "linear-gradient(to bottom, black calc(100% - 20px), transparent)";
            else if (!bottom)    el.style.maskImage = "linear-gradient(to bottom, transparent, black 20px)";
            else                 el.style.maskImage = "linear-gradient(to bottom, transparent, black 20px, black calc(100% - 20px), transparent)";
        }
        update();
        el.addEventListener("scroll", update, { passive: true });
        const ro = new ResizeObserver(update);
        ro.observe(el);
        scrollCleanupRef.current = () => { el.removeEventListener("scroll", update); ro.disconnect(); };
    }, []);

    const applyPreset = useCallback((preset) => {
        setActivePreset(preset.label);
        setDateRange(preset.days === null ? null : rangeForDays(preset.days));
    }, []);

    const handlePickerChange = useCallback((range) => {
        setDateRange(range);
        setActivePreset(null);
    }, []);

    // Push the timeframe toolbar into the layout header slot.
    useEffect(() => {
        if (!setPageHeaderActions) return;
        setPageHeaderActions(
            <div className="flex items-center gap-2">
                <DateRangePicker value={dateRange} onChange={handlePickerChange}>
                    <DateField.Group fullWidth>
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
        );
        return () => setPageHeaderActions(null);
    }, [activePreset, dateRange, applyPreset, handlePickerChange, setPageHeaderActions]);

    if (loading) {
        return (
            <div ref={scrollMaskRef} className="h-full overflow-y-auto">
                <div className="flex flex-col gap-5 pb-6">
                    <Skeleton className="h-4 w-32 rounded-lg" />
                    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                        {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
                    </div>
                </div>
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

    if (numericMetrics.length === 0 && imageMetrics.length === 0) {
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
        <div ref={scrollMaskRef} className="h-full overflow-y-auto">
            <div className="flex flex-col gap-5 pb-6">

                {/* Measurements */}
                {numericMetrics.length > 0 && (
                    <section>
                        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Measurements</h2>
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                            {numericMetrics.map(m => (
                                <MetricChart key={m.id} metric={m} locale={locale} startDate={startDate} endDate={endDate} />
                            ))}
                        </div>
                    </section>
                )}

                {/* Progress Photos */}
                {imageMetrics.length > 0 && (
                    <section>
                        <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Progress Photos</h2>
                        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                            {imageMetrics.map(m => (
                                <PhotoGallery key={m.id} metric={m} locale={locale} startDate={startDate} endDate={endDate} />
                            ))}
                        </div>
                    </section>
                )}


            </div>
        </div>
    );
}
