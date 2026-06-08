exports.up = (pgm) => {
    pgm.addColumns('training_plans', {
        created_by: {
            type: 'text',
            notNull: false,
            default: null,
            references: '"users"(id)',
            onDelete: 'SET NULL',
        },
    });

    pgm.addColumns('nutrition_plans', {
        created_by: {
            type: 'text',
            notNull: false,
            default: null,
            references: '"users"(id)',
            onDelete: 'SET NULL',
        },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('training_plans', ['created_by']);
    pgm.dropColumns('nutrition_plans', ['created_by']);
};
