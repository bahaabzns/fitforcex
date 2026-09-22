"use client";

// Shows the current form version's lifecycle state — Draft (unsealed, still
// freely editable in place) vs Sealed vN (assigned to at least one client;
// the next edit will fork a new version rather than mutate this one). See
// server/src/modules/forms/forms.service.ts's resolveWritableVersion.
export default function VersionBadge({ versionNumber, sealedAt }) {
    if (!versionNumber) return null;
    const isSealed = Boolean(sealedAt);

    return (
        <span
            title={isSealed
                ? "This version has been assigned to a client. The next edit will create a new version."
                : "This version hasn't been assigned yet — edits save in place."}
            className={`shrink-0 text-xs px-2 py-0.5 rounded-full border font-medium ${
                isSealed
                    ? "bg-secondary text-muted-foreground border-border"
                    : "bg-primary/10 text-primary border-primary/30"
            }`}
        >
            {isSealed ? `Sealed v${versionNumber}` : `Draft v${versionNumber}`}
        </span>
    );
}
