'use client';

import { useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Rocket } from "lucide-react";
import AppModal from "@/app/components/Modal";
import useGettingStarted from "@/app/components/gettingStarted/useGettingStarted";
import GettingStartedList from "@/app/components/gettingStarted/GettingStartedList";

// Header entry point, on every coach page, for a new owner: "Get started 2/6" opening the checklist in a modal on a
// desktop and a bottom sheet on a phone (the same one that comes back after each finished step).
// Renders nothing for anyone the checklist doesn't apply to (see the server's getGettingStarted).
export default function GettingStartedButton() {
    const t = useTranslations('gettingStarted');
    const { workspaceSlug } = useParams();
    const { status, dismiss } = useGettingStarted();
    const [open, setOpen] = useState(false);

    if (!status?.visible) return null;
    const percent = Math.round((status.doneCount / status.total) * 100);

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/15"
            >
                <Rocket size={14} aria-hidden="true" />
                <span className="hidden sm:inline">{t('title')}</span>
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] leading-none text-white">
                    {status.doneCount}/{status.total}
                </span>
            </button>

            <AppModal open={open} onClose={() => setOpen(false)} title={t('subtitle')} sheetOnMobile dialogClassName="ff-no-scrollbar max-w-lg">
                <div className="flex flex-col gap-4">
                    <div>
                        <p className="text-xs text-muted-foreground">{t('progress', { done: status.doneCount, total: status.total })}</p>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-primary/10" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
                            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
                        </div>
                    </div>
                    <GettingStartedList status={status} workspaceSlug={workspaceSlug} onNavigate={() => setOpen(false)} compact />
                    <button type="button" onClick={() => { setOpen(false); dismiss(); }} className="ms-auto text-xs text-muted-foreground hover:text-foreground">
                        {t('hide')}
                    </button>
                </div>
            </AppModal>
        </>
    );
}
