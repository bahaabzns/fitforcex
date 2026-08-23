"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import { LogOut, MessageSquarePlus, ChevronLeft, ChevronRight, CreditCard } from 'lucide-react';
import { useTranslations, useLocale } from "next-intl";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import FeedbackEntryModal from "@/app/components/insights/FeedbackEntryModal";
import NewFeatureTooltip from "@/app/components/NewFeatureTooltip";
import { Avatar } from "@heroui/react/avatar";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";
import { Modal } from "@heroui/react/modal";
import { Chip } from "@heroui/react/chip";
import { usePageTitle } from "@/hooks/usePageTitle";

function subStatusColor(status) {
    switch (status) {
        case "Active":    return "bg-green-500/15 text-green-600";
        case "Expired":   return "bg-destructive/10 text-destructive";
        case "Frozen":    return "bg-accent/15 text-accent";
        case "Pre-start": return "bg-yellow-500/15 text-yellow-600";
        default:          return "bg-secondary text-muted-foreground";
    }
}

export default function ClientProfilePage() {
    const t = useTranslations('portal.profile');
    const tInsights = useTranslations('insights');
    const tSub = useTranslations('portal.subscription');
    usePageTitle(t('title'));
    const locale = useLocale();
    const isRTL = locale === 'ar';
    const [client, setClient] = useState(null);
    const [subscription, setSubscription] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [feedbackOpen, setFeedbackOpen] = useState(false);
    const router = useRouter();

    useEffect(() => {
        api.get("/api/client-portal/me")
            .then(res => { setClient(res.data); setLoading(false); })
            .catch(() => setLoading(false));
        api.get("/api/client-portal/subscription")
            .then(res => setSubscription(res.data))
            .catch(() => {});
    }, []);

    const subStatusLabels = {
        Active: tSub('statusActive'), Expired: tSub('statusExpired'),
        Frozen: tSub('statusFrozen'), "Pre-start": tSub('statusPreStart'),
    };

    const handleLogout = async () => {
        await api.post("/api/client-portal/logout").catch(() => {});
        router.push("/portal");
    };

    const getInitials = (c) => {
        if (!c) return "?";
        return `${c.fname?.[0] ?? ""}${c.lname?.[0] ?? ""}`.toUpperCase();
    };

    return (
        <div className="max-w-lg mx-auto p-6 flex flex-col gap-5">

            {/* Profile identity */}
            <div className="flex flex-col items-center gap-3 py-6">
                {loading ? (
                    <>
                        <Skeleton className="w-20 h-20 rounded-full" />
                        <Skeleton className="h-5 w-36 rounded-md" />
                        <Skeleton className="h-4 w-24 rounded-md" />
                    </>
                ) : (
                    <>
                        <Avatar color="primary" className="w-20 h-20 text-2xl">
                            <Avatar.Fallback>{getInitials(client)}</Avatar.Fallback>
                        </Avatar>
                        <div className="flex flex-col items-center gap-0.5">
                            <h1 className="text-xl font-bold text-foreground">
                                {client?.fname} {client?.lname}
                            </h1>
                            {client?.email && (
                                <p className="text-sm text-muted-foreground">{client.email}</p>
                            )}
                            {client?.client_code && (
                                <p className="text-xs text-muted-foreground mt-0.5">#{client.client_code}</p>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Subscription */}
            <div
                role="button"
                tabIndex={0}
                onClick={() => router.push('/portal/subscription')}
                onKeyDown={(e) => { if (e.key === 'Enter') router.push('/portal/subscription'); }}
                className="flex items-center justify-between px-4 py-3 rounded-2xl bg-secondary cursor-pointer"
            >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <CreditCard size={16} className="text-muted-foreground" />
                    {tSub('cardLabel')}
                    {subscription?.plan?.name && (
                        <span className="text-muted-foreground font-normal">— {subscription.plan.name}</span>
                    )}
                </span>
                <div className="flex items-center gap-2">
                    {subscription?.status && subStatusLabels[subscription.status] && (
                        <Chip size="sm" className={subStatusColor(subscription.status)}>
                            {subStatusLabels[subscription.status]}
                        </Chip>
                    )}
                    {isRTL
                        ? <ChevronLeft size={16} className="text-muted-foreground" />
                        : <ChevronRight size={16} className="text-muted-foreground" />}
                </div>
            </div>

            {/* Preferences */}
            <div className="flex flex-col gap-0.5">
                <p className="px-1 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('preferences')}
                </p>

                {/* Appearance row */}
                <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-secondary">
                    <span className="text-sm font-medium text-foreground">{t('appearance')}</span>
                    <ThemeToggle />
                </div>

                {/* Language row */}
                <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-secondary">
                    <span className="text-sm font-medium text-foreground">{t('language')}</span>
                    <LanguageSwitcher />
                </div>
            </div>

            {/* Feedback entry point — opt-in only, never a popup */}
            <NewFeatureTooltip
                featureKey="feedback_entry_hint"
                active
                message={tInsights('hint')}
                dismissLabel={tInsights('hintDismiss')}
                badgeLabel={tInsights('newFeature')}
                onTriggerClick={() => setFeedbackOpen(true)}
                triggerClassName="flex items-center justify-between px-4 py-3 rounded-2xl bg-secondary cursor-pointer"
            >
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    <MessageSquarePlus size={16} className="text-muted-foreground" />
                    {tInsights('navLabel')}
                </span>
                {isRTL
                    ? <ChevronLeft size={16} className="text-muted-foreground" />
                    : <ChevronRight size={16} className="text-muted-foreground" />}
            </NewFeatureTooltip>

            <FeedbackEntryModal
                open={feedbackOpen}
                onClose={() => setFeedbackOpen(false)}
                submitUrl="/api/client-portal/insights"
                screenshotUploadUrl="/api/client-portal/insights/screenshot"
            />

            {/* Logout */}
            <Button
                variant="danger-soft"
                size="md"
                fullWidth
                onClick={() => setShowLogoutConfirm(true)}
                className="mt-2"
            >
                <LogOut size={16} className="shrink-0" />
                {t('logout')}
            </Button>

            {/* Logout confirmation */}
            <Modal isOpen={showLogoutConfirm} onOpenChange={(o) => !o && setShowLogoutConfirm(false)}>
                <Modal.Backdrop>
                    <Modal.Container className="max-w-sm">
                        <Modal.Dialog>
                            <Modal.Header>
                                <Modal.Heading>{t('logoutConfirmTitle')}</Modal.Heading>
                                <Modal.CloseTrigger />
                            </Modal.Header>
                            <Modal.Body>
                                <p className="text-sm text-muted-foreground">{t('logoutConfirmMessage')}</p>
                            </Modal.Body>
                            <Modal.Footer className="flex justify-end gap-2 pt-2">
                                <Button size="sm" variant="ghost" onClick={() => setShowLogoutConfirm(false)}>
                                    {t('cancel')}
                                </Button>
                                <Button size="sm" variant="danger" onClick={handleLogout}>
                                    {t('logout')}
                                </Button>
                            </Modal.Footer>
                        </Modal.Dialog>
                    </Modal.Container>
                </Modal.Backdrop>
            </Modal>
        </div>
    );
}
