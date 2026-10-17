"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@heroui/react/button";
import api from "@/lib/axios";
import Modal from "@/app/components/Modal";

// Confirms handing the oldest unassigned plans to the person with the most room.
export default function AssignWaitingModal({ assignee, onClose, onDone }) {
    const t = useTranslations("operations");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    async function handleConfirm() {
        setSaving(true);
        setError("");
        try {
            await api.post("/api/operations/assign-waiting", { assigneeUserId: assignee.userId, limit: assignee.canTake });
            onDone();
            onClose();
        } catch {
            setError(t("assignFailed"));
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal open onClose={onClose} title={t("assignTitle")}>
            <div className="flex flex-col gap-4">
                {error && (
                    <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>
                )}
                <p className="text-sm text-foreground">{t("assignBody", { count: assignee.canTake, name: assignee.name })}</p>
                <div className="flex gap-2 justify-end">
                    <Button variant="ghost" onClick={onClose}>{t("cancel")}</Button>
                    <Button variant="primary" onClick={handleConfirm} isDisabled={saving}>
                        {saving ? t("saving") : t("assignConfirm", { count: assignee.canTake })}
                    </Button>
                </div>
            </div>
        </Modal>
    );
}
