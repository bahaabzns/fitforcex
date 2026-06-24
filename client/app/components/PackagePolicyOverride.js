"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import api from "@/lib/axios";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@heroui/react/button";
import { Switch } from "@heroui/react/switch";
import SubscriptionPolicyFields, { defaultPolicy } from "@/app/components/SubscriptionPolicyFields";

/**
 * Per-package subscription-policy override editor. A scope toggled "Custom"
 * sends its policy object; toggled off sends null (the package reverts to the
 * workspace global for that scope). Loads and saves independently of the
 * package-name form.
 */
export default function PackagePolicyOverride({ packageId }) {
    const t = useTranslations("subscriptionPolicies");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState("");
    const [error, setError] = useState("");

    const [expiredOn, setExpiredOn] = useState(false);
    const [frozenOn, setFrozenOn] = useState(false);
    const [expired, setExpired] = useState(defaultPolicy("expired"));
    const [frozen, setFrozen] = useState(defaultPolicy("frozen"));

    // The component remounts per package (editingPackage drives mount/unmount),
    // so initial state already handles the loading/reset — the effect only fetches.
    useEffect(() => {
        if (!packageId) return;
        let active = true;
        api.get(`/api/subscription-policies/packages/${packageId}`)
            .then(res => {
                if (!active) return;
                setExpiredOn(!!res.data?.expired);
                setFrozenOn(!!res.data?.frozen);
                if (res.data?.expired) setExpired({ ...defaultPolicy("expired"), ...res.data.expired });
                if (res.data?.frozen) setFrozen({ ...defaultPolicy("frozen"), ...res.data.frozen });
                setLoading(false);
            })
            .catch(err => {
                if (!active) return;
                setError(err.response?.data?.error || t("saveFailed"));
                setLoading(false);
            });
        return () => { active = false; };
    }, [packageId, t]);

    async function handleSave() {
        setSaving(true);
        setSuccess(""); setError("");
        try {
            await api.put(`/api/subscription-policies/packages/${packageId}`, {
                expired: expiredOn ? expired : null,
                frozen:  frozenOn ? frozen : null,
            });
            setSuccess(t("saveSuccess"));
        } catch (err) {
            setError(err.response?.data?.error || t("saveFailed"));
        } finally {
            setSaving(false);
        }
    }

    if (loading) {
        return <div className="h-16 rounded-lg border border-dashed border-border animate-pulse" />;
    }

    const scopeRow = (scope, on, setOn, value, setValue, overrideLabel) => (
        <div className="rounded-lg border border-border p-3 flex flex-col gap-3">
            <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-medium text-foreground">{overrideLabel}</span>
                <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">{on ? t("custom") : t("useGlobal")}</span>
                    <Switch isSelected={on} onChange={setOn}>
                        <Switch.Control><Switch.Thumb /></Switch.Control>
                    </Switch>
                </div>
            </div>
            {on && <SubscriptionPolicyFields scope={scope} value={value} onChange={setValue} />}
        </div>
    );

    return (
        <div className="flex flex-col gap-3 pt-4 mt-2 border-t border-border">
            <div>
                <h4 className="text-sm font-semibold text-foreground">{t("overridesTitle")}</h4>
                <p className="text-xs text-muted-foreground">{t("overridesHelp")}</p>
            </div>

            {scopeRow("expired", expiredOn, setExpiredOn, expired, setExpired, t("expiredOverride"))}
            {scopeRow("frozen", frozenOn, setFrozenOn, frozen, setFrozen, t("frozenOverride"))}

            {error && <p className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">{error}</p>}
            {success && (
                <p className="flex items-center gap-2 text-sm text-green-600 bg-green-500/10 border border-green-500/20 rounded-lg px-3 py-2">
                    <CheckCircle2 size={14} className="shrink-0" /> {success}
                </p>
            )}

            <Button type="button" onClick={handleSave} isDisabled={saving} variant="primary" className="self-start">
                {saving ? t("saving") : t("save")}
            </Button>
        </div>
    );
}
