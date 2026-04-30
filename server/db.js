require('dotenv').config();
const { Pool, types } = require('pg');

// OID 1114 = TIMESTAMP WITHOUT TIME ZONE
// OID 1184 = TIMESTAMP WITH TIME ZONE (TIMESTAMPTZ)
//
// node-postgres returns TIMESTAMP WITHOUT TIME ZONE as a JS Date by treating the
// stored string as UTC.  That is correct IF you always store UTC.  However on some
// setups the driver falls back to returning a raw string like "2026-04-29 22:21:37.310"
// which new Date() then parses in local time (Cairo = UTC+3) and shifts the value by
// 3 hours.  Registering a custom parser normalises both types to UTC ISO-8601 strings
// before any application code sees them.
function parseTimestamp(val) {
    if (!val) return null;
    // Postgres sends "YYYY-MM-DD HH:MM:SS.mmm" (no timezone) for TIMESTAMP WITHOUT TIME ZONE.
    // Treat it as UTC by converting to the T-separator ISO form and appending Z.
    const iso = val.replace(' ', 'T');
    const withZ = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z';
    const d = new Date(withZ);
    return Number.isNaN(d.getTime()) ? val : d.toISOString();
}

types.setTypeParser(1114, parseTimestamp);   // TIMESTAMP WITHOUT TIME ZONE
types.setTypeParser(1184, parseTimestamp);   // TIMESTAMPTZ

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

module.exports = pool;