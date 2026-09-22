"use client";

import { useState } from "react";
import { ArchiveRestore, ListChecks, X } from "lucide-react";
import api from "@/lib/axios";
import { useDateFormatter } from "@/utils/useDateFormatter";
import DataTable from "@/app/components/DataTable";
import ActionBar from "@/app/components/ActionBar";
import { Button } from "@heroui/react/button";
import { Chip } from "@heroui/react/chip";
import { Separator } from "@heroui/react/separator";
import { Tooltip } from "@heroui/react/tooltip";
import { useLocale, useTranslations } from "next-intl";
import { getLocalizedField } from "@/utils/localization";
import { LABEL_COLOR_CLASSES } from "@/app/components/plansQueue/ManageLabelsModal";

function titleCaseType(type) {
    if (!type) return "";
    return type.charAt(0).toUpperCase() + type.slice(1);
}

// Read-only counterpart to PlansQueueTable — lists archived submissions with a
// single "Restore" action (per-row and bulk), mirroring the clients archive/restore split.
export default function ArchivedSubmissionsTable({ items, onRestored }) {
    const t = useTranslations('plansQueue');
    const locale = useLocale();
    const { formatDateTime } = useDateFormatter();
    const [selectedIds, setSelectedIds] = useState(new Set());
    const [filteredItems, setFilteredItems] = useState([]);
    const [restoring, setRestoring] = useState(false);

    async function restoreSubmissions(ids) {
        if (ids.length === 0) return;
        setRestoring(true);
        try {
            await api.patch("/api/forms/queue/archive", { ids, action: "restore" });
            setSelectedIds(new Set());
            onRestored?.(ids);
        } catch {
            // silent
        }
        setRestoring(false);
    }

    function shortDate(dateStr) {
        if (!dateStr) return <span className="text-muted-foreground">-</span>;
        const formatted = formatDateTime(dateStr);
        if (!formatted) return <span className="text-muted-foreground/60 text-xs">{dateStr}</span>;
        return <span className="text-muted-foreground text-xs whitespace-nowrap">{formatted}</span>;
    }

    const columns = [
        {
            key: "clientCode",
            label: t('code'),
            sortable: true,
            filterType: "text",
            width: "70px",
            render: (row) => <span className="text-muted-foreground font-mono text-xs">#{row.clientCode ?? "-"}</span>,
        },
        {
            key: "clientName",
            label: t('client'),
            filterType: "text",
            sortable: true,
            width: "180px",
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
            options: [...new Set(items.map((s) => getLocalizedField(s, 'formTitle', locale)).filter(Boolean))],
            sortable: true,
            width: "180px",
            render: (row) => <span className="text-foreground text-sm">{getLocalizedField(row, 'formTitle', locale)}</span>,
        },
        {
            key: "formType",
            label: t('type'),
            filterType: "multi",
            options: ["assessment", "check-in"],
            optionLabel: (v) => titleCaseType(v),
            width: "100px",
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
            key: "submittedAt",
            label: t('submitted'),
            sortable: true,
            filterType: "dateRange",
            width: "150px",
            render: (row) => shortDate(row.submittedAt),
        },
        {
            key: "archivedAt",
            label: t('archivedAt'),
            sortable: true,
            filterType: "dateRange",
            width: "150px",
            render: (row) => shortDate(row.archivedAt),
        },
        {
            // Read-only here — archived items keep whatever label they had when
            // archived, but this view has no per-row actions to change it, matching
            // every other column in this table (see PlansQueueTable for the editable version).
            key: "label",
            label: t('label'),
            filterType: "multi",
            options: [...new Set(items.map((r) => r.labelName).filter(Boolean))],
            sortable: true,
            width: "130px",
            render: (row) => row.labelName
                ? <Chip size="sm" className={`whitespace-nowrap ${LABEL_COLOR_CLASSES[row.labelColor] || "bg-zinc-500/20 text-zinc-400"}`}>{row.labelName}</Chip>
                : <span className="text-muted-foreground text-sm">-</span>,
        },
        {
            key: "actions",
            label: t('action'),
            width: "80px",
            alwaysVisibleActions: true,
            stickyEnd: true,
            render: (row) => (
                <Tooltip>
                    <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); restoreSubmissions([row.id]); }}
                        disabled={restoring}
                        aria-label={t('restore')}
                        className="p-1.5 rounded-full transition-colors disabled:opacity-50 bg-accent/15 text-accent hover:bg-accent/25"
                    >
                        <ArchiveRestore size={15} />
                    </button>
                    <Tooltip.Content>{t('restore')}</Tooltip.Content>
                </Tooltip>
            ),
        },
    ];

    return (
        <>
            <DataTable
                columns={columns}
                data={items}
                rowKey="id"
                scrollable
                quickSearch={{
                    fields: ["clientName", "clientEmail", "clientCode", "formTitle_en", "formTitle_ar"],
                    placeholder: t('searchPlaceholder'),
                }}
                selectable
                selectedKeys={selectedIds}
                onSelectionChange={setSelectedIds}
                onFilteredDataChange={setFilteredItems}
            />

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
                    <Button variant="ghost" size="sm" onClick={() => restoreSubmissions([...selectedIds])} isDisabled={restoring}>
                        <ArchiveRestore className="w-4 h-4" />
                        <span className="action-bar__label">{restoring ? t('restoring') : t('restoreBulk', { count: selectedIds.size })}</span>
                    </Button>
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
