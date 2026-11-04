import { useEffect, useRef } from "react";
import { X } from "lucide-react";

// Full-screen view of one screenshot. Native <dialog> gives focus trapping and Escape for free.
export default function LpLightbox({ image, closeLabel, onClose }) {
    const dialogRef = useRef(null);

    useEffect(() => {
        const dialog = dialogRef.current;
        if (image && dialog && !dialog.open) dialog.showModal();
    }, [image]);

    if (!image) return null;
    return (
        <dialog ref={dialogRef} className="lp-lightbox" aria-label={image.alt} onClose={onClose} onClick={onClose}>
            <button type="button" className="lp-lightbox__close" onClick={onClose} aria-label={closeLabel}>
                <X size={24} aria-hidden="true" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={image.src} alt={image.alt} />
        </dialog>
    );
}
