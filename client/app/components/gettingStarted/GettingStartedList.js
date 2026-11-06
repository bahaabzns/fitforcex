'use client';

import { useTranslations } from "next-intl";
import { Check, Circle } from "lucide-react";
import { useGuide } from "@/app/components/guide/GuideProvider";

// `compact` is for the popups: only the chapter the coach is in is listed (a handful of steps, finished ones stay in
// the list, struck through), and every other chapter is one muted line, so it stays short. Numbers keep their place
// in the full list.
export default function GettingStartedList({ status, workspaceSlug, onNavigate, compact = false }) {
    const t = useTranslations('gettingStarted');
    const { startGuide } = useGuide();
    const nextKey = status.steps.find(step => !step.done)?.key;
    const numbered = status.steps.map((step, index) => ({ ...step, number: index + 1 }));
    const currentGroup = numbered.find(step => !step.done)?.group;
    const rows = compact ? numbered.filter(step => step.group === currentGroup) : numbered;
    const otherChapters = compact
        ? [...new Set(numbered.filter(step => step.group !== currentGroup).map(step => step.group))]
            .map(group => ({ group, left: numbered.filter(step => !step.done && step.group === group).length }))
        : [];

    // Clicking a step does not navigate: it starts an arrow guide that points at each click, wherever the coach is.
    function open(key) {
        onNavigate?.();
        startGuide(key, { slug: workspaceSlug, demoClientId: status.demoClientId, firstRealClientId: status.firstRealClientId, demoLogin: status.demoLogin });
    }

    return (
        <ol className="flex flex-col gap-1.5">
            {rows.map(({ key, group, done, number }, index) => (
                <li key={key} className="flex flex-col gap-1.5">
                    {/* A chapter heading above the first step of each group. */}
                    {(index === 0 || rows[index - 1].group !== group) && (
                        <p className={`px-1 text-xs font-bold text-muted-foreground ${index === 0 ? '' : 'mt-2'}`}>{t(`group_${group}`)}</p>
                    )}
                    <button
                        type="button"
                        onClick={() => open(key)}
                        disabled={done}
                        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-start text-sm transition-colors ${done ? 'cursor-default' : 'cursor-pointer'} ${done
                            ? 'border-green-500/30 bg-green-500/10 text-green-700'
                            : key === nextKey
                                ? 'border-primary bg-primary/10 text-foreground ring-1 ring-primary/40'
                                : 'border-border bg-background text-foreground hover:border-primary/50'}`}
                    >
                        {done ? <Check size={16} className="shrink-0" aria-hidden="true" /> : <Circle size={16} className="shrink-0 text-muted-foreground" aria-hidden="true" />}
                        <span className={`flex-1 ${done ? 'line-through opacity-70' : ''}`}>{number}. {t(`step_${key}`)}</span>
                        {key === nextKey && <span className="shrink-0 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-white">{t('next')}</span>}
                    </button>
                </li>
            ))}
            {otherChapters.map(({ group, left }) => (
                <li key={group} className="px-1 pt-2 text-xs text-muted-foreground">
                    {t(`group_${group}`)} · {left > 0 ? t('chapterLeft', { count: left }) : t('chapterDone')}
                </li>
            ))}
        </ol>
    );
}
