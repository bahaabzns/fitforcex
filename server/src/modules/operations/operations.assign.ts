import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { recordEvent } from '../../lib/events';
import { CAPACITY_ROLES } from './operations.constants';

const MAX_ASSIGN_AT_ONCE = 200;
export const MAX_ASSIGN_LIMIT = MAX_ASSIGN_AT_ONCE;

// Who can be handed plans from the dashboard: the owner, or an active member in a role that
// produces plans. (Capacity is not required: the coach may be deliberately overriding it.)
async function canReceivePlans(workspaceId: string, userId: string): Promise<boolean> {
    const [owner, member] = await Promise.all([
        prisma.workspaces.findFirst({ where: { id: workspaceId, owner_id: userId }, select: { id: true } }),
        prisma.workspace_members.findFirst({
            where: { workspace_id: workspaceId, user_id: userId, is_active: true, role: { in: [...CAPACITY_ROLES] } },
            select: { id: true },
        }),
    ]);
    return !!(owner || member);
}

// Assigns up to `limit` of the oldest unassigned, plan-producing, needs-action requests to one person.
// Returns null when the assignee cannot receive plans. The `assigned_to IS NULL` guard in the UPDATE
// means a request someone else claims in the meantime is skipped rather than overwritten.
export async function assignUnassignedPlans(
    workspaceId: string, assigneeUserId: string, limit: number, actorUserId: string,
): Promise<{ assigned: number } | null> {
    if (!(await canReceivePlans(workspaceId, assigneeUserId))) return null;

    const updated = await prisma.$queryRaw<{ id: string; client_id: string }[]>`
        UPDATE form_requests
        SET assigned_to = ${assigneeUserId}
        WHERE id IN (
            SELECT fr.id
            FROM form_requests fr
            JOIN forms f ON f.id = fr.form_id
            WHERE fr.workspace_id = ${workspaceId}
              AND fr.status = 'submitted'
              AND fr.archived_at IS NULL
              AND fr.assigned_to IS NULL
              AND COALESCE(NULLIF(fr.post_action, ''), f.post_action, 'nothing') <> 'nothing'
            ORDER BY fr.submitted_at ASC
            LIMIT ${limit}
        )
          AND workspace_id = ${workspaceId}
          AND assigned_to IS NULL
        RETURNING id, client_id
    `;

    // Same notification the Plans Queue sends on assignment, unless the coach assigned it to themselves.
    if (assigneeUserId !== actorUserId) {
        await Promise.all(updated.map((row) => recordEvent({
            workspaceId,
            type:       'checkin.assigned',
            importance: 'actionable',
            title:      'A check-in was assigned to you for review',
            recipients: [{ type: 'user', id: assigneeUserId }],
            actor:      { type: 'user', id: actorUserId },
            entity:     { type: 'form_request', id: row.id },
            metadata:   { clientId: row.client_id } as Prisma.InputJsonValue,
        })));
    }
    return { assigned: updated.length };
}
