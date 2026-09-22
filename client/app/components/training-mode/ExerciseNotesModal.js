"use client";

import { useEffect, useState } from "react";
import { useTranslations, useLocale } from "next-intl";
import Modal, { ModalFooter } from "@/app/components/Modal";
import { Button } from "@heroui/react/button";
import { TextField } from "@heroui/react/textfield";
import { TextArea } from "@heroui/react/textarea";
import { Spinner } from "@heroui/react/spinner";
import api from "@/lib/axios";
import { useDateFormatter } from "@/utils/useDateFormatter";

// Local draft so Cancel discards unsaved edits; Save commits the draft up via
// onSave (the parent owns the actual exercise.note state — this modal is just
// the input surface). Below the input, "Previous Notes" lists notes from past
// sessions of this same exercise — the same recentSessions data the Progress
// modal charts, filtered down to entries that actually have one.
export default function ExerciseNotesModal({ open, onClose, initialValue, onSave, exercise }) {
    const t = useTranslations("portal.training");
    const tCommon = useTranslations("common");
    const locale = useLocale();
    const { formatDate } = useDateFormatter();
    const [draft, setDraft] = useState(initialValue ?? "");
    const [previousNotes, setPreviousNotes] = useState([]);
    const [loadingPrevious, setLoadingPrevious] = useState(false);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the draft each time the modal (re)opens
        if (open) setDraft(initialValue ?? "");
    }, [open, initialValue]);

    useEffect(() => {
        if (!open || !exercise) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reset before the fetch below re-populates; same pattern as ClientExerciseInsightsModal.js
        setLoadingPrevious(true);
        setPreviousNotes([]);

        const params = {};
        if (exercise.exercise_library_id) params.exercise_library_id = exercise.exercise_library_id;
        else params.exercise_id = exercise.exercise_id;

        api.get("/api/client-portal/workout-logs/exercise-insights", { params })
            .then(({ data }) => {
                const withNotes = (data?.recentSessions ?? []).filter(s => s.note?.trim());
                setPreviousNotes(withNotes);
            })
            .catch(() => setPreviousNotes([]))
            .finally(() => setLoadingPrevious(false));
    }, [open, exercise]);

    function handleSave() {
        onSave(draft);
        onClose();
    }

    return (
        <Modal open={open} onClose={onClose} title={t("notesModalTitle")}>
            <div className="flex flex-col gap-4 px-1 py-1">
                <TextField value={draft} onChange={setDraft} aria-label={t("notesModalTitle")} variant="secondary" fullWidth>
                    <TextArea placeholder={t("exerciseNotePlaceholder")} dir={locale === "ar" ? "rtl" : "ltr"} rows={5} className="resize-none" />
                </TextField>

                {loadingPrevious && (
                    <div className="flex items-center justify-center py-4">
                        <Spinner size="sm" />
                    </div>
                )}

                {!loadingPrevious && previousNotes.length > 0 && (
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t("previousNotes")}</span>
                        <div className="flex flex-col divide-y divide-border/50 max-h-48 overflow-y-auto">
                            {previousNotes.map((session, i) => (
                                <div key={i} className="py-2">
                                    <p className="text-[11px] text-muted-foreground/70">{formatDate(session.date)}</p>
                                    <p dir="auto" className="text-sm text-foreground whitespace-pre-wrap">{session.note}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <ModalFooter>
                    <Button type="button" variant="ghost" onClick={onClose}>{tCommon("cancel")}</Button>
                    <Button type="button" variant="primary" onClick={handleSave}>{t("saveNotes")}</Button>
                </ModalFooter>
            </div>
        </Modal>
    );
}
