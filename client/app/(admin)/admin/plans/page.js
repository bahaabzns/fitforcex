'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/axios';
import { Plus, Pencil, Star, Trash2, Check, X } from 'lucide-react';
import { Skeleton } from '@heroui/react/skeleton';
import { Button } from '@heroui/react/button';
import { AlertDialog } from '@heroui/react/alert-dialog';
import AppModal, { ModalFooter } from '@/app/components/Modal';
import { FieldLabel, FieldErrorText } from '@/app/components/Field';
import { TextField } from '@heroui/react/textfield';
import { Input } from '@heroui/react/input';
import { Select } from '@heroui/react/select';
import { ListBox } from '@heroui/react/list-box';

// A variation's display label is generated from its limits (no free-text name field) —
// mirrors server/src/lib/planVariationLabel.ts so the admin preview never drifts from
// what the public landing page actually shows.
function formatVariationLabel(v) {
    return v.max_clients === '' || v.max_clients == null
        ? 'Unlimited clients'
        : `Up to ${v.max_clients} clients`;
}

function emptyVariation(isDefault = false) {
    return {
        id: null,
        max_clients: '',
        price_monthly: '', currency: 'LE', payment_link: '',
        is_default: isDefault, is_active: true,
    };
}

function variationFromServer(v) {
    return {
        id: v.id,
        max_clients:   v.max_clients ?? '',
        price_monthly: v.price_monthly ?? '',
        currency:      v.currency ?? 'LE',
        payment_link:  v.payment_link ?? '',
        is_default:    v.is_default ?? false,
        is_active:     v.is_active ?? true,
    };
}

const EMPTY_FORM = {
    name: '', display_name: '',
    subtitle: '',
    trial_days: '',
    max_team_seats: '',
    is_active: true, is_default: false,
    is_popular: false, show_on_landing: true,
    cta_text: "Get Started – It's FREE!", cta_variant: 'outline',
    features_header: "What's included:", features_subheader: '',
    sort_order: 0,
    features: [],
    period_links: {}, // { period_key: payment_link }
    variations: [emptyVariation(true)],
    addon_rules: [],
};

const INPUT_CLS = 'w-full px-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors';
const INPUT_SM_CLS = 'px-2 py-1.5 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors';
const SECTION_LABEL_CLS = 'text-xs font-semibold uppercase tracking-widest text-muted-foreground pt-2';

function PlanModal({ plan, onClose, onSaved, billingPeriods, addons }) {
    const isEdit = !!plan;
    const [form, setForm] = useState(
        isEdit
            ? {
                display_name:      plan.display_name,
                subtitle:          plan.subtitle ?? '',
                trial_days:        plan.trial_days ?? '',
                max_team_seats:    plan.max_team_seats ?? '',
                is_active:         plan.is_active,
                is_default:        plan.is_default,
                is_popular:        plan.is_popular ?? false,
                show_on_landing:   plan.show_on_landing ?? true,
                cta_text:          plan.cta_text ?? "Get Started – It's FREE!",
                cta_variant:       plan.cta_variant ?? 'outline',
                features_header:   plan.features_header ?? "What's included:",
                features_subheader:plan.features_subheader ?? '',
                sort_order:        plan.sort_order ?? 0,
                features:          Array.isArray(plan.features) ? plan.features : [],
                period_links:      plan.period_links ?? {},
                variations:        Array.isArray(plan.variations) && plan.variations.length > 0
                    ? plan.variations.map(variationFromServer)
                    : [emptyVariation(true)],
                addon_rules:       Array.isArray(plan.addon_rules)
                    ? plan.addon_rules.map(r => ({ addon_id: r.addon_id, max_units: r.max_units ?? '' }))
                    : [],
              }
            : EMPTY_FORM
    );
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

    function setVariation(index, key, val) {
        setForm(f => ({
            ...f,
            variations: f.variations.map((v, i) => (i === index ? { ...v, [key]: val } : v)),
        }));
    }

    function addVariation() {
        setForm(f => ({ ...f, variations: [...f.variations, emptyVariation(f.variations.length === 0)] }));
    }

    function removeVariation(index) {
        setForm(f => ({ ...f, variations: f.variations.filter((_, i) => i !== index) }));
    }

    function toggleAddon(addonId, enabled) {
        setForm(f => ({
            ...f,
            addon_rules: enabled
                ? [...f.addon_rules, { addon_id: addonId, max_units: '' }]
                : f.addon_rules.filter(r => r.addon_id !== addonId),
        }));
    }

    function setAddonMaxUnits(addonId, val) {
        setForm(f => ({
            ...f,
            addon_rules: f.addon_rules.map(r => (r.addon_id === addonId ? { ...r, max_units: val } : r)),
        }));
    }

    function parseOptInt(v) { const n = parseInt(v); return isNaN(n) ? null : n; }
    function parseOptFloat(v) { const n = parseFloat(v); return isNaN(n) ? null : n; }

    async function handleSave() {
        setSaving(true);
        setError('');
        try {
            const payload = {
                display_name:       form.display_name.trim() || undefined,
                trial_days:         parseOptInt(form.trial_days),
                max_team_seats:     parseOptInt(form.max_team_seats),
                is_active:          form.is_active,
                is_default:         form.is_default,
                features:           form.features.filter(f => f.trim() !== ''),
                subtitle:           form.subtitle.trim() || null,
                is_popular:         form.is_popular,
                cta_text:           form.cta_text.trim() || 'Get Started',
                cta_variant:        form.cta_variant,
                features_header:    form.features_header.trim() || "What's included:",
                features_subheader: form.features_subheader.trim() || null,
                sort_order:         parseOptInt(form.sort_order) ?? 0,
                show_on_landing:    form.show_on_landing,
                period_links:       form.period_links,
                variations: form.variations.map(v => ({
                    id:            v.id || undefined,
                    max_clients:   parseOptInt(v.max_clients),
                    price_monthly: parseOptFloat(v.price_monthly),
                    currency:      v.currency.trim() || 'LE',
                    payment_link:  v.payment_link.trim() || null,
                    is_default:    v.is_default,
                    is_active:     v.is_active,
                })),
                addon_rules: form.addon_rules.map(r => ({
                    addon_id:  r.addon_id,
                    max_units: parseOptInt(r.max_units),
                })),
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
        <AppModal open onClose={onClose} title={isEdit ? 'Edit Plan' : 'New Plan'} wide>
            <div className="flex flex-col gap-4">

                {/* ── Core fields ── */}
                {!isEdit && (
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>Internal name <span className="text-muted-foreground">(e.g. pro)</span></FieldLabel>
                        <TextField variant="secondary" fullWidth aria-label="Internal name" value={form.name} onChange={(val) => set('name', val)}>
                            <Input type="text" placeholder="pro" />
                        </TextField>
                    </div>
                )}

                <div className="flex flex-col gap-1.5">
                    <FieldLabel>Display name</FieldLabel>
                    <TextField variant="secondary" fullWidth aria-label="Display name" value={form.display_name} onChange={(val) => set('display_name', val)}>
                        <Input type="text" placeholder="Pro" />
                    </TextField>
                </div>

                <div className="grid grid-cols-2 gap-3 max-w-md">
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>Trial days <span className="text-muted-foreground">(blank = no trial, shared by all variations)</span></FieldLabel>
                        <TextField variant="secondary" fullWidth aria-label="Trial days" value={form.trial_days} onChange={(val) => set('trial_days', val)}>
                            <Input type="number" min="1" inputMode="numeric" placeholder="—" />
                        </TextField>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>Team seats included <span className="text-muted-foreground">(∞ blank)</span></FieldLabel>
                        <TextField variant="secondary" fullWidth aria-label="Team seats included" value={form.max_team_seats} onChange={(val) => set('max_team_seats', val)}>
                            <Input type="number" min="0" inputMode="numeric" placeholder="∞" />
                        </TextField>
                    </div>
                </div>

                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded" />
                    Active
                </label>

                {/* ── Variations ── */}
                <p className={SECTION_LABEL_CLS}>Variations</p>
                <p className="text-xs text-muted-foreground -mt-2">
                    Every plan needs at least one. Variations differ only by client limit and price — the coach picks
                    one via a dropdown on the pricing card. Team seats (above) and the feature list are shared by all.
                </p>

                <div className="flex flex-col gap-3">
                    {form.variations.map((v, i) => (
                        <div key={v.id ?? `new-${i}`} className="flex flex-col gap-2.5 p-3 rounded-lg border border-border bg-secondary/20">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-semibold text-foreground">{formatVariationLabel(v)}</span>
                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                                        <input type="checkbox" checked={v.is_default} onChange={e => setVariation(i, 'is_default', e.target.checked)} className="rounded" />
                                        Default
                                    </label>
                                    <label className="flex items-center gap-1.5 text-xs text-foreground cursor-pointer">
                                        <input type="checkbox" checked={v.is_active} onChange={e => setVariation(i, 'is_active', e.target.checked)} className="rounded" />
                                        Active
                                    </label>
                                    <button
                                        type="button"
                                        onClick={() => removeVariation(i)}
                                        disabled={form.variations.length <= 1}
                                        className="p-1 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors disabled:opacity-30 disabled:pointer-events-none"
                                        title="Remove variation"
                                    >
                                        <Trash2 size={13} />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                    <FieldLabel>Max clients <span className="text-muted-foreground">(∞ blank)</span></FieldLabel>
                                    <input type="number" min="1" inputMode="numeric" placeholder="∞" className={INPUT_SM_CLS}
                                        value={v.max_clients} onChange={e => setVariation(i, 'max_clients', e.target.value)} />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <FieldLabel>Price / mo <span className="text-muted-foreground">(blank = TBD)</span></FieldLabel>
                                    <input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" className={INPUT_SM_CLS}
                                        value={v.price_monthly} onChange={e => setVariation(i, 'price_monthly', e.target.value)} />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div className="flex flex-col gap-1">
                                    <FieldLabel>Currency</FieldLabel>
                                    <input type="text" placeholder="LE" className={INPUT_SM_CLS}
                                        value={v.currency} onChange={e => setVariation(i, 'currency', e.target.value)} />
                                </div>
                                <div className="flex flex-col gap-1">
                                    <FieldLabel>Fawaterak payment link</FieldLabel>
                                    <input type="url" placeholder="https://app.fawaterak.com/pay/..." className={INPUT_SM_CLS}
                                        value={v.payment_link} onChange={e => setVariation(i, 'payment_link', e.target.value)} />
                                </div>
                            </div>
                        </div>
                    ))}

                    <Button variant="ghost" onClick={addVariation} className="self-start">
                        <Plus size={14} className="mr-1.5" />
                        Add variation
                    </Button>
                </div>

                {addons?.length > 0 && (
                    <>
                        <p className={SECTION_LABEL_CLS}>Add-ons</p>
                        <p className="text-xs text-muted-foreground -mt-2">
                            Which add-ons this plan may buy, and an optional cap on how many units of each
                            (blank = unlimited). An add-on with no cap and enabled here can be bought any number of times.
                        </p>
                        <div className="flex flex-col gap-2">
                            {addons.map(a => {
                                const rule = form.addon_rules.find(r => r.addon_id === a.id);
                                return (
                                    <div key={a.id} className="flex items-center gap-3 px-3 py-2 rounded-lg border border-border bg-secondary/20">
                                        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer flex-1">
                                            <input type="checkbox" checked={!!rule} onChange={e => toggleAddon(a.id, e.target.checked)} className="rounded" />
                                            {a.label} <span className="text-muted-foreground">({a.dimension}, +{a.units})</span>
                                        </label>
                                        {rule && (
                                            <div className="flex items-center gap-1.5">
                                                <FieldLabel>Max units</FieldLabel>
                                                <input type="number" min="1" inputMode="numeric" placeholder="∞" className={`${INPUT_SM_CLS} w-20`}
                                                    value={rule.max_units} onChange={e => setAddonMaxUnits(a.id, e.target.value)} />
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}

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
                    <FieldLabel>Subtitle</FieldLabel>
                    <TextField variant="secondary" fullWidth aria-label="Subtitle" value={form.subtitle} onChange={(val) => set('subtitle', val)}>
                        <Input type="text" placeholder="For solo coaches" />
                    </TextField>
                </div>

                <div className="flex flex-col gap-1.5 max-w-56">
                    <FieldLabel>Sort order</FieldLabel>
                    <TextField variant="secondary" fullWidth aria-label="Sort order" value={form.sort_order} onChange={(val) => set('sort_order', val)}>
                        <Input type="number" min="0" inputMode="numeric" placeholder="0" />
                    </TextField>
                </div>

                <div className="flex flex-col gap-1.5">
                    <FieldLabel>CTA button text</FieldLabel>
                    <TextField variant="secondary" fullWidth aria-label="CTA button text" value={form.cta_text} onChange={(val) => set('cta_text', val)}>
                        <Input type="text" placeholder="Get Started – It's FREE!" />
                    </TextField>
                </div>

                <div className="flex flex-col gap-1.5">
                    <FieldLabel>CTA button style</FieldLabel>
                    <Select variant="secondary" fullWidth aria-label="CTA button style" value={form.cta_variant} onChange={(key) => set('cta_variant', key)}>
                        <Select.Trigger>
                            <Select.Value />
                            <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover>
                            <ListBox>
                                <ListBox.Item id="outline" textValue="Outline">Outline<ListBox.ItemIndicator /></ListBox.Item>
                                <ListBox.Item id="primary" textValue="Primary (filled)">Primary (filled)<ListBox.ItemIndicator /></ListBox.Item>
                                <ListBox.Item id="ghost" textValue="Ghost">Ghost<ListBox.ItemIndicator /></ListBox.Item>
                            </ListBox>
                        </Select.Popover>
                    </Select>
                </div>

                <div className="flex flex-col gap-1.5">
                    <FieldLabel>Features section header</FieldLabel>
                    <TextField variant="secondary" fullWidth aria-label="Features section header" value={form.features_header} onChange={(val) => set('features_header', val)}>
                        <Input type="text" placeholder="What's included:" />
                    </TextField>
                </div>

                <div className="flex flex-col gap-1.5">
                    <FieldLabel>Features sub-header <span className="text-muted-foreground">(optional)</span></FieldLabel>
                    <TextField variant="secondary" fullWidth aria-label="Features sub-header" value={form.features_subheader} onChange={(val) => set('features_subheader', val)}>
                        <Input type="text" placeholder="Team Features" />
                    </TextField>
                </div>

                <div className="flex flex-col gap-1.5">
                    <FieldLabel>Features <span className="text-muted-foreground">(one per line)</span></FieldLabel>
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
                    Show &quot;Most Popular&quot; badge
                </label>

                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input type="checkbox" checked={form.show_on_landing} onChange={e => set('show_on_landing', e.target.checked)} className="rounded" />
                    Show on landing page
                </label>

                {/* ── Payment links per billing period ── */}
                {billingPeriods?.length > 0 && (
                    <>
                        <p className={SECTION_LABEL_CLS}>Payment Links per Billing Period</p>
                        <p className="text-xs text-muted-foreground -mt-2">
                            Each period needs its own Fawaterak link (different billing amount). Leave blank to fall back to each variation&apos;s own payment link above.
                        </p>
                        {billingPeriods.map(d => (
                            <div key={d.period_key} className="flex flex-col gap-1.5">
                                <FieldLabel>
                                    <span className="flex items-center gap-2">
                                        {d.label}
                                        {d.save_label && (
                                            <span className="text-xs text-primary font-semibold">{d.save_label}</span>
                                        )}
                                        <span className="text-muted-foreground font-normal">({d.months} mo)</span>
                                    </span>
                                </FieldLabel>
                                <TextField
                                    variant="secondary"
                                    fullWidth
                                    aria-label={d.label}
                                    value={form.period_links?.[d.period_key] ?? ''}
                                    onChange={(val) => set('period_links', { ...form.period_links, [d.period_key]: val })}
                                >
                                    <Input type="url" placeholder="https://app.fawaterak.com/pay/..." />
                                </TextField>
                            </div>
                        ))}
                    </>
                )}

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

function AddonModal({ addon, onClose, onSaved }) {
    const isEdit = !!addon;
    const [form, setForm] = useState({
        key:           addon?.key ?? '',
        label:         addon?.label ?? '',
        dimension:     addon?.dimension ?? 'clients',
        units:         addon?.units ?? '',
        price_monthly: addon?.price_monthly ?? '',
        currency:      addon?.currency ?? 'LE',
        payment_link:  addon?.payment_link ?? '',
        is_active:     addon?.is_active ?? true,
        sort_order:    addon?.sort_order ?? 0,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

    async function handleSave() {
        setSaving(true);
        setError('');
        try {
            const payload = {
                label:         form.label.trim(),
                dimension:     form.dimension.trim(),
                units:         parseInt(form.units) || 0,
                price_monthly: parseFloat(form.price_monthly) || 0,
                currency:      form.currency.trim() || 'LE',
                payment_link:  form.payment_link.trim() || null,
                is_active:     form.is_active,
                sort_order:    parseInt(form.sort_order) || 0,
            };
            if (isEdit) {
                await api.put(`/api/admin/addons/${addon.id}`, payload);
            } else {
                await api.post('/api/admin/addons', { ...payload, key: form.key.trim() });
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
        <AppModal open onClose={onClose} title={isEdit ? 'Edit Add-on' : 'New Add-on'}>
            <div className="flex flex-col gap-4">
                {!isEdit && (
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>Internal key <span className="text-muted-foreground">(e.g. clients_plus_10)</span></FieldLabel>
                        <TextField variant="secondary" fullWidth aria-label="Internal key" value={form.key} onChange={(val) => set('key', val)}>
                            <Input type="text" placeholder="clients_plus_10" />
                        </TextField>
                    </div>
                )}

                <div className="flex flex-col gap-1.5">
                    <FieldLabel>Label</FieldLabel>
                    <TextField variant="secondary" fullWidth aria-label="Label" value={form.label} onChange={(val) => set('label', val)}>
                        <Input type="text" placeholder="+10 Clients" />
                    </TextField>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>Dimension</FieldLabel>
                        <Select variant="secondary" fullWidth aria-label="Dimension" value={form.dimension} onChange={(key) => set('dimension', key)}>
                            <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    <ListBox.Item id="clients" textValue="Clients">Clients<ListBox.ItemIndicator /></ListBox.Item>
                                    <ListBox.Item id="team_seats" textValue="Team seats">Team seats<ListBox.ItemIndicator /></ListBox.Item>
                                </ListBox>
                            </Select.Popover>
                        </Select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>Units per purchase</FieldLabel>
                        <TextField variant="secondary" fullWidth aria-label="Units per purchase" value={form.units} onChange={(val) => set('units', val)}>
                            <Input type="number" min="1" inputMode="numeric" placeholder="10" />
                        </TextField>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>Price / mo</FieldLabel>
                        <TextField variant="secondary" fullWidth aria-label="Price per month" value={form.price_monthly} onChange={(val) => set('price_monthly', val)}>
                            <Input type="number" min="0" step="0.01" inputMode="decimal" placeholder="0.00" />
                        </TextField>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <FieldLabel>Currency</FieldLabel>
                        <TextField variant="secondary" fullWidth aria-label="Currency" value={form.currency} onChange={(val) => set('currency', val)}>
                            <Input type="text" placeholder="LE" />
                        </TextField>
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <FieldLabel>Fawaterak payment link</FieldLabel>
                    <TextField variant="secondary" fullWidth aria-label="Fawaterak payment link" value={form.payment_link} onChange={(val) => set('payment_link', val)}>
                        <Input type="url" placeholder="https://app.fawaterak.com/pay/..." />
                    </TextField>
                </div>

                <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                    <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded" />
                    Active
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

function DeleteAddonConfirmModal({ addon, onClose, onConfirm, error }) {
    const [deleting, setDeleting] = useState(false);

    async function handleDelete() {
        setDeleting(true);
        await onConfirm(addon);
        setDeleting(false);
    }

    return (
        <AlertDialog isOpen={true} onOpenChange={(o) => !o && onClose()}>
            <AlertDialog.Backdrop>
                <AlertDialog.Container>
                    <AlertDialog.Dialog>
                        <AlertDialog.Header>
                            <AlertDialog.Heading>Delete Add-on</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            <p className="text-sm text-muted-foreground">
                                Are you sure you want to delete <span className="font-semibold text-foreground">{addon.label}</span>? This cannot be undone.
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

    const [addons, setAddons] = useState([]);
    const [addonsLoading, setAddonsLoading] = useState(true);
    const [addonModal, setAddonModal] = useState(null);
    const [deleteAddonTarget, setDeleteAddonTarget] = useState(null);
    const [addonError, setAddonError] = useState('');

    const [trialSettings, setTrialSettings] = useState(null);
    const [trialSaving, setTrialSaving] = useState(false);

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

    function loadAddons() {
        setAddonsLoading(true);
        api.get('/api/admin/addons')
            .then(res => setAddons(res.data))
            .finally(() => setAddonsLoading(false));
    }

    function loadTrialSettings() {
        api.get('/api/admin/trial-settings').then(res => setTrialSettings(res.data));
    }

    function saveTrialSettings(next) {
        setTrialSaving(true);
        api.put('/api/admin/trial-settings', next)
            .then(res => setTrialSettings(res.data))
            .finally(() => setTrialSaving(false));
    }

    async function handleDeleteAddon(addon) {
        setAddonError('');
        try {
            await api.delete(`/api/admin/addons/${addon.id}`);
            setDeleteAddonTarget(null);
            loadAddons();
        } catch (err) {
            setAddonError(err.response?.data?.message || 'Failed to delete add-on');
        }
    }

    useEffect(() => { load(); loadDiscounts(); loadAddons(); loadTrialSettings(); }, []);

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
                <div className="grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto] gap-4 px-4 py-2.5 bg-secondary/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <span>Name</span>
                    <span>Display</span>
                    <span>Variations</span>
                    <span>Price range</span>
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
                    plans.map((p, idx) => {
                        const variations = Array.isArray(p.variations) ? p.variations : [];
                        const prices = variations.map(v => v.price_monthly).filter(v => v != null).map(Number);
                        const currency = variations[0]?.currency ?? '';
                        const priceRange = prices.length === 0
                            ? '—'
                            : Math.min(...prices) === Math.max(...prices)
                                ? `${Math.min(...prices).toLocaleString('en-EG')} ${currency}`.trim()
                                : `${Math.min(...prices).toLocaleString('en-EG')}–${Math.max(...prices).toLocaleString('en-EG')} ${currency}`.trim();
                        return (
                        <div
                            key={p.id}
                            className={`grid grid-cols-[auto_1fr_auto_auto_auto_auto_auto_auto] gap-4 items-center px-4 py-3 ${idx > 0 ? 'border-t border-border' : ''} ${!p.is_active ? 'opacity-50' : ''}`}
                        >
                            <span className="text-sm font-mono text-muted-foreground w-20">{p.name}</span>
                            <span className="text-sm font-medium text-foreground">{p.display_name}</span>
                            <span className="text-sm text-foreground w-20 text-center">{variations.length}</span>
                            <span className="text-sm text-foreground w-32 text-right">{priceRange}</span>
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
                        );
                    })
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

            {/* ── Add-ons ── */}
            <div className="rounded-xl border border-border overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-secondary/50 border-b border-border">
                    <div>
                        <h2 className="text-sm font-semibold text-foreground">Add-ons</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            Purchasable extras (+10 clients, +1 team member, …). Enable per-plan in each plan&apos;s edit modal.
                        </p>
                    </div>
                    <Button variant="ghost" onClick={() => setAddonModal('new')}>
                        <Plus size={14} className="mr-1.5" />
                        New add-on
                    </Button>
                </div>

                <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 px-4 py-2 bg-secondary/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <span>Label</span>
                    <span className="w-24">Dimension</span>
                    <span className="w-14 text-center">Units</span>
                    <span className="w-24 text-right">Price/mo</span>
                    <span className="w-16">Active</span>
                    <span></span>
                </div>

                {addonsLoading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                        <Skeleton key={i} className="h-10 border-t border-border rounded-none" />
                    ))
                ) : addons.length === 0 ? (
                    <div className="py-10 text-center text-sm text-muted-foreground border-t border-border">No add-ons yet.</div>
                ) : (
                    addons.map((a, idx) => (
                        <div key={a.id} className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-3 items-center px-4 py-3 ${idx > 0 ? 'border-t border-border' : ''} ${!a.is_active ? 'opacity-40' : ''}`}>
                            <span className="text-sm font-medium text-foreground">{a.label} <span className="text-xs text-muted-foreground font-mono">({a.key})</span></span>
                            <span className="text-sm text-muted-foreground w-24">{a.dimension}</span>
                            <span className="text-sm text-foreground w-14 text-center">+{a.units}</span>
                            <span className="text-sm text-foreground w-24 text-right">{Number(a.price_monthly).toLocaleString('en-EG')} {a.currency}</span>
                            <span className={`text-xs font-medium w-16 ${a.is_active ? 'text-green-500' : 'text-muted-foreground'}`}>{a.is_active ? 'On' : 'Off'}</span>
                            <div className="flex items-center gap-1">
                                <button onClick={() => setAddonModal(a)}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-default hover:text-foreground transition-colors" title="Edit add-on">
                                    <Pencil size={14} />
                                </button>
                                <button onClick={() => setDeleteAddonTarget(a)}
                                    className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors" title="Delete add-on">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* ── Trial Settings ── */}
            {trialSettings && (
                <div className="rounded-xl border border-border overflow-hidden">
                    <div className="px-4 py-3 bg-secondary/50 border-b border-border">
                        <h2 className="text-sm font-semibold text-foreground">Trial Settings</h2>
                        <p className="text-xs text-muted-foreground mt-0.5">
                            When enabled, every new workspace starts on a OneForce trial and reverts to Free once it expires.
                        </p>
                    </div>
                    <div className="flex items-center gap-6 px-4 py-3">
                        <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                            <input
                                type="checkbox"
                                checked={trialSettings.trial_enabled}
                                onChange={e => saveTrialSettings({ ...trialSettings, trial_enabled: e.target.checked })}
                                className="rounded"
                            />
                            Trial enabled
                        </label>
                        <div className="flex items-center gap-2">
                            <FieldLabel>Trial duration (days)</FieldLabel>
                            <input
                                type="number" min="1" inputMode="numeric"
                                className="w-20 px-2 py-1.5 text-sm text-foreground bg-card border border-border rounded-lg outline-none"
                                value={trialSettings.trial_duration_days}
                                onChange={e => setTrialSettings(s => ({ ...s, trial_duration_days: e.target.value }))}
                                onBlur={e => saveTrialSettings({ ...trialSettings, trial_duration_days: parseInt(e.target.value) || 14 })}
                            />
                        </div>
                        {trialSaving && <span className="text-xs text-muted-foreground">Saving…</span>}
                    </div>
                </div>
            )}

            {modal && (
                <PlanModal
                    plan={modal === 'new' ? null : modal}
                    onClose={() => setModal(null)}
                    onSaved={load}
                    billingPeriods={discounts}
                    addons={addons}
                />
            )}

            {deleteTarget && (
                <DeleteConfirmModal
                    plan={deleteTarget}
                    onClose={() => setDeleteTarget(null)}
                    onDeleted={load}
                />
            )}

            {addonModal && (
                <AddonModal
                    addon={addonModal === 'new' ? null : addonModal}
                    onClose={() => setAddonModal(null)}
                    onSaved={loadAddons}
                />
            )}

            {deleteAddonTarget && (
                <DeleteAddonConfirmModal
                    addon={deleteAddonTarget}
                    error={addonError}
                    onClose={() => { setDeleteAddonTarget(null); setAddonError(''); }}
                    onConfirm={handleDeleteAddon}
                />
            )}
        </div>
    );
}
