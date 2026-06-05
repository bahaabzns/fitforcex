"use client";

import { useEffect, useState } from "react";
import api from "@/lib/axios";
import { useTranslations } from "next-intl";
import { CheckCircle2 } from 'lucide-react';
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

export default function ProfilePage() {
    const t = useTranslations('settings');
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
            setNameSuccess(t('nameUpdated'));
        } catch (err) {
            setNameError(err.response?.data?.message || t('nameUpdateFailed'));
        } finally {
            setSavingName(false);
        }
    }

    async function handleChangePassword(e) {
        e.preventDefault();
        setPwError(""); setPwSuccess("");
        if (newPassword !== confirmPassword) { setPwError(t('passwordMismatch')); return; }
        if (newPassword.length < 8) { setPwError(t('passwordMinLength')); return; }
        setSavingPw(true);
        try {
            await api.patch("/api/auth/profile", { currentPassword, newPassword });
            setPwSuccess(t('passwordChanged'));
            setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
        } catch (err) {
            setPwError(err.response?.data?.message || t('passwordChangeFailed'));
        } finally {
            setSavingPw(false);
        }
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">{t('profile')}</h1>
                <p className="text-sm text-muted-foreground mt-1">{t('manageInfo')}</p>
            </div>

            {/* Name */}
            <div className="rounded-lg border border-border p-5 flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-foreground">{t('personalInfo')}</h3>
                <div className="text-sm text-muted-foreground">
                    <span className="font-medium text-foreground">{t('emailLabel')}: </span>{me?.email}
                </div>
                <form onSubmit={handleSaveName} className="flex flex-col gap-3">
                    <div className="flex gap-3">
                        <div className="flex-1">
                            <label className="text-xs text-muted-foreground font-medium block mb-1">{t('firstName')}</label>
                            <input
                                type="text"
                                value={fname}
                                onChange={e => setFname(e.target.value)}
                                className={inputCls}
                                required
                            />
                        </div>
                        <div className="flex-1">
                            <label className="text-xs text-muted-foreground font-medium block mb-1">{t('lastName')}</label>
                            <input
                                type="text"
                                value={lname}
                                onChange={e => setLname(e.target.value)}
                                className={inputCls}
                            />
                        </div>
                    </div>
                    <ErrorMsg msg={nameError} />
                    <SuccessMsg msg={nameSuccess} />
                    <Button
                        type="submit"
                        isDisabled={savingName || !fname.trim()}
                        variant="primary"
                        className="self-start"
                    >
                        {savingName ? t('saving') : t('saveName')}
                    </Button>
                </form>
            </div>

            {/* Password */}
            <div className="rounded-lg border border-border p-5 flex flex-col gap-4">
                <h3 className="text-sm font-semibold text-foreground">{t('changePassword')}</h3>
                <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
                    <div>
                        <label className="text-xs text-muted-foreground font-medium block mb-1">{t('currentPassword')}</label>
                        <input
                            type="password"
                            value={currentPassword}
                            onChange={e => setCurrentPassword(e.target.value)}
                            className={inputCls}
                            autoComplete="current-password"
                            required
                        />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground font-medium block mb-1">{t('newPasswordLabel')}</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={e => setNewPassword(e.target.value)}
                            className={inputCls}
                            autoComplete="new-password"
                            required
                            minLength={8}
                        />
                    </div>
                    <div>
                        <label className="text-xs text-muted-foreground font-medium block mb-1">{t('confirmPassword')}</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={e => setConfirmPassword(e.target.value)}
                            className={inputCls}
                            autoComplete="new-password"
                            required
                        />
                    </div>
                    <ErrorMsg msg={pwError} />
                    <SuccessMsg msg={pwSuccess} />
                    <Button
                        type="submit"
                        isDisabled={savingPw || !currentPassword || !newPassword || !confirmPassword}
                        variant="primary"
                        className="self-start"
                    >
                        {savingPw ? t('changingPassword') : t('changePassword')}
                    </Button>
                </form>
            </div>
        </div>
    );
}
