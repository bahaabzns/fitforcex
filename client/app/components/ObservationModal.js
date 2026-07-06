"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Paperclip, X } from "lucide-react";
import Modal, { ModalFooter } from "@/app/components/Modal";
import { FieldLabel, FieldErrorText } from "@/app/components/Field";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { TextArea } from "@heroui/react/textarea";
import { Button } from "@heroui/react/button";
import { Chip } from "@heroui/react/chip";
import api from "@/lib/axios";
import LinkedItemsPicker from "@/app/components/LinkedItemsPicker";
import { OBSERVATION_CATEGORIES, OBSERVATION_SEVERITIES, categoryLabel, severityLabel, severityChipColor } from "@/utils/observations";

function blankFields(observation, initialRelatedItem) {
    return {
        title: observation?.title ?? "",
        content: observation?.content ?? "",
        category: observation?.category ?? "General",
        severity: observation?.severity ?? null,
        relatedItems: observation?.relatedItems ?? (initialRelatedItem ? [initialRelatedItem] : []),
    };
}

/**
 * The one place an observation is created or edited, everywhere in the app.
 * `observation` present = edit (PATCHes that row); absent = create (POSTs a
 * new one). `initialRelatedItem` pre-fills the link for contextual entry
 * points (Exercise/Food Insights, Check-in Review, Messenger).
 *
 *   <ObservationModal open={open} onClose={...} clientId={id} onCreated={...} />
 *   <ObservationModal open={open} onClose={...} clientId={id} observation={obs} onUpdated={...} />
 */
export default function ObservationModal({
    open, onClose, clientId, observation = null, initialRelatedItem = null, onCreated, onUpdated,
}) {
    const t = useTranslations("clientObservations");
    const tCommon = useTranslations("common");
    const fileInputRef = useRef(null);
    const isEditing = !!observation;

    // Identity of what's currently open — resets every field the instant the
    // modal opens for a *different* target (a new create, or a different
    // observation to edit) rather than carrying over stale draft state.
    const identity = open ? (observation?.id ?? "__create__") : null;
    const [syncedIdentity, setSyncedIdentity] = useState(identity);
    const initial = blankFields(observation, initialRelatedItem);
    const [title, setTitle] = useState(initial.title);
    const [content, setContent] = useState(initial.content);
    const [category, setCategory] = useState(initial.category);
    const [severity, setSeverity] = useState(initial.severity);
    const [relatedItems, setRelatedItems] = useState(initial.relatedItems);
    const [file, setFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");

    if (identity !== syncedIdentity) {
        setSyncedIdentity(identity);
        const fresh = blankFields(observation, initialRelatedItem);
        setTitle(fresh.title);
        setContent(fresh.content);
        setCategory(fresh.category);
        setSeverity(fresh.severity);
        setRelatedItems(fresh.relatedItems);
        setFile(null);
        setPreviewUrl(null);
        setError("");
    }

    useEffect(() => {
        if (!previewUrl) return;
        return () => URL.revokeObjectURL(previewUrl);
    }, [previewUrl]);

    function handleFileSelect(e) {
        const picked = e.target.files?.[0];
        e.target.value = "";
        if (!picked) return;
        setFile(picked);
        setPreviewUrl(URL.createObjectURL(picked));
    }

    function removeFile() {
        setFile(null);
        setPreviewUrl(null);
    }

    function addLinkedItem(item) {
        setRelatedItems((prev) => (prev.some((v) => v.type === item.type && String(v.id) === String(item.id)) ? prev : [...prev, item]));
    }

    function removeLinkedItem(item) {
        setRelatedItems((prev) => prev.filter((v) => !(v.type === item.type && String(v.id) === String(item.id))));
    }

    async function handleSubmit(e) {
        e?.preventDefault();
        if (saving) return;
        const trimmedTitle = title.trim();
        if (!trimmedTitle) {
            setError(t("titleRequiredError"));
            return;
        }

        const form = new FormData();
        form.append("title", trimmedTitle);
        if (content.trim()) form.append("content", content.trim());
        form.append("category", category);
        if (severity) form.append("severity", severity);
        form.append("relatedItems", JSON.stringify(relatedItems.map(({ type, id }) => ({ type, id }))));
        if (file) form.append("file", file);

        setSaving(true);
        setError("");
        try {
            if (isEditing) {
                const res = await api.patch(`/api/clients/${clientId}/observations/${observation.id}`, form);
                onUpdated?.(res.data);
            } else {
                const res = await api.post(`/api/clients/${clientId}/observations`, form);
                onCreated?.(res.data);
            }
            onClose();
        } catch (err) {
            setError(err.response?.data?.error || t("saveError"));
        } finally {
            setSaving(false);
        }
    }

    return (
        <Modal open={open} onClose={onClose} title={isEditing ? t("editTitle") : t("addTitle")}>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                    <FieldLabel required>{t("titleFieldLabel")}</FieldLabel>
                    <TextField value={title} onChange={setTitle} aria-label={t("titleFieldLabel")} isRequired>
                        <Input
                            type="text"
                            placeholder={t("composerPlaceholder")}
                            maxLength={120}
                            autoFocus
                            onKeyDown={(e) => {
                                if (e.key === "Enter") { e.preventDefault(); handleSubmit(); }
                            }}
                        />
                    </TextField>
                </div>

                <div className="flex flex-col gap-1.5">
                    <FieldLabel>{t("categoryFieldLabel")}</FieldLabel>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {OBSERVATION_CATEGORIES.map((c) => (
                            <button key={c} type="button" onClick={() => setCategory(c)} className="cursor-pointer">
                                <Chip size="sm" color={category === c ? "accent" : "default"} variant={category === c ? "primary" : "soft"}>
                                    {categoryLabel(c, t)}
                                </Chip>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <FieldLabel>{t("severityFieldLabel")}</FieldLabel>
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {OBSERVATION_SEVERITIES.map((s) => (
                            <button key={s} type="button" onClick={() => setSeverity((cur) => (cur === s ? null : s))} className="cursor-pointer">
                                <Chip size="sm" color={severity === s ? severityChipColor(s) : "default"} variant={severity === s ? "primary" : "soft"}>
                                    {severityLabel(s, t)}
                                </Chip>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex flex-col gap-1.5">
                    <FieldLabel>{t("detailsFieldLabel")}</FieldLabel>
                    <TextField value={content} onChange={setContent} aria-label={t("detailsFieldLabel")}>
                        <TextArea placeholder={t("detailsPlaceholder")} variant="secondary" fullWidth rows={3} className="resize-none text-sm" />
                    </TextField>
                </div>

                <div className="flex flex-col gap-1.5">
                    <FieldLabel>{t("linkedItemsFieldLabel")}</FieldLabel>
                    <LinkedItemsPicker clientId={clientId} values={relatedItems} onAdd={addLinkedItem} onRemove={removeLinkedItem} />
                </div>

                <div className="flex flex-col gap-1.5">
                    <FieldLabel>{t("attachLabel")}</FieldLabel>
                    {previewUrl ? (
                        <div className="flex items-center gap-2">
                            <img src={previewUrl} alt="" className="h-14 w-14 rounded-lg object-cover shrink-0 border border-border" />
                            <button
                                type="button"
                                aria-label={t("removeAttachmentLabel")}
                                className="text-muted-foreground hover:text-destructive transition-colors"
                                onClick={removeFile}
                            >
                                <X size={15} />
                            </button>
                        </div>
                    ) : isEditing && observation?.attachmentUrl ? (
                        <div className="flex items-center gap-2">
                            <img src={observation.attachmentUrl} alt="" className="h-14 w-14 rounded-lg object-cover shrink-0 border border-border" />
                            <span className="text-xs text-muted-foreground">{t("currentAttachmentHint")}</span>
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => fileInputRef.current?.click()}
                            className="inline-flex items-center gap-1.5 self-start text-xs text-muted-foreground hover:text-foreground transition-colors"
                        >
                            <Paperclip size={14} /> {t("attachLabel")}
                        </button>
                    )}
                    <input ref={fileInputRef} type="file" hidden accept="image/*" onChange={handleFileSelect} />
                </div>

                <FieldErrorText msg={error} />

                <ModalFooter>
                    <Button type="button" variant="ghost" isDisabled={saving} onClick={onClose}>
                        {tCommon("cancel")}
                    </Button>
                    <Button type="submit" variant="primary" isDisabled={saving || !title.trim()}>
                        {saving ? tCommon("saving") : isEditing ? tCommon("update") : t("saveButton")}
                    </Button>
                </ModalFooter>
            </form>
        </Modal>
    );
}
