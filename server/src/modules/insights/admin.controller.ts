import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../../lib/prisma';
import * as insightsService from './insights.service';

function adminActorId(req: Request): string {
    // adminAuthMiddleware decodes the admin JWT onto req.admin; its shape is
    // intentionally loose ({ isAdmin: boolean; [key: string]: unknown }), so
    // pull whichever id claim the token carries rather than assuming one key.
    const admin = req.admin as Record<string, unknown> | undefined;
    return (admin?.id as string | undefined) ?? (admin?.adminId as string | undefined) ?? 'admin';
}

// ── Insights inbox ──────────────────────────────────────────────────────────

export async function listInsights(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { status, sourceType, workspaceId } = req.query as Record<string, string | undefined>;
        const rows = await prisma.insights.findMany({
            where: {
                ...(status ? { status } : {}),
                ...(sourceType ? { source_type: sourceType } : {}),
                ...(workspaceId ? { workspace_id: workspaceId } : {}),
                archived_at: null,
            },
            orderBy: { created_at: 'desc' },
        });
        res.json(rows);
    } catch (err) {
        next(err);
    }
}

export async function triageInsight(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { status, roadmapItemId, newRoadmapItemTitle, note } = req.body as Record<string, unknown>;
        const updated = await insightsService.triageInsight(
            req.params.id as string,
            {
                status: status as 'new' | 'triaged' | 'resolved' | undefined,
                roadmapItemId: roadmapItemId as string | undefined,
                newRoadmapItemTitle: newRoadmapItemTitle as string | undefined,
                note: (note as string | undefined) ?? null,
            },
            adminActorId(req),
        );
        res.json(updated);
    } catch (err) {
        next(err);
    }
}

// ── Prompts ──────────────────────────────────────────────────────────────

const RESPONSE_TYPES = ['rating', 'multiple_choice', 'text'];
const AUDIENCES = ['user', 'client', 'everyone'];

export async function listPrompts(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { status } = req.query as Record<string, string | undefined>;
        const rows = await prisma.insight_prompts.findMany({
            where: status ? { status } : {},
            orderBy: { created_at: 'desc' },
        });
        res.json(rows);
    } catch (err) {
        next(err);
    }
}

const CONDITION_FIELDS = ['subscription_status', 'package_variation_id'];

export async function createPrompt(req: Request, res: Response, next: NextFunction): Promise<void> {
    const {
        workspaceId, questionEn, questionAr, responseType, options, targetAudience, triggerEvent,
        startsAt, endsAt, maxShowsPerUser, allowConcurrent, workspaceIds, conditions,
    } = req.body as Record<string, unknown>;

    if (typeof questionEn !== 'string' || questionEn.trim().length === 0) {
        res.status(400).json({ error: 'questionEn is required' });
        return;
    }
    if (!RESPONSE_TYPES.includes(responseType as string)) {
        res.status(400).json({ error: `responseType must be one of ${RESPONSE_TYPES.join(', ')}` });
        return;
    }
    if (responseType === 'multiple_choice' && (!Array.isArray(options) || options.length < 2)) {
        res.status(400).json({ error: 'options must be an array of at least 2 choices for multiple_choice prompts' });
        return;
    }
    if (triggerEvent != null && !insightsService.isValidTriggerEvent(triggerEvent)) {
        res.status(400).json({ error: `triggerEvent must be one of ${insightsService.TRIGGER_EVENTS.join(', ')}` });
        return;
    }
    if (workspaceIds != null && !Array.isArray(workspaceIds)) {
        res.status(400).json({ error: 'workspaceIds must be an array of workspace ids' });
        return;
    }
    let parsedConditions: insightsService.PromptCondition[] | undefined;
    if (conditions != null) {
        if (!Array.isArray(conditions) || conditions.some((c) => !CONDITION_FIELDS.includes(c?.field) || typeof c?.value !== 'string')) {
            res.status(400).json({ error: `each condition needs a field (${CONDITION_FIELDS.join(', ')}) and a value` });
            return;
        }
        parsedConditions = conditions as insightsService.PromptCondition[];
    }
    const audience = AUDIENCES.includes(targetAudience as string) ? (targetAudience as string) : 'everyone';

    try {
        const prompt = await insightsService.activatePrompt(
            {
                workspaceId: (workspaceId as string | undefined) ?? null,
                questionEn,
                questionAr: (questionAr as string | undefined) ?? null,
                responseType: responseType as 'rating' | 'multiple_choice' | 'text',
                options: responseType === 'multiple_choice' ? options : undefined,
                targetAudience: audience as 'user' | 'client' | 'everyone',
                triggerEvent: (triggerEvent as insightsService.TriggerEvent | undefined) ?? null,
                startsAt: startsAt ? new Date(startsAt as string) : null,
                endsAt: endsAt ? new Date(endsAt as string) : null,
                maxShowsPerUser: typeof maxShowsPerUser === 'number' ? maxShowsPerUser : null,
                allowConcurrent: allowConcurrent === true,
                workspaceIds: workspaceIds as string[] | undefined,
                conditions: parsedConditions,
            },
            adminActorId(req),
        );
        res.status(201).json(prompt);
    } catch (err) {
        next(err);
    }
}

export async function getPromptAnalytics(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const funnel = await insightsService.getPromptFunnel(req.params.id as string);
        res.json(funnel);
    } catch (err) {
        next(err);
    }
}

export async function endPromptHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        await insightsService.endPrompt(req.params.id as string);
        res.json({ ended: true });
    } catch (err) {
        next(err);
    }
}

// ── Roadmap ──────────────────────────────────────────────────────────────

interface RoadmapItemStatsRow {
    id: string;
    workspace_id: string | null;
    title: string;
    status: string;
    release_tag: string | null;
    created_at: Date;
    resolved_at: Date | null;
    insight_count: number;
    avg_rating: number | null;
}

export async function listRoadmapItems(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        // The free prioritization signal from §8/§12 of the architecture memo —
        // "N people asked for this" falls straight out of counting insights
        // per roadmap item, no separate tracking needed.
        const rows = await prisma.$queryRaw<RoadmapItemStatsRow[]>`
            SELECT r.*,
                   COUNT(i.id)::int AS insight_count,
                   AVG(i.rating_value)::float AS avg_rating
            FROM roadmap_items r
            LEFT JOIN insights i ON i.roadmap_item_id = r.id
            WHERE r.archived_at IS NULL
            GROUP BY r.id
            ORDER BY r.created_at DESC
        `;
        res.json(rows);
    } catch (err) {
        next(err);
    }
}

export async function createRoadmapItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { title, workspaceId } = req.body as Record<string, unknown>;
    if (typeof title !== 'string' || title.trim().length === 0) {
        res.status(400).json({ error: 'title is required' });
        return;
    }
    try {
        const item = await prisma.roadmap_items.create({
            data: { id: createId(), title, workspace_id: (workspaceId as string | undefined) ?? null, status: 'proposed' },
        });
        res.status(201).json(item);
    } catch (err) {
        next(err);
    }
}

const ROADMAP_STATUSES = ['proposed', 'planned', 'in_progress', 'shipped', 'declined'];

export async function updateRoadmapItem(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { status, releaseTag, note } = req.body as Record<string, unknown>;
    if (!ROADMAP_STATUSES.includes(status as string)) {
        res.status(400).json({ error: `status must be one of ${ROADMAP_STATUSES.join(', ')}` });
        return;
    }
    try {
        const updated = await insightsService.updateRoadmapItemStatus(
            req.params.id as string,
            status as insightsService.RoadmapStatus,
            (releaseTag as string | undefined) ?? null,
            (note as string | undefined) ?? null,
            adminActorId(req),
        );
        res.json(updated);
    } catch (err) {
        next(err);
    }
}
