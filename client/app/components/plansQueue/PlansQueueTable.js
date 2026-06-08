"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import DataTable from "@/app/components/DataTable";
import { Chip } from "@heroui/react/chip";
import { useLocale, useTranslations } from "next-intl";
import { getLocalizedField } from "@/utils/localization";

export default function PlansQueueTable({ initialSubmissions, awaiting, forms }) {
    const t = useTranslations('plansQueue');
    const locale = useLocale();
    const [submissions, setSubmissions] = useState(initialSubmissions);
    const [expandedId, setExpandedId] = useState(null);
    const [marking, setMarking] = useState(false);
    const [filteredItems, setFilteredItems] = useState(null);
    const router = useRouter();

    const handleFilteredDataChange = useCallback((data) => {
        setFilteredItems(data);
    }, []);

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

    const mergedSubmissions = submissions.map((item) => ({
        ...item,
        postAction: item.postAction || getPostAction(item.formId),
        formType: item.formType || getFormType(item.formId),
    }));

    const mergedAwaiting = awaiting.map((item) => ({
        ...item,
        postAction: item.postAction || getPostAction(item.formId),
        formType: item.formType || getFormType(item.formId),
    }));

    const allItems = [...mergedAwaiting, ...mergedSubmissions];

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

    function formatAnswer(value) {
        if (Array.isArray(value)) return value.join(", ");
        if (typeof value === "number") return String(value);
        if (value === "") return "-";
        if (value == null) return "-";
        return String(value);
    }

    const visible = filteredItems || allItems;
    const scheduledCount = visible.filter((r) => r.status === "scheduled").length;
    const awaitingCount = visible.filter((r) => r.status === "awaiting").length;
    const needActionCount = visible.filter((r) => r.status === "need-action").length;
    const actionDoneCount = visible.filter((r) => r.status === "action-done").length;

    const nutritionPlanCount = visible.filter((r) => r.postAction === "nutrition-plan").length;
    const workoutPlanCount = visible.filter((r) => r.postAction === "workout-plan").length;
    const noActionCount = visible.filter((r) => r.postAction === "nothing").length;

    function parseQueueDate(dateStr) {
        if (!dateStr) return new Date(0);
        const parsed = new Date(dateStr);
        if (!Number.isNaN(parsed.getTime())) return parsed;
        return new Date(0);
    }

    function shortDate(dateStr) {
        if (!dateStr) return <span className="text-muted-foreground">-</span>;
        const d = new Date(dateStr);
        if (Number.isNaN(d.getTime())) return <span className="text-muted-foreground/60 text-xs">{dateStr}</span>;
        return (
            <span className="text-muted-foreground text-xs whitespace-nowrap">
                {d.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                <span className="text-muted-foreground ml-1">
                    {d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: true })}
                </span>
            </span>
        );
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
            width: "100px",
            cardPriority: "secondary",
            render: (row) => (
                <Chip size="sm" className={`whitespace-nowrap ${
                    row.formType === "assessment"
                        ? "bg-purple-500/20 text-purple-400"
                        : "bg-accent/15 text-accent"
                }`}>
                    {row.formType}
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
                    <div className="flex items-center gap-1">
                        <button
                            onClick={(e) => { e.stopPropagation(); setExpandedId(expandedId === row.id ? null : row.id); }}
                            className="text-muted-foreground hover:text-foreground text-xs px-2 py-1 rounded hover:bg-default transition-colors"
                        >
                            {expandedId === row.id ? t('hide') : t('view')}
                        </button>
                        {row.status === "need-action" && (
                            row.postAction === "nutrition-plan" ? (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/clients/${row.clientId}/nutrition?submissionId=${row.id}`);
                                    }}
                                    className="text-amber-600 hover:text-amber-700 text-[11px] px-2 py-1 rounded hover:bg-amber-500/15 transition-colors whitespace-nowrap"
                                >
                                    {t('openNutrition')}
                                </button>
                            ) : row.postAction === "workout-plan" ? (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        router.push(`/clients/${row.clientId}/training?submissionId=${row.id}`);
                                    }}
                                    className="text-primary hover:text-primary/80 text-[11px] px-2 py-1 rounded hover:bg-primary/10 transition-colors whitespace-nowrap"
                                >
                                    {t('openWorkout')}
                                </button>
                            ) : (
                                <button
                                    onClick={(e) => { e.stopPropagation(); markReviewed([row.id], "review"); }}
                                    disabled={marking}
                                    className="text-emerald-600 hover:text-emerald-700 text-[11px] px-2 py-1 rounded hover:bg-emerald-500/15 transition-colors disabled:opacity-50 whitespace-nowrap"
                                >
                                    {t('markReviewed')}
                                </button>
                            )
                        )}
                        {row.status === "action-done" && (
                            <button
                                onClick={(e) => { e.stopPropagation(); markReviewed([row.id], "undo"); }}
                                disabled={marking}
                                className="text-muted-foreground hover:text-foreground text-[11px] px-2 py-1 rounded hover:bg-default transition-colors disabled:opacity-50 whitespace-nowrap"
                            >
                                {t('undo')}
                            </button>
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
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg">
                        <div className="w-2 h-2 rounded-full bg-accent" />
                        <span className="text-primary text-sm font-medium">{scheduledCount} {t('scheduled')}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg">
                        <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                        <span className="text-muted-foreground text-sm font-medium">{awaitingCount} {t('awaiting')}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 rounded-lg">
                        <div className="w-2 h-2 rounded-full bg-amber-400" />
                        <span className="text-amber-500 text-sm font-medium">{needActionCount} {t('needAction')}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 rounded-lg">
                        <div className="w-2 h-2 rounded-full bg-emerald-500" />
                        <span className="text-emerald-600 text-sm font-medium">{actionDoneCount} {t('actionDone')}</span>
                    </div>
                </div>
                <div className="flex items-center gap-3 flex-wrap">
                    <span className="text-muted-foreground text-xs">{t('actionType')}</span>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 rounded-lg">
                        <span className="text-amber-500 text-sm font-medium">{nutritionPlanCount} {t('nutrition')}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-lg">
                        <span className="text-primary text-sm font-medium">{workoutPlanCount} {t('workout')}</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-lg">
                        <span className="text-muted-foreground text-sm font-medium">{noActionCount} {t('noAction')}</span>
                    </div>
                </div>
            </div>

            <DataTable
                columns={columns}
                data={allItems}
                rowKey="id"
                scrollable
                dateParser={parseQueueDate}
                onFilteredDataChange={handleFilteredDataChange}
                renderExpandedRow={renderExpandedRow}
                renderMobileExpanded={renderMobileExpanded}
            />
        </>
    );
}
