'use client';

import { useEffect, useRef, useState } from 'react';
import { MessageSquarePlus, MoreHorizontal } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import AppModal from '@/app/components/Modal';
import { ThemeToggle } from '@/app/components/ThemeToggle';
import LanguageSwitcher, { LanguageList } from '@/app/components/LanguageSwitcher';

// Phone-width home for the header controls that do not need to be one tap away (feedback, theme,
// language), so the top bar keeps only what matters: upgrade, getting started, notifications.
// On a phone it opens as a bottom sheet (language as plain rows); between phone and desktop width
// it is a small dropdown.
export default function HeaderMoreMenu({ onFeedback }) {
    const tInsights = useTranslations('insights');
    const tCommon = useTranslations('common');
    const isPhone = useMediaQuery('(max-width: 639px)');
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        // The sheet lives in a portal, so "outside" clicks are handled by the modal itself.
        if (!open || isPhone) return;
        function closeOnOutside(event) { if (ref.current && !ref.current.contains(event.target)) setOpen(false); }
        function closeOnEscape(event) { if (event.key === 'Escape') setOpen(false); }
        document.addEventListener('mousedown', closeOnOutside);
        document.addEventListener('keydown', closeOnEscape);
        return () => {
            document.removeEventListener('mousedown', closeOnOutside);
            document.removeEventListener('keydown', closeOnEscape);
        };
    }, [open, isPhone]);

    function openFeedback() {
        setOpen(false);
        onFeedback();
    }

    return (
        <div className="relative" ref={ref}>
            <button
                type="button"
                onClick={() => setOpen(current => !current)}
                aria-haspopup={isPhone ? 'dialog' : 'menu'}
                aria-expanded={open}
                aria-label={tCommon('more')}
                className="button button--icon-only button--sm button--ghost inline-flex!"
            >
                <MoreHorizontal size={16} />
            </button>

            {open && !isPhone && (
                <div role="menu" className="absolute inset-e-0 top-full z-50 mt-2 flex w-60 flex-col gap-2 rounded-xl border border-border bg-card p-2 shadow-xl">
                    <button
                        type="button"
                        role="menuitem"
                        onClick={openFeedback}
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

            <AppModal open={open && isPhone} onClose={() => setOpen(false)} title={tCommon('more')} sheetOnMobile>
                <div className="flex flex-col gap-3 pb-2">
                    <button
                        type="button"
                        onClick={openFeedback}
                        className="flex min-h-12 items-center gap-3 rounded-lg px-3 text-start text-sm text-foreground transition-colors hover:bg-sidebar-accent"
                    >
                        <MessageSquarePlus size={18} aria-hidden="true" />
                        {tInsights('navLabel')}
                    </button>
                    <div className="flex justify-center border-t border-border pt-3">
                        <ThemeToggle />
                    </div>
                    <div className="border-t border-border pt-1">
                        <LanguageList onSwitching={() => setOpen(false)} />
                    </div>
                </div>
            </AppModal>
        </div>
    );
}
