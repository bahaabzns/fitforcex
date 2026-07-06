"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@heroui/react/button";
import api from "@/lib/axios";
import ObservationModal from "@/app/components/ObservationModal";
import ObservationsFeed from "@/app/components/ObservationsFeed";

export default function ClientObservationsPage() {
    const { id } = useParams();
    const t = useTranslations("clientObservations");

    const [observations, setObservations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [me, setMe] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingObservation, setEditingObservation] = useState(null);

    const fetchObservations = useCallback(() => {
        api.get(`/api/clients/${id}/observations`)
            .then((res) => {
                setObservations(Array.isArray(res.data) ? res.data : []);
                setError(false);
            })
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, [id]);

    useEffect(() => {
        fetchObservations();
        api.get("/api/auth/me").then((res) => setMe(res.data)).catch(() => {});
    }, [fetchObservations]);

    function openCreate() {
        setEditingObservation(null);
        setModalOpen(true);
    }

    function openEdit(observation) {
        setEditingObservation(observation);
        setModalOpen(true);
    }

    function handleCreated(observation) {
        setObservations((prev) => [observation, ...prev]);
    }

    function handleUpdated(updated) {
        setObservations((prev) => prev.map((o) => (o.id === updated.id ? updated : o)));
    }

    function handleDeleted(deletedId) {
        setObservations((prev) => prev.filter((o) => o.id !== deletedId));
    }

    return (
        <div className="h-full flex flex-col gap-4">
            <div className="flex items-center justify-between shrink-0">
                <h2 className="text-base font-semibold text-foreground">{t("title")}</h2>
                <Button variant="primary" size="sm" onPress={openCreate}>
                    <Plus size={15} /> {t("addObservationButton")}
                </Button>
            </div>
            <div className="flex-1 min-h-0">
                <ObservationsFeed
                    observations={observations}
                    loading={loading}
                    error={error}
                    onRetry={fetchObservations}
                    onAddClick={openCreate}
                    clientId={id}
                    currentUserId={me?.userId}
                    isOwner={me?.currentWorkspace?.role === "owner"}
                    onEdit={openEdit}
                    onDeleted={handleDeleted}
                />
            </div>
            <ObservationModal
                open={modalOpen}
                onClose={() => setModalOpen(false)}
                clientId={id}
                observation={editingObservation}
                onCreated={handleCreated}
                onUpdated={handleUpdated}
            />
        </div>
    );
}
