"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import Modal from "@/app/components/Modal";
import { useTranslations } from "next-intl";

/**
 * Click-to-preview image. Renders a thumbnail (the `children` trigger, or the
 * image itself by default) and opens the full image in a small modal on click —
 * instead of navigating away / downloading it.
 *
 * PDFs can't be previewed inline, so for those the trigger opens the file in a
 * new tab as before.
 *
 *   <ImagePreview src={url} alt="Proof" isPdf={isPdf}>
 *     <img src={url} className="h-10 w-10 ..." />
 *   </ImagePreview>
 */
export default function ImagePreview({ src, alt = "", isPdf = false, title, triggerClassName = "", children }) {
    const t = useTranslations("common");
    const [open, setOpen] = useState(false);
    const [zoomed, setZoomed] = useState(false);
    if (!src) return null;

    const trigger = children ?? (
        <img src={src} alt={alt} className="h-10 w-10 rounded-md border border-border object-cover" loading="lazy" />
    );

    // PDFs: keep the open-in-new-tab behavior — no inline preview.
    if (isPdf) {
        return (
            <a href={src} target="_blank" rel="noreferrer" className={`inline-flex ${triggerClassName}`} title={title || alt}>
                {trigger}
            </a>
        );
    }

    function close() {
        setOpen(false);
        setZoomed(false);
    }

    return (
        <>
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); setOpen(true); }}
                className={`inline-flex cursor-pointer ${triggerClassName}`}
                aria-label={title || alt || "Preview image"}
                title={title || alt}
            >
                {trigger}
            </button>
            <Modal open={open} onClose={close} title={title || alt || ""}>
                <div className="flex flex-col items-center gap-3">
                    <div className={zoomed ? "w-full max-h-[70vh] overflow-auto rounded-lg" : "flex justify-center"}>
                        <img
                            src={src}
                            alt={alt}
                            onClick={() => setZoomed(z => !z)}
                            className={zoomed
                                ? "max-w-none rounded-lg cursor-zoom-out"
                                : "max-h-[60vh] max-w-full rounded-lg object-contain cursor-zoom-in"}
                        />
                    </div>
                    <a
                        href={src}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                    >
                        <ExternalLink size={13} />
                        {t("openOriginal")}
                    </a>
                </div>
            </Modal>
        </>
    );
}
