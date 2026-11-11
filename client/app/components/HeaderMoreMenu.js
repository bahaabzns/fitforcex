'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageSquarePlus, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { ThemeToggle } from '@/app/components/ThemeToggle';
import LanguageSwitcher from '@/app/components/LanguageSwitcher';

// Phone-width home for the header controls that do not need to be one tap away (feedback, theme,
// language), so the top bar keeps only what matters: upgrade, getting started, notifications.
export default function HeaderMoreMenu({ onFeedback }) {
    const tInsights = useTranslations('insights');
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        function closeOnOutside(event) { if (ref.current && !ref.current.contains(event.target)) setOpen(false); }
        function closeOnEscape(event) { if (event.key === 'Escape') setOpen(false); }
        document.addEventListener('mousedown', closeOnOutside);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('mousedown', closeOnOutside);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [open]);

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(current => !current)}
                aria-haspopup="menu"
                aria-expanded={open}
                aria-label={tInsights('navLabel')}
                className="button button--icon-only button--sm button--ghost inline-flex!"
            >
                <MoreHorizontal size={16} />
            </button>

            {open && (
                <div role="menu" className="absolute end-0 top-full z-50 mt-2 flex w-60 flex-col gap-2 rounded-xl border border-border bg-card p-2 shadow-xl">
                    <button
                        type="button"
                        role="menuitem"
                        onClick={() => { setOpen(false); onFeedback(); }}
                        className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-start text-sm text-foreground transition-colors hover:bg-sidebar-accent"
                    >
                        <MessageSquarePlus size={16} aria-hidden="true" />
                        {tInsights('navLabel')}
                    </button>
                    <div className="flex items-center justify-between gap-2 border-t border-border px-3 pt-2">
                        <ThemeToggle />
                        <LanguageSwitcher />
                    </div>
                </div>
            )}
        </div>
    );
}
