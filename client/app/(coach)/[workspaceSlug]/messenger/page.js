"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import api from "@/lib/axios";
import { useDateFormatter } from "@/utils/useDateFormatter";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";
import { Avatar } from "@heroui/react/avatar";
import { Chip } from "@heroui/react/chip";
import { ScrollShadow } from "@heroui/react/scroll-shadow";
import { Card } from "@heroui/react/card";
import { ListBox } from "@heroui/react/list-box";
import { SearchField } from "@heroui/react/search-field";
import { TextField } from "@heroui/react/textfield";
import { TextArea } from "@heroui/react/textarea";
import { Send, ExternalLink, Mail, Phone, Package, Calendar, Clock, CheckCheck } from "lucide-react";

const POLL_INTERVAL_MS = 5000;

const STATUS_CHIP = {
    Active:      "success",
    Expired:     "danger",
    Frozen:      "default",
    "Pre-start": "warning",
    Cancelled:   "default",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatTimestamp(ts, locale) {
    if (!ts) return '';
    const date = new Date(ts);
    const isToday = date.toDateString() === new Date().toDateString();
    if (isToday) return date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
    return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' });
}

function formatGroupTime(ts, locale) {
    if (!ts) return '';
    return new Date(ts).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
}

function getDateLabel(ts, locale, labels) {
    const date = new Date(ts);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === today.toDateString()) return labels.today;
    if (date.toDateString() === yesterday.toDateString()) return labels.yesterday;
    return date.toLocaleDateString(locale, { weekday: 'long', month: 'short', day: 'numeric' });
}

function getInitials(fname, lname) {
    return `${fname?.[0] ?? ''}${lname?.[0] ?? ''}`.toUpperCase();
}

// Groups consecutive messages from the same sender within a 5-minute window.
function buildSegments(messages, locale, dateLabels) {
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
            segments.push({ type: 'date', label: getDateLabel(group.messages[0].created_at, locale, dateLabels) });
            lastDate = dateStr;
        }
        segments.push({ type: 'group', group });
    });
    return segments;
}

// Returns tailwind radius classes based on position in a message group.
function bubbleRadius(isTeam, pos) {
    if (isTeam) {
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

const scrollbarCls =
    "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent " +
    "[&::-webkit-scrollbar-thumb]:bg-border/50 [&::-webkit-scrollbar-thumb]:rounded-full";

// ── Component ──────────────────────────────────────────────────────────────────

export default function MessengerPage() {
    const { workspaceSlug } = useParams();
    const t = useTranslations('messenger');
    const tFilter = useTranslations('filter');
    const locale = useLocale();
    const { formatDate } = useDateFormatter();
    const containerRef = useRef(null);
    const [widths, setWidths] = useState([26, 46, 28]);

    const [threads, setThreads] = useState([]);
    const [filteredThreads, setFilteredThreads] = useState([]);
    const [search, setSearch] = useState('');
    const [selectedThreadId, setSelectedThreadId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [clientProfile, setClientProfile] = useState(null);
    const [draft, setDraft] = useState('');
    const [threadsLoading, setThreadsLoading] = useState(true);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [profileLoading, setProfileLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [togglingStatus, setTogglingStatus] = useState(false);
    const messagesEndRef = useRef(null);
    const pollRef = useRef(null);

    // ── Resizable panels ───────────────────────────────────────────────────────
    function handleDividerMouseDown(index, e) {
        e.preventDefault();
        const containerWidth = containerRef.current.getBoundingClientRect().width;
        const startX = e.clientX;
        const startWidths = [...widths];

        function onMove(ev) {
            const deltaPct = ((ev.clientX - startX) / containerWidth) * 100;
            const next = [...startWidths];
            next[index]     = Math.max(18, startWidths[index] + deltaPct);
            next[index + 1] = Math.max(18, startWidths[index + 1] - deltaPct);
            setWidths(next);
        }
        function onUp() {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        }
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }

    // ── Data fetching ──────────────────────────────────────────────────────────
    const fetchThreads = useCallback(async () => {
        try {
            const res = await api.get('/api/messenger/threads');
            setThreads(res.data);
        } catch { /* silent */ }
    }, []);

    const fetchMessages = useCallback(async (threadId) => {
        if (!threadId) return;
        try {
            const res = await api.get(`/api/messenger/threads/${threadId}/messages`);
            setMessages(res.data);
        } catch { /* silent */ }
    }, []);

    useEffect(() => { fetchThreads().finally(() => setThreadsLoading(false)); }, [fetchThreads]);

    useEffect(() => {
        clearInterval(pollRef.current);
        pollRef.current = setInterval(() => {
            fetchThreads();
            if (selectedThreadId) fetchMessages(selectedThreadId);
        }, POLL_INTERVAL_MS);
        return () => clearInterval(pollRef.current);
    }, [selectedThreadId, fetchThreads, fetchMessages]);

    useEffect(() => {
        if (!selectedThreadId) return;
        setMessagesLoading(true);
        fetchMessages(selectedThreadId).finally(() => setMessagesLoading(false));
    }, [selectedThreadId, fetchMessages]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (!search.trim()) { setFilteredThreads(threads); return; }
        const q = search.toLowerCase();
        setFilteredThreads(threads.filter(thread =>
            `${thread.fname} ${thread.lname}`.toLowerCase().includes(q) ||
            thread.latest_message?.toLowerCase().includes(q)
        ));
    }, [search, threads]);

    // ── Actions ────────────────────────────────────────────────────────────────
    const handleSelectThread = (thread) => {
        setSelectedThreadId(thread.id);
        setMessages([]);
        setDraft('');
        setProfileLoading(true);
        api.get(`/api/clients/${thread.client_id}`)
            .then(res => setClientProfile(res.data))
            .catch(() => setClientProfile(null))
            .finally(() => setProfileLoading(false));
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
        } catch { /* silent — message stays in draft */ }
        finally { setSending(false); }
    };

    const handleToggleStatus = async () => {
        if (!selectedThreadId || !selectedThread) return;
        const newStatus = selectedThread.status === 'open' ? 'closed' : 'open';
        setTogglingStatus(true);
        try {
            await api.patch(`/api/messenger/threads/${selectedThreadId}/status`, { status: newStatus });
            setThreads(prev => prev.map(t => t.id === selectedThreadId ? { ...t, status: newStatus } : t));
        } catch { /* silent */ }
        finally { setTogglingStatus(false); }
    };

    const selectedThread = threads.find(thread => thread.id === selectedThreadId);
    const segments = buildSegments(messages, locale, { today: t('today'), yesterday: t('yesterday') });

    // ── Render ─────────────────────────────────────────────────────────────────
    return (
        <div className="flex flex-col flex-1 h-full overflow-hidden p-3">
            <div ref={containerRef} className="flex flex-row flex-1 min-h-0 overflow-hidden">

                {/* ── Panel 1: Conversations ─────────────────────────────── */}
                <div style={{ width: `${widths[0]}%` }} className="flex flex-col h-full min-h-0 overflow-hidden">
                    <Card className="w-full flex-1 min-h-0 p-0 gap-0">

                        <Card.Header className="flex flex-col gap-3 px-4 pt-4 pb-3 shrink-0">
                            <Card.Title className="text-base font-semibold text-foreground">
                                {t('title')}
                            </Card.Title>
                            <SearchField
                                value={search}
                                onChange={setSearch}
                                onClear={() => setSearch('')}
                                aria-label={t('searchPlaceholder')}
                                variant="secondary"
                            >
                                <SearchField.Group>
                                    <SearchField.SearchIcon />
                                    <SearchField.Input placeholder={t('searchPlaceholder')} />
                                    <SearchField.ClearButton />
                                </SearchField.Group>
                            </SearchField>
                        </Card.Header>

                        <Card.Content className="overflow-hidden min-h-0 px-4 pb-4">
                            {threadsLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <div key={i} className="flex items-start gap-3 px-2 py-3 rounded-xl mb-1">
                                        <Skeleton className="h-8 w-8 rounded-full shrink-0 mt-0.5" />
                                        <div className="flex-1 space-y-1.5 pt-0.5">
                                            <Skeleton className="h-3 w-28 rounded" />
                                            <Skeleton className="h-2.5 w-40 rounded" />
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <ScrollShadow className={`flex-1 overflow-y-auto -mx-2 px-2 ${scrollbarCls}`}>
                                    <ListBox
                                        selectionMode="single"
                                        disallowEmptySelection
                                        selectedKeys={selectedThreadId ? [selectedThreadId] : []}
                                        onSelectionChange={(keys) => {
                                            const id = [...keys][0];
                                            if (!id) return;
                                            const thread = filteredThreads.find(t => t.id === id);
                                            if (thread) handleSelectThread(thread);
                                        }}
                                        aria-label={t('title')}
                                        renderEmptyState={() => (
                                            <div className="rounded-xl p-5 flex flex-col items-center justify-center gap-2 text-center mx-1 my-1">
                                                <p className="text-sm text-muted-foreground">
                                                    {search ? t('noResults') : t('noConversations')}
                                                </p>
                                                {search && (
                                                    <Button size="sm" variant="ghost" onClick={() => setSearch('')}>
                                                        {tFilter('clearSearch')}
                                                    </Button>
                                                )}
                                            </div>
                                        )}
                                        className="p-0 gap-0"
                                    >
                                        {filteredThreads.map(thread => {
                                            const hasUnread = thread.unread_count > 0;
                                            return (
                                                <ListBox.Item
                                                    key={thread.id}
                                                    id={thread.id}
                                                    textValue={`${thread.fname} ${thread.lname}`}
                                                    className="items-start gap-3 rounded-xl px-3 py-2.5 mb-0.5 border-l-[3px] border-transparent [&:hover]:bg-accent/40 data-[selected=true]:border-primary data-[selected=true]:bg-primary/8 data-[selected=true]:[&:hover]:bg-primary/8"
                                                >
                                                    <Avatar size="sm" color="primary" className="shrink-0 mt-0.5">
                                                        <Avatar.Fallback>{getInitials(thread.fname, thread.lname)}</Avatar.Fallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between gap-1.5 mb-0.5">
                                                            <span className={`text-sm truncate ${hasUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                                                                {thread.fname} {thread.lname}
                                                            </span>
                                                            <div className="flex items-center gap-1.5 shrink-0">
                                                                {hasUnread && (
                                                                    <span className="min-w-4.5 h-4.5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">
                                                                        {thread.unread_count > 9 ? '9+' : thread.unread_count}
                                                                    </span>
                                                                )}
                                                                <span className="text-[11px] text-muted-foreground">
                                                                    {formatTimestamp(thread.latest_message_at || thread.updated_at, locale)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <p className={`text-xs truncate ${hasUnread ? 'text-foreground/70' : 'text-muted-foreground'}`}>
                                                            {thread.latest_message || t('threadNoMessages')}
                                                        </p>
                                                    </div>
                                                </ListBox.Item>
                                            );
                                        })}
                                    </ListBox>
                                </ScrollShadow>
                            )}
                        </Card.Content>

                    </Card>
                </div>

                {/* Divider 1 */}
                <div className="w-1.5 mx-1 shrink-0 flex items-center justify-center cursor-col-resize group" onMouseDown={e => handleDividerMouseDown(0, e)}>
                    <div className="w-1.5 h-12 bg-accent/20 rounded-full group-hover:bg-accent/60 group-active:bg-accent transition-colors" />
                </div>

                {/* ── Panel 2: Open Chat ─────────────────────────────────── */}
                <div style={{ width: `${widths[1]}%` }} className="flex flex-col h-full min-h-0 overflow-hidden">
                    <Card className="w-full flex-1 min-h-0 p-0 gap-0">

                        {!selectedThreadId ? (
                            <Card.Content className="flex-1 flex flex-col items-center justify-center gap-3 p-8 text-center">
                                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center">
                                    <Send size={20} className="text-muted-foreground" />
                                </div>
                                <p className="text-sm font-medium text-foreground">{t('noThreadSelected')}</p>
                                <p className="text-xs text-muted-foreground">{t('noThreadSelectedHint')}</p>
                            </Card.Content>
                        ) : (
                            <>
                                {/* Chat header with status toggle */}
                                <Card.Header className="flex-row items-center gap-3 px-5 py-3 border-b border-border shrink-0">
                                    <Avatar size="sm" color="primary" className="shrink-0">
                                        <Avatar.Fallback>{getInitials(selectedThread?.fname, selectedThread?.lname)}</Avatar.Fallback>
                                    </Avatar>
                                    <span className="text-sm font-semibold text-foreground flex-1 min-w-0 truncate">
                                        {selectedThread?.fname} {selectedThread?.lname}
                                    </span>
                                    <Chip
                                        size="sm"
                                        color={selectedThread?.status === 'open' ? 'success' : 'default'}
                                        variant="flat"
                                        className="shrink-0"
                                    >
                                        {selectedThread?.status === 'open' ? t('statusOpen') : t('statusClosed')}
                                    </Chip>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        isDisabled={togglingStatus}
                                        onClick={handleToggleStatus}
                                        className="shrink-0 text-xs text-muted-foreground gap-1"
                                    >
                                        <CheckCheck size={13} />
                                        {selectedThread?.status === 'open' ? t('close') : t('reopen')}
                                    </Button>
                                </Card.Header>

                                {/* Messages with grouping + date separators */}
                                <Card.Content className="overflow-hidden min-h-0 p-0">
                                    <ScrollShadow className={`h-full overflow-y-auto px-5 py-4 flex flex-col gap-1 ${scrollbarCls}`}>
                                        {messagesLoading ? (
                                            Array.from({ length: 4 }).map((_, i) => (
                                                <div key={i} className={`flex mb-2 ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                                                    <Skeleton className="h-10 w-52 rounded-2xl" />
                                                </div>
                                            ))
                                        ) : messages.length === 0 ? (
                                            <div className="flex-1 flex items-center justify-center">
                                                <p className="text-sm text-muted-foreground">{t('emptyChat')}</p>
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
                                                const isTeam = group.sender_type === 'team';
                                                const count  = group.messages.length;

                                                return (
                                                    <div key={`group-${si}`} className={`flex flex-col gap-0.5 mb-3 ${isTeam ? 'items-end' : 'items-start'}`}>
                                                        {group.messages.map((msg, mi) => {
                                                            const pos = count === 1 ? 'solo'
                                                                : mi === 0 ? 'first'
                                                                : mi === count - 1 ? 'last'
                                                                : 'middle';
                                                            return (
                                                                <div
                                                                    key={msg.id}
                                                                    className={`max-w-[70%] px-4 py-2 text-sm leading-relaxed wrap-break-word ${
                                                                        isTeam
                                                                            ? `bg-primary text-primary-foreground ${bubbleRadius(true, pos)}`
                                                                            : `bg-muted text-foreground ${bubbleRadius(false, pos)}`
                                                                    }`}
                                                                >
                                                                    {msg.body}
                                                                </div>
                                                            );
                                                        })}
                                                        {/* Single timestamp per group, shown after last message */}
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
                                <Card.Footer className="px-4 py-3 border-t border-border shrink-0">
                                    <form
                                        onSubmit={handleSend}
                                        className="flex items-end gap-2 w-full"
                                    >
                                        <TextField
                                            value={draft}
                                            onChange={setDraft}
                                            aria-label={t('replyPlaceholder')}
                                            className="flex-1 min-w-0"
                                        >
                                            <TextArea
                                                placeholder={t('replyPlaceholder')}
                                                variant="secondary"
                                                fullWidth
                                                rows={1}
                                                className="resize-none [field-sizing:content] max-h-32 overflow-y-auto text-sm"
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleSend(e);
                                                    }
                                                }}
                                            />
                                        </TextField>
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
                                </Card.Footer>
                            </>
                        )}

                    </Card>
                </div>

                {/* Divider 2 */}
                <div className="w-1.5 mx-1 shrink-0 flex items-center justify-center cursor-col-resize group" onMouseDown={e => handleDividerMouseDown(1, e)}>
                    <div className="w-1.5 h-12 bg-accent/20 rounded-full group-hover:bg-accent/60 group-active:bg-accent transition-colors" />
                </div>

                {/* ── Panel 3: Client Profile ────────────────────────────── */}
                <div style={{ width: `${widths[2]}%` }} className="flex flex-col h-full min-h-0 overflow-hidden">
                    <Card className="w-full flex-1 min-h-0 p-0 gap-0">

                        <Card.Content className="flex flex-col flex-1 min-h-0 p-5">
                            {!selectedThreadId ? (
                                <div className="rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-center flex-1">
                                    <p className="text-sm text-muted-foreground">{t('selectConversationProfile')}</p>
                                </div>
                            ) : profileLoading ? (
                                <div className="flex flex-col items-center gap-4 pt-4">
                                    <Skeleton className="h-16 w-16 rounded-full" />
                                    <Skeleton className="h-4 w-32 rounded" />
                                    <Skeleton className="h-3 w-24 rounded" />
                                    <div className="w-full space-y-2 mt-4">
                                        {Array.from({ length: 4 }).map((_, i) => (
                                            <Skeleton key={i} className="h-8 w-full rounded-lg" />
                                        ))}
                                    </div>
                                </div>
                            ) : clientProfile ? (
                                <div className={`flex flex-col flex-1 min-h-0 overflow-y-auto ${scrollbarCls}`}>
                                    {/* Avatar + name + status */}
                                    <div className="flex flex-col items-center gap-2 mb-5 text-center shrink-0">
                                        <Avatar size="lg" color="primary">
                                            <Avatar.Fallback className="text-lg">
                                                {getInitials(clientProfile.fname, clientProfile.lname)}
                                            </Avatar.Fallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-sm font-semibold text-foreground">
                                                {clientProfile.fname} {clientProfile.lname}
                                            </p>
                                            {clientProfile.client_code && (
                                                <p className="text-xs text-muted-foreground mt-0.5">#{clientProfile.client_code}</p>
                                            )}
                                        </div>
                                        {clientProfile.subscription_status && (
                                            <Chip size="sm" color={STATUS_CHIP[clientProfile.subscription_status] ?? 'default'} variant="flat">
                                                {clientProfile.subscription_status}
                                            </Chip>
                                        )}
                                    </div>

                                    {/* Contact + metadata details */}
                                    <div className="flex flex-col gap-3 flex-1">
                                        {clientProfile.email && (
                                            <div className="flex items-start gap-3">
                                                <Mail size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                                                <span className="text-xs text-foreground break-all">{clientProfile.email}</span>
                                            </div>
                                        )}
                                        {clientProfile.phone && (
                                            <div className="flex items-start gap-3">
                                                <Phone size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                                                <span className="text-xs text-foreground">{clientProfile.phone}</span>
                                            </div>
                                        )}
                                        {clientProfile.current_package && (
                                            <div className="flex items-start gap-3">
                                                <Package size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                                                <span className="text-xs text-foreground">{clientProfile.current_package}</span>
                                            </div>
                                        )}
                                        {clientProfile.created_at && (
                                            <div className="flex items-start gap-3">
                                                <Calendar size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="text-[11px] text-muted-foreground">{t('memberSince')}</p>
                                                    <p className="text-xs text-foreground">
                                                        {formatDate(clientProfile.created_at)}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                        {selectedThread?.latest_message_at && (
                                            <div className="flex items-start gap-3">
                                                <Clock size={14} className="text-muted-foreground mt-0.5 shrink-0" />
                                                <div>
                                                    <p className="text-[11px] text-muted-foreground">{t('lastMessage')}</p>
                                                    <p className="text-xs text-foreground">
                                                        {formatTimestamp(selectedThread.latest_message_at, locale)}
                                                    </p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Open Profile pinned to bottom */}
                                    <div className="mt-4 pt-4 border-t border-border shrink-0">
                                        <Link href={`/${workspaceSlug}/clients/${clientProfile.id}`}>
                                            <Button variant="outline" size="sm" className="w-full gap-1.5">
                                                <ExternalLink size={13} />
                                                {t('openProfile')}
                                            </Button>
                                        </Link>
                                    </div>
                                </div>
                            ) : null}
                        </Card.Content>

                    </Card>
                </div>

            </div>
        </div>
    );
}
