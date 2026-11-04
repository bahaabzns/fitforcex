import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { recordVisit } from './tracking.service';

const BOT_USER_AGENT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse/i;

const optionalText = (max: number) => z.string().trim().max(max).nullish().transform(value => value || null);

const visitSchema = z.object({
    visitorId:   z.string().uuid(),
    path:        z.string().trim().min(1).max(200),
    referrer:    optionalText(500),
    utmSource:   optionalText(100),
    utmMedium:   optionalText(100),
    utmCampaign: optionalText(150),
    hasFbclid:   z.boolean().optional(),
});

export async function trackVisit(req: Request, res: Response, next: NextFunction) {
    try {
        const parsed = visitSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: 'Invalid visit payload' });

        // Crawlers and link-preview fetchers would otherwise inflate "sessions before subscribing".
        if (BOT_USER_AGENT.test(req.headers['user-agent'] ?? '')) return res.status(204).end();

        await recordVisit(parsed.data);
        res.status(204).end();
    } catch (err) {
        next(err);
    }
}
