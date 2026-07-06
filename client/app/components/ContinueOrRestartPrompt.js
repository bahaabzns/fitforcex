"use client";

import { useTranslations } from "next-intl";
import Modal, { ModalFooter } from "@/app/components/Modal";
import { Button } from "@heroui/react/button";

/**
 * Package Lifecycle Phase 3b — appears only when saving an edit to a plan
 * that is currently active (Business Logic §12.5). Not dismissible without
 * a choice: closing without picking leaves the save incomplete, matching
 * the plan's edge-case rule that this prompt is never optional once shown.
 */
export default function ContinueOrRestartPrompt({ open, endDateLabel, onContinue, onRestart, submitting }) {
    const t = useTranslations("planActivation");

    return (
        <Modal open={open} onClose={() => {}} title={t("restartPromptTitle")}>
            <div className="flex flex-col gap-4 px-1 py-1">
                <p className="text-sm text-muted-foreground">{t("restartPromptBody")}</p>
                {endDateLabel && (
                    <p className="text-xs text-muted-foreground bg-secondary rounded-lg px-3 py-2">
                        {t("restartConsequence", { date: endDateLabel })}
                    </p>
                )}
                <ModalFooter>
                    <Button type="button" variant="outline" onClick={onContinue} isDisabled={submitting}>
                        {t("continueRemaining")}
                    </Button>
                    <Button type="button" variant="primary" onClick={onRestart} isDisabled={submitting}>
                        {t("restartDuration")}
                    </Button>
                </ModalFooter>
            </div>
        </Modal>
    );
}
