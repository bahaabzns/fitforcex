"use client";

import { FileText } from "lucide-react";
import ImagePreview from "@/app/components/ImagePreview";

function formatFileSize(bytes) {
    if (bytes == null) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Renders a single message's content — text, image, voice note, or file —
 * plus the deleted/edited states. Shared by the coach messenger and the
 * client portal chat so both surfaces render every message type identically.
 *
 * @param {object} message   a message row (type, body, attachment_*, edited_at, deleted_at)
 * @param {(key: string) => string} t   translation function scoped to a namespace
 *   that has: messageDeleted, imageAlt, editedLabel
 * @param {boolean} [isOwn]  true when rendered on a colored/primary bubble —
 *   adjusts the file-chip contrast so it reads on both bubble colors
 */
export default function MessageBubbleContent({ message, t, isOwn = false }) {
    if (message.deleted_at) {
        return <span className="italic opacity-70">{t("messageDeleted")}</span>;
    }

    const fileChipCls = isOwn
        ? "bg-white/15 hover:bg-white/20"
        : "bg-black/5 hover:bg-black/10 dark:bg-white/10 dark:hover:bg-white/15";

    if (message.type === "image" && message.attachment_url) {
        return (
            <div className="flex flex-col gap-1.5 min-w-0">
                <ImagePreview src={message.attachment_url} alt={message.attachment_name || t("imageAlt")} title={message.attachment_name}>
                    <img
                        src={message.attachment_url}
                        alt={message.attachment_name || t("imageAlt")}
                        className="block max-w-64 max-h-64 w-auto h-auto rounded-lg object-cover"
                    />
                </ImagePreview>
                {message.body && <span>{message.body}</span>}
            </div>
        );
    }

    if (message.type === "voice" && message.attachment_url) {
        return (
            <div className="flex flex-col gap-1">
                <audio controls src={message.attachment_url} className="h-9 max-w-64" />
                {message.body && <span>{message.body}</span>}
            </div>
        );
    }

    if (message.type === "file" && message.attachment_url) {
        return (
            <div className="flex flex-col gap-1.5">
                <a
                    href={message.attachment_url}
                    target="_blank"
                    rel="noreferrer"
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${fileChipCls}`}
                >
                    <FileText size={18} className="shrink-0" />
                    <span className="flex-1 min-w-0 truncate text-sm">{message.attachment_name}</span>
                    {message.attachment_size != null && (
                        <span className="text-xs opacity-70 shrink-0">{formatFileSize(message.attachment_size)}</span>
                    )}
                </a>
                {message.body && <span>{message.body}</span>}
            </div>
        );
    }

    return (
        <>
            {message.body}
            {message.edited_at && <span className="text-[10px] opacity-60 ms-1.5">{t("editedLabel")}</span>}
        </>
    );
}
