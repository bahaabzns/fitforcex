'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/axios';
import { Search, Plus, Pencil, Trash2, Upload, ChevronLeft, ChevronRight, Dumbbell, Apple } from 'lucide-react';
import { Skeleton } from '@heroui/react/skeleton';
import { Button } from '@heroui/react/button';
import { AlertDialog } from '@heroui/react/alert-dialog';
import AppModal, { ModalFooter } from '@/app/components/Modal';
import { FieldLabel, FieldErrorText } from '@/app/components/Field';

const INPUT_CLS = 'w-full px-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors';

// Field/column config per resource. Mirrors the server's RESOURCES registry so the
// admin UI is fully data-driven — one component manages all five libraries.
const RESOURCES = [
    {
        key: 'exercises', label: 'Exercises', group: 'Training', icon: Dumbbell,
        fields: [
            { name: 'name_en', label: 'Name (English)', required: true },
            { name: 'name_ar', label: 'Name (Arabic)' },
            { name: 'muscle_group', label: 'Muscle Group' },
            { name: 'equipment', label: 'Equipment' },
            { name: 'youtube_url', label: 'YouTube URL' },
            { name: 'thumbnail_path', label: 'Thumbnail (GIF URL)' },
            { name: 'instructions_en', label: 'Instructions (English)', textarea: true },
            { name: 'instructions_ar', label: 'Instructions (Arabic)', textarea: true },
        ],
        columns: [
            { name: 'name_en', label: 'Name' },
            { name: 'muscle_group', label: 'Muscle Group' },
            { name: 'equipment', label: 'Equipment' },
        ],
    },
    {
        key: 'muscle-groups', label: 'Muscle Groups', group: 'Training', icon: Dumbbell,
        fields: [
            { name: 'name_en', label: 'Name (English)', required: true },
            { name: 'name_ar', label: 'Name (Arabic)' },
        ],
        columns: [{ name: 'name_en', label: 'Name' }, { name: 'name_ar', label: 'Arabic' }],
    },
    {
        key: 'equipment', label: 'Equipment', group: 'Training', icon: Dumbbell,
        fields: [
            { name: 'name_en', label: 'Name (English)', required: true },
            { name: 'name_ar', label: 'Name (Arabic)' },
        ],
        columns: [{ name: 'name_en', label: 'Name' }, { name: 'name_ar', label: 'Arabic' }],
    },
    {
        key: 'food-items', label: 'Food Items', group: 'Nutrition', icon: Apple,
        fields: [
            { name: 'name_en', label: 'Name (English)', required: true },
            { name: 'name_ar', label: 'Name (Arabic)' },
            { name: 'food_category', label: 'Category' },
            { name: 'serving_size', label: 'Serving Size', number: true },
            { name: 'serving_unit', label: 'Serving Unit' },
            { name: 'calories_per_serving', label: 'Calories', number: true },
            { name: 'protein_per_serving', label: 'Protein (g)', number: true },
            { name: 'carbs_per_serving', label: 'Carbs (g)', number: true },
            { name: 'fats_per_serving', label: 'Fats (g)', number: true },
        ],
        columns: [
            { name: 'name_en', label: 'Name' },
            { name: 'food_category', label: 'Category' },
            { name: 'calories_per_serving', label: 'Calories' },
        ],
    },
    {
        key: 'food-categories', label: 'Food Categories', group: 'Nutrition', icon: Apple,
        fields: [
            { name: 'name_en', label: 'Name (English)', required: true },
            { name: 'name_ar', label: 'Name (Arabic)' },
        ],
        columns: [{ name: 'name_en', label: 'Name' }, { name: 'name_ar', label: 'Arabic' }],
    },
];

function useDebounce(value, delay = 350) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

function RecordModal({ resource, record, onClose, onSaved }) {
    const isEdit = !!record;
    const [form, setForm] = useState(() => {
        const init = {};
        resource.fields.forEach((f) => { init[f.name] = record?.[f.name] ?? ''; });
        return init;
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    function set(key, val) { setForm((f) => ({ ...f, [key]: val })); }

    async function handleSave() {
        setSaving(true);
        setError('');
        try {
            const payload = {};
            resource.fields.forEach((f) => {
                const raw = form[f.name];
                payload[f.name] = f.number ? (raw === '' ? null : Number(raw)) : (typeof raw === 'string' ? raw.trim() : raw);
            });
            if (isEdit) await api.put(`/api/admin/libraries/${resource.key}/${record.id}`, payload);
            else await api.post(`/api/admin/libraries/${resource.key}`, payload);
            onSaved();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save');
            setSaving(false);
        }
    }

    return (
        <AppModal open onClose={onClose} title={`${isEdit ? 'Edit' : 'New'} ${resource.label.replace(/s$/, '')}`}>
            <div className="flex flex-col gap-4">
                {resource.fields.map((f) => (
                    <div key={f.name} className="flex flex-col gap-1.5">
                        <FieldLabel>
                            {f.label}{f.required && <span className="text-red-500"> *</span>}
                        </FieldLabel>
                        {f.textarea ? (
                            <textarea rows={3} value={form[f.name]} onChange={(e) => set(f.name, e.target.value)} className={`${INPUT_CLS} resize-y`} />
                        ) : (
                            <input
                                type={f.number ? 'number' : 'text'}
                                inputMode={f.number ? 'decimal' : undefined}
                                value={form[f.name]}
                                onChange={(e) => set(f.name, e.target.value)}
                                className={INPUT_CLS}
                            />
                        )}
                    </div>
                ))}
                <FieldErrorText msg={error} />
                <ModalFooter>
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" isDisabled={saving} onClick={handleSave}>{saving ? 'Saving…' : 'Save'}</Button>
                </ModalFooter>
            </div>
        </AppModal>
    );
}

function ImportModal({ resource, onClose, onImported }) {
    const [text, setText] = useState('');
    const [importing, setImporting] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null);

    function parseInput(raw) {
        const trimmed = raw.trim();
        if (!trimmed) return [];
        // JSON array of objects, or CSV with a header row.
        if (trimmed.startsWith('[')) return JSON.parse(trimmed);
        const [headerLine, ...lines] = trimmed.split(/\r?\n/);
        const headers = headerLine.split(',').map((h) => h.trim());
        return lines.filter(Boolean).map((line) => {
            const cells = line.split(',');
            const row = {};
            headers.forEach((h, i) => { row[h] = (cells[i] ?? '').trim(); });
            return row;
        });
    }

    async function handleFile(e) {
        const file = e.target.files?.[0];
        if (file) setText(await file.text());
    }

    async function handleImport() {
        setImporting(true);
        setError('');
        setResult(null);
        try {
            const records = parseInput(text);
            if (!Array.isArray(records) || records.length === 0) throw new Error('No records found to import');
            const res = await api.post(`/api/admin/libraries/${resource.key}/import`, { records });
            setResult(res.data);
            onImported();
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Import failed');
        } finally {
            setImporting(false);
        }
    }

    return (
        <AppModal open onClose={onClose} title={`Import ${resource.label}`} wide>
            <div className="flex flex-col gap-4">
                <p className="text-sm text-muted-foreground">
                    Paste a JSON array of objects, or CSV with a header row. Columns:{' '}
                    <span className="font-mono text-foreground">{resource.fields.map((f) => f.name).join(', ')}</span>
                </p>
                <input type="file" accept=".json,.csv,text/csv,application/json" onChange={handleFile} className="text-sm text-muted-foreground" />
                <textarea
                    rows={10}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder={'[{ "name_en": "Push-up" }]\n\nor\n\nname_en,name_ar\nPush-up,ضغط'}
                    className={`${INPUT_CLS} resize-y font-mono text-xs`}
                />
                {result && (
                    <div className="text-sm rounded-lg bg-secondary/40 border border-border p-3">
                        <p className="text-foreground font-medium">Imported {result.imported}, skipped {result.skipped}.</p>
                        {result.errors?.length > 0 && (
                            <p className="text-orange-600 mt-1">{result.errors.length} row(s) had errors (e.g. row {result.errors[0].index}: {result.errors[0].message}).</p>
                        )}
                    </div>
                )}
                <FieldErrorText msg={error} />
                <ModalFooter>
                    <Button variant="ghost" onClick={onClose}>{result ? 'Close' : 'Cancel'}</Button>
                    <Button variant="primary" isDisabled={importing || !text.trim()} onClick={handleImport}>
                        {importing ? 'Importing…' : 'Import'}
                    </Button>
                </ModalFooter>
            </div>
        </AppModal>
    );
}

function DeleteModal({ resource, record, onClose, onDeleted }) {
    const [deleting, setDeleting] = useState(false);
    const [error, setError] = useState('');

    async function handleDelete() {
        setDeleting(true);
        setError('');
        try {
            await api.delete(`/api/admin/libraries/${resource.key}/${record.id}`);
            onDeleted();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete');
            setDeleting(false);
        }
    }

    return (
        <AlertDialog isOpen onOpenChange={(o) => !o && onClose()}>
            <AlertDialog.Backdrop>
                <AlertDialog.Container>
                    <AlertDialog.Dialog>
                        <AlertDialog.Header>
                            <AlertDialog.Heading>Delete record</AlertDialog.Heading>
                        </AlertDialog.Header>
                        <AlertDialog.Body>
                            <p className="text-sm text-muted-foreground">
                                Delete <span className="font-semibold text-foreground">{record.name_en}</span>? This only affects the global master library, not existing coach workspaces.
                            </p>
                            {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
                        </AlertDialog.Body>
                        <AlertDialog.Footer>
                            <Button variant="ghost" isDisabled={deleting} onClick={onClose}>Cancel</Button>
                            <Button isDisabled={deleting} onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                                {deleting ? 'Deleting…' : 'Delete'}
                            </Button>
                        </AlertDialog.Footer>
                    </AlertDialog.Dialog>
                </AlertDialog.Container>
            </AlertDialog.Backdrop>
        </AlertDialog>
    );
}

function formatCell(value) {
    if (value == null || value === '') return '—';
    return String(value);
}

export default function AdminLibrariesPage() {
    const [activeKey, setActiveKey] = useState(RESOURCES[0].key);
    const resource = RESOURCES.find((r) => r.key === activeKey);

    const [records, setRecords] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const [editTarget, setEditTarget] = useState(null);   // record | 'new' | null
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [importing, setImporting] = useState(false);

    const debouncedSearch = useDebounce(search);
    const limit = 20;
    const totalPages = Math.ceil(total / limit) || 1;

    const fetchRecords = useCallback(() => {
        setLoading(true);
        api.get(`/api/admin/libraries/${activeKey}`, { params: { search: debouncedSearch, limit, offset: (page - 1) * limit } })
            .then((res) => { setRecords(res.data.records); setTotal(res.data.total); })
            .catch(() => setError('Failed to load records'))
            .finally(() => setLoading(false));
    }, [activeKey, debouncedSearch, page]);

    useEffect(() => { fetchRecords(); }, [fetchRecords]);
    useEffect(() => { setPage(1); }, [debouncedSearch, activeKey]);
    useEffect(() => { setSearch(''); }, [activeKey]);

    // Built at runtime, so use an inline style (Tailwind JIT can't see dynamic classes).
    const gridStyle = { gridTemplateColumns: `${resource.columns.map(() => '1fr').join(' ')} auto` };

    return (
        <div className="p-8 flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Default Libraries</h1>
                <p className="text-sm text-muted-foreground mt-1">
                    The global master database cloned into every new coach workspace.
                </p>
            </div>

            {/* Resource tabs */}
            <div className="flex flex-wrap gap-2">
                {RESOURCES.map((r) => {
                    const Icon = r.icon;
                    const active = r.key === activeKey;
                    return (
                        <button
                            key={r.key}
                            onClick={() => setActiveKey(r.key)}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors border ${
                                active ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-muted-foreground border-border hover:text-foreground hover:border-primary/40'
                            }`}
                        >
                            <Icon size={14} />
                            {r.label}
                        </button>
                    );
                })}
            </div>

            {/* Toolbar */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="relative max-w-sm flex-1 min-w-50">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        className="w-full pl-8 pr-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors"
                        placeholder={`Search ${resource.label.toLowerCase()}…`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" onClick={() => setImporting(true)}>
                        <Upload size={15} className="mr-1.5" /> Import
                    </Button>
                    <Button variant="primary" onClick={() => setEditTarget('new')}>
                        <Plus size={15} className="mr-1.5" /> New
                    </Button>
                </div>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {/* Table */}
            <div className="rounded-xl border border-border overflow-hidden">
                <div style={gridStyle} className="grid gap-4 px-4 py-2.5 bg-secondary/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {resource.columns.map((c) => <span key={c.name}>{c.label}</span>)}
                    <span className="w-16 text-right">Actions</span>
                </div>

                {loading ? (
                    Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-12 border-t border-border rounded-none" />)
                ) : records.length === 0 ? (
                    <div className="py-14 text-center text-sm text-muted-foreground border-t border-border">
                        No {resource.label.toLowerCase()} found.
                    </div>
                ) : (
                    records.map((rec, idx) => (
                        <div key={rec.id} style={gridStyle} className={`grid gap-4 items-center px-4 py-3 ${idx > 0 ? 'border-t border-border' : ''}`}>
                            {resource.columns.map((c, ci) => (
                                <span key={c.name} className={`text-sm truncate ${ci === 0 ? 'font-medium text-foreground' : 'text-muted-foreground'}`}>
                                    {formatCell(rec[c.name])}
                                </span>
                            ))}
                            <div className="w-16 flex items-center justify-end gap-1">
                                <button onClick={() => setEditTarget(rec)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-default hover:text-foreground transition-colors" title="Edit">
                                    <Pencil size={14} />
                                </button>
                                <button onClick={() => setDeleteTarget(rec)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-red-500/10 hover:text-red-500 transition-colors" title="Delete">
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{total} total · page {page} of {totalPages}</p>
                    <div className="flex gap-2">
                        <Button isIconOnly variant="outline" size="sm" isDisabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                            <ChevronLeft size={15} />
                        </Button>
                        <Button isIconOnly variant="outline" size="sm" isDisabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                            <ChevronRight size={15} />
                        </Button>
                    </div>
                </div>
            )}

            {editTarget && (
                <RecordModal
                    resource={resource}
                    record={editTarget === 'new' ? null : editTarget}
                    onClose={() => setEditTarget(null)}
                    onSaved={fetchRecords}
                />
            )}
            {importing && (
                <ImportModal resource={resource} onClose={() => setImporting(false)} onImported={fetchRecords} />
            )}
            {deleteTarget && (
                <DeleteModal resource={resource} record={deleteTarget} onClose={() => setDeleteTarget(null)} onDeleted={fetchRecords} />
            )}
        </div>
    );
}
