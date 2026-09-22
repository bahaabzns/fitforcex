"use client";

import { forwardRef, useEffect, useRef, useState } from "react";
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
// Callers that key by list *position* rather than entity id (e.g. a row in a
// reorderable/removable list) can still end up with the same mounted instance
// representing a different item after the list shifts — the effect below
// resyncs `draft` from `value` whenever it changes externally while the field
// isn't focused, so a stale draft can't be re-committed onto the wrong item.
//
//  value          — current committed value
//  onCommit(next) — called with the trimmed string when it changes
//  fallback       — substituted when the trimmed draft is empty (titles)
//  selectOnFocus  — select-all on focus (amount fields)
//  placeholder    — shown when empty and no fallback (optional secondary-language titles)
//  dir            — text direction, e.g. "rtl" for Arabic fields
const InlineEditField = forwardRef(function InlineEditField(
    { value, onCommit, fallback, type = "text", selectOnFocus, ariaLabel, className = "", inputClassName = "", variant = "primary", placeholder, dir },
    ref
) {
    const [draft, setDraft] = useState(value ?? "");
    const isFocusedRef = useRef(false);

    useEffect(() => {
        if (!isFocusedRef.current) setDraft(value ?? "");
    }, [value]);

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
                placeholder={placeholder}
                dir={dir}
                onFocus={(e) => {
                    isFocusedRef.current = true;
                    if (selectOnFocus) e.target.select();
                }}
                onBlur={() => {
                    isFocusedRef.current = false;
                    commit();
                }}
                onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") { setDraft(value ?? ""); e.currentTarget.blur(); }
                }}
            />
        </TextField>
    );
});

export default InlineEditField;
