"use client";

import { useState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { PenLine, Ruler, Camera } from "lucide-react";
import { Button } from "@heroui/react/button";
import { Switch } from "@heroui/react/switch";
import { Separator, Surface } from "@heroui/react";
import { ScrollShadow } from "@/app/components/ScrollShadow";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";
import { Header } from "react-aria-components";
import EmptyState from "@/app/components/EmptyState";
import InlineEditField from "@/app/components/InlineEditField";
import api from "@/lib/axios";
import { QUESTION_TYPE_VALUES, METRIC_CONVERTIBLE_TYPES, ATTACHMENT_CATEGORIES } from "./questionTypes";
import AppModal, { ModalFooter } from "@/app/components/Modal";

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
    isDirty,
    handleGetMetricPreview,
    handleTrackAsMetric,
}) {
    const t = useTranslations('forms');
    const tCommon = useTranslations('common');
    const QUESTION_TYPES = QUESTION_TYPE_VALUES.map(q => ({ ...q, label: t(q.labelKey) }));
    const labelRef = useRef(null);
    const [newOption, setNewOption] = useState("");
    const [metrics, setMetrics] = useState([]);
    const [trackModalOpen, setTrackModalOpen] = useState(false);

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
    const isMetricType     = q.type === 'metric';
    const isAttachmentType = q.type === 'attachment';
    const hasOptions       = q.type === 'select' || q.type === 'multiselect';
    const hasPlaceholder   = ['text', 'long_text', 'number'].includes(q.type);
    const hasScale         = q.type === 'scale';
    const allowedCategory  = q.options?.allowedCategory || 'any';

    const numberMetrics = metrics.filter(m => m.type === 'number');
    const imageMetrics  = metrics.filter(m => m.type === 'image');
    const linkedMetric  = q.metric_id ? metrics.find(m => m.id === q.metric_id) : null;

    // "Track as Metric" (Phase 4) — only offered for a saved (non-temp)
    // question of a numeric-answer type that isn't already metric-linked,
    // and only while the builder has no unsaved changes: this action forks
    // a version immediately (see forms.controller.ts's trackQuestionAsMetric),
    // which would silently invalidate any local unsaved edit still holding
    // the pre-fork ids.
    const isTrackable = !isMetricType
        && METRIC_CONVERTIBLE_TYPES.includes(q.type)
        && !String(q.id).startsWith('tmp-q-')
        && Boolean(handleGetMetricPreview && handleTrackAsMetric); // absent on the Master Templates builder — no workspace, no metrics

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
        const updatedAr = (q.options_ar || []).filter((_, i) => i !== idx);
        save({ options: updated, options_ar: updatedAr });
    }

    function updateOption(idx, val) {
        const updated = [...q.options];
        updated[idx] = val;
        save({ options: updated });
    }

    function updateOptionAr(idx, val) {
        const updated = [...(q.options_ar || [])];
        while (updated.length <= idx) updated.push('');
        updated[idx] = val || '';
        save({ options_ar: updated.map(v => v ?? '') });
    }

    return (
        <Surface variant="default" className="w-full flex flex-col overflow-hidden min-h-full p-3 rounded-2xl shadow-surface">

            {/* Header: inline label input (EN + Arabic) + close */}
            <div className="mb-3 shrink-0">
                <div className="flex justify-between items-center gap-4">
                    <InlineEditField
                        ref={labelRef}
                        key={q.id}
                        value={q.label_en}
                        fallback="Question"
                        onCommit={(name) => save({ label_en: name })}
                        ariaLabel="Question label"
                        variant="primary"
                        className="flex-1 min-w-0"
                        inputClassName="text-base font-semibold truncate"
                    />
                    <button
                        title={tCommon('close')}
                        className="cursor-pointer p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-default transition-colors shrink-0"
                        onClick={() => setSelectedQuestion(null)}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                </div>
                <InlineEditField
                    key={`label-ar-${q.id}`}
                    value={q.label_ar || ""}
                    onCommit={(name) => save({ label_ar: name || null })}
                    ariaLabel={t('labelArLabel')}
                    variant="primary"
                    dir="rtl"
                    placeholder={t('labelArHint')}
                    className="w-full mt-1.5"
                    inputClassName="text-sm text-muted-foreground"
                />
            </div>

            <Separator className="my-2 shrink-0" />

            {/* Scrollable content */}
            <ScrollShadow className="flex-1 min-h-0" hideScrollBar>
                <div className="flex flex-col gap-5 px-0.5 pb-4">

                {/* Type */}
                <Field label={t('questionType')}>
                    <Select
                        variant="secondary"
                        fullWidth
                        aria-label={t('questionType')}
                        value={q.type}
                        onChange={(key) => save({ type: key })}
                    >
                        <Select.Trigger>
                            <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
                            <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                            <ListBox>
                                {QUESTION_TYPES.map(({ value, label, icon: Icon }) => (
                                    <ListBox.Item key={value} id={value} textValue={label}>
                                        <Icon size={16} className="shrink-0 opacity-70" />
                                        {label}
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                ))}
                            </ListBox>
                        </Select.Popover>
                    </Select>
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
                                <Select
                                    variant="secondary"
                                    fullWidth
                                    placeholder="Select a metric"
                                    aria-label="Metric"
                                    value={q.metric_id || ''}
                                    onChange={(key) => save({ metric_id: key || null })}
                                >
                                    <Select.Trigger>
                                        <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
                                        <Select.Indicator />
                                    </Select.Trigger>
                                    <Select.Popover>
                                        <ListBox>
                                            {numberMetrics.length > 0 && (
                                                <ListBox.Section>
                                                    <Header>Number Metrics</Header>
                                                    {numberMetrics.map(m => (
                                                        <ListBox.Item key={m.id} id={m.id} textValue={`${m.name}${m.unit ? ` (${m.unit})` : ''}`}>
                                                            <Ruler size={16} className="shrink-0 opacity-70" />
                                                            {m.name}{m.unit ? ` (${m.unit})` : ''}
                                                            <ListBox.ItemIndicator />
                                                        </ListBox.Item>
                                                    ))}
                                                </ListBox.Section>
                                            )}
                                            {imageMetrics.length > 0 && (
                                                <ListBox.Section>
                                                    <Header>Photo Metrics</Header>
                                                    {imageMetrics.map(m => (
                                                        <ListBox.Item key={m.id} id={m.id} textValue={m.name}>
                                                            <Camera size={16} className="shrink-0 opacity-70" />
                                                            {m.name}
                                                            <ListBox.ItemIndicator />
                                                        </ListBox.Item>
                                                    ))}
                                                </ListBox.Section>
                                            )}
                                        </ListBox>
                                    </Select.Popover>
                                </Select>
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

                {/* Attachment category — a server-enforced upload constraint
                    (forms.controller.ts/formAttachments.ts), not just a client hint. */}
                {isAttachmentType && (
                    <Field label="Allowed Files">
                        <Select
                            variant="secondary"
                            fullWidth
                            aria-label="Allowed Files"
                            value={allowedCategory}
                            onChange={(key) => save({ options: { allowedCategory: key } })}
                        >
                            <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    {ATTACHMENT_CATEGORIES.map(({ value, label }) => (
                                        <ListBox.Item key={value} id={value} textValue={label}>
                                            {label}
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
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

                {/* Track as Metric */}
                {isTrackable && (
                    <div className="shrink-0">
                        <Button
                            variant="outline"
                            isDisabled={isDirty}
                            onClick={() => setTrackModalOpen(true)}
                            className="w-full"
                        >
                            📊 Track as Metric
                        </Button>
                        {isDirty && (
                            <p className="text-xs text-muted-foreground mt-1.5">Save your changes first to track this question as a metric.</p>
                        )}
                    </div>
                )}

                {/* Placeholder */}
                {hasPlaceholder && (
                    <Field label={t('placeholderText')}>
                        <TextField key={`ph-${q.id}`} variant="secondary" fullWidth>
                            <Input
                                type="text"
                                defaultValue={q.placeholder_en || ''}
                                onBlur={(e) => {
                                    const val = e.target.value.trim() || null;
                                    if (val !== (q.placeholder_en || null)) save({ placeholder_en: val });
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.target.blur();
                                    if (e.key === 'Escape') { e.target.value = q.placeholder_en || ''; e.target.blur(); }
                                }}
                                placeholder={t('placeholderHint')}
                                className="text-sm"
                            />
                        </TextField>
                    </Field>
                )}

                {/* Placeholder (Arabic) */}
                {hasPlaceholder && (
                    <Field label={t('placeholderArLabel')}>
                        <TextField key={`ph-ar-${q.id}`} variant="secondary" fullWidth>
                            <Input
                                type="text"
                                dir="rtl"
                                defaultValue={q.placeholder_ar || ''}
                                onBlur={(e) => {
                                    const val = e.target.value.trim() || null;
                                    if (val !== (q.placeholder_ar || null)) save({ placeholder_ar: val });
                                }}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') e.target.blur();
                                    if (e.key === 'Escape') { e.target.value = q.placeholder_ar || ''; e.target.blur(); }
                                }}
                                placeholder={t('placeholderArHint')}
                                className="text-sm"
                            />
                        </TextField>
                    </Field>
                )}

                {/* Scale min/max */}
                {hasScale && (
                    <Field label={t('scaleRange')}>
                        <div className="flex items-center gap-3">
                            <div className="flex-1">
                                <label className="text-xs text-muted-foreground mb-1 block">{t('scaleMin')}</label>
                                <TextField key={`min-${q.id}`} variant="secondary" fullWidth>
                                    <Input
                                        type="number"
                                        defaultValue={q.min_value ?? 1}
                                        onBlur={(e) => save({ min_value: parseInt(e.target.value) || 1 })}
                                        className="text-sm text-center"
                                        min={0} max={10}
                                    />
                                </TextField>
                            </div>
                            <span className="text-muted-foreground/40 mt-5 text-lg">—</span>
                            <div className="flex-1">
                                <label className="text-xs text-muted-foreground mb-1 block">{t('scaleMax')}</label>
                                <TextField key={`max-${q.id}`} variant="secondary" fullWidth>
                                    <Input
                                        type="number"
                                        defaultValue={q.max_value ?? 10}
                                        onBlur={(e) => save({ max_value: parseInt(e.target.value) || 10 })}
                                        className="text-sm text-center"
                                        min={1} max={100}
                                    />
                                </TextField>
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
                                    <div key={idx} className="flex items-start gap-2 group">
                                        <span className={`shrink-0 w-4 h-4 mt-2 border-2 border-border ${q.type === 'multiselect' ? 'rounded' : 'rounded-full'}`} />
                                        <div className="flex-1 min-w-0 flex flex-col gap-1 py-0.5">
                                            <InlineEditField
                                                key={`opt-${idx}`}
                                                value={opt}
                                                fallback={opt}
                                                onCommit={(text) => updateOption(idx, text)}
                                                ariaLabel={`${t('options')} ${idx + 1}`}
                                                variant="secondary"
                                                className="w-full"
                                                inputClassName="text-sm"
                                            />
                                            <InlineEditField
                                                key={`opt-ar-${idx}`}
                                                value={q.options_ar?.[idx] || ""}
                                                onCommit={(text) => updateOptionAr(idx, text)}
                                                ariaLabel={`${t('optionArHint')} ${idx + 1}`}
                                                variant="secondary"
                                                dir="rtl"
                                                placeholder={t('optionArHint')}
                                                className="w-full"
                                                inputClassName="text-xs"
                                            />
                                        </div>
                                        <button
                                            className="cursor-pointer shrink-0 p-1 mt-2 text-muted-foreground/40 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                                            onClick={() => removeOption(idx)}
                                        >
                                            <TrashIcon />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                        <div className="flex gap-2">
                            <TextField variant="secondary" value={newOption} onChange={setNewOption} className="flex-1">
                                <Input
                                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOption(); } }}
                                    placeholder={t('addOptionHint')}
                                    className="text-sm"
                                />
                            </TextField>
                            <Button variant="primary" onClick={addOption} className="shrink-0">
                                {tCommon('add')}
                            </Button>
                        </div>
                    </Field>
                )}

                </div>
            </ScrollShadow>

            {trackModalOpen && (
                <TrackAsMetricModal
                    question={q}
                    numberMetrics={numberMetrics}
                    onClose={() => setTrackModalOpen(false)}
                    handleGetMetricPreview={handleGetMetricPreview}
                    handleTrackAsMetric={handleTrackAsMetric}
                />
            )}
        </Surface>
    );
}

// "Track as Metric" (Phase 4) — the coach picks a metric, sees exactly how
// many historical answers will be backfilled (across the question's full
// version-fork lineage — see the metric-preview endpoint), and confirms.
// Backfill is automatic on confirm, not a separate opt-in step: the coach's
// intent in choosing a metric here is already unambiguous.
function TrackAsMetricModal({ question, numberMetrics, onClose, handleGetMetricPreview, handleTrackAsMetric }) {
    const [selectedMetricId, setSelectedMetricId] = useState("");
    const [preview, setPreview] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);

    useEffect(() => {
        let cancelled = false;
        handleGetMetricPreview(question.id).then((data) => {
            if (!cancelled) setPreview(data);
        });
        return () => { cancelled = true; };
    }, [question.id, handleGetMetricPreview]);

    async function handleConfirm() {
        if (!selectedMetricId) return;
        setSubmitting(true);
        const res = await handleTrackAsMetric(question.id, selectedMetricId);
        setSubmitting(false);
        if (res.success) {
            setResult(res);
        } else {
            window.alert(res.error || 'Could not track this question as a metric — check your connection and retry.');
        }
    }

    const selectedMetric = numberMetrics.find(m => m.id === selectedMetricId);

    return (
        <AppModal open onClose={onClose} title="Track as Metric">
            {result ? (
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-foreground">
                        Done — <strong>{selectedMetric?.name}</strong> is now tracked.
                        {result.backfilledCount > 0
                            ? ` ${result.backfilledCount} historical response(s) became historical ${selectedMetric?.name} metrics.`
                            : ' There was no prior history to backfill.'}
                    </p>
                    <ModalFooter>
                        <Button variant="primary" onClick={onClose}>{`Done`}</Button>
                    </ModalFooter>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    <p className="text-sm text-muted-foreground">
                        The question itself doesn&apos;t change — it will simply become a tracked metric throughout the app,
                        including on the client&apos;s progress charts.
                    </p>

                    <Field label="Metric">
                        {numberMetrics.length === 0 ? (
                            <p className="text-xs text-muted-foreground py-2">No number metrics found. Add one from Forms Metrics first.</p>
                        ) : (
                            <Select
                                variant="secondary"
                                fullWidth
                                placeholder="Select a metric"
                                aria-label="Metric"
                                value={selectedMetricId}
                                onChange={setSelectedMetricId}
                            >
                                <Select.Trigger>
                                    <Select.Value>{({ selectedText }) => selectedText}</Select.Value>
                                    <Select.Indicator />
                                </Select.Trigger>
                                <Select.Popover>
                                    <ListBox>
                                        {numberMetrics.map(m => (
                                            <ListBox.Item key={m.id} id={m.id} textValue={`${m.name}${m.unit ? ` (${m.unit})` : ''}`}>
                                                <Ruler size={16} className="shrink-0 opacity-70" />
                                                {m.name}{m.unit ? ` (${m.unit})` : ''}
                                                <ListBox.ItemIndicator />
                                            </ListBox.Item>
                                        ))}
                                    </ListBox>
                                </Select.Popover>
                            </Select>
                        )}
                    </Field>

                    {preview === null ? (
                        <p className="text-xs text-muted-foreground">Checking history…</p>
                    ) : preview.count > 0 ? (
                        <p className="text-xs text-foreground bg-secondary border border-border rounded-lg px-3 py-2">
                            This question has <strong>{preview.count}</strong> historical response{preview.count === 1 ? '' : 's'}.
                            {selectedMetric
                                ? ` They will automatically become historical ${selectedMetric.name} metrics after tracking.`
                                : ' They will automatically become historical metrics after tracking.'}
                        </p>
                    ) : (
                        <p className="text-xs text-muted-foreground">This question has no historical responses yet — nothing to backfill.</p>
                    )}

                    <ModalFooter>
                        <Button variant="ghost" onClick={onClose}>Cancel</Button>
                        <Button variant="primary" isDisabled={!selectedMetricId || submitting} onClick={handleConfirm}>
                            {submitting ? 'Tracking…' : 'Track'}
                        </Button>
                    </ModalFooter>
                </div>
            )}
        </AppModal>
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

