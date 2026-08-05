import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import path from 'path';
import { createId } from '@paralleldrive/cuid2';
import { imageSize } from 'image-size';
import { prisma } from '../../lib/prisma';
import pool from '../../db';
import { renderHtmlToPdf } from '../../lib/pdfRenderer';
import { toPublicUrl, putBuffer } from '../../lib/storage';
import { fetchFullNutritionPlan } from '../nutrition/nutrition.service';
import { fetchFullTrainingPlan } from '../training/training.service';
import { renderNutritionPlanHtml } from './templates/nutritionPlan';
import { renderTrainingPlanHtml } from './templates/trainingPlan';
import { getOrDefaultNutritionPdfSettings, getOrDefaultTrainingPdfSettings } from './pdfExport.service';
import { SAMPLE_NUTRITION_PLAN, SAMPLE_TRAINING_PLAN, SAMPLE_CLIENT_NAME } from './templates/sampleData';

type Row = Record<string, unknown>;

async function getClientName(clientId: unknown, workspaceId: string): Promise<string> {
    if (!clientId) return '';
    const result = await pool.query(
        'SELECT fname, lname FROM clients WHERE id = $1 AND workspace_id = $2',
        [clientId, workspaceId]
    );
    const client = result.rows[0] as Row | undefined;
    return client ? `${client.fname} ${client.lname}`.trim() : '';
}

function slugify(value: unknown): string {
    return String(value ?? 'plan')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'plan';
}

function timestampTag(): string {
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

function buildExportFilename(planName: unknown, clientName: string): string {
    const parts = [slugify(planName), clientName && slugify(clientName), timestampTag()].filter(Boolean);
    return `${parts.join('_')}.pdf`;
}

// pdf settings store page dimensions in points; a cover background image
// must be uploaded pre-sized to fill the page exactly (no cropping/letterbox
// guesswork at render time) rather than being scaled to fit, so its required
// pixel size is derived from the page size at a fixed 96px/inch — the same
// conversion the client-side preview iframe uses, so "what you'll need to
// upload" is consistent everywhere it's shown.
const COVER_IMAGE_PIXELS_PER_INCH = 96;
const COVER_IMAGE_SIZE_TOLERANCE_PX = 5;

function expectedCoverImagePixelSize(settings: { page_width: number; page_height: number }) {
    return {
        width:  Math.round((settings.page_width / 72) * COVER_IMAGE_PIXELS_PER_INCH),
        height: Math.round((settings.page_height / 72) * COVER_IMAGE_PIXELS_PER_INCH),
    };
}

// ---------------------------------------------------------------------------
// Export (render a real plan to PDF)
// ---------------------------------------------------------------------------

export async function exportNutritionPlan(req: Request, res: Response, next: NextFunction) {
    try {
        const workspaceId = req.user!.workspaceId;
        const plan = await fetchFullNutritionPlan(req.params.planId as string, workspaceId);
        if (!plan) return res.status(404).json({ error: 'Nutrition plan not found' });

        const [clientName, settings] = await Promise.all([
            getClientName((plan as Row).client_id, workspaceId),
            getOrDefaultNutritionPdfSettings(workspaceId),
        ]);

        const html = renderNutritionPlanHtml(plan as Row, clientName, settings);
        const pdfBuffer = await renderHtmlToPdf(html, { width: settings.page_width, height: settings.page_height });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${buildExportFilename((plan as Row).name, clientName)}"`);
        res.send(pdfBuffer);
    } catch (err) { next(err); }
}

export async function exportTrainingPlan(req: Request, res: Response, next: NextFunction) {
    try {
        const workspaceId = req.user!.workspaceId;
        const plan = await fetchFullTrainingPlan(req.params.planId as string, workspaceId);
        if (!plan) return res.status(404).json({ error: 'Training plan not found' });

        const [clientName, settings] = await Promise.all([
            getClientName((plan as Row).client_id, workspaceId),
            getOrDefaultTrainingPdfSettings(workspaceId),
        ]);

        const html = renderTrainingPlanHtml(plan as Row, clientName, settings);
        const pdfBuffer = await renderHtmlToPdf(html, { width: settings.page_width, height: settings.page_height });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${buildExportFilename((plan as Row).name, clientName)}"`);
        res.send(pdfBuffer);
    } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// Settings CRUD — nutrition_pdf_settings and training_pdf_settings are fully
// independent tables (see DECISIONS.md, 2026-07-28), so these are separate
// functions per type rather than one generic handler switching on a param —
// each type has its own field set and its own Prisma model.
// ---------------------------------------------------------------------------

export async function getNutritionSettings(req: Request, res: Response, next: NextFunction) {
    try {
        res.json(await getOrDefaultNutritionPdfSettings(req.user!.workspaceId));
    } catch (err) { next(err); }
}

export async function getTrainingSettings(req: Request, res: Response, next: NextFunction) {
    try {
        res.json(await getOrDefaultTrainingPdfSettings(req.user!.workspaceId));
    } catch (err) { next(err); }
}

export async function previewSettings(req: Request, res: Response, next: NextFunction) {
    try {
        const workspaceId = req.user!.workspaceId;
        const type = req.query.type === 'training' ? 'training' : 'nutrition';
        // Draft values from the settings page (not yet saved) render straight
        // into the same escaped template a real export uses (see
        // templates/layout.ts's escapeHtml, and setJavaScriptEnabled(false)
        // in lib/pdfRenderer.ts) — nothing here is persisted, so there's no
        // need for the stricter validation the update*SettingsSchemas apply
        // to an actual save; a malformed value just renders oddly in this
        // workspace's own preview, nothing more.
        if (type === 'training') {
            const saved = await getOrDefaultTrainingPdfSettings(workspaceId);
            const draft = { ...saved, ...(req.body && typeof req.body === 'object' ? req.body : {}) };
            const html = renderTrainingPlanHtml(SAMPLE_TRAINING_PLAN, SAMPLE_CLIENT_NAME, draft);
            const pdfBuffer = await renderHtmlToPdf(html, { width: draft.page_width, height: draft.page_height });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
            return res.send(pdfBuffer);
        }

        const saved = await getOrDefaultNutritionPdfSettings(workspaceId);
        const draft = { ...saved, ...(req.body && typeof req.body === 'object' ? req.body : {}) };
        const html = renderNutritionPlanHtml(SAMPLE_NUTRITION_PLAN, SAMPLE_CLIENT_NAME, draft);
        const pdfBuffer = await renderHtmlToPdf(html, { width: draft.page_width, height: draft.page_height });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
        res.send(pdfBuffer);
    } catch (err) { next(err); }
}

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #007AFF');

// Fields shared by both plan types (branding, cover page, page size) plus
// nutrition's own section toggles.
const updateNutritionSettingsSchema = z.object({
    coach_name:                  z.string().max(120).optional(),
    footer_text:                 z.string().max(200).optional(),
    primary_color:                hexColor.optional(),
    header_text_color:            hexColor.optional(),
    table_header_bg_color:        hexColor.optional(),
    table_alt_bg_color:           hexColor.optional(),
    cover_title:                  z.string().max(120).optional(),
    cover_subtitle:                z.string().max(200).nullable().optional(),
    page_width:                    z.number().positive().max(5000).optional(),
    page_height:                   z.number().positive().max(5000).optional(),
    show_cover_page:               z.boolean().optional(),
    show_plan_summary_page:        z.boolean().optional(),
    show_back_cover_page:          z.boolean().optional(),
    max_meals_per_page:            z.number().int().min(0).max(50).optional(),
    meals_content_primary_color:   hexColor.nullable().optional(),
    plan_summary_primary_color:    hexColor.nullable().optional(),
    cycle_summary_primary_color:   hexColor.nullable().optional(),
    show_notes:                    z.boolean().optional(),
    show_alternatives:             z.boolean().optional(),
    show_macros_summary:           z.boolean().optional(),
    show_cycle_totals:             z.boolean().optional(),
    show_meal_totals:              z.boolean().optional(),
    show_food_calories:            z.boolean().optional(),
    show_food_macros:              z.boolean().optional(),
    show_meal_summary_page:        z.boolean().optional(),
    show_cycle_summary_page:       z.boolean().optional(),
    show_cover_header:             z.boolean().optional(),
    show_cover_title:              z.boolean().optional(),
    show_cover_subtitle:           z.boolean().optional(),
    show_cover_client_name:        z.boolean().optional(),
    body_text_color:               hexColor.optional(),
});

const updateTrainingSettingsSchema = z.object({
    coach_name:                     z.string().max(120).optional(),
    footer_text:                    z.string().max(200).optional(),
    primary_color:                   hexColor.optional(),
    header_text_color:               hexColor.optional(),
    table_header_bg_color:           hexColor.optional(),
    table_alt_bg_color:              hexColor.optional(),
    cover_title:                     z.string().max(120).optional(),
    cover_subtitle:                   z.string().max(200).nullable().optional(),
    page_width:                       z.number().positive().max(5000).optional(),
    page_height:                      z.number().positive().max(5000).optional(),
    show_cover_page:                  z.boolean().optional(),
    show_plan_summary_page:           z.boolean().optional(),
    show_back_cover_page:             z.boolean().optional(),
    max_exercises_per_page:           z.number().int().min(0).max(50).optional(),
    exercise_content_primary_color:   hexColor.nullable().optional(),
    day_summary_primary_color:        hexColor.nullable().optional(),
    show_notes:                       z.boolean().optional(),
    show_exercise_notes:              z.boolean().optional(),
    show_exercise_equipment:          z.boolean().optional(),
    show_sets_detail:                 z.boolean().optional(),
    show_day_summary_page:            z.boolean().optional(),
    show_cover_header:                z.boolean().optional(),
    show_cover_title:                 z.boolean().optional(),
    show_cover_subtitle:              z.boolean().optional(),
    show_cover_client_name:           z.boolean().optional(),
    body_text_color:                  hexColor.optional(),
    show_exercise_thumbnail:          z.boolean().optional(),
    exercise_thumbnail_size:          z.enum(['small', 'medium', 'large']).optional(),
});

export async function updateNutritionSettings(req: Request, res: Response, next: NextFunction) {
    const parsed = updateNutritionSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    try {
        const workspaceId = req.user!.workspaceId;
        const updated = await prisma.nutrition_pdf_settings.upsert({
            where:  { workspace_id: workspaceId },
            create: { id: createId(), workspace_id: workspaceId, ...parsed.data },
            update: { ...parsed.data, updated_at: new Date() },
        });
        res.json(updated);
    } catch (err) { next(err); }
}

export async function updateTrainingSettings(req: Request, res: Response, next: NextFunction) {
    const parsed = updateTrainingSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    try {
        const workspaceId = req.user!.workspaceId;
        const updated = await prisma.training_pdf_settings.upsert({
            where:  { workspace_id: workspaceId },
            create: { id: createId(), workspace_id: workspaceId, ...parsed.data },
            update: { ...parsed.data, updated_at: new Date() },
        });
        res.json(updated);
    } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// Logo upload — one per plan type, so a workspace can use a different logo
// for nutrition vs. training exports.
// ---------------------------------------------------------------------------

export async function uploadNutritionLogo(req: Request, res: Response, next: NextFunction) {
    try {
        const file = req.file as Express.MulterS3.File | undefined;
        if (!file) return res.status(400).json({ error: 'No file uploaded' });

        const workspaceId = req.user!.workspaceId;
        const logoUrl = toPublicUrl(file.key);
        const updated = await prisma.nutrition_pdf_settings.upsert({
            where:  { workspace_id: workspaceId },
            create: { id: createId(), workspace_id: workspaceId, logo_url: logoUrl },
            update: { logo_url: logoUrl, updated_at: new Date() },
        });
        res.json(updated);
    } catch (err) { next(err); }
}

export async function uploadTrainingLogo(req: Request, res: Response, next: NextFunction) {
    try {
        const file = req.file as Express.MulterS3.File | undefined;
        if (!file) return res.status(400).json({ error: 'No file uploaded' });

        const workspaceId = req.user!.workspaceId;
        const logoUrl = toPublicUrl(file.key);
        const updated = await prisma.training_pdf_settings.upsert({
            where:  { workspace_id: workspaceId },
            create: { id: createId(), workspace_id: workspaceId, logo_url: logoUrl },
            update: { logo_url: logoUrl, updated_at: new Date() },
        });
        res.json(updated);
    } catch (err) { next(err); }
}

// Clears the logo without uploading a replacement — a coach may want no logo
// at all (matches display name/footer text also being optional now). Doesn't
// attempt to delete the now-unreferenced file from storage: the stored value
// is a public URL, not the raw S3 key, so reversing it back to a key to issue
// a delete isn't worth the complexity for what's normal storage-cleanup debt.
export async function removeNutritionLogo(req: Request, res: Response, next: NextFunction) {
    try {
        const workspaceId = req.user!.workspaceId;
        const updated = await prisma.nutrition_pdf_settings.upsert({
            where:  { workspace_id: workspaceId },
            create: { id: createId(), workspace_id: workspaceId, logo_url: null },
            update: { logo_url: null, updated_at: new Date() },
        });
        res.json(updated);
    } catch (err) { next(err); }
}

export async function removeTrainingLogo(req: Request, res: Response, next: NextFunction) {
    try {
        const workspaceId = req.user!.workspaceId;
        const updated = await prisma.training_pdf_settings.upsert({
            where:  { workspace_id: workspaceId },
            create: { id: createId(), workspace_id: workspaceId, logo_url: null },
            update: { logo_url: null, updated_at: new Date() },
        });
        res.json(updated);
    } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// Cover image upload — validated to exactly match the page's pixel size (see
// expectedCoverImagePixelSize above), one per plan type. Uses a memory-storage
// multer (see routes.ts) instead of the S3/disk-writing uploaders makeUploader
// builds, specifically so the bytes can be measured and rejected *before*
// anything is persisted.
// ---------------------------------------------------------------------------

async function readAndValidateCoverImage(file: Express.Multer.File | undefined, pageSize: { page_width: number; page_height: number }) {
    if (!file) return { error: 'No file uploaded' } as const;

    const expected = expectedCoverImagePixelSize(pageSize);
    let actual: { width: number; height: number };
    try {
        actual = imageSize(file.buffer);
    } catch {
        return { error: 'Could not read image dimensions — upload a valid image file' } as const;
    }

    const widthOff = Math.abs(actual.width - expected.width);
    const heightOff = Math.abs(actual.height - expected.height);
    if (widthOff > COVER_IMAGE_SIZE_TOLERANCE_PX || heightOff > COVER_IMAGE_SIZE_TOLERANCE_PX) {
        return {
            error: `Cover image must be ${expected.width}x${expected.height}px to match the page size (uploaded image is ${actual.width}x${actual.height}px)`,
        } as const;
    }

    const ext = path.extname(file.originalname || '').toLowerCase() || '.jpg';
    const key = await putBuffer(
        'pdf-settings/cover-images',
        `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`,
        file.buffer,
        file.mimetype
    );
    return { imageUrl: toPublicUrl(key) } as const;
}

export async function uploadNutritionCoverImage(req: Request, res: Response, next: NextFunction) {
    try {
        const workspaceId = req.user!.workspaceId;
        const settings = await getOrDefaultNutritionPdfSettings(workspaceId);
        const result = await readAndValidateCoverImage(req.file as Express.Multer.File | undefined, settings);
        if ('error' in result) return res.status(400).json({ error: result.error });

        const updated = await prisma.nutrition_pdf_settings.upsert({
            where:  { workspace_id: workspaceId },
            create: { id: createId(), workspace_id: workspaceId, cover_image_url: result.imageUrl },
            update: { cover_image_url: result.imageUrl, updated_at: new Date() },
        });
        res.json(updated);
    } catch (err) { next(err); }
}

export async function uploadTrainingCoverImage(req: Request, res: Response, next: NextFunction) {
    try {
        const workspaceId = req.user!.workspaceId;
        const settings = await getOrDefaultTrainingPdfSettings(workspaceId);
        const result = await readAndValidateCoverImage(req.file as Express.Multer.File | undefined, settings);
        if ('error' in result) return res.status(400).json({ error: result.error });

        const updated = await prisma.training_pdf_settings.upsert({
            where:  { workspace_id: workspaceId },
            create: { id: createId(), workspace_id: workspaceId, cover_image_url: result.imageUrl },
            update: { cover_image_url: result.imageUrl, updated_at: new Date() },
        });
        res.json(updated);
    } catch (err) { next(err); }
}

export async function removeNutritionCoverImage(req: Request, res: Response, next: NextFunction) {
    try {
        const workspaceId = req.user!.workspaceId;
        const updated = await prisma.nutrition_pdf_settings.upsert({
            where:  { workspace_id: workspaceId },
            create: { id: createId(), workspace_id: workspaceId, cover_image_url: null },
            update: { cover_image_url: null, updated_at: new Date() },
        });
        res.json(updated);
    } catch (err) { next(err); }
}

export async function removeTrainingCoverImage(req: Request, res: Response, next: NextFunction) {
    try {
        const workspaceId = req.user!.workspaceId;
        const updated = await prisma.training_pdf_settings.upsert({
            where:  { workspace_id: workspaceId },
            create: { id: createId(), workspace_id: workspaceId, cover_image_url: null },
            update: { cover_image_url: null, updated_at: new Date() },
        });
        res.json(updated);
    } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// Other background image slots (unvalidated — 'cover' is deliberately absent
// from both maps, see readAndValidateCoverImage above).
// ---------------------------------------------------------------------------

const NUTRITION_BACKGROUND_SLOT_COLUMN: Record<string, 'page_bg_image_url' | 'back_cover_bg_image_url' | 'summary_bg_image_url' | 'plan_summary_bg_image_url' | 'meal_summary_bg_image_url' | 'cycle_summary_bg_image_url'> = {
    page:         'page_bg_image_url',
    backCover:    'back_cover_bg_image_url',
    summary:      'summary_bg_image_url',
    planSummary:  'plan_summary_bg_image_url',
    mealSummary:  'meal_summary_bg_image_url',
    cycleSummary: 'cycle_summary_bg_image_url',
};

const TRAINING_BACKGROUND_SLOT_COLUMN: Record<string, 'page_bg_image_url' | 'back_cover_bg_image_url' | 'day_summary_bg_image_url'> = {
    page:      'page_bg_image_url',
    backCover: 'back_cover_bg_image_url',
    daySummary: 'day_summary_bg_image_url',
};

export async function uploadNutritionBackground(req: Request, res: Response, next: NextFunction) {
    try {
        const slot = req.params.slot as string;
        const column = NUTRITION_BACKGROUND_SLOT_COLUMN[slot];
        if (!column) return res.status(400).json({ error: `Unknown background slot: ${slot}` });

        const file = req.file as Express.MulterS3.File | undefined;
        if (!file) return res.status(400).json({ error: 'No file uploaded' });

        const workspaceId = req.user!.workspaceId;
        const imageUrl = toPublicUrl(file.key);
        const updated = await prisma.nutrition_pdf_settings.upsert({
            where:  { workspace_id: workspaceId },
            create: { id: createId(), workspace_id: workspaceId, [column]: imageUrl },
            update: { [column]: imageUrl, updated_at: new Date() },
        });
        res.json(updated);
    } catch (err) { next(err); }
}

export async function uploadTrainingBackground(req: Request, res: Response, next: NextFunction) {
    try {
        const slot = req.params.slot as string;
        const column = TRAINING_BACKGROUND_SLOT_COLUMN[slot];
        if (!column) return res.status(400).json({ error: `Unknown background slot: ${slot}` });

        const file = req.file as Express.MulterS3.File | undefined;
        if (!file) return res.status(400).json({ error: 'No file uploaded' });

        const workspaceId = req.user!.workspaceId;
        const imageUrl = toPublicUrl(file.key);
        const updated = await prisma.training_pdf_settings.upsert({
            where:  { workspace_id: workspaceId },
            create: { id: createId(), workspace_id: workspaceId, [column]: imageUrl },
            update: { [column]: imageUrl, updated_at: new Date() },
        });
        res.json(updated);
    } catch (err) { next(err); }
}

export async function removeNutritionBackground(req: Request, res: Response, next: NextFunction) {
    try {
        const slot = req.params.slot as string;
        const column = NUTRITION_BACKGROUND_SLOT_COLUMN[slot];
        if (!column) return res.status(400).json({ error: `Unknown background slot: ${slot}` });

        const workspaceId = req.user!.workspaceId;
        const updated = await prisma.nutrition_pdf_settings.upsert({
            where:  { workspace_id: workspaceId },
            create: { id: createId(), workspace_id: workspaceId, [column]: null },
            update: { [column]: null, updated_at: new Date() },
        });
        res.json(updated);
    } catch (err) { next(err); }
}

export async function removeTrainingBackground(req: Request, res: Response, next: NextFunction) {
    try {
        const slot = req.params.slot as string;
        const column = TRAINING_BACKGROUND_SLOT_COLUMN[slot];
        if (!column) return res.status(400).json({ error: `Unknown background slot: ${slot}` });

        const workspaceId = req.user!.workspaceId;
        const updated = await prisma.training_pdf_settings.upsert({
            where:  { workspace_id: workspaceId },
            create: { id: createId(), workspace_id: workspaceId, [column]: null },
            update: { [column]: null, updated_at: new Date() },
        });
        res.json(updated);
    } catch (err) { next(err); }
}
