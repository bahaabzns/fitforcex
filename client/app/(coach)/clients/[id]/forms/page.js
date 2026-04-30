"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams } from "next/navigation";
import api from "@/lib/axios";
import Modal from "@/app/components/Modal";
import { Trash2, Clock, CheckCircle, ClipboardList, CalendarClock, Send } from "lucide-react";

export default function ClientFormsPage() {
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
            const t = new Date(scheduledAt);
            if (Number.isNaN(t.getTime()) || t.getTime() <= Date.now()) {
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
                <p className="text-sm text-gray-400">Loading…</p>
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
                <div className="card flex flex-col overflow-hidden h-full">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4 shrink-0">
                        <h2 className="text-base font-semibold text-gray-900">Form Requests</h2>
                        <div className="flex items-center gap-2">
                            {requests.filter(r => r.status === 'pending' || r.status === 'scheduled').length > 0 && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                                    {requests.filter(r => r.status === 'pending' || r.status === 'scheduled').length} open
                                </span>
                            )}
                            <button
                                onClick={openRequestModal}
                                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-purple-500 hover:border-purple-300 transition-colors cursor-pointer"
                            >
                                <Send size={12} />
                                Request Form
                            </button>
                        </div>
                    </div>

                    {requests.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center py-8">
                            <ClipboardList size={36} className="text-gray-200" />
                            <p className="text-sm font-medium text-gray-500">No form requests yet</p>
                            <p className="text-xs text-gray-400">Use the &quot;Request Form&quot; button on the Clients page.</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto flex flex-col gap-1.5">
                            {requests.map(req => (
                                <button
                                    key={req.id}
                                    onClick={() => setSelected(req)}
                                    className={`w-full text-left px-3 py-3 rounded-xl border transition-all cursor-pointer ${
                                        selected?.id === req.id
                                            ? 'border-blue-400 bg-blue-50'
                                            : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <p className="text-sm font-medium text-gray-900 truncate flex-1">{req.form_title}</p>
                                        {req.status === 'pending' ? (
                                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 font-medium shrink-0">
                                                <Clock size={10} /> Pending
                                            </span>
                                        ) : req.status === 'scheduled' ? (
                                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium shrink-0">
                                                <CalendarClock size={10} /> Scheduled
                                            </span>
                                        ) : (
                                            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-medium shrink-0">
                                                <CheckCircle size={10} /> Submitted
                                            </span>
                                        )}
                                    </div>
                                    {req.form_description && (
                                        <p className="text-xs text-gray-400 truncate mt-0.5">{req.form_description}</p>
                                    )}
                                    <p className="text-xs text-gray-400 mt-1">
                                        {req.status === 'scheduled' && req.scheduled_at
                                            ? `Scheduled ${new Date(req.scheduled_at).toLocaleString()}`
                                            : new Date(req.requested_at).toLocaleDateString()}
                                        {req.submitted_at && ` · submitted ${new Date(req.submitted_at).toLocaleDateString()}`}
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
                <div className="w-1.5 h-12 bg-blue-200 rounded-full group-hover:bg-blue-400 group-active:bg-blue-500 transition-colors" />
            </div>

            {/* ── Right Panel: Responses Detail ───────────────────── */}
            <div
                className="flex flex-col overflow-hidden"
                style={{ width: `${widths[1]}%` }}
            >
                <div className="card flex flex-col h-full overflow-hidden">
                    {!selected ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
                            <ClipboardList size={40} className="text-gray-200" />
                            <p className="text-sm font-medium text-gray-500">Select a form request</p>
                            <p className="text-xs text-gray-400">Click on a request from the left to view details.</p>
                        </div>
                    ) : (
                        <>
                            {/* Detail Header */}
                            <div className="flex items-start justify-between gap-4 mb-5 shrink-0">
                                <div className="flex-1 min-w-0">
                                    <h3 className="text-lg font-bold text-gray-900">{selected.form_title}</h3>
                                    {selected.form_description && (
                                        <p className="text-sm text-gray-400 mt-0.5">{selected.form_description}</p>
                                    )}
                                    <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                                        <span>Requested {new Date(selected.requested_at).toLocaleDateString()}</span>
                                        {selected.submitted_at && (
                                            <span>· Submitted {new Date(selected.submitted_at).toLocaleDateString()}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    {selected.status === 'pending' || selected.status === 'scheduled' ? (
                                        <>
                                            {selected.status === 'scheduled' ? (
                                                <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                                                    <CalendarClock size={11} /> Scheduled
                                                </span>
                                            ) : (
                                                <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700 font-medium">
                                                    <Clock size={11} /> Pending
                                                </span>
                                            )}
                                            <button
                                                onClick={() => handleCancel(selected.id)}
                                                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:text-red-500 hover:border-red-300 transition-colors cursor-pointer"
                                            >
                                                <Trash2 size={12} /> Cancel Request
                                            </button>
                                        </>
                                    ) : (
                                        <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full bg-green-100 text-green-700 font-medium">
                                            <CheckCircle size={11} /> Submitted
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
                                                <CalendarClock size={36} className="text-blue-300" />
                                                <p className="text-sm font-medium text-gray-600">Form is scheduled</p>
                                                <p className="text-xs text-gray-400">Client will receive it at {selected.scheduled_at ? new Date(selected.scheduled_at).toLocaleString() : 'the selected time'}.</p>
                                            </>
                                        ) : (
                                            <>
                                                <Clock size={36} className="text-yellow-300" />
                                                <p className="text-sm font-medium text-gray-600">Waiting for client to respond</p>
                                                <p className="text-xs text-gray-400">The client will see this form when they log in.</p>
                                            </>
                                        )}
                                    </div>
                                ) : selected.responses?.length === 0 ? (
                                    <p className="text-sm text-gray-400 text-center py-8">No responses recorded.</p>
                                ) : (
                                    <div className="flex flex-col gap-4">
                                        {selected.responses.map((r, i) => (
                                            <div key={i} className="flex flex-col gap-1.5">
                                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                                                    {i + 1}. {r.label}
                                                </p>
                                                <div className="bg-gray-50 rounded-xl px-4 py-3 border border-gray-100">
                                                    <p className="text-sm text-gray-900 whitespace-pre-wrap">
                                                        {r.answer || <span className="text-gray-400 italic">No answer</span>}
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
        <Modal open={requestModal} onClose={() => setRequestModal(false)} title="Request Form from Client">
            <div className="flex flex-col gap-3">
                <div className="rounded-lg border border-gray-200 p-3">
                    <p className="text-xs font-semibold text-gray-500 mb-2">Request Timing</p>
                    <div className="flex gap-2 mb-2">
                        <button
                            onClick={() => setRequestMode('now')}
                            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                                requestMode === 'now'
                                    ? 'bg-blue-500 border-blue-500 text-white'
                                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            Request Now
                        </button>
                        <button
                            onClick={() => setRequestMode('schedule')}
                            className={`text-xs px-3 py-1.5 rounded-lg border transition-colors cursor-pointer ${
                                requestMode === 'schedule'
                                    ? 'bg-blue-500 border-blue-500 text-white'
                                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                            }`}
                        >
                            Schedule
                        </button>
                    </div>
                    {requestMode === 'schedule' && (
                        <input
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={(e) => setScheduledAt(e.target.value)}
                            min={new Date(Date.now() + 5 * 60 * 1000).toISOString().slice(0, 16)}
                            className="input-field"
                        />
                    )}
                </div>

                {activeForms.length === 0 ? (
                    <p className="text-sm text-gray-500 py-4 text-center">No active forms available. Activate a form first.</p>
                ) : (
                    <div className="flex flex-col gap-2 max-h-72 overflow-y-auto">
                        {activeForms.map(form => (
                            <label key={form.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-200 hover:border-blue-300 cursor-pointer transition-colors">
                                <input
                                    type="checkbox"
                                    checked={selectedFormIds.includes(form.id)}
                                    onChange={() => toggleFormSelection(form.id)}
                                    className="mt-0.5 cursor-pointer"
                                />
                                <div>
                                    <p className="text-sm font-medium text-gray-800">{form.title}</p>
                                    {form.description && <p className="text-xs text-gray-400 mt-0.5">{form.description}</p>}
                                    <p className="text-xs text-gray-400">{form.question_count} question{form.question_count !== 1 ? 's' : ''}</p>
                                </div>
                            </label>
                        ))}
                    </div>
                )}

                {requestError && (
                    <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{requestError}</p>
                )}
                <div className="flex gap-2 mt-1">
                    <button
                        onClick={handleSendRequests}
                        disabled={requestSending || activeForms.length === 0}
                        className="btn-primary flex-1 disabled:opacity-50"
                    >
                        {requestSending ? 'Sending...' : 'Send Request'}
                    </button>
                    <button onClick={() => setRequestModal(false)} className="btn-danger flex-1">Cancel</button>
                </div>
            </div>
        </Modal>
        </>
    );
}
