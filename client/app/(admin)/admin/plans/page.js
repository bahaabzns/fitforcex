'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { Plus, Pencil, Star, Trash2, Check, X } from 'lucide-react';
import { Skeleton } from '@heroui/react/skeleton';
import { Button } from '@heroui/react/button';
import { Modal } from '@heroui/react/modal';
import { AlertDialog } from '@heroui/react/alert-dialog';

const EMPTY_FORM = {
    name: '', display_name: '',
    subtitle: '',
    max_team_seats: '', max_workspaces: '',
    price_monthly: '', currency: 'LE',
    trial_days: '', payment_link: '',
    is_active: true, is_default: false,
    is_popular: false, show_on_landing: true,
    cta_text: "Get Started – It's FREE!", cta_variant: 'outline',
    features_header: "What's included:", features_subheader: '',
    has_team_counter: false, sort_order: 0,
    features: [],
    price_per_seat: '', min_seat_count: 1, max_seat_count: 20,
    max_clients: '',
    period_links: {}, // { period_key: payment_link }
};

const INPUT_CLS = 'w-full px-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors';
const SECTION_LABEL_CLS = 'text-xs font-semibold uppercase tracking-widest text-muted-foreground pt-2';

function PlanModal({ plan, onClose, onSaved, billingPeriods }) {
    const isEdit = !!plan;
    const [form, setForm] = useState(
        isEdit
            ? {
                display_name:      plan.display_name,
                subtitle:          plan.subtitle ?? '',
                max_team_seats:    plan.max_team_seats ?? '',
                max_workspaces:    plan.max_workspaces ?? '',
                price_monthly:     plan.price_monthly ?? '',
                currency:          plan.currency ?? 'LE',
                trial_days:        plan.trial_days ?? '',
                payment_link:      plan.payment_link ?? '',
                is_active:         plan.is_active,
                is_default:        plan.is_default,
                is_popular:        plan.is_popular ?? false,
                show_on_landing:   plan.show_on_landing ?? true,
                cta_text:          plan.cta_text ?? "Get Started – It's FREE!",
                cta_variant:       plan.cta_variant ?? 'outline',
                features_header:   plan.features_header ?? "What's included:",
                features_subheader:plan.features_subheader ?? '',
                has_team_counter:  plan.has_team_counter ?? false,
                sort_order:        plan.sort_order ?? 0,
                features:          Array.isArray(plan.features) ? plan.features : [],
                price_per_seat:    plan.price_per_seat ?? '',
                min_seat_count:    plan.min_seat_count ?? 1,
                max_seat_count:    plan.max_seat_count ?? 20,
                max_clients:       plan.max_clients ?? '',
                period_links:      plan.period_links ?? {},
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
                display_name:       form.display_name.trim() || undefined,
                max_team_seats:     parseOptInt(form.max_team_seats),
                max_workspaces:     parseOptInt(form.max_workspaces),
                price_monthly:      parseOptFloat(form.price_monthly),
                trial_days:         parseOptInt(form.trial_days),
                payment_link:       form.payment_link.trim() || null,
                is_active:          form.is_active,
                is_default:         form.is_default,
                features:           form.features.filter(f => f.trim() !== ''),
                subtitle:           form.subtitle.trim() || null,
                is_popular:         form.is_popular,
                cta_text:           form.cta_text.trim() || 'Get Started',
                cta_variant:        form.cta_variant,
                features_header:    form.features_header.trim() || "What's included:",
                features_subheader: form.features_subheader.trim() || null,
                has_team_counter:   form.has_team_counter,
                sort_order:         parseOptInt(form.sort_order) ?? 0,
                currency:           form.currency.trim() || 'LE',
                show_on_landing:    form.show_on_landing,
                price_per_seat:     parseOptFloat(form.price_per_seat),
                min_seat_count:     parseOptInt(form.min_seat_count) ?? 1,
                max_seat_count:     parseOptInt(form.max_seat_count) ?? 20,
                max_clients:        parseOptInt(form.max_clients),
                period_links:       form.period_links,
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

                            {/* ── Core fields ── */}
                            {!isEdit && (
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-medium text-foreground">
                                        Internal name <span className="text-muted-foreground">(e.g. pro)</span>
                                    </label>
                                    <input type="text" placeholder="pro" value={form.name}
                                        onChange={e => set('name', e.target.value)} className={INPUT_CLS} />
                                </div>
                            )}

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-foreground">Display name</label>
                                <input type="text" placeholder="Pro" value={form.display_name}
                                    onChange={e => set('display_name', e.target.value)} className={INPUT_CLS} />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-medium text-foreground">
                                        Max clients <span className="text-muted-foreground">(blank = unlimited)</span>
                                    </label>
                                    <input type="number" min="1" placeholder="∞" value={form.max_clients}
                                        onChange={e => set('max_clients', e.target.value)} className={INPUT_CLS} />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-medium text-foreground">
                                        Max team seats <span className="text-muted-foreground">(blank = unlimited)</span>
                                    </label>
                                    <input type="number" min="0" placeholder="∞" value={form.max_team_seats}
                                        onChange={e => set('max_team_seats', e.target.value)} className={INPUT_CLS} />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-medium text-foreground">
                                        Max workspaces <span className="text-muted-foreground">(blank = unlimited)</span>
                                    </label>
                                    <input type="number" min="1" placeholder="∞" value={form.max_workspaces}
                                        onChange={e => set('max_workspaces', e.target.value)} className={INPUT_CLS} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-medium text-foreground">
                                        Monthly price <span className="text-muted-foreground">(blank = TBD)</span>
                                    </label>
                                    <input type="number" min="0" step="0.01" placeholder="0.00" value={form.price_monthly}
                                        onChange={e => set('price_monthly', e.target.value)} className={INPUT_CLS} />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-medium text-foreground">
                                        Trial days <span className="text-muted-foreground">(blank = no expiry)</span>
                                    </label>
                                    <input type="number" min="1" placeholder="—" value={form.trial_days}
                                        onChange={e => set('trial_days', e.target.value)} className={INPUT_CLS} />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-foreground">
                                    Fawaterak payment link <span className="text-muted-foreground">(paste from your Fawaterak dashboard)</span>
                                </label>
                                <input type="url" placeholder="https://app.fawaterak.com/pay/..." value={form.payment_link}
                                    onChange={e => set('payment_link', e.target.value)} className={INPUT_CLS} />
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

                            {/* ── Landing page display ── */}
                            <p className={SECTION_LABEL_CLS}>Landing Page Display</p>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-foreground">Subtitle</label>
                                <input type="text" placeholder="For solo coaches" value={form.subtitle}
                                    onChange={e => set('subtitle', e.target.value)} className={INPUT_CLS} />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-medium text-foreground">Currency</label>
                                    <input type="text" placeholder="LE" value={form.currency}
                                        onChange={e => set('currency', e.target.value)} className={INPUT_CLS} />
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <label className="text-xs font-medium text-foreground">Sort order</label>
                                    <input type="number" min="0" placeholder="0" value={form.sort_order}
                                        onChange={e => set('sort_order', e.target.value)} className={INPUT_CLS} />
                                </div>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-foreground">CTA button text</label>
                                <input type="text" placeholder="Get Started – It's FREE!" value={form.cta_text}
                                    onChange={e => set('cta_text', e.target.value)} className={INPUT_CLS} />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-foreground">CTA button style</label>
                                <select value={form.cta_variant} onChange={e => set('cta_variant', e.target.value)} className={INPUT_CLS}>
                                    <option value="outline">Outline</option>
                                    <option value="primary">Primary (filled)</option>
                                    <option value="ghost">Ghost</option>
                                </select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-foreground">Features section header</label>
                                <input type="text" placeholder="What's included:" value={form.features_header}
                                    onChange={e => set('features_header', e.target.value)} className={INPUT_CLS} />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-foreground">
                                    Features sub-header <span className="text-muted-foreground">(optional)</span>
                                </label>
                                <input type="text" placeholder="Team Features" value={form.features_subheader}
                                    onChange={e => set('features_subheader', e.target.value)} className={INPUT_CLS} />
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-foreground">
                                    Features <span className="text-muted-foreground">(one per line)</span>
                                </label>
                                <textarea
                                    rows={6}
                                    placeholder={"∞ Unlimited clients\nWorkout plan delivery\n..."}
                                    value={Array.isArray(form.features) ? form.features.join('\n') : ''}
                                    onChange={e => set('features', e.target.value.split('\n'))}
                                    className={`${INPUT_CLS} resize-y`}
                                />
                            </div>

                            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                                <input type="checkbox" checked={form.is_popular} onChange={e => set('is_popular', e.target.checked)} className="rounded" />
                                Show "Most Popular" badge
                            </label>

                            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                                <input type="checkbox" checked={form.has_team_counter} onChange={e => set('has_team_counter', e.target.checked)} className="rounded" />
                                Show team member counter widget
                            </label>

                            {form.has_team_counter && (
                                <div className="ml-6 flex flex-col gap-3 p-3 rounded-lg bg-secondary/40 border border-border">
                                    <div className="flex flex-col gap-1.5">
                                        <label className="text-xs font-medium text-foreground">
                                            Price per additional seat / month <span className="text-muted-foreground">(blank = no seat charge)</span>
                                        </label>
                                        <input type="number" min="0" step="0.01" placeholder="0.00" value={form.price_per_seat}
                                            onChange={e => set('price_per_seat', e.target.value)} className={INPUT_CLS} />
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs font-medium text-foreground">Min seats</label>
                                            <input type="number" min="1" placeholder="1" value={form.min_seat_count}
                                                onChange={e => set('min_seat_count', e.target.value)} className={INPUT_CLS} />
                                        </div>
                                        <div className="flex flex-col gap-1.5">
                                            <label className="text-xs font-medium text-foreground">Max seats</label>
                                            <input type="number" min="1" placeholder="20" value={form.max_seat_count}
                                                onChange={e => set('max_seat_count', e.target.value)} className={INPUT_CLS} />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                                <input type="checkbox" checked={form.show_on_landing} onChange={e => set('show_on_landing', e.target.checked)} className="rounded" />
                                Show on landing page
                            </label>

                            {/* ── Payment links per billing period ── */}
                            {billingPeriods?.length > 0 && (
                                <>
                                    <p className={SECTION_LABEL_CLS}>Payment Links per Billing Period</p>
                                    <p className="text-xs text-muted-foreground -mt-2">
                                        Each period needs its own Fawaterak link (different billing amount). Leave blank to fall back to the default payment link above.
                                    </p>
                                    {billingPeriods.map(d => (
                                        <div key={d.period_key} className="flex flex-col gap-1.5">
                                            <label className="text-xs font-medium text-foreground flex items-center gap-2">
                                                {d.label}
                                                {d.save_label && (
                                                    <span className="text-xs text-primary font-semibold">{d.save_label}</span>
                                                )}
                                                <span className="text-muted-foreground font-normal">({d.months} mo)</span>
                                            </label>
                                            <input
                                                type="url"
                                                placeholder="https://app.fawaterak.com/pay/..."
                                                value={form.period_links?.[d.period_key] ?? ''}
                                                onChange={e => set('period_links', { ...form.period_links, [d.period_key]: e.target.value })}
                                                className={INPUT_CLS}
                                            />
                                        </div>
                                    ))}
                                </>
                            )}

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

function BillingDiscountEditRow({ discount, onSave, onCancel }) {
    const [form, setForm] = useState({
        label:            discount.label,
        save_label:       discount.save_label ?? '',
        discount_percent: discount.discount_percent,
        months:           discount.months,
        is_active:        discount.is_active,
    });
    const [saving, setSaving] = useState(false);

    function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

    async function handleSave() {
        setSaving(true);
        try {
            const res = await api.put(`/api/admin/billing-discounts/${discount.id}`, {
                ...form,
                save_label: form.save_label.trim() || null,
            });
            onSave(res.data);
        } finally {
            setSaving(false);
        }
    }

    const INPUT_SM = 'px-2 py-1 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors';

    return (
        <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 items-center px-4 py-2 border-t border-border bg-secondary/20">
            <span className="text-sm font-mono text-muted-foreground">{discount.period_key}</span>
            <input value={form.label} onChange={e => set('label', e.target.value)}
                className={`${INPUT_SM} w-28`} placeholder="Label" />
            <input value={form.save_label} onChange={e => set('save_label', e.target.value)}
                className={`${INPUT_SM} w-24`} placeholder="Save label" />
            <input type="number" min="0" max="100" value={form.discount_percent} onChange={e => set('discount_percent', parseInt(e.target.value) || 0)}
                className={`${INPUT_SM} w-16 text-center`} />
            <input type="number" min="1" value={form.months} onChange={e => set('months', parseInt(e.target.value) || 1)}
                className={`${INPUT_SM} w-14 text-center`} />
            <div className="flex items-center gap-1.5">
                <label className="flex items-center gap-1 text-xs text-foreground cursor-pointer">
                    <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded" />
                    On
                </label>
                <button onClick={handleSave} disabled={saving}
                    className="p-1.5 rounded-lg text-green-500 hover:bg-green-500/10 transition-colors" title="Save">
                    <Check size={14} />
                </button>
                <button onClick={onCancel}
                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-default hover:text-foreground transition-colors" title="Cancel">
                    <X size={14} />
                </button>
            </div>
        </div>
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
    const [modal, setModal] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);

    const [discounts, setDiscounts] = useState([]);
    const [discountsLoading, setDiscountsLoading] = useState(true);
    const [editingDiscount, setEditingDiscount] = useState(null);

    function load() {
        setLoading(true);
        api.get('/api/admin/plans')
            .then(res => setPlans(res.data))
            .catch(() => setError('Failed to load plans'))
            .finally(() => setLoading(false));
    }

    function loadDiscounts() {
        setDiscountsLoading(true);
        api.get('/api/admin/billing-discounts')
            .then(res => setDiscounts(res.data))
            .finally(() => setDiscountsLoading(false));
    }

    useEffect(() => { load(); loadDiscounts(); }, []);

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

            {/* ── Plans table ── */}
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
                                {p.price_monthly != null ? `${parseFloat(p.price_monthly).toLocaleString('en-EG')} ${p.currency || ''}`.trim() : '—'}
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
                                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-default hover:text-foreground transition-colors"
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

            {/* ── Billing Periods ── */}
            <div className="rounded-xl border border-border overflow-hidden">
                <div className="px-4 py-3 bg-secondary/50 border-b border-border">
                    <h2 className="text-sm font-semibold text-foreground">Billing Periods</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                        Discounts applied to the base monthly price for each billing cycle.
                    </p>
                </div>

                <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 px-4 py-2 bg-secondary/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <span>Period key</span>
                    <span className="w-28">Label</span>
                    <span className="w-24">Save label</span>
                    <span className="w-16 text-center">Discount</span>
                    <span className="w-14 text-center">Months</span>
                    <span className="w-20">Active</span>
                </div>

                {discountsLoading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 border-t border-border rounded-none" />
                    ))
                ) : (
                    discounts.map((d, idx) => (
                        editingDiscount?.id === d.id
                            ? <BillingDiscountEditRow
                                key={d.id}
                                discount={d}
                                onSave={updated => {
                                    setDiscounts(ds => ds.map(x => x.id === updated.id ? updated : x));
                                    setEditingDiscount(null);
                                }}
                                onCancel={() => setEditingDiscount(null)}
                              />
                            : <div key={d.id} className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 items-center px-4 py-3 ${idx > 0 ? 'border-t border-border' : ''} ${!d.is_active ? 'opacity-40' : ''}`}>
                                <span className="text-sm font-mono text-muted-foreground">{d.period_key}</span>
                                <span className="text-sm text-foreground w-28">{d.label}</span>
                                <span className="text-sm text-muted-foreground w-24">{d.save_label ?? '—'}</span>
                                <span className="text-sm text-foreground w-16 text-center font-medium">{d.discount_percent}%</span>
                                <span className="text-sm text-foreground w-14 text-center">{d.months} mo</span>
                                <div className="w-20 flex items-center gap-2">
                                    <span className={`text-xs font-medium ${d.is_active ? 'text-green-500' : 'text-muted-foreground'}`}>
                                        {d.is_active ? 'On' : 'Off'}
                                    </span>
                                    <button onClick={() => setEditingDiscount(d)}
                                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-default hover:text-foreground transition-colors"
                                        title="Edit period">
                                        <Pencil size={14} />
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
                    billingPeriods={discounts}
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
