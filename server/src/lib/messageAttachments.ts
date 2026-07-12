import { makeUploader, toPublicUrl } from './storage';

// Shared between the coach messenger and the client portal chat — both send/
// receive the same `messages` rows, so the upload rules and the URL
// serialization need to match exactly or one side renders a broken link.
export const ALLOWED_ATTACHMENT_EXTS = [
    '.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic',
    '.mp3', '.m4a', '.wav', '.ogg', '.webm', '.aac',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.zip',
];

export const attachmentUploader = makeUploader(
    'messenger-attachments',
    ALLOWED_ATTACHMENT_EXTS,
    { maxSize: 20 * 1024 * 1024 },
);

export function attachmentTypeFromMime(mime: string): 'image' | 'voice' | 'file' {
    if (mime.startsWith('image/')) return 'image';
    if (mime.startsWith('audio/')) return 'voice';
    return 'file';
}

/** Shared Prisma `select` for a message row — used by every read/write path on both sides of the chat. */
export const MESSAGE_SELECT = {
    id: true, sender_type: true, sender_id: true, body: true,
    type: true, attachment_url: true, attachment_name: true, attachment_size: true,
    attachment_mime: true, attachment_duration: true,
    edited_at: true, deleted_at: true,
    read_by_team_at: true, read_by_client_at: true, created_at: true,
} as const;

/** Converts a message's stored attachment key to a servable URL for API responses. */
export function serializeMessage<T extends { attachment_url: string | null }>(message: T): T {
    return { ...message, attachment_url: toPublicUrl(message.attachment_url) };
}
