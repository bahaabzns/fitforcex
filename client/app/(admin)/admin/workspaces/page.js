'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/axios';
import { Search, ChevronLeft, ChevronRight, ArchiveRestore, Archive } from 'lucide-react';
import { Skeleton } from '@heroui/react/skeleton';
import { Button } from '@heroui/react/button';
import { Chip } from '@heroui/react/chip';
import { Avatar } from '@heroui/react/avatar';
import { Modal } from '@heroui/react/modal';
import { Drawer } from '@heroui/react/drawer';

function useDebounce(value, delay = 350) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

function SubscriptionModal({ workspace, plans, onClose, onSaved }) {
    const [planId, setPlanId] = useState(workspace.plan_id);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function handleSave() {
        setSaving(true);
        setError('');
        try {
            await api.put(`/api/admin/workspaces/${workspace.id}/subscription`, { planId, notes });
            onSaved();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update');
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
                            <Modal.Heading>Override Subscription</Modal.Heading>
                            <Modal.CloseTrigger />
                        </Modal.Header>
                        <Modal.Body className="flex flex-col gap-4">
                            <p className="text-sm text-muted-foreground">{workspace.name}</p>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Plan</label>
                                <select
                                    value={planId}
                                    onChange={e => setPlanId(parseInt(e.target.value))}
                                    className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none"
                                >
                                    {plans.map(p => (
                                        <option key={p.id} value={p.id}>{p.display_name} ({p.name})</option>
                                    ))}
                                </select>
                            </div>

                            <div className="flex flex-col gap-1.5">
                                <label className="text-xs font-medium text-muted-foreground">Notes (optional)</label>
                                <input
                                    type="text"
                                    placeholder="e.g. trial, promo, enterprise deal"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                    className="w-full px-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors"
                                />
                            </div>

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

function WorkspaceDrawer({ workspaceId, plans, onClose, onRefresh }) {
    const [workspace, setWorkspace] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showSubModal, setShowSubModal] = useState(false);
    const [actionLoading, setActionLoading] = useState(false);
    const [actionError, setActionError] = useState('');

    const load = useCallback(() => {
        setLoading(true);
        api.get(`/api/admin/workspaces/${workspaceId}`)
            .then(res => setWorkspace(res.data))
            .finally(() => setLoading(false));
    }, [workspaceId]);

    useEffect(() => { load(); }, [load]);

    async function handleArchive() {
        if (!confirm(`Archive workspace "${workspace.name}"? This hides it from all users.`)) return;
        setActionLoading(true);
        setActionError('');
        try {
            await api.post(`/api/admin/workspaces/${workspaceId}/archive`);
            onRefresh();
            load();
        } catch (err) {
            setActionError(err.response?.data?.message || 'Failed');
        } finally {
            setActionLoading(false);
        }
    }

    async function handleRestore() {
        setActionLoading(true);
        setActionError('');
        try {
            await api.post(`/api/admin/workspaces/${workspaceId}/restore`);
            onRefresh();
            load();
        } catch (err) {
            setActionError(err.response?.data?.message || 'Failed');
        } finally {
            setActionLoading(false);
        }
    }

    return (
        <>
            <Drawer isOpen={true} onOpenChange={(o) => !o && onClose()}>
                <Drawer.Backdrop>
                    <Drawer.Container className="justify-end">
                        <Drawer.Dialog className="w-full max-w-md h-full rounded-none">
                            <Drawer.Header>
                                <Drawer.Heading>Workspace Detail</Drawer.Heading>
                                <Drawer.CloseTrigger />
                            </Drawer.Header>
                            <Drawer.Body className="flex flex-col gap-5">
                                {loading && (
                                    <div className="flex flex-col gap-3">
                                        {[1,2,3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
                                    </div>
                                )}

                                {workspace && (
                                    <>
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="text-base font-semibold text-foreground">{workspace.name}</h3>
                                                {workspace.archived_at && (
                                                    <Chip size="sm" className="bg-orange-100 text-orange-700">Archived</Chip>
                                                )}
                                            </div>
                                            <p className="text-sm text-muted-foreground">/{workspace.slug}</p>
                                            <p className="text-xs text-muted-foreground mt-1">
                                                Created {new Date(workspace.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                                            </p>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div className="rounded-lg border border-border p-3">
                                                <p className="text-xs text-muted-foreground">Owner</p>
                                                <p className="font-medium text-foreground">{workspace.owner_fname} {workspace.owner_lname}</p>
                                                <p className="text-xs text-muted-foreground truncate">{workspace.owner_email}</p>
                                            </div>
                                            <div className="rounded-lg border border-border p-3">
                                                <p className="text-xs text-muted-foreground">Plan</p>
                                                <p className="font-medium text-foreground">{workspace.plan_display}</p>
                                                <p className="text-xs text-muted-foreground">{workspace.subscription_status}</p>
                                            </div>
                                            <div className="rounded-lg border border-border p-3">
                                                <p className="text-xs text-muted-foreground">Members</p>
                                                <p className="font-bold text-foreground text-xl">{workspace.member_count}</p>
                                            </div>
                                            <div className="rounded-lg border border-border p-3">
                                                <p className="text-xs text-muted-foreground">Clients</p>
                                                <p className="font-bold text-foreground text-xl">{workspace.client_count}</p>
                                            </div>
                                        </div>

                                        {workspace.members.length > 0 && (
                                            <div>
                                                <h4 className="text-sm font-semibold text-foreground mb-2">Team Members</h4>
                                                <div className="rounded-xl border border-border overflow-hidden">
                                                    {workspace.members.map((m, idx) => (
                                                        <div key={m.id} className={`flex items-center gap-2 px-3 py-2.5 ${idx < workspace.members.length - 1 ? 'border-b border-border' : ''}`}>
                                                            <Avatar className="w-6 h-6 text-xs shrink-0">
                                                                <Avatar.Fallback>
                                                                    {`${m.fname?.[0] ?? ''}${m.lname?.[0] ?? ''}`.toUpperCase() || '?'}
                                                                </Avatar.Fallback>
                                                            </Avatar>
                                                            <div className="flex-1 min-w-0">
                                                                <p className="text-sm font-medium text-foreground truncate">{m.fname} {m.lname}</p>
                                                                <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                                                            </div>
                                                            <Chip size="sm" className="bg-secondary text-muted-foreground">{m.role}</Chip>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {actionError && <p className="text-sm text-red-500">{actionError}</p>}

                                        <div className="flex flex-col gap-2 pt-2 border-t border-border">
                                            <Button variant="outline" className="w-full" onClick={() => setShowSubModal(true)}>
                                                Override Subscription Plan
                                            </Button>
                                            {workspace.archived_at ? (
                                                <Button variant="outline" className="w-full" isDisabled={actionLoading} onClick={handleRestore}>
                                                    <ArchiveRestore size={14} className="mr-1.5" />
                                                    Restore Workspace
                                                </Button>
                                            ) : (
                                                <Button variant="outline" className="w-full text-orange-600 border-orange-200 hover:bg-orange-50" isDisabled={actionLoading} onClick={handleArchive}>
                                                    <Archive size={14} className="mr-1.5" />
                                                    Force Archive
                                                </Button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </Drawer.Body>
                        </Drawer.Dialog>
                    </Drawer.Container>
                </Drawer.Backdrop>
            </Drawer>

            {showSubModal && workspace && (
                <SubscriptionModal
                    workspace={workspace}
                    plans={plans}
                    onClose={() => setShowSubModal(false)}
                    onSaved={() => { onRefresh(); load(); }}
                />
            )}
        </>
    );
}

export default function AdminWorkspacesPage() {
    const [workspaces, setWorkspaces] = useState([]);
    const [total, setTotal] = useState(0);
    const [plans, setPlans] = useState([]);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [planFilter, setPlanFilter] = useState('');
    const [showArchived, setShowArchived] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedId, setSelectedId] = useState(null);

    const debouncedSearch = useDebounce(search);
    const limit = 20;
    const totalPages = Math.ceil(total / limit);

    const fetchWorkspaces = useCallback(() => {
        setLoading(true);
        api.get('/api/admin/workspaces', { params: { search: debouncedSearch, plan: planFilter, archived: showArchived, page, limit } })
            .then(res => { setWorkspaces(res.data.workspaces); setTotal(res.data.total); })
            .catch(() => setError('Failed to load workspaces'))
            .finally(() => setLoading(false));
    }, [debouncedSearch, planFilter, showArchived, page]);

    useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);
    useEffect(() => { api.get('/api/admin/plans').then(res => setPlans(res.data)); }, []);
    useEffect(() => { setPage(1); }, [debouncedSearch, planFilter, showArchived]);

    return (
        <div className="p-8 flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Workspaces</h1>
                <p className="text-sm text-muted-foreground mt-1">{total} total</p>
            </div>

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative max-w-sm w-full">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        className="w-full pl-8 pr-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors"
                        placeholder="Search by name or slug…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select
                    value={planFilter}
                    onChange={e => setPlanFilter(e.target.value)}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none"
                >
                    <option value="">All plans</option>
                    {plans.map(p => <option key={p.id} value={p.name}>{p.display_name}</option>)}
                </select>
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer select-none">
                    <input type="checkbox" checked={showArchived} onChange={e => setShowArchived(e.target.checked)} className="rounded" />
                    Show archived
                </label>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {/* Table */}
            <div className="rounded-xl border border-border overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-4 px-4 py-2.5 bg-secondary/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <span>Workspace</span>
                    <span>Owner</span>
                    <span>Plan</span>
                    <span className="text-center">Members</span>
                    <span className="text-center">Clients</span>
                    <span>Created</span>
                </div>

                {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 border-t border-border rounded-none" />
                    ))
                ) : workspaces.length === 0 ? (
                    <div className="py-14 text-center text-sm text-muted-foreground border-t border-border">No workspaces found.</div>
                ) : (
                    workspaces.map((w, idx) => (
                        <button
                            key={w.id}
                            onClick={() => setSelectedId(w.id)}
                            className={`w-full grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-4 items-center px-4 py-3 text-left hover:bg-accent/40 transition-colors ${idx > 0 ? 'border-t border-border' : ''}`}
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <span className="text-sm font-medium text-foreground truncate">{w.name}</span>
                                {w.archived_at && (
                                    <Chip size="sm" className="bg-orange-100 text-orange-700 shrink-0">archived</Chip>
                                )}
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm text-foreground truncate">{w.owner_fname} {w.owner_lname}</p>
                                <p className="text-xs text-muted-foreground truncate">{w.owner_email}</p>
                            </div>
                            <Chip size="sm" className="bg-primary/10 text-primary">{w.plan_display}</Chip>
                            <span className="text-sm text-foreground text-center w-16">{w.member_count}</span>
                            <span className="text-sm text-foreground text-center w-16">{w.client_count}</span>
                            <span className="text-xs text-muted-foreground shrink-0">
                                {new Date(w.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                            </span>
                        </button>
                    ))
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">Page {page} of {totalPages}</p>
                    <div className="flex gap-2">
                        <Button isIconOnly variant="outline" size="sm" isDisabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                            <ChevronLeft size={15} />
                        </Button>
                        <Button isIconOnly variant="outline" size="sm" isDisabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                            <ChevronRight size={15} />
                        </Button>
                    </div>
                </div>
            )}

            {selectedId && (
                <WorkspaceDrawer
                    workspaceId={selectedId}
                    plans={plans}
                    onClose={() => setSelectedId(null)}
                    onRefresh={fetchWorkspaces}
                />
            )}
        </div>
    );
}
