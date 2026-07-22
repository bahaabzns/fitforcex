'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/axios';
import { Plus, Users, Star } from 'lucide-react';
import { Skeleton } from '@heroui/react/skeleton';
import { Button } from '@heroui/react/button';
import { Chip } from '@heroui/react/chip';

const STATUSES = ['proposed', 'planned', 'in_progress', 'shipped', 'declined'];
const STATUS_STYLE = {
    proposed:    'bg-secondary text-muted-foreground',
    planned:     'bg-blue-500/15 text-blue-600',
    in_progress: 'bg-amber-500/15 text-amber-600',
    shipped:     'bg-primary/10 text-primary',
    declined:    'bg-red-500/15 text-red-600',
};

function RoadmapRow({ item, onChanged }) {
    const [status, setStatus] = useState(item.status);
    const [releaseTag, setReleaseTag] = useState(item.release_tag ?? '');
    const [note, setNote] = useState('');
    const [saving, setSaving] = useState(false);
    const [expanded, setExpanded] = useState(false);

    async function handleSave() {
        setSaving(true);
        try {
            await api.patch(`/api/admin/roadmap/${item.id}`, {
                status,
                releaseTag: releaseTag.trim() || undefined,
                note: note.trim() || undefined,
            });
            setExpanded(false);
            onChanged();
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="border-t border-border first:border-t-0">
            <button onClick={() => setExpanded(v => !v)} className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-default/40 transition-colors cursor-pointer">
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{item.title}</p>
                </div>
                <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0" title="Insights linked">
                    <Users size={12} /> {item.insight_count}
                </span>
                {item.avg_rating != null && (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground shrink-0" title="Average rating">
                        <Star size={12} /> {item.avg_rating.toFixed(1)}
                    </span>
                )}
                <Chip size="sm" className={`${STATUS_STYLE[item.status]} shrink-0`}>{item.status.replace('_', ' ')}</Chip>
            </button>

            {expanded && (
                <div className="px-4 pb-4 flex flex-col gap-3">
                    <div className="flex flex-wrap gap-1.5">
                        {STATUSES.map(s => (
                            <button key={s} onClick={() => setStatus(s)} className="cursor-pointer">
                                <Chip size="sm" variant={status === s ? 'primary' : 'soft'}>{s.replace('_', ' ')}</Chip>
                            </button>
                        ))}
                    </div>
                    {status === 'shipped' && (
                        <input
                            className="px-3 py-2 text-sm bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground"
                            placeholder="Release tag, e.g. v1.42"
                            value={releaseTag}
                            onChange={e => setReleaseTag(e.target.value)}
                        />
                    )}
                    {(status === 'shipped' || status === 'declined') && status !== item.status && (
                        <input
                            className="px-3 py-2 text-sm bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground"
                            placeholder={status === 'declined' ? 'Why? (shown to everyone who asked for this)' : 'Note (optional)'}
                            value={note}
                            onChange={e => setNote(e.target.value)}
                        />
                    )}
                    {status !== item.status && (status === 'shipped' || status === 'declined') && (
                        <p className="text-xs text-muted-foreground">
                            Every coach/client with an insight linked to this item will be notified.
                        </p>
                    )}
                    <div className="flex justify-end">
                        <Button size="sm" variant="primary" isDisabled={saving} onClick={handleSave}>{saving ? 'Saving…' : 'Save'}</Button>
                    </div>
                </div>
            )}
        </div>
    );
}

function NewRoadmapItemForm({ onClose, onCreated }) {
    const [title, setTitle] = useState('');
    const [saving, setSaving] = useState(false);

    async function handleCreate() {
        if (!title.trim()) return;
        setSaving(true);
        try {
            await api.post('/api/admin/roadmap', { title: title.trim() });
            onCreated();
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
            <input
                className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-lg outline-none placeholder:text-muted-foreground"
                placeholder="Roadmap item title"
                value={title}
                onChange={e => setTitle(e.target.value)}
            />
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button variant="primary" isDisabled={saving || !title.trim()} onClick={handleCreate}>{saving ? 'Creating…' : 'Create'}</Button>
        </div>
    );
}

export default function AdminRoadmapPage() {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);

    const fetchItems = useCallback(() => {
        setLoading(true);
        api.get('/api/admin/roadmap').then(res => setItems(res.data)).finally(() => setLoading(false));
    }, []);

    useEffect(() => { fetchItems(); }, [fetchItems]);

    return (
        <div className="p-8 flex flex-col gap-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Roadmap</h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Linked-insight count is a free prioritization signal — no separate voting mechanism needed.
                    </p>
                </div>
                <Button variant="primary" onClick={() => setShowForm(v => !v)}>
                    <Plus size={15} /> New item
                </Button>
            </div>

            {showForm && <NewRoadmapItemForm onClose={() => setShowForm(false)} onCreated={() => { setShowForm(false); fetchItems(); }} />}

            <div className="rounded-xl border border-border overflow-hidden">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className={`h-12 rounded-none ${i > 0 ? 'border-t border-border' : ''}`} />)
                ) : items.length === 0 ? (
                    <div className="py-14 text-center text-sm text-muted-foreground">No roadmap items yet.</div>
                ) : (
                    items.map(item => <RoadmapRow key={item.id} item={item} onChanged={fetchItems} />)
                )}
            </div>
        </div>
    );
}
