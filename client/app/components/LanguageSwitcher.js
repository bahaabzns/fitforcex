'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState, useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { Languages, Check } from 'lucide-react';
import api from '@/lib/axios';

const LANGS = [
    { code: 'en', label: 'English' },
    { code: 'ar', label: 'العربية' },
];

export default function LanguageSwitcher() {
    const locale   = useLocale();
    const router   = useRouter();
    const { resolvedTheme } = useTheme();
    const [switching, setSwitching] = useState(false);
    const [open, setOpen]           = useState(false);
    const [mounted, setMounted]     = useState(false);
    const ref = useRef(null);

    useEffect(() => setMounted(true), []);

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

    const isDark    = mounted && resolvedTheme === 'dark';
    const pillBg    = isDark ? 'lab(15.7305% .613764 -2.16959)' : '#e5e7eb';
    const btnBg     = isDark ? '#2c2c2c' : '#ffffff';
    const btnHover  = isDark ? '#383838' : '#f3f4f6';
    const btnText   = isDark ? 'text-white' : 'text-foreground';

    return (
        <div className="relative" ref={ref}>
            <div className="flex items-center rounded-full p-0.5" style={{ backgroundColor: pillBg }}>
                <button
                    onClick={() => setOpen(o => !o)}
                    disabled={switching}
                    aria-label="Choose a language"
                    style={{ backgroundColor: btnBg }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = btnHover; }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = btnBg; }}
                    className={`flex items-center justify-center w-7 h-7 rounded-full shrink-0 cursor-pointer transition-colors ${btnText}`}
                >
                    <Languages size={14} />
                </button>
            </div>

            {open && (
                <div className="absolute right-0 top-full mt-1 z-50 min-w-44 bg-card border border-border rounded-xl shadow-xl overflow-hidden">
                    <p className="text-xs font-medium text-muted-foreground px-3 py-2 border-b border-border">
                        Choose a language
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
