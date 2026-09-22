"use client";

import { useTranslations, useLocale } from "next-intl";
import Modal from "@/app/components/Modal";
import { getLocalizedField } from "@/utils/localization";

// Read-only exercise instructions pulled from the exercise library, opened
// from the instructions icon beside the Progress button — shared by the day
// preview and the Training Mode session card so both read from the same
// source instead of duplicating the modal.
export default function ExerciseInstructionsModal({ open, onClose, exercise }) {
    const t = useTranslations("portal.training");
    const locale = useLocale();
    const instructions = exercise ? getLocalizedField(exercise, "instructions", locale).trim() : "";

    return (
        <Modal open={open} onClose={onClose} title={t("instructions")}>
            {instructions ? (
                <p dir="auto" className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">{instructions}</p>
            ) : (
                <p className="text-sm text-muted-foreground text-center py-8">{t("noInstructions")}</p>
            )}
        </Modal>
    );
}
