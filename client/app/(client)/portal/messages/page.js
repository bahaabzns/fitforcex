"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import api from "@/lib/axios";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";
import { Avatar } from "@heroui/react/avatar";
import { Send } from "lucide-react";
import { useTranslations } from "next-intl";

const POLL_INTERVAL_MS = 5000;

const scrollbarCls =
    "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent " +
    "[&::-webkit-scrollbar-thumb]:bg-border/50 [&::-webkit-scrollbar-thumb]:rounded-full";

function formatGroupTime(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function getDateLabel(ts) {
    const date = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return 'Today';
    if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return date.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' });
}

// Groups consecutive messages from the same sender within a 5-minute window.
function buildSegments(messages) {
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
            segments.push({ type: 'date', label: getDateLabel(group.messages[0].created_at) });
            lastDate = dateStr;
        }
        segments.push({ type: 'group', group });
    });
    return segments;
}

function bubbleRadius(isClient, pos) {
    if (isClient) {
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
    const t = useTranslations('portal.sidebar');
    const [messages, setMessages] = useState([]);
    const [coachName, setCoachName] = useState('');
    const [draft, setDraft] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);
    const pollRef = useRef(null);

    const fetchMessages = useCallback(async () => {
        try {
            const res = await api.get('/api/client-portal/messages');
            setMessages(res.data.messages);
            if (res.data.coachName && !coachName) setCoachName(res.data.coachName);
        } catch {
            // silent
        }
    }, [coachName]);

    useEffect(() => { fetchMessages().finally(() => setLoading(false)); }, [fetchMessages]);

    useEffect(() => {
        pollRef.current = setInterval(fetchMessages, POLL_INTERVAL_MS);
        return () => clearInterval(pollRef.current);
    }, [fetchMessages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!draft.trim()) return;
        setSending(true);
        try {
            const res = await api.post('/api/client-portal/messages', { body: draft });
            setMessages(prev => [...prev, res.data]);
            setDraft('');
        } catch {
            // silent — message stays in draft
        } finally {
            setSending(false);
        }
    };

    const segments = buildSegments(messages);

    return (
        <div className="flex flex-col h-[calc(100dvh-120px)]">

            {/* Header */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-background shrink-0">
                <Avatar size="sm" color="primary" className="shrink-0">
                    <Avatar.Fallback>
                        {coachName ? coachName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) : 'C'}
                    </Avatar.Fallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">
                        {coachName || 'Your Coach'}
                    </p>
                    <p className="text-xs text-muted-foreground">Chat with your coach</p>
                </div>
            </div>

            {/* Messages */}
            <div className={`flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-1 ${scrollbarCls}`}>
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className={`flex mb-2 ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                            <Skeleton className="h-10 w-52 rounded-2xl" />
                        </div>
                    ))
                ) : messages.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center gap-2 mt-12 text-center px-6">
                        <div className="w-10 h-10 rounded-2xl bg-muted flex items-center justify-center mb-1">
                            <Send size={18} className="text-muted-foreground" />
                        </div>
                        <p className="text-sm font-medium text-foreground">No messages yet</p>
                        <p className="text-xs text-muted-foreground">Send a message to your coach below.</p>
                    </div>
                ) : (
                    segments.map((seg, si) => {
                        if (seg.type === 'date') {
                            return (
                                <div key={`date-${si}`} className="flex items-center gap-3 my-3">
                                    <div className="flex-1 h-px bg-border/50" />
                                    <span className="text-[11px] text-muted-foreground font-medium px-2">{seg.label}</span>
                                    <div className="flex-1 h-px bg-border/50" />
                                </div>
                            );
                        }

                        const { group } = seg;
                        const isClient = group.sender_type === 'client';
                        const count = group.messages.length;

                        return (
                            <div key={`group-${si}`} className={`flex flex-col gap-0.5 mb-3 ${isClient ? 'items-end' : 'items-start'}`}>
                                {group.messages.map((msg, mi) => {
                                    const pos = count === 1 ? 'solo'
                                        : mi === 0 ? 'first'
                                        : mi === count - 1 ? 'last'
                                        : 'middle';
                                    return (
                                        <div
                                            key={msg.id}
                                            className={`max-w-[78%] px-4 py-2.5 text-sm leading-relaxed wrap-break-word ${
                                                isClient
                                                    ? `bg-primary text-primary-foreground ${bubbleRadius(true, pos)}`
                                                    : `bg-muted text-foreground ${bubbleRadius(false, pos)}`
                                            }`}
                                        >
                                            {msg.body}
                                        </div>
                                    );
                                })}
                                <span className="text-[11px] text-muted-foreground mt-0.5 px-1">
                                    {formatGroupTime(group.messages[group.messages.length - 1].created_at)}
                                </span>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Compact reply card */}
            <div className="px-4 py-3 border-t border-border bg-background shrink-0">
                <form
                    onSubmit={handleSend}
                    className="flex items-center gap-2 rounded-xl border border-border bg-muted/20 px-4 py-2"
                >
                    <input
                        value={draft}
                        onChange={e => setDraft(e.target.value)}
                        placeholder="Reply… (Enter to send)"
                        className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none"
                        onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                handleSend(e);
                            }
                        }}
                    />
                    <Button
                        type="submit"
                        color="primary"
                        isDisabled={sending || !draft.trim()}
                        size="sm"
                        isIconOnly
                        className="shrink-0"
                    >
                        <Send size={13} />
                    </Button>
                </form>
            </div>
        </div>
    );
}
