"use client";

import { Pencil, Trash2 } from "lucide-react";
import MessageBubbleContent from "@/app/components/MessageBubbleContent";

// A fixed pixel cap (not a %) so the same message wraps identically in the
// coach messenger's wide chat panel and the client portal's narrower one —
// a percentage-based max-width made the two surfaces wrap inconsistently
// since they size their chat panels very differently.
const BUBBLE_MAX_WIDTH = "max-w-[420px]";

/**
 * One message bubble + its hover-revealed edit/delete actions. Shared by the
 * coach messenger and the client portal chat so both render identically —
 * same wrap width, same colors, same overflow handling for image/file content.
 *
 * @param {object} message
 * @param {(key: string) => string} t
 * @param {boolean} isOwn        true for the viewer's own messages (colored bubble, right-aligned)
 * @param {string} radiusClass   tailwind radius classes for this bubble's position in its group
 * @param {boolean} canManage    show edit/delete actions (only ever true for the viewer's own messages)
 * @param {(message: object) => void} onEditStart
 * @param {(id: string) => void} onDelete
 */
export default function MessageRow({ message, t, isOwn, radiusClass, canManage, onEditStart, onDelete }) {
    return (
        <div className={`flex items-end gap-1 group/msg ${isOwn ? "flex-row-reverse" : ""}`}>
            <div
                className={`min-w-0 max-w-full overflow-hidden ${BUBBLE_MAX_WIDTH} px-4 py-2 text-sm leading-relaxed wrap-break-word ${
                    isOwn
                        ? `bg-primary text-primary-foreground ${radiusClass}`
                        : `bg-default text-foreground ${radiusClass}`
                }`}
            >
                <MessageBubbleContent message={message} t={t} isOwn={isOwn} />
            </div>
            {canManage && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity shrink-0">
                    {message.type === "text" && !message.deleted_at && (
                        <button
                            type="button"
                            aria-label={t("editMessageLabel")}
                            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-default transition-colors"
                            onClick={() => onEditStart(message)}
                        >
                            <Pencil size={13} />
                        </button>
                    )}
                    <button
                        type="button"
                        aria-label={t("deleteMessageLabel")}
                        className="p-1 rounded-full text-muted-foreground hover:text-destructive hover:bg-default transition-colors"
                        onClick={() => onDelete(message.id)}
                    >
                        <Trash2 size={13} />
                    </button>
                </div>
            )}
        </div>
    );
}
