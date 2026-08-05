// Prescription-side counterpart to migration 080's tracking_type — a coach
// sets targets for Duration/Duration+Cardio exercises here, symmetric with
// how reps/rest_seconds/tempo/rir already work for Reps & Weight exercises.
// See server/src/config/exerciseTrackingTypes.ts for which columns apply to
// which tracking type. All nullable, no default: existing sets are all
// 'reps_weight' and simply have NULL here, same as tempo/rir today.
exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE training_sets
            ADD COLUMN duration_seconds INTEGER,
            ADD COLUMN distance_km       DECIMAL(6,2),
            ADD COLUMN incline_percent   DECIMAL(4,1),
            ADD COLUMN speed_kmh         DECIMAL(5,2);
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE training_sets
            DROP COLUMN duration_seconds,
            DROP COLUMN distance_km,
            DROP COLUMN incline_percent,
            DROP COLUMN speed_kmh;
    `);
};
