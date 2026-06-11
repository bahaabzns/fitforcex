/**
 * Migration 001 — Baseline
 *
 * The initial schema was built in two phases before node-pg-migrate was introduced:
 *   1. scripts/migrate.js created the workspace layer on top of an existing old-server DB.
 *   2. The pre-workspace tables (users, clients, training_plans, etc.) came from the
 *      original Prisma schema.
 *
 * For a brand-new database (fresh staging / production deploy), initialize the schema
 * via `server/schema.sql` BEFORE running node-pg-migrate — the deploy.sh script
 * handles this automatically. schema.sql is a pg_dump of the fully-migrated dev DB
 * and includes all tables, indexes, and constraints through migration 020.
 *
 * This file is a no-op in the migration runner; it exists only to anchor the
 * pgmigrations sequence so future migrations (002+) have a reference point.
 */

exports.up = async () => {};

exports.down = async () => {};
