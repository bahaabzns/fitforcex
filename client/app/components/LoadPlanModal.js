'use client';
import { useState, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import api from '@/lib/axios';
import AppModal from '@/app/components/Modal';
import { FieldLabel } from '@/app/components/Field';
import { Button } from '@heroui/react/button';
import { Skeleton } from '@heroui/react/skeleton';
import { ScrollShadow } from "@/app/components/ScrollShadow";
import { SearchField } from '@heroui/react/search-field';
import { Select } from '@heroui/react/select';
import { Autocomplete } from '@heroui/react/autocomplete';
import { useFilter } from '@heroui/react/rac';
import { ListBox } from '@heroui/react/list-box';
import { Chip } from '@heroui/react/chip';
import { Card } from '@heroui/react/card';
import { Pagination } from '@heroui/react/pagination';
import EmptyState from '@/app/components/EmptyState';
import PlanIcon from '@/app/components/PlanIcon';
import { getPageNumbers } from '@/utils/pagination';

// Native numeric inputs keep their previous digits highlighted on focus so
// typing immediately replaces the value instead of appending to it.
const selectAllOnFocus = (e) => e.target.select();

// Sentinels for the "all X" option — HeroUI Select/Autocomplete keys can't be
// the empty string, but the filter state uses '' to mean "no filter". Map between them.
const ALL_CREATORS = '__all__';
const ALL_CLIENTS = '__all_clients__';

// Matches the other picker modals' PAGE_SIZE. The cards are compact (2-3
// lines each) and the modal now uses size="cover", so 10 fit comfortably —
// the ScrollShadow below scrolls internally past whatever doesn't.
const PAGE_SIZE = 10;

function formatRelativeTime(dateStr, t) {
    if (!dateStr) return '';
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return t('justNow');
    if (diffMins < 60) return t('minutesAgo', { count: diffMins });
    if (diffHours < 24) return t('hoursAgo', { count: diffHours });
    if (diffDays === 1) return t('yesterday');
    if (diffDays < 7) return t('daysAgo', { count: diffDays });
    if (diffDays < 30) return t('weeksAgo', { count: Math.floor(diffDays / 7) });
    if (diffDays < 365) return t('monthsAgo', { count: Math.floor(diffDays / 30) });
    return t('yearsAgo', { count: Math.floor(diffDays / 365) });
}

// Centers the value and strips the native number-input spinner in every
// engine: WebKit/Blink hide it via the inner/outer spin-button pseudo-elements,
// Firefox via -moz-appearance:textfield (appearance:none alone doesn't hide it there).
const NUMBER_INPUT_CLASS = 'min-w-0 text-center [-moz-appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

function RangeInput({ label, minValue, maxValue, onMinChange, onMaxChange, unit = '' }) {
    const tCommon = useTranslations('common');
    return (
        <div className="flex flex-col gap-1.5 w-full">
            <FieldLabel>
                {label}
                {unit && <span className="ms-1 text-[11px] font-normal text-muted-foreground">({unit})</span>}
            </FieldLabel>
            {/* One bordered field, two editable regions either side of a colon — same
                visual language as HeroUI's TimeField (hour : minute). Deliberately
                plain HTML wearing HeroUI's own input-group classes/data-slot, NOT the
                <InputGroup> component: InputGroup's root has an onClick that always
                focuses the FIRST <input> it finds via querySelector — fine for its
                intended one-input-plus-affix layout, but with two real inputs it
                hijacked every click on the max field onto the min field instead. The
                blue focus ring is pure CSS (.input-group:has([data-slot=input-group-
                input]:focus)), so it still works with no JS wiring of our own. */}
            <div className="input-group input-group--primary input-group--full-width">
                {/* min-w-0: native <input> elements resist shrinking below their
                    intrinsic content width in a flex container by default (a classic
                    flexbox gotcha) — without this, two of them refuse to compress into
                    one narrow group and silently overflow it. */}
                <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    data-slot="input-group-input"
                    className={`input-group__input ${NUMBER_INPUT_CLASS}`}
                    aria-label={`${label} ${tCommon('min')}`}
                    placeholder={tCommon('min')}
                    value={minValue}
                    onChange={(e) => onMinChange(e.target.value)}
                    onFocus={selectAllOnFocus}
                />
                <span className="px-1 text-sm text-muted-foreground select-none" aria-hidden="true">:</span>
                <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    data-slot="input-group-input"
                    className={`input-group__input ${NUMBER_INPUT_CLASS}`}
                    aria-label={`${label} ${tCommon('max')}`}
                    placeholder={tCommon('max')}
                    value={maxValue}
                    onChange={(e) => onMaxChange(e.target.value)}
                    onFocus={selectAllOnFocus}
                />
            </div>
        </div>
    );
}

export default function LoadPlanModal({ open, onClose, type, onLoad }) {
    const tFilter = useTranslations('filter');
    const tTraining = useTranslations('training');
    const tNutrition = useTranslations('nutrition');
    const tModal = useTranslations('modal');
    const tCommon = useTranslations('common');
    const { contains } = useFilter({ sensitivity: 'base' });
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(false);
    const [loadError, setLoadError] = useState(false);
    const [selectedPlanId, setSelectedPlanId] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [creatorFilter, setCreatorFilter] = useState('');
    const [clientFilter, setClientFilter] = useState('');
    const [page, setPage] = useState(1);

    const [minDays, setMinDays] = useState('');
    const [maxDays, setMaxDays] = useState('');

    const [minCalories, setMinCalories] = useState('');
    const [maxCalories, setMaxCalories] = useState('');
    const [minProtein, setMinProtein] = useState('');
    const [maxProtein, setMaxProtein] = useState('');
    const [minCarbs, setMinCarbs] = useState('');
    const [maxCarbs, setMaxCarbs] = useState('');
    const [minFats, setMinFats] = useState('');
    const [maxFats, setMaxFats] = useState('');

    useEffect(() => {
        if (!open) return;
        setLoading(true);
        setLoadError(false);
        setSelectedPlanId(null);
        setSearchQuery('');
        setCreatorFilter('');
        setClientFilter('');
        setPage(1);
        setMinDays(''); setMaxDays('');
        setMinCalories(''); setMaxCalories('');
        setMinProtein(''); setMaxProtein('');
        setMinCarbs(''); setMaxCarbs('');
        setMinFats(''); setMaxFats('');

        const controller = new AbortController();
        const route = type === 'training' ? '/api/training/plans/workspace-library' : '/api/nutrition/plans/workspace-library';
        api.get(route, { signal: controller.signal })
            .then((res) => setPlans(res.data ?? []))
            .catch((err) => { if (!api.isCancel?.(err) && err.name !== 'CanceledError') setPlans([]); })
            .finally(() => setLoading(false));
        return () => controller.abort();
    }, [open, type]);

    const creators = useMemo(() => {
        const names = [...new Set(plans.map((p) => p.creator_name ?? 'Unknown'))].sort();
        return names;
    }, [plans]);

    // Unique clients across the fetched plans, keyed by client_code (unique
    // per workspace) so the autocomplete filter can search by name or code.
    const clientOptions = useMemo(() => {
        const map = new Map();
        for (const p of plans) {
            if (p.client_code == null) continue;
            const key = String(p.client_code);
            if (!map.has(key)) map.set(key, p.client_name ?? tCommon('unknownClient'));
        }
        return [...map.entries()]
            .map(([code, name]) => ({ code, name }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [plans, tCommon]);

    const filteredPlans = useMemo(() => {
        return plans.filter((plan) => {
            if (searchQuery && !plan.name?.toLowerCase().includes(searchQuery.trim().toLowerCase())) return false;
            if (creatorFilter && (plan.creator_name ?? 'Unknown') !== creatorFilter) return false;
            if (clientFilter && String(plan.client_code) !== clientFilter) return false;

            if (type === 'training') {
                const days = plan.day_count ?? 0;
                if (minDays !== '' && days < Number(minDays)) return false;
                if (maxDays !== '' && days > Number(maxDays)) return false;
            } else {
                const cal = plan.avg_calories ?? 0;
                const pro = plan.avg_protein ?? 0;
                const carb = plan.avg_carbs ?? 0;
                const fat = plan.avg_fats ?? 0;
                if (minCalories !== '' && cal < Number(minCalories)) return false;
                if (maxCalories !== '' && cal > Number(maxCalories)) return false;
                if (minProtein !== '' && pro < Number(minProtein)) return false;
                if (maxProtein !== '' && pro > Number(maxProtein)) return false;
                if (minCarbs !== '' && carb < Number(minCarbs)) return false;
                if (maxCarbs !== '' && carb > Number(maxCarbs)) return false;
                if (minFats !== '' && fat < Number(minFats)) return false;
                if (maxFats !== '' && fat > Number(maxFats)) return false;
            }
            return true;
        });
    }, [plans, searchQuery, creatorFilter, clientFilter, type, minDays, maxDays, minCalories, maxCalories, minProtein, maxProtein, minCarbs, maxCarbs, minFats, maxFats]);

    // Back to page 1 whenever a filter/search input changes — otherwise the
    // coach could be silently stranded on a now-empty page. Adjusted during
    // render (React's recommended alternative to an effect for this) rather
    // than via useEffect, same pattern PlansQueueTable.js uses for prevCompletingId.
    const filterSignature = JSON.stringify([searchQuery, creatorFilter, clientFilter, minDays, maxDays, minCalories, maxCalories, minProtein, maxProtein, minCarbs, maxCarbs, minFats, maxFats]);
    const [prevFilterSignature, setPrevFilterSignature] = useState(filterSignature);
    if (filterSignature !== prevFilterSignature) {
        setPrevFilterSignature(filterSignature);
        setPage(1);
    }

    const totalPages = Math.max(1, Math.ceil(filteredPlans.length / PAGE_SIZE));
    const safePage = Math.min(page, totalPages);
    const pagedPlans = filteredPlans.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    const hasActiveFilters = [searchQuery, creatorFilter, clientFilter, minDays, maxDays, minCalories, maxCalories, minProtein, maxProtein, minCarbs, maxCarbs, minFats, maxFats].some((v) => v !== '');

    function clearAllFilters() {
        setSearchQuery('');
        setCreatorFilter('');
        setClientFilter('');
        setMinDays(''); setMaxDays('');
        setMinCalories(''); setMaxCalories('');
        setMinProtein(''); setMaxProtein('');
        setMinCarbs(''); setMaxCarbs('');
        setMinFats(''); setMaxFats('');
    }

    async function handleLoad() {
        if (!selectedPlanId) return;
        setLoadError(false);
        const success = await onLoad(selectedPlanId);
        if (success === false) {
            setLoadError(true);
            return;
        }
        onClose();
    }

    const title = type === 'training' ? tModal('loadTrainingPlan') : tModal('loadNutritionPlan');
    const selectedClientName = clientOptions.find((c) => c.code === clientFilter)?.name;

    return (
        <AppModal
            open={open}
            onClose={onClose}
            title={title}
            size="cover"
            dialogClassName="max-w-3xl"
            footer={
                <div className="flex flex-col gap-3 w-full">
                    {/* justify-center! — HeroUI's own .pagination{justify-content:space-between}
                        outranks a plain Tailwind utility here (same reason Card needed flex-row!
                        and grid! elsewhere in this file), so it needs the important suffix to win. */}
                    {totalPages > 1 && (
                        <Pagination className="justify-center!" size="sm">
                            <Pagination.Content>
                                <Pagination.Item>
                                    <Pagination.Previous isDisabled={safePage === 1} onPress={() => setPage((p) => p - 1)}>
                                        <Pagination.PreviousIcon />
                                        <span>{tFilter('previous')}</span>
                                    </Pagination.Previous>
                                </Pagination.Item>
                                {getPageNumbers(safePage, totalPages).map((p, i) =>
                                    p === 'ellipsis' ? (
                                        <Pagination.Item key={`ellipsis-${i}`}>
                                            <Pagination.Ellipsis />
                                        </Pagination.Item>
                                    ) : (
                                        <Pagination.Item key={p}>
                                            <Pagination.Link isActive={p === safePage} onPress={() => setPage(p)}>
                                                {p}
                                            </Pagination.Link>
                                        </Pagination.Item>
                                    )
                                )}
                                <Pagination.Item>
                                    <Pagination.Next isDisabled={safePage === totalPages} onPress={() => setPage((p) => p + 1)}>
                                        <span>{tFilter('next')}</span>
                                        <Pagination.NextIcon />
                                    </Pagination.Next>
                                </Pagination.Item>
                            </Pagination.Content>
                        </Pagination>
                    )}
                    <div className="flex items-center justify-between gap-2 w-full border-t border-border pt-3">
                        <div className="flex items-center gap-3">
                            <p className={`text-xs ${loadError ? 'text-destructive' : 'text-muted-foreground'}`}>
                                {loadError
                                    ? tModal('loadFailed')
                                    : !loading && tFilter('plansCount', { filtered: filteredPlans.length, total: plans.length })}
                            </p>
                            {/* Lives here instead of the search/filter row above — it's always
                                visible (the footer is pinned), reads naturally next to "how many
                                results" this count already shows, and stops fighting the search
                                field + two dropdowns for space at narrow widths. */}
                            {hasActiveFilters && (
                                <Button variant="danger-soft" size="sm" onClick={clearAllFilters}>
                                    {tFilter('clearFilters')}
                                </Button>
                            )}
                        </div>
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" onClick={onClose}>{tModal('cancel')}</Button>
                            <Button
                                variant="primary"
                                isDisabled={!selectedPlanId}
                                onClick={handleLoad}
                            >
                                {tModal('loadSelectedPlan')}
                            </Button>
                        </div>
                    </div>
                </div>
            }
        >
            {/* h-full + flex-col fills Modal.Body's own bounded height exactly, so Body's
                default scroll-inside behavior never has to kick in — only the ScrollShadow
                below (flex-1 min-h-0) grows/shrinks and scrolls internally, while search,
                filters, and (via the footer prop above) pagination + actions all stay put.
                px-1.5 insets every child from the dialog's rounded edge uniformly —
                deliberately padding here, not margin on individual fullWidth (width:100%)
                children below, since a margin there would add on top of that 100% and
                silently force a horizontal scrollbar (exactly what happened when the
                search field alone had a margin: 100% + 2×margin > parent). */}
            <div className="flex flex-col h-full gap-4 px-1.5 overflow-x-hidden">

                {/* Search + Created by + Client, one row. mt-1.5 gives the focus ring room
                    from the header above (vertical margin is safe here, unlike horizontal —
                    it doesn't fight fullWidth's width:100% the way mx did on the search
                    field alone). Search takes remaining space; the two dropdowns keep a
                    fixed width so they don't reflow as their own text changes. */}
                {/* Stacked column below sm, one row at sm and up. Below sm: search takes
                    its own full-width row, then Created-by/Client share a second row and
                    each grow to fill it (flex-1) — no more fixed w-44 leaving empty space
                    next to them. At sm+, the dropdown-group div becomes `contents` (drops
                    out of the flow) so Select/Autocomplete rejoin this row directly as
                    fixed-width items beside the search field, which is back to flex-1. */}
                <div className="flex flex-col gap-2 mt-1.5 shrink-0 sm:flex-row sm:items-center sm:gap-3">
                    <SearchField variant="secondary" className="w-full sm:flex-1 sm:min-w-60" aria-label={tFilter('searchPlanName')} value={searchQuery} onChange={setSearchQuery}>
                        <SearchField.Group>
                            <SearchField.SearchIcon />
                            <SearchField.Input placeholder={tFilter('searchPlanName')} />
                            <SearchField.ClearButton />
                        </SearchField.Group>
                    </SearchField>

                    <div className="flex gap-3 sm:contents">
                    {creators.length > 0 && (
                        <Select
                            variant="secondary"
                            className="flex-1 sm:w-44 sm:shrink-0"
                            aria-label={tFilter('createdBy')}
                            value={creatorFilter || ALL_CREATORS}
                            onChange={(key) => setCreatorFilter(key === ALL_CREATORS ? '' : key)}
                        >
                            <Select.Trigger>
                                <Select.Value />
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                {/* Same cap as the client Autocomplete below — a large team otherwise
                                    grows this popover to fit every member instead of scrolling. */}
                                <ListBox className="max-h-64 overflow-y-auto">
                                    <ListBox.Item id={ALL_CREATORS} textValue={tFilter('allMembers')}>
                                        {tFilter('allMembers')}
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                    {creators.map((name) => (
                                        <ListBox.Item key={name} id={name} textValue={name}>
                                            {name}
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                    )}

                    {/* Client filter — searchable by name or code (autocomplete), not a
                        plain closed Select, since a workspace can have far more clients
                        than team members. */}
                    {clientOptions.length > 0 && (
                        <Autocomplete
                            variant="secondary"
                            className="flex-1 sm:w-44 sm:shrink-0"
                            aria-label={tFilter('client')}
                            value={clientFilter || ALL_CLIENTS}
                            onChange={(key) => setClientFilter(key === ALL_CLIENTS ? '' : key)}
                        >
                            <Autocomplete.Trigger>
                                <Autocomplete.Value>
                                    {() => clientFilter ? (selectedClientName ?? tFilter('allClients')) : tFilter('allClients')}
                                </Autocomplete.Value>
                                <Autocomplete.Indicator />
                            </Autocomplete.Trigger>
                            {/* w-72: the trigger is only w-44 (176px), too narrow for the search
                                placeholder to render without clipping — the popover's own min-width
                                is the trigger width, but an explicit wider width here overrides that.
                                max-h-80 + overflow-y-auto on the list: the popover's overflow-y:auto
                                is already set by HeroUI, but with no height cap it just grows to fit
                                every client instead of ever scrolling — that's what made it "very tall". */}
                            <Autocomplete.Popover className="w-72">
                                <Autocomplete.Filter filter={contains}>
                                    <SearchField autoFocus name="client-search" variant="secondary">
                                        <SearchField.Group>
                                            <SearchField.SearchIcon />
                                            <SearchField.Input placeholder={tFilter('searchClient')} />
                                            <SearchField.ClearButton />
                                        </SearchField.Group>
                                    </SearchField>
                                    {/* ListBox defaults to overflow:clip (no scroll) — max-h + overflow-y-auto
                                        together cap it and make the rest of a long client list scrollable
                                        instead of the whole popover growing to fit every item. */}
                                    <ListBox className="max-h-64 overflow-y-auto">
                                        <ListBox.Item id={ALL_CLIENTS} textValue={tFilter('allClients')}>
                                            {tFilter('allClients')}
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                        {clientOptions.map((c) => (
                                            <ListBox.Item key={c.code} id={c.code} textValue={`${c.name} #${c.code}`}>
                                                <span className="truncate flex-1">{c.name}</span>
                                                <span className="shrink-0 text-xs text-muted-foreground">#{c.code}</span>
                                                <ListBox.ItemIndicator />
                                            </ListBox.Item>
                                        ))}
                                    </ListBox>
                                </Autocomplete.Filter>
                            </Autocomplete.Popover>
                        </Autocomplete>
                    )}
                    </div>
                </div>

                {/* Filters — transparent Card so the app's own bg-default panel color
                    shows through, keeping it visually distinct from the plan cards below.
                    grid-cols-2 → lg:grid-cols-4 so the 4 nutrition ranges sit 2-per-row on
                    small screens and all 4 in one row on large ones, instead of flex-wrap's
                    uneven greedy wrap (e.g. 3+1). Training's 2 ranges fit either way. */}
                <Card variant="transparent" className="shrink-0 grid! grid-cols-2 lg:grid-cols-4 gap-x-5 gap-y-3 bg-default border border-border">
                    {type === 'training' ? (
                        <RangeInput label={tTraining('daysSection')} minValue={minDays} maxValue={maxDays} onMinChange={setMinDays} onMaxChange={setMaxDays} />
                    ) : (
                        <>
                            <RangeInput label={tNutrition('caloriesLabel')} minValue={minCalories} maxValue={maxCalories} onMinChange={setMinCalories} onMaxChange={setMaxCalories} unit="kcal" />
                            <RangeInput label={tNutrition('protein')} minValue={minProtein} maxValue={maxProtein} onMinChange={setMinProtein} onMaxChange={setMaxProtein} unit="g" />
                            <RangeInput label={tNutrition('carbs')} minValue={minCarbs} maxValue={maxCarbs} onMinChange={setMinCarbs} onMaxChange={setMaxCarbs} unit="g" />
                            <RangeInput label={tNutrition('fat')} minValue={minFats} maxValue={maxFats} onMinChange={setMinFats} onMaxChange={setMaxFats} unit="g" />
                        </>
                    )}
                </Card>

                {/* Plan list — the modal's own flexible region; grows to fill whatever
                    space search/filters/footer leave and scrolls internally past that.
                    overflow-x-hidden: HeroUI's ScrollShadow only sets overflow-y:auto,
                    and per the CSS overflow spec a lone auto axis forces the other axis
                    to compute as auto too — so any 1px sub-pixel-wide child (easy to hit
                    with flex-wrap chip rows) silently grows a horizontal scrollbar here. */}
                <ScrollShadow className="flex-1 min-h-0 overflow-x-hidden" hideScrollBar>
                    {loading ? (
                        <div className="flex flex-col gap-2">
                            {[1, 2, 3, 4].map((i) => (
                                <Skeleton key={i} className="h-16 rounded-xl" />
                            ))}
                        </div>
                    ) : filteredPlans.length === 0 ? (
                        <EmptyState
                            variant={plans.length === 0 ? 'firstTime' : 'search'}
                            title={plans.length === 0 ? tFilter('noPlansYet') : tFilter('noPlansMatch')}
                        />
                    ) : (
                        <div className="flex flex-col gap-1.5">
                            {pagedPlans.map((plan) => {
                                const isSelected = String(selectedPlanId) === String(plan.id);
                                const cycles = plan.cycles ?? [];
                                const days = plan.days ?? [];
                                return (
                                    <button
                                        key={plan.id}
                                        onClick={() => setSelectedPlanId(plan.id)}
                                        className="w-full text-left cursor-pointer"
                                    >
                                        {/* app-surface-card/hover/selected — the same elevation tokens
                                            RightPanel/nutrition RightPanel use for their draggable rows —
                                            deliberately not the Filters card's bg-default, so the two
                                            surfaces stay visually distinct.
                                            p-3! overrides Card's own p-4 — a tighter card fits the header
                                            + cycle rows in 2-3 compact lines instead of the taller
                                            Header/Content split this used to be. */}
                                        <Card
                                            variant="transparent"
                                            className={`p-3! transition-colors duration-100 ${
                                                isSelected
                                                    ? 'bg-app-surface-selected border border-primary/40'
                                                    : 'bg-app-surface-card border border-transparent hover:bg-app-surface-hover'
                                            }`}
                                        >
                                            {/* Two columns: left = everything about the plan/client, right =
                                                cycles info, split by a subtle divider. items-start so a
                                                taller cycles list (or a taller left column) doesn't stretch
                                                the shorter side. Stacked (flex-col) below sm — side by side
                                                two narrow columns just truncated everything on a small
                                                screen; full width for each, one under the other, keeps both
                                                actually readable there. */}
                                            <div className="flex flex-col sm:flex-row items-stretch sm:items-start gap-2 sm:gap-4">
                                                {/* Left column — plan icon (same glyph as the builder's own
                                                    LeftPanel plan list, so a plan reads the same everywhere)
                                                    + two-level header: plan name is the primary heading,
                                                    client/code/creator muted below it, relative time as a
                                                    corner badge instead of competing inline text. */}
                                                <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                                    <div className={`relative shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${
                                                        isSelected ? 'bg-primary/25 text-primary' : 'bg-foreground/10 text-muted-foreground'
                                                    }`}>
                                                        <PlanIcon />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <p className={`truncate text-sm font-bold ${isSelected ? 'text-primary' : 'text-foreground'}`}>
                                                                {plan.name}
                                                            </p>
                                                            <span className="shrink-0 rounded-full bg-default px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                                                                {formatRelativeTime(plan.updated_at, tCommon)}
                                                            </span>
                                                        </div>
                                                        <p className="truncate text-[11px] text-muted-foreground">
                                                            {plan.client_name ?? tCommon('unknownClient')}
                                                            {plan.client_code != null && ` • #${plan.client_code}`}
                                                            {plan.creator_name && ` • ${plan.creator_name}`}
                                                        </p>
                                                    </div>
                                                </div>

                                                {/* Right column — cycles info (every cycle, no truncation).
                                                    Divider reads as a horizontal rule above when stacked,
                                                    a vertical rule to the start side once side by side. */}
                                                <div className="min-w-0 flex-1 border-t sm:border-t-0 sm:border-s border-border pt-2 sm:pt-0 sm:ps-4">
                                                    {type === 'training' ? (
                                                        days.length > 0 ? (
                                                            <div className="flex flex-col gap-0.5">
                                                                {days.map((day) => (
                                                                    // Compact inline row: Push Day | 13 exercises | 20 sets.
                                                                    // Same neutral-text-with-pipe-separators treatment as the
                                                                    // nutrition cycle rows — no macros here, so nothing to color.
                                                                    <p key={day.id} className="truncate text-[11px] text-muted-foreground">
                                                                        {day.name || tTraining('untitledDay')}
                                                                        {' '}<span className="text-muted-foreground/40">|</span>{' '}
                                                                        {tTraining('exerciseCount', { count: day.exercise_count ?? 0 })}
                                                                        {' '}<span className="text-muted-foreground/40">|</span>{' '}
                                                                        {tTraining('setCount', { count: day.set_count ?? 0 })}
                                                                    </p>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-wrap items-center gap-1.5">
                                                                <Chip size="sm" variant="soft" color="default">
                                                                    {tTraining('dayCount', { count: plan.day_count ?? 0 })}
                                                                </Chip>
                                                                <Chip size="sm" variant="soft" color="default">
                                                                    {tTraining('exerciseCount', { count: plan.exercise_count ?? 0 })}
                                                                </Chip>
                                                            </div>
                                                        )
                                                    ) : cycles.length > 0 ? (
                                                        <div className="flex flex-col gap-0.5">
                                                            {cycles.map((cycle) => (
                                                                // Compact inline row: Cycle 1 | 2283 kcal | P163 C182 F72 | 9 meals.
                                                                // Color carries the macro values only (same hues as the builder's
                                                                // MacrosDonut/MacroStat: carbs=primary, protein=orange, fat=amber) —
                                                                // the name/kcal/separators/meal-count stay neutral muted text.
                                                                <p key={cycle.id} className="truncate text-[11px] text-muted-foreground">
                                                                    {cycle.name || tNutrition('untitledCycle')}
                                                                    {/* calories/protein/carbs/fats are computed from the cycle's actual
                                                                        meal items (server-side), not the optional manually-set goal_*
                                                                        columns most coaches leave blank — see nutrition.controller.ts. */}
                                                                    {cycle.calories != null && <> <span className="text-muted-foreground/40">|</span> {cycle.calories} kcal</>}
                                                                    {(cycle.protein != null || cycle.carbs != null || cycle.fats != null) && (
                                                                        <>
                                                                            {' '}<span className="text-muted-foreground/40">|</span>{' '}
                                                                            {cycle.protein != null && <span className="text-orange-500">P{cycle.protein}</span>}
                                                                            {cycle.carbs != null && <span className="text-primary"> C{cycle.carbs}</span>}
                                                                            {cycle.fats != null && <span className="text-amber-500"> F{cycle.fats}</span>}
                                                                        </>
                                                                    )}
                                                                    {' '}<span className="text-muted-foreground/40">|</span>{' '}
                                                                    {tNutrition('mealCount', { count: cycle.meal_count ?? 0 })}
                                                                </p>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-[11px] text-muted-foreground">
                                                            {tNutrition('cycleCount', { count: plan.cycle_count ?? 0 })}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        </Card>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </ScrollShadow>
            </div>
        </AppModal>
    );
}
