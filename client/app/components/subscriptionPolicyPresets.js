import {
    KeyRound,
    Dumbbell,
    Salad,
    LineChart,
    ClipboardList,
    CalendarCheck,
    MessageSquare,
    Send,
    CalendarClock,
    Download,
} from "lucide-react";
import { PERMISSION_KEYS } from "@/app/components/SubscriptionPolicyFields";

export const PRESET_KEYS = ["locked", "read_only", "limited", "custom"];

export const PRESET_FLAGS = {
    locked: {
        keep_portal_access: false,
        view_training_plans: false,
        view_nutrition_plans: false,
        view_progress_history: false,
        view_assessments: false,
        view_checkins: false,
        allow_messaging: false,
        allow_submit_checkins: false,
        allow_booking_appointments: false,
        allow_download_files: false,
    },
    read_only: {
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
    },
    limited: {
        keep_portal_access: true,
        view_training_plans: true,
        view_nutrition_plans: true,
        view_progress_history: false,
        view_assessments: false,
        view_checkins: false,
        allow_messaging: true,
        allow_submit_checkins: false,
        allow_booking_appointments: false,
        allow_download_files: false,
    },
};

/**
 * Matches only the 10 permission flags (never grace_period_days) against each
 * named preset in a fixed order; 'custom' means nothing matched exactly.
 */
export function detectPreset(flags) {
    const namedPresets = PRESET_KEYS.filter(key => key !== "custom");
    for (const preset of namedPresets) {
        const shape = PRESET_FLAGS[preset];
        if (PERMISSION_KEYS.every(key => flags[key] === shape[key])) return preset;
    }
    return "custom";
}

/** Returns only the PERMISSION_KEYS-keyed booleans from a policy object (drops grace_period_days). */
export function pickPermissionFlags(policy) {
    return PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: policy[key] === true }), {});
}

/** Counts changed leaf fields across both scopes (10 + grace_period_days expired, 10 frozen). */
export function diffPolicies(a, b) {
    let changed = 0;
    for (const key of PERMISSION_KEYS) {
        if (a.expired[key] !== b.expired[key]) changed++;
        if (a.frozen[key] !== b.frozen[key]) changed++;
    }
    if (a.expired.grace_period_days !== b.expired.grace_period_days) changed++;
    return changed;
}

export const PERMISSION_GROUPS = [
    { key: "general", titleKey: "group.general", icon: KeyRound, permissionKeys: ["keep_portal_access"] },
    { key: "plans", titleKey: "group.plans", icon: Dumbbell, permissionKeys: ["view_training_plans", "view_nutrition_plans"] },
    { key: "progress", titleKey: "group.progress", icon: LineChart, permissionKeys: ["view_progress_history", "view_assessments", "view_checkins"] },
    { key: "communication", titleKey: "group.communication", icon: MessageSquare, permissionKeys: ["allow_messaging", "allow_submit_checkins"] },
    { key: "extras", titleKey: "group.extras", icon: Download, permissionKeys: ["allow_download_files", "allow_booking_appointments"] },
];

export const PERMISSION_ICONS = {
    keep_portal_access: KeyRound,
    view_training_plans: Dumbbell,
    view_nutrition_plans: Salad,
    view_progress_history: LineChart,
    view_assessments: ClipboardList,
    view_checkins: CalendarCheck,
    allow_messaging: MessageSquare,
    allow_submit_checkins: Send,
    allow_booking_appointments: CalendarClock,
    allow_download_files: Download,
};
