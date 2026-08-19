import { resetTestDb, closeTestDb } from './testDb';

// Jest's default per-hook timeout (5000ms) is tighter than resetTestDb's own
// transaction timeout (20000ms) — under load, the TRUNCATE ... CASCADE can
// legitimately take longer than 5s as the schema grows, and Jest kills the
// hook first, failing the test with no assertion ever having run. Match this
// to resetTestDb's own budget so a slow-but-successful reset doesn't read as
// a false failure.
beforeEach(async () => { await resetTestDb(); }, 25000);
afterAll(async ()  => { await closeTestDb(); });
