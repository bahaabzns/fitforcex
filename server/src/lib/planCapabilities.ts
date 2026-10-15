import { prisma } from './prisma';

/**
 * Plan-level feature capabilities — the one registry of boolean features a plan can unlock.
 * Which plans carry which capability is DATA (plans.capabilities, edited in Admin → Plans),
 * never a hardcoded plan name. Add a key here and it appears in the admin editor.
 */
export const CAPABILITIES = {
    custom_branding: {
        label:       'Custom branding',
        description: 'Coach logo, colors and banners on the Client Portal and mobile app',
    },
} as const;

export type CapabilityKey = keyof typeof CAPABILITIES;
export const CAPABILITY_KEYS = Object.keys(CAPABILITIES) as CapabilityKey[];

export function isCapabilityKey(value: string): value is CapabilityKey {
    return (CAPABILITY_KEYS as string[]).includes(value);
}

/** Keeps only registered keys with strict boolean values — anything else from a request is dropped. */
export function sanitizeCapabilities(input: unknown): Partial<Record<CapabilityKey, boolean>> {
    const out: Partial<Record<CapabilityKey, boolean>> = {};
    if (!input || typeof input !== 'object' || Array.isArray(input)) return out;
    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
        if (isCapabilityKey(key) && typeof value === 'boolean') out[key] = value;
    }
    return out;
}

export interface WorkspaceCapabilityState {
    /** plan carries the capability AND the subscription has not expired */
    effective:    boolean;
    planHas:      boolean;
    expired:      boolean;
    planName:     string | null;
}

/**
 * Founder decision: no grace period for capabilities. They stop applying the moment
 * `expires_at` passes (the app's 3-day read-only grace in subscriptionAccessGate is for
 * data mutations, not for premium perks). A null `expires_at` never expires.
 */
export async function getCapabilityState(workspaceId: string, key: CapabilityKey): Promise<WorkspaceCapabilityState> {
    const sub = await prisma.workspace_subscriptions.findUnique({
        where:  { workspace_id: workspaceId },
        select: { expires_at: true, plans: { select: { name: true, capabilities: true } } },
    });
    if (!sub) return { effective: false, planHas: false, expired: false, planName: null };

    const caps    = sanitizeCapabilities(sub.plans.capabilities);
    const planHas = caps[key] === true;
    const expired = sub.expires_at !== null && sub.expires_at.getTime() <= Date.now();
    return { effective: planHas && !expired, planHas, expired, planName: sub.plans.name };
}

export async function hasCapability(workspaceId: string, key: CapabilityKey): Promise<boolean> {
    return (await getCapabilityState(workspaceId, key)).effective;
}

/** Display names of the active plans that carry a capability — powers the locked-state upgrade copy. */
export async function getPlansWithCapability(key: CapabilityKey): Promise<Array<{ name: string; display_name: string; display_name_ar: string | null }>> {
    const plans = await prisma.plans.findMany({
        where:   { is_active: true },
        select:  { name: true, display_name: true, display_name_ar: true, capabilities: true },
        orderBy: { sort_order: 'asc' },
    });
    return plans
        .filter(p => sanitizeCapabilities(p.capabilities)[key] === true)
        .map(({ name, display_name, display_name_ar }) => ({ name, display_name, display_name_ar }));
}
