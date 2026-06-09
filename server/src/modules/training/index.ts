import { Router, Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { PoolClient } from 'pg';
import authMiddleware from '../../middleware/auth';
import requirePermission from '../../middleware/requirePermission';
import { makeUploader, deleteFile, toPublicUrl } from '../../lib/storage';
import { uploadLimiter } from '../../middleware/rateLimit';
import {
    toIsoDateOrNull,
    serializePlanRow,
    serializePlanRows,
    normalizeOrderedList,
    insertOrderedChildren,
    replaceClientPlansTransactional,
    activateSinglePlan,
    saveSinglePlanDraft,
} from '../../lib/planEngine';
import pool from '../../db';

const router = Router();

type Row  = Record<string, unknown>;
type FileBag = { [fieldname: string]: Express.MulterS3.File[] };

const upload = makeUploader(
    (file: Express.Multer.File) => file.fieldname === 'video' ? 'exercise-library/videos' : 'exercise-library/thumbnails',
    null,
    {
        maxSize:    5 * 1024 * 1024,
        fileFilter: (_req, file, cb) => {
            if (file.fieldname === 'video') {
                if (!file.mimetype.startsWith('video/')) return cb(new Error('Video must be a video file'));
                return cb(null, true);
            }
            if (file.fieldname === 'thumbnail') {
                if (!file.mimetype.startsWith('image/')) return cb(new Error('Thumbnail must be an image file'));
                return cb(null, true);
            }
            cb(null, true);
        },
    }
);

router.use(authMiddleware);
router.use((req: Request, res: Response, next: NextFunction) => {
    const action = req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('training', action)(req, res, next);
});

// ── Muscle Groups ─────────────────────────────────────────────────────────────

router.get('/muscle-groups', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await pool.query(
            `SELECT emg.*, (SELECT COUNT(*)::int FROM exercise_library el WHERE el.workspace_id = emg.workspace_id AND el.muscle_group = emg.name_en) AS exercise_count
             FROM exercise_muscle_groups emg
             WHERE emg.workspace_id = $1
             ORDER BY emg.name_en ASC`,
            [req.user!.workspaceId]
        );
        res.json(result.rows);
    } catch (err) { next(err); }
});

router.post('/muscle-groups', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name_en, name_ar } = req.body as { name_en?: string; name_ar?: string };
        const result = await pool.query(
            'INSERT INTO exercise_muscle_groups (workspace_id, name_en, name_ar) VALUES ($1, $2, $3) RETURNING *',
            [req.user!.workspaceId, name_en, name_ar || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
});

router.put('/muscle-groups/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const oldRow = await pool.query('SELECT * FROM exercise_muscle_groups WHERE id = $1 AND workspace_id = $2', [req.params.id, req.user!.workspaceId]);
        if (!oldRow.rows.length) return res.status(404).json({ error: 'Muscle group not found' });
        const oldNameEn = (oldRow.rows[0] as Row).name_en as string;

        const { name_en, name_ar } = req.body as { name_en?: string; name_ar?: string };
        const result = await pool.query(
            'UPDATE exercise_muscle_groups SET name_en = $1, name_ar = $2 WHERE id = $3 AND workspace_id = $4 RETURNING *',
            [name_en, name_ar || null, req.params.id, req.user!.workspaceId]
        );

        await pool.query(
            'UPDATE exercise_library SET muscle_group = $1 WHERE workspace_id = $2 AND muscle_group = $3',
            [name_en, req.user!.workspaceId, oldNameEn]
        );

        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

router.delete('/muscle-groups/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await pool.query('DELETE FROM exercise_muscle_groups WHERE id = $1 AND workspace_id = $2 RETURNING *', [req.params.id, req.user!.workspaceId]);
        if (!result.rows.length) return res.status(404).json({ error: 'Muscle group not found' });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

// ── Equipment ─────────────────────────────────────────────────────────────────

router.get('/equipments', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await pool.query(
            `SELECT ee.*, (SELECT COUNT(*)::int FROM exercise_library el WHERE el.workspace_id = ee.workspace_id AND el.equipment = ee.name_en) AS exercise_count
             FROM exercise_equipments ee
             WHERE ee.workspace_id = $1
             ORDER BY ee.name_en ASC`,
            [req.user!.workspaceId]
        );
        res.json(result.rows);
    } catch (err) { next(err); }
});

router.post('/equipments', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name_en, name_ar } = req.body as { name_en?: string; name_ar?: string };
        const result = await pool.query(
            'INSERT INTO exercise_equipments (workspace_id, name_en, name_ar) VALUES ($1, $2, $3) RETURNING *',
            [req.user!.workspaceId, name_en, name_ar || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
});

router.put('/equipments/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const oldRow = await pool.query('SELECT * FROM exercise_equipments WHERE id = $1 AND workspace_id = $2', [req.params.id, req.user!.workspaceId]);
        if (!oldRow.rows.length) return res.status(404).json({ error: 'Equipment not found' });
        const oldNameEn = (oldRow.rows[0] as Row).name_en as string;

        const { name_en, name_ar } = req.body as { name_en?: string; name_ar?: string };
        const result = await pool.query(
            'UPDATE exercise_equipments SET name_en = $1, name_ar = $2 WHERE id = $3 AND workspace_id = $4 RETURNING *',
            [name_en, name_ar || null, req.params.id, req.user!.workspaceId]
        );

        await pool.query(
            'UPDATE exercise_library SET equipment = $1 WHERE workspace_id = $2 AND equipment = $3',
            [name_en, req.user!.workspaceId, oldNameEn]
        );

        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

router.delete('/equipments/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await pool.query('DELETE FROM exercise_equipments WHERE id = $1 AND workspace_id = $2 RETURNING *', [req.params.id, req.user!.workspaceId]);
        if (!result.rows.length) return res.status(404).json({ error: 'Equipment not found' });
        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

// ── Exercise Library ──────────────────────────────────────────────────────────

router.get('/exercise-library', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await pool.query(
            `SELECT * FROM exercise_library WHERE workspace_id = $1 ORDER BY created_at DESC`,
            [req.user!.workspaceId]
        );
        res.json(result.rows.map((r: Row) => ({
            ...r,
            video_path:     toPublicUrl(r.video_path as string | null),
            thumbnail_path: toPublicUrl(r.thumbnail_path as string | null),
            created_at:     toIsoDateOrNull(r.created_at as Date | string | null),
            updated_at:     toIsoDateOrNull(r.updated_at as Date | string | null),
        })));
    } catch (err) { next(err); }
});

router.post('/exercise-library', uploadLimiter, upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name_en, name_ar, muscle_group, equipment, youtube_url, instructions_en, instructions_ar } = req.body as Record<string, string | undefined>;

        if (!name_en || !name_en.trim()) {
            return res.status(400).json({ error: 'Exercise name (English) is required' });
        }

        const files        = req.files as FileBag | undefined;
        const videoPath    = files?.video?.[0]?.key     ?? null;
        const thumbPath    = files?.thumbnail?.[0]?.key ?? null;

        const result = await pool.query(
            `INSERT INTO exercise_library (workspace_id, name_en, name_ar, muscle_group, equipment, youtube_url, video_path, thumbnail_path, instructions_en, instructions_ar, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
             RETURNING *`,
            [req.user!.workspaceId, name_en.trim(), name_ar || null, muscle_group || null, equipment || null, youtube_url || null, videoPath, thumbPath, instructions_en || null, instructions_ar || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) { next(err); }
});

router.put('/exercise-library/:id', uploadLimiter, upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), async (req: Request, res: Response, next: NextFunction) => {
    try {
        const existing = await pool.query('SELECT * FROM exercise_library WHERE id = $1 AND workspace_id = $2', [req.params.id, req.user!.workspaceId]);
        if (!existing.rows.length) return res.status(404).json({ error: 'Exercise not found' });
        const current = existing.rows[0] as Row;

        const body = req.body as Record<string, string | undefined>;
        if (!body.name_en || !body.name_en.trim()) {
            return res.status(400).json({ error: 'Exercise name (English) is required' });
        }

        const files         = req.files as FileBag | undefined;
        const newVideoFile  = files?.video?.[0];
        const newThumbFile  = files?.thumbnail?.[0];
        const videoPath     = newVideoFile ? newVideoFile.key  : (current.video_path     as string | null);
        const thumbnailPath = newThumbFile ? newThumbFile.key  : (current.thumbnail_path as string | null);

        const result = await pool.query(
            `UPDATE exercise_library
             SET name_en = $1, name_ar = $2, muscle_group = $3, equipment = $4, youtube_url = $5,
                 video_path = $6, thumbnail_path = $7, instructions_en = $8, instructions_ar = $9,
                 updated_at = NOW()
             WHERE id = $10 AND workspace_id = $11
             RETURNING *`,
            [
                body.name_en.trim(), body.name_ar || null, body.muscle_group || null, body.equipment || null,
                body.youtube_url || null, videoPath, thumbnailPath,
                body.instructions_en || null, body.instructions_ar || null,
                req.params.id, req.user!.workspaceId,
            ]
        );

        if (newVideoFile  && current.video_path)     deleteFile(current.video_path as string).catch(() => {});
        if (newThumbFile  && current.thumbnail_path) deleteFile(current.thumbnail_path as string).catch(() => {});

        res.json(result.rows[0]);
    } catch (err) { next(err); }
});

router.delete('/exercise-library/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await pool.query('DELETE FROM exercise_library WHERE id = $1 AND workspace_id = $2 RETURNING *', [req.params.id, req.user!.workspaceId]);
        if (!result.rows.length) return res.status(404).json({ error: 'Exercise not found' });
        const deleted = result.rows[0] as Row;
        deleteFile(deleted.video_path as string).catch(() => {});
        deleteFile(deleted.thumbnail_path as string).catch(() => {});
        res.json(deleted);
    } catch (err) { next(err); }
});

// ── Training Plans ────────────────────────────────────────────────────────────

router.get('/plans/workspace-library', async (req: Request, res: Response, next: NextFunction) => {
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
});

router.get('/plans', async (req: Request, res: Response, next: NextFunction) => {
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
});

router.get('/plans/:id', async (req: Request, res: Response, next: NextFunction) => {
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
});

router.post('/plans/save-draft', async (req: Request, res: Response, next: NextFunction) => {
    const { clientId, plans = [], activePlanId = null } = req.body as { clientId: string; plans?: Row[]; activePlanId?: string | null };

    try {
        await replaceClientPlansTransactional({
            pool,
            work: async (dbClient) => {
                await dbClient.query('DELETE FROM training_plans WHERE workspace_id = $1 AND client_id = $2', [req.user!.workspaceId, clientId]);

                const planIdMap = new Map<string, string>();

                for (const [planIndex, plan] of (normalizeOrderedList(plans, 'plan_order') as Row[]).entries()) {
                    const createdAt = toIsoDateOrNull(plan.created_at as string | null) || new Date().toISOString();
                    const updatedAt = new Date().toISOString();

                    const insertedPlan = await dbClient.query(
                        `INSERT INTO training_plans (name, client_id, workspace_id, status, notes, created_at, updated_at, created_by, id)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                         RETURNING *`,
                        [
                            (plan.name as string) || `Training Plan ${planIndex + 1}`,
                            clientId,
                            req.user!.workspaceId,
                            plan.status === 'active' ? 'active' : 'inactive',
                            plan.notes ?? null,
                            createdAt, updatedAt,
                            (plan.created_by as string | null) ?? req.user!.userId,
                            createId(),
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
                         SET status = CASE WHEN id = $1 THEN 'active' ELSE 'inactive' END, updated_at = NOW()
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
});

router.post('/plans/save-plan-draft', async (req: Request, res: Response, next: NextFunction) => {
    const { clientId, plan, activePlanId = null } = req.body as { clientId: string; plan: Row; activePlanId?: string | null };

    try {
        let existingCreatedBy: string | null = null;

        const result = await saveSinglePlanDraft({
            pool,
            plan,
            clientId,
            coachId:    req.user!.workspaceId,
            activePlanId,
            loadExistingPlan: async ({ dbClient, planId, clientId: cId, coachId }: { dbClient: PoolClient; planId: number; clientId: string; coachId: string }) => {
                const existing = await dbClient.query(
                    `SELECT id, created_at, created_by FROM training_plans WHERE id = $1 AND workspace_id = $2 AND client_id = $3`,
                    [planId, coachId, cId]
                );
                existingCreatedBy = (existing.rows[0] as Row)?.created_by as string ?? null;
                return existing.rows[0] ?? null;
            },
            deleteExistingPlanTree: async ({ dbClient, planId }: { dbClient: PoolClient; planId: number }) => {
                await dbClient.query('DELETE FROM training_plans WHERE id = $1', [planId]);
            },
            insertPlanTree: async ({ dbClient, plan: incomingPlan, clientId: cId, coachId, createdAt, updatedAt }: { dbClient: PoolClient; plan: Row; clientId: string; coachId: string; createdAt: string; updatedAt: string }) => {
                const createdBy = existingCreatedBy ?? req.user!.userId;
                const insertedPlan = await dbClient.query(
                    `INSERT INTO training_plans (name, client_id, workspace_id, status, notes, created_at, updated_at, created_by, id)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
                    [
                        (incomingPlan.name as string) || 'Untitled Training Plan',
                        cId, coachId,
                        incomingPlan.status === 'active' ? 'active' : 'inactive',
                        incomingPlan.notes ?? null, createdAt, updatedAt, createdBy, createId(),
                    ]
                );

                const newPlan = insertedPlan.rows[0] as Row;

                await insertOrderedChildren({
                    items:    incomingPlan.days as Row[],
                    orderKey: 'day_order',
                    insert:   async (day: Row) => {
                        const insertedDay = await dbClient.query(
                            `INSERT INTO training_days (plan_id, name, day_order, notes, id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
                            [newPlan.id, (day.name as string) || `Day ${day.day_order}`, day.day_order, day.notes ?? null, createId()]
                        );

                        await insertOrderedChildren({
                            items:    day.exercises as Row[],
                            orderKey: 'exercise_order',
                            insert:   async (exercise: Row) => {
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
                                    items:    exercise.sets as Row[],
                                    orderKey: 'set_order',
                                    insert:   async (set: Row) => {
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
                                    items:    exercise.alternatives as Row[],
                                    orderKey: 'alt_order',
                                    insert:   async (alt: Row) => {
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
            activatePlanInTransaction: async ({ dbClient, planId, clientId: cId, coachId }: { dbClient: PoolClient; planId: unknown; clientId: string; coachId: string }) => {
                await dbClient.query(
                    `UPDATE training_plans
                     SET status = CASE WHEN id = $1 THEN 'active' ELSE 'inactive' END, updated_at = NOW()
                     WHERE workspace_id = $2 AND client_id = $3`,
                    [planId, coachId, cId]
                );
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

        res.json(result);
    } catch (err) { next(err); }
});

router.post('/plans/:id/activate', async (req: Request, res: Response, next: NextFunction) => {
    const planId = Number(req.params.id);
    if (!Number.isInteger(planId) || planId <= 0) {
        return res.status(400).json({ error: 'Plan must be saved before it can be activated' });
    }
    try {
        const updatedPlan = await activateSinglePlan({
            pool,
            tableName:      'training_plans',
            planId,
            coachId:        req.user!.workspaceId,
            clientIdColumn: 'client_id',
        });

        if (!updatedPlan) return res.status(404).json({ error: 'Plan not found' });
        res.json(updatedPlan);
    } catch (err) { next(err); }
});

export default router;
