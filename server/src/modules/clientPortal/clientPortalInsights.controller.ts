import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../../lib/prisma';
import * as insightsService from '../insights/insights.service';
import { respondToPromptShared } from '../insights/insights.controller';

const SOURCE_TYPES = ['bug', 'feature_request', 'rating'];

/**
 * Client-portal side of the Insights System. A thin wrapper delegating to
 * insights.service.ts / insights.controller.ts for all real logic — mirrors
 * how clientPortalNotifications.controller.ts wraps the shared notifications
 * concept, rather than duplicating business logic across modules.
 */
export async function submitInsight(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { sourceType, textValue, ratingValue, module, appVersion, screenshotUrl } = req.body as Record<string, unknown>;

    if (!SOURCE_TYPES.includes(sourceType as string)) {
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
                workspace_id: req.client!.workspaceId,
                source_type: sourceType as string,
                submitted_by_type: 'client',
                submitted_by_id: req.client!.clientId,
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

export async function getActivePrompt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const prompt = await insightsService.getActivePrompt('client', req.client!.workspaceId, req.client!.clientId);
        res.json(prompt);
    } catch (err) {
        next(err);
    }
}

export async function respondToPrompt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        const { status, payload } = await respondToPromptShared(
            req.params.id as string,
            req.body as Record<string, unknown>,
            'client',
            req.client!.clientId,
            req.client!.workspaceId,
        );
        res.status(status).json(payload);
    } catch (err) {
        next(err);
    }
}

export async function getPromptForTrigger(req: Request, res: Response, next: NextFunction): Promise<void> {
    const { event } = req.params;
    if (!insightsService.isValidTriggerEvent(event)) {
        res.status(400).json({ error: `Unknown trigger event: ${event}` });
        return;
    }
    try {
        const prompt = await insightsService.getPromptForTrigger(event, 'client', req.client!.workspaceId, req.client!.clientId);
        res.json(prompt);
    } catch (err) {
        next(err);
    }
}

export async function dismissPrompt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        await insightsService.recordDismissal(req.params.id as string, 'client', req.client!.clientId);
        res.json({ dismissed: true });
    } catch (err) {
        next(err);
    }
}

export async function startPrompt(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
        await insightsService.recordImpressionStarted(req.params.id as string, 'client', req.client!.clientId);
        res.json({ started: true });
    } catch (err) {
        next(err);
    }
}
