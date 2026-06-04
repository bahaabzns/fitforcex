'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import api from '@/lib/axios';

export default function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const [switching, setSwitching] = useState(false);

    async function handleSwitch() {
        if (switching) return;
        const next = locale === 'en' ? 'ar' : 'en';
        setSwitching(true);
        try {
            // Persist preference to user account
            await api.patch('/api/auth/profile', { preferred_language: next });
        } catch {
            // Non-fatal — cookie still gets set so the UI switches
        }
        // Set NEXT_LOCALE cookie so the server reads it on next request
        document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000; SameSite=Lax`;
        router.refresh();
        setSwitching(false);
    }

    return (
        <button
            onClick={handleSwitch}
            disabled={switching}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-sm font-medium transition-colors text-muted-foreground hover:bg-sidebar-accent disabled:opacity-50"
            aria-label={locale === 'en' ? 'Switch to Arabic' : 'التبديل إلى الإنجليزية'}
        >
            <span className="text-base leading-none">{locale === 'en' ? '🇸🇦' : '🇬🇧'}</span>
            <span>{locale === 'en' ? 'العربية' : 'English'}</span>
        </button>
    );
}
