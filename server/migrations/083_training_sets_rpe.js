// RPE (Rate of Perceived Exertion), 1-10 in 0.5 steps — a coach-selectable
// metric for Sets & Reps exercises alongside tempo/rir (see migration 082
// and server/src/config/exerciseTrackingTypes.ts). Nullable, no default,
// same convention as rir/tempo — a set simply has no RPE until a coach (or
// the exercise's tracked_metrics selection) calls for one.
exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE training_sets ADD COLUMN rpe DECIMAL(3,1);
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE training_sets DROP COLUMN rpe;
    `);
};
