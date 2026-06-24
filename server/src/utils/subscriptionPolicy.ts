import type { SubscriptionStatus } from './subscriptionStatus';

/**
 * Subscription Access Policy — what a client may still see/do once their
 * subscription is no longer active. Two scopes: 'expired' and 'frozen'.
 * Each scope carries the same 10 permission flags; the expired scope also
 * carries a grace period. See migration 024 / model subscription_access_policies.
 */

export const POLICY_SCOPES = ['expired', 'frozen'] as const;
export type PolicyScope = (typeof POLICY_SCOPES)[number];

/** The 10 access flags, in display order. Keys mirror the DB columns 1:1. */
export const PERMISSION_KEYS = [
    'keep_portal_access',
    'view_training_plans',
    'view_nutrition_plans',
    'view_progress_history',
    'view_assessments',
    'view_checkins',
    'allow_messaging',
    'allow_submit_checkins',
    'allow_booking_appointments',
    'allow_download_files',
] as const;

export type PermissionKey = (typeof PERMISSION_KEYS)[number];
export type PolicyPermissions = Record<PermissionKey, boolean>;

/** Expired policy = the 10 flags + a grace window (days after expiry treated as Active). */
export type ExpiredPolicy = PolicyPermissions & { grace_period_days: number };
export type FrozenPolicy  = PolicyPermissions;

/** Spec defaults: read-only portal — views on, actions off. */
const READ_ONLY_FLAGS: PolicyPermissions = {
    keep_portal_access:         true,
    view_training_plans:        true,
    view_nutrition_plans:       true,
    view_progress_history:      true,
    view_assessments:           true,
    view_checkins:              true,
    allow_messaging:            false,
    allow_submit_checkins:      false,
    allow_booking_appointments: false,
    allow_download_files:       false,
};

export const DEFAULT_EXPIRED_POLICY: ExpiredPolicy = { ...READ_ONLY_FLAGS, grace_period_days: 0 };
export const DEFAULT_FROZEN_POLICY:  FrozenPolicy  = { ...READ_ONLY_FLAGS };

const ALL_ALLOWED: PolicyPermissions = PERMISSION_KEYS.reduce(
    (acc, key) => ({ ...acc, [key]: true }),
    {} as PolicyPermissions,
);

const ALL_DENIED: PolicyPermissions = PERMISSION_KEYS.reduce(
    (acc, key) => ({ ...acc, [key]: false }),
    {} as PolicyPermissions,
);

/** Returns only the 10 permission flags from a policy object (drops grace_period_days etc.). */
export function pickPermissions(policy: Partial<PolicyPermissions>): PolicyPermissions {
    return PERMISSION_KEYS.reduce(
        (acc, key) => ({ ...acc, [key]: policy[key] === true }),
        {} as PolicyPermissions,
    );
}

/**
 * Resolves the effective access flags for a client given their computed status
 * and the workspace/package policies.
 *
 * Only Expired and Frozen subscriptions are policy-restricted. Active, Pre-start
 * and No Subscriptions (a newly created client with no payment yet) get full
 * access so onboarding is never blocked. Expired → expired policy (the caller
 * applies the grace window — see subscriptionPolicies.service). Frozen → frozen
 * policy. Cancelled → portal closed (not produced by the status engine today,
 * kept for completeness).
 */
export function resolveAccess(
    status: SubscriptionStatus | 'Cancelled',
    policies: { expired: PolicyPermissions; frozen: PolicyPermissions },
): PolicyPermissions {
    switch (status) {
        case 'Frozen':
            return pickPermissions(policies.frozen);
        case 'Expired':
            return pickPermissions(policies.expired);
        case 'Cancelled':
            return { ...ALL_DENIED };
        case 'Active':
        case 'Pre-start':
        case 'No Subscriptions':
        default:
            return { ...ALL_ALLOWED };
    }
}
