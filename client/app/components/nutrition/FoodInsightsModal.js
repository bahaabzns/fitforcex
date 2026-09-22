"use client";

import { useEffect, useState } from "react";
import { Modal } from "@heroui/react/modal";
import { ScrollShadow } from "@/app/components/ScrollShadow";
import api from "@/lib/axios";
import ObservationModal from "@/app/components/ObservationModal";
import RelatedObservationsPanel from "@/app/components/RelatedObservationsPanel";

/**
 * Thin sibling of ExerciseInsightsModal.js, scoped to only what a food item
 * actually has — no progress chart or personal records (those are
 * workout-log concepts a food item has no equivalent of). Just its Related
 * Observations, so coaches get the same "+ Add observation" moment on a
 * food item that Training already has on an exercise.
 */
export default function FoodInsightsModal({ open, onClose, item, clientId, onObservationsChanged }) {
    const [relatedObservations, setRelatedObservations] = useState([]);
    const [observationModalOpen, setObservationModalOpen] = useState(false);
    const [editingObservation, setEditingObservation] = useState(null);
    const [me, setMe] = useState(null);

    const foodItemId = item?.food_item_id || item?.id;

    useEffect(() => {
        if (!open || !clientId || !foodItemId) return;
        api.get(`/api/clients/${clientId}/observations?relatedType=foodItem`)
            .then(({ data }) => setRelatedObservations((data ?? []).filter(o => o.relatedItems?.some(ri => ri.id === foodItemId))))
            .catch(() => setRelatedObservations([]));
    }, [open, clientId, foodItemId]);

    useEffect(() => {
        if (!open) return;
        api.get('/api/auth/me').then(({ data }) => setMe(data)).catch(() => {});
    }, [open]);

    function handleClose() {
        onObservationsChanged?.();
        onClose();
    }

    return (
        <>
        <Modal isOpen={open} onOpenChange={(o) => !o && handleClose()}>
            <Modal.Backdrop>
                <Modal.Container className="max-w-lg w-full">
                    <Modal.Dialog>
                        <Modal.Header>
                            <Modal.Heading>{item?.name || "Food Item"}</Modal.Heading>
                            <Modal.CloseTrigger />
                        </Modal.Header>
                        <Modal.Body>
                            <ScrollShadow className="max-h-[70vh]" hideScrollBar>
                                <RelatedObservationsPanel
                                    title="Related Observations"
                                    addLabel="Add observation"
                                    emptyLabel="No observations linked to this food item yet."
                                    observations={relatedObservations}
                                    clientId={clientId}
                                    currentUserId={me?.userId}
                                    isOwner={me?.currentWorkspace?.role === "owner"}
                                    onAddClick={() => { setEditingObservation(null); setObservationModalOpen(true); }}
                                    onEdit={(obs) => { setEditingObservation(obs); setObservationModalOpen(true); }}
                                    onDeleted={(deletedId) => setRelatedObservations(prev => prev.filter(x => x.id !== deletedId))}
                                />
                            </ScrollShadow>
                        </Modal.Body>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
        <ObservationModal
            open={observationModalOpen}
            onClose={() => setObservationModalOpen(false)}
            clientId={clientId}
            observation={editingObservation}
            initialRelatedItem={{ type: "foodItem", id: foodItemId, label: item?.name || "" }}
            onCreated={(obs) => setRelatedObservations(prev => [obs, ...prev])}
            onUpdated={(updated) => setRelatedObservations(prev => prev.map(x => x.id === updated.id ? updated : x))}
        />
        </>
    );
}
