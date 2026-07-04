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
import { Separator } from "@heroui/react/separator";
import { ListBox } from "@heroui/react/list-box";
import { SearchField } from "@heroui/react/search-field";
import { TextField } from "@heroui/react/textfield";
import { TextArea } from "@heroui/react/textarea";
import { Send, ExternalLink, Mail, Phone, Package, Calendar, Clock, X } from "lucide-react";
import EmptyState from "@/app/components/EmptyState";

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

const scrollbarCls = "[&::-webkit-scrollbar]:w-0 [scrollbar-width:none]";

// ── Component ──────────────────────────────────────────────────────────────────

export default function MessengerPage() {
    const { workspaceSlug } = useParams();
    const t = useTranslations('messenger');
    const tFilter = useTranslations('filter');
    const locale = useLocale();
    const { formatDate } = useDateFormatter();

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
            <div className="flex flex-row flex-1 min-h-0 overflow-hidden gap-2">

                {/* ── Panel 1: Conversations ─────────────────────────────── */}
                <div className="w-[26%] flex flex-col h-full min-h-0 overflow-hidden pt-0.5">

                    <div className="pb-3 px-1.5 shrink-0">
                        <SearchField
                            value={search}
                            onChange={setSearch}
                            onClear={() => setSearch('')}
                            aria-label={t('searchPlaceholder')}
                        >
                            <SearchField.Group className="bg-surface! border-surface!">
                                <SearchField.SearchIcon />
                                <SearchField.Input placeholder={t('searchPlaceholder')} />
                                <SearchField.ClearButton />
                            </SearchField.Group>
                        </SearchField>
                    </div>

                    <div className="overflow-hidden min-h-0 px-2 pb-4 flex-1 flex flex-col">
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
                            <ScrollShadow hideScrollBar className="flex-1 overflow-y-auto">
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
                                        <EmptyState
                                            variant={search ? "search" : "firstTime"}
                                            title={search ? t('noResults') : t('noConversations')}
                                            action={search ? { label: tFilter('clearSearch'), onPress: () => setSearch('') } : undefined}
                                        />
                                    )}
                                    className="p-0 gap-0 outline-none"
                                >
                                    {filteredThreads.map(thread => {
                                        const hasUnread = thread.unread_count > 0;
                                        return (
                                            <ListBox.Item
                                                key={thread.id}
                                                id={thread.id}
                                                textValue={`${thread.fname} ${thread.lname}`}
                                                className="items-start gap-3 rounded-xl px-3 py-2.5 mb-0.5 cursor-pointer [&:hover]:bg-surface data-[selected=true]:bg-surface data-[selected=true]:[&:hover]:bg-surface focus:outline-none! focus:ring-0! focus:shadow-none! focus-visible:outline-none! focus-visible:ring-0! focus-visible:shadow-none!"
                                            >
                                                <Avatar size="sm" color="primary" className="shrink-0 mt-0.5">
                                                    <Avatar.Fallback>{getInitials(thread.fname, thread.lname)}</Avatar.Fallback>
                                                </Avatar>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between gap-1.5 mb-0.5">
                                                        <span className={`text-sm truncate ${hasUnread ? 'font-semibold text-foreground' : 'font-medium text-foreground/80'}`}>
                                                            {thread.fname} {thread.lname}
                                                            {thread.client_code && <span className="ms-1.5 inline-flex items-center px-1.5 py-0.5 rounded-md bg-default text-[10px] font-medium text-foreground/70 shrink-0">#{thread.client_code}</span>}
                                                        </span>
                                                        <span className="text-[11px] text-muted-foreground shrink-0">
                                                            {formatTimestamp(thread.latest_message_at || thread.updated_at, locale)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-1.5">
                                                        <p className={`text-xs truncate ${hasUnread ? 'text-foreground/70' : 'text-muted-foreground'}`}>
                                                            {thread.latest_message || t('threadNoMessages')}
                                                        </p>
                                                        {hasUnread && (
                                                            <span className="min-w-4.5 h-4.5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center shrink-0">
                                                                {thread.unread_count > 9 ? '9+' : thread.unread_count}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </ListBox.Item>
                                        );
                                    })}
                                </ListBox>
                            </ScrollShadow>
                        )}
                    </div>

                </div>


                {/* ── Panel 2: Open Chat ─────────────────────────────────── */}
                <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden pt-0.5">
                    <Card className="w-full flex-1 min-h-0 p-0 gap-0">

                        {!selectedThreadId ? (
                            <Card.Content className="flex-1 flex flex-col items-center justify-center p-8">
                                <EmptyState
                                    variant="firstTime"
                                    icon={Send}
                                    title={t('noThreadSelected')}
                                    description={t('noThreadSelectedHint')}
                                />
                            </Card.Content>
                        ) : (
                            <>
                                {/* Chat header */}
                                <Card.Header className="flex-row items-center gap-2 px-4 py-3 shrink-0">
                                    <Avatar size="sm" color="primary" className="shrink-0">
                                        <Avatar.Fallback>{getInitials(selectedThread?.fname, selectedThread?.lname)}</Avatar.Fallback>
                                    </Avatar>
                                    <div className="flex items-baseline gap-2 flex-1 min-w-0">
                                        <span className="text-sm font-semibold text-foreground truncate">
                                            {selectedThread?.fname} {selectedThread?.lname}
                                        </span>
                                        {selectedThread?.client_code && (
                                            <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-default text-[11px] font-medium text-foreground/70 shrink-0">#{selectedThread.client_code}</span>
                                        )}
                                    </div>
                                    <Button
                                        isIconOnly
                                        variant="ghost"
                                        size="sm"
                                        className="shrink-0 text-muted-foreground"
                                        aria-label="Close chat"
                                        onClick={() => setSelectedThreadId(null)}
                                    >
                                        <X size={15} />
                                    </Button>
                                </Card.Header>

                                {/* Messages with grouping + date separators */}
                                <Card.Content className="overflow-hidden min-h-0 p-0">
                                    <ScrollShadow hideScrollBar className="h-full overflow-y-auto px-5 pt-2 pb-4 flex flex-col gap-1">
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
                                                            <Separator className="flex-1" />
                                                            <span className="text-[11px] text-muted font-medium px-2">{seg.label}</span>
                                                            <Separator className="flex-1" />
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
                                                                            : `bg-default text-foreground ${bubbleRadius(false, pos)}`
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
                                <Card.Footer className="px-4 pb-4 pt-1 shrink-0">
                                    <form onSubmit={handleSend} className="w-full rounded-2xl border border-border bg-default flex flex-col px-4 pt-3 pb-3 gap-2 transition-[box-shadow,background-color] focus-within:ring-2 focus-within:ring-focus focus-within:bg-[color-mix(in_oklch,var(--color-default)_85%,white_15%)] dark:focus-within:bg-[color-mix(in_oklch,var(--color-default)_85%,black_15%)]">
                                        <TextField
                                            value={draft}
                                            onChange={setDraft}
                                            aria-label={t('replyPlaceholder')}
                                            className="w-full"
                                        >
                                            <TextArea
                                                placeholder={t('replyPlaceholder')}
                                                variant="secondary"
                                                fullWidth
                                                rows={1}
                                                className={`resize-none [field-sizing:content] max-h-32 overflow-y-auto text-sm px-0! border-transparent! shadow-none! focus:ring-0! focus:shadow-none! [--textarea-bg:transparent] [--textarea-bg-hover:transparent] [--textarea-bg-focus:transparent] ${scrollbarCls}`}
                                                onKeyDown={e => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        handleSend(e);
                                                    }
                                                }}
                                            />
                                        </TextField>
                                        <div className="flex items-center justify-end">
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
                                        </div>
                                    </form>
                                </Card.Footer>
                            </>
                        )}

                    </Card>
                </div>


                {/* ── Panel 3: Client Profile ────────────────────────────── */}
                <div className="w-[28%] flex flex-col h-full min-h-0 overflow-hidden pt-0.5">
                    <Card className="w-full flex-1 min-h-0 p-0 gap-0">

                        <Card.Content className="flex flex-col flex-1 min-h-0 p-5">
                            {!selectedThreadId ? (
                                <div className="flex-1 flex items-center justify-center">
                                    <EmptyState
                                        variant="firstTime"
                                        icon={Mail}
                                        description={t('selectConversationProfile')}
                                    />
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
                                            <Chip size="sm" color={STATUS_CHIP[clientProfile.subscription_status] ?? 'default'} variant="soft">
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
                                    <Separator className="mt-4 mb-4 shrink-0" />
                                    <div className="shrink-0">
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
