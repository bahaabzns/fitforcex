"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import api from "@/lib/axios";
import { CheckCircle } from "lucide-react";

export default function ClientFillFormPage() {
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
                // Pre-fill answers if already submitted (read-only view)
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

        // Validate required questions
        const missing = data.questions.filter(q => q.required && !answers[q.id]?.toString().trim());
        if (missing.length > 0) {
            setError(`Please answer all required questions (${missing.length} missing).`);
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
            setError(e.response?.data?.error || 'Failed to submit. Please try again.');
        } finally {
            setSubmitting(false);
        }
    };

    if (loading) {
        return (
            <div className="p-8 flex items-center justify-center">
                <p className="text-muted-foreground">Loading form…</p>
            </div>
        );
    }

    if (!data) return null;

    const isSubmitted = data.status !== 'pending';

    const inputCls = "w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";

    return (
        <div className="max-w-2xl mx-auto p-6">
            {/* Page header */}
            <div className="flex items-start gap-4 mb-6">
                <button
                    onClick={() => router.push("/client/forms")}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors cursor-pointer mt-1"
                >
                    ← Back
                </button>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-foreground">{data.form_title}</h1>
                    {data.form_description && <p className="text-sm text-muted-foreground mt-0.5">{data.form_description}</p>}
                </div>
                {isSubmitted && (
                    <span className="text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium mt-1">
                        Submitted
                    </span>
                )}
            </div>

            {isSubmitted && (
                <div className="mb-2 px-4 py-3 rounded-lg bg-green-50 border border-green-200 text-sm text-green-700 font-medium flex items-center gap-2">
                    <CheckCircle size={15} /> You have already submitted this form. Your answers are shown below.
                </div>
            )}

            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    {data.questions.map((q, index) => (
                        <div key={q.id} className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 flex flex-col gap-2">
                            <label className="text-sm font-semibold text-foreground">
                                {index + 1}. {q.label}
                                {q.required && <span className="text-destructive ml-1">*</span>}
                            </label>

                            {q.type === 'text' && (
                                <input
                                    type="text"
                                    value={answers[q.id] ?? ''}
                                    onChange={e => setAnswer(q.id, e.target.value)}
                                    placeholder={q.placeholder || ''}
                                    disabled={isSubmitted}
                                    className={`${inputCls} disabled:bg-secondary disabled:text-muted-foreground`}
                                />
                            )}

                            {q.type === 'textarea' && (
                                <textarea
                                    value={answers[q.id] ?? ''}
                                    onChange={e => setAnswer(q.id, e.target.value)}
                                    placeholder={q.placeholder || ''}
                                    disabled={isSubmitted}
                                    rows={4}
                                    className={`${inputCls} resize-none disabled:bg-secondary disabled:text-muted-foreground`}
                                />
                            )}

                            {q.type === 'number' && (
                                <input
                                    type="number"
                                    value={answers[q.id] ?? ''}
                                    onChange={e => setAnswer(q.id, e.target.value)}
                                    placeholder={q.placeholder || ''}
                                    disabled={isSubmitted}
                                    className={`${inputCls} disabled:bg-secondary disabled:text-muted-foreground`}
                                />
                            )}

                            {q.type === 'scale' && (
                                <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-3">
                                        <span className="text-xs text-muted-foreground w-4 text-right">{q.min_value ?? 1}</span>
                                        <input
                                            type="range"
                                            min={q.min_value ?? 1}
                                            max={q.max_value ?? 10}
                                            value={answers[q.id] ?? q.min_value ?? 1}
                                            onChange={e => setAnswer(q.id, e.target.value)}
                                            disabled={isSubmitted}
                                            className="flex-1 cursor-pointer"
                                        />
                                        <span className="text-xs text-muted-foreground w-4">{q.max_value ?? 10}</span>
                                    </div>
                                    <p className="text-center text-sm font-semibold text-primary">
                                        {answers[q.id] ?? q.min_value ?? 1}
                                    </p>
                                </div>
                            )}

                            {q.type === 'select' && (
                                <select
                                    value={answers[q.id] ?? ''}
                                    onChange={e => setAnswer(q.id, e.target.value)}
                                    disabled={isSubmitted}
                                    className={`${inputCls} disabled:bg-secondary disabled:text-muted-foreground`}
                                >
                                    <option value="">Select an option…</option>
                                    {(q.options ?? []).map(opt => (
                                        <option key={opt} value={opt}>{opt}</option>
                                    ))}
                                </select>
                            )}

                            {q.type === 'multiselect' && (
                                <div className="flex flex-col gap-1.5">
                                    {(q.options ?? []).map(opt => {
                                        const selected = (answers[q.id] ?? '').split(',').filter(Boolean);
                                        const checked = selected.includes(opt);
                                        return (
                                            <label key={opt} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={checked}
                                                    disabled={isSubmitted}
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
                        </div>
                    ))}

                    {error && (
                        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-4 py-3">
                            {error}
                        </p>
                    )}

                    {!isSubmitted && (
                        <button
                            type="submit"
                            disabled={submitting}
                            className="inline-flex items-center justify-center w-full rounded-md bg-primary text-primary-foreground hover:bg-primary/90 py-3 text-base font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:pointer-events-none"
                        >
                            {submitting ? 'Submitting…' : 'Submit Form'}
                        </button>
                    )}
                </form>
        </div>
    );
}
