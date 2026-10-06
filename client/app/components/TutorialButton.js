'use client';
import { useState } from 'react';
import { usePathname, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PlayCircle, ExternalLink, X } from 'lucide-react';
import { resolveTutorialPageKey, TUTORIAL_PAGES } from '@/lib/tutorialPages';
import { useTutorial } from '@/app/contexts/tutorials';
import { getYoutubeEmbedUrl } from '@/utils/video';

// Renders nothing unless the current page has an assigned tutorial — one
// instance lives in the shared coach-portal layout (see (coach)/layout.js) as a
// floating bottom-corner pill that expands into a small dismissable video
// window, so every page gets it in the exact same spot without per-page code.
// The window starts open; once the coach closes it, it stays a pill on every
// page (and later visits) until they click it again.
const DISMISS_STORAGE_KEY = 'tutorialWindowDismissed';

// localStorage can throw (private windows, blocked site data) — failing to
// remember a dismissal just means the window opens again next visit.
function readDismissed() {
    try { return localStorage.getItem(DISMISS_STORAGE_KEY) === '1'; } catch { return false; }
}

export default function TutorialButton() {
    const t = useTranslations('tutorials');
    const pathname = usePathname();
    const { workspaceSlug } = useParams();
    const [isOpen, setIsOpen] = useState(() => !readDismissed());

    const pageKey = resolveTutorialPageKey(pathname, workspaceSlug);
    const tutorial = useTutorial(pageKey);
    const embedUrl = tutorial ? getYoutubeEmbedUrl(tutorial.youtube_url) : null;

    if (!tutorial || !embedUrl) return null;

    function closeWindow() {
        setIsOpen(false);
        try { localStorage.setItem(DISMISS_STORAGE_KEY, '1'); } catch { /* not persisted — window reopens next visit */ }
    }

    const pageLabel = TUTORIAL_PAGES.find((p) => p.key === pageKey)?.label;
    const windowTitle = tutorial.title || pageLabel || t('modalDefaultTitle');

    return (
        <div className="fixed bottom-6 inset-e-6 z-40 flex flex-col items-end gap-3">
            {isOpen ? (
                <div
                    role="dialog"
                    aria-label={windowTitle}
                    className="w-[min(22rem,calc(100vw-3rem))] rounded-2xl border border-border bg-background shadow-2xl p-3 flex flex-col gap-2"
                >
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-foreground truncate">{windowTitle}</h2>
                        <button
                            type="button"
                            onClick={closeWindow}
                            aria-label={t('dismiss')}
                            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
                        <iframe
                            src={embedUrl}
                            title={windowTitle}
                            className="absolute inset-0 w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    </div>
                    <a
                        href={tutorial.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="self-start flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {t('watchOnYoutube')}
                    </a>
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => setIsOpen(true)}
                    className="relative flex items-center gap-2 rounded-full bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-lg hover:opacity-90 transition-opacity"
                >
                    {/* Soft glow that fades in and out — decorative; hidden for reduced-motion users. */}
                    <span aria-hidden="true" className="absolute -inset-1 -z-10 rounded-full bg-primary/25 animate-pulse motion-reduce:hidden" />
                    <PlayCircle className="h-5 w-5" />
                    {t('seeTutorial')}
                </button>
            )}
        </div>
    );
}
