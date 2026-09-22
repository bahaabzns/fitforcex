'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { X } from 'lucide-react';
import { Button } from '@heroui/react/button';
import { TextArea } from '@heroui/react/textarea';
import Typography from '@/app/components/Typography';

/**
 * Pure presentational card for one insight_prompt — the question UI shared
 * by InsightBanner (Phase 2, manual/immediate prompts) and
 * TriggerInsightBanner (Phase 3, contextual prompts). Extracted so both
 * delivery modes render identically; only how a prompt is fetched and
 * dismissed differs between them. `onStart` (Phase 4 funnel) fires once, on
 * the first interaction with any answer control — a ref guard, not state,
 * since it must never trigger a re-render.
 */
export default function PromptCard({ prompt, onSubmit, onDismiss, onStart, submitting, thanked }) {
    const t = useTranslations('insights.banner');
    const [rating, setRating] = useState(null);
    const [selectedOption, setSelectedOption] = useState(null);
    const [text, setText] = useState('');
    const started = useRef(false);

    function markStarted() {
        if (started.current) return;
        started.current = true;
        onStart?.();
    }

    const canSubmit =
        (prompt.response_type === 'rating' && rating != null) ||
        (prompt.response_type === 'rating_with_text' && rating != null) ||
        (prompt.response_type === 'multiple_choice' && selectedOption != null) ||
        (prompt.response_type === 'text' && text.trim().length > 0);

    function handleSubmit() {
        const isRating = prompt.response_type === 'rating' || prompt.response_type === 'rating_with_text';
        onSubmit({
            ratingValue: isRating ? rating : undefined,
            selectedOption: prompt.response_type === 'multiple_choice' ? selectedOption : undefined,
            textValue: prompt.response_type === 'text'
                ? text.trim()
                : prompt.response_type === 'rating_with_text' && text.trim().length > 0
                    ? text.trim()
                    : undefined,
        });
    }

    if (thanked) {
        return <p className="text-sm text-foreground text-center py-1">{t('thanks')}</p>;
    }

    return (
        <>
            <div className="flex items-start justify-between gap-2">
                <div>
                    <Typography type="body-xs" weight="medium" color="muted" className="uppercase tracking-wider">
                        {t('quickQuestion')}
                    </Typography>
                    <p className="text-sm font-medium text-foreground mt-0.5">{prompt.question_en}</p>
                </div>
                <button
                    onClick={onDismiss}
                    className="shrink-0 text-muted-foreground hover:text-foreground cursor-pointer"
                    aria-label={t('dismiss')}
                >
                    <X size={15} />
                </button>
            </div>

            <div className="mt-2.5">
                {(prompt.response_type === 'rating' || prompt.response_type === 'rating_with_text') && (
                    <div className="flex flex-wrap gap-1">
                        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                            <button
                                key={n}
                                type="button"
                                onClick={() => { markStarted(); setRating(n); }}
                                className={`w-7 h-7 rounded-md text-xs font-medium border transition-colors cursor-pointer ${
                                    rating === n
                                        ? 'bg-primary text-primary-foreground border-primary'
                                        : 'border-border text-muted-foreground hover:bg-default'
                                }`}
                            >
                                {n}
                            </button>
                        ))}
                    </div>
                )}

                {prompt.response_type === 'rating_with_text' && (
                    <TextArea
                        className="mt-2"
                        placeholder={t('optionalNote')}
                        value={text}
                        onChange={(e) => { markStarted(); setText(e.target.value); }}
                        rows={2}
                    />
                )}

                {prompt.response_type === 'multiple_choice' && Array.isArray(prompt.options) && (
                    <div className="flex flex-col gap-1.5">
                        {prompt.options.map((opt) => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => { markStarted(); setSelectedOption(opt); }}
                                className={`text-start px-3 py-1.5 rounded-lg text-sm border transition-colors cursor-pointer ${
                                    selectedOption === opt
                                        ? 'bg-primary/10 border-primary text-foreground'
                                        : 'border-border text-muted-foreground hover:bg-default'
                                }`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                )}

                {prompt.response_type === 'text' && (
                    <TextArea value={text} onChange={(e) => { markStarted(); setText(e.target.value); }} rows={2} />
                )}
            </div>

            <div className="flex justify-end gap-2 mt-2.5">
                <Button size="sm" variant="ghost" onClick={onDismiss}>{t('dismiss')}</Button>
                <Button size="sm" variant="primary" isDisabled={!canSubmit || submitting} onClick={handleSubmit}>
                    {t('submit')}
                </Button>
            </div>
        </>
    );
}
