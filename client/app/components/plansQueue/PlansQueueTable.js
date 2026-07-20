"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Salad, Dumbbell, Check, Undo2, UserPlus, ListChecks, Ban, X, Archive, Target, FileText, ClipboardList, Package, Users, Activity } from "lucide-react";
import api from "@/lib/axios";
import { useDateFormatter } from "@/utils/useDateFormatter";
import DataTable from "@/app/components/DataTable";
import ActionBar from "@/app/components/ActionBar";
import { Button } from "@heroui/react/button";
import { Chip } from "@heroui/react/chip";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";
import { Separator } from "@heroui/react/separator";
import { Tooltip } from "@heroui/react/tooltip";
import { useLocale, useTranslations } from "next-intl";
import { getLocalizedField } from "@/utils/localization";

// "assessment" → "Assessment", "check-in" → "Check-in"
function titleCaseType(type) {
    if (!type) return "";
    return type.charAt(0).toUpperCase() + type.slice(1);
}

// Deliberately disjoint from the purple/amber/accent/emerald/zinc already used
// for Type and Action chips in this table, so a package chip never reads as
// one of those. Cycles (reused) once distinct package count exceeds this —
// there's no way to guarantee uniqueness past a finite palette.
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

export default function PlansQueueTable({
    initialSubmissions, awaiting, forms, members = [],
    hideStatusColumn = false, hideActionTakenColumn = false,
    title, description, headerAction,
    // The just-completed submission id, already claimed once (Strict-Mode-safe,
    // URL already stripped) by plans-queue/page.js — see that file for why the
    // claim lives there now: it also owns the Main queue's temporary retention
    // of this row, so it needs to know when the exit animation below has
    // actually finished, not just when the row started reacting to it.
    completingId = null,
    // Full row data for completingId, only needed on Main: its status has
    // already flipped to action-done by the time we're back here, so it's
    // structurally excluded from `initialSubmissions` — spliced into
    // `allItems` below (not merged into `submissions` state) so it can still
    // be found and animated without needing a resync of state that's meant
    // to stay a one-time snapshot (see `submissions` below).
    completingItem = null,
    onCompletionDone,
}) {
    const t = useTranslations('plansQueue');
    const locale = useLocale();
    const { formatDateTime } = useDateFormatter();
    const [submissions, setSubmissions] = useState(initialSubmissions);
    const [marking, setMarking] = useState(false);
    // Per-row assignee overrides applied on top of the server data (id → { assignedTo, assignedToName }).
    const [assignMap, setAssignMap] = useState({});
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
    // Full filtered+sorted row set from the table (across all pages) — powers "select all filtered".
    const [filteredItems, setFilteredItems] = useState([]);
    // Mirrored into a ref so the completion-transition effect's timeout
    // closures (above) can read the current filtered order to find "the next
    // item" without re-running that effect every time filters/sort change.
    useEffect(() => { filteredItemsRef.current = filteredItems; }, [filteredItems]);
    // Ids cancelled via the bulk "Cancel Request" action — filtered out client-side
    // until the next load, since `awaiting` (unlike `submissions`) isn't local state.
    const [removedIds, setRemovedIds] = useState(new Set());
    // Ids archived via the row/bulk "Archive" action — same client-side hide-until-reload
    // strategy as removedIds, kept separate so the two actions stay easy to reason about.
    const [archivedIds, setArchivedIds] = useState(new Set());
    const [bulkAssigning, setBulkAssigning] = useState(false);
    const [cancelling, setCancelling] = useState(false);
    const [archiving, setArchiving] = useState(false);

    async function assignTo(rowId, userId) {
        const member = members.find((m) => m.id === userId);
        // Optimistic — reflect the new assignee immediately, then persist.
        setAssignMap((prev) => ({
            ...prev,
            [rowId]: { assignedTo: userId || null, assignedToName: member?.name || null },
        }));
        try {
            await api.patch("/api/forms/queue/assign", { ids: [rowId], assignedTo: userId || null });
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
        return {
            ...item,
            postAction: item.postAction || getPostAction(item.formId),
            formType: item.formType || getFormType(item.formId),
            assignedTo: override ? override.assignedTo : (item.assignedTo ?? null),
            assignedToName: override ? override.assignedToName : (item.assignedToName ?? null),
        };
    };

    const mergedSubmissions = submissions.map(withDerived);
    const mergedAwaiting = awaiting.map(withDerived);

    const baseItems = [...mergedAwaiting, ...mergedSubmissions].filter((r) => !removedIds.has(r.id) && !archivedIds.has(r.id));
    // Splice the just-completed row in for the duration of its animation
    // (Main only — History already has it naturally, since it keeps every
    // status). Appended, not merged into submissions/mergedSubmissions
    // state, so it disappears cleanly the instant completingItem clears
    // (handleCompletionDone in page.js) with no risk of it lingering behind
    // a stale optimistic update the way folding it into local state could.
    const allItems = completingItem && !baseItems.some((r) => r.id === completingItem.id)
        ? [...baseItems, withDerived(completingItem)]
        : baseItems;

    // Sorted (not insertion order) so a given package name always lands on the
    // same color regardless of which row it first appears in.
    const packageNames = [...new Set(allItems.map((r) => r.clientPackage).filter(Boolean))].sort();
    const packageColors = Object.fromEntries(
        packageNames.map((name, i) => [name, PACKAGE_CHIP_COLORS[i % PACKAGE_CHIP_COLORS.length]])
    );

    async function markReviewed(ids, action = "review") {
        setMarking(true);
        try {
            const res = await api.patch("/api/forms/queue/review", { ids, action });
            const updatedIds = res.data?.updatedIds || ids;
            setSubmissions((prev) =>
                prev.map((s) =>
                    updatedIds.includes(s.id) || updatedIds.includes(String(s.id))
                        ? {
                            ...s,
                            status: action === "undo" ? "need-action" : "action-done",
                            actionTakenAt: action === "undo" ? null : new Date().toISOString(),
                        }
                        : s
                )
            );
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
        const member = members.find((m) => m.id === userId);
        setAssignMap((prev) => {
            const next = { ...prev };
            for (const id of ids) next[id] = { assignedTo: userId || null, assignedToName: member?.name || null };
            return next;
        });
        setBulkAssigning(true);
        try {
            await api.patch("/api/forms/queue/assign", { ids, assignedTo: userId || null });
        } catch {
            // silent — leave the optimistic value; a reload reconciles with the server
        }
        setBulkAssigning(false);
        setSelectedIds(new Set());
    }

    // Only rows the corresponding action is actually valid for — see the Plans Queue
    // bulk-actions analysis: marking a nutrition/workout submission "reviewed" in bulk
    // would silently skip building the plan, so that action is scoped to plain check-ins.
    const selectedItems = allItems.filter((r) => selectedIds.has(r.id));
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
    // deleting. No local state exists for `awaiting` (unlike `submissions`), so cancelled
    // ids are tracked in `removedIds` and filtered out of `allItems` client-side.
    async function bulkCancelRequests() {
        if (eligibleCancelIds.length === 0) return;
        if (!confirm(t('cancelRequestConfirm', { count: eligibleCancelIds.length }))) return;
        setCancelling(true);
        try {
            await api.delete("/api/forms/queue/cancel", { data: { ids: eligibleCancelIds } });
            setRemovedIds((prev) => new Set([...prev, ...eligibleCancelIds]));
            setSelectedIds(new Set());
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
        } catch {
            // silent
        }
        setArchiving(false);
    }

    function parseQueueDate(dateStr) {
        if (!dateStr) return new Date(0);
        const parsed = new Date(dateStr);
        if (!Number.isNaN(parsed.getTime())) return parsed;
        return new Date(0);
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
                    <p className="text-foreground font-medium text-sm truncate">{row.clientName}</p>
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
            options: [...new Set(allItems.map((s) => getLocalizedField(s, 'formTitle', locale)).filter(Boolean))],
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
                <Select
                    aria-label={t('assignTo')}
                    value={row.assignedTo ?? "none"}
                    onChange={(v) => assignTo(row.id, v === "none" ? null : v)}
                    size="sm"
                >
                    <Select.Trigger className="border-0! bg-transparent! shadow-none! min-h-0! py-1! px-2! gap-1.5 items-center text-muted-foreground hover:text-foreground transition-colors cursor-pointer max-w-full">
                        <UserPlus size={13} className="shrink-0" />
                        <span className="truncate text-xs">{row.assignedToName || t('unassigned')}</span>
                        <Select.Indicator />
                    </Select.Trigger>
                    <Select.Popover>
                        <ListBox>
                            <ListBox.Item id="none" textValue={t('unassigned')}>
                                {t('unassigned')}
                                <ListBox.ItemIndicator />
                            </ListBox.Item>
                            {members.map((m) => (
                                <ListBox.Item key={m.id} id={m.id} textValue={m.name}>
                                    {m.name}
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
                {headerAction}
            </div>

            <DataTable
                columns={columns}
                data={allItems}
                rowKey="id"
                scrollable
                dateParser={parseQueueDate}
                quickSearch={{
                    fields: ["clientName", "clientEmail", "clientCode", "formTitle_en", "formTitle_ar"],
                    placeholder: t('searchPlaceholder'),
                }}
                selectable
                selectedKeys={selectedIds}
                onSelectionChange={setSelectedIds}
                onFilteredDataChange={setFilteredItems}
                // Scoped per view (hideStatusColumn is 1:1 with main vs. history —
                // see page.js's two call sites): Main and History render different
                // columns over different datasets, so sharing one key meant a
                // filter/sort saved in one view would silently misapply (or just
                // do nothing) when restored into the other's incompatible columns.
                persistKey={`plans-queue-${hideStatusColumn ? "main" : "history"}-${workspaceSlug}`}
                highlightKey={highlightId}
                filterButtonLabel={t('otherFilters')}
                rowClassName={(row) => row.id === highlightId ? "bg-emerald-500/10 outline outline-2 -outline-offset-1 outline-emerald-500/40 transition-colors duration-1000" : ""}
                rowTransition={rowTransition}
            />

            {/* Floating bulk action bar — same component/pattern as the Clients datatable. */}
            <ActionBar isOpen={selectedIds.size > 0} aria-label={t('selectedBar', { count: selectedIds.size })}>
                <ActionBar.Prefix>
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-default px-1.5 text-xs font-semibold text-foreground">
                        {selectedIds.size}
                    </span>
                    {filteredItems.length > selectedIds.size && (
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedIds(new Set(filteredItems.map((r) => r.id)))}
                        >
                            <ListChecks className="w-4 h-4" />
                            <span className="action-bar__label">{t('selectAllFiltered', { count: filteredItems.length })}</span>
                        </Button>
                    )}
                </ActionBar.Prefix>
                <Separator orientation="vertical" className="h-6" />
                <ActionBar.Content>
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
                        <Select.Popover>
                            <ListBox>
                                <ListBox.Item id="none" textValue={t('unassigned')}>
                                    {t('unassigned')}
                                    <ListBox.ItemIndicator />
                                </ListBox.Item>
                                {members.map((m) => (
                                    <ListBox.Item key={m.id} id={m.id} textValue={m.name}>
                                        {m.name}
                                        <ListBox.ItemIndicator />
                                    </ListBox.Item>
                                ))}
                            </ListBox>
                        </Select.Popover>
                    </Select>

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
