"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import api from "@/lib/axios";
import { useLocale, useTranslations } from "next-intl";
import { getLocalizedField } from "@/utils/localization";
import { useDateFormatter } from "@/utils/useDateFormatter";
import { Clock, CheckCircle, ClipboardList, CalendarClock } from 'lucide-react';
import { Skeleton } from "@heroui/react/skeleton";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { usePageTitle } from "@/hooks/usePageTitle";
import { setSeenIds } from "@/lib/lastSeenStore";

// A request that still needs the client's attention — mirrors
// formRequestNeedsAction in the mobile app (shared/models/form.dart).
const ACTIONABLE_STATUSES = new Set(["pending", "scheduled"]);

export default function ClientFormsListPage() {
    const t = useTranslations('portal.forms');
    usePageTitle(t('title'));
    const locale = useLocale();
    const { formatDate, formatDateTime } = useDateFormatter();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState("pending");
    const [isPageScrolled, setIsPageScrolled] = useState(false);

    useEffect(() => {
        api.get("/api/client-portal/form-requests")
            .then(res => setRequests(res.data))
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    // Clears the bottom-nav Forms dot — every currently-actionable request is
    // "seen" once this page has loaded it, even if still unfilled (the dot
    // means "new," not "incomplete"). Runs only after the fetch settles, so
    // it never briefly wipes previously-seen ids with an empty set while
    // `requests` still holds its initial []. Matches formRequestNeedsAction +
    // formsSeenProvider.markSeen in the mobile app (forms_page.dart).
    useEffect(() => {
        if (loading) return;
        const actionable = new Set(requests.filter(r => ACTIONABLE_STATUSES.has(r.status)).map(r => r.id));
        setSeenIds('forms', actionable);
    }, [loading, requests]);

    useEffect(() => {
        function handleScroll() { setIsPageScrolled(window.scrollY > 4); }
        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const filtered = requests.filter((r) => {
        if (filter === "pending") return r.status === "pending";
        if (filter === "submitted") return r.status === "submitted" || r.status === "reviewed";
        return true;
    });
    const pendingCount = requests.filter(r => r.status === "pending").length;

    const tabs = [
        { key: "pending",   label: t('filterPending') },
        { key: "submitted", label: t('filterSubmitted') },
    ];

    if (loading) {
        return (
            <div className="max-w-4xl mx-auto p-6 flex flex-col gap-6">
                <Skeleton className="h-8 w-48 rounded-lg mx-auto" />
                <Skeleton className="h-10 rounded-full w-72 mx-auto" />
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto flex flex-col">

            {/* Sticky header */}
            <div className={`sticky top-14 z-30 bg-background px-6 pt-5 pb-4 flex flex-col gap-4 border-b transition-colors duration-200 ${isPageScrolled ? 'border-border' : 'border-transparent'}`}>
                <div className="flex items-center justify-center gap-3">
                    <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
                    {pendingCount > 0 && (
                        <Chip size="sm" className="bg-yellow-500/15 text-yellow-600">
                            {t('pendingChip', { count: pendingCount })}
                        </Chip>
                    )}
                </div>

                {/* Filter pills */}
                <div className="flex items-center justify-center gap-2 flex-wrap">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setFilter(tab.key)}
                            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium border transition-colors cursor-pointer ${
                                filter === tab.key
                                    ? "bg-primary border-primary text-primary-foreground"
                                    : "border-border text-muted-foreground hover:bg-default"
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Scrollable content */}
            <div className="px-6 pt-4 pb-6 flex flex-col gap-4">
                {filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center min-h-[40vh] gap-3 text-center">
                        <ClipboardList size={52} className="text-muted-foreground/25" />
                        <p className="text-xl font-semibold text-foreground">
                            {filter === "submitted" ? t('emptySubmitted') : t('emptyPending')}
                        </p>
                        <p className="text-sm text-muted-foreground/60 text-center max-w-xs">{t('emptyHint')}</p>
                    </div>
                ) : (
                    <div className="flex flex-col gap-3">
                        {filtered.map(req => (
                            <Card key={req.id}>
                                <Card.Content className="px-4 py-3 flex items-center gap-4">
                                    <div className="flex-1 min-w-0">
                                        <p className="font-semibold text-sm text-foreground">
                                            {getLocalizedField(req, 'form_title', locale)}
                                        </p>
                                        {getLocalizedField(req, 'form_description', locale) && (
                                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                                {getLocalizedField(req, 'form_description', locale)}
                                            </p>
                                        )}
                                        <p className="text-[11px] text-muted-foreground/60 mt-1">
                                            {req.status === "scheduled" && req.scheduled_at
                                                ? `${t('filterScheduled')} ${formatDateTime(req.scheduled_at)}`
                                                : `${t('filterPending')} ${formatDate(req.requested_at)}`}
                                            {req.submitted_at && ` · ${t('filterSubmitted')} ${formatDate(req.submitted_at)}`}
                                        </p>
                                    </div>

                                    <div className="flex items-center gap-2 shrink-0">
                                        {req.status === "pending" ? (
                                            <>
                                                <Chip size="sm" className="bg-yellow-500/15 text-yellow-600">
                                                    <Clock size={11} className="mr-1" />{t('filterPending')}
                                                </Chip>
                                                <Link
                                                    href={`/portal/forms/${req.id}`}
                                                    className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-1.5 text-sm font-medium transition-colors cursor-pointer"
                                                >
                                                    {t('fillForm')}
                                                </Link>
                                            </>
                                        ) : req.status === "scheduled" ? (
                                            <>
                                                <Chip size="sm" className="bg-accent/15 text-accent">
                                                    <CalendarClock size={11} className="mr-1" />{t('filterScheduled')}
                                                </Chip>
                                                <span className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground">
                                                    {t('notOpenYet')}
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <Chip size="sm" className="bg-green-500/15 text-green-700">
                                                    <CheckCircle size={11} className="mr-1" />{t('filterSubmitted')}
                                                </Chip>
                                                <Link
                                                    href={`/portal/forms/${req.id}`}
                                                    className="text-xs px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
                                                >
                                                    {t('viewAnswers')}
                                                </Link>
                                            </>
                                        )}
                                    </div>
                                </Card.Content>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
