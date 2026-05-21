exports.up = (pgm) => {
    pgm.addColumns('users', {
        phone: { type: 'text', notNull: false, default: null },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('users', ['phone']);
};
