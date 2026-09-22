'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import PromptCard from './PromptCard';

/**
 * The Insights System's manual/immediate Founder Prompt surface — a
 * non-blocking, dismissible banner, never a modal-on-load. This codebase has
 * no dismissal-state infrastructure anywhere (no dismissed_at column, no
 * "don't show again" pattern) — a banner sidesteps that gap entirely rather
 * than needing it. Dismiss is session-only (component state, not
 * persisted): acceptable while only one manual prompt is ever active at a
 * time (Phase 2's "one at a time" rule) — the founder question comes back
 * next session, which is the point for a broad, repeat-visibility ask. For
 * contextual (trigger_event) prompts, see TriggerInsightBanner, which
 * persists dismissal instead.
 *
 * `activePromptUrl` / `respondUrlPrefix` differ between the coach dashboard
 * (/api/insights/prompts/...) and the client portal (/api/client-portal/prompts/...)
 * — see FeedbackEntryModal's doc comment for why this takes explicit URLs.
 */
export default function InsightBanner({ activePromptUrl, respondUrlPrefix }) {
    const [prompt, setPrompt] = useState(null);
    const [dismissed, setDismissed] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [thanked, setThanked] = useState(false);

    useEffect(() => {
        let cancelled = false;
        api.get(activePromptUrl)
            .then((res) => { if (!cancelled) setPrompt(res.data ?? null); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [activePromptUrl]);

    if (!prompt || dismissed) return null;

    async function handleSubmit(answer) {
        setSubmitting(true);
        try {
            await api.post(`${respondUrlPrefix}/${prompt.id}/respond`, answer);
            setThanked(true);
            setTimeout(() => setDismissed(true), 1800);
        } catch {
            // Silent — a failed prompt answer isn't worth interrupting the
            // page with an error; the banner simply stays up to retry.
        } finally {
            setSubmitting(false);
        }
    }

    // bottom offset cleared to sit above the various per-page floating action
    // buttons (Start Training, Continue Day, Shopping List, …), which all
    // anchor at bottom: 4.5rem — at the old 5rem offset this card's own
    // height overlapped that button's clickable area and silently ate its
    // clicks (confirmed: "Start Training" stopped responding whenever this
    // prompt was showing).
    return (
        <div className="fixed inset-x-0 z-60 flex justify-center px-4 pointer-events-none bottom-[calc(7rem+1rem+env(safe-area-inset-bottom))]">
            <div className="pointer-events-auto w-full max-w-md rounded-xl border border-border bg-card shadow-lg px-4 py-3">
                <PromptCard
                    prompt={prompt}
                    onSubmit={handleSubmit}
                    onDismiss={() => setDismissed(true)}
                    onStart={() => api.post(`${respondUrlPrefix}/${prompt.id}/started`).catch(() => {})}
                    submitting={submitting}
                    thanked={thanked}
                />
            </div>
        </div>
    );
}
