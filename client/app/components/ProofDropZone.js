'use client';

import { useRef, useState } from "react";
import { UploadCloud, X } from "lucide-react";
import { Button } from "@heroui/react/button";

// Human-readable file size.
function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Drag-and-drop single-file upload used across modals (proof of payment, etc.).
 * Presentational: labels are passed in so it stays namespace-agnostic and reusable.
 *
 *   <ProofDropZone file={file} onChange={setFile}
 *     label={t('proofDropLabel')} hint={t('proofDropHint')} removeLabel={t('removeProof')} />
 */
export default function ProofDropZone({ file, onChange, accept = "image/*,.pdf", label, hint, removeLabel }) {
    const inputRef = useRef(null);
    const [dragOver, setDragOver] = useState(false);

    function pickFirst(fileList) {
        const picked = fileList && fileList[0];
        if (picked) onChange(picked);
    }

    if (file) {
        const ext = (file.name.split(".").pop() || "file").toUpperCase();
        return (
            <div className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-[10px] font-semibold text-primary">
                    {ext.slice(0, 4)}
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm text-foreground">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{formatFileSize(file.size)}</span>
                </div>
                <Button
                    type="button"
                    variant="ghost"
                    isIconOnly
                    aria-label={removeLabel}
                    className="shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => onChange(null)}
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>
        );
    }

    return (
        <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); inputRef.current?.click(); } }}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); pickFirst(e.dataTransfer.files); }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-3 py-4 text-center transition-colors ${
                dragOver ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/60"
            }`}
        >
            <UploadCloud className="h-5 w-5 text-muted-foreground" />
            <span className="text-xs font-medium text-foreground">{label}</span>
            <span className="text-[11px] text-muted-foreground">{hint}</span>
            <input
                ref={inputRef}
                type="file"
                accept={accept}
                className="hidden"
                onChange={(e) => pickFirst(e.target.files)}
            />
        </div>
    );
}
