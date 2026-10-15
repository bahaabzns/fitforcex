import sharp from 'sharp';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { putBuffer, deleteFile, toPublicUrl } from '../../lib/storage';

export const ANNOUNCEMENT_LIMITS = {
    titleMax:        120,
    bodyMax:         280,
    ctaLabelMax:     40,
    ctaHrefMax:      300,
    imageMaxBytes:   2 * 1024 * 1024,
    imageMaxWidthPx: 1200,
    imageMinWidthPx: 400,
} as const;

const ALLOWED_IMAGE_FORMATS = ['jpeg', 'png', 'webp'];
const MAX_INPUT_PIXELS = 40_000_000;
// In-app path (may use the {slug} placeholder, replaced client-side with the workspace slug).
const INTERNAL_HREF = /^\/(\{slug\}|[A-Za-z0-9_-]+)(\/[A-Za-z0-9_{}-]+)*\/?$/;

/** Returns the cleaned href, null for "no link", or 'invalid'. Only in-app paths and https URLs. */
export function normalizeCtaHref(raw: unknown): string | null | 'invalid' {
    if (raw === null || raw === undefined) return null;
    if (typeof raw !== 'string') return 'invalid';
    const value = raw.trim();
    if (value === '') return null;
    if (value.length > ANNOUNCEMENT_LIMITS.ctaHrefMax) return 'invalid';
    if (INTERNAL_HREF.test(value)) return value;
    try {
        return new URL(value).protocol === 'https:' ? value : 'invalid';
    } catch {
        return 'invalid';
    }
}

const s3Configured = !!(env.S3_BUCKET && env.S3_ACCESS_KEY && env.S3_SECRET_KEY);

async function removeStoredImage(key: string | null | undefined): Promise<void> {
    if (!key) return;
    // storage.deleteFile unlinks the bare key in local-disk mode, but local files live under uploads/
    await deleteFile(s3Configured ? key : `uploads/${key}`).catch(() => undefined);
}

type AnnouncementRow = NonNullable<Awaited<ReturnType<typeof prisma.product_announcements.findFirst>>>;

export function serializeAnnouncement(row: AnnouncementRow) {
    return {
        id:          row.id,
        title:       row.title,
        titleAr:     row.title_ar,
        body:        row.body,
        bodyAr:      row.body_ar,
        ctaLabel:    row.cta_label,
        ctaLabelAr:  row.cta_label_ar,
        ctaHref:     row.cta_href,
        imageUrl:    toPublicUrl(row.image_key),
    };
}

/**
 * The single announcement to show this coach: active, inside its schedule window, not yet
 * dismissed by them — lowest sort_order first, newest first as the tiebreaker.
 */
export async function getActiveAnnouncementForUser(userId: string) {
    const now = new Date();
    const row = await prisma.product_announcements.findFirst({
        where: {
            is_active: true,
            AND: [
                { OR: [{ starts_at: null }, { starts_at: { lte: now } }] },
                { OR: [{ ends_at: null }, { ends_at: { gt: now } }] },
            ],
            announcement_dismissals: { none: { user_id: userId } },
        },
        orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
    });
    return row ? serializeAnnouncement(row) : null;
}

export async function dismissAnnouncement(userId: string, announcementId: string, action: 'dismissed' | 'clicked') {
    const exists = await prisma.product_announcements.findUnique({ where: { id: announcementId }, select: { id: true } });
    if (!exists) return false;
    await prisma.announcement_dismissals.upsert({
        where:  { user_id_announcement_id: { user_id: userId, announcement_id: announcementId } },
        create: { user_id: userId, announcement_id: announcementId, action },
        update: {},
    });
    return true;
}

// ── Admin ───────────────────────────────────────────────────────────────────────────────
export interface AnnouncementInput {
    title:        string;
    title_ar:     string | null;
    body:         string;
    body_ar:      string | null;
    cta_label:    string | null;
    cta_label_ar: string | null;
    cta_href:     string | null;
    is_active:    boolean;
    starts_at:    Date | null;
    ends_at:      Date | null;
    sort_order:   number;
}

export async function listAnnouncementsForAdmin() {
    const rows = await prisma.product_announcements.findMany({
        orderBy: [{ sort_order: 'asc' }, { created_at: 'desc' }],
        include: { announcement_dismissals: { select: { action: true } } },
    });
    return rows.map(({ announcement_dismissals, ...row }) => ({
        ...row,
        image_url:       toPublicUrl(row.image_key),
        dismissed_count: announcement_dismissals.filter(d => d.action === 'dismissed').length,
        clicked_count:   announcement_dismissals.filter(d => d.action === 'clicked').length,
    }));
}

export async function createAnnouncement(input: AnnouncementInput) {
    return prisma.product_announcements.create({ data: { id: createId(), ...input } });
}

export async function updateAnnouncement(id: string, input: Partial<AnnouncementInput>) {
    const result = await prisma.product_announcements.updateMany({
        where: { id }, data: { ...input, updated_at: new Date() },
    });
    return result.count > 0;
}

export async function deleteAnnouncement(id: string) {
    const row = await prisma.product_announcements.findUnique({ where: { id } });
    if (!row) return false;
    await prisma.product_announcements.delete({ where: { id } });
    await removeStoredImage(row.image_key);
    return true;
}

export async function setAnnouncementImage(id: string, buffer: Buffer): Promise<{ error: string; status: number } | { ok: true }> {
    const row = await prisma.product_announcements.findUnique({ where: { id }, select: { image_key: true } });
    if (!row) return { error: 'Announcement not found', status: 404 };

    const meta = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata().catch(() => null);
    if (!meta || !meta.format || !ALLOWED_IMAGE_FORMATS.includes(meta.format) || !meta.width) {
        return { error: 'Unsupported image — use PNG, JPG or WebP', status: 400 };
    }
    if (meta.width < ANNOUNCEMENT_LIMITS.imageMinWidthPx) {
        return { error: `Image is too narrow — at least ${ANNOUNCEMENT_LIMITS.imageMinWidthPx}px wide`, status: 400 };
    }

    const output = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
        .rotate()
        .resize({ width: ANNOUNCEMENT_LIMITS.imageMaxWidthPx, withoutEnlargement: true })
        .webp({ quality: 82 })
        .toBuffer();
    const key = await putBuffer('announcements', `${id}-${Date.now()}-${createId().slice(0, 6)}.webp`, output, 'image/webp');

    await prisma.product_announcements.update({ where: { id }, data: { image_key: key, updated_at: new Date() } });
    await removeStoredImage(row.image_key);
    return { ok: true };
}

export async function clearAnnouncementImage(id: string): Promise<boolean> {
    const row = await prisma.product_announcements.findUnique({ where: { id }, select: { image_key: true } });
    if (!row) return false;
    await prisma.product_announcements.update({ where: { id }, data: { image_key: null, updated_at: new Date() } });
    await removeStoredImage(row.image_key);
    return true;
}
