exports.up = (pgm) => {
    pgm.addColumns('plans', {
        max_clients: { type: 'integer', notNull: false, default: null },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('plans', ['max_clients']);
};
