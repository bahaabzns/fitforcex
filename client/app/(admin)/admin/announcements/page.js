'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/lib/axios';
import { Megaphone, Pencil, Plus, Trash2, ImagePlus, RefreshCw } from 'lucide-react';
import { Skeleton } from '@heroui/react/skeleton';
import { Button } from '@heroui/react/button';
import { AlertDialog } from '@heroui/react/alert-dialog';
import { TextField } from '@heroui/react/textfield';
import { Input } from '@heroui/react/input';
import AppModal, { ModalFooter } from '@/app/components/Modal';
import { FieldLabel, FieldErrorText } from '@/app/components/Field';

const TITLE_MAX = 120;
const BODY_MAX = 280;
const CTA_LABEL_MAX = 40;
const IMAGE_MAX_MB = 2;

/** ISO string → value for <input type="datetime-local"> (local time). */
function toLocalInput(iso) {
    if (!iso) return '';
    const d = new Date(iso);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(value) {
    return value ? new Date(value).toISOString() : null;
}

function emptyForm() {
    return {
        title: '', title_ar: '', body: '', body_ar: '',
        cta_label: '', cta_label_ar: '', cta_href: '',
        is_active: true, starts_at: '', ends_at: '', sort_order: 0,
    };
}

function formFromRow(row) {
    return {
        title: row.title ?? '', title_ar: row.title_ar ?? '',
        body: row.body ?? '', body_ar: row.body_ar ?? '',
        cta_label: row.cta_label ?? '', cta_label_ar: row.cta_label_ar ?? '',
        cta_href: row.cta_href ?? '',
        is_active: row.is_active, starts_at: toLocalInput(row.starts_at), ends_at: toLocalInput(row.ends_at),
        sort_order: row.sort_order ?? 0,
    };
}

function statusOf(row) {
    const now = Date.now();
    if (!row.is_active) return { label: 'Inactive', cls: 'bg-secondary text-muted-foreground' };
    if (row.starts_at && new Date(row.starts_at).getTime() > now) return { label: 'Scheduled', cls: 'bg-yellow-500/10 text-yellow-600' };
    if (row.ends_at && new Date(row.ends_at).getTime() <= now) return { label: 'Expired', cls: 'bg-destructive/10 text-destructive' };
    return { label: 'Live', cls: 'bg-green-500/10 text-green-600' };
}

function AnnouncementModal({ existing, onClose, onSaved }) {
    const [form, setForm] = useState(existing ? formFromRow(existing) : emptyForm());
    const [imageFile, setImageFile] = useState(null);
    const [removeImage, setRemoveImage] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const fileInput = useRef(null);

    const imagePreview = imageFile
        ? URL.createObjectURL(imageFile)
        : (!removeImage && existing?.image_url) || null;

    function set(key, value) { setForm((f) => ({ ...f, [key]: value })); }

    async function handleSave() {
        if (!form.title.trim()) { setError('Title is required'); return; }
        if (!form.body.trim()) { setError('Benefit line is required'); return; }

        const payload = {
            title: form.title.trim(),
            title_ar: form.title_ar.trim() || null,
            body: form.body.trim(),
            body_ar: form.body_ar.trim() || null,
            cta_label: form.cta_label.trim() || null,
            cta_label_ar: form.cta_label_ar.trim() || null,
            cta_href: form.cta_href.trim() || null,
            is_active: form.is_active,
            starts_at: fromLocalInput(form.starts_at),
            ends_at: fromLocalInput(form.ends_at),
            sort_order: parseInt(form.sort_order, 10) || 0,
        };

        setSaving(true);
        setError('');
        try {
            const res = existing
                ? await api.put(`/api/admin/announcements/${existing.id}`, payload)
                : await api.post('/api/admin/announcements', payload);
            const id = existing ? existing.id : res.data.id;

            if (imageFile) {
                const data = new FormData();
                data.append('file', imageFile);
                await api.post(`/api/admin/announcements/${id}/image`, data);
            } else if (removeImage && existing?.image_url) {
                await api.delete(`/api/admin/announcements/${id}/image`);
            }
            onSaved();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save');
        } finally {
            setSaving(false);
        }
    }

    return (
        <AppModal open onClose={onClose} wide title={existing ? 'Edit announcement' : 'New announcement'}>
            <div className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel required>Title <span className="text-muted-foreground">(one line)</span></FieldLabel>
                        <TextField variant="secondary" fullWidth aria-label="Title" value={form.title} onChange={(v) => set('title', v)}>
                            <Input type="text" maxLength={TITLE_MAX} placeholder="Make the client portal yours" autoFocus />
                        </TextField>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>Title (Arabic)</FieldLabel>
                        <TextField variant="secondary" fullWidth aria-label="Title (Arabic)" value={form.title_ar} onChange={(v) => set('title_ar', v)}>
                            <Input type="text" dir="rtl" maxLength={TITLE_MAX} />
                        </TextField>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel required>Benefit <span className="text-muted-foreground">(one line)</span></FieldLabel>
                        <TextField variant="secondary" fullWidth aria-label="Benefit" value={form.body} onChange={(v) => set('body', v)}>
                            <Input type="text" maxLength={BODY_MAX} placeholder="Add your logo, colors and banners." />
                        </TextField>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>Benefit (Arabic)</FieldLabel>
                        <TextField variant="secondary" fullWidth aria-label="Benefit (Arabic)" value={form.body_ar} onChange={(v) => set('body_ar', v)}>
                            <Input type="text" dir="rtl" maxLength={BODY_MAX} />
                        </TextField>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>Button label</FieldLabel>
                        <TextField variant="secondary" fullWidth aria-label="Button label" value={form.cta_label} onChange={(v) => set('cta_label', v)}>
                            <Input type="text" maxLength={CTA_LABEL_MAX} placeholder="Set up branding" />
                        </TextField>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>Button label (Arabic)</FieldLabel>
                        <TextField variant="secondary" fullWidth aria-label="Button label (Arabic)" value={form.cta_label_ar} onChange={(v) => set('cta_label_ar', v)}>
                            <Input type="text" dir="rtl" maxLength={CTA_LABEL_MAX} />
                        </TextField>
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <FieldLabel hint="An in-app path or an https:// URL. Use {slug} for the coach's workspace, e.g. /{slug}/settings/branding">
                        Button link
                    </FieldLabel>
                    <TextField variant="secondary" fullWidth aria-label="Button link" value={form.cta_href} onChange={(v) => set('cta_href', v)}>
                        <Input type="text" dir="ltr" placeholder="/{slug}/settings/branding" />
                    </TextField>
                </div>

                <div className="flex flex-col gap-1.5">
                    <FieldLabel>Image <span className="text-muted-foreground">(optional — PNG/JPG/WebP, at least 400px wide, max {IMAGE_MAX_MB} MB; a default illustration is used otherwise)</span></FieldLabel>
                    <div className="flex items-center gap-3">
                        <div className="h-16 w-28 shrink-0 rounded-lg border border-dashed border-border bg-secondary/40 flex items-center justify-center overflow-hidden">
                            {imagePreview ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={imagePreview} alt="" className="h-full w-full object-cover" />
                            ) : (
                                <ImagePlus size={20} className="text-muted-foreground" />
                            )}
                        </div>
                        <input
                            ref={fileInput}
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(e) => { setImageFile(e.target.files?.[0] ?? null); setRemoveImage(false); }}
                        />
                        <Button size="sm" variant="outline" onClick={() => fileInput.current?.click()}>
                            {imagePreview ? 'Replace' : 'Choose image'}
                        </Button>
                        {imagePreview && (
                            <Button size="sm" variant="ghost" onClick={() => { setImageFile(null); setRemoveImage(true); }}>
                                Remove
                            </Button>
                        )}
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel hint="Leave empty to show immediately">Starts</FieldLabel>
                        <input type="datetime-local" value={form.starts_at} onChange={(e) => set('starts_at', e.target.value)}
                            className="px-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel hint="Leave empty to keep showing until dismissed or deactivated">Ends</FieldLabel>
                        <input type="datetime-local" value={form.ends_at} onChange={(e) => set('ends_at', e.target.value)}
                            className="px-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel hint="Lower numbers are shown first. Only one announcement is shown at a time.">Order</FieldLabel>
                        <input type="number" min="0" value={form.sort_order} onChange={(e) => set('sort_order', e.target.value)}
                            className="px-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none" />
                    </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input type="checkbox" checked={form.is_active} onChange={(e) => set('is_active', e.target.checked)} className="rounded" />
                    Active (visible to coaches)
                </label>

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

function RepublishConfirmModal({ announcement, onClose, onRepublished }) {
    const [working, setWorking] = useState(false);
    const [error, setError] = useState('');
    const seenBy = announcement.dismissed_count + announcement.clicked_count;

    async function handleRepublish() {
        setWorking(true);
        setError('');
        try {
            await api.post(`/api/admin/announcements/${announcement.id}/republish`);
            onRepublished();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to republish');
            setWorking(false);
        }
    }

    return (
        <AlertDialog isOpen onOpenChange={(open) => !open && onClose()}>
            <AlertDialog.Backdrop>
                <AlertDialog.Container>
                    <AlertDialog.Dialog>
                        <AlertDialog.Header>
                            <AlertDialog.Heading>Republish announcement</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            <p className="text-sm text-muted-foreground">
                                Show <span className="font-semibold text-foreground">{announcement.title}</span> again to every coach
                                {seenBy > 0 ? <>, including the <span className="font-semibold text-foreground">{seenBy}</span> who already dismissed or clicked it</> : null}.
                                It becomes active and live immediately: a future start date is cleared and an expired end date is removed.
                            </p>
                            {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button variant="ghost" isDisabled={working} onClick={onClose}>Cancel</Button>
                            <Button variant="primary" isDisabled={working} onClick={handleRepublish}>
                                {working ? 'Republishing…' : 'Republish'}
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </AlertDialog>
    );
}

function DeleteConfirmModal({ announcement, onClose, onDeleted }) {
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState('');

    async function handleDelete() {
        setDeleting(true);
        setError('');
        try {
            await api.delete(`/api/admin/announcements/${announcement.id}`);
            onDeleted();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete');
            setDeleting(false);
        }
    }

    return (
        <AlertDialog isOpen onOpenChange={(open) => !open && onClose()}>
            <AlertDialog.Backdrop>
                <AlertDialog.Container>
                    <AlertDialog.Dialog>
                        <AlertDialog.Header>
                            <AlertDialog.Heading>Delete announcement</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            <p className="text-sm text-muted-foreground">
                                Delete <span className="font-semibold text-foreground">{announcement.title}</span>? It disappears for every coach and its
                                dismissal history is removed. To hide it temporarily, deactivate it instead.
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
                                {deleting ? 'Deleting…' : 'Delete'}
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </AlertDialog>
    );
}

export default function AdminAnnouncementsPage() {
    const [rows, setRows] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [editTarget, setEditTarget] = useState(null); // 'new' | row
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [republishTarget, setRepublishTarget] = useState(null);

    function load() {
        api.get('/api/admin/announcements')
            .then((res) => setRows(res.data))
            .catch(() => setError('Failed to load announcements'))
            .finally(() => setLoading(false));
    }

    useEffect(() => { load(); }, []);

    return (
        <div className="p-8 flex flex-col gap-6">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Megaphone size={22} />
                        Announcements
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        &quot;What&apos;s new&quot; cards shown at the top of the coach dashboard. Each coach sees one at a time, in order, and
                        dismissing it reveals the next.
                    </p>
                </div>
                <Button variant="primary" onClick={() => setEditTarget('new')}>
                    <Plus size={16} /> New announcement
                </Button>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {loading ? (
                <div className="flex flex-col gap-2">
                    {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
                </div>
            ) : rows.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
                    No announcements yet. Create one to show a card on every coach&apos;s dashboard.
                </div>
            ) : (
                <div className="rounded-xl border border-border overflow-hidden">
                    {rows.map((row, index) => {
                        const status = statusOf(row);
                        return (
                            <div key={row.id} className={`flex items-center gap-4 px-4 py-3 ${index > 0 ? 'border-t border-border' : ''}`}>
                                <div className="h-12 w-20 shrink-0 rounded-lg bg-primary/10 overflow-hidden flex items-center justify-center">
                                    {row.image_url ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={row.image_url} alt="" className="h-full w-full object-cover" />
                                    ) : (
                                        <Megaphone size={18} className="text-primary" />
                                    )}
                                </div>
                                <div className="min-w-0 grow">
                                    <p className="text-sm font-semibold text-foreground truncate">{row.title}</p>
                                    <p className="text-xs text-muted-foreground truncate">{row.body}</p>
                                    <p className="text-[11px] text-muted-foreground mt-0.5">
                                        Order {row.sort_order} · {row.dismissed_count} dismissed · {row.clicked_count} clicked
                                        {row.cta_href ? ` · ${row.cta_href}` : ''}
                                    </p>
                                </div>
                                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${status.cls}`}>{status.label}</span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => setRepublishTarget(row)}
                                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-default hover:text-foreground transition-colors"
                                        title="Republish — show again to every coach"
                                    >
                                        <RefreshCw size={14} />
                                    </button>
                                    <button
                                        onClick={() => setEditTarget(row)}
                                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-default hover:text-foreground transition-colors"
                                        title="Edit"
                                    >
                                        <Pencil size={14} />
                                    </button>
                                    <button
                                        onClick={() => setDeleteTarget(row)}
                                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                                        title="Delete"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {editTarget && (
                <AnnouncementModal
                    existing={editTarget === 'new' ? null : editTarget}
                    onClose={() => setEditTarget(null)}
                    onSaved={load}
                />
            )}

            {republishTarget && (
                <RepublishConfirmModal
                    announcement={republishTarget}
                    onClose={() => setRepublishTarget(null)}
                    onRepublished={load}
                />
            )}

            {deleteTarget && (
                <DeleteConfirmModal
                    announcement={deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    onDeleted={load}
                />
            )}
        </div>
    );
}
