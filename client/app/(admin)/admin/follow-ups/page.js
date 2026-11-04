'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import api from '@/lib/axios';
import { useDateFormatter } from '@/utils/useDateFormatter';
import { Skeleton } from '@heroui/react/skeleton';
import { Button } from '@heroui/react/button';
import { Search, BellRing, MessageCircleOff, TrendingUp, BadgeCheck, X, Plus, Bell, Banknote } from 'lucide-react';
import ChartCard from '@/app/components/charts/ChartCard';
import StatTile from '@/app/components/charts/StatTile';
import SegmentedBar from '@/app/components/charts/SegmentedBar';
import ColumnChart from '@/app/components/charts/ColumnChart';
import {
    AGE_BUCKETS, STATUS_META, STATUS_ORDER, ageBucketOf, sortForToday, describeReminder, describePendingTransfer,
} from '@/lib/followUps';
import WhatsAppActions from './WhatsAppActions';
import FollowUpModal from './FollowUpModal';

const ROWS_PER_PAGE = 50;
const COLOR_NEAR_LIMIT = 'var(--viz-s1)';
const COLOR_DE_EMPHASIS = 'var(--viz-gray)';
const TABLE_COLUMNS = 'grid-cols-[minmax(170px,1.1fr)_minmax(250px,1.5fr)_80px_100px_120px_115px_150px_130px]';
const SELECT_CLASSES = 'rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none';

const EMPTY_FILTERS = {
    search: '', status: '', age: '', dueOnly: false, pendingTransfer: false, neverMessaged: false, nearLimit: false, freeClients: null,
};

export default function AdminFollowUpsPage() {
    const { formatDate } = useDateFormatter();
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [includeArchived, setIncludeArchived] = useState(false);
    const [filters, setFilters] = useState(EMPTY_FILTERS);
    const [visibleLimit, setVisibleLimit] = useState(ROWS_PER_PAGE);
    const [openModal, setOpenModal] = useState(null);

    const fetchCoaches = useCallback(() => (
        api.get('/api/admin/follow-ups', { params: { includeArchived } })
            .then(res => { setData(res.data); setError(''); })
            .catch(() => setError('Failed to load coaches'))
    ), [includeArchived]);

    useEffect(() => { fetchCoaches(); }, [fetchCoaches]);

    // After saving a follow-up: keep the page in place and dim it while the numbers refresh.
    const refreshCoaches = useCallback(() => {
        setIsRefreshing(true);
        fetchCoaches().finally(() => setIsRefreshing(false));
    }, [fetchCoaches]);

    const coaches = useMemo(() => data?.coaches ?? [], [data]);
    const freeClientLimit = data?.freeClientLimit ?? null;
    const patchFilters = patch => { setFilters(current => ({ ...current, ...patch })); setVisibleLimit(ROWS_PER_PAGE); };
    const toggleFilter = (key, value) => patchFilters({ [key]: filters[key] === value ? EMPTY_FILTERS[key] : value });

    const isNearLimit = useCallback(
        coach => coach.status === 'free' && freeClientLimit !== null && coach.clientsCount >= freeClientLimit - 1,
        [freeClientLimit],
    );

    const stats = useMemo(() => ({
        due: coaches.filter(coach => coach.isDue).length,
        pendingTransfer: coaches.filter(coach => coach.pendingTransfer).length,
        neverMessaged: coaches.filter(coach => coach.followUpCount === 0 && coach.status !== 'subscribed').length,
        nearLimit: coaches.filter(isNearLimit).length,
        subscribed: coaches.filter(coach => coach.status === 'subscribed').length,
    }), [coaches, isNearLimit]);

    const visibleCoaches = useMemo(() => {
        const needle = filters.search.trim().toLowerCase();
        const filtered = coaches.filter(coach => {
            if (filters.status && coach.status !== filters.status) return false;
            if (filters.age && ageBucketOf(coach.daysSinceSignup).key !== filters.age) return false;
            if (filters.dueOnly && !coach.isDue) return false;
            if (filters.pendingTransfer && !coach.pendingTransfer) return false;
            if (filters.neverMessaged && !(coach.followUpCount === 0 && coach.status !== 'subscribed')) return false;
            if (filters.nearLimit && !isNearLimit(coach)) return false;
            if (filters.freeClients !== null && !(coach.status === 'free' && coach.clientsCount === filters.freeClients)) return false;
            if (!needle) return true;
            return [coach.workspaceName, coach.ownerName, coach.ownerEmail, coach.phone].some(text => text?.toLowerCase().includes(needle));
        });
        return sortForToday(filtered);
    }, [coaches, filters, isNearLimit]);

    const activeFilterChips = [
        filters.status && { key: 'status', label: `Status: ${STATUS_META[filters.status].label}` },
        filters.age && { key: 'age', label: `Joined ${AGE_BUCKETS.find(bucket => bucket.key === filters.age).label} ago` },
        filters.dueOnly && { key: 'dueOnly', label: 'Due today or overdue' },
        filters.pendingTransfer && { key: 'pendingTransfer', label: 'Transfer awaiting your confirmation' },
        filters.neverMessaged && { key: 'neverMessaged', label: 'Never messaged' },
        filters.nearLimit && { key: 'nearLimit', label: 'Free, near the client limit' },
        filters.freeClients !== null && { key: 'freeClients', label: `Free with ${filters.freeClients} ${filters.freeClients === 1 ? 'client' : 'clients'}` },
    ].filter(Boolean);

    const modalCoach = openModal ? coaches.find(coach => coach.workspaceId === openModal.workspaceId) : null;

    return (
        <div className="viz-root flex flex-col gap-6 p-8">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Follow-ups</h1>
                <p className="mt-1 text-sm text-muted-foreground">
                    Everyone who created a workspace, who to message today, and what you said last time.
                </p>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            {!data ? (
                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-xl" />)}
                </div>
            ) : (
                <div className={`flex flex-col gap-6 transition-opacity ${isRefreshing ? 'opacity-60' : ''}`}>
                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                        <StatTile
                            icon={Banknote}
                            label="Awaiting your confirmation"
                            value={stats.pendingTransfer}
                            note="manual transfers to confirm in Payments"
                            tone={stats.pendingTransfer > 0 ? 'attention' : 'default'}
                            isActive={filters.pendingTransfer}
                            onClick={() => toggleFilter('pendingTransfer', true)}
                        />
                        <StatTile
                            icon={BellRing}
                            label="Message today"
                            value={stats.due}
                            note={stats.due === 1 ? 'follow-up due or overdue' : 'follow-ups due or overdue'}
                            tone={stats.due > 0 ? 'attention' : 'default'}
                            isActive={filters.dueOnly}
                            onClick={() => toggleFilter('dueOnly', true)}
                        />
                        <StatTile
                            icon={MessageCircleOff}
                            label="Never messaged"
                            value={stats.neverMessaged}
                            note="free or expired coaches you haven't contacted"
                            isActive={filters.neverMessaged}
                            onClick={() => toggleFilter('neverMessaged', true)}
                        />
                        <StatTile
                            icon={TrendingUp}
                            label="Close to the free limit"
                            value={stats.nearLimit}
                            note={freeClientLimit !== null ? `free coaches with ${freeClientLimit - 1}–${freeClientLimit} clients: likely to upgrade` : 'free coaches near the client limit'}
                            isActive={filters.nearLimit}
                            onClick={() => toggleFilter('nearLimit', true)}
                        />
                        <StatTile
                            icon={BadgeCheck}
                            label="Subscribed"
                            value={stats.subscribed}
                            note={`${coaches.length > 0 ? Math.round((stats.subscribed / coaches.length) * 100) : 0}% of ${coaches.length} coaches`}
                            isActive={filters.status === 'subscribed'}
                            onClick={() => toggleFilter('status', 'subscribed')}
                        />
                    </div>

                    <FollowUpCharts
                        coaches={coaches}
                        freeClientLimit={freeClientLimit}
                        filters={filters}
                        onSelectStatus={status => toggleFilter('status', status)}
                        onSelectAge={age => toggleFilter('age', age)}
                        onSelectFreeClients={count => toggleFilter('freeClients', count)}
                    />

                    <section className="flex flex-col gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative w-full max-w-sm">
                                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input
                                    className="w-full rounded-lg border border-border bg-card py-2 pl-8 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground hover:border-primary/40"
                                    placeholder="Search name, workspace, email or phone…"
                                    value={filters.search}
                                    onChange={event => patchFilters({ search: event.target.value })}
                                />
                            </div>
                            <select value={filters.status} onChange={event => patchFilters({ status: event.target.value })} className={SELECT_CLASSES} aria-label="Filter by status">
                                <option value="">All statuses</option>
                                {STATUS_ORDER.map(status => <option key={status} value={status}>{STATUS_META[status].label}</option>)}
                            </select>
                            <select value={filters.age} onChange={event => patchFilters({ age: event.target.value })} className={SELECT_CLASSES} aria-label="Filter by days since signup">
                                <option value="">Any time since signup</option>
                                {AGE_BUCKETS.map(bucket => <option key={bucket.key} value={bucket.key}>Joined {bucket.label} ago</option>)}
                            </select>
                            <label className="flex items-center gap-2 text-sm text-muted-foreground">
                                <input type="checkbox" checked={includeArchived} onChange={event => setIncludeArchived(event.target.checked)} />
                                Show archived workspaces
                            </label>
                        </div>

                        {activeFilterChips.length > 0 && (
                            <div className="flex flex-wrap items-center gap-2">
                                {activeFilterChips.map(chip => (
                                    <button
                                        key={chip.key}
                                        type="button"
                                        onClick={() => patchFilters({ [chip.key]: EMPTY_FILTERS[chip.key] })}
                                        className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs text-primary transition-colors hover:bg-primary/20"
                                    >
                                        {chip.label}<X size={11} aria-hidden="true" />
                                        <span className="sr-only">Remove filter</span>
                                    </button>
                                ))}
                                <button type="button" onClick={() => patchFilters({ ...EMPTY_FILTERS, search: filters.search })} className="text-xs text-muted-foreground underline-offset-2 hover:underline">Clear all</button>
                            </div>
                        )}

                        <p className="text-xs text-muted-foreground">
                            Showing {Math.min(visibleLimit, visibleCoaches.length)} of {visibleCoaches.length} coaches — transfers waiting for you first, then due reminders, then coaches nobody has messaged yet.
                        </p>

                        <CoachTable
                            coaches={visibleCoaches.slice(0, visibleLimit)}
                            freeClientLimit={freeClientLimit}
                            formatDate={formatDate}
                            onOpen={(coach, startWithForm) => setOpenModal({ workspaceId: coach.workspaceId, startWithForm })}
                        />

                        {visibleCoaches.length > visibleLimit && (
                            <Button variant="outline" size="sm" onClick={() => setVisibleLimit(current => current + ROWS_PER_PAGE)} className="self-center">
                                Show more
                            </Button>
                        )}
                    </section>
                </div>
            )}

            {modalCoach && (
                <FollowUpModal
                    coach={modalCoach}
                    startWithForm={openModal.startWithForm}
                    onClose={() => setOpenModal(null)}
                    onChanged={refreshCoaches}
                />
            )}
        </div>
    );
}

function FollowUpCharts({ coaches, freeClientLimit, filters, onSelectStatus, onSelectAge, onSelectFreeClients }) {
    const statusParts = STATUS_ORDER.map(status => ({
        key: status, label: STATUS_META[status].label, color: STATUS_META[status].color,
        value: coaches.filter(coach => coach.status === status).length,
    }));

    const joinedCategories = AGE_BUCKETS.map(bucket => ({
        key: bucket.key,
        label: bucket.key.replace('-', '–'),
        values: Object.fromEntries(STATUS_ORDER.map(status => [
            status,
            coaches.filter(coach => ageBucketOf(coach.daysSinceSignup).key === bucket.key && coach.status === status).length,
        ])),
    }));

    const freeCoaches = coaches.filter(coach => coach.status === 'free');
    const clientCategories = freeClientLimit === null ? [] : Array.from({ length: freeClientLimit + 1 }, (_, count) => ({
        key: String(count),
        label: count === freeClientLimit ? `${count} (full)` : String(count),
        values: { coaches: freeCoaches.filter(coach => Math.min(coach.clientsCount, freeClientLimit) === count).length },
        // Emphasis: only the coaches one step from the limit are highlighted; the rest recede.
        color: count >= freeClientLimit - 1 ? COLOR_NEAR_LIMIT : COLOR_DE_EMPHASIS,
    }));

    return (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
            <ChartCard
                title="Where your coaches are"
                subtitle="Click a block to filter the list"
                table={{ columns: ['Status', 'Coaches'], rows: statusParts.map(part => [part.label, part.value]) }}
            >
                <SegmentedBar parts={statusParts} onSelect={onSelectStatus} selectedKey={filters.status} />
            </ChartCard>

            <ChartCard
                title="How long ago they joined"
                subtitle="Days since signup, by status — click a column to filter"
                legend={STATUS_ORDER.map(status => ({ label: STATUS_META[status].label, color: STATUS_META[status].color }))}
                table={{
                    columns: ['Joined', ...STATUS_ORDER.map(status => STATUS_META[status].label)],
                    rows: joinedCategories.map(category => [AGE_BUCKETS.find(bucket => bucket.key === category.key).label, ...STATUS_ORDER.map(status => category.values[status])]),
                }}
            >
                <ColumnChart
                    categories={joinedCategories}
                    series={STATUS_ORDER.map(status => ({ key: status, label: STATUS_META[status].label, color: STATUS_META[status].color }))}
                    stacked
                    height={150}
                    onSelect={onSelectAge}
                    selectedKey={filters.age}
                />
            </ChartCard>

            <ChartCard
                title="Free coaches by clients used"
                subtitle={freeClientLimit !== null ? `Highlighted: one step from the ${freeClientLimit}-client limit, the likeliest to upgrade` : 'Needs the free plan client limit'}
                table={{ columns: ['Clients', 'Free coaches'], rows: clientCategories.map(category => [category.label, category.values.coaches]) }}
            >
                <ColumnChart
                    categories={clientCategories}
                    series={[{ key: 'coaches', label: 'Free coaches', color: COLOR_DE_EMPHASIS }]}
                    height={150}
                    onSelect={count => onSelectFreeClients(Number(count))}
                    selectedKey={filters.freeClients === null ? undefined : String(filters.freeClients)}
                    emptyText="No free coaches yet."
                />
            </ChartCard>
        </div>
    );
}

function ClientsCell({ coach, freeClientLimit }) {
    if (coach.status !== 'free' || freeClientLimit === null) {
        return <span className="text-sm text-foreground">{coach.clientsCount}</span>;
    }
    const isFull = coach.clientsCount >= freeClientLimit;
    const fillPercent = Math.min(100, (coach.clientsCount / freeClientLimit) * 100);
    return (
        <div className="flex flex-col gap-1" title={`${coach.clientsCount} of ${freeClientLimit} free clients used`}>
            <span className="text-sm text-foreground">{coach.clientsCount} / {freeClientLimit}{isFull && <span className="ml-1 text-xs text-muted-foreground">full</span>}</span>
            <span className="h-1.5 w-full overflow-hidden rounded-full" style={{ background: 'var(--viz-grid)' }}>
                <span className="block h-full rounded-full" style={{ width: `${fillPercent}%`, background: isFull ? 'var(--viz-step-3)' : 'var(--viz-s1)' }} />
            </span>
        </div>
    );
}

function ReminderCell({ coach, formatDate }) {
    const reminder = describeReminder(coach.nextFollowUpOn);
    if (!reminder) return <span className="text-sm text-muted-foreground">—</span>;
    if (reminder.isDue) {
        return (
            <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-orange-700">
                <Bell size={13} aria-hidden="true" />
                {reminder.text}
            </span>
        );
    }
    return (
        <div>
            <p className="text-sm text-foreground">{formatDate(coach.nextFollowUpOn)}</p>
            <p className="text-xs text-muted-foreground">{reminder.text}</p>
        </div>
    );
}

function CoachTable({ coaches, freeClientLimit, formatDate, onOpen }) {
    return (
        <div className="overflow-x-auto rounded-xl border border-border">
            <div className="min-w-[1150px]">
                <div className={`grid ${TABLE_COLUMNS} gap-4 bg-secondary/50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground`}>
                    <span>Coach</span>
                    <span>WhatsApp</span>
                    <span>Joined</span>
                    <span>Status</span>
                    <span>Clients</span>
                    <span>Last follow-up</span>
                    <span>Next follow-up</span>
                    <span />
                </div>
                {coaches.length === 0 ? (
                    <div className="border-t border-border py-14 text-center text-sm text-muted-foreground">No coaches match these filters.</div>
                ) : coaches.map((coach, index) => (
                    <div
                        key={coach.workspaceId}
                        role="button"
                        tabIndex={0}
                        onClick={() => onOpen(coach, false)}
                        onKeyDown={event => { if (event.key === 'Enter') onOpen(coach, false); }}
                        className={`grid ${TABLE_COLUMNS} cursor-pointer items-center gap-4 px-4 py-3 transition-colors hover:bg-default/40 ${index > 0 ? 'border-t border-border' : ''} ${coach.isDue ? 'border-l-4 border-l-orange-400 bg-orange-500/5' : coach.pendingTransfer ? 'border-l-4 border-l-primary bg-primary/5' : ''}`}
                    >
                        <div className="min-w-0">
                            <p className="truncate text-sm font-medium text-foreground">{coach.ownerName}</p>
                            <p className="truncate text-xs text-muted-foreground">{coach.workspaceName}{coach.isArchived ? ' · archived' : ''}</p>
                            {coach.pendingTransfer && (
                                <p className="mt-0.5 flex items-center gap-1 text-[11px] font-medium text-primary">
                                    <Banknote size={11} aria-hidden="true" className="shrink-0" />
                                    <span className="truncate">{describePendingTransfer(coach.pendingTransfer)}</span>
                                </p>
                            )}
                            {coach.firstSource && <p className="truncate text-[11px] text-muted-foreground">Came from {coach.firstSource}</p>}
                        </div>
                        <WhatsAppActions coach={coach} />
                        <div>
                            <p className="text-sm text-foreground">{coach.daysSinceSignup}d</p>
                            <p className="text-[11px] text-muted-foreground">{formatDate(coach.signedUpAt)}</p>
                        </div>
                        <span className={`justify-self-start whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-medium ${STATUS_META[coach.status].chip}`}>{STATUS_META[coach.status].label}</span>
                        <ClientsCell coach={coach} freeClientLimit={freeClientLimit} />
                        <div>
                            {coach.lastFollowUpAt ? (
                                <>
                                    <p className="text-sm text-foreground">{formatDate(coach.lastFollowUpAt)}</p>
                                    <p className="text-[11px] text-muted-foreground">{coach.followUpCount} {coach.followUpCount === 1 ? 'message' : 'messages'} logged</p>
                                </>
                            ) : <span className="text-xs italic text-muted-foreground">Never</span>}
                        </div>
                        <ReminderCell coach={coach} formatDate={formatDate} />
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={event => { event.stopPropagation(); onOpen(coach, true); }}
                            className="justify-self-end"
                        >
                            <Plus size={13} /> Add follow-up
                        </Button>
                    </div>
                ))}
            </div>
        </div>
    );
}
