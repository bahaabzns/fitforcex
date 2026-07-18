"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import { Card } from "@heroui/react/card";
import { Button } from "@heroui/react/button";
import { Alert } from "@heroui/react/alert";
import { Tabs } from "@heroui/react/tabs";
import { defaultPolicy } from "@/app/components/SubscriptionPolicyFields";
import { diffPolicies } from "@/app/components/subscriptionPolicyPresets";
import SubscriptionPolicyEditor from "@/app/components/SubscriptionPolicyEditor";
import SettingsPageHeader from "../_components/SettingsPageHeader";
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

export default function ClientExperiencePage() {
    const tNav = useTranslations("nav");
    const tPolicy = useTranslations("subscriptionPolicies");
    const tCommon = useTranslations("common");
    usePageTitle(tNav("clientExperience"));
    const [me, setMe] = useState(null);

    const [expiredPolicy, setExpiredPolicy] = useState(defaultPolicy("expired"));
    const [frozenPolicy, setFrozenPolicy] = useState(defaultPolicy("frozen"));
    const [originalPolicies, setOriginalPolicies] = useState({ expired: defaultPolicy("expired"), frozen: defaultPolicy("frozen") });
    const [policiesVersion, setPoliciesVersion] = useState(0);
    const [activePolicyTab, setActivePolicyTab] = useState("expired");
    const [copiedPolicy, setCopiedPolicy] = useState(null);
    const [copiedFromScope, setCopiedFromScope] = useState(null);
    const [policySaving, setPolicySaving] = useState(false);
    const [policyError, setPolicyError] = useState("");
    const [policySuccess, setPolicySuccess] = useState("");

    useEffect(() => {
        api.get("/api/auth/me").then(res => setMe(res.data));

        api.get("/api/subscription-policies")
            .then(res => {
                const expired = { ...defaultPolicy("expired"), ...(res.data?.expired ?? {}) };
                const frozen = { ...defaultPolicy("frozen"), ...(res.data?.frozen ?? {}) };
                setExpiredPolicy(expired);
                setFrozenPolicy(frozen);
                setOriginalPolicies({ expired, frozen });
                setPoliciesVersion(v => v + 1);
            })
            .catch(() => { });
    }, []);

    const isOwner = me?.currentWorkspace?.role === "owner";

    const modifiedCount = diffPolicies(originalPolicies, { expired: expiredPolicy, frozen: frozenPolicy });
    const isPolicyDirty = modifiedCount > 0;

    async function handleSavePolicies() {
        setPolicyError(""); setPolicySuccess("");
        setPolicySaving(true);
        try {
            const res = await api.put("/api/subscription-policies", { expired: expiredPolicy, frozen: frozenPolicy });
            const expired = { ...defaultPolicy("expired"), ...res.data.expired };
            const frozen = { ...defaultPolicy("frozen"), ...res.data.frozen };
            setExpiredPolicy(expired);
            setFrozenPolicy(frozen);
            setOriginalPolicies({ expired, frozen });
            setPoliciesVersion(v => v + 1);
            setPolicySuccess(tPolicy("saveSuccess"));
        } catch (err) {
            setPolicyError(err.response?.data?.error || tPolicy("saveFailed"));
        } finally {
            setPolicySaving(false);
        }
    }

    function handleDiscardPolicies() {
        setExpiredPolicy(originalPolicies.expired);
        setFrozenPolicy(originalPolicies.frozen);
        setPolicyError(""); setPolicySuccess("");
        setPoliciesVersion(v => v + 1);
    }

    function updateExpiredPolicy(next) {
        setExpiredPolicy(next);
        setPolicySuccess("");
    }

    function updateFrozenPolicy(next) {
        setFrozenPolicy(next);
        setPolicySuccess("");
    }

    function handleCopyPolicy(scope, flags) {
        setCopiedPolicy(flags);
        setCopiedFromScope(scope);
    }

    function handlePastePolicy(scope) {
        if (!copiedPolicy) return;
        if (scope === "expired") updateExpiredPolicy(prev => ({ ...prev, ...copiedPolicy }));
        else updateFrozenPolicy(prev => ({ ...prev, ...copiedPolicy }));
    }

    return (
        <div className="flex flex-col gap-8">
            <SettingsPageHeader title={tNav("clientExperience")} description={tPolicy("pageSubtitle")} />

            <div className="flex flex-col gap-6">
                {isOwner ? (
                    <Card>
                        <Card.Header>
                            <Card.Title>{tPolicy("pageTitle")}</Card.Title>
                        </Card.Header>
                        <Card.Content>
                            <Tabs selectedKey={activePolicyTab} onSelectionChange={setActivePolicyTab}>
                                <Tabs.ListContainer>
                                    <Tabs.List aria-label={tPolicy("pageTitle")}>
                                        <Tabs.Tab id="expired">
                                            {tPolicy("tabExpired")}
                                            <Tabs.Indicator />
                                        </Tabs.Tab>
                                        <Tabs.Tab id="frozen">
                                            {tPolicy("tabFrozen")}
                                            <Tabs.Indicator />
                                        </Tabs.Tab>
                                    </Tabs.List>
                                </Tabs.ListContainer>

                                <Tabs.Panel id="expired" className="pt-4">
                                    <p className="text-xs text-muted-foreground mb-3">{tPolicy("expiredDesc")}</p>
                                    <SubscriptionPolicyEditor
                                        key={`expired-${policiesVersion}`}
                                        scope="expired"
                                        value={expiredPolicy}
                                        onChange={updateExpiredPolicy}
                                        onCopy={handleCopyPolicy}
                                        onPaste={() => handlePastePolicy("expired")}
                                        canPaste={copiedPolicy !== null && copiedFromScope !== "expired"}
                                        copiedFromLabel={copiedFromScope === "frozen" ? tPolicy("tabFrozen") : tPolicy("tabExpired")}
                                    />
                                </Tabs.Panel>

                                <Tabs.Panel id="frozen" className="pt-4">
                                    <p className="text-xs text-muted-foreground mb-3">{tPolicy("frozenDesc")}</p>
                                    <SubscriptionPolicyEditor
                                        key={`frozen-${policiesVersion}`}
                                        scope="frozen"
                                        value={frozenPolicy}
                                        onChange={updateFrozenPolicy}
                                        onCopy={handleCopyPolicy}
                                        onPaste={() => handlePastePolicy("frozen")}
                                        canPaste={copiedPolicy !== null && copiedFromScope !== "frozen"}
                                        copiedFromLabel={copiedFromScope === "expired" ? tPolicy("tabExpired") : tPolicy("tabFrozen")}
                                    />
                                </Tabs.Panel>
                            </Tabs>
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

            {isPolicyDirty && isOwner && (
                <div className="sticky bottom-4 z-10 self-center w-full max-w-2xl">
                    <Card className="flex-row items-center justify-between gap-4 px-4 py-3 shadow-lg border border-border bg-card">
                        <span className="text-sm text-foreground">
                            {tPolicy("stickyBar.modifiedCount", { count: modifiedCount })}
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                            <Button size="sm" variant="ghost" isDisabled={policySaving} onClick={handleDiscardPolicies}>
                                {tPolicy("stickyBar.discard")}
                            </Button>
                            <Button size="sm" variant="primary" isDisabled={policySaving} onClick={handleSavePolicies}>
                                {policySaving ? tPolicy("saving") : tPolicy("stickyBar.save")}
                            </Button>
                        </div>
                    </Card>
                    <StatusAlert status="danger">{policyError}</StatusAlert>
                </div>
            )}
        </div>
    );
}
