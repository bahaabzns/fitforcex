/**
 * Adds the `assigned_to` column to form_requests so a Plans Queue item can be
 * assigned to a team member (stores the assignee's user id).
 *
 * Idempotent — safe to run more than once.
 *
 * Usage (from server/):
 *   DATABASE_URL="postgresql://..." npx tsx src/scripts/migrate-add-queue-assignee.ts
 */

import { Pool } from 'pg';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL is required');
  process.exit(1);
}

const db = new Pool({ connectionString: DATABASE_URL });

async function main() {
  await db.query(`ALTER TABLE form_requests ADD COLUMN IF NOT EXISTS assigned_to text`);
  await db.query(`CREATE INDEX IF NOT EXISTS form_requests_assigned_to_idx ON form_requests (assigned_to)`);
  console.log('[migrate-add-queue-assignee] done — assigned_to column + index ready');
}

main().catch(err => {
  console.error('migrate-add-queue-assignee FAILED:', err);
  process.exit(1);
}).finally(async () => {
  await db.end();
});
