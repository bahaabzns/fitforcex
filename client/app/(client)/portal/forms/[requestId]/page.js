"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/axios";
import { useLocale, useTranslations } from "next-intl";
import { getLocalizedField } from "@/utils/localization";
import { CheckCircle } from "lucide-react";
import { Skeleton } from "@heroui/react/skeleton";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Button } from "@heroui/react/button";
import { Alert } from "@heroui/react/alert";

export default function ClientFillFormPage() {
    const t = useTranslations('portal.forms');
    const locale = useLocale();
    const { requestId } = useParams();
    const router = useRouter();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [answers, setAnswers] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        api.get(`/api/client-portal/form-requests/${requestId}`)
            .then(res => {
                setData(res.data);
                if (res.data.responses?.length > 0) {
                    const filled = {};
                    res.data.responses.forEach(r => { filled[r.question_id] = r.answer; });
                    setAnswers(filled);
                }
            })
            .catch(() => router.push("/client/dashboard"))
            .finally(() => setLoading(false));
    }, [requestId, router]);

    const setAnswer = (questionId, value) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const missing = data.questions.filter(q => q.required && !answers[q.id]?.toString().trim());
        if (missing.length > 0) {
            setError(t('requiredError', { count: missing.length }));
            return;
        }

        setSubmitting(true);
        try {
            const answersPayload = data.questions.map(q => ({
                question_id: q.id,
                answer: answers[q.id] ?? '',
            }));
            await api.post(`/api/client-portal/form-requests/${requestId}/submit`, { answers: answersPayload });
            router.push("/client/forms");
        } catch (e) {
            setError(e.response?.data?.error || t('submitFailed'));
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="max-w-2xl mx-auto p-6 flex flex-col gap-5">
                <Skeleton className="h-8 w-48 rounded-lg" />
                {[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
            </div>
        );
    }

    if (!data) return null;

    const isSubmitted = data.status !== 'pending';

    const inputCls = "w-full px-3 py-2 rounded-md border border-border bg-card text-foreground placeholder:text-muted-foreground text-sm outline-none transition-colors hover:border-primary/40 disabled:bg-secondary disabled:text-muted-foreground";

    return (
        <div className="max-w-2xl mx-auto p-6">
            {/* Page header */}
            <div className="flex items-start gap-4 mb-6">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/client/forms")}
                    className="mt-1 text-muted-foreground"
                >
                    {t('back')}
                </Button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-foreground">{getLocalizedField(data, 'form_title', locale)}</h1>
                    {getLocalizedField(data, 'form_description', locale) && <p className="text-sm text-muted-foreground mt-0.5">{getLocalizedField(data, 'form_description', locale)}</p>}
                </div>
                {isSubmitted && (
                    <Chip size="sm" className="bg-green-500/15 text-green-700 mt-1">{t('filterSubmitted')}</Chip>
                )}
            </div>

            {isSubmitted && (
                <div className="mb-4">
                    <Alert>
                        <Alert.Indicator>
                            <CheckCircle size={15} />
                        </Alert.Indicator>
                        <Alert.Content>
                            <Alert.Description>
                                {t('alreadySubmitted')}
                            </Alert.Description>
                        </Alert.Content>
                    </Alert>
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                {data.questions.map((q, index) => (
                    <Card key={q.id}>
                        <Card.Content className="p-6 flex flex-col gap-2">
                            <label className="text-sm font-semibold text-foreground">
                                {index + 1}. {getLocalizedField(q, 'label', locale)}
                                {q.required && <span className="text-destructive ml-1">*</span>}
                            </label>

                            {q.type === 'text' && (
                                <input type="text" value={answers[q.id] ?? ''} onChange={e => setAnswer(q.id, e.target.value)}
                                    placeholder={getLocalizedField(q, 'placeholder', locale)} disabled={isSubmitted} className={inputCls} />
                            )}

                            {q.type === 'textarea' && (
                                <textarea value={answers[q.id] ?? ''} onChange={e => setAnswer(q.id, e.target.value)}
                                    placeholder={getLocalizedField(q, 'placeholder', locale)} disabled={isSubmitted} rows={4} className={`${inputCls} resize-none`} />
                            )}

                            {q.type === 'number' && (
                                <input type="number" value={answers[q.id] ?? ''} onChange={e => setAnswer(q.id, e.target.value)}
                                    placeholder={getLocalizedField(q, 'placeholder', locale)} disabled={isSubmitted} className={inputCls} />
                            )}

                            {q.type === 'scale' && (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground w-4 text-right">{q.min_value ?? 1}</span>
                                        <input type="range" min={q.min_value ?? 1} max={q.max_value ?? 10}
                                            value={answers[q.id] ?? q.min_value ?? 1}
                                            onChange={e => setAnswer(q.id, e.target.value)}
                                            disabled={isSubmitted} className="flex-1 cursor-pointer" />
                                        <span className="text-xs text-muted-foreground w-4">{q.max_value ?? 10}</span>
                                    </div>
                                    <p className="text-center text-sm font-semibold text-primary">
                                        {answers[q.id] ?? q.min_value ?? 1}
                                    </p>
                                </div>
                            )}

                            {q.type === 'select' && (
                                <select value={answers[q.id] ?? ''} onChange={e => setAnswer(q.id, e.target.value)}
                                    disabled={isSubmitted} className={inputCls}>
                                    <option value="">{t('selectOption')}</option>
                                    {(locale === 'ar' && q.options_ar?.length ? q.options_ar : (q.options ?? [])).map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            )}

                            {q.type === 'multiselect' && (
                                <div className="flex flex-col gap-1.5">
                                    {(locale === 'ar' && q.options_ar?.length ? q.options_ar : (q.options ?? [])).map(opt => {
                                        const selected = (answers[q.id] ?? '').split(',').filter(Boolean);
                                        const checked = selected.includes(opt);
                                        return (
                                            <label key={opt} className="flex items-center gap-2 cursor-pointer">
                                                <input type="checkbox" checked={checked} disabled={isSubmitted}
                                                    onChange={() => {
                                                        const next = checked
                                                            ? selected.filter(x => x !== opt)
                                                            : [...selected, opt];
                                                        setAnswer(q.id, next.join(','));
                                                    }}
                                                    className="cursor-pointer"
                                                />
                                                <span className="text-sm text-foreground">{opt}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            )}
                        </Card.Content>
                    </Card>
                ))}

                {error && (
                    <Alert>
                        <Alert.Indicator />
                        <Alert.Content>
                            <Alert.Description>{error}</Alert.Description>
                        </Alert.Content>
                    </Alert>
                )}

                {!isSubmitted && (
                    <Button type="submit" variant="primary" fullWidth isDisabled={submitting}>
                        {submitting ? t('submitting') : t('submit')}
                    </Button>
                )}
            </form>
        </div>
    );
}
