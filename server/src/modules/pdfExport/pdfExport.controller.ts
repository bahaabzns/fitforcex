import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import path from 'path';
import { Prisma } from '@prisma/client';
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
import {
    getNutritionPdfProfile,
    getTrainingPdfProfile,
    listNutritionPdfProfiles,
    listTrainingPdfProfiles,
} from './pdfExport.service';
import { SAMPLE_NUTRITION_PLAN, SAMPLE_TRAINING_PLAN, SAMPLE_CLIENT_NAME } from './templates/sampleData';

type Row = Record<string, unknown>;

// A workspace keeps a handful of branding profiles per plan type, not an
// unbounded list — this is a coach picking between a few looks, not a CMS.
const MAX_PDF_PROFILES_PER_TYPE = 20;

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

// The export/preview endpoints name the profile to render with via ?profileId=;
// absent or unrecognized falls back to the workspace's default profile inside
// the service.
function profileIdFromQuery(req: Request): string | null {
    return typeof req.query.profileId === 'string' && req.query.profileId ? req.query.profileId : null;
}

function isUniqueViolation(err: unknown): boolean {
    return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

// "<name> copy", then "<name> copy 2", "<name> copy 3", … skipping names
// already taken in the same (workspace, type). The DB unique constraint is
// still the backstop (P2002 -> 400).
function nextCopyName(sourceName: string, takenNames: string[]): string {
    const taken = new Set(takenNames);
    const base = `${sourceName} copy`;
    if (!taken.has(base)) return base;
    for (let n = 2; n < 1000; n++) {
        const candidate = `${base} ${n}`;
        if (!taken.has(candidate)) return candidate;
    }
    return `${base} ${createId().slice(0, 6)}`;
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
            getNutritionPdfProfile(workspaceId, profileIdFromQuery(req)),
        ]);

        const html = await renderNutritionPlanHtml(plan as Row, clientName, settings);
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
            getTrainingPdfProfile(workspaceId, profileIdFromQuery(req)),
        ]);

        const html = await renderTrainingPlanHtml(plan as Row, clientName, settings);
        const pdfBuffer = await renderHtmlToPdf(html, { width: settings.page_width, height: settings.page_height });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${buildExportFilename((plan as Row).name, clientName)}"`);
        res.send(pdfBuffer);
    } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// Profiles CRUD — nutrition_pdf_settings and training_pdf_settings are fully
// independent tables (see DECISIONS.md, 2026-07-28), so these stay as separate
// per-type functions rather than one generic handler switching on a param —
// each type has its own field set and its own Prisma model. Migration 091
// turned the single row per workspace into many named profiles, one flagged
// is_default.
// ---------------------------------------------------------------------------

const profileNameSchema = z
    .string()
    .trim()
    .min(1, 'Profile name is required')
    .max(60, 'Profile name must be 60 characters or fewer');

const createProfileSchema = z.object({ name: profileNameSchema });

const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Must be a hex color like #007AFF');

// Fields shared by both plan types (branding, cover page, page size) plus
// nutrition's own section toggles. `name`/`is_default` are profile metadata a
// PUT can also change (is_default only ever set to true — you switch the
// default by promoting another profile, never by clearing this one).
const updateNutritionSettingsSchema = z.object({
    name:                          profileNameSchema.optional(),
    is_default:                    z.boolean().optional(),
    coach_name:                    z.string().max(120).optional(),
    footer_text:                   z.string().max(200).optional(),
    primary_color:                 hexColor.optional(),
    header_text_color:             hexColor.optional(),
    table_header_bg_color:         hexColor.optional(),
    table_alt_bg_color:            hexColor.optional(),
    cover_title:                   z.string().max(120).optional(),
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
    name:                          profileNameSchema.optional(),
    is_default:                    z.boolean().optional(),
    coach_name:                    z.string().max(120).optional(),
    footer_text:                   z.string().max(200).optional(),
    primary_color:                 hexColor.optional(),
    header_text_color:             hexColor.optional(),
    table_header_bg_color:         hexColor.optional(),
    table_alt_bg_color:            hexColor.optional(),
    cover_title:                   z.string().max(120).optional(),
    cover_subtitle:                z.string().max(200).nullable().optional(),
    page_width:                    z.number().positive().max(5000).optional(),
    page_height:                   z.number().positive().max(5000).optional(),
    show_cover_page:               z.boolean().optional(),
    show_plan_summary_page:        z.boolean().optional(),
    show_back_cover_page:          z.boolean().optional(),
    max_exercises_per_page:        z.number().int().min(0).max(50).optional(),
    exercise_content_primary_color: hexColor.nullable().optional(),
    day_summary_primary_color:     hexColor.nullable().optional(),
    show_notes:                    z.boolean().optional(),
    show_exercise_notes:           z.boolean().optional(),
    show_exercise_equipment:       z.boolean().optional(),
    show_sets_detail:              z.boolean().optional(),
    show_day_summary_page:         z.boolean().optional(),
    show_cover_header:             z.boolean().optional(),
    show_cover_title:              z.boolean().optional(),
    show_cover_subtitle:           z.boolean().optional(),
    show_cover_client_name:        z.boolean().optional(),
    body_text_color:               hexColor.optional(),
    show_exercise_thumbnail:       z.boolean().optional(),
    exercise_thumbnail_size:       z.enum(['small', 'medium', 'large']).optional(),
});

// --- nutrition profiles ---

export async function listNutritionProfiles(req: Request, res: Response, next: NextFunction) {
    try {
        res.json(await listNutritionPdfProfiles(req.user!.workspaceId));
    } catch (err) { next(err); }
}

export async function getNutritionProfile(req: Request, res: Response, next: NextFunction) {
    try {
        const profile = await prisma.nutrition_pdf_settings.findFirst({
            where: { id: (req.params.profileId as string), workspace_id: req.user!.workspaceId },
        });
        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        res.json(profile);
    } catch (err) { next(err); }
}

export async function createNutritionProfile(req: Request, res: Response, next: NextFunction) {
    const parsed = createProfileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid profile name' });
    try {
        const workspaceId = req.user!.workspaceId;
        const count = await prisma.nutrition_pdf_settings.count({ where: { workspace_id: workspaceId } });
        if (count >= MAX_PDF_PROFILES_PER_TYPE) {
            return res.status(400).json({ error: `A workspace can have at most ${MAX_PDF_PROFILES_PER_TYPE} nutrition branding profiles` });
        }
        // First profile a workspace ever saves becomes its default (nothing
        // else can be), so an export always resolves to a real profile.
        const created = await prisma.nutrition_pdf_settings.create({
            data: { id: createId(), workspace_id: workspaceId, name: parsed.data.name, is_default: count === 0 },
        });
        res.status(201).json(created);
    } catch (err) {
        if (isUniqueViolation(err)) return res.status(400).json({ error: 'A profile with that name already exists' });
        next(err);
    }
}

// Copy every branding field of one profile into a new "<name> copy" profile —
// image urls included (two profiles pointing at the same stored file is fine;
// replacing an image uploads a fresh file and rewrites only that profile). The
// copy is never the default.
export async function duplicateNutritionProfile(req: Request, res: Response, next: NextFunction) {
    try {
        const workspaceId = req.user!.workspaceId;
        const sourceId = (req.params.profileId as string);

        const profiles = await prisma.nutrition_pdf_settings.findMany({ where: { workspace_id: workspaceId } });
        const source = profiles.find(p => p.id === sourceId);
        if (!source) return res.status(404).json({ error: 'Profile not found' });
        if (profiles.length >= MAX_PDF_PROFILES_PER_TYPE) {
            return res.status(400).json({ error: `A workspace can have at most ${MAX_PDF_PROFILES_PER_TYPE} nutrition branding profiles` });
        }

        const { id: _id, workspace_id: _ws, updated_at: _u, name: _n, is_default: _d, ...fields } = source;
        const created = await prisma.nutrition_pdf_settings.create({
            data: {
                ...fields,
                id: createId(),
                workspace_id: workspaceId,
                name: nextCopyName(source.name, profiles.map(p => p.name)),
                is_default: false,
            },
        });
        res.status(201).json(created);
    } catch (err) {
        if (isUniqueViolation(err)) return res.status(400).json({ error: 'A profile with that name already exists' });
        next(err);
    }
}

export async function updateNutritionProfile(req: Request, res: Response, next: NextFunction) {
    const parsed = updateNutritionSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    try {
        const workspaceId = req.user!.workspaceId;
        const profileId = (req.params.profileId as string);
        const { is_default, ...fields } = parsed.data;

        const owned = await prisma.nutrition_pdf_settings.findFirst({ where: { id: profileId, workspace_id: workspaceId } });
        if (!owned) return res.status(404).json({ error: 'Profile not found' });

        const updated = await prisma.$transaction(async (tx) => {
            if (is_default === true) {
                await tx.nutrition_pdf_settings.updateMany({
                    where: { workspace_id: workspaceId, is_default: true, NOT: { id: profileId } },
                    data:  { is_default: false },
                });
            }
            return tx.nutrition_pdf_settings.update({
                where: { id: profileId },
                data:  { ...fields, ...(is_default === true ? { is_default: true } : {}), updated_at: new Date() },
            });
        });
        res.json(updated);
    } catch (err) {
        if (isUniqueViolation(err)) return res.status(400).json({ error: 'A profile with that name already exists' });
        next(err);
    }
}

export async function deleteNutritionProfile(req: Request, res: Response, next: NextFunction) {
    try {
        const workspaceId = req.user!.workspaceId;
        const profileId = (req.params.profileId as string);

        const profiles = await prisma.nutrition_pdf_settings.findMany({ where: { workspace_id: workspaceId } });
        const target = profiles.find(p => p.id === profileId);
        if (!target) return res.status(404).json({ error: 'Profile not found' });
        if (profiles.length <= 1) {
            return res.status(400).json({ error: 'A workspace must keep at least one nutrition branding profile' });
        }

        await prisma.$transaction(async (tx) => {
            await tx.nutrition_pdf_settings.delete({ where: { id: profileId } });
            if (target.is_default) {
                // Keep exactly one default: promote the most-recently-updated
                // of what's left.
                const promoted = profiles
                    .filter(p => p.id !== profileId)
                    .sort((a, b) => (b.updated_at?.getTime() ?? 0) - (a.updated_at?.getTime() ?? 0))[0];
                await tx.nutrition_pdf_settings.update({ where: { id: promoted.id }, data: { is_default: true } });
            }
        });
        res.json(await listNutritionPdfProfiles(workspaceId));
    } catch (err) { next(err); }
}

// --- training profiles ---

export async function listTrainingProfiles(req: Request, res: Response, next: NextFunction) {
    try {
        res.json(await listTrainingPdfProfiles(req.user!.workspaceId));
    } catch (err) { next(err); }
}

export async function getTrainingProfile(req: Request, res: Response, next: NextFunction) {
    try {
        const profile = await prisma.training_pdf_settings.findFirst({
            where: { id: (req.params.profileId as string), workspace_id: req.user!.workspaceId },
        });
        if (!profile) return res.status(404).json({ error: 'Profile not found' });
        res.json(profile);
    } catch (err) { next(err); }
}

export async function createTrainingProfile(req: Request, res: Response, next: NextFunction) {
    const parsed = createProfileSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0]?.message ?? 'Invalid profile name' });
    try {
        const workspaceId = req.user!.workspaceId;
        const count = await prisma.training_pdf_settings.count({ where: { workspace_id: workspaceId } });
        if (count >= MAX_PDF_PROFILES_PER_TYPE) {
            return res.status(400).json({ error: `A workspace can have at most ${MAX_PDF_PROFILES_PER_TYPE} training branding profiles` });
        }
        const created = await prisma.training_pdf_settings.create({
            data: { id: createId(), workspace_id: workspaceId, name: parsed.data.name, is_default: count === 0 },
        });
        res.status(201).json(created);
    } catch (err) {
        if (isUniqueViolation(err)) return res.status(400).json({ error: 'A profile with that name already exists' });
        next(err);
    }
}

// See duplicateNutritionProfile.
export async function duplicateTrainingProfile(req: Request, res: Response, next: NextFunction) {
    try {
        const workspaceId = req.user!.workspaceId;
        const sourceId = (req.params.profileId as string);

        const profiles = await prisma.training_pdf_settings.findMany({ where: { workspace_id: workspaceId } });
        const source = profiles.find(p => p.id === sourceId);
        if (!source) return res.status(404).json({ error: 'Profile not found' });
        if (profiles.length >= MAX_PDF_PROFILES_PER_TYPE) {
            return res.status(400).json({ error: `A workspace can have at most ${MAX_PDF_PROFILES_PER_TYPE} training branding profiles` });
        }

        const { id: _id, workspace_id: _ws, updated_at: _u, name: _n, is_default: _d, ...fields } = source;
        const created = await prisma.training_pdf_settings.create({
            data: {
                ...fields,
                id: createId(),
                workspace_id: workspaceId,
                name: nextCopyName(source.name, profiles.map(p => p.name)),
                is_default: false,
            },
        });
        res.status(201).json(created);
    } catch (err) {
        if (isUniqueViolation(err)) return res.status(400).json({ error: 'A profile with that name already exists' });
        next(err);
    }
}

export async function updateTrainingProfile(req: Request, res: Response, next: NextFunction) {
    const parsed = updateTrainingSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    try {
        const workspaceId = req.user!.workspaceId;
        const profileId = (req.params.profileId as string);
        const { is_default, ...fields } = parsed.data;

        const owned = await prisma.training_pdf_settings.findFirst({ where: { id: profileId, workspace_id: workspaceId } });
        if (!owned) return res.status(404).json({ error: 'Profile not found' });

        const updated = await prisma.$transaction(async (tx) => {
            if (is_default === true) {
                await tx.training_pdf_settings.updateMany({
                    where: { workspace_id: workspaceId, is_default: true, NOT: { id: profileId } },
                    data:  { is_default: false },
                });
            }
            return tx.training_pdf_settings.update({
                where: { id: profileId },
                data:  { ...fields, ...(is_default === true ? { is_default: true } : {}), updated_at: new Date() },
            });
        });
        res.json(updated);
    } catch (err) {
        if (isUniqueViolation(err)) return res.status(400).json({ error: 'A profile with that name already exists' });
        next(err);
    }
}

export async function deleteTrainingProfile(req: Request, res: Response, next: NextFunction) {
    try {
        const workspaceId = req.user!.workspaceId;
        const profileId = (req.params.profileId as string);

        const profiles = await prisma.training_pdf_settings.findMany({ where: { workspace_id: workspaceId } });
        const target = profiles.find(p => p.id === profileId);
        if (!target) return res.status(404).json({ error: 'Profile not found' });
        if (profiles.length <= 1) {
            return res.status(400).json({ error: 'A workspace must keep at least one training branding profile' });
        }

        await prisma.$transaction(async (tx) => {
            await tx.training_pdf_settings.delete({ where: { id: profileId } });
            if (target.is_default) {
                const promoted = profiles
                    .filter(p => p.id !== profileId)
                    .sort((a, b) => (b.updated_at?.getTime() ?? 0) - (a.updated_at?.getTime() ?? 0))[0];
                await tx.training_pdf_settings.update({ where: { id: promoted.id }, data: { is_default: true } });
            }
        });
        res.json(await listTrainingPdfProfiles(workspaceId));
    } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// Live preview — draft (unsaved) values rendered over a chosen profile (or the
// default profile when none is named). Nothing here is persisted, so there's
// no need for the stricter validation the update schemas apply to a real save;
// a malformed value just renders oddly in this workspace's own preview. The
// draft still flows through the same escaped template a real export uses (see
// templates/layout.ts's escapeHtml, and setJavaScriptEnabled(false) in
// lib/pdfRenderer.ts).
// ---------------------------------------------------------------------------

export async function previewSettings(req: Request, res: Response, next: NextFunction) {
    try {
        const workspaceId = req.user!.workspaceId;
        const type = req.query.type === 'training' ? 'training' : 'nutrition';
        const body = req.body && typeof req.body === 'object' ? req.body : {};

        if (type === 'training') {
            const base = await getTrainingPdfProfile(workspaceId, profileIdFromQuery(req));
            const draft = { ...base, ...body };
            const html = await renderTrainingPlanHtml(SAMPLE_TRAINING_PLAN, SAMPLE_CLIENT_NAME, draft);
            const pdfBuffer = await renderHtmlToPdf(html, { width: draft.page_width, height: draft.page_height });
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
            return res.send(pdfBuffer);
        }

        const base = await getNutritionPdfProfile(workspaceId, profileIdFromQuery(req));
        const draft = { ...base, ...body };
        const html = await renderNutritionPlanHtml(SAMPLE_NUTRITION_PLAN, SAMPLE_CLIENT_NAME, draft);
        const pdfBuffer = await renderHtmlToPdf(html, { width: draft.page_width, height: draft.page_height });
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'inline; filename="preview.pdf"');
        res.send(pdfBuffer);
    } catch (err) { next(err); }
}

// ---------------------------------------------------------------------------
// Image uploads — every write targets one profile by id, scoped to the
// caller's workspace. `updateMany({ where: { id, workspace_id } })` returns a
// count of 0 for an id that isn't in this workspace, which is the 404 signal —
// there's no upsert here, the profile must already exist.
// ---------------------------------------------------------------------------

async function setNutritionProfileFields(workspaceId: string, profileId: string, data: Prisma.nutrition_pdf_settingsUpdateManyMutationInput) {
    const { count } = await prisma.nutrition_pdf_settings.updateMany({
        where: { id: profileId, workspace_id: workspaceId },
        data:  { ...data, updated_at: new Date() },
    });
    if (count === 0) return null;
    return prisma.nutrition_pdf_settings.findFirst({ where: { id: profileId, workspace_id: workspaceId } });
}

async function setTrainingProfileFields(workspaceId: string, profileId: string, data: Prisma.training_pdf_settingsUpdateManyMutationInput) {
    const { count } = await prisma.training_pdf_settings.updateMany({
        where: { id: profileId, workspace_id: workspaceId },
        data:  { ...data, updated_at: new Date() },
    });
    if (count === 0) return null;
    return prisma.training_pdf_settings.findFirst({ where: { id: profileId, workspace_id: workspaceId } });
}

// --- logo (one per profile) ---

export async function uploadNutritionLogo(req: Request, res: Response, next: NextFunction) {
    try {
        const file = req.file as Express.MulterS3.File | undefined;
        if (!file) return res.status(400).json({ error: 'No file uploaded' });
        const updated = await setNutritionProfileFields(req.user!.workspaceId, (req.params.profileId as string), { logo_url: toPublicUrl(file.key) });
        if (!updated) return res.status(404).json({ error: 'Profile not found' });
        res.json(updated);
    } catch (err) { next(err); }
}

export async function uploadTrainingLogo(req: Request, res: Response, next: NextFunction) {
    try {
        const file = req.file as Express.MulterS3.File | undefined;
        if (!file) return res.status(400).json({ error: 'No file uploaded' });
        const updated = await setTrainingProfileFields(req.user!.workspaceId, (req.params.profileId as string), { logo_url: toPublicUrl(file.key) });
        if (!updated) return res.status(404).json({ error: 'Profile not found' });
        res.json(updated);
    } catch (err) { next(err); }
}

// Clears the logo without uploading a replacement — a coach may want no logo
// at all (display name / footer text are optional too). Doesn't delete the
// now-unreferenced file from storage: the stored value is a public URL, not
// the raw key, so reversing it isn't worth the complexity for normal
// storage-cleanup debt.
export async function removeNutritionLogo(req: Request, res: Response, next: NextFunction) {
    try {
        const updated = await setNutritionProfileFields(req.user!.workspaceId, (req.params.profileId as string), { logo_url: null });
        if (!updated) return res.status(404).json({ error: 'Profile not found' });
        res.json(updated);
    } catch (err) { next(err); }
}

export async function removeTrainingLogo(req: Request, res: Response, next: NextFunction) {
    try {
        const updated = await setTrainingProfileFields(req.user!.workspaceId, (req.params.profileId as string), { logo_url: null });
        if (!updated) return res.status(404).json({ error: 'Profile not found' });
        res.json(updated);
    } catch (err) { next(err); }
}

// --- cover image (validated to exactly match the profile's page pixel size) ---
// Uses a memory-storage multer (see routes.ts) instead of the S3/disk-writing
// uploaders makeUploader builds, specifically so the bytes can be measured and
// rejected *before* anything is persisted.

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
        const profileId = (req.params.profileId as string);
        const profile = await prisma.nutrition_pdf_settings.findFirst({ where: { id: profileId, workspace_id: workspaceId } });
        if (!profile) return res.status(404).json({ error: 'Profile not found' });

        const result = await readAndValidateCoverImage(req.file as Express.Multer.File | undefined, profile);
        if ('error' in result) return res.status(400).json({ error: result.error });

        const updated = await setNutritionProfileFields(workspaceId, profileId, { cover_image_url: result.imageUrl });
        res.json(updated);
    } catch (err) { next(err); }
}

export async function uploadTrainingCoverImage(req: Request, res: Response, next: NextFunction) {
    try {
        const workspaceId = req.user!.workspaceId;
        const profileId = (req.params.profileId as string);
        const profile = await prisma.training_pdf_settings.findFirst({ where: { id: profileId, workspace_id: workspaceId } });
        if (!profile) return res.status(404).json({ error: 'Profile not found' });

        const result = await readAndValidateCoverImage(req.file as Express.Multer.File | undefined, profile);
        if ('error' in result) return res.status(400).json({ error: result.error });

        const updated = await setTrainingProfileFields(workspaceId, profileId, { cover_image_url: result.imageUrl });
        res.json(updated);
    } catch (err) { next(err); }
}

export async function removeNutritionCoverImage(req: Request, res: Response, next: NextFunction) {
    try {
        const updated = await setNutritionProfileFields(req.user!.workspaceId, (req.params.profileId as string), { cover_image_url: null });
        if (!updated) return res.status(404).json({ error: 'Profile not found' });
        res.json(updated);
    } catch (err) { next(err); }
}

export async function removeTrainingCoverImage(req: Request, res: Response, next: NextFunction) {
    try {
        const updated = await setTrainingProfileFields(req.user!.workspaceId, (req.params.profileId as string), { cover_image_url: null });
        if (!updated) return res.status(404).json({ error: 'Profile not found' });
        res.json(updated);
    } catch (err) { next(err); }
}

// --- other background image slots (unvalidated — 'cover' is deliberately
// absent from both maps, it has its own validated endpoint above) ---

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

        const updated = await setNutritionProfileFields(req.user!.workspaceId, (req.params.profileId as string), { [column]: toPublicUrl(file.key) });
        if (!updated) return res.status(404).json({ error: 'Profile not found' });
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

        const updated = await setTrainingProfileFields(req.user!.workspaceId, (req.params.profileId as string), { [column]: toPublicUrl(file.key) });
        if (!updated) return res.status(404).json({ error: 'Profile not found' });
        res.json(updated);
    } catch (err) { next(err); }
}

export async function removeNutritionBackground(req: Request, res: Response, next: NextFunction) {
    try {
        const slot = req.params.slot as string;
        const column = NUTRITION_BACKGROUND_SLOT_COLUMN[slot];
        if (!column) return res.status(400).json({ error: `Unknown background slot: ${slot}` });

        const updated = await setNutritionProfileFields(req.user!.workspaceId, (req.params.profileId as string), { [column]: null });
        if (!updated) return res.status(404).json({ error: 'Profile not found' });
        res.json(updated);
    } catch (err) { next(err); }
}

export async function removeTrainingBackground(req: Request, res: Response, next: NextFunction) {
    try {
        const slot = req.params.slot as string;
        const column = TRAINING_BACKGROUND_SLOT_COLUMN[slot];
        if (!column) return res.status(400).json({ error: `Unknown background slot: ${slot}` });

        const updated = await setTrainingProfileFields(req.user!.workspaceId, (req.params.profileId as string), { [column]: null });
        if (!updated) return res.status(404).json({ error: 'Profile not found' });
        res.json(updated);
    } catch (err) { next(err); }
}
