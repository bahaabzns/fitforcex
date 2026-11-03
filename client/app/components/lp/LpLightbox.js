'use client';

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

const LightboxContext = createContext(() => {});

// Opens any screenshot at full size in a native <dialog>: Esc, the close button or a click
// outside the picture all close it, and focus returns to where it was.
export function useLpLightbox() {
    return useContext(LightboxContext);
}

export function LpLightboxProvider({ children }) {
    const t = useTranslations("lp.ui");
    const [shot, setShot] = useState(null);
    const dialogRef = useRef(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (shot && !dialog.open) dialog.showModal();
        if (!shot && dialog.open) dialog.close();
    }, [shot]);

    const open = useMemo(() => (next) => setShot(next), []);

    return (
        <LightboxContext.Provider value={open}>
            {children}
            <dialog
                ref={dialogRef}
                className="lp-lightbox"
                aria-label={shot?.alt}
                onClose={() => setShot(null)}
                onClick={(event) => { if (event.target === event.currentTarget) setShot(null); }}
            >
                <button type="button" className="lp-lightbox__close" onClick={() => setShot(null)} aria-label={t("close")}>
                    <X size={22} aria-hidden="true" />
                </button>
                {shot && <Image src={shot.src} alt={shot.alt} width={shot.w} height={shot.h} unoptimized />}
            </dialog>
        </LightboxContext.Provider>
    );
}
