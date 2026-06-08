/**
 * DEV ONLY — removes pgmigrations entries for 002-012 so node-pg-migrate
 * will actually run them and add the columns/tables schema.sql is missing.
 * Migrations 001 and 013-015 stay marked done (schema.sql already has those).
 */
const { Pool } = require('pg');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const TO_REMOVE = [
    '002_add_trial_days_to_plans',
    '003_add_fawaterak_payments',
    '004_add_plan_payment_link',
    '005_plans_landing_fields',
    '006_billing_discounts_and_seat_price',
    '007_plan_period_links',
    '008_plans_max_clients',
    '009_users_phone',
    '010_add_created_by_to_plans',
    '011_users_preferred_language',
    '012_bilingual_content_columns',
];

pool.query(
    'DELETE FROM public.pgmigrations WHERE name = ANY($1)',
    [TO_REMOVE],
    (err, res) => {
        if (err) { console.error('Failed:', err.message); process.exit(1); }
        console.log(`Removed ${res.rowCount} migration entries. Ready for npm run dev.`);
        pool.end();
    }
);
