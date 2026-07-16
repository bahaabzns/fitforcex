// Tracks who last touched a nutrition plan's content, so the plan card can
// show "edited 2w ago · by <name>" instead of just a bare timestamp. Every
// mutation endpoint in nutrition.controller.ts that bumps updated_at now
// also sets this to req.user.userId.
exports.up = (pgm) => {
    pgm.addColumns('nutrition_plans', {
        last_edited_by: { type: 'text', references: 'users', onDelete: 'SET NULL' },
    }, { ifNotExists: true });

    pgm.createIndex('nutrition_plans', 'last_edited_by', { ifNotExists: true });
};

exports.down = (pgm) => {
    pgm.dropIndex('nutrition_plans', 'last_edited_by', { ifExists: true });
    pgm.dropColumns('nutrition_plans', ['last_edited_by']);
};
