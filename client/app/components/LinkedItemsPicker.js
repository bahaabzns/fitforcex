"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";
import { Chip } from "@heroui/react/chip";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";
import api from "@/lib/axios";

const TYPES = ["exercise", "foodItem", "checkIn", "assessment"];

/**
 * "Linked Items" — an observation can link to any number of entities
 * (exercises, food items, check-ins, assessments). Renders every currently
 * linked item as its own small removable chip, plus a collapsed "+ Add Link"
 * toggle that expands to the same type-chips-then-picker flow as before —
 * picking one adds it to the list and collapses back, ready for another.
 *
 *   <LinkedItemsPicker clientId={id} values={linkedItems} onAdd={...} onRemove={...} />
 */
export default function LinkedItemsPicker({ clientId, values = [], onAdd, onRemove }) {
    const t = useTranslations("clientObservations");
    const tCommon = useTranslations("common");
    const [expanded, setExpanded] = useState(false);
    const [pickingType, setPickingType] = useState(null);
    const [options, setOptions] = useState([]);
    const [loadingOptions, setLoadingOptions] = useState(false);
    const [cache, setCache] = useState({});

    async function selectType(type) {
        setPickingType(type);
        if (cache[type]) {
            setOptions(cache[type]);
            return;
        }
        setLoadingOptions(true);
        try {
            let opts = [];
            if (type === "exercise") {
                const res = await api.get("/api/training/exercise-library");
                opts = (res.data ?? []).map((e) => ({ id: e.id, label: e.name_en }));
            } else if (type === "foodItem") {
                const res = await api.get("/api/nutrition/food-items");
                opts = (res.data ?? []).map((f) => ({ id: f.id, label: f.name_en }));
            } else {
                const res = await api.get(`/api/forms/requests/client/${clientId}`);
                const wantAssessment = type === "assessment";
                opts = (res.data ?? [])
                    .filter((r) => (r.form_type === "assessment") === wantAssessment)
                    .map((r) => ({ id: r.id, label: r.form_title_en }));
            }
            setCache((prev) => ({ ...prev, [type]: opts }));
            setOptions(opts);
        } catch {
            setOptions([]);
        } finally {
            setLoadingOptions(false);
        }
    }

    function handlePick(id) {
        if (!id) return;
        const opt = options.find((o) => String(o.id) === String(id));
        if (!opt) return;
        onAdd?.({ type: pickingType, id: opt.id, label: opt.label });
        setExpanded(false);
        setPickingType(null);
    }

    function collapse() {
        setExpanded(false);
        setPickingType(null);
    }

    // Already-linked ids of the type currently being picked, so the list
    // doesn't offer something already added.
    const linkedIdsForType = pickingType
        ? new Set(values.filter((v) => v.type === pickingType).map((v) => String(v.id)))
        : new Set();
    const pickableOptions = options.filter((o) => !linkedIdsForType.has(String(o.id)));

    return (
        <div className="flex flex-col gap-1.5">
            {values.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                    {values.map((v) => (
                        <button key={`${v.type}:${v.id}`} type="button" onClick={() => onRemove?.(v)} className="cursor-pointer inline-flex">
                            <Chip size="sm" color="accent" variant="soft">
                                {t(`relatedType.${v.type}`)} &middot; {v.label}
                                <X size={12} className="ms-1" />
                            </Chip>
                        </button>
                    ))}
                </div>
            )}

            {!expanded ? (
                <button
                    type="button"
                    onClick={() => setExpanded(true)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors self-start"
                >
                    {t("addLinkToggle")}
                </button>
            ) : (
                <div className="flex items-center gap-1.5 flex-wrap">
                    {TYPES.map((type) => (
                        <button key={type} type="button" onClick={() => selectType(type)} className="cursor-pointer">
                            <Chip
                                size="sm"
                                color={pickingType === type ? "accent" : "default"}
                                variant={pickingType === type ? "primary" : "soft"}
                            >
                                {t(`relatedType.${type}`)}
                            </Chip>
                        </button>
                    ))}
                    {pickingType && (
                        <Select size="sm" variant="secondary" onChange={handlePick} aria-label={t("addLinkToggle")} className="min-w-40">
                            <Select.Trigger className="min-w-40">
                                <Select.Value placeholder={loadingOptions ? tCommon("loading") : t("selectItemPlaceholder")} />
                                <Select.Indicator />
                            </Select.Trigger>
                            <Select.Popover>
                                <ListBox>
                                    {pickableOptions.map((o) => (
                                        <ListBox.Item key={o.id} id={o.id} textValue={o.label}>
                                            {o.label}
                                            <ListBox.ItemIndicator />
                                        </ListBox.Item>
                                    ))}
                                </ListBox>
                            </Select.Popover>
                        </Select>
                    )}
                    <button type="button" onClick={collapse} aria-label={tCommon("cancel")} className="text-muted-foreground hover:text-destructive transition-colors">
                        <X size={14} />
                    </button>
                </div>
            )}
        </div>
    );
}
