"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@heroui/react/button";

const inputCls = "w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-colors";

function SuccessMsg({ msg }) {
    if (!msg) return null;
    return (
        <p className="flex items-center gap-2 text-sm text-green-600 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
            <CheckCircle2 size={14} className="shrink-0" /> {msg}
        </p>
    );
}

function ErrorMsg({ msg }) {
    if (!msg) return null;
    return (
        <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
            {msg}
        </p>
    );
}

export default function WorkspacePage() {
    const t = useTranslations("workspaceSettings");
    const router = useRouter();
    const [me, setMe] = useState(null);
    const [workspace, setWorkspace] = useState(null);
    const [members, setMembers] = useState([]);

    const [wsName, setWsName] = useState("");
    const [renameSaving, setRenameSaving] = useState(false);
    const [renameError, setRenameError] = useState("");
    const [renameSuccess, setRenameSuccess] = useState("");

    const [newSlug, setNewSlug] = useState("");
    const [slugSaving, setSlugSaving] = useState(false);
    const [slugError, setSlugError] = useState("");
    const [slugSuccess, setSlugSuccess] = useState("");

    const [showTransfer, setShowTransfer] = useState(false);
    const [transferMemberId, setTransferMemberId] = useState("");
    const [transferPassword, setTransferPassword] = useState("");
    const [transferring, setTransferring] = useState(false);
    const [transferError, setTransferError] = useState("");

    const [showArchive, setShowArchive] = useState(false);
    const [archiveConfirm, setArchiveConfirm] = useState("");
    const [archiving, setArchiving] = useState(false);
    const [archiveError, setArchiveError] = useState("");

    useEffect(() => {
        Promise.all([
            api.get("/api/auth/me"),
        ]).then(([meRes]) => {
            setMe(meRes.data);
            const wsId = meRes.data.currentWorkspace?.id;
            if (wsId) {
                return Promise.all([
                    api.get(`/api/workspaces/${wsId}`),
                    api.get(`/api/workspaces/${wsId}/members`).catch(() => ({ data: [] })),
                ]).then(([wsRes, membersRes]) => {
                    setWorkspace(wsRes.data);
                    setMembers(membersRes.data);
                    setWsName(wsRes.data?.name ?? "");
                });
            }
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

    async function handleTransfer(e) {
        e.preventDefault();
        setTransferError("");
        setTransferring(true);
        try {
            await api.post(`/api/workspaces/${wsId}/transfer-ownership`, {
                memberId: parseInt(transferMemberId),
                ownerPassword: transferPassword,
            });
            router.push("/dashboard");
            router.refresh();
        } catch (err) {
            setTransferError(err.response?.data?.message || t("transferFailed"));
        } finally {
            setTransferring(false);
        }
    }

    async function handleArchive(e) {
        e.preventDefault();
        if (archiveConfirm !== workspace?.name) return;
        setArchiveError("");
        setArchiving(true);
        try {
            await api.delete(`/api/workspaces/${wsId}`);
            router.push("/dashboard");
            router.refresh();
        } catch (err) {
            setArchiveError(err.response?.data?.message || t("archiveFailed"));
        } finally {
            setArchiving(false);
        }
    }

    const activeMembers = members.filter(m => m.is_active);

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">{t("pageTitle")}</h1>
                <p className="text-sm text-muted-foreground mt-1">{t("pageSubtitle")}</p>
            </div>

            {/* Rename */}
            {isOwner && (
                <div className="rounded-lg border border-border p-5 flex flex-col gap-4">
                    <h3 className="text-sm font-semibold text-foreground">{t("workspaceNameSection")}</h3>
                    <form onSubmit={handleRename} className="flex flex-col gap-3">
                        <div>
                            <label className="text-xs text-muted-foreground font-medium block mb-1">{t("nameLabel")}</label>
                            <input
                                type="text"
                                value={wsName}
                                onChange={e => setWsName(e.target.value)}
                                className={inputCls}
                                required
                            />
                        </div>
                        <ErrorMsg msg={renameError} />
                        <SuccessMsg msg={renameSuccess} />
                        <Button
                            type="submit"
                            isDisabled={renameSaving || !wsName.trim() || wsName.trim() === workspace?.name}
                            variant="primary"
                            className="self-start"
                        >
                            {renameSaving ? t("saving") : t("save")}
                        </Button>
                    </form>
                </div>
            )}

            {/* Portal URL */}
            <div className="rounded-lg border border-border p-5 flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-foreground">{t("clientPortalSection")}</h3>
                <div>
                    <label className="text-xs text-muted-foreground font-medium block mb-1">{t("portalUrlLabel")}</label>
                    <div className="p-3 rounded-lg bg-secondary/50 border border-border">
                        <code className="text-sm text-foreground break-all">{portalUrl}</code>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1.5">
                        {t("portalUrlHint")}
                    </p>
                </div>

                {/* Slug customization */}
                {isOwner && !workspace?.slug_customized && (
                    <form onSubmit={handleCustomizeSlug} className="flex flex-col gap-3 pt-3 border-t border-border">
                        <p className="text-xs text-muted-foreground">
                            {t("slugHint")}
                        </p>
                        <div>
                            <label className="text-xs text-muted-foreground font-medium block mb-1">{t("customSlugLabel")}</label>
                            <div className="flex items-center gap-0">
                                <span className="px-3 py-2 rounded-l-md border border-r-0 border-input bg-secondary text-muted-foreground text-sm select-none">
                                    /portal/
                                </span>
                                <input
                                    type="text"
                                    placeholder="your-slug"
                                    value={newSlug}
                                    onChange={e => setNewSlug(e.target.value)}
                                    className="flex-1 px-3 py-2 rounded-r-md border border-input bg-background text-foreground placeholder:text-muted-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors"
                                    required
                                />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">{t("slugFormat")}</p>
                        </div>
                        <ErrorMsg msg={slugError} />
                        <SuccessMsg msg={slugSuccess} />
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
                    <p className="text-xs text-accent bg-accent/10 border border-accent/20 rounded-lg px-3 py-2">
                        ✓ {t("slugCustomized")}
                    </p>
                )}
            </div>

            {/* Danger Zone Section */}
            {isOwner ? (
                <div className="flex flex-col gap-4">
                    <h3 className="text-sm font-semibold text-destructive">{t("dangerZone")}</h3>

                    {/* Transfer Ownership */}
                    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-5 flex flex-col gap-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                            <div>
                                <h4 className="text-sm font-semibold text-foreground">{t("transferTitle")}</h4>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {t("transferDesc")}
                                </p>
                            </div>
                        </div>

                        {!showTransfer ? (
                            <Button
                                onClick={() => setShowTransfer(true)}
                                isDisabled={activeMembers.length === 0}
                                className="self-start border border-amber-500/40 bg-amber-500/15 text-amber-700 hover:bg-amber-500/25"
                            >
                                {t("transferButton")}
                            </Button>
                        ) : (
                            <form onSubmit={handleTransfer} className="flex flex-col gap-3">
                                {activeMembers.length === 0 ? (
                                    <p className="text-sm text-muted-foreground">{t("noActiveMembers")}</p>
                                ) : (
                                    <>
                                        <div>
                                            <label className="text-xs text-muted-foreground font-medium block mb-1">{t("transferToLabel")}</label>
                                            <select
                                                value={transferMemberId}
                                                onChange={e => setTransferMemberId(e.target.value)}
                                                className={inputCls}
                                                required
                                            >
                                                <option value="">{t("selectMember")}</option>
                                                {activeMembers.map(m => (
                                                    <option key={m.id} value={m.id}>
                                                        {m.fname} {m.lname} ({m.email})
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="text-xs text-muted-foreground font-medium block mb-1">{t("confirmPasswordLabel")}</label>
                                            <input
                                                type="password"
                                                value={transferPassword}
                                                onChange={e => setTransferPassword(e.target.value)}
                                                className={inputCls}
                                                required
                                                autoComplete="current-password"
                                            />
                                        </div>
                                        <ErrorMsg msg={transferError} />
                                        <div className="flex gap-2">
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                onClick={() => { setShowTransfer(false); setTransferError(""); setTransferPassword(""); setTransferMemberId(""); }}
                                            >
                                                {t("cancel")}
                                            </Button>
                                            <Button
                                                type="submit"
                                                isDisabled={transferring || !transferMemberId || !transferPassword}
                                                className="bg-amber-600 text-white hover:bg-amber-700"
                                            >
                                                {transferring ? t("transferring") : t("confirmTransfer")}
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </form>
                        )}
                    </div>

                    {/* Archive */}
                    <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-5 flex flex-col gap-4">
                        <div className="flex items-start gap-3">
                            <AlertTriangle size={16} className="text-destructive mt-0.5 shrink-0" />
                            <div>
                                <h4 className="text-sm font-semibold text-foreground">{t("archiveTitle")}</h4>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {t("archiveDesc")}
                                </p>
                            </div>
                        </div>

                        {!showArchive ? (
                            <Button
                                onClick={() => setShowArchive(true)}
                                className="self-start border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20"
                            >
                                {t("archiveButton")}
                            </Button>
                        ) : (
                            <form onSubmit={handleArchive} className="flex flex-col gap-3">
                                <div>
                                    <label className="text-xs text-muted-foreground font-medium block mb-1">
                                        {t("archiveConfirmLabel", { name: workspace?.name })}
                                    </label>
                                    <input
                                        type="text"
                                        value={archiveConfirm}
                                        onChange={e => setArchiveConfirm(e.target.value)}
                                        className={inputCls}
                                        placeholder={workspace?.name}
                                    />
                                </div>
                                <ErrorMsg msg={archiveError} />
                                <div className="flex gap-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        onClick={() => { setShowArchive(false); setArchiveConfirm(""); setArchiveError(""); }}
                                    >
                                        {t("cancel")}
                                    </Button>
                                    <Button
                                        type="submit"
                                        isDisabled={archiving || archiveConfirm !== workspace?.name}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    >
                                        {archiving ? t("archiving") : t("archiveButton")}
                                    </Button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            ) : (
                <div className="rounded-lg border border-dashed border-border py-10 text-center">
                    <p className="text-sm text-muted-foreground">{t("ownerOnlyMessage")}</p>
                </div>
            )}
        </div>
    );
}
