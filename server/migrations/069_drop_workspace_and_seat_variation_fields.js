// Pricing simplification (founder decisions):
//   - Workspace limits are removed from pricing entirely — every workspace owns its own
//     independent subscription, so there is no "max workspaces per plan" concept anymore.
//   - TeamForce variations differ ONLY by client limit + price; team-seat count is no longer
//     a per-variation knob — it lives as a flat base allotment on `plans.max_team_seats`,
//     with anything beyond that sold as a team-member add-on (see migration 064).
//   - The old "buy extra seats on the pricing card" mechanism (has_team_counter/price_per_seat/
//     min_seat_count/max_seat_count) was pricing-card display math only — never charged, never
//     persisted (see the pricing architecture audit) — and is superseded by the real add-on
//     purchase flow, so it comes out with the other seat-related fields rather than sitting
//     alongside a second, real mechanism for the same thing.

exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE plans
            DROP COLUMN IF EXISTS max_workspaces,
            DROP COLUMN IF EXISTS has_team_counter,
            DROP COLUMN IF EXISTS price_per_seat,
            DROP COLUMN IF EXISTS min_seat_count,
            DROP COLUMN IF EXISTS max_seat_count;

        ALTER TABLE plan_variations
            DROP COLUMN IF EXISTS max_workspaces,
            DROP COLUMN IF EXISTS max_team_seats,
            DROP COLUMN IF EXISTS has_team_counter,
            DROP COLUMN IF EXISTS price_per_seat,
            DROP COLUMN IF EXISTS min_seat_count,
            DROP COLUMN IF EXISTS max_seat_count;
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE plans
            ADD COLUMN IF NOT EXISTS max_workspaces   INTEGER,
            ADD COLUMN IF NOT EXISTS has_team_counter BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS price_per_seat    DECIMAL(10, 2),
            ADD COLUMN IF NOT EXISTS min_seat_count    INTEGER NOT NULL DEFAULT 1,
            ADD COLUMN IF NOT EXISTS max_seat_count    INTEGER NOT NULL DEFAULT 20;

        ALTER TABLE plan_variations
            ADD COLUMN IF NOT EXISTS max_workspaces    INTEGER,
            ADD COLUMN IF NOT EXISTS max_team_seats    INTEGER,
            ADD COLUMN IF NOT EXISTS has_team_counter  BOOLEAN NOT NULL DEFAULT FALSE,
            ADD COLUMN IF NOT EXISTS price_per_seat     DECIMAL(10, 2),
            ADD COLUMN IF NOT EXISTS min_seat_count     INTEGER NOT NULL DEFAULT 1,
            ADD COLUMN IF NOT EXISTS max_seat_count     INTEGER NOT NULL DEFAULT 20;
    `);
};
