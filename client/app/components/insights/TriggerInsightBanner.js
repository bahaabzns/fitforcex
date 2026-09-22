'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import PromptCard from './PromptCard';

/**
 * Phase 3 — the contextual counterpart to InsightBanner. Checks, on mount,
 * whether a prompt tied to `triggerEvent` is eligible for the current
 * caller right now (the server evaluates the condition — see
 * insights.service.ts's TRIGGER_CHECKS — this component never guesses).
 * Mounted on the page a user lands on right after the triggering action
 * (e.g. the training history page right after finishing a first workout),
 * so "check on mount" is enough — no separate event bus needed.
 *
 * Unlike InsightBanner, dismiss here is persisted (POST .../dismiss) so a
 * contextual prompt tied to a repeatable action doesn't keep re-asking.
 */
export default function TriggerInsightBanner({ triggerEvent, checkUrl, respondUrlPrefix, dismissUrlPrefix }) {
    const [prompt, setPrompt] = useState(null);
    const [hidden, setHidden] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [thanked, setThanked] = useState(false);

    useEffect(() => {
        let cancelled = false;
        api.get(checkUrl)
            .then((res) => { if (!cancelled) setPrompt(res.data ?? null); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [checkUrl]);

    if (!prompt || hidden) return null;

    async function handleDismiss() {
        setHidden(true);
        api.post(`${dismissUrlPrefix}/${prompt.id}/dismiss`).catch(() => {});
    }

    async function handleSubmit(answer) {
        setSubmitting(true);
        try {
            await api.post(`${respondUrlPrefix}/${prompt.id}/respond`, answer);
            setThanked(true);
            setTimeout(() => setHidden(true), 1800);
        } catch {
            // Silent — matches InsightBanner's failure handling.
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-sm px-4 py-3 mb-4" data-trigger={triggerEvent}>
            <PromptCard
                prompt={prompt}
                onSubmit={handleSubmit}
                onDismiss={handleDismiss}
                onStart={() => api.post(`${respondUrlPrefix}/${prompt.id}/started`).catch(() => {})}
                submitting={submitting}
                thanked={thanked}
            />
        </div>
    );
}
