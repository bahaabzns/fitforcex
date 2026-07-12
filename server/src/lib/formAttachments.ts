import { Request } from 'express';
import multer from 'multer';
import { makeUploader, toPublicUrl } from './storage';
import { ALLOWED_ATTACHMENT_EXTS } from './messageAttachments';

// Upload plumbing for the "attachment" form question type (Phase 5). The
// coach picks one of four categories per question (see forms.controller.ts's
// ATTACHMENT_CATEGORIES); the category is a server-enforced upload
// constraint, not just a client-side hint — the multer instance for the
// question's category is the only one ever wired to the upload route, so a
// client can't widen its own allowlist by editing the request.
export const ATTACHMENT_CATEGORIES = ['images', 'documents', 'videos', 'any'] as const;
export type AttachmentCategory = typeof ATTACHMENT_CATEGORIES[number];

export function isValidAttachmentCategory(value: unknown): value is AttachmentCategory {
    return typeof value === 'string' && (ATTACHMENT_CATEGORIES as readonly string[]).includes(value);
}

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.heic', '.webp', '.gif'];
const DOCUMENT_EXTS = ['.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt'];
const MAX_SIZE = 20 * 1024 * 1024;

function videoFileFilter(_req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) {
    if (!file.mimetype.startsWith('video/')) return cb(new Error('File must be a video'));
    cb(null, true);
}

// One multer instance per category, built once at module load (mirrors
// photoUploader/attachmentUploader elsewhere) rather than per-request.
const uploadersByCategory: Record<AttachmentCategory, multer.Multer> = {
    images:    makeUploader('form-attachments/images', IMAGE_EXTS, { maxSize: MAX_SIZE }),
    documents: makeUploader('form-attachments/documents', DOCUMENT_EXTS, { maxSize: MAX_SIZE }),
    videos:    makeUploader('form-attachments/videos', null, { maxSize: MAX_SIZE, fileFilter: videoFileFilter }),
    // The vetted general-purpose allowlist already used for chat attachments
    // (images/audio/docs/zip) — reused as-is rather than inventing a new one.
    any:       makeUploader('form-attachments/any', ALLOWED_ATTACHMENT_EXTS, { maxSize: MAX_SIZE }),
};

export function attachmentUploaderFor(category: AttachmentCategory): multer.Multer {
    return uploadersByCategory[category];
}

export { toPublicUrl };
