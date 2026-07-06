'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Bell, Check, MessageSquare, ClipboardList, UserPlus, Wallet, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";
import { Avatar } from "@heroui/react/avatar";
import { Chip } from "@heroui/react/chip";
import { Separator } from "@heroui/react/separator";
import { Disclosure } from "@heroui/react/disclosure";
import EmptyState from "@/app/components/EmptyState";
import { sortByPriority, priorityAccentClass, groupNotifications, FILTER_KEYS, filterItems } from "@/utils/notifications";
import { getDateLabel } from "@/utils/date";
import api from "@/lib/axios";

const UNREAD_POLL_MS = 15000;
const LIST_LIMIT     = 15;

// System-event icon per type — shown in a muted circle, same visual language as
// EmptyState's icon treatment. Person-triggered types (message.received,
// checkin.submitted) fall back to these only when metadata.actorName is missing
// (older rows recorded before this field existed); otherwise they get an Avatar.
const TYPE_ICON = {
    'message.received':         MessageSquare,
    'checkin.submitted':        ClipboardList,
    'checkin.assigned':         ClipboardList,
    'client.created':           UserPlus,
    'billing.payment_received': Wallet,
    'billing.payment_failed':   Wallet,
    'subscription.expired':     AlertTriangle,
    'subscription.frozen':      AlertTriangle,
    'subscription.reactivated': CheckCircle2,
};

function getInitials(name) {
    if (!name) return null;
    const parts = name.trim().split(/\s+/);
    const initials = `${parts[0]?.[0] ?? ''}${parts[1]?.[0] ?? ''}`.toUpperCase();
    return initials || null;
}

// Leading visual for a card — the sender's avatar when we know who they are,
// otherwise a category icon (same fallback for legacy rows recorded before
// metadata.actorName existed).
function NotificationIcon({ notification }) {
    const initials = getInitials(notification.metadata?.actorName);
    if (initials) {
        return (
            <Avatar size="sm" color="primary" className="shrink-0">
                <Avatar.Fallback>{initials}</Avatar.Fallback>
            </Avatar>
        );
    }
    const Icon = TYPE_ICON[notification.type] ?? Bell;
    return (
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted/40 text-muted-foreground shrink-0">
            <Icon size={16} strokeWidth={1.75} />
        </div>
    );
}

function relativeTimeFor(iso, now, locale, t) {
    const diffSec = Math.round((now - new Date(iso).getTime()) / 1000);
    if (diffSec < 60) return t('timeJustNow');
    const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
    const min = Math.round(diffSec / 60);
    if (min < 60) return rtf.format(-min, 'minute');
    const hr = Math.round(min / 60);
    if (hr < 24) return rtf.format(-hr, 'hour');
    return rtf.format(-Math.round(hr / 24), 'day');
}

// A single notification row — used both standalone and for each item inside an
// expanded group, so the two never visually drift apart.
function NotificationRow({ notification, cta, onClick, now, locale, t }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-start transition-colors hover:bg-sidebar-accent cursor-pointer ${priorityAccentClass(notification)} ${
                notification.read_at ? '' : 'bg-primary/5'
            }`}
        >
            <NotificationIcon notification={notification} />
            {!notification.read_at && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />}
            <span className={`flex-1 min-w-0 ${notification.read_at ? 'ps-4' : ''}`}>
                <span className="block text-sm text-foreground truncate">{displayText(notification, t)}</span>
                <span className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-muted-foreground">{relativeTimeFor(notification.created_at, now, locale, t)}</span>
                    {cta && (
                        <>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-xs font-medium text-primary">{cta}</span>
                        </>
                    )}
                </span>
            </span>
        </button>
    );
}

// Notification rows store an English title (written server-side). We localise by
// `type` here and fall back to the stored title for any type we don't map yet.
//
// Note: 'plan.assigned' is intentionally absent — recordEvent only ever lists the
// client as its recipient (training.controller.ts / nutrition.controller.ts), and
// this bell's own /api/notifications is scoped to recipient_type: 'user', so a
// coach can never receive one. A case for it here would be dead code.
function displayText(notification, t) {
    switch (notification.type) {
        // 'message.received' is recorded for both directions (coach->client and
        // client->coach) — actor_type tells us which one this recipient got.
        case 'message.received':         return notification.actor_type === 'client'
            ? t('types.messageReceivedFromClient')
            : t('types.messageReceivedFromCoach');
        case 'checkin.submitted':        return t('types.checkinSubmitted');
        case 'checkin.assigned':         return t('types.checkinAssigned');
        case 'client.created':           return t('types.clientCreated');
        case 'billing.payment_received': return t('types.paymentReceived');
        case 'billing.payment_failed':   return t('types.paymentFailed');
        case 'subscription.expired':     return t('types.subscriptionExpired');
        case 'subscription.frozen':      return t('types.subscriptionFrozen');
        case 'subscription.reactivated': return t('types.subscriptionReactivated');
        default:                         return notification.title;
    }
}

// The primary call-to-action label shown on each card — tells the coach what
// clicking it will let them do, not just where it goes.
function ctaLabel(notification, t) {
    switch (notification.type) {
        case 'message.received':         return t('cta.reply');
        case 'checkin.submitted':        return t('cta.reviewCheckin');
        case 'checkin.assigned':         return t('cta.startReview');
        case 'client.created':           return t('cta.viewClient');
        case 'billing.payment_received': return t('cta.viewInvoice');
        case 'billing.payment_failed':   return t('cta.updatePayment');
        case 'subscription.expired':
        case 'subscription.frozen':
        case 'subscription.reactivated': return t('cta.viewClient');
        default:                         return null;
    }
}

// Header label for a collapsed group (see groupNotifications in @/utils/notifications).
function groupLabel(group, t) {
    const first = group.items[0];
    if (first.type === 'message.received') {
        const name = first.metadata?.actorName;
        return name
            ? t('groupMessagesFrom', { count: group.items.length, name })
            : t('groupMessages', { count: group.items.length });
    }
    return t('groupCheckins', { count: group.items.length });
}

// Where clicking a notification should take the coach, built from the entity
// the event pointed at (entity_type/entity_id) rather than one hardcoded case.
function getDestination(notification, workspaceSlug) {
    if (!workspaceSlug) return null;
    const { type, entity_id, metadata } = notification;

    switch (type) {
        case 'message.received':
            return notification.entity_type === 'thread' && entity_id
                ? `/${workspaceSlug}/messenger?threadId=${entity_id}`
                : `/${workspaceSlug}/messenger`;
        case 'checkin.submitted':
        case 'checkin.assigned':
            // Land on the specific client's check-ins once we know which client;
            // fall back to the generic queue for older rows recorded before this.
            return metadata?.clientId
                ? `/${workspaceSlug}/clients/${metadata.clientId}/forms`
                : `/${workspaceSlug}/plans-queue`;
        case 'client.created':
        case 'subscription.expired':
        case 'subscription.frozen':
        case 'subscription.reactivated':
            return entity_id ? `/${workspaceSlug}/clients/${entity_id}` : null;
        case 'billing.payment_received':
        case 'billing.payment_failed':
            return `/${workspaceSlug}/settings/billing`;
        default:
            return null;
    }
}

export default function NotificationBell() {
    const t = useTranslations('notifications');
    const locale = useLocale();
    const router = useRouter();
    const { workspaceSlug } = useParams();

    const [open, setOpen]       = useState(false);
    const [items, setItems]     = useState([]);
    const [unread, setUnread]   = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError]     = useState(false);
    const [filter, setFilter]   = useState('all');
    // Reference timestamp for relative-time labels, captured when the list loads
    // (not read during render — keeps the component render-pure).
    const [now, setNow]         = useState(0);
    const panelRef = useRef(null);

    const fetchUnread = useCallback(() => {
        api.get('/api/notifications/unread-count')
            .then(res => setUnread(res.data?.count ?? 0))
            .catch(() => {});
    }, []);

    // Badge poll — cheap COUNT, runs whether or not the panel is open.
    useEffect(() => {
        fetchUnread();
        const interval = setInterval(fetchUnread, UNREAD_POLL_MS);
        return () => clearInterval(interval);
    }, [fetchUnread]);

    // Outside-click close (mirrors the Sidebar workspace-switcher pattern).
    useEffect(() => {
        function handler(e) {
            if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const fetchList = useCallback(() => {
        setLoading(true);
        setError(false);
        setNow(Date.now());
        api.get(`/api/notifications?limit=${LIST_LIMIT}`)
            .then(res => setItems(sortByPriority(Array.isArray(res.data) ? res.data : [])))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, []);

    const toggleOpen = () => {
        const next = !open;
        setOpen(next);
        if (next) fetchList();
    };

    const markAllRead = async () => {
        try {
            await api.patch('/api/notifications/read-all');
            setItems(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
            setUnread(0);
        } catch {}
    };

    // Marks one notification read without navigating — shared by a single
    // card's click and by "mark group read" (which never navigates, since a
    // group has no single destination).
    const markOneRead = async (notification) => {
        if (notification.read_at) return;
        try {
            await api.patch(`/api/notifications/${notification.id}/read`);
            setItems(prev => prev.map(n => (n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n)));
            setUnread(c => Math.max(0, c - 1));
        } catch {}
    };

    const markGroupRead = async (group) => {
        await Promise.all(group.filter(n => !n.read_at).map(markOneRead));
    };

    const handleClick = async (notification) => {
        await markOneRead(notification);
        const destination = getDestination(notification, workspaceSlug);
        if (destination) {
            setOpen(false);
            router.push(destination);
        }
    };

    return (
        <div className="relative" ref={panelRef}>
            <Button
                isIconOnly
                size="sm"
                variant="ghost"
                onClick={toggleOpen}
                title={t('title')}
                aria-label={t('title')}
                className="relative text-muted-foreground hover:text-foreground"
            >
                <Bell size={16} />
                {unread > 0 && (
                    <span className="absolute -top-0.5 -inset-e-0.5 min-w-4 h-4 px-1 rounded-full bg-primary text-primary-foreground text-[9px] font-bold flex items-center justify-center leading-none">
                        {unread > 99 ? '99+' : unread}
                    </span>
                )}
            </Button>

            {open && (
                <div className="absolute inset-e-0 mt-2 w-80 max-w-[calc(100vw-2rem)] z-50 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                    <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
                        <span className="text-sm font-semibold text-foreground">{t('title')}</span>
                        {unread > 0 && (
                            <button
                                onClick={markAllRead}
                                className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                            >
                                <Check size={12} />
                                {t('markAllRead')}
                            </button>
                        )}
                    </div>

                    <div className="max-h-96 overflow-y-auto">
                        {loading ? (
                            <div className="flex flex-col gap-2 p-3">
                                {[0, 1, 2].map(i => <Skeleton key={i} className="h-12 rounded-lg" />)}
                            </div>
                        ) : error ? (
                            <EmptyState
                                variant="error"
                                title={t('errorTitle')}
                                description={t('errorHint')}
                                action={{ label: t('retry'), onPress: fetchList }}
                            />
                        ) : items.length === 0 ? (
                            <EmptyState
                                variant="firstTime"
                                icon={Bell}
                                title={t('empty')}
                            />
                        ) : (
                            <>
                            <div className="flex items-center gap-1.5 px-3 py-2 overflow-x-auto border-b border-border">
                                {FILTER_KEYS.map(key => (
                                    <button key={key} onClick={() => setFilter(key)} className="shrink-0 cursor-pointer">
                                        <Chip size="sm" variant={filter === key ? 'primary' : 'soft'}>
                                            {t(`filters.${key}`)}
                                        </Chip>
                                    </button>
                                ))}
                            </div>
                            {(() => {
                                const filtered = filterItems(items, filter);
                                if (filtered.length === 0) {
                                    return (
                                        <EmptyState
                                            variant="filter"
                                            title={t('noMatch')}
                                            action={{ label: t('clearFilter'), onPress: () => setFilter('all') }}
                                        />
                                    );
                                }
                                let lastDayLabel = null;
                                return (
                            <ul className="flex flex-col">
                                {groupNotifications(filtered).map(node => {
                                    const representative = node.kind === 'group' ? node.items[0] : node.item;
                                    const dayLabel = getDateLabel(representative.created_at, locale, { today: t('today'), yesterday: t('yesterday') });
                                    const showDayHeader = dayLabel !== lastDayLabel;
                                    lastDayLabel = dayLabel;
                                    const dayHeader = showDayHeader && (
                                        <div className="flex items-center gap-2 px-3 pt-2.5 pb-1">
                                            <span className="text-[11px] font-medium text-muted-foreground">{dayLabel}</span>
                                            <Separator className="flex-1" />
                                        </div>
                                    );

                                    if (node.kind === 'single') {
                                        return (
                                            <li key={node.item.id}>
                                                {dayHeader}
                                                <NotificationRow
                                                    notification={node.item}
                                                    cta={ctaLabel(node.item, t)}
                                                    onClick={() => handleClick(node.item)}
                                                    now={now} locale={locale} t={t}
                                                />
                                            </li>
                                        );
                                    }

                                    const unreadInGroup = node.items.filter(i => !i.read_at).length;
                                    return (
                                        <li key={node.key}>
                                            {dayHeader}
                                            <Disclosure defaultExpanded={false}>
                                                <Disclosure.Heading className="flex items-center">
                                                    <Disclosure.Trigger className="flex-1 min-w-0 flex items-start gap-2.5 px-3 py-2.5 text-start transition-colors hover:bg-sidebar-accent cursor-pointer">
                                                        <NotificationIcon notification={representative} />
                                                        {unreadInGroup > 0 && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />}
                                                        <span className={`flex-1 min-w-0 ${unreadInGroup === 0 ? 'ps-4' : ''}`}>
                                                            <span className="block text-sm text-foreground truncate">{groupLabel(node, t)}</span>
                                                            <span className="block text-xs text-muted-foreground mt-0.5">{relativeTimeFor(representative.created_at, now, locale, t)}</span>
                                                        </span>
                                                        <Disclosure.Indicator className="shrink-0 text-muted-foreground" />
                                                    </Disclosure.Trigger>
                                                    {unreadInGroup > 0 && (
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); markGroupRead(node.items); }}
                                                            title={t('markAllRead')}
                                                            className="shrink-0 p-1.5 me-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-sidebar-accent cursor-pointer"
                                                        >
                                                            <Check size={14} />
                                                        </button>
                                                    )}
                                                </Disclosure.Heading>
                                                <Disclosure.Content>
                                                    <Disclosure.Body className="p-0">
                                                        {node.items.map(item => (
                                                            <NotificationRow
                                                                key={item.id}
                                                                notification={item}
                                                                cta={ctaLabel(item, t)}
                                                                onClick={() => handleClick(item)}
                                                                now={now} locale={locale} t={t}
                                                            />
                                                        ))}
                                                    </Disclosure.Body>
                                                </Disclosure.Content>
                                            </Disclosure>
                                        </li>
                                    );
                                })}
                            </ul>
                                );
                            })()}
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
