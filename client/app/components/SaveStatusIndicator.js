"use client";

// Small dot + label save-state indicator: ● Unsaved Changes / Saving… / ✓ Saved.
// Used by the Forms Builder header; safe to adopt in other builders (training/nutrition)
// later without changing their save logic, since this is purely presentational.
export default function SaveStatusIndicator({ isDirty, saveStatus, labels = {} }) {
    const {
        unsaved = "Unsaved changes",
        saving = "Saving…",
        saved = "Saved",
    } = labels;

    if (saveStatus === "saving") {
        return (
            <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                {saving}
            </span>
        );
    }

    if (saveStatus === "saved" && !isDirty) {
        return (
            <span className="flex items-center gap-1.5 text-xs font-medium text-success">
                <span aria-hidden>✓</span>
                {saved}
            </span>
        );
    }

    if (isDirty) {
        return (
            <span className="flex items-center gap-1.5 text-xs font-medium text-warning">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-warning" />
                {unsaved}
            </span>
        );
    }

    return null;
}
