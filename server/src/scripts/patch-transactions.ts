/**
 * Patches the transactions table with data missing from the original migration:
 *   - client_id          (was queried but never inserted)
 *   - duration           (days, derived from old ClientPackage.durationMonths)
 *   - client_name        (derived from old Client.fname + lname)
 *   - payment_method     (from old Payment.provider)
 *
 * Without duration + client_id, computeSubscriptionStatus returns 'Pre-start'
 * for every client regardless of their actual payment history.
 *
 * Usage (from server/):
 *   PG_OLD_URL="postgresql://fitforce_user:<password>@localhost:5432/fitforce_old" \
 *   DATABASE_URL="postgresql://fitforce_user:<password>@localhost:5432/fitforce_db" \
 *   npx tsx src/scripts/patch-transactions.ts
 */

import { Pool } from 'pg';

const OLD_URL = process.env.PG_OLD_URL;
const NEW_URL  = process.env.DATABASE_URL;

if (!OLD_URL || !NEW_URL) {
  console.error('PG_OLD_URL and DATABASE_URL are both required');
  process.exit(1);
}

const old   = new Pool({ connectionString: OLD_URL });
const newDb = new Pool({ connectionString: NEW_URL });

async function main() {
  console.log('patch-transactions: reading old Payment data…');

  const { rows } = await old.query<{
    id: string;
    clientId: string;
    payment_method: string;
    duration: number;
    client_name: string;
  }>(`
    SELECT
      p.id,
      p."clientId",
      COALESCE(p.provider, 'manual')                                  AS payment_method,
      GREATEST(COALESCE(pkg."durationMonths", 0) * 30, 30)            AS duration,
      COALESCE(NULLIF(TRIM(c."fullName"), ''), 'Unknown')               AS client_name
    FROM public."Payment" p
    LEFT JOIN public."ClientPackage" pkg ON pkg.id = p."packageId"
    LEFT JOIN public."Client"        c   ON c.id   = p."clientId"
    WHERE p."deletedAt" IS NULL
      AND p."clientId"  IS NOT NULL
  `);

  console.log(`patch-transactions: ${rows.length} rows to patch`);

  const BATCH = 200;
  let updated = 0;

  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH);

    // Build a single UPDATE … FROM (VALUES …) for the whole batch
    const vals: unknown[] = [];
    const placeholders = batch.map((r, j) => {
      const base = j * 5;
      vals.push(r.id, r.clientId, r.duration, r.client_name, r.payment_method);
      return `($${base + 1}::text, $${base + 2}::text, $${base + 3}::int, $${base + 4}::text, $${base + 5}::text)`;
    });

    const sql = `
      UPDATE transactions t
      SET
        client_id      = v.client_id,
        duration       = v.duration,
        client_name    = v.client_name,
        payment_method = v.payment_method
      FROM (VALUES ${placeholders.join(',')})
           AS v(id, client_id, duration, client_name, payment_method)
      WHERE t.id = v.id
    `;

    const result = await newDb.query(sql, vals);
    updated += result.rowCount ?? 0;
    console.log(`  progress: ${Math.min(i + BATCH, rows.length)} / ${rows.length}`);
  }

  console.log(`patch-transactions: done — ${updated} transactions patched`);
}

main().catch(err => {
  console.error('patch-transactions FAILED:', err);
  process.exit(1);
}).finally(async () => {
  await old.end();
  await newDb.end();
});
