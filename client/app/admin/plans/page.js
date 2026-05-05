'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { Plus, Pencil } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';

const EMPTY_FORM = { name: '', display_name: '', max_team_seats: '', max_workspaces: '', price_monthly: '', is_active: true };

function PlanModal({ plan, onClose, onSaved }) {
    const isEdit = !!plan;
    const [form, setForm] = useState(
        isEdit
            ? {
                display_name: plan.display_name,
                max_team_seats: plan.max_team_seats ?? '',
                max_workspaces: plan.max_workspaces ?? '',
                price_monthly: plan.price_monthly ?? '',
                is_active: plan.is_active,
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
                is_active: form.is_active,
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
        <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40" />
            <div className="relative bg-card border border-border rounded-2xl p-6 w-full max-w-sm shadow-2xl flex flex-col gap-4" onClick={e => e.stopPropagation()}>
                <h2 className="text-base font-bold text-foreground">{isEdit ? 'Edit Plan' : 'New Plan'}</h2>

                {!isEdit && (
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-xs">Internal name <span className="text-muted-foreground">(e.g. pro)</span></Label>
                        <Input placeholder="pro" value={form.name} onChange={e => set('name', e.target.value)} />
                    </div>
                )}
                <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Display name</Label>
                    <Input placeholder="Pro" value={form.display_name} onChange={e => set('display_name', e.target.value)} />
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-xs">Max team seats <span className="text-muted-foreground">(blank = unlimited)</span></Label>
                        <Input type="number" min="0" placeholder="∞" value={form.max_team_seats} onChange={e => set('max_team_seats', e.target.value)} />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-xs">Max workspaces <span className="text-muted-foreground">(blank = unlimited)</span></Label>
                        <Input type="number" min="1" placeholder="∞" value={form.max_workspaces} onChange={e => set('max_workspaces', e.target.value)} />
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <Label className="text-xs">Monthly price <span className="text-muted-foreground">(blank = TBD)</span></Label>
                    <Input type="number" min="0" step="0.01" placeholder="0.00" value={form.price_monthly} onChange={e => set('price_monthly', e.target.value)} />
                </div>

                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded" />
                    Active
                </label>

                {error && <p className="text-sm text-red-500">{error}</p>}

                <div className="flex gap-2 justify-end pt-1">
                    <Button variant="outline" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Button>
                </div>
            </div>
        </div>
    );
}

export default function AdminPlansPage() {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [modal, setModal] = useState(null); // null | 'new' | plan object

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
                <Button onClick={() => setModal('new')}>
                    <Plus size={15} className="mr-1.5" />
                    New Plan
                </Button>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div className="rounded-xl border border-border overflow-hidden">
                <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-2.5 bg-secondary/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <span>Name</span>
                    <span>Display</span>
                    <span>Seats</span>
                    <span>Workspaces</span>
                    <span>Price/mo</span>
                    <span>Workspaces Using</span>
                    <span></span>
                </div>

                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="h-12 border-t border-border bg-secondary/20 animate-pulse" />
                    ))
                ) : plans.length === 0 ? (
                    <div className="py-14 text-center text-sm text-muted-foreground border-t border-border">No plans found.</div>
                ) : (
                    plans.map((p, idx) => (
                        <div
                            key={p.id}
                            className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto] gap-4 items-center px-4 py-3 ${idx > 0 ? 'border-t border-border' : ''} ${!p.is_active ? 'opacity-50' : ''}`}
                        >
                            <span className="text-sm font-mono text-muted-foreground w-20">{p.name}</span>
                            <span className="text-sm font-medium text-foreground">{p.display_name}</span>
                            <span className="text-sm text-foreground w-16 text-center">{p.max_team_seats ?? '∞'}</span>
                            <span className="text-sm text-foreground w-20 text-center">{p.max_workspaces ?? '∞'}</span>
                            <span className="text-sm text-foreground w-20 text-right">
                                {p.price_monthly != null ? `$${parseFloat(p.price_monthly).toFixed(2)}` : '—'}
                            </span>
                            <span className="text-sm text-foreground w-24 text-center">{p.workspace_count}</span>
                            <button
                                onClick={() => setModal(p)}
                                className="p-1.5 rounded-lg text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                                title="Edit plan"
                            >
                                <Pencil size={14} />
                            </button>
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
        </div>
    );
}
