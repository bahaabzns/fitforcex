/**
 * DEV ONLY — patches the database after a schema.sql reset.
 * 1. Runs migrate.js steps to fill in baseline gaps (is_default, plan seeds, etc.)
 * 2. Applies SQL from migrations 002-012 with IF NOT EXISTS guards
 * 3. Re-marks 002-012 as done in pgmigrations
 */
const { Pool } = require('pg');
const path = require('path');
const { createId } = require('@paralleldrive/cuid2');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

if (process.env.NODE_ENV === 'production') {
    console.error('Never run this in production.'); process.exit(1);
}

const pool = new Pool({
    user: process.env.DB_USER, host: process.env.DB_HOST,
    database: process.env.DB_NAME, password: process.env.DB_PASSWORD, port: process.env.DB_PORT,
});

async function columnExists(client, table, col) {
    const { rows } = await client.query(
        `SELECT 1 FROM information_schema.columns WHERE table_name=$1 AND column_name=$2`, [table, col]);
    return rows.length > 0;
}
async function tableExists(client, table) {
    const { rows } = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name=$1`, [table]);
    return rows.length > 0;
}
async function indexExists(client, name) {
    const { rows } = await client.query(`SELECT 1 FROM pg_indexes WHERE indexname=$1`, [name]);
    return rows.length > 0;
}

async function patch(client) {

    // ── migrate.js baseline gaps ──────────────────────────────────────────────

    console.log('Seeding plans (free, starter, pro, business)...');
    for (const p of [
        { name: 'free',     display_name: 'Free',     max_team_seats: 0,    max_workspaces: 1,    price_monthly: 0 },
        { name: 'starter',  display_name: 'Starter',  max_team_seats: 2,    max_workspaces: 1,    price_monthly: null },
        { name: 'pro',      display_name: 'Pro',      max_team_seats: 5,    max_workspaces: 3,    price_monthly: null },
        { name: 'business', display_name: 'Business', max_team_seats: null, max_workspaces: null, price_monthly: null },
    ]) {
        await client.query(
            `INSERT INTO plans (id, name, display_name, max_team_seats, max_workspaces, price_monthly)
             VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (name) DO NOTHING`,
            [createId(), p.name, p.display_name, p.max_team_seats, p.max_workspaces, p.price_monthly]
        );
    }

    console.log('Adding plans.is_default...');
    if (!await columnExists(client, 'plans', 'is_default')) {
        await client.query(`ALTER TABLE plans ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT FALSE`);
    }
    if (!await indexExists(client, 'plans_one_default')) {
        await client.query(`CREATE UNIQUE INDEX plans_one_default ON plans (is_default) WHERE is_default = TRUE`);
    }
    const { rows: defaultRows } = await client.query(`SELECT id FROM plans WHERE is_default = TRUE`);
    if (!defaultRows.length) {
        await client.query(`UPDATE plans SET is_default = TRUE WHERE name = 'free'`);
        console.log('  → free plan marked as default');
    }

    // ── migration 002: plans.trial_days ───────────────────────────────────────
    console.log('002: plans.trial_days...');
    if (!await columnExists(client, 'plans', 'trial_days')) {
        await client.query(`ALTER TABLE plans ADD COLUMN trial_days integer`);
    }

    // ── migration 003: plans.duration_days + workspace_payments table ─────────
    console.log('003: plans.duration_days + workspace_payments...');
    if (!await columnExists(client, 'plans', 'duration_days')) {
        await client.query(`ALTER TABLE plans ADD COLUMN duration_days integer NOT NULL DEFAULT 30`);
    }
    if (!await tableExists(client, 'workspace_payments')) {
        await client.query(`
            CREATE TABLE workspace_payments (
                id                    text PRIMARY KEY,
                workspace_id          text NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                plan_id               text NOT NULL REFERENCES plans(id),
                amount                numeric(10,2) NOT NULL,
                currency              text NOT NULL DEFAULT 'EGP',
                duration_days         integer NOT NULL,
                fawaterak_invoice_id  text,
                fawaterak_payment_url text,
                fawaterak_status      text NOT NULL DEFAULT 'pending',
                fawaterak_raw_webhook jsonb,
                notes                 text,
                paid_at               timestamptz,
                created_at            timestamptz NOT NULL DEFAULT now()
            )
        `);
        await client.query(`CREATE INDEX ON workspace_payments (fawaterak_invoice_id)`);
        await client.query(`CREATE INDEX ON workspace_payments (workspace_id)`);
    }

    // ── migration 004: plans.payment_link ─────────────────────────────────────
    console.log('004: plans.payment_link...');
    if (!await columnExists(client, 'plans', 'payment_link')) {
        await client.query(`ALTER TABLE plans ADD COLUMN payment_link text`);
    }

    // ── migration 005: plans landing fields ───────────────────────────────────
    console.log('005: plans landing fields...');
    const landingCols = {
        subtitle:           `text`,
        is_popular:         `boolean NOT NULL DEFAULT false`,
        cta_text:           `text NOT NULL DEFAULT 'Get Started'`,
        cta_variant:        `text NOT NULL DEFAULT 'outline'`,
        features_header:    `text NOT NULL DEFAULT 'What''s included:'`,
        features_subheader: `text`,
        has_team_counter:   `boolean NOT NULL DEFAULT false`,
        sort_order:         `integer NOT NULL DEFAULT 0`,
        currency:           `text NOT NULL DEFAULT 'LE'`,
        show_on_landing:    `boolean NOT NULL DEFAULT true`,
    };
    for (const [col, def] of Object.entries(landingCols)) {
        if (!await columnExists(client, 'plans', col)) {
            await client.query(`ALTER TABLE plans ADD COLUMN ${col} ${def}`);
        }
    }

    // ── migration 006: billing_discounts + plans seat pricing ─────────────────
    console.log('006: billing_discounts + plans seat pricing...');
    if (!await tableExists(client, 'billing_discounts')) {
        await client.query(`
            CREATE TABLE billing_discounts (
                id               text PRIMARY KEY,
                period_key       text NOT NULL UNIQUE,
                label            text NOT NULL,
                save_label       text,
                discount_percent integer NOT NULL DEFAULT 0,
                months           integer NOT NULL DEFAULT 1,
                sort_order       integer NOT NULL DEFAULT 0,
                is_active        boolean NOT NULL DEFAULT true
            )
        `);
    }
    for (const [col, def] of [
        ['price_per_seat', `decimal(10,2)`],
        ['min_seat_count', `integer NOT NULL DEFAULT 1`],
        ['max_seat_count', `integer NOT NULL DEFAULT 20`],
    ]) {
        if (!await columnExists(client, 'plans', col)) {
            await client.query(`ALTER TABLE plans ADD COLUMN ${col} ${def}`);
        }
    }

    // ── migration 007: plan_period_links ──────────────────────────────────────
    console.log('007: plan_period_links...');
    if (!await tableExists(client, 'plan_period_links')) {
        await client.query(`
            CREATE TABLE plan_period_links (
                id                  text PRIMARY KEY,
                plan_id             text NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
                billing_discount_id text NOT NULL REFERENCES billing_discounts(id) ON DELETE CASCADE,
                payment_link        text,
                UNIQUE(plan_id, billing_discount_id)
            )
        `);
    }

    // ── migration 008: plans.max_clients ──────────────────────────────────────
    console.log('008: plans.max_clients...');
    if (!await columnExists(client, 'plans', 'max_clients')) {
        await client.query(`ALTER TABLE plans ADD COLUMN max_clients integer`);
    }

    // ── migration 009: users.phone ────────────────────────────────────────────
    console.log('009: users.phone...');
    if (!await columnExists(client, 'users', 'phone')) {
        await client.query(`ALTER TABLE users ADD COLUMN phone text`);
    }

    // ── migration 010: training_plans.created_by + nutrition_plans.created_by ─
    console.log('010: training_plans.created_by + nutrition_plans.created_by...');
    if (!await columnExists(client, 'training_plans', 'created_by')) {
        await client.query(`ALTER TABLE training_plans ADD COLUMN created_by text REFERENCES users(id) ON DELETE SET NULL`);
    }
    if (!await columnExists(client, 'nutrition_plans', 'created_by')) {
        await client.query(`ALTER TABLE nutrition_plans ADD COLUMN created_by text REFERENCES users(id) ON DELETE SET NULL`);
    }

    // ── migrations 011-012: stubs (no-op) ─────────────────────────────────────
    console.log('011-012: stubs — nothing to apply.');

    // ── re-mark 002-012 as done ───────────────────────────────────────────────
    console.log('Marking 002-012 as done in pgmigrations...');
    const toMark = [
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
    for (const name of toMark) {
        await client.query(
            `INSERT INTO public.pgmigrations (name, run_on) VALUES ($1, NOW()) ON CONFLICT DO NOTHING`,
            [name]
        );
    }

    console.log('\nPatch complete. Ready for npm run dev.');
}

async function run() {
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        await patch(client);
        await client.query('COMMIT');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Patch failed:', err.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
