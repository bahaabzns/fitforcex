"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Modal, { ModalFooter } from "@/app/components/Modal";
import { Button } from "@heroui/react/button";
import { TextField } from "@heroui/react/textfield";
import { TextArea } from "@heroui/react/textarea";

// Local draft so Cancel discards unsaved edits; Save commits the draft up via
// onSave (the parent owns the actual exercise.note state — this modal is just
// the input surface).
export default function ExerciseNotesModal({ open, onClose, initialValue, onSave }) {
    const t = useTranslations("portal.training");
    const tCommon = useTranslations("common");
    const [draft, setDraft] = useState(initialValue ?? "");

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reset the draft each time the modal (re)opens
        if (open) setDraft(initialValue ?? "");
    }, [open, initialValue]);

    function handleSave() {
        onSave(draft);
        onClose();
    }

    return (
        <Modal open={open} onClose={onClose} title={t("notesModalTitle")}>
            <div className="flex flex-col gap-4 px-1 py-1">
                <TextField value={draft} onChange={setDraft} aria-label={t("notesModalTitle")} variant="secondary" fullWidth>
                    <TextArea placeholder={t("exerciseNotePlaceholder")} dir="auto" rows={5} className="resize-none" />
                </TextField>
                <ModalFooter>
                    <Button type="button" variant="ghost" onClick={onClose}>{tCommon("cancel")}</Button>
                    <Button type="button" variant="primary" onClick={handleSave}>{t("saveNotes")}</Button>
                </ModalFooter>
            </div>
        </Modal>
    );
}
