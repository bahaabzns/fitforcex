'use client';
import { useState } from 'react';
import { usePathname, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PlayCircle, ExternalLink, X, ChevronRight, ChevronsRight } from 'lucide-react';
import { resolveTutorialPageKey, TUTORIAL_PAGES } from '@/lib/tutorialPages';
import { useTutorial } from '@/app/contexts/tutorials';
import { getYoutubeEmbedUrl } from '@/utils/video';

// Renders nothing unless the current page has an assigned tutorial — one
// instance lives in the shared coach-portal layout (see (coach)/layout.js) so
// every page gets it in the exact same spot without per-page code.
//
// Three states, so it never has to cover the page underneath:
//   window — a small dismissable video window (the first-visit default)
//   pill   — a floating "See tutorial" pill in the bottom corner, with a separate round
//            chevron button beside it that tucks everything to the edge
//   edge   — a slim tab docked flush to the screen edge, at the same height as the pill;
//            click it to bring the pill back
// The pill group and the edge tab are always mounted and slide/fade between each other
// (transform + opacity only, off for reduced-motion). Closing the window leaves the pill.
// Both choices are remembered across pages and visits.
const DISMISS_STORAGE_KEY = 'tutorialWindowDismissed';
const EDGE_STORAGE_KEY = 'tutorialDockedToEdge';

const SLIDE_TRANSITION = 'transition-all duration-300 ease-out motion-reduce:transition-none';
// The pill group sits 1.5rem in from the edge; sliding it by its own width + that gutter
// takes it fully off-screen (mirrored in RTL).
const PILL_HIDDEN = 'translate-x-[calc(100%+1.5rem)] rtl:-translate-x-[calc(100%+1.5rem)] opacity-0 pointer-events-none';
const EDGE_HIDDEN = 'translate-x-full rtl:-translate-x-full opacity-0 pointer-events-none';

// localStorage can throw (private windows, blocked site data) — failing to
// remember a choice just means the default state returns next visit.
function readFlag(key) {
    try { return localStorage.getItem(key) === '1'; } catch { return false; }
}

function writeFlag(key, value) {
    try { localStorage.setItem(key, value ? '1' : '0'); } catch { /* not persisted — default state next visit */ }
}

function initialMode() {
    if (readFlag(EDGE_STORAGE_KEY)) return 'edge';
    return readFlag(DISMISS_STORAGE_KEY) ? 'pill' : 'window';
}

export default function TutorialButton() {
    const t = useTranslations('tutorials');
    const pathname = usePathname();
    const { workspaceSlug } = useParams();
    const [mode, setMode] = useState(initialMode);

    const pageKey = resolveTutorialPageKey(pathname, workspaceSlug);
    const tutorial = useTutorial(pageKey);
    const embedUrl = tutorial ? getYoutubeEmbedUrl(tutorial.youtube_url) : null;

    if (!tutorial || !embedUrl) return null;

    function showWindow() {
        setMode('window');
        writeFlag(EDGE_STORAGE_KEY, false);
    }

    function showPill() {
        setMode('pill');
        writeFlag(DISMISS_STORAGE_KEY, true);
        writeFlag(EDGE_STORAGE_KEY, false);
    }

    function dockToEdge() {
        setMode('edge');
        writeFlag(DISMISS_STORAGE_KEY, true);
        writeFlag(EDGE_STORAGE_KEY, true);
    }

    const pageLabel = TUTORIAL_PAGES.find((p) => p.key === pageKey)?.label;
    const windowTitle = tutorial.title || pageLabel || t('modalDefaultTitle');
    const isWindow = mode === 'window';
    const isPill = mode === 'pill';
    const isEdge = mode === 'edge';

    return (
        <>
            {isWindow && (
                <div className="fixed bottom-6 inset-e-6 z-40">
                    <div
                        role="dialog"
                        aria-label={windowTitle}
                        className="animate-tutorial-window-in w-[min(22rem,calc(100vw-3rem))] rounded-2xl border border-border bg-background shadow-2xl p-3 flex flex-col gap-2"
                    >
                        <div className="flex items-center justify-between gap-2">
                            <h2 className="text-sm font-semibold text-foreground truncate">{windowTitle}</h2>
                            <div className="flex shrink-0 items-center gap-1">
                                <button
                                    type="button"
                                    onClick={dockToEdge}
                                    aria-label={t('collapseToEdge')}
                                    title={t('collapseToEdge')}
                                    className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                                >
                                    <ChevronsRight className="h-4 w-4 rtl:rotate-180" />
                                </button>
                                <button
                                    type="button"
                                    onClick={showPill}
                                    aria-label={t('dismiss')}
                                    className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
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
                </div>
            )}

            {/* Pill + its own round "tuck to edge" button. Two separate controls: the chevron is a
                circle with its own surface and border, so it doesn't read as part of the pill. */}
            <div
                className={`fixed bottom-6 inset-e-6 z-40 flex items-center gap-2 ${SLIDE_TRANSITION} ${isPill ? 'translate-x-0 opacity-100' : PILL_HIDDEN}`}
                inert={!isPill}
                aria-hidden={!isPill}
            >
                <div className="relative">
                    {/* Soft glow that fades in and out — decorative; hidden for reduced-motion users. */}
                    <span aria-hidden="true" className="absolute -inset-1 -z-10 rounded-full bg-primary/25 animate-pulse motion-reduce:hidden" />
                    <button
                        type="button"
                        onClick={showWindow}
                        className="flex h-11 items-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-lg hover:opacity-90 transition-opacity"
                    >
                        <PlayCircle className="h-5 w-5" />
                        {t('seeTutorial')}
                    </button>
                </div>
                <button
                    type="button"
                    onClick={dockToEdge}
                    aria-label={t('collapseToEdge')}
                    title={t('collapseToEdge')}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-md hover:bg-secondary hover:text-foreground transition-colors"
                >
                    <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                </button>
            </div>

            {/* Edge tab — flush to the screen edge, same bottom offset and height as the pill so it
                sits at the same level; slides in from the edge when the pill tucks away. */}
            <button
                type="button"
                onClick={showPill}
                aria-label={t('seeTutorial')}
                title={t('seeTutorial')}
                inert={!isEdge}
                aria-hidden={!isEdge}
                className={`fixed bottom-6 inset-e-0 z-40 flex h-11 w-7 items-center justify-center rounded-s-xl bg-primary text-primary-foreground shadow-lg hover:w-9 focus-visible:w-9 ${SLIDE_TRANSITION} ${isEdge ? 'translate-x-0 opacity-100' : EDGE_HIDDEN}`}
            >
                <PlayCircle className="h-5 w-5" />
            </button>
        </>
    );
}
