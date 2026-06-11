const express = require('express');
const router = express.Router();
const { createId } = require('@paralleldrive/cuid2');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const { makeUploader, deleteFile, toPublicUrl } = require('../lib/storage');
const { uploadLimiter } = require('../middleware/rateLimit');
const {
    toIsoDateOrNull,
    serializePlanRow,
    serializePlanRows,
    normalizeOrderedList,
    insertOrderedChildren,
    replaceClientPlansTransactional,
    activateSinglePlan,
    saveSinglePlanDraft,
} = require('../lib/planEngine');

const upload = makeUploader(
    (file) => file.fieldname === 'video' ? 'exercise-library/videos' : 'exercise-library/thumbnails',
    null,
    {
        maxSize: 5 * 1024 * 1024,
        fileFilter: (req, file, cb) => {
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
router.use((req, res, next) => {
    const action = req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('training', action)(req, res, next);
});

// --- Exercise Library Taxonomies ---
router.get('/muscle-groups', async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT emg.*, (SELECT COUNT(*)::int FROM exercise_library el WHERE el.workspace_id = emg.workspace_id AND el.muscle_group = emg.name_en) AS exercise_count
             FROM exercise_muscle_groups emg
             WHERE emg.workspace_id = $1
             ORDER BY emg.name_en ASC`,
            [req.user.workspaceId]
        );
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

router.post('/muscle-groups', async (req, res, next) => {
    try {
        const { name_en, name_ar } = req.body;
        const result = await pool.query(
            'INSERT INTO exercise_muscle_groups (workspace_id, name_en, name_ar) VALUES ($1, $2, $3) RETURNING *',
            [req.user.workspaceId, name_en, name_ar || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

router.put('/muscle-groups/:id', async (req, res, next) => {
    try {
        const oldRow = await pool.query('SELECT * FROM exercise_muscle_groups WHERE id = $1 AND workspace_id = $2', [req.params.id, req.user.workspaceId]);
        if (oldRow.rows.length === 0) return res.status(404).json({ error: 'Muscle group not found' });
        const oldNameEn = oldRow.rows[0].name_en;

        const { name_en, name_ar } = req.body;
        const result = await pool.query(
            'UPDATE exercise_muscle_groups SET name_en = $1, name_ar = $2 WHERE id = $3 AND workspace_id = $4 RETURNING *',
            [name_en, name_ar || null, req.params.id, req.user.workspaceId]
        );

        // keep exercise_library.muscle_group in sync with the English name
        await pool.query(
            'UPDATE exercise_library SET muscle_group = $1 WHERE workspace_id = $2 AND muscle_group = $3',
            [name_en, req.user.workspaceId, oldNameEn]
        );

        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

router.delete('/muscle-groups/:id', async (req, res, next) => {
    try {
        const result = await pool.query('DELETE FROM exercise_muscle_groups WHERE id = $1 AND workspace_id = $2 RETURNING *', [req.params.id, req.user.workspaceId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Muscle group not found' });
        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

router.get('/equipments', async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT ee.*, (SELECT COUNT(*)::int FROM exercise_library el WHERE el.workspace_id = ee.workspace_id AND el.equipment = ee.name_en) AS exercise_count
             FROM exercise_equipments ee
             WHERE ee.workspace_id = $1
             ORDER BY ee.name_en ASC`,
            [req.user.workspaceId]
        );
        res.json(result.rows);
    } catch (err) {
        next(err);
    }
});

router.post('/equipments', async (req, res, next) => {
    try {
        const { name_en, name_ar } = req.body;
        const result = await pool.query(
            'INSERT INTO exercise_equipments (workspace_id, name_en, name_ar) VALUES ($1, $2, $3) RETURNING *',
            [req.user.workspaceId, name_en, name_ar || null]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

router.put('/equipments/:id', async (req, res, next) => {
    try {
        const oldRow = await pool.query('SELECT * FROM exercise_equipments WHERE id = $1 AND workspace_id = $2', [req.params.id, req.user.workspaceId]);
        if (oldRow.rows.length === 0) return res.status(404).json({ error: 'Equipment not found' });
        const oldNameEn = oldRow.rows[0].name_en;

        const { name_en, name_ar } = req.body;
        const result = await pool.query(
            'UPDATE exercise_equipments SET name_en = $1, name_ar = $2 WHERE id = $3 AND workspace_id = $4 RETURNING *',
            [name_en, name_ar || null, req.params.id, req.user.workspaceId]
        );

        // keep exercise_library.equipment in sync with the English name
        await pool.query(
            'UPDATE exercise_library SET equipment = $1 WHERE workspace_id = $2 AND equipment = $3',
            [name_en, req.user.workspaceId, oldNameEn]
        );

        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

router.delete('/equipments/:id', async (req, res, next) => {
    try {
        const result = await pool.query('DELETE FROM exercise_equipments WHERE id = $1 AND workspace_id = $2 RETURNING *', [req.params.id, req.user.workspaceId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Equipment not found' });
        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

// --- Exercise Library ---
router.get('/exercise-library', async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT *
             FROM exercise_library
             WHERE workspace_id = $1
             ORDER BY created_at DESC`,
            [req.user.workspaceId]
        );
        res.json(result.rows.map((r) => ({
            ...r,
            video_path:     toPublicUrl(r.video_path),
            thumbnail_path: toPublicUrl(r.thumbnail_path),
            created_at:     toIsoDateOrNull(r.created_at),
            updated_at:     toIsoDateOrNull(r.updated_at),
        })));
    } catch (err) {
        next(err);
    }
});

router.post('/exercise-library', uploadLimiter, upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), async (req, res, next) => {
    try {
        const {
            name_en,
            name_ar,
            muscle_group,
            equipment,
            youtube_url,
            instructions_en,
            instructions_ar,
        } = req.body;

        if (!name_en || !name_en.trim()) {
            return res.status(400).json({ error: 'Exercise name (English) is required' });
        }

        const videoPath     = req.files?.video?.[0]?.key     ?? null;
        const thumbnailPath = req.files?.thumbnail?.[0]?.key ?? null;

        const result = await pool.query(
            `INSERT INTO exercise_library (workspace_id, name_en, name_ar, muscle_group, equipment, youtube_url, video_path, thumbnail_path, instructions_en, instructions_ar, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
             RETURNING *`,
            [req.user.workspaceId, name_en.trim(), name_ar || null, muscle_group || null, equipment || null, youtube_url || null, videoPath, thumbnailPath, instructions_en || null, instructions_ar || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

router.put('/exercise-library/:id', uploadLimiter, upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), async (req, res, next) => {
    try {
        const existing = await pool.query('SELECT * FROM exercise_library WHERE id = $1 AND workspace_id = $2', [req.params.id, req.user.workspaceId]);
        if (existing.rows.length === 0) return res.status(404).json({ error: 'Exercise not found' });
        const current = existing.rows[0];

        if (!req.body.name_en || !req.body.name_en.trim()) {
            return res.status(400).json({ error: 'Exercise name (English) is required' });
        }

        const newVideoFile  = req.files?.video?.[0];
        const newThumbFile  = req.files?.thumbnail?.[0];
        const videoPath     = newVideoFile ? newVideoFile.key     : current.video_path;
        const thumbnailPath = newThumbFile ? newThumbFile.key     : current.thumbnail_path;

        const result = await pool.query(
            `UPDATE exercise_library
             SET name_en = $1,
                 name_ar = $2,
                 muscle_group = $3,
                 equipment = $4,
                 youtube_url = $5,
                 video_path = $6,
                 thumbnail_path = $7,
                 instructions_en = $8,
                 instructions_ar = $9,
                 updated_at = NOW()
             WHERE id = $10 AND workspace_id = $11
             RETURNING *`,
            [
                req.body.name_en.trim(),
                req.body.name_ar || null,
                req.body.muscle_group || null,
                req.body.equipment || null,
                req.body.youtube_url || null,
                videoPath,
                thumbnailPath,
                req.body.instructions_en || null,
                req.body.instructions_ar || null,
                req.params.id,
                req.user.workspaceId,
            ]
        );

        // Delete replaced files from S3 (fire-and-forget)
        if (newVideoFile  && current.video_path)     deleteFile(current.video_path).catch(() => {});
        if (newThumbFile  && current.thumbnail_path) deleteFile(current.thumbnail_path).catch(() => {});

        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

router.delete('/exercise-library/:id', async (req, res, next) => {
    try {
        const result = await pool.query('DELETE FROM exercise_library WHERE id = $1 AND workspace_id = $2 RETURNING *', [req.params.id, req.user.workspaceId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Exercise not found' });
        const deleted = result.rows[0];
        deleteFile(deleted.video_path).catch(() => {});
        deleteFile(deleted.thumbnail_path).catch(() => {});
        res.json(deleted);
    } catch (err) {
        next(err);
    }
});

router.get('/plans/workspace-library', async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT
                tp.id,
                tp.name,
                tp.status,
                tp.created_at,
                tp.updated_at,
                tp.created_by,
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
            [req.user.workspaceId]
        );
        res.json(serializePlanRows(result.rows));
    } catch (err) {
        next(err);
    }
});

router.get('/plans', async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT tp.*,
                (SELECT COUNT(*) FROM training_days WHERE plan_id = tp.id)::int AS day_count
             FROM training_plans tp
             WHERE tp.workspace_id = $1 AND tp.client_id = $2
             ORDER BY tp.created_at DESC`,
            [req.user.workspaceId, req.query.clientId]
        );

        res.json(serializePlanRows(result.rows));
    } catch (err) {
        next(err);
    }
});

router.get('/plans/:id', async (req, res, next) => {
    try {
        const planResult = await pool.query(
            'SELECT * FROM training_plans WHERE id = $1 AND workspace_id = $2',
            [req.params.id, req.user.workspaceId]
        );

        if (planResult.rows.length === 0) {
            return res.status(404).json({ error: 'Training plan not found' });
        }

        const plan = planResult.rows[0];

        const daysResult = await pool.query(
            'SELECT * FROM training_days WHERE plan_id = $1 ORDER BY day_order ASC',
            [plan.id]
        );

        const days = await Promise.all(daysResult.rows.map(async (day) => {
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

            const exercises = await Promise.all(exercisesResult.rows.map(async (exercise) => {
                const setsResult = await pool.query(
                    'SELECT * FROM training_sets WHERE exercise_id = $1 ORDER BY set_order ASC',
                    [exercise.id]
                );
                const alternativesResult = await pool.query(
                    `SELECT tea.*, el.name_en AS name, el.name_ar, el.muscle_group, el.equipment, el.thumbnail_path, el.youtube_url, el.video_path
                     FROM training_exercise_alternatives tea
                     JOIN exercise_library el ON el.id = tea.exercise_library_id
                     WHERE tea.exercise_id = $1
                     ORDER BY tea.alt_order ASC`,
                    [exercise.id]
                );

                return {
                    ...exercise,
                    thumbnail_path: toPublicUrl(exercise.thumbnail_path),
                    video_path:     toPublicUrl(exercise.video_path),
                    sets: setsResult.rows,
                    alternatives: alternativesResult.rows.map(alt => ({
                        ...alt,
                        thumbnail_path: toPublicUrl(alt.thumbnail_path),
                        video_path:     toPublicUrl(alt.video_path),
                    })),
                };
            }));

            return {
                ...day,
                exercises,
            };
        }));

        res.json({
            ...serializePlanRow(plan),
            days,
            day_count: days.length,
        });
    } catch (err) {
        next(err);
    }
});

router.post('/plans/save-draft', async (req, res, next) => {
    const { clientId, plans = [], activePlanId = null } = req.body;

    try {
        await replaceClientPlansTransactional({
            pool,
            work: async (dbClient) => {
                await dbClient.query('DELETE FROM training_plans WHERE workspace_id = $1 AND client_id = $2', [req.user.workspaceId, clientId]);

                const planIdMap = new Map();

                for (const [planIndex, plan] of normalizeOrderedList(plans, 'plan_order').entries()) {
                    const createdAt = toIsoDateOrNull(plan.created_at) || new Date().toISOString();
                    const updatedAt = new Date().toISOString();

                    const insertedPlan = await dbClient.query(
                        `INSERT INTO training_plans (name, client_id, workspace_id, status, notes, created_at, updated_at, created_by, id)
                         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                         RETURNING *`,
                        [
                            plan.name || `Training Plan ${planIndex + 1}`,
                            clientId,
                            req.user.workspaceId,
                            plan.status === 'active' ? 'active' : 'inactive',
                            plan.notes ?? null,
                            createdAt,
                            updatedAt,
                            plan.created_by ?? req.user.id,
                            createId(),
                        ]
                    );

                    const dbPlan = insertedPlan.rows[0];
                    planIdMap.set(plan.id, dbPlan.id);

                    for (const day of normalizeOrderedList(plan.days, 'day_order')) {
                        const insertedDay = await dbClient.query(
                            `INSERT INTO training_days (plan_id, name, day_order, notes, id)
                             VALUES ($1, $2, $3, $4, $5)
                             RETURNING *`,
                            [dbPlan.id, day.name || `Day ${day.day_order}`, day.day_order, day.notes ?? null, createId()]
                        );

                        for (const exercise of normalizeOrderedList(day.exercises, 'exercise_order')) {
                            const insertedExercise = await dbClient.query(
                                `INSERT INTO training_exercises (day_id, name, exercise_order, exercise_library_id, equipment, notes, id)
                                 VALUES ($1, $2, $3, $4, $5, $6, $7)
                                 RETURNING *`,
                                [
                                    insertedDay.rows[0].id,
                                    exercise.name || `Exercise ${exercise.exercise_order}`,
                                    exercise.exercise_order,
                                    exercise.exercise_library_id || null,
                                    exercise.equipment ?? null,
                                    exercise.notes ?? null,
                                    createId(),
                                ]
                            );

                            for (const set of normalizeOrderedList(exercise.sets, 'set_order')) {
                                await dbClient.query(
                                    `INSERT INTO training_sets (exercise_id, set_order, reps, rest_seconds, tempo, rir, id)
                                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                                    [
                                        insertedExercise.rows[0].id,
                                        set.set_order,
                                        set.reps ?? null,
                                        Number.isFinite(Number(set.rest_seconds)) ? Number(set.rest_seconds) : null,
                                        set.tempo ?? null,
                                        Number.isFinite(Number(set.rir)) ? Number(set.rir) : null,
                                        createId(),
                                    ]
                                );
                            }

                            for (const alt of normalizeOrderedList(exercise.alternatives, 'alt_order')) {
                                if (!alt.exercise_library_id) continue;
                                await dbClient.query(
                                    `INSERT INTO training_exercise_alternatives (exercise_id, exercise_library_id, alt_order, id)
                                     VALUES ($1, $2, $3, $4)`,
                                    [insertedExercise.rows[0].id, alt.exercise_library_id, alt.alt_order, createId()]
                                );
                            }
                        }
                    }
                }

                const resolvedActivePlanId = planIdMap.get(activePlanId) || null;
                if (resolvedActivePlanId) {
                    await dbClient.query(
                        `UPDATE training_plans
                         SET status = CASE WHEN id = $1 THEN 'active' ELSE 'inactive' END,
                             updated_at = NOW()
                         WHERE workspace_id = $2
                           AND client_id = $3`,
                        [resolvedActivePlanId, req.user.workspaceId, clientId]
                    );
                }
            },
        });

        const summary = await pool.query(
            `SELECT tp.*,
                (SELECT COUNT(*) FROM training_days WHERE plan_id = tp.id)::int AS day_count
             FROM training_plans tp
             WHERE tp.workspace_id = $1
               AND tp.client_id = $2
             ORDER BY tp.created_at DESC`,
            [req.user.workspaceId, clientId]
        );

        res.json({ plans: serializePlanRows(summary.rows) });
    } catch (err) {
        next(err);
    }
});

router.post('/plans/save-plan-draft', async (req, res, next) => {
    const { clientId, plan, activePlanId = null } = req.body;

    try {
        let existingCreatedBy = null;

        const result = await saveSinglePlanDraft({
            pool,
            plan,
            clientId,
            coachId: req.user.workspaceId,
            activePlanId,
            loadExistingPlan: async ({ dbClient, planId, clientId: cId, coachId }) => {
                const existing = await dbClient.query(
                    `SELECT id, created_at, created_by
                     FROM training_plans
                     WHERE id = $1 AND workspace_id = $2 AND client_id = $3`,
                    [planId, coachId, cId]
                );
                existingCreatedBy = existing.rows[0]?.created_by ?? null;
                return existing.rows[0] ?? null;
            },
            deleteExistingPlanTree: async ({ dbClient, planId }) => {
                await dbClient.query('DELETE FROM training_plans WHERE id = $1', [planId]);
            },
            insertPlanTree: async ({ dbClient, plan: incomingPlan, clientId: cId, coachId, createdAt, updatedAt }) => {
                const createdBy = existingCreatedBy ?? req.user.id;
                const insertedPlan = await dbClient.query(
                    `INSERT INTO training_plans (name, client_id, workspace_id, status, notes, created_at, updated_at, created_by, id)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                     RETURNING *`,
                    [
                        incomingPlan.name || 'Untitled Training Plan',
                        cId,
                        coachId,
                        incomingPlan.status === 'active' ? 'active' : 'inactive',
                        incomingPlan.notes ?? null,
                        createdAt,
                        updatedAt,
                        createdBy,
                        createId(),
                    ]
                );

                const newPlan = insertedPlan.rows[0];

                await insertOrderedChildren({
                    items: incomingPlan.days,
                    orderKey: 'day_order',
                    insert: async (day) => {
                        const insertedDay = await dbClient.query(
                            `INSERT INTO training_days (plan_id, name, day_order, notes, id)
                             VALUES ($1, $2, $3, $4, $5)
                             RETURNING *`,
                            [newPlan.id, day.name || `Day ${day.day_order}`, day.day_order, day.notes ?? null, createId()]
                        );

                        await insertOrderedChildren({
                            items: day.exercises,
                            orderKey: 'exercise_order',
                            insert: async (exercise) => {
                                const insertedExercise = await dbClient.query(
                                    `INSERT INTO training_exercises (day_id, name, exercise_order, exercise_library_id, equipment, notes, id)
                                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                                     RETURNING *`,
                                    [
                                        insertedDay.rows[0].id,
                                        exercise.name || `Exercise ${exercise.exercise_order}`,
                                        exercise.exercise_order,
                                        exercise.exercise_library_id || null,
                                        exercise.equipment ?? null,
                                        exercise.notes ?? null,
                                        createId(),
                                    ]
                                );

                                await insertOrderedChildren({
                                    items: exercise.sets,
                                    orderKey: 'set_order',
                                    insert: async (set) => {
                                        await dbClient.query(
                                            `INSERT INTO training_sets (exercise_id, set_order, reps, rest_seconds, tempo, rir, id)
                                             VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                                            [
                                                insertedExercise.rows[0].id,
                                                set.set_order,
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
                                    items: exercise.alternatives,
                                    orderKey: 'alt_order',
                                    insert: async (alt) => {
                                        if (!alt.exercise_library_id) return alt;
                                        await dbClient.query(
                                            `INSERT INTO training_exercise_alternatives (exercise_id, exercise_library_id, alt_order, id)
                                             VALUES ($1, $2, $3, $4)`,
                                            [insertedExercise.rows[0].id, alt.exercise_library_id, alt.alt_order, createId()]
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
            activatePlanInTransaction: async ({ dbClient, planId, clientId: cId, coachId }) => {
                await dbClient.query(
                    `UPDATE training_plans
                     SET status = CASE WHEN id = $1 THEN 'active' ELSE 'inactive' END,
                         updated_at = NOW()
                     WHERE workspace_id = $2
                       AND client_id = $3`,
                    [planId, coachId, cId]
                );
            },
            fetchSavedPlan: async ({ planId, coachId }) => {
                const savedPlanResult = await pool.query(
                    `SELECT tp.*,
                            (SELECT COUNT(*) FROM training_days WHERE plan_id = tp.id)::int AS day_count
                     FROM training_plans tp
                     WHERE tp.id = $1 AND tp.workspace_id = $2`,
                    [planId, coachId]
                );
                return savedPlanResult.rows[0] ?? null;
            },
        });

        res.json(result);
    } catch (err) {
        next(err);
    }
});

router.post('/plans/:id/activate', async (req, res, next) => {
    const planId = Number(req.params.id);
    if (!Number.isInteger(planId) || planId <= 0) {
        return res.status(400).json({ error: 'Plan must be saved before it can be activated' });
    }
    try {
        const updatedPlan = await activateSinglePlan({
            pool,
            tableName: 'training_plans',
            planId,
            coachId: req.user.workspaceId,
            clientIdColumn: 'client_id',
        });

        if (!updatedPlan) {
            return res.status(404).json({ error: 'Plan not found' });
        }

        res.json(updatedPlan);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
