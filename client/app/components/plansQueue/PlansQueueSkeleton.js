"use client";

import { Skeleton } from "@heroui/react/skeleton";
import { useTranslations } from "next-intl";

// How many placeholder rows to draw — enough to fill a laptop screen without implying a real row count.
const SKELETON_ROW_COUNT = 8;
const SKELETON_ROW_KEYS = Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => index);

// Stand-in for the Plans Queue while its data loads. The title and description are known immediately, so they
// render for real; only the parts that depend on the request (toolbar buttons, table rows) are placeholders.
// Mirrors the real layout (header row, search + filter toolbar, table with the same column order) so nothing
// jumps when the data arrives. Columns beyond the client and form collapse on small screens, like the real table.
export default function PlansQueueSkeleton({ title, description }) {
    const t = useTranslations("plansQueue");

    return (
        <div className="p-8 overflow-auto h-full" role="status" aria-busy="true" aria-live="polite">
            <span className="sr-only">{t("loadingQueue")}</span>

            <div className="flex items-center justify-between gap-4 flex-wrap" aria-hidden="true">
                <div>
                    <h1 className="text-3xl font-bold">{title ?? t("title")}</h1>
                    <p className="text-muted-foreground text-sm mt-1">{description ?? t("description")}</p>
                </div>
                <div className="flex items-center gap-2">
                    <Skeleton className="h-8 w-28 rounded-lg" />
                    <Skeleton className="h-8 w-36 rounded-lg" />
                </div>
            </div>

            <div className="mt-6 flex items-center gap-2" aria-hidden="true">
                <Skeleton className="h-9 w-full max-w-xs rounded-lg" />
                <Skeleton className="hidden sm:block h-9 w-24 rounded-lg" />
                <Skeleton className="hidden sm:block h-9 w-24 rounded-lg" />
            </div>

            <div className="mt-4 rounded-lg border border-border overflow-hidden" aria-hidden="true">
                <div className="flex items-center gap-4 px-4 py-3 border-b border-border">
                    <Skeleton className="hidden md:block h-3 w-10 rounded" />
                    <Skeleton className="h-3 w-24 rounded" />
                    <Skeleton className="hidden lg:block h-3 w-20 rounded" />
                    <Skeleton className="h-3 w-24 rounded md:ml-8" />
                    <Skeleton className="hidden md:block h-3 w-24 rounded ml-auto" />
                </div>

                {SKELETON_ROW_KEYS.map((key) => (
                    <div key={key} className="flex items-center gap-4 px-4 py-3 border-b border-border last:border-b-0">
                        <Skeleton className="hidden md:block h-3 w-10 rounded" />
                        <div className="flex flex-col gap-1.5 w-40 shrink-0">
                            <Skeleton className="h-3.5 w-32 rounded" />
                            <Skeleton className="h-2.5 w-24 rounded" />
                        </div>
                        <Skeleton className="hidden lg:block h-5 w-20 rounded-full" />
                        <div className="flex flex-col gap-1.5 flex-1 min-w-0">
                            <Skeleton className="h-3.5 w-40 max-w-full rounded" />
                            <div className="flex gap-1">
                                <Skeleton className="h-4 w-14 rounded-full" />
                                <Skeleton className="h-4 w-16 rounded-full" />
                            </div>
                        </div>
                        <Skeleton className="hidden md:block h-3 w-20 rounded" />
                        <div className="flex items-center gap-1.5 shrink-0">
                            <Skeleton className="h-7 w-7 rounded-full" />
                            <Skeleton className="h-7 w-7 rounded-full" />
                            <Skeleton className="hidden sm:block h-7 w-7 rounded-full" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
