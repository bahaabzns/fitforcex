'use client';

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter, useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Bell, Check } from "lucide-react";
import { Button } from "@heroui/react/button";
import api from "@/lib/axios";

const UNREAD_POLL_MS = 15000;
const LIST_LIMIT     = 15;

// Notification rows store an English title (written server-side). We localise by
// `type` here and fall back to the stored title for any type we don't map yet.
function displayText(notification, t) {
    switch (notification.type) {
        case 'message.received':         return t('types.messageReceived');
        case 'plan.assigned':            return t('types.planAssigned');
        case 'checkin.submitted':        return t('types.checkinSubmitted');
        case 'client.created':           return t('types.clientCreated');
        case 'billing.payment_received': return t('types.paymentReceived');
        case 'billing.payment_failed':   return t('types.paymentFailed');
        default:                         return notification.title;
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
        setNow(Date.now());
        api.get(`/api/notifications?limit=${LIST_LIMIT}`)
            .then(res => setItems(Array.isArray(res.data) ? res.data : []))
            .catch(() => setItems([]))
            .finally(() => setLoading(false));
    }, []);

    const toggleOpen = () => {
        const next = !open;
        setOpen(next);
        if (next) fetchList();
    };

    const relativeTime = (iso) => {
        const diffSec = Math.round((now - new Date(iso).getTime()) / 1000);
        if (diffSec < 60) return t('timeJustNow');
        const rtf = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' });
        const min = Math.round(diffSec / 60);
        if (min < 60) return rtf.format(-min, 'minute');
        const hr = Math.round(min / 60);
        if (hr < 24) return rtf.format(-hr, 'hour');
        return rtf.format(-Math.round(hr / 24), 'day');
    };

    const markAllRead = async () => {
        try {
            await api.patch('/api/notifications/read-all');
            setItems(prev => prev.map(n => ({ ...n, read_at: n.read_at ?? new Date().toISOString() })));
            setUnread(0);
        } catch {}
    };

    const handleClick = async (notification) => {
        if (!notification.read_at) {
            try {
                await api.patch(`/api/notifications/${notification.id}/read`);
                setItems(prev => prev.map(n => (n.id === notification.id ? { ...n, read_at: new Date().toISOString() } : n)));
                setUnread(c => Math.max(0, c - 1));
            } catch {}
        }
        // The only coach-facing type today points at a message thread.
        if (notification.type === 'message.received' && workspaceSlug) {
            setOpen(false);
            router.push(`/${workspaceSlug}/messenger`);
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
                            <p className="px-3 py-6 text-center text-xs text-muted-foreground">{t('loading')}</p>
                        ) : items.length === 0 ? (
                            <div className="flex flex-col items-center gap-2 px-3 py-8">
                                <Bell size={28} className="text-muted-foreground/25" />
                                <p className="text-sm text-muted-foreground">{t('empty')}</p>
                            </div>
                        ) : (
                            <ul className="flex flex-col">
                                {items.map(n => (
                                    <li key={n.id}>
                                        <button
                                            onClick={() => handleClick(n)}
                                            className={`w-full flex items-start gap-2.5 px-3 py-2.5 text-start transition-colors hover:bg-sidebar-accent cursor-pointer ${
                                                n.read_at ? '' : 'bg-primary/5'
                                            }`}
                                        >
                                            {!n.read_at && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary shrink-0" />}
                                            <span className={`flex-1 min-w-0 ${n.read_at ? 'ps-4' : ''}`}>
                                                <span className="block text-sm text-foreground truncate">{displayText(n, t)}</span>
                                                <span className="block text-xs text-muted-foreground mt-0.5">{relativeTime(n.created_at)}</span>
                                            </span>
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
