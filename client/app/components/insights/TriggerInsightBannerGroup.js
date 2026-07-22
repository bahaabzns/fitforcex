'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import PromptCard from './PromptCard';

/**
 * Checks a list of trigger events for this page (in order) and renders the
 * first one that's eligible — never more than one at a time. Exists because
 * several pages have more than one meaningful moment worth a trigger (e.g.
 * the training builder cares about both "first plan created" and "first plan
 * activated"), and stacking multiple independent TriggerInsightBanner
 * instances would risk showing two banners at once if both happened to be
 * eligible simultaneously.
 *
 * `basePath` is '/api/insights' (coach) or '/api/client-portal' (client) —
 * every other URL this needs is derived from it, matching the existing
 * for-trigger/respond/dismiss route shapes on both surfaces.
 */
export default function TriggerInsightBannerGroup({ basePath, events }) {
    const [prompt, setPrompt] = useState(null);
    const [hidden, setHidden] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [thanked, setThanked] = useState(false);

    useEffect(() => {
        let cancelled = false;
        (async () => {
            for (const event of events) {
                try {
                    const res = await api.get(`${basePath}/prompts/for-trigger/${event}`);
                    if (cancelled) return;
                    if (res.data) { setPrompt(res.data); return; }
                } catch {
                    // Try the next trigger in the list.
                }
            }
        })();
        return () => { cancelled = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [basePath, events.join(',')]);

    if (!prompt || hidden) return null;

    const respondUrlPrefix = `${basePath}/prompts`;
    const dismissUrlPrefix = `${basePath}/prompts`;

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
            // Silent — matches InsightBanner/TriggerInsightBanner's failure handling.
        } finally {
            setSubmitting(false);
        }
    }

    return (
        <div className="w-full max-w-md rounded-xl border border-border bg-card shadow-sm px-4 py-3 mb-4">
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
