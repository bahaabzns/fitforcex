'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/axios';
import { useDateFormatter } from '@/utils/useDateFormatter';
import { Bug, Lightbulb, Star, MessageCircleQuestion } from 'lucide-react';
import { Skeleton } from '@heroui/react/skeleton';
import { Button } from '@heroui/react/button';
import { Chip } from '@heroui/react/chip';
import { TextArea } from '@heroui/react/textarea';

const SOURCE_META = {
    bug:             { label: 'Bug', icon: Bug,               className: 'bg-red-500/15 text-red-600' },
    feature_request: { label: 'Feature request', icon: Lightbulb, className: 'bg-amber-500/15 text-amber-600' },
    rating:          { label: 'Rating', icon: Star,           className: 'bg-primary/10 text-primary' },
    prompt_response: { label: 'Prompt response', icon: MessageCircleQuestion, className: 'bg-secondary text-muted-foreground' },
};

const STATUS_FILTERS = [
    { value: '',         label: 'All' },
    { value: 'new',      label: 'New' },
    { value: 'triaged',  label: 'Triaged' },
    { value: 'resolved', label: 'Resolved' },
];

function TriageDrawer({ insight, onClose, onSaved }) {
    const [roadmapItems, setRoadmapItems] = useState([]);
    const [status, setStatus] = useState(insight.status);
    const [roadmapItemId, setRoadmapItemId] = useState(insight.roadmap_item_id ?? '');
    const [newRoadmapItemTitle, setNewRoadmapItemTitle] = useState('');
    const [note, setNote] = useState(insight.resolution_note ?? '');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        api.get('/api/admin/roadmap').then(res => setRoadmapItems(res.data)).catch(() => {});
    }, []);

    async function handleSave() {
        setSaving(true);
        try {
            await api.patch(`/api/admin/insights/${insight.id}`, {
                status,
                roadmapItemId: roadmapItemId || undefined,
                newRoadmapItemTitle: !roadmapItemId && newRoadmapItemTitle.trim() ? newRoadmapItemTitle.trim() : undefined,
                note: note.trim() || undefined,
            });
            onSaved();
        } finally {
            setSaving(false);
        }
    }

    const meta = SOURCE_META[insight.source_type] ?? SOURCE_META.prompt_response;

    return (
        <div className="fixed inset-0 z-50 flex justify-end">
            <div className="absolute inset-0 bg-black/50" onClick={onClose} />
            <div className="relative w-full max-w-md h-full bg-background border-l border-border flex flex-col shadow-xl">
                <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
                    <p className="text-sm font-semibold text-foreground">Triage insight</p>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors text-lg leading-none">✕</button>
                </div>

                <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-5">
                    <div>
                        <Chip size="sm" className={meta.className}>{meta.label}</Chip>
                        {insight.rating_value != null && (
                            <p className="text-2xl font-bold text-foreground mt-2">{insight.rating_value}<span className="text-sm text-muted-foreground">/10</span></p>
                        )}
                        {insight.text_value && <p className="text-sm text-foreground mt-2 whitespace-pre-wrap">{insight.text_value}</p>}
                        {insight.selected_option && <p className="text-sm text-foreground mt-2">{insight.selected_option}</p>}
                        {insight.screenshot_url && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={insight.screenshot_url} alt="" className="mt-2 max-h-48 rounded-lg border border-border" />
                        )}
                        {insight.module && <p className="text-xs text-muted-foreground mt-2">Module: {insight.module}</p>}
                    </div>

                    <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Status</p>
                        <div className="flex gap-1.5">
                            {['new', 'triaged', 'resolved'].map(s => (
                                <button key={s} onClick={() => setStatus(s)} className="cursor-pointer">
                                    <Chip size="sm" variant={status === s ? 'primary' : 'soft'}>{s}</Chip>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Roadmap item</p>
                        <select
                            className="w-full px-3 py-2 text-sm bg-card border border-border rounded-lg outline-none"
                            value={roadmapItemId}
                            onChange={e => setRoadmapItemId(e.target.value)}
                        >
                            <option value="">— none —</option>
                            {roadmapItems.map(r => (
                                <option key={r.id} value={r.id}>{r.title} ({r.status})</option>
                            ))}
                        </select>
                        {!roadmapItemId && (
                            <input
                                className="w-full mt-2 px-3 py-2 text-sm bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground"
                                placeholder="…or create a new roadmap item on the spot"
                                value={newRoadmapItemTitle}
                                onChange={e => setNewRoadmapItemTitle(e.target.value)}
                            />
                        )}
                    </div>

                    <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Note</p>
                        <TextArea value={note} onChange={e => setNote(e.target.value)} rows={3} />
                    </div>
                </div>

                <div className="flex justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
                    <Button variant="ghost" onClick={onClose}>Cancel</Button>
                    <Button variant="primary" isDisabled={saving} onClick={handleSave}>{saving ? 'Saving…' : 'Save'}</Button>
                </div>
            </div>
        </div>
    );
}

export default function AdminInsightsPage() {
    const { formatDate } = useDateFormatter();
    const [insights, setInsights] = useState([]);
    const [statusFilter, setStatusFilter] = useState('');
    const [loading, setLoading] = useState(true);
    const [selected, setSelected] = useState(null);

    const fetchInsights = useCallback(() => {
        setLoading(true);
        api.get('/api/admin/insights', { params: statusFilter ? { status: statusFilter } : {} })
            .then(res => setInsights(res.data))
            .finally(() => setLoading(false));
    }, [statusFilter]);

    useEffect(() => { fetchInsights(); }, [fetchInsights]);

    return (
        <div className="p-8 flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Insights</h1>
                <p className="text-sm text-muted-foreground mt-1">Every bug report, feature request, rating, and prompt response — one inbox.</p>
            </div>

            <div className="flex gap-1.5">
                {STATUS_FILTERS.map(f => (
                    <button key={f.value} onClick={() => setStatusFilter(f.value)} className="cursor-pointer">
                        <Chip size="sm" variant={statusFilter === f.value ? 'primary' : 'soft'}>{f.label}</Chip>
                    </button>
                ))}
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
                <div className="grid grid-cols-[auto_1fr_auto_auto] gap-4 px-4 py-2.5 bg-secondary/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <span>Type</span>
                    <span>Content</span>
                    <span>Status</span>
                    <span>Submitted</span>
                </div>

                {loading ? (
                    Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14 border-t border-border rounded-none" />)
                ) : insights.length === 0 ? (
                    <div className="py-14 text-center text-sm text-muted-foreground border-t border-border">No insights match this filter.</div>
                ) : (
                    insights.map((insight, idx) => {
                        const meta = SOURCE_META[insight.source_type] ?? SOURCE_META.prompt_response;
                        const Icon = meta.icon;
                        return (
                            <button
                                key={insight.id}
                                onClick={() => setSelected(insight)}
                                className={`w-full grid grid-cols-[auto_1fr_auto_auto] gap-4 items-center px-4 py-3 text-left hover:bg-default/40 transition-colors ${idx > 0 ? 'border-t border-border' : ''}`}
                            >
                                <Chip size="sm" className={`${meta.className} shrink-0 inline-flex items-center gap-1`}>
                                    <Icon size={12} />
                                    {meta.label}
                                </Chip>
                                <span className="text-sm text-foreground truncate">
                                    {insight.text_value || insight.selected_option || (insight.rating_value != null ? `Rating: ${insight.rating_value}/10` : '—')}
                                </span>
                                <Chip size="sm" variant="soft" className="shrink-0">{insight.status}</Chip>
                                <span className="text-xs text-muted-foreground shrink-0">{formatDate(insight.created_at)}</span>
                            </button>
                        );
                    })
                )}
            </div>

            {selected && (
                <TriageDrawer
                    insight={selected}
                    onClose={() => setSelected(null)}
                    onSaved={() => { setSelected(null); fetchInsights(); }}
                />
            )}
        </div>
    );
}
