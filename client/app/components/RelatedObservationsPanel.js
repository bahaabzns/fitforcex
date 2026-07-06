"use client";

import { Plus } from "lucide-react";
import { Button } from "@heroui/react/button";
import ObservationCard from "@/app/components/ObservationCard";

/**
 * "Related Observations" section reused wherever a specific related item
 * (an exercise, a food item, a check-in/assessment) needs its own filtered
 * feed — Check-in Review, Exercise/Food Insights, Messenger. The caller owns
 * the data fetch and the create/edit modal; this is just the header + list +
 * empty-state shell, so that shape exists in exactly one place.
 *
 *   <RelatedObservationsPanel
 *     title={t('relatedObservations')} addLabel={t('addObservation')} emptyLabel={t('noRelatedObservations')}
 *     observations={relatedObservations} clientId={id} currentUserId={me?.userId} isOwner={isOwner}
 *     onAddClick={() => { setEditingObservation(null); setObservationModalOpen(true); }}
 *     onEdit={(obs) => { setEditingObservation(obs); setObservationModalOpen(true); }}
 *     onDeleted={(deletedId) => setRelatedObservations(prev => prev.filter(x => x.id !== deletedId))}
 *   />
 */
export default function RelatedObservationsPanel({
    title, addLabel, emptyLabel, observations, clientId, currentUserId, isOwner, onAddClick, onEdit, onDeleted,
}) {
    return (
        <div>
            <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
                <Button variant="ghost" size="sm" onPress={onAddClick}>
                    <Plus size={13} /> {addLabel}
                </Button>
            </div>
            {observations.length === 0 ? (
                <p className="text-xs text-muted-foreground">{emptyLabel}</p>
            ) : (
                <div className="flex flex-col gap-2">
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
            )}
        </div>
    );
}
