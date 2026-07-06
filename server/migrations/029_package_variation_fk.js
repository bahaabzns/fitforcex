// Package Lifecycle, Phase 0 — replaces name-matching between a client's
// subscription/transactions and package_variations with a real foreign key.
// See docs/package-lifecycle-implementation-plan.md, Phase 0.
//
// Both new columns are nullable and additive: existing rows are untouched
// here (a separate, re-runnable backfill script resolves them by name —
// see server/src/scripts/backfill-package-variation-ids.ts). The legacy
// string columns (transactions.package_variation, clients.current_package)
// are kept unchanged as historical/display snapshots.

exports.up = async (pgm) => {
    await pgm.db.query(`
        ALTER TABLE transactions
            ADD COLUMN IF NOT EXISTS package_variation_id TEXT
                REFERENCES package_variations(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_transactions_package_variation
            ON transactions (package_variation_id);

        ALTER TABLE clients
            ADD COLUMN IF NOT EXISTS current_package_variation_id TEXT
                REFERENCES package_variations(id) ON DELETE SET NULL;
        CREATE INDEX IF NOT EXISTS idx_clients_current_package_variation
            ON clients (current_package_variation_id);
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        DROP INDEX IF EXISTS idx_clients_current_package_variation;
        ALTER TABLE clients DROP COLUMN IF EXISTS current_package_variation_id;

        DROP INDEX IF EXISTS idx_transactions_package_variation;
        ALTER TABLE transactions DROP COLUMN IF EXISTS package_variation_id;
    `);
};
