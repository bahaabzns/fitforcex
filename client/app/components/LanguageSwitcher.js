'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Languages, Check } from 'lucide-react';
import api from '@/lib/axios';
import { setLocaleCookie } from '@/lib/landingConfig';

const LANGS = [
    { code: 'en', label: 'English' },
    { code: 'ar', label: 'العربية' },
];

// Saves the choice to the profile and cookie, then refreshes so the whole app re-renders translated.
function useSwitchLanguage(onSwitching) {
    const locale = useLocale();
    const router = useRouter();
    const [switching, setSwitching] = useState(false);

    async function switchTo(lang) {
        if (lang === locale || switching) return;
        setSwitching(true);
        onSwitching?.();
        try {
            await api.patch('/api/auth/profile', { preferred_language: lang });
        } catch {}
        setLocaleCookie(lang);
        router.refresh();
        setSwitching(false);
    }

    return { locale, switching, switchTo };
}

// The language options as plain rows (no dropdown) — used inside bottom sheets.
export function LanguageList({ onSwitching }) {
    const { locale, switchTo } = useSwitchLanguage(onSwitching);
    return (
        <div className="flex flex-col">
            {LANGS.map(lang => (
                <button
                    key={lang.code}
                    type="button"
                    onClick={() => switchTo(lang.code)}
                    className="flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-lg px-3 text-start text-sm text-foreground transition-colors hover:bg-sidebar-accent"
                >
                    <span className="flex w-4 shrink-0 items-center justify-center">
                        {locale === lang.code && <Check size={14} className="text-primary" />}
                    </span>
                    {lang.label}
                </button>
            ))}
        </div>
    );
}

export default function LanguageSwitcher() {
    const tCommon  = useTranslations('common');
    const [open, setOpen] = useState(false);
    const { locale, switching, switchTo } = useSwitchLanguage(() => setOpen(false));
    const ref = useRef(null);

    useEffect(() => {
        function handler(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    return (
        <div className="relative" ref={ref}>
            <div className="flex items-center rounded-full p-0.5" style={{ backgroundColor: 'var(--color-default)' }}>
                <button
                    onClick={() => setOpen(o => !o)}
                    disabled={switching}
                    aria-label={tCommon('chooseLanguage')}
                    style={{ backgroundColor: 'var(--color-background)' }}
                    className="flex items-center justify-center w-7 h-7 rounded-full shrink-0 cursor-pointer transition-opacity text-foreground hover:opacity-90"
                >
                    <Languages size={14} />
                </button>
            </div>

            {open && (
                <div className="absolute ltr:right-0 rtl:left-0 top-full mt-1 z-50 min-w-44 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                    <p className="text-xs font-medium text-muted-foreground px-3 py-2 border-b border-border">
                        {tCommon('chooseLanguage')}
                    </p>
                    {LANGS.map(lang => (
                        <button
                            key={lang.code}
                            onClick={() => switchTo(lang.code)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-sidebar-accent transition-colors text-start cursor-pointer"
                        >
                            <span className="w-4 shrink-0 flex items-center justify-center">
                                {locale === lang.code && <Check size={13} className="text-primary" />}
                            </span>
                            {lang.label}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
