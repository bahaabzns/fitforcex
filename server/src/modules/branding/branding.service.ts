import sharp from 'sharp';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../../lib/prisma';
import { env } from '../../config/env';
import { putBuffer, deleteFile, toPublicUrl } from '../../lib/storage';
import { getCapabilityState, getPlansWithCapability } from '../../lib/planCapabilities';

// ── Limits (mirrored in the settings UI via GET /api/branding → limits) ─────────────────
export const BRANDING_LIMITS = {
    maxBanners:        5,
    logoMaxBytes:      1 * 1024 * 1024,
    bannerMaxBytes:    2 * 1024 * 1024,
    logoMinPx:         128,
    logoMaxPx:         2000,
    bannerMinWidthPx:  600,
    bannerOutputWidth: 1600,
    bannerTitleMax:    80,
    welcomeMessageMax: 160,
    linkMax:           500,
} as const;

const ALLOWED_IMAGE_FORMATS = ['jpeg', 'png', 'webp'];
const MAX_INPUT_PIXELS = 40_000_000;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
// Internal portal paths a banner may deep-link to, e.g. /portal/forms
const INTERNAL_PORTAL_PATH = /^\/portal(\/[A-Za-z0-9_-]+)*$/;
const LIGHT_BG = '#ffffff';
const DARK_BG  = '#18181b';
const MIN_TEXT_CONTRAST = 4.5;
const MIN_UI_CONTRAST   = 3;

export type LogoVariant = 'light' | 'dark';

// ── Colors ──────────────────────────────────────────────────────────────────────────────
export function isHexColor(value: unknown): value is string {
    return typeof value === 'string' && HEX_COLOR.test(value);
}

function relativeLuminance(hex: string): number {
    const [r, g, b] = [1, 3, 5]
        .map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
    const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
}

/** Text color (black/white) with the better contrast against a brand color. */
export function pickForeground(hex: string): '#ffffff' | '#000000' {
    return contrastRatio(hex, '#ffffff') >= contrastRatio(hex, '#000000') ? '#ffffff' : '#000000';
}

/** Advisory only (founder decision: warn, don't block). */
export function colorWarnings(primary: string | null): string[] {
    if (!primary) return [];
    const warnings: string[] = [];
    if (contrastRatio(primary, pickForeground(primary)) < MIN_TEXT_CONTRAST) warnings.push('text_on_primary_low_contrast');
    if (contrastRatio(primary, LIGHT_BG) < MIN_UI_CONTRAST) warnings.push('low_contrast_on_light_background');
    if (contrastRatio(primary, DARK_BG) < MIN_UI_CONTRAST) warnings.push('low_contrast_on_dark_background');
    return warnings;
}

// ── Links ───────────────────────────────────────────────────────────────────────────────
export function normalizeBannerLink(raw: unknown): string | null | 'invalid' {
    if (raw === null || raw === undefined) return null;
    if (typeof raw !== 'string') return 'invalid';
    const value = raw.trim();
    if (value === '') return null;
    if (value.length > BRANDING_LIMITS.linkMax) return 'invalid';
    if (INTERNAL_PORTAL_PATH.test(value)) return value;
    try {
        const url = new URL(value);
        return url.protocol === 'https:' ? url.toString() : 'invalid';
    } catch {
        return 'invalid';
    }
}

// ── Storage ─────────────────────────────────────────────────────────────────────────────
const s3Configured = !!(env.S3_BUCKET && env.S3_ACCESS_KEY && env.S3_SECRET_KEY);

async function removeStoredImage(key: string | null | undefined): Promise<void> {
    if (!key) return;
    // storage.deleteFile unlinks the bare key in local-disk mode, but local files live under uploads/
    await deleteFile(s3Configured ? key : `uploads/${key}`).catch(() => undefined);
}

type ImageResult = { key: string } | { error: string };

/**
 * Validates by decoded content (not extension/mimetype), strips metadata, bounds dimensions,
 * re-encodes to WebP and stores under branding/<workspaceId>/. SVG/GIF are rejected by format.
 */
async function processAndStoreImage(
    buffer: Buffer, workspaceId: string, kind: 'logo' | 'banner',
): Promise<ImageResult> {
    const meta = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata().catch(() => null);
    if (!meta) return { error: 'Could not read the image — upload a valid PNG, JPG or WebP file' };
    if (!meta.format || !ALLOWED_IMAGE_FORMATS.includes(meta.format) || !meta.width || !meta.height) {
        return { error: 'Unsupported image type — use PNG, JPG or WebP' };
    }
    if (meta.pages && meta.pages > 1) return { error: 'Animated images are not supported' };

    // .rotate() with no args applies EXIF orientation, then output drops all metadata.
    let pipeline = sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).rotate();
    if (kind === 'logo') {
        if (Math.max(meta.width, meta.height) < BRANDING_LIMITS.logoMinPx) {
            return { error: `Logo is too small — at least ${BRANDING_LIMITS.logoMinPx}px on its longest side` };
        }
        pipeline = pipeline.resize({
            width: BRANDING_LIMITS.logoMaxPx, height: BRANDING_LIMITS.logoMaxPx, fit: 'inside', withoutEnlargement: true,
        });
    } else {
        if (meta.width < BRANDING_LIMITS.bannerMinWidthPx) {
            return { error: `Banner is too narrow — at least ${BRANDING_LIMITS.bannerMinWidthPx}px wide` };
        }
        pipeline = pipeline.resize({ width: BRANDING_LIMITS.bannerOutputWidth, withoutEnlargement: true });
    }

    const output = await pipeline.webp({ quality: kind === 'logo' ? 90 : 82 }).toBuffer();
    const key = await putBuffer(
        `branding/${workspaceId}`,
        `${kind}-${Date.now()}-${createId().slice(0, 8)}.webp`,
        output,
        'image/webp',
    );
    return { key };
}

// ── Reads ───────────────────────────────────────────────────────────────────────────────
export interface PortalBranding {
    active:       boolean;
    name:         string;
    logoUrl:      string | null;
    logoDarkUrl:  string | null;
    primaryColor: string | null;
    accentColor:  string | null;
    welcomeMessage: string | null;
    version:      number;
    banners:      Array<{ id: string; imageUrl: string; title: string | null; linkUrl: string | null }>;
}

/**
 * The single place that decides what a trainee sees: capability + standing are checked on every
 * read, so a downgrade/expiry hides branding immediately and a re-upgrade restores it with no
 * job or backfill. Per-field fallback is the caller's job (null ⇒ FitForce default).
 */
export async function resolvePortalBranding(
    workspaceId: string, opts: { includeBanners: boolean },
): Promise<PortalBranding | null> {
    const [workspace, state] = await Promise.all([
        prisma.workspaces.findFirst({ where: { id: workspaceId, archived_at: null }, select: { name: true } }),
        getCapabilityState(workspaceId, 'custom_branding'),
    ]);
    if (!workspace) return null;

    const base: PortalBranding = {
        active: false, name: workspace.name, logoUrl: null, logoDarkUrl: null,
        primaryColor: null, accentColor: null, welcomeMessage: null, version: 0, banners: [],
    };
    if (!state.effective) return base;

    const [row, banners] = await Promise.all([
        prisma.workspace_branding.findUnique({ where: { workspace_id: workspaceId } }),
        opts.includeBanners
            ? prisma.workspace_banners.findMany({
                where:   { workspace_id: workspaceId, deleted_at: null, is_active: true },
                orderBy: { sort_order: 'asc' },
            })
            : Promise.resolve([]),
    ]);

    return {
        ...base,
        active:       true,
        logoUrl:      toPublicUrl(row?.logo_key),
        logoDarkUrl:  toPublicUrl(row?.logo_dark_key),
        primaryColor: row?.primary_color ?? null,
        accentColor:  row?.accent_color ?? null,
        welcomeMessage: row?.welcome_message ?? null,
        version:      row?.version ?? 0,
        banners: banners.map(b => ({
            id: b.id, imageUrl: toPublicUrl(b.image_key) as string, title: b.title, linkUrl: b.link_url,
        })),
    };
}

/** Coach-side view: saved values are always returned (even when locked), plus eligibility. */
export async function getCoachBrandingView(workspaceId: string) {
    const [state, plans, row, banners, workspace] = await Promise.all([
        getCapabilityState(workspaceId, 'custom_branding'),
        getPlansWithCapability('custom_branding'),
        prisma.workspace_branding.findUnique({ where: { workspace_id: workspaceId } }),
        prisma.workspace_banners.findMany({
            where: { workspace_id: workspaceId, deleted_at: null }, orderBy: { sort_order: 'asc' },
        }),
        prisma.workspaces.findUnique({ where: { id: workspaceId }, select: { name: true } }),
    ]);

    const primary = row?.primary_color ?? null;
    return {
        eligibility: {
            eligible: state.effective, planHas: state.planHas, expired: state.expired, plans,
        },
        workspaceName: workspace?.name ?? '',
        branding: {
            logoUrl:      toPublicUrl(row?.logo_key),
            logoDarkUrl:  toPublicUrl(row?.logo_dark_key),
            primaryColor: primary,
            accentColor:  row?.accent_color ?? null,
            welcomeMessage: row?.welcome_message ?? null,
            version:      row?.version ?? 0,
            warnings:     colorWarnings(primary),
        },
        banners: banners.map(b => ({
            id: b.id, imageUrl: toPublicUrl(b.image_key), title: b.title, linkUrl: b.link_url,
            isActive: b.is_active, sortOrder: b.sort_order,
        })),
        limits: BRANDING_LIMITS,
    };
}

// ── Writes ──────────────────────────────────────────────────────────────────────────────
type BrandingColumns = {
    logo_key?: string | null; logo_dark_key?: string | null;
    primary_color?: string | null; accent_color?: string | null; welcome_message?: string | null;
};

/** Upserts the row and bumps `version` — every change (including banners) busts client caches. */
async function touchBranding(workspaceId: string, userId: string | undefined, data: BrandingColumns = {}) {
    return prisma.workspace_branding.upsert({
        where:  { workspace_id: workspaceId },
        create: { workspace_id: workspaceId, updated_by: userId ?? null, version: 1, ...data },
        update: { updated_by: userId ?? null, updated_at: new Date(), version: { increment: 1 }, ...data },
    });
}

export async function updateSettings(
    workspaceId: string, userId: string | undefined,
    settings: { primary_color?: string | null; accent_color?: string | null; welcome_message?: string | null },
) {
    const data: BrandingColumns = {};
    if (settings.primary_color !== undefined) data.primary_color = settings.primary_color;
    if (settings.accent_color !== undefined)  data.accent_color  = settings.accent_color;
    if (settings.welcome_message !== undefined) {
        data.welcome_message = settings.welcome_message === null || settings.welcome_message.trim() === ''
            ? null
            : settings.welcome_message.trim();
    }
    return touchBranding(workspaceId, userId, data);
}

function logoColumn(variant: LogoVariant): 'logo_key' | 'logo_dark_key' {
    return variant === 'dark' ? 'logo_dark_key' : 'logo_key';
}

export async function setLogo(
    workspaceId: string, userId: string | undefined, variant: LogoVariant, buffer: Buffer,
): Promise<{ error: string } | { ok: true }> {
    const stored = await processAndStoreImage(buffer, workspaceId, 'logo');
    if ('error' in stored) return stored;

    const column = logoColumn(variant);
    const previous = await prisma.workspace_branding.findUnique({
        where: { workspace_id: workspaceId }, select: { logo_key: true, logo_dark_key: true },
    });
    await touchBranding(workspaceId, userId, { [column]: stored.key });
    await removeStoredImage(previous?.[column]);
    return { ok: true };
}

export async function clearLogo(workspaceId: string, userId: string | undefined, variant: LogoVariant) {
    const column = logoColumn(variant);
    const previous = await prisma.workspace_branding.findUnique({
        where: { workspace_id: workspaceId }, select: { logo_key: true, logo_dark_key: true },
    });
    if (!previous) return;
    await touchBranding(workspaceId, userId, { [column]: null });
    await removeStoredImage(previous[column]);
}

export async function createBanner(
    workspaceId: string, userId: string | undefined,
    input: { buffer: Buffer; title: string | null; linkUrl: string | null },
): Promise<{ error: string; status: number } | { banner: { id: string } }> {
    const count = await prisma.workspace_banners.count({ where: { workspace_id: workspaceId, deleted_at: null } });
    if (count >= BRANDING_LIMITS.maxBanners) {
        return { error: `You can have at most ${BRANDING_LIMITS.maxBanners} banners — delete one to add another`, status: 409 };
    }
    const stored = await processAndStoreImage(input.buffer, workspaceId, 'banner');
    if ('error' in stored) return { error: stored.error, status: 400 };

    const last = await prisma.workspace_banners.findFirst({
        where: { workspace_id: workspaceId, deleted_at: null }, orderBy: { sort_order: 'desc' }, select: { sort_order: true },
    });
    const banner = await prisma.workspace_banners.create({
        data: {
            id: createId(), workspace_id: workspaceId, image_key: stored.key,
            title: input.title, link_url: input.linkUrl, sort_order: (last?.sort_order ?? -1) + 1,
        },
    });
    await touchBranding(workspaceId, userId);
    return { banner: { id: banner.id } };
}

export async function updateBanner(
    workspaceId: string, userId: string | undefined, bannerId: string,
    patch: { title?: string | null; link_url?: string | null; is_active?: boolean },
): Promise<boolean> {
    const result = await prisma.workspace_banners.updateMany({
        where: { id: bannerId, workspace_id: workspaceId, deleted_at: null },
        data:  { ...patch, updated_at: new Date() },
    });
    if (result.count === 0) return false;
    await touchBranding(workspaceId, userId);
    return true;
}

export async function deleteBanner(workspaceId: string, userId: string | undefined, bannerId: string): Promise<boolean> {
    const banner = await prisma.workspace_banners.findFirst({
        where: { id: bannerId, workspace_id: workspaceId, deleted_at: null },
    });
    if (!banner) return false;
    await prisma.workspace_banners.update({ where: { id: banner.id }, data: { deleted_at: new Date() } });
    await touchBranding(workspaceId, userId);
    await removeStoredImage(banner.image_key);
    return true;
}

/** Applies the given id order to this workspace's live banners; ids must match the set exactly. */
export async function reorderBanners(workspaceId: string, userId: string | undefined, ids: string[]): Promise<boolean> {
    const live = await prisma.workspace_banners.findMany({
        where: { workspace_id: workspaceId, deleted_at: null }, select: { id: true },
    });
    const liveIds = new Set(live.map(b => b.id));
    if (ids.length !== liveIds.size || new Set(ids).size !== ids.length || !ids.every(id => liveIds.has(id))) return false;

    await prisma.$transaction(ids.map((id, index) =>
        prisma.workspace_banners.update({ where: { id }, data: { sort_order: index } }),
    ));
    await touchBranding(workspaceId, userId);
    return true;
}
