"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import { ShieldCheck, Monitor } from "lucide-react";
import { Card } from "@heroui/react/card";
import { Button } from "@heroui/react/button";
import { Alert } from "@heroui/react/alert";
import { TextField } from "@heroui/react/textfield";
import { Input } from "@heroui/react/input";
import { Label } from "@heroui/react/label";
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

export default function AccountPage() {
    const t = useTranslations("settings");
    const tNav = useTranslations("nav");
    const tSecurity = useTranslations("accountSecurity");
    const tCommon = useTranslations("common");
    usePageTitle(tNav("account"));

    const [me, setMe] = useState(null);
    const [fname, setFname] = useState("");
    const [lname, setLname] = useState("");
    const [savingName, setSavingName] = useState(false);
    const [nameError, setNameError] = useState("");
    const [nameSuccess, setNameSuccess] = useState("");

    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [savingPw, setSavingPw] = useState(false);
    const [pwError, setPwError] = useState("");
    const [pwSuccess, setPwSuccess] = useState("");

    useEffect(() => {
        api.get("/api/auth/me").then(res => {
            setMe(res.data);
            setFname(res.data?.fname ?? "");
            setLname(res.data?.lname ?? "");
        });
    }, []);

    async function handleSaveName(e) {
        e.preventDefault();
        if (!fname.trim()) return;
        setNameError(""); setNameSuccess("");
        setSavingName(true);
        try {
            await api.patch("/api/auth/profile", { fname: fname.trim(), lname: lname.trim() });
            setNameSuccess(t("nameUpdated"));
        } catch (err) {
            setNameError(err.response?.data?.message || t("nameUpdateFailed"));
        } finally {
            setSavingName(false);
        }
    }

    async function handleChangePassword(e) {
        e.preventDefault();
        setPwError(""); setPwSuccess("");
        if (newPassword !== confirmPassword) { setPwError(t("passwordMismatch")); return; }
        if (newPassword.length < 8) { setPwError(t("passwordMinLength")); return; }
        setSavingPw(true);
        try {
            await api.patch("/api/auth/profile", { currentPassword, newPassword });
            setPwSuccess(t("passwordChanged"));
            setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
        } catch (err) {
            setPwError(err.response?.data?.message || t("passwordChangeFailed"));
        } finally {
            setSavingPw(false);
        }
    }

    return (
        <div className="flex flex-col gap-8">
            <SettingsPageHeader title={tNav("account")} description={t("accountPageSubtitle")} />

            <div className="flex flex-col gap-6">
                <Card>
                    <Card.Header>
                        <Card.Title>{t("personalInfo")}</Card.Title>
                    </Card.Header>
                    <Card.Content className="flex flex-col gap-4">
                        <div className="text-sm text-muted-foreground">
                            <span className="font-medium text-foreground">{t("emailLabel")}: </span>{me?.email}
                        </div>
                        <form id="profile-name-form" onSubmit={handleSaveName} className="flex flex-col gap-4">
                            <div className="flex gap-3">
                                <TextField variant="secondary" className="flex-1" isRequired value={fname} onChange={setFname}>
                                    <Label>{t("firstName")}</Label>
                                    <Input />
                                </TextField>
                                <TextField variant="secondary" className="flex-1" value={lname} onChange={setLname}>
                                    <Label>{t("lastName")}</Label>
                                    <Input />
                                </TextField>
                            </div>
                            <StatusAlert status="danger">{nameError}</StatusAlert>
                            <StatusAlert status="success">{nameSuccess}</StatusAlert>
                        </form>
                    </Card.Content>
                    <Card.Footer>
                        <Button
                            type="submit"
                            form="profile-name-form"
                            isDisabled={savingName || !fname.trim()}
                            variant="primary"
                        >
                            {savingName ? t("saving") : t("saveName")}
                        </Button>
                    </Card.Footer>
                </Card>

                <Card>
                    <Card.Header>
                        <Card.Title>{t("changePassword")}</Card.Title>
                    </Card.Header>
                    <Card.Content>
                        <form id="security-password-form" onSubmit={handleChangePassword} className="flex flex-col gap-4">
                            <TextField variant="secondary" fullWidth isRequired value={currentPassword} onChange={setCurrentPassword}>
                                <Label>{t("currentPassword")}</Label>
                                <Input type="password" autoComplete="current-password" />
                            </TextField>
                            <TextField variant="secondary" fullWidth isRequired value={newPassword} onChange={setNewPassword}>
                                <Label>{t("newPasswordLabel")}</Label>
                                <Input type="password" autoComplete="new-password" minLength={8} />
                            </TextField>
                            <TextField variant="secondary" fullWidth isRequired value={confirmPassword} onChange={setConfirmPassword}>
                                <Label>{t("confirmPassword")}</Label>
                                <Input type="password" autoComplete="new-password" />
                            </TextField>
                            <StatusAlert status="danger">{pwError}</StatusAlert>
                            <StatusAlert status="success">{pwSuccess}</StatusAlert>
                        </form>
                    </Card.Content>
                    <Card.Footer>
                        <Button
                            type="submit"
                            form="security-password-form"
                            isDisabled={savingPw || !currentPassword || !newPassword || !confirmPassword}
                            variant="primary"
                        >
                            {savingPw ? t("changingPassword") : t("changePassword")}
                        </Button>
                    </Card.Footer>
                </Card>

                <Card>
                    <Card.Header>
                        <Card.Title>{tSecurity("pageTitle")}</Card.Title>
                    </Card.Header>
                    <Card.Content className="flex flex-col">
                        <SettingsPlaceholderRow
                            icon={ShieldCheck}
                            label={tSecurity("twoFactorAuth")}
                            description={tSecurity("twoFactorAuthDesc")}
                            comingSoonLabel={tCommon("comingSoon")}
                        />
                        <SettingsPlaceholderRow
                            icon={Monitor}
                            label={tSecurity("activeSessions")}
                            description={tSecurity("activeSessionsDesc")}
                            comingSoonLabel={tCommon("comingSoon")}
                        />
                    </Card.Content>
                </Card>
            </div>
        </div>
    );
}
