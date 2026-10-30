"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pencil, Trash2, Reply } from "lucide-react";
import MessageBubbleContent from "@/app/components/MessageBubbleContent";
import ReplyQuote from "@/app/components/ReplyQuote";

// A fixed pixel cap (not a %) so the same message wraps identically in the
// coach messenger's wide chat panel and the client portal's narrower one —
// a percentage-based max-width made the two surfaces wrap inconsistently
// since they size their chat panels very differently.
const BUBBLE_MAX_WIDTH = "max-w-[420px]";

const LONG_PRESS_MS = 450;
// Finger travel that turns a press into a scroll/swipe instead of a long-press.
const TOUCH_SLOP_PX = 8;
const SWIPE_TRIGGER_PX = 56;
const SWIPE_MAX_PX = 72;
// Taps on these keep their own behaviour (scrubbing audio, typing) — never start a gesture there.
const GESTURE_IGNORED_SELECTOR = "audio, video, input, textarea";
// Double-click must not hijack clicks that already mean something.
const DOUBLE_CLICK_IGNORED_SELECTOR = "a, button, audio, video, img";

/**
 * One message bubble + its hover-revealed reply/edit/delete actions. Shared by the
 * coach messenger and the client portal chat so both render identically —
 * same wrap width, same colors, same overflow handling for image/file content.
 *
 * Reply can be triggered by: the hover button, double-click (desktop), swipe toward
 * the reading direction, or long-press (touch) which opens a small action sheet.
 *
 * @param {object} message
 * @param {(key: string, values?: object) => string} t
 * @param {boolean} isOwn        true for the viewer's own messages (colored bubble, right-aligned)
 * @param {string} radiusClass   tailwind radius classes for this bubble's position in its group
 * @param {boolean} canManage    show edit/delete actions (only ever true for the viewer's own messages)
 * @param {(message: object) => void} onEditStart
 * @param {(id: string) => void} onDelete
 * @param {(message: object) => void} [onReply]   omit to disable replying
 * @param {(messageId: string) => void} [onJumpToMessage]   tapping the quote
 * @param {{ team: string, client: string }} [senderNames]   display name per sender_type for the quote
 * @param {boolean} [isHighlighted]   briefly flashed after a quote jumps here
 */
export default function MessageRow({
    message, t, isOwn, radiusClass, canManage, onEditStart, onDelete,
    onReply, onJumpToMessage, senderNames, isHighlighted = false,
}) {
    const canReply = Boolean(onReply) && !message.deleted_at;
    const { swipeOffset, sheetOpen, closeSheet, touchHandlers, consumeSuppressedClick } = useReplyGestures({
        enabled: canReply,
        onReply: () => onReply(message),
    });

    function handleDoubleClick(e) {
        if (!canReply || e.target.closest(DOUBLE_CLICK_IGNORED_SELECTOR)) return;
        window.getSelection()?.removeAllRanges();
        onReply(message);
    }

    return (
        <div
            data-message-id={message.id}
            className={`relative flex items-end gap-1 group/msg ${isOwn ? "flex-row-reverse" : ""}`}
        >
            {swipeOffset > 0 && (
                <span
                    aria-hidden="true"
                    className="absolute start-0 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                    style={{ opacity: Math.min(1, swipeOffset / SWIPE_TRIGGER_PX) }}
                >
                    <Reply size={16} />
                </span>
            )}
            <div
                {...touchHandlers}
                onDoubleClick={handleDoubleClick}
                onClickCapture={e => { if (consumeSuppressedClick()) { e.preventDefault(); e.stopPropagation(); } }}
                onContextMenu={e => { if (sheetOpen) e.preventDefault(); }}
                style={{
                    transform: swipeOffset ? `translateX(calc(${swipeOffset}px * var(--reply-dir, 1)))` : undefined,
                    transition: swipeOffset ? "none" : "transform 180ms ease-out",
                    touchAction: canReply ? "pan-y" : undefined,
                }}
                className={`min-w-0 max-w-full overflow-hidden ${BUBBLE_MAX_WIDTH} px-4 py-2 text-sm leading-relaxed wrap-break-word rtl:[--reply-dir:-1] transition-shadow ${
                    isHighlighted ? "ring-2 ring-primary shadow-lg" : ""
                } ${
                    isOwn
                        ? `bg-primary text-primary-foreground ${radiusClass}`
                        : `bg-default text-foreground ${radiusClass}`
                }`}
            >
                {message.reply_to && !message.deleted_at && (
                    <ReplyQuote
                        replyTo={message.reply_to}
                        senderNames={senderNames ?? {}}
                        t={t}
                        isOwn={isOwn}
                        onClick={onJumpToMessage}
                    />
                )}
                <MessageBubbleContent message={message} t={t} isOwn={isOwn} />
            </div>
            {(canReply || canManage) && (
                <div className="flex items-center gap-0.5 opacity-0 group-hover/msg:opacity-100 transition-opacity shrink-0">
                    {canReply && (
                        <button
                            type="button"
                            aria-label={t("replyLabel")}
                            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-default transition-colors"
                            onClick={() => onReply(message)}
                        >
                            <Reply size={13} />
                        </button>
                    )}
                    {canManage && message.type === "text" && !message.deleted_at && (
                        <button
                            type="button"
                            aria-label={t("editMessageLabel")}
                            className="p-1 rounded-full text-muted-foreground hover:text-foreground hover:bg-default transition-colors"
                            onClick={() => onEditStart(message)}
                        >
                            <Pencil size={13} />
                        </button>
                    )}
                    {canManage && (
                        <button
                            type="button"
                            aria-label={t("deleteMessageLabel")}
                            className="p-1 rounded-full text-muted-foreground hover:text-destructive hover:bg-default transition-colors"
                            onClick={() => onDelete(message.id)}
                        >
                            <Trash2 size={13} />
                        </button>
                    )}
                </div>
            )}
            {sheetOpen && (
                <ReplyActionSheet
                    label={t("replyLabel")}
                    onReply={() => { closeSheet(); onReply(message); }}
                    onClose={closeSheet}
                />
            )}
        </div>
    );
}

/**
 * Touch gestures on a bubble: long-press opens the action sheet, a swipe toward
 * the reading direction replies. Only touch input is handled — mouse users get the
 * hover button and double-click instead.
 */
function useReplyGestures({ enabled, onReply }) {
    const [swipeOffset, setSwipeOffset] = useState(0);
    const [sheetOpen, setSheetOpen] = useState(false);
    const gesture = useRef(null);
    const longPressTimer = useRef(null);
    const suppressNextClick = useRef(false);

    useEffect(() => () => clearTimeout(longPressTimer.current), []);

    function onTouchStart(e) {
        if (!enabled || e.touches.length !== 1 || e.target.closest(GESTURE_IGNORED_SELECTOR)) return;
        const point = e.touches[0];
        gesture.current = { x: point.clientX, y: point.clientY, intent: null };
        clearTimeout(longPressTimer.current);
        longPressTimer.current = setTimeout(() => {
            if (!gesture.current || gesture.current.intent) return;
            gesture.current.intent = "longpress";
            suppressNextClick.current = true;
            setSheetOpen(true);
        }, LONG_PRESS_MS);
    }

    function onTouchMove(e) {
        const g = gesture.current;
        if (!g || g.intent === "longpress") return;
        const point = e.touches[0];
        const deltaX = point.clientX - g.x;
        const deltaY = point.clientY - g.y;

        if (!g.intent) {
            if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < TOUCH_SLOP_PX) return;
            clearTimeout(longPressTimer.current);
            const isRtl = document.documentElement.dir === "rtl";
            const towardReading = isRtl ? deltaX < 0 : deltaX > 0;
            g.intent = Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && towardReading ? "swipe" : "scroll";
            if (g.intent === "swipe") g.direction = isRtl ? -1 : 1;
        }
        if (g.intent !== "swipe") return;

        // This touch is now ours: keep the messenger's panel-swipe (back to the list) from also reacting.
        e.stopPropagation();
        setSwipeOffset(Math.min(SWIPE_MAX_PX, Math.max(0, deltaX * g.direction)));
    }

    function onTouchEnd(e) {
        clearTimeout(longPressTimer.current);
        const g = gesture.current;
        gesture.current = null;
        if (!g) return;
        if (g.intent === "swipe") {
            e.stopPropagation();
            suppressNextClick.current = true;
            const triggered = swipeOffset >= SWIPE_TRIGGER_PX;
            setSwipeOffset(0);
            if (triggered) onReply();
        }
    }

    return {
        swipeOffset,
        sheetOpen,
        closeSheet: () => setSheetOpen(false),
        // The click a browser fires after a long-press/swipe must not open links or previews.
        consumeSuppressedClick: () => {
            const wasSuppressed = suppressNextClick.current;
            suppressNextClick.current = false;
            return wasSuppressed;
        },
        touchHandlers: { onTouchStart, onTouchMove, onTouchEnd, onTouchCancel: onTouchEnd },
    };
}

// Portaled to <body> so the scrolling message list can't clip it.
function ReplyActionSheet({ label, onReply, onClose }) {
    return createPortal(
        <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center p-4" onClick={onClose}>
            <div
                role="menu"
                className="w-full max-w-sm rounded-2xl bg-background border border-border shadow-xl p-1"
                onClick={e => e.stopPropagation()}
            >
                <button
                    type="button"
                    role="menuitem"
                    className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm text-foreground hover:bg-default transition-colors"
                    onClick={onReply}
                >
                    <Reply size={16} />
                    {label}
                </button>
            </div>
        </div>,
        document.body,
    );
}
