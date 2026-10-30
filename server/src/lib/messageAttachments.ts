import multerS3 from 'multer-s3';
import { makeUploader, toPublicUrl } from './storage';
import { prisma } from './prisma';

// Shared between the coach messenger and the client portal chat — both send/
// receive the same `messages` rows, so the upload rules and the URL
// serialization need to match exactly or one side renders a broken link.
export const ALLOWED_ATTACHMENT_EXTS = [
    '.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic',
    '.mp3', '.m4a', '.wav', '.ogg', '.webm', '.aac',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.zip',
];

// Byte-sniffing (multerS3.AUTO_CONTENT_TYPE) misidentifies Safari/iOS voice notes:
// its bundled file-type check matches any MP4 "ftyp" box against the generic
// video/mp4 signature before it ever checks for the m4a brand, so audio-only MP4
// recordings get stored with Content-Type: video/mp4 — which Safari's <audio>
// element then refuses to play. Voice notes are recorded by our own
// useVoiceRecorder hook, which sets the Blob's real MediaRecorder mimeType, so
// trust that declared type instead of sniffing for this one attachment kind.
export function resolveAttachmentContentType(
    req: Express.Request,
    file: Express.Multer.File,
    cb: (error: unknown, mime?: string, stream?: NodeJS.ReadableStream) => void,
) {
    if (file.mimetype.startsWith('audio/')) return cb(null, file.mimetype);
    multerS3.AUTO_CONTENT_TYPE(req, file, cb);
}

export const attachmentUploader = makeUploader(
    'messenger-attachments',
    ALLOWED_ATTACHMENT_EXTS,
    { maxSize: 20 * 1024 * 1024, contentType: resolveAttachmentContentType },
);

export function attachmentTypeFromMime(mime: string): 'image' | 'voice' | 'file' {
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('audio/')) return 'voice';
    return 'file';
}

/**
 * Minimal projection of a quoted (replied-to) message. A deleted original has its
 * body/attachment nulled at delete time, so this never leaks removed content.
 */
export const REPLY_TO_SELECT = {
    id: true, sender_type: true, type: true, body: true,
    attachment_name: true, attachment_url: true, deleted_at: true,
} as const;

/** Shared Prisma `select` for a message row — used by every read/write path on both sides of the chat. */
export const MESSAGE_SELECT = {
    id: true, sender_type: true, sender_id: true, body: true,
    type: true, attachment_url: true, attachment_name: true, attachment_size: true,
    attachment_mime: true, attachment_duration: true,
    edited_at: true, deleted_at: true,
    read_by_team_at: true, read_by_client_at: true, created_at: true,
    reply_to_id: true,
    reply_to: { select: REPLY_TO_SELECT },
} as const;

type SerializableMessage = {
    attachment_url: string | null;
    reply_to?: { attachment_url: string | null } | null;
};

/** Converts a message's (and its quoted message's) stored attachment key to a servable URL for API responses. */
export function serializeMessage<T extends SerializableMessage>(message: T): T {
    const serialized = { ...message, attachment_url: toPublicUrl(message.attachment_url) };
    if (message.reply_to) {
        serialized.reply_to = { ...message.reply_to, attachment_url: toPublicUrl(message.reply_to.attachment_url) };
    }
    return serialized;
}

export type ReplyTargetCheck =
    | { ok: true; replyToId: string | null }
    | { ok: false; error: string };

/**
 * Validates an optional `replyToId` from a send request: it must name a live
 * message in the SAME thread, so a caller can't quote (and thereby read) a
 * message from another conversation or workspace.
 */
export async function resolveReplyTarget(threadId: string, raw: unknown): Promise<ReplyTargetCheck> {
    if (raw === undefined || raw === null || raw === '') return { ok: true, replyToId: null };
    if (typeof raw !== 'string') return { ok: false, error: 'replyToId must be a string' };

    const target = await prisma.messages.findFirst({
        where:  { id: raw, thread_id: threadId },
        select: { id: true, deleted_at: true },
    });
    if (!target) return { ok: false, error: 'Message to reply to was not found in this conversation' };
    if (target.deleted_at) return { ok: false, error: 'You cannot reply to a deleted message' };
    return { ok: true, replyToId: target.id };
}
