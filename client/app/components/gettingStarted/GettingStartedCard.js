'use client';

import { useEffect, useRef, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Rocket } from "lucide-react";
import useGettingStarted from "@/app/components/gettingStarted/useGettingStarted";
import GettingStartedList from "@/app/components/gettingStarted/GettingStartedList";

const HIGHLIGHT_MS = 2800;

// The same checklist, open, at the top of the dashboard where a new coach lands.
export default function GettingStartedCard() {
    const t = useTranslations('gettingStarted');
    const { workspaceSlug } = useParams();
    const { status, dismiss } = useGettingStarted();
    const searchParams = useSearchParams();
    const wantsFocus = searchParams.get('checklist') === '1';
    const cardRef = useRef(null);
    const [highlight, setHighlight] = useState(false);
    const visible = !!status?.visible;

    // Arriving with ?checklist=1 (the welcome's button): bring the card into view and pulse it for a moment.
    useEffect(() => {
        if (!wantsFocus || !visible) return undefined;
        cardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const on = setTimeout(() => setHighlight(true), 0);
        const off = setTimeout(() => {
            setHighlight(false);
            window.history.replaceState(null, '', window.location.pathname);
        }, HIGHLIGHT_MS);
        return () => { clearTimeout(on); clearTimeout(off); };
    }, [wantsFocus, visible]);

    if (!visible) return null;
    const percent = Math.round((status.doneCount / status.total) * 100);

    return (
        <section
            ref={cardRef}
            className={`rounded-2xl border bg-primary/5 p-5 transition-shadow duration-500 ${highlight ? 'border-primary shadow-[0_0_0_4px_rgba(0,153,255,0.25)]' : 'border-primary/20'}`}
        >
            <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                        <Rocket size={20} className="text-primary" aria-hidden="true" />
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-foreground">{t('subtitle')}</h2>
                        <p className="text-xs text-muted-foreground">{t('progress', { done: status.doneCount, total: status.total })}</p>
                    </div>
                </div>
                <button type="button" onClick={dismiss} className="text-xs text-muted-foreground hover:text-foreground">{t('hide')}</button>
            </div>
            <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-primary/10" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
            </div>
            <div className="mt-4">
                <GettingStartedList status={status} workspaceSlug={workspaceSlug} />
            </div>
        </section>
    );
}
