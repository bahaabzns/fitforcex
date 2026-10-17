"use client";

// The segmented pill control used across Team Workload (period buttons, chart filters): a rounded track with
// one pill per option, the selected one in the accent colour. `value` is the selected option id or null.
// With `allowDeselect`, pressing the selected pill clears it (for filters); without it, a selection stays
// (for presets).
//
// Plain buttons rather than a Tabs control on purpose: Tabs always keeps one tab selected, so an unselected
// state (a custom date range, or "no filter") would be forced back onto the first tab.
// `fullWidth` stretches the track to its container with equal-width pills on a phone; `trailing` is an extra control
// (a date picker button) drawn as the last pill inside the same track.
export default function PillToggleGroup({ ariaLabel, options, value, onChange, allowDeselect = false, fullWidth = false, trailing = null }) {
    return (
        <div role="group" aria-label={ariaLabel} className={`items-center gap-0.5 sm:gap-1 rounded-full bg-default/60 p-1 ${fullWidth ? "flex w-full sm:inline-flex sm:w-auto" : "inline-flex shrink-0"}`}>
            {options.map((option) => {
                const isSelected = value === option.id;
                return (
                    <button
                        key={option.id}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => onChange(isSelected && allowDeselect ? null : option.id)}
                        className={`h-8 sm:h-7 px-2 sm:px-3 ${fullWidth ? "flex-1 sm:flex-none" : ""} rounded-full text-xs sm:text-sm whitespace-nowrap transition-colors cursor-pointer ${
                            isSelected ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                        {option.label}
                    </button>
                );
            })}
            {trailing}
        </div>
    );
}
