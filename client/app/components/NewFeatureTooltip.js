"use client";

import { useState } from "react";
import { Popover } from "@heroui/react/popover";
import { PartyPopper } from "lucide-react";

/**
 * A first-time-only floating hint that anchors to an interactive trigger,
 * shows once ever per browser (localStorage-backed), and is dismissed either
 * explicitly or by using the feature it points at.
 *
 * `isOpen` is intentionally computed synchronously (lazy useState initializer,
 * no effect) and must already be correct on `active`'s very first true value —
 * react-aria's trigger doesn't reliably reopen on a false→true transition
 * after mount, and its onOpenChange fires a spurious close during React
 * Strict Mode's dev-only double-mount cycle, so dismissal is wired only
 * through explicit user actions here, never through onOpenChange.
 *
 * Usage:
 *   <NewFeatureTooltip
 *     featureKey="food_swap_hint"
 *     active={isFirstEligibleItem}
 *     message={t('hint')}
 *     dismissLabel={t('gotIt')}
 *     badgeLabel={t('newFeature')}
 *     onTriggerClick={() => setSwapItemId(item.id)}
 *     triggerClassName="flex items-center gap-1 text-[11px] font-medium text-primary"
 *   >
 *     <ArrowLeftRight className="w-2.5 h-2.5" />
 *     {t('swapFood')}
 *   </NewFeatureTooltip>
 */
export default function NewFeatureTooltip({
    featureKey,
    active,
    message,
    dismissLabel,
    badgeLabel,
    badgeIcon: BadgeIcon = PartyPopper,
    onTriggerClick,
    triggerClassName,
    // Most callers wrap the actual interactive control the hint is pointing
    // at (see the doc comment above) — that control must keep rendering
    // forever regardless of hint state, so by default `children` always
    // renders and only the popover bubble is gated by `seen`. A few callers
    // instead wrap a purely decorative badge (e.g. a small dot) that has no
    // function of its own once the hint's been acknowledged — those pass
    // this to make the whole trigger disappear on dismissal instead of
    // sitting there forever with nothing left to say.
    hideTriggerWhenSeen = false,
    children,
}) {
    const storageKey = `ff_seen_feature_hint_${featureKey}`;
    const [seen, setSeen] = useState(() => {
        if (typeof window === "undefined") return true;
        try { return !!localStorage.getItem(storageKey); } catch { return true; }
    });

    function dismiss() {
        setSeen(true);
        try { localStorage.setItem(storageKey, "1"); } catch { /* storage unavailable — hint just won't persist dismissal this session */ }
    }

    if (hideTriggerWhenSeen && seen) return null;

    return (
        <Popover isOpen={active && !seen}>
            <Popover.Trigger
                onClick={() => { onTriggerClick?.(); dismiss(); }}
                className={triggerClassName}
            >
                {children}
            </Popover.Trigger>
            <Popover.Content className="max-w-64 border border-border" isNonModal>
                <Popover.Dialog>
                    <Popover.Arrow>
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-border overflow-visible">
                            <path d="M0 0C5.48483 8 6.5 8 12 0" stroke="currentColor" strokeWidth="1" />
                        </svg>
                    </Popover.Arrow>
                    {badgeLabel && (
                        <span className="inline-flex items-center gap-1 mb-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold uppercase tracking-wide">
                            <BadgeIcon className="w-3 h-3" />
                            {badgeLabel}
                        </span>
                    )}
                    <p className="text-xs text-foreground">{message}</p>
                    <button
                        onClick={dismiss}
                        className="mt-2 block ms-auto text-xs font-medium text-primary hover:opacity-80 cursor-pointer"
                    >
                        {dismissLabel}
                    </button>
                </Popover.Dialog>
            </Popover.Content>
        </Popover>
    );
}
