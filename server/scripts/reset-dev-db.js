/**
 * DEV ONLY — resets the database to a clean state using schema.sql.
 * Drops everything, recreates from schema, marks all migrations as done.
 * Never run this in production.
 */
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

if (process.env.NODE_ENV === 'production') {
    console.error('This script must never be run in production.');
    process.exit(1);
}

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const MIGRATIONS = [
    '001_baseline',
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
    '013_email_verification',
    '014_messaging',
    '015_password_reset_tokens',
];

async function reset() {
    const client = await pool.connect();
    try {
        console.log('Dropping public schema...');
        await client.query('DROP SCHEMA public CASCADE');
        await client.query('CREATE SCHEMA public');
        await client.query('GRANT ALL ON SCHEMA public TO public');

        console.log('Applying schema.sql...');
        const raw = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        // Strip psql meta-commands (lines starting with \) — not valid SQL
        const sql = raw.split('\n').filter(l => !l.trimStart().startsWith('\\')).join('\n');
        await client.query(sql);

        console.log('Marking all migrations as applied...');
        for (const name of MIGRATIONS) {
            await client.query(
                "INSERT INTO public.pgmigrations (name, run_on) VALUES ($1, NOW())",
                [name]
            );
        }

        console.log('Done. Database reset successfully.');
    } catch (err) {
        console.error('Reset failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

reset();
