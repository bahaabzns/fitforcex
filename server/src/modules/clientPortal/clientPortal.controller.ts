import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { toPublicUrl } from '../../lib/storage';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { getIo } from '../../lib/socket';

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
                exercise_order: row.exercise_order, equipment: row.equipment,
                notes: row.exercise_notes, exercise_library_id: row.exercise_library_id,
                thumbnail_path: toPublicUrl(row.thumbnail_path as string | null),
                video_path:     toPublicUrl(row.video_path as string | null),
                youtube_url: row.youtube_url, muscle_group: row.muscle_group,
                instructions_en: row.instructions_en, instructions_ar: row.instructions_ar,
                sets: [], alternatives: [],
            });
            (daysMap.get(row.day_id as string)!.exercises as unknown[]).push(exercisesMap.get(row.exercise_id as string)!);
        }
        if (row.set_id) {
            const sets = exercisesMap.get(row.exercise_id as string)?.sets as Array<Record<string, unknown>> | undefined;
            if (!sets?.some(s => s.id === row.set_id)) {
                sets?.push({
                    id: row.set_id, exercise_id: row.exercise_id, set_order: row.set_order,
                    reps: row.reps, rest_seconds: row.rest_seconds, tempo: row.tempo, rir: row.rir,
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
                    muscle_group: row.alt_muscle_group, equipment: row.alt_equipment,
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
            WHERE c.email = ${email} AND w.slug = ${slug.trim()} AND w.archived_at IS NULL
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
        }).status(200).json({ message: 'Login successful' });
    } catch (err) {
        next(err);
    }
}

export function logout(_req: Request, res: Response) {
    res.clearCookie('client_token').status(200).json({ message: 'Logged out' });
}

export async function getMe(req: Request, res: Response, next: NextFunction) {
    try {
        const client = await prisma.clients.findFirst({
            where:  { id: req.client!.clientId },
            select: { id: true, fname: true, lname: true, email: true, phone: true, client_code: true, workspace_id: true },
        });
        if (!client) return res.status(404).json({ message: 'Client not found' });
        res.json(client);
    } catch (err) {
        next(err);
    }
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
                nm.id AS meal_id, nm.cycle_id, nm.name AS meal_name, nm.meal_order, nm.note AS meal_note,
                nmi.id AS item_id, nmi.meal_id, nmi.food_item_id, nmi.amount AS item_amount, nmi.meal_item_order,
                fi.name_en AS food_name, fi.name_ar AS food_name_ar, fi.serving_unit, fi.calories_per_serving, fi.protein_per_serving,
                    fi.carbs_per_serving, fi.fats_per_serving, fi.serving_size, fi.food_category,
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
                te.id AS exercise_id, te.day_id, te.name AS exercise_name, te.exercise_order,
                    te.equipment, te.notes AS exercise_notes, te.exercise_library_id,
                el.thumbnail_path, el.video_path, el.youtube_url, el.muscle_group,
                    el.instructions_en, el.instructions_ar,
                ts.id AS set_id, ts.set_order, ts.reps, ts.rest_seconds, ts.tempo, ts.rir,
                tea.id AS alt_id, tea.exercise_library_id AS alt_exercise_library_id, tea.alt_order,
                el2.name_en AS alt_name_en, el2.name_ar AS alt_name_ar,
                    el2.muscle_group AS alt_muscle_group, el2.equipment AS alt_equipment,
                    el2.thumbnail_path AS alt_thumbnail_path, el2.youtube_url AS alt_youtube_url, el2.video_path AS alt_video_path
            FROM training_plans tp
            LEFT JOIN training_days td ON td.plan_id = tp.id
            LEFT JOIN training_exercises te ON te.day_id = td.id
            LEFT JOIN exercise_library el ON el.id = te.exercise_library_id
            LEFT JOIN training_sets ts ON ts.exercise_id = te.id
            LEFT JOIN training_exercise_alternatives tea ON tea.exercise_id = te.id
            LEFT JOIN exercise_library el2 ON el2.id = tea.exercise_library_id
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

        const [questions, responses] = await Promise.all([
            prisma.form_questions.findMany({
                where:   { form_id: request.form_id as string },
                orderBy: [{ order_index: 'asc' }, { id: 'asc' }],
            }),
            request.status !== 'pending' && request.status !== 'scheduled'
                ? prisma.form_responses.findMany({
                    where:  { request_id: request.id as string },
                    select: { question_id: true, answer: true },
                  })
                : Promise.resolve([]),
        ]);

        res.json({ ...request, questions, responses });
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
            select: { id: true, form_id: true },
        });
        if (!request) return res.status(404).json({ error: 'Request not found or already submitted' });

        await prisma.$transaction([
            prisma.form_responses.createMany({
                data: answers.map(({ question_id, answer }) => ({
                    id:         createId(),
                    request_id: req.params.request_id as string,
                    question_id,
                    answer:     answer != null ? String(answer) : '',
                })),
            }),
            prisma.form_requests.update({
                where: { id: req.params.request_id as string },
                data:  { status: 'submitted', submitted_at: new Date() },
            }),
        ]);

        res.json({ success: true });
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

        const [messages, workspace] = await Promise.all([
            prisma.messages.findMany({
                where:   { thread_id: thread.id },
                select:  { id: true, sender_type: true, body: true, read_by_team_at: true, read_by_client_at: true, created_at: true },
                orderBy: { created_at: 'asc' },
            }),
            prisma.workspaces.findFirst({
                where:  { id: req.client!.workspaceId },
                select: { name: true },
            }),
        ]);

        res.json({ thread, messages, coachName: workspace?.name ?? null });
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

        getIo()
            .to(`workspace:${req.client!.workspaceId}`)
            .emit('new_message', { threadId: thread.id, message, fromClient: true });

        res.status(201).json(message);
    } catch (err) {
        next(err);
    }
}
