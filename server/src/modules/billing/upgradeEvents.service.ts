import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../../lib/prisma';

// Every surface that can start an upgrade. Adding a button means adding its key here so the
// admin funnel table can list it — unknown values from a client are rejected, not stored.
export const UPGRADE_SOURCES = [
    'topbar', 'sidebar_meter', 'limit_popup', 'lock_branding', 'expiry_banner', 'subscription_page',
] as const;
export type UpgradeSource = (typeof UPGRADE_SOURCES)[number];

// Steps a client may report itself; checkout_started and paid are written by the server only,
// so they can't be forged to inflate conversion.
export const CLIENT_EVENT_TYPES = ['shown', 'click', 'plan_selected'] as const;
export type ClientEventType = (typeof CLIENT_EVENT_TYPES)[number];

const MAX_RETURN_TO_LENGTH = 300;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARACTERS = /[\u0000-\u001f]/;

/**
 * A return path is user-controlled input that ends up in a redirect, so it must be a relative
 * path inside this workspace — no scheme, no `//host`, no backslashes. Anything else is dropped
 * (the coach just lands on the dashboard).
 */
export function sanitizeReturnTo(value: unknown, workspaceSlug: string): string | null {
    if (typeof value !== 'string' || value.length === 0 || value.length > MAX_RETURN_TO_LENGTH) return null;
    if (!workspaceSlug || !value.startsWith(`/${workspaceSlug}/`)) return null;
    if (value.includes('\\') || value.includes('//') || CONTROL_CHARACTERS.test(value)) return null;
    return value;
}

interface RecordEventInput {
    workspaceId: string;
    userId?: string | null;
    eventType: ClientEventType | 'checkout_started' | 'paid';
    source: UpgradeSource;
    planId?: string | null;
    variationId?: string | null;
    paymentId?: string | null;
    returnTo?: string | null;
}

export async function recordUpgradeEvent(input: RecordEventInput): Promise<void> {
    await prisma.upgrade_events.create({
        data: {
            id:           createId(),
            workspace_id: input.workspaceId,
            user_id:      input.userId ?? null,
            event_type:   input.eventType,
            source:       input.source,
            plan_id:      input.planId ?? null,
            variation_id: input.variationId ?? null,
            payment_id:   input.paymentId ?? null,
            return_to:    input.returnTo ?? null,
        },
    });
}

/** Best-effort wrapper: analytics must never break checkout or payment activation. */
export async function recordUpgradeEventSafely(input: RecordEventInput): Promise<void> {
    try {
        await recordUpgradeEvent(input);
    } catch (err) {
        console.error('[UpgradeEvents] failed to record', input.eventType, (err as Error).message);
    }
}

/**
 * Called once from applyPayment's single activation choke point. Looks up the checkout that
 * started this payment so the sale is credited to the button that began it, even if the coach
 * paid hours later. Payments with no checkout_started row (admin-entered, add-ons) are skipped.
 */
export async function recordPaidUpgradeEvent(paymentId: string, workspaceId: string): Promise<void> {
    try {
        const checkout = await prisma.upgrade_events.findFirst({
            where:  { payment_id: paymentId, workspace_id: workspaceId, event_type: 'checkout_started' },
            select: { source: true, user_id: true, plan_id: true, variation_id: true, return_to: true },
        });
        if (!checkout) return;
        await recordUpgradeEvent({
            workspaceId, userId: checkout.user_id, eventType: 'paid',
            source: checkout.source as UpgradeSource, planId: checkout.plan_id,
            variationId: checkout.variation_id, paymentId, returnTo: checkout.return_to,
        });
    } catch (err) {
        console.error('[UpgradeEvents] failed to record paid for', paymentId, (err as Error).message);
    }
}

export async function findCheckoutReturnTo(paymentId: string, workspaceId: string): Promise<string | null> {
    const checkout = await prisma.upgrade_events.findFirst({
        where:  { payment_id: paymentId, workspace_id: workspaceId, event_type: 'checkout_started' },
        select: { return_to: true },
    });
    return checkout?.return_to ?? null;
}
