// Revises founder decision 9: TeamForce's included team seats now scale with the client
// tier (e.g. 150 clients / 3 seats vs 5000 clients / 20 seats), reversing the "variations
// differ only by client limit + price" rule from migration 063. max_team_seats moves back
// onto plan_variations; plans.max_team_seats remains as the fallback for single-variation
// plans (Free, OneForce) via the same COALESCE(pv.*, p.*) pattern max_clients already uses.
exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE plan_variations ADD COLUMN max_team_seats INTEGER;
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE plan_variations DROP COLUMN IF EXISTS max_team_seats;
    `);
};
