"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/axios";
import { useLocale, useTranslations } from "next-intl";
import { getLocalizedField } from "@/utils/localization";
import { useDateFormatter } from "@/utils/useDateFormatter";
import Modal from "@/app/components/Modal";
import { Trash2, Clock, CheckCircle, ClipboardList, CalendarClock, Send } from 'lucide-react';

const inputCls = "w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";

export default function ClientFormsPage() {
    const t = useTranslations('forms');
    const tCommon = useTranslations('common');
    const locale = useLocale();
    const { formatDate, formatDateTime } = useDateFormatter();
    const { id } = useParams();
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);

    // Request Form modal state
    const [requestModal, setRequestModal] = useState(false);
    const [activeForms, setActiveForms] = useState([]);
    const [selectedFormIds, setSelectedFormIds] = useState([]);
    const [requestSending, setRequestSending] = useState(false);
    const [requestError, setRequestError] = useState('');
    const [requestMode, setRequestMode] = useState('now');
    const [scheduledAt, setScheduledAt] = useState('');
    const [minScheduledAt, setMinScheduledAt] = useState('');

    // Draggable divider
    const [widths, setWidths] = useState([38, 62]);
    const containerRef = useRef(null);

    function handleDividerMouseDown(e) {
        e.preventDefault();
        const containerWidth = containerRef.current.getBoundingClientRect().width;
        const startX = e.clientX;
        const startWidths = [...widths];

        function onMove(moveEvent) {
            const deltaX = moveEvent.clientX - startX;
            const deltaPct = (deltaX / containerWidth) * 100;
            setWidths([
                Math.max(20, startWidths[0] + deltaPct),
                Math.max(20, startWidths[1] - deltaPct),
            ]);
        }
        function onUp() {
            document.removeEventListener("mousemove", onMove);
            document.removeEventListener("mouseup", onUp);
        }
        document.addEventListener("mousemove", onMove);
        document.addEventListener("mouseup", onUp);
    }

    const openRequestModal = async () => {
        setSelectedFormIds([]);
        setRequestError('');
        setRequestMode('now');
        setScheduledAt('');
        const minDt = new Date(Date.now() + 5 * 60 * 1000);
        setMinScheduledAt(minDt.toISOString().slice(0, 16));
        try {
            const res = await api.get('/api/forms');
            setActiveForms(res.data.filter(f => f.status === 'active'));
        } catch {
            setActiveForms([]);
        }
        setRequestModal(true);
    };

    const toggleFormSelection = (formId) => {
        setSelectedFormIds(prev => prev.includes(formId) ? prev.filter(x => x !== formId) : [...prev, formId]);
    };

    const handleSendRequests = async () => {
        if (selectedFormIds.length === 0) { setRequestError('Select at least one form'); return; }
        if (requestMode === 'schedule' && !scheduledAt) { setRequestError('Choose a schedule date and time'); return; }
        if (requestMode === 'schedule') {
            const scheduledDate = new Date(scheduledAt);
            if (Number.isNaN(scheduledDate.getTime()) || scheduledAt < minScheduledAt) {
                setRequestError('Schedule time must be in the future');
                return;
            }
        }
        setRequestSending(true);
        setRequestError('');
        try {
            await api.post('/api/forms/requests', {
                form_ids: selectedFormIds,
                client_id: id,
                mode: requestMode,
                scheduled_at: requestMode === 'schedule' ? new Date(scheduledAt).toISOString() : null,
            });
            setRequestModal(false);
            await fetchRequests();
        } catch (e) {
            setRequestError(e.response?.data?.error || 'Failed to send requests');
        } finally {
            setRequestSending(false);
        }
    };

    const fetchRequests = useCallback(async () => {
        try {
            const res = await api.get(`/api/forms/requests/client/${id}`);
            setRequests(res.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetchRequests(); }, [fetchRequests]);

    const handleCancel = async (requestId) => {
        if (!confirm("Cancel this form request?")) return;
        try {
            await api.delete(`/api/forms/requests/${requestId}`);
            setRequests(prev => prev.filter(r => r.id !== requestId));
            if (selected?.id === requestId) setSelected(null);
        } catch (e) {
            alert(e.response?.data?.error || "Failed to cancel request");
        }
    };

    if (loading) {
        return (
            <div className="h-full flex items-center justify-center">
                <p className="text-sm text-muted-foreground">Loading…</p>
            </div>
        );
    }

    return (
        <>
        <div
            ref={containerRef}
            className="flex h-full overflow-hidden gap-0"
        >
            {/* ── Left Panel: Form Requests List ─────────────────── */}
            <div
                className="flex flex-col overflow-hidden"
                style={{ width: `${widths[0]}%` }}
            >
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 flex flex-col overflow-hidden h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 shrink-0">
                        <h2 className="text-base font-semibold text-foreground">{t('formRequests')}</h2>
                        <div className="flex items-center gap-2">
                            {requests.filter(r => r.status === 'pending' || r.status === 'scheduled').length > 0 && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-600 font-medium">
                                    {requests.filter(r => r.status === 'pending' || r.status === 'scheduled').length} {t('open')}
                                </span>
                            )}
                            <button
                                onClick={openRequestModal}
                                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-purple-500 hover:border-purple-300 transition-colors cursor-pointer"
                            >
                                <Send size={12} />
                                {t('requestForm')}
                            </button>
                        </div>
                    </div>

                    {requests.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-8">
                            <ClipboardList size={36} className="text-muted-foreground/30" />
                            <p className="text-sm font-medium text-muted-foreground">{t('noFormRequests')}</p>
                            <p className="text-xs text-muted-foreground/70">{t('noFormRequestsHint')}</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto flex flex-col gap-1.5">
                            {requests.map(req => (
                                <button
                                    key={req.id}
                                    onClick={() => setSelected(req)}
                                    className={`w-full text-left px-3 py-3 rounded-lg border transition-all cursor-pointer ${
                                        selected?.id === req.id
                                            ? 'border-primary/40 bg-primary/5'
                                            : 'border-border hover:border-border/80 hover:bg-default'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm font-medium text-foreground truncate flex-1">{getLocalizedField(req, 'form_title', locale)}</p>
                                        {req.status === 'pending' ? (
                                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-600 font-medium shrink-0">
                                                <Clock size={10} /> {t('pending')}
                                            </span>
                                        ) : req.status === 'scheduled' ? (
                                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium shrink-0">
                                                <CalendarClock size={10} /> {tCommon('scheduled')}
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/15 text-green-600 font-medium shrink-0">
                                                <CheckCircle size={10} /> {t('submitted')}
                                            </span>
                                        )}
                                    </div>
                                    {getLocalizedField(req, 'form_description', locale) && (
                                        <p className="text-xs text-muted-foreground/70 truncate mt-0.5">{getLocalizedField(req, 'form_description', locale)}</p>
                                    )}
                                    <p className="text-xs text-muted-foreground/70 mt-1">
                                        {req.status === 'scheduled' && req.scheduled_at
                                            ? `${tCommon('scheduled')} ${formatDateTime(req.scheduled_at)}`
                                            : formatDate(req.requested_at)}
                                        {req.submitted_at && ` · ${t('submitted')} ${formatDate(req.submitted_at)}`}
                                    </p>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Divider ─────────────────────────────────────────── */}
            <div
                className="w-1.5 mx-1 shrink-0 flex items-center justify-center cursor-col-resize group"
                onMouseDown={handleDividerMouseDown}
            >
                <div className="w-1.5 h-12 bg-accent/20 rounded-full group-hover:bg-accent/60 group-active:bg-accent transition-colors" />
            </div>

            {/* ── Right Panel: Responses Detail ───────────────────── */}
            <div
                className="flex flex-col overflow-hidden"
                style={{ width: `${widths[1]}%` }}
            >
                <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 flex flex-col h-full overflow-hidden">
                    {!selected ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                            <ClipboardList size={40} className="text-muted-foreground/30" />
                            <p className="text-sm font-medium text-muted-foreground">{t('selectRequest')}</p>
                            <p className="text-xs text-muted-foreground/70">{t('selectRequestHint')}</p>
                        </div>
                    ) : (
                        <>
                            {/* Detail Header */}
                            <div className="flex items-start justify-between gap-4 mb-5 shrink-0">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-bold text-foreground">{getLocalizedField(selected, 'form_title', locale)}</h3>
                                    {getLocalizedField(selected, 'form_description', locale) && (
                                        <p className="text-sm text-muted-foreground mt-0.5">{getLocalizedField(selected, 'form_description', locale)}</p>
                                    )}
                                    <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                                        <span>{t('requested')} {formatDate(selected.requested_at)}</span>
                                        {selected.submitted_at && (
                                            <span>· {t('submitted')} {formatDate(selected.submitted_at)}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {selected.status === 'pending' || selected.status === 'scheduled' ? (
                                        <>
                                            {selected.status === 'scheduled' ? (
                                                <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-accent/15 text-accent font-medium">
                                                    <CalendarClock size={11} /> {tCommon('scheduled')}
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-yellow-500/15 text-yellow-600 font-medium">
                                                    <Clock size={11} /> {t('pending')}
                                                </span>
                                            )}
                                            <button
                                                onClick={() => handleCancel(selected.id)}
                                                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors cursor-pointer"
                                            >
                                                <Trash2 size={12} /> {t('cancelRequest')}
                                            </button>
                                        </>
                                    ) : (
                                        <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-500/15 text-green-700 font-medium">
                                            <CheckCircle size={11} /> {t('submitted')}
                                        </span>
                                    )}
                                </div>
                            </div>

                            {/* Responses body */}
                            <div className="flex-1 overflow-y-auto">
                                {selected.status === 'pending' || selected.status === 'scheduled' ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
                                        {selected.status === 'scheduled' ? (
                                            <>
                                                <CalendarClock size={36} className="text-accent" />
                                                <p className="text-sm font-medium text-muted-foreground">{t('formScheduled')}</p>
                                                <p className="text-xs text-muted-foreground/70">{t('formScheduledHint', { time: selected.scheduled_at ? formatDateTime(selected.scheduled_at) : '—' })}</p>
                                            </>
                                        ) : (
                                            <>
                                                <Clock size={36} className="text-yellow-500" />
                                                <p className="text-sm font-medium text-muted-foreground">{t('waitingForClient')}</p>
                                                <p className="text-xs text-muted-foreground/70">{t('waitingHint')}</p>
                                            </>
                                        )}
                                    </div>
                                ) : selected.responses?.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-8">{t('noResponses')}</p>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        {selected.responses.map((r, i) => (
                                            <div key={i} className="flex flex-col gap-1.5">
                                                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                                                    {i + 1}. {getLocalizedField(r, 'label', locale)}
                                                </p>
                                                <div className="bg-secondary rounded-lg px-4 py-3 border border-border">
                                                    <p className="text-sm text-foreground whitespace-pre-wrap">
                                                        {r.answer || <span className="text-muted-foreground italic">No answer</span>}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </div>
            </div>
        </div>

        {/* Request Form Modal */}
        <Modal open={requestModal} onClose={() => setRequestModal(false)} title={t('requestFormFromClient')}>
            <div className="flex flex-col gap-3">
                <div className="rounded-lg border border-border p-3">
                    <p className="text-xs font-semibold text-muted-foreground mb-2">{t('requestTiming')}</p>
                    <div className="flex gap-2 mb-2">
                        <button
                            onClick={() => setRequestMode('now')}
                            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                                requestMode === 'now'
                                    ? 'bg-primary border-primary text-white'
                                    : 'border-border text-muted-foreground hover:bg-default'
                            }`}
                        >
                            {t('requestNow')}
                        </button>
                        <button
                            onClick={() => setRequestMode('schedule')}
                            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                                requestMode === 'schedule'
                                    ? 'bg-primary border-primary text-white'
                                    : 'border-border text-muted-foreground hover:bg-default'
                            }`}
                        >
                            {t('schedule')}
                        </button>
                    </div>
                    {requestMode === 'schedule' && (
                        <input
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={(e) => setScheduledAt(e.target.value)}
                            min={minScheduledAt}
                            className={inputCls}
                        />
                    )}
                </div>

                {activeForms.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4 text-center">{t('noActiveForms')}</p>
                ) : (
                    <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                        {activeForms.map(form => (
                            <label key={form.id} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/50 cursor-pointer transition-colors">
                                <input
                                    type="checkbox"
                                    checked={selectedFormIds.includes(form.id)}
                                    onChange={() => toggleFormSelection(form.id)}
                                    className="mt-0.5 cursor-pointer accent-primary"
                                />
                                <div>
                                    <p className="text-sm font-medium text-foreground">{getLocalizedField(form, 'title', locale)}</p>
                                    {getLocalizedField(form, 'description', locale) && <p className="text-xs text-muted-foreground mt-0.5">{getLocalizedField(form, 'description', locale)}</p>}
                                    <p className="text-xs text-muted-foreground">{form.question_count} question{form.question_count !== 1 ? 's' : ''}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                )}

                {requestError && (
                    <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{requestError}</p>
                )}
                <div className="flex gap-2 mt-1">
                    <button
                        onClick={handleSendRequests}
                        disabled={requestSending || activeForms.length === 0}
                        className="flex-1 bg-primary hover:bg-primary/90 disabled:opacity-50 text-white font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer text-sm"
                    >
                        {requestSending ? t('sending') : t('sendRequest')}
                    </button>
                    <button
                        onClick={() => setRequestModal(false)}
                        className="flex-1 bg-destructive/10 hover:bg-destructive/20 text-destructive font-medium px-4 py-2 rounded-lg transition-colors cursor-pointer text-sm"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </Modal>
        </>
    );
}
