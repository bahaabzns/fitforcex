"use client";

import { useLocale, useTranslations } from "next-intl";
import { DateRangePicker } from "@heroui/react/date-range-picker";
import { RangeCalendar } from "@heroui/react/range-calendar";
import { DateField } from "@heroui/react/date-field";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import PillToggleGroup from "@/app/components/operations/PillToggleGroup";
import { PRESET_DAYS } from "@/app/components/operations/useTrendRange";

// The page period: an always-visible date range picker beside the Today / 7 days / 30 days buttons.
// The picker always shows the dates the current choice covers; picking dates in it switches to a
// custom range, and then none of the buttons is selected.
//
// The presets are plain buttons, not a Tabs control, on purpose: Tabs always keeps one tab selected, so
// with a custom range active it silently re-selected the first tab and threw the range away.
export default function TrendRangeControls({ range }) {
    const t = useTranslations("operations");
    const locale = useLocale();
    const isRtl = locale === "ar";

    // One control, four buttons: Today / 7 days / 30 days and a fourth that opens the calendar. On a phone the
    // track spans the full width with equal-width buttons. The calendar button is highlighted while a custom
    // range is active (no preset selected).
    const customActive = range.presetDays === null;
    const calendarButton = (
        <DateRangePicker
            aria-label={t("trendRange")}
            value={range.shownRange}
            onChange={range.pickCustom}
            className="flex-1 sm:flex-none"
            maxValue={range.todayDate}
            isInvalid={range.tooLong}
        >
            {/* The group is only the anchor the calendar opens from; it has no text fields and no chrome. */}
            <DateField.Group className="w-full border-0 bg-transparent p-0 shadow-none">
                <DateRangePicker.Trigger
                    className={`inline-flex h-8 sm:h-7 w-full items-center justify-center gap-1.5 rounded-full px-2 sm:px-3 text-xs sm:text-sm whitespace-nowrap cursor-pointer transition-colors border-0 ${
                        customActive ? "bg-accent text-accent-foreground" : "bg-transparent text-muted-foreground hover:text-foreground"
                    }`}
                >
                    <CalendarDays size={13} aria-hidden="true" />
                    {t("rangeCustom")}
                </DateRangePicker.Trigger>
            </DateField.Group>
                <DateRangePicker.Popover placement="bottom end" className="max-w-[calc(100vw-1rem)]">
                    <RangeCalendar aria-label={t("trendRange")} className="w-72 max-w-full">
                        <RangeCalendar.Header>
                            <RangeCalendar.YearPickerTrigger>
                                <RangeCalendar.YearPickerTriggerHeading />
                                <RangeCalendar.YearPickerTriggerIndicator>
                                    {isRtl ? <ChevronLeft style={{ height: "1em", width: "1em" }} /> : <ChevronRight style={{ height: "1em", width: "1em" }} />}
                                </RangeCalendar.YearPickerTriggerIndicator>
                            </RangeCalendar.YearPickerTrigger>
                            <RangeCalendar.NavButton slot="previous">
                                {isRtl ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
                            </RangeCalendar.NavButton>
                            <RangeCalendar.NavButton slot="next">
                                {isRtl ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
                            </RangeCalendar.NavButton>
                        </RangeCalendar.Header>
                        <RangeCalendar.Grid weekdayStyle="narrow">
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
    );

    // While a custom range is active, spell out the dates picked: beside the buttons on wider screens, under them on a phone.
    const formatDay = (day) => new Date(day.year, day.month - 1, day.day).toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
    const rangeText = customActive ? `${formatDay(range.shownRange.start)} – ${formatDay(range.shownRange.end)}` : null;

    return (
        <div className="flex w-full flex-col gap-1.5 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            {rangeText && (
                <span className="order-2 text-center text-xs font-medium text-muted-foreground tabular-nums sm:order-1 sm:text-sm" dir="auto">{rangeText}</span>
            )}
            <div className="order-1 w-full sm:order-2 sm:w-auto">
            <PillToggleGroup
                fullWidth
                ariaLabel={t("trendRange")}
                value={range.presetDays}
                onChange={range.selectPreset}
                options={PRESET_DAYS.map((days) => ({ id: days, label: days === 1 ? t("rangeToday") : t("trendDays", { count: days }) }))}
                trailing={calendarButton}
            />
            </div>
        </div>
    );
}
