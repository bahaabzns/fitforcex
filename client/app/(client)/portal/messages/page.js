"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import api from "@/lib/axios";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";
import { Avatar } from "@heroui/react/avatar";
import { Send } from "lucide-react";
import { useTranslations } from "next-intl";

const POLL_INTERVAL_MS = 5000;

function formatTimestamp(ts) {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) +
        ' · ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
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

    useEffect(() => {
        fetchMessages().finally(() => setLoading(false));
    }, [fetchMessages]);

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

    return (
        <div className="flex flex-col h-[calc(100dvh-120px)]">

            {/* Header — mail-style sender card */}
            <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border bg-background">
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
            <div className="flex-1 overflow-y-auto px-5 py-4 flex flex-col gap-3">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
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
                    messages.map(msg => {
                        const isClient = msg.sender_type === 'client';
                        return (
                            <div key={msg.id} className={`flex flex-col ${isClient ? 'items-end' : 'items-start'}`}>
                                <div className={`max-w-[78%] px-4 py-2.5 text-sm leading-relaxed wrap-break-word ${
                                    isClient
                                        ? 'bg-primary text-primary-foreground rounded-2xl rounded-br-sm'
                                        : 'bg-muted text-foreground rounded-2xl rounded-bl-sm'
                                }`}>
                                    {msg.body}
                                </div>
                                <span className="text-[11px] text-muted-foreground mt-1 px-1">
                                    {formatTimestamp(msg.created_at)}
                                </span>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Reply input — mail-style card */}
            <div className="px-4 py-3 border-t border-border bg-background">
                <div className="rounded-xl border border-border bg-muted/20 overflow-hidden">
                    <form onSubmit={handleSend}>
                        <div className="px-1 pt-1">
                            <input
                                value={draft}
                                onChange={e => setDraft(e.target.value)}
                                placeholder="Reply…"
                                className={
                                    "w-full px-3 py-2 bg-transparent text-foreground " +
                                    "placeholder:text-muted-foreground text-sm focus-visible:outline-none"
                                }
                                onKeyDown={e => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend(e);
                                    }
                                }}
                            />
                        </div>
                        <div className="flex items-center justify-end px-3 py-2 border-t border-border/50">
                            <Button
                                type="submit"
                                color="primary"
                                isDisabled={sending || !draft.trim()}
                                size="sm"
                                className="gap-1.5"
                            >
                                <Send size={13} />
                                {sending ? 'Sending…' : 'Send'}
                            </Button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
