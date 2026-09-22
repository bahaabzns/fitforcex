// Plan Variations, Phase 1 (cont.) — records which plan_variations row a workspace
// actually purchased, plus the price it's locked into (workspace_subscriptions.locked_price_monthly).
//
// The locked price is deliberately separate from plan_variations.price_monthly (the
// current *public* price): editing a variation's public price must never retroactively
// reprice an existing subscriber — admins opt existing subscribers into a new price
// explicitly (see the resync-price admin action), never automatically.
//
// Both FKs are nullable and additive; existing rows are backfilled by the separate,
// re-runnable script server/src/scripts/backfill-plan-variations.ts.

exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE workspace_subscriptions
            ADD COLUMN IF NOT EXISTS variation_id TEXT
                REFERENCES plan_variations(id) ON DELETE SET NULL,
            ADD COLUMN IF NOT EXISTS locked_price_monthly DECIMAL(10, 2),
            ADD COLUMN IF NOT EXISTS locked_currency TEXT;
        CREATE INDEX IF NOT EXISTS idx_workspace_subscriptions_variation
            ON workspace_subscriptions (variation_id);

        ALTER TABLE workspace_payments
            ADD COLUMN IF NOT EXISTS variation_id TEXT
                REFERENCES plan_variations(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_workspace_payments_variation
            ON workspace_payments (variation_id);
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        DROP INDEX IF EXISTS idx_workspace_payments_variation;
        ALTER TABLE workspace_payments DROP COLUMN IF EXISTS variation_id;

        DROP INDEX IF EXISTS idx_workspace_subscriptions_variation;
        ALTER TABLE workspace_subscriptions
            DROP COLUMN IF EXISTS variation_id,
            DROP COLUMN IF EXISTS locked_price_monthly,
            DROP COLUMN IF EXISTS locked_currency;
    `);
};
