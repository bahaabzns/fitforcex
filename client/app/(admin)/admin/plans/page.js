'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { Plus, Pencil, Star, Trash2 } from 'lucide-react';
import { Skeleton } from '@heroui/react/skeleton';
import { Button } from '@heroui/react/button';
import { Modal } from '@heroui/react/modal';
import { AlertDialog } from '@heroui/react/alert-dialog';

const EMPTY_FORM = { name: '', display_name: '', max_team_seats: '', max_workspaces: '', price_monthly: '', trial_days: '', is_active: true, is_default: false };

function PlanModal({ plan, onClose, onSaved }) {
    const isEdit = !!plan;
    const [form, setForm] = useState(
        isEdit
            ? {
                display_name: plan.display_name,
                max_team_seats: plan.max_team_seats ?? '',
                max_workspaces: plan.max_workspaces ?? '',
                price_monthly: plan.price_monthly ?? '',
                trial_days: plan.trial_days ?? '',
                is_active: plan.is_active,
                is_default: plan.is_default,
              }
            : EMPTY_FORM
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

    function parseOptInt(v) { const n = parseInt(v); return isNaN(n) ? null : n; }
    function parseOptFloat(v) { const n = parseFloat(v); return isNaN(n) ? null : n; }

    async function handleSave() {
        setSaving(true);
        setError('');
        try {
            const payload = {
                display_name: form.display_name.trim() || undefined,
                max_team_seats: parseOptInt(form.max_team_seats),
                max_workspaces: parseOptInt(form.max_workspaces),
                price_monthly: parseOptFloat(form.price_monthly),
                trial_days: parseOptInt(form.trial_days),
                is_active: form.is_active,
                is_default: form.is_default,
            };
            if (isEdit) {
                await api.put(`/api/admin/plans/${plan.id}`, payload);
            } else {
                await api.post('/api/admin/plans', { ...payload, name: form.name.trim() });
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
        <Modal isOpen={true} onOpenChange={(o) => !o && onClose()}>
            <Modal.Backdrop>
                <Modal.Container>
                    <Modal.Dialog>
                        <Modal.Header>
                            <Modal.Heading>{isEdit ? 'Edit Plan' : 'New Plan'}</Modal.Heading>
                            <Modal.CloseTrigger />
                        </Modal.Header>
                        <Modal.Body className="flex flex-col gap-4">
                            {!isEdit && (
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-medium text-foreground">
                                        Internal name <span className="text-muted-foreground">(e.g. pro)</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="pro"
                                        value={form.name}
                                        onChange={e => set('name', e.target.value)}
                                        className="w-full px-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors"
                                    />
                                </div>
                            )}
                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-foreground">Display name</label>
                                <input
                                    type="text"
                                    placeholder="Pro"
                                    value={form.display_name}
                                    onChange={e => set('display_name', e.target.value)}
                                    className="w-full px-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-medium text-foreground">
                                        Max team seats <span className="text-muted-foreground">(blank = unlimited)</span>
                                    </label>
                                    <input type="number" min="0" placeholder="∞" value={form.max_team_seats} onChange={e => set('max_team_seats', e.target.value)}
                                        className="w-full px-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-medium text-foreground">
                                        Max workspaces <span className="text-muted-foreground">(blank = unlimited)</span>
                                    </label>
                                    <input type="number" min="1" placeholder="∞" value={form.max_workspaces} onChange={e => set('max_workspaces', e.target.value)}
                                        className="w-full px-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-medium text-foreground">
                                        Monthly price <span className="text-muted-foreground">(blank = TBD)</span>
                                    </label>
                                    <input type="number" min="0" step="0.01" placeholder="0.00" value={form.price_monthly} onChange={e => set('price_monthly', e.target.value)}
                                        className="w-full px-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors" />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-medium text-foreground">
                                        Trial days <span className="text-muted-foreground">(blank = no expiry)</span>
                                    </label>
                                    <input type="number" min="1" placeholder="—" value={form.trial_days} onChange={e => set('trial_days', e.target.value)}
                                        className="w-full px-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors" />
                                </div>
                            </div>

                            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                                <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded" />
                                Active
                            </label>

                            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                                <input type="checkbox" checked={form.is_default} onChange={e => set('is_default', e.target.checked)} className="rounded" />
                                <span className="flex items-center gap-1">
                                    <Star size={13} className="text-yellow-500" />
                                    Default plan for new registrations
                                </span>
                            </label>

                            {error && <p className="text-sm text-red-500">{error}</p>}
                        </Modal.Body>
                        <Modal.Footer>
                            <Button variant="ghost" onClick={onClose}>Cancel</Button>
                            <Button variant="primary" isDisabled={saving} onClick={handleSave}>
                                {saving ? 'Saving…' : 'Save'}
                            </Button>
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}

function DeleteConfirmModal({ plan, onClose, onDeleted }) {
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState('');

    async function handleDelete() {
        setDeleting(true);
        setError('');
        try {
            await api.delete(`/api/admin/plans/${plan.id}`);
            onDeleted();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete');
            setDeleting(false);
        }
    }

    return (
        <AlertDialog isOpen={true} onOpenChange={(o) => !o && onClose()}>
            <AlertDialog.Backdrop>
                <AlertDialog.Container>
                    <AlertDialog.Dialog>
                        <AlertDialog.Header>
                            <AlertDialog.Heading>Delete Plan</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            <p className="text-sm text-muted-foreground">
                                Are you sure you want to delete <span className="font-semibold text-foreground">{plan.display_name}</span>? This cannot be undone.
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

export default function AdminPlansPage() {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [modal, setModal] = useState(null); // null | 'new' | plan object
    const [deleteTarget, setDeleteTarget] = useState(null); // plan to delete

    function load() {
        setLoading(true);
        api.get('/api/admin/plans')
            .then(res => setPlans(res.data))
            .catch(() => setError('Failed to load plans'))
            .finally(() => setLoading(false));
    }

    useEffect(() => { load(); }, []);

    return (
        <div className="p-8 flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Plans</h1>
                    <p className="text-sm text-muted-foreground mt-1">Manage subscription tiers</p>
                </div>
                <Button variant="primary" onClick={() => setModal('new')}>
                    <Plus size={15} className="mr-1.5" />
                    New Plan
                </Button>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="rounded-xl border border-border overflow-hidden">
                <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto_auto] gap-4 px-4 py-2.5 bg-secondary/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <span>Name</span>
                    <span>Display</span>
                    <span>Seats</span>
                    <span>Workspaces</span>
                    <span>Price/mo</span>
                    <span>Trial days</span>
                    <span>Workspaces Using</span>
                    <span>Default</span>
                    <span></span>
                </div>

                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 border-t border-border rounded-none" />
                    ))
                ) : plans.length === 0 ? (
                    <div className="py-14 text-center text-sm text-muted-foreground border-t border-border">No plans found.</div>
                ) : (
                    plans.map((p, idx) => (
                        <div
                            key={p.id}
                            className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto_auto] gap-4 items-center px-4 py-3 ${idx > 0 ? 'border-t border-border' : ''} ${!p.is_active ? 'opacity-50' : ''}`}
                        >
                            <span className="text-sm font-mono text-muted-foreground w-20">{p.name}</span>
                            <span className="text-sm font-medium text-foreground">{p.display_name}</span>
                            <span className="text-sm text-foreground w-16 text-center">{p.max_team_seats ?? '∞'}</span>
                            <span className="text-sm text-foreground w-20 text-center">{p.max_workspaces ?? '∞'}</span>
                            <span className="text-sm text-foreground w-20 text-right">
                                {p.price_monthly != null ? `$${parseFloat(p.price_monthly).toFixed(2)}` : '—'}
                            </span>
                            <span className="text-sm text-foreground w-20 text-center">
                                {p.trial_days != null ? `${p.trial_days}d` : '—'}
                            </span>
                            <span className="text-sm text-foreground w-24 text-center">{p.workspace_count}</span>
                            <span className="w-16 flex justify-center">
                                {p.is_default && <Star size={14} className="text-yellow-500" title="Default plan for new registrations" />}
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setModal(p)}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                                    title="Edit plan"
                                >
                                    <Pencil size={14} />
                                </button>
                                <button
                                    onClick={() => setDeleteTarget(p)}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors"
                                    title="Delete plan"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {modal && (
                <PlanModal
                    plan={modal === 'new' ? null : modal}
                    onClose={() => setModal(null)}
                    onSaved={load}
                />
            )}

            {deleteTarget && (
                <DeleteConfirmModal
                    plan={deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    onDeleted={load}
                />
            )}
        </div>
    );
}
