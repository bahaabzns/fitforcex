import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';

// Read-only for the coach portal — assignment/editing happens through the
// admin module (server/src/modules/admin/tutorials.controller.ts).
export async function listTutorials(_req: Request, res: Response, next: NextFunction) {
    try {
        const tutorials = await prisma.page_tutorials.findMany({
            select: { page_key: true, youtube_url: true, title: true },
        });
        res.json(tutorials);
    } catch (err) { next(err); }
}
