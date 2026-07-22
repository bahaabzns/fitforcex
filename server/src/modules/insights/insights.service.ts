import { createId } from '@paralleldrive/cuid2';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { recordEvent, Recipient } from '../../lib/events';

export type EntityType = 'insight' | 'roadmap_item';
export type SubmitterType = 'user' | 'client';
export type SourceType = 'bug' | 'feature_request' | 'rating' | 'prompt_response';
export type RoadmapStatus = 'proposed' | 'planned' | 'in_progress' | 'shipped' | 'declined';

interface InsightPromptRow {
    id: string;
    workspace_id: string | null;
    question_en: string;
    question_ar: string | null;
    response_type: string;
    options: unknown;
    target_audience: string;
    trigger_event: string | null;
    status: string;
    created_by: string;
    created_at: Date;
    ended_at: Date | null;
}

/**
 * Writes one row to insight_events for a status transition. This is the only
 * function that touches insight_events — every status change on an insight or
 * a roadmap_item goes through here, so no transition can happen unlogged. Not
 * to be confused with lib/events.ts's recordEvent, which is the separate
 * notifications/realtime choke point (used below for closing the loop).
 */
export async function logStatusChange(
    entityType: EntityType,
    entityId: string,
    fromStatus: string | null,
    toStatus: string,
    note: string | null,
    actorId: string,
): Promise<void> {
    await prisma.insight_events.create({
        data: {
            id: createId(),
            entity_type: entityType,
            entity_id: entityId,
            from_status: fromStatus,
            to_status: toStatus,
            note,
            actor_id: actorId,
        },
    });
}

/**
 * Phase 4 filters shared by getActivePrompt and getPromptForTrigger:
 *   - scheduling window (starts_at/ends_at)
 *   - multi-workspace targeting (insight_prompt_workspaces) — falls back to
 *     the plain workspace_id column when no specific rows exist, so 051/052
 *     prompts keep working unchanged
 *   - a soft per-user frequency cap (max_shows_per_user vs. impression count)
 *   - bounded condition targeting (insight_prompt_conditions) — only ever
 *     evaluated against a client's subscription_status/current_package_variation_id;
 *     a 'user' submitter fails any prompt that has conditions, since none of
 *     the bounded fields apply to coaches
 */
function phase4EligibilityFragment(audience: SubmitterType, workspaceId: string | null, submitterId: string): Prisma.Sql {
    return Prisma.sql`
        AND (starts_at IS NULL OR starts_at <= NOW())
        AND (ends_at IS NULL OR ends_at >= NOW())
        AND (
            (NOT EXISTS (SELECT 1 FROM insight_prompt_workspaces w WHERE w.prompt_id = insight_prompts.id)
                AND (workspace_id IS NULL OR workspace_id = ${workspaceId}))
            OR EXISTS (SELECT 1 FROM insight_prompt_workspaces w WHERE w.prompt_id = insight_prompts.id AND w.workspace_id = ${workspaceId})
        )
        AND (
            max_shows_per_user IS NULL
            OR (SELECT COUNT(*) FROM insight_prompt_impressions imp
                WHERE imp.prompt_id = insight_prompts.id AND imp.submitted_by_type = ${audience} AND imp.submitted_by_id = ${submitterId}
               ) < max_shows_per_user
        )
        AND (
            NOT EXISTS (SELECT 1 FROM insight_prompt_conditions c WHERE c.prompt_id = insight_prompts.id)
            OR (
                ${audience} = 'client'
                AND NOT EXISTS (
                    SELECT 1 FROM insight_prompt_conditions c
                    WHERE c.prompt_id = insight_prompts.id
                      AND (
                          (c.field = 'subscription_status' AND c.value <> COALESCE((SELECT subscription_status FROM clients WHERE id = ${submitterId}), ''))
                          OR (c.field = 'package_variation_id' AND c.value <> COALESCE((SELECT current_package_variation_id FROM clients WHERE id = ${submitterId}), ''))
                      )
                )
            )
        )
    `;
}

/** Records a "sent/viewed" impression — this system has no separate push channel, so a prompt is sent exactly when it's fetched and eligible. */
async function recordImpression(promptId: string, submitterType: SubmitterType, submitterId: string): Promise<void> {
    await prisma.insight_prompt_impressions.create({
        data: { id: createId(), prompt_id: promptId, submitted_by_type: submitterType, submitted_by_id: submitterId },
    });
}

/**
 * The active prompt (if any) eligible for this submitter — targeted at their
 * audience (or 'everyone'), scoped to their workspace or platform-wide, not
 * yet answered by them, not a contextual (trigger_event-gated) prompt —
 * manual/immediate delivery only — and passing every Phase 4 filter above.
 * Raw SQL for the NOT EXISTS checks, matching this codebase's existing
 * convention of dropping to $queryRaw for this class of query (see
 * forms.controller.ts). Records an impression when a match is returned.
 */
export async function getActivePrompt(
    audience: SubmitterType,
    workspaceId: string | null,
    submitterId: string,
): Promise<InsightPromptRow | null> {
    const rows = await prisma.$queryRaw<InsightPromptRow[]>`
        SELECT * FROM insight_prompts
        WHERE status = 'active'
          AND target_audience IN (${audience}, 'everyone')
          AND trigger_event IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM insights
              WHERE insights.prompt_id = insight_prompts.id
                AND insights.submitted_by_id = ${submitterId}
          )
          ${phase4EligibilityFragment(audience, workspaceId, submitterId)}
        ORDER BY created_at DESC
        LIMIT 1
    `;
    const prompt = rows[0] ?? null;
    if (prompt) await recordImpression(prompt.id, audience, submitterId);
    return prompt;
}

/**
 * Phase 3 — the fixed trigger catalog. Deliberately a hardcoded lookup, not a
 * generic rules/condition engine: nobody has asked for compound conditions,
 * and a handful of named product moments is enough for years (see §9 of the
 * architecture memo). Each check answers "has this exact moment just
 * happened for this submitter" — callers fire the check right after the
 * relevant action succeeds (e.g. right after a workout log is created), not
 * on a poll, so "count === 1" means "this was the one that just happened."
 */
export const TRIGGER_EVENTS = [
    // Training
    'first_workout_logged', 'workout_logs_10x', 'first_training_plan_created', 'first_training_plan_activated', 'first_custom_exercise_added',
    // Nutrition
    'nutrition_builder_used_10x', 'first_nutrition_plan_activated', 'first_custom_food_item_added',
    // Forms / check-ins
    'first_checkin_completed', 'first_form_created', 'first_checkin_request_sent', 'first_checkin_reviewed',
    // Messenger
    'first_message_sent_by_client', 'first_message_sent_by_coach',
    // Clients
    'first_client_added', 'first_client_observation_logged', 'first_client_archived', 'first_subscription_freeze_created',
    // Billing
    'first_completed_transaction_logged', 'first_refund_issued', 'first_workspace_subscription_paid',
    // Packages
    'first_package_created', 'first_package_variation_assigned_to_client',
    // Team
    'first_team_member_invited', 'first_team_invitation_accepted',
] as const;
export type TriggerEvent = (typeof TRIGGER_EVENTS)[number];

/**
 * Each check answers "has this exact moment just happened for this
 * submitter" — callers fire it right after the relevant action succeeds
 * (e.g. right after a workout log is created), not on a poll, so an exact
 * count match (=== 1, or === 10 for a milestone) means "this was the one
 * that just happened," not "this has been true for a while."
 * workspaceId is only used by coach-side, workspace-aggregate checks
 * (e.g. "first client added in this workspace"); client-scoped and
 * per-user checks ignore it.
 */
const TRIGGER_CHECKS: Record<TriggerEvent, (submitterType: SubmitterType, submitterId: string, workspaceId: string | null) => Promise<boolean>> = {
    // Training
    first_workout_logged: async (submitterType, submitterId) => {
        if (submitterType !== 'client') return false;
        const count = await prisma.workout_logs.count({ where: { client_id: submitterId, completed: true } });
        return count === 1;
    },
    workout_logs_10x: async (submitterType, submitterId) => {
        if (submitterType !== 'client') return false;
        const count = await prisma.workout_logs.count({ where: { client_id: submitterId, completed: true } });
        return count === 10;
    },
    first_training_plan_created: async (submitterType, submitterId) => {
        if (submitterType !== 'user') return false;
        const count = await prisma.training_plans.count({ where: { created_by: submitterId } });
        return count === 1;
    },
    first_training_plan_activated: async (submitterType, submitterId) => {
        if (submitterType !== 'user') return false;
        const count = await prisma.training_plans.count({ where: { created_by: submitterId, status: 'active' } });
        return count === 1;
    },
    first_custom_exercise_added: async (submitterType, submitterId, workspaceId) => {
        if (submitterType !== 'user' || !workspaceId) return false;
        const count = await prisma.exercise_library.count({ where: { workspace_id: workspaceId } });
        return count === 1;
    },

    // Nutrition
    nutrition_builder_used_10x: async (submitterType, submitterId) => {
        if (submitterType !== 'user') return false;
        const count = await prisma.nutrition_plans.count({ where: { created_by: submitterId } });
        return count >= 10;
    },
    first_nutrition_plan_activated: async (submitterType, submitterId) => {
        if (submitterType !== 'user') return false;
        const count = await prisma.nutrition_plans.count({ where: { created_by: submitterId, status: 'active' } });
        return count === 1;
    },
    first_custom_food_item_added: async (submitterType, submitterId, workspaceId) => {
        if (submitterType !== 'user' || !workspaceId) return false;
        const count = await prisma.food_items.count({ where: { workspace_id: workspaceId } });
        return count === 1;
    },

    // Forms / check-ins
    first_checkin_completed: async (submitterType, submitterId) => {
        if (submitterType !== 'client') return false;
        const count = await prisma.form_requests.count({ where: { client_id: submitterId, submitted_at: { not: null } } });
        return count === 1;
    },
    first_form_created: async (submitterType, submitterId, workspaceId) => {
        if (submitterType !== 'user' || !workspaceId) return false;
        const count = await prisma.forms.count({ where: { workspace_id: workspaceId } });
        return count === 1;
    },
    first_checkin_request_sent: async (submitterType, submitterId, workspaceId) => {
        if (submitterType !== 'user' || !workspaceId) return false;
        const count = await prisma.form_requests.count({ where: { workspace_id: workspaceId } });
        return count === 1;
    },
    first_checkin_reviewed: async (submitterType, submitterId, workspaceId) => {
        if (submitterType !== 'user' || !workspaceId) return false;
        const count = await prisma.form_requests.count({ where: { workspace_id: workspaceId, status: 'reviewed' } });
        return count === 1;
    },

    // Messenger
    first_message_sent_by_client: async (submitterType, submitterId) => {
        if (submitterType !== 'client') return false;
        const count = await prisma.messages.count({ where: { sender_type: 'client', sender_id: submitterId } });
        return count === 1;
    },
    first_message_sent_by_coach: async (submitterType, submitterId) => {
        if (submitterType !== 'user') return false;
        const count = await prisma.messages.count({ where: { sender_type: 'team', sender_id: submitterId } });
        return count === 1;
    },

    // Clients
    first_client_added: async (submitterType, submitterId, workspaceId) => {
        if (submitterType !== 'user' || !workspaceId) return false;
        const count = await prisma.clients.count({ where: { workspace_id: workspaceId } });
        return count === 1;
    },
    first_client_observation_logged: async (submitterType, submitterId, workspaceId) => {
        if (submitterType !== 'user' || !workspaceId) return false;
        const count = await prisma.client_observations.count({ where: { workspace_id: workspaceId } });
        return count === 1;
    },
    first_client_archived: async (submitterType, submitterId, workspaceId) => {
        if (submitterType !== 'user' || !workspaceId) return false;
        const count = await prisma.clients.count({ where: { workspace_id: workspaceId, archived_at: { not: null } } });
        return count === 1;
    },
    first_subscription_freeze_created: async (submitterType, submitterId, workspaceId) => {
        if (submitterType !== 'user' || !workspaceId) return false;
        const count = await prisma.subscription_freezes.count({ where: { clients: { workspace_id: workspaceId } } });
        return count === 1;
    },

    // Billing
    first_completed_transaction_logged: async (submitterType, submitterId, workspaceId) => {
        if (submitterType !== 'user' || !workspaceId) return false;
        const count = await prisma.transactions.count({ where: { workspace_id: workspaceId, status: 'completed' } });
        return count === 1;
    },
    first_refund_issued: async (submitterType, submitterId, workspaceId) => {
        if (submitterType !== 'user' || !workspaceId) return false;
        const count = await prisma.transactions.count({ where: { workspace_id: workspaceId, status: 'refunded' } });
        return count === 1;
    },
    first_workspace_subscription_paid: async (submitterType, submitterId, workspaceId) => {
        if (submitterType !== 'user' || !workspaceId) return false;
        const count = await prisma.workspace_payments.count({ where: { workspace_id: workspaceId, paid_at: { not: null } } });
        return count === 1;
    },

    // Packages
    first_package_created: async (submitterType, submitterId, workspaceId) => {
        if (submitterType !== 'user' || !workspaceId) return false;
        const count = await prisma.packages.count({ where: { workspace_id: workspaceId } });
        return count === 1;
    },
    first_package_variation_assigned_to_client: async (submitterType, submitterId, workspaceId) => {
        if (submitterType !== 'user' || !workspaceId) return false;
        const count = await prisma.clients.count({ where: { workspace_id: workspaceId, current_package_variation_id: { not: null } } });
        return count === 1;
    },

    // Team
    first_team_member_invited: async (submitterType, submitterId, workspaceId) => {
        if (submitterType !== 'user' || !workspaceId) return false;
        const count = await prisma.workspace_invitations.count({ where: { workspace_id: workspaceId } });
        return count === 1;
    },
    first_team_invitation_accepted: async (submitterType, submitterId) => {
        if (submitterType !== 'user') return false;
        const count = await prisma.workspace_invitations.count({ where: { invited_user_id: submitterId, status: 'accepted' } });
        return count === 1;
    },
};

export function isValidTriggerEvent(value: unknown): value is TriggerEvent {
    return TRIGGER_EVENTS.includes(value as TriggerEvent);
}

/**
 * The active, contextual prompt (if any) eligible for this submitter right
 * after `triggerEvent` fires — condition met, targeted at their audience,
 * scoped to their workspace, not yet answered, and not previously dismissed
 * (persisted — unlike the manual/session-only dismiss in Phase 2, a
 * contextual prompt tied to a repeatable action must stay dismissed or it
 * becomes a nag). Returns null fast if the trigger's condition isn't met, so
 * callers can fire this after every relevant action without extra guarding.
 */
export async function getPromptForTrigger(
    triggerEvent: TriggerEvent,
    audience: SubmitterType,
    workspaceId: string | null,
    submitterId: string,
): Promise<InsightPromptRow | null> {
    const conditionMet = await TRIGGER_CHECKS[triggerEvent](audience, submitterId, workspaceId);
    if (!conditionMet) return null;

    const rows = await prisma.$queryRaw<InsightPromptRow[]>`
        SELECT * FROM insight_prompts
        WHERE status = 'active'
          AND trigger_event = ${triggerEvent}
          AND target_audience IN (${audience}, 'everyone')
          AND NOT EXISTS (
              SELECT 1 FROM insights
              WHERE insights.prompt_id = insight_prompts.id AND insights.submitted_by_id = ${submitterId}
          )
          AND NOT EXISTS (
              SELECT 1 FROM insight_prompt_dismissals d
              WHERE d.prompt_id = insight_prompts.id
                AND d.submitted_by_type = ${audience}
                AND d.submitted_by_id = ${submitterId}
          )
          ${phase4EligibilityFragment(audience, workspaceId, submitterId)}
        ORDER BY created_at DESC
        LIMIT 1
    `;
    const prompt = rows[0] ?? null;
    if (prompt) await recordImpression(prompt.id, audience, submitterId);
    return prompt;
}

export async function recordDismissal(promptId: string, submitterType: SubmitterType, submitterId: string): Promise<void> {
    await prisma.insight_prompt_dismissals.create({
        data: { id: createId(), prompt_id: promptId, submitted_by_type: submitterType, submitted_by_id: submitterId },
    });
}

/** Phase 4 — the "started" ping the frontend fires on a prompt's first interaction (e.g. picking a rating before submitting). */
export async function recordImpressionStarted(promptId: string, submitterType: SubmitterType, submitterId: string): Promise<void> {
    await prisma.$executeRaw`
        UPDATE insight_prompt_impressions
        SET started_at = NOW()
        WHERE id = (
            SELECT id FROM insight_prompt_impressions
            WHERE prompt_id = ${promptId} AND submitted_by_type = ${submitterType} AND submitted_by_id = ${submitterId} AND started_at IS NULL
            ORDER BY viewed_at DESC
            LIMIT 1
        )
    `;
}

export interface PromptCondition {
    field: 'subscription_status' | 'package_variation_id';
    operator?: string;
    value: string;
}

export interface NewPromptInput {
    workspaceId: string | null;
    questionEn: string;
    questionAr?: string | null;
    responseType: 'rating' | 'multiple_choice' | 'text';
    options?: unknown;
    targetAudience: 'user' | 'client' | 'everyone';
    /** Phase 3: set for a contextual prompt, omit/null for the Phase 2 manual/immediate kind. */
    triggerEvent?: TriggerEvent | null;
    /** Phase 4 */
    startsAt?: Date | null;
    endsAt?: Date | null;
    maxShowsPerUser?: number | null;
    /** Opts this prompt out of the "one active question at a time" exclusivity entirely — for running a deliberate multi-campaign research push. */
    allowConcurrent?: boolean;
    /** Non-empty = target exactly these workspaces instead of the single workspaceId-or-platform-wide rule. */
    workspaceIds?: string[];
    conditions?: PromptCondition[];
}

/**
 * Activates a new prompt. Exclusivity is scoped to how the prompt is
 * delivered, not just its audience:
 *   - allowConcurrent skips exclusivity entirely — Phase 4's "run multiple
 *     campaigns at once" escape hatch.
 *   - Manual prompts (triggerEvent unset) still enforce "one active question
 *     at a time" among other manual, non-concurrent prompts with an
 *     overlapping audience — unchanged Phase 2 behavior.
 *   - Contextual prompts only compete with another active, non-concurrent
 *     prompt on the exact same trigger_event. Different triggers — and the
 *     manual prompt — are independent and can all be active simultaneously,
 *     since they're shown at different moments, not competing for the same
 *     "one thing visible right now" slot.
 */
export async function activatePrompt(input: NewPromptInput, actorId: string): Promise<InsightPromptRow> {
    return prisma.$transaction(async (tx) => {
        if (!input.allowConcurrent) {
            if (input.triggerEvent) {
                await tx.$executeRaw`
                    UPDATE insight_prompts
                    SET status = 'ended', ended_at = NOW()
                    WHERE status = 'active' AND trigger_event = ${input.triggerEvent} AND allow_concurrent = false
                `;
            } else {
                await tx.$executeRaw`
                    UPDATE insight_prompts
                    SET status = 'ended', ended_at = NOW()
                    WHERE status = 'active'
                      AND trigger_event IS NULL
                      AND allow_concurrent = false
                      AND (target_audience = ${input.targetAudience} OR target_audience = 'everyone' OR ${input.targetAudience} = 'everyone')
                      AND (workspace_id IS NULL OR ${input.workspaceId}::text IS NULL OR workspace_id = ${input.workspaceId})
                `;
            }
        }

        const id = createId();
        await tx.insight_prompts.create({
            data: {
                id,
                workspace_id: input.workspaceId,
                question_en: input.questionEn,
                question_ar: input.questionAr ?? null,
                response_type: input.responseType,
                options: input.options ?? undefined,
                target_audience: input.targetAudience,
                trigger_event: input.triggerEvent ?? null,
                status: 'active',
                created_by: actorId,
                starts_at: input.startsAt ?? null,
                ends_at: input.endsAt ?? null,
                max_shows_per_user: input.maxShowsPerUser ?? null,
                allow_concurrent: input.allowConcurrent ?? false,
            },
        });

        if (input.workspaceIds && input.workspaceIds.length > 0) {
            await tx.insight_prompt_workspaces.createMany({
                data: input.workspaceIds.map((workspaceId) => ({ id: createId(), prompt_id: id, workspace_id: workspaceId })),
            });
        }
        if (input.conditions && input.conditions.length > 0) {
            await tx.insight_prompt_conditions.createMany({
                data: input.conditions.map((c) => ({ id: createId(), prompt_id: id, field: c.field, operator: c.operator ?? 'eq', value: c.value })),
            });
        }

        const rows = await tx.$queryRaw<InsightPromptRow[]>`SELECT * FROM insight_prompts WHERE id = ${id}`;
        return rows[0];
    });
}

export async function endPrompt(id: string): Promise<void> {
    await prisma.insight_prompts.updateMany({
        where: { id, status: 'active' },
        data: { status: 'ended', ended_at: new Date() },
    });
}

export interface TriageInput {
    status?: 'new' | 'triaged' | 'resolved';
    roadmapItemId?: string;
    newRoadmapItemTitle?: string;
    note?: string | null;
}

/**
 * Admin triage: optionally links an insight to a roadmap item — creating one
 * on the spot from newRoadmapItemTitle if no existing id was given, so a good
 * idea never has to wait on a separate roadmap-planning step before it can be
 * credited — then updates status and logs the transition.
 */
export async function triageInsight(id: string, input: TriageInput, actorId: string): Promise<unknown> {
    return prisma.$transaction(async (tx) => {
        const existing = await tx.insights.findUnique({ where: { id } });
        if (!existing) throw Object.assign(new Error('Insight not found'), { status: 404 });

        let roadmapItemId = input.roadmapItemId ?? existing.roadmap_item_id ?? undefined;
        if (!roadmapItemId && input.newRoadmapItemTitle) {
            const created = await tx.roadmap_items.create({
                data: { id: createId(), title: input.newRoadmapItemTitle, status: 'proposed' },
            });
            roadmapItemId = created.id;
        }

        const nextStatus = input.status ?? existing.status;
        const updated = await tx.insights.update({
            where: { id },
            data: {
                status: nextStatus,
                roadmap_item_id: roadmapItemId,
                resolution_note: input.note ?? existing.resolution_note,
            },
        });

        if (nextStatus !== existing.status) {
            await tx.insight_events.create({
                data: {
                    id: createId(),
                    entity_type: 'insight',
                    entity_id: id,
                    from_status: existing.status,
                    to_status: nextStatus,
                    note: input.note ?? null,
                    actor_id: actorId,
                },
            });
        }

        return updated;
    });
}

const CLOSED_LOOP_COPY: Record<'shipped' | 'declined', { type: string; importance: 'actionable' | 'info'; title: string; body: (title: string, note: string | null) => string }> = {
    shipped: {
        type: 'insight.roadmap_shipped',
        importance: 'actionable',
        title: 'You asked, we listened 🎉',
        body: (title) => `${title} is now available.`,
    },
    declined: {
        type: 'insight.roadmap_declined',
        importance: 'info',
        title: 'An update on your feedback',
        body: (title, note) => `We looked into "${title}" and won't be building it right now${note ? ` — ${note}` : '.'}`,
    },
};

/**
 * Notifies everyone who submitted an insight linked to this roadmap item, via
 * lib/events.ts's recordEvent (the existing single choke point for
 * notifications + realtime) — deduped so a submitter with two linked insights
 * gets one notification, not two, and grouped by workspace_id since a
 * platform-wide roadmap item can aggregate insights from several workspaces
 * and each notification row requires exactly one workspace_id.
 */
export async function notifySubmittersForRoadmapItem(
    roadmapItemId: string,
    kind: 'shipped' | 'declined',
    note: string | null,
): Promise<void> {
    const [roadmapItem, insights] = await Promise.all([
        prisma.roadmap_items.findUnique({ where: { id: roadmapItemId } }),
        prisma.insights.findMany({
            where: { roadmap_item_id: roadmapItemId },
            select: { workspace_id: true, submitted_by_type: true, submitted_by_id: true },
        }),
    ]);
    if (!roadmapItem) return;

    const byWorkspace = new Map<string, Map<string, Recipient>>();
    for (const insight of insights) {
        if (!insight.workspace_id) continue;
        const key = `${insight.submitted_by_type}:${insight.submitted_by_id}`;
        if (!byWorkspace.has(insight.workspace_id)) byWorkspace.set(insight.workspace_id, new Map());
        byWorkspace.get(insight.workspace_id)!.set(key, {
            type: insight.submitted_by_type as SubmitterType,
            id: insight.submitted_by_id,
        });
    }

    const copy = CLOSED_LOOP_COPY[kind];
    await Promise.all(
        Array.from(byWorkspace.entries()).map(([workspaceId, recipients]) =>
            recordEvent({
                workspaceId,
                type: copy.type,
                importance: copy.importance,
                title: copy.title,
                body: copy.body(roadmapItem.title, note),
                recipients: Array.from(recipients.values()),
                actor: { type: 'system' },
                entity: { type: 'roadmap_item', id: roadmapItemId },
            }),
        ),
    );
}

/**
 * Updates a roadmap item's status, logs the transition, and — on the two
 * closing states — marks every linked insight resolved and fires the
 * closed-loop notification. This is the one function that ever transitions a
 * roadmap_items row, so "shipped"/"declined" always fans out consistently.
 */
export async function updateRoadmapItemStatus(
    id: string,
    newStatus: RoadmapStatus,
    releaseTag: string | null,
    note: string | null,
    actorId: string,
): Promise<unknown> {
    const existing = await prisma.roadmap_items.findUnique({ where: { id } });
    if (!existing) throw Object.assign(new Error('Roadmap item not found'), { status: 404 });

    const isClosing = newStatus === 'shipped' || newStatus === 'declined';

    const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.roadmap_items.update({
            where: { id },
            data: {
                status: newStatus,
                release_tag: releaseTag ?? existing.release_tag,
                resolved_at: isClosing ? new Date() : existing.resolved_at,
            },
        });

        if (newStatus !== existing.status) {
            await tx.insight_events.create({
                data: {
                    id: createId(),
                    entity_type: 'roadmap_item',
                    entity_id: id,
                    from_status: existing.status,
                    to_status: newStatus,
                    note,
                    actor_id: actorId,
                },
            });
        }

        if (isClosing) {
            await tx.insights.updateMany({
                where: { roadmap_item_id: id },
                data: { status: 'resolved' },
            });
        }

        return result;
    });

    if (isClosing) {
        await notifySubmittersForRoadmapItem(id, newStatus as 'shipped' | 'declined', note);
    }

    return updated;
}

export interface PromptFunnel {
    sent: number;
    started: number;
    completed: number;
    completionRate: number;
    /** Only for response_type = 'rating': average score plus a standard 0–10-scale NPS-style split (9–10 promoter, 7–8 passive, 0–6 detractor). */
    rating?: { average: number | null; promoters: number; passives: number; detractors: number };
    /** Only for response_type = 'multiple_choice': how many times each option was picked. */
    optionCounts?: Record<string, number>;
}

/**
 * Phase 4 analytics — the funnel (sent/viewed = impressions, started =
 * impressions with started_at set, completed = matching rows in the
 * existing `insights` table) plus a response breakdown shaped by the
 * prompt's response_type. "Sent" and "viewed" collapse to one number
 * because this system has no separate push channel — see
 * insight_prompt_impressions's schema comment.
 */
export async function getPromptFunnel(promptId: string): Promise<PromptFunnel> {
    const prompt = await prisma.insight_prompts.findUnique({ where: { id: promptId } });
    if (!prompt) throw Object.assign(new Error('Prompt not found'), { status: 404 });

    const [sent, started, responses] = await Promise.all([
        prisma.insight_prompt_impressions.count({ where: { prompt_id: promptId } }),
        prisma.insight_prompt_impressions.count({ where: { prompt_id: promptId, started_at: { not: null } } }),
        prisma.insights.findMany({ where: { prompt_id: promptId }, select: { rating_value: true, selected_option: true } }),
    ]);

    const completed = responses.length;
    const funnel: PromptFunnel = {
        sent,
        started,
        completed,
        completionRate: sent > 0 ? completed / sent : 0,
    };

    if (prompt.response_type === 'rating') {
        const ratings = responses.map((r) => r.rating_value).filter((v): v is number => v != null);
        funnel.rating = {
            average: ratings.length > 0 ? ratings.reduce((a, b) => a + b, 0) / ratings.length : null,
            promoters: ratings.filter((v) => v >= 9).length,
            passives: ratings.filter((v) => v >= 7 && v <= 8).length,
            detractors: ratings.filter((v) => v <= 6).length,
        };
    } else if (prompt.response_type === 'multiple_choice') {
        const counts: Record<string, number> = {};
        for (const r of responses) {
            if (r.selected_option) counts[r.selected_option] = (counts[r.selected_option] ?? 0) + 1;
        }
        funnel.optionCounts = counts;
    }

    return funnel;
}

/**
 * Phase 4 scheduling — ends any prompt whose ends_at has passed. Called from
 * a cron tick (see middleware/scheduler.ts's scheduleInsightPromptExpiry),
 * matching this codebase's existing in-process scheduler pattern (§11).
 */
export async function expireScheduledPrompts(): Promise<number> {
    const { count } = await prisma.insight_prompts.updateMany({
        where: { status: 'active', ends_at: { lt: new Date() } },
        data: { status: 'ended', ended_at: new Date() },
    });
    return count;
}
