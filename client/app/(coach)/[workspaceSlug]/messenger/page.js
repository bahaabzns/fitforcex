"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
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

export default function MessengerPage() {
    const { workspaceSlug } = useParams();
    const [threads, setThreads] = useState([]);
    const [selectedThreadId, setSelectedThreadId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [draft, setDraft] = useState('');
    const [threadsLoading, setThreadsLoading] = useState(true);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const messagesEndRef = useRef(null);
    const pollRef = useRef(null);

    const fetchThreads = useCallback(async () => {
        try {
            const res = await api.get('/api/messenger/threads');
            setThreads(res.data);
        } catch {
            // silent — keeps showing stale data
        }
    }, []);

    const fetchMessages = useCallback(async (threadId) => {
        if (!threadId) return;
        try {
            const res = await api.get(`/api/messenger/threads/${threadId}/messages`);
            setMessages(res.data);
        } catch {
            // silent
        }
    }, []);

    // Initial load
    useEffect(() => {
        fetchThreads().finally(() => setThreadsLoading(false));
    }, [fetchThreads]);

    // Polling: refresh threads list + active thread messages every 5 seconds
    useEffect(() => {
        clearInterval(pollRef.current);
        pollRef.current = setInterval(() => {
            fetchThreads();
            if (selectedThreadId) fetchMessages(selectedThreadId);
        }, POLL_INTERVAL_MS);
        return () => clearInterval(pollRef.current);
    }, [selectedThreadId, fetchThreads, fetchMessages]);

    // Load messages when a thread is selected
    useEffect(() => {
        if (!selectedThreadId) return;
        setMessagesLoading(true);
        fetchMessages(selectedThreadId).finally(() => setMessagesLoading(false));
    }, [selectedThreadId, fetchMessages]);

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const handleSelectThread = (threadId) => {
        setSelectedThreadId(threadId);
        setMessages([]);
        setDraft('');
    };

    const handleSend = async (e) => {
        e.preventDefault();
        if (!draft.trim() || !selectedThreadId) return;
        setSending(true);
        try {
            const res = await api.post(`/api/messenger/threads/${selectedThreadId}/messages`, { body: draft });
            setMessages(prev => [...prev, res.data]);
            setDraft('');
            fetchThreads();
        } catch {
            // silent — message stays in draft
        } finally {
            setSending(false);
        }
    };

    const selectedThread = threads.find(t => t.id === selectedThreadId);

    return (
        <div style={{ display: 'flex', height: 'calc(100vh - 64px)', overflow: 'hidden' }}>

            {/* Thread list */}
            <div style={{
                width: 280, minWidth: 280, borderRight: '1px solid var(--border)',
                display: 'flex', flexDirection: 'column', background: 'var(--background)'
            }}>
                <div style={{ padding: '16px', borderBottom: '1px solid var(--border)' }}>
                    <h2 style={{ fontWeight: 600, fontSize: 16, margin: 0 }}>Messages</h2>
                </div>
                <div style={{ overflowY: 'auto', flex: 1 }}>
                    {threadsLoading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} style={{ padding: '12px 16px', display: 'flex', gap: 10 }}>
                                <Skeleton className="h-10 w-10 rounded-full" />
                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-3 w-48" />
                                </div>
                            </div>
                        ))
                    ) : threads.length === 0 ? (
                        <p style={{ padding: 16, color: 'var(--muted-foreground)', fontSize: 14 }}>
                            No conversations yet. They appear here when a client sends their first message.
                        </p>
                    ) : (
                        threads.map(thread => (
                            <button
                                key={thread.id}
                                onClick={() => handleSelectThread(thread.id)}
                                style={{
                                    width: '100%', textAlign: 'left', padding: '12px 16px',
                                    background: selectedThreadId === thread.id ? 'var(--accent)' : 'transparent',
                                    border: 'none', cursor: 'pointer', borderBottom: '1px solid var(--border)',
                                    display: 'flex', gap: 10, alignItems: 'center',
                                }}
                            >
                                <div style={{
                                    width: 38, height: 38, borderRadius: '50%', flexShrink: 0,
                                    background: 'var(--muted)', display: 'flex', alignItems: 'center',
                                    justifyContent: 'center', fontWeight: 600, fontSize: 14,
                                    color: 'var(--muted-foreground)',
                                }}>
                                    {thread.fname?.[0]}{thread.lname?.[0]}
                                </div>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--foreground)' }}>
                                            {thread.fname} {thread.lname}
                                        </span>
                                        {thread.unread_count > 0 && (
                                            <span style={{
                                                background: 'var(--primary)', color: 'var(--primary-foreground)',
                                                borderRadius: '50%', width: 18, height: 18,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                fontSize: 11, fontWeight: 700, flexShrink: 0,
                                            }}>
                                                {thread.unread_count}
                                            </span>
                                        )}
                                    </div>
                                    <p style={{
                                        margin: 0, fontSize: 13, color: 'var(--muted-foreground)',
                                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                    }}>
                                        {thread.latest_message || 'No messages yet'}
                                    </p>
                                </div>
                            </button>
                        ))
                    )}
                </div>
            </div>

            {/* Message pane */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {!selectedThreadId ? (
                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <p style={{ color: 'var(--muted-foreground)' }}>Select a conversation to start messaging</p>
                    </div>
                ) : (
                    <>
                        {/* Header */}
                        <div style={{
                            padding: '12px 20px', borderBottom: '1px solid var(--border)',
                            display: 'flex', alignItems: 'center', gap: 12,
                            background: 'var(--background)',
                        }}>
                            <div style={{
                                width: 36, height: 36, borderRadius: '50%', background: 'var(--muted)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontWeight: 600, fontSize: 13, color: 'var(--muted-foreground)',
                            }}>
                                {selectedThread?.fname?.[0]}{selectedThread?.lname?.[0]}
                            </div>
                            <span style={{ fontWeight: 600, fontSize: 15 }}>
                                {selectedThread?.fname} {selectedThread?.lname}
                            </span>
                        </div>

                        {/* Messages */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
                            {messagesLoading ? (
                                Array.from({ length: 3 }).map((_, i) => (
                                    <Skeleton key={i} className="h-10 w-64" style={{ alignSelf: i % 2 === 0 ? 'flex-start' : 'flex-end' }} />
                                ))
                            ) : messages.length === 0 ? (
                                <p style={{ color: 'var(--muted-foreground)', fontSize: 14, textAlign: 'center', marginTop: 32 }}>
                                    No messages yet. Say hello!
                                </p>
                            ) : (
                                messages.map(msg => {
                                    const isTeam = msg.sender_type === 'team';
                                    return (
                                        <div key={msg.id} style={{ display: 'flex', flexDirection: 'column', alignItems: isTeam ? 'flex-end' : 'flex-start' }}>
                                            <div style={{
                                                maxWidth: '70%', padding: '8px 12px', borderRadius: 12,
                                                background: isTeam ? 'var(--primary)' : 'var(--muted)',
                                                color: isTeam ? 'var(--primary-foreground)' : 'var(--foreground)',
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

                        {/* Input */}
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
                    </>
                )}
            </div>
        </div>
    );
}
