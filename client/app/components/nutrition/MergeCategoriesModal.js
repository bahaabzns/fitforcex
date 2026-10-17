'use client';
import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { AlertTriangle, Info } from "lucide-react";
import api from "@/lib/axios";
import Modal, { ModalFooter } from "@/app/components/Modal";
import { FieldLabel } from "@/app/components/Field";
import { Button } from "@heroui/react/button";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { Alert } from "@heroui/react/alert";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";
import { categoriesLookRelated } from "@/lib/foodCategoryMergeSuggestions";

const MERGE_API = "/api/nutrition/food-categories/merge";
const PREVIEW_DEBOUNCE_MS = 300;
const HTTP_FORBIDDEN = 403;
const MIN_CATEGORIES_TO_MERGE = 2;

/**
 * "Merge categories" dialog. `selected` = the category rows to merge (>= 2). `initialTarget`
 * ({ name_en, name_ar }) pre-fills the "new name" option — used by Suggested merges; the
 * coach still reviews the live preview and presses Merge themselves.
 * The form is mounted only while open, so every opening starts from fresh state.
 */
export default function MergeCategoriesModal({ open, onClose, selected, initialTarget, onMerged }) {
    const t = useTranslations("foodCategories");
    return (
        <Modal open={open} onClose={onClose} title={t("mergeTitle")} wide>
            {open && <MergeForm selected={selected} initialTarget={initialTarget} onClose={onClose} onMerged={onMerged} />}
        </Modal>
    );
}

function MergeForm({ selected, initialTarget, onClose, onMerged }) {
    const t = useTranslations("foodCategories");
    const tCommon = useTranslations("common");
    const locale = useLocale();

    const [mode, setMode] = useState(initialTarget ? "new" : "keep");
    // Default "keep" choice = the category with the most foods, so the fewest items move.
    const [keepId, setKeepId] = useState(() => [...selected].sort((a, b) => (b.food_item_count ?? 0) - (a.food_item_count ?? 0))[0]?.id ?? "");
    const [nameEn, setNameEn] = useState(initialTarget?.name_en ?? "");
    const [nameAr, setNameAr] = useState(initialTarget?.name_ar ?? "");
    const [submitting, setSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [previewResult, setPreviewResult] = useState({ key: null, preview: null, error: "" });

    function errorMessage(err) {
        if (err?.response?.status === HTTP_FORBIDDEN) return t("mergeNoPermission");
        return err?.response?.data?.error || t("mergeError");
    }

    const targetReady = mode === "keep" ? !!keepId : !!nameEn.trim();
    const body = {
        sourceIds: selected.map((category) => category.id),
        target: mode === "keep" ? { id: keepId } : { name_en: nameEn.trim(), name_ar: nameAr.trim() || null },
    };
    // A string key for "what the preview is for": the effect re-runs only when it changes,
    // and a result for an older key is ignored — so a slow response can't show stale numbers.
    const requestKey = targetReady && selected.length >= MIN_CATEGORIES_TO_MERGE ? JSON.stringify(body) : null;

    useEffect(() => {
        if (!requestKey) return undefined;
        let stale = false;
        const timer = setTimeout(async () => {
            try {
                const res = await api.post(`${MERGE_API}/preview`, JSON.parse(requestKey));
                if (!stale) setPreviewResult({ key: requestKey, preview: res.data, error: "" });
            } catch (err) {
                if (!stale) setPreviewResult({ key: requestKey, preview: null, error: errorMessage(err) });
            }
        }, PREVIEW_DEBOUNCE_MS);
        return () => { stale = true; clearTimeout(timer); };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [requestKey]);

    const isCurrent = previewResult.key === requestKey;
    const preview = isCurrent ? previewResult.preview : null;
    const previewLoading = !!requestKey && !isCurrent;
    const error = submitError || (isCurrent ? previewResult.error : "");

    async function handleConfirm() {
        setSubmitting(true);
        setSubmitError("");
        try {
            const res = await api.post(MERGE_API, body);
            onMerged(res.data);
        } catch (err) {
            setSubmitError(errorMessage(err));
        } finally {
            setSubmitting(false);
        }
    }

    const looksRelated = categoriesLookRelated(selected);
    const removedNames = preview
        ? new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(preview.sources.map((source) => source.name_en))
        : "";

    return (
        <div className="flex flex-col gap-5 px-1 py-1">
            <p className="text-sm text-muted-foreground">{t("mergeIntro")}</p>

            <div>
                <FieldLabel>{t("mergeSelectedLabel", { count: selected.length })}</FieldLabel>
                <ul className="mt-1 flex flex-wrap gap-1.5">
                    {selected.map((category) => (
                        <li key={category.id} className="rounded-md bg-default px-2 py-1 text-xs">
                            {category.name_en} <span className="text-muted-foreground">({category.food_item_count ?? 0})</span>
                        </li>
                    ))}
                </ul>
            </div>

            <fieldset className="flex flex-col gap-3">
                <legend className="sr-only">{t("mergeTargetLegend")}</legend>

                <label className="flex items-start gap-2 text-sm">
                    <input type="radio" name="merge-mode" className="mt-1" checked={mode === "keep"} onChange={() => setMode("keep")} />
                    <span className="flex flex-1 flex-col gap-1.5">
                        <span className="font-medium">{t("mergeKeepOption")}</span>
                        {mode === "keep" && (
                            <Select
                                variant="secondary"
                                fullWidth
                                aria-label={t("mergeKeepLabel")}
                                value={keepId}
                                onChange={(key) => setKeepId(key)}
                            >
                                <Select.Trigger>
                                    <Select.Value />
                                    <Select.Indicator />
                                </Select.Trigger>
                                <Select.Popover>
                                    <ListBox>
                                        {selected.map((category) => (
                                            <ListBox.Item key={category.id} id={category.id} textValue={category.name_en}>
                                                {category.name_en}
                                                <ListBox.ItemIndicator />
                                            </ListBox.Item>
                                        ))}
                                    </ListBox>
                                </Select.Popover>
                            </Select>
                        )}
                    </span>
                </label>

                <label className="flex items-start gap-2 text-sm">
                    <input type="radio" name="merge-mode" className="mt-1" checked={mode === "new"} onChange={() => setMode("new")} />
                    <span className="flex flex-1 flex-col gap-1.5">
                        <span className="font-medium">{t("mergeNewOption")}</span>
                        {mode === "new" && (
                            <span className="flex flex-col md:flex-row gap-2">
                                <span className="flex flex-1 flex-col gap-1.5">
                                    <FieldLabel required>{t("labelNameEn")}</FieldLabel>
                                    <TextField variant="secondary" fullWidth aria-label={t("labelNameEn")} value={nameEn} onChange={setNameEn}>
                                        <Input type="text" placeholder={t("placeholderNameEn")} autoFocus />
                                    </TextField>
                                </span>
                                <span className="flex flex-1 flex-col gap-1.5">
                                    <FieldLabel>{t("labelNameAr")}</FieldLabel>
                                    <TextField variant="secondary" fullWidth aria-label={t("labelNameAr")} value={nameAr} onChange={setNameAr}>
                                        <Input type="text" placeholder={t("placeholderNameAr")} dir="rtl" />
                                    </TextField>
                                </span>
                            </span>
                        )}
                    </span>
                </label>
            </fieldset>

            {/* Preview: what will actually happen, straight from the server */}
            <section aria-live="polite" className="rounded-lg border border-border p-3 text-sm">
                <h3 className="mb-1.5 font-semibold">{t("mergePreviewTitle")}</h3>
                {!preview && !previewLoading && <p className="text-muted-foreground">{t("mergePreviewEmpty")}</p>}
                {!preview && previewLoading && <p className="text-muted-foreground">{t("mergePreviewLoading")}</p>}
                {preview && (
                    <ul className="flex list-disc flex-col gap-1 ps-5">
                        <li>
                            {t("mergePreviewTarget", { name: preview.target.name_en })}{" "}
                            <span className="text-muted-foreground">{preview.target.is_new ? t("mergePreviewNew") : t("mergePreviewExisting")}</span>
                        </li>
                        <li>{t("mergePreviewItems", { count: preview.items_to_move })}</li>
                        <li>{t("mergePreviewRemoved", { names: removedNames })}</li>
                    </ul>
                )}
            </section>

            {!looksRelated && (
                <Alert>
                    <Alert.Indicator><AlertTriangle size={15} /></Alert.Indicator>
                    <Alert.Content><Alert.Description>{t("mergeUnrelatedWarning")}</Alert.Description></Alert.Content>
                </Alert>
            )}

            <p className="flex items-start gap-2 text-xs text-muted-foreground">
                <Info size={14} className="mt-0.5 shrink-0" />
                <span>{t("mergeSafetyNote")}</span>
            </p>

            {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

            <ModalFooter>
                <Button type="button" variant="ghost" onClick={onClose}>{tCommon("cancel")}</Button>
                <Button type="button" variant="primary" onClick={handleConfirm} isDisabled={!preview || submitting}>
                    {submitting ? t("mergeConfirming") : t("mergeConfirm")}
                </Button>
            </ModalFooter>
        </div>
    );
}
