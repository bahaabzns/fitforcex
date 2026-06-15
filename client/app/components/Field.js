'use client';

import { Label } from "@heroui/react/label";

/**
 * Form field label used inside modals/forms across the app.
 * Mirrors the "Add Client" modal pattern: a HeroUI Label with an optional
 * required-marker asterisk.
 */
export function FieldLabel({ children, required = false }) {
    return (
        <Label>
            {children}
            {required && <span className="text-red-500"> *</span>}
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
