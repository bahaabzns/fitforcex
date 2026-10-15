"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { DropZone, FileTrigger } from "react-aria-components";
import { ArrowDown, ArrowUp, Bell, ChevronRight, ClipboardList, Dumbbell, Home, Lock, MessageSquare, Salad, Trash2 } from "lucide-react";
import api from "@/lib/axios";
import { Card } from "@heroui/react/card";
import { Button } from "@heroui/react/button";
import { Alert } from "@heroui/react/alert";
import { Switch } from "@heroui/react/switch";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { Skeleton } from "@heroui/react/skeleton";
import SettingsPageHeader from "../_components/SettingsPageHeader";
import { usePageTitle } from "@/hooks/usePageTitle";
import { isHexColor, colorWarnings, pickForeground, liftForDark } from "@/lib/brandTheme";

const FALLBACK_PRIMARY = "#159bff";

function errorMessage(err, fallback) {
    return err?.response?.data?.error || err?.response?.data?.message || fallback;
}

function ColorField({ label, value, onChange, disabled, placeholder, invalidText }) {
    const invalid = value !== "" && !isHexColor(value);
    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-sm text-foreground">{label}</span>
            <div className="flex items-center gap-2">
                <input
                    type="color"
                    value={isHexColor(value) ? value : (placeholder || "#000000")}
                    onChange={(e) => onChange(e.target.value)}
                    disabled={disabled}
                    aria-label={label}
                    className="h-9 w-9 shrink-0 rounded border border-border cursor-pointer bg-transparent"
                />
                <TextField variant="secondary" value={value} onChange={onChange} isDisabled={disabled} aria-label={label} className="min-w-0">
                    <Input type="text" dir="ltr" placeholder={placeholder} />
                </TextField>
            </div>
            {invalid && <p className="text-xs text-destructive">{invalidText}</p>}
        </div>
    );
}

async function readDroppedFile(items) {
    const fileItem = items.find((item) => item.kind === "file");
    return fileItem ? fileItem.getFile() : null;
}

function ImageDropZone({ label, imageUrl, onFile, onRemove, busy, disabled, hint, accept = ["image/png", "image/jpeg", "image/webp"] }) {
    const t = useTranslations("brandingSettings");
    return (
        <div className="flex flex-col gap-1.5">
            <span className="text-sm text-foreground">{label}</span>
            <DropZone
                isDisabled={disabled || busy}
                onDrop={async (e) => { const file = await readDroppedFile(e.items); if (file) onFile(file); }}
                className={({ isDropTarget, isFocusVisible, isDisabled }) => [
                    "flex items-center gap-3 rounded-lg border-2 border-dashed p-3 transition-colors",
                    isDropTarget ? "border-primary bg-primary/5" : "border-border",
                    isFocusVisible ? "ring-2 ring-primary ring-offset-2 ring-offset-background" : "",
                    isDisabled ? "opacity-60" : "",
                ].filter(Boolean).join(" ")}
            >
                {imageUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt="" className="h-12 w-12 shrink-0 rounded object-contain border border-border bg-background" />
                )}
                <div className="flex flex-col gap-1 min-w-0">
                    <span className="text-xs text-muted-foreground">{t("dropHint")}</span>
                    <div className="flex items-center gap-2">
                        <FileTrigger acceptedFileTypes={accept} onSelect={(list) => list?.[0] && onFile(list[0])}>
                            <Button size="sm" variant="outline" isDisabled={disabled || busy}>
                                {busy ? t("uploading") : t("chooseFile")}
                            </Button>
                        </FileTrigger>
                        {imageUrl && onRemove && (
                            <Button size="sm" variant="ghost" isDisabled={disabled || busy} onClick={onRemove}>
                                {t("remove")}
                            </Button>
                        )}
                    </div>
                </div>
            </DropZone>
            {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
    );
}

/**
 * Mock-up of the real portal home page (header, welcome, banners, action items, progress and
 * bottom tab bar), driven by the unsaved draft so the coach sees what trainees will get before
 * saving. Variables are scoped to this element (the real portal sets them on <html>).
 */
function PreviewActionItem({ icon: Icon, title, subtitle }) {
    return (
        <div className="flex items-center gap-2 rounded-xl bg-secondary px-2.5 py-2">
            <span className="h-6 w-6 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                <Icon size={12} />
            </span>
            <span className="min-w-0 grow">
                <span className="block text-[11px] font-medium truncate">{title}</span>
                <span className="block text-[10px] text-muted-foreground truncate">{subtitle}</span>
            </span>
            <ChevronRight size={12} className="shrink-0 text-muted-foreground rtl:rotate-180" />
        </div>
    );
}

function PortalPreview({ draftPrimary, draftAccent, logoUrl, logoDarkUrl, welcomeMessage, banners, dark }) {
    const t = useTranslations("brandingSettings");
    const primary = isHexColor(draftPrimary) ? draftPrimary : null;
    const accent = primary ? (dark ? liftForDark(primary) : primary) : null;
    const foreground = accent ? pickForeground(accent) : null;
    const secondary = isHexColor(draftAccent) ? (dark ? liftForDark(draftAccent) : draftAccent) : null;
    const shownLogo = dark ? (logoDarkUrl || logoUrl) : logoUrl;
    const firstBanner = banners[0] ?? null;

    const style = accent ? {
        "--accent": accent, "--accent-foreground": foreground,
        "--primary": accent, "--primary-foreground": foreground, "--focus": accent,
        "--sidebar-accent": `color-mix(in oklch, ${accent} 14%, transparent)`,
        ...(secondary ? { "--brand-secondary": secondary } : {}),
    } : undefined;

    const tabs = [
        { key: "home", icon: Home, active: true },
        { key: "nutrition", icon: Salad },
        { key: "training", icon: Dumbbell },
        { key: "forms", icon: ClipboardList },
        { key: "messages", icon: MessageSquare },
    ];

    return (
        <div className={`${dark ? "dark" : ""} rounded-xl border border-border overflow-hidden bg-background text-foreground flex flex-col`} style={style}>
            {/* Header: avatar · logo · notifications (same layout as ClientPortalNav) */}
            <div className="h-12 shrink-0 border-b border-border grid grid-cols-3 items-center px-3">
                <div className="h-7 w-7 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center">AB</div>
                <div className="flex justify-center">
                    {shownLogo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={shownLogo} alt="" className="h-7 w-auto max-w-32 object-contain" />
                    ) : (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={dark ? "/blue_white.png" : "/blue_dark.png"} alt="FitForce" className="h-6 w-auto object-contain" />
                    )}
                </div>
                <div className="flex justify-end">
                    <span className="relative p-1.5 text-muted-foreground">
                        <Bell size={16} />
                        <span className="absolute -top-0.5 -end-0.5 min-w-3.5 h-3.5 px-0.5 rounded-full bg-(--brand-secondary,var(--primary)) text-primary-foreground text-[8px] font-bold flex items-center justify-center">3</span>
                    </span>
                </div>
            </div>

            {/* Page body: Home title, welcome message, banners, action needed, progress */}
            <div className="px-3 pt-3 pb-4 flex flex-col gap-3">
                <div>
                    <p className="text-base font-bold">{t("previewHome")}</p>
                    {welcomeMessage && <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{welcomeMessage}</p>}
                </div>

                {firstBanner ? (
                    <div className="flex flex-col gap-1.5">
                        <div className="relative aspect-3/1 rounded-xl overflow-hidden bg-default">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={firstBanner.imageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
                            {firstBanner.title && (
                                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-3 pt-6 pb-2">
                                    <p className="text-white text-[11px] font-semibold line-clamp-1">{firstBanner.title}</p>
                                </div>
                            )}
                        </div>
                        {banners.length > 1 && (
                            <div className="flex justify-center gap-1">
                                {banners.map((banner, index) => (
                                    <span
                                        key={banner.id}
                                        className={`h-1 rounded-full ${index === 0 ? "w-4 bg-(--brand-secondary,var(--primary))" : "w-1 bg-border"}`}
                                    />
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="aspect-3/1 rounded-xl bg-default flex items-center justify-center text-[11px] text-muted-foreground">
                        {t("previewBanner")}
                    </div>
                )}

                <div className="flex flex-col gap-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("previewActionNeeded")}</p>
                    <PreviewActionItem icon={ClipboardList} title={t("previewCheckin")} subtitle={t("previewCheckinSub")} />
                    <PreviewActionItem icon={Salad} title={t("previewNutritionPlan")} subtitle={t("previewNutritionPlanSub")} />
                </div>

                <div className="flex flex-col gap-1.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{t("previewProgress")}</p>
                    <div className="rounded-xl bg-secondary px-3 py-2.5">
                        <div className="flex items-center justify-between">
                            <span className="text-[11px] font-medium">{t("previewWeight")}</span>
                            <span className="text-[11px] text-primary font-semibold">78.4 kg</span>
                        </div>
                        <svg viewBox="0 0 100 24" className="mt-1.5 h-8 w-full text-primary" preserveAspectRatio="none" aria-hidden="true">
                            <polyline points="0,18 20,15 40,16 60,10 80,8 100,4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Bottom tab bar (same icons as the portal nav; home active) */}
            <div className="shrink-0 border-t border-border flex items-center justify-around px-1 py-2">
                {tabs.map(({ key, icon: Icon, active }) => (
                    <span
                        key={key}
                        className={`flex h-8 w-10 items-center justify-center rounded-lg ${active ? "bg-sidebar-accent text-primary" : "text-muted-foreground"}`}
                    >
                        <Icon size={16} />
                    </span>
                ))}
            </div>
        </div>
    );
}

function LockedState({ eligibility, hasSavedBranding, slug }) {
    const t = useTranslations("brandingSettings");
    const locale = useLocale();
    const planNames = (eligibility.plans ?? [])
        .map((p) => (locale === "ar" && p.display_name_ar) ? p.display_name_ar : p.display_name)
        .join(", ");

    return (
        <Card>
            <Card.Content className="flex flex-col items-center text-center gap-4 py-10">
                <div className="h-12 w-12 rounded-full bg-default flex items-center justify-center">
                    <Lock size={22} className="text-muted-foreground" />
                </div>
                <div className="flex flex-col gap-1 max-w-md">
                    <h2 className="text-lg font-semibold text-foreground">
                        {eligibility.expired && eligibility.planHas ? t("lockedExpiredTitle") : t("lockedTitle")}
                    </h2>
                    <p className="text-sm text-muted-foreground">
                        {eligibility.expired && eligibility.planHas
                            ? t("lockedExpiredBody")
                            : (planNames ? t("lockedBodyWithPlans", { plans: planNames }) : t("lockedBody"))}
                    </p>
                    {hasSavedBranding && <p className="text-sm text-foreground mt-2">{t("lockedPausedNote")}</p>}
                </div>
                <Link href={`/${slug}/settings/subscription`}>
                    <Button variant="primary">{eligibility.expired && eligibility.planHas ? t("renewCta") : t("upgradeCta")}</Button>
                </Link>
            </Card.Content>
        </Card>
    );
}

function BannerRow({ banner, index, total, disabled, onPatch, onMove, onDelete }) {
    const t = useTranslations("brandingSettings");
    const [title, setTitle] = useState(banner.title ?? "");
    const [link, setLink] = useState(banner.linkUrl ?? "");

    return (
        <div className="flex flex-col sm:flex-row gap-3 rounded-lg border border-border p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={banner.imageUrl} alt="" className="w-full sm:w-40 aspect-3/1 object-cover rounded border border-border shrink-0" />
            <div className="flex flex-col gap-2 grow min-w-0">
                <TextField variant="secondary" fullWidth value={title} onChange={setTitle} isDisabled={disabled} aria-label={t("bannerTitle")}>
                    <Input type="text" maxLength={80} placeholder={t("bannerTitle")}
                        onBlur={() => title !== (banner.title ?? "") && onPatch(banner.id, { title })} />
                </TextField>
                <TextField variant="secondary" fullWidth value={link} onChange={setLink} isDisabled={disabled} aria-label={t("bannerLink")}>
                    <Input type="text" dir="ltr" placeholder="https://… / /portal/forms"
                        onBlur={() => link !== (banner.linkUrl ?? "") && onPatch(banner.id, { link_url: link })} />
                </TextField>
                <div className="flex items-center gap-2 flex-wrap">
                    <Switch isSelected={banner.isActive} isDisabled={disabled} onChange={(v) => onPatch(banner.id, { is_active: v })}>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                    </Switch>
                    <span className="text-xs text-muted-foreground">{banner.isActive ? t("bannerActive") : t("bannerHidden")}</span>
                    <div className="ms-auto flex items-center gap-1">
                        <Button size="sm" variant="ghost" isIconOnly aria-label={t("moveUp")} isDisabled={disabled || index === 0} onClick={() => onMove(index, -1)}><ArrowUp size={16} /></Button>
                        <Button size="sm" variant="ghost" isIconOnly aria-label={t("moveDown")} isDisabled={disabled || index === total - 1} onClick={() => onMove(index, 1)}><ArrowDown size={16} /></Button>
                        <Button size="sm" variant="ghost" isIconOnly aria-label={t("delete")} isDisabled={disabled} onClick={() => onDelete(banner.id)}><Trash2 size={16} /></Button>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default function BrandingSettingsPage() {
    const t = useTranslations("brandingSettings");
    const tNav = useTranslations("nav");
    const { workspaceSlug } = useParams();
    usePageTitle(tNav("branding"));

    const [view, setView] = useState(null);
    const [loadError, setLoadError] = useState("");
    const [actionError, setActionError] = useState("");
    const [busy, setBusy] = useState("");
    const [savedNotice, setSavedNotice] = useState(false);
    const [previewDark, setPreviewDark] = useState(false);
    const [draftPrimary, setDraftPrimary] = useState("");
    const [draftAccent, setDraftAccent] = useState("");
    const [draftWelcome, setDraftWelcome] = useState("");
    const [newBanner, setNewBanner] = useState({ file: null, title: "", link: "" });

    const applyView = useCallback((data, { resetDraft } = { resetDraft: false }) => {
        setView(data);
        if (resetDraft) {
            setDraftPrimary(data.branding.primaryColor ?? "");
            setDraftAccent(data.branding.accentColor ?? "");
            setDraftWelcome(data.branding.welcomeMessage ?? "");
        }
    }, []);

    useEffect(() => {
        let active = true;
        api.get("/api/branding")
            .then((res) => { if (active) applyView(res.data, { resetDraft: true }); })
            .catch((err) => { if (active) setLoadError(errorMessage(err, t("loadFailed"))); });
        return () => { active = false; };
    }, [applyView, t]);

    const run = useCallback(async (key, request, { resetDraft = false, successNotice = false } = {}) => {
        setBusy(key);
        setActionError("");
        try {
            const res = await request();
            applyView(res.data, { resetDraft });
            if (successNotice) {
                setSavedNotice(true);
                setTimeout(() => setSavedNotice(false), 2500);
            }
            return true;
        } catch (err) {
            setActionError(errorMessage(err, t("actionFailed")));
            return false;
        } finally {
            setBusy("");
        }
    }, [applyView, t]);

    const warnings = useMemo(() => colorWarnings(draftPrimary), [draftPrimary]);

    // Object URL for the not-yet-uploaded banner file; revoked when replaced/unmounted.
    const newBannerPreviewUrl = useMemo(
        () => (newBanner.file ? URL.createObjectURL(newBanner.file) : null),
        [newBanner.file],
    );
    useEffect(() => () => { if (newBannerPreviewUrl) URL.revokeObjectURL(newBannerPreviewUrl); }, [newBannerPreviewUrl]);
    const colorsChanged = view && (
        draftPrimary !== (view.branding.primaryColor ?? "") || draftAccent !== (view.branding.accentColor ?? "")
    );
    const colorsValid = (draftPrimary === "" || isHexColor(draftPrimary)) && (draftAccent === "" || isHexColor(draftAccent));

    if (loadError) {
        return <Alert status="danger"><Alert.Indicator /><Alert.Content><Alert.Description>{loadError}</Alert.Description></Alert.Content></Alert>;
    }
    if (!view) {
        return (
            <div className="flex flex-col gap-4">
                <Skeleton className="h-9 w-48 rounded-lg" />
                {[1, 2].map((i) => <Skeleton key={i} className="h-40 rounded-lg" />)}
            </div>
        );
    }

    const { eligibility, branding, banners, limits } = view;
    const eligible = eligibility.eligible;
    const hasSavedBranding = !!(branding.logoUrl || branding.logoDarkUrl || branding.primaryColor || branding.accentColor || banners.length > 0);
    const controlsDisabled = !eligible || busy !== "";
    const maxLogoMb = Math.round(limits.logoMaxBytes / (1024 * 1024));
    const maxBannerMb = Math.round(limits.bannerMaxBytes / (1024 * 1024));

    function moveBanner(index, delta) {
        const ids = banners.map((b) => b.id);
        const target = index + delta;
        if (target < 0 || target >= ids.length) return;
        [ids[index], ids[target]] = [ids[target], ids[index]];
        run("reorder", () => api.put("/api/branding/banners/order", { ids }));
    }

    function addBanner() {
        if (!newBanner.file) return;
        const form = new FormData();
        form.append("file", newBanner.file);
        if (newBanner.title.trim()) form.append("title", newBanner.title.trim());
        if (newBanner.link.trim()) form.append("link_url", newBanner.link.trim());
        run("banner-add", () => api.post("/api/branding/banners", form)).then((ok) => {
            if (ok) setNewBanner({ file: null, title: "", link: "" });
        });
    }

    return (
        <div className="flex flex-col gap-6">
            <SettingsPageHeader title={t("title")} description={t("description")} />

            {!eligible && (
                <LockedState eligibility={eligibility} hasSavedBranding={hasSavedBranding} slug={workspaceSlug} />
            )}

            {actionError && (
                <Alert status="danger"><Alert.Indicator /><Alert.Content><Alert.Description>{actionError}</Alert.Description></Alert.Content></Alert>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                <div className="flex flex-col gap-6 min-w-0">
                    <Card>
                        <Card.Header><Card.Title>{t("logoTitle")}</Card.Title></Card.Header>
                        <Card.Content className="flex flex-col gap-4">
                            <ImageDropZone
                                label={t("logoLight")}
                                imageUrl={branding.logoUrl}
                                busy={busy === "logo-light"}
                                disabled={controlsDisabled}
                                hint={t("logoHint", { size: maxLogoMb, min: limits.logoMinPx })}
                                onFile={(file) => {
                                    const form = new FormData(); form.append("file", file);
                                    run("logo-light", () => api.post("/api/branding/logo?variant=light", form));
                                }}
                                onRemove={() => run("logo-light", () => api.delete("/api/branding/logo?variant=light"))}
                            />
                            <ImageDropZone
                                label={t("logoDark")}
                                imageUrl={branding.logoDarkUrl}
                                busy={busy === "logo-dark"}
                                disabled={controlsDisabled}
                                hint={t("logoDarkHint")}
                                onFile={(file) => {
                                    const form = new FormData(); form.append("file", file);
                                    run("logo-dark", () => api.post("/api/branding/logo?variant=dark", form));
                                }}
                                onRemove={() => run("logo-dark", () => api.delete("/api/branding/logo?variant=dark"))}
                            />
                        </Card.Content>
                    </Card>

                    <Card>
                        <Card.Header><Card.Title>{t("colorsTitle")}</Card.Title></Card.Header>
                        <Card.Content className="flex flex-col gap-4">
                            <ColorField label={t("primaryColor")} value={draftPrimary} onChange={setDraftPrimary}
                                disabled={controlsDisabled} placeholder={FALLBACK_PRIMARY} invalidText={t("invalidColor")} />
                            <ColorField label={t("accentColor")} value={draftAccent} onChange={setDraftAccent}
                                disabled={controlsDisabled} placeholder="#16a34a" invalidText={t("invalidColor")} />
                            <p className="text-xs text-muted-foreground">{t("colorsHint")}</p>
                            {warnings.length > 0 && (
                                <Alert status="warning">
                                    <Alert.Indicator />
                                    <Alert.Content>
                                        <Alert.Description>
                                            <ul className="list-disc ps-4">
                                                {warnings.map((w) => <li key={w}>{t(`warning.${w}`)}</li>)}
                                            </ul>
                                        </Alert.Description>
                                    </Alert.Content>
                                </Alert>
                            )}
                            <div className="flex items-center gap-2 flex-wrap">
                                <Button
                                    variant="primary"
                                    isDisabled={controlsDisabled || !colorsChanged || !colorsValid}
                                    onClick={() => run("colors", () => api.put("/api/branding", {
                                        primary_color: draftPrimary || null,
                                        accent_color: draftAccent || null,
                                    }), { successNotice: true })}
                                >
                                    {busy === "colors" ? t("saving") : t("save")}
                                </Button>
                                <Button
                                    variant="outline"
                                    isDisabled={controlsDisabled || (!branding.primaryColor && !branding.accentColor && !draftPrimary && !draftAccent)}
                                    onClick={() => run("colors", () => api.put("/api/branding", { primary_color: null, accent_color: null }), { resetDraft: true })}
                                >
                                    {t("resetColors")}
                                </Button>
                                {savedNotice && <span className="text-sm text-success">{t("saved")}</span>}
                            </div>
                        </Card.Content>
                    </Card>

                    <Card>
                        <Card.Header><Card.Title>{t("welcomeTitle")}</Card.Title></Card.Header>
                        <Card.Content className="flex flex-col gap-3">
                            <TextField variant="secondary" fullWidth value={draftWelcome} onChange={setDraftWelcome} isDisabled={controlsDisabled} aria-label={t("welcomeTitle")}>
                                <Input type="text" maxLength={limits.welcomeMessageMax} placeholder={t("welcomePlaceholder")} />
                            </TextField>
                            <p className="text-xs text-muted-foreground">
                                {t("welcomeHint", { count: draftWelcome.length, max: limits.welcomeMessageMax })}
                            </p>
                            <div>
                                <Button
                                    variant="primary"
                                    isDisabled={controlsDisabled || draftWelcome.trim() === (branding.welcomeMessage ?? "")}
                                    onClick={() => run("welcome", () => api.put("/api/branding", { welcome_message: draftWelcome.trim() || null }), { successNotice: true })}
                                >
                                    {busy === "welcome" ? t("saving") : t("saveWelcome")}
                                </Button>
                            </div>
                        </Card.Content>
                    </Card>

                    <Card>
                        <Card.Header><Card.Title>{t("bannersTitle")}</Card.Title></Card.Header>
                        <Card.Content className="flex flex-col gap-4">
                            <p className="text-xs text-muted-foreground">
                                {t("bannersHint", { max: limits.maxBanners, size: maxBannerMb, width: limits.bannerMinWidthPx })}
                            </p>
                            {banners.map((banner, index) => (
                                <BannerRow
                                    // remount when saved values change so the draft inputs re-sync from the server
                                    key={`${banner.id}:${banner.title ?? ""}:${banner.linkUrl ?? ""}`}
                                    banner={banner}
                                    index={index}
                                    total={banners.length}
                                    disabled={controlsDisabled}
                                    onPatch={(id, patch) => run(`banner-${id}`, () => api.patch(`/api/branding/banners/${id}`, patch))}
                                    onMove={moveBanner}
                                    onDelete={(id) => run(`banner-${id}`, () => api.delete(`/api/branding/banners/${id}`))}
                                />
                            ))}
                            {banners.length < limits.maxBanners && (
                                <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border p-3">
                                    <ImageDropZone
                                        label={t("addBanner")}
                                        imageUrl={newBannerPreviewUrl}
                                        busy={busy === "banner-add"}
                                        disabled={controlsDisabled}
                                        onFile={(file) => setNewBanner((s) => ({ ...s, file }))}
                                        onRemove={() => setNewBanner((s) => ({ ...s, file: null }))}
                                    />
                                    <TextField variant="secondary" fullWidth value={newBanner.title} onChange={(v) => setNewBanner((s) => ({ ...s, title: v }))} isDisabled={controlsDisabled} aria-label={t("bannerTitle")}>
                                        <Input type="text" maxLength={80} placeholder={t("bannerTitle")} />
                                    </TextField>
                                    <TextField variant="secondary" fullWidth value={newBanner.link} onChange={(v) => setNewBanner((s) => ({ ...s, link: v }))} isDisabled={controlsDisabled} aria-label={t("bannerLink")}>
                                        <Input type="text" dir="ltr" placeholder="https://… / /portal/forms" />
                                    </TextField>
                                    <div>
                                        <Button variant="primary" isDisabled={controlsDisabled || !newBanner.file} onClick={addBanner}>
                                            {busy === "banner-add" ? t("uploading") : t("addBannerCta")}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </Card.Content>
                    </Card>
                </div>

                <div className="flex flex-col gap-3 lg:sticky lg:top-6">
                    <div className="flex items-center justify-between gap-2">
                        <h2 className="text-sm font-semibold text-foreground">{t("previewTitle")}</h2>
                        <div className="flex gap-1">
                            <Button size="sm" variant={previewDark ? "ghost" : "secondary"} onClick={() => setPreviewDark(false)}>{t("previewLight")}</Button>
                            <Button size="sm" variant={previewDark ? "secondary" : "ghost"} onClick={() => setPreviewDark(true)}>{t("previewDark")}</Button>
                        </div>
                    </div>
                    <PortalPreview
                        draftPrimary={draftPrimary}
                        draftAccent={draftAccent}
                        logoUrl={branding.logoUrl}
                        logoDarkUrl={branding.logoDarkUrl}
                        welcomeMessage={draftWelcome.trim()}
                        banners={banners.filter((b) => b.isActive)}
                        dark={previewDark}
                    />
                    <p className="text-xs text-muted-foreground">{t("previewNote")}</p>
                </div>
            </div>
        </div>
    );
}
