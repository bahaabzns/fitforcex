"use client";

import { FileText, Mic, Image as ImageIcon } from "lucide-react";

/**
 * The quoted original shown on top of a reply bubble and in the composer's
 * "replying to" strip. Text shows its first lines; images show a thumbnail;
 * voice notes and files show a short label. A deleted original shows only the
 * deleted notice (the server has already stripped its content).
 *
 * @param {object} replyTo   the quoted message: id, sender_type, type, body, attachment_name,
 *   attachment_url, deleted_at
 * @param {{ team: string, client: string }} senderNames   display name per sender_type
 * @param {(key: string) => string} t   needs: messageDeleted, replyPhoto, replyVoice, replyFile
 * @param {boolean} [isOwn]   rendered on the viewer's colored bubble — adjusts contrast
 * @param {(messageId: string) => void} [onClick]   makes the quote tappable (jump to original)
 */
export default function ReplyQuote({ replyTo, senderNames, t, isOwn = false, onClick }) {
    const isDeleted = Boolean(replyTo.deleted_at);
    const showThumbnail = !isDeleted && replyTo.type === "image" && replyTo.attachment_url;

    const surfaceCls = isOwn
        ? "bg-black/15 border-primary-foreground/70"
        : "bg-black/5 dark:bg-white/10 border-primary";
    const className = `flex items-stretch gap-2 w-full min-w-0 text-start rounded-lg border-s-4 px-2 py-1.5 mb-1.5 text-xs ${surfaceCls} ${onClick ? "cursor-pointer" : ""}`;

    const content = (
        <>
            <div className="flex-1 min-w-0">
                <p className={`font-semibold truncate ${isOwn ? "" : "text-primary"}`}>
                    {senderNames[replyTo.sender_type] ?? ""}
                </p>
                <p className="flex items-center gap-1 opacity-80 min-w-0">
                    <QuoteSummary replyTo={replyTo} isDeleted={isDeleted} t={t} />
                </p>
            </div>
            {showThumbnail && (
                <img src={replyTo.attachment_url} alt="" className="h-10 w-10 rounded-md object-cover shrink-0" />
            )}
        </>
    );

    if (!onClick) return <div className={className}>{content}</div>;
    return (
        <button type="button" className={className} onClick={() => onClick(replyTo.id)}>
            {content}
        </button>
    );
}

function QuoteSummary({ replyTo, isDeleted, t }) {
    if (isDeleted) return <span className="italic truncate">{t("messageDeleted")}</span>;

    if (replyTo.type === "image") {
        return (
            <>
                <ImageIcon size={12} className="shrink-0" />
                <span className="truncate">{replyTo.body || t("replyPhoto")}</span>
            </>
        );
    }
    if (replyTo.type === "voice") {
        return (
            <>
                <Mic size={12} className="shrink-0" />
                <span className="truncate">{t("replyVoice")}</span>
            </>
        );
    }
    if (replyTo.type === "file") {
        return (
            <>
                <FileText size={12} className="shrink-0" />
                <span className="truncate">{replyTo.attachment_name || t("replyFile")}</span>
            </>
        );
    }
    return <span className="line-clamp-2 wrap-break-word">{replyTo.body}</span>;
}
