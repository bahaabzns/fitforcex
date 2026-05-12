exports.up = (pgm) => {
    pgm.addColumn('plans', {
        trial_days: { type: 'integer', notNull: false }
    });
};

exports.down = (pgm) => {
    pgm.dropColumn('plans', 'trial_days');
};
