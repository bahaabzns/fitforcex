"use client";

import { useTranslations } from "next-intl";
import { NotebookText } from "lucide-react";
import { ScrollShadow } from "@heroui/react/scroll-shadow";
import { Skeleton } from "@heroui/react/skeleton";
import EmptyState from "@/app/components/EmptyState";
import ObservationCard from "@/app/components/ObservationCard";

/** Loading / error / empty / list states for a client's observation feed. */
export default function ObservationsFeed({ observations, loading, error, onRetry, onAddClick, clientId, currentUserId, isOwner, onEdit, onDeleted }) {
    const t = useTranslations("clientObservations");

    if (loading) {
        return (
            <div className="flex flex-col gap-2">
                {[0, 1, 2].map((i) => <Skeleton key={i} className="h-20 rounded-2xl" />)}
            </div>
        );
    }

    if (error) {
        return (
            <EmptyState
                variant="error"
                title={t("loadErrorTitle")}
                description={t("loadErrorHint")}
                action={{ label: t("retry"), onPress: onRetry }}
            />
        );
    }

    if (observations.length === 0) {
        return (
            <EmptyState
                variant="firstTime"
                icon={NotebookText}
                title={t("emptyTitle")}
                description={t("emptyHint")}
                action={onAddClick ? { label: t("addObservationButton"), onPress: onAddClick } : undefined}
            />
        );
    }

    return (
        <ScrollShadow className="h-full">
            <div className="flex flex-col gap-2 pb-4">
                {observations.map((o) => (
                    <ObservationCard
                        key={o.id}
                        observation={o}
                        clientId={clientId}
                        currentUserId={currentUserId}
                        isOwner={isOwner}
                        onEdit={onEdit}
                        onDeleted={onDeleted}
                    />
                ))}
            </div>
        </ScrollShadow>
    );
}
