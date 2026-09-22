// Plan Variations, Phase 1 — lets a single SaaS billing `plans` row (e.g. "Professional")
// offer multiple purchasable client/seat/workspace-limit + price combinations, selected by
// the coach at checkout (e.g. "Up to 20 clients — $19/mo" vs "Up to 100 clients — $69/mo").
//
// Every existing `plans` row gets exactly one backfilled variation (see the separate,
// re-runnable backfill script: server/src/scripts/backfill-plan-variations.ts) — this
// migration only creates the new table; it does not touch existing data.
//
// `plans.max_clients` / `max_team_seats` / `max_workspaces` / `price_monthly` / `currency` /
// `payment_link` remain in place for now (deprecated, not dropped) until every read path is
// migrated to `plan_variations` — see docs/... plan-variations implementation plan.

exports.up = async (pgm) => {
    await pgm.db.query(`
        CREATE TABLE plan_variations (
            id                TEXT     PRIMARY KEY,
            plan_id           TEXT     NOT NULL REFERENCES plans(id) ON DELETE CASCADE,

            max_clients       INTEGER,
            max_team_seats    INTEGER,
            max_workspaces    INTEGER,
            price_monthly     DECIMAL(10, 2) NOT NULL,
            currency          TEXT     NOT NULL DEFAULT 'LE',
            payment_link      TEXT,

            has_team_counter  BOOLEAN  NOT NULL DEFAULT FALSE,
            price_per_seat    DECIMAL(10, 2),
            min_seat_count    INTEGER  NOT NULL DEFAULT 1,
            max_seat_count    INTEGER  NOT NULL DEFAULT 20,

            is_default        BOOLEAN  NOT NULL DEFAULT FALSE,
            is_active         BOOLEAN  NOT NULL DEFAULT TRUE,
            sort_order        INTEGER  NOT NULL DEFAULT 0,
            created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),

            CONSTRAINT plan_variations_plan_sort_unique UNIQUE (plan_id, sort_order)
        );

        CREATE INDEX idx_plan_variations_plan_id ON plan_variations (plan_id);
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        DROP TABLE IF EXISTS plan_variations;
    `);
};
