"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Pencil, Trash2 } from "lucide-react";
import { Chip } from "@heroui/react/chip";
import api from "@/lib/axios";
import ImagePreview from "@/app/components/ImagePreview";
import CardActionsMenu from "@/app/components/CardActionsMenu";
import { categoryLabel, severityDotClass } from "@/utils/observations";

/**
 * Where a linked-item chip navigates. Exercise/Food Item land on their
 * (workspace-level) library list — there's no per-item detail page today, so
 * that's the closest real destination. Check-in/Assessment land on that
 * client's Forms review page, auto-selecting the exact submission via
 * `?requestId=`.
 */
function linkedItemHref(item, workspaceSlug, clientId) {
    if (item.type === "exercise") return `/${workspaceSlug}/training/exercises`;
    if (item.type === "foodItem") return `/${workspaceSlug}/nutrition/food-items`;
    if (item.type === "checkIn" || item.type === "assessment") {
        return `/${workspaceSlug}/clients/${clientId}/forms?requestId=${item.id}`;
    }
    return null;
}

// Mirrors the formatRelativeTime helper already used in FormsPanel.js / the
// nutrition & training LeftPanels — same common.*Ago translation keys.
function formatRelativeTime(dateStr, t) {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 1) return t("justNow");
    if (diffMins < 60) return t("minutesAgo", { count: diffMins });
    if (diffHours < 24) return t("hoursAgo", { count: diffHours });
    if (diffDays === 1) return t("yesterday");
    if (diffDays < 7) return t("daysAgo", { count: diffDays });
    if (diffDays < 30) return t("weeksAgo", { count: Math.floor(diffDays / 7) });
    if (diffDays < 365) return t("monthsAgo", { count: Math.floor(diffDays / 30) });
    return t("yearsAgo", { count: Math.floor(diffDays / 365) });
}

/**
 * One observation entry, everywhere it's listed (the Observations tab, the
 * Client Overview widget, Exercise/Food Insights, Check-in Review, Messenger).
 * Compact single-row layout — matches the Training/Nutrition builder row
 * convention rather than a full Card, so severity (a small dot, not a chip
 * or a border) and category/related-item (plain meta text) stay in support
 * of the title instead of competing with it.
 *
 * Edit/delete are only offered to the author or the workspace owner
 * (`currentUserId`/`isOwner`) — mirrors the same check the backend enforces,
 * so the UI never offers an action the API would reject. Editing is handed
 * off to the parent via `onEdit` — the card itself no longer owns a modal.
 */
export default function ObservationCard({ observation, clientId, currentUserId, isOwner, onEdit, onDeleted }) {
    const t = useTranslations("clientObservations");
    const tCommon = useTranslations("common");
    const { workspaceSlug } = useParams();
    const [deleting, setDeleting] = useState(false);

    const canManage = !!clientId && (isOwner || (!!currentUserId && observation.author?.id === currentUserId));

    async function handleDelete() {
        if (!window.confirm(t("deleteConfirm"))) return;
        setDeleting(true);
        try {
            await api.delete(`/api/clients/${clientId}/observations/${observation.id}`);
            onDeleted?.(observation.id);
        } catch {
            setDeleting(false);
        }
    }

    return (
        <div className="group flex items-start gap-2.5 rounded-xl border border-border px-3 py-2 hover:bg-default/40 transition-colors">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${severityDotClass(observation.severity)}`} aria-hidden="true" />
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
                <div className="flex items-start gap-2">
                    <p className="flex-1 min-w-0 text-sm font-semibold text-foreground wrap-break-word">{observation.title}</p>
                    <span className="shrink-0 text-[11px] text-muted-foreground/70 mt-0.5">{formatRelativeTime(observation.createdAt, tCommon)}</span>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap text-xs text-muted-foreground">
                    <span>{observation.author?.name?.trim() || tCommon("noData")}</span>
                    <span className="text-muted-foreground/40">·</span>
                    <span>{categoryLabel(observation.category, t)}</span>
                </div>

                {observation.content && (
                    <p className="text-xs text-muted-foreground wrap-break-word mt-0.5">{observation.content}</p>
                )}

                {observation.relatedItems?.length > 0 && (
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        {observation.relatedItems.map((item) => {
                            const href = linkedItemHref(item, workspaceSlug, clientId);
                            const chip = (
                                <Chip size="sm" variant="soft" color="accent">
                                    {t(`relatedType.${item.type}`)} &middot; {item.label}
                                </Chip>
                            );
                            return href ? (
                                <Link key={`${item.type}:${item.id}`} href={href} className="hover:opacity-80 transition-opacity">
                                    {chip}
                                </Link>
                            ) : (
                                <span key={`${item.type}:${item.id}`}>{chip}</span>
                            );
                        })}
                    </div>
                )}

                {observation.attachmentUrl && (
                    <ImagePreview src={observation.attachmentUrl} alt={observation.title} title={observation.title} triggerClassName="mt-1">
                        <img
                            src={observation.attachmentUrl}
                            alt=""
                            className="h-10 w-10 rounded-md border border-border object-cover"
                            loading="lazy"
                        />
                    </ImagePreview>
                )}
            </div>
            {canManage && !deleting && (
                <CardActionsMenu
                    ariaLabel={tCommon("edit")}
                    items={[
                        { key: "edit", label: tCommon("edit"), icon: <Pencil size={14} className="me-2 shrink-0" />, onSelect: () => onEdit?.(observation) },
                        { key: "delete", label: tCommon("delete"), icon: <Trash2 size={14} className="me-2 shrink-0" />, danger: true, onSelect: handleDelete },
                    ]}
                />
            )}
        </div>
    );
}
