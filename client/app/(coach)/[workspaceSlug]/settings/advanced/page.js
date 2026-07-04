"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import { useRouter } from "next/navigation";
import { Card } from "@heroui/react/card";
import { Button } from "@heroui/react/button";
import { Alert } from "@heroui/react/alert";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { Label } from "@heroui/react/label";
import { Select } from "@heroui/react/select";
import { ListBox } from "@heroui/react/list-box";
import SettingsPageHeader from "../_components/SettingsPageHeader";

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

export default function AdvancedPage() {
    const t = useTranslations("workspaceSettings");
    const tNav = useTranslations("nav");
    const tDanger = useTranslations("dangerZone");
    const tCommon = useTranslations("common");
    const router = useRouter();
    const [me, setMe] = useState(null);
    const [workspace, setWorkspace] = useState(null);
    const [members, setMembers] = useState([]);

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
        api.get("/api/auth/me").then(meRes => {
            setMe(meRes.data);
            const wsId = meRes.data.currentWorkspace?.id;
            if (!wsId) return;
            Promise.all([
                api.get(`/api/workspaces/${wsId}`),
                api.get(`/api/workspaces/${wsId}/members`).catch(() => ({ data: [] })),
            ]).then(([wsRes, membersRes]) => {
                setWorkspace(wsRes.data);
                setMembers(membersRes.data);
            });
        });
    }, []);

    const isOwner = me?.currentWorkspace?.role === "owner";
    const wsId = me?.currentWorkspace?.id;
    const activeMembers = members.filter(m => m.is_active);

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

    return (
        <div className="flex flex-col gap-8">
            <SettingsPageHeader title={tNav("advanced")} description={tDanger("pageSubtitle")} />

            <div className="flex flex-col gap-6">
                {isOwner ? (
                    <Card>
                        <Card.Content className="flex flex-col gap-3">
                            {/* Transfer Ownership */}
                            <Alert status="warning">
                                <Alert.Indicator />
                                <Alert.Content className="w-full">
                                    <div className="flex items-center justify-between gap-3 w-full flex-wrap">
                                        <Alert.Title>{t("transferTitle")}</Alert.Title>
                                        {!showTransfer && (
                                            <Button
                                                size="sm"
                                                variant="secondary"
                                                onClick={() => setShowTransfer(true)}
                                                isDisabled={activeMembers.length === 0}
                                                className="shrink-0"
                                            >
                                                {t("transferButton")}
                                            </Button>
                                        )}
                                    </div>
                                    <Alert.Description>{t("transferDesc")}</Alert.Description>

                                    {showTransfer && (
                                        <form onSubmit={handleTransfer} className="flex flex-col gap-3 w-full mt-2">
                                            {activeMembers.length === 0 ? (
                                                <p className="text-sm text-muted-foreground">{t("noActiveMembers")}</p>
                                            ) : (
                                                <>
                                                    <div className="flex flex-col gap-1.5">
                                                        <Label>{t("transferToLabel")}</Label>
                                                        <Select
                                                            variant="secondary"
                                                            fullWidth
                                                            placeholder={t("selectMember")}
                                                            value={transferMemberId}
                                                            onChange={setTransferMemberId}
                                                        >
                                                            <Select.Trigger>
                                                                <Select.Value />
                                                                <Select.Indicator />
                                                            </Select.Trigger>
                                                            <Select.Popover>
                                                                <ListBox>
                                                                    {activeMembers.map(m => (
                                                                        <ListBox.Item key={m.id} id={String(m.id)} textValue={`${m.fname} ${m.lname} (${m.email})`}>
                                                                            {m.fname} {m.lname} ({m.email})
                                                                            <ListBox.ItemIndicator />
                                                                        </ListBox.Item>
                                                                    ))}
                                                                </ListBox>
                                                            </Select.Popover>
                                                        </Select>
                                                    </div>
                                                    <TextField fullWidth isRequired value={transferPassword} onChange={setTransferPassword}>
                                                        <Label>{t("confirmPasswordLabel")}</Label>
                                                        <Input type="password" autoComplete="current-password" />
                                                    </TextField>
                                                    <StatusAlert status="danger">{transferError}</StatusAlert>
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
                                                            variant="secondary"
                                                            isDisabled={transferring || !transferMemberId || !transferPassword}
                                                        >
                                                            {transferring ? t("transferring") : t("confirmTransfer")}
                                                        </Button>
                                                    </div>
                                                </>
                                            )}
                                        </form>
                                    )}
                                </Alert.Content>
                            </Alert>

                            {/* Archive */}
                            <Alert status="danger">
                                <Alert.Indicator />
                                <Alert.Content className="w-full">
                                    <div className="flex items-center justify-between gap-3 w-full flex-wrap">
                                        <Alert.Title>{t("archiveTitle")}</Alert.Title>
                                        {!showArchive && (
                                            <Button
                                                size="sm"
                                                variant="danger"
                                                onClick={() => setShowArchive(true)}
                                                className="shrink-0"
                                            >
                                                {t("archiveButton")}
                                            </Button>
                                        )}
                                    </div>
                                    <Alert.Description>{t("archiveDesc")}</Alert.Description>

                                    {showArchive && (
                                        <form onSubmit={handleArchive} className="flex flex-col gap-3 w-full mt-2">
                                            <TextField fullWidth value={archiveConfirm} onChange={setArchiveConfirm}>
                                                <Label>{t("archiveConfirmLabel", { name: workspace?.name })}</Label>
                                                <Input placeholder={workspace?.name} />
                                            </TextField>
                                            <StatusAlert status="danger">{archiveError}</StatusAlert>
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
                                                    variant="danger"
                                                    isDisabled={archiving || archiveConfirm !== workspace?.name}
                                                >
                                                    {archiving ? t("archiving") : t("archiveButton")}
                                                </Button>
                                            </div>
                                        </form>
                                    )}
                                </Alert.Content>
                            </Alert>
                        </Card.Content>
                    </Card>
                ) : (
                    <Card>
                        <Card.Content className="items-center text-center py-10">
                            <p className="text-sm text-muted-foreground">{tCommon("ownerOnlyMessage")}</p>
                        </Card.Content>
                    </Card>
                )}
            </div>
        </div>
    );
}
