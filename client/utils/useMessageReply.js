"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const HIGHLIGHT_MS = 1600;

/**
 * Reply-to-message state shared by the coach messenger and the client portal chat:
 * which message is being replied to, and "jump to the quoted original" with a brief
 * highlight.
 *
 * @param {{ current: HTMLElement | null }} listEndRef  the empty element at the end of the
 *   message list — its parent is the scroll container (same convention the pages already use
 *   for scroll-to-bottom, which scrolls only the list and never the page).
 */
export function useMessageReply(listEndRef) {
    const [replyingTo, setReplyingTo] = useState(null);
    const [highlightedId, setHighlightedId] = useState(null);
    const highlightTimer = useRef(null);

    useEffect(() => () => clearTimeout(highlightTimer.current), []);

    const startReply = useCallback((message) => setReplyingTo(message), []);
    const cancelReply = useCallback(() => setReplyingTo(null), []);

    const jumpToMessage = useCallback((messageId) => {
        const list = listEndRef.current?.parentElement;
        const target = list?.querySelector(`[data-message-id="${messageId}"]`);
        if (!list || !target) return;

        const listRect = list.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const centeredTop = list.scrollTop + (targetRect.top - listRect.top) - (list.clientHeight - targetRect.height) / 2;
        list.scrollTo({ top: Math.max(0, centeredTop), behavior: "smooth" });

        setHighlightedId(messageId);
        clearTimeout(highlightTimer.current);
        highlightTimer.current = setTimeout(() => setHighlightedId(null), HIGHLIGHT_MS);
    }, [listEndRef]);

    return { replyingTo, startReply, cancelReply, highlightedId, jumpToMessage };
}
