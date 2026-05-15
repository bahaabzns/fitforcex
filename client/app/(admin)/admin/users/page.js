'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/axios';
import { Search, ChevronLeft, ChevronRight, Building2 } from 'lucide-react';
import { Skeleton } from '@heroui/react/skeleton';
import { Button } from '@heroui/react/button';
import { Chip } from '@heroui/react/chip';
import { Avatar } from '@heroui/react/avatar';
import { Drawer } from '@heroui/react/drawer';

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
        <Drawer isOpen={true} onOpenChange={(o) => !o && onClose()}>
            <Drawer.Backdrop>
                <Drawer.Container className="justify-end">
                    <Drawer.Dialog className="w-full max-w-md h-full rounded-none">
                        <Drawer.Header>
                            <Drawer.Heading>User Detail</Drawer.Heading>
                            <Drawer.CloseTrigger />
                        </Drawer.Header>
                        <Drawer.Body className="flex flex-col gap-6">
                            {loading && (
                                <div className="flex flex-col gap-3">
                                    {[1,2,3].map(i => <Skeleton key={i} className="h-10 rounded-lg" />)}
                                </div>
                            )}

                            {user && (
                                <>
                                    <div className="flex items-center gap-3">
                                        <Avatar className="w-12 h-12 text-base shrink-0">
                                            <Avatar.Fallback>
                                                {`${user.fname?.[0] ?? ''}${user.lname?.[0] ?? ''}`.toUpperCase() || '?'}
                                            </Avatar.Fallback>
                                        </Avatar>
                                        <div>
                                            <p className="font-semibold text-foreground">{user.fname} {user.lname}</p>
                                            <p className="text-sm text-muted-foreground">{user.email}</p>
                                            {user.is_admin && (
                                                <Chip size="sm" className="bg-orange-100 text-orange-700 mt-1">Admin</Chip>
                                            )}
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
                                                        <Chip size="sm" className={w.role === 'owner' ? 'bg-primary/10 text-primary' : 'bg-secondary text-muted-foreground'}>
                                                            {w.role}
                                                        </Chip>
                                                        {w.archived_at && (
                                                            <Chip size="sm" className="bg-orange-100 text-orange-600">archived</Chip>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </Drawer.Body>
                    </Drawer.Dialog>
                </Drawer.Container>
            </Drawer.Backdrop>
        </Drawer>
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
                <input
                    className="w-full pl-8 pr-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors"
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
                        <Skeleton key={i} className="h-12 border-t border-border rounded-none" />
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
                                <Avatar className="w-7 h-7 text-xs shrink-0">
                                    <Avatar.Fallback>
                                        {`${u.fname?.[0] ?? ''}${u.lname?.[0] ?? ''}`.toUpperCase() || '?'}
                                    </Avatar.Fallback>
                                </Avatar>
                                <span className="text-sm font-medium text-foreground truncate">{u.fname} {u.lname}</span>
                                {u.is_admin && (
                                    <Chip size="sm" className="bg-orange-100 text-orange-700 shrink-0">Admin</Chip>
                                )}
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
                        <Button
                            isIconOnly
                            variant="outline"
                            size="sm"
                            isDisabled={page <= 1}
                            onClick={() => setPage(p => p - 1)}
                        >
                            <ChevronLeft size={15} />
                        </Button>
                        <Button
                            isIconOnly
                            variant="outline"
                            size="sm"
                            isDisabled={page >= totalPages}
                            onClick={() => setPage(p => p + 1)}
                        >
                            <ChevronRight size={15} />
                        </Button>
                    </div>
                </div>
            )}

            {selectedUserId && (
                <UserDrawer userId={selectedUserId} onClose={() => setSelectedUserId(null)} />
            )}
        </div>
    );
}
