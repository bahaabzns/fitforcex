"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import { Image, Globe, Clock, Calendar, Copy, Check, ExternalLink, QrCode, Share2, Palette, MessageSquare, Eye } from "lucide-react";
import { Card } from "@heroui/react/card";
import { Button } from "@heroui/react/button";
import { Alert } from "@heroui/react/alert";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { InputGroup } from "@heroui/react/input-group";
import { Label } from "@heroui/react/label";
import { Tooltip } from "@heroui/react/tooltip";
import SettingsPageHeader from "../_components/SettingsPageHeader";
import SettingsPlaceholderRow from "../_components/SettingsPlaceholderRow";
import { usePageTitle } from "@/hooks/usePageTitle";

function StatusAlert({ status, children }) {
    if (!children) return null;
    return (
        <Alert status={status}>
            <Alert.Indicator />
            <Alert.Content>
                <Alert.Description>{children}</Alert.Description>
            </Alert.Content>
        </Alert>
    );
}

export default function WorkspacePage() {
    const t = useTranslations("workspaceSettings");
    const tNav = useTranslations("nav");
    const tGeneral = useTranslations("workspaceGeneral");
    const tPortal = useTranslations("clientPortalSettings");
    const tCommon = useTranslations("common");
    usePageTitle(tNav("workspace"));
    const [me, setMe] = useState(null);
    const [workspace, setWorkspace] = useState(null);

    const [wsName, setWsName] = useState("");
    const [renameSaving, setRenameSaving] = useState(false);
    const [renameError, setRenameError] = useState("");
    const [renameSuccess, setRenameSuccess] = useState("");

    const [copied, setCopied] = useState(false);
    const [newSlug, setNewSlug] = useState("");
    const [slugSaving, setSlugSaving] = useState(false);
    const [slugError, setSlugError] = useState("");
    const [slugSuccess, setSlugSuccess] = useState("");

    const [renewalLink, setRenewalLink] = useState("");
    const [renewalLinkSaving, setRenewalLinkSaving] = useState(false);
    const [renewalLinkError, setRenewalLinkError] = useState("");
    const [renewalLinkSuccess, setRenewalLinkSuccess] = useState("");

    useEffect(() => {
        api.get("/api/auth/me").then(meRes => {
            setMe(meRes.data);
            const wsId = meRes.data.currentWorkspace?.id;
            if (!wsId) return;
            api.get(`/api/workspaces/${wsId}`).then(wsRes => {
                setWorkspace(wsRes.data);
                setWsName(wsRes.data?.name ?? "");
                setRenewalLink(wsRes.data?.renewal_link ?? "");
            });
        });
    }, []);

    const isOwner = me?.currentWorkspace?.role === "owner";
    const wsId = me?.currentWorkspace?.id;

    const portalUrl = typeof window !== "undefined"
        ? `${window.location.origin}/portal/${workspace?.slug}`
        : `/portal/${workspace?.slug}`;

    async function handleRename(e) {
        e.preventDefault();
        if (!wsName.trim()) return;
        setRenameError(""); setRenameSuccess("");
        setRenameSaving(true);
        try {
            const res = await api.patch(`/api/workspaces/${wsId}/name`, { name: wsName.trim() });
            setWorkspace(prev => ({ ...prev, name: res.data.name }));
            setRenameSuccess(t("renameSuccess"));
        } catch (err) {
            setRenameError(err.response?.data?.message || t("renameFailed"));
        } finally {
            setRenameSaving(false);
        }
    }

    async function handleSaveRenewalLink(e) {
        e.preventDefault();
        setRenewalLinkError(""); setRenewalLinkSuccess("");
        setRenewalLinkSaving(true);
        try {
            const res = await api.patch(`/api/workspaces/${wsId}/renewal-link`, { renewalLink: renewalLink.trim() });
            setWorkspace(prev => ({ ...prev, renewal_link: res.data.renewal_link }));
            setRenewalLink(res.data.renewal_link ?? "");
            setRenewalLinkSuccess(t("renewalLinkSaveSuccess"));
        } catch (err) {
            setRenewalLinkError(err.response?.data?.message || t("renewalLinkSaveFailed"));
        } finally {
            setRenewalLinkSaving(false);
        }
    }

    async function handleCopyPortalUrl() {
        try {
            await navigator.clipboard.writeText(portalUrl);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
        } catch {
            // Clipboard API unavailable — nothing to fall back to.
        }
    }

    function handleOpenPortal() {
        window.open(portalUrl, "_blank", "noopener,noreferrer");
    }

    async function handleCustomizeSlug(e) {
        e.preventDefault();
        setSlugError(""); setSlugSuccess("");
        setSlugSaving(true);
        try {
            const res = await api.put(`/api/workspaces/${wsId}/slug`, { slug: newSlug.trim() });
            setWorkspace(prev => ({ ...prev, slug: res.data.slug, slug_customized: true }));
            setSlugSuccess(t("slugUpdateSuccess"));
            setNewSlug("");
        } catch (err) {
            setSlugError(err.response?.data?.message || t("slugUpdateFailed"));
        } finally {
            setSlugSaving(false);
        }
    }

    return (
        <div className="flex flex-col gap-8">
            <SettingsPageHeader title={tNav("workspace")} description={t("pageSubtitle")} />

            <div className="flex flex-col gap-6">
                {isOwner && (
                    <Card>
                        <Card.Header>
                            <Card.Title>{t("workspaceNameSection")}</Card.Title>
                            <Card.Description>{t("workspaceNameSectionDesc")}</Card.Description>
                        </Card.Header>
                        <Card.Content className="flex flex-col gap-4">
                            <form id="workspace-rename-form" onSubmit={handleRename} className="flex flex-col gap-4">
                                <TextField variant="secondary" fullWidth isRequired value={wsName} onChange={setWsName}>
                                    <Label>{t("nameLabel")}</Label>
                                    <Input />
                                </TextField>
                                <StatusAlert status="danger">{renameError}</StatusAlert>
                                <StatusAlert status="success">{renameSuccess}</StatusAlert>
                            </form>
                        </Card.Content>
                        <Card.Footer>
                            <Button
                                type="submit"
                                form="workspace-rename-form"
                                isDisabled={renameSaving || !wsName.trim() || wsName.trim() === workspace?.name}
                                variant="primary"
                            >
                                {renameSaving ? t("saving") : t("save")}
                            </Button>
                        </Card.Footer>
                    </Card>
                )}

                <Card>
                    <Card.Header>
                        <Card.Title>{tGeneral("morePreferences")}</Card.Title>
                    </Card.Header>
                    <Card.Content className="flex flex-col">
                        <SettingsPlaceholderRow icon={Image} label={tGeneral("logo")} comingSoonLabel={tCommon("comingSoon")} />
                        <SettingsPlaceholderRow icon={Globe} label={tGeneral("language")} comingSoonLabel={tCommon("comingSoon")} />
                        <SettingsPlaceholderRow icon={Clock} label={tGeneral("timezone")} comingSoonLabel={tCommon("comingSoon")} />
                        <SettingsPlaceholderRow icon={Calendar} label={tGeneral("dateFormat")} comingSoonLabel={tCommon("comingSoon")} />
                    </Card.Content>
                </Card>

                <Card>
                    <Card.Header>
                        <Card.Title>{t("clientPortalSection")}</Card.Title>
                        <Card.Description>{t("portalUrlHint")}</Card.Description>
                    </Card.Header>
                    <Card.Content className="flex flex-col gap-4">
                        <div className="flex flex-col gap-1.5">
                            <Label>{t("portalUrlLabel")}</Label>
                            <InputGroup variant="secondary">
                                <InputGroup.Input readOnly value={portalUrl} onFocus={(e) => e.target.select()} />
                                <InputGroup.Suffix>
                                    <Tooltip>
                                        <Button
                                            isIconOnly
                                            size="sm"
                                            variant="ghost"
                                            aria-label={tCommon("copy")}
                                            onClick={handleCopyPortalUrl}
                                        >
                                            {copied ? <Check size={14} /> : <Copy size={14} />}
                                        </Button>
                                        <Tooltip.Content>{copied ? tCommon("copied") : tCommon("copy")}</Tooltip.Content>
                                    </Tooltip>
                                </InputGroup.Suffix>
                            </InputGroup>
                        </div>

                        {/* Quick actions */}
                        <div className="flex flex-wrap items-center gap-2">
                            <Button size="sm" variant="outline" onClick={handleOpenPortal} className="gap-1.5">
                                <ExternalLink size={14} /> {t("portalQuickActions.open")}
                            </Button>
                            <Tooltip>
                                <Button size="sm" variant="outline" isDisabled className="gap-1.5">
                                    <QrCode size={14} /> {t("portalQuickActions.generateQr")}
                                </Button>
                                <Tooltip.Content>{t("portalQuickActions.comingSoon")}</Tooltip.Content>
                            </Tooltip>
                            <Tooltip>
                                <Button size="sm" variant="outline" isDisabled className="gap-1.5">
                                    <Share2 size={14} /> {t("portalQuickActions.share")}
                                </Button>
                                <Tooltip.Content>{t("portalQuickActions.comingSoon")}</Tooltip.Content>
                            </Tooltip>
                        </div>

                        {/* Renewal link — what the "Renew Subscription" button on the
                            client portal's expired-subscription screen opens. */}
                        {isOwner && (
                            <form onSubmit={handleSaveRenewalLink} className="flex flex-col gap-3 pt-3 border-t border-border">
                                <div className="flex flex-col gap-1.5">
                                    <Label>{t("renewalLinkLabel")}</Label>
                                    <TextField variant="secondary" fullWidth value={renewalLink} onChange={setRenewalLink}>
                                        <Input type="url" placeholder="https://" />
                                    </TextField>
                                    <p className="text-xs text-muted-foreground">{t("renewalLinkHint")}</p>
                                </div>
                                <StatusAlert status="danger">{renewalLinkError}</StatusAlert>
                                <StatusAlert status="success">{renewalLinkSuccess}</StatusAlert>
                                <Button
                                    type="submit"
                                    isDisabled={renewalLinkSaving || renewalLink.trim() === (workspace?.renewal_link ?? "")}
                                    variant="primary"
                                    className="self-start"
                                >
                                    {renewalLinkSaving ? t("saving") : t("save")}
                                </Button>
                            </form>
                        )}

                        {/* Slug customization */}
                        {isOwner && !workspace?.slug_customized && (
                            <form onSubmit={handleCustomizeSlug} className="flex flex-col gap-3 pt-3 border-t border-border">
                                <p className="text-xs text-muted-foreground">{t("slugHint")}</p>
                                <div className="flex flex-col gap-1.5">
                                    <Label>{t("customSlugLabel")}</Label>
                                    <InputGroup variant="secondary">
                                        <InputGroup.Prefix className="text-muted-foreground text-sm">/portal/</InputGroup.Prefix>
                                        <InputGroup.Input
                                            placeholder="your-slug"
                                            value={newSlug}
                                            onChange={e => setNewSlug(e.target.value)}
                                        />
                                    </InputGroup>
                                    <p className="text-xs text-muted-foreground">{t("slugFormat")}</p>
                                </div>
                                <StatusAlert status="danger">{slugError}</StatusAlert>
                                <StatusAlert status="success">{slugSuccess}</StatusAlert>
                                <Button
                                    type="submit"
                                    isDisabled={slugSaving || !newSlug.trim()}
                                    variant="primary"
                                    className="self-start"
                                >
                                    {slugSaving ? t("saving") : t("customizeSlug")}
                                </Button>
                            </form>
                        )}

                        {workspace?.slug_customized && (
                            <StatusAlert status="accent">{t("slugCustomized")}</StatusAlert>
                        )}
                    </Card.Content>
                </Card>

                <Card>
                    <Card.Header>
                        <Card.Title>{tPortal("morePreferences")}</Card.Title>
                    </Card.Header>
                    <Card.Content className="flex flex-col">
                        <SettingsPlaceholderRow icon={Palette} label={tPortal("portalTheme")} comingSoonLabel={tCommon("comingSoon")} />
                        <SettingsPlaceholderRow icon={MessageSquare} label={tPortal("portalWelcomeMessage")} comingSoonLabel={tCommon("comingSoon")} />
                        <SettingsPlaceholderRow icon={Eye} label={tPortal("portalVisibility")} comingSoonLabel={tCommon("comingSoon")} />
                    </Card.Content>
                </Card>
            </div>
        </div>
    );
}
