"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@heroui/react/button";
import SubscriptionPolicyFields, { defaultPolicy } from "@/app/components/SubscriptionPolicyFields";

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

export default function SubscriptionPoliciesPage() {
    const t = useTranslations("subscriptionPolicies");
    const [expired, setExpired] = useState(defaultPolicy("expired"));
    const [frozen, setFrozen] = useState(defaultPolicy("frozen"));
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        api.get("/api/subscription-policies")
            .then(res => {
                if (res.data?.expired) setExpired({ ...defaultPolicy("expired"), ...res.data.expired });
                if (res.data?.frozen) setFrozen({ ...defaultPolicy("frozen"), ...res.data.frozen });
            })
            .catch(err => setError(err.response?.data?.error || t("saveFailed")))
            .finally(() => setLoading(false));
    }, [t]);

    async function handleSave() {
        setError(""); setSuccess("");
        setSaving(true);
        try {
            const res = await api.put("/api/subscription-policies", { expired, frozen });
            setExpired({ ...defaultPolicy("expired"), ...res.data.expired });
            setFrozen({ ...defaultPolicy("frozen"), ...res.data.frozen });
            setSuccess(t("saveSuccess"));
        } catch (err) {
            setError(err.response?.data?.error || t("saveFailed"));
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <div className="h-40 rounded-lg border border-dashed border-border animate-pulse" />;
    }

    return (
        <div className="flex flex-col gap-6">
            <div>
                <h1 className="text-3xl font-bold text-foreground">{t("pageTitle")}</h1>
                <p className="text-sm text-muted-foreground mt-1">{t("pageSubtitle")}</p>
            </div>

            <div className="rounded-lg border border-border p-5 flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-foreground">{t("expiredTitle")}</h3>
                <p className="text-xs text-muted-foreground mb-2">{t("expiredDesc")}</p>
                <SubscriptionPolicyFields scope="expired" value={expired} onChange={setExpired} />
            </div>

            <div className="rounded-lg border border-border p-5 flex flex-col gap-2">
                <h3 className="text-sm font-semibold text-foreground">{t("frozenTitle")}</h3>
                <p className="text-xs text-muted-foreground mb-2">{t("frozenDesc")}</p>
                <SubscriptionPolicyFields scope="frozen" value={frozen} onChange={setFrozen} />
            </div>

            <ErrorMsg msg={error} />
            <SuccessMsg msg={success} />

            <Button onClick={handleSave} isDisabled={saving} variant="primary" className="self-start">
                {saving ? t("saving") : t("save")}
            </Button>
        </div>
    );
}
