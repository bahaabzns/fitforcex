"use client";

import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import api from "@/lib/axios";
import { useDateFormatter } from "@/utils/useDateFormatter";
import { getDateLabel } from "@/utils/date";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";
import { Avatar } from "@heroui/react/avatar";
import { Chip } from "@heroui/react/chip";
import { ScrollShadow } from "@heroui/react/scroll-shadow";
import { Card } from "@heroui/react/card";
import { Separator } from "@heroui/react/separator";
import { ListBox } from "@heroui/react/list-box";
import { SearchField } from "@heroui/react/search-field";
import { Send, ExternalLink, Mail, Phone, Package, Calendar, Clock, X, ListFilter, ArrowDownWideNarrow, ArrowUpWideNarrow, ChevronRight, Megaphone, NotebookText, Plus } from "lucide-react";
import EmptyState from "@/app/components/EmptyState";
import BroadcastMessageModal from "@/app/components/BroadcastMessageModal";
import MessageComposer from "@/app/components/MessageComposer";
import MessageRow from "@/app/components/MessageRow";
import ObservationCard from "@/app/components/ObservationCard";
import ObservationModal from "@/app/components/ObservationModal";

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

const NO_PACKAGE = '__no_package__';
const STATUS_ORDER = ['Active', 'Pre-start', 'Frozen', 'Expired', 'No Subscriptions'];

// ── Component ──────────────────────────────────────────────────────────────────

export default function MessengerPage() {
    const { workspaceSlug } = useParams();
    const searchParams = useSearchParams();
    const router = useRouter();
    const t = useTranslations('messenger');
    const tFilter = useTranslations('filter');
    const locale = useLocale();
    const isRtl = locale === 'ar';
    const { formatDate } = useDateFormatter();

    const [threads, setThreads] = useState([]);
    const [search, setSearch] = useState('');
    const [packageFilter, setPackageFilter] = useState([]);
    const [statusFilter, setStatusFilter] = useState([]);
    const [senderFilter, setSenderFilter] = useState([]);
    const [filterOpen, setFilterOpen] = useState(false);
    const [pendingFilterKey, setPendingFilterKey] = useState(null);
    const [filterMenuPos, setFilterMenuPos] = useState(null);
    const filterAnchorRef = useRef(null);
    const [sortOrder, setSortOrder] = useState('desc'); // 'desc' = newest first, 'asc' = oldest first
    const [broadcastOpen, setBroadcastOpen] = useState(false);
    const [selectedThreadId, setSelectedThreadId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [editingMessage, setEditingMessage] = useState(null);
    const [clientProfile, setClientProfile] = useState(null);
    const [recentObservations, setRecentObservations] = useState([]);
    const [observationModalOpen, setObservationModalOpen] = useState(false);
    const [editingObservation, setEditingObservation] = useState(null);
    const [threadsLoading, setThreadsLoading] = useState(true);
    const [messagesLoading, setMessagesLoading] = useState(false);
    const [profileLoading, setProfileLoading] = useState(false);
    const [togglingStatus, setTogglingStatus] = useState(false);
    const [me, setMe] = useState(null);
    const messagesEndRef = useRef(null);
    const pollRef = useRef(null);
    const prevMessageCountRef = useRef(0);


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
    useEffect(() => { api.get('/api/auth/me').then(res => setMe(res.data)).catch(() => {}); }, []);

    // Deep link from a notification click (?threadId=...) — select once, then
    // drop the query param so the 5s poll/back button don't re-trigger it.
    useEffect(() => {
        const threadId = searchParams.get('threadId');
        if (threadId) {
            setSelectedThreadId(threadId);
            router.replace(`/${workspaceSlug}/messenger`);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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
        // The 5s poll refetches the same thread and replaces `messages` with a new
        // array even when nothing changed — only scroll when a message was actually
        // added, so reading old history isn't interrupted by a forced scroll-to-bottom.
        if (messages.length > prevMessageCountRef.current) {
            messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
        }
        prevMessageCountRef.current = messages.length;
    }, [messages]);

    // Filter menu is portaled to <body> so it isn't clipped by the scrollable
    // conversation panel's overflow-hidden — position it against the button instead.
    useLayoutEffect(() => {
        if (!filterOpen) return;
        const reposition = () => {
            if (!filterAnchorRef.current) return;
            const rect = filterAnchorRef.current.getBoundingClientRect();
            setFilterMenuPos({
                top: rect.bottom + 4,
                ...(isRtl ? { left: rect.left } : { right: window.innerWidth - rect.right }),
            });
        };
        reposition();
        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, true);
        return () => {
            window.removeEventListener('resize', reposition);
            window.removeEventListener('scroll', reposition, true);
        };
    }, [filterOpen, isRtl]);

    // ── Filter options derived from the loaded threads ──────────────────────────
    const packageOptions = useMemo(() => {
        const pkgs = new Set();
        let hasNone = false;
        threads.forEach(thread => { thread.current_package ? pkgs.add(thread.current_package) : (hasNone = true); });
        const sorted = [...pkgs].sort();
        return hasNone ? [...sorted, NO_PACKAGE] : sorted;
    }, [threads]);

    const statusOptions = useMemo(() => {
        const present = new Set(threads.map(thread => thread.subscription_status).filter(Boolean));
        const ordered = STATUS_ORDER.filter(s => present.has(s));
        const rest = [...present].filter(s => !STATUS_ORDER.includes(s));
        return [...ordered, ...rest];
    }, [threads]);

    const filterFields = [
        {
            key: 'package', label: t('filterPackage'), options: packageOptions,
            selected: packageFilter, onChange: setPackageFilter,
            optionLabel: opt => opt === NO_PACKAGE ? t('filterNoPackage') : opt,
        },
        {
            key: 'status', label: t('filterSubscriptionStatus'), options: statusOptions,
            selected: statusFilter, onChange: setStatusFilter,
        },
        {
            key: 'sender', label: t('filterLastMessageFrom'), options: ['client', 'team'],
            selected: senderFilter, onChange: setSenderFilter,
            optionLabel: opt => opt === 'client' ? t('filterFromClient') : t('filterFromStaff'),
        },
    ];

    const hasActiveFilters = packageFilter.length > 0 || statusFilter.length > 0 || senderFilter.length > 0;

    const clearAllFilters = () => {
        setPackageFilter([]);
        setStatusFilter([]);
        setSenderFilter([]);
    };

    const filteredThreads = useMemo(() => {
        let result = threads;
        if (search.trim()) {
            const q = search.toLowerCase();
            result = result.filter(thread =>
                `${thread.fname} ${thread.lname}`.toLowerCase().includes(q) ||
                thread.latest_message?.toLowerCase().includes(q)
            );
        }
        if (packageFilter.length) {
            result = result.filter(thread => packageFilter.includes(thread.current_package || NO_PACKAGE));
        }
        if (statusFilter.length) {
            result = result.filter(thread => statusFilter.includes(thread.subscription_status));
        }
        if (senderFilter.length) {
            result = result.filter(thread => senderFilter.includes(thread.latest_message_sender_type));
        }
        result = [...result].sort((a, b) => {
            const timeA = new Date(a.latest_message_at || a.updated_at).getTime();
            const timeB = new Date(b.latest_message_at || b.updated_at).getTime();
            return sortOrder === 'asc' ? timeA - timeB : timeB - timeA;
        });
        return result;
    }, [search, threads, packageFilter, statusFilter, senderFilter, sortOrder]);

    // ── Actions ────────────────────────────────────────────────────────────────
    const handleSelectThread = (thread) => {
        setSelectedThreadId(thread.id);
        setMessages([]);
        setEditingMessage(null);
        setProfileLoading(true);
        api.get(`/api/clients/${thread.client_id}`)
            .then(res => setClientProfile(res.data))
            .catch(() => setClientProfile(null))
            .finally(() => setProfileLoading(false));

        setRecentObservations([]);
        api.get(`/api/clients/${thread.client_id}/observations?limit=2`)
            .then(res => setRecentObservations(Array.isArray(res.data) ? res.data : []))
            .catch(() => setRecentObservations([]));
    };

    // These intentionally don't catch — MessageComposer keeps the draft/attachment/
    // edit state intact on failure so the user can retry, matching the prior
    // "silent — message stays in draft" behavior of the old inline send handler.
    const handleSendText = async (body) => {
        const res = await api.post(`/api/messenger/threads/${selectedThreadId}/messages`, { body });
        setMessages(prev => [...prev, res.data]);
        fetchThreads();
    };

    const handleSendAttachment = async (attachment, caption) => {
        const formData = new FormData();
        formData.append('file', attachment.file, attachment.name);
        if (caption) formData.append('body', caption);
        if (attachment.durationSeconds) formData.append('durationSeconds', String(attachment.durationSeconds));
        const res = await api.post(`/api/messenger/threads/${selectedThreadId}/attachments`, formData);
        setMessages(prev => [...prev, res.data]);
        fetchThreads();
    };

    const handleSaveEdit = async (messageId, body) => {
        const res = await api.patch(`/api/messenger/threads/${selectedThreadId}/messages/${messageId}`, { body });
        setMessages(prev => prev.map(m => m.id === messageId ? res.data : m));
        setEditingMessage(null);
        fetchThreads();
    };

    const handleDeleteMessage = async (messageId) => {
        if (!confirm(t('deleteConfirm'))) return;
        try {
            const res = await api.delete(`/api/messenger/threads/${selectedThreadId}/messages/${messageId}`);
            setMessages(prev => prev.map(m => m.id === messageId ? res.data : m));
            if (editingMessage?.id === messageId) setEditingMessage(null);
            fetchThreads();
        } catch { /* silent */ }
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
                        <div className="flex items-center gap-1.5">
                            <SearchField
                                value={search}
                                onChange={setSearch}
                                onClear={() => setSearch('')}
                                aria-label={t('searchPlaceholder')}
                                className="flex-1 min-w-0"
                            >
                                <SearchField.Group className="bg-surface! border-surface!">
                                    <SearchField.SearchIcon />
                                    <SearchField.Input placeholder={t('searchPlaceholder')} />
                                    <SearchField.ClearButton />
                                </SearchField.Group>
                            </SearchField>

                            <Button
                                size="sm"
                                variant="secondary"
                                isIconOnly
                                aria-label={sortOrder === 'desc' ? t('sortNewestFirst') : t('sortOldestFirst')}
                                className="shrink-0 bg-surface! border-surface!"
                                onClick={() => setSortOrder(o => o === 'desc' ? 'asc' : 'desc')}
                            >
                                {sortOrder === 'desc' ? <ArrowDownWideNarrow size={15} /> : <ArrowUpWideNarrow size={15} />}
                            </Button>

                            <div ref={filterAnchorRef} className="relative shrink-0">
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    className="relative bg-surface! border-surface!"
                                    onClick={() => setFilterOpen(v => !v)}
                                >
                                    <ListFilter size={14} />
                                    {tFilter('filterButton')}
                                </Button>
                                {filterOpen && filterMenuPos && createPortal(
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => { setFilterOpen(false); setPendingFilterKey(null); }} />
                                        <div
                                            style={{ position: 'fixed', top: filterMenuPos.top, left: filterMenuPos.left, right: filterMenuPos.right, zIndex: 50 }}
                                            className="bg-card border border-border rounded-xl shadow-md p-2 flex flex-col gap-1 min-w-48"
                                        >
                                        {filterFields.map(field => (
                                            <div key={field.key} className="relative">
                                                <button
                                                    className={`w-full text-start text-sm px-3 py-1.5 rounded-lg transition-colors flex items-center justify-between ${pendingFilterKey === field.key ? "bg-primary/10 text-primary" : "hover:bg-default"}`}
                                                    onClick={() => setPendingFilterKey(pendingFilterKey === field.key ? null : field.key)}
                                                >
                                                    {field.label}
                                                    <ChevronRight size={14} className="text-muted-foreground shrink-0 rtl:rotate-180" />
                                                </button>

                                                {pendingFilterKey === field.key && (
                                                    <div className="absolute z-30 ltr:left-full rtl:right-full top-0 ltr:ml-1 rtl:mr-1 bg-card border border-border rounded-xl shadow-md p-3 flex flex-col gap-3 min-w-56">
                                                        <div className={`flex flex-col gap-0.5 max-h-48 overflow-y-auto ${scrollbarCls}`}>
                                                            {field.options.map(option => (
                                                                <label
                                                                    key={option}
                                                                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-default cursor-pointer text-sm select-none"
                                                                >
                                                                    <input
                                                                        type="checkbox"
                                                                        checked={field.selected.includes(option)}
                                                                        onChange={e => {
                                                                            const next = e.target.checked
                                                                                ? [...field.selected, option]
                                                                                : field.selected.filter(v => v !== option);
                                                                            field.onChange(next);
                                                                        }}
                                                                        className="rounded"
                                                                    />
                                                                    {field.optionLabel ? field.optionLabel(option) : option}
                                                                </label>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                        </div>
                                    </>,
                                    document.body
                                )}
                            </div>
                        </div>

                        {hasActiveFilters && (
                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                                {filterFields.filter(field => field.selected.length > 0).map(field => (
                                    <div key={field.key} className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm border border-primary/20">
                                        <span className="font-medium">{field.label}:</span>
                                        <span>{field.selected.map(v => field.optionLabel ? field.optionLabel(v) : v).join(', ')}</span>
                                        <button
                                            className="ms-0.5 hover:text-destructive transition-colors leading-none"
                                            onClick={() => field.onChange([])}
                                        >✕</button>
                                    </div>
                                ))}
                                <Button size="sm" variant="ghost" onClick={clearAllFilters}>
                                    {tFilter('clearAll')}
                                </Button>
                            </div>
                        )}

                        <div className="flex items-center justify-between gap-2 mt-2">
                            <span className="text-xs text-muted-foreground">
                                {t('conversationCount', { count: filteredThreads.length })}
                            </span>
                            <Button
                                size="sm"
                                variant="secondary"
                                className="gap-1.5 bg-surface! border-surface!"
                                isDisabled={filteredThreads.length === 0}
                                onClick={() => setBroadcastOpen(true)}
                            >
                                <Megaphone size={13} />
                                {t('broadcastButton')}
                            </Button>
                        </div>
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
                                            variant={(search || hasActiveFilters) ? "search" : "firstTime"}
                                            title={(search || hasActiveFilters) ? t('noResults') : t('noConversations')}
                                            action={(search || hasActiveFilters) ? {
                                                label: hasActiveFilters ? tFilter('clearAll') : tFilter('clearSearch'),
                                                onPress: () => { setSearch(''); clearAllFilters(); },
                                            } : undefined}
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
                                                                <MessageRow
                                                                    key={msg.id}
                                                                    message={msg}
                                                                    t={t}
                                                                    isOwn={isTeam}
                                                                    radiusClass={bubbleRadius(isTeam, pos)}
                                                                    canManage={isTeam && !msg.deleted_at}
                                                                    onEditStart={m => setEditingMessage({ id: m.id, body: m.body || '' })}
                                                                    onDelete={handleDeleteMessage}
                                                                />
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
                                    <MessageComposer
                                        t={t}
                                        editingMessage={editingMessage}
                                        onCancelEdit={() => setEditingMessage(null)}
                                        onSaveEdit={handleSaveEdit}
                                        onSendText={handleSendText}
                                        onSendAttachment={handleSendAttachment}
                                    />
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

                                    {/* Recent Observations — durable coaching notes, kept visually
                                        distinct from the conversation itself (see product vision:
                                        an observation is knowledge, not a message). */}
                                    <Separator className="mt-4 mb-4 shrink-0" />
                                    <div className="shrink-0">
                                        <div className="flex items-center justify-between mb-2">
                                            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                <NotebookText size={12} />
                                                {t('recentObservations')}
                                            </p>
                                            <Button
                                                isIconOnly
                                                variant="ghost"
                                                size="sm"
                                                aria-label={t('addObservation')}
                                                title={t('addObservation')}
                                                onPress={() => { setEditingObservation(null); setObservationModalOpen(true); }}
                                            >
                                                <Plus size={14} />
                                            </Button>
                                        </div>
                                        {recentObservations.length === 0 ? (
                                            <p className="text-xs text-muted-foreground">{t('noObservationsYet')}</p>
                                        ) : (
                                            <div className="flex flex-col gap-1.5 mb-2">
                                                {recentObservations.map(o => (
                                                    <ObservationCard
                                                        key={o.id}
                                                        observation={o}
                                                        clientId={clientProfile.id}
                                                        currentUserId={me?.userId}
                                                        isOwner={me?.currentWorkspace?.role === 'owner'}
                                                        onEdit={(obs) => { setEditingObservation(obs); setObservationModalOpen(true); }}
                                                        onDeleted={(deletedId) => setRecentObservations(prev => prev.filter(x => x.id !== deletedId))}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                        <Link
                                            href={`/${workspaceSlug}/clients/${clientProfile.id}/observations`}
                                            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                                        >
                                            {t('viewAllObservations')}
                                        </Link>
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
            <ObservationModal
                open={observationModalOpen}
                onClose={() => setObservationModalOpen(false)}
                clientId={clientProfile?.id}
                observation={editingObservation}
                onCreated={(obs) => setRecentObservations(prev => [obs, ...prev].slice(0, 2))}
                onUpdated={(updated) => setRecentObservations(prev => prev.map(x => x.id === updated.id ? updated : x))}
            />

            <BroadcastMessageModal
                open={broadcastOpen}
                onClose={() => setBroadcastOpen(false)}
                threadIds={filteredThreads.map(thread => thread.id)}
                onSuccess={() => fetchThreads()}
            />
        </div>
    );
}
