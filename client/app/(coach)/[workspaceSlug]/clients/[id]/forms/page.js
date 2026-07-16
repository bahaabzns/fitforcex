"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useSearchParams } from "next/navigation";
import api from "@/lib/axios";
import { useLocale, useTranslations } from "next-intl";
import { getLocalizedField } from "@/utils/localization";
import { useDateFormatter } from "@/utils/useDateFormatter";
import Modal from "@/app/components/Modal";
import ObservationModal from "@/app/components/ObservationModal";
import RelatedObservationsPanel from "@/app/components/RelatedObservationsPanel";
import { Trash2, Clock, CheckCircle, ClipboardList, CalendarClock, Send, ChevronsDown, ChevronsUp } from 'lucide-react';
import { Button } from "@heroui/react/button";
import { Chip } from "@heroui/react/chip";
import { Skeleton } from "@heroui/react/skeleton";
import { Accordion, Separator, Surface } from "@heroui/react";
import { ScrollShadow } from "@/app/components/ScrollShadow";
import ImagePreview from "@/app/components/ImagePreview";

const inputCls = "w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";

// Coach Portal answer viewer — rendering is always decided by the question's
// type (returned by the API alongside each response), never guessed from the
// answer string. A small number of legacy responses may have no question
// (question_id was NULL before Forms Versioning) — those have no `type` and
// safely fall through to the plain-text branch below rather than being
// content-sniffed.
function isImageAnswer(r) {
    return r.type === 'metric' && r.metric_type === 'image';
}

// "attachment" answers are presented by file kind, not treated as one
// generic blob — the kind here is a presentation choice about an answer
// already known (by type) to be an attachment, not a guess about the
// question's type, so this doesn't reintroduce the isImageUrl anti-pattern
// it replaced. See client/app/components/forms/questionTypes.js's
// ATTACHMENT_CATEGORIES for the categories a coach can configure.
function attachmentKind(url) {
    if (!url || typeof url !== 'string') return 'file';
    const path = url.split('?')[0].toLowerCase();
    if (/\.(png|jpe?g|gif|webp|avif|heic)$/.test(path)) return 'image';
    if (path.endsWith('.pdf')) return 'pdf';
    return 'file';
}

function attachmentFileName(url) {
    try {
        return decodeURIComponent(new URL(url).pathname.split('/').pop() || 'file');
    } catch {
        return 'file';
    }
}

function AnswerBody({ response: r }) {
    if (isImageAnswer(r)) {
        return (
            <a href={r.answer} target="_blank" rel="noopener noreferrer" className="block">
                <img src={r.answer} alt="" className="w-full rounded-lg object-contain max-h-96 bg-black/5" />
            </a>
        );
    }

    if (r.type === 'attachment' && r.answer) {
        const kind = attachmentKind(r.answer);
        if (kind === 'image') {
            return (
                <a href={r.answer} target="_blank" rel="noopener noreferrer" className="block">
                    <img src={r.answer} alt="" className="w-full rounded-lg object-contain max-h-96 bg-black/5" />
                </a>
            );
        }
        if (kind === 'pdf') {
            return (
                <ImagePreview
                    src={r.answer}
                    isPdf
                    title={attachmentFileName(r.answer)}
                    triggerClassName="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-secondary hover:border-primary/40 transition-colors"
                >
                    <span className="text-xl shrink-0">📄</span>
                    <span className="flex-1 text-sm text-foreground truncate text-left">{attachmentFileName(r.answer)}</span>
                    <span className="text-xs text-primary shrink-0">Open</span>
                </ImagePreview>
            );
        }
        return (
            <a href={r.answer} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-border bg-secondary hover:border-primary/40 transition-colors">
                <span className="text-xl shrink-0">📎</span>
                <span className="flex-1 text-sm text-foreground truncate">{attachmentFileName(r.answer)}</span>
                <span className="text-xs text-primary shrink-0">Open</span>
            </a>
        );
    }

    return (
        <p className="text-sm text-foreground whitespace-pre-wrap">
            {r.answer || <span className="text-muted-foreground italic">—</span>}
        </p>
    );
}

function formatRelativeTime(dateStr, t) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return t('justNow');
    if (diffMins < 60) return t('minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('hoursAgo', { count: diffHours });
    if (diffDays === 1) return t('yesterday');
    if (diffDays < 7) return t('daysAgo', { count: diffDays });
    if (diffDays < 30) return t('weeksAgo', { count: Math.floor(diffDays / 7) });
    if (diffDays < 365) return t('monthsAgo', { count: Math.floor(diffDays / 30) });
    return t('yearsAgo', { count: Math.floor(diffDays / 365) });
}

export default function ClientFormsPage() {
    const t = useTranslations('forms');
    const tCommon = useTranslations('common');
    const locale = useLocale();
    const { formatDate, formatDateTime } = useDateFormatter();
    const { id } = useParams();
    const searchParams = useSearchParams();
    const requestIdParam = searchParams.get('requestId');
    const [requests, setRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);
    const [sortOrder, setSortOrder] = useState("newest");

    // Request Form modal state
    const [requestModal, setRequestModal] = useState(false);
    const [activeForms, setActiveForms] = useState([]);
    const [selectedFormIds, setSelectedFormIds] = useState([]);
    const [requestSending, setRequestSending] = useState(false);
    const [requestError, setRequestError] = useState('');
    const [requestMode, setRequestMode] = useState('now');
    const [scheduledAt, setScheduledAt] = useState('');
    const [minScheduledAt, setMinScheduledAt] = useState('');

    // Accordion expand/collapse state
    const [expandedKeys, setExpandedKeys] = useState(new Set());

    // Observations linked to the selected request (see the Observations tab/module)
    const [relatedObservations, setRelatedObservations] = useState([]);
    const [observationModalOpen, setObservationModalOpen] = useState(false);
    const [editingObservation, setEditingObservation] = useState(null);
    const [me, setMe] = useState(null);

    // Close the modal when switching which request is selected — adjusted
    // during render (not in an effect), mirroring MessageComposer's own
    // reset-on-prop-change pattern elsewhere in this codebase.
    const [syncedRequestId, setSyncedRequestId] = useState(selected?.id ?? null);
    if ((selected?.id ?? null) !== syncedRequestId) {
        setSyncedRequestId(selected?.id ?? null);
        setObservationModalOpen(false);
        setEditingObservation(null);
    }

    // Auto-select the submission named by ?requestId= (e.g. from a linked-item
    // chip elsewhere in the app) once the request list has loaded — same
    // render-time-adjust idiom as above, not an effect.
    const [autoSelectedRequestId, setAutoSelectedRequestId] = useState(null);
    if (requestIdParam && requestIdParam !== autoSelectedRequestId && requests.length > 0) {
        setAutoSelectedRequestId(requestIdParam);
        const match = requests.find(r => String(r.id) === String(requestIdParam));
        if (match) setSelected(match);
    }

    useEffect(() => {
        if (!selected) return;
        api.get(`/api/clients/${id}/observations?relatedType=checkIn`)
            .then(({ data }) => setRelatedObservations((data ?? []).filter(o => o.relatedItems?.some(ri => ri.id === selected.id))))
            .catch(() => setRelatedObservations([]));
    }, [selected?.id, id]);

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

    useEffect(() => {
        fetchRequests();
        api.get('/api/auth/me').then(res => setMe(res.data)).catch(() => {});
    }, [fetchRequests]);

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

    const sortedRequests = [...requests].sort((a, b) => {
        if (sortOrder === "oldest") return new Date(a.requested_at) - new Date(b.requested_at);
        if (sortOrder === "lastSubmitted") {
            const aTime = a.submitted_at ? new Date(a.submitted_at).getTime() : 0;
            const bTime = b.submitted_at ? new Date(b.submitted_at).getTime() : 0;
            return bTime - aTime;
        }
        return new Date(b.requested_at) - new Date(a.requested_at);
    });

    if (loading) {
        return (
            <div className="flex h-full overflow-hidden gap-0">
                <div className="flex flex-col overflow-hidden" style={{ width: "38%" }}>
                    <Surface variant="default" className="flex flex-col flex-1 p-3 rounded-2xl gap-3">
                        <div className="flex items-center justify-between px-1">
                            <Skeleton className="h-5 w-24 rounded-lg" />
                            <Skeleton className="h-8 w-28 rounded-lg" />
                        </div>
                        <div className="flex gap-2 px-1">
                            {[1, 2, 3].map(i => <Skeleton key={i} className="h-6 w-20 rounded-full" />)}
                        </div>
                        <div className="flex flex-col gap-2 px-1">
                            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
                        </div>
                    </Surface>
                </div>
                <div className="w-1.5 mx-1 shrink-0" />
                <div className="flex flex-col overflow-hidden" style={{ width: "62%" }}>
                    <Surface variant="default" className="flex flex-col flex-1 p-3 rounded-2xl" />
                </div>
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
                <Surface variant="default" className="flex flex-col overflow-hidden flex-1 p-3 rounded-2xl">
                    {/* Header */}
                    <div className="flex items-center gap-2 px-1 mb-3 shrink-0">
                        <h2 className="flex-1 text-base font-semibold text-foreground">
                            {t('formRequests')}
                            <span className="ml-2 text-xs font-normal text-muted-foreground">{requests.length}</span>
                        </h2>
                        <Button variant="primary" onClick={openRequestModal} className="shrink-0 gap-1.5">
                            <Send size={14} />
                            {t('requestForm')}
                        </Button>
                    </div>

                    {/* Sort Pills */}
                    <div className="flex gap-2 mb-3 shrink-0 px-1">
                        {[
                            { value: "newest",       label: t('newest') },
                            { value: "oldest",       label: t('oldest') },
                            { value: "lastSubmitted", label: t('lastSubmitted') },
                        ].map(({ value, label }) => (
                            <button
                                key={value}
                                onClick={() => setSortOrder(value)}
                                className={`cursor-pointer text-xs px-3 py-1 rounded-full border transition-colors ${
                                    sortOrder === value
                                        ? "bg-primary border-primary text-white"
                                        : "border-border text-muted-foreground hover:border-border hover:bg-default"
                                }`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>

                    {/* List */}
                    <ScrollShadow className="flex-1 min-h-0" hideScrollBar>
                        {requests.length === 0 ? (
                            <Surface variant="default" className="rounded-xl p-6 flex flex-col items-center justify-center gap-3 text-center mx-1 my-1">
                                <ClipboardList size={36} className="text-border" />
                                <div>
                                    <p className="text-sm font-medium text-muted-foreground">{t('noFormRequests')}</p>
                                    <p className="text-xs text-muted-foreground mt-1">{t('noFormRequestsHint')}</p>
                                </div>
                                <Button variant="primary" onClick={openRequestModal}>
                                    {t('requestForm')}
                                </Button>
                            </Surface>
                        ) : (
                            <div className="flex flex-col gap-2 px-1 py-1">
                                {sortedRequests.map(req => {
                                    const isActive = selected?.id === req.id;
                                    return (
                                        <div
                                            key={req.id}
                                            onClick={() => { setSelected(req); setExpandedKeys(new Set()); }}
                                            className={`group flex items-center gap-3 px-3 py-2.5 cursor-pointer rounded-xl shadow-surface transition-all duration-150 select-none ${
                                                isActive
                                                    ? "bg-primary/5 dark:bg-primary/15 ring-1 ring-primary/40"
                                                    : "bg-card dark:bg-(--color-surface-secondary) hover:bg-default dark:hover:bg-(--color-surface-tertiary)"
                                            }`}
                                        >
                                            <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                                                isActive
                                                    ? "bg-primary/25 text-primary"
                                                    : "bg-foreground/10 text-muted-foreground group-hover:text-foreground"
                                            }`}>
                                                <ClipboardList size={16} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm font-medium truncate ${isActive ? "text-primary" : "text-foreground"}`}>
                                                    {getLocalizedField(req, 'form_title', locale)}
                                                </p>
                                                <p className="text-xs text-muted-foreground mt-0.5">
                                                    {req.status === 'scheduled' && req.scheduled_at
                                                        ? `${tCommon('scheduled')} ${formatDate(req.scheduled_at)}`
                                                        : `${t('requested')} ${formatRelativeTime(req.requested_at, tCommon)}`}
                                                </p>
                                            </div>
                                            <div className="shrink-0">
                                                {req.status === 'submitted' ? (
                                                    <Chip size="sm" color="success" variant="soft">
                                                        <Chip.Label>{t('submitted')}</Chip.Label>
                                                    </Chip>
                                                ) : req.status === 'scheduled' ? (
                                                    <Chip size="sm" color="secondary" variant="soft">
                                                        <Chip.Label>{tCommon('scheduled')}</Chip.Label>
                                                    </Chip>
                                                ) : (
                                                    <Chip size="sm" color="warning" variant="soft">
                                                        <Chip.Label>{t('pending')}</Chip.Label>
                                                    </Chip>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </ScrollShadow>
                </Surface>
            </div>

            {/* ── Divider ─────────────────────────────────────────── */}
            <div
                className="w-1.5 mx-1 shrink-0 flex items-center justify-center cursor-col-resize group"
                onMouseDown={handleDividerMouseDown}
            >
                <div className="w-1.5 h-12 bg-accent/20 rounded-full group-hover:bg-accent/60 group-active:bg-accent transition-colors" />
            </div>

            {/* ── Right Panel: Response Detail ────────────────────── */}
            <div
                className="flex flex-col overflow-hidden"
                style={{ width: `${widths[1]}%` }}
            >
                <Surface variant="default" className="flex flex-col overflow-hidden flex-1 p-3 rounded-2xl">
                    {!selected ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                            <ClipboardList size={40} className="text-border" />
                            <div>
                                <p className="text-sm font-medium text-muted-foreground">{t('selectRequest')}</p>
                                <p className="text-xs text-muted-foreground mt-1">{t('selectRequestHint')}</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* Header */}
                            <div className="flex items-start justify-between gap-3 px-1 mb-1 shrink-0">
                                <h3 className="text-base font-semibold text-foreground flex-1 min-w-0 truncate">
                                    {getLocalizedField(selected, 'form_title', locale)}
                                </h3>
                                <div className="flex items-center gap-2 shrink-0">
                                    {selected.status === 'submitted' ? (
                                        <Chip size="sm" color="success" variant="soft">
                                            <CheckCircle size={11} />
                                            <Chip.Label>{t('submitted')}</Chip.Label>
                                        </Chip>
                                    ) : selected.status === 'scheduled' ? (
                                        <Chip size="sm" color="secondary" variant="soft">
                                            <CalendarClock size={11} />
                                            <Chip.Label>{tCommon('scheduled')}</Chip.Label>
                                        </Chip>
                                    ) : (
                                        <Chip size="sm" color="warning" variant="soft">
                                            <Clock size={11} />
                                            <Chip.Label>{t('pending')}</Chip.Label>
                                        </Chip>
                                    )}
                                    {(selected.status === 'pending' || selected.status === 'scheduled') && (
                                        <button
                                            onClick={() => handleCancel(selected.id)}
                                            className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-border text-muted-foreground hover:text-destructive hover:border-destructive/50 transition-colors cursor-pointer"
                                        >
                                            <Trash2 size={12} /> {t('cancelRequest')}
                                        </button>
                                    )}
                                </div>
                            </div>

                            {/* Metadata Row */}
                            <p className="text-xs text-muted-foreground px-1 mb-3 shrink-0">
                                {t('requested')} {formatDate(selected.requested_at)}
                                {selected.submitted_at && ` · ${t('submitted')} ${formatDate(selected.submitted_at)}`}
                            </p>

                            <Separator className="mb-3 shrink-0" />

                            {/* Body */}
                            <ScrollShadow className="flex-1 min-h-0" hideScrollBar>
                                {selected.status === 'pending' || selected.status === 'scheduled' ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-12">
                                        {selected.status === 'scheduled' ? (
                                            <>
                                                <CalendarClock size={36} className="text-muted-foreground/40" />
                                                <div>
                                                    <p className="text-sm font-medium text-muted-foreground">{t('formScheduled')}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">{t('formScheduledHint', { time: selected.scheduled_at ? formatDateTime(selected.scheduled_at) : '—' })}</p>
                                                </div>
                                            </>
                                        ) : (
                                            <>
                                                <Clock size={36} className="text-muted-foreground/40" />
                                                <div>
                                                    <p className="text-sm font-medium text-muted-foreground">{t('waitingForClient')}</p>
                                                    <p className="text-xs text-muted-foreground mt-1">{t('waitingHint')}</p>
                                                </div>
                                            </>
                                        )}
                                    </div>
                                ) : !selected.responses?.length ? (
                                    <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-8">
                                        <p className="text-sm text-muted-foreground">{t('noResponses')}</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2 px-1 py-1">
                                        <div className="flex items-center justify-between mb-1">
                                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                                {t('questions')}
                                            </p>
                                            <div className="flex gap-1">
                                                <button
                                                    onClick={() => setExpandedKeys(new Set(selected.responses.map((_, i) => String(i))))}
                                                    title={t('expandAll')}
                                                    className="w-6 h-6 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-default hover:text-foreground transition-colors cursor-pointer"
                                                >
                                                    <ChevronsDown size={13} />
                                                </button>
                                                <button
                                                    onClick={() => setExpandedKeys(new Set())}
                                                    title={t('collapseAll')}
                                                    className="w-6 h-6 flex items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-default hover:text-foreground transition-colors cursor-pointer"
                                                >
                                                    <ChevronsUp size={13} />
                                                </button>
                                            </div>
                                        </div>
                                        <Accordion expandedKeys={expandedKeys} onExpandedChange={setExpandedKeys} allowsMultipleExpanded>
                                            {selected.responses.map((r, i) => (
                                                <Accordion.Item key={i} id={String(i)}>
                                                    <Accordion.Heading>
                                                        <Accordion.Trigger>
                                                            <span className="text-sm text-foreground">
                                                                {i + 1}. {getLocalizedField(r, 'label', locale)}
                                                            </span>
                                                            <Accordion.Indicator />
                                                        </Accordion.Trigger>
                                                    </Accordion.Heading>
                                                    <Accordion.Panel>
                                                        <Accordion.Body>
                                                            <AnswerBody response={r} />
                                                        </Accordion.Body>
                                                    </Accordion.Panel>
                                                </Accordion.Item>
                                            ))}
                                        </Accordion>
                                    </div>
                                )}

                                {/* Related Observations — durable coaching notes linked to this request */}
                                <div className="px-1 py-3 mt-2 border-t border-border">
                                    <RelatedObservationsPanel
                                        title={t('relatedObservations')}
                                        addLabel={t('addObservation')}
                                        emptyLabel={t('noRelatedObservations')}
                                        observations={relatedObservations}
                                        clientId={id}
                                        currentUserId={me?.userId}
                                        isOwner={me?.currentWorkspace?.role === 'owner'}
                                        onAddClick={() => { setEditingObservation(null); setObservationModalOpen(true); }}
                                        onEdit={(obs) => { setEditingObservation(obs); setObservationModalOpen(true); }}
                                        onDeleted={(deletedId) => setRelatedObservations(prev => prev.filter(x => x.id !== deletedId))}
                                    />
                                </div>
                            </ScrollShadow>
                            <ObservationModal
                                open={observationModalOpen}
                                onClose={() => setObservationModalOpen(false)}
                                clientId={id}
                                observation={editingObservation}
                                initialRelatedItem={{
                                    type: selected.form_type === 'assessment' ? 'assessment' : 'checkIn',
                                    id: selected.id,
                                    label: getLocalizedField(selected, 'form_title', locale),
                                }}
                                onCreated={(obs) => setRelatedObservations(prev => [obs, ...prev])}
                                onUpdated={(updated) => setRelatedObservations(prev => prev.map(x => x.id === updated.id ? updated : x))}
                            />
                        </>
                    )}
                </Surface>
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
