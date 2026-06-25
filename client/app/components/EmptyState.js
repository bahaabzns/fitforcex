"use client";

import { SearchX, FilterX, Lock, Plug, TriangleAlert, Inbox } from "lucide-react";
import { Button } from "@heroui/react/button";

// ============================================================
// EmptyState — the one empty/zero-data surface for the portal
// ============================================================
// The `variant` encodes the CTA strategy so each caller can't drift:
//
//   firstTime    → user has never created data here. Prominent: big icon,
//                  title, description, primary creation CTA. (Activation.)
//   search       → data exists but the search matched nothing. Light: small
//                  icon + one-line hint + recovery action (Clear search).
//   filter       → data exists but filters matched nothing. Light + Clear filters.
//   permission   → caller is blocked. Prominent + recovery CTA (Go back / Upgrade).
//   integration  → setup required before content exists. Prominent + Connect/Configure.
//   error        → load failed. Prominent + Retry/Refresh.
//
// Rule of thumb (see the Empty-State CTA strategy): a creation CTA belongs ONLY
// to `firstTime`. search/filter get recovery actions, never "create".

const VARIANT = {
    firstTime:   { tone: "prominent", icon: Inbox },
    search:      { tone: "light",     icon: SearchX },
    filter:      { tone: "light",     icon: FilterX },
    permission:  { tone: "prominent", icon: Lock },
    integration: { tone: "prominent", icon: Plug },
    error:       { tone: "prominent", icon: TriangleAlert },
};

// An action is { label, onPress, icon?, variant? } or a ready-made node.
function ActionButton({ action, fallbackVariant }) {
    if (!action) return null;
    if (typeof action === "object" && "type" in action) return action; // already JSX
    const { label, onPress, href, icon: Icon, variant } = action;
    return (
        <Button
            size="sm"
            variant={variant ?? fallbackVariant}
            onPress={onPress}
            {...(href ? { as: "a", href } : {})}
        >
            {Icon ? <Icon size={16} /> : null}
            {label}
        </Button>
    );
}

export default function EmptyState({
    variant = "firstTime",
    icon,
    title,
    description,
    action,
    secondaryAction,
    className = "",
}) {
    const spec = VARIANT[variant] ?? VARIANT.firstTime;
    const Icon = icon ?? spec.icon;
    const isProminent = spec.tone === "prominent";

    if (isProminent) {
        return (
            <div className={`flex flex-col items-center justify-center text-center px-6 py-14 ${className}`}>
                <div className="flex items-center justify-center w-16 h-16 rounded-full bg-muted/40 text-muted-foreground mb-5">
                    <Icon size={28} strokeWidth={1.5} />
                </div>
                {title && <h3 className="text-base font-semibold text-foreground">{title}</h3>}
                {description && (
                    <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
                )}
                {(action || secondaryAction) && (
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
                        <ActionButton action={action} fallbackVariant="primary" />
                        <ActionButton action={secondaryAction} fallbackVariant="ghost" />
                    </div>
                )}
            </div>
        );
    }

    // light tone — search / filter recovery
    return (
        <div className={`flex flex-col items-center justify-center text-center px-6 py-10 ${className}`}>
            <Icon size={22} strokeWidth={1.75} className="text-muted-foreground/70 mb-2.5" />
            {title && <p className="text-sm font-medium text-foreground">{title}</p>}
            {description && (
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">{description}</p>
            )}
            {action && (
                <div className="mt-3">
                    <ActionButton action={action} fallbackVariant="ghost" />
                </div>
            )}
        </div>
    );
}
