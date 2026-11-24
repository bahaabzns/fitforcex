"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Salad, Dumbbell, Check, Undo2, UserPlus, ListChecks, Ban, X, Archive, Target, FileText, ClipboardList, Package, Users, Activity, Eye, Tag, Settings, Repeat, UserX } from "lucide-react";
import api from "@/lib/axios";
import { useDateFormatter } from "@/utils/useDateFormatter";
import DataTable from "@/app/components/DataTable";
import ActionBar from "@/app/components/ActionBar";
import { Avatar } from "@heroui/react/avatar";
import { Button } from "@heroui/react/button";
import { Chip } from "@heroui/react/chip";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";
import { Separator } from "@heroui/react/separator";
import { Skeleton } from "@heroui/react/skeleton";
import { Tooltip } from "@heroui/react/tooltip";
import { toast } from "@heroui/react/toast";
import { useLocale, useTranslations } from "next-intl";
import { getLocalizedField } from "@/utils/localization";
import { getInitials } from "@/utils/initials";
import { useSheetUi } from "@/hooks/useSheetUi";
import NewFeatureTooltip from "@/app/components/NewFeatureTooltip";
import AnswerBody from "@/app/components/forms/AnswerBody";
import Modal from "@/app/components/Modal";
import DemoBadge from "@/app/components/demo/DemoBadge";
import ManageLabelsModal, { LABEL_COLOR_CLASSES, LABEL_COLOR_SWATCH } from "@/app/components/plansQueue/ManageLabelsModal";
import PlansQueueSkeleton from "@/app/components/plansQueue/PlansQueueSkeleton";
import { plansQueuePersistKey } from "@/app/components/plansQueue/persistKey";
import { fetchMatchingQueueRows, usePlansQueueRows, usePlansQueueSummary } from "@/app/components/plansQueue/usePlansQueue";

// "assessment" → "Assessment", "check-in" → "Check-in"
function titleCaseType(type) {
    if (!type) return "";
    return type.charAt(0).toUpperCase() + type.slice(1);
}

// Deliberately disjoint from the purple/amber/accent/emerald/zinc already used
// for Type and Action chips in this table, so a package chip never reads as
// one of those. Cycles (reused) once distinct package count exceeds this —
// there's no way to guarantee uniqueness past a finite palette.
// Plan types an "auto-assign next time" rule can cover (same values as client_auto_assign.plan_type).
const PLAN_ACTIONS = ["nutrition-plan", "workout-plan"];

const PACKAGE_CHIP_COLORS = [
    "bg-pink-500/20 text-pink-400",
    "bg-cyan-500/20 text-cyan-400",
    "bg-orange-500/20 text-orange-400",
    "bg-teal-500/20 text-teal-400",
    "bg-indigo-500/20 text-indigo-400",
    "bg-rose-500/20 text-rose-400",
    "bg-lime-500/20 text-lime-400",
    "bg-sky-500/20 text-sky-400",
    "bg-fuchsia-500/20 text-fuchsia-400",
    "bg-violet-500/20 text-violet-400",
];

// Always-visible row action, fully rounded (same radius as the toolbar's
// filter buttons). `className` supplies the per-action filled tone (bg +
// text). Compact icon-only circle by default (label shown as a tooltip);
// `showLabel` renders the primary actions (make a plan, mark reviewed) as a
// pill with the label text visible; `padded` is a slightly bigger icon-only
// circle (e.g. Archive) — equal padding on every side so it stays a true
// circle rather than stretching into an oval.
function IconAction({ label, onClick, disabled, className = "", children, showLabel = false, padded = false }) {
    const sizeClasses = showLabel ? "px-2.5 py-1.5" : padded ? "p-2" : "p-1.5";
    const button = (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            aria-label={label}
            className={`flex items-center gap-1.5 rounded-full transition-colors disabled:opacity-50 cursor-pointer ${sizeClasses} ${showLabel ? "text-sm font-medium whitespace-nowrap" : ""} ${className}`}
        >
            {children}
            {showLabel && <span>{label}</span>}
        </button>
    );

    if (showLabel) return button;

    return (
        <Tooltip>
            {button}
            <Tooltip.Content>{label}</Tooltip.Content>
        </Tooltip>
    );
}

// Initials badge + two-line member option: name on top, current "Need
// Action" workload below — lets a manager see who's overloaded right in the
// assignment dropdown instead of having to cross-reference a separate report.
// flex-1 + truncate on both lines keeps long names/counts from spilling past
// the item's own checkmark reservation (see globals.css's
// .select__popover [data-slot="list-box-item"]:has(...) override for why
// that reservation needs restating at all).
function MemberOptionLabel({ name, count, needActionLabel }) {
    return (
        <div className="flex items-center gap-2 min-w-0 flex-1">
            <Avatar variant="soft" color="accent" className="w-6 h-6 text-[10px] font-bold shrink-0">
                <Avatar.Fallback>{getInitials(name)}</Avatar.Fallback>
            </Avatar>
            <div className="flex flex-col min-w-0 items-start">
                <span className="truncate">{name}</span>
                <span className="truncate text-[11px] text-muted-foreground">{needActionLabel} &middot; {count}</span>
            </div>
        </div>
    );
}

// "Unassigned" shown with an avatar-sized slot like the people below it, so every option's text starts on the
// same edge instead of "Unassigned" sitting further left than the names.
function UnassignedOptionLabel({ label }) {
    return (
        <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="flex w-6 h-6 shrink-0 items-center justify-center rounded-full bg-default text-muted-foreground">
                <UserX size={13} />
            </span>
            <span className="truncate">{label}</span>
        </div>
    );
}

// The option list shared by the row's "Assigned" dropdown and the bulk bar's assign dropdown. A plain function
// (not a component) so the ListBox sees the items directly.
function renderAssigneeOptions({ members, needActionCountByAssignee, t }) {
    return [
        <ListBox.Item key="none" id="none" textValue={t('unassigned')}>
            <UnassignedOptionLabel label={t('unassigned')} />
            <ListBox.ItemIndicator />
        </ListBox.Item>,
        ...members.map((m) => (
            <ListBox.Item key={m.id} id={m.id} textValue={m.name}>
                <MemberOptionLabel name={m.name} count={needActionCountByAssignee.get(m.id) ?? 0} needActionLabel={t('needAction')} />
                <ListBox.ItemIndicator />
            </ListBox.Item>
        )),
    ];
}

// A row has answers to preview when the server counted some (list loaded with ?answers=lazy), or when it
// arrived with the answers themselves (the full-list shape).
function hasAnswers(row) {
    return (row.responseCount ?? row.responses?.length ?? 0) > 0;
}

// Wide enough for a name plus its "Need Action · n" line, with a slim scrollbar that doesn't sit on the rounded edge.
const ASSIGNEE_POPOVER_CLASS = "min-w-60 [scrollbar-width:thin] [scrollbar-color:var(--color-border)_transparent]";

// Full-detail preview of a row's submitted answers, opened from a single
// icon button in the actions column (between the primary/undo action and
// Archive) — a large modal rather than a popover since answers can include
// images/attachments that need real room. Only rendered by the caller for
// rows that actually have answers (need-action/action-done); awaiting/
// scheduled rows have none yet (see getQueue in forms.controller.ts). One
// instance for the whole table, driven by previewOpenId, so opening one
// row's preview implicitly closes any other row's.
//
// The queue list is loaded with ?answers=lazy (rows carry only a count), so a row's answers usually aren't in
// `responses` yet: this modal fetches them for that one request when it opens. Rows that already carry their
// answers (the older full-list shape) skip the request.
function AnswerPreviewModal({ open, onClose, requestId, responses, locale, heading, formTitle }) {
    const t = useTranslations('plansQueue');
    const needsFetch = responses.length === 0;
    const [loaded, setLoaded] = useState({ requestId: null, responses: [], failed: false });
    const [retryToken, setRetryToken] = useState(0);
    const isLoaded = loaded.requestId === requestId;

    useEffect(() => {
        if (!needsFetch) return;
        let cancelled = false;
        api.get(`/api/forms/queue/${requestId}/responses`)
            .then((res) => { if (!cancelled) setLoaded({ requestId, responses: res.data || [], failed: false }); })
            .catch(() => { if (!cancelled) setLoaded({ requestId, responses: [], failed: true }); });
        return () => { cancelled = true; };
    }, [needsFetch, requestId, retryToken]);

    const shown = needsFetch ? (isLoaded ? loaded.responses : []) : responses;
    const failed = needsFetch && isLoaded && loaded.failed;
    const isLoading = needsFetch && !isLoaded;

    return (
        <Modal open={open} onClose={onClose} title={formTitle ? `${heading} — ${formTitle}` : heading} size="xl">
            <div className="flex flex-col gap-4">
                {isLoading && (
                    <div role="status" aria-busy="true" className="flex flex-col gap-4">
                        <span className="sr-only">{t('loadingAnswers')}</span>
                        {[0, 1, 2].map((i) => (
                            <div key={i} className="flex flex-col gap-1.5" aria-hidden="true">
                                <Skeleton className="h-3 w-40 rounded" />
                                <Skeleton className="h-4 w-full rounded" />
                            </div>
                        ))}
                    </div>
                )}
                {failed && (
                    <div className="flex flex-col items-start gap-2">
                        <p className="text-sm text-destructive">{t('answersLoadFailed')}</p>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                                setLoaded({ requestId: null, responses: [], failed: false });
                                setRetryToken((n) => n + 1);
                            }}
                        >
                            {t('answersRetry')}
                        </Button>
                    </div>
                )}
                {shown.map((r, i) => (
                    <div key={r.id ?? i} className="flex flex-col gap-1.5">
                        <span className="text-muted-foreground text-xs font-medium">{getLocalizedField(r, 'label', locale) || `Q${i + 1}`}</span>
                        <AnswerBody response={r} />
                    </div>
                ))}
            </div>
        </Modal>
    );
}

export default function PlansQueueTable({
    // Which rows this table lists: "need-action" (Main) or "all" (Submission History). The table fetches them
    // itself, one page at a time, with the search/filters/sort the coach picks done on the server.
    view,
    // The row the coach just finished in a builder (asked for once, so its completion animation can play), and a
    // counter the page bumps to make the table refetch (after a restore, or turning off auto-assign rules in bulk).
    includeId = null, reloadToken = 0,
    forms, members = [],
    labels = [], canManageLabels = false, onLabelsChange = async () => {},
    // "Auto-assign next time" (see AutoAssignRulesModal). Each row arrives with its own rule (autoAssignRuleId /
    // autoAssignAgentName); the page owns the switch and the instant-update overrides so Main and History agree.
    autoAssignOnAssign = false, autoRuleOverrides = {}, onAutoRuleOverrides = () => {},
    canManageAutoAssign = false, onAutoAssignChange = () => {},
    hideStatusColumn = false, hideActionTakenColumn = false,
    title, description, headerAction,
    // The just-completed submission id, already claimed once (Strict-Mode-safe,
    // URL already stripped) by plans-queue/page.js — see that file for why the
    // claim lives there now: it also owns the Main queue's temporary retention
    // of this row, so it needs to know when the exit animation below has
    // actually finished, not just when the row started reacting to it.
    completingId = null,
    onCompletionDone,
    // Called once the first page of rows has arrived (the page uses it to restore a remembered scroll position).
    onLoaded,
}) {
    const t = useTranslations('plansQueue');
    const locale = useLocale();
    const { formatDateTime } = useDateFormatter();
    // On a phone the assignee and label pickers (and the dialogs) open as bottom sheets.
    useSheetUi();

    // One page of rows from the server, plus the numbers the table used to derive from "every row" (per-assignee
    // workload, the package/form filter options). Edits made here (assign, label, review) are layered on top of
    // the fetched rows as the overlays below, so they show instantly without a refetch.
    const { rows, total, includedItem, error: loadError, isFetching, onQueryChange, refetch } = usePlansQueueRows({ view, includeId, reloadToken });
    const { summary, refresh: refreshSummary } = usePlansQueueSummary({ view, reloadToken });
    // Full row data for completingId, only needed on Main: its status has already flipped to action-done by the
    // time we're back here, so the need-action list doesn't contain it — the server returns it on the first load.
    const completingItem = hideStatusColumn ? includedItem : null;
    useEffect(() => {
        if (total !== null) onLoaded?.();
        // eslint-disable-next-line react-hooks/exhaustive-deps -- fires when the first page lands; onLoaded identity changes every render
    }, [total !== null]);
    // Per-row review overrides (id → { status, actionTakenAt }), same idea as assignMap below.
    const [statusMap, setStatusMap] = useState({});
    const [marking, setMarking] = useState(false);
    // Per-row assignee overrides applied on top of the server data (id → { assignedTo, assignedToName }).
    const [assignMap, setAssignMap] = useState({});
    // Per-row label override — just the id (not a name/color snapshot), so a
    // row's displayed label is always re-resolved against the current
    // `labels` list in withDerived below. This is what makes renaming,
    // recoloring, or deleting a label reflect instantly on every row that
    // has it, with no extra sync effect: name/color are never stored
    // anywhere except on the label itself, so they can't go stale.
    const [labelMap, setLabelMap] = useState({});
    const [manageLabelsOpen, setManageLabelsOpen] = useState(false);
    const router = useRouter();
    const { workspaceSlug } = useParams();
    // hideStatusColumn is 1:1 with which builder-return button was clicked
    // (see the nutrition/workout IconAction onClick below) — round-tripped
    // through the builder as ?returnTo= so the coach lands back on whichever
    // view they actually left, instead of guessing from the item's status.
    const returnToView = hideStatusColumn ? "main" : "history";

    // The row the coach just finished acting on plays one of two treatments:
    //
    // Main (hideStatusColumn) is a "what still needs doing" list — a
    // completed item structurally doesn't belong there anymore, so it plays
    // a brief success flash, then collapses out (rowTransition, below), then
    // hands a short highlight to whatever's now next in line.
    //
    // History keeps every status forever, so a completed item legitimately
    // stays — it gets the older, simpler highlight-then-fade (highlightId)
    // with no removal.
    //
    // completingId only changes value once per real navigation (page.js
    // claims it exactly once), so unlike the old claim logic that used to
    // live here, Strict Mode double-invoking THIS effect is harmless: both
    // invocations compute identical initial state from the same stable prop
    // — no external mutation between them the way the URL used to be. Only
    // the nested timer chain needs the cancel guard, so a discarded instance
    // can't fire onCompletionDone or schedule the next-item highlight twice.
    const [rowTransition, setRowTransition] = useState(null); // { key, phase: "celebrate" | "exit" } — Main only
    const [highlightId, setHighlightId] = useState(null); // History's fade highlight, and Main's next-item cue
    const filteredItemsRef = useRef([]);

    // Adjusted during render (not an effect) the moment completingId changes —
    // same pattern as DataTable.js's prevHighlightKey: React's own supported
    // way to kick off state in response to a prop change without an effect,
    // and unlike an effect, this is safe under Strict Mode's double-render by
    // construction (render-phase code is expected to be pure/idempotent —
    // recomputing the same celebrate/highlight state twice is a no-op). The
    // rest of the sequence (still driven by the effect below) is pure timer
    // scheduling, not a synchronous setState call, so it doesn't hit the
    // same concern.
    // On Main, wait for completingItem to actually match completingId before
    // kicking anything off. completingId is claimed via a setTimeout(0) in
    // page.js — fast — while completingItem depends on that page's queueItems
    // fetch finishing — a real network request, almost always slower. If
    // highlightId (below) fired first, DataTable's highlightKey page-jump
    // effect (which only ever re-evaluates once per highlightKey value — see
    // its prevHighlightKey guard in DataTable.js) would run while the row
    // isn't in allItems yet, find nothing, and never get a second chance —
    // the row would then render on whatever page happened to already be
    // showing instead of the one it actually landed on, which is exactly
    // how "the completed row silently doesn't fade out" looks in practice:
    // it's sitting off-screen, animating right on schedule, just not where
    // anyone's looking. activeCompletingId is the single value both the
    // render-phase kickoff and the timer effect below key off, so they can
    // never fall out of sync with each other while waiting.
    const readyToStart = hideStatusColumn ? (!!completingId && completingItem?.id === completingId) : !!completingId;
    const activeCompletingId = readyToStart ? completingId : null;

    const [prevCompletingId, setPrevCompletingId] = useState(null);
    if (activeCompletingId !== prevCompletingId) {
        setPrevCompletingId(activeCompletingId);
        if (activeCompletingId) {
            // highlightId doubles as DataTable's highlightKey (below), which
            // auto-jumps pagination to whichever page actually contains this
            // row — set on Main too, not just History: completingItem gets
            // appended to the END of allItems (see baseItems above), and
            // with 10+ need-action rows this can easily land several pages
            // past whatever page the coach is currently on. Without this,
            // the row silently renders off-screen on a page nobody's
            // looking at, and the celebrate/exit animation nobody sees
            // reads as "it just doesn't fade out."
            setHighlightId(activeCompletingId);
            if (hideStatusColumn) setRowTransition({ key: activeCompletingId, phase: "celebrate" });
        }
    }

    useEffect(() => {
        if (!activeCompletingId) return;
        let cancelled = false;
        const timers = [];
        const after = (fn, ms) => { timers.push(setTimeout(() => { if (!cancelled) fn(); }, ms)); };

        if (!hideStatusColumn) {
            onCompletionDone?.(activeCompletingId);
        } else {
            after(() => {
                setRowTransition({ key: activeCompletingId, phase: "exit" });
                after(() => {
                    setRowTransition(null);
                    const list = filteredItemsRef.current;
                    const idx = list.findIndex((r) => r.id === activeCompletingId);
                    const nextItem = (idx !== -1 ? list[idx + 1] : undefined) ?? list.find((r) => r.id !== activeCompletingId);
                    // onCompletionDone (below) tells the parent it's safe to drop this
                    // id from data, which flows back down as completingId={null} —
                    // that's a dependency change for THIS effect, so React tears this
                    // exact instance down right after, cancelling `timers` via the
                    // cleanup below. setHighlightId(nextItem.id) itself still commits
                    // fine (it already ran), but a fade timer scheduled here would be
                    // cancelled before it ever fires — that's why the fade lives in
                    // its own independent effect (below, keyed on highlightId) instead
                    // of being scheduled from inside this one.
                    if (nextItem) setHighlightId(nextItem.id);
                    onCompletionDone?.(activeCompletingId);
                }, 320);
            }, 800);
        }

        return () => {
            cancelled = true;
            timers.forEach(clearTimeout);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per activeCompletingId; hideStatusColumn/onCompletionDone are stable per instance
    }, [activeCompletingId]);

    // highlightId's fade-out lives in its own effect, independent of
    // completingId's — see the comment above for why: calling
    // onCompletionDone from inside that effect changes completingId, which
    // tears that effect down (by design, via its cleanup) right after, which
    // would silently cancel any fade timer scheduled in the same closure.
    // History's highlight and Main's next-item cue both flow through here.
    useEffect(() => {
        if (!highlightId) return;
        const duration = hideStatusColumn ? 1500 : 4000;
        const timer = setTimeout(() => setHighlightId(null), duration);
        return () => clearTimeout(timer);
    }, [highlightId, hideStatusColumn]);

    // Bulk selection (mirrors the Clients datatable's selection + Action Bar pattern).
    const [selectedIds, setSelectedIds] = useState(new Set());
    // The rows on the current page, in display order. The completion-transition effect's timeout closures
    // (above) read it through a ref to find "the next item" without re-running that effect every time the
    // filters or sort change.
    const [filteredItems, setFilteredItems] = useState([]);
    useEffect(() => { filteredItemsRef.current = filteredItems; }, [filteredItems]);

    // What each row the coach may have selected is (id → { id, status, postAction }), kept as pages load so the
    // bulk bar can still tell which actions apply after paging away, and filled by "select all matching" for rows
    // that were never loaded.
    const [rowInfo, setRowInfo] = useState(() => new Map());
    // Adjusted during render (not in an effect) when a new page of rows arrives — the same pattern as
    // prevCompletingId above.
    const [prevRows, setPrevRows] = useState(rows);
    if (rows !== prevRows) {
        setPrevRows(rows);
        setRowInfo((prev) => {
            const next = new Map(prev);
            for (const row of rows) next.set(row.id, { id: row.id, status: row.status, postAction: row.postAction });
            return next;
        });
    }

    // The query the table is showing right now, so "select all matching" asks for exactly the same rows.
    const currentQueryRef = useRef(null);
    function handleQueryChange(query) {
        currentQueryRef.current = query;
        onQueryChange(query);
    }

    const [selectingAll, setSelectingAll] = useState(false);
    async function selectAllMatching() {
        if (!currentQueryRef.current) return;
        setSelectingAll(true);
        try {
            const { items, capped } = await fetchMatchingQueueRows({ view, ...currentQueryRef.current });
            setRowInfo((prev) => {
                const next = new Map(prev);
                for (const item of items) next.set(item.id, item);
                return next;
            });
            setSelectedIds(new Set(items.map((item) => item.id)));
            if (capped) toast.warning(t('selectAllCapped', { count: items.length }));
        } catch {
            toast.warning(t('selectAllFailed'));
        }
        setSelectingAll(false);
    }

    // Ids cancelled via the bulk "Cancel Request" action — hidden at once, until the refetch drops them.
    const [removedIds, setRemovedIds] = useState(new Set());
    // Ids archived via the row/bulk "Archive" action — same hide-until-refetch
    // strategy as removedIds, kept separate so the two actions stay easy to reason about.
    const [archivedIds, setArchivedIds] = useState(new Set());
    const [bulkAssigning, setBulkAssigning] = useState(false);
    // Row currently toggling auto-assign (disables its button). The outcome is announced with a toast.
    const [autoAssignBusyId, setAutoAssignBusyId] = useState(null);
    const [cancelling, setCancelling] = useState(false);
    // Which row's answer-preview popover is open (row id or null) — lifted
    // here rather than local to AnswerPreviewTrigger so opening one row's
    // preview closes any other row's still-open one.
    const [previewOpenId, setPreviewOpenId] = useState(null);
    const [archiving, setArchiving] = useState(false);

    const isPlanRow = (row) => PLAN_ACTIONS.includes(row.postAction) && !!row.clientId;
    const planTypeLabel = (postAction) => (postAction === "nutrition-plan" ? t('nutrition') : t('workout')).toLocaleLowerCase(locale);
    // One current rule per client + plan type, so a client's nutrition and workout rows show their own badge.
    // An override (set by a toggle, a bulk assign or the rules modal) wins over the row's snapshot.
    const autoRuleKey = (row) => `${row.clientId}:${row.postAction}`;
    const autoRuleFor = (row) => {
        const key = autoRuleKey(row);
        if (Object.prototype.hasOwnProperty.call(autoRuleOverrides, key)) return autoRuleOverrides[key];
        return row.autoAssignRuleId ? { id: row.autoAssignRuleId, agentName: row.autoAssignAgentName } : null;
    };

    // One click on a row's auto-assign button: off -> on (rule points at the row's current assignee),
    // on -> off. Updates the badge straight away from the server's answer.
    async function toggleAutoAssign(row) {
        setAutoAssignBusyId(row.id);
        try {
            const rule = autoRuleFor(row);
            if (rule) {
                await api.patch(`/api/forms/queue/auto-assign/${rule.id}/off`);
                onAutoRuleOverrides([[autoRuleKey(row), null]]);
            } else {
                const res = await api.post("/api/forms/queue/auto-assign", { requestId: row.id });
                onAutoRuleOverrides([[autoRuleKey(row), { id: res.data.rule.id, agentName: row.assignedToName }]]);
            }
            onAutoAssignChange();
        } catch {
            toast.warning(t('autoAssignNoticeError'));
        }
        setAutoAssignBusyId(null);
    }

    // After an assignment made with the "Auto-assign when I assign" switch on: show the new rules on the rows
    // straight away and say what happened (including when the assignee couldn't be given rules).
    function handleAutoAssignResult(result, member) {
        if (!result) return;
        if (result.skipped === "error") return toast.warning(t('autoAssignNoticeError'));
        if (result.skipped === "agent_not_eligible") return toast.warning(t('autoAssignNoticeNotEligible'));
        onAutoRuleOverrides(result.rules.map((rule) => [`${rule.clientId}:${rule.planType}`, { id: rule.id, agentName: member?.name ?? null }]));
        onAutoAssignChange();
        if (result.rulesSet > 0) toast.success(t('autoAssignNoticeSaved', { count: result.rulesSet, name: member?.name ?? "" }));
    }

    // Per-row control next to the assignee. Managers/owners get a toggle button; everyone else just sees
    // a small marker when a rule exists (so an agent can tell why a form landed on them).
    function renderAutoAssignControl(row) {
        if (!isPlanRow(row)) return null;
        const rule = autoRuleFor(row);
        const plan = planTypeLabel(row.postAction);
        if (!canManageAutoAssign) {
            if (!rule) return null;
            return (
                <Tooltip>
                    <span className="shrink-0 inline-flex text-accent" tabIndex={0} aria-label={t('autoAssignRules')}>
                        <Repeat size={12} />
                    </span>
                    <Tooltip.Content>{t('autoAssignBadgeTip', { plan, name: rule.agentName || "—" })}</Tooltip.Content>
                </Tooltip>
            );
        }
        // Nobody to point a new rule at until the form is assigned to someone.
        const needsAssignee = !rule && !row.assignedTo;
        const tip = rule
            ? t('autoAssignOnTip', { plan, name: rule.agentName || "—" })
            : needsAssignee
                ? t('autoAssignNeedsAssignee')
                : t('autoAssignOffTip', { plan, name: row.assignedToName || "—" });
        return (
            <Tooltip>
                <Button
                    isIconOnly
                    size="sm"
                    variant="ghost"
                    aria-label={tip}
                    aria-pressed={!!rule}
                    isDisabled={needsAssignee || autoAssignBusyId === row.id}
                    className={`shrink-0 ${rule ? "text-accent" : "text-muted-foreground"}`}
                    onClick={(e) => { e.stopPropagation(); toggleAutoAssign(row); }}
                >
                    <Repeat size={14} />
                </Button>
                <Tooltip.Content>{tip}</Tooltip.Content>
            </Tooltip>
        );
    }

    // The page's switch decides whether assigning ALSO turns on auto-assign (one step, for one row or a bulk selection).
    const shouldAutoAssign = (userId) => autoAssignOnAssign && canManageAutoAssign && !!userId;

    async function assignTo(rowId, userId) {
        const wantsAutoAssign = shouldAutoAssign(userId);
        const member = members.find((m) => m.id === userId);
        // Optimistic — reflect the new assignee immediately, then persist.
        setAssignMap((prev) => ({
            ...prev,
            [rowId]: { assignedTo: userId || null, assignedToName: member?.name || null },
        }));
        try {
            const res = await api.patch("/api/forms/queue/assign", { ids: [rowId], assignedTo: userId || null, autoAssign: wantsAutoAssign || undefined });
            handleAutoAssignResult(res.data?.autoAssign, member);
            refreshSummary();
        } catch {
            // silent — leave the optimistic value; a reload reconciles with the server
        }
    }

    async function assignLabel(rowId, labelId) {
        // Optimistic — same pattern as assignTo above. Just the id; see
        // labelMap's declaration for why name/color are never stored here.
        setLabelMap((prev) => ({ ...prev, [rowId]: labelId || null }));
        try {
            await api.patch("/api/forms/queue/label", { formRequestId: rowId, labelId: labelId || null });
        } catch {
            // silent — leave the optimistic value; a reload reconciles with the server
        }
    }

    function getPostAction(formId) {
        const form = forms.find((f) => f.id === formId);
        return form?.postAction || "nothing";
    }

    function getFormType(formId) {
        const form = forms.find((f) => f.id === formId);
        return form?.type || "check-in";
    }

    const withDerived = (item) => {
        const override = assignMap[item.id];
        // hasOwnProperty, not `labelMap[item.id] ?? item.labelId`: a row
        // explicitly cleared to "no label" stores `null` in labelMap, which
        // must win over item.labelId rather than falling back to it.
        const hasLabelOverride = Object.prototype.hasOwnProperty.call(labelMap, item.id);
        const effectiveLabelId = hasLabelOverride ? labelMap[item.id] : (item.labelId ?? null);
        // Always re-resolved against the current labels list — never a
        // snapshot — so a rename/recolor/delete shows up immediately on
        // every row with no separate sync step (see labelMap's declaration).
        const effectiveLabel = effectiveLabelId ? labels.find((l) => l.id === effectiveLabelId) : null;
        return {
            ...item,
            postAction: item.postAction || getPostAction(item.formId),
            formType: item.formType || getFormType(item.formId),
            assignedTo: override ? override.assignedTo : (item.assignedTo ?? null),
            assignedToName: override ? override.assignedToName : (item.assignedToName ?? null),
            labelId: effectiveLabel ? effectiveLabel.id : null,
            labelName: effectiveLabel ? effectiveLabel.name : null,
            labelColor: effectiveLabel ? effectiveLabel.color : null,
            ...(statusMap[item.id] ?? {}),
        };
    };

    // Rows hidden since the page was fetched (cancelled or archived here) stay hidden until the refetch lands.
    const baseItems = rows.map(withDerived).filter((r) => !removedIds.has(r.id) && !archivedIds.has(r.id));
    // Splice the just-completed row in for the duration of its animation
    // (Main only — it is no longer need-action, so the list doesn't hold it).
    // Appended rather than merged into the fetched rows, so it disappears
    // cleanly the instant completingItem clears (handleCompletionDone in
    // page.js) with no risk of it lingering behind a stale optimistic update.
    const allItems = completingItem && !baseItems.some((r) => r.id === completingItem.id)
        ? [...baseItems, withDerived(completingItem)]
        : baseItems;

    // Per-member "Need Action" workload for the assignee pickers. Counted by the server over every need-action
    // row (not just this page), and re-read after each assignment/review below.
    const needActionCountByAssignee = new Map(Object.entries(summary.needActionByAssignee));

    // Sorted so a given package name always lands on the same color. Drawn from the server's list of packages
    // (every package with rows in this view), not just the ones on this page, so a chip's color never shifts
    // as the coach pages or filters.
    const packageNames = summary.packages;
    const packageColors = Object.fromEntries(
        packageNames.map((name, i) => [name, PACKAGE_CHIP_COLORS[i % PACKAGE_CHIP_COLORS.length]])
    );

    async function markReviewed(ids, action = "review") {
        setMarking(true);
        try {
            const res = await api.patch("/api/forms/queue/review", { ids, action });
            const updatedIds = (res.data?.updatedIds || ids).map(String);
            setStatusMap((prev) => {
                const next = { ...prev };
                for (const id of updatedIds) {
                    next[id] = {
                        status: action === "undo" ? "need-action" : "action-done",
                        actionTakenAt: action === "undo" ? null : new Date().toISOString(),
                    };
                }
                return next;
            });
            refreshSummary();
        } catch {
            // silent
        }
        setMarking(false);
    }

    // Bulk assign/unassign — same endpoint and optimistic-update strategy as the
    // per-row assignTo above, just applied to the whole selection at once.
    async function bulkAssignTo(userId) {
        const ids = [...selectedIds];
        if (ids.length === 0) return;
        const wantsAutoAssign = shouldAutoAssign(userId);
        const member = members.find((m) => m.id === userId);
        setAssignMap((prev) => {
            const next = { ...prev };
            for (const id of ids) next[id] = { assignedTo: userId || null, assignedToName: member?.name || null };
            return next;
        });
        setBulkAssigning(true);
        try {
            const res = await api.patch("/api/forms/queue/assign", { ids, assignedTo: userId || null, autoAssign: wantsAutoAssign || undefined });
            handleAutoAssignResult(res.data?.autoAssign, member);
            refreshSummary();
        } catch {
            // silent — leave the optimistic value; a reload reconciles with the server
        }
        setBulkAssigning(false);
        setSelectedIds(new Set());
    }

    // Bulk label assignment — same shape as bulkAssignTo above, applied to
    // one label at a time across the whole selection.
    async function bulkAssignLabel(labelId) {
        const ids = [...selectedIds];
        if (ids.length === 0) return;
        setLabelMap((prev) => {
            const next = { ...prev };
            for (const id of ids) next[id] = labelId || null;
            return next;
        });
        setBulkAssigning(true);
        try {
            await Promise.all(ids.map((id) => api.patch("/api/forms/queue/label", { formRequestId: id, labelId: labelId || null })));
        } catch {
            // silent — leave the optimistic value; a reload reconciles with the server
        }
        setBulkAssigning(false);
        setSelectedIds(new Set());
    }

    // Only rows the corresponding action is actually valid for — see the Plans Queue
    // bulk-actions analysis: marking a nutrition/workout submission "reviewed" in bulk
    // would silently skip building the plan, so that action is scoped to plain check-ins.
    // A selection can span pages (and "select all matching" reaches rows that were never loaded), so what each
    // selected row is comes from rowInfo — remembered per row as pages load, or filled by select-all — with the
    // review overlay applied on top, rather than from the rows currently on screen.
    const selectedItems = [...selectedIds]
        .map((id) => rowInfo.get(id))
        .filter(Boolean)
        .map((info) => ({ ...info, ...(statusMap[info.id]?.status ? { status: statusMap[info.id].status } : {}) }));
    const eligibleReviewIds = selectedItems.filter((r) => r.status === "need-action" && r.postAction === "nothing").map((r) => r.id);
    const eligibleUndoIds = selectedItems.filter((r) => r.status === "action-done").map((r) => r.id);
    const eligibleCancelIds = selectedItems.filter((r) => r.status === "awaiting" || r.status === "scheduled").map((r) => r.id);
    const eligibleArchiveIds = selectedItems.filter((r) => r.status === "need-action" || r.status === "action-done").map((r) => r.id);

    async function bulkMarkReviewed() {
        if (eligibleReviewIds.length === 0) return;
        await markReviewed(eligibleReviewIds, "review");
        setSelectedIds(new Set());
    }

    async function bulkUndo() {
        if (eligibleUndoIds.length === 0) return;
        await markReviewed(eligibleUndoIds, "undo");
        setSelectedIds(new Set());
    }

    // Cancels pending/scheduled requests — the only queue statuses the backend allows
    // deleting. The cancelled ids are hidden straight away (removedIds) and the page is
    // refetched, so the rows after them move up and the total count stays right.
    async function bulkCancelRequests() {
        if (eligibleCancelIds.length === 0) return;
        if (!confirm(t('cancelRequestConfirm', { count: eligibleCancelIds.length }))) return;
        setCancelling(true);
        try {
            await api.delete("/api/forms/queue/cancel", { data: { ids: eligibleCancelIds } });
            setRemovedIds((prev) => new Set([...prev, ...eligibleCancelIds]));
            setSelectedIds(new Set());
            refetch();
            refreshSummary();
        } catch {
            // silent
        }
        setCancelling(false);
    }

    // Archives submitted/reviewed submissions out of the active queue — reversible
    // (via the Archived view's Restore action), unlike bulkCancelRequests' hard delete.
    async function archiveSubmissions(ids) {
        if (ids.length === 0) return;
        setArchiving(true);
        try {
            await api.patch("/api/forms/queue/archive", { ids, action: "archive" });
            setArchivedIds((prev) => new Set([...prev, ...ids]));
            setSelectedIds(new Set());
            refetch();
            refreshSummary();
        } catch {
            // silent
        }
        setArchiving(false);
    }

    function shortDate(dateStr) {
        if (!dateStr) return <span className="text-muted-foreground">-</span>;
        const formatted = formatDateTime(dateStr);
        if (!formatted) return <span className="text-muted-foreground/60 text-xs">{dateStr}</span>;
        return <span className="text-muted-foreground text-xs whitespace-nowrap">{formatted}</span>;
    }

    function actionTypeLabel(postAction) {
        if (postAction === "nutrition-plan") return t('nutrition');
        if (postAction === "workout-plan") return t('workout');
        return t('noAction');
    }

    function statusBadge(status) {
        const styles = {
            scheduled: "bg-accent/15 text-accent",
            awaiting: "bg-zinc-500/20 text-zinc-400",
            "need-action": "bg-amber-500/20 text-amber-400",
            "action-done": "bg-emerald-500/20 text-emerald-400",
        };
        const labels = {
            scheduled: t('scheduled'),
            awaiting: t('awaiting'),
            "need-action": t('needAction'),
            "action-done": t('actionDone'),
        };
        return (
            <Chip size="sm" className={`whitespace-nowrap ${styles[status] || "bg-zinc-500/20 text-zinc-400"}`}>
                {labels[status] || status}
            </Chip>
        );
    }

    const columns = [
        {
            key: "clientCode",
            label: t('code'),
            sortable: true,
            filterType: "text",
            width: "70px",
            cardPriority: "secondary",
            render: (row) => <span className="text-muted-foreground font-mono text-xs">#{row.clientCode ?? "-"}</span>,
        },
        {
            key: "clientName",
            label: t('client'),
            filterType: "text",
            sortable: true,
            width: "180px",
            cardPriority: "primary",
            render: (row) => (
                <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-foreground font-medium text-sm">
                        <span className="truncate">{row.clientName}</span>
                        {row.isDemo && <DemoBadge className="shrink-0" />}
                    </p>
                    <p className="text-muted-foreground text-[10px] truncate">{row.clientEmail}</p>
                </div>
            ),
        },
        {
            key: "clientPackage",
            label: t('colPackage'),
            filterType: "multi",
            options: packageNames,
            pinned: true,
            icon: Package,
            sortable: true,
            width: "150px",
            cardPriority: "secondary",
            render: (row) => row.clientPackage
                ? <Chip size="sm" className={`whitespace-nowrap ${packageColors[row.clientPackage]}`}>{row.clientPackage}</Chip>
                : <span className="text-muted-foreground text-sm">-</span>,
        },
        {
            key: "formTitle_en",
            label: t('form'),
            filterType: "multi",
            // Filters by form id (the server matches on it); only forms that have rows in this view are offered.
            options: summary.formIds,
            optionLabel: (formId) => {
                const form = forms.find((f) => f.id === formId);
                return form ? getLocalizedField(form, 'title', locale) || formId : formId;
            },
            pinned: true,
            icon: ClipboardList,
            sortable: true,
            width: "220px",
            cardPriority: "primary",
            render: (row) => (
                <div className="min-w-0">
                    <p className="text-foreground text-sm font-medium truncate">{getLocalizedField(row, 'formTitle', locale)}</p>
                    <div className="flex items-center gap-1 mt-1">
                        <Chip size="sm" className={`whitespace-nowrap ${
                            row.formType === "assessment"
                                ? "bg-purple-500/20 text-purple-400"
                                : "bg-accent/15 text-accent"
                        }`}>
                            {titleCaseType(row.formType)}
                        </Chip>
                        <Chip size="sm" className={`whitespace-nowrap ${
                            row.postAction === "nutrition-plan" ? "bg-amber-500/20 text-amber-400"
                                : row.postAction === "workout-plan" ? "bg-accent/15 text-accent"
                                : "bg-zinc-500/20 text-zinc-400"
                        }`}>
                            {actionTypeLabel(row.postAction)}
                        </Chip>
                    </div>
                </div>
            ),
        },
        // Filter-only — its value is already shown as a chip inside the Form
        // column above, so it doesn't need its own visible table column too.
        {
            key: "formType",
            label: t('type'),
            filterType: "multi",
            options: ["assessment", "check-in"],
            optionLabel: (v) => titleCaseType(v),
            pinned: true,
            icon: FileText,
            hidden: true,
        },
        // Filter-only, like formType above — the action is already a chip in the
        // Form column. Exists so Operations drill-downs can pre-filter by nutrition/workout.
        {
            key: "postAction",
            label: t('actionFilter'),
            filterType: "multi",
            options: ["nutrition-plan", "workout-plan", "nothing"],
            optionLabel: (v) => actionTypeLabel(v),
            pinned: true,
            icon: Target,
            hidden: true,
        },
        {
            key: "requestedAt",
            label: t('requestedScheduled'),
            sortable: true,
            filterType: "dateRange",
            width: "150px",
            cardPriority: "secondary",
            render: (row) => {
                if (row.scheduledAt && row.status === "scheduled") {
                    return (
                        <span className="text-primary text-xs whitespace-nowrap">
                            {t('scheduled')} {shortDate(row.scheduledAt)}
                        </span>
                    );
                }
                return shortDate(row.requestedAt);
            },
        },
        {
            key: "submittedAt",
            label: t('submitted'),
            sortable: true,
            filterType: "dateRange",
            width: "150px",
            cardPriority: "primary",
            render: (row) => shortDate(row.submittedAt),
        },
        ...(hideActionTakenColumn ? [] : [{
            key: "actionTakenAt",
            label: t('actionTaken'),
            sortable: true,
            filterType: "dateRange",
            width: "150px",
            cardPriority: "secondary",
            render: (row) => shortDate(row.actionTakenAt),
        }]),
        ...(hideStatusColumn ? [] : [{
            key: "status",
            label: t('status'),
            filterType: "multi",
            options: ["scheduled", "awaiting", "need-action", "action-done"],
            optionLabel: (v) => ({
                scheduled: t('scheduled'),
                awaiting: t('awaiting'),
                "need-action": t('needAction'),
                "action-done": t('actionDone'),
            }[v] ?? v),
            pinned: true,
            icon: Activity,
            width: "130px",
            cardPriority: "primary",
            render: (row) => statusBadge(row.status),
        }]),
        {
            key: "assignedTo",
            label: t('assigned'),
            filterType: "multi",
            options: [null, ...members.map((m) => m.id)],
            optionLabel: (id) => id === null ? t('unassigned') : (members.find((m) => m.id === id)?.name || id),
            filterValue: (row) => row.assignedTo ?? null,
            sortable: true,
            // Sort by the assignee's display name, not the raw id — unassigned
            // rows sort last regardless of direction (empty string always wins
            // localeCompare against a real name).
            sortValue: (row) => row.assignedToName || null,
            pinned: true,
            icon: Users,
            width: "170px",
            cardPriority: "secondary",
            render: (row) => (
                <div className="flex items-center gap-1 min-w-0">
                    {/* One-time hint pointing at the workload counts now shown inside
                        this dropdown — only on the Main view's first row, where a
                        manager's eye actually lands, and only until dismissed once. */}
                    {hideStatusColumn && members.length > 0 && row.id === allItems[0]?.id && (
                        <NewFeatureTooltip
                            featureKey="assignee_workload_hint"
                            active
                            hideTriggerWhenSeen
                            message={t('assignWorkloadHint')}
                            dismissLabel={t('assignWorkloadHintDismiss')}
                            badgeLabel={t('assignWorkloadHintBadge')}
                            triggerClassName="shrink-0 w-1.5 h-1.5 rounded-full bg-primary cursor-pointer"
                        >
                            <span className="sr-only">{t('assignWorkloadHintBadge')}</span>
                        </NewFeatureTooltip>
                    )}
                    <Select
                        aria-label={t('assignTo')}
                        value={row.assignedTo ?? "none"}
                        onChange={(v) => assignTo(row.id, v === "none" ? null : v)}
                        size="sm"
                        fullWidth
                    >
                        {/* pl-2!/pr-6! (not px-2!) — a bare px-2! also overrides the
                            !important-free pr-7 that HeroUI's own select__trigger:has()
                            rule reserves for Select.Indicator below, so the chevron sat
                            on top of the last letter of the assignee/label name. pr-6
                            (24px) exactly covers the indicator's own right-2 + size-4. */}
                        <Select.Trigger className="border-0! bg-transparent! shadow-none! min-h-0! py-1! pl-2! pr-6! gap-1.5 items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer max-w-full">
                            <UserPlus size={13} className="shrink-0" />
                            <span className="truncate text-xs">{row.assignedToName || t('unassigned')}</span>
                            <Select.Indicator />
                        </Select.Trigger>
                        <Select.Popover className={ASSIGNEE_POPOVER_CLASS}>
                            <ListBox>{renderAssigneeOptions({ members, needActionCountByAssignee, t })}</ListBox>
                        </Select.Popover>
                    </Select>
                    {renderAutoAssignControl(row)}
                </div>
            ),
        },
        {
            key: "label",
            label: t('label'),
            filterType: "multi",
            options: [null, ...labels.map((l) => l.id)],
            optionLabel: (id) => id === null ? t('unlabeled') : (labels.find((l) => l.id === id)?.name || id),
            filterValue: (row) => row.labelId ?? null,
            sortable: true,
            sortValue: (row) => row.labelName || null,
            pinned: true,
            icon: Tag,
            width: "150px",
            cardPriority: "secondary",
            render: (row) => (
                <Select
                    aria-label={t('label')}
                    value={row.labelId ?? "none"}
                    onChange={(v) => assignLabel(row.id, v === "none" ? null : v)}
                    size="sm"
                    fullWidth
                >
                    {/* pl-2!/pr-6!, not px-2! — see the assignedTo Select.Trigger above for why. */}
                    <Select.Trigger className="border-0! bg-transparent! shadow-none! min-h-0! py-1! pl-2! pr-6! gap-1.5 items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer max-w-full">
                        {row.labelName ? (
                            <Chip size="sm" className={`whitespace-nowrap ${LABEL_COLOR_CLASSES[row.labelColor] || "bg-zinc-500/20 text-zinc-400"}`}>
                                {row.labelName}
                            </Chip>
                        ) : (
                            <>
                                <Tag size={13} className="shrink-0" />
                                <span className="truncate text-xs">{t('unlabeled')}</span>
                            </>
                        )}
                        <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                        <ListBox>
                            <ListBox.Item id="none" textValue={t('unlabeled')}>
                                {t('unlabeled')}
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                            {labels.map((l) => (
                                <ListBox.Item key={l.id} id={l.id} textValue={l.name}>
                                    <span className="flex items-center gap-2">
                                        <span className={`w-2 h-2 rounded-full shrink-0 ${LABEL_COLOR_SWATCH[l.color] || "bg-zinc-500"}`} />
                                        {l.name}
                                    </span>
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                            ))}
                        </ListBox>
                    </Select.Popover>
                </Select>
            ),
        },
        {
            key: "actions",
            label: t('action'),
            filterType: "multi",
            options: ["nothing", "nutrition-plan", "workout-plan"],
            optionLabel: (v) => actionTypeLabel(v),
            filterValue: (row) => row.postAction,
            pinned: true,
            icon: Target,
            alwaysVisibleActions: true,
            stickyEnd: true,
            width: "260px",
            cardPriority: "primary",
            render: (row) => {
                const typeBadge = row.postAction === "nutrition-plan"
                    ? <Chip size="sm" className="bg-amber-500/20 text-amber-400 whitespace-nowrap">{t('nutrition')}</Chip>
                    : row.postAction === "workout-plan"
                    ? <Chip size="sm" className="bg-accent/15 text-accent whitespace-nowrap">{t('workout')}</Chip>
                    : null;

                if (row.status === "awaiting") {
                    return (
                        <div className="flex items-center gap-2">
                            {typeBadge}
                            <span className="text-muted-foreground text-xs italic whitespace-nowrap">{t('waitingForClient')}</span>
                        </div>
                    );
                }

                if (row.status === "scheduled") {
                    return (
                        <div className="flex items-center gap-2">
                            {typeBadge}
                            <span className="text-primary text-xs italic">{t('scheduled')}</span>
                        </div>
                    );
                }

                return (
                    <div className="flex items-center gap-2">
                        {row.status === "need-action" && (
                            row.postAction === "nutrition-plan" ? (
                                <IconAction
                                    showLabel
                                    label={t('openNutrition')}
                                    onClick={(e) => { e.stopPropagation(); router.push(`/${workspaceSlug}/clients/${row.clientId}/nutrition?submissionId=${row.id}&returnTo=${returnToView}`); }}
                                    className="bg-amber-500/20 text-amber-400 hover:bg-amber-500/30"
                                >
                                    <Salad size={16} />
                                </IconAction>
                            ) : row.postAction === "workout-plan" ? (
                                <IconAction
                                    showLabel
                                    label={t('openWorkout')}
                                    onClick={(e) => { e.stopPropagation(); router.push(`/${workspaceSlug}/clients/${row.clientId}/training?submissionId=${row.id}&returnTo=${returnToView}`); }}
                                    className="bg-accent/15 text-accent hover:bg-accent/25"
                                >
                                    <Dumbbell size={16} />
                                </IconAction>
                            ) : (
                                <IconAction
                                    showLabel
                                    label={t('markReviewed')}
                                    onClick={(e) => { e.stopPropagation(); markReviewed([row.id], "review"); }}
                                    disabled={marking}
                                    className="bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                                >
                                    <Check size={16} />
                                </IconAction>
                            )
                        )}
                        {row.status === "action-done" && (
                            <IconAction
                                label={t('undo')}
                                onClick={(e) => { e.stopPropagation(); markReviewed([row.id], "undo"); }}
                                disabled={marking}
                                className="bg-zinc-500/20 text-zinc-400 hover:bg-zinc-500/30"
                            >
                                <Undo2 size={15} />
                            </IconAction>
                        )}
                        {hasAnswers(row) && (
                            <>
                                {/* One-time hint pointing at the new answer-preview icon — only on
                                    the first eligible row, dismissed once (same pattern as the
                                    assignee-workload hint above). */}
                                {row.id === allItems.find(hasAnswers)?.id && (
                                    <NewFeatureTooltip
                                        featureKey="answer_preview_hint"
                                        active
                                        hideTriggerWhenSeen
                                        message={t('previewAnswersHint')}
                                        dismissLabel={t('previewAnswersHintDismiss')}
                                        badgeLabel={t('previewAnswersHintBadge')}
                                        triggerClassName="shrink-0 w-1.5 h-1.5 rounded-full bg-primary cursor-pointer"
                                    >
                                        <span className="sr-only">{t('previewAnswersHintBadge')}</span>
                                    </NewFeatureTooltip>
                                )}
                                <IconAction
                                    label={t('previewAnswers')}
                                    onClick={(e) => { e.stopPropagation(); setPreviewOpenId(row.id); }}
                                    className="bg-zinc-500/20 text-zinc-400 hover:bg-zinc-500/30"
                                >
                                    <Eye size={15} />
                                </IconAction>
                            </>
                        )}
                        {(row.status === "need-action" || row.status === "action-done") && (
                            <IconAction
                                padded
                                label={t('archive')}
                                onClick={(e) => { e.stopPropagation(); archiveSubmissions([row.id]); }}
                                disabled={archiving}
                                className="bg-zinc-500/20 text-zinc-400 hover:bg-zinc-500/30"
                            >
                                <Archive size={15} />
                            </IconAction>
                        )}
                    </div>
                );
            },
        },
    ];


    // A phone row, grouped instead of one "label: value" line per column: who and what on top (with the status),
    // the form and its tags, the two dates side by side, the action buttons, then who has it and its label.
    // It reuses the table's own cells, so every control behaves exactly as it does on a wide screen.
    function renderMobileRow(row) {
        const cell = (key) => columns.find((column) => column.key === key);
        const statusCell = cell("status");
        const actionTakenCell = cell("actionTakenAt");
        const fieldLabel = (text) => <p className="mb-0.5 text-[11px] font-medium text-muted-foreground">{text}</p>;

        return (
            <div className="flex flex-col gap-3">
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">{cell("clientName").render(row)}</div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                        {statusCell?.render(row)}
                        <span className="font-mono text-xs text-muted-foreground">#{row.clientCode ?? "-"}</span>
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    {cell("formTitle_en").render(row)}
                    {row.clientPackage && <div className="flex">{cell("clientPackage").render(row)}</div>}
                </div>

                <div className="grid grid-cols-2 gap-x-3 gap-y-2">
                    <div>{fieldLabel(t('submitted'))}{cell("submittedAt").render(row)}</div>
                    <div>{fieldLabel(t('requestedScheduled'))}{cell("requestedAt").render(row)}</div>
                    {actionTakenCell && <div>{fieldLabel(t('actionTaken'))}{actionTakenCell.render(row)}</div>}
                </div>

                <div className="flex items-center">{cell("actions").render(row)}</div>

                <div className="grid grid-cols-2 gap-3 border-t border-border pt-2">
                    <div className="min-w-0">{fieldLabel(t('assigned'))}{cell("assignedTo").render(row)}</div>
                    <div className="min-w-0">{fieldLabel(t('label'))}{cell("label").render(row)}</div>
                </div>
            </div>
        );
    }

    return (
        // A real element, not a Fragment — this component is sometimes rendered
        // inside a parent flex container (Submission History's gap-10 wrapper);
        // a Fragment here would leak its children as that container's direct
        // flex items, doubling up spacing that this component already controls
        // internally (via DataTable's own margins below).
        <div>
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-3xl font-bold">{title ?? t('title')}</h1>
                    <p className="text-muted-foreground text-sm mt-1">{description ?? t('description')}</p>
                </div>
                {/* On a phone the action buttons take the full width as ONE row (the page's headerAction wrapper
                    dissolves into this row, see plans-queue/page.js): the compact auto-assign button keeps its size
                    and the labelled buttons split the rest equally, instead of wrapping into uneven rows. */}
                <div className="flex items-center gap-2 max-sm:w-full">
                    {canManageLabels && (
                        <NewFeatureTooltip
                            featureKey="plans_queue_labels_hint"
                            active
                            message={t('manageLabelsHint')}
                            dismissLabel={t('manageLabelsHintDismiss')}
                            badgeLabel={t('manageLabelsHintBadge')}
                            triggerClassName="max-sm:flex-1 max-sm:min-w-0"
                        >
                            <Button variant="outline" size="sm" className="max-sm:w-full max-sm:px-2 max-sm:gap-1 max-sm:text-xs" onClick={() => setManageLabelsOpen(true)}>
                                <Settings className="w-4 h-4 shrink-0" />
                                <span className="max-sm:truncate">{t('manageLabels')}</span>
                            </Button>
                        </NewFeatureTooltip>
                    )}
                    {headerAction}
                </div>
            </div>

            {canManageLabels && (
                <ManageLabelsModal
                    open={manageLabelsOpen}
                    onClose={() => setManageLabelsOpen(false)}
                    labels={labels}
                    onChanged={onLabelsChange}
                />
            )}

            {previewOpenId && (() => {
                const previewRow = allItems.find((r) => r.id === previewOpenId);
                if (!previewRow) return null;
                return (
                    <AnswerPreviewModal
                        open
                        onClose={() => setPreviewOpenId(null)}
                        requestId={previewRow.id}
                        responses={previewRow.responses ?? []}
                        locale={locale}
                        heading={t('submissionAnswers')}
                        formTitle={getLocalizedField(previewRow, 'formTitle', locale)}
                    />
                );
            })()}

            {loadError && (
                <div role="alert" className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 text-destructive shadow-sm p-4">
                    <span>{loadError}</span>
                    <Button size="sm" variant="outline" onClick={refetch}>{t('loadRetry')}</Button>
                </div>
            )}
            {/* Until the first response arrives (total is null) the table stays mounted but hidden: mounting is what
                reports the query to fetch (including a search/filter restored from this tab's last visit). */}
            {total === null && !loadError && <PlansQueueSkeleton />}
            <div className={total === null ? "hidden" : ""}>
            <DataTable
                columns={columns}
                data={allItems}
                rowKey="id"
                scrollable
                // The server searches, filters, sorts and pages; `data` is only the current page.
                serverSide={{ totalCount: total, isFetching, onQueryChange: handleQueryChange }}
                // Eight filter buttons: an even two-column grid on phones instead of rows of 3, 3 and 2.
                evenFilterGridOnMobile
                quickSearch={{
                    fields: ["clientName", "clientEmail", "clientCode", "formTitle_en", "formTitle_ar"],
                    placeholder: t('searchPlaceholder'),
                }}
                selectable
                mobileListView
                renderMobileRow={renderMobileRow}
                selectedKeys={selectedIds}
                onSelectionChange={setSelectedIds}
                onFilteredDataChange={setFilteredItems}
                // Scoped per view (hideStatusColumn is 1:1 with main vs. history —
                // see page.js's two call sites): Main and History render different
                // columns over different datasets, so sharing one key meant a
                // filter/sort saved in one view would silently misapply (or just
                // do nothing) when restored into the other's incompatible columns.
                persistKey={plansQueuePersistKey({ isMainView: hideStatusColumn, workspaceSlug })}
                highlightKey={highlightId}
                filterButtonLabel={t('otherFilters')}
                rowClassName={(row) => row.id === highlightId ? "bg-emerald-500/10 outline outline-2 -outline-offset-1 outline-emerald-500/40 transition-colors duration-1000" : ""}
                rowTransition={rowTransition}
            />
            </div>

            {/* Floating bulk action bar — same component/pattern as the Clients datatable. */}
            <ActionBar isOpen={selectedIds.size > 0} aria-label={t('selectedBar', { count: selectedIds.size })}>
                <ActionBar.Prefix>
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-default px-1.5 text-xs font-semibold text-foreground">
                        {selectedIds.size}
                    </span>
                    {(total ?? 0) > selectedIds.size && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={selectAllMatching}
                            isDisabled={selectingAll}
                        >
                            <ListChecks className="w-4 h-4" />
                            <span className="action-bar__label">{t('selectAllFiltered', { count: total })}</span>
                        </Button>
                    )}
                </ActionBar.Prefix>
                <Separator orientation="vertical" className="h-6" />
                <ActionBar.Content>
                    {/* The switch lives in the header, out of sight while the manager is picking an assignee, so say
                        here that this assignment will also create auto-assign rules. */}
                    {autoAssignOnAssign && canManageAutoAssign && (
                        <Chip size="sm" variant="soft" color="accent" title={t('autoAssignBarOnHint')} className="shrink-0">
                            <Repeat className="w-3 h-3" />
                            <Chip.Label className="action-bar__label">{t('autoAssignBarOn')}</Chip.Label>
                        </Chip>
                    )}
                    <Select
                        aria-label={t('assignTo')}
                        value="none"
                        onChange={(v) => bulkAssignTo(v === "none" ? null : v)}
                        size="sm"
                        isDisabled={bulkAssigning || marking || cancelling}
                    >
                        <Select.Trigger className="border-0! bg-transparent! shadow-none! min-h-0! py-1! px-2! gap-1.5 items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                            <UserPlus size={14} className="shrink-0" />
                            <span className="action-bar__label text-sm">{t('bulkAssign')}</span>
                        </Select.Trigger>
                        <Select.Popover className={ASSIGNEE_POPOVER_CLASS}>
                            <ListBox>{renderAssigneeOptions({ members, needActionCountByAssignee, t })}</ListBox>
                        </Select.Popover>
                    </Select>

                    {labels.length > 0 && (
                        <Select
                            aria-label={t('label')}
                            value="none"
                            onChange={(v) => bulkAssignLabel(v === "none" ? null : v)}
                            size="sm"
                            isDisabled={bulkAssigning || marking || cancelling}
                        >
                            <Select.Trigger className="border-0! bg-transparent! shadow-none! min-h-0! py-1! px-2! gap-1.5 items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                                <Tag size={14} className="shrink-0" />
                                <span className="action-bar__label text-sm">{t('label')}</span>
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    <ListBox.Item id="none" textValue={t('unlabeled')}>
                                        {t('unlabeled')}
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                    {labels.map((l) => (
                                        <ListBox.Item key={l.id} id={l.id} textValue={l.name}>
                                            <span className="flex items-center gap-2">
                                                <span className={`w-2 h-2 rounded-full shrink-0 ${LABEL_COLOR_SWATCH[l.color] || "bg-zinc-500"}`} />
                                                {l.name}
                                            </span>
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                    )}

                    {eligibleReviewIds.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={bulkMarkReviewed} isDisabled={marking}>
                            <Check className="w-4 h-4" />
                            <span className="action-bar__label">{t('markReviewedBulk', { count: eligibleReviewIds.length })}</span>
                        </Button>
                    )}

                    {eligibleUndoIds.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={bulkUndo} isDisabled={marking}>
                            <Undo2 className="w-4 h-4" />
                            <span className="action-bar__label">{t('undoBulk', { count: eligibleUndoIds.length })}</span>
                        </Button>
                    )}

                    {eligibleCancelIds.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={bulkCancelRequests} isDisabled={cancelling}>
                            <Ban className="w-4 h-4" />
                            <span className="action-bar__label">{cancelling ? t('cancelling') : t('cancelRequestBulk', { count: eligibleCancelIds.length })}</span>
                        </Button>
                    )}

                    {eligibleArchiveIds.length > 0 && (
                        <Button variant="ghost" size="sm" onClick={() => archiveSubmissions(eligibleArchiveIds)} isDisabled={archiving}>
                            <Archive className="w-4 h-4" />
                            <span className="action-bar__label">{archiving ? t('archiving') : t('archiveBulk', { count: eligibleArchiveIds.length })}</span>
                        </Button>
                    )}
                </ActionBar.Content>
                <Separator orientation="vertical" className="h-6" />
                <ActionBar.Suffix>
                    <Tooltip>
                        <Button
                            isIconOnly
                            variant="ghost"
                            size="sm"
                            aria-label={t('clearSelection')}
                            onClick={() => setSelectedIds(new Set())}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                        <Tooltip.Content>{t('clearSelection')}</Tooltip.Content>
                    </Tooltip>
                </ActionBar.Suffix>
            </ActionBar>
        </div>
    );
}
