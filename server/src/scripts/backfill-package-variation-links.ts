/**
 * Backfills the package linkage that was never carried over by any past
 * migration script, platform-wide:
 *
 *   1. transactions.package_variation_id (+ package_variation text label) —
 *      real source: old Payment.packageId, which maps directly onto
 *      package_variations.id (ClientPackage.id was used unprefixed as the
 *      new variation's id — see migrate-phase2.ts's migratePackages()).
 *      patch-transactions.ts backfilled client_id/duration/client_name/
 *      payment_method from the same old Payment rows, but never this field.
 *
 *   2. clients.current_package_variation_id (+ current_package text label) —
 *      the live app only ever sets this via syncClientPackage() in
 *      transactions.controller.ts, triggered on transaction create/update.
 *      Migrated transactions were inserted directly into the DB, bypassing
 *      that function entirely, so this replicates its exact logic (latest
 *      transaction by transaction_date desc, then created_at desc) as a
 *      single set-based UPDATE.
 *
 * Confirmed platform-wide before writing this: only 3/2919 transactions and
 * 3/2691 clients had this linkage at all (real demo/seed data, not migrated
 * production data).
 *
 * Additive only — only fills NULLs, never overwrites an existing value.
 * Idempotent, safe to re-run.
 *
 * Usage (from server/):
 *   DRY_RUN=true PG_OLD_URL="$PG_OLD_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-package-variation-links.ts
 *
 *   PG_OLD_URL="$PG_OLD_URL" DATABASE_URL="$DATABASE_URL" \
 *     npx tsx src/scripts/backfill-package-variation-links.ts
 */

import { Pool } from 'pg';

const OLD_URL = process.env.PG_OLD_URL;
const NEW_URL = process.env.DATABASE_URL;
if (!OLD_URL) { console.error('PG_OLD_URL is required'); process.exit(1); }
if (!NEW_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const DRY_RUN = process.env.DRY_RUN === 'true';

const old = new Pool({ connectionString: OLD_URL });
const newDb = new Pool({ connectionString: NEW_URL });

function log(msg: string) { console.log(`[backfill-pkg-links] ${msg}`); }

async function backfillTransactionPackageVariation() {
  const { rows } = await old.query<{ id: string; packageId: string }>(`
    SELECT id, "packageId" FROM public."Payment" WHERE "packageId" IS NOT NULL
  `);
  if (rows.length === 0) { log('transactions: no old Payment.packageId rows, skipping'); return; }

  const client = await newDb.connect();
  try {
    await client.query(`DROP TABLE IF EXISTS backfill_pkg_links`);
    await client.query(`CREATE TEMP TABLE backfill_pkg_links (id text, package_variation_id text)`);

    const batchSize = 500;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values: unknown[] = [];
      const placeholders = batch.map((r, j) => {
        values.push(r.id, r.packageId);
        return `($${j * 2 + 1},$${j * 2 + 2})`;
      });
      await client.query(
        `INSERT INTO backfill_pkg_links (id, package_variation_id) VALUES ${placeholders.join(',')}`,
        values,
      );
    }

    // Only rows whose old packageId actually resolves to a real package_variations
    // row today (some packages/variations may have been deleted since).
    const { rows: missing } = await client.query<{ id: string }>(`
      SELECT t.id FROM transactions t
      JOIN backfill_pkg_links o ON o.id = t.id
      JOIN package_variations pv ON pv.id = o.package_variation_id
      WHERE t.package_variation_id IS NULL
    `);
    log(`transactions: ${missing.length} row(s) need package_variation_id backfill`);
    if (missing.length === 0 || DRY_RUN) return;

    const result = await client.query(`
      UPDATE transactions t
      SET package_variation_id = pv.id,
          package_variation    = p.name || ' — ' || pv.name
      FROM backfill_pkg_links o
      JOIN package_variations pv ON pv.id = o.package_variation_id
      JOIN packages p ON p.id = pv.package_id
      WHERE o.id = t.id AND t.package_variation_id IS NULL
    `);
    log(`transactions: backfilled ${result.rowCount} row(s)`);
  } finally {
    client.release();
  }
}

async function syncAllClientPackages() {
  if (DRY_RUN) {
    const { rows } = await newDb.query<{ count: string }>(`
      SELECT count(*) FROM clients c
      WHERE c.current_package_variation_id IS NULL
        AND EXISTS (
          SELECT 1 FROM transactions t
          WHERE t.client_id = c.id AND t.package_variation_id IS NOT NULL
        )
    `);
    log(`clients: ${rows[0].count} row(s) need current_package backfill`);
    return;
  }

  const result = await newDb.query(`
    UPDATE clients c
    SET current_package_variation_id = t.package_variation_id,
        current_package              = t.package_variation
    FROM (
      SELECT DISTINCT ON (client_id) client_id, package_variation_id, package_variation
      FROM transactions
      WHERE client_id IS NOT NULL AND package_variation_id IS NOT NULL
      ORDER BY client_id, transaction_date DESC, created_at DESC
    ) t
    WHERE c.id = t.client_id AND c.current_package_variation_id IS NULL
  `);
  log(`clients: backfilled ${result.rowCount} row(s)`);
}

async function main() {
  console.time('backfill-pkg-links');
  log(`Starting… ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE — writing to production)'}`);
  try {
    await backfillTransactionPackageVariation();
    await syncAllClientPackages();
    log(DRY_RUN ? 'Dry run complete — no data was written.' : 'Backfill complete.');
  } catch (err) {
    console.error('[backfill-pkg-links] FAILED:', err);
    process.exit(1);
  } finally {
    await old.end();
    await newDb.end();
    console.timeEnd('backfill-pkg-links');
  }
}

main();
