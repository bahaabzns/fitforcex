import { makeUploader, toPublicUrl } from '../../lib/storage';
import { serializePlanRow } from '../../lib/planEngine';
import pool from '../../db';

export type FileBag = { [fieldname: string]: Express.MulterS3.File[] };

type Row = Record<string, unknown>;

/**
 * Fetches a training plan with its full days -> exercises -> sets(+alternatives)
 * tree, scoped to a workspace. Shared by the JSON plan-detail endpoint and the
 * PDF export controller so both always render the exact same data — extracted
 * out of training.controller.ts's getPlan rather than duplicated.
 */
export async function fetchFullTrainingPlan(planId: string, workspaceId: string) {
    const planResult = await pool.query(
        'SELECT * FROM training_plans WHERE id = $1 AND workspace_id = $2',
        [planId, workspaceId]
    );
    if (!planResult.rows.length) return null;

    const plan = planResult.rows[0] as Row;

    const daysResult = await pool.query(
        'SELECT * FROM training_days WHERE plan_id = $1 ORDER BY day_order ASC',
        [plan.id]
    );

    const days = await Promise.all((daysResult.rows as Row[]).map(async (day) => {
        const exercisesResult = await pool.query(
            `SELECT te.*,
                    el.thumbnail_path, el.video_path, el.youtube_url, el.muscle_group, emg.name_ar AS muscle_group_ar,
                    el.instructions_en AS instructions, el.instructions_ar,
                    el.name_en AS library_name_en, el.name_ar AS library_name_ar,
                    el.tracking_type, el.tracked_metrics, ee.name_ar AS equipment_ar
             FROM training_exercises te
             LEFT JOIN exercise_library el ON el.id = te.exercise_library_id
             LEFT JOIN exercise_muscle_groups emg ON emg.workspace_id = $2 AND emg.name_en = el.muscle_group
             LEFT JOIN exercise_equipments ee ON ee.workspace_id = $2 AND ee.name_en = te.equipment
             WHERE te.day_id = $1 ORDER BY te.exercise_order ASC`,
            [day.id, workspaceId]
        );

        const exercises = await Promise.all((exercisesResult.rows as Row[]).map(async (exercise) => {
            const [setsResult, alternativesResult] = await Promise.all([
                pool.query('SELECT * FROM training_sets WHERE exercise_id = $1 ORDER BY set_order ASC', [exercise.id]),
                pool.query(
                    `SELECT tea.*, el.name_en AS name, el.name_ar, el.muscle_group, emg.name_ar AS muscle_group_ar,
                            el.equipment, ee.name_ar AS equipment_ar, el.thumbnail_path, el.youtube_url, el.video_path
                     FROM training_exercise_alternatives tea
                     JOIN exercise_library el ON el.id = tea.exercise_library_id
                     LEFT JOIN exercise_muscle_groups emg ON emg.workspace_id = $2 AND emg.name_en = el.muscle_group
                     LEFT JOIN exercise_equipments ee ON ee.workspace_id = $2 AND ee.name_en = el.equipment
                     WHERE tea.exercise_id = $1 ORDER BY tea.alt_order ASC`,
                    [exercise.id, workspaceId]
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

    return { ...serializePlanRow(plan), days, day_count: days.length };
}

export const upload = makeUploader(
    (file: Express.Multer.File) => file.fieldname === 'video' ? 'exercise-library/videos' : 'exercise-library/thumbnails',
    null,
    {
        maxSize:    5 * 1024 * 1024,
        fileFilter: (_req: Express.Request, file: Express.Multer.File, cb: import('multer').FileFilterCallback) => {
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
