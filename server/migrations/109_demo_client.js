// Demo Client: a sample client auto-created for new coaches so they see the diet, the app and
// tracking before adding a real client. Everything seeded for it is flagged is_demo so it can be
// left out of stats/money totals and removed in one go when the coach deletes the demo client.
//
// Touches exactly:
//   clients.is_demo, transactions.is_demo, packages.is_demo, payment_methods.is_demo, forms.is_demo (new)
//   workspaces.demo_client_created_at / demo_client_deleted_at / demo_welcome_seen_at (new)
//   demo_client_events (new) — first time each funnel step happened, one row per (workspace, step)
exports.up = (pgm) => {
    for (const table of ['clients', 'transactions', 'packages', 'payment_methods', 'forms']) {
        pgm.sql(`ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "is_demo" BOOLEAN NOT NULL DEFAULT FALSE;`);
    }
    // Partial indexes: demo rows are rare, and these are what the cleanup + "is there a real client" lookups hit.
    pgm.sql(`CREATE INDEX IF NOT EXISTS "idx_clients_ws_demo" ON "clients" ("workspace_id") WHERE "is_demo" = TRUE;`);
    pgm.sql(`CREATE INDEX IF NOT EXISTS "idx_transactions_ws_demo" ON "transactions" ("workspace_id") WHERE "is_demo" = TRUE;`);
    pgm.sql(`CREATE INDEX IF NOT EXISTS "idx_packages_ws_demo" ON "packages" ("workspace_id") WHERE "is_demo" = TRUE;`);
    pgm.sql(`CREATE INDEX IF NOT EXISTS "idx_payment_methods_ws_demo" ON "payment_methods" ("workspace_id") WHERE "is_demo" = TRUE;`);
    pgm.sql(`CREATE INDEX IF NOT EXISTS "idx_forms_ws_demo" ON "forms" ("workspace_id") WHERE "is_demo" = TRUE;`);

    pgm.sql(`
        ALTER TABLE "workspaces"
            ADD COLUMN IF NOT EXISTS "demo_client_created_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "demo_client_deleted_at" TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS "demo_welcome_seen_at"   TIMESTAMPTZ;
    `);

    pgm.sql(`
        CREATE TABLE IF NOT EXISTS "demo_client_events" (
            "id"           TEXT PRIMARY KEY,
            "workspace_id" TEXT NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
            "event_type"   TEXT NOT NULL,
            "created_at"   TIMESTAMPTZ NOT NULL DEFAULT now(),
            UNIQUE ("workspace_id", "event_type")
        );
    `);
};

exports.down = (pgm) => {
    pgm.sql(`DROP TABLE IF EXISTS "demo_client_events";`);
    pgm.sql(`ALTER TABLE "workspaces" DROP COLUMN IF EXISTS "demo_client_created_at", DROP COLUMN IF EXISTS "demo_client_deleted_at", DROP COLUMN IF EXISTS "demo_welcome_seen_at";`);
    for (const table of ['clients', 'transactions', 'packages', 'payment_methods', 'forms']) {
        pgm.sql(`DROP INDEX IF EXISTS "idx_${table}_ws_demo";`);
        pgm.sql(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS "is_demo";`);
    }
};
