const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const router = express.Router();

const pool = require('../db');
const authMiddleware = require('../middleware/auth');
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

async function ensureTrainingSchema() {
    if (!trainingSchemaReadyPromise) {
        trainingSchemaReadyPromise = (async () => {
            await pool.query(`
                CREATE TABLE IF NOT EXISTS training_plans (
                    id SERIAL PRIMARY KEY,
                    name TEXT NOT NULL,
                    client_id INTEGER NOT NULL,
                    coach_id INTEGER NOT NULL,
                    status TEXT NOT NULL DEFAULT 'inactive',
                    notes TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT training_plans_status_check CHECK (status IN ('active', 'inactive'))
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS training_days (
                    id SERIAL PRIMARY KEY,
                    plan_id INTEGER NOT NULL REFERENCES training_plans(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    day_order INTEGER NOT NULL,
                    notes TEXT
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS exercise_muscle_groups (
                    id SERIAL PRIMARY KEY,
                    coach_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    UNIQUE (coach_id, name)
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS exercise_equipments (
                    id SERIAL PRIMARY KEY,
                    coach_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    UNIQUE (coach_id, name)
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS exercise_library (
                    id SERIAL PRIMARY KEY,
                    coach_id INTEGER NOT NULL,
                    name TEXT NOT NULL,
                    muscle_group TEXT,
                    equipment TEXT,
                    youtube_url TEXT,
                    video_path TEXT,
                    thumbnail_path TEXT,
                    instructions TEXT,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS training_exercises (
                    id SERIAL PRIMARY KEY,
                    day_id INTEGER NOT NULL REFERENCES training_days(id) ON DELETE CASCADE,
                    name TEXT NOT NULL,
                    exercise_order INTEGER NOT NULL,
                    exercise_library_id INTEGER REFERENCES exercise_library(id) ON DELETE SET NULL,
                    equipment TEXT,
                    notes TEXT
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS training_sets (
                    id SERIAL PRIMARY KEY,
                    exercise_id INTEGER NOT NULL REFERENCES training_exercises(id) ON DELETE CASCADE,
                    set_order INTEGER NOT NULL,
                    reps TEXT,
                    rest_seconds INTEGER,
                    tempo TEXT,
                    rir INTEGER
                )
            `);

            await pool.query(`
                CREATE TABLE IF NOT EXISTS training_exercise_alternatives (
                    id SERIAL PRIMARY KEY,
                    exercise_id INTEGER NOT NULL REFERENCES training_exercises(id) ON DELETE CASCADE,
                    exercise_library_id INTEGER NOT NULL REFERENCES exercise_library(id) ON DELETE CASCADE,
                    alt_order INTEGER NOT NULL
                )
            `);

            // Indexes for common lookups
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_training_plans_coach_client ON training_plans (coach_id, client_id)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_training_plans_client ON training_plans (client_id)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_training_days_plan ON training_days (plan_id)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_training_exercises_day ON training_exercises (day_id)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_training_sets_exercise ON training_sets (exercise_id)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_training_alternatives_exercise ON training_exercise_alternatives (exercise_id)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_exercise_library_coach ON exercise_library (coach_id)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_exercise_muscle_groups_coach ON exercise_muscle_groups (coach_id)`);
            await pool.query(`CREATE INDEX IF NOT EXISTS idx_exercise_equipments_coach ON exercise_equipments (coach_id)`);
        })();
    }

    await trainingSchemaReadyPromise;
}

router.use(authMiddleware);
router.use(async (req, res, next) => {
    try {
        await ensureTrainingSchema();
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to initialize training schema' });
    }
});

// --- Exercise Library Taxonomies ---
router.get('/muscle-groups', async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT emg.*, (SELECT COUNT(*)::int FROM exercise_library el WHERE el.coach_id = emg.coach_id AND el.muscle_group = emg.name) AS exercise_count
             FROM exercise_muscle_groups emg
             WHERE emg.coach_id = $1
             ORDER BY emg.name ASC`,
            [req.user.id]
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
            'INSERT INTO exercise_muscle_groups (coach_id, name) VALUES ($1, $2) RETURNING *',
            [req.user.id, name]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/muscle-groups/:id', async (req, res) => {
    try {
        const oldRow = await pool.query('SELECT * FROM exercise_muscle_groups WHERE id = $1 AND coach_id = $2', [req.params.id, req.user.id]);
        if (oldRow.rows.length === 0) return res.status(404).json({ error: 'Muscle group not found' });
        const oldName = oldRow.rows[0].name;

        const result = await pool.query(
            'UPDATE exercise_muscle_groups SET name = $1 WHERE id = $2 AND coach_id = $3 RETURNING *',
            [req.body.name, req.params.id, req.user.id]
        );

        await pool.query(
            'UPDATE exercise_library SET muscle_group = $1 WHERE coach_id = $2 AND muscle_group = $3',
            [req.body.name, req.user.id, oldName]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/muscle-groups/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM exercise_muscle_groups WHERE id = $1 AND coach_id = $2 RETURNING *', [req.params.id, req.user.id]);
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
            `SELECT ee.*, (SELECT COUNT(*)::int FROM exercise_library el WHERE el.coach_id = ee.coach_id AND el.equipment = ee.name) AS exercise_count
             FROM exercise_equipments ee
             WHERE ee.coach_id = $1
             ORDER BY ee.name ASC`,
            [req.user.id]
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
            'INSERT INTO exercise_equipments (coach_id, name) VALUES ($1, $2) RETURNING *',
            [req.user.id, name]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/equipments/:id', async (req, res) => {
    try {
        const oldRow = await pool.query('SELECT * FROM exercise_equipments WHERE id = $1 AND coach_id = $2', [req.params.id, req.user.id]);
        if (oldRow.rows.length === 0) return res.status(404).json({ error: 'Equipment not found' });
        const oldName = oldRow.rows[0].name;

        const result = await pool.query(
            'UPDATE exercise_equipments SET name = $1 WHERE id = $2 AND coach_id = $3 RETURNING *',
            [req.body.name, req.params.id, req.user.id]
        );

        await pool.query(
            'UPDATE exercise_library SET equipment = $1 WHERE coach_id = $2 AND equipment = $3',
            [req.body.name, req.user.id, oldName]
        );

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/equipments/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM exercise_equipments WHERE id = $1 AND coach_id = $2 RETURNING *', [req.params.id, req.user.id]);
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
             WHERE coach_id = $1
             ORDER BY created_at DESC`,
            [req.user.id]
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

        const videoPath = req.files?.video?.[0] ? `/uploads/exercise-library/videos/${path.basename(req.files.video[0].path)}` : null;
        const thumbnailPath = req.files?.thumbnail?.[0] ? `/uploads/exercise-library/thumbnails/${path.basename(req.files.thumbnail[0].path)}` : null;

        const result = await pool.query(
            `INSERT INTO exercise_library (coach_id, name, muscle_group, equipment, youtube_url, video_path, thumbnail_path, instructions, created_at, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())
             RETURNING *`,
            [req.user.id, name, muscle_group || null, equipment || null, youtube_url || null, videoPath, thumbnailPath, instructions || null]
        );

        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.put('/exercise-library/:id', upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]), async (req, res) => {
    try {
        const existing = await pool.query('SELECT * FROM exercise_library WHERE id = $1 AND coach_id = $2', [req.params.id, req.user.id]);
        if (existing.rows.length === 0) return res.status(404).json({ error: 'Exercise not found' });
        const current = existing.rows[0];

        const videoPath = req.files?.video?.[0] ? `/uploads/exercise-library/videos/${path.basename(req.files.video[0].path)}` : current.video_path;
        const thumbnailPath = req.files?.thumbnail?.[0] ? `/uploads/exercise-library/thumbnails/${path.basename(req.files.thumbnail[0].path)}` : current.thumbnail_path;

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
             WHERE id = $8 AND coach_id = $9
             RETURNING *`,
            [
                req.body.name,
                req.body.muscle_group || null,
                req.body.equipment || null,
                req.body.youtube_url || null,
                videoPath,
                thumbnailPath,
                req.body.instructions || null,
                req.params.id,
                req.user.id,
            ]
        );
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.delete('/exercise-library/:id', async (req, res) => {
    try {
        const result = await pool.query('DELETE FROM exercise_library WHERE id = $1 AND coach_id = $2 RETURNING *', [req.params.id, req.user.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Exercise not found' });
        res.json(result.rows[0]);
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
             WHERE tp.coach_id = $1 AND tp.client_id = $2
             ORDER BY tp.created_at DESC`,
            [req.user.id, req.query.clientId]
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
            'SELECT * FROM training_plans WHERE id = $1 AND coach_id = $2',
            [req.params.id, req.user.id]
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
                'SELECT * FROM training_exercises WHERE day_id = $1 ORDER BY exercise_order ASC',
                [day.id]
            );

            const exercises = await Promise.all(exercisesResult.rows.map(async (exercise) => {
                const setsResult = await pool.query(
                    'SELECT * FROM training_sets WHERE exercise_id = $1 ORDER BY set_order ASC',
                    [exercise.id]
                );
                const alternativesResult = await pool.query(
                    `SELECT tea.*, el.name, el.muscle_group, el.equipment, el.thumbnail_path
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
                await dbClient.query('DELETE FROM training_plans WHERE coach_id = $1 AND client_id = $2', [req.user.id, clientId]);

                const planIdMap = new Map();

                for (const [planIndex, plan] of normalizeOrderedList(plans, 'plan_order').entries()) {
                    const createdAt = toIsoDateOrNull(plan.created_at) || new Date().toISOString();
                    const updatedAt = new Date().toISOString();

                    const insertedPlan = await dbClient.query(
                        `INSERT INTO training_plans (name, client_id, coach_id, status, notes, created_at, updated_at)
                         VALUES ($1, $2, $3, $4, $5, $6, $7)
                         RETURNING *`,
                        [
                            plan.name || `Training Plan ${planIndex + 1}`,
                            clientId,
                            req.user.id,
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
                         WHERE coach_id = $2
                           AND client_id = $3`,
                        [resolvedActivePlanId, req.user.id, clientId]
                    );
                }
            },
        });

        const summary = await pool.query(
            `SELECT tp.*,
                (SELECT COUNT(*) FROM training_days WHERE plan_id = tp.id)::int AS day_count
             FROM training_plans tp
             WHERE tp.coach_id = $1
               AND tp.client_id = $2
             ORDER BY tp.created_at DESC`,
            [req.user.id, clientId]
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
            coachId: req.user.id,
            activePlanId,
            loadExistingPlan: async ({ dbClient, planId, clientId: cId, coachId }) => {
                const existing = await dbClient.query(
                    `SELECT id, created_at
                     FROM training_plans
                     WHERE id = $1 AND coach_id = $2 AND client_id = $3`,
                    [planId, coachId, cId]
                );
                return existing.rows[0] ?? null;
            },
            deleteExistingPlanTree: async ({ dbClient, planId }) => {
                await dbClient.query('DELETE FROM training_plans WHERE id = $1', [planId]);
            },
            insertPlanTree: async ({ dbClient, plan: incomingPlan, clientId: cId, coachId, createdAt, updatedAt }) => {
                const insertedPlan = await dbClient.query(
                    `INSERT INTO training_plans (name, client_id, coach_id, status, notes, created_at, updated_at)
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
                     WHERE coach_id = $2
                       AND client_id = $3`,
                    [planId, coachId, cId]
                );
            },
            fetchSavedPlan: async ({ planId, coachId }) => {
                const savedPlanResult = await pool.query(
                    `SELECT tp.*,
                            (SELECT COUNT(*) FROM training_days WHERE plan_id = tp.id)::int AS day_count
                     FROM training_plans tp
                     WHERE tp.id = $1 AND tp.coach_id = $2`,
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
            coachId: req.user.id,
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
