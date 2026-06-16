'use client';

import { DatePicker } from "@heroui/react/date-picker";
import { DateField } from "@heroui/react/date-field";
import { Calendar } from "@heroui/react/calendar";
import { parseDate } from "@internationalized/date";

/**
 * Parse a "YYYY-MM-DD" string into a DateValue for DatePicker, or null when empty.
 * Pair with `dv.toString()` to convert back to a string on change.
 */
export function strToDate(dateStr) {
    return dateStr ? parseDate(dateStr) : null;
}

/**
 * Shared date picker used inside modals/forms across the app. Matches the
 * "Add Client" subscription step: a secondary-variant DateField with a calendar
 * trigger and year-picker. RTL-aware via HeroUI.
 */
export default function DatePickerField({ value, onChange, ariaLabel, isInvalid, isDisabled }) {
    return (
        <DatePicker className="w-full" aria-label={ariaLabel} value={value} onChange={onChange} isInvalid={isInvalid} isDisabled={isDisabled}>
            <DateField.Group fullWidth variant="secondary">
                <DateField.Input>{(segment) => <DateField.Segment segment={segment} />}</DateField.Input>
                <DateField.Suffix>
                    <DatePicker.Trigger>
                        <DatePicker.TriggerIndicator />
                    </DatePicker.Trigger>
                </DateField.Suffix>
            </DateField.Group>
            <DatePicker.Popover>
                <Calendar aria-label={ariaLabel}>
                    <Calendar.Header>
                        <Calendar.YearPickerTrigger>
                            <Calendar.YearPickerTriggerHeading />
                            <Calendar.YearPickerTriggerIndicator />
                        </Calendar.YearPickerTrigger>
                        <Calendar.NavButton slot="previous" />
                        <Calendar.NavButton slot="next" />
                    </Calendar.Header>
                    <Calendar.Grid>
                        <Calendar.GridHeader>
                            {(day) => <Calendar.HeaderCell>{day}</Calendar.HeaderCell>}
                        </Calendar.GridHeader>
                        <Calendar.GridBody>{(date) => <Calendar.Cell date={date} />}</Calendar.GridBody>
                    </Calendar.Grid>
                    <Calendar.YearPickerGrid>
                        <Calendar.YearPickerGridBody>
                            {({ year }) => <Calendar.YearPickerCell year={year} />}
                        </Calendar.YearPickerGridBody>
                    </Calendar.YearPickerGrid>
                </Calendar>
            </DatePicker.Popover>
        </DatePicker>
    );
}
