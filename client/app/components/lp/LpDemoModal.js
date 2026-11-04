'use client';

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { DEMO_VIDEO_ID } from "@/lib/landingConfig";

// The demo video opens in a modal, so the page itself stays short. The player is only mounted
// while the modal is open: nothing from YouTube loads until someone asks for it.
export default function LpDemoModal({ open, onClose }) {
    const t = useTranslations("lp.demo");
    const dialogRef = useRef(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (open && !dialog.open) dialog.showModal();
        if (!open && dialog.open) dialog.close();
    }, [open]);

    return (
        <dialog
            ref={dialogRef}
            className="lp-modal"
            aria-label={t("videoTitle")}
            onClose={onClose}
            onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}
        >
            <button type="button" className="lp-modal__close" onClick={onClose} aria-label={t("close")}>
                <X size={22} aria-hidden="true" />
            </button>
            {open && (
                <div className="lp-modal__video">
                    <iframe
                        src={`https://www.youtube-nocookie.com/embed/${DEMO_VIDEO_ID}?rel=0&autoplay=1`}
                        title={t("videoTitle")}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                    />
                </div>
            )}
        </dialog>
    );
}
