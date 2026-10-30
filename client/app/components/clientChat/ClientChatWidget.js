"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Avatar } from "@heroui/react/avatar";
import { MessageCircle, Minus, ExternalLink } from "lucide-react";
import api from "@/lib/axios";
import { getSocket } from "@/lib/socket";
import MessageList from "@/app/components/MessageList";
import MessageComposer from "@/app/components/MessageComposer";
import { useMessageReply } from "@/utils/useMessageReply";

const MAX_BADGE_COUNT = 9;
const THREADS_REFRESH_DEBOUNCE_MS = 300;
const THREADS_POLL_MS = 30000;

function getInitials(fname, lname) {
    return `${fname?.[0] ?? ''}${lname?.[0] ?? ''}`.toUpperCase();
}

// Floating chat for the client currently open in the coach app. Reuses the
// Messenger's list/composer/row components and its endpoints; the server needs
// no changes (getThreads already returns one row per client with unread_count).
export default function ClientChatWidget({ clientId }) {
    const { workspaceSlug } = useParams();
    const t = useTranslations('messenger');
    const tChat = useTranslations('clientChat');
    const locale = useLocale();

    const [row, setRow] = useState(null);
    const [open, setOpen] = useState(false);
    const [messages, setMessages] = useState([]);
    const [loading, setLoading] = useState(false);
    const [editingMessage, setEditingMessage] = useState(null);
    const [unavailable, setUnavailable] = useState(false);
    const messagesEndRef = useRef(null);
    const prevCountRef = useRef(0);
    const refreshTimerRef = useRef(null);
    const { replyingTo, startReply, cancelReply, highlightedId, jumpToMessage } = useMessageReply(messagesEndRef);

    const threadId = row?.id ?? null;

    const fetchRow = useCallback(async () => {
        try {
            const res = await api.get('/api/messenger/threads');
            setRow(res.data.find(r => r.client_id === clientId) ?? null);
            setUnavailable(false);
        } catch { setUnavailable(true); }
    }, [clientId]);

    // Opening a thread's messages marks them read server-side, so the row is
    // refetched right after to drop the badge to zero.
    const fetchMessages = useCallback(async (id) => {
        if (!id) return;
        try {
            const res = await api.get(`/api/messenger/threads/${id}/messages`);
            setMessages(res.data);
            fetchRow();
        } catch { /* silent */ }
    }, [fetchRow]);

    useEffect(() => { fetchRow(); }, [fetchRow]);

    useEffect(() => {
        const interval = setInterval(fetchRow, THREADS_POLL_MS);
        return () => clearInterval(interval);
    }, [fetchRow]);

    useEffect(() => {
        if (!threadId) return;
        if (!open) return;
        setLoading(true);
        fetchMessages(threadId).finally(() => setLoading(false));
    }, [open, threadId, fetchMessages]);

    useEffect(() => {
        const socket = getSocket();
        const handleNewMessage = (payload) => {
            clearTimeout(refreshTimerRef.current);
            refreshTimerRef.current = setTimeout(fetchRow, THREADS_REFRESH_DEBOUNCE_MS);
            if (open && payload?.threadId && payload.threadId === threadId) fetchMessages(threadId);
        };
        const handleReconnect = () => {
            fetchRow();
            if (open) fetchMessages(threadId);
        };
        socket.on('new_message', handleNewMessage);
        socket.on('connect', handleReconnect);
        return () => {
            clearTimeout(refreshTimerRef.current);
            socket.off('new_message', handleNewMessage);
            socket.off('connect', handleReconnect);
        };
    }, [open, threadId, fetchRow, fetchMessages]);

    // Scroll only when a message was added, so reading history isn't interrupted.
    useEffect(() => {
        if (messages.length > prevCountRef.current) {
            const list = messagesEndRef.current?.parentElement;
            list?.scrollTo({ top: list.scrollHeight, behavior: 'smooth' });
        }
        prevCountRef.current = messages.length;
    }, [messages]);

    // A client row exists before any conversation does (threadId null) —
    // create the thread lazily on first send, as the Messenger page does.
    const ensureThreadId = async () => {
        if (threadId) return threadId;
        const res = await api.post('/api/messenger/threads', { clientId });
        return res.data.id;
    };

    // Intentionally no catch — MessageComposer keeps the draft intact on failure.
    const handleSendText = async (body, replyToId) => {
        const id = await ensureThreadId();
        const res = await api.post(`/api/messenger/threads/${id}/messages`, { body, replyToId });
        setMessages(prev => [...prev, res.data]);
        fetchRow();
    };

    const handleSendAttachment = async (attachment, caption, replyToId) => {
        const id = await ensureThreadId();
        const formData = new FormData();
        formData.append('file', attachment.file, attachment.name);
        if (caption) formData.append('body', caption);
        if (replyToId) formData.append('replyToId', replyToId);
        if (attachment.durationSeconds) formData.append('durationSeconds', String(attachment.durationSeconds));
        const res = await api.post(`/api/messenger/threads/${id}/attachments`, formData);
        setMessages(prev => [...prev, res.data]);
        fetchRow();
    };

    const handleSaveEdit = async (messageId, body) => {
        const res = await api.patch(`/api/messenger/threads/${threadId}/messages/${messageId}`, { body });
        setMessages(prev => prev.map(m => m.id === messageId ? res.data : m));
        setEditingMessage(null);
    };

    const handleDeleteMessage = async (messageId) => {
        if (!confirm(t('deleteConfirm'))) return;
        try {
            const res = await api.delete(`/api/messenger/threads/${threadId}/messages/${messageId}`);
            setMessages(prev => prev.map(m => m.id === messageId ? res.data : m));
            if (editingMessage?.id === messageId) setEditingMessage(null);
            if (replyingTo?.id === messageId) cancelReply();
        } catch { /* silent */ }
    };

    if (unavailable || !row) return null;

    const clientName = `${row.fname ?? ''} ${row.lname ?? ''}`.trim();
    const senderNames = { team: t('replyYou'), client: clientName };
    const unread = row.unread_count || 0;

    if (!open) {
        return (
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={unread > 0 ? tChat('openWithUnread', { name: clientName, count: unread }) : tChat('open', { name: clientName })}
                className="fixed bottom-4 end-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform hover:scale-105 max-md:bottom-[calc(1rem+env(safe-area-inset-bottom))]"
            >
                <MessageCircle size={24} />
                {unread > 0 && (
                    <span className="absolute -top-1 -end-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-danger px-1 text-[11px] font-semibold text-danger-foreground">
                        {unread > MAX_BADGE_COUNT ? `${MAX_BADGE_COUNT}+` : unread}
                    </span>
                )}
            </button>
        );
    }

    const messengerHref = `/${workspaceSlug}/messenger${threadId ? `?threadId=${threadId}` : ''}`;

    return (
        <section
            role="dialog"
            aria-label={tChat('title', { name: clientName })}
            className="fixed z-40 flex flex-col overflow-hidden border border-separator bg-surface shadow-2xl max-md:inset-0 max-md:h-dvh md:bottom-4 md:end-4 md:h-[500px] md:max-h-[calc(100dvh-2rem)] md:w-[360px] md:rounded-2xl"
        >
            <header className="flex shrink-0 items-center gap-2 border-b border-separator px-3 py-2.5 max-md:pt-[calc(0.625rem+env(safe-area-inset-top))]">
                <Avatar size="sm">
                    <Avatar.Fallback>{getInitials(row.fname, row.lname)}</Avatar.Fallback>
                </Avatar>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{clientName}</span>
                <Link
                    href={messengerHref}
                    title={tChat('openInMessenger')}
                    aria-label={tChat('openInMessenger')}
                    className="rounded-full p-2 text-muted hover:bg-default"
                >
                    <ExternalLink size={16} />
                </Link>
                <button
                    type="button"
                    onClick={() => setOpen(false)}
                    title={tChat('minimize')}
                    aria-label={tChat('minimize')}
                    className="rounded-full p-2 text-muted hover:bg-default"
                >
                    <Minus size={18} />
                </button>
            </header>

            <div className="min-h-0 flex-1">
                <MessageList
                    className="px-3 pt-2 pb-3"
                    messages={messages}
                    loading={loading}
                    t={t}
                    locale={locale}
                    senderNames={senderNames}
                    endRef={messagesEndRef}
                    highlightedId={highlightedId}
                    onEditStart={m => { cancelReply(); setEditingMessage({ id: m.id, body: m.body || '' }); }}
                    onDelete={handleDeleteMessage}
                    onReply={m => { setEditingMessage(null); startReply(m); }}
                    onJumpToMessage={jumpToMessage}
                />
            </div>

            <footer className="shrink-0 px-3 pb-3 pt-1 max-md:pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
                <MessageComposer
                    t={t}
                    editingMessage={editingMessage}
                    onCancelEdit={() => setEditingMessage(null)}
                    onSaveEdit={handleSaveEdit}
                    onSendText={handleSendText}
                    onSendAttachment={handleSendAttachment}
                    replyingTo={replyingTo}
                    onCancelReply={cancelReply}
                    senderNames={senderNames}
                />
            </footer>
        </section>
    );
}
