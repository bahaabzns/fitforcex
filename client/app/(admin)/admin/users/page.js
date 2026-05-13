'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/axios';
import { Search, ChevronLeft, ChevronRight, Building2, Users } from 'lucide-react';
import { Input } from '@/components/ui/input';

function useDebounce(value, delay = 350) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const t = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(t);
    }, [value, delay]);
    return debounced;
}

function UserDrawer({ userId, onClose }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setLoading(true);
        api.get(`/api/admin/users/${userId}`)
            .then(res => setUser(res.data))
            .finally(() => setLoading(false));
    }, [userId]);

    return (
        <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
            <div className="absolute inset-0 bg-black/40" />
            <div
                className="relative w-full max-w-md bg-card border-l border-border h-full overflow-y-auto p-6 flex flex-col gap-6 shadow-2xl"
                onClick={e => e.stopPropagation()}
            >
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-foreground">User Detail</h2>
                    <button onClick={onClose} className="text-muted-foreground hover:text-foreground text-xl leading-none">×</button>
                </div>

                {loading && <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-10 rounded-lg bg-secondary animate-pulse" />)}</div>}

                {user && (
                    <>
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-full bg-primary/10 text-primary font-bold text-base flex items-center justify-center">
                                {`${user.fname?.[0] ?? ''}${user.lname?.[0] ?? ''}`.toUpperCase() || '?'}
                            </div>
                            <div>
                                <p className="font-semibold text-foreground">{user.fname} {user.lname}</p>
                                <p className="text-sm text-muted-foreground">{user.email}</p>
                                {user.is_admin && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">Admin</span>}
                            </div>
                        </div>

                        <div className="text-xs text-muted-foreground">
                            Joined {new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                        </div>

                        <div>
                            <h3 className="text-sm font-semibold text-foreground mb-2">Workspaces</h3>
                            {user.workspaces.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No workspaces.</p>
                            ) : (
                                <div className="rounded-xl border border-border overflow-hidden">
                                    {user.workspaces.map((w, idx) => (
                                        <div key={w.id} className={`flex items-center gap-2 px-3 py-2.5 ${idx < user.workspaces.length - 1 ? 'border-b border-border' : ''}`}>
                                            <Building2 size={13} className="text-muted-foreground shrink-0" />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-foreground truncate">{w.name}</p>
                                                <p className="text-xs text-muted-foreground">/{w.slug} · {w.plan}</p>
                                            </div>
                                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                                w.role === 'owner' ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'
                                            }`}>{w.role}</span>
                                            {w.archived_at && <span className="text-xs text-orange-600">archived</span>}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

export default function AdminUsersPage() {
    const [users, setUsers] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedUserId, setSelectedUserId] = useState(null);

    const debouncedSearch = useDebounce(search);
    const limit = 20;
    const totalPages = Math.ceil(total / limit);

    const fetchUsers = useCallback(() => {
        setLoading(true);
        api.get('/api/admin/users', { params: { search: debouncedSearch, page, limit } })
            .then(res => { setUsers(res.data.users); setTotal(res.data.total); })
            .catch(() => setError('Failed to load users'))
            .finally(() => setLoading(false));
    }, [debouncedSearch, page]);

    useEffect(() => { fetchUsers(); }, [fetchUsers]);
    useEffect(() => { setPage(1); }, [debouncedSearch]);

    return (
        <div className="p-8 flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Users</h1>
                <p className="text-sm text-muted-foreground mt-1">{total} total</p>
            </div>

            {/* Search */}
            <div className="relative max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                    className="pl-8"
                    placeholder="Search by name or email…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {/* Table */}
            <div className="rounded-xl border border-border overflow-hidden">
                {/* Header */}
                <div className="grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 px-4 py-2.5 bg-secondary/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <span>User</span>
                    <span>Email</span>
                    <span className="text-center">Workspaces</span>
                    <span className="text-center">Teams</span>
                    <span>Joined</span>
                </div>

                {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="h-12 border-t border-border bg-secondary/20 animate-pulse" />
                    ))
                ) : users.length === 0 ? (
                    <div className="py-14 text-center text-sm text-muted-foreground border-t border-border">
                        No users found.
                    </div>
                ) : (
                    users.map((u, idx) => (
                        <button
                            key={u.id}
                            onClick={() => setSelectedUserId(u.id)}
                            className={`w-full grid grid-cols-[1fr_1fr_auto_auto_auto] gap-4 items-center px-4 py-3 text-left hover:bg-accent/40 transition-colors ${idx > 0 ? 'border-t border-border' : ''}`}
                        >
                            <div className="flex items-center gap-2.5 min-w-0">
                                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center shrink-0">
                                    {`${u.fname?.[0] ?? ''}${u.lname?.[0] ?? ''}`.toUpperCase() || '?'}
                                </div>
                                <span className="text-sm font-medium text-foreground truncate">{u.fname} {u.lname}</span>
                                {u.is_admin && <span className="text-xs bg-orange-100 text-orange-700 px-1.5 py-0.5 rounded-full shrink-0">Admin</span>}
                            </div>
                            <span className="text-sm text-muted-foreground truncate">{u.email}</span>
                            <span className="text-sm text-foreground text-center w-16">{u.workspace_count}</span>
                            <span className="text-sm text-foreground text-center w-16">{u.member_count}</span>
                            <span className="text-xs text-muted-foreground shrink-0">
                                {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                            </span>
                        </button>
                    ))
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                        Page {page} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                        <button
                            disabled={page <= 1}
                            onClick={() => setPage(p => p - 1)}
                            className="p-1.5 rounded-lg border border-border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronLeft size={15} />
                        </button>
                        <button
                            disabled={page >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                            className="p-1.5 rounded-lg border border-border hover:bg-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <ChevronRight size={15} />
                        </button>
                    </div>
                </div>
            )}

            {selectedUserId && (
                <UserDrawer userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
            )}
        </div>
    );
}
