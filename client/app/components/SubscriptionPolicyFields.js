"use client";

import { useTranslations } from "next-intl";
import { Switch } from "@heroui/react/switch";
import { NumberField } from "@heroui/react/number-field";
import { Label } from "@heroui/react/label";
import { Chip } from "@heroui/react/chip";
import { Separator } from "@heroui/react/separator";

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
export const COMING_SOON = new Set(["allow_booking_appointments", "allow_download_files"]);

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

/**
 * Controlled set of subscription-policy toggles. `value` is a policy object
 * (10 booleans, plus grace_period_days when scope === "expired"); `onChange`
 * receives the next policy object.
 */
export default function SubscriptionPolicyFields({ scope, value, onChange, disabled = false }) {
    const t = useTranslations("subscriptionPolicies");

    const setFlag = (key, next) => onChange({ ...value, [key]: next });
    const showGrace = scope === "expired";

    return (
        <div className="flex flex-col">
            {showGrace && (
                <div className="flex flex-col gap-1.5 pb-4">
                    <Label>{t("gracePeriodLabel")}</Label>
                    <NumberField
                        value={value.grace_period_days ?? 0}
                        onChange={(next) => onChange({ ...value, grace_period_days: Math.max(0, next || 0) })}
                        minValue={0}
                        maxValue={3650}
                        isDisabled={disabled}
                        aria-label={t("gracePeriodLabel")}
                    >
                        <NumberField.Group className="w-36">
                            <NumberField.DecrementButton />
                            <NumberField.Input />
                            <NumberField.IncrementButton />
                        </NumberField.Group>
                    </NumberField>
                    <p className="text-xs text-muted-foreground">{t("gracePeriodHelp")}</p>
                </div>
            )}

            {PERMISSION_KEYS.map((key, index) => (
                <div key={key}>
                    {(showGrace || index > 0) && <Separator />}
                    <div className="flex items-center justify-between gap-4 py-3">
                        <div className="flex flex-col gap-0.5">
                            <span className="text-sm font-medium text-foreground flex items-center gap-2">
                                {t(`label.${key}`)}
                                {COMING_SOON.has(key) && (
                                    <Chip size="sm" color="warning" variant="soft">
                                        {t("comingSoon")}
                                    </Chip>
                                )}
                            </span>
                            <span className="text-xs text-muted-foreground">{t(`help.${key}`)}</span>
                        </div>
                        <Switch
                            isSelected={value[key] === true}
                            onChange={next => setFlag(key, next)}
                            isDisabled={disabled}
                            className="shrink-0"
                        >
                            <Switch.Control>
                                <Switch.Thumb />
                            </Switch.Control>
                        </Switch>
                    </div>
                </div>
            ))}
        </div>
    );
}
