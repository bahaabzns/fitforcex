const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = express.Router();

const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
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

let trainingSchemaReadyPromise;

function deleteUploadedFile(relativePath) {
    if (!relativePath) return;
    try {
        const abs = path.join(__dirname, '..', relativePath);
        if (fs.existsSync(abs)) fs.unlinkSync(abs);
    } catch (e) {
        console.error('Failed to delete upload:', relativePath, e.message);
    }
}

const uploadRoot = path.join(__dirname, '..', 'uploads', 'exercise-library');
const videoDir = path.join(uploadRoot, 'videos');
const thumbDir = path.join(uploadRoot, 'thumbnails');
fs.mkdirSync(videoDir, { recursive: true });
fs.mkdirSync(thumbDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        if (file.fieldname === 'video') return cb(null, videoDir);
        if (file.fieldname === 'thumbnail') return cb(null, thumbDir);
        cb(null, uploadRoot);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname || '').toLowerCase();
        cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
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
});


router.use(authMiddleware);
router.use((req, res, next) => {
    const action = req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('training', action)(req, res, next);
});

// --- Exercise Library Taxonomies ---
router.get('/muscle-groups', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT emg.*, (SELECT COUNT(*)::int FROM exercise_library el WHERE el.workspace_id = emg.workspace_id AND el.muscle_group = emg.name) AS exercise_count
             FROM exercise_muscle_groups emg
             WHERE emg.workspace_id = $1
             ORDER BY emg.name ASC`,
            [req.user.workspaceId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/muscle-groups', async (req, res) => {
    try {
        const { name } = req.body;
        const result = await pool.query(
            'INSERT INTO exercise_muscle_groups (workspace_id, name) VALUES ($1, $2) RETURNING *',
            [req.user.workspaceId, name]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/muscle-groups/:id', async (req, res) => {
    try {
        const oldRow = await pool.query('SELECT * FROM exercise_muscle_groups WHERE id = $1 AND workspace_id = $2', [req.params.id, req.user.workspaceId]);
        if (oldRow.rows.length === 0) return res.status(404).json({ error: 'Muscle group not found' });
        const oldName = oldRow.rows[0].name;

        const result = await pool.query(
            'UPDATE exercise_muscle_groups SET name = $1 WHERE id = $2 AND workspace_id = $3 RETURNING *',
            [req.body.name, req.params.id, req.user.workspaceId]
        );

        await pool.query(
            'UPDATE exercise_library SET muscle_group = $1 WHERE workspace_id = $2 AND muscle_group = $3',
            [req.body.name, req.user.workspaceId, oldName]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/muscle-groups/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM exercise_muscle_groups WHERE id = $1 AND workspace_id = $2 RETURNING *', [req.params.id, req.user.workspaceId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Muscle group not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/equipments', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT ee.*, (SELECT COUNT(*)::int FROM exercise_library el WHERE el.workspace_id = ee.workspace_id AND el.equipment = ee.name) AS exercise_count
             FROM exercise_equipments ee
             WHERE ee.workspace_id = $1
             ORDER BY ee.name ASC`,
            [req.user.workspaceId]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/equipments', async (req, res) => {
    try {
        const { name } = req.body;
        const result = await pool.query(
            'INSERT INTO exercise_equipments (workspace_id, name) VALUES ($1, $2) RETURNING *',
            [req.user.workspaceId, name]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/equipments/:id', async (req, res) => {
    try {
        const oldRow = await pool.query('SELECT * FROM exercise_equipments WHERE id = $1 AND workspace_id = $2', [req.params.id, req.user.workspaceId]);
        if (oldRow.rows.length === 0) return res.status(404).json({ error: 'Equipment not found' });
        const oldName = oldRow.rows[0].name;

        const result = await pool.query(
            'UPDATE exercise_equipments SET name = $1 WHERE id = $2 AND workspace_id = $3 RETURNING *',
            [req.body.name, req.params.id, req.user.workspaceId]
        );

        await pool.query(
            'UPDATE exercise_library SET equipment = $1 WHERE workspace_id = $2 AND equipment = $3',
            [req.body.name, req.user.workspaceId, oldName]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/equipments/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM exercise_equipments WHERE id = $1 AND workspace_id = $2 RETURNING *', [req.params.id, req.user.workspaceId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Equipment not found' });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// --- Exercise Library ---
router.get('/exercise-library', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT *
             FROM exercise_library
             WHERE workspace_id = $1
             ORDER BY created_at DESC`,
            [req.user.workspaceId]
        );
        res.json(result.rows.map((r) => ({ ...r, created_at: toIsoDateOrNull(r.created_at), updated_at: toIsoDateOrNull(r.updated_at) })));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/exercise-library', upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), async (req, res) => {
    try {
        const {
            name,
            muscle_group,
            equipment,
            youtube_url,
            instructions,
        } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({ error: 'Exercise name is required' });
        }

        const videoPath = req.files?.video?.[0] ? `/uploads/exercise-library/videos/${path.basename(req.files.video[0].path)}` : null;
        const thumbnailPath = req.files?.thumbnail?.[0] ? `/uploads/exercise-library/thumbnails/${path.basename(req.files.thumbnail[0].path)}` : null;

        const result = await pool.query(
            `INSERT INTO exercise_library (workspace_id, name, muscle_group, equipment, youtube_url, video_path, thumbnail_path, instructions, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
             RETURNING *`,
            [req.user.workspaceId, name.trim(), muscle_group || null, equipment || null, youtube_url || null, videoPath, thumbnailPath, instructions || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/exercise-library/:id', upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), async (req, res) => {
    try {
        const existing = await pool.query('SELECT * FROM exercise_library WHERE id = $1 AND workspace_id = $2', [req.params.id, req.user.workspaceId]);
        if (existing.rows.length === 0) return res.status(404).json({ error: 'Exercise not found' });
        const current = existing.rows[0];

        if (!req.body.name || !req.body.name.trim()) {
            return res.status(400).json({ error: 'Exercise name is required' });
        }

        const newVideoFile = req.files?.video?.[0];
        const newThumbFile = req.files?.thumbnail?.[0];
        const videoPath = newVideoFile ? `/uploads/exercise-library/videos/${path.basename(newVideoFile.path)}` : current.video_path;
        const thumbnailPath = newThumbFile ? `/uploads/exercise-library/thumbnails/${path.basename(newThumbFile.path)}` : current.thumbnail_path;

        const result = await pool.query(
            `UPDATE exercise_library
             SET name = $1,
                 muscle_group = $2,
                 equipment = $3,
                 youtube_url = $4,
                 video_path = $5,
                 thumbnail_path = $6,
                 instructions = $7,
                 updated_at = NOW()
             WHERE id = $8 AND workspace_id = $9
             RETURNING *`,
            [
                req.body.name.trim(),
                req.body.muscle_group || null,
                req.body.equipment || null,
                req.body.youtube_url || null,
                videoPath,
                thumbnailPath,
                req.body.instructions || null,
                req.params.id,
                req.user.workspaceId,
            ]
        );

        // Delete replaced files
        if (newVideoFile && current.video_path) deleteUploadedFile(current.video_path);
        if (newThumbFile && current.thumbnail_path) deleteUploadedFile(current.thumbnail_path);

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/exercise-library/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM exercise_library WHERE id = $1 AND workspace_id = $2 RETURNING *', [req.params.id, req.user.workspaceId]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Exercise not found' });
        const deleted = result.rows[0];
        deleteUploadedFile(deleted.video_path);
        deleteUploadedFile(deleted.thumbnail_path);
        res.json(deleted);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/plans', async (req, res) => {
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
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/plans/:id', async (req, res) => {
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
                        el.thumbnail_path, el.video_path, el.youtube_url, el.muscle_group, el.instructions
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
                    `SELECT tea.*, el.name, el.muscle_group, el.equipment, el.thumbnail_path, el.youtube_url, el.video_path
                     FROM training_exercise_alternatives tea
                     JOIN exercise_library el ON el.id = tea.exercise_library_id
                     WHERE tea.exercise_id = $1
                     ORDER BY tea.alt_order ASC`,
                    [exercise.id]
                );

                return {
                    ...exercise,
                    sets: setsResult.rows,
                    alternatives: alternativesResult.rows,
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
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/plans/save-draft', async (req, res) => {
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
                        `INSERT INTO training_plans (name, client_id, workspace_id, status, notes, created_at, updated_at)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)
                         RETURNING *`,
                        [
                            plan.name || `Training Plan ${planIndex + 1}`,
                            clientId,
                            req.user.workspaceId,
                            plan.status === 'active' ? 'active' : 'inactive',
                            plan.notes ?? null,
                            createdAt,
                            updatedAt,
                        ]
                    );

                    const dbPlan = insertedPlan.rows[0];
                    planIdMap.set(plan.id, dbPlan.id);

                    for (const day of normalizeOrderedList(plan.days, 'day_order')) {
                        const insertedDay = await dbClient.query(
                            `INSERT INTO training_days (plan_id, name, day_order, notes)
                             VALUES ($1, $2, $3, $4)
                             RETURNING *`,
                            [dbPlan.id, day.name || `Day ${day.day_order}`, day.day_order, day.notes ?? null]
                        );

                        for (const exercise of normalizeOrderedList(day.exercises, 'exercise_order')) {
                            const insertedExercise = await dbClient.query(
                                `INSERT INTO training_exercises (day_id, name, exercise_order, exercise_library_id, equipment, notes)
                                 VALUES ($1, $2, $3, $4, $5, $6)
                                 RETURNING *`,
                                [
                                    insertedDay.rows[0].id,
                                    exercise.name || `Exercise ${exercise.exercise_order}`,
                                    exercise.exercise_order,
                                    exercise.exercise_library_id || null,
                                    exercise.equipment ?? null,
                                    exercise.notes ?? null,
                                ]
                            );

                            for (const set of normalizeOrderedList(exercise.sets, 'set_order')) {
                                await dbClient.query(
                                    `INSERT INTO training_sets (exercise_id, set_order, reps, rest_seconds, tempo, rir)
                                     VALUES ($1, $2, $3, $4, $5, $6)`,
                                    [
                                        insertedExercise.rows[0].id,
                                        set.set_order,
                                        set.reps ?? null,
                                        Number.isFinite(Number(set.rest_seconds)) ? Number(set.rest_seconds) : null,
                                        set.tempo ?? null,
                                        Number.isFinite(Number(set.rir)) ? Number(set.rir) : null,
                                    ]
                                );
                            }

                            for (const alt of normalizeOrderedList(exercise.alternatives, 'alt_order')) {
                                if (!alt.exercise_library_id) continue;
                                await dbClient.query(
                                    `INSERT INTO training_exercise_alternatives (exercise_id, exercise_library_id, alt_order)
                                     VALUES ($1, $2, $3)`,
                                    [insertedExercise.rows[0].id, alt.exercise_library_id, alt.alt_order]
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
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/plans/save-plan-draft', async (req, res) => {
    const { clientId, plan, activePlanId = null } = req.body;

    try {
        const result = await saveSinglePlanDraft({
            pool,
            plan,
            clientId,
            coachId: req.user.workspaceId,
            activePlanId,
            loadExistingPlan: async ({ dbClient, planId, clientId: cId, coachId }) => {
                const existing = await dbClient.query(
                    `SELECT id, created_at
                     FROM training_plans
                     WHERE id = $1 AND workspace_id = $2 AND client_id = $3`,
                    [planId, coachId, cId]
                );
                return existing.rows[0] ?? null;
            },
            deleteExistingPlanTree: async ({ dbClient, planId }) => {
                await dbClient.query('DELETE FROM training_plans WHERE id = $1', [planId]);
            },
            insertPlanTree: async ({ dbClient, plan: incomingPlan, clientId: cId, coachId, createdAt, updatedAt }) => {
                const insertedPlan = await dbClient.query(
                    `INSERT INTO training_plans (name, client_id, workspace_id, status, notes, created_at, updated_at)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)
                     RETURNING *`,
                    [
                        incomingPlan.name || 'Untitled Training Plan',
                        cId,
                        coachId,
                        incomingPlan.status === 'active' ? 'active' : 'inactive',
                        incomingPlan.notes ?? null,
                        createdAt,
                        updatedAt,
                    ]
                );

                const newPlan = insertedPlan.rows[0];

                await insertOrderedChildren({
                    items: incomingPlan.days,
                    orderKey: 'day_order',
                    insert: async (day) => {
                        const insertedDay = await dbClient.query(
                            `INSERT INTO training_days (plan_id, name, day_order, notes)
                             VALUES ($1, $2, $3, $4)
                             RETURNING *`,
                            [newPlan.id, day.name || `Day ${day.day_order}`, day.day_order, day.notes ?? null]
                        );

                        await insertOrderedChildren({
                            items: day.exercises,
                            orderKey: 'exercise_order',
                            insert: async (exercise) => {
                                const insertedExercise = await dbClient.query(
                                    `INSERT INTO training_exercises (day_id, name, exercise_order, exercise_library_id, equipment, notes)
                                     VALUES ($1, $2, $3, $4, $5, $6)
                                     RETURNING *`,
                                    [
                                        insertedDay.rows[0].id,
                                        exercise.name || `Exercise ${exercise.exercise_order}`,
                                        exercise.exercise_order,
                                        exercise.exercise_library_id || null,
                                        exercise.equipment ?? null,
                                        exercise.notes ?? null,
                                    ]
                                );

                                await insertOrderedChildren({
                                    items: exercise.sets,
                                    orderKey: 'set_order',
                                    insert: async (set) => {
                                        await dbClient.query(
                                            `INSERT INTO training_sets (exercise_id, set_order, reps, rest_seconds, tempo, rir)
                                             VALUES ($1, $2, $3, $4, $5, $6)`,
                                            [
                                                insertedExercise.rows[0].id,
                                                set.set_order,
                                                set.reps ?? null,
                                                Number.isFinite(Number(set.rest_seconds)) ? Number(set.rest_seconds) : null,
                                                set.tempo ?? null,
                                                Number.isFinite(Number(set.rir)) ? Number(set.rir) : null,
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
                                            `INSERT INTO training_exercise_alternatives (exercise_id, exercise_library_id, alt_order)
                                             VALUES ($1, $2, $3)`,
                                            [insertedExercise.rows[0].id, alt.exercise_library_id, alt.alt_order]
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
        console.error(err);
        res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
    }
});

router.post('/plans/:id/activate', async (req, res) => {
    try {
        const updatedPlan = await activateSinglePlan({
            pool,
            tableName: 'training_plans',
            planId: req.params.id,
            coachId: req.user.workspaceId,
            clientIdColumn: 'client_id',
        });

        if (!updatedPlan) {
            return res.status(404).json({ error: 'Plan not found' });
        }

        res.json(updatedPlan);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
