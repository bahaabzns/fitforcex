"use client";

import { use, useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import { Skeleton } from "@heroui/react/skeleton";
import { Tabs } from "@heroui/react/tabs";
import { Separator } from "@heroui/react/separator";
import SettingsPageHeader from "./_components/SettingsPageHeader";

const TAB_KEYS = ["account", "workspace", "subscription", "client-experience", "pdf", "advanced"];

export default function SettingsLayout({ children, params }) {
    const router = useRouter();
    const pathname = usePathname();
    const tNav = useTranslations("nav");
    const tSettings = useTranslations("settings");
    const [me, setMe] = useState(null);
    const [workspace, setWorkspace] = useState(null);
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);

    const workspaceSlug = use(params).workspaceSlug;

    const load = useCallback(async () => {
        try {
            const meRes = await api.get("/api/auth/me");
            setMe(meRes.data);
            const wsId = meRes.data.currentWorkspace?.id;
            if (!wsId) return;
            const [wsRes, membersRes] = await Promise.all([
                api.get(`/api/workspaces/${wsId}`),
                api.get(`/api/workspaces/${wsId}/members`).catch(() => ({ data: [] })),
            ]);
            setWorkspace(wsRes.data);
            setMembers(membersRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const isOwner = me?.currentWorkspace?.role === "owner";
    const canManagePdfExport = isOwner || me?.currentWorkspace?.permissions?.pdfExport?.write === true;

    if (loading) {
        return (
            <div className="p-8 max-w-full flex flex-col gap-6">
                <Skeleton className="h-9 w-28 rounded-lg mb-6" />
                <div className="flex gap-2 mb-6">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-9 w-24 rounded" />)}
                </div>
                <div className="flex flex-col gap-3">
                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
                </div>
            </div>
        );
    }

    const activeKeyMatch = pathname.match(/\/settings\/([^/]+)/);
    const activeKey = TAB_KEYS.includes(activeKeyMatch?.[1]) ? activeKeyMatch[1] : "account";

    function handleSelectionChange(key) {
        router.push(`/${workspaceSlug}/settings/${key}`);
    }

    return (
        <div className="p-8 max-w-full flex flex-col gap-8">
            <SettingsPageHeader title={tSettings("pageTitle")} description={tSettings("pageDescription")} />

            <Separator className="bg-border" />

            <div className="flex gap-8 items-start">
                <div className="w-55 shrink-0">
                    <Tabs orientation="vertical" variant="secondary" selectedKey={activeKey} onSelectionChange={handleSelectionChange}>
                        <Tabs.ListContainer>
                            <Tabs.List aria-label={tSettings("pageTitle")}>
                                <Tabs.Tab id="account">
                                    {tNav("account")}
                                    <Tabs.Indicator />
                                </Tabs.Tab>
                                <Tabs.Tab id="workspace">
                                    {tNav("workspace")}
                                    <Tabs.Indicator />
                                </Tabs.Tab>
                                {isOwner && (
                                    <Tabs.Tab id="subscription">
                                        {tNav("subscription")}
                                        <Tabs.Indicator />
                                    </Tabs.Tab>
                                )}
                                <Tabs.Tab id="client-experience">
                                    {tNav("clientExperience")}
                                    <Tabs.Indicator />
                                </Tabs.Tab>
                                {canManagePdfExport && (
                                    <Tabs.Tab id="pdf">
                                        {tNav("pdfExport")}
                                        <Tabs.Indicator />
                                    </Tabs.Tab>
                                )}
                                {isOwner && (
                                    <Tabs.Tab id="advanced">
                                        {tNav("advanced")}
                                        <Tabs.Indicator />
                                    </Tabs.Tab>
                                )}
                            </Tabs.List>
                        </Tabs.ListContainer>
                    </Tabs>
                </div>

                <div className="flex-1 min-w-0">
                    {children}
                </div>
            </div>
        </div>
    );
}
