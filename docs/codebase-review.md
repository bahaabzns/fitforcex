# FitForce X — Codebase Review
**Reviewer:** Senior Full-Stack Engineer | **Date:** 2026-05-05  
**Stack:** Express 5 + PostgreSQL (`pg`) · Next.js 16 (React 19) · Tailwind 4

---

> **Executive Summary:** Decent bones. The workspace-scoped multi-tenancy is real, SQL injection is mostly shut down via parameterized queries throughout, and the subscription logic has thoughtful freeze/queue semantics. But there are multiple production-blocking issues — two of which are *actively leaking sensitive data to clients right now* — no migration system, no CI/CD, and effectively zero test coverage. I would not run this with real users' financial data until the critical issues are resolved.

---

## 1. Architecture & System Design

**Grade: C+** — Functional monolith, will crack at scale, fixable now.

### Critical Issues

**Schema migrations living inside route handlers** — every route file has a top-level IIFE that runs `ALTER TABLE` and `CREATE TABLE` statements on server startup. This is the single most dangerous architectural decision in the codebase.

```js
// server/routes/clients.js — runs every boot
;(async () => {
    try {
        await pool.query(`ALTER TABLE clients ADD COLUMN IF NOT EXISTS phones JSONB DEFAULT '[]'`);
        await pool.query(`ALTER TABLE clients DROP COLUMN IF EXISTS plain_password`);
        // ...more DDL...
    } catch (err) { console.error('clients bootstrap error:', err.message); }
})();
```

This means:
- Schema changes cannot be versioned, reviewed, or rolled back
- Two servers starting simultaneously can race on DDL
- Destructive ops (`DROP COLUMN`) can silently succeed with no audit trail
- You cannot reconstruct the current schema from the codebase alone

**Fix:** Adopt a real migration tool. `node-pg-migrate`, `Flyway`, or even a `migrations/` directory with numbered SQL files run by a dedicated `npm run migrate` script is fine. Kill all the IIFE DDL.

### Important Improvements

**No global error handler.** Unhandled promise rejections in route handlers currently return no response and may crash the process. Express 5 propagates async errors automatically, but only if there's a final error handler.

```js
// server/server.js — missing entirely
app.use((err, req, res, next) => {
    console.error(err);
    res.status(err.status ?? 500).json({ error: err.message ?? 'Internal server error' });
});
```

**Hardcoded port and CORS origin.** `server.js` has `const PORT = 4000` (ignores `process.env.PORT`) and CORS is hardcoded to `http://localhost:3000`. Both are time bombs when you deploy.

```js
// Current — breaks in any environment
const PORT = 4000;
server.use(cors({ origin: 'http://localhost:3000', credentials: true }));

// Fix
const PORT = process.env.PORT || 4000;
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
server.use(cors({ origin: ALLOWED_ORIGINS, credentials: true }));
```

**No API versioning.** Every breaking change to a route is immediately a production incident. Prefix routes with `/api/v1/` now while it's cheap.

### Nice to Haves

- The `server/` and `client/` split is clean — keep it
- Consider splitting the 13-route Express app into domain modules (auth, workspace, coaching, billing) as the team grows
- `server.js` loads routes inconsistently — some via `require` inline, some via named variables; pick one style

---

## 2. Security

**Grade: D** — Multiple active data leaks and weak secrets.

### Critical Issues

**[ACTIVE LEAK] Plaintext passwords returned in API responses.** Two endpoints return the raw password to the caller:

```js
// server/routes/clients.js:196 — POST /api/clients
res.status(201).json({ ...mapClient(result.rows[0]), tempPassword: password || null });

// server/routes/clients.js:354 — POST /api/clients/:id/set-password
res.json({ message: 'Password set successfully', tempPassword: password });
```

Any coach, trainer, or browser extension sitting on the network sees this password in plaintext. Remove `tempPassword` from both responses entirely. If you need to show it once on the UI, generate it client-side before sending and never echo it back.

**[ACTIVE LEAK] JWT token sent in login response body** in addition to the httpOnly cookie.

```js
// server/routes/auth.js:204
res.cookie('token', token, { httpOnly: true, ... })
   .status(200)
   .json({ message: 'Login successful', token, ... }); // ← token exposed in body
```

The whole point of `httpOnly` is that JavaScript can't read the token. Sending it in the body nullifies that. Remove `token` from the JSON response. The cookie is sufficient.

**`ADMIN_JWT_SECRET` is a public demo JWT payload.**

```
ADMIN_JWT_SECRET=eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyNDI2MjJ9.
```

This is the middle segment of the demo token from jwt.io — it is publicly known. Anyone can forge admin tokens. Replace immediately with `openssl rand -base64 64`.

**Cookies missing `secure` and `sameSite` flags.** Tokens will be sent over plain HTTP and are vulnerable to CSRF.

```js
// Current
res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 })

// Fix for production
res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
})
```

**Cross-workspace client login.** When no `workspace_slug` is provided, the client portal login queries ALL clients across ALL workspaces by email:

```js
// server/routes/clientPortal.js:58-61
const query = slug
    ? `SELECT c.* FROM clients c JOIN workspaces w ... WHERE c.email = $1 AND w.slug = $2`
    : 'SELECT * FROM clients WHERE email = $1'; // ← any workspace
```

A client with the same email in two workspaces will be authenticated into whichever row comes back first. This is an IDOR. Always require the workspace slug.

**No input validation on registration.** No email format check, no minimum password length, no name length limits. The register route blindly hashes whatever arrives and inserts it.

```js
// server/routes/auth.js:121-170
router.post('/register', async (req, res) => {
    const { fname, lname, email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10); // password can be ''
    // No validation before this point
```

Add a validation middleware (Zod or `express-validator`) at the route level.

**Stale permission data in JWT.** Permissions are baked into the 7-day JWT at login. If an owner changes a member's permissions, the member's token is still valid for up to 7 days with the old permissions. This is particularly bad for revocations.

Fix: either shorten the token TTL (e.g., 15 min + refresh token), or add a `permissions_version` counter to the DB and verify it on each request in `requirePermission`.

### Important Improvements

- Rate limiting only covers login endpoints — registration, form submission, and file uploads have no protection
- File upload MIME type check uses `path.extname()` only for images/PDFs but `file.mimetype` for videos — inconsistent and bypassable for images by renaming an executable to `.jpg`
- The proof-image LIKE query `WHERE proof_image LIKE $1` with `%${filename}` could match unintended rows if filenames share a suffix pattern; use exact match or store just the filename and reconstruct the path server-side

### Nice to Haves

- Add security headers (Helmet.js) — `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`
- Consider short-lived access tokens + refresh tokens to enable instant permission revocation
- Add audit log entries for failed authentication attempts, not just successful team operations

---

## 3. Performance & Scalability

**Grade: C** — Works fine at 50 clients, will visibly degrade at 500.

### Critical Issues

**Severe N+1 in client portal active-plan endpoint.** For a plan with C cycles, M meals per cycle, and I items per meal, this executes `1 + C + (C×M) + (C×M×I) + (C×M×I)` queries:

```js
// server/routes/clientPortal.js:142-195
const cycles = await Promise.all(
    cyclesResult.rows.map(async (cycle) => {
        const mealsResult = await pool.query(...); // N queries
        const mealsWithItems = await Promise.all(
            mealsResult.rows.map(async (meal) => {
                const itemsResult = await pool.query(...); // N×M queries
                const itemsWithAlts = await Promise.all(
                    itemsResult.rows.map(async (item) => {
                        const altsResult = await pool.query(...); // N×M×I queries
```

A plan with 3 cycles × 7 meals × 8 items = **168+ queries per page load**. Same pattern in `active-training-plan`. Fix with a single JOIN query:

```sql
SELECT tp.*, td.*, te.*, tset.*
FROM training_plans tp
JOIN training_days td ON td.plan_id = tp.id
JOIN training_exercises te ON te.day_id = td.id
LEFT JOIN training_sets tset ON tset.exercise_id = te.id
WHERE tp.client_id = $1 AND tp.status = 'active'
ORDER BY td.day_order, te.exercise_order, tset.set_order
```

Then reassemble the hierarchy in JavaScript — one query, same result.

**No pagination on list endpoints.** `GET /api/clients`, `GET /api/transactions`, `GET /api/training` all return unbounded result sets. A workspace with 1,000 clients fetches all 1,000 rows, all their transactions, all freezes, all plan activations, and computes subscription status in JS on every request.

**Subscription status recomputed in memory on every `GET /api/clients` call.** This involves 4 parallel queries and O(clients × transactions) JavaScript processing. At 500 clients with 3 transactions each, this is 1,500 objects processed on every list load.

Fix: persist `subscription_status` as a computed column (updated by a background job or on write), or at minimum add `LIMIT`/`OFFSET` pagination first.

### Important Improvements

**Race condition in client code generation:**

```js
// server/routes/clients.js:170-174
const codeResult = await pool.query(
    'SELECT COALESCE(MAX(client_code), 0) + 1 AS next_code FROM clients WHERE workspace_id = $1',
    [req.user.workspaceId]
);
```

Two concurrent `POST /api/clients` calls can read the same MAX and produce duplicate codes. Use a `SERIAL` column or a `SELECT ... FOR UPDATE` approach.

- Missing database indexes: there are no visible `CREATE INDEX` statements for high-frequency lookup columns like `clients.workspace_id`, `transactions.workspace_id`, `transactions.client_id`, `workspace_members.user_id`, or `training_plans.client_id`. Add them.
- `GET /api/clients` fires 4 parallel queries loading all data workspace-wide, then joins in JavaScript. A single CTE-based query would be more efficient.

### Nice to Haves

- Add Redis caching for `GET /api/clients` subscription statuses with TTL-based invalidation
- Consider read replicas for dashboard/stats queries as load grows

---

## 4. Code Quality & Maintainability

**Grade: C+** — Readable but inconsistent; several latent bugs.

### Critical Issues

**Wrong FK reference in transactions table DDL:**

```js
// server/routes/transactions.js:47
workspace_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
//                                             ^^^^ should be workspaces(id)
```

If this table was created from this IIFE, the FK points at `users`, not `workspaces`. Cascade delete fires when a user is deleted, not a workspace. The ON DELETE behaviour is completely wrong. Verify this against your actual DB schema immediately: `\d transactions` in psql.

**`lname.trim() !== undefined` is always `true`** — a string can never be `undefined`, so this condition is vacuous and the update always sets `lname`:

```js
// server/routes/auth.js:379
if (lname?.trim() !== undefined) updates.lname = lname.trim();
// Should be:
if (lname !== undefined) updates.lname = lname?.trim() ?? '';
```

**Duplicate subscription status logic.** The full calculation exists in `utils/subscriptionStatus.js` and is duplicated inside `routes/transactions.js` as `computePerTxStatuses`. These will drift.

### Important Improvements

**`buildToken` in auth.js has dead/contradictory code:**

```js
// server/routes/auth.js:70-75
if (!fallback.rows?.length && !fallback.length) {
    const anyWorkspace = fallback.rows ?? fallback;   // always fallback since rows is undefined
    if (!anyWorkspace.length) throw new Error('...');
}
const wsId = (fallback.rows ?? fallback)[0]?.id;
```

`pool.query()` always returns `{ rows, ... }` — `fallback.rows` is always defined. The `fallback.rows?.length` check will always be falsy when there are no rows. Simplify this.

**Magic strings everywhere** outside of the one validation array in transactions. Statuses like `'active'`, `'pending'`, `'completed'`, `'owner'`, `'manager'` are scattered across a dozen files. Extract to a shared `constants.js`.

**Inconsistent error response shape.** Some routes return `{ error: '...' }`, others return `{ message: '...' }` for the same HTTP status codes. Pick one and enforce it:

```js
// clients.js uses 'error'
res.status(500).json({ error: 'Internal server error' });

// workspaces.js uses 'message'
res.status(500).json({ message: 'Failed to fetch workspace' });

// auth.js uses 'message'  
res.status(500).json({ message: 'Registration failed' });
```

### Nice to Haves

- `normalizeSlug` is defined twice (auth.js and workspaces.js) — move to a shared util
- File upload cleanup on error is implemented in training.js (`deleteUploadedFile`) but not in transactions.js — if the DB insert fails after file upload, the orphaned file stays
- The `mapRow`/`mapClient` serializer pattern is good; apply it consistently everywhere

---

## 5. Multi-Tenancy & SaaS-Specific Concerns

**Grade: B-** — Tenant isolation exists at the query layer; plan enforcement has gaps.

### Critical Issues

The cross-workspace client login described in Section 2 is a data isolation violation. Fix it.

**`workspace_subscriptions` has no `starts_at`/`expires_at` columns** in the actual migration, but the admin route queries them:

```js
// server/routes/admin.js:226
ws.status AS subscription_status, ws.starts_at, ws.expires_at,
```

These columns return `null` because they don't exist, which means the admin panel is silently showing incomplete subscription data.

### Important Improvements

**Plan limit enforcement is checked before insert but not inside a transaction.** Two concurrent requests can both pass `checkSeatLimit`, then both insert, exceeding the limit. Wrap seat-limit check + insert in a single transaction with `SELECT ... FOR UPDATE` or use a DB-level constraint.

**No payment gateway integration.** Plans are assigned manually by admins. There's no Stripe (or equivalent), no webhook handling, no automatic plan downgrade when a subscription lapses. This means churn management, dunning, and plan enforcement all depend on manual admin action. This is fine for MVP but will become a support burden fast.

**Client subscription status is not persisted** — it's computed on-the-fly and never written back to `clients.subscription_status`, which the schema has. The column exists but is never updated from the computation. This means `SELECT subscription_status FROM clients` returns stale data.

### Nice to Haves

- Add a `workspace_audit_log` query endpoint so owners can view their own audit trail, not just admins
- Consider tenant-scoped feature flags (e.g., "beta_nutrition_v2") for controlled rollouts per workspace

---

## 6. API Design

**Grade: C** — Inconsistent conventions, no versioning, non-RESTful patterns.

### Critical Issues

**`PUT /api/transactions` takes the record ID in the request body, not the URL.**

```js
// server/routes/transactions.js:350
router.put('/', async (req, res) => {
    const { id, clientName, ... } = req.body; // id in body
```

**`DELETE /api/transactions` takes the ID in query string, not URL.**

```js
// server/routes/transactions.js:416
router.delete('/', async (req, res) => {
    const id = req.query.id; // ?id=X
```

These violate REST conventions and make these endpoints non-cacheable and awkward to use. They should be `PUT /api/transactions/:id` and `DELETE /api/transactions/:id`.

### Important Improvements

- No API versioning — add `/api/v1/` prefix now
- Error responses need a consistent schema (see Section 4)
- No rate limiting on mutation endpoints (only login has it)
- The `GET /api/auth/test` route is exposed in production — remove it

### Nice to Haves

- Generate an OpenAPI 3.0 spec — `swagger-jsdoc` or `tsoa` if you ever migrate to TypeScript
- Add `Content-Type: application/json` validation middleware so malformed bodies return 400 instead of silently processing undefined values

---

## 7. Database & Data Layer

**Grade: C** — Parameterized queries are great; everything else needs work.

### Critical Issues

**The transactions FK bug** (referenced in Section 4): `workspace_id REFERENCES users(id)` must be verified and corrected. This is data integrity risk.

**No migration system** (referenced in Section 1): schema is partially defined in `CREATE TABLE IF NOT EXISTS` blocks inside route IIFEs, partially in `scripts/migrate.js`. There is no single source of truth for the current schema.

### Important Improvements

**Missing indexes on high-cardinality FK columns.** There are no visible index creation statements anywhere. These are the minimum you need:

```sql
CREATE INDEX IF NOT EXISTS idx_clients_workspace_id ON clients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_transactions_workspace_id ON transactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_transactions_client_id ON transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_training_plans_client_id ON training_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);
```

**Soft deletes are inconsistent.** Workspaces use `archived_at` (soft delete). Clients, transactions, members use hard `DELETE`. Decide which tables need soft deletion for audit/billing purposes and apply it consistently.

**`checkWorkspaceLimit` query is logically incorrect.** It groups by `p.max_workspaces` and takes the first result, but a user could own workspaces on different plans if plan changes aren't handled atomically:

```js
// server/lib/seatLimits.js:27-36
// This aggregates across all owned workspaces and takes the lowest max_workspaces plan.
// It does not correctly represent "the user's current entitlement."
```

The intent is to check if the user can create another workspace. The correct check is: look up the plan of the workspace the user is currently acting in, and compare its `max_workspaces` to the number of workspaces the user owns.

### Nice to Haves

- Add `updated_at` columns with triggers to all mutable tables
- Consider using `TIMESTAMPTZ` consistently (the custom `parseTimestamp` in `db.js` suggests there were timezone issues — store all times as UTC and eliminate the workaround)
- Add a `CHECK` constraint on `transactions.status` and `transactions.type` at the DB level, not just in application code

---

## 8. DevOps, CI/CD & Observability

**Grade: D** — Nothing here. Manual everything.

### Critical Issues

**No CI/CD pipeline.** `.github/agents/` exists but contains only Claude agent instructions. Zero automated tests run on push. A broken commit goes straight to production.

**No structured logging.** All error reporting is `console.error(err)`. You cannot search, filter, or alert on these logs in production. Add `pino` or `winston`:

```js
// Instead of:
console.error(err);
res.status(500).json({ error: 'Internal server error' });

// Do:
logger.error({ err, userId: req.user?.userId, path: req.path }, 'Unhandled route error');
res.status(500).json({ error: 'Internal server error' });
```

**No error tracking.** There's no Sentry, Datadog, or equivalent. When a production error occurs, you will find out from a user complaint, not an alert.

### Important Improvements

- Add GitHub Actions: lint → test → build on every PR; deploy on merge to `main`
- Add a health check that actually tests the DB connection, not just `SELECT NOW()` (check a real table exists)
- Uploaded files are stored on disk local to the server — this breaks immediately with multiple server instances or a container restart. Move to S3 or equivalent object storage

### Nice to Haves

- Add `pino-http` middleware to log every request with method, path, status, and latency
- Set up database backups (pg_dump on a cron, off-site)
- Document deployment steps in `DEPLOY.md`

---

## 9. Frontend Quality

**Grade: B-** — Hard to fully assess without running the app, but the patterns visible in the API suggest some issues.

### Critical Issues

The `token` field in the login response body is consumed by the frontend — it should not exist (see Section 2). If the frontend is storing this token in `localStorage` or memory, it bypasses the httpOnly protection entirely.

### Important Improvements

- Verify that all API calls handle the loading, error, and empty states — the API returns consistent error structures only some of the time (see Section 4), which makes frontend error handling unreliable
- The client portal's deep N+1 queries (Section 3) will produce slow page loads — even if you fix the backend, add skeleton loading states for perceived performance

### Nice to Haves

- Audit for unnecessary re-renders in list views (clients list re-renders on every status computation)
- Add basic a11y: ensure form inputs have labels, buttons have accessible names, and focus management works in modals

---

## 10. Testing & Reliability

**Grade: F** — Two middleware unit tests. Nothing else.

### Critical Issues

There are exactly 2 test files (`requirePermission.test.js`, `requireOwner.test.js`), both testing middleware in isolation. Zero API integration tests exist.

Untested critical paths:
- User registration and login
- Workspace creation and isolation
- Subscription status computation (this is complex business logic)
- File upload authentication
- Client portal cross-workspace isolation
- Plan limit enforcement
- Ownership transfer transaction

### Important Improvements

Add integration tests for the 5 highest-risk paths first. Use `supertest` + a test PostgreSQL database:

```js
// Example — test that client A cannot access client B's data
it('should not return clients from another workspace', async () => {
    const wsA = await createTestWorkspace();
    const wsB = await createTestWorkspace();
    const client = await createClient(wsA.id);
    
    const res = await request(app)
        .get(`/api/clients/${client.id}`)
        .set('Cookie', `token=${wsB.token}`);
    
    expect(res.status).toBe(404); // not 200
});
```

### Nice to Haves

- Add the `subscriptionStatus.js` logic to unit tests — it's pure JS with no DB dependency and is the most complex business logic in the codebase
- Set a coverage threshold of 60% before allowing merges once you have a baseline

---

## 11. Documentation & Team Scalability

**Grade: C-** — `.github/agents/` exists for Claude; humans are underserved.

### Critical Issues

No `README.md` at the project root. A new developer cannot figure out how to run the project without asking someone.

No API documentation. The 13 route files with ~60+ endpoints are the only reference.

### Important Improvements

- Add a root `README.md` with: prerequisites, `npm install` steps for both `client/` and `server/`, environment variable list, how to run migrations, how to seed admin, how to start dev servers
- Document the subscription status state machine — the `computeSubscriptionStatus` logic with `on_first_plan`/`queued`/`custom` modes is non-obvious business logic that will confuse every new engineer
- Add a `.env.example` file with all required keys (no real values)

### Nice to Haves

- Add JSDoc to the public functions in `planEngine.js` and `subscriptionStatus.js`
- Document the permission matrix in a table in the README (not just in code)

---

## Top 10 Priority List

| # | Issue | Impact | Urgency |
|---|-------|--------|---------|
| 1 | **Remove plaintext `tempPassword` from API responses** | Data breach | Fix today |
| 2 | **Remove `token` from login response body** | Security bypass | Fix today |
| 3 | **Replace `ADMIN_JWT_SECRET` with a real secret** | Full admin takeover | Fix today |
| 4 | **Add `secure` + `sameSite: 'strict'` to cookies** | Token hijacking | Fix this week |
| 5 | **Fix cross-workspace client login (require slug always)** | IDOR / data leak | Fix this week |
| 6 | **Verify and fix FK: `transactions.workspace_id REFERENCES workspaces(id)`** | Data integrity | Fix this week |
| 7 | **Replace route-IIFE DDL with a real migration system** | Deployment safety | Fix this sprint |
| 8 | **Add pagination to `/api/clients` and `/api/transactions`** | Performance | Fix this sprint |
| 9 | **Fix N+1 queries in client portal plan endpoints** | Performance | Fix this sprint |
| 10 | **Add integration tests for auth, isolation, and subscription logic** | Regression safety | Fix this month |

---

## "If I Were Joining This Team Tomorrow"

### Week 1 — Stop the bleeding
1. Rotate all credentials: DB password, `JWT_SECRET`, `ADMIN_JWT_SECRET`. The current admin secret is a public JWT example. Treat all existing tokens as compromised.
2. Remove `tempPassword` from both client endpoints and `token` from login response.
3. Add `secure` + `sameSite: 'strict'` to all `res.cookie()` calls.
4. Require `workspace_slug` in client portal login — remove the global lookup.
5. Run `\d transactions` in psql and verify the `workspace_id` FK actually points to `workspaces`.

### Month 1 — Stabilize the foundation
6. Install `node-pg-migrate` (or equivalent). Move all `CREATE TABLE`, `ALTER TABLE`, and `CREATE INDEX` statements out of route files and into versioned migration files. Delete every IIFE DDL block.
7. Add a global error handler to `server.js`.
8. Add `pino` for structured logging + Sentry for error tracking.
9. Add `supertest` integration tests covering: auth flow, workspace isolation, subscription status computation, and file upload auth. Aim for coverage of the 5 critical paths.
10. Add `LIMIT`/`OFFSET` pagination to clients, transactions, and training plan list endpoints.

### Quarter 1 — Build for growth
11. Refactor the client portal plan-loading endpoints to single JOIN queries — eliminate the N+1.
12. Set up a GitHub Actions pipeline: lint + test on PR, deploy on merge to `main`.
13. Move file uploads from local disk to S3 (or Cloudflare R2). The current setup breaks with any horizontal scaling.
14. Integrate a payment gateway (Stripe). Manual plan assignment is not sustainable.
15. Write the `README.md` and an `.env.example`. Document the subscription state machine. Make it possible for a new engineer to be productive in under a day.
