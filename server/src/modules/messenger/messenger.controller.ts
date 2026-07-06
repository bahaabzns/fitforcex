import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../../lib/prisma';
import { recordEvent } from '../../lib/events';
import { deleteFile } from '../../lib/storage';
import { attachmentTypeFromMime, serializeMessage, MESSAGE_SELECT } from '../../lib/messageAttachments';

/** Display name for a notification's `metadata.actorName` — best-effort, null on any miss. */
async function getUserDisplayName(userId: string): Promise<string | null> {
    const user = await prisma.users.findUnique({ where: { id: userId }, select: { fname: true, lname: true } });
    if (!user) return null;
    return `${user.fname} ${user.lname}`.trim() || null;
}

type ThreadRow = {
    id: string; client_id: string; status: string; updated_at: Date;
    fname: string; lname: string; client_code: string | null;
    current_package: string | null; subscription_status: string;
    latest_message: string | null; latest_message_at: Date | null;
    latest_message_sender_type: string | null;
    latest_message_type: string | null;
    latest_message_attachment_name: string | null;
    latest_message_deleted_at: Date | null;
    unread_count: number;
};

export async function getThreads(req: Request, res: Response, next: NextFunction) {
    try {
        const rows = await prisma.$queryRaw<ThreadRow[]>`
            SELECT
                t.id, t.client_id, t.status, t.updated_at,
                c.fname, c.lname, c.client_code, c.current_package, c.subscription_status,
                lm.body AS latest_message,
                lm.created_at AS latest_message_at,
                lm.sender_type AS latest_message_sender_type,
                lm.type AS latest_message_type,
                lm.attachment_name AS latest_message_attachment_name,
                lm.deleted_at AS latest_message_deleted_at,
                (SELECT COUNT(*) FROM messages m WHERE m.thread_id = t.id AND m.sender_type = 'client' AND m.read_by_team_at IS NULL AND m.deleted_at IS NULL)::int AS unread_count
            FROM threads t
            JOIN clients c ON c.id = t.client_id
            LEFT JOIN LATERAL (
                SELECT body, created_at, sender_type, type, attachment_name, deleted_at
                FROM messages m
                WHERE m.thread_id = t.id
                ORDER BY m.created_at DESC
                LIMIT 1
            ) lm ON true
            WHERE t.workspace_id = ${req.user!.workspaceId}
            ORDER BY COALESCE(lm.created_at, t.created_at) DESC
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

        // Keep the bell badge in sync with the thread list's own unread signal —
        // opening the thread (from anywhere, not just a notification click) should
        // clear this user's notification for it too.
        await prisma.notifications.updateMany({
            where: {
                workspace_id:   req.user!.workspaceId,
                recipient_type: 'user',
                recipient_id:   req.user!.userId,
                entity_type:    'thread',
                entity_id:      threadId,
                read_at:        null,
            },
            data: { read_at: new Date() },
        });

        const messages = await prisma.messages.findMany({
            where:   { thread_id: threadId },
            select:  MESSAGE_SELECT,
            orderBy: { created_at: 'asc' },
        });

        res.json(messages.map(serializeMessage));
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
            metadata:    { actorName: await getUserDisplayName(req.user!.userId) },
            realtime:    { rooms: [`workspace:${req.user!.workspaceId}`], event: 'new_message', payload: { threadId, message } },
        });

        res.status(201).json(serializeMessage(message));
    } catch (err) { next(err); }
}

export async function sendAttachment(req: Request, res: Response, next: NextFunction) {
    const file = req.file as (Express.Multer.File & { key?: string }) | undefined;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const threadId = req.params.threadId as string;
    const { body, durationSeconds } = req.body as { body?: string; durationSeconds?: string };

    try {
        const thread = await prisma.threads.findFirst({
            where: { id: threadId, workspace_id: req.user!.workspaceId },
            select: { id: true, client_id: true },
        });
        if (!thread) return res.status(404).json({ error: 'Thread not found' });

        const key  = file.key ?? file.path;
        const type = attachmentTypeFromMime(file.mimetype);

        const message = await prisma.messages.create({
            data: {
                id:                  createId(),
                thread_id:           threadId,
                sender_type:         'team',
                sender_id:           req.user!.userId,
                body:                body?.trim() || null,
                type,
                attachment_url:      key,
                attachment_name:     file.originalname,
                attachment_size:     file.size,
                attachment_mime:     file.mimetype,
                attachment_duration: type === 'voice' && durationSeconds ? Math.round(Number(durationSeconds)) : null,
                read_by_team_at:     new Date(),
            },
        });

        await prisma.threads.update({
            where: { id: threadId },
            data:  { updated_at: new Date() },
        });

        const serialized = serializeMessage(message);
        await recordEvent({
            workspaceId: req.user!.workspaceId,
            type:        'message.received',
            importance:  'actionable',
            title:       'New message from your coach',
            recipients:  [{ type: 'client', id: thread.client_id }],
            actor:       { type: 'user', id: req.user!.userId },
            entity:      { type: 'thread', id: threadId },
            metadata:    { actorName: await getUserDisplayName(req.user!.userId) },
            realtime:    { rooms: [`workspace:${req.user!.workspaceId}`], event: 'new_message', payload: { threadId, message: serialized } },
        });

        res.status(201).json(serialized);
    } catch (err) { next(err); }
}

export async function editMessage(req: Request, res: Response, next: NextFunction) {
    const { body } = req.body as { body?: string };
    if (!body || !body.trim()) return res.status(400).json({ error: 'Message body is required' });
    if (body.trim().length > 5000) return res.status(400).json({ error: 'Message exceeds 5000 character limit' });

    const threadId  = req.params.threadId as string;
    const messageId = req.params.messageId as string;
    try {
        const thread = await prisma.threads.findFirst({
            where: { id: threadId, workspace_id: req.user!.workspaceId },
            select: { id: true },
        });
        if (!thread) return res.status(404).json({ error: 'Thread not found' });

        const existing = await prisma.messages.findFirst({ where: { id: messageId, thread_id: threadId } });
        if (!existing || existing.deleted_at) return res.status(404).json({ error: 'Message not found' });
        if (existing.sender_type !== 'team') return res.status(403).json({ error: 'You can only edit your own messages' });
        if (existing.type !== 'text') return res.status(400).json({ error: 'Only text messages can be edited' });

        const message = await prisma.messages.update({
            where: { id: messageId },
            data:  { body: body.trim(), edited_at: new Date() },
            select: MESSAGE_SELECT,
        });

        res.json(serializeMessage(message));
    } catch (err) { next(err); }
}

export async function deleteMessage(req: Request, res: Response, next: NextFunction) {
    const threadId  = req.params.threadId as string;
    const messageId = req.params.messageId as string;
    try {
        const thread = await prisma.threads.findFirst({
            where: { id: threadId, workspace_id: req.user!.workspaceId },
            select: { id: true },
        });
        if (!thread) return res.status(404).json({ error: 'Thread not found' });

        const existing = await prisma.messages.findFirst({ where: { id: messageId, thread_id: threadId } });
        if (!existing || existing.deleted_at) return res.status(404).json({ error: 'Message not found' });
        if (existing.sender_type !== 'team') return res.status(403).json({ error: 'You can only delete your own messages' });

        if (existing.attachment_url) await deleteFile(existing.attachment_url);

        const message = await prisma.messages.update({
            where: { id: messageId },
            data: {
                deleted_at:          new Date(),
                body:                null,
                attachment_url:      null,
                attachment_name:     null,
                attachment_size:     null,
                attachment_mime:     null,
                attachment_duration: null,
            },
            select: MESSAGE_SELECT,
        });

        res.json(serializeMessage(message));
    } catch (err) { next(err); }
}

const MAX_BROADCAST_THREADS = 500;

export async function broadcastMessage(req: Request, res: Response, next: NextFunction) {
    const { threadIds, body } = req.body as { threadIds?: string[]; body?: string };
    if (!body || !body.trim()) return res.status(400).json({ error: 'Message body is required' });
    if (body.trim().length > 5000) return res.status(400).json({ error: 'Message exceeds 5000 character limit' });
    if (!Array.isArray(threadIds) || threadIds.length === 0) {
        return res.status(400).json({ error: 'threadIds must be a non-empty array' });
    }
    if (threadIds.length > MAX_BROADCAST_THREADS) {
        return res.status(400).json({ error: `Cannot broadcast to more than ${MAX_BROADCAST_THREADS} conversations at once` });
    }

    try {
        const threads = await prisma.threads.findMany({
            where:  { id: { in: threadIds }, workspace_id: req.user!.workspaceId },
            select: { id: true, client_id: true },
        });
        if (threads.length === 0) return res.status(404).json({ error: 'No matching conversations found' });

        const trimmedBody = body.trim();
        const now = new Date();

        const messages = await prisma.$transaction(
            threads.map(thread => prisma.messages.create({
                data: {
                    id:              createId(),
                    thread_id:       thread.id,
                    sender_type:     'team',
                    sender_id:       req.user!.userId,
                    body:            trimmedBody,
                    read_by_team_at: now,
                },
            }))
        );

        await prisma.threads.updateMany({
            where: { id: { in: threads.map(thread => thread.id) } },
            data:  { updated_at: now },
        });

        // Durable + realtime notification per recipient, mirroring sendMessage —
        // each client only gets an event for their own thread/message pair.
        const actorName = await getUserDisplayName(req.user!.userId);
        await Promise.all(threads.map((thread, i) => recordEvent({
            workspaceId: req.user!.workspaceId,
            type:        'message.received',
            importance:  'actionable',
            title:       'New message from your coach',
            recipients:  [{ type: 'client', id: thread.client_id }],
            actor:       { type: 'user', id: req.user!.userId },
            entity:      { type: 'thread', id: thread.id },
            metadata:    { actorName },
            realtime:    { rooms: [`workspace:${req.user!.workspaceId}`], event: 'new_message', payload: { threadId: thread.id, message: messages[i] } },
        })));

        res.status(201).json({ sent: threads.length, skipped: threadIds.length - threads.length });
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
