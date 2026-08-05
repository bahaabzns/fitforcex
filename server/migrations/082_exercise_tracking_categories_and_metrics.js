// Replaces the 3 fixed tracking types (reps_weight / duration /
// duration_cardio, migration 080) with 2 broader categories that the coach
// then customizes per exercise via a metric checklist: "Sets & Reps"
// (sets_reps) always tracks reps + weight + rest, with tempo/rir/rpe as
// opt-in; "Time-Based" (time_based) always tracks rest, with
// duration/distance/incline/speed as opt-in. See
// server/src/config/exerciseTrackingTypes.ts for the shared definition.
//
// Order matters within this migration: tracked_metrics is backfilled from
// the OLD 3-way tracking_type value (still intact at that point) so an
// existing 'duration' exercise keeps just its duration column and a
// 'duration_cardio' exercise keeps its full cardio column set — only after
// that backfill does tracking_type itself collapse to the new 2-way value,
// which would otherwise destroy the duration/duration_cardio distinction
// tracked_metrics needs to preserve.
exports.up = async (pgm) => {
    for (const table of ['exercise_library', 'master_exercise_library']) {
        await pgm.db.query(`
            ALTER TABLE ${table} ADD COLUMN tracked_metrics TEXT[] NOT NULL DEFAULT '{}';
        `);

        await pgm.db.query(`
            UPDATE ${table} SET tracked_metrics = ARRAY['tempo', 'rir'] WHERE tracking_type = 'reps_weight';
        `);
        await pgm.db.query(`
            UPDATE ${table} SET tracked_metrics = ARRAY['duration_seconds'] WHERE tracking_type = 'duration';
        `);
        await pgm.db.query(`
            UPDATE ${table} SET tracked_metrics = ARRAY['duration_seconds', 'distance_km', 'incline_percent', 'speed_kmh'] WHERE tracking_type = 'duration_cardio';
        `);

        await pgm.db.query(`
            UPDATE ${table} SET tracking_type = 'sets_reps' WHERE tracking_type = 'reps_weight';
        `);
        await pgm.db.query(`
            UPDATE ${table} SET tracking_type = 'time_based' WHERE tracking_type IN ('duration', 'duration_cardio');
        `);
        await pgm.db.query(`
            ALTER TABLE ${table} ALTER COLUMN tracking_type SET DEFAULT 'sets_reps';
        `);
    }
};

exports.down = async (pgm) => {
    for (const table of ['exercise_library', 'master_exercise_library']) {
        // Best-effort: a time_based row's original duration-vs-duration_cardio
        // split can be approximated from tracked_metrics, but distance/incline/
        // speed-only combinations that never existed pre-migration have no
        // exact inverse — this is a reasonable, not perfect, rollback.
        await pgm.db.query(`
            UPDATE ${table} SET tracking_type = 'reps_weight' WHERE tracking_type = 'sets_reps';
        `);
        await pgm.db.query(`
            UPDATE ${table} SET tracking_type = 'duration_cardio'
            WHERE tracking_type = 'time_based' AND (tracked_metrics && ARRAY['distance_km', 'incline_percent', 'speed_kmh']);
        `);
        await pgm.db.query(`
            UPDATE ${table} SET tracking_type = 'duration' WHERE tracking_type = 'time_based';
        `);
        await pgm.db.query(`
            ALTER TABLE ${table} ALTER COLUMN tracking_type SET DEFAULT 'reps_weight';
        `);
        await pgm.db.query(`
            ALTER TABLE ${table} DROP COLUMN tracked_metrics;
        `);
    }
};
