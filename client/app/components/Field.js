'use client';

import { Label } from "@heroui/react/label";
import InfoTooltip from "./InfoTooltip";

/**
 * Form field label used inside modals/forms across the app.
 * Mirrors the "Add Client" modal pattern: a HeroUI Label with an optional
 * required-marker asterisk. Pass `hint` for a note that would otherwise sit
 * as its own line of muted text under the field — it renders as an "i" icon
 * next to the label instead, revealed on hover/focus.
 */
export function FieldLabel({ children, required = false, hint }) {
    return (
        <Label className="inline-flex items-center gap-1">
            {children}
            {required && <span className="text-red-500"> *</span>}
            {hint && <InfoTooltip text={hint} />}
        </Label>
    );
}

/**
 * Inline validation error shown beneath a field. Renders nothing when there's
 * no message, so it can be left in the tree unconditionally.
 */
export function FieldErrorText({ msg }) {
    return msg ? <p className="text-xs text-destructive">{msg}</p> : null;
}
