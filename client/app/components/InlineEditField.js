"use client";

import { forwardRef, useState } from "react";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";

// HeroUI text field that commits on blur / Enter and reverts on Escape, used
// for the builders' inline title and amount editors. react-aria renders its
// input as controlled, so we hold a local draft and only call `onCommit` when
// the value actually changes (mirroring the old uncontrolled inputs' UX).
//
// Give it a `key={entity.id}` from the caller so it re-initialises when a
// different entity is selected. The forwarded ref points at the DOM input so
// callers can focus()/select() it programmatically.
//
//  value          — current committed value
//  onCommit(next) — called with the trimmed string when it changes
//  fallback       — substituted when the trimmed draft is empty (titles)
//  selectOnFocus  — select-all on focus (amount fields)
const InlineEditField = forwardRef(function InlineEditField(
    { value, onCommit, fallback, type = "text", selectOnFocus, ariaLabel, className = "", inputClassName = "", variant = "primary" },
    ref
) {
    const [draft, setDraft] = useState(value ?? "");

    function commit() {
        const trimmed = String(draft).trim();
        const next = trimmed === "" && fallback != null ? fallback : trimmed;
        if (next !== String(draft)) setDraft(next);
        if (String(next) !== String(value ?? "")) onCommit(next);
    }

    return (
        <TextField
            value={String(draft)}
            onChange={setDraft}
            aria-label={ariaLabel}
            className={className}
        >
            <Input
                ref={ref}
                type={type}
                variant={variant}
                className={inputClassName}
                onFocus={selectOnFocus ? (e) => e.target.select() : undefined}
                onBlur={commit}
                onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") { setDraft(value ?? ""); e.currentTarget.blur(); }
                }}
            />
        </TextField>
    );
});

export default InlineEditField;
