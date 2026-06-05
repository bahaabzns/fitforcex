"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import api from "@/lib/axios";
import { LogOut } from 'lucide-react';
import { useTranslations } from "next-intl";
import { ThemeToggle } from "@/app/components/ThemeToggle";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { Avatar } from "@heroui/react/avatar";
import { Button } from "@heroui/react/button";
import { Skeleton } from "@heroui/react/skeleton";
import { Modal } from "@heroui/react/modal";

export default function ClientProfilePage() {
    const t = useTranslations('portal.profile');
    const [client, setClient] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const router = useRouter();

    useEffect(() => {
        api.get("/api/client-portal/me")
            .then(res => { setClient(res.data); setLoading(false); })
            .catch(() => setLoading(false));
    }, []);

    const handleLogout = async () => {
        await api.post("/api/client-portal/logout").catch(() => {});
        router.push("/portal/login");
    };

    const getInitials = (c) => {
        if (!c) return "?";
        return `${c.fname?.[0] ?? ""}${c.lname?.[0] ?? ""}`.toUpperCase();
    };

    return (
        <div className="max-w-lg mx-auto p-6 flex flex-col gap-5">

            {/* Profile identity */}
            <div className="flex flex-col items-center gap-3 py-6">
                {loading ? (
                    <>
                        <Skeleton className="w-20 h-20 rounded-full" />
                        <Skeleton className="h-5 w-36 rounded-md" />
                        <Skeleton className="h-4 w-24 rounded-md" />
                    </>
                ) : (
                    <>
                        <Avatar color="primary" className="w-20 h-20 text-2xl">
                            <Avatar.Fallback>{getInitials(client)}</Avatar.Fallback>
                        </Avatar>
                        <div className="flex flex-col items-center gap-0.5">
                            <h1 className="text-xl font-bold text-foreground">
                                {client?.fname} {client?.lname}
                            </h1>
                            {client?.email && (
                                <p className="text-sm text-muted-foreground">{client.email}</p>
                            )}
                            {client?.client_code && (
                                <p className="text-xs text-muted-foreground mt-0.5">#{client.client_code}</p>
                            )}
                        </div>
                    </>
                )}
            </div>

            {/* Preferences */}
            <div className="flex flex-col gap-0.5">
                <p className="px-1 pb-1 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    {t('preferences')}
                </p>

                {/* Appearance row */}
                <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-secondary">
                    <span className="text-sm font-medium text-foreground">{t('appearance')}</span>
                    <ThemeToggle />
                </div>

                {/* Language row */}
                <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-secondary">
                    <span className="text-sm font-medium text-foreground">{t('language')}</span>
                    <LanguageSwitcher />
                </div>
            </div>

            {/* Logout */}
            <Button
                variant="danger-soft"
                size="md"
                fullWidth
                onClick={() => setShowLogoutConfirm(true)}
                className="mt-2"
            >
                <LogOut size={16} className="shrink-0" />
                {t('logout')}
            </Button>

            {/* Logout confirmation */}
            <Modal isOpen={showLogoutConfirm} onOpenChange={(o) => !o && setShowLogoutConfirm(false)}>
                <Modal.Backdrop>
                    <Modal.Container className="max-w-sm">
                        <Modal.Dialog>
                            <Modal.Header>
                                <Modal.Heading>{t('logoutConfirmTitle')}</Modal.Heading>
                                <Modal.CloseTrigger />
                            </Modal.Header>
                            <Modal.Body>
                                <p className="text-sm text-muted-foreground">{t('logoutConfirmMessage')}</p>
                            </Modal.Body>
                            <Modal.Footer className="flex justify-end gap-2 pt-2">
                                <Button size="sm" variant="ghost" onClick={() => setShowLogoutConfirm(false)}>
                                    {t('cancel')}
                                </Button>
                                <Button size="sm" variant="danger" onClick={handleLogout}>
                                    {t('logout')}
                                </Button>
                            </Modal.Footer>
                        </Modal.Dialog>
                    </Modal.Container>
                </Modal.Backdrop>
            </Modal>
        </div>
    );
}
