"use client";

import { useTranslations } from "next-intl";
import { Switch } from "@heroui/react/switch";

// The 10 access flags, in display order. Must match the backend PERMISSION_KEYS.
export const PERMISSION_KEYS = [
    "keep_portal_access",
    "view_training_plans",
    "view_nutrition_plans",
    "view_progress_history",
    "view_assessments",
    "view_checkins",
    "allow_messaging",
    "allow_submit_checkins",
    "allow_booking_appointments",
    "allow_download_files",
];

// Forward-looking permissions stored but not yet enforced (no subsystem exists).
const COMING_SOON = new Set(["allow_booking_appointments", "allow_download_files"]);

const READ_ONLY_DEFAULT = {
    keep_portal_access: true,
    view_training_plans: true,
    view_nutrition_plans: true,
    view_progress_history: true,
    view_assessments: true,
    view_checkins: true,
    allow_messaging: false,
    allow_submit_checkins: false,
    allow_booking_appointments: false,
    allow_download_files: false,
};

export function defaultPolicy(scope) {
    return scope === "expired" ? { ...READ_ONLY_DEFAULT, grace_period_days: 0 } : { ...READ_ONLY_DEFAULT };
}

const inputCls = "w-32 px-3 py-2 rounded-md border border-input bg-background text-foreground text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition-colors";

/**
 * Controlled set of subscription-policy toggles. `value` is a policy object
 * (10 booleans, plus grace_period_days when scope === "expired"); `onChange`
 * receives the next policy object.
 */
export default function SubscriptionPolicyFields({ scope, value, onChange, disabled = false }) {
    const t = useTranslations("subscriptionPolicies");

    const setFlag = (key, next) => onChange({ ...value, [key]: next });

    return (
        <div className="flex flex-col gap-1">
            {scope === "expired" && (
                <div className="flex flex-col gap-1 pb-3 mb-1 border-b border-border">
                    <label className="text-xs text-muted-foreground font-medium">{t("gracePeriodLabel")}</label>
                    <input
                        type="number"
                        min={0}
                        max={3650}
                        value={value.grace_period_days ?? 0}
                        onChange={e => onChange({ ...value, grace_period_days: Math.max(0, parseInt(e.target.value) || 0) })}
                        className={inputCls}
                        disabled={disabled}
                    />
                    <p className="text-xs text-muted-foreground">{t("gracePeriodHelp")}</p>
                </div>
            )}

            {PERMISSION_KEYS.map(key => (
                <div key={key} className="flex items-start justify-between gap-4 py-2">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground flex items-center gap-2">
                            {t(`label.${key}`)}
                            {COMING_SOON.has(key) && (
                                <span className="text-[10px] uppercase tracking-wide text-muted-foreground border border-border rounded px-1.5 py-0.5">
                                    {t("comingSoon")}
                                </span>
                            )}
                        </span>
                        <span className="text-xs text-muted-foreground">{t(`help.${key}`)}</span>
                    </div>
                    <Switch
                        isSelected={value[key] === true}
                        onChange={next => setFlag(key, next)}
                        isDisabled={disabled}
                        className="shrink-0 mt-0.5"
                    >
                        <Switch.Control>
                            <Switch.Thumb />
                        </Switch.Control>
                    </Switch>
                </div>
            ))}
        </div>
    );
}
