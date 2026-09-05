"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import api from "@/lib/axios";
import { Skeleton } from "@heroui/react/skeleton";
import { Avatar } from "@heroui/react/avatar";
import { ScrollShadow } from "@/app/components/ScrollShadow";
import { Card } from "@heroui/react/card";
import { Separator } from "@heroui/react/separator";
import { Send } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import MessageComposer from "@/app/components/MessageComposer";
import MessageRow from "@/app/components/MessageRow";
import EmptyState from "@/app/components/EmptyState";
import { usePageTitle } from "@/hooks/usePageTitle";
import TriggerInsightBanner from "@/app/components/insights/TriggerInsightBanner";
import { getDateLabel } from "@/utils/date";

const POLL_INTERVAL_MS = 5000;

const scrollbarCls = "[&::-webkit-scrollbar]:w-0 [scrollbar-width:none]";

function formatGroupTime(ts, locale) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

// Groups consecutive messages from the same sender within a 5-minute window.
function buildSegments(messages, locale, dayLabels) {
    const groups = [];
    messages.forEach(msg => {
        const last = groups[groups.length - 1];
        const sameSender = last && last.sender_type === msg.sender_type;
        const withinWindow = last &&
            (new Date(msg.created_at) - new Date(last.messages[last.messages.length - 1].created_at)) < 5 * 60 * 1000;
        if (sameSender && withinWindow) {
            last.messages.push(msg);
        } else {
            groups.push({ sender_type: msg.sender_type, messages: [msg] });
        }
    });

    const segments = [];
    let lastDate = null;
    groups.forEach(group => {
        const dateStr = new Date(group.messages[0].created_at).toDateString();
        if (dateStr !== lastDate) {
            segments.push({ type: 'date', label: getDateLabel(group.messages[0].created_at, locale, dayLabels) });
            lastDate = dateStr;
        }
        segments.push({ type: 'group', group });
    });
    return segments;
}

// Matches the coach messenger's bubble radius exactly — same shape language
// on both sides of the same conversation.
function bubbleRadius(isOwn, pos) {
    if (isOwn) {
        if (pos === 'solo')   return 'rounded-2xl rounded-br-sm';
        if (pos === 'first')  return 'rounded-2xl rounded-br-sm';
        if (pos === 'middle') return 'rounded-l-2xl rounded-r-lg';
        if (pos === 'last')   return 'rounded-l-2xl rounded-tr-2xl rounded-br-sm';
    } else {
        if (pos === 'solo')   return 'rounded-2xl rounded-bl-sm';
        if (pos === 'first')  return 'rounded-2xl rounded-bl-sm';
        if (pos === 'middle') return 'rounded-r-2xl rounded-l-lg';
        if (pos === 'last')   return 'rounded-r-2xl rounded-tl-2xl rounded-bl-sm';
    }
    return 'rounded-2xl';
}

export default function ClientMessagesPage() {
    const t = useTranslations('portal.messages');
    const locale = useLocale();
    usePageTitle(t('title'));
    const [messages, setMessages] = useState([]);
    const [editingMessage, setEditingMessage] = useState(null);
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);
    const pollRef = useRef(null);
    const prevMessageCountRef = useRef(0);

    const fetchMessages = useCallback(async () => {
        try {
            const res = await api.get('/api/client-portal/messages');
            setMessages(res.data.messages);
        } catch {
            // silent
        }
    }, []);

    useEffect(() => { fetchMessages().finally(() => setLoading(false)); }, [fetchMessages]);

    useEffect(() => {
        pollRef.current = setInterval(fetchMessages, POLL_INTERVAL_MS);
        return () => clearInterval(pollRef.current);
    }, [fetchMessages]);

    useEffect(() => {
        // The 5s poll refetches and replaces `messages` with a new array even when
        // nothing changed — only scroll when a message was actually added, so
        // reading old history isn't interrupted by a forced scroll-to-bottom.
        if (messages.length > prevMessageCountRef.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
        prevMessageCountRef.current = messages.length;
    }, [messages]);

    // These intentionally don't catch — MessageComposer keeps the draft/attachment/
    // edit state intact on failure so the user can retry.
    const handleSendText = async (body) => {
        const res = await api.post('/api/client-portal/messages', { body });
        setMessages(prev => [...prev, res.data]);
    };

    const handleSendAttachment = async (attachment, caption) => {
        const formData = new FormData();
        formData.append('file', attachment.file, attachment.name);
        if (caption) formData.append('body', caption);
        if (attachment.durationSeconds) formData.append('durationSeconds', String(attachment.durationSeconds));
        const res = await api.post('/api/client-portal/messages/attachments', formData);
        setMessages(prev => [...prev, res.data]);
    };

    const handleSaveEdit = async (messageId, body) => {
        const res = await api.patch(`/api/client-portal/messages/${messageId}`, { body });
        setMessages(prev => prev.map(m => m.id === messageId ? res.data : m));
        setEditingMessage(null);
    };

    const handleDeleteMessage = async (messageId) => {
        if (!confirm(t('deleteConfirm'))) return;
        try {
            const res = await api.delete(`/api/client-portal/messages/${messageId}`);
            setMessages(prev => prev.map(m => m.id === messageId ? res.data : m));
            if (editingMessage?.id === messageId) setEditingMessage(null);
        } catch { /* silent */ }
    };

    const segments = buildSegments(messages, locale, { today: t('today'), yesterday: t('yesterday') });

    return (
        <div className="flex flex-col h-[calc(100dvh-120px)] p-3">
            <div className="shrink-0">
                <TriggerInsightBanner
                    triggerEvent="first_message_sent_by_client"
                    checkUrl="/api/client-portal/prompts/for-trigger/first_message_sent_by_client"
                    respondUrlPrefix="/api/client-portal/prompts"
                    dismissUrlPrefix="/api/client-portal/prompts"
                />
            </div>
            <Card className="w-full flex-1 min-h-0 p-0 gap-0">

                {/* Header */}
                <Card.Header className="flex-row items-center gap-3 px-4 py-3 shrink-0">
                    <Avatar size="sm" color="primary" className="shrink-0">
                        <Avatar.Fallback>C</Avatar.Fallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">
                            {t('coachFallback')}
                        </p>
                        <p className="text-xs text-muted-foreground">{t('subtitle')}</p>
                    </div>
                </Card.Header>

                {/* Messages */}
                <Card.Content className="overflow-hidden min-h-0 p-0">
                    <ScrollShadow hideScrollBar className={`h-full overflow-y-auto px-5 pt-2 pb-4 flex flex-col gap-1 ${scrollbarCls}`}>
                        {loading ? (
                            Array.from({ length: 4 }).map((_, i) => (
                                <div key={i} className={`flex mb-2 ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                                    <Skeleton className="h-10 w-52 rounded-2xl" />
                                </div>
                            ))
                        ) : messages.length === 0 ? (
                            <div className="flex-1 flex items-center justify-center">
                                <EmptyState
                                    variant="firstTime"
                                    icon={Send}
                                    title={t('emptyTitle')}
                                    description={t('emptyHint')}
                                />
                            </div>
                        ) : (
                            segments.map((seg, si) => {
                                if (seg.type === 'date') {
                                    return (
                                        <div key={`date-${si}`} className="flex items-center gap-3 my-3">
                                            <Separator className="flex-1" />
                                            <span className="text-[11px] text-muted-foreground font-medium px-2">{seg.label}</span>
                                            <Separator className="flex-1" />
                                        </div>
                                    );
                                }

                                const { group } = seg;
                                const isOwn = group.sender_type === 'client';
                                const count = group.messages.length;

                                return (
                                    <div key={`group-${si}`} className={`flex flex-col gap-0.5 mb-3 ${isOwn ? 'items-end' : 'items-start'}`}>
                                        {group.messages.map((msg, mi) => {
                                            const pos = count === 1 ? 'solo'
                                                : mi === 0 ? 'first'
                                                : mi === count - 1 ? 'last'
                                                : 'middle';
                                            return (
                                                <MessageRow
                                                    key={msg.id}
                                                    message={msg}
                                                    t={t}
                                                    isOwn={isOwn}
                                                    radiusClass={bubbleRadius(isOwn, pos)}
                                                    canManage={isOwn && !msg.deleted_at}
                                                    onEditStart={m => setEditingMessage({ id: m.id, body: m.body || '' })}
                                                    onDelete={handleDeleteMessage}
                                                />
                                            );
                                        })}
                                        <span className="text-[11px] text-muted-foreground mt-0.5 px-1">
                                            {formatGroupTime(group.messages[group.messages.length - 1].created_at, locale)}
                                        </span>
                                    </div>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </ScrollShadow>
                </Card.Content>

                {/* Reply bar */}
                <Card.Footer className="px-4 pb-4 pt-1 shrink-0">
                    <MessageComposer
                        t={t}
                        editingMessage={editingMessage}
                        onCancelEdit={() => setEditingMessage(null)}
                        onSaveEdit={handleSaveEdit}
                        onSendText={handleSendText}
                        onSendAttachment={handleSendAttachment}
                    />
                </Card.Footer>
            </Card>
        </div>
    );
}
