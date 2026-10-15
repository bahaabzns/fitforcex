import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import {
    BRANDING_LIMITS, getCoachBrandingView, updateColors, setLogo, clearLogo,
    createBanner, updateBanner, deleteBanner, reorderBanners, normalizeBannerLink, LogoVariant,
} from './branding.service';

const LINK_ERROR = 'Link must be an https:// URL or a portal path like /portal/forms';

const hexOrNull = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Color must be a #RRGGBB hex value').nullable();

const updateSchema = z.object({
    primary_color: hexOrNull.optional(),
    accent_color:  hexOrNull.optional(),
}).strict();

const bannerFieldsSchema = z.object({
    title:     z.string().trim().max(BRANDING_LIMITS.bannerTitleMax).nullable().optional(),
    link_url:  z.string().nullable().optional(),
    is_active: z.boolean().optional(),
}).strict();

const reorderSchema = z.object({ ids: z.array(z.string().min(1)).max(BRANDING_LIMITS.maxBanners) }).strict();

function variantFrom(req: Request): LogoVariant | null {
    const variant = (req.query.variant as string | undefined) ?? 'light';
    return variant === 'light' || variant === 'dark' ? variant : null;
}

export async function getBranding(req: Request, res: Response) {
    res.json(await getCoachBrandingView(req.user!.workspaceId));
}

export async function putBranding(req: Request, res: Response) {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid branding values' });

    await updateColors(req.user!.workspaceId, req.user!.userId, parsed.data);
    res.json(await getCoachBrandingView(req.user!.workspaceId));
}

export async function uploadLogo(req: Request, res: Response) {
    const variant = variantFrom(req);
    if (!variant) return res.status(400).json({ error: 'variant must be "light" or "dark"' });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const result = await setLogo(req.user!.workspaceId, req.user!.userId, variant, req.file.buffer);
    if ('error' in result) return res.status(400).json({ error: result.error });
    res.json(await getCoachBrandingView(req.user!.workspaceId));
}

export async function removeLogo(req: Request, res: Response) {
    const variant = variantFrom(req);
    if (!variant) return res.status(400).json({ error: 'variant must be "light" or "dark"' });

    await clearLogo(req.user!.workspaceId, req.user!.userId, variant);
    res.json(await getCoachBrandingView(req.user!.workspaceId));
}

export async function addBanner(req: Request, res: Response) {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const body = req.body as Record<string, unknown>;
    const parsed = bannerFieldsSchema.safeParse({
        title:    typeof body.title === 'string' && body.title.trim() !== '' ? body.title : null,
        link_url: typeof body.link_url === 'string' ? body.link_url : null,
    });
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid banner' });

    const link = normalizeBannerLink(parsed.data.link_url);
    if (link === 'invalid') return res.status(400).json({ error: LINK_ERROR });

    const result = await createBanner(req.user!.workspaceId, req.user!.userId, {
        buffer: req.file.buffer, title: parsed.data.title ?? null, linkUrl: link,
    });
    if ('error' in result) return res.status(result.status).json({ error: result.error });
    res.status(201).json(await getCoachBrandingView(req.user!.workspaceId));
}

export async function patchBanner(req: Request, res: Response) {
    const parsed = bannerFieldsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid banner' });

    const patch: { title?: string | null; link_url?: string | null; is_active?: boolean } = {};
    if (parsed.data.title !== undefined) patch.title = parsed.data.title === '' ? null : parsed.data.title;
    if (parsed.data.is_active !== undefined) patch.is_active = parsed.data.is_active;
    if (parsed.data.link_url !== undefined) {
        const link = normalizeBannerLink(parsed.data.link_url);
        if (link === 'invalid') return res.status(400).json({ error: LINK_ERROR });
        patch.link_url = link;
    }

    const updated = await updateBanner(req.user!.workspaceId, req.user!.userId, req.params.id as string, patch);
    if (!updated) return res.status(404).json({ error: 'Banner not found' });
    res.json(await getCoachBrandingView(req.user!.workspaceId));
}

export async function removeBanner(req: Request, res: Response) {
    const deleted = await deleteBanner(req.user!.workspaceId, req.user!.userId, req.params.id as string);
    if (!deleted) return res.status(404).json({ error: 'Banner not found' });
    res.json(await getCoachBrandingView(req.user!.workspaceId));
}

export async function putBannerOrder(req: Request, res: Response) {
    const parsed = reorderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'ids must be an array of banner ids' });

    const reordered = await reorderBanners(req.user!.workspaceId, req.user!.userId, parsed.data.ids);
    if (!reordered) return res.status(400).json({ error: 'ids must list every banner exactly once' });
    res.json(await getCoachBrandingView(req.user!.workspaceId));
}
