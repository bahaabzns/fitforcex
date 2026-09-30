'use client';
import { useState } from 'react';
import { usePathname, useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { HelpCircle, ExternalLink } from 'lucide-react';
import { Button } from '@heroui/react/button';
import { Tooltip } from '@heroui/react/tooltip';
import AppModal from '@/app/components/Modal';
import { resolveTutorialPageKey, TUTORIAL_PAGES } from '@/lib/tutorialPages';
import { useTutorial } from '@/app/contexts/tutorials';
import { getYoutubeEmbedUrl } from '@/utils/video';

// Renders nothing unless the current page has an assigned tutorial — one
// instance lives in the shared coach-portal header (see (coach)/layout.js),
// so every page gets the button in the exact same spot without per-page code.
export default function TutorialButton() {
    const t = useTranslations('tutorials');
    const pathname = usePathname();
    const { workspaceSlug } = useParams();
    const [open, setOpen] = useState(false);

    const pageKey = resolveTutorialPageKey(pathname, workspaceSlug);
    const tutorial = useTutorial(pageKey);
    const embedUrl = tutorial ? getYoutubeEmbedUrl(tutorial.youtube_url) : null;

    if (!tutorial || !embedUrl) return null;

    const pageLabel = TUTORIAL_PAGES.find((p) => p.key === pageKey)?.label;
    const modalTitle = tutorial.title || pageLabel || t('modalDefaultTitle');

    return (
        <>
            <Tooltip>
                <Button isIconOnly size="sm" variant="ghost" aria-label={t('watchTutorial')} onClick={() => setOpen(true)}>
                    <HelpCircle className="h-4 w-4" />
                </Button>
                <Tooltip.Content>{t('watchTutorial')}</Tooltip.Content>
            </Tooltip>

            <AppModal open={open} onClose={() => setOpen(false)} title={modalTitle} wide>
                <div className="flex flex-col gap-3">
                    <div className="relative w-full aspect-video rounded-xl overflow-hidden bg-black">
                        <iframe
                            src={embedUrl}
                            title={modalTitle}
                            className="absolute inset-0 w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    </div>
                    <a
                        href={tutorial.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="self-start flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
                    >
                        <ExternalLink className="h-3.5 w-3.5" />
                        {t('watchOnYoutube')}
                    </a>
                </div>
            </AppModal>
        </>
    );
}
