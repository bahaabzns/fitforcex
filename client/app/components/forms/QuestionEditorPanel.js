"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { PenLine } from "lucide-react";
import { Button } from "@heroui/react/button";
import { Switch } from "@heroui/react/switch";
import { Separator, Surface } from "@heroui/react";
import { ScrollShadow } from "@heroui/react/scroll-shadow";
import EmptyState from "@/app/components/EmptyState";
import api from "@/lib/axios";

const QUESTION_TYPE_VALUES = [
    { value: "text",        labelKey: "typeShortText",   icon: "T" },
    { value: "long_text",   labelKey: "typeLongText",    icon: "¶" },
    { value: "number",      labelKey: "typeNumber",      icon: "#" },
    { value: "scale",       labelKey: "typeScale",       icon: "↔" },
    { value: "select",      labelKey: "typeSingleChoice",icon: "◉" },
    { value: "multiselect", labelKey: "typeMultiChoice", icon: "☑" },
    { value: "date",        labelKey: "typeDate",        icon: "📅" },
    { value: "metric",      labelKey: "typeMetric",      icon: "📊" },
];

const TrashIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
        <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
);

export default function QuestionEditorPanel({
    selectedQuestion, setSelectedQuestion,
    pendingFocusQuestionId, setPendingFocusQuestionId,
    handleUpdateQuestion,
}) {
    const t = useTranslations('forms');
    const tCommon = useTranslations('common');
    const QUESTION_TYPES = QUESTION_TYPE_VALUES.map(q => ({ ...q, label: t(q.labelKey) }));
    const labelRef = useRef(null);
    const [newOption, setNewOption] = useState("");
    const [metrics, setMetrics] = useState([]);

    useEffect(() => {
        if (pendingFocusQuestionId && selectedQuestion?.id === pendingFocusQuestionId) {
            labelRef.current?.focus();
            labelRef.current?.select();
            setPendingFocusQuestionId(null);
        }
    }, [pendingFocusQuestionId, selectedQuestion?.id, setPendingFocusQuestionId]);

    useEffect(() => {
        api.get('/api/metrics')
            .then(res => setMetrics(res.data || []))
            .catch(() => {});
    }, []);

    if (!selectedQuestion) {
        return (
            <Surface variant="default" className="w-full flex flex-col min-h-full p-3 rounded-2xl shadow-surface">
                <EmptyState
                    variant="firstTime"
                    icon={PenLine}
                    title={t('noQuestionSelected')}
                    description={t('noQuestionHint')}
                />
            </Surface>
        );
    }

    const q = selectedQuestion;
    const isMetricType   = q.type === 'metric';
    const hasOptions     = q.type === 'select' || q.type === 'multiselect';
    const hasPlaceholder = ['text', 'long_text', 'number'].includes(q.type);
    const hasScale       = q.type === 'scale';

    const numberMetrics = metrics.filter(m => m.type === 'number');
    const imageMetrics  = metrics.filter(m => m.type === 'image');
    const linkedMetric  = q.metric_id ? metrics.find(m => m.id === q.metric_id) : null;

    function save(updates) {
        handleUpdateQuestion(q.id, updates);
    }

    function addOption() {
        const val = newOption.trim();
        if (!val) return;
        const updated = [...(q.options || []), val];
        save({ options: updated });
        setNewOption("");
    }

    function removeOption(idx) {
        const updated = (q.options || []).filter((_, i) => i !== idx);
        save({ options: updated });
    }

    return (
        <Surface variant="default" className="w-full flex flex-col overflow-hidden min-h-full p-3 rounded-2xl shadow-surface">

            {/* Header: inline label input + close */}
            <div className="flex justify-between items-center mb-3 gap-4 shrink-0">
                <input
                    ref={labelRef}
                    key={`label-${q.id}`}
                    type="text"
                    defaultValue={q.label_en}
                    onBlur={(e) => {
                        const trimmed = e.target.value.trim() || "Question";
                        e.target.value = trimmed;
                        if (trimmed !== q.label_en) save({ label_en: trimmed });
                    }}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') e.target.blur();
                        if (e.key === 'Escape') { e.target.value = q.label_en; e.target.blur(); }
                    }}
                    className="flex-1 text-base font-semibold bg-transparent border border-transparent rounded-md px-2 py-1 outline-none w-full transition-colors hover:border-primary/30 truncate text-foreground"
                />
                <button
                    title={tCommon('close')}
                    className="cursor-pointer p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-default transition-colors shrink-0"
                    onClick={() => setSelectedQuestion(null)}
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>

            <Separator className="my-2 shrink-0" />

            {/* Scrollable content */}
            <ScrollShadow className="flex-1 min-h-0" hideScrollBar>
                <div className="flex flex-col gap-5 pb-4">

                {/* Type */}
                <Field label={t('questionType')}>
                    <select
                        key={`type-${q.id}`}
                        defaultValue={q.type}
                        onChange={(e) => save({ type: e.target.value })}
                        className="w-full px-3 py-2.5 text-sm text-foreground bg-card border border-border rounded-lg outline-none hover:border-primary/40 transition-colors"
                    >
                        {QUESTION_TYPES.map(({ value, label, icon }) => (
                            <option key={value} value={value}>{icon} {label}</option>
                        ))}
                    </select>
                </Field>

                {/* Metric picker */}
                {isMetricType && (
                    <Field label="Metric">
                        {!q.metric_id && (
                            <div className="flex items-start gap-2 mb-2 px-3 py-2 rounded-lg bg-warning/10 border border-warning/30">
                                <span className="text-warning text-sm shrink-0">⚠</span>
                                <p className="text-xs text-warning">Select a metric below — this question won't track data until one is chosen.</p>
                            </div>
                        )}
                        {metrics.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">No metrics found. Add metrics from Forms Metrics.</p>
                        ) : (
                            <>
                                <select
                                    key={`metric-${q.id}-${q.metric_id || 'none'}`}
                                    defaultValue={q.metric_id || ''}
                                    onChange={(e) => save({ metric_id: e.target.value || null })}
                                    className="w-full px-3 py-2.5 text-sm text-foreground bg-card border border-border rounded-lg outline-none hover:border-primary/40 transition-colors"
                                >
                                    <option value="">Select a metric</option>
                                    {numberMetrics.length > 0 && (
                                        <optgroup label="Number Metrics">
                                            {numberMetrics.map(m => (
                                                <option key={m.id} value={m.id}>
                                                    {m.icon} {m.name}{m.unit ? ` (${m.unit})` : ''}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                    {imageMetrics.length > 0 && (
                                        <optgroup label="Photo Metrics">
                                            {imageMetrics.map(m => (
                                                <option key={m.id} value={m.id}>
                                                    {m.icon} {m.name}
                                                </option>
                                            ))}
                                        </optgroup>
                                    )}
                                </select>
                                {linkedMetric && (
                                    <p className="text-xs text-primary/80 mt-1.5 flex items-center gap-1.5">
                                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                                        Answers contribute to the <strong>{linkedMetric.name}</strong> history
                                    </p>
                                )}
                            </>
                        )}
                    </Field>
                )}

                {/* Required */}
                {!isMetricType && (
                    <div className="flex items-center justify-between gap-3 shrink-0">
                        <div>
                            <p className="text-sm font-medium text-foreground">{t('required')}</p>
                            <p className="text-xs text-muted-foreground">{t('requiredHint')}</p>
                        </div>
                        <Switch checked={q.required} onCheckedChange={(checked) => save({ required: checked })}>
                            <Switch.Control>
                                <Switch.Thumb />
                            </Switch.Control>
                        </Switch>
                    </div>
                )}

                {/* Placeholder */}
                {hasPlaceholder && (
                    <Field label={t('placeholderText')}>
                        <input
                            key={`ph-${q.id}`}
                            type="text"
                            defaultValue={q.placeholder_en || ''}
                            onBlur={(e) => {
                                const val = e.target.value.trim() || null;
                                if (val !== (q.placeholder_en || null)) save({ placeholder_en: val });
                            }}
                            onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }}
                            placeholder={t('placeholderHint')}
                            className="w-full px-3 py-2.5 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors"
                        />
                    </Field>
                )}

                {/* Scale min/max */}
                {hasScale && (
                    <Field label={t('scaleRange')}>
                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <label className="text-xs text-muted-foreground mb-1 block">{t('scaleMin')}</label>
                                <input
                                    key={`min-${q.id}`}
                                    type="number"
                                    defaultValue={q.min_value ?? 1}
                                    onBlur={(e) => save({ min_value: parseInt(e.target.value) || 1 })}
                                    className="w-full px-3 py-2.5 text-sm text-foreground bg-card border border-border rounded-lg outline-none text-center hover:border-primary/40 transition-colors"
                                    min={0} max={10}
                                />
                            </div>
                            <span className="text-muted-foreground/40 mt-5 text-lg">—</span>
                            <div className="flex-1">
                                <label className="text-xs text-muted-foreground mb-1 block">{t('scaleMax')}</label>
                                <input
                                    key={`max-${q.id}`}
                                    type="number"
                                    defaultValue={q.max_value ?? 10}
                                    onBlur={(e) => save({ max_value: parseInt(e.target.value) || 10 })}
                                    className="w-full px-3 py-2.5 text-sm text-foreground bg-card border border-border rounded-lg outline-none text-center hover:border-primary/40 transition-colors"
                                    min={1} max={100}
                                />
                            </div>
                        </div>
                        <div className="mt-3 flex items-center justify-between">
                            {[...Array(Math.min((q.max_value ?? 10) - (q.min_value ?? 1) + 1, 11))].map((_, i) => {
                                const val = (q.min_value ?? 1) + i;
                                return (
                                    <div key={val} className="flex flex-col items-center gap-1">
                                        <div className="w-7 h-7 rounded-full border-2 border-border bg-card flex items-center justify-center text-xs text-muted-foreground font-medium">
                                            {val}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </Field>
                )}

                {/* Options */}
                {hasOptions && (
                    <Field label={`${t('options')} (${(q.options || []).length})`}>
                        <div className="flex flex-col gap-1.5 mb-3">
                            {(q.options || []).length === 0 ? (
                                <p className="text-xs text-muted-foreground py-2 text-center">{t('noOptions')}</p>
                            ) : (
                                (q.options || []).map((opt, idx) => (
                                    <div key={idx} className="flex items-center gap-2 group">
                                        <span className={`shrink-0 w-4 h-4 border-2 border-border ${q.type === 'multiselect' ? 'rounded' : 'rounded-full'}`} />
                                        <span className="flex-1 text-sm text-foreground truncate">{opt}</span>
                                        <button
                                            className="cursor-pointer shrink-0 p-1 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                                            onClick={() => removeOption(idx)}
                                        >
                                            <TrashIcon />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newOption}
                                onChange={(e) => setNewOption(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                                placeholder={t('addOptionHint')}
                                className="flex-1 px-3 py-2.5 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors"
                            />
                            <Button variant="primary" onClick={addOption} className="shrink-0">
                                {tCommon('add')}
                            </Button>
                        </div>
                    </Field>
                )}

                {/* Preview */}
                <div className="rounded-xl bg-secondary border border-border p-4">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">{t('preview')}</p>
                    <QuestionPreview question={q} linkedMetric={linkedMetric} />
                </div>

                </div>
            </ScrollShadow>
        </Surface>
    );
}

function Field({ label, required, children }) {
    return (
        <div className="shrink-0">
            <label className="block text-sm font-medium text-foreground mb-1.5">
                {label}
                {required && <span className="text-destructive ml-1">*</span>}
            </label>
            {children}
        </div>
    );
}

function QuestionPreview({ question: q, linkedMetric }) {
    const ph = q.placeholder_en || "Your answer";
    switch (q.type) {
        case 'metric': {
            if (!linkedMetric) return <p className="text-xs text-muted-foreground italic">Select a metric above to preview</p>;
            if (linkedMetric.type === 'image') {
                return (
                    <div className="w-full h-24 rounded-lg border-2 border-dashed border-border bg-background flex flex-col items-center justify-center gap-1 opacity-60">
                        <span className="text-2xl">📷</span>
                        <span className="text-xs text-muted-foreground">Upload photo</span>
                    </div>
                );
            }
            return (
                <div className="flex items-center gap-2 opacity-60">
                    <input type="number" placeholder={`Enter ${linkedMetric.name.toLowerCase()}`} disabled
                        className="flex-1 px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm" />
                    {linkedMetric.unit && <span className="text-sm text-muted-foreground shrink-0">{linkedMetric.unit}</span>}
                </div>
            );
        }
        case 'text':
            return <input type="text" placeholder={ph} disabled className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm opacity-60" />;
        case 'long_text':
            return <textarea rows={2} placeholder={ph} disabled className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm opacity-60 resize-none" />;
        case 'number':
            return <input type="number" placeholder={ph} disabled className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm opacity-60" />;
        case 'date':
            return <input type="date" disabled className="w-full px-3 py-2 rounded-lg border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm opacity-60" />;
        case 'scale': {
            const min = q.min_value ?? 1;
            const max = q.max_value ?? 10;
            const count = Math.min(max - min + 1, 11);
            return (
                <div className="flex gap-1 flex-wrap">
                    {[...Array(count)].map((_, i) => (
                        <div key={i} className="flex-1 min-w-7 h-8 rounded-lg border border-border bg-card flex items-center justify-center text-xs text-muted-foreground font-medium">
                            {min + i}
                        </div>
                    ))}
                </div>
            );
        }
        case 'select':
        case 'multiselect': {
            const opts = q.options || [];
            if (opts.length === 0) return <p className="text-xs text-muted-foreground">No options added yet</p>;
            return (
                <div className="flex flex-col gap-1.5">
                    {opts.map((opt, i) => (
                        <label key={i} className="flex items-center gap-2 cursor-not-allowed opacity-60">
                            <input
                                type={q.type === 'multiselect' ? 'checkbox' : 'radio'}
                                disabled
                                className="accent-primary"
                            />
                            <span className="text-sm text-foreground">{opt}</span>
                        </label>
                    ))}
                </div>
            );
        }
        default:
            return null;
    }
}
