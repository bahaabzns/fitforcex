// Adds a fixed tracking type to the exercise catalog (Reps & Weight /
// Duration / Duration + Cardio — see server/src/config/exerciseTrackingTypes.ts
// for the shared definition, mirrored client-side in
// client/utils/exerciseTrackingTypes.js) so different exercises are tracked
// with different fields throughout the builder, client portal, session
// logging, and PDF export. TEXT with an app-level default, validated in
// training.controller.ts — no DB CHECK constraint, matching
// exercise_thumbnail_size (migration 079) and the rest of this app's
// enum-like columns. Every existing row backfills to 'reps_weight', which was
// the implicit behavior before this column existed.
exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE exercise_library ADD COLUMN tracking_type TEXT NOT NULL DEFAULT 'reps_weight';
    `);
    await pgm.db.query(`
        ALTER TABLE master_exercise_library ADD COLUMN tracking_type TEXT NOT NULL DEFAULT 'reps_weight';
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE exercise_library DROP COLUMN tracking_type;
    `);
    await pgm.db.query(`
        ALTER TABLE master_exercise_library DROP COLUMN tracking_type;
    `);
};
