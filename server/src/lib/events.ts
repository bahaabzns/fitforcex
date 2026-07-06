import { createId } from '@paralleldrive/cuid2';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { getIo } from './socket';

/**
 * The single choke point for domain events. Before this, controllers hand-rolled
 * `getIo().emit(...)`, so events were realtime-only and vanished the moment a
 * recipient was offline. recordEvent() makes them durable: it writes one
 * notification row per recipient AND fans out realtime — so the bell survives a
 * closed tab, and a later email/push consumer can read the same rows.
 *
 * It is best-effort: a failure here is logged but never propagated, so a
 * notification problem can't break the originating request (mirrors
 * logSubscriptionAudit in subscriptionPolicies.service).
 */

export type RecipientKind = 'user' | 'client';
export type EventImportance = 'info' | 'actionable' | 'alert';

export type Recipient = { type: RecipientKind; id: string };

export type DomainEvent = {
    workspaceId: string;
    /** Event key, e.g. 'message.received' | 'plan.assigned'. */
    type: string;
    /** Drives the bell vs. feed treatment downstream. Defaults to 'info'. */
    importance?: EventImportance;
    title: string;
    body?: string;
    /** Who gets a durable notification + a bell ping in their socket room. */
    recipients: Recipient[];
    actor?: { type: 'user' | 'client' | 'system'; id?: string | null };
    /** What the notification points at, e.g. { type: 'thread', id }. */
    entity?: { type: string; id: string };
    metadata?: Prisma.InputJsonValue;
    /**
     * Legacy realtime emit, preserved verbatim so existing client listeners keep
     * working. Emitted to the given rooms unchanged; orthogonal to `recipients`.
     */
    realtime?: { rooms: string[]; event: string; payload: unknown };
};

export async function recordEvent(event: DomainEvent): Promise<void> {
    try {
        const importance = event.importance ?? 'info';

        if (event.recipients.length > 0) {
            await prisma.notifications.createMany({
                data: event.recipients.map(recipient => ({
                    id:             createId(),
                    workspace_id:   event.workspaceId,
                    recipient_type: recipient.type,
                    recipient_id:   recipient.id,
                    type:           event.type,
                    importance,
                    title:          event.title,
                    body:           event.body ?? null,
                    entity_type:    event.entity?.type ?? null,
                    entity_id:      event.entity?.id ?? null,
                    actor_type:     event.actor?.type ?? null,
                    actor_id:       event.actor?.id ?? null,
                    metadata:       event.metadata,
                })),
            });
        }

        const io = getIo();

        // Bell ping to each recipient's own room (socket.ts joins `user:<id>` and
        // `client:<id>` on connect). Lightweight: the client refetches on receipt.
        for (const recipient of event.recipients) {
            io.to(`${recipient.type}:${recipient.id}`).emit('notification', {
                type: event.type,
                importance,
                title: event.title,
            });
        }

        // Unchanged legacy realtime event for the UI-sync listeners that predate this.
        if (event.realtime) {
            for (const room of event.realtime.rooms) {
                io.to(room).emit(event.realtime.event, event.realtime.payload);
            }
        }
    } catch (err) {
        console.error('[events] recordEvent failed:', err);
    }
}

/**
 * Active team members of a workspace as user recipients, optionally minus the actor.
 * Includes the workspace owner explicitly — ownership is implicit via
 * workspaces.owner_id, not a workspace_members row (see lib/defaultPermissions.ts),
 * so a solo coach with no invited teammates would otherwise get zero recipients.
 */
export async function teamRecipients(workspaceId: string, excludeUserId?: string): Promise<Recipient[]> {
    const [workspace, members] = await Promise.all([
        prisma.workspaces.findUnique({ where: { id: workspaceId }, select: { owner_id: true } }),
        prisma.workspace_members.findMany({
            where:  { workspace_id: workspaceId, is_active: true },
            select: { user_id: true },
        }),
    ]);

    const userIds = new Set(members.map(member => member.user_id));
    if (workspace?.owner_id) userIds.add(workspace.owner_id);
    if (excludeUserId) userIds.delete(excludeUserId);

    return Array.from(userIds, id => ({ type: 'user' as const, id }));
}

/**
 * The workspace owner as a user recipient — for owner-only alerts (e.g. billing).
 * 'owner' is never a workspace_members.role (see lib/defaultPermissions.ts — VALID_ROLES
 * is manager/trainer/nutritionist/receptionist/viewer), so the old role: 'owner' lookup
 * against workspace_members could never match; ownership only lives on workspaces.owner_id.
 */
export async function ownerRecipients(workspaceId: string): Promise<Recipient[]> {
    const workspace = await prisma.workspaces.findUnique({ where: { id: workspaceId }, select: { owner_id: true } });
    return workspace?.owner_id ? [{ type: 'user' as const, id: workspace.owner_id }] : [];
}
