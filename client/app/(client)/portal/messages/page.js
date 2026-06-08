"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import api from "@/lib/axios";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";

const POLL_INTERVAL_MS = 5000;

function formatTime(ts) {
    if (!ts) return '';
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatDate(ts) {
    if (!ts) return '';
    return new Date(ts).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function ClientMessagesPage() {
    const [messages, setMessages] = useState([]);
    const [draft, setDraft] = useState('');
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const threadIdRef = useRef(null);
    const messagesEndRef = useRef(null);
    const pollRef = useRef(null);

    const fetchMessages = useCallback(async () => {
        try {
            const res = await api.get('/api/client-portal/messages');
            threadIdRef.current = res.data.thread?.id;
            setMessages(res.data.messages);
        } catch {
            // silent
        }
    }, []);

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
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 80px)' }}>
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                <h1 style={{ fontWeight: 600, fontSize: 18, margin: 0 }}>Messages</h1>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--muted-foreground)' }}>
                    Chat with your coach
                </p>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 w-56" style={{ alignSelf: i % 2 === 0 ? 'flex-start' : 'flex-end' }} />
                    ))
                ) : messages.length === 0 ? (
                    <p style={{ color: 'var(--muted-foreground)', fontSize: 14, textAlign: 'center', marginTop: 32 }}>
                        No messages yet. Send a message to your coach below.
                    </p>
                ) : (
                    messages.map(msg => {
                        const isClient = msg.sender_type === 'client';
                        return (
                            <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isClient ? 'flex-end' : 'flex-start' }}>
                                <div style={{
                                    maxWidth: '75%', padding: '8px 12px', borderRadius: 12,
                                    background: isClient ? 'var(--primary)' : 'var(--muted)',
                                    color: isClient ? 'var(--primary-foreground)' : 'var(--foreground)',
                                    fontSize: 14, lineHeight: 1.5, wordBreak: 'break-word',
                                }}>
                                    {msg.body}
                                </div>
                                <span style={{ fontSize: 11, color: 'var(--muted-foreground)', marginTop: 2 }}>
                                    {formatDate(msg.created_at)} {formatTime(msg.created_at)}
                                </span>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} style={{
                padding: '12px 20px', borderTop: '1px solid var(--border)',
                display: 'flex', gap: 8, background: 'var(--background)',
            }}>
                <input
                    value={draft}
                    onChange={e => setDraft(e.target.value)}
                    placeholder="Type a message…"
                    style={{
                        flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: 14,
                        border: '1px solid var(--border)', background: 'var(--background)',
                        color: 'var(--foreground)', outline: 'none',
                    }}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(e); } }}
                />
                <Button type="submit" color="primary" isDisabled={sending || !draft.trim()} size="sm">
                    {sending ? '…' : 'Send'}
                </Button>
            </form>
        </div>
    );
}
