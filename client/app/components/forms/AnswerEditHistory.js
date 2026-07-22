"use client";

import { useTranslations } from "next-intl";

// Read-only trail of previous → new values for one answer. Shared by the
// client portal's own answer view and the coach's client-forms view — both
// just pass the `history` array the API already returns per response
// ({ previous_answer, new_answer, edited_at }[], oldest first).
function formatRelativeTime(dateStr, t) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return t('justNow');
    if (diffMins < 60) return t('minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('hoursAgo', { count: diffHours });
    if (diffDays === 1) return t('yesterday');
    if (diffDays < 7) return t('daysAgo', { count: diffDays });
    if (diffDays < 30) return t('weeksAgo', { count: Math.floor(diffDays / 7) });
    if (diffDays < 365) return t('monthsAgo', { count: Math.floor(diffDays / 30) });
    return t('yearsAgo', { count: Math.floor(diffDays / 365) });
}

export default function AnswerEditHistory({ history, label }) {
    const tCommon = useTranslations('common');

    if (!history?.length) return null;

    return (
        <div className="mt-2 pt-2 border-t border-border/60 flex flex-col gap-1.5">
            {label && (
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</p>
            )}
            {history.map((entry, i) => (
                <div key={i} className="text-xs flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5">
                    <span className="text-muted-foreground line-through decoration-muted-foreground/50">
                        {entry.previous_answer || '—'}
                    </span>
                    <span className="text-muted-foreground/70">→</span>
                    <span className="text-foreground font-medium">{entry.new_answer || '—'}</span>
                    <span className="text-muted-foreground/70 ml-1">{formatRelativeTime(entry.edited_at, tCommon)}</span>
                </div>
            ))}
        </div>
    );
}
