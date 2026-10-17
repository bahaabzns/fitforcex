import { Prisma } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../../lib/prisma';
import { CAPACITY_ROLES } from './operations.constants';
import { sameDays } from './operations.schedule';

export interface CapacityChange {
    workspaceId: string;
    newCapacity: number | null;
    newDaysOff?: number[];      // omitted = leave the person's days off as they are
    changedBy:   string;
}

// A person's schedule at a point in time: how much they can do per working day, and which weekdays they are off.
interface Schedule { capacity: number | null; daysOff: number[] }

// Writes a history row only when the capacity or the days off actually changed, in the same
// transaction as the update, so history can never disagree with the setting. Every row records
// the full before/after schedule, which is what lets the chart replay past capacity.
async function recordIfChanged(
    tx: Prisma.TransactionClient,
    workspaceId: string, userId: string, changedBy: string,
    previous: Schedule, next: Schedule,
): Promise<boolean> {
    if (previous.capacity === next.capacity && sameDays(previous.daysOff, next.daysOff)) return false;
    await tx.capacity_history.create({
        data: {
            id: createId(), workspace_id: workspaceId, user_id: userId, changed_by: changedBy,
            previous_capacity: previous.capacity, new_capacity: next.capacity,
            previous_days_off: previous.daysOff, new_days_off: next.daysOff,
        },
    });
    return true;
}

// Returns null when the member is not in this workspace.
export async function setMemberCapacity(memberId: string, change: CapacityChange): Promise<{ changed: boolean } | null> {
    return prisma.$transaction(async (tx) => {
        const member = await tx.workspace_members.findFirst({
            where:  { id: memberId, workspace_id: change.workspaceId },
            select: { user_id: true, daily_plan_capacity: true, days_off: true },
        });
        if (!member) return null;
        const next: Schedule = { capacity: change.newCapacity, daysOff: change.newDaysOff ?? member.days_off };
        await tx.workspace_members.update({ where: { id: memberId }, data: { daily_plan_capacity: next.capacity, days_off: next.daysOff } });
        const changed = await recordIfChanged(tx, change.workspaceId, member.user_id, change.changedBy,
            { capacity: member.daily_plan_capacity, daysOff: member.days_off }, next);
        return { changed };
    });
}

export async function setOwnerCapacity(change: CapacityChange): Promise<{ changed: boolean }> {
    return prisma.$transaction(async (tx) => {
        const workspace = await tx.workspaces.findFirstOrThrow({
            where:  { id: change.workspaceId },
            select: { owner_id: true, owner_daily_plan_capacity: true, owner_days_off: true },
        });
        const next: Schedule = { capacity: change.newCapacity, daysOff: change.newDaysOff ?? workspace.owner_days_off };
        await tx.workspaces.update({ where: { id: change.workspaceId }, data: { owner_daily_plan_capacity: next.capacity, owner_days_off: next.daysOff } });
        const changed = await recordIfChanged(tx, change.workspaceId, workspace.owner_id, change.changedBy,
            { capacity: workspace.owner_daily_plan_capacity, daysOff: workspace.owner_days_off }, next);
        return { changed };
    });
}

// Gives every active, plan-producing member who has no capacity yet the same starting value (and,
// if given, the same days off), logging each as its own history entry. Members who already have
// a value are left alone.
export async function setCapacityForUnset(
    workspaceId: string, value: number, changedBy: string, daysOff?: number[],
): Promise<number> {
    return prisma.$transaction(async (tx) => {
        const unset = await tx.workspace_members.findMany({
            where: { workspace_id: workspaceId, is_active: true, role: { in: [...CAPACITY_ROLES] }, daily_plan_capacity: null },
            select: { id: true, user_id: true, days_off: true },
        });
        for (const member of unset) {
            const next: Schedule = { capacity: value, daysOff: daysOff ?? member.days_off };
            await tx.workspace_members.update({ where: { id: member.id }, data: { daily_plan_capacity: next.capacity, days_off: next.daysOff } });
            await recordIfChanged(tx, workspaceId, member.user_id, changedBy, { capacity: null, daysOff: member.days_off }, next);
        }
        return unset.length;
    });
}

export interface CapacityHistoryEntry {
    id: string;
    previousCapacity: number | null;
    newCapacity: number | null;
    // empty on entries written before days off existed (everyone then worked every day)
    previousDaysOff: number[];
    newDaysOff: number[];
    changedAt: Date;
    changedByName: string | null;
}

const HISTORY_LIMIT = 100;

const displayName = (u: { fname: string; lname: string; email: string }) =>
    `${u.fname} ${u.lname}`.trim() || u.email;

export async function loadCapacityHistory(workspaceId: string, userId: string): Promise<CapacityHistoryEntry[]> {
    const rows = await prisma.capacity_history.findMany({
        where:   { workspace_id: workspaceId, user_id: userId },
        orderBy: { changed_at: 'desc' },
        take:    HISTORY_LIMIT,
    });
    const actorIds = [...new Set(rows.map((r) => r.changed_by).filter((id): id is string => !!id))];
    const actors = actorIds.length
        ? await prisma.users.findMany({ where: { id: { in: actorIds } }, select: { id: true, fname: true, lname: true, email: true } })
        : [];
    const nameById = new Map(actors.map((u) => [u.id, displayName(u)]));
    return rows.map((r) => ({
        id: r.id, previousCapacity: r.previous_capacity, newCapacity: r.new_capacity,
        previousDaysOff: r.previous_days_off, newDaysOff: r.new_days_off,
        changedAt: r.changed_at, changedByName: r.changed_by ? (nameById.get(r.changed_by) ?? null) : null,
    }));
}

// Only people in (or owning) this workspace may have their history read.
export async function isWorkspacePerson(workspaceId: string, userId: string): Promise<boolean> {
    const [member, owner] = await Promise.all([
        prisma.workspace_members.findFirst({ where: { workspace_id: workspaceId, user_id: userId }, select: { id: true } }),
        prisma.workspaces.findFirst({ where: { id: workspaceId, owner_id: userId }, select: { id: true } }),
    ]);
    return !!(member || owner);
}
