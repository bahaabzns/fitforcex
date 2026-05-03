"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================
// Modal — A reusable modal dialog component
// =============================================================
// Props:
//   open     — boolean
//   onClose  — () => void
//   title    — string
//   children — JSX
//   wide     — boolean: use max-w-2xl instead of max-w-lg

export default function Modal({ open, onClose, title, children, wide }) {
    const dialogRef = useRef(null);

    useEffect(() => {
        document.body.style.overflow = open ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        const handleKey = (e) => { if (e.key === "Escape") onClose(); };
        document.addEventListener("keydown", handleKey);
        return () => document.removeEventListener("keydown", handleKey);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/80 overflow-y-auto py-8 px-4"
            onClick={onClose}
        >
            <div
                ref={dialogRef}
                className={cn(
                    "relative bg-background border border-border rounded-lg w-full shadow-xl my-auto",
                    wide ? "max-w-2xl" : "max-w-lg"
                )}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                    <h2 className="text-lg font-semibold text-foreground">{title}</h2>
                    <button
                        onClick={onClose}
                        className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring p-1"
                    >
                        <X className="h-4 w-4" aria-hidden="true" />
                        <span className="sr-only">Close</span>
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
