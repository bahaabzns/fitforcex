"use client";

import { useEffect, useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { DropZone, FileTrigger } from "react-aria-components";
import api from "@/lib/axios";
import { Card } from "@heroui/react/card";
import { Button } from "@heroui/react/button";
import { Alert } from "@heroui/react/alert";
import { Switch } from "@heroui/react/switch";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { NumberField } from "@heroui/react/number-field";
import { Separator } from "@heroui/react/separator";
import { Skeleton } from "@heroui/react/skeleton";
import SettingsPageHeader from "../_components/SettingsPageHeader";
import { usePageTitle } from "@/hooks/usePageTitle";

// Nutrition and training PDFs have fully independent settings (separate
// tables server-side — nutrition_pdf_settings / training_pdf_settings, see
// DECISIONS.md 2026-07-28) — no shared logo/colors/cover image between them.
// Fields sent to PUT /api/pdf-export/settings/{type} — mirrors
// update{Nutrition,Training}SettingsSchema in pdfExport.controller.ts. Image
// url fields (logo_url, cover_image_url, etc.) are deliberately excluded —
// they're only ever set through the dedicated upload endpoints, which
// persist immediately on file select.
const EDITABLE_FIELDS_BY_TYPE = {
    nutrition: [
        "coach_name", "footer_text", "primary_color", "header_text_color",
        "table_header_bg_color", "table_alt_bg_color",
        "cover_title", "cover_subtitle",
        "show_cover_page", "show_back_cover_page", "show_plan_summary_page",
        "show_cover_header", "show_cover_title", "show_cover_subtitle", "show_cover_client_name",
        "show_notes", "show_alternatives", "show_macros_summary", "show_cycle_totals", "show_meal_totals",
        "show_food_calories", "show_food_macros", "show_cycle_summary_page", "show_meal_summary_page",
        "max_meals_per_page",
    ],
    training: [
        "coach_name", "footer_text", "primary_color", "header_text_color",
        "table_header_bg_color", "table_alt_bg_color",
        "cover_title", "cover_subtitle",
        "show_cover_page", "show_back_cover_page", "show_plan_summary_page",
        "show_cover_header", "show_cover_title", "show_cover_subtitle", "show_cover_client_name",
        "show_notes", "show_exercise_notes", "show_exercise_equipment", "show_sets_detail", "show_day_summary_page",
        "max_exercises_per_page",
    ],
};

function pick(source, keys) {
    const out = {};
    for (const key of keys) out[key] = source[key];
    return out;
}

// Mirrors expectedCoverImagePixelSize() in pdfExport.controller.ts (96px/inch
// off the page's point dimensions) — kept in sync so the hint shown here
// always matches what the server will actually accept.
function requiredCoverImageSize(settings) {
    return {
        width:  Math.round((settings.page_width / 72) * 96),
        height: Math.round((settings.page_height / 72) * 96),
    };
}

function readImageDimensions(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new window.Image();
        img.onload = () => {
            URL.revokeObjectURL(url);
            resolve({ width: img.naturalWidth, height: img.naturalHeight });
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Could not read image"));
        };
        img.src = url;
    });
}

// Checked client-side before the upload even fires, so a mismatched image is
// caught instantly instead of round-tripping to the server just to find out
// — the server (uploadNutritionCoverImage/uploadTrainingCoverImage) still
// re-validates and is the actual enforcement point; this is purely a faster,
// friendlier guide for the user. Same ±5px tolerance as the server, so this
// never warns about a difference the server would go on to accept anyway.
const COVER_IMAGE_SIZE_TOLERANCE_PX = 5;

async function validateCoverImageDimensions(file, settings, t) {
    let actual;
    try {
        actual = await readImageDimensions(file);
    } catch {
        return t("coverPage.coverImageUnreadable");
    }
    const required = requiredCoverImageSize(settings);
    const widthOff = Math.abs(actual.width - required.width);
    const heightOff = Math.abs(actual.height - required.height);
    if (widthOff > COVER_IMAGE_SIZE_TOLERANCE_PX || heightOff > COVER_IMAGE_SIZE_TOLERANCE_PX) {
        return t("coverPage.coverImageSizeWarning", {
            actualWidth: actual.width, actualHeight: actual.height,
            width: required.width, height: required.height,
        });
    }
    return null;
}

function ToggleRow({ label, checked, onChange, disabled }) {
    return (
        <div className="flex items-center justify-between gap-4 py-2.5">
            <span className="text-sm text-foreground">{label}</span>
            <Switch isSelected={checked === true} onChange={onChange} isDisabled={disabled} className="shrink-0">
                <Switch.Control>
                    <Switch.Thumb />
                </Switch.Control>
            </Switch>
        </div>
    );
}

function ColorField({ label, value, onChange, disabled }) {
    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-sm text-foreground">{label}</span>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    value={value || "#000000"}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    className="h-9 w-9 shrink-0 rounded border border-border cursor-pointer bg-transparent"
                />
                <TextField variant="secondary" value={value || ""} onChange={onChange} isDisabled={disabled} aria-label={label} className="min-w-0">
                    <Input type="text" placeholder="#007AFF" />
                </TextField>
            </div>
        </div>
    );
}

// Debounces `value` so callers don't fire a request on every keystroke —
// waits `delay`ms after the last change before updating the returned value.
function useDebouncedValue(value, delay) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

// HeroUI has no "Drop Zone" component of its own (checked the installed
// package's exports and its docs — no such page exists); it's built on top
// of react-aria-components, which does have DropZone/FileTrigger primitives,
// already a direct dependency here (see providers.js / QuestionEditorPanel.js
// for existing precedent importing from the same package). This wraps those
// unstyled primitives with this app's own look, the same way HeroUI's own
// components are themed react-aria-components underneath.
async function readDroppedFile(items) {
    const fileItem = items.find((item) => item.kind === "file");
    return fileItem ? fileItem.getFile() : null;
}

function ImageDropZone({ label, imageUrl, onFile, onRemove, uploading, removing, disabled, hint, validateFile }) {
    const t = useTranslations("pdfExport");
    const [localError, setLocalError] = useState("");

    async function handleFile(file) {
        if (!file) return;
        setLocalError("");
        if (validateFile) {
            const message = await validateFile(file);
            if (message) {
                setLocalError(message);
                return;
            }
        }
        onFile(file);
    }

    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-sm text-foreground">{label}</span>
            <DropZone
                isDisabled={disabled || uploading}
                onDrop={async (e) => handleFile(await readDroppedFile(e.items))}
                className={({ isDropTarget, isFocusVisible, isDisabled }) => [
                    "flex items-center gap-3 rounded-lg border-2 border-dashed p-3 transition-colors",
                    isDropTarget ? "border-primary bg-primary/5" : "border-border",
                    isFocusVisible ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
                    isDisabled ? "opacity-60" : "",
                ].filter(Boolean).join(" ")}
            >
                {imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt="" className="h-12 w-12 shrink-0 rounded object-cover border border-border" />
                )}
                <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-xs text-muted-foreground">{t("dropZone.instructions")}</span>
                    <div className="flex items-center gap-2">
                        <FileTrigger acceptedFileTypes={["image/*"]} onSelect={(fileList) => handleFile(fileList?.[0])}>
                            <Button size="sm" variant="outline" isDisabled={disabled || uploading || removing}>
                                {uploading ? t("dropZone.uploading") : t("dropZone.chooseFile")}
                            </Button>
                        </FileTrigger>
                        {imageUrl && onRemove && (
                            <Button size="sm" variant="ghost" isDisabled={disabled || uploading || removing} onClick={onRemove}>
                                {removing ? t("dropZone.removing") : t("dropZone.remove")}
                            </Button>
                        )}
                    </div>
                </div>
            </DropZone>
            {localError && <p className="text-xs text-destructive">{localError}</p>}
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}

// Chrome/Edge's embedded PDF viewer ignores the `#view=`/`#zoom=` open
// parameters for blob: URLs shown in an <iframe> — it always renders at its
// own default ("Automatic") zoom regardless of the iframe's size, which for
// a full A4 page is taller than most preview panels, forcing a scrollbar.
// The reliable fix is a pure CSS one: render the iframe at the page's true
// pixel size (96 CSS px per inch, the standard px-per-pt conversion — the
// viewer's default zoom already matches this), then `transform: scale()` the
// whole iframe down to fit the actual container, measured live via
// ResizeObserver. The wrapper is sized to the scaled result with
// `overflow: hidden`, so nothing can peek out even if the pixel-size guess
// is slightly off.
function PdfPreviewFrame({ src, pageWidthPt, pageHeightPt, title }) {
    const containerRef = useRef(null);
    const [scale, setScale] = useState(1);
    const naturalWidth = (pageWidthPt / 72) * 96;
    const naturalHeight = (pageHeightPt / 72) * 96;

    useEffect(() => {
        const el = containerRef.current;
        if (!el) return undefined;
        const updateScale = () => {
            const { width, height } = el.getBoundingClientRect();
            if (!width || !height) return;
            setScale(Math.min(width / naturalWidth, height / naturalHeight));
        };
        updateScale();
        const observer = new ResizeObserver(updateScale);
        observer.observe(el);
        return () => observer.disconnect();
    }, [naturalWidth, naturalHeight]);

    return (
        <div ref={containerRef} className="w-full h-full flex items-center justify-center overflow-hidden">
            <div style={{ width: naturalWidth * scale, height: naturalHeight * scale, overflow: "hidden" }} className="shadow-lg">
                <iframe
                    src={src}
                    title={title}
                    style={{ width: naturalWidth, height: naturalHeight, transform: `scale(${scale})`, transformOrigin: "top left", border: 0 }}
                />
            </div>
        </div>
    );
}

export default function PdfExportSettingsPage() {
    const t = useTranslations("pdfExport");
    const tNav = useTranslations("nav");
    usePageTitle(tNav("pdfExport"));

    // Drives both which settings are being edited AND which sample the
    // preview panel renders — editing nutrition settings previews nutrition,
    // editing training settings previews training, always in sync.
    const [activeType, setActiveType] = useState("nutrition");
    const editableFields = EDITABLE_FIELDS_BY_TYPE[activeType];

    const [settings, setSettings] = useState(null);
    const [original, setOriginal] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [uploadingSlot, setUploadingSlot] = useState(null);
    const [removingSlot, setRemovingSlot] = useState(null);

    const [previewUrl, setPreviewUrl] = useState(null);
    const [previewLoading, setPreviewLoading] = useState(false);
    const [previewError, setPreviewError] = useState(false);
    const previewUrlRef = useRef(null);
    const previewRequestId = useRef(0);
    const debouncedSettings = useDebouncedValue(settings, 700);

    useEffect(() => {
        setLoading(true);
        setError(""); setSuccess("");
        api.get(`/api/pdf-export/settings/${activeType}`)
            .then((res) => {
                setSettings(res.data);
                setOriginal(res.data);
            })
            .catch(() => setError(t("saveFailed")))
            .finally(() => setLoading(false));
    }, [activeType, t]);

    function update(patch) {
        setSettings((prev) => ({ ...prev, ...patch }));
        setSuccess("");
    }

    const isDirty = settings && original && editableFields.some((key) => settings[key] !== original[key]);

    async function handleSave() {
        setSaving(true);
        setError(""); setSuccess("");
        try {
            const res = await api.put(`/api/pdf-export/settings/${activeType}`, pick(settings, editableFields));
            setSettings(res.data);
            setOriginal(res.data);
            setSuccess(t("saveSuccess"));
        } catch (err) {
            setError(err.response?.data?.error || t("saveFailed"));
        } finally {
            setSaving(false);
        }
    }

    function handleDiscard() {
        setSettings(original);
        setError(""); setSuccess("");
    }

    async function handleLogoUpload(file) {
        setUploadingSlot("logo");
        setError("");
        try {
            const body = new FormData();
            body.append("logo", file);
            const res = await api.post(`/api/pdf-export/settings/${activeType}/logo`, body, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setSettings(res.data);
            setOriginal(res.data);
        } catch {
            setError(t("uploadFailed"));
        } finally {
            setUploadingSlot(null);
        }
    }

    async function handleCoverImageUpload(file) {
        setUploadingSlot("cover");
        setError("");
        try {
            const body = new FormData();
            body.append("image", file);
            const res = await api.post(`/api/pdf-export/settings/${activeType}/cover-image`, body, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setSettings(res.data);
            setOriginal(res.data);
        } catch (err) {
            // Surfaced as-is (not the generic uploadFailed text) — the
            // server's message says exactly which pixel size is required and
            // what was uploaded instead, which the generic text can't convey.
            setError(err.response?.data?.error || t("uploadFailed"));
        } finally {
            setUploadingSlot(null);
        }
    }

    async function handleBackgroundUpload(slot, file) {
        setUploadingSlot(slot);
        setError("");
        try {
            const body = new FormData();
            body.append("image", file);
            const res = await api.post(`/api/pdf-export/settings/${activeType}/background/${slot}`, body, {
                headers: { "Content-Type": "multipart/form-data" },
            });
            setSettings(res.data);
            setOriginal(res.data);
        } catch {
            setError(t("uploadFailed"));
        } finally {
            setUploadingSlot(null);
        }
    }

    async function handleLogoRemove() {
        setRemovingSlot("logo");
        setError("");
        try {
            const res = await api.delete(`/api/pdf-export/settings/${activeType}/logo`);
            setSettings(res.data);
            setOriginal(res.data);
        } catch {
            setError(t("uploadFailed"));
        } finally {
            setRemovingSlot(null);
        }
    }

    async function handleCoverImageRemove() {
        setRemovingSlot("cover");
        setError("");
        try {
            const res = await api.delete(`/api/pdf-export/settings/${activeType}/cover-image`);
            setSettings(res.data);
            setOriginal(res.data);
        } catch {
            setError(t("uploadFailed"));
        } finally {
            setRemovingSlot(null);
        }
    }

    async function handleBackgroundRemove(slot) {
        setRemovingSlot(slot);
        setError("");
        try {
            const res = await api.delete(`/api/pdf-export/settings/${activeType}/background/${slot}`);
            setSettings(res.data);
            setOriginal(res.data);
        } catch {
            setError(t("uploadFailed"));
        } finally {
            setRemovingSlot(null);
        }
    }

    // Regenerates the preview PDF whenever the (debounced) draft settings or
    // the active type change. A request-id guard discards a response that
    // arrives after a newer request has already started, so a slow render
    // for an older draft can't clobber the current preview.
    useEffect(() => {
        if (!debouncedSettings) return;
        const requestId = ++previewRequestId.current;
        setPreviewLoading(true);
        setPreviewError(false);
        api.post(`/api/pdf-export/settings/preview?type=${activeType}`, debouncedSettings, { responseType: "blob" })
            .then((res) => {
                if (requestId !== previewRequestId.current) return;
                const nextUrl = URL.createObjectURL(res.data);
                if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
                previewUrlRef.current = nextUrl;
                setPreviewUrl(nextUrl);
            })
            .catch(() => {
                if (requestId !== previewRequestId.current) return;
                setPreviewError(true);
            })
            .finally(() => {
                if (requestId !== previewRequestId.current) return;
                setPreviewLoading(false);
            });
    }, [debouncedSettings, activeType]);

    useEffect(() => {
        return () => {
            if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
        };
    }, []);

    return (
        <div className="flex flex-col gap-8">
            <SettingsPageHeader title={t("pageTitle")} description={t("pageSubtitle")} />

            <div className="flex gap-1 self-start rounded-lg border border-border p-1">
                <Button size="sm" variant={activeType === "nutrition" ? "primary" : "ghost"} onClick={() => setActiveType("nutrition")}>
                    {t("preview.nutrition")}
                </Button>
                <Button size="sm" variant={activeType === "training" ? "primary" : "ghost"} onClick={() => setActiveType("training")}>
                    {t("preview.training")}
                </Button>
            </div>

            {error && (
                <Alert status="danger">
                    <Alert.Indicator />
                    <Alert.Content><Alert.Description>{error}</Alert.Description></Alert.Content>
                </Alert>
            )}
            {success && (
                <Alert status="success">
                    <Alert.Indicator />
                    <Alert.Content><Alert.Description>{success}</Alert.Description></Alert.Content>
                </Alert>
            )}

            {(loading || !settings) ? (
                <div className="flex flex-col gap-6">
                    <Skeleton className="h-8 w-48 rounded-lg" />
                    {[1, 2, 3].map((i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
                </div>
            ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
            <div className="flex flex-col gap-8 min-w-0">
            <Card>
                <Card.Header><Card.Title>{t("branding.title")}</Card.Title></Card.Header>
                <Card.Content className="flex flex-col gap-4">
                    <TextField variant="secondary" fullWidth value={settings.coach_name || ""} onChange={(v) => update({ coach_name: v })} aria-label={t("branding.coachName")}>
                        <Input type="text" placeholder={t("branding.coachName")} />
                    </TextField>
                    <TextField variant="secondary" fullWidth value={settings.footer_text || ""} onChange={(v) => update({ footer_text: v })} aria-label={t("branding.footerText")}>
                        <Input type="text" placeholder={t("branding.footerText")} />
                    </TextField>
                    <div className="grid grid-cols-1 gap-4">
                        <ColorField label={t("branding.primaryColor")} value={settings.primary_color} onChange={(v) => update({ primary_color: v })} />
                        <ColorField label={t("branding.headerTextColor")} value={settings.header_text_color} onChange={(v) => update({ header_text_color: v })} />
                        <ColorField label={t("branding.tableHeaderColor")} value={settings.table_header_bg_color} onChange={(v) => update({ table_header_bg_color: v })} />
                        <ColorField label={t("branding.tableAltColor")} value={settings.table_alt_bg_color} onChange={(v) => update({ table_alt_bg_color: v })} />
                    </div>
                    <ImageDropZone
                        label={t("branding.logo")}
                        imageUrl={settings.logo_url}
                        onFile={handleLogoUpload}
                        onRemove={handleLogoRemove}
                        uploading={uploadingSlot === "logo"}
                        removing={removingSlot === "logo"}
                    />
                </Card.Content>
            </Card>

            <Card>
                <Card.Header><Card.Title>{t("coverPage.title")}</Card.Title></Card.Header>
                <Card.Content className="flex flex-col">
                    <ToggleRow label={t("coverPage.showCoverPage")} checked={settings.show_cover_page} onChange={(v) => update({ show_cover_page: v })} />
                    <Separator />
                    <ToggleRow label={t("coverPage.showPlanSummaryPage")} checked={settings.show_plan_summary_page} onChange={(v) => update({ show_plan_summary_page: v })} />
                    <Separator />
                    <ToggleRow label={t("coverPage.showCoverHeader")} checked={settings.show_cover_header} onChange={(v) => update({ show_cover_header: v })} />
                    <Separator />
                    <div className="py-3 flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <TextField variant="secondary" fullWidth value={settings.cover_title || ""} onChange={(v) => update({ cover_title: v })} aria-label={t("coverPage.coverTitle")}>
                                <Input type="text" placeholder={t("coverPage.coverTitle")} />
                            </TextField>
                            <ToggleRow label={t("coverPage.showCoverTitle")} checked={settings.show_cover_title} onChange={(v) => update({ show_cover_title: v })} />
                        </div>
                        <div className="flex flex-col gap-2">
                            <TextField variant="secondary" fullWidth value={settings.cover_subtitle || ""} onChange={(v) => update({ cover_subtitle: v })} aria-label={t("coverPage.coverSubtitle")}>
                                <Input type="text" placeholder={t("coverPage.coverSubtitle")} />
                            </TextField>
                            <ToggleRow label={t("coverPage.showCoverSubtitle")} checked={settings.show_cover_subtitle} onChange={(v) => update({ show_cover_subtitle: v })} />
                        </div>
                        <ImageDropZone
                            label={t("coverPage.coverImage")}
                            imageUrl={settings.cover_image_url}
                            onFile={handleCoverImageUpload}
                            onRemove={handleCoverImageRemove}
                            uploading={uploadingSlot === "cover"}
                            removing={removingSlot === "cover"}
                            hint={t("coverPage.coverImageSizeHint", requiredCoverImageSize(settings))}
                            validateFile={(file) => validateCoverImageDimensions(file, settings, t)}
                        />
                    </div>
                    <Separator />
                    <ToggleRow label={t("coverPage.showCoverClientName")} checked={settings.show_cover_client_name} onChange={(v) => update({ show_cover_client_name: v })} />
                    <Separator />
                    <ToggleRow label={t("coverPage.showBackCoverPage")} checked={settings.show_back_cover_page} onChange={(v) => update({ show_back_cover_page: v })} />
                    {settings.show_back_cover_page && (
                        <div className="pb-2">
                            <ImageDropZone
                                label={t("coverPage.backCoverImage")}
                                imageUrl={settings.back_cover_bg_image_url}
                                onFile={(file) => handleBackgroundUpload("backCover", file)}
                                onRemove={() => handleBackgroundRemove("backCover")}
                                uploading={uploadingSlot === "backCover"}
                                removing={removingSlot === "backCover"}
                            />
                        </div>
                    )}
                </Card.Content>
            </Card>

            {activeType === "nutrition" && (
            <Card>
                <Card.Header><Card.Title>{t("nutrition.title")}</Card.Title></Card.Header>
                <Card.Content className="flex flex-col">
                    {[
                        ["show_notes", "showNotes"], ["show_alternatives", "showAlternatives"],
                        ["show_cycle_totals", "showCycleTotals"], ["show_meal_totals", "showMealTotals"],
                        ["show_food_calories", "showFoodCalories"], ["show_food_macros", "showFoodMacros"],
                        ["show_cycle_summary_page", "showCycleSummaryPage"], ["show_meal_summary_page", "showMealSummaryPage"],
                    ].map(([field, key], index) => (
                        <div key={field}>
                            {index > 0 && <Separator />}
                            <ToggleRow label={t(`nutrition.${key}`)} checked={settings[field]} onChange={(v) => update({ [field]: v })} />
                        </div>
                    ))}
                    <Separator />
                    <div className="py-3">
                        <NumberField
                            variant="secondary"
                            value={settings.max_meals_per_page ?? 0}
                            onChange={(v) => update({ max_meals_per_page: Math.max(0, v || 0) })}
                            minValue={0}
                            maxValue={50}
                            aria-label={t("nutrition.maxMealsPerPage")}
                        >
                            <label className="text-sm text-foreground mb-1.5 block">{t("nutrition.maxMealsPerPage")}</label>
                            <NumberField.Group className="w-36">
                                <NumberField.DecrementButton />
                                <NumberField.Input />
                                <NumberField.IncrementButton />
                            </NumberField.Group>
                        </NumberField>
                    </div>
                </Card.Content>
            </Card>
            )}

            {activeType === "training" && (
            <Card>
                <Card.Header><Card.Title>{t("training.title")}</Card.Title></Card.Header>
                <Card.Content className="flex flex-col">
                    {[
                        ["show_exercise_notes", "showExerciseNotes"], ["show_exercise_equipment", "showExerciseEquipment"],
                        ["show_sets_detail", "showSetsDetail"], ["show_day_summary_page", "showDaySummaryPage"],
                    ].map(([field, key], index) => (
                        <div key={field}>
                            {index > 0 && <Separator />}
                            <ToggleRow label={t(`training.${key}`)} checked={settings[field]} onChange={(v) => update({ [field]: v })} />
                        </div>
                    ))}
                    <Separator />
                    <div className="py-3">
                        <NumberField
                            variant="secondary"
                            value={settings.max_exercises_per_page ?? 0}
                            onChange={(v) => update({ max_exercises_per_page: Math.max(0, v || 0) })}
                            minValue={0}
                            maxValue={50}
                            aria-label={t("training.maxExercisesPerPage")}
                        >
                            <label className="text-sm text-foreground mb-1.5 block">{t("training.maxExercisesPerPage")}</label>
                            <NumberField.Group className="w-36">
                                <NumberField.DecrementButton />
                                <NumberField.Input />
                                <NumberField.IncrementButton />
                            </NumberField.Group>
                        </NumberField>
                    </div>
                </Card.Content>
            </Card>
            )}
            </div>

            {/* Pure CSS height, deliberately not JS-measured: 100vh is always
                exactly the true viewport height, full stop — no ancestor,
                sticky-phase, or scroll-timing assumptions that can be wrong.
                144px = the top-6 sticky offset (24px) + a 120px bottom
                margin so the card never touches the edge of the screen. */}
            <div className="flex flex-col gap-3 min-h-0 lg:sticky lg:top-6 lg:h-[calc(100vh-144px)] lg:min-h-80">
                <Card className="overflow-hidden flex flex-col flex-1 min-h-0">
                    <Card.Header className="shrink-0">
                        <Card.Title>{t("preview.title")}</Card.Title>
                    </Card.Header>
                    {/* flex-1 + min-h-0: the header above takes its natural height, this
                        fills exactly what's left, so header+content never add up to more
                        than the outer div's fixed viewport-based height — the whole card
                        stays on screen with no page-level scrolling needed to see the rest. */}
                    <Card.Content className="p-0 relative flex-1 min-h-0 overflow-hidden bg-black/20">
                        {previewUrl && (
                            <PdfPreviewFrame
                                src={`${previewUrl}#toolbar=0&navpanes=0`}
                                pageWidthPt={settings.page_width}
                                pageHeightPt={settings.page_height}
                                title={t("preview.title")}
                            />
                        )}
                        {!previewUrl && !previewLoading && !previewError && (
                            <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground p-4 text-center">
                                {t("preview.empty")}
                            </div>
                        )}
                        {previewError && (
                            <div className="w-full h-full flex items-center justify-center text-sm text-destructive p-4 text-center">
                                {t("preview.failed")}
                            </div>
                        )}
                        {previewLoading && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/60">
                                <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                            </div>
                        )}
                    </Card.Content>
                </Card>
                <p className="text-xs text-muted-foreground px-1">{t("preview.hint")}</p>
            </div>
            </div>
            )}

            {isDirty && (
                <div className="sticky bottom-4 z-10 self-center w-full max-w-2xl">
                    <Card className="flex-row items-center justify-between gap-4 px-4 py-3 shadow-lg border border-border bg-card">
                        <span className="text-sm text-foreground">{t("pageTitle")}</span>
                        <div className="flex items-center gap-2 shrink-0">
                            <Button size="sm" variant="ghost" isDisabled={saving} onClick={handleDiscard}>{t("discard")}</Button>
                            <Button size="sm" variant="primary" isDisabled={saving} onClick={handleSave}>
                                {saving ? t("saving") : t("save")}
                            </Button>
                        </div>
                    </Card>
                </div>
            )}
        </div>
    );
}
