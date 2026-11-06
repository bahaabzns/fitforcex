'use client';

import { useTranslations } from "next-intl";
import { Sparkles } from "lucide-react";
import { Button } from "@heroui/react/button";

// The one-time "wow" welcome content: a short pitch and a single action that takes the coach to the getting-started checklist. Used by the signup onboarding modal and, for coaches
// who skipped signup onboarding, by DemoWelcomeModal.
export default function DemoShowcase({ onOpen, onSkip, busy = false }) {
    const t = useTranslations('demoClient');

    return (
        <div className="ff-fade-in flex w-full flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
                <Sparkles className="text-primary" size={26} aria-hidden="true" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">{t('showcaseTitle')}</h1>
            <p className="mt-2 text-sm text-muted-foreground">{t('showcaseSubtitle')}</p>

            <Button variant="primary" size="lg" className="mt-8 w-full" onClick={onOpen} isDisabled={busy}>
                {t('startChecklist')}
            </Button>
            <button onClick={onSkip} disabled={busy} className="mt-3 text-xs text-muted-foreground hover:text-foreground transition-colors">
                {t('skip')}
            </button>
        </div>
    );
}
