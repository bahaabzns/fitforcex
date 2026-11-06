'use client';

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { PartyPopper } from "lucide-react";
import { Button } from "@heroui/react/button";
import AppModal from "@/app/components/Modal";
import GettingStartedList from "@/app/components/gettingStarted/GettingStartedList";
import { useGettingStartedContext } from "@/app/components/gettingStarted/GettingStartedProvider";

const CONFETTI_MS = 4000;
const PIECES = 70;
const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#a855f7', '#ec4899'];

// Deterministic "random" so rendering stays pure: the same celebration always draws the same confetti.
const spread = (index, salt) => {
    const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return value - Math.floor(value);
};

function Confetti({ salt }) {
    return createPortal(
        <div className="pointer-events-none fixed inset-0 z-90 overflow-hidden" aria-hidden="true">
            {Array.from({ length: PIECES }, (_, index) => (
                <span
                    key={index}
                    className="ff-confetti"
                    style={{
                        left: `${spread(index, salt) * 100}%`,
                        width: 6 + spread(index, salt + 1) * 6,
                        height: 10 + spread(index, salt + 2) * 8,
                        background: COLORS[index % COLORS.length],
                        borderRadius: index % 3 === 0 ? '9999px' : '2px',
                        animationDuration: `${2.2 + spread(index, salt + 3) * 1.6}s`,
                        animationDelay: `${spread(index, salt + 4) * 0.5}s`,
                        '--drift': `${(spread(index, salt + 5) - 0.5) * 160}px`,
                        '--rot': `${360 + spread(index, salt + 6) * 720}deg`,
                    }}
                />
            ))}
        </div>,
        document.body,
    );
}

// Shown when a getting-started step is fully done: confetti over the page, then the checklist again with the next
// step highlighted, in a modal on a desktop and a bottom sheet on a phone.
export default function Celebration() {
    const t = useTranslations('gettingStarted');
    const { workspaceSlug } = useParams();
    const { status, dismiss, celebration, clearCelebration } = useGettingStartedContext();
    const celebrationId = celebration?.id;
    const showConfetti = useConfettiWindow(celebrationId);

    if (!celebration) return null;
    const salt = celebration.id % 997;
    const showList = !celebration.all && !!status?.visible;

    return (
        <>
            {showConfetti && <Confetti salt={salt} />}
            <AppModal open onClose={clearCelebration} title={t('celebrateTitle')} sheetOnMobile dialogClassName="ff-no-scrollbar max-w-lg">
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3 rounded-xl bg-amber-500/10 px-4 py-3 text-sm font-semibold text-foreground">
                        <PartyPopper size={22} className="shrink-0 text-amber-500" aria-hidden="true" />
                        <span>{celebration.all ? t('celebrateAll') : t('celebrateStep', { step: t(`step_${celebration.key}`) })}</span>
                    </div>
                    {showList && (
                        <>
                            <p className="text-xs text-muted-foreground">{t('progress', { done: status.doneCount, total: status.total })}</p>
                            <GettingStartedList status={status} workspaceSlug={workspaceSlug} onNavigate={clearCelebration} compact />
                            <button type="button" onClick={() => { clearCelebration(); dismiss(); }} className="ms-auto text-xs text-muted-foreground hover:text-foreground">
                                {t('hide')}
                            </button>
                        </>
                    )}
                    {!showList && <Button variant="primary" onClick={clearCelebration}>{t('celebrateClose')}</Button>}
                </div>
            </AppModal>
        </>
    );
}

// Confetti only plays for a few seconds, while the modal stays until the coach closes it.
function useConfettiWindow(celebrationId) {
    const [playingFor, setPlayingFor] = useState(null);
    useEffect(() => {
        if (celebrationId === undefined) return undefined;
        const start = setTimeout(() => setPlayingFor(celebrationId), 0);
        const stop = setTimeout(() => setPlayingFor(null), CONFETTI_MS);
        return () => { clearTimeout(start); clearTimeout(stop); };
    }, [celebrationId]);
    return celebrationId !== undefined && playingFor === celebrationId && !prefersReducedMotion();
}

function prefersReducedMotion() {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
