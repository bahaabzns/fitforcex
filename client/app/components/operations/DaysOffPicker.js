"use client";

import { useLocale } from "next-intl";
import { ToggleButton } from "@heroui/react/toggle-button";
import { ToggleButtonGroup } from "@heroui/react/toggle-button-group";
import { WEEK_DAYS, weekdayLabel } from "@/app/components/operations/weekdays";

// Seven toggle buttons, one per weekday; a pressed day is a day OFF. `value` is the list of weekday
// numbers (0 = Sunday ... 6 = Saturday).
export default function DaysOffPicker({ value, onChange, ariaLabel }) {
    const locale = useLocale();

    return (
        <ToggleButtonGroup
            aria-label={ariaLabel}
            selectionMode="multiple"
            isDetached
            size="sm"
            // Wraps onto a second line on a narrow screen instead of scrolling sideways.
            className="flex-wrap"
            selectedKeys={new Set(value.map(String))}
            onSelectionChange={(keys) => onChange([...keys].map(Number).sort((a, b) => a - b))}
        >
            {WEEK_DAYS.map((dow) => (
                <ToggleButton key={dow} id={String(dow)} aria-label={weekdayLabel(locale, dow, "long")}>
                    {weekdayLabel(locale, dow)}
                </ToggleButton>
            ))}
        </ToggleButtonGroup>
    );
}
