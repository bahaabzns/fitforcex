"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Bell, Check, MessageSquare, Dumbbell, Salad, ClipboardCheck, AlertTriangle, CheckCircle2, PartyPopper, MessageCircle } from "lucide-react";
import { Skeleton } from "@heroui/react/skeleton";
import { Avatar } from "@heroui/react/avatar";
import { Chip } from "@heroui/react/chip";
import { Separator } from "@heroui/react/separator";
import { Disclosure } from "@heroui/react/disclosure";
import EmptyState from "@/app/components/EmptyState";
import { sortByPriority, priorityAccentClass, groupNotifications, FILTER_KEYS, filterItems } from "@/utils/notifications";
import { getDateLabel } from "@/utils/date";
import { getInitials } from "@/utils/initials";
import api from "@/lib/axios";
import { usePageTitle } from "@/hooks/usePageTitle";

const LIST_LIMIT = 30;

const TYPE_ICON = {
    'message.received':        MessageSquare,
    'checkin.reviewed':        ClipboardCheck,
    'subscription.expired':    AlertTriangle,
    'subscription.frozen':     AlertTriangle,
    'subscription.reactivated': CheckCircle2,
    'insight.roadmap_shipped':  PartyPopper,
    'insight.roadmap_declined': MessageCircle,
};


// Leading visual for a card — the sender's avatar when we know who they are
// (message.received), a training/nutrition icon for plan.assigned depending on
// which plan it is, otherwise a category icon.
function NotificationIcon({ notification }) {
    const initials = getInitials(notification.metadata?.actorName);
    if (initials) {
        return (
            <Avatar size="sm" color="primary" className="shrink-0">
                <Avatar.Fallback>{initials}</Avatar.Fallback>
            </Avatar>
        );
    }
    const Icon = notification.type === 'plan.assigned'
        ? (notification.entity_type === 'nutrition_plan' ? Salad : Dumbbell)
        : (TYPE_ICON[notification.type] ?? Bell);
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
function NotificationRow({ notification, cta, onClick, now, locale, t, tTypes }) {
    return (
        <button
            onClick={onClick}
            className={`w-full flex items-start gap-2.5 px-3 py-3 rounded-xl text-start transition-colors hover:bg-sidebar-accent cursor-pointer ${priorityAccentClass(notification)} ${
                notification.read_at ? '' : 'bg-primary/5'
            }`}
        >
            <NotificationIcon notification={notification} />
            {!notification.read_at && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />}
            <span className={`flex-1 min-w-0 ${notification.read_at ? 'ps-4' : ''}`}>
                <span className="block text-sm text-foreground">{displayText(notification, tTypes)}</span>
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

// Header label for a collapsed group (see groupNotifications in @/utils/notifications).
// checkin.submitted never reaches a client, so in practice only message threads group here.
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

// Mirrors NotificationBell.js's displayText/getDestination — same event types,
// same actor_type-based direction, scoped to what a client can ever receive.
function displayText(notification, tTypes) {
    switch (notification.type) {
        case 'message.received':
            return notification.actor_type === 'client'
                ? tTypes('messageReceivedFromClient')
                : tTypes('messageReceivedFromCoach');
        case 'plan.assigned':             return tTypes('planAssigned');
        case 'checkin.reviewed':          return tTypes('checkinReviewed');
        case 'subscription.expired':      return tTypes('yourSubscriptionExpired');
        case 'subscription.frozen':       return tTypes('yourSubscriptionFrozen');
        case 'subscription.reactivated':  return tTypes('yourSubscriptionReactivated');
        default:                          return notification.title;
    }
}

function getDestination(notification) {
    switch (notification.type) {
        case 'message.received':         return '/portal/messages';
        case 'plan.assigned':            return notification.entity_type === 'nutrition_plan' ? '/portal/nutrition' : '/portal/training';
        case 'checkin.reviewed':         return notification.entity_id ? `/portal/forms/${notification.entity_id}` : '/portal/forms';
        case 'subscription.expired':
        case 'subscription.frozen':
        case 'subscription.reactivated': return '/portal/home';
        default:                         return null;
    }
}

// The primary call-to-action label shown on each card — tells the client what
// clicking it will let them do, not just where it goes.
function ctaLabel(notification, t) {
    switch (notification.type) {
        case 'message.received':         return t('cta.reply');
        case 'plan.assigned':            return t('cta.viewPlan');
        case 'checkin.reviewed':         return t('cta.viewFeedback');
        case 'subscription.expired':
        case 'subscription.frozen':
        case 'subscription.reactivated': return t('cta.viewDetails');
        default:                         return null;
    }
}

export default function ClientNotificationsPage() {
    const t = useTranslations('portal.notifications');
    const tTypes = useTranslations('notifications.types');
    usePageTitle(t('title'));
    const locale = useLocale();
    const router = useRouter();

    const [items, setItems]     = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError]     = useState(false);
    const [now, setNow]         = useState(0);
    const [filter, setFilter]   = useState('all');

    const fetchList = useCallback(() => {
        setLoading(true);
        setError(false);
        setNow(Date.now());
        api.get(`/api/client-portal/notifications?limit=${LIST_LIMIT}`)
            .then(res => setItems(sortByPriority(Array.isArray(res.data) ? res.data : [])))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => { fetchList(); }, [fetchList]);

    const markAllRead = async () => {
        try {
            await api.patch('/api/client-portal/notifications/read-all');
            setItems(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
        } catch {}
    };

    // Marks one notification read without navigating — shared by a single
    // card's click and by "mark group read" (which never navigates, since a
    // group has no single destination).
    const markOneRead = async (notification) => {
        if (notification.read_at) return;
        try {
            await api.patch(`/api/client-portal/notifications/${notification.id}/read`);
            setItems(prev => prev.map(n => (n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n)));
        } catch {}
    };

    const markGroupRead = async (group) => {
        await Promise.all(group.filter(n => !n.read_at).map(markOneRead));
    };

    const handleClick = async (notification) => {
        await markOneRead(notification);
        const destination = getDestination(notification);
        if (destination) router.push(destination);
    };

    const unreadCount = items.filter(n => !n.read_at).length;

    return (
        <div className="max-w-lg mx-auto p-4 pb-24">
            <div className="flex items-center justify-between px-1 py-3">
                <h1 className="text-lg font-semibold text-foreground">{t('title')}</h1>
                {unreadCount > 0 && (
                    <button
                        onClick={markAllRead}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                    >
                        <Check size={12} />
                        {t('markAllRead')}
                    </button>
                )}
            </div>

            {loading ? (
                <div className="flex flex-col gap-2 px-1">
                    {[0, 1, 2].map(i => <Skeleton key={i} className="h-14 rounded-xl" />)}
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
                    description={t('emptyHint')}
                />
            ) : (
                <>
                <div className="flex items-center gap-1.5 px-1 py-2 overflow-x-auto">
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
                <ul className="flex flex-col gap-1">
                    {groupNotifications(filtered).map(node => {
                        const representative = node.kind === 'group' ? node.items[0] : node.item;
                        const dayLabel = getDateLabel(representative.created_at, locale, { today: t('today'), yesterday: t('yesterday') });
                        const showDayHeader = dayLabel !== lastDayLabel;
                        lastDayLabel = dayLabel;
                        const dayHeader = showDayHeader && (
                            <div className="flex items-center gap-2 px-1 pt-3 pb-1">
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
                                        now={now} locale={locale} t={t} tTypes={tTypes}
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
                                        <Disclosure.Trigger className="flex-1 min-w-0 flex items-start gap-2.5 px-3 py-3 rounded-xl text-start transition-colors hover:bg-sidebar-accent cursor-pointer">
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
                                                    now={now} locale={locale} t={t} tTypes={tTypes}
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
    );
}
