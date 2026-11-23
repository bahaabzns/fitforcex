"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, TriangleAlert } from "lucide-react";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import { useDateFormatter } from "@/utils/useDateFormatter";
import { Button } from "@heroui/react/button";
import { ListBox } from "@heroui/react/list-box";
import { Modal } from "@heroui/react/modal";
import { Pagination } from "@heroui/react/pagination";
import { SearchField } from "@heroui/react/search-field";
import { Select } from "@heroui/react/select";
import { Table } from "@heroui/react/table";
import { toast } from "@heroui/react/toast";

const PAGE_SIZE = 25;
const SEARCH_DEBOUNCE_MS = 300;
const ALL = "all";
const NONE = "none";
const DEFAULT_SORT = { column: "enabledAt", direction: "descending" };
const NUTRITION = "nutrition-plan";
const WORKOUT = "workout-plan";
// Which cell of a row holds each plan type's rule.
const CELL_BY_PLAN = { [NUTRITION]: "nutrition", [WORKOUT]: "workout" };
const HEADER_CLASS = "sticky top-0 z-10 bg-surface-secondary";

// Compact filter dropdown (same look as the queue's own pickers).
function FilterSelect({ label, value, onChange, options }) {
    return (
        <Select aria-label={label} value={value} onChange={onChange} size="sm" variant="secondary">
            <Select.Trigger className="min-w-36 max-w-full">
                <Select.Value />
                <Select.Indicator />
            </Select.Trigger>
            <Select.Popover>
                <ListBox>
                    {options.map((option) => (
                        <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
                            {option.label}
                            <ListBox.ItemIndicator />
                        </ListBox.Item>
                    ))}
                </ListBox>
            </Select.Popover>
        </Select>
    );
}

// Sortable header: the label plus an arrow showing the current direction.
function sortableHeader(label) {
    function SortableHeader({ sortDirection }) {
        return (
            <span className="flex items-center gap-1">
                {label}
                {sortDirection === "ascending" && <ChevronUp size={13} className="text-primary shrink-0" />}
                {sortDirection === "descending" && <ChevronDown size={13} className="text-primary shrink-0" />}
                {!sortDirection && <ChevronsUpDown size={13} className="text-muted-foreground shrink-0 opacity-50" />}
            </span>
        );
    }
    return SortableHeader;
}

// 1 … 4 5 [6] 7 8 … 20 — always the first, last and the neighbours of the current page.
function getPageNumbers(page, lastPage) {
    if (lastPage <= 7) return Array.from({ length: lastPage }, (_, i) => i + 1);
    const pages = [1];
    if (page > 3) pages.push("ellipsis-start");
    for (let p = Math.max(2, page - 1); p <= Math.min(lastPage - 1, page + 1); p++) pages.push(p);
    if (page < lastPage - 2) pages.push("ellipsis-end");
    pages.push(lastPage);
    return pages;
}

// One plan type's agent for one client: pick a person, or "None" to turn that rule off. Saves on change.
// The dropdown only offers people who can produce this plan type; a current agent who no longer qualifies
// (or has since left) is still listed so the cell never shows a blank for a rule that exists.
function AgentCell({ rule, agents, canManage, busy, onChange, labels }) {
    // The API sends { id, name }; the dropdown items read { id, label }.
    const options = [{ id: NONE, label: labels.none }, ...agents.map((agent) => ({ id: agent.id, label: agent.name }))];
    if (rule && !agents.some((agent) => agent.id === rule.agentUserId)) {
        options.push({ id: rule.agentUserId, label: rule.agentName || "—" });
    }
    if (!canManage) return <bdi dir="auto" className="text-sm">{rule?.agentName || "—"}</bdi>;
    return (
        <div className="flex flex-col items-start gap-1">
            <Select
                aria-label={labels.column}
                value={rule?.agentUserId ?? NONE}
                onChange={onChange}
                isDisabled={busy}
                size="sm"
                variant="secondary"
                className="w-48"
            >
                <Select.Trigger>
                    <Select.Value />
                    <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                    <ListBox>
                        {options.map((option) => (
                            <ListBox.Item key={option.id} id={option.id} textValue={option.label}>
                                {option.label}
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                        ))}
                    </ListBox>
                </Select.Popover>
            </Select>
            {rule && !rule.agentAvailable && (
                <span className="flex items-center gap-1 text-xs text-warning" title={labels.unavailableDetail}>
                    <TriangleAlert size={12} className="shrink-0" />
                    {labels.unavailable}
                </span>
            )}
        </div>
    );
}

// One row per client with a nutrition and a training agent, each editable in place. Server-side paging,
// search, filters and sorting keep it fast with thousands of clients. Changing agents or turning rules off is
// owner/manager only (enforced server-side too); everyone else gets a read-only table so an agent can see
// why a form landed on them.
export default function AutoAssignRulesModal({ open, onClose, members, canManage, onRulesChanged, onTurnedOffInBulk }) {
    const t = useTranslations("plansQueue");
    const tFilter = useTranslations("filter");
    const { formatDateTime } = useDateFormatter();
    const [searchText, setSearchText] = useState("");
    const [search, setSearch] = useState("");
    const [agentUserId, setAgentUserId] = useState(ALL);
    const [status, setStatus] = useState(ALL);
    const [sort, setSort] = useState(DEFAULT_SORT);
    const [page, setPage] = useState(1);
    const [data, setData] = useState({ items: [], total: 0, totalRules: 0 });
    const [agents, setAgents] = useState({ nutrition: [], workout: [] });
    const [loading, setLoading] = useState(false);
    // Keys of the cells / rows being saved, so each control disables only itself.
    const [busyKeys, setBusyKeys] = useState(() => new Set());
    const [bulkBusy, setBulkBusy] = useState(false);
    const [error, setError] = useState("");
    const [loadFailed, setLoadFailed] = useState(false);
    // Bumped after a change so the current page is fetched again.
    const [reloadToken, setReloadToken] = useState(0);

    // Debounced, so typing doesn't fire a request per keystroke.
    useEffect(() => {
        const timer = setTimeout(() => { setSearch(searchText.trim()); setPage(1); }, SEARCH_DEBOUNCE_MS);
        return () => clearTimeout(timer);
    }, [searchText]);

    // Who each dropdown may offer; changes rarely, so once per opening is plenty.
    useEffect(() => {
        if (!open) return;
        let stale = false;
        async function loadAgents() {
            try {
                const res = await api.get("/api/forms/queue/auto-assign/agents");
                if (!stale) setAgents(res.data);
            } catch {
                // the dropdowns then only list each row's current agent; the table itself still works
            }
        }
        loadAgents();
        return () => { stale = true; };
    }, [open]);

    useEffect(() => {
        if (!open) return;
        // `stale` guards against a slow earlier request overwriting the answer to a newer filter.
        let stale = false;
        async function load() {
            setLoading(true);
            setLoadFailed(false);
            try {
                const params = {
                    page,
                    pageSize: PAGE_SIZE,
                    sortBy: sort.column,
                    sortDir: sort.direction === "ascending" ? "asc" : "desc",
                };
                if (search) params.search = search;
                if (agentUserId !== ALL) params.agentUserId = agentUserId;
                if (status !== ALL) params.status = status;
                const res = await api.get("/api/forms/queue/auto-assign", { params });
                // Rows are keyed by client (the table needs an `id`).
                if (!stale) setData({ items: res.data.items.map((row) => ({ ...row, id: row.clientId })), total: res.data.total, totalRules: res.data.totalRules });
            } catch {
                if (!stale) setLoadFailed(true);
            }
            if (!stale) setLoading(false);
        }
        load();
        return () => { stale = true; };
    }, [open, search, agentUserId, status, sort, page, reloadToken]);

    const planLabel = (planType) => (planType === NUTRITION ? t("nutrition") : t("workout"));
    const hasFilters = !!search || agentUserId !== ALL || status !== ALL;
    const lastPage = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
    const rangeFrom = data.total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
    const rangeTo = Math.min(page * PAGE_SIZE, data.total);

    // Changing a filter always goes back to page 1.
    const onFilter = (setter) => (value) => { setter(value); setPage(1); };

    function clearFilters() {
        setSearchText("");
        setSearch("");
        setAgentUserId(ALL);
        setStatus(ALL);
        setPage(1);
    }

    function setBusy(key, isBusy) {
        setBusyKeys((previous) => {
            const next = new Set(previous);
            if (isBusy) next.add(key); else next.delete(key);
            return next;
        });
    }

    // A dropdown changed: save right away, then show it in the row without refetching (so rows don't jump
    // around under the cursor). A row left with no rules at all disappears, so that case refetches.
    async function changeAgent(row, planType, value) {
        const key = `${row.clientId}:${planType}`;
        const cell = CELL_BY_PLAN[planType];
        if ((row[cell]?.agentUserId ?? NONE) === value) return;
        setBusy(key, true);
        setError("");
        try {
            const res = await api.put(`/api/forms/queue/auto-assign/clients/${row.clientId}/${planType}`, {
                agentUserId: value === NONE ? null : value,
            });
            const { outcome, rule } = res.data;
            if (outcome === "unchanged") return;
            const updated = { ...row, [cell]: rule };
            onRulesChanged([[key, rule ? { id: rule.id, agentName: rule.agentName } : null]]);
            if (!updated.nutrition && !updated.workout) {
                setReloadToken((n) => n + 1);
            } else {
                const ruleDelta = rule && !row[cell] ? 1 : !rule ? -1 : 0;
                setData((previous) => ({
                    ...previous,
                    totalRules: previous.totalRules + ruleDelta,
                    items: previous.items.map((item) => (item.clientId === row.clientId ? updated : item)),
                }));
            }
            toast.success(rule
                ? t("autoAssignAgentSet", { plan: planLabel(planType), client: row.clientName, agent: rule.agentName || "—" })
                : t("autoAssignAgentCleared", { plan: planLabel(planType), client: row.clientName }));
        } catch {
            toast.danger(t("autoAssignAgentFailed"));
        } finally {
            setBusy(key, false);
        }
    }

    // "Turn off" on a row switches off both of the client's rules.
    async function turnOffClient(row) {
        const key = `${row.clientId}:off`;
        setBusy(key, true);
        setError("");
        try {
            await api.patch(`/api/forms/queue/auto-assign/clients/${row.clientId}/off`);
            onRulesChanged([[`${row.clientId}:${NUTRITION}`, null], [`${row.clientId}:${WORKOUT}`, null]]);
            setReloadToken((n) => n + 1);
            toast.success(t("autoAssignClientOff", { client: row.clientName }));
        } catch {
            toast.danger(t("autoAssignTurnOffFailed"));
        } finally {
            setBusy(key, false);
        }
    }

    // Same filters as the list, so "turn off these" means exactly the rules the manager is looking at. Only
    // offered while a filter is active, so it can never switch off every rule by accident.
    async function turnOffAllMatching() {
        if (!confirm(t("autoAssignTurnOffMatchingConfirm", { count: data.totalRules }))) return;
        setBulkBusy(true);
        setError("");
        try {
            const body = {};
            if (search) body.search = search;
            if (agentUserId !== ALL) body.agentUserId = agentUserId;
            if (status !== ALL) body.status = status;
            await api.post("/api/forms/queue/auto-assign/off-matching", body);
            onTurnedOffInBulk();
            setPage(1);
            setReloadToken((n) => n + 1);
        } catch {
            setError(t("autoAssignTurnOffFailed"));
        }
        setBulkBusy(false);
    }

    const nutritionLabels = { none: t("autoAssignAgentNone"), column: t("autoAssignColNutrition"), unavailable: t("autoAssignStatusUnavailable"), unavailableDetail: t("autoAssignAgentUnavailable") };
    const workoutLabels = { ...nutritionLabels, column: t("autoAssignColWorkout") };

    return (
        <Modal isOpen={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
            <Modal.Backdrop shouldCloseOnInteractOutside={(element) => !element.closest(".popover, .tooltip, .toast-region")}>
                <Modal.Container className="max-sm:p-2">
                    <Modal.Dialog className="flex h-[90dvh] w-[90vw] max-w-none flex-col max-sm:h-[96dvh] max-sm:w-full">
                        <Modal.Header className="shrink-0">
                            <div className="flex min-w-0 flex-col gap-0.5 pe-10">
                                <Modal.Heading>{t("autoAssignRules")}</Modal.Heading>
                                <p className="text-sm font-normal text-muted-foreground">{t("autoAssignRulesDesc")}</p>
                            </div>
                            <Modal.CloseTrigger />
                        </Modal.Header>

                        <Modal.Body className="flex min-h-0 flex-1 flex-col gap-3">
                            {/* pt-1 ps-1: the focus ring of the search field is drawn outside its box and the body clips
                                anything that overflows it, so the toolbar needs that much room above and before it. */}
                            <div className="flex shrink-0 flex-wrap items-center gap-2 pt-1 ps-1">
                                <SearchField
                                    variant="secondary"
                                    value={searchText}
                                    onChange={setSearchText}
                                    onClear={() => setSearchText("")}
                                    aria-label={t("autoAssignSearchPlaceholder")}
                                    className="min-w-56 flex-1"
                                >
                                    <SearchField.Group>
                                        <SearchField.SearchIcon />
                                        <SearchField.Input placeholder={t("autoAssignSearchPlaceholder")} />
                                        <SearchField.ClearButton />
                                    </SearchField.Group>
                                </SearchField>
                                <FilterSelect
                                    label={t("autoAssignFilterAgent")}
                                    value={agentUserId}
                                    onChange={onFilter(setAgentUserId)}
                                    options={[{ id: ALL, label: t("autoAssignAllAgents") }, ...members.map((m) => ({ id: m.id, label: m.name }))]}
                                />
                                <FilterSelect
                                    label={t("autoAssignFilterStatus")}
                                    value={status}
                                    onChange={onFilter(setStatus)}
                                    options={[
                                        { id: ALL, label: t("autoAssignStatusAll") },
                                        { id: "unavailable", label: t("autoAssignStatusUnavailable") },
                                    ]}
                                />
                            </div>

                            <div className="flex shrink-0 items-center gap-3">
                                <span className="text-sm font-medium text-foreground">{t("autoAssignClientsTotal", { count: data.total })}</span>
                                {hasFilters && (
                                    <Button size="sm" variant="ghost" onPress={clearFilters}>{tFilter("clearAll")}</Button>
                                )}
                            </div>

                            {/* The table scrolls inside the modal (both ways on phones); the header row stays pinned. */}
                            <Table className={`flex min-h-0 flex-1 flex-col ${loading ? "opacity-60" : ""}`}>
                                <Table.ScrollContainer className="min-h-0 flex-1 overflow-auto">
                                    <Table.Content
                                        aria-label={t("autoAssignRules")}
                                        aria-busy={loading}
                                        className="min-w-[60rem]"
                                        sortDescriptor={sort}
                                        onSortChange={(descriptor) => { setSort(descriptor); setPage(1); }}
                                    >
                                        <Table.Header>
                                            <Table.Column isRowHeader id="client" allowsSorting className={HEADER_CLASS}>
                                                {sortableHeader(t("autoAssignColClient"))}
                                            </Table.Column>
                                            <Table.Column id="nutritionAgent" allowsSorting className={HEADER_CLASS}>
                                                {sortableHeader(t("autoAssignColNutrition"))}
                                            </Table.Column>
                                            <Table.Column id="workoutAgent" allowsSorting className={HEADER_CLASS}>
                                                {sortableHeader(t("autoAssignColWorkout"))}
                                            </Table.Column>
                                            <Table.Column id="setBy" allowsSorting className={HEADER_CLASS}>
                                                {sortableHeader(t("autoAssignColSetBy"))}
                                            </Table.Column>
                                            <Table.Column id="enabledAt" allowsSorting className={HEADER_CLASS}>
                                                {sortableHeader(t("autoAssignColSetOn"))}
                                            </Table.Column>
                                            {canManage && (
                                                <Table.Column id="actions" className={`${HEADER_CLASS} text-end`}>
                                                    <span className="sr-only">{t("autoAssignColAction")}</span>
                                                </Table.Column>
                                            )}
                                        </Table.Header>
                                        <Table.Body
                                            items={data.items}
                                            renderEmptyState={() => loading ? null : (
                                                <p className="py-10 text-center text-sm italic text-muted-foreground">
                                                    {hasFilters ? t("autoAssignNoMatches") : t("autoAssignNone")}
                                                </p>
                                            )}
                                        >
                                            {(row) => (
                                                <Table.Row id={row.clientId}>
                                                    <Table.Cell>
                                                        {/* items-start: the name and the code share one left (start) edge. A name with dir="auto"
                                                            stretched to full width would right-align when it is Arabic while the code stayed left. */}
                                                        <div className="flex min-w-0 flex-col items-start">
                                                            <bdi dir="auto" className="text-sm font-medium text-foreground">{row.clientName}</bdi>
                                                            <span dir="ltr" className="text-xs text-muted-foreground">#{row.clientCode}</span>
                                                        </div>
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <AgentCell
                                                            rule={row.nutrition}
                                                            agents={agents.nutrition}
                                                            canManage={canManage}
                                                            busy={busyKeys.has(`${row.clientId}:${NUTRITION}`) || busyKeys.has(`${row.clientId}:off`) || bulkBusy}
                                                            onChange={(value) => changeAgent(row, NUTRITION, value)}
                                                            labels={nutritionLabels}
                                                        />
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <AgentCell
                                                            rule={row.workout}
                                                            agents={agents.workout}
                                                            canManage={canManage}
                                                            busy={busyKeys.has(`${row.clientId}:${WORKOUT}`) || busyKeys.has(`${row.clientId}:off`) || bulkBusy}
                                                            onChange={(value) => changeAgent(row, WORKOUT, value)}
                                                            labels={workoutLabels}
                                                        />
                                                    </Table.Cell>
                                                    <Table.Cell>
                                                        <bdi dir="auto" className="text-sm">{row.enabledByName || "—"}</bdi>
                                                    </Table.Cell>
                                                    <Table.Cell className="whitespace-nowrap">{row.enabledAt ? formatDateTime(row.enabledAt) : "—"}</Table.Cell>
                                                    {canManage && (
                                                        <Table.Cell className="text-end">
                                                            <Button size="sm" variant="ghost" isDisabled={busyKeys.has(`${row.clientId}:off`) || bulkBusy} onPress={() => turnOffClient(row)}>
                                                                {t("autoAssignTurnOff")}
                                                            </Button>
                                                        </Table.Cell>
                                                    )}
                                                </Table.Row>
                                            )}
                                        </Table.Body>
                                    </Table.Content>
                                </Table.ScrollContainer>
                            </Table>

                            {(error || loadFailed) && <p className="shrink-0 text-sm text-destructive">{error || t("autoAssignLoadFailed")}</p>}
                        </Modal.Body>

                        <Modal.Footer className="shrink-0 flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                {canManage && hasFilters && data.totalRules > 0 && (
                                    <Button variant="ghost" className="text-destructive" isDisabled={bulkBusy} onPress={turnOffAllMatching}>
                                        {t("autoAssignTurnOffMatching", { count: data.totalRules })}
                                    </Button>
                                )}
                                {data.total > 0 && (
                                    <span className="text-xs text-muted-foreground">{t("autoAssignRange", { from: rangeFrom, to: rangeTo, total: data.total })}</span>
                                )}
                            </div>
                            {lastPage > 1 && (
                                <Pagination size="sm" className="w-auto">
                                    <Pagination.Content>
                                        <Pagination.Item>
                                            <Pagination.Previous isDisabled={page <= 1 || loading} onPress={() => setPage((p) => p - 1)}>
                                                <Pagination.PreviousIcon />
                                                <span className="max-md:hidden">{tFilter("previous")}</span>
                                            </Pagination.Previous>
                                        </Pagination.Item>
                                        {getPageNumbers(page, lastPage).map((entry) => (
                                            <Pagination.Item key={entry}>
                                                {typeof entry === "string" ? (
                                                    <Pagination.Ellipsis />
                                                ) : (
                                                    <Pagination.Link isActive={entry === page} onPress={() => setPage(entry)}>{entry}</Pagination.Link>
                                                )}
                                            </Pagination.Item>
                                        ))}
                                        <Pagination.Item>
                                            <Pagination.Next isDisabled={page >= lastPage || loading} onPress={() => setPage((p) => p + 1)}>
                                                <span className="max-md:hidden">{tFilter("next")}</span>
                                                <Pagination.NextIcon />
                                            </Pagination.Next>
                                        </Pagination.Item>
                                    </Pagination.Content>
                                </Pagination>
                            )}
                        </Modal.Footer>
                    </Modal.Dialog>
                </Modal.Container>
            </Modal.Backdrop>
        </Modal>
    );
}
