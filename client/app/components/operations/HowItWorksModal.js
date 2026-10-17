"use client";

import { useTranslations } from "next-intl";
import { Button } from "@heroui/react/button";
import Modal from "@/app/components/Modal";

const SECTIONS = ["Waiting", "Limit", "Full", "Act"];

// The "how does this page work" explainer: four short answers, in plain words.
export default function HowItWorksModal({ onClose }) {
    const t = useTranslations("operations");
    return (
        <Modal open onClose={onClose} title={t("howTitle")}>
            <div className="flex flex-col gap-5">
                {SECTIONS.map((section) => (
                    <div key={section} className="flex flex-col gap-1">
                        <h3 className="text-sm font-semibold text-foreground">{t(`how${section}Title`)}</h3>
                        <p className="text-sm text-muted-foreground">{t(`how${section}Body`)}</p>
                    </div>
                ))}
                <div className="flex justify-end">
                    <Button variant="primary" onClick={onClose}>{t("howClose")}</Button>
                </div>
            </div>
        </Modal>
    );
}
