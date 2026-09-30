'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { Pencil, Trash2, HelpCircle, ExternalLink, AlertTriangle } from 'lucide-react';
import { Skeleton } from '@heroui/react/skeleton';
import { Button } from '@heroui/react/button';
import { AlertDialog } from '@heroui/react/alert-dialog';
import AppModal, { ModalFooter } from '@/app/components/Modal';
import { FieldLabel, FieldErrorText } from '@/app/components/Field';
import { TextField } from '@heroui/react/textfield';
import { Input } from '@heroui/react/input';
import { TUTORIAL_PAGES } from '@/lib/tutorialPages';
import { getYoutubeVideoId } from '@/utils/video';

// Section order mirrors the order pages first appear in TUTORIAL_PAGES.
const SECTIONS = [...new Set(TUTORIAL_PAGES.map((p) => p.section))];

function TutorialModal({ pageKey, pageLabel, existing, onClose, onSaved }) {
    const [youtubeUrl, setYoutubeUrl] = useState(existing?.youtube_url ?? '');
    const [title, setTitle] = useState(existing?.title ?? '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function handleSave() {
        const url = youtubeUrl.trim();
        if (!url) { setError('A YouTube URL is required'); return; }
        if (!getYoutubeVideoId(url)) { setError('Not a recognizable YouTube URL — paste a watch, youtu.be, or embed link'); return; }

        setSaving(true);
        setError('');
        try {
            await api.put(`/api/admin/tutorials/${pageKey}`, { youtube_url: url, title: title.trim() || null });
            onSaved();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    }

    return (
        <AppModal open onClose={onClose} title={existing ? `Edit tutorial — ${pageLabel}` : `Add tutorial — ${pageLabel}`}>
            <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                    <FieldLabel required>YouTube URL</FieldLabel>
                    <TextField variant="secondary" fullWidth aria-label="YouTube URL" value={youtubeUrl} onChange={setYoutubeUrl}>
                        <Input type="text" placeholder="https://www.youtube.com/watch?v=..." autoFocus />
                    </TextField>
                </div>
                <div className="flex flex-col gap-1.5">
                    <FieldLabel>Title <span className="text-muted-foreground">(optional — shown as the modal heading; falls back to the page name)</span></FieldLabel>
                    <TextField variant="secondary" fullWidth aria-label="Title" value={title} onChange={setTitle}>
                        <Input type="text" placeholder={pageLabel} />
                    </TextField>
                </div>

                <FieldErrorText msg={error} />

                <ModalFooter>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" isDisabled={saving} onClick={handleSave}>
                        {saving ? 'Saving…' : 'Save'}
                    </Button>
                </ModalFooter>
            </div>
        </AppModal>
    );
}

function DeleteConfirmModal({ pageKey, pageLabel, onClose, onDeleted }) {
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState('');

    async function handleDelete() {
        setDeleting(true);
        setError('');
        try {
            await api.delete(`/api/admin/tutorials/${pageKey}`);
            onDeleted();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to remove');
            setDeleting(false);
        }
    }

    return (
        <AlertDialog isOpen={true} onOpenChange={(o) => !o && onClose()}>
            <AlertDialog.Backdrop>
                <AlertDialog.Container>
                    <AlertDialog.Dialog>
                        <AlertDialog.Header>
                            <AlertDialog.Heading>Remove Tutorial</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            <p className="text-sm text-muted-foreground">
                                Remove the tutorial video from <span className="font-semibold text-foreground">{pageLabel}</span>? The button will stop showing on that page.
                            </p>
                            {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button variant="ghost" isDisabled={deleting} onClick={onClose}>Cancel</Button>
                            <Button
                                isDisabled={deleting}
                                onClick={handleDelete}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                {deleting ? 'Removing…' : 'Remove'}
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </AlertDialog>
    );
}

function TutorialRow({ pageKey, pageLabel, row, onEdit, onDelete }) {
    return (
        <div className="grid grid-cols-[1fr_auto_auto] gap-3 items-center px-4 py-3 border-t border-border">
            <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{pageLabel}</p>
                {row ? (
                    <a
                        href={row.youtube_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground truncate"
                    >
                        <ExternalLink size={11} className="shrink-0" />
                        <span className="truncate">{row.title || row.youtube_url}</span>
                    </a>
                ) : (
                    <p className="text-xs text-muted-foreground">Not set</p>
                )}
            </div>
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${row ? 'bg-green-500/10 text-green-600' : 'bg-secondary text-muted-foreground'}`}>
                {row ? 'Assigned' : 'Unassigned'}
            </span>
            <div className="flex items-center gap-1">
                <button
                    onClick={onEdit}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-default hover:text-foreground transition-colors"
                    title={row ? 'Edit tutorial' : 'Add tutorial'}
                >
                    <Pencil size={14} />
                </button>
                {row && (
                    <button
                        onClick={onDelete}
                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                        title="Remove tutorial"
                    >
                        <Trash2 size={14} />
                    </button>
                )}
            </div>
        </div>
    );
}

export default function AdminTutorialsPage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editTarget, setEditTarget] = useState(null); // { pageKey, pageLabel, existing }
    const [deleteTarget, setDeleteTarget] = useState(null); // { pageKey, pageLabel }

    function load() {
        setLoading(true);
        api.get('/api/admin/tutorials')
            .then((res) => setRows(res.data))
            .catch(() => setError('Failed to load tutorials'))
            .finally(() => setLoading(false));
    }

    useEffect(() => { load(); }, []);

    const byKey = Object.fromEntries(rows.map((r) => [r.page_key, r]));
    const knownKeys = new Set(TUTORIAL_PAGES.map((p) => p.key));
    const unmatched = rows.filter((r) => !knownKeys.has(r.page_key));

    return (
        <div className="p-8 flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <HelpCircle size={22} />
                    Tutorials
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                    Assign one YouTube tutorial video per coach-portal page. Pages with a video show a help button in the header; pages without one don&apos;t.
                </p>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {loading ? (
                <div className="flex flex-col gap-2">
                    {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
                </div>
            ) : (
                SECTIONS.map((section) => (
                    <div key={section} className="rounded-xl border border-border overflow-hidden">
                        <div className="px-4 py-2.5 bg-secondary/50">
                            <h2 className="text-sm font-semibold text-foreground">{section}</h2>
                        </div>
                        {TUTORIAL_PAGES.filter((p) => p.section === section).map((page) => (
                            <TutorialRow
                                key={page.key}
                                pageKey={page.key}
                                pageLabel={page.label}
                                row={byKey[page.key] ?? null}
                                onEdit={() => setEditTarget({ pageKey: page.key, pageLabel: page.label, existing: byKey[page.key] ?? null })}
                                onDelete={() => setDeleteTarget({ pageKey: page.key, pageLabel: page.label })}
                            />
                        ))}
                    </div>
                ))
            )}

            {!loading && unmatched.length > 0 && (
                <div className="rounded-xl border border-yellow-500/30 overflow-hidden">
                    <div className="px-4 py-2.5 bg-yellow-500/10 flex items-center gap-2">
                        <AlertTriangle size={15} className="text-yellow-600" />
                        <div>
                            <h2 className="text-sm font-semibold text-foreground">Unmatched assignments</h2>
                            <p className="text-xs text-muted-foreground">
                                These reference a page key that no longer exists in the app (renamed or removed route). They have no effect — remove them.
                            </p>
                        </div>
                    </div>
                    {unmatched.map((row) => (
                        <TutorialRow
                            key={row.page_key}
                            pageKey={row.page_key}
                            pageLabel={row.page_key}
                            row={row}
                            onEdit={() => setEditTarget({ pageKey: row.page_key, pageLabel: row.page_key, existing: row })}
                            onDelete={() => setDeleteTarget({ pageKey: row.page_key, pageLabel: row.page_key })}
                        />
                    ))}
                </div>
            )}

            {editTarget && (
                <TutorialModal
                    pageKey={editTarget.pageKey}
                    pageLabel={editTarget.pageLabel}
                    existing={editTarget.existing}
                    onClose={() => setEditTarget(null)}
                    onSaved={load}
                />
            )}

            {deleteTarget && (
                <DeleteConfirmModal
                    pageKey={deleteTarget.pageKey}
                    pageLabel={deleteTarget.pageLabel}
                    onClose={() => setDeleteTarget(null)}
                    onDeleted={load}
                />
            )}
        </div>
    );
}
