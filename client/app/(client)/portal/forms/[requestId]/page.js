"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/axios";
import { useLocale, useTranslations } from "next-intl";
import { getLocalizedField } from "@/utils/localization";
import { CheckCircle } from 'lucide-react';
import { Skeleton } from "@heroui/react/skeleton";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Button } from "@heroui/react/button";
import { Alert } from "@heroui/react/alert";
import { usePageTitle } from "@/hooks/usePageTitle";
import AnswerEditHistory from "@/app/components/forms/AnswerEditHistory";
import NewFeatureTooltip from "@/app/components/NewFeatureTooltip";

export default function ClientFillFormPage() {
    const t = useTranslations('portal.forms');
    const tCommon = useTranslations('common');
    usePageTitle(t('title'));
    const locale = useLocale();
    const { requestId } = useParams();
    const router = useRouter();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [answers, setAnswers] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Per-question edit state — only one answer can be edited at a time,
    // and only after the form has already been submitted once.
    const [editingQuestionId, setEditingQuestionId] = useState(null);
    const [savingQuestionId, setSavingQuestionId] = useState(null);
    const [editError, setEditError] = useState('');

    const loadRequest = useCallback(() => {
        return api.get(`/api/client-portal/form-requests/${requestId}`)
            .then(res => {
                setData(res.data);
                if (res.data.responses?.length > 0) {
                    const filled = {};
                    res.data.responses.forEach(r => { filled[r.question_id] = r.answer; });
                    setAnswers(filled);
                }
            });
    }, [requestId]);

    useEffect(() => {
        loadRequest()
            .catch(() => router.push("/portal/home"))
            .finally(() => setLoading(false));
    }, [loadRequest, router]);

    const setAnswer = (questionId, value) => {
        setAnswers(prev => ({ ...prev, [questionId]: value }));
    };

    const startEdit = (q) => {
        setEditingQuestionId(q.id);
        setEditError('');
    };

    const cancelEdit = (q, response) => {
        setAnswers(prev => ({ ...prev, [q.id]: response?.answer ?? '' }));
        setEditingQuestionId(null);
        setEditError('');
    };

    const saveEdit = async (q) => {
        setEditError('');
        if (q.required && !answers[q.id]?.toString().trim()) {
            setEditError(t('requiredError', { count: 1 }));
            return;
        }
        setSavingQuestionId(q.id);
        try {
            await api.patch(`/api/client-portal/form-requests/${requestId}/answers/${q.id}`, { answer: answers[q.id] ?? '' });
            await loadRequest();
            setEditingQuestionId(null);
        } catch (e) {
            setEditError(e.response?.data?.error || t('editFailed'));
        } finally {
            setSavingQuestionId(null);
        }
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
            router.push("/portal/forms");
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

    // 'sent' is the dispatcher cron's stamp on a due 'pending' request — still
    // awaiting the client's answer, not a submitted/locked state.
    const isSubmitted = data.status !== 'pending' && data.status !== 'sent';

    const responseByQuestion = {};
    (data.responses ?? []).forEach(r => { responseByQuestion[r.question_id] = r; });

    const inputCls = "w-full px-3 py-2 rounded-md border border-border bg-card text-foreground placeholder:text-muted-foreground text-sm outline-none transition-colors hover:border-primary/40 disabled:bg-secondary disabled:text-muted-foreground";

    // Gates the first-time "you can edit this" hint to the first editable
    // question rendered — NewFeatureTooltip itself handles never showing it
    // again after that (localStorage), same pattern as the food-swap hint.
    let firstEditHintClaimed = false;

    return (
        <div className="max-w-2xl mx-auto p-6">
            {/* Page header */}
            <div className="flex items-start gap-4 mb-6">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push("/portal/forms")}
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
                {data.questions.map((q, index) => {
                    const response = responseByQuestion[q.id];
                    const locked = isSubmitted && editingQuestionId !== q.id;
                    const isFirstEditableQuestion = isSubmitted && !firstEditHintClaimed;
                    if (isFirstEditableQuestion) firstEditHintClaimed = true;
                    return (
                    <Card key={q.id}>
                        <Card.Content className="p-6 flex flex-col gap-2">
                            <label className="text-sm font-semibold text-foreground flex items-center gap-2">
                                {index + 1}. {getLocalizedField(q, 'label', locale)}
                                {q.required && <span className="text-destructive ml-1">*</span>}
                                {response?.edited && (
                                    <Chip size="sm" color="secondary" variant="soft">
                                        <Chip.Label>{t('answerEdited')}</Chip.Label>
                                    </Chip>
                                )}
                            </label>

                            {q.type === 'text' && (
                                <input type="text" value={answers[q.id] ?? ''} onChange={e => setAnswer(q.id, e.target.value)}
                                    placeholder={getLocalizedField(q, 'placeholder', locale)} disabled={locked} className={inputCls} />
                            )}

                            {(q.type === 'long_text' || q.type === 'textarea') && (
                                <textarea value={answers[q.id] ?? ''} onChange={e => setAnswer(q.id, e.target.value)}
                                    placeholder={getLocalizedField(q, 'placeholder', locale)} disabled={locked} rows={4} className={`${inputCls} resize-none`} />
                            )}

                            {q.type === 'number' && (
                                <input type="number" value={answers[q.id] ?? ''} onChange={e => setAnswer(q.id, e.target.value)}
                                    placeholder={getLocalizedField(q, 'placeholder', locale)} disabled={locked} className={inputCls} />
                            )}

                            {q.type === 'date' && (
                                <input type="date" value={answers[q.id] ?? ''} onChange={e => setAnswer(q.id, e.target.value)}
                                    disabled={locked} className={inputCls} />
                            )}

                            {q.type === 'metric' && q.metric_type === 'number' && (
                                <div className="flex items-center gap-2">
                                    <input
                                        type="number"
                                        value={answers[q.id] ?? ''}
                                        onChange={e => setAnswer(q.id, e.target.value)}
                                        placeholder={t('metricPlaceholder', { name: (q.metric_name || t('metricValueFallback')).toLowerCase() })}
                                        disabled={locked}
                                        className={`${inputCls} flex-1`}
                                    />
                                    {q.metric_unit && (
                                        <span className="text-sm text-muted-foreground shrink-0 px-3 py-2 rounded-md border border-border bg-secondary">
                                            {q.metric_unit}
                                        </span>
                                    )}
                                </div>
                            )}

                            {q.type === 'metric' && q.metric_type === 'image' && (
                                <MetricPhotoInput
                                    questionId={q.id}
                                    value={answers[q.id]}
                                    isSubmitted={locked}
                                    onChange={setAnswer}
                                    t={t}
                                />
                            )}

                            {q.type === 'attachment' && (
                                <AttachmentInput
                                    questionId={q.id}
                                    value={answers[q.id]}
                                    isSubmitted={locked}
                                    onChange={setAnswer}
                                    category={q.options?.allowedCategory || 'any'}
                                    t={t}
                                />
                            )}

                            {q.type === 'scale' && (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground w-4 text-right">{q.min_value ?? 1}</span>
                                        <input type="range" min={q.min_value ?? 1} max={q.max_value ?? 10}
                                            value={answers[q.id] ?? q.min_value ?? 1}
                                            onChange={e => setAnswer(q.id, e.target.value)}
                                            disabled={locked} className="flex-1 cursor-pointer" />
                                        <span className="text-xs text-muted-foreground w-4">{q.max_value ?? 10}</span>
                                    </div>
                                    <p className="text-center text-sm font-semibold text-primary">
                                        {answers[q.id] ?? q.min_value ?? 1}
                                    </p>
                                </div>
                            )}

                            {q.type === 'select' && (
                                <select value={answers[q.id] ?? ''} onChange={e => setAnswer(q.id, e.target.value)}
                                    disabled={locked} className={inputCls}>
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
                                                <input type="checkbox" checked={checked} disabled={locked}
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

                            {isSubmitted && (
                                <div className="flex justify-end gap-2 mt-2 pt-1">
                                    {editingQuestionId === q.id ? (
                                        <>
                                            <button type="button" onClick={() => cancelEdit(q, response)}
                                                className="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:bg-default transition-colors cursor-pointer">
                                                {tCommon('cancel')}
                                            </button>
                                            <button type="button" onClick={() => saveEdit(q)} disabled={savingQuestionId === q.id}
                                                className="text-xs px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors cursor-pointer">
                                                {savingQuestionId === q.id ? tCommon('saving') : t('saveAnswer')}
                                            </button>
                                        </>
                                    ) : (
                                        <NewFeatureTooltip
                                            featureKey="edit_answer_hint"
                                            active={isFirstEditableQuestion}
                                            message={t('editHint')}
                                            dismissLabel={t('editHintDismiss')}
                                            badgeLabel={t('editHintNewFeature')}
                                            onTriggerClick={() => startEdit(q)}
                                            triggerClassName="text-xs px-3 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors cursor-pointer"
                                        >
                                            {t('editAnswer')}
                                        </NewFeatureTooltip>
                                    )}
                                </div>
                            )}
                            {editError && editingQuestionId === q.id && (
                                <p className="text-xs text-destructive">{editError}</p>
                            )}
                            {response?.edited && editingQuestionId !== q.id && (
                                <AnswerEditHistory history={response.history} label={t('editHistory')} />
                            )}
                        </Card.Content>
                    </Card>
                    );
                })}

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

function MetricPhotoInput({ questionId, value, isSubmitted, onChange, t }) {
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');

    async function handleFile(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadError('');
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('photo', file);
            const res = await api.post('/api/client-portal/uploads/photo', fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            onChange(questionId, res.data.url);
        } catch {
            setUploadError(t('uploadFailed'));
        } finally {
            setUploading(false);
        }
    }

    if (isSubmitted && value) {
        return (
            <img src={value} alt={t('progressPhotoAlt')} className="w-full max-h-72 object-cover rounded-lg border border-border" />
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <label className={`flex flex-col items-center justify-center gap-2 w-full rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                value ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/40 bg-secondary'
            } ${isSubmitted ? 'opacity-60 pointer-events-none' : ''}`}>
                <input type="file" accept="image/*" className="sr-only" onChange={handleFile} disabled={isSubmitted || uploading} />
                {uploading ? (
                    <div className="py-8 flex flex-col items-center gap-2">
                        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        <span className="text-xs text-muted-foreground">{t('uploading')}</span>
                    </div>
                ) : value ? (
                    <div className="relative w-full">
                        <img src={value} alt={t('progressPhotoAlt')} className="w-full max-h-56 object-cover rounded-lg" />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg opacity-0 hover:opacity-100 transition-opacity">
                            <span className="text-white text-xs font-medium">{t('tapToReplace')}</span>
                        </div>
                    </div>
                ) : (
                    <div className="py-10 flex flex-col items-center gap-2">
                        <span className="text-3xl">📷</span>
                        <span className="text-sm font-medium text-foreground">{t('tapToUploadPhoto')}</span>
                        <span className="text-xs text-muted-foreground">{t('hintImages')}</span>
                    </div>
                )}
            </label>
            {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
        </div>
    );
}

const ACCEPT_BY_CATEGORY = {
    images: 'image/*',
    documents: '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt',
    videos: 'video/*',
    any: undefined,
};

const HINT_KEY_BY_CATEGORY = {
    images: 'hintImages',
    documents: 'hintDocuments',
    videos: 'hintVideos',
    any: 'hintAny',
};

function fileNameFromUrl(url) {
    try {
        return decodeURIComponent(new URL(url, window.location.origin).pathname.split('/').pop() || 'file');
    } catch {
        return 'file';
    }
}

// Generalized from MetricPhotoInput — same upload-then-store-the-URL
// pattern (see server/src/lib/formAttachments.ts), but for any of the 4
// attachment categories a coach can configure on the question, not just
// progress photos.
function AttachmentInput({ questionId, value, isSubmitted, onChange, category, t }) {
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');

    async function handleFile(e) {
        const file = e.target.files?.[0];
        if (!file) return;
        setUploadError('');
        setUploading(true);
        try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await api.post(`/api/client-portal/uploads/attachment/${category}`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            onChange(questionId, res.data.url);
        } catch (err) {
            setUploadError(err.response?.data?.error || t('uploadFailed'));
        } finally {
            setUploading(false);
        }
    }

    if (category === 'images') {
        if (isSubmitted && value) {
            return <img src={value} alt={t('attachmentAlt')} className="w-full max-h-72 object-cover rounded-lg border border-border" />;
        }
        return (
            <div className="flex flex-col gap-2">
                <label className={`flex flex-col items-center justify-center gap-2 w-full rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                    value ? 'border-primary/40 bg-primary/5' : 'border-border hover:border-primary/40 bg-secondary'
                } ${isSubmitted ? 'opacity-60 pointer-events-none' : ''}`}>
                    <input type="file" accept={ACCEPT_BY_CATEGORY.images} className="sr-only" onChange={handleFile} disabled={isSubmitted || uploading} />
                    {uploading ? (
                        <div className="py-8 flex flex-col items-center gap-2">
                            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            <span className="text-xs text-muted-foreground">{t('uploading')}</span>
                        </div>
                    ) : value ? (
                        <div className="relative w-full">
                            <img src={value} alt={t('attachmentAlt')} className="w-full max-h-56 object-cover rounded-lg" />
                            <div className="absolute inset-0 flex items-center justify-center bg-black/40 rounded-lg opacity-0 hover:opacity-100 transition-opacity">
                                <span className="text-white text-xs font-medium">{t('tapToReplace')}</span>
                            </div>
                        </div>
                    ) : (
                        <div className="py-10 flex flex-col items-center gap-2">
                            <span className="text-3xl">📷</span>
                            <span className="text-sm font-medium text-foreground">{t('tapToUploadImage')}</span>
                            <span className="text-xs text-muted-foreground">{t(HINT_KEY_BY_CATEGORY.images)}</span>
                        </div>
                    )}
                </label>
                {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
            </div>
        );
    }

    // documents / videos / any — a file-chip presentation, not an inline
    // preview (see the Coach Portal viewer's identical category branching).
    return (
        <div className="flex flex-col gap-2">
            {value ? (
                <a href={value} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-secondary hover:border-primary/40 transition-colors">
                    <span className="text-xl shrink-0">📎</span>
                    <span className="flex-1 text-sm text-foreground truncate">{fileNameFromUrl(value)}</span>
                    <span className="text-xs text-primary shrink-0">{t('openLink')}</span>
                </a>
            ) : null}
            {!isSubmitted && (
                <label className="flex items-center justify-center gap-2 w-full py-3 rounded-lg border-2 border-dashed border-border hover:border-primary/40 bg-secondary cursor-pointer transition-colors">
                    <input type="file" accept={ACCEPT_BY_CATEGORY[category]} className="sr-only" onChange={handleFile} disabled={uploading} />
                    {uploading ? (
                        <span className="text-xs text-muted-foreground flex items-center gap-2">
                            <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            {t('uploading')}
                        </span>
                    ) : (
                        <span className="text-sm text-foreground">{value ? t('tapToReplaceFile') : t('tapToUploadFile')}</span>
                    )}
                </label>
            )}
            {!isSubmitted && <p className="text-xs text-muted-foreground">{t(HINT_KEY_BY_CATEGORY[category])}</p>}
            {uploadError && <p className="text-xs text-destructive">{uploadError}</p>}
        </div>
    );
}
