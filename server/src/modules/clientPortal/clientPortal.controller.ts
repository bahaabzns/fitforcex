import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { z } from 'zod';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { toPublicUrl, makeUploader, deleteFile } from '../../lib/storage';
import { attachmentTypeFromMime, serializeMessage, MESSAGE_SELECT } from '../../lib/messageAttachments';
import { attachmentUploaderFor, isValidAttachmentCategory } from '../../lib/formAttachments';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { recordEvent, teamRecipients } from '../../lib/events';
import {
    summarizeLog,
    buildExerciseProgress,
    extractPreviousSets,
    distinctLoggedExercises,
    extractRecentSessions,
    computePersonalRecords,
    computeCoachInsights,
    type LoggedExercise,
    type WorkoutLogRow,
    type ExerciseKey,
} from '../../utils/workoutLogStats';
import { buildTransformationPayload } from '../clients/clients.controller';
import { normalizeEmail } from '../../utils/email';
import { attachEditHistory } from '../../utils/formResponseHistory';

/** Display name for a notification's `metadata.actorName` — best-effort, null on any miss. */
async function getClientDisplayName(clientId: string): Promise<string | null> {
    const client = await prisma.clients.findUnique({ where: { id: clientId }, select: { fname: true, lname: true } });
    if (!client) return null;
    return `${client.fname} ${client.lname}`.trim() || null;
}

async function activateDueClientScheduledRequests(clientId: string): Promise<void> {
    await prisma.$executeRaw`
        UPDATE form_requests
        SET status = 'pending',
            requested_at = COALESCE(requested_at, NOW())
        WHERE client_id = ${clientId}
          AND status = 'scheduled'
          AND scheduled_at IS NOT NULL
          AND scheduled_at <= NOW()
    `;
}

function buildNutritionPlanHierarchy(plan: Record<string, unknown>, flatRows: Record<string, unknown>[]) {
    const cyclesMap = new Map<string, Record<string, unknown>>();
    const mealsMap  = new Map<string, Record<string, unknown>>();
    const itemsMap  = new Map<string, Record<string, unknown>>();

    for (const row of flatRows) {
        if (row.cycle_id && !cyclesMap.has(row.cycle_id as string)) {
            cyclesMap.set(row.cycle_id as string, {
                id: row.cycle_id, plan_id: row.plan_id, name: row.cycle_name,
                cycle_order: row.cycle_order, goal_calories: row.goal_calories,
                goal_protein: row.goal_protein, goal_carbs: row.goal_carbs,
                goal_fats: row.goal_fats, note: row.cycle_note, meals: [],
            });
        }
        if (row.meal_id && !mealsMap.has(row.meal_id as string)) {
            mealsMap.set(row.meal_id as string, {
                id: row.meal_id, cycle_id: row.cycle_id, name: row.meal_name,
                meal_order: row.meal_order, note: row.meal_note, items: [],
            });
            (cyclesMap.get(row.cycle_id as string)!.meals as unknown[]).push(mealsMap.get(row.meal_id as string)!);
        }
        if (row.item_id && !itemsMap.has(row.item_id as string)) {
            itemsMap.set(row.item_id as string, {
                id: row.item_id, meal_id: row.meal_id, food_item_id: row.food_item_id,
                amount: row.item_amount, meal_item_order: row.meal_item_order,
                name: row.food_name, name_ar: row.food_name_ar, serving_unit: row.serving_unit,
                calories_per_serving: row.calories_per_serving, protein_per_serving: row.protein_per_serving,
                carbs_per_serving: row.carbs_per_serving, fats_per_serving: row.fats_per_serving,
                serving_size: row.serving_size, food_category: row.food_category, alternatives: [],
                is_swapped: row.is_swapped === true, swapped_at: row.swapped_at,
                original_food_item_id: row.original_food_item_id,
                original_food_name: row.original_food_name, original_food_name_ar: row.original_food_name_ar,
            });
            (mealsMap.get(row.meal_id as string)!.items as unknown[]).push(itemsMap.get(row.item_id as string)!);
        }
        if (row.alt_id) {
            const alts = itemsMap.get(row.item_id as string)?.alternatives as Array<Record<string, unknown>> | undefined;
            if (!alts?.some(a => a.id === row.alt_id)) {
                alts?.push({
                    id: row.alt_id, meal_item_id: row.meal_item_id, food_item_id: row.alt_food_item_id,
                    amount: row.alt_amount, alt_order: row.alt_order, name: row.alt_food_name,
                    name_ar: row.alt_food_name_ar, serving_unit: row.alt_serving_unit,
                    calories_per_serving: row.alt_calories_per_serving, protein_per_serving: row.alt_protein_per_serving,
                    carbs_per_serving: row.alt_carbs_per_serving, fats_per_serving: row.alt_fats_per_serving,
                    serving_size: row.alt_serving_size, food_category: row.alt_food_category,
                });
            }
        }
    }

    const cycles = Array.from(cyclesMap.values()).sort((a, b) => (a.cycle_order as number) - (b.cycle_order as number));
    cycles.forEach(cycle => {
        (cycle.meals as Record<string, unknown>[]).sort((a, b) => (a.meal_order as number) - (b.meal_order as number));
        (cycle.meals as Record<string, unknown>[]).forEach(meal => {
            (meal.items as Record<string, unknown>[]).sort((a, b) => (a.meal_item_order as number) - (b.meal_item_order as number));
            (meal.items as Record<string, unknown>[]).forEach(item => {
                (item.alternatives as Record<string, unknown>[]).sort((a, b) => (a.alt_order as number) - (b.alt_order as number));
            });
        });
    });
    return { ...plan, cycles };
}

function buildTrainingPlanHierarchy(plan: Record<string, unknown>, flatRows: Record<string, unknown>[]) {
    const daysMap      = new Map<string, Record<string, unknown>>();
    const exercisesMap = new Map<string, Record<string, unknown>>();

    for (const row of flatRows) {
        if (row.day_id && !daysMap.has(row.day_id as string)) {
            daysMap.set(row.day_id as string, {
                id: row.day_id, plan_id: row.plan_id, name: row.day_name,
                day_order: row.day_order, notes: row.day_notes, exercises: [],
            });
        }
        if (row.exercise_id && !exercisesMap.has(row.exercise_id as string)) {
            exercisesMap.set(row.exercise_id as string, {
                id: row.exercise_id, day_id: row.day_id, name: row.exercise_name,
                library_name_en: row.library_name_en, library_name_ar: row.library_name_ar,
                exercise_order: row.exercise_order, equipment: row.equipment, equipment_ar: row.equipment_ar,
                notes: row.exercise_notes, exercise_library_id: row.exercise_library_id,
                thumbnail_path: toPublicUrl(row.thumbnail_path as string | null),
                video_path:     toPublicUrl(row.video_path as string | null),
                youtube_url: row.youtube_url, muscle_group: row.muscle_group, muscle_group_ar: row.muscle_group_ar,
                instructions_en: row.instructions_en, instructions_ar: row.instructions_ar,
                tracking_type: row.tracking_type, tracked_metrics: row.tracked_metrics,
                sets: [], alternatives: [],
            });
            (daysMap.get(row.day_id as string)!.exercises as unknown[]).push(exercisesMap.get(row.exercise_id as string)!);
        }
        if (row.set_id) {
            const sets = exercisesMap.get(row.exercise_id as string)?.sets as Array<Record<string, unknown>> | undefined;
            if (!sets?.some(s => s.id === row.set_id)) {
                sets?.push({
                    id: row.set_id, exercise_id: row.exercise_id, set_order: row.set_order,
                    reps: row.reps, rest_seconds: row.rest_seconds, tempo: row.tempo, rir: row.rir, rpe: row.rpe,
                    duration_seconds: row.duration_seconds, distance_km: row.distance_km,
                    incline_percent: row.incline_percent, speed_kmh: row.speed_kmh,
                });
            }
        }
        if (row.alt_id) {
            const alts = exercisesMap.get(row.exercise_id as string)?.alternatives as Array<Record<string, unknown>> | undefined;
            if (!alts?.some(a => a.id === row.alt_id)) {
                alts?.push({
                    id: row.alt_id, exercise_id: row.exercise_id,
                    exercise_library_id: row.alt_exercise_library_id, alt_order: row.alt_order,
                    name_en: row.alt_name_en, name_ar: row.alt_name_ar,
                    muscle_group: row.alt_muscle_group, muscle_group_ar: row.alt_muscle_group_ar,
                    equipment: row.alt_equipment, equipment_ar: row.alt_equipment_ar,
                    thumbnail_path: toPublicUrl(row.alt_thumbnail_path as string | null),
                    youtube_url:    row.alt_youtube_url,
                    video_path:     toPublicUrl(row.alt_video_path as string | null),
                });
            }
        }
    }

    const days = Array.from(daysMap.values()).sort((a, b) => (a.day_order as number) - (b.day_order as number));
    days.forEach(day => {
        (day.exercises as Record<string, unknown>[]).sort((a, b) => (a.exercise_order as number) - (b.exercise_order as number));
        (day.exercises as Record<string, unknown>[]).forEach(exercise => {
            (exercise.sets as Record<string, unknown>[]).sort((a, b) => (a.set_order as number) - (b.set_order as number));
            (exercise.alternatives as Record<string, unknown>[]).sort((a, b) => (a.alt_order as number) - (b.alt_order as number));
        });
    });
    return { ...plan, days };
}

const discoverWorkspaceSchema = z.object({
    email: z.string().trim().min(1).email(),
});

/**
 * Email-first workspace discovery for the mobile app login flow. clients.email
 * is unique per-workspace, not globally (@@unique([workspace_id, email])), so
 * the same email can belong to a client at more than one workspace — this
 * returns every match and lets the caller disambiguate before asking for a
 * password. Reuses the same archived-row filtering as login() so a workspace
 * returned here is guaranteed to be loginable.
 */
export async function discoverWorkspace(req: Request, res: Response, next: NextFunction) {
    const parsed = discoverWorkspaceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'A valid email is required' });

    try {
        const rows = await prisma.$queryRaw<Array<{ slug: string; name: string; fname: string }>>`
            SELECT w.slug, w.name, c.fname
            FROM clients c
            JOIN workspaces w ON w.id = c.workspace_id
            WHERE LOWER(c.email) = ${normalizeEmail(parsed.data.email)}
              AND w.archived_at IS NULL AND c.archived_at IS NULL
        `;

        if (rows.length === 0) {
            return res.status(404).json({ message: "We couldn't find an account with this email." });
        }

        res.json({
            workspaces: rows.map(row => ({
                slug:       row.slug,
                name:       row.name,
                logoUrl:    null,
                clientName: row.fname,
            })),
        });
    } catch (err) {
        next(err);
    }
}

export async function login(req: Request, res: Response, next: NextFunction) {
    const { email, password, workspace_slug, coach_slug } = req.body as Record<string, string | undefined>;
    const slug = workspace_slug || coach_slug;

    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
    if (!slug?.trim())       return res.status(400).json({ message: 'Workspace is required' });

    try {
        type ClientLoginRow = Record<string, unknown>;
        const rows = await prisma.$queryRaw<ClientLoginRow[]>`
            SELECT c.* FROM clients c
            JOIN workspaces w ON w.id = c.workspace_id
            WHERE LOWER(c.email) = ${normalizeEmail(email)} AND w.slug = ${slug.trim()}
              AND w.archived_at IS NULL AND c.archived_at IS NULL
        `;

        if (rows.length === 0) return res.status(401).json({ message: 'Invalid email or password' });

        const client = rows[0];
        if (!client.password) return res.status(401).json({ message: 'Account not activated. Contact your coach.' });

        const match = await bcrypt.compare(password, client.password as string);
        if (!match) return res.status(401).json({ message: 'Invalid email or password' });

        const token = jwt.sign(
            { clientId: client.id, workspaceId: client.workspace_id },
            env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie('client_token', token, {
            httpOnly: true,
            secure:   env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge:   7 * 24 * 60 * 60 * 1000,
        }).status(200).json({ message: 'Login successful', token });
    } catch (err) {
        next(err);
    }
}

export function logout(_req: Request, res: Response) {
    res.clearCookie('client_token').status(200).json({ message: 'Logged out' });
}

/**
 * Public workspace lookup for the mobile branded-login screen. Mobile has no
 * subdomain, so it resolves a slug to the workspace's display identity before
 * the client signs in. Returns only non-sensitive branding fields.
 */
export async function getWorkspace(req: Request, res: Response, next: NextFunction) {
    const slug = (req.query.slug as string | undefined)?.trim();
    if (!slug) return res.status(400).json({ message: 'slug is required' });

    try {
        const workspace = await prisma.workspaces.findFirst({
            where:  { slug, archived_at: null },
            select: { slug: true, name: true },
        });
        if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

        // logoUrl / brandColor are not yet modelled per-workspace; return null so
        // the client can fall back to app defaults without a contract change later.
        res.json({ slug: workspace.slug, name: workspace.name, logoUrl: null, brandColor: null });
    } catch (err) {
        next(err);
    }
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
    try {
        const client = await prisma.clients.findFirst({
            where:  { id: req.client!.clientId },
            select: {
                id: true, fname: true, lname: true, email: true, phone: true, client_code: true, workspace_id: true,
                workspaces: { select: { renewal_link: true } },
            },
        });
        if (!client) return res.status(404).json({ message: 'Client not found' });

        // Effective subscription access is computed once by loadClientAccess; surface
        // it here so the portal can gate UI without an extra round trip.
        const effective = req.clientAccess;
        const { workspaces, ...clientFields } = client;
        res.json({
            ...clientFields,
            status:      effective?.status ?? null,
            withinGrace: effective?.withinGrace ?? false,
            access:      effective?.access ?? null,
            renewalLink: workspaces?.renewal_link ?? null,
        });
    } catch (err) {
        next(err);
    }
}

export function getAccess(req: Request, res: Response) {
    res.json(req.clientAccess ?? null);
}

export async function getActivePlan(req: Request, res: Response, next: NextFunction) {
    try {
        const plan = await prisma.nutrition_plans.findFirst({
            where:   { client_id: req.client!.clientId, status: 'active' },
            orderBy: { updated_at: 'desc' },
        });
        if (!plan) return res.status(404).json({ message: 'No active plan found' });

        const hierarchyRows = await prisma.$queryRaw<Record<string, unknown>[]>`
            SELECT
                np.id, np.name, np.client_id, np.workspace_id, np.status, np.created_at, np.updated_at, np.activated_at,
                nc.id AS cycle_id, nc.plan_id, nc.name AS cycle_name, nc.cycle_order,
                    nc.goal_calories, nc.goal_protein, nc.goal_carbs, nc.goal_fats, nc.note AS cycle_note,
                nm.id AS meal_id, nm.cycle_id AS meal_cycle_id, nm.name AS meal_name, nm.meal_order, nm.note AS meal_note,
                nmi.id AS item_id, nmi.meal_id AS item_meal_id, nmi.food_item_id, nmi.amount AS item_amount, nmi.meal_item_order,
                    nmi.is_swapped, nmi.swapped_at, nmi.original_food_item_id,
                fi.name_en AS food_name, fi.name_ar AS food_name_ar, fi.serving_unit, fi.calories_per_serving, fi.protein_per_serving,
                    fi.carbs_per_serving, fi.fats_per_serving, fi.serving_size, fi.food_category,
                fo.name_en AS original_food_name, fo.name_ar AS original_food_name_ar,
                nmia.id AS alt_id, nmia.meal_item_id, nmia.food_item_id AS alt_food_item_id,
                    nmia.amount AS alt_amount, nmia.alt_order,
                fi2.name_en AS alt_food_name, fi2.name_ar AS alt_food_name_ar, fi2.serving_unit AS alt_serving_unit,
                    fi2.calories_per_serving AS alt_calories_per_serving,
                    fi2.protein_per_serving AS alt_protein_per_serving,
                    fi2.carbs_per_serving AS alt_carbs_per_serving, fi2.fats_per_serving AS alt_fats_per_serving,
                    fi2.serving_size AS alt_serving_size, fi2.food_category AS alt_food_category
            FROM nutrition_plans np
            LEFT JOIN nutrition_cycles nc ON nc.plan_id = np.id
            LEFT JOIN nutrition_meals nm ON nm.cycle_id = nc.id
            LEFT JOIN nutrition_meal_items nmi ON nmi.meal_id = nm.id
            LEFT JOIN food_items fi ON fi.id = nmi.food_item_id
            LEFT JOIN food_items fo ON fo.id = nmi.original_food_item_id
            LEFT JOIN nutrition_meal_item_alternatives nmia ON nmia.meal_item_id = nmi.id
            LEFT JOIN food_items fi2 ON fi2.id = nmia.food_item_id
            WHERE np.id = ${plan.id}
            ORDER BY nc.cycle_order, nm.meal_order, nmi.meal_item_order, nmia.alt_order
        `;

        res.json(buildNutritionPlanHierarchy(plan as unknown as Record<string, unknown>, hierarchyRows));
    } catch (err) {
        next(err);
    }
}

export async function getActiveTrainingPlan(req: Request, res: Response, next: NextFunction) {
    try {
        const plan = await prisma.training_plans.findFirst({
            where:   { client_id: req.client!.clientId, status: 'active' },
            orderBy: { updated_at: 'desc' },
        });
        if (!plan) return res.status(404).json({ message: 'No active training plan found' });

        const hierarchyRows = await prisma.$queryRaw<Record<string, unknown>[]>`
            SELECT
                tp.id, tp.name, tp.client_id, tp.workspace_id, tp.status, tp.notes,
                    tp.created_at, tp.updated_at, tp.activated_at,
                td.id AS day_id, td.plan_id, td.name AS day_name, td.day_order, td.notes AS day_notes,
                te.id AS exercise_id, te.day_id AS exercise_day_id, te.name AS exercise_name, te.exercise_order,
                    te.equipment, te.notes AS exercise_notes, te.exercise_library_id,
                el.thumbnail_path, el.video_path, el.youtube_url, el.muscle_group,
                    el.name_en AS library_name_en, el.name_ar AS library_name_ar,
                    el.instructions_en, el.instructions_ar, el.tracking_type, el.tracked_metrics,
                    emg.name_ar AS muscle_group_ar, ee.name_ar AS equipment_ar,
                ts.id AS set_id, ts.set_order, ts.reps, ts.rest_seconds, ts.tempo, ts.rir, ts.rpe,
                    ts.duration_seconds, ts.distance_km, ts.incline_percent, ts.speed_kmh,
                tea.id AS alt_id, tea.exercise_library_id AS alt_exercise_library_id, tea.alt_order,
                el2.name_en AS alt_name_en, el2.name_ar AS alt_name_ar,
                    el2.muscle_group AS alt_muscle_group, el2.equipment AS alt_equipment,
                    emg2.name_ar AS alt_muscle_group_ar, ee2.name_ar AS alt_equipment_ar,
                    el2.thumbnail_path AS alt_thumbnail_path, el2.youtube_url AS alt_youtube_url, el2.video_path AS alt_video_path
            FROM training_plans tp
            LEFT JOIN training_days td ON td.plan_id = tp.id
            LEFT JOIN training_exercises te ON te.day_id = td.id
            LEFT JOIN exercise_library el ON el.id = te.exercise_library_id
            LEFT JOIN exercise_muscle_groups emg ON emg.workspace_id = ${req.client!.workspaceId} AND emg.name_en = el.muscle_group
            LEFT JOIN exercise_equipments ee ON ee.workspace_id = ${req.client!.workspaceId} AND ee.name_en = te.equipment
            LEFT JOIN training_sets ts ON ts.exercise_id = te.id
            LEFT JOIN training_exercise_alternatives tea ON tea.exercise_id = te.id
            LEFT JOIN exercise_library el2 ON el2.id = tea.exercise_library_id
            LEFT JOIN exercise_muscle_groups emg2 ON emg2.workspace_id = ${req.client!.workspaceId} AND emg2.name_en = el2.muscle_group
            LEFT JOIN exercise_equipments ee2 ON ee2.workspace_id = ${req.client!.workspaceId} AND ee2.name_en = el2.equipment
            WHERE tp.id = ${plan.id}
            ORDER BY td.day_order, te.exercise_order, ts.set_order, tea.alt_order
        `;

        res.json(buildTrainingPlanHierarchy(plan as unknown as Record<string, unknown>, hierarchyRows));
    } catch (err) {
        next(err);
    }
}

export async function getFormRequests(req: Request, res: Response, next: NextFunction) {
    try {
        await activateDueClientScheduledRequests(req.client!.clientId);

        const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
            SELECT fr.id, fr.status, fr.requested_at, fr.submitted_at, fr.scheduled_at, fr.post_action,
                   f.id AS form_id,
                   f.title_en AS form_title_en, f.title_ar AS form_title_ar,
                   f.description_en AS form_description_en, f.description_ar AS form_description_ar
            FROM form_requests fr
            JOIN forms f ON f.id = fr.form_id
            WHERE fr.client_id = ${req.client!.clientId}
            ORDER BY COALESCE(fr.scheduled_at, fr.requested_at) DESC
        `;
        res.json(rows);
    } catch (err) {
        next(err);
    }
}

export async function getFormRequest(req: Request, res: Response, next: NextFunction) {
    try {
        await activateDueClientScheduledRequests(req.client!.clientId);

        const rows = await prisma.$queryRaw<Record<string, unknown>[]>`
            SELECT fr.id, fr.status, fr.requested_at, fr.submitted_at, fr.scheduled_at, fr.post_action,
                   fr.form_version_id,
                   f.id AS form_id,
                   f.title_en AS form_title_en, f.title_ar AS form_title_ar,
                   f.description_en AS form_description_en, f.description_ar AS form_description_ar
            FROM form_requests fr
            JOIN forms f ON f.id = fr.form_id
            WHERE fr.id = ${req.params.request_id as string} AND fr.client_id = ${req.client!.clientId}
        `;
        if (rows.length === 0) return res.status(404).json({ error: 'Request not found' });

        const request = rows[0];
        if (
            request.status === 'scheduled' &&
            request.scheduled_at &&
            new Date(request.scheduled_at as string).getTime() > Date.now()
        ) {
            return res.status(403).json({ error: 'This form is not available yet' });
        }

        // Forms Versioning Phase 2 — always render the version PINNED to this
        // request (set at assignment time), never the form's live current
        // draft. This is what guarantees a client answers exactly what was
        // asked when they were assigned the form, even if the coach has
        // since edited it.
        const [rawQuestions, responses] = await Promise.all([
            request.form_version_id
                ? prisma.form_version_questions.findMany({
                    where:   { form_version_id: request.form_version_id as string },
                    orderBy: [{ order_index: 'asc' }, { id: 'asc' }],
                    include: { metrics: { select: { type: true, unit: true, name: true, icon: true } } },
                  })
                : Promise.resolve([]),
            request.status !== 'pending' && request.status !== 'scheduled'
                ? prisma.form_responses.findMany({
                    where:  { request_id: request.id as string },
                    select: { id: true, question_id: true, answer: true },
                  })
                : Promise.resolve([]),
        ]);

        // Flatten metric fields onto each question so the client portal renderer
        // can determine the input type without a second fetch.
        const questions = rawQuestions.map(q => ({
            ...q,
            metric_type: (q as unknown as { metrics?: { type: string; unit: string | null; name: string; icon: string | null } }).metrics?.type ?? null,
            metric_unit: (q as unknown as { metrics?: { unit: string | null } }).metrics?.unit ?? null,
            metric_name: (q as unknown as { metrics?: { name: string } }).metrics?.name ?? null,
            metric_icon: (q as unknown as { metrics?: { icon: string | null } }).metrics?.icon ?? null,
        }));
        const responsesWithHistory = await attachEditHistory(responses);
        res.json({ ...request, questions, responses: responsesWithHistory });
    } catch (err) {
        next(err);
    }
}

type ActionItem = {
    id:        string;
    kind:      'subscription' | 'pending_form' | 'plan_update';
    title_en:  string;
    title_ar?: string | null;
    subtitle?: string | null;
    href:      string;
    createdAt: string;
};

/**
 * Aggregates the small set of things a client portal home page treats as
 * "needs your attention" — pending forms, a coach's plan activation/restart,
 * and a subscription in its grace period — each read from data that already
 * exists for other endpoints (form_requests, notifications, clientAccess), so
 * this is a read-only convenience view, not a new source of truth.
 *
 * A fully lapsed subscription (keep_portal_access: false) is handled
 * elsewhere: portal/layout.js replaces the whole shell with
 * ClientPortalStatusCard before this page ever renders, so this only needs to
 * cover the softer "still has access, but should renew soon" grace window.
 */
export async function getActionItems(req: Request, res: Response, next: NextFunction) {
    try {
        await activateDueClientScheduledRequests(req.client!.clientId);

        const [pendingForms, planNotifications] = await Promise.all([
            prisma.$queryRaw<Record<string, unknown>[]>`
                SELECT fr.id, fr.requested_at,
                       f.title_en AS form_title_en, f.title_ar AS form_title_ar
                FROM form_requests fr
                JOIN forms f ON f.id = fr.form_id
                WHERE fr.client_id = ${req.client!.clientId} AND fr.status = 'pending'
                ORDER BY fr.requested_at DESC
            `,
            prisma.notifications.findMany({
                where: {
                    workspace_id:   req.client!.workspaceId,
                    recipient_type: 'client',
                    recipient_id:   req.client!.clientId,
                    read_at:        null,
                    type:           { in: ['plan.assigned', 'plan.duration_restarted'] },
                },
                orderBy: { created_at: 'desc' },
            }),
        ]);

        const items: ActionItem[] = [];

        const access = req.clientAccess;
        if (access?.status === 'Expired' && access.withinGrace) {
            const workspace = await prisma.workspaces.findFirst({
                where:  { id: req.client!.workspaceId },
                select: { renewal_link: true },
            });
            items.push({
                id:        'subscription',
                kind:      'subscription',
                title_en:  'Your subscription is expiring soon',
                subtitle:  'Renew now to keep uninterrupted access',
                href:      workspace?.renewal_link || '/portal/profile',
                createdAt: new Date().toISOString(),
            });
        }

        for (const row of pendingForms) {
            items.push({
                id:        row.id as string,
                kind:      'pending_form',
                title_en:  row.form_title_en as string,
                title_ar:  row.form_title_ar as string | null,
                subtitle:  'Check-in form ready to fill',
                href:      `/portal/forms/${row.id}`,
                createdAt: new Date(row.requested_at as string).toISOString(),
            });
        }

        // A client can accumulate several unread plan.assigned/restarted
        // notifications for the same plan type (e.g. a coach re-activating a
        // plan a few times) — only the most recent per type is actionable,
        // so keep the first one seen (planNotifications is created_at desc).
        const seenPlanTypes = new Set<string>();
        for (const n of planNotifications) {
            const entityType = n.entity_type === 'training_plan' ? 'training_plan' : 'nutrition_plan';
            if (seenPlanTypes.has(entityType)) continue;
            seenPlanTypes.add(entityType);

            items.push({
                id:        n.id,
                kind:      'plan_update',
                title_en:  n.title,
                subtitle:  entityType === 'training_plan' ? 'New training plan' : 'New nutrition plan',
                href:      entityType === 'training_plan' ? '/portal/training' : '/portal/nutrition',
                createdAt: n.created_at.toISOString(),
            });
        }

        items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        // Subscription is the most urgent item regardless of recency.
        items.sort((a, b) => (a.kind === 'subscription' ? -1 : b.kind === 'subscription' ? 1 : 0));

        res.json(items);
    } catch (err) {
        next(err);
    }
}

export async function submitFormRequest(req: Request, res: Response, next: NextFunction) {
    const { answers } = req.body as { answers?: Array<{ question_id: string; answer: unknown }> };
    if (!answers || !Array.isArray(answers)) {
        return res.status(400).json({ error: 'answers array is required' });
    }
    try {
        const request = await prisma.form_requests.findFirst({
            where:  { id: req.params.request_id as string, client_id: req.client!.clientId, status: 'pending' },
            select: { id: true, form_id: true, assigned_to: true },
        });
        if (!request) return res.status(404).json({ error: 'Request not found or already submitted' });

        // Fetch metric_ids so they can be denormalized into each answer row.
        // This keeps transformation queries fast and preserves history even if
        // the question is later re-linked or deleted. Reads from
        // form_version_questions (Forms Versioning Phase 2) — the pinned,
        // immutable snapshot these question ids actually belong to.
        const questionIds = answers.map(a => a.question_id).filter(Boolean);
        const questionMetrics = await prisma.form_version_questions.findMany({
            where:  { id: { in: questionIds } },
            select: { id: true, metric_id: true },
        });
        const metricByQuestion = new Map(questionMetrics.map(q => [q.id, q.metric_id]));

        await prisma.$transaction([
            prisma.form_responses.createMany({
                data: answers.map(({ question_id, answer }) => ({
                    id:         createId(),
                    request_id: req.params.request_id as string,
                    question_id,
                    metric_id:  metricByQuestion.get(question_id) ?? null,
                    answer:     answer != null ? String(answer) : '',
                })),
            }),
            prisma.form_requests.update({
                where: { id: req.params.request_id as string },
                data:  { status: 'submitted', submitted_at: new Date() },
            }),
        ]);

        // Notify the assigned reviewer if one is set, otherwise the whole team.
        await recordEvent({
            workspaceId: req.client!.workspaceId,
            type:        'checkin.submitted',
            importance:  'actionable',
            title:       'A client submitted a check-in',
            recipients:  request.assigned_to
                ? [{ type: 'user', id: request.assigned_to }]
                : await teamRecipients(req.client!.workspaceId),
            actor:       { type: 'client', id: req.client!.clientId },
            entity:      { type: 'form_request', id: request.id },
            metadata:    { clientId: req.client!.clientId, actorName: await getClientDisplayName(req.client!.clientId) },
        });

        res.json({ success: true });
    } catch (err) {
        next(err);
    }
}

// Lets a client correct a previously submitted answer, any time after
// submission (no review-lock, no time window — see DECISIONS). Every edit is
// logged to form_response_edits so both the client and the coach can see the
// before/after trail on that question. This updates form_responses.answer
// in place (not an insert), which is what keeps metric-linked answers'
// progress charts showing only the latest value at that submission's date —
// see buildTransformationPayload in clients.controller.ts.
export async function editFormAnswer(req: Request, res: Response, next: NextFunction) {
    const { answer } = req.body as { answer?: unknown };
    if (answer === undefined) return res.status(400).json({ error: 'answer is required' });

    try {
        const request = await prisma.form_requests.findFirst({
            where:  { id: req.params.request_id as string, client_id: req.client!.clientId },
            select: { id: true, status: true },
        });
        if (!request) return res.status(404).json({ error: 'Request not found' });
        if (request.status === 'pending' || request.status === 'scheduled') {
            return res.status(400).json({ error: 'Submit the form before editing an answer' });
        }

        const existing = await prisma.form_responses.findFirst({
            where: { request_id: request.id, question_id: req.params.question_id as string },
        });
        if (!existing) return res.status(404).json({ error: 'Answer not found' });

        const newAnswer = answer != null ? String(answer) : '';
        if (newAnswer === (existing.answer ?? '')) {
            return res.json({ success: true, answer: existing.answer });
        }

        const [, updated] = await prisma.$transaction([
            prisma.form_response_edits.create({
                data: {
                    id:                  createId(),
                    response_id:         existing.id,
                    previous_answer:     existing.answer,
                    new_answer:          newAnswer,
                    edited_by_client_id: req.client!.clientId,
                },
            }),
            prisma.form_responses.update({
                where: { id: existing.id },
                data:  { answer: newAnswer },
            }),
        ]);

        res.json({ success: true, answer: updated.answer });
    } catch (err) {
        next(err);
    }
}

export async function getMessages(req: Request, res: Response, next: NextFunction) {
    try {
        const thread = await prisma.threads.upsert({
            where:  { workspace_id_client_id: { workspace_id: req.client!.workspaceId, client_id: req.client!.clientId } },
            create: { id: createId(), workspace_id: req.client!.workspaceId, client_id: req.client!.clientId },
            update: {},
        });

        await prisma.messages.updateMany({
            where: { thread_id: thread.id, sender_type: 'team', read_by_client_at: null },
            data:  { read_by_client_at: new Date() },
        });

        // Keep the notification row in sync with the thread's own unread signal —
        // opening the thread should clear this client's notification for it too.
        await prisma.notifications.updateMany({
            where: {
                workspace_id:   req.client!.workspaceId,
                recipient_type: 'client',
                recipient_id:   req.client!.clientId,
                entity_type:    'thread',
                entity_id:      thread.id,
                read_at:        null,
            },
            data: { read_at: new Date() },
        });

        const [messages, workspace] = await Promise.all([
            prisma.messages.findMany({
                where:   { thread_id: thread.id },
                select:  MESSAGE_SELECT,
                orderBy: { created_at: 'asc' },
            }),
            prisma.workspaces.findFirst({
                where:  { id: req.client!.workspaceId },
                select: { name: true },
            }),
        ]);

        res.json({ thread, messages: messages.map(serializeMessage), coachName: workspace?.name ?? null });
    } catch (err) {
        next(err);
    }
}

export async function sendMessage(req: Request, res: Response, next: NextFunction) {
    const { body } = req.body as { body?: string };
    if (!body || !body.trim()) return res.status(400).json({ error: 'Message body is required' });
    if (body.trim().length > 5000) return res.status(400).json({ error: 'Message exceeds 5000 character limit' });

    try {
        const thread = await prisma.threads.findFirst({
            where:  { workspace_id: req.client!.workspaceId, client_id: req.client!.clientId },
            select: { id: true },
        });
        if (!thread) return res.status(404).json({ error: 'No thread found — open the messages page first' });

        const message = await prisma.messages.create({
            data: {
                id:                createId(),
                thread_id:         thread.id,
                sender_type:       'client',
                sender_id:         req.client!.clientId,
                body:              body.trim(),
                read_by_client_at: new Date(),
            },
        });

        await prisma.threads.update({
            where: { id: thread.id },
            data:  { updated_at: new Date() },
        });

        // Durable: this is the bug recordEvent fixes — a coach who had the tab
        // closed used to never learn a client replied. Notify the whole team;
        // keep the legacy workspace-room emit so open threads still live-sync.
        await recordEvent({
            workspaceId: req.client!.workspaceId,
            type:        'message.received',
            importance:  'actionable',
            title:       'New message from a client',
            recipients:  await teamRecipients(req.client!.workspaceId),
            actor:       { type: 'client', id: req.client!.clientId },
            entity:      { type: 'thread', id: thread.id },
            metadata:    { actorName: await getClientDisplayName(req.client!.clientId) },
            realtime:    { rooms: [`workspace:${req.client!.workspaceId}`], event: 'new_message', payload: { threadId: thread.id, message, fromClient: true } },
        });

        res.status(201).json(serializeMessage(message));
    } catch (err) {
        next(err);
    }
}

export async function sendMessageAttachment(req: Request, res: Response, next: NextFunction) {
    const file = req.file as (Express.Multer.File & { key?: string }) | undefined;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const { body, durationSeconds } = req.body as { body?: string; durationSeconds?: string };

    try {
        const thread = await prisma.threads.upsert({
            where:  { workspace_id_client_id: { workspace_id: req.client!.workspaceId, client_id: req.client!.clientId } },
            create: { id: createId(), workspace_id: req.client!.workspaceId, client_id: req.client!.clientId },
            update: {},
        });

        const key  = file.key ?? file.path;
        const type = attachmentTypeFromMime(file.mimetype);

        const message = await prisma.messages.create({
            data: {
                id:                  createId(),
                thread_id:           thread.id,
                sender_type:         'client',
                sender_id:           req.client!.clientId,
                body:                body?.trim() || null,
                type,
                attachment_url:      key,
                attachment_name:     file.originalname,
                attachment_size:     file.size,
                attachment_mime:     file.mimetype,
                attachment_duration: type === 'voice' && durationSeconds ? Math.round(Number(durationSeconds)) : null,
                read_by_client_at:   new Date(),
            },
        });

        await prisma.threads.update({
            where: { id: thread.id },
            data:  { updated_at: new Date() },
        });

        const serialized = serializeMessage(message);
        await recordEvent({
            workspaceId: req.client!.workspaceId,
            type:        'message.received',
            importance:  'actionable',
            title:       'New message from a client',
            recipients:  await teamRecipients(req.client!.workspaceId),
            actor:       { type: 'client', id: req.client!.clientId },
            entity:      { type: 'thread', id: thread.id },
            metadata:    { actorName: await getClientDisplayName(req.client!.clientId) },
            realtime:    { rooms: [`workspace:${req.client!.workspaceId}`], event: 'new_message', payload: { threadId: thread.id, message: serialized, fromClient: true } },
        });

        res.status(201).json(serialized);
    } catch (err) {
        next(err);
    }
}

export async function editMessage(req: Request, res: Response, next: NextFunction) {
    const { body } = req.body as { body?: string };
    if (!body || !body.trim()) return res.status(400).json({ error: 'Message body is required' });
    if (body.trim().length > 5000) return res.status(400).json({ error: 'Message exceeds 5000 character limit' });

    const messageId = req.params.messageId as string;
    try {
        const thread = await prisma.threads.findFirst({
            where:  { workspace_id: req.client!.workspaceId, client_id: req.client!.clientId },
            select: { id: true },
        });
        if (!thread) return res.status(404).json({ error: 'Message not found' });

        const existing = await prisma.messages.findFirst({ where: { id: messageId, thread_id: thread.id } });
        if (!existing || existing.deleted_at) return res.status(404).json({ error: 'Message not found' });
        if (existing.sender_type !== 'client') return res.status(403).json({ error: 'You can only edit your own messages' });
        if (existing.type !== 'text') return res.status(400).json({ error: 'Only text messages can be edited' });

        const message = await prisma.messages.update({
            where:  { id: messageId },
            data:   { body: body.trim(), edited_at: new Date() },
            select: MESSAGE_SELECT,
        });

        res.json(serializeMessage(message));
    } catch (err) {
        next(err);
    }
}

export async function deleteMessage(req: Request, res: Response, next: NextFunction) {
    const messageId = req.params.messageId as string;
    try {
        const thread = await prisma.threads.findFirst({
            where:  { workspace_id: req.client!.workspaceId, client_id: req.client!.clientId },
            select: { id: true },
        });
        if (!thread) return res.status(404).json({ error: 'Message not found' });

        const existing = await prisma.messages.findFirst({ where: { id: messageId, thread_id: thread.id } });
        if (!existing || existing.deleted_at) return res.status(404).json({ error: 'Message not found' });
        if (existing.sender_type !== 'client') return res.status(403).json({ error: 'You can only delete your own messages' });

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
    } catch (err) {
        next(err);
    }
}

// ─── workout logs (Training Mode) ───────────────────────────────────────────────

const HISTORY_LIMIT  = 50;   // sessions returned in the history list
const PROGRESS_LIMIT = 200;  // sessions scanned to build a progress chart

const loggedSetSchema = z.object({
    set_order:        z.number().int().nonnegative(),
    weight:           z.number().nullable().default(null),
    reps:             z.number().nullable().default(null),
    rir:              z.number().nullable().default(null),
    rpe:              z.number().nullable().default(null),
    rest_seconds:     z.number().int().nullable().default(null),
    duration_seconds: z.number().int().nullable().default(null),
    distance_km:      z.number().nullable().default(null),
    incline_percent:  z.number().nullable().default(null),
    speed_kmh:        z.number().nullable().default(null),
    completed:        z.boolean().default(false),
});

const loggedExerciseSchema = z.object({
    exercise_id:         z.string().min(1),
    exercise_library_id: z.string().nullable().default(null),
    name:                z.string().min(1),
    library_name_en:     z.string().nullable().default(null),
    library_name_ar:     z.string().nullable().default(null),
    note:                z.string().nullable().default(null),
    // Snapshotted from the catalog exercise at submission time (like name/
    // exercise_library_id already are) rather than re-derived later — a coach
    // could change the exercise's tracking_type/tracked_metrics after a
    // client logs it, and history/PDF must keep rendering what was actually
    // prescribed at the time.
    tracking_type:       z.string().nullable().default(null),
    tracked_metrics:     z.array(z.string()).nullable().default(null),
    sets:                z.array(loggedSetSchema),
});

const createWorkoutLogSchema = z.object({
    plan_id:    z.string().min(1).nullable().default(null),
    day_id:     z.string().min(1).nullable().default(null),
    day_index:  z.number().int().nullable().default(null),
    notes:      z.string().nullable().default(null),
    started_at: z.string().min(1),
    ended_at:   z.string().min(1),
    exercises:  z.array(loggedExerciseSchema),
});

/** Prisma returns the `exercises` JSON column as an opaque value; coerce to our shape. */
function parseLoggedExercises(value: unknown): LoggedExercise[] {
    return Array.isArray(value) ? (value as LoggedExercise[]) : [];
}

function toLogRow(row: { id: string; date: Date; start_time: string | null; end_time: string | null; exercises: unknown }): WorkoutLogRow {
    return {
        id:         row.id,
        date:       row.date,
        start_time: row.start_time,
        end_time:   row.end_time,
        exercises:  parseLoggedExercises(row.exercises),
    };
}

export async function createWorkoutLog(req: Request, res: Response, next: NextFunction) {
    const parsed = createWorkoutLogSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: 'Validation failed', details: parsed.error.flatten().fieldErrors });
    }
    const data = parsed.data;

    try {
        const sessionDate = new Date(data.started_at);
        const log = await prisma.workout_logs.create({
            data: {
                id:           createId(),
                client_id:    req.client!.clientId,
                workspace_id: req.client!.workspaceId,
                plan_id:      data.plan_id,
                day_id:       data.day_id,
                day_index:    data.day_index,
                date:         Number.isNaN(sessionDate.getTime()) ? new Date() : sessionDate,
                start_time:   data.started_at,
                end_time:     data.ended_at,
                notes:        data.notes,
                exercises:    data.exercises as object,
                completed:    true,
            },
        });
        res.status(201).json({ id: log.id, ...summarizeLog(toLogRow(log)) });
    } catch (err) {
        next(err);
    }
}

export async function getWorkoutLogs(req: Request, res: Response, next: NextFunction) {
    try {
        const logs = await prisma.workout_logs.findMany({
            where:   { client_id: req.client!.clientId },
            orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
            take:    HISTORY_LIMIT,
            include: { training_days: { select: { name: true } } },
        });

        res.json(logs.map(log => ({
            id:         log.id,
            date:       log.date,
            start_time: log.start_time,
            day_id:     log.day_id,
            day_name:   log.training_days?.name ?? null,
            notes:      log.notes,
            ...summarizeLog(toLogRow(log)),
        })));
    } catch (err) {
        next(err);
    }
}

export async function getWorkoutLogPrevious(req: Request, res: Response, next: NextFunction) {
    const dayId = req.query.day_id as string | undefined;
    if (!dayId) return res.status(400).json({ error: 'day_id is required' });

    try {
        const dayExercises = await prisma.training_exercises.findMany({
            where:  { day_id: dayId },
            select: { id: true, exercise_library_id: true, name: true },
        });
        const targets: ExerciseKey[] = dayExercises.map(e => ({
            exercise_id:         e.id,
            exercise_library_id: e.exercise_library_id,
            name:                e.name,
        }));

        const priorLogs = await prisma.workout_logs.findMany({
            where:   { client_id: req.client!.clientId },
            orderBy: { date: 'desc' },
            take:    HISTORY_LIMIT,
            select:  { id: true, date: true, start_time: true, end_time: true, exercises: true },
        });

        res.json(extractPreviousSets(priorLogs.map(toLogRow), targets));
    } catch (err) {
        next(err);
    }
}

export async function getExerciseProgress(req: Request, res: Response, next: NextFunction) {
    const exerciseLibraryId = req.query.exercise_library_id as string | undefined;
    const exerciseId        = req.query.exercise_id as string | undefined;
    if (!exerciseLibraryId && !exerciseId) {
        return res.status(400).json({ error: 'exercise_library_id or exercise_id is required' });
    }

    try {
        const logs = await prisma.workout_logs.findMany({
            where:   { client_id: req.client!.clientId },
            orderBy: { date: 'asc' },
            take:    PROGRESS_LIMIT,
            select:  { id: true, date: true, start_time: true, end_time: true, exercises: true },
        });

        res.json(buildExerciseProgress(
            logs.map(toLogRow),
            { exercise_library_id: exerciseLibraryId ?? null, exercise_id: exerciseId ?? null },
        ));
    } catch (err) {
        next(err);
    }
}

export async function getExerciseInsights(req: Request, res: Response, next: NextFunction) {
    const exerciseLibraryId = req.query.exercise_library_id as string | undefined;
    const exerciseId        = req.query.exercise_id as string | undefined;
    if (!exerciseLibraryId && !exerciseId) {
        return res.status(400).json({ error: 'exercise_library_id or exercise_id is required' });
    }

    try {
        const logs = await prisma.workout_logs.findMany({
            where:   { client_id: req.client!.clientId },
            orderBy: { date: 'desc' },
            take:    PROGRESS_LIMIT,
            select:  { id: true, date: true, start_time: true, end_time: true, exercises: true },
        });

        const logRows       = logs.map(toLogRow);
        const key: ExerciseKey = { exercise_library_id: exerciseLibraryId ?? null, exercise_id: exerciseId ?? null };
        const progressPoints = buildExerciseProgress(logRows, key);

        res.json({
            progressPoints,
            recentSessions:  extractRecentSessions(logRows, key, 10),
            personalRecords: computePersonalRecords(logRows, key, progressPoints),
            insights:        computeCoachInsights(progressPoints),
            timeline: {
                first_session_date: progressPoints.length > 0 ? progressPoints[0].date : null,
                total_sessions:     progressPoints.length,
            },
        });
    } catch (err) {
        next(err);
    }
}

export async function getLoggedExercises(req: Request, res: Response, next: NextFunction) {
    try {
        const logs = await prisma.workout_logs.findMany({
            where:   { client_id: req.client!.clientId },
            orderBy: { date: 'desc' },
            take:    PROGRESS_LIMIT,
            select:  { id: true, date: true, start_time: true, end_time: true, exercises: true },
        });
        res.json(distinctLoggedExercises(logs.map(toLogRow)));
    } catch (err) {
        next(err);
    }
}

export async function getWorkoutLog(req: Request, res: Response, next: NextFunction) {
    try {
        const log = await prisma.workout_logs.findFirst({
            where:   { id: req.params.id as string, client_id: req.client!.clientId },
            include: { training_days: { select: { name: true } } },
        });
        if (!log) return res.status(404).json({ error: 'Workout log not found' });

        res.json({
            id:         log.id,
            date:       log.date,
            day_id:     log.day_id,
            day_name:   log.training_days?.name ?? null,
            start_time: log.start_time,
            end_time:   log.end_time,
            notes:      log.notes,
            exercises:  parseLoggedExercises(log.exercises),
            ...summarizeLog(toLogRow(log)),
        });
    } catch (err) {
        next(err);
    }
}

export async function deleteWorkoutLog(req: Request, res: Response, next: NextFunction) {
    try {
        const log = await prisma.workout_logs.findFirst({
            where:  { id: req.params.id as string, client_id: req.client!.clientId },
            select: { id: true },
        });
        if (!log) return res.status(404).json({ error: 'Workout log not found' });

        await prisma.workout_logs.delete({ where: { id: log.id } });
        res.json({ success: true });
    } catch (err) {
        next(err);
    }
}

export async function uploadPhoto(req: Request, res: Response) {
    const file = req.file as (Express.Multer.File & { key?: string; location?: string }) | undefined;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const key = file.key ?? file.path;
    const url = toPublicUrl(key);
    res.status(201).json({ url });
}

export const photoUploader = makeUploader(
    'client-progress-photos',
    ['.jpg', '.jpeg', '.png', '.heic', '.webp'],
    { maxSize: 20 * 1024 * 1024 },
);

// Attachment question type (Phase 5) — the multer instance is chosen from
// the route's :category param, which was itself set server-side by the
// coach when configuring the question (forms.controller.ts), never trusted
// from the client at upload time beyond selecting which pre-built,
// already-vetted allowlist applies. See lib/formAttachments.ts.
export function uploadAttachmentMiddleware(req: Request, res: Response, next: NextFunction) {
    const category = req.params.category;
    if (!isValidAttachmentCategory(category)) {
        return res.status(400).json({ error: 'Invalid attachment category' });
    }
    attachmentUploaderFor(category).single('file')(req, res, next);
}

export async function uploadAttachment(req: Request, res: Response) {
    const file = req.file as (Express.Multer.File & { key?: string; location?: string }) | undefined;
    if (!file) return res.status(400).json({ error: 'No file uploaded' });

    const key = file.key ?? file.path;
    const url = toPublicUrl(key);
    res.status(201).json({ url, name: file.originalname, mime: file.mimetype, size: file.size });
}

export async function getPortalTransformation(req: Request, res: Response, next: NextFunction) {
    try {
        const clientId = req.client!.clientId;

        const clientRecord = await prisma.clients.findUnique({
            where:  { id: clientId },
            select: { workspace_id: true },
        });
        if (!clientRecord?.workspace_id) { res.status(404).json({ error: 'Client not found' }); return; }

        const result = await buildTransformationPayload(clientId, clientRecord.workspace_id as string);
        res.json(result);
    } catch (err) {
        next(err);
    }
}
