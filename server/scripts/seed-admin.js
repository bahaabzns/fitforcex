/**
 * One-time script: creates the admins table and seeds the first admin account.
 * Usage: node server/scripts/seed-admin.js
 *
 * Set ADMIN_EMAIL and ADMIN_PASSWORD as env vars, or edit the defaults below.
 * ADMIN_JWT_SECRET must be set in your .env file before running.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../db');
const bcrypt = require('bcrypt');

const ADMIN_EMAIL    = process.env.ADMIN_EMAIL    || 'admin@fitforce.app';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (() => { throw new Error('Set ADMIN_PASSWORD env var'); })();
const ADMIN_FNAME    = process.env.ADMIN_FNAME    || 'Bahaa';
const ADMIN_LNAME    = process.env.ADMIN_LNAME    || 'Ahmed';

async function run() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS admins (
                id         SERIAL PRIMARY KEY,
                email      TEXT NOT NULL UNIQUE,
                password   TEXT NOT NULL,
                fname      TEXT,
                lname      TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        console.log('admins table ready');

        const hashed = await bcrypt.hash(ADMIN_PASSWORD, 12);

        const result = await pool.query(
            `INSERT INTO admins (email, password, fname, lname)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (email) DO NOTHING
             RETURNING id, email`,
            [ADMIN_EMAIL, hashed, ADMIN_FNAME, ADMIN_LNAME]
        );

        if (result.rows.length === 0) {
            console.log(`Admin ${ADMIN_EMAIL} already exists — skipped`);
        } else {
            console.log(`Admin seeded: ${result.rows[0].email} (id=${result.rows[0].id})`);
        }

    } catch (err) {
        console.error('Seed failed:', err.message);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

run();
