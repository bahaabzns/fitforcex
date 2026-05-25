exports.up = (pgm) => {
    pgm.addColumns('users', {
        preferred_language: {
            type: 'varchar(10)',
            notNull: true,
            default: 'en',
        },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('users', ['preferred_language']);
};
