"use client";

import { Bell } from "lucide-react";
import { useTranslations } from "next-intl";

export default function ClientNotificationsPage() {
    const t = useTranslations('portal.notifications');

    return (
        <div className="max-w-lg mx-auto p-6 flex flex-col items-center justify-center min-h-[50vh] gap-3">
            <Bell size={52} className="text-muted-foreground/25" />
            <h1 className="text-xl font-semibold text-foreground">{t('title')}</h1>
            <p className="text-sm text-muted-foreground">{t('comingSoon')}</p>
            <p className="text-xs text-muted-foreground/60 text-center max-w-xs">{t('comingSoonHint')}</p>
        </div>
    );
}
