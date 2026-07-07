import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { PoolClient } from 'pg';
import { deleteFile, toPublicUrl } from '../../lib/storage';
import {
    toIsoDateOrNull,
    serializePlanRow,
    serializePlanRows,
    normalizeOrderedList,
    insertOrderedChildren,
    replaceClientPlansTransactional,
    activateSinglePlan,
    saveSinglePlanDraft,
    withTransaction,
    reconcileCheckInSchedules,
} from '../../lib/planEngine';
import pool from '../../db';
import { prisma } from '../../lib/prisma';
import { FileBag } from './training.service';
import { recordEvent } from '../../lib/events';
import { sealVersionForAssignment } from '../forms/forms.service';

type Row = Record<string, unknown>;

// ── Muscle Groups ─────────────────────────────────────────────────────────────

export async function getMuscleGroups(req: Request, res: Response, next: NextFunction) {
    try {
        const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
            SELECT emg.*, (SELECT COUNT(*)::int FROM exercise_library el WHERE el.workspace_id = emg.workspace_id AND el.muscle_group = emg.name_en) AS exercise_count
            FROM exercise_muscle_groups emg
            WHERE emg.workspace_id = ${req.user!.workspaceId}
            ORDER BY emg.name_en ASC
        `;
        res.json(rows);
    } catch (err) { next(err); }
}

export async function createMuscleGroup(req: Request, res: Response, next: NextFunction) {
    try {
        const { name_en, name_ar } = req.body as { name_en?: string; name_ar?: string };
        const created = await prisma.exercise_muscle_groups.create({
            data: { id: createId(), workspace_id: req.user!.workspaceId, name_en: name_en!, name_ar: name_ar || null },
        });
        res.status(201).json(created);
    } catch (err) { next(err); }
}

export async function updateMuscleGroup(req: Request, res: Response, next: NextFunction) {
    try {
        const existing = await prisma.exercise_muscle_groups.findFirst({
            where: { id: req.params.id as string, workspace_id: req.user!.workspaceId as string },
        });
        if (!existing) return res.status(404).json({ error: 'Muscle group not found' });
        const oldNameEn = existing.name_en;

        const { name_en, name_ar } = req.body as { name_en?: string; name_ar?: string };
        const updated = await prisma.exercise_muscle_groups.update({
            where: { id: req.params.id as string },
            data:  { name_en: name_en!, name_ar: name_ar || null },
        });

        await prisma.exercise_library.updateMany({
            where: { workspace_id: req.user!.workspaceId, muscle_group: oldNameEn },
            data:  { muscle_group: name_en },
        });

        res.json(updated);
    } catch (err) { next(err); }
}

export async function deleteMuscleGroup(req: Request, res: Response, next: NextFunction) {
    try {
        const toDelete = await prisma.exercise_muscle_groups.findFirst({
            where: { id: req.params.id as string, workspace_id: req.user!.workspaceId as string },
        });
        if (!toDelete) return res.status(404).json({ error: 'Muscle group not found' });
        await prisma.exercise_muscle_groups.delete({ where: { id: req.params.id as string } });
        res.json(toDelete);
    } catch (err) { next(err); }
}

// ── Equipment ─────────────────────────────────────────────────────────────────

export async function getEquipments(req: Request, res: Response, next: NextFunction) {
    try {
        const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
            SELECT ee.*, (SELECT COUNT(*)::int FROM exercise_library el WHERE el.workspace_id = ee.workspace_id AND el.equipment = ee.name_en) AS exercise_count
            FROM exercise_equipments ee
            WHERE ee.workspace_id = ${req.user!.workspaceId}
            ORDER BY ee.name_en ASC
        `;
        res.json(rows);
    } catch (err) { next(err); }
}

export async function createEquipment(req: Request, res: Response, next: NextFunction) {
    try {
        const { name_en, name_ar } = req.body as { name_en?: string; name_ar?: string };
        const created = await prisma.exercise_equipments.create({
            data: { id: createId(), workspace_id: req.user!.workspaceId, name_en: name_en!, name_ar: name_ar || null },
        });
        res.status(201).json(created);
    } catch (err) { next(err); }
}

export async function updateEquipment(req: Request, res: Response, next: NextFunction) {
    try {
        const existing = await prisma.exercise_equipments.findFirst({
            where: { id: req.params.id as string, workspace_id: req.user!.workspaceId as string },
        });
        if (!existing) return res.status(404).json({ error: 'Equipment not found' });
        const oldNameEn = existing.name_en;

        const { name_en, name_ar } = req.body as { name_en?: string; name_ar?: string };
        const updated = await prisma.exercise_equipments.update({
            where: { id: req.params.id as string },
            data:  { name_en: name_en!, name_ar: name_ar || null },
        });

        await prisma.exercise_library.updateMany({
            where: { workspace_id: req.user!.workspaceId, equipment: oldNameEn },
            data:  { equipment: name_en },
        });

        res.json(updated);
    } catch (err) { next(err); }
}

export async function deleteEquipment(req: Request, res: Response, next: NextFunction) {
    try {
        const toDelete = await prisma.exercise_equipments.findFirst({
            where: { id: req.params.id as string, workspace_id: req.user!.workspaceId as string },
        });
        if (!toDelete) return res.status(404).json({ error: 'Equipment not found' });
        await prisma.exercise_equipments.delete({ where: { id: req.params.id as string } });
        res.json(toDelete);
    } catch (err) { next(err); }
}

// ── Exercise Library ──────────────────────────────────────────────────────────

export async function getExercises(req: Request, res: Response, next: NextFunction) {
    try {
        const exercises = await prisma.exercise_library.findMany({
            where:   { workspace_id: req.user!.workspaceId },
            orderBy: { created_at: 'desc' },
        });
        res.json(exercises.map((r) => ({
            ...r,
            video_path:     toPublicUrl(r.video_path),
            thumbnail_path: toPublicUrl(r.thumbnail_path),
            created_at:     toIsoDateOrNull(r.created_at),
            updated_at:     toIsoDateOrNull(r.updated_at),
        })));
    } catch (err) { next(err); }
}

export async function createExercise(req: Request, res: Response, next: NextFunction) {
    try {
        const { name_en, name_ar, muscle_group, equipment, youtube_url, instructions_en, instructions_ar } = req.body as Record<string, string | undefined>;

        if (!name_en || !name_en.trim()) return res.status(400).json({ error: 'Exercise name (English) is required' });

        const files     = req.files as FileBag | undefined;
        const videoPath = files?.video?.[0]?.key     ?? null;
        const thumbPath = files?.thumbnail?.[0]?.key ?? null;

        const created = await prisma.exercise_library.create({
            data: {
                id:              createId(),
                workspace_id:    req.user!.workspaceId,
                name_en:         name_en.trim(),
                name_ar:         name_ar || null,
                muscle_group:    muscle_group || null,
                equipment:       equipment || null,
                youtube_url:     youtube_url || null,
                video_path:      videoPath,
                thumbnail_path:  thumbPath,
                instructions_en: instructions_en || null,
                instructions_ar: instructions_ar || null,
            },
        });

        res.status(201).json(created);
    } catch (err) { next(err); }
}

export async function updateExercise(req: Request, res: Response, next: NextFunction) {
    try {
        const current = await prisma.exercise_library.findFirst({
            where: { id: req.params.id as string, workspace_id: req.user!.workspaceId as string },
        });
        if (!current) return res.status(404).json({ error: 'Exercise not found' });

        const body = req.body as Record<string, string | undefined>;
        if (!body.name_en || !body.name_en.trim()) return res.status(400).json({ error: 'Exercise name (English) is required' });

        const files         = req.files as FileBag | undefined;
        const newVideoFile  = files?.video?.[0];
        const newThumbFile  = files?.thumbnail?.[0];
        const videoPath     = newVideoFile ? newVideoFile.key : current.video_path;
        const thumbnailPath = newThumbFile ? newThumbFile.key : current.thumbnail_path;

        const updated = await prisma.exercise_library.update({
            where: { id: req.params.id as string },
            data: {
                name_en:         body.name_en.trim(),
                name_ar:         body.name_ar || null,
                muscle_group:    body.muscle_group || null,
                equipment:       body.equipment || null,
                youtube_url:     body.youtube_url || null,
                video_path:      videoPath,
                thumbnail_path:  thumbnailPath,
                instructions_en: body.instructions_en || null,
                instructions_ar: body.instructions_ar || null,
                updated_at:      new Date(),
            },
        });

        if (newVideoFile && current.video_path)     deleteFile(current.video_path).catch(() => {});
        if (newThumbFile && current.thumbnail_path) deleteFile(current.thumbnail_path).catch(() => {});

        res.json(updated);
    } catch (err) { next(err); }
}

export async function deleteExercise(req: Request, res: Response, next: NextFunction) {
    try {
        const toDelete = await prisma.exercise_library.findFirst({
            where: { id: req.params.id as string, workspace_id: req.user!.workspaceId as string },
        });
        if (!toDelete) return res.status(404).json({ error: 'Exercise not found' });
        await prisma.exercise_library.delete({ where: { id: req.params.id as string } });
        if (toDelete.video_path)     deleteFile(toDelete.video_path).catch(() => {});
        if (toDelete.thumbnail_path) deleteFile(toDelete.thumbnail_path).catch(() => {});
        res.json(toDelete);
    } catch (err) { next(err); }
}

// ── Training Plans ────────────────────────────────────────────────────────────

export async function getWorkspaceLibrary(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await pool.query(
            `SELECT
                tp.id, tp.name, tp.status, tp.created_at, tp.updated_at, tp.created_by,
                NULLIF(TRIM(COALESCE(c.fname, '') || ' ' || COALESCE(c.lname, '')), '') AS client_name,
                NULLIF(TRIM(COALESCE(u.fname, '') || ' ' || COALESCE(u.lname, '')), '') AS creator_name,
                (SELECT COUNT(*)::int FROM training_days td WHERE td.plan_id = tp.id) AS day_count,
                (SELECT COUNT(*)::int FROM training_exercises te
                    JOIN training_days td ON td.id = te.day_id
                    WHERE td.plan_id = tp.id) AS exercise_count
             FROM training_plans tp
             LEFT JOIN clients c ON c.id = tp.client_id
             LEFT JOIN users u ON u.id = tp.created_by
             WHERE tp.workspace_id = $1
             ORDER BY tp.updated_at DESC`,
            [req.user!.workspaceId]
        );
        res.json(serializePlanRows(result.rows));
    } catch (err) { next(err); }
}

export async function getPlans(req: Request, res: Response, next: NextFunction) {
    try {
        const result = await pool.query(
            `SELECT tp.*,
                (SELECT COUNT(*) FROM training_days WHERE plan_id = tp.id)::int AS day_count
             FROM training_plans tp
             WHERE tp.workspace_id = $1 AND tp.client_id = $2
             ORDER BY tp.created_at DESC`,
            [req.user!.workspaceId, req.query.clientId]
        );
        res.json(serializePlanRows(result.rows));
    } catch (err) { next(err); }
}

export async function getPlan(req: Request, res: Response, next: NextFunction) {
    try {
        const planResult = await pool.query(
            'SELECT * FROM training_plans WHERE id = $1 AND workspace_id = $2',
            [req.params.id, req.user!.workspaceId]
        );
        if (!planResult.rows.length) return res.status(404).json({ error: 'Training plan not found' });

        const plan = planResult.rows[0] as Row;

        const daysResult = await pool.query(
            'SELECT * FROM training_days WHERE plan_id = $1 ORDER BY day_order ASC',
            [plan.id]
        );

        const days = await Promise.all((daysResult.rows as Row[]).map(async (day) => {
            const exercisesResult = await pool.query(
                `SELECT te.*,
                        el.thumbnail_path, el.video_path, el.youtube_url, el.muscle_group,
                        el.instructions_en AS instructions, el.instructions_ar,
                        el.name_en AS library_name_en, el.name_ar AS library_name_ar
                 FROM training_exercises te
                 LEFT JOIN exercise_library el ON el.id = te.exercise_library_id
                 WHERE te.day_id = $1 ORDER BY te.exercise_order ASC`,
                [day.id]
            );

            const exercises = await Promise.all((exercisesResult.rows as Row[]).map(async (exercise) => {
                const [setsResult, alternativesResult] = await Promise.all([
                    pool.query('SELECT * FROM training_sets WHERE exercise_id = $1 ORDER BY set_order ASC', [exercise.id]),
                    pool.query(
                        `SELECT tea.*, el.name_en AS name, el.name_ar, el.muscle_group, el.equipment, el.thumbnail_path, el.youtube_url, el.video_path
                         FROM training_exercise_alternatives tea
                         JOIN exercise_library el ON el.id = tea.exercise_library_id
                         WHERE tea.exercise_id = $1 ORDER BY tea.alt_order ASC`,
                        [exercise.id]
                    ),
                ]);

                return {
                    ...exercise,
                    thumbnail_path: toPublicUrl(exercise.thumbnail_path as string | null),
                    video_path:     toPublicUrl(exercise.video_path as string | null),
                    sets:           setsResult.rows,
                    alternatives:   (alternativesResult.rows as Row[]).map((alt) => ({
                        ...alt,
                        thumbnail_path: toPublicUrl(alt.thumbnail_path as string | null),
                        video_path:     toPublicUrl(alt.video_path as string | null),
                    })),
                };
            }));

            return { ...day, exercises };
        }));

        res.json({ ...serializePlanRow(plan), days, day_count: days.length });
    } catch (err) { next(err); }
}

export async function saveDraft(req: Request, res: Response, next: NextFunction) {
    const { clientId, plans = [], activePlanId = null } = req.body as { clientId: string; plans?: Row[]; activePlanId?: string | null };

    try {
        await replaceClientPlansTransactional({
            pool,
            work: async (dbClient) => {
                // Package Lifecycle Phase 3a bug fix -- see the identical
                // note in nutrition.controller.ts's saveDraft.
                const existingPlansResult = await dbClient.query(
                    `SELECT id, activated_at, cycle_days, cycle_end_at, review_notified_at
                     FROM training_plans WHERE workspace_id = $1 AND client_id = $2`,
                    [req.user!.workspaceId, clientId]
                );
                const existingPlanDates = new Map(
                    (existingPlansResult.rows as Row[]).map(row => [row.id as string, row])
                );

                await dbClient.query('DELETE FROM training_plans WHERE workspace_id = $1 AND client_id = $2', [req.user!.workspaceId, clientId]);

                const planIdMap = new Map<string, string>();

                for (const [planIndex, plan] of (normalizeOrderedList(plans, 'plan_order') as Row[]).entries()) {
                    const createdAt = toIsoDateOrNull(plan.created_at as string | null) || new Date().toISOString();
                    const updatedAt = new Date().toISOString();
                    const priorDates = existingPlanDates.get(plan.id as string);

                    const insertedPlan = await dbClient.query(
                        `INSERT INTO training_plans (name, client_id, workspace_id, status, notes, created_at, updated_at, created_by, id, activated_at, cycle_days, cycle_end_at, review_notified_at)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
                        [
                            (plan.name as string) || `Training Plan ${planIndex + 1}`,
                            clientId, req.user!.workspaceId,
                            plan.status === 'active' ? 'active' : 'inactive',
                            plan.notes ?? null, createdAt, updatedAt,
                            (plan.created_by as string | null) ?? req.user!.userId,
                            createId(),
                            priorDates?.activated_at ?? null,
                            priorDates?.cycle_days ?? null,
                            priorDates?.cycle_end_at ?? null,
                            priorDates?.review_notified_at ?? null,
                        ]
                    );

                    const dbPlan = insertedPlan.rows[0] as Row;
                    planIdMap.set(plan.id as string, dbPlan.id as string);

                    for (const day of normalizeOrderedList(plan.days as Row[], 'day_order') as Row[]) {
                        const insertedDay = await dbClient.query(
                            `INSERT INTO training_days (plan_id, name, day_order, notes, id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                            [dbPlan.id, (day.name as string) || `Day ${day.day_order}`, day.day_order, day.notes ?? null, createId()]
                        );

                        for (const exercise of normalizeOrderedList(day.exercises as Row[], 'exercise_order') as Row[]) {
                            const insertedExercise = await dbClient.query(
                                `INSERT INTO training_exercises (day_id, name, exercise_order, exercise_library_id, equipment, notes, id)
                                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                                [
                                    (insertedDay.rows[0] as Row).id,
                                    (exercise.name as string) || `Exercise ${exercise.exercise_order}`,
                                    exercise.exercise_order, exercise.exercise_library_id || null,
                                    exercise.equipment ?? null, exercise.notes ?? null, createId(),
                                ]
                            );

                            for (const set of normalizeOrderedList(exercise.sets as Row[], 'set_order') as Row[]) {
                                await dbClient.query(
                                    `INSERT INTO training_sets (exercise_id, set_order, reps, rest_seconds, tempo, rir, id)
                                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                                    [
                                        (insertedExercise.rows[0] as Row).id, set.set_order,
                                        set.reps ?? null,
                                        Number.isFinite(Number(set.rest_seconds)) ? Number(set.rest_seconds) : null,
                                        set.tempo ?? null,
                                        Number.isFinite(Number(set.rir)) ? Number(set.rir) : null,
                                        createId(),
                                    ]
                                );
                            }

                            for (const alt of normalizeOrderedList(exercise.alternatives as Row[], 'alt_order') as Row[]) {
                                if (!alt.exercise_library_id) continue;
                                await dbClient.query(
                                    `INSERT INTO training_exercise_alternatives (exercise_id, exercise_library_id, alt_order, id) VALUES ($1, $2, $3, $4)`,
                                    [(insertedExercise.rows[0] as Row).id, alt.exercise_library_id, alt.alt_order, createId()]
                                );
                            }
                        }
                    }
                }

                const resolvedActivePlanId = planIdMap.get(activePlanId as string) || null;
                if (resolvedActivePlanId) {
                    await dbClient.query(
                        `UPDATE training_plans
                         SET status = CASE WHEN id = $1 THEN 'active' ELSE 'inactive' END,
                             activated_at = CASE WHEN id = $1 THEN COALESCE(activated_at, NOW()) ELSE activated_at END,
                             updated_at = NOW()
                         WHERE workspace_id = $2 AND client_id = $3`,
                        [resolvedActivePlanId, req.user!.workspaceId, clientId]
                    );
                }
            },
        });

        const summary = await pool.query(
            `SELECT tp.*, (SELECT COUNT(*) FROM training_days WHERE plan_id = tp.id)::int AS day_count
             FROM training_plans tp
             WHERE tp.workspace_id = $1 AND tp.client_id = $2
             ORDER BY tp.created_at DESC`,
            [req.user!.workspaceId, clientId]
        );

        res.json({ plans: serializePlanRows(summary.rows) });
    } catch (err) { next(err); }
}

export async function savePlanDraft(req: Request, res: Response, next: NextFunction) {
    const { clientId, plan, activePlanId = null, durationChoice, cycleDays: restartCycleDays, checkInForms: restartCheckInForms } = req.body as {
        clientId: string; plan: Row; activePlanId?: string | null;
        durationChoice?: 'restart' | 'extend';
        // See the identical note in nutrition.controller.ts's savePlanDraft.
        cycleDays?: number | null;
        checkInForms?: Array<{ formId: string }>;
    };

    try {
        let existingCreatedBy: string | null = null;
        // Package Lifecycle Phase 3a bug fix -- see the identical note in
        // nutrition.controller.ts's savePlanDraft.
        let existingActivatedAt: Date | null = null;
        let existingCycleDays: number | null = null;
        let existingCycleEndAt: Date | null = null;
        let existingReviewNotifiedAt: Date | null = null;
        // See the identical note in nutrition.controller.ts's savePlanDraft.
        let restartedClientId: string | null = null;

        const result = await saveSinglePlanDraft({
            pool, plan, clientId, coachId: req.user!.workspaceId, activePlanId,
            loadExistingPlan: async ({ dbClient, planId, clientId: cId, coachId }: { dbClient: PoolClient; planId: string; clientId: string; coachId: string }) => {
                const existing = await dbClient.query(
                    `SELECT id, created_at, created_by, activated_at, cycle_days, cycle_end_at, review_notified_at
                     FROM training_plans WHERE id = $1 AND workspace_id = $2 AND client_id = $3`,
                    [planId, coachId, cId]
                );
                const row = existing.rows[0] as Row | undefined;
                existingCreatedBy       = (row?.created_by as string) ?? null;
                existingActivatedAt     = (row?.activated_at as Date) ?? null;
                existingCycleDays       = (row?.cycle_days as number) ?? null;
                existingCycleEndAt      = (row?.cycle_end_at as Date) ?? null;
                existingReviewNotifiedAt = (row?.review_notified_at as Date) ?? null;
                return row ?? null;
            },
            deleteExistingPlanTree: async ({ dbClient, planId }: { dbClient: PoolClient; planId: string }) => {
                await dbClient.query('DELETE FROM training_plans WHERE id = $1', [planId]);
            },
            insertPlanTree: async ({ dbClient, plan: incomingPlan, clientId: cId, coachId, createdAt, updatedAt }: { dbClient: PoolClient; plan: Row; clientId: string; coachId: string; createdAt: string; updatedAt: string }) => {
                const createdBy    = existingCreatedBy ?? req.user!.userId;
                const insertedPlan = await dbClient.query(
                    `INSERT INTO training_plans (name, client_id, workspace_id, status, notes, created_at, updated_at, created_by, id, activated_at, cycle_days, cycle_end_at, review_notified_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
                    [
                        (incomingPlan.name as string) || 'Untitled Training Plan',
                        cId, coachId,
                        incomingPlan.status === 'active' ? 'active' : 'inactive',
                        incomingPlan.notes ?? null, createdAt, updatedAt, createdBy, createId(),
                        existingActivatedAt, existingCycleDays, existingCycleEndAt, existingReviewNotifiedAt,
                    ]
                );

                const newPlan = insertedPlan.rows[0] as Row;

                await insertOrderedChildren({
                    items: incomingPlan.days as Row[], orderKey: 'day_order',
                    insert: async (day: Row) => {
                        const insertedDay = await dbClient.query(
                            `INSERT INTO training_days (plan_id, name, day_order, notes, id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                            [newPlan.id, (day.name as string) || `Day ${day.day_order}`, day.day_order, day.notes ?? null, createId()]
                        );

                        await insertOrderedChildren({
                            items: day.exercises as Row[], orderKey: 'exercise_order',
                            insert: async (exercise: Row) => {
                                const insertedExercise = await dbClient.query(
                                    `INSERT INTO training_exercises (day_id, name, exercise_order, exercise_library_id, equipment, notes, id)
                                     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                                    [
                                        (insertedDay.rows[0] as Row).id,
                                        (exercise.name as string) || `Exercise ${exercise.exercise_order}`,
                                        exercise.exercise_order, exercise.exercise_library_id || null,
                                        exercise.equipment ?? null, exercise.notes ?? null, createId(),
                                    ]
                                );

                                await insertOrderedChildren({
                                    items: exercise.sets as Row[], orderKey: 'set_order',
                                    insert: async (set: Row) => {
                                        await dbClient.query(
                                            `INSERT INTO training_sets (exercise_id, set_order, reps, rest_seconds, tempo, rir, id)
                                             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                                            [
                                                (insertedExercise.rows[0] as Row).id, set.set_order,
                                                set.reps ?? null,
                                                Number.isFinite(Number(set.rest_seconds)) ? Number(set.rest_seconds) : null,
                                                set.tempo ?? null,
                                                Number.isFinite(Number(set.rir)) ? Number(set.rir) : null,
                                                createId(),
                                            ]
                                        );
                                        return set;
                                    },
                                });

                                await insertOrderedChildren({
                                    items: exercise.alternatives as Row[], orderKey: 'alt_order',
                                    insert: async (alt: Row) => {
                                        if (!alt.exercise_library_id) return alt;
                                        await dbClient.query(
                                            `INSERT INTO training_exercise_alternatives (exercise_id, exercise_library_id, alt_order, id) VALUES ($1, $2, $3, $4)`,
                                            [(insertedExercise.rows[0] as Row).id, alt.exercise_library_id, alt.alt_order, createId()]
                                        );
                                        return alt;
                                    },
                                });

                                return insertedExercise.rows[0];
                            },
                        });

                        return insertedDay.rows[0];
                    },
                });

                return newPlan;
            },
            activatePlanInTransaction: async ({ dbClient, planId, coachId }: { dbClient: PoolClient; planId: unknown; clientId: string; coachId: string }) => {
                // Package Lifecycle Phase 3b, post-review refinement:
                // consolidated onto the shared activateSinglePlan -- see the
                // identical note in nutrition.controller.ts's savePlanDraft.
                const restarted = await activateSinglePlan({
                    db: dbClient,
                    tableName:      'training_plans',
                    planId:         planId as string,
                    coachId,
                    clientIdColumn: 'client_id',
                    updateMode:     durationChoice,
                    ...(durationChoice === 'restart' && restartCycleDays !== undefined ? { cycleDays: restartCycleDays } : {}),
                });
                if (restarted && durationChoice === 'restart') {
                    // See the identical note in nutrition.controller.ts:
                    // matched by client + plan type, not source_plan_id,
                    // since this save path's plan id already changed by now.
                    // reconcileCheckInSchedules retargets/removes/adds
                    // check-in schedules for the new cycle_end_at -- see its
                    // doc comment in lib/planEngine.ts. Skipped if the
                    // restart didn't resolve a cycle_end_at.
                    if (restarted.cycle_end_at) {
                        await reconcileCheckInSchedules({
                            dbClient,
                            sourcePlanType: 'training',
                            sourcePlanId:   restarted.id as string,
                            clientId:       restarted.client_id as string,
                            workspaceId:    coachId,
                            cycleEndAt:     restarted.cycle_end_at as Date,
                            checkInForms:   restartCheckInForms,
                            actorUserId:    req.user!.userId,
                        });
                    }
                    restartedClientId = restarted.client_id as string;
                }
            },
            fetchSavedPlan: async ({ planId, coachId }: { planId: unknown; coachId: string }) => {
                const savedPlanResult = await pool.query(
                    `SELECT tp.*, (SELECT COUNT(*) FROM training_days WHERE plan_id = tp.id)::int AS day_count
                     FROM training_plans tp WHERE tp.id = $1 AND tp.workspace_id = $2`,
                    [planId, coachId]
                );
                return savedPlanResult.rows[0] ?? null;
            },
        });

        if (restartedClientId) {
            await recordEvent({
                workspaceId: req.user!.workspaceId,
                type:        'plan.duration_restarted',
                title:       'Your training plan has been restarted',
                recipients:  [{ type: 'client', id: restartedClientId }],
                actor:       { type: 'user', id: req.user!.userId },
                entity:      { type: 'training_plan', id: result.newPlanId as string },
                metadata:    { clientId: restartedClientId },
            });
        }

        res.json(result);
    } catch (err) { next(err); }
}

export async function activatePlan(req: Request, res: Response, next: NextFunction) {
    // Package Lifecycle Phase 3b -- see the identical note in
    // nutrition.controller.ts's activatePlan.
    const { cycleDays, checkInForms, reviewOffsetDays, updateMode } = req.body as {
        cycleDays?: number | null;
        checkInForms?: { formId: string }[];
        reviewOffsetDays?: number | null;
        updateMode?: 'restart' | 'extend';
    };

    try {
        const planId  = req.params.id as string;
        const coachId = req.user!.workspaceId;

        const updatedPlan = await withTransaction(pool, async (dbClient) => {
            const plan = await activateSinglePlan({
                db: dbClient,
                tableName:      'training_plans',
                planId,
                coachId,
                clientIdColumn: 'client_id',
                cycleDays:        cycleDays !== undefined ? (cycleDays == null ? null : Number(cycleDays)) : undefined,
                reviewOffsetDays: reviewOffsetDays !== undefined ? (reviewOffsetDays == null ? null : Number(reviewOffsetDays)) : undefined,
                updateMode,
            });
            if (!plan) return null;

            if (updateMode === 'restart') {
                // Bug fix -- see the identical note in
                // nutrition.controller.ts's activatePlan.
                await dbClient.query(
                    `DELETE FROM form_requests WHERE status = 'scheduled' AND id IN (
                         SELECT form_request_id FROM check_in_schedules
                         WHERE source_plan_type = 'training' AND source_plan_id = $1 AND form_request_id IS NOT NULL
                     )`,
                    [planId]
                );
                await dbClient.query(
                    `DELETE FROM check_in_schedules WHERE source_plan_type = 'training' AND source_plan_id = $1`,
                    [planId]
                );
            }
            // Check-in forms fire once, at the plan's own end date -- see
            // the identical note in nutrition.controller.ts's activatePlan.
            if (Array.isArray(checkInForms) && checkInForms.length > 0 && plan.cycle_end_at) {
                for (const f of checkInForms) {
                    if (!f.formId) continue;

                    // Bug fix -- see the identical note in
                    // nutrition.controller.ts's activatePlan: create the
                    // form_requests row immediately (status 'scheduled') so
                    // it's visible in Plans Queue right away.
                    const { versionId } = await sealVersionForAssignment(f.formId, coachId, req.user!.userId);
                    const requestId = createId();
                    await dbClient.query(
                        `INSERT INTO form_requests (id, form_id, form_version_id, client_id, workspace_id, status, scheduled_at)
                         VALUES ($1, $2, $3, $4, $5, 'scheduled', $6)`,
                        [requestId, f.formId, versionId, plan.client_id, coachId, plan.cycle_end_at]
                    );
                    await dbClient.query(
                        `INSERT INTO check_in_schedules (id, workspace_id, client_id, form_id, next_due_at, source_plan_type, source_plan_id, form_request_id)
                         VALUES ($1, $2, $3, $4, $5, 'training', $6, $7)`,
                        [createId(), coachId, plan.client_id, f.formId, plan.cycle_end_at, plan.id, requestId]
                    );
                }
            }

            return plan;
        });

        if (!updatedPlan) return res.status(404).json({ error: 'Plan not found' });

        // See the identical note in nutrition.controller.ts's activatePlan.
        if (updateMode === 'restart') {
            await recordEvent({
                workspaceId: req.user!.workspaceId,
                type:        'plan.duration_restarted',
                title:       'Your training plan has been restarted',
                recipients:  [{ type: 'client', id: updatedPlan.client_id as string }],
                actor:       { type: 'user', id: req.user!.userId },
                entity:      { type: 'training_plan', id: updatedPlan.id as string },
                metadata:    { clientId: updatedPlan.client_id as string },
            });
        } else {
            await recordEvent({
                workspaceId: req.user!.workspaceId,
                type:        'plan.assigned',
                title:       'A new training plan was assigned to you',
                recipients:  [{ type: 'client', id: updatedPlan.client_id as string }],
                actor:       { type: 'user', id: req.user!.userId },
                entity:      { type: 'training_plan', id: updatedPlan.id as string },
                metadata:    { clientId: updatedPlan.client_id as string },
                realtime:    { rooms: [`client:${updatedPlan.client_id as string}`], event: 'plan_assigned', payload: { type: 'training', planId: updatedPlan.id } },
            });
        }

        res.json(updatedPlan);
    } catch (err) { next(err); }
}
