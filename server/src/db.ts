import { Pool, types } from 'pg';
import { env } from './config/env';

// OID 1114 = TIMESTAMP WITHOUT TIME ZONE
// OID 1184 = TIMESTAMPTZ
// Normalises both to UTC ISO-8601 strings so Cairo UTC+3 offset never shifts values.
function parseTimestamp(val: string | null): string | null {
    if (!val) return null;
    const iso = val.replace(' ', 'T');
    const withZ = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z';
    const d = new Date(withZ);
    return Number.isNaN(d.getTime()) ? val : d.toISOString();
}

types.setTypeParser(1114, parseTimestamp);
types.setTypeParser(1184, parseTimestamp);

const pool = new Pool({
    user:     env.DB_USER,
    host:     env.DB_HOST,
    database: env.DB_NAME,
    password: env.DB_PASSWORD,
    port:     env.DB_PORT,
});

export default pool;
