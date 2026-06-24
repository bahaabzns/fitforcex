import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../../lib/prisma';
import { recordEvent } from '../../lib/events';

type ThreadRow = {
    id: string; client_id: string; status: string; updated_at: Date;
    fname: string; lname: string;
    latest_message: string | null; latest_message_at: Date | null;
    unread_count: number;
};

export async function getThreads(req: Request, res: Response, next: NextFunction) {
    try {
        const rows = await prisma.$queryRaw<ThreadRow[]>`
            SELECT
                t.id, t.client_id, t.status, t.updated_at,
                c.fname, c.lname,
                (SELECT body FROM messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS latest_message,
                (SELECT created_at FROM messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1) AS latest_message_at,
                (SELECT COUNT(*) FROM messages m WHERE m.thread_id = t.id AND m.sender_type = 'client' AND m.read_by_team_at IS NULL)::int AS unread_count
            FROM threads t
            JOIN clients c ON c.id = t.client_id
            WHERE t.workspace_id = ${req.user!.workspaceId}
            ORDER BY COALESCE(
                (SELECT created_at FROM messages m WHERE m.thread_id = t.id ORDER BY m.created_at DESC LIMIT 1),
                t.created_at
            ) DESC
        `;
        res.json(rows);
    } catch (err) { next(err); }
}

export async function createThread(req: Request, res: Response, next: NextFunction) {
    const { clientId } = req.body as { clientId?: string };
    if (!clientId) return res.status(400).json({ error: 'clientId is required' });

    try {
        const clientExists = await prisma.clients.findFirst({
            where: { id: clientId, workspace_id: req.user!.workspaceId },
            select: { id: true },
        });
        if (!clientExists) return res.status(404).json({ error: 'Client not found' });

        const thread = await prisma.threads.upsert({
            where: { workspace_id_client_id: { workspace_id: req.user!.workspaceId, client_id: clientId } },
            create: { id: createId(), workspace_id: req.user!.workspaceId, client_id: clientId },
            update: {},
        });

        res.status(201).json(thread);
    } catch (err) { next(err); }
}

export async function getMessages(req: Request, res: Response, next: NextFunction) {
    const threadId = req.params.threadId as string;
    try {
        const thread = await prisma.threads.findFirst({
            where: { id: threadId, workspace_id: req.user!.workspaceId },
            select: { id: true },
        });
        if (!thread) return res.status(404).json({ error: 'Thread not found' });

        await prisma.messages.updateMany({
            where: { thread_id: threadId, sender_type: 'client', read_by_team_at: null },
            data:  { read_by_team_at: new Date() },
        });

        const messages = await prisma.messages.findMany({
            where: { thread_id: threadId },
            select: {
                id: true, sender_type: true, sender_id: true, body: true,
                read_by_team_at: true, read_by_client_at: true, created_at: true,
            },
            orderBy: { created_at: 'asc' },
        });

        res.json(messages);
    } catch (err) { next(err); }
}

export async function sendMessage(req: Request, res: Response, next: NextFunction) {
    const { body } = req.body as { body?: string };
    if (!body || !body.trim()) return res.status(400).json({ error: 'Message body is required' });
    if (body.trim().length > 5000) return res.status(400).json({ error: 'Message exceeds 5000 character limit' });

    const threadId = req.params.threadId as string;
    try {
        const thread = await prisma.threads.findFirst({
            where: { id: threadId, workspace_id: req.user!.workspaceId },
            select: { id: true, client_id: true },
        });
        if (!thread) return res.status(404).json({ error: 'Thread not found' });

        const message = await prisma.messages.create({
            data: {
                id:              createId(),
                thread_id:       threadId,
                sender_type:     'team',
                sender_id:       req.user!.userId,
                body:            body.trim(),
                read_by_team_at: new Date(),
            },
        });

        await prisma.threads.update({
            where: { id: threadId },
            data:  { updated_at: new Date() },
        });

        // Durable: notify the client of their coach's message. Realtime: keep the
        // legacy workspace-room `new_message` so open coach threads still live-sync.
        await recordEvent({
            workspaceId: req.user!.workspaceId,
            type:        'message.received',
            importance:  'actionable',
            title:       'New message from your coach',
            recipients:  [{ type: 'client', id: thread.client_id }],
            actor:       { type: 'user', id: req.user!.userId },
            entity:      { type: 'thread', id: threadId },
            realtime:    { rooms: [`workspace:${req.user!.workspaceId}`], event: 'new_message', payload: { threadId, message } },
        });

        res.status(201).json(message);
    } catch (err) { next(err); }
}

export async function updateThreadStatus(req: Request, res: Response, next: NextFunction) {
    const { status } = req.body as { status?: string };
    if (!['open', 'closed'].includes(status!)) {
        return res.status(400).json({ error: 'status must be open or closed' });
    }
    const threadId = req.params.threadId as string;
    try {
        const updated = await prisma.threads.updateMany({
            where: { id: threadId, workspace_id: req.user!.workspaceId },
            data:  { status: status!, updated_at: new Date() },
        });
        if (updated.count === 0) return res.status(404).json({ error: 'Thread not found' });

        const thread = await prisma.threads.findUnique({ where: { id: threadId } });
        res.json(thread);
    } catch (err) { next(err); }
}
