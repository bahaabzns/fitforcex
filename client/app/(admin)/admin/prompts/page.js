'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/axios';
import { useDateFormatter } from '@/utils/useDateFormatter';
import { Plus, X, ChevronDown, ChevronUp, Pencil } from 'lucide-react';
import { Skeleton } from '@heroui/react/skeleton';
import { Button } from '@heroui/react/button';
import { Chip } from '@heroui/react/chip';
import { TextArea } from '@heroui/react/textarea';

const RESPONSE_TYPES = ['rating', 'multiple_choice', 'text', 'rating_with_text'];
const RESPONSE_TYPE_LABELS = { rating: 'rating', multiple_choice: 'multiple choice', text: 'text', rating_with_text: 'rating + text' };
const AUDIENCES = ['everyone', 'user', 'client'];
// Grouped to match insights.service.ts's TRIGGER_EVENTS ordering/comments —
// keep both lists in sync when adding a new trigger.
const TRIGGER_GROUPS = [
    { label: null, options: [{ value: '', label: 'Immediately (manual)' }] },
    { label: 'Training', options: [
        { value: 'first_workout_logged', label: 'After a client logs their first workout' },
        { value: 'workout_logs_10x', label: "After a client's 10th workout" },
        { value: 'first_training_plan_created', label: "After a coach's first training plan" },
        { value: 'first_training_plan_activated', label: "After a coach's first training plan is activated" },
        { value: 'first_custom_exercise_added', label: 'After a coach adds their first custom exercise' },
    ] },
    { label: 'Nutrition', options: [
        { value: 'nutrition_builder_used_10x', label: "After a coach's 10th nutrition plan" },
        { value: 'first_nutrition_plan_activated', label: "After a coach's first nutrition plan is activated" },
        { value: 'first_custom_food_item_added', label: 'After a coach adds their first custom food item' },
    ] },
    { label: 'Forms / check-ins', options: [
        { value: 'first_checkin_completed', label: 'After a client completes their first check-in' },
        { value: 'first_form_created', label: "After a coach's first custom form" },
        { value: 'first_checkin_request_sent', label: "After a coach's first check-in request" },
        { value: 'first_checkin_reviewed', label: "After a coach's first check-in review" },
    ] },
    { label: 'Messenger', options: [
        { value: 'first_message_sent_by_client', label: "After a client's first message" },
        { value: 'first_message_sent_by_coach', label: "After a coach's first message" },
    ] },
    { label: 'Clients', options: [
        { value: 'first_client_added', label: "After a coach's first client" },
        { value: 'first_client_observation_logged', label: "After a coach's first client observation" },
        { value: 'first_client_archived', label: "After a coach's first client archive" },
        { value: 'first_subscription_freeze_created', label: "After a coach's first subscription freeze" },
    ] },
    { label: 'Billing', options: [
        { value: 'first_completed_transaction_logged', label: "After a coach's first completed transaction" },
        { value: 'first_refund_issued', label: "After a coach's first refund" },
        { value: 'first_workspace_subscription_paid', label: "After a coach's first paid platform subscription" },
    ] },
    { label: 'Packages', options: [
        { value: 'first_package_created', label: "After a coach's first package" },
        { value: 'first_package_variation_assigned_to_client', label: 'After a package is first assigned to a client' },
    ] },
    { label: 'Team', options: [
        { value: 'first_team_member_invited', label: "After a coach's first team invite" },
        { value: 'first_team_invitation_accepted', label: 'After a new team member accepts their invite' },
    ] },
];
const TRIGGER_EVENTS = TRIGGER_GROUPS.flatMap(g => g.options);
const CONDITION_FIELDS = ['subscription_status', 'package_variation_id'];

function NewPromptForm({ onClose, onCreated }) {
    const [questionEn, setQuestionEn] = useState('');
    const [responseType, setResponseType] = useState('rating');
    const [targetAudience, setTargetAudience] = useState('everyone');
    const [triggerEvent, setTriggerEvent] = useState('');
    const [options, setOptions] = useState(['', '']);
    const [error, setError] = useState('');
    const [saving, setSaving] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Phase 4
    const [startsAt, setStartsAt] = useState('');
    const [endsAt, setEndsAt] = useState('');
    const [maxShowsPerUser, setMaxShowsPerUser] = useState('');
    const [repeatIntervalDays, setRepeatIntervalDays] = useState('');
    const [allowConcurrent, setAllowConcurrent] = useState(false);
    const [workspaceIdsText, setWorkspaceIdsText] = useState('');
    const [conditions, setConditions] = useState([]);

    async function handleCreate() {
        if (!questionEn.trim()) { setError('A question is required'); return; }
        if (responseType === 'multiple_choice' && options.filter(o => o.trim()).length < 2) {
            setError('Add at least 2 options');
            return;
        }
        setSaving(true);
        setError('');
        try {
            await api.post('/api/admin/prompts', {
                questionEn: questionEn.trim(),
                responseType,
                targetAudience,
                triggerEvent: triggerEvent || undefined,
                options: responseType === 'multiple_choice' ? options.filter(o => o.trim()) : undefined,
                startsAt: startsAt || undefined,
                endsAt: endsAt || undefined,
                maxShowsPerUser: maxShowsPerUser ? Number(maxShowsPerUser) : undefined,
                repeatIntervalDays: repeatIntervalDays ? Number(repeatIntervalDays) : undefined,
                allowConcurrent: allowConcurrent || undefined,
                workspaceIds: workspaceIdsText.trim()
                    ? workspaceIdsText.split(',').map(s => s.trim()).filter(Boolean)
                    : undefined,
                conditions: conditions.filter(c => c.value.trim()).length > 0
                    ? conditions.filter(c => c.value.trim())
                    : undefined,
            });
            onCreated();
        } catch (err) {
            setError(err?.response?.data?.error ?? 'Could not create this prompt');
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-foreground">New Founder Prompt</p>
                <button onClick={onClose} className="text-muted-foreground hover:text-foreground cursor-pointer"><X size={15} /></button>
            </div>

            <TextArea placeholder="What's the most frustrating thing about…?" value={questionEn} onChange={e => setQuestionEn(e.target.value)} rows={2} />

            <div className="flex flex-wrap gap-4">
                <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Response type</p>
                    <div className="flex gap-1.5">
                        {RESPONSE_TYPES.map(rt => (
                            <button key={rt} onClick={() => setResponseType(rt)} className="cursor-pointer">
                                <Chip size="sm" variant={responseType === rt ? 'primary' : 'soft'}>{RESPONSE_TYPE_LABELS[rt]}</Chip>
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Audience</p>
                    <div className="flex gap-1.5">
                        {AUDIENCES.map(a => (
                            <button key={a} onClick={() => setTargetAudience(a)} className="cursor-pointer">
                                <Chip size="sm" variant={targetAudience === a ? 'primary' : 'soft'}>{a === 'user' ? 'coaches' : a}</Chip>
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div>
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">When to show it</p>
                <select
                    className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none"
                    value={triggerEvent}
                    onChange={e => { setTriggerEvent(e.target.value); if (e.target.value) setRepeatIntervalDays(''); }}
                >
                    {TRIGGER_GROUPS.map((group) => (
                        group.label ? (
                            <optgroup key={group.label} label={group.label}>
                                {group.options.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </optgroup>
                        ) : (
                            group.options.map(t => <option key={t.value} value={t.value}>{t.label}</option>)
                        )
                    ))}
                </select>
            </div>

            {responseType === 'multiple_choice' && (
                <div className="flex flex-col gap-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Options</p>
                    {options.map((opt, i) => (
                        <input
                            key={i}
                            className="px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none"
                            value={opt}
                            placeholder={`Option ${i + 1}`}
                            onChange={e => setOptions(prev => prev.map((o, idx) => (idx === i ? e.target.value : o)))}
                        />
                    ))}
                    <Button size="sm" variant="ghost" onClick={() => setOptions(prev => [...prev, ''])}>+ Add option</Button>
                </div>
            )}

            <button
                onClick={() => setShowAdvanced(v => !v)}
                className="flex items-center gap-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide cursor-pointer"
            >
                {showAdvanced ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                Advanced: scheduling, workspaces, conditions
            </button>

            {showAdvanced && (
                <div className="flex flex-col gap-4 rounded-lg border border-dashed border-border p-3">
                    <div className="flex flex-wrap gap-4">
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Starts</p>
                            <input type="datetime-local" className="px-3 py-1.5 text-sm bg-background border border-border rounded-lg outline-none"
                                value={startsAt} onChange={e => setStartsAt(e.target.value)} />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Ends</p>
                            <input type="datetime-local" className="px-3 py-1.5 text-sm bg-background border border-border rounded-lg outline-none"
                                value={endsAt} onChange={e => setEndsAt(e.target.value)} />
                        </div>
                        <div>
                            <p className="text-xs text-muted-foreground mb-1">Max shows per user</p>
                            <input type="number" min="1" placeholder="unlimited" className="w-28 px-3 py-1.5 text-sm bg-background border border-border rounded-lg outline-none"
                                value={maxShowsPerUser} onChange={e => setMaxShowsPerUser(e.target.value)} />
                        </div>
                        {!triggerEvent && (
                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Repeat every (days)</p>
                                <input type="number" min="1" placeholder="ask once" className="w-28 px-3 py-1.5 text-sm bg-background border border-border rounded-lg outline-none"
                                    value={repeatIntervalDays} onChange={e => setRepeatIntervalDays(e.target.value)} />
                            </div>
                        )}
                    </div>

                    <button onClick={() => setAllowConcurrent(v => !v)} className="self-start cursor-pointer">
                        <Chip size="sm" variant={allowConcurrent ? 'primary' : 'soft'}>
                            {allowConcurrent ? 'Runs alongside other prompts' : 'Exclusive (one at a time)'}
                        </Chip>
                    </button>

                    <div>
                        <p className="text-xs text-muted-foreground mb-1">Specific workspaces only (comma-separated ids — leave blank for platform-wide)</p>
                        <input
                            className="w-full px-3 py-1.5 text-sm bg-background border border-border rounded-lg outline-none"
                            placeholder="ws_abc123, ws_def456"
                            value={workspaceIdsText}
                            onChange={e => setWorkspaceIdsText(e.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <p className="text-xs text-muted-foreground">Only show to clients matching (all conditions must match)</p>
                        {conditions.map((c, i) => (
                            <div key={i} className="flex items-center gap-2">
                                <select
                                    className="px-2 py-1.5 text-sm bg-background border border-border rounded-lg outline-none"
                                    value={c.field}
                                    onChange={e => setConditions(prev => prev.map((x, idx) => (idx === i ? { ...x, field: e.target.value } : x)))}
                                >
                                    {CONDITION_FIELDS.map(f => <option key={f} value={f}>{f}</option>)}
                                </select>
                                <span className="text-xs text-muted-foreground">=</span>
                                <input
                                    className="flex-1 px-3 py-1.5 text-sm bg-background border border-border rounded-lg outline-none"
                                    placeholder="e.g. Active"
                                    value={c.value}
                                    onChange={e => setConditions(prev => prev.map((x, idx) => (idx === i ? { ...x, value: e.target.value } : x)))}
                                />
                                <button onClick={() => setConditions(prev => prev.filter((_, idx) => idx !== i))} className="text-muted-foreground hover:text-foreground cursor-pointer">
                                    <X size={14} />
                                </button>
                            </div>
                        ))}
                        <Button size="sm" variant="ghost" className="self-start"
                            onClick={() => setConditions(prev => [...prev, { field: 'subscription_status', value: '' }])}>
                            + Add condition
                        </Button>
                    </div>
                </div>
            )}

            {error && <p className="text-sm text-red-500">{error}</p>}

            <p className="text-xs text-muted-foreground">
                {allowConcurrent
                    ? 'Runs alongside any other active prompt — the one-at-a-time rule is skipped for this campaign.'
                    : triggerEvent
                        ? 'Contextual prompts only compete with another active prompt on the exact same trigger — this can run alongside the immediate prompt and other triggers.'
                        : 'Activating this ends any other active manual prompt whose audience overlaps — only one immediate question is ever shown at a time.'}
            </p>

            <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={onClose}>Cancel</Button>
                <Button variant="primary" isDisabled={saving} onClick={handleCreate}>{saving ? 'Activating…' : 'Activate'}</Button>
            </div>
        </div>
    );
}

function NpsBar({ promoters, passives, detractors }) {
    const total = promoters + passives + detractors;
    if (total === 0) return null;
    return (
        <div className="flex h-2 rounded-full overflow-hidden">
            <div className="bg-primary" style={{ width: `${(promoters / total) * 100}%` }} title={`${promoters} promoters`} />
            <div className="bg-amber-400" style={{ width: `${(passives / total) * 100}%` }} title={`${passives} passive`} />
            <div className="bg-red-400" style={{ width: `${(detractors / total) * 100}%` }} title={`${detractors} detractors`} />
        </div>
    );
}

function PromptAnalytics({ promptId }) {
    const [funnel, setFunnel] = useState(null);

    useEffect(() => {
        api.get(`/api/admin/prompts/${promptId}/analytics`).then(res => setFunnel(res.data)).catch(() => {});
    }, [promptId]);

    if (!funnel) return <Skeleton className="h-16 rounded-lg" />;

    return (
        <div className="flex flex-col gap-3 px-4 py-3 bg-secondary/30 rounded-lg">
            <div className="flex items-center gap-6">
                {[
                    ['Sent', funnel.sent],
                    ['Started', funnel.started],
                    ['Completed', funnel.completed],
                    ['Completion rate', `${Math.round(funnel.completionRate * 100)}%`],
                ].map(([label, value]) => (
                    <div key={label}>
                        <p className="text-lg font-bold text-foreground tabular-nums">{value}</p>
                        <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                ))}
            </div>

            {funnel.rating && (
                <div className="flex flex-col gap-1.5">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                        Average {funnel.rating.average != null ? funnel.rating.average.toFixed(1) : '—'}/{funnel.rating.scaleMax ?? 10}
                    </p>
                    {(funnel.rating.scaleMax ?? 10) === 10 && (
                        <>
                            <NpsBar {...funnel.rating} />
                            <p className="text-xs text-muted-foreground">
                                {funnel.rating.promoters} promoters (9–10) · {funnel.rating.passives} passive (7–8) · {funnel.rating.detractors} detractors (0–6)
                            </p>
                        </>
                    )}
                </div>
            )}

            {funnel.optionCounts && Object.keys(funnel.optionCounts).length > 0 && (
                <div className="flex flex-col gap-1">
                    {Object.entries(funnel.optionCounts).map(([opt, count]) => (
                        <div key={opt} className="flex items-center justify-between text-xs">
                            <span className="text-foreground">{opt}</span>
                            <span className="text-muted-foreground tabular-nums">{count}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function AdminPromptsPage() {
    const { formatDate } = useDateFormatter();
    const [prompts, setPrompts] = useState([]);
    const [statusFilter, setStatusFilter] = useState('active');
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [expandedId, setExpandedId] = useState(null);

    const [editingId, setEditingId] = useState(null);
    const [editQuestionEn, setEditQuestionEn] = useState('');
    const [editQuestionAr, setEditQuestionAr] = useState('');
    const [editSaving, setEditSaving] = useState(false);
    const [editError, setEditError] = useState('');

    const fetchPrompts = useCallback(() => {
        setLoading(true);
        api.get('/api/admin/prompts', { params: { status: statusFilter } })
            .then(res => setPrompts(res.data))
            .finally(() => setLoading(false));
    }, [statusFilter]);

    useEffect(() => { fetchPrompts(); }, [fetchPrompts]);

    async function handleEnd(id) {
        await api.patch(`/api/admin/prompts/${id}/end`);
        fetchPrompts();
    }

    async function handleReactivate(id) {
        await api.patch(`/api/admin/prompts/${id}/reactivate`);
        fetchPrompts();
    }

    function startEdit(p) {
        setEditingId(p.id);
        setEditQuestionEn(p.question_en);
        setEditQuestionAr(p.question_ar ?? '');
        setEditError('');
    }

    async function saveEdit(id) {
        if (!editQuestionEn.trim()) { setEditError('Question is required'); return; }
        setEditSaving(true);
        setEditError('');
        try {
            await api.patch(`/api/admin/prompts/${id}/question`, {
                questionEn: editQuestionEn.trim(),
                questionAr: editQuestionAr.trim() || null,
            });
            setEditingId(null);
            fetchPrompts();
        } catch (err) {
            setEditError(err?.response?.data?.error ?? 'Could not save this question');
        } finally {
            setEditSaving(false);
        }
    }

    return (
        <div className="p-8 flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Prompts</h1>
                    <p className="text-sm text-muted-foreground mt-1">Founder Prompts — one list, filtered by status.</p>
                </div>
                <Button variant="primary" onClick={() => setShowForm(v => !v)}>
                    <Plus size={15} /> New Prompt
                </Button>
            </div>

            {showForm && <NewPromptForm onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); setStatusFilter('active'); fetchPrompts(); }} />}

            <div className="flex gap-1.5">
                {['active', 'ended'].map(s => (
                    <button key={s} onClick={() => setStatusFilter(s)} className="cursor-pointer">
                        <Chip size="sm" variant={statusFilter === s ? 'primary' : 'soft'}>{s}</Chip>
                    </button>
                ))}
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
                {loading ? (
                    Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className={`h-16 rounded-none ${i > 0 ? 'border-t border-border' : ''}`} />)
                ) : prompts.length === 0 ? (
                    <div className="py-14 text-center text-sm text-muted-foreground">No {statusFilter} prompts.</div>
                ) : (
                    prompts.map((p, idx) => (
                        <div key={p.id} className={idx > 0 ? 'border-t border-border' : ''}>
                            {editingId === p.id ? (
                                <div className="px-4 py-3 flex flex-col gap-2">
                                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Edit question</p>
                                    <TextArea value={editQuestionEn} onChange={e => setEditQuestionEn(e.target.value)} rows={2} placeholder="Question (English)" />
                                    <TextArea value={editQuestionAr} onChange={e => setEditQuestionAr(e.target.value)} rows={2} placeholder="Question (Arabic — optional)" />
                                    {editError && <p className="text-sm text-red-500">{editError}</p>}
                                    <div className="flex justify-end gap-2">
                                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                                        <Button size="sm" variant="primary" isDisabled={editSaving} onClick={() => saveEdit(p.id)}>
                                            {editSaving ? 'Saving…' : 'Save'}
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                            <button
                                onClick={() => setExpandedId(cur => (cur === p.id ? null : p.id))}
                                className="w-full flex items-center justify-between gap-4 px-4 py-3 text-left hover:bg-default/40 transition-colors cursor-pointer"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-foreground truncate">{p.question_en}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">
                                        {RESPONSE_TYPE_LABELS[p.response_type] ?? p.response_type} · {p.target_audience === 'user' ? 'coaches' : p.target_audience} · {formatDate(p.created_at)}
                                        {p.allow_concurrent && ' · concurrent'}
                                        {p.max_shows_per_user && ` · max ${p.max_shows_per_user}/user`}
                                        {p.repeat_interval_days && ` · repeats every ${p.repeat_interval_days}d`}
                                    </p>
                                    {p.trigger_event && (
                                        <Chip size="sm" variant="soft" className="mt-1">
                                            {TRIGGER_EVENTS.find(t => t.value === p.trigger_event)?.label ?? p.trigger_event}
                                        </Chip>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e) => { e.stopPropagation(); startEdit(p); }}
                                        className="text-muted-foreground hover:text-foreground cursor-pointer px-1.5"
                                        aria-label="Edit question"
                                    >
                                        <Pencil size={14} />
                                    </span>
                                    {p.status === 'active' ? (
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => { e.stopPropagation(); handleEnd(p.id); }}
                                            className="text-sm text-muted-foreground hover:text-foreground cursor-pointer px-2"
                                        >
                                            End
                                        </span>
                                    ) : (
                                        <span
                                            role="button"
                                            tabIndex={0}
                                            onClick={(e) => { e.stopPropagation(); handleReactivate(p.id); }}
                                            className="text-sm text-muted-foreground hover:text-foreground cursor-pointer px-2"
                                        >
                                            Reactivate
                                        </span>
                                    )}
                                    {expandedId === p.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                </div>
                            </button>
                            )}
                            {expandedId === p.id && editingId !== p.id && (
                                <div className="px-4 pb-4">
                                    <PromptAnalytics promptId={p.id} />
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
