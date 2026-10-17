"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Skeleton } from "@heroui/react/skeleton";
import { Button } from "@heroui/react/button";
import api from "@/lib/axios";
import { useDateFormatter } from "@/utils/useDateFormatter";
import { CalendarClock, Clock, Eye, Inbox, Pencil, Plus, Scale, UserX } from "lucide-react";
import KpiTrendCards, { StatCard } from "@/app/components/operations/KpiTrendCards";
import OpsTable from "@/app/components/operations/OpsTable";
import InfoTooltip from "@/app/components/InfoTooltip";
import NewFeatureTooltip from "@/app/components/NewFeatureTooltip";
import { openQueueWithFilters } from "@/app/components/operations/queueDrilldown";
import DemandTrendChart from "@/app/components/operations/DemandTrendChart";
import FinishedPlans from "@/app/components/operations/FinishedPlans";
import ServiceLevelPanel from "@/app/components/operations/ServiceLevelPanel";
import Section from "@/app/components/operations/Section";
import TrendRangeControls from "@/app/components/operations/TrendRangeControls";
import { useTrendRange } from "@/app/components/operations/useTrendRange";
import CapacityEditModal from "@/app/components/operations/CapacityEditModal";
import WorkloadSummary from "@/app/components/operations/WorkloadSummary";
import SetupGuide from "@/app/components/operations/SetupGuide";
import HowItWorksModal from "@/app/components/operations/HowItWorksModal";
import AssignWaitingModal from "@/app/components/operations/AssignWaitingModal";
import { SUGGESTED_DAILY_CAPACITY, findMostRoom } from "@/app/components/operations/workloadInsights";
import { formatDaysOff } from "@/app/components/operations/weekdays";


// First-visit tour: one tip per anchor, shown in order, each remembered once dismissed.
const TOUR = [
    { key: "ops_tour_status", message: "walkStatus" },
    { key: "ops_tour_who", message: "walkWho" },
];

function firstUnseenTourStep() {
    if (typeof window === "undefined") return TOUR.length;
    try {
        const index = TOUR.findIndex((step) => !localStorage.getItem(`ff_seen_feature_hint_${step.key}`));
        return index === -1 ? TOUR.length : index;
    } catch {
        return TOUR.length;   // storage unavailable: skip the tour rather than show it every time
    }
}

const STATUS_STYLE = {
    healthy:    { chip: "bg-green-500/15 text-green-600", bar: "bg-green-500" },
    tight:      { chip: "bg-amber-500/15 text-amber-600", bar: "bg-amber-500" },
    overloaded: { chip: "bg-destructive/10 text-destructive", bar: "bg-destructive" },
};

function StatusChip({ status }) {
    const t = useTranslations("operations");
    if (!status) return <Chip size="sm" className="bg-secondary text-muted-foreground">{t("statusUnknown")}</Chip>;
    return <Chip size="sm" className={`whitespace-nowrap ${STATUS_STYLE[status].chip}`}>{t(`status_${status}`)}</Chip>;
}

// Capped at 100% so an overloaded bar fills its track instead of overflowing it;
// the exact percentage is always printed beside it.
function UtilizationBar({ pct, status }) {
    const width = pct === null ? 0 : Math.min(pct, 100);
    return (
        <div className="h-2 w-full rounded-full bg-default/60 overflow-hidden" role="presentation">
            <div className={`h-full rounded-full ${status ? STATUS_STYLE[status].bar : "bg-muted"}`} style={{ width: `${width}%` }} />
        </div>
    );
}

function LoadCell({ load }) {
    const t = useTranslations("operations");
    return (
        // Two separate boxes, not inline text: in Arabic the total and the split's first number would otherwise merge into one.
        <span className="inline-flex flex-wrap items-baseline gap-x-2 tabular-nums">
            <bdi>{load.total}</bdi>
            <bdi className="text-xs text-muted-foreground">
                {t("loadSplit", { nutrition: load.nutrition, workout: load.workout })}
            </bdi>
        </span>
    );
}

// Capacity cell, in the style of HeroUI's table examples: the number as plain bold text with a muted unit, the
// weekdays off as a small soft chip, and an icon button to edit (a "Set limit" button when nothing is set yet).
// Editing opens the capacity sheet / modal, which also shows the change history. A HeroUI Button's press does
// not reach the row, so the row's queue drill-down does not also fire.
function CapacityCell({ row, onEdit }) {
    const t = useTranslations("operations");
    const locale = useLocale();
    const isSet = row.capacity.total !== null;
    const daysOffText = formatDaysOff(locale, row.daysOff);

    if (!isSet) {
        return (
            <Button variant="secondary" size="sm" onPress={() => onEdit(row)}>
                <Plus size={14} aria-hidden="true" />
                {t("setCapacity")}
            </Button>
        );
    }

    return (
        <span className="inline-flex items-center gap-2">
            <span className="whitespace-nowrap">
                <span className="text-base font-semibold tabular-nums text-foreground">{row.capacity.total}</span>
                <span className="ms-1 text-xs text-muted-foreground">{t("capacityUnit")}</span>
            </span>
            {daysOffText && (
                <Chip size="sm" variant="soft" className="whitespace-nowrap">
                    <Chip.Label>{t("daysOffShort", { days: daysOffText })}</Chip.Label>
                </Chip>
            )}
            <Button variant="ghost" size="sm" isIconOnly onPress={() => onEdit(row)} aria-label={t("editCapacity")}>
                <Pencil size={14} aria-hidden="true" />
            </Button>
        </span>
    );
}

function HeaderWithHint({ children, hint }) {
    return (
        <span className="inline-flex items-center gap-0.5">
            {children}
            <InfoTooltip text={hint} />
        </span>
    );
}

function TrainerTable({ data, mostRoomUserId, onOpen, onEditCapacity, wrapTitle }) {
    const t = useTranslations("operations");

    // Three kinds of row: people with a limit, people without one (listed so their plans are not lost), and
    // two summary rows ("nobody picked up yet" and "assigned to someone who cannot take work") that stay at
    // the bottom whatever the sort.
    const rows = [
        ...data.trainers.map((row) => ({ ...row, id: row.userId, kind: "trainer" })),
        ...data.notConfigured.map((row) => ({ ...row, id: row.userId, kind: "unset", capacity: { total: null }, utilizationPct: null, status: null })),
    ];
    const footerRows = [];
    if (data.unassigned.load.total > 0) footerRows.push({ id: "__unassigned__", kind: "unassigned", load: data.unassigned.load });
    if (data.otherAssigned > 0) footerRows.push({ id: "__other__", kind: "other", clickable: false, load: { total: data.otherAssigned, nutrition: 0, workout: 0 } });

    const isOffWholeWindow = (row) => row.kind === "trainer" && row.capacity.total !== null && row.workingDaysInHorizon === 0;
    const isPerson = (row) => row.kind === "trainer" || row.kind === "unset";

    const columns = [
        {
            key: "name", label: t("colTrainer"), sortable: true, sortValue: (row) => row.name,
            render: (row) => {
                if (row.kind === "unassigned") return <span className="italic text-muted-foreground">{t("unassignedRow")}</span>;
                if (row.kind === "other") return <span className="italic text-muted-foreground">{t("otherAssignedRow")}</span>;
                return (
                    <span className="font-medium text-foreground">
                        {row.name}
                        {row.isOwner && <span className="ms-1.5 text-[10px] text-muted-foreground">{t("ownerBadge")}</span>}
                        {mostRoomUserId === row.userId && (
                            // Under the name on a phone (it never wraps onto two lines), beside it on wider screens.
                            <span className="mt-1 block sm:ms-2 sm:mt-0 sm:inline">
                                <Chip size="sm" className="bg-green-500/15 text-green-600 whitespace-nowrap">{t("mostRoom")}</Chip>
                            </span>
                        )}
                    </span>
                );
            },
        },
        {
            key: "capacity", label: <HeaderWithHint hint={t("colCapacityHint")}>{t("colCapacity")}</HeaderWithHint>,
            sortable: true, sortValue: (row) => row.capacity?.total ?? null,
            render: (row) => (isPerson(row) ? <CapacityCell row={row} onEdit={onEditCapacity} /> : <span className="text-muted-foreground">—</span>),
        },
        {
            key: "load", label: t("colLoad"), sortable: true, sortValue: (row) => row.load.total,
            render: (row) => (row.kind === "other" ? row.load.total : <LoadCell load={row.load} />),
        },
        {
            key: "utilization", label: <HeaderWithHint hint={t("colUtilizationHint", { days: data.utilization.targetDays })}>{t("colUtilization")}</HeaderWithHint>,
            sortable: true, sortValue: (row) => row.utilizationPct ?? null,
            render: (row) => {
                if (isOffWholeWindow(row)) return <span className="text-xs text-muted-foreground">{t("offInWindow")}</span>;
                if (row.kind !== "trainer") return <span className="text-muted-foreground">—</span>;
                return (
                    <div className="flex items-center gap-2 min-w-36">
                        <UtilizationBar pct={row.utilizationPct} status={row.status} />
                        <span className="tabular-nums text-xs w-12 text-end">{row.utilizationPct === null ? "—" : `${row.utilizationPct}%`}</span>
                    </div>
                );
            },
        },
        {
            key: "status", label: t("colStatus"),
            render: (row) => (isPerson(row) && !isOffWholeWindow(row) ? <StatusChip status={row.status} /> : null),
        },
    ];

    return (
        <div className="flex flex-col gap-2">
            <div>
                <div className="flex items-center gap-1">
                    {wrapTitle(<h3 className="text-sm font-semibold text-foreground">{t("trainersTitle")}</h3>)}
                    <InfoTooltip text={t("trainersHint")} />
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">{t("trainersSubtitle", { days: data.horizonDays })}</p>
            </div>
            {rows.length === 0 && footerRows.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("noTrainers")}</p>
            ) : (
                <OpsTable
                    ariaLabel={t("trainersTitle")} columns={columns} rows={rows} footerRows={footerRows} scroll="x"
                    defaultSort={{ key: "load", direction: "descending" }}
                    onRowClick={(row) => onOpen({ assignedTo: row.kind === "unassigned" ? null : row.userId })}
                />
            )}
        </div>
    );
}

// What a trainer/nutritionist gets: their own row, nothing about colleagues or totals.
function SelfView({ data, onOpen }) {
    const t = useTranslations("operations");
    const me = data.me;
    return (
        <Card className="rounded-xl max-w-xl">
            <Card.Content className="p-5 flex flex-col gap-3">
                <h3 className="text-sm font-semibold text-foreground">{t("myLoadTitle")}</h3>
                {!me ? (
                    <p className="text-sm text-muted-foreground">{t("myLoadEmpty")}</p>
                ) : (
                    <>
                        <div className="flex items-baseline justify-between gap-3">
                            <p className="text-3xl font-bold tabular-nums text-foreground">{me.load.total}</p>
                            <StatusChip status={me.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">{t("loadSplit", { nutrition: me.load.nutrition, workout: me.load.workout })}</p>
                        {me.capacity.total !== null ? (
                            <div className="flex items-center gap-2">
                                <UtilizationBar pct={me.utilizationPct} status={me.status} />
                                <span className="tabular-nums text-xs w-12 text-end">{me.utilizationPct === null ? "—" : `${me.utilizationPct}%`}</span>
                            </div>
                        ) : (
                            <p className="text-xs text-muted-foreground">{t("myCapacityNotSet")}</p>
                        )}
                        <Button variant="ghost" className="self-start" onClick={() => onOpen({ assignedTo: me.userId })}>
                            {t("viewInQueue")}
                        </Button>
                    </>
                )}
            </Card.Content>
        </Card>
    );
}

export default function OperationsTab() {
    const t = useTranslations("operations");
    const router = useRouter();
    const { workspaceSlug } = useParams();
    const { formatDate } = useDateFormatter();
    const range = useTrendRange(30);   // the page-wide period: drives every chart and the service level

    const [helpOpen, setHelpOpen] = useState(false);
    const [assigning, setAssigning] = useState(null);     // { userId, name, canTake }
    const [editingRow, setEditingRow] = useState(null);   // trainer row whose capacity is being edited
    const [tourStep, setTourStep] = useState(firstUnseenTourStep);
    // Bumped after anything that changes capacity or assignments, so the charts reload too.
    const [refreshToken, setRefreshToken] = useState(0);
    const [data, setData] = useState(null);
    const [error, setError] = useState(false);

    const load = useCallback(async () => {
        // The "right now" numbers always look at today: can the team finish what is waiting using today's capacity?
        const params = { timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone };
        try {
            const res = await api.get("/api/operations/summary", { params });
            setData(res.data);
            setError(false);
        } catch {
            setError(true);
        }
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- initial/filtered fetch on mount and on filter change
        load();
    }, [load]);

    const reloadAll = useCallback(() => {
        load();
        setRefreshToken((token) => token + 1);
    }, [load]);

    const openQueue = (extra) => openQueueWithFilters(router, workspaceSlug, extra);

    function tourAnchor(index, node) {
        const step = TOUR[index];
        return (
            <NewFeatureTooltip
                featureKey={step.key}
                active={tourStep === index}
                message={t(step.message)}
                dismissLabel={index < TOUR.length - 1 ? t("walkNext") : t("walkDone")}
                badgeLabel={t("walkBadge", { step: index + 1, total: TOUR.length })}
                onDismiss={() => setTourStep(index + 1)}
                triggerClassName="inline-flex text-start cursor-pointer"
            >
                {node}
            </NewFeatureTooltip>
        );
    }

    if (error && !data) {
        return (
            <div className="rounded-xl border border-dashed border-border py-10 text-center flex flex-col items-center gap-3">
                <p className="text-sm text-muted-foreground">{t("loadFailed")}</p>
                <Button variant="ghost" onClick={load}>{t("retry")}</Button>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="flex flex-col gap-4">
                <Skeleton className="h-28 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
                <Skeleton className="h-56 rounded-xl" />
            </div>
        );
    }

    if (data.scope === "self") {
        return (
            <div className="flex flex-col gap-5">
                <SelfView data={data} onOpen={(extra) => openQueueWithFilters(router, workspaceSlug, extra)} />
                <TrendRangeControls range={range} />
                <FinishedPlans range={range} refreshToken={refreshToken} />
            </div>
        );
    }

    const { demand, capacity, utilization, aging } = data;
    const gapIsShortfall = utilization.gap !== null && utilization.gap < 0;
    const mostRoom = findMostRoom(data);


    function handleHintAction(hint) {
        if (hint.action === "assign") setAssigning(hint.assign);
        else if (hint.action === "openUnassigned") openQueue({ assignedTo: null });
        else openQueue({});
    }

    return (
        <div className="flex flex-col gap-6 sm:gap-8 min-w-0 max-w-full">
            {/* The one period filter for the whole page. It stays pinned to the top while the page scrolls, so the
                period can be changed from anywhere. Instead of a border, the bar is solid at the top and fades out
                downward, so scrolling content dissolves under it. The fade itself ignores the pointer (so it never
                blocks what is underneath); only the controls row takes clicks. The page padding is cancelled so the
                bar spans edge to edge, and the negative bottom margin gives back the room the fade adds. */}
            <div className="sticky top-0 z-40 -mx-4 sm:-mx-8 -mb-4 sm:-mb-6 px-4 sm:px-8 pt-2 sm:pt-3 pb-5 sm:pb-8 bg-linear-to-b from-background from-65% to-transparent pointer-events-none">
                <div className="flex items-center justify-between gap-3 pointer-events-auto">
                    <span className="hidden sm:inline-flex items-center gap-1 text-sm font-medium text-foreground">
                        {t("periodLabel")}
                        <InfoTooltip text={t("periodNote")} />
                    </span>
                    <TrendRangeControls range={range} />
                </div>
            </div>

            {/* First-time setup gets its own full-width row right under the period bar, so it is the first thing a new
                coach sees; it disappears once at least one person has a daily limit. */}
            {capacity.countedTrainers === 0 && (
                <SetupGuide
                    hasUnsetMembers={data.notConfigured.length > 0}
                    onDone={reloadAll}
                    onSetOwnLimit={() => setEditingRow({ isOwner: true, name: data.owner.name, userId: data.owner.userId, capacity: { total: null }, daysOff: [] })}
                />
            )}

            {/* The summary (1/3) beside the requests chart (2/3); they stack on narrower screens. */}
            <div className="grid grid-cols-1 *:min-w-0 gap-6 xl:grid-cols-3 items-stretch">
                <div className="flex flex-col gap-5">
                    <div className="flex-1 [&>*]:h-full">
                        <WorkloadSummary
                            summary={data}
                            onAction={handleHintAction}
                            onOpenHelp={() => setHelpOpen(true)}
                            wrapStatus={(node) => tourAnchor(0, node)}
                        />
                    </div>
                </div>
                <div className="xl:col-span-2">
                    <DemandTrendChart range={range} refreshToken={refreshToken} />
                </div>
            </div>

            <Section
                first
                title={t("secNow")}
                description={t("secNowDesc")}
            >
                <KpiTrendCards summary={data} refreshToken={refreshToken} />

                {/* Then what is waiting: room, check-ins, what is coming, and how long clients have waited. */}
                <div className="flex flex-col gap-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        <h3 className="text-sm font-semibold text-foreground">{t("secWaiting")}</h3>
                        <Button variant="secondary" size="sm" onClick={() => openQueue({})}>{t("viewInQueue")}</Button>
                    </div>
                    <div className="grid grid-cols-2 *:min-w-0 gap-2.5 sm:gap-4 xl:grid-cols-4">
                        <StatCard
                            icon={Scale}
                            label={gapIsShortfall ? t("kpiShortfall") : t("kpiSpare")}
                            hint={gapIsShortfall ? t("kpiShortfallHint") : t("kpiSpareHint")}
                            value={utilization.gap === null ? "—" : `${Math.abs(utilization.gap)} ${t("unitPlans")}`}
                            hideDelta noChart
                        />
                        <StatCard
                            icon={Eye}
                            label={t("kpiReviewOnly")} hint={t("kpiReviewOnlyHint")}
                            value={demand.reviewOnly} caption={t("kpiReviewOnlyCaption")}
                            hideDelta noChart
                        />
                        <StatCard
                            icon={Inbox}
                            label={t("kpiIncoming")} hint={t("kpiIncomingHint")}
                            value={demand.incoming} caption={t("kpiIncomingCaption")}
                            hideDelta noChart
                        />
                        <StatCard
                            icon={UserX}
                            label={t("kpiUnassigned")} hint={t("kpiUnassignedHint")}
                            value={demand.unassigned}
                            hideDelta noChart
                        />
                        <StatCard
                            icon={CalendarClock}
                            label={t("agingOldest")} hint={t("agingHint")}
                            value={aging.oldestSubmittedAt ? formatDate(aging.oldestSubmittedAt) : "—"}
                            hideDelta noChart
                        />
                        <StatCard icon={Clock} label={t("agingOver1")} value={aging.over1d} hideDelta noChart />
                        <StatCard icon={Clock} label={t("agingOver3")} value={aging.over3d} hideDelta noChart />
                        <StatCard icon={Clock} label={t("agingOver7")} value={aging.over7d} hideDelta noChart />
                    </div>
                </div>
                <TrainerTable
                    data={data}
                    mostRoomUserId={mostRoom?.userId}
                    onOpen={openQueue}
                    onEditCapacity={setEditingRow}
                    wrapTitle={(node) => tourAnchor(1, node)}
                />
            </Section>

            <Section
                title={t("secTime")}
                description={t("secTimeDesc")}
            >
                <FinishedPlans range={range} refreshToken={refreshToken} />
            </Section>

            <ServiceLevelPanel
               
                range={range}
                refreshToken={refreshToken}
            />

            {editingRow && (
                <CapacityEditModal
                    name={editingRow.name}
                    userId={editingRow.userId}
                    currentValue={editingRow.capacity.total}
                    currentDaysOff={editingRow.daysOff ?? []}
                    suggestedValue={editingRow.capacity.total === null ? SUGGESTED_DAILY_CAPACITY : undefined}
                    endpoint={editingRow.isOwner
                        ? "/api/operations/capacity/owner"
                        : `/api/operations/capacity/members/${editingRow.memberId}`}
                    hint={editingRow.isOwner ? t("ownerCapacityHint") : undefined}
                    onClose={() => setEditingRow(null)}
                    onSaved={reloadAll}
                />
            )}
            {helpOpen && <HowItWorksModal onClose={() => setHelpOpen(false)} />}
            {assigning && <AssignWaitingModal assignee={assigning} onClose={() => setAssigning(null)} onDone={reloadAll} />}
        </div>
    );
}
