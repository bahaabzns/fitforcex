import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../../lib/prisma';
import { getYoutubeVideoId } from '../../utils/youtube';

// Coach-portal tutorial videos, one per page_key (see client/app/lib/tutorialPages.js
// for the canonical list of page keys). Platform-wide, not tenant-scoped.

export async function listTutorials(_req: Request, res: Response, next: NextFunction) {
    try {
        const tutorials = await prisma.page_tutorials.findMany({ orderBy: { page_key: 'asc' } });
        res.json(tutorials);
    } catch (err) { next(err); }
}

// Upserts the single tutorial for a page key — routes.ts documents this as PUT
// /admin/tutorials/{pageKey}, so the page key is the identity, not a row id.
export async function upsertTutorial(req: Request, res: Response, next: NextFunction) {
    try {
        const pageKey = req.params.pageKey as string;
        const { youtube_url, title } = req.body as Record<string, unknown>;

        const url = typeof youtube_url === 'string' ? youtube_url.trim() : '';
        if (!url) return res.status(400).json({ message: 'youtube_url is required' });
        if (!getYoutubeVideoId(url)) return res.status(400).json({ message: 'Not a recognizable YouTube URL' });

        const trimmedTitle = typeof title === 'string' ? title.trim() : '';

        const tutorial = await prisma.page_tutorials.upsert({
            where: { page_key: pageKey },
            create: { id: createId(), page_key: pageKey, youtube_url: url, title: trimmedTitle || null },
            update: { youtube_url: url, title: trimmedTitle || null, updated_at: new Date() },
        });
        res.json(tutorial);
    } catch (err) { next(err); }
}

export async function deleteTutorial(req: Request, res: Response, next: NextFunction) {
    try {
        await prisma.page_tutorials.delete({ where: { page_key: req.params.pageKey as string } });
        res.status(204).end();
    } catch (err) {
        // Deleting an already-absent assignment is a no-op from the caller's perspective.
        const prismaErr = err as { code?: string };
        if (prismaErr.code === 'P2025') return res.status(204).end();
        next(err);
    }
}
