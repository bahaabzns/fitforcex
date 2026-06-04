'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@heroui/react/button';
import { Languages, Check } from 'lucide-react';
import api from '@/lib/axios';

const LANGS = [
    { code: 'en', label: 'English' },
    { code: 'ar', label: 'العربية' },
];

export default function LanguageSwitcher() {
    const locale = useLocale();
    const router = useRouter();
    const [switching, setSwitching] = useState(false);
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        function handler(e) {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        }
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    async function switchTo(lang) {
        if (lang === locale || switching) return;
        setSwitching(true);
        setOpen(false);
        try {
            await api.patch('/api/auth/profile', { preferred_language: lang });
        } catch {}
        document.cookie = `NEXT_LOCALE=${lang}; path=/; max-age=31536000; SameSite=Lax`;
        router.refresh();
        setSwitching(false);
    }

    return (
        <div className="relative" ref={ref}>
            <Button
                isIconOnly
                variant="ghost"
                size="sm"
                aria-label="Choose a language"
                onPress={() => setOpen(o => !o)}
                isDisabled={switching}
                className="shrink-0"
            >
                <Languages size={16} />
            </Button>

            {open && (
                <div className="absolute right-0 top-full mt-1 z-50 min-w-44 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                    <p className="text-xs font-medium text-muted-foreground px-3 py-2 border-b border-border">
                        Choose a language
                    </p>
                    {LANGS.map(lang => (
                        <button
                            key={lang.code}
                            onClick={() => switchTo(lang.code)}
                            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-foreground hover:bg-sidebar-accent transition-colors text-start"
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
