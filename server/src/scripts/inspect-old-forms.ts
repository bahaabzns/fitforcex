/**
 * Inspects the old DB to discover form-request-related table structures.
 * Run this first to confirm column names before writing the migration.
 *
 * Usage (from server/):
 *   PG_OLD_URL="postgresql://fitforce_user:<password>@localhost:5432/fitforce_old" \
 *   npx tsx src/scripts/inspect-old-forms.ts
 */

import { Pool } from 'pg';

const OLD_URL = process.env.PG_OLD_URL;
if (!OLD_URL) { console.error('PG_OLD_URL is required'); process.exit(1); }

const old = new Pool({ connectionString: OLD_URL });

async function main() {
  // 1. List all tables containing "form" or "check" or "request" or "queue"
  const { rows: tables } = await old.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND (
        LOWER(table_name) LIKE '%form%'
        OR LOWER(table_name) LIKE '%request%'
        OR LOWER(table_name) LIKE '%response%'
        OR LOWER(table_name) LIKE '%answer%'
        OR LOWER(table_name) LIKE '%checkin%'
        OR LOWER(table_name) LIKE '%check_in%'
        OR LOWER(table_name) LIKE '%queue%'
        OR LOWER(table_name) LIKE '%submission%'
      )
    ORDER BY table_name
  `);

  console.log('\n=== Relevant tables ===');
  for (const t of tables) console.log(' ', t.table_name);

  // 2. For each, show columns + row count
  for (const t of tables) {
    const name = t.table_name;

    const { rows: cols } = await old.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
      ORDER BY ordinal_position
    `, [name]);

    const { rows: cnt } = await old.query(`SELECT COUNT(*) FROM public."${name}"`);

    console.log(`\n--- "${name}" (${cnt[0].count} rows) ---`);
    for (const c of cols) {
      console.log(`  ${c.column_name}  [${c.data_type}]${c.is_nullable === 'YES' ? ' nullable' : ''}`);
    }

    // Show a sample row
    if (Number(cnt[0].count) > 0) {
      const { rows: sample } = await old.query(`SELECT * FROM public."${name}" LIMIT 1`);
      console.log('  sample:', JSON.stringify(sample[0], null, 2).split('\n').map(l => '  ' + l).join('\n'));
    }
  }
}

main().catch(err => {
  console.error('FAILED:', err);
  process.exit(1);
}).finally(() => old.end());
