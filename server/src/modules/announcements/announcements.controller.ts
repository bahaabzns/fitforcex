import { Request, Response } from 'express';
import { z } from 'zod';
import {
    ANNOUNCEMENT_LIMITS, AnnouncementInput, normalizeCtaHref, getActiveAnnouncementForUser, dismissAnnouncement,
    listAnnouncementsForAdmin, createAnnouncement, updateAnnouncement, deleteAnnouncement,
    setAnnouncementImage, clearAnnouncementImage,
} from './announcements.service';

const HREF_ERROR = 'CTA link must be an in-app path like /{slug}/settings/branding or an https:// URL';

const optionalText = (max: number) => z.string().trim().max(max).nullable().optional();

const announcementSchema = z.object({
    title:        z.string().trim().min(1, 'Title is required').max(ANNOUNCEMENT_LIMITS.titleMax),
    title_ar:     optionalText(ANNOUNCEMENT_LIMITS.titleMax),
    body:         z.string().trim().min(1, 'Benefit line is required').max(ANNOUNCEMENT_LIMITS.bodyMax),
    body_ar:      optionalText(ANNOUNCEMENT_LIMITS.bodyMax),
    cta_label:    optionalText(ANNOUNCEMENT_LIMITS.ctaLabelMax),
    cta_label_ar: optionalText(ANNOUNCEMENT_LIMITS.ctaLabelMax),
    cta_href:     z.string().nullable().optional(),
    is_active:    z.boolean().optional(),
    starts_at:    z.string().datetime().nullable().optional(),
    ends_at:      z.string().datetime().nullable().optional(),
    sort_order:   z.number().int().min(0).max(10_000).optional(),
}).strict();

const blankToNull = (value: string | null | undefined) => (value && value.trim() !== '' ? value.trim() : null);

/** Validated body → DB columns. Returns an error message when the link or schedule is invalid. */
function toInput(body: z.infer<typeof announcementSchema>): AnnouncementInput | { error: string } {
    const href = normalizeCtaHref(body.cta_href);
    if (href === 'invalid') return { error: HREF_ERROR };

    const startsAt = body.starts_at ? new Date(body.starts_at) : null;
    const endsAt = body.ends_at ? new Date(body.ends_at) : null;
    if (startsAt && endsAt && endsAt <= startsAt) return { error: 'End date must be after the start date' };

    const ctaLabel = blankToNull(body.cta_label);
    if (href && !ctaLabel) return { error: 'Add a button label for the CTA link' };

    return {
        title:        body.title,
        title_ar:     blankToNull(body.title_ar),
        body:         body.body,
        body_ar:      blankToNull(body.body_ar),
        cta_label:    ctaLabel,
        cta_label_ar: blankToNull(body.cta_label_ar),
        cta_href:     href,
        is_active:    body.is_active ?? true,
        starts_at:    startsAt,
        ends_at:      endsAt,
        sort_order:   body.sort_order ?? 0,
    };
}

// ── Coach ───────────────────────────────────────────────────────────────────────────────
export async function getActive(req: Request, res: Response) {
    const announcement = await getActiveAnnouncementForUser(req.user!.userId);
    res.json({ announcement });
}

const dismissSchema = z.object({ action: z.enum(['dismissed', 'clicked']).optional() }).strict();

export async function dismiss(req: Request, res: Response) {
    const parsed = dismissSchema.safeParse(req.body ?? {});
    if (!parsed.success) return res.status(400).json({ error: 'Invalid action' });

    const found = await dismissAnnouncement(req.user!.userId, req.params.id as string, parsed.data.action ?? 'dismissed');
    if (!found) return res.status(404).json({ error: 'Announcement not found' });
    res.json({ ok: true });
}

// ── Admin ───────────────────────────────────────────────────────────────────────────────
export async function adminList(_req: Request, res: Response) {
    res.json(await listAnnouncementsForAdmin());
}

export async function adminCreate(req: Request, res: Response) {
    const parsed = announcementSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid announcement' });

    const input = toInput(parsed.data);
    if ('error' in input) return res.status(400).json({ message: input.error });

    res.status(201).json(await createAnnouncement(input));
}

export async function adminUpdate(req: Request, res: Response) {
    const parsed = announcementSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid announcement' });

    const input = toInput(parsed.data);
    if ('error' in input) return res.status(400).json({ message: input.error });

    const updated = await updateAnnouncement(req.params.id as string, input);
    if (!updated) return res.status(404).json({ message: 'Announcement not found' });
    res.json({ ok: true });
}

export async function adminDelete(req: Request, res: Response) {
    const deleted = await deleteAnnouncement(req.params.id as string);
    if (!deleted) return res.status(404).json({ message: 'Announcement not found' });
    res.json({ ok: true });
}

export async function adminUploadImage(req: Request, res: Response) {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const result = await setAnnouncementImage(req.params.id as string, req.file.buffer);
    if ('error' in result) return res.status(result.status).json({ message: result.error });
    res.json({ ok: true });
}

export async function adminRemoveImage(req: Request, res: Response) {
    const cleared = await clearAnnouncementImage(req.params.id as string);
    if (!cleared) return res.status(404).json({ message: 'Announcement not found' });
    res.json({ ok: true });
}
