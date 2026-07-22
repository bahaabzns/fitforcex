import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../../lib/prisma';
import { makeUploader, toPublicUrl } from '../../lib/storage';
import * as insightsService from './insights.service';

export const screenshotUploader = makeUploader(
    'insight-screenshots',
    ['.jpg', '.jpeg', '.png', '.webp'],
    { maxSize: 8 * 1024 * 1024 },
);

export async function uploadScreenshot(req: Request, res: Response): Promise<void> {
    const file = req.file as (Express.Multer.File & { key?: string; location?: string }) | undefined;
    if (!file) { res.status(400).json({ error: 'No file uploaded' }); return; }
    const key = file.key ?? file.path;
    res.status(201).json({ url: toPublicUrl(key) });
}

const SOURCE_TYPES = ['bug', 'feature_request', 'rating'];

function isValidSourceType(value: unknown): value is 'bug' | 'feature_request' | 'rating' {
    return SOURCE_TYPES.includes(value as string);
}

/**
 * Coach submits organic feedback — a bug report, a feature request, or a
 * standalone rating. Not tied to any insight_prompt (source_type is never
 * 'prompt_response' here — see respondToPrompt for that path).
 */
export async function submitInsight(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { sourceType, textValue, ratingValue, module, appVersion, screenshotUrl } = req.body as Record<string, unknown>;

    if (!isValidSourceType(sourceType)) {
        res.status(400).json({ error: 'sourceType must be one of bug, feature_request, rating' });
        return;
    }
    if (sourceType === 'rating') {
        const rating = Number(ratingValue);
        if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
            res.status(400).json({ error: 'ratingValue must be an integer between 1 and 10' });
            return;
        }
    } else if (typeof textValue !== 'string' || textValue.trim().length === 0) {
        res.status(400).json({ error: 'textValue is required' });
        return;
    }

    try {
        const insight = await prisma.insights.create({
            data: {
                id: createId(),
                workspace_id: req.user!.workspaceId,
                source_type: sourceType,
                submitted_by_type: 'user',
                submitted_by_id: req.user!.userId,
                module: (module as string | undefined) ?? null,
                app_version: (appVersion as string | undefined) ?? null,
                rating_value: sourceType === 'rating' ? Number(ratingValue) : null,
                text_value: sourceType === 'rating' ? null : (textValue as string),
                screenshot_url: (screenshotUrl as string | undefined) ?? null,
                status: 'new',
            },
        });
        res.status(201).json(insight);
    } catch (err) {
        next(err);
    }
}

export async function listMyInsights(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const rows = await prisma.insights.findMany({
            where: {
                workspace_id: req.user!.workspaceId,
                submitted_by_type: 'user',
                submitted_by_id: req.user!.userId,
            },
            orderBy: { created_at: 'desc' },
        });
        res.json(rows);
    } catch (err) {
        next(err);
    }
}

export async function getActivePromptForCoach(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const prompt = await insightsService.getActivePrompt('user', req.user!.workspaceId, req.user!.userId);
        res.json(prompt);
    } catch (err) {
        next(err);
    }
}

/**
 * Phase 3 — called by the frontend right after a trigger-eligible action
 * succeeds (e.g. right after the coach's Nth nutrition plan save). Not a
 * generic event bus: the caller names the exact event, the server only
 * checks whether that named condition is true for them right now.
 */
export async function getPromptForTrigger(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { event } = req.params;
    if (!insightsService.isValidTriggerEvent(event)) {
        res.status(400).json({ error: `Unknown trigger event: ${event}` });
        return;
    }
    try {
        const prompt = await insightsService.getPromptForTrigger(event, 'user', req.user!.workspaceId, req.user!.userId);
        res.json(prompt);
    } catch (err) {
        next(err);
    }
}

export async function dismissPrompt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        await insightsService.recordDismissal(req.params.id as string, 'user', req.user!.userId);
        res.json({ dismissed: true });
    } catch (err) {
        next(err);
    }
}

export async function startPrompt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        await insightsService.recordImpressionStarted(req.params.id as string, 'user', req.user!.userId);
        res.json({ started: true });
    } catch (err) {
        next(err);
    }
}

async function respondToPromptShared(
    promptId: string,
    body: Record<string, unknown>,
    submittedByType: 'user' | 'client',
    submittedById: string,
    workspaceId: string | null,
): Promise<{ status: number; payload: unknown }> {
    const prompt = await prisma.insight_prompts.findUnique({ where: { id: promptId } });
    if (!prompt || prompt.status !== 'active') {
        return { status: 404, payload: { error: 'This question is no longer active' } };
    }

    const { ratingValue, selectedOption, textValue } = body;
    const data: Record<string, unknown> = {
        id: createId(),
        workspace_id: workspaceId,
        source_type: 'prompt_response',
        prompt_id: promptId,
        submitted_by_type: submittedByType,
        submitted_by_id: submittedById,
        status: 'new',
    };

    if (prompt.response_type === 'rating') {
        const rating = Number(ratingValue);
        if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
            return { status: 400, payload: { error: 'ratingValue must be an integer between 1 and 10' } };
        }
        data.rating_value = rating;
    } else if (prompt.response_type === 'multiple_choice') {
        const options = Array.isArray(prompt.options) ? (prompt.options as unknown[]) : [];
        if (typeof selectedOption !== 'string' || !options.includes(selectedOption)) {
            return { status: 400, payload: { error: 'selectedOption must be one of the prompt options' } };
        }
        data.selected_option = selectedOption;
    } else if (prompt.response_type === 'rating_with_text') {
        // Rating is required; the accompanying note is optional, unlike the plain 'rating' and 'text' types.
        const rating = Number(ratingValue);
        if (!Number.isInteger(rating) || rating < 1 || rating > 10) {
            return { status: 400, payload: { error: 'ratingValue must be an integer between 1 and 10' } };
        }
        data.rating_value = rating;
        if (typeof textValue === 'string' && textValue.trim().length > 0) {
            data.text_value = textValue.trim();
        }
    } else {
        if (typeof textValue !== 'string' || textValue.trim().length === 0) {
            return { status: 400, payload: { error: 'textValue is required' } };
        }
        data.text_value = textValue;
    }

    const insight = await prisma.insights.create({ data: data as never });
    return { status: 201, payload: insight };
}

export async function respondToPrompt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { status, payload } = await respondToPromptShared(
            req.params.id as string,
            req.body as Record<string, unknown>,
            'user',
            req.user!.userId,
            req.user!.workspaceId,
        );
        res.status(status).json(payload);
    } catch (err) {
        next(err);
    }
}

export { respondToPromptShared };
