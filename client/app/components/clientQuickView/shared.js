"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Skeleton } from "@heroui/react/skeleton";
import EmptyState from "@/app/components/EmptyState";

export const NOOP = () => {};

// Same orderings as the builders' sort pills.
export function sortPlans(plans, sortOrder) {
    const byDate = (field) => (a, b) => new Date(b[field]) - new Date(a[field]);
    if (sortOrder === "created_asc") return [...plans].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    if (sortOrder === "updated_desc") return [...plans].sort(byDate("updated_at"));
    return [...plans].sort(byDate("created_at"));
}

/**
 * Fetches once on mount. `load` must be stable (wrap it in useCallback) — a new
 * function identity re-fetches. State is only set from the promise callbacks.
 */
export function useQuickViewFetch(load) {
    const [state, setState] = useState({ data: null, loading: true, error: false });

    const run = useCallback(() => {
        load()
            .then((data) => setState({ data, loading: false, error: false }))
            .catch(() => setState({ data: null, loading: false, error: true }));
    }, [load]);

    useEffect(() => { run(); }, [run]);

    const reload = useCallback(() => {
        setState((prev) => ({ ...prev, loading: true, error: false }));
        run();
    }, [run]);

    return { ...state, reload };
}

/** Loading / error / empty / content states shared by every quick-view tab. */
export function AsyncSection({ loading, error, onRetry, isEmpty, emptyTitle, children }) {
    const t = useTranslations("clientQuickView");

    if (loading) {
        return (
            <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-16 rounded-2xl" />)}
            </div>
        );
    }
    if (error) {
        return (
            <EmptyState
                variant="error"
                title={t("loadError")}
                action={{ label: t("retry"), onPress: onRetry }}
            />
        );
    }
    if (isEmpty) {
        return <EmptyState variant="firstTime" title={emptyTitle} />;
    }
    return children;
}

/** Row of selectable pills used to switch between plans / cycles. */
export function PillPicker({ options, selectedId, onSelect, ariaLabel, scrollable = false }) {
    if (options.length < 2) return null;
    return (
        <div
            role="tablist"
            aria-label={ariaLabel}
            className={`flex gap-1.5 ${scrollable ? "flex-nowrap overflow-x-auto scrollbar-none" : "flex-wrap"}`}
        >
            {options.map((option) => {
                const isSelected = String(option.id) === String(selectedId);
                return (
                    <button
                        key={option.id}
                        type="button"
                        role="tab"
                        aria-selected={isSelected}
                        onClick={() => onSelect(option.id)}
                        className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                            isSelected
                                ? "bg-primary/10 text-primary border-primary/30"
                                : "bg-surface text-muted-foreground border-border hover:text-foreground"
                        }`}
                    >
                        {option.label}
                    </button>
                );
            })}
        </div>
    );
}
