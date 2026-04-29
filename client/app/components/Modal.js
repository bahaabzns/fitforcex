"use client";

import { useEffect, useRef } from "react";

// =============================================================
// Modal — A reusable modal dialog component
// =============================================================
//
// Props:
//   open     — boolean: whether the modal is visible
//   onClose  — () => void: called when backdrop or X is clicked
//   title    — string: modal heading text
//   children — JSX: modal body content
//   wide     — boolean: use wider max-width (max-w-2xl vs max-w-lg)

export default function Modal({ open, onClose, title, children, wide }) {
    const dialogRef = useRef(null);

    // Lock body scroll when modal is open
    useEffect(() => {
        if (open) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    // Close on Escape key
    useEffect(() => {
        if (!open) return;
        function handleKey(e) {
            if (e.key === "Escape") onClose();
        }
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm overflow-y-auto py-8 px-4"
            onClick={onClose}
        >
            <div
                ref={dialogRef}
                className={`bg-white border border-[#D2D2D7] rounded-2xl w-full ${
                    wide ? "max-w-2xl" : "max-w-lg"
                } shadow-xl animate-[fadeIn_150ms_ease-out] my-auto`}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-[#D2D2D7]">
                    <h2 className="text-lg font-semibold text-[#1D1D1F]">{title}</h2>
                    <button
                        onClick={onClose}
                        className="text-[#86868B] hover:text-[#1D1D1F] transition-colors p-1 rounded-lg hover:bg-[#F0F0F5]"
                    >
                        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5">
                    {children}
                </div>
            </div>
        </div>
    );
}
