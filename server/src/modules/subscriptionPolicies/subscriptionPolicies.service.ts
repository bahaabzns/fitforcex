import { createId } from '@paralleldrive/cuid2';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { computeSubscriptionDetails, type SubscriptionStatus } from '../../utils/subscriptionStatus';
import {
    DEFAULT_EXPIRED_POLICY,
    DEFAULT_FROZEN_POLICY,
    PERMISSION_KEYS,
    pickPermissions,
    resolveAccess,
    type ExpiredPolicy,
    type FrozenPolicy,
    type PolicyPermissions,
    type PolicyScope,
} from '../../utils/subscriptionPolicy';

const DAY_MS = 86400000;

type PolicyRow = {
    grace_period_days: number;
} & Record<string, unknown>;

function rowToExpired(row: PolicyRow): ExpiredPolicy {
    return { ...pickPermissions(row as Partial<PolicyPermissions>), grace_period_days: row.grace_period_days ?? 0 };
}

function rowToFrozen(row: PolicyRow): FrozenPolicy {
    return pickPermissions(row as Partial<PolicyPermissions>);
}

/** Global (package_id NULL) policies for a workspace; falls back to spec defaults when unset. */
export async function getGlobalPolicies(workspaceId: string): Promise<{ expired: ExpiredPolicy; frozen: FrozenPolicy }> {
    const rows = await prisma.subscription_access_policies.findMany({
        where: { workspace_id: workspaceId, package_id: null },
    });
    const expiredRow = rows.find(r => r.scope === 'expired');
    const frozenRow  = rows.find(r => r.scope === 'frozen');
    return {
        expired: expiredRow ? rowToExpired(expiredRow as unknown as PolicyRow) : { ...DEFAULT_EXPIRED_POLICY },
        frozen:  frozenRow  ? rowToFrozen(frozenRow  as unknown as PolicyRow) : { ...DEFAULT_FROZEN_POLICY },
    };
}

/** Per-package overrides for a workspace; null on a scope means "use global". */
export async function getPackageOverrides(
    workspaceId: string,
    packageId: string,
): Promise<{ expired: ExpiredPolicy | null; frozen: FrozenPolicy | null }> {
    const rows = await prisma.subscription_access_policies.findMany({
        where: { workspace_id: workspaceId, package_id: packageId },
    });
    const expiredRow = rows.find(r => r.scope === 'expired');
    const frozenRow  = rows.find(r => r.scope === 'frozen');
    return {
        expired: expiredRow ? rowToExpired(expiredRow as unknown as PolicyRow) : null,
        frozen:  frozenRow  ? rowToFrozen(frozenRow  as unknown as PolicyRow) : null,
    };
}

function flagsToColumns(flags: PolicyPermissions): Record<string, boolean> {
    return PERMISSION_KEYS.reduce((acc, key) => ({ ...acc, [key]: flags[key] === true }), {});
}

/**
 * Upserts a single policy row (Prisma can't target the partial unique indexes,
 * so we find-then-update/create by hand). package_id null = global.
 */
async function upsertPolicy(
    workspaceId: string,
    packageId: string | null,
    scope: PolicyScope,
    flags: PolicyPermissions,
    gracePeriodDays: number,
): Promise<void> {
    const existing = await prisma.subscription_access_policies.findFirst({
        where: { workspace_id: workspaceId, package_id: packageId, scope },
        select: { id: true },
    });
    const data = {
        ...flagsToColumns(flags),
        grace_period_days: scope === 'expired' ? gracePeriodDays : 0,
        updated_at: new Date(),
    };
    if (existing) {
        await prisma.subscription_access_policies.update({ where: { id: existing.id }, data });
    } else {
        await prisma.subscription_access_policies.create({
            data: { id: createId(), workspace_id: workspaceId, package_id: packageId, scope, ...data },
        });
    }
}

/** Replaces both global policies for a workspace. */
export async function saveGlobalPolicies(
    workspaceId: string,
    policies: { expired: ExpiredPolicy; frozen: FrozenPolicy },
): Promise<void> {
    await upsertPolicy(workspaceId, null, 'expired', policies.expired, policies.expired.grace_period_days);
    await upsertPolicy(workspaceId, null, 'frozen', policies.frozen, 0);
}

/**
 * Sets per-package overrides. For each scope: an object upserts the override,
 * `null` removes it (the package reverts to the global default for that scope),
 * `undefined` leaves it untouched.
 */
export async function savePackageOverrides(
    workspaceId: string,
    packageId: string,
    overrides: { expired?: ExpiredPolicy | null; frozen?: FrozenPolicy | null },
): Promise<void> {
    if (overrides.expired !== undefined) {
        if (overrides.expired === null) {
            await prisma.subscription_access_policies.deleteMany({ where: { workspace_id: workspaceId, package_id: packageId, scope: 'expired' } });
        } else {
            await upsertPolicy(workspaceId, packageId, 'expired', overrides.expired, overrides.expired.grace_period_days);
        }
    }
    if (overrides.frozen !== undefined) {
        if (overrides.frozen === null) {
            await prisma.subscription_access_policies.deleteMany({ where: { workspace_id: workspaceId, package_id: packageId, scope: 'frozen' } });
        } else {
            await upsertPolicy(workspaceId, packageId, 'frozen', overrides.frozen, 0);
        }
    }
}

/** Records a coach policy edit or a system status transition. Best-effort: never throws into the caller. */
export async function logSubscriptionAudit(entry: {
    workspaceId: string;
    clientId?: string | null;
    actorType: 'coach' | 'system';
    actorUserId?: string | null;
    eventType: 'policy.update' | 'status.change' | 'client.archive' | 'client.restore' | 'client.delete';
    fromStatus?: string | null;
    toStatus?: string | null;
    metadata?: Prisma.InputJsonValue;
}): Promise<void> {
    try {
        await prisma.subscription_status_audit.create({
            data: {
                id:            createId(),
                workspace_id:  entry.workspaceId,
                client_id:     entry.clientId ?? null,
                actor_type:    entry.actorType,
                actor_user_id: entry.actorUserId ?? null,
                event_type:    entry.eventType,
                from_status:   entry.fromStatus ?? null,
                to_status:     entry.toStatus ?? null,
                metadata:      entry.metadata,
            },
        });
    } catch (err) {
        console.error('[SubscriptionAudit] failed to write audit row:', err);
    }
}

type TxLike = { status: string; created_at: string | Date; duration?: number | string | null; start_mode?: string | null; subscription_start_date?: string | Date | null };

/** Fetches the inputs for and computes one client's subscription status + period end. */
export async function computeClientStatus(clientId: string, workspaceId: string) {
    const [txRows, freezeRows, planActRows] = await Promise.all([
        prisma.transactions.findMany({
            where:  { workspace_id: workspaceId, client_id: clientId },
            select: { status: true, duration: true, subscription_start_date: true, start_mode: true, created_at: true },
        }),
        prisma.subscription_freezes.findMany({ where: { client_id: clientId } }),
        prisma.$queryRaw<{ first_activation: Date | null }[]>`
            SELECT MIN(activated_at) AS first_activation FROM (
                SELECT activated_at FROM training_plans  WHERE workspace_id = ${workspaceId} AND client_id = ${clientId} AND activated_at IS NOT NULL
                UNION ALL
                SELECT activated_at FROM nutrition_plans WHERE workspace_id = ${workspaceId} AND client_id = ${clientId} AND activated_at IS NOT NULL
            ) combined
        `,
    ]);

    const firstActivation = planActRows[0]?.first_activation ?? null;
    return computeSubscriptionDetails(txRows as TxLike[], freezeRows, firstActivation);
}

/** Maps a client to its package id via the FK'd current package variation (Package Lifecycle Phase 0). */
async function resolveClientPackageId(clientId: string, workspaceId: string): Promise<string | null> {
    const client = await prisma.clients.findFirst({
        where:  { id: clientId, workspace_id: workspaceId },
        select: { current_package_variation_id: true },
    });
    if (!client?.current_package_variation_id) return null;

    const variation = await prisma.package_variations.findUnique({
        where:  { id: client.current_package_variation_id },
        select: { package_id: true },
    });
    return variation?.package_id ?? null;
}

export type EffectiveAccess = {
    status: SubscriptionStatus | 'Archived';
    withinGrace: boolean;
    access: PolicyPermissions;
    currentPeriodEnd: Date | null;
    currentPeriodStart: Date | null;
    totalCoverageEnd: Date | null;
};

/**
 * The single source of truth for "what can this client do right now": computes
 * status, resolves the package override (or global) policy, applies the expiry
 * grace window, and returns the effective 10 access flags.
 */
export async function getEffectiveAccessForClient(clientId: string, workspaceId: string): Promise<EffectiveAccess> {
    // Archived clients have no portal access regardless of subscription state.
    // resolveAccess('Cancelled') denies every flag → requirePortalOpen blocks
    // feature routes while /me and /access still render a restricted status card.
    const lifecycle = await prisma.clients.findFirst({
        where:  { id: clientId, workspace_id: workspaceId },
        select: { archived_at: true },
    });
    if (lifecycle?.archived_at) {
        return { status: 'Archived', withinGrace: false, currentPeriodEnd: null, currentPeriodStart: null, totalCoverageEnd: null, access: resolveAccess('Cancelled', { expired: DEFAULT_EXPIRED_POLICY, frozen: DEFAULT_FROZEN_POLICY }) };
    }

    const [details, packageId, global] = await Promise.all([
        computeClientStatus(clientId, workspaceId),
        resolveClientPackageId(clientId, workspaceId),
        getGlobalPolicies(workspaceId),
    ]);

    const overrides = packageId ? await getPackageOverrides(workspaceId, packageId) : { expired: null, frozen: null };
    const expired = overrides.expired ?? global.expired;
    const frozen  = overrides.frozen  ?? global.frozen;

    // Grace window: an expired client within `grace_period_days` of their period
    // end is still treated as fully Active.
    let withinGrace = false;
    let effectiveStatus: SubscriptionStatus = details.status;
    if (details.status === 'Expired' && expired.grace_period_days > 0 && details.currentPeriodEnd) {
        const graceEnd = new Date(details.currentPeriodEnd.getTime() + expired.grace_period_days * DAY_MS);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (today < graceEnd) {
            withinGrace = true;
            effectiveStatus = 'Active';
        }
    }

    return {
        status: details.status,
        withinGrace,
        currentPeriodEnd:   details.currentPeriodEnd,
        currentPeriodStart: details.currentPeriodStart,
        totalCoverageEnd:   details.totalCoverageEnd,
        access: resolveAccess(effectiveStatus, { expired, frozen }),
    };
}
