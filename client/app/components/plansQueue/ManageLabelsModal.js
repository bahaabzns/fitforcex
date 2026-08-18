"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import Modal, { ModalFooter } from "@/app/components/Modal";
import { FieldLabel } from "@/app/components/Field";
import { Button } from "@heroui/react/button";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { Tooltip } from "@heroui/react/tooltip";

// Same 10 color keys as forms.controller.ts's QUEUE_LABEL_COLORS — a fixed
// palette (not a freeform hex picker) so labels render with the same visual
// weight as every other chip in this table. Values mirror
// PlansQueueTable.js's PACKAGE_CHIP_COLORS exactly, just keyed by name
// instead of index so the same class string is reachable from a stored key.
export const LABEL_COLOR_CLASSES = {
    pink: "bg-pink-500/20 text-pink-400",
    cyan: "bg-cyan-500/20 text-cyan-400",
    orange: "bg-orange-500/20 text-orange-400",
    teal: "bg-teal-500/20 text-teal-400",
    indigo: "bg-indigo-500/20 text-indigo-400",
    rose: "bg-rose-500/20 text-rose-400",
    lime: "bg-lime-500/20 text-lime-400",
    sky: "bg-sky-500/20 text-sky-400",
    fuchsia: "bg-fuchsia-500/20 text-fuchsia-400",
    violet: "bg-violet-500/20 text-violet-400",
};
export const LABEL_COLOR_SWATCH = {
    pink: "bg-pink-500", cyan: "bg-cyan-500", orange: "bg-orange-500", teal: "bg-teal-500",
    indigo: "bg-indigo-500", rose: "bg-rose-500", lime: "bg-lime-500", sky: "bg-sky-500",
    fuchsia: "bg-fuchsia-500", violet: "bg-violet-500",
};
export const LABEL_COLOR_KEYS = Object.keys(LABEL_COLOR_CLASSES);

function ColorPicker({ value, onChange }) {
    return (
        <div className="flex items-center gap-1.5 flex-wrap">
            {LABEL_COLOR_KEYS.map((key) => (
                <button
                    key={key}
                    type="button"
                    onClick={() => onChange(key)}
                    aria-label={key}
                    className={`w-5 h-5 rounded-full ${LABEL_COLOR_SWATCH[key]} transition-transform cursor-pointer ${value === key ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110" : "opacity-70 hover:opacity-100"}`}
                />
            ))}
        </div>
    );
}

// Create/rename/delete workspace labels for Plans Queue — restricted to the
// workspace owner/manager (enforced server-side too; see
// forms.controller.ts's isManagerOrOwner). Applying an existing label to a
// row happens inline in PlansQueueTable's Label column, not here.
export default function ManageLabelsModal({ open, onClose, labels, onChanged }) {
    const t = useTranslations("plansQueue");
    const tCommon = useTranslations("common");
    const [newName, setNewName] = useState("");
    const [newColor, setNewColor] = useState(LABEL_COLOR_KEYS[0]);
    const [editingId, setEditingId] = useState(null);
    const [editName, setEditName] = useState("");
    const [editColor, setEditColor] = useState(LABEL_COLOR_KEYS[0]);
    const [error, setError] = useState("");
    const [saving, setSaving] = useState(false);

    function resetAndClose() {
        setNewName("");
        setNewColor(LABEL_COLOR_KEYS[0]);
        setEditingId(null);
        setError("");
        onClose();
    }

    async function handleAdd(e) {
        e.preventDefault();
        const trimmed = newName.trim();
        if (!trimmed) return setError(t("labelNameRequired"));
        if (labels.some((l) => l.name.toLowerCase() === trimmed.toLowerCase())) return setError(t("labelNameDuplicate"));
        setError("");
        setSaving(true);
        try {
            await api.post("/api/forms/queue/labels", { name: trimmed, color: newColor });
            setNewName("");
            setNewColor(LABEL_COLOR_KEYS[0]);
            await onChanged();
        } catch (err) {
            setError(err.response?.data?.error || t("labelSaveFailed"));
        }
        setSaving(false);
    }

    function startEdit(label) {
        setEditingId(label.id);
        setEditName(label.name);
        setEditColor(label.color);
        setError("");
    }

    async function handleSaveEdit() {
        const trimmed = editName.trim();
        if (!trimmed) return setError(t("labelNameRequired"));
        setError("");
        setSaving(true);
        try {
            await api.patch(`/api/forms/queue/labels/${editingId}`, { name: trimmed, color: editColor });
            setEditingId(null);
            await onChanged();
        } catch (err) {
            setError(err.response?.data?.error || t("labelSaveFailed"));
        }
        setSaving(false);
    }

    async function handleDelete(label) {
        if (!confirm(t("deleteLabelConfirm", { name: label.name }))) return;
        setError("");
        try {
            await api.delete(`/api/forms/queue/labels/${label.id}`);
            await onChanged();
        } catch {
            setError(t("labelDeleteFailed"));
        }
    }

    return (
        <Modal open={open} onClose={resetAndClose} title={t("manageLabels")}>
            {/* px-3/py-2 (not the more common px-1) — the color swatches below
                use ring-offset-2 + scale-110 on the selected one, which needs
                real clearance or it visually clips against the modal's own
                edge (seen on the leftmost/first swatch). Recurring risk for
                any modal content with a ring/scale-transformed element near
                an edge — give it real padding, not just enough for plain text. */}
            <div className="flex flex-col gap-5 px-3 py-2">
                <p className="text-sm text-muted-foreground">{t("manageLabelsDesc")}</p>

                <div className="flex flex-col gap-2">
                    {labels.length === 0 && <p className="text-sm text-muted-foreground italic">{t("noLabelsYet")}</p>}
                    {labels.map((label) => (
                        <div key={label.id} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                            {editingId === label.id ? (
                                <>
                                    <TextField variant="secondary" size="sm" fullWidth aria-label={t("labelName")} value={editName} onChange={setEditName}>
                                        <Input type="text" autoFocus />
                                    </TextField>
                                    <ColorPicker value={editColor} onChange={setEditColor} />
                                    <Tooltip>
                                        <Button isIconOnly size="sm" variant="ghost" aria-label={t("save")} isDisabled={saving} onClick={handleSaveEdit}>
                                            <Check className="w-4 h-4" />
                                        </Button>
                                        <Tooltip.Content>{t("save")}</Tooltip.Content>
                                    </Tooltip>
                                    <Tooltip>
                                        <Button isIconOnly size="sm" variant="ghost" aria-label={t("cancel")} onClick={() => setEditingId(null)}>
                                            <X className="w-4 h-4" />
                                        </Button>
                                        <Tooltip.Content>{t("cancel")}</Tooltip.Content>
                                    </Tooltip>
                                </>
                            ) : (
                                <>
                                    <span className={`w-3 h-3 rounded-full shrink-0 ${LABEL_COLOR_SWATCH[label.color] || "bg-zinc-500"}`} />
                                    <span className="flex-1 text-sm text-foreground truncate">{label.name}</span>
                                    <Tooltip>
                                        <Button isIconOnly size="sm" variant="ghost" aria-label={tCommon("edit")} onClick={() => startEdit(label)}>
                                            <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Tooltip.Content>{tCommon("edit")}</Tooltip.Content>
                                    </Tooltip>
                                    <Tooltip>
                                        <Button isIconOnly size="sm" variant="ghost" className="text-destructive hover:text-red-700" aria-label={tCommon("delete")} onClick={() => handleDelete(label)}>
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                        <Tooltip.Content>{tCommon("delete")}</Tooltip.Content>
                                    </Tooltip>
                                </>
                            )}
                        </div>
                    ))}
                </div>

                <form onSubmit={handleAdd} className="flex flex-col gap-3 border-t border-border pt-4">
                    <FieldLabel>{t("addLabel")}</FieldLabel>
                    <div className="flex items-center gap-2">
                        <TextField variant="secondary" size="sm" fullWidth aria-label={t("labelName")} value={newName} onChange={setNewName}>
                            <Input type="text" placeholder={t("labelNamePlaceholder")} />
                        </TextField>
                        <Button type="submit" variant="primary" size="sm" isDisabled={saving}>{t("addLabel")}</Button>
                    </div>
                    <ColorPicker value={newColor} onChange={setNewColor} />
                </form>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <ModalFooter>
                    <Button variant="ghost" onClick={resetAndClose}>{t("cancel")}</Button>
                </ModalFooter>
            </div>
        </Modal>
    );
}
