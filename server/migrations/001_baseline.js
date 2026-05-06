/**
 * Migration 001 — Baseline
 *
 * The initial schema was created by scripts/migrate.js before the migration
 * system was introduced. This file exists purely to establish the baseline
 * in the pgmigrations table so future migrations have a starting point.
 *
 * All tables, columns, and FKs that existed before this migration system
 * are assumed to already exist in the database.
 */

exports.up = async () => {
    // No-op: schema already exists from scripts/migrate.js
};

exports.down = async () => {
    // No-op: baseline cannot be rolled back safely
};
