"use client";

import { useTranslations, useLocale } from "next-intl";
import { BookOpen } from "lucide-react";
import Modal from "@/app/components/Modal";
import { getLocalizedField } from "@/utils/localization";

// Read-only coach instructions for one exercise, opened from the "Coach Note"
// icon on the logging card. No draft/save — this is display-only, unlike
// ExerciseNotesModal which edits the client's own per-exercise note.
export default function CoachNoteModal({ open, onClose, exercise }) {
    const t = useTranslations("portal.training");
    const locale = useLocale();
    const note = getLocalizedField(exercise, "instructions", locale).trim();

    return (
        <Modal open={open} onClose={onClose} title={t("coachNote")}>
            {note ? (
                <div className="flex flex-col gap-2 px-1 py-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                        <BookOpen className="w-4 h-4" />
                        <span className="text-xs font-semibold">{t("coachInstructions")}</span>
                    </div>
                    <p dir="auto" className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{note}</p>
                </div>
            ) : (
                <p className="text-sm text-muted-foreground text-center py-8">{t("noCoachNote")}</p>
            )}
        </Modal>
    );
}
