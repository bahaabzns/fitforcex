"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Eye, EyeOff, Salad, Dumbbell, Check, Undo2, UserPlus, ListChecks, Ban, X } from "lucide-react";
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

// Compact icon button with an accessible tooltip — used for the row actions.
function IconAction({ label, onClick, disabled, className = "", children }) {
    return (
        <Tooltip>
            <button
                type="button"
                onClick={onClick}
                disabled={disabled}
                aria-label={label}
                className={`p-1.5 rounded hover:bg-default transition-colors disabled:opacity-50 ${className}`}
            >
                {children}
            </button>
            <Tooltip.Content>{label}</Tooltip.Content>
        </Tooltip>
    );
}

export default function PlansQueueTable({ initialSubmissions, awaiting, forms, members = [] }) {
    const t = useTranslations('plansQueue');
    const locale = useLocale();
    const { formatDateTime } = useDateFormatter();
    const [submissions, setSubmissions] = useState(initialSubmissions);
    const [expandedId, setExpandedId] = useState(null);
    const [marking, setMarking] = useState(false);
    // Per-row assignee overrides applied on top of the server data (id → { assignedTo, assignedToName }).
    const [assignMap, setAssignMap] = useState({});
    // Card quick-filters: click a stat card to filter the table by status / action.
    const [cardStatus, setCardStatus] = useState(null);
    const [cardAction, setCardAction] = useState(null);
    const router = useRouter();
    const { workspaceSlug } = useParams();

    // Bulk selection (mirrors the Clients datatable's selection + Action Bar pattern).
    const [selectedIds, setSelectedIds] = useState(new Set());
    // Full filtered+sorted row set from the table (across all pages) — powers "select all filtered".
    const [filteredItems, setFilteredItems] = useState([]);
    // Ids cancelled via the bulk "Cancel Request" action — filtered out client-side
    // until the next load, since `awaiting` (unlike `submissions`) isn't local state.
    const [removedIds, setRemovedIds] = useState(new Set());
    const [bulkAssigning, setBulkAssigning] = useState(false);
    const [cancelling, setCancelling] = useState(false);

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

    function getFormQuestions(formId) {
        const form = forms.find((f) => f.id === formId);
        return form?.questions || [];
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

    const allItems = [...mergedAwaiting, ...mergedSubmissions].filter((r) => !removedIds.has(r.id));

    // Card quick-filters narrow the rows handed to the table; the table's own
    // column filters then apply on top.
    const displayItems = allItems.filter((r) =>
        (!cardStatus || r.status === cardStatus) &&
        (!cardAction || r.postAction === cardAction)
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

    function formatAnswer(value) {
        if (Array.isArray(value)) return value.join(", ");
        if (typeof value === "number") return String(value);
        if (value === "") return "-";
        if (value == null) return "-";
        return String(value);
    }

    // Stat cards show full totals (independent of the active card filter) so the
    // numbers stay stable as you toggle filters.
    const scheduledCount = allItems.filter((r) => r.status === "scheduled").length;
    const awaitingCount = allItems.filter((r) => r.status === "awaiting").length;
    const needActionCount = allItems.filter((r) => r.status === "need-action").length;
    const actionDoneCount = allItems.filter((r) => r.status === "action-done").length;

    const nutritionPlanCount = allItems.filter((r) => r.postAction === "nutrition-plan").length;
    const workoutPlanCount = allItems.filter((r) => r.postAction === "workout-plan").length;
    const noActionCount = allItems.filter((r) => r.postAction === "nothing").length;

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
            key: "formTitle_en",
            label: t('form'),
            filterType: "multi",
            options: [...new Set(allItems.map((s) => getLocalizedField(s, 'formTitle', locale)).filter(Boolean))],
            sortable: true,
            width: "180px",
            cardPriority: "primary",
            render: (row) => <span className="text-foreground text-sm">{getLocalizedField(row, 'formTitle', locale)}</span>,
        },
        {
            key: "formType",
            label: t('type'),
            filterType: "multi",
            options: ["assessment", "check-in"],
            optionLabel: (v) => titleCaseType(v),
            width: "100px",
            cardPriority: "secondary",
            render: (row) => (
                <Chip size="sm" className={`whitespace-nowrap ${
                    row.formType === "assessment"
                        ? "bg-purple-500/20 text-purple-400"
                        : "bg-accent/15 text-accent"
                }`}>
                    {titleCaseType(row.formType)}
                </Chip>
            ),
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
        {
            key: "actionTakenAt",
            label: t('actionTaken'),
            sortable: true,
            filterType: "dateRange",
            width: "150px",
            cardPriority: "secondary",
            render: (row) => shortDate(row.actionTakenAt),
        },
        {
            key: "status",
            label: t('status'),
            filterType: "multi",
            options: ["scheduled", "awaiting", "need-action", "action-done"],
            width: "130px",
            cardPriority: "primary",
            render: (row) => statusBadge(row.status),
        },
        {
            key: "assignedTo",
            label: t('assigned'),
            filterType: "multi",
            options: members.map((m) => m.id),
            optionLabel: (id) => members.find((m) => m.id === id)?.name || id,
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
            filterValue: (row) => row.postAction,
            width: "220px",
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
                    <div className="flex items-center gap-0.5">
                        <IconAction
                            label={expandedId === row.id ? t('hide') : t('view')}
                            onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === row.id ? null : row.id); }}
                            className="text-muted-foreground hover:text-foreground"
                        >
                            {expandedId === row.id ? <EyeOff size={15} /> : <Eye size={15} />}
                        </IconAction>
                        {row.status === "need-action" && (
                            row.postAction === "nutrition-plan" ? (
                                <IconAction
                                    label={t('openNutrition')}
                                    onClick={(e) => { e.stopPropagation(); router.push(`/${workspaceSlug}/clients/${row.clientId}/nutrition?submissionId=${row.id}`); }}
                                    className="text-amber-600 hover:text-amber-700 hover:bg-amber-500/15"
                                >
                                    <Salad size={15} />
                                </IconAction>
                            ) : row.postAction === "workout-plan" ? (
                                <IconAction
                                    label={t('openWorkout')}
                                    onClick={(e) => { e.stopPropagation(); router.push(`/${workspaceSlug}/clients/${row.clientId}/training?submissionId=${row.id}`); }}
                                    className="text-primary hover:text-primary/80 hover:bg-primary/10"
                                >
                                    <Dumbbell size={15} />
                                </IconAction>
                            ) : (
                                <IconAction
                                    label={t('markReviewed')}
                                    onClick={(e) => { e.stopPropagation(); markReviewed([row.id], "review"); }}
                                    disabled={marking}
                                    className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/15"
                                >
                                    <Check size={15} />
                                </IconAction>
                            )
                        )}
                        {row.status === "action-done" && (
                            <IconAction
                                label={t('undo')}
                                onClick={(e) => { e.stopPropagation(); markReviewed([row.id], "undo"); }}
                                disabled={marking}
                                className="text-muted-foreground hover:text-foreground"
                            >
                                <Undo2 size={15} />
                            </IconAction>
                        )}
                    </div>
                );
            },
        },
    ];

    function renderAnswers(row) {
        const questions = getFormQuestions(row.formId);
        if (questions.length > 0) {
            return questions.map((q) => (
                <div key={q.id} className="flex flex-col gap-0.5">
                    <span className="text-muted-foreground text-xs">{getLocalizedField(q, 'label', locale)}</span>
                    <span className="text-foreground text-sm">{formatAnswer(row.answers?.[q.id])}</span>
                </div>
            ));
        }

        return (row.responses || []).map((r, index) => (
            <div key={`${row.id}-${index}`} className="flex flex-col gap-0.5">
                <span className="text-muted-foreground text-xs">{getLocalizedField(r, 'label', locale) || `Question ${index + 1}`}</span>
                <span className="text-foreground text-sm">{formatAnswer(r.answer)}</span>
            </div>
        ));
    }

    function renderExpandedRow(row) {
        if (expandedId !== row.id || row.status === "awaiting" || row.status === "scheduled") return null;

        return (
            <tr key={`expanded-${row.id}`}>
                <td colSpan={columns.length + 1} className="px-4 py-0">
                    <div className="bg-secondary rounded-lg p-4 my-2 border border-border">
                        <h4 className="text-foreground text-sm font-semibold mb-3">
                            {t('submissionAnswers')} - {getLocalizedField(row, 'formTitle', locale)}
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {renderAnswers(row)}
                        </div>
                    </div>
                </td>
            </tr>
        );
    }

    function renderMobileExpanded(row) {
        if (expandedId !== row.id || row.status === "awaiting" || row.status === "scheduled") return null;

        return (
            <div className="mt-3 bg-secondary rounded-lg p-4 border border-border">
                <h4 className="text-foreground text-sm font-semibold mb-3">{t('submissionAnswers')}</h4>
                <div className="flex flex-col gap-3">{renderAnswers(row)}</div>
            </div>
        );
    }

    return (
        <>
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                    <h1 className="text-3xl font-bold">{t('title')}</h1>
                    <p className="text-muted-foreground text-sm mt-1">{t('description')}</p>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <button
                        type="button"
                        onClick={() => setCardStatus((s) => (s === "scheduled" ? null : "scheduled"))}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 cursor-pointer transition-shadow ${cardStatus === "scheduled" ? "ring-2 ring-primary/50" : "hover:ring-1 hover:ring-primary/30"}`}
                    >
                        <div className="w-2 h-2 rounded-full bg-accent" />
                        <span className="text-primary text-sm font-medium">{scheduledCount} {t('scheduled')}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setCardStatus((s) => (s === "awaiting" ? null : "awaiting"))}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary cursor-pointer transition-shadow ${cardStatus === "awaiting" ? "ring-2 ring-muted-foreground/40" : "hover:ring-1 hover:ring-muted-foreground/30"}`}
                    >
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                        <span className="text-muted-foreground text-sm font-medium">{awaitingCount} {t('awaiting')}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setCardStatus((s) => (s === "need-action" ? null : "need-action"))}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 cursor-pointer transition-shadow ${cardStatus === "need-action" ? "ring-2 ring-amber-400/60" : "hover:ring-1 hover:ring-amber-400/40"}`}
                    >
                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="text-amber-500 text-sm font-medium">{needActionCount} {t('needAction')}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setCardStatus((s) => (s === "action-done" ? null : "action-done"))}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 cursor-pointer transition-shadow ${cardStatus === "action-done" ? "ring-2 ring-emerald-500/60" : "hover:ring-1 hover:ring-emerald-500/40"}`}
                    >
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-emerald-600 text-sm font-medium">{actionDoneCount} {t('actionDone')}</span>
                    </button>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-muted-foreground text-xs">{t('actionType')}</span>
                    <button
                        type="button"
                        onClick={() => setCardAction((a) => (a === "nutrition-plan" ? null : "nutrition-plan"))}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-amber-500/10 cursor-pointer transition-shadow ${cardAction === "nutrition-plan" ? "ring-2 ring-amber-400/60" : "hover:ring-1 hover:ring-amber-400/40"}`}
                    >
                        <span className="text-amber-500 text-sm font-medium">{nutritionPlanCount} {t('nutrition')}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setCardAction((a) => (a === "workout-plan" ? null : "workout-plan"))}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 cursor-pointer transition-shadow ${cardAction === "workout-plan" ? "ring-2 ring-primary/50" : "hover:ring-1 hover:ring-primary/30"}`}
                    >
                        <span className="text-primary text-sm font-medium">{workoutPlanCount} {t('workout')}</span>
                    </button>
                    <button
                        type="button"
                        onClick={() => setCardAction((a) => (a === "nothing" ? null : "nothing"))}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary cursor-pointer transition-shadow ${cardAction === "nothing" ? "ring-2 ring-muted-foreground/40" : "hover:ring-1 hover:ring-muted-foreground/30"}`}
                    >
                        <span className="text-muted-foreground text-sm font-medium">{noActionCount} {t('noAction')}</span>
                    </button>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={displayItems}
                rowKey="id"
                scrollable
                dateParser={parseQueueDate}
                quickSearch={{
                    fields: ["clientName", "clientEmail", "clientCode", "formTitle_en", "formTitle_ar"],
                    placeholder: t('searchPlaceholder'),
                }}
                renderExpandedRow={renderExpandedRow}
                renderMobileExpanded={renderMobileExpanded}
                selectable
                selectedKeys={selectedIds}
                onSelectionChange={setSelectedIds}
                onFilteredDataChange={setFilteredItems}
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
        </>
    );
}
