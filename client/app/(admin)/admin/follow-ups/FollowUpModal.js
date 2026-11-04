'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/axios';
import { Modal } from '@heroui/react/modal';
import { Button } from '@heroui/react/button';
import { Skeleton } from '@heroui/react/skeleton';
import { Plus, Pencil, Trash2, CalendarClock, Banknote } from 'lucide-react';
import { useDateFormatter } from '@/utils/useDateFormatter';
import { STATUS_META, REPORT_TIME_ZONE, cairoDate, addDaysToDate, describeReminder, describePendingTransfer } from '@/lib/followUps';
import WhatsAppActions from './WhatsAppActions';

const NEXT_DATE_SHORTCUTS = [
    { label: '+2 days', days: 2 },
    { label: '+1 week', days: 7 },
    { label: '+2 weeks', days: 14 },
];

const FIELD_CLASSES = 'w-full rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-primary/40 focus:border-primary/60';

const cairoDateOf = (isoDateTime) => new Intl.DateTimeFormat('en-CA', { timeZone: REPORT_TIME_ZONE }).format(new Date(isoDateTime));

// Used for both "Add follow-up" and editing an existing entry.
function EntryForm({ entry, submitLabel, onSubmit, onCancel }) {
    const originalDate = entry ? cairoDateOf(entry.followedUpAt) : cairoDate();
    const [followedUpOn, setFollowedUpOn] = useState(originalDate);
    const [sentNote, setSentNote] = useState(entry?.sentNote ?? '');
    const [replyNote, setReplyNote] = useState(entry?.replyNote ?? '');
    const [nextFollowUpOn, setNextFollowUpOn] = useState(entry?.nextFollowUpOn ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function handleSubmit(event) {
        event.preventDefault();
        if (!sentNote.trim()) { setError('Write what you sent or talked about'); return; }
        setSaving(true);
        setError('');
        try {
            await onSubmit({
                sentNote: sentNote.trim(),
                replyNote: replyNote.trim() || null,
                nextFollowUpOn: nextFollowUpOn || null,
                // Left out when untouched so the server stamps "now" (create) or keeps the original time (edit).
                followedUpAt: followedUpOn !== originalDate ? followedUpOn : undefined,
            });
        } catch (err) {
            setError(err.response?.data?.message || 'Could not save this follow-up');
            setSaving(false);
        }
    }

    return (
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-border bg-secondary/30 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-[170px_1fr]">
                <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">Date</span>
                    <input type="date" value={followedUpOn} max={cairoDate()} onChange={event => setFollowedUpOn(event.target.value)} className={FIELD_CLASSES} />
                </label>
                <label className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-muted-foreground">What I sent or talked about</span>
                    <textarea rows={2} value={sentNote} onChange={event => setSentNote(event.target.value)} placeholder="e.g. Sent the welcome message and offered a quick tour" className={FIELD_CLASSES} />
                </label>
            </div>
            <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Their reply or the result</span>
                <textarea rows={2} value={replyNote} onChange={event => setReplyNote(event.target.value)} placeholder="e.g. Said she'll add her clients this week" className={FIELD_CLASSES} />
            </label>
            <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-muted-foreground">Next follow-up (optional)</span>
                <div className="flex flex-wrap items-center gap-2">
                    <input type="date" value={nextFollowUpOn} min={followedUpOn} onChange={event => setNextFollowUpOn(event.target.value)} className={`${FIELD_CLASSES} max-w-[170px]`} />
                    {NEXT_DATE_SHORTCUTS.map(shortcut => (
                        <button
                            key={shortcut.label}
                            type="button"
                            onClick={() => setNextFollowUpOn(addDaysToDate(cairoDate(), shortcut.days))}
                            className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-default hover:text-foreground"
                        >
                            {shortcut.label}
                        </button>
                    ))}
                    {nextFollowUpOn && (
                        <button type="button" onClick={() => setNextFollowUpOn('')} className="text-xs text-muted-foreground underline-offset-2 hover:underline">Clear</button>
                    )}
                </div>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <div className="flex justify-end gap-2">
                {onCancel && <Button type="button" variant="outline" size="sm" onClick={onCancel} isDisabled={saving}>Cancel</Button>}
                <Button type="submit" variant="primary" size="sm" isDisabled={saving}>{saving ? 'Saving…' : submitLabel}</Button>
            </div>
        </form>
    );
}

function HistoryEntry({ entry, onEdit, onDelete }) {
    const { formatDate } = useDateFormatter();
    const reminder = describeReminder(entry.nextFollowUpOn);

    return (
        <li className="flex flex-col gap-2 rounded-xl border border-border p-4">
            <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">{formatDate(entry.followedUpAt)}</span>
                <div className="flex items-center gap-1">
                    <button type="button" onClick={onEdit} aria-label="Edit follow-up" className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-default hover:text-foreground"><Pencil size={13} /></button>
                    <button type="button" onClick={onDelete} aria-label="Delete follow-up" className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-600"><Trash2 size={13} /></button>
                </div>
            </div>
            <div>
                <p className="text-xs font-medium text-muted-foreground">I sent / we talked about</p>
                <p className="whitespace-pre-wrap text-sm text-foreground">{entry.sentNote}</p>
            </div>
            <div>
                <p className="text-xs font-medium text-muted-foreground">Their reply / result</p>
                <p className={`whitespace-pre-wrap text-sm ${entry.replyNote ? 'text-foreground' : 'italic text-muted-foreground'}`}>{entry.replyNote || 'No reply yet'}</p>
            </div>
            {entry.nextFollowUpOn && (
                <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <CalendarClock size={12} aria-hidden="true" />
                    Next follow-up {formatDate(entry.nextFollowUpOn)}{reminder ? ` · ${reminder.text}` : ''}
                </p>
            )}
        </li>
    );
}

export default function FollowUpModal({ coach, startWithForm, onClose, onChanged }) {
    const [entries, setEntries] = useState(null);
    const [error, setError] = useState('');
    const [isAdding, setIsAdding] = useState(startWithForm);
    const [editingId, setEditingId] = useState(null);
    const status = STATUS_META[coach.status];

    const loadHistory = useCallback(() => {
        api.get(`/api/admin/follow-ups/${coach.workspaceId}`)
            .then(res => { setEntries(res.data.entries); setError(''); })
            .catch(() => setError('Failed to load the follow-up history'));
    }, [coach.workspaceId]);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    // After any change, refresh both this history and the list behind the modal (last/next dates).
    function afterChange() {
        loadHistory();
        onChanged();
    }

    async function handleCreate(payload) {
        await api.post(`/api/admin/follow-ups/${coach.workspaceId}`, payload);
        setIsAdding(false);
        afterChange();
    }

    async function handleUpdate(entryId, payload) {
        await api.patch(`/api/admin/follow-ups/entries/${entryId}`, payload);
        setEditingId(null);
        afterChange();
    }

    async function handleDelete(entryId) {
        if (!window.confirm('Delete this follow-up? It will disappear from the history.')) return;
        try {
            await api.delete(`/api/admin/follow-ups/entries/${entryId}`);
            afterChange();
        } catch (err) {
            setError(err.response?.data?.message || 'Could not delete this follow-up');
        }
    }

    return (
        <Modal isOpen={true} onOpenChange={open => !open && onClose()}>
            <Modal.Backdrop>
                <Modal.Container>
                    <Modal.Dialog className="sm:max-w-2xl">
                        <Modal.Header>
                            <Modal.Heading>{coach.ownerName}</Modal.Heading>
                            <Modal.CloseTrigger />
                        </Modal.Header>
                        <Modal.Body className="flex flex-col gap-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <p className="truncate text-sm text-foreground">{coach.workspaceName}</p>
                                    <p className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
                                        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${status.chip}`}>{status.label}</span>
                                        Joined {coach.daysSinceSignup} {coach.daysSinceSignup === 1 ? 'day' : 'days'} ago
                                    </p>
                                </div>
                                <WhatsAppActions coach={coach} />
                            </div>

                            {coach.pendingTransfer && (
                                <p className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm text-foreground">
                                    <Banknote size={16} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                                    <span>
                                        {describePendingTransfer(coach.pendingTransfer)}. This coach already chose to pay — once you see the money, confirm it on the{' '}
                                        <Link href="/payments" className="font-medium text-primary underline-offset-2 hover:underline">Payments page</Link>{coach.pendingTransfer.referenceCode ? ' (search the reference code)' : ''}.
                                    </span>
                                </p>
                            )}

                            {isAdding ? (
                                <EntryForm submitLabel="Save follow-up" onSubmit={handleCreate} onCancel={entries?.length ? () => setIsAdding(false) : undefined} />
                            ) : (
                                <Button variant="primary" size="sm" onClick={() => setIsAdding(true)} className="self-start"><Plus size={14} /> Add follow-up</Button>
                            )}

                            {error && <p className="text-sm text-red-500">{error}</p>}

                            <div className="flex flex-col gap-2">
                                <h3 className="text-sm font-semibold text-foreground">History</h3>
                                {entries === null ? (
                                    <Skeleton className="h-24 rounded-xl" />
                                ) : entries.length === 0 ? (
                                    <p className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">No follow-ups yet — the first one you save will show up here.</p>
                                ) : (
                                    <ul className="flex flex-col gap-2">
                                        {entries.map(entry => editingId === entry.id ? (
                                            <li key={entry.id}>
                                                <EntryForm entry={entry} submitLabel="Save changes" onSubmit={payload => handleUpdate(entry.id, payload)} onCancel={() => setEditingId(null)} />
                                            </li>
                                        ) : (
                                            <HistoryEntry key={entry.id} entry={entry} onEdit={() => setEditingId(entry.id)} onDelete={() => handleDelete(entry.id)} />
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </Modal.Body>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
