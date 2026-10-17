"use client";

import { useMemo, useState } from "react";
import { today } from "@internationalized/date";
import { tz } from "@/utils/chartDateRange";

export const PRESET_DAYS = [1, 7, 30];   // 1 = Today
export const MAX_RANGE_DAYS = 366; // mirrors the server's MAX_TREND_RANGE_DAYS

const rangeLength = (range) => range.end.compare(range.start) + 1;

// The chart date range shared by every chart on the tab: a preset (last 7/30/90 days) or a custom
// start/end. `params` is what the API wants (stable between renders unless the range really changes);
// `key` is a primitive for effect dependency lists.
export function useTrendRange(initialDays = 30) {
    const todayDate = useMemo(() => today(tz), []);
    const [presetDays, setPresetDays] = useState(initialDays);   // null while a custom range is active
    const [customRange, setCustomRange] = useState(null);

    const fromKey = customRange?.start.toString();
    const toKey = customRange?.end.toString();
    const tooLong = customRange !== null && rangeLength(customRange) > MAX_RANGE_DAYS;

    const params = useMemo(
        () => (fromKey && toKey ? { from: fromKey, to: toKey } : { days: presetDays }),
        [fromKey, toKey, presetDays],
    );
    const key = fromKey && toKey ? `${fromKey}..${toKey}` : `last-${presetDays}`;

    // What the date picker displays: the custom range, or the preset's equivalent dates.
    const shownRange = customRange ?? { start: todayDate.subtract({ days: (presetDays ?? initialDays) - 1 }), end: todayDate };

    // How many days the range covers: 1 means a single day, which the charts show as numbers rather than a line.
    const dayCount = customRange ? rangeLength(customRange) : presetDays;

    return {
        todayDate, presetDays, customRange, shownRange, tooLong, params, key, dayCount,
        selectPreset(days) { setPresetDays(days); setCustomRange(null); },
        pickCustom(range) { if (!range) return; setCustomRange(range); setPresetDays(null); },
    };
}
