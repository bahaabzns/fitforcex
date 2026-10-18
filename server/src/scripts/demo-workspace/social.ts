// Coach notes on a client and the coach/client conversation thread.

import { createId } from '@paralleldrive/cuid2';
import { CLIENT_LASTS, CLIENT_REPLIES, CLIENT_UNREAD_PINGS, OBSERVATION_TEMPLATES, TEAM_FOLLOWUPS, TEAM_OPENERS } from './pools';
import { addDays, chance, clampToNow, DAY, daysAgo, MINUTE, NOW, pick, pickWeighted, rand, randInt } from './random';
import type { BuildContext, Profile, Subscription } from './types';

export interface ObservationLinks { exerciseIds: string[]; foodIds: string[]; requestIds: string[] }

export function buildObservations(ctx: BuildContext, profile: Profile, subscription: Subscription, links: ObservationLinks): void {
    const count = pickWeighted([[0, 35], [1, 25], [2, 20], [3, 12], [4, 8]] as const);
    const earliest = addDays(subscription.periods[0].start, 3).getTime();
    const window = Math.max(DAY, NOW.getTime() - earliest);

    for (let i = 0; i < count; i++) {
        const template = pick(OBSERVATION_TEMPLATES);
        const createdAt = clampToNow(new Date(earliest + rand() * window));
        const id = createId();
        ctx.buffers.observations.push({
            id, client_id: profile.id, workspace_id: ctx.workspaceId, title: template.title, content: template.content,
            category: template.category, severity: template.severity,
            author_id: template.category === 'Nutrition' ? profile.nutritionist.userId : profile.trainer.userId, created_at: createdAt,
        });
        linkObservation(ctx, id, template.category, links);
    }
}

function linkObservation(ctx: BuildContext, observationId: string, category: string, links: ObservationLinks) {
    const base = { id: createId(), observation_id: observationId };
    if (category === 'Injury/Pain' && links.exerciseIds.length > 0) {
        ctx.buffers.observationRelations.push({ ...base, exercise_library_id: pick(links.exerciseIds) });
    } else if (category === 'Nutrition' && links.foodIds.length > 0) {
        ctx.buffers.observationRelations.push({ ...base, food_item_id: pick(links.foodIds) });
    } else if (category === 'Adherence' && links.requestIds.length > 0 && chance(0.5)) {
        ctx.buffers.observationRelations.push({ ...base, form_request_id: pick(links.requestIds) });
    }
}

// ── Chat ───────────────────────────────────────────────────────────────────
function lastMessageTime(profile: Profile, createdAt: Date): Date {
    const recent = ['active', 'expiringSoon', 'newClient', 'frozen'].includes(profile.scenario);
    const daysBack = recent ? Math.floor(Math.pow(rand(), 2.2) * 14) : randInt(15, 150);
    const candidate = daysAgo(daysBack, randInt(0, 20));
    return candidate.getTime() > createdAt.getTime() + DAY ? candidate : clampToNow(new Date(createdAt.getTime() + 2 * DAY));
}

function conversationTimes(count: number, createdAt: Date, last: Date): Date[] {
    const spanMs = Math.max(DAY / 2, Math.min(last.getTime() - createdAt.getTime(), randInt(2, 30) * DAY));
    const first = last.getTime() - spanMs;
    const times = Array.from({ length: count - 1 }, () => first + rand() * spanMs).sort((a, b) => a - b);
    return [...times, last.getTime()].map((t) => new Date(t));
}

function sender(profile: Profile, ctx: BuildContext): string {
    const roll = rand();
    return roll < 0.75 ? profile.trainer.userId : roll < 0.9 ? profile.nutritionist.userId : ctx.ownerId;
}

export function buildThread(ctx: BuildContext, profile: Profile, createdAt: Date): void {
    if (profile.scenario !== 'none' && !chance(0.9)) return;
    const threadId = createId();
    const messageCount = randInt(3, 14);
    const last = lastMessageTime(profile, createdAt);
    const times = conversationTimes(messageCount, createdAt, last);
    const startsWithTeam = chance(0.6);
    const hasUnread = ['active', 'expiringSoon', 'newClient'].includes(profile.scenario) && chance(0.2);
    const unreadStart = hasUnread ? messageCount - randInt(1, 2) : messageCount;
    const teamSender = sender(profile, ctx);
    const clientName = `${profile.fname} ${profile.lname}`;

    ctx.buffers.threads.push({
        id: threadId, workspace_id: ctx.workspaceId, client_id: profile.id, status: 'open', created_at: times[0], updated_at: last,
    });

    times.forEach((time, index) => {
        const fromTeam = hasUnread && index >= unreadStart ? false : (index % 2 === 0) === startsWithTeam;
        const isUnread = hasUnread && index >= unreadStart;
        const body = !fromTeam
            ? (isUnread ? pick(CLIENT_UNREAD_PINGS) : index === messageCount - 1 ? pick(CLIENT_LASTS) : pick(CLIENT_REPLIES))
            : (index < 2 ? pick(TEAM_OPENERS) : pick(TEAM_FOLLOWUPS));
        ctx.buffers.messages.push({
            id: createId(), thread_id: threadId, sender_type: fromTeam ? 'team' : 'client', sender_id: fromTeam ? teamSender : profile.id, body, type: 'text',
            read_by_team_at: fromTeam ? null : isUnread ? null : new Date(time.getTime() + randInt(2, 240) * MINUTE),
            read_by_client_at: fromTeam ? (chance(0.9) || index < messageCount - 2 ? new Date(time.getTime() + randInt(2, 600) * MINUTE) : null) : null,
            created_at: time,
        });
    });

    if (hasUnread) {
        ctx.collected.unreadThreads.push({ threadId, clientId: profile.id, clientName, at: last, assignee: teamSender });
    }
}
