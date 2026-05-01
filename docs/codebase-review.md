# FitForce X — Codebase Review
**Reviewer:** Senior Full-Stack Engineer | **Date:** 2026-04-30  
**Stack:** Next.js 16 + Express 5 + PostgreSQL (pg driver)

---

> **Executive Summary:** Decent bones. The architecture is straightforward, DB queries are parameterized throughout, tenant isolation exists on most routes, and the subscription logic is actually well-thought-out with good inline docs. But there are multiple production-blocking security issues — two of which are *currently leaking sensitive user data* — and the codebase has zero tests and no proper migration system. This is not yet safe to run with real users' financial data.

---

## 1. Architecture & System Design

**Grade: C+**  
Monolithic Express with flat route files. Serviceable for a 0→1 but will hit walls at growth.

### Critical Issues
- **No migration system.** Schema is bootstrapped via `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE ADD COLUMN IF NOT EXISTS` inside route-module IIFEs that run on every server start. This is one bad deploy away from silent data loss or partial migrations that corrupt state.
  ```js
  // server/routes/transactions.js — runs on every process start
  ;(async () => {
      await pool.query(`CREATE TABLE IF NOT EXISTS transactions (...)`);
      await pool.query(`ALTER TABLE transactions ADD COLUMN IF NOT EXISTS client_id ...`);
  })();
  ```
  **Fix:** Use a proper migration tool — Flyway, node-pg-migrate, or even plain numbered SQL files run by a `migrate` npm script before server start. Never let application code own schema shape.

### Important Improvements
- **No service layer.** Business logic (subscription computation, client creation, freeze validation) lives directly in route handlers. When you need to send an email on subscription creation or add webhooks, you'll be copy-pasting. Extract a `services/` layer now while the surface is still small.
- **PORT hardcoded** in `server/server.js` line 7: `const PORT = 4000` — ignores `process.env.PORT`. One line fix.
- **CORS origin hardcoded** to `'http://localhost:3000'`. This needs to be `process.env.CORS_ORIGIN` before any staging/production deploy.

### Nice to Haves
- No API versioning (`/v1/`). Fine for now, painful to retrofit later.
- No TypeScript. The codebase is medium-complexity enough that TS would catch real bugs (wrong field names, missing null checks).

---

## 2. Security

**Grade: D**  
Parameterized queries everywhere (good), but multiple active vulnerabilities affecting user data today.

### Critical Issues

**[SEC-1] Plaintext passwords stored AND returned in every client API response.**  
`plain_password` is inserted into the database (clients.js:174) and then returned verbatim in every `GET /api/clients` and `GET /api/clients/:id` response via `mapClient()`.

```js
// server/routes/clients.js:58 — inside mapClient(), called on every clients response
plain_password: row.plain_password,

// server/routes/clients.js:174 — INSERT
[nextCode, firstName, ..., hashedPassword, password || null]
//                                         ^^^^^^^^^^^^^^ raw plaintext
```

Every coach's API response currently sends every client's raw password over the wire to the browser. Any XSS, MITM, or log scraping exposes all passwords immediately. This also means you can never tell a client "your password is secure" — it literally isn't.

**Fix:**
1. Drop the `plain_password` column entirely.
2. Remove it from `mapClient()`.
3. If coaches need to reset passwords, generate a temporary token; don't store plaintext.
```sql
ALTER TABLE clients DROP COLUMN plain_password;
```

---

**[SEC-2] Transaction proof images are publicly accessible — no authentication on `/uploads`.**  
`server/server.js:20` serves the entire uploads directory as a static folder with zero access control. These are *financial transaction proof images* (bank transfers, payment receipts).

```js
// server/server.js:20
server.use('/uploads', express.static(path.join(__dirname, 'uploads')));
```

Anyone on the internet who can guess or enumerate a filename (e.g. `proof_1714000000000_abc123.jpg`) can download it. Filenames use `Date.now()` which has ~1000 values/second — not hard to brute-force a time window.

**Fix:** Remove the static serve. Add an authenticated route that checks ownership before streaming:
```js
// server/routes/transactions.js
router.get('/proof/:filename', authMiddleware, async (req, res) => {
    const { filename } = req.params;
    const result = await pool.query(
        'SELECT id FROM transactions WHERE proof_image LIKE $1 AND coach_id = $2',
        [`%${filename}`, req.user.id]
    );
    if (!result.rows.length) return res.status(403).json({ error: 'Forbidden' });
    res.sendFile(path.join(__dirname, '../uploads/transactions', filename));
});
```

---

**[SEC-3] Client portal login can return the wrong client — potential cross-tenant IDOR.**  
`clientPortal.js:54` queries `WHERE email = $1` with no `coach_id` filter. The `clients` table has no unique constraint on `email` globally. If Coach A and Coach B each have a client with `alice@example.com`, whichever row the DB returns first wins — Alice could authenticate as the other coach's client record and see their data.

```js
// server/routes/clientPortal.js:54
const result = await pool.query('SELECT * FROM clients WHERE email = $1', [email]);
// Returns first matching row across ALL coaches
```

**Fix:** Require email + client_code (which is unique per coach) for portal login, or add a `UNIQUE(email)` constraint globally. At minimum, document the current behavior explicitly because it's a latent bug waiting for your first duplicate email.

---

### Important Improvements

**[SEC-4] No rate limiting anywhere.**  
Both `/api/auth/login` and `/api/client-portal/login` are wide open to brute force. Add `express-rate-limit`:
```js
const rateLimit = require('express-rate-limit');
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });
router.post('/login', loginLimiter, async (req, res) => { ... });
```

**[SEC-5] JWT/Cookie expiry mismatch.**  
`auth.js:60`: `jwt.sign({...}, secret, { expiresIn: '1h' })` — JWT is valid 1 hour.  
`auth.js:62`: `res.cookie('token', token, { maxAge: 7*24*60*60*1000 })` — cookie lives 7 days.

After 1 hour the cookie is still sent but the JWT is expired. The `/api/auth/me` check will fail and redirect to login — a confusing UX cliff. Either make both 7 days, or implement refresh tokens.

**[SEC-6] Cookie security flags missing.**  
```js
// auth.js — current
res.cookie('token', token, { httpOnly: true, maxAge: ... })

// Should be
res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: ...,
})
```
Without `sameSite: 'strict'`, CSRF attacks can trigger state-changing requests using the victim's session cookie.

**[SEC-7] Same JWT secret signs both coach and client tokens.**  
A coach's `token` and a client's `client_token` are both signed with the same `JWT_SECRET`. This is a token confusion risk: in theory, a client token could be presented to a coach-only endpoint if the middleware logic ever changes. Use separate secrets:
```
JWT_COACH_SECRET=...
JWT_CLIENT_SECRET=...
```

**[SEC-8] `/api/db-test` is a public unauthenticated endpoint.**  
```js
// server/server.js:40
server.get('/api/db-test', async (req, res) => {
    await pool.query('SELECT NOW()')
    res.status(200).json({message: 'Database connection successful'})
})
```
Low risk in isolation but confirms the DB is live to anyone probing. Delete it or gate it behind `authMiddleware`.

**[SEC-9] `/api/auth/register` has zero input validation.**  
```js
router.post('/register', async (req, res) => {
    const { fname, lname, email, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);  // password could be undefined
    await pool.query('INSERT INTO users (fname, lname, email, password) VALUES ($1,$2,$3,$4)...', [fname, lname, email, hashed])
```
`password` can be `undefined`, `bcrypt.hash(undefined, 10)` will throw and return a 500, leaking that registration attempted. No email format check, no minimum password length, `email` goes straight to DB without trim. Add explicit validation before the hash:
```js
if (!email?.includes('@')) return res.status(400).json({ message: 'Invalid email' });
if (!password || password.length < 8) return res.status(400).json({ message: 'Password must be 8+ characters' });
```

**[SEC-10] Token returned in login response body AND the HttpOnly cookie.**  
```js
// auth.js:65
res.cookie('token', token, { httpOnly: true, ... })
  .status(200).json({ message: 'Login successful', token });  // <-- why?
```
Sending the JWT in the JSON body defeats the point of HttpOnly — it's now accessible to JS. The cookie is already sent. Remove `token` from the JSON response.

### Nice to Haves
- No CSRF tokens (mitigated partially by `sameSite: strict` once added).
- File upload MIME check is extension-based only — a `.jpg` file that is actually a PHP script would pass. Add magic-byte validation with a library like `file-type`.
- No password strength enforcement beyond `>= 6 chars` in the client portal (server doesn't enforce even that).
- GDPR: no data export or deletion endpoints.

---

## 3. Performance & Scalability

**Grade: C**  
The `GET /api/clients` route is architecturally sound (4 parallel queries, then in-memory join). Client portal is not.

### Critical Issues
None that are fires today, but one that becomes one at scale:

### Important Improvements

**[PERF-1] N+1 query explosion in client portal training/nutrition plan endpoints.**  
Looking at the pattern across `clientPortal.js` for training/nutrition — for a plan with 5 days × 5 exercises each, this fires 1 + 5 + 25 + 25 = 56 queries instead of 3-4 with JOINs. At 100 concurrent clients loading their plans, that's 5,600 queries/second against Postgres.

**Fix:** Fetch all days + exercises + sets in 3 queries, then assemble in JS:
```js
const [days, exercises, sets] = await Promise.all([
    pool.query(`SELECT * FROM training_plan_days WHERE plan_id = $1`, [planId]),
    pool.query(`SELECT e.* FROM plan_exercises e JOIN training_plan_days d ON d.id = e.day_id WHERE d.plan_id = $1`, [planId]),
    pool.query(`SELECT s.* FROM exercise_sets s JOIN plan_exercises e ON e.id = s.exercise_id JOIN training_plan_days d ON d.id = e.day_id WHERE d.plan_id = $1`, [planId]),
]);
```

**[PERF-2] `computeSubscriptionStatus` called per-client on every `GET /api/clients`.**  
With 100 clients per coach, `GET /api/clients` calls `computeSubscriptionStatus()` 100 times — each iterating through all transactions and freezes. The queries are already batched in parallel (good), but the computation runs synchronously in JS. At 1000 clients per coach this becomes noticeable. The subscription status is already persisted to the DB column `subscription_status` — use it as a cache and refresh it only when transactions/freezes change.

**[PERF-3] `GET /api/transactions` loads ALL transactions for the coach with no pagination.**  
A coach with 500 clients and 3 transactions each sends 1,500 rows to the browser in one response. Add limit/offset:
```js
const { page = 1, limit = 50 } = req.query;
const offset = (page - 1) * limit;
// ... WHERE coach_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3
```

**[PERF-4] Missing database indexes.**  
The bootstrap code creates tables but never creates indexes. Every `WHERE coach_id = $1` is a full table scan on a growing table.
```sql
CREATE INDEX IF NOT EXISTS idx_transactions_coach_id      ON transactions(coach_id);
CREATE INDEX IF NOT EXISTS idx_transactions_client_id     ON transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_clients_coach_id           ON clients(coach_id);
CREATE INDEX IF NOT EXISTS idx_clients_email              ON clients(email);
CREATE INDEX IF NOT EXISTS idx_subscription_freezes_client ON subscription_freezes(client_id);
CREATE INDEX IF NOT EXISTS idx_training_plans_client_id   ON training_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_nutrition_plans_client_id  ON nutrition_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_form_requests_client_status ON form_requests(client_id, status);
```

### Nice to Haves
- No Redis/memory cache for subscription status (not needed yet, but the hook should be there).
- `Date.now()` in filenames means 1ms collisions possible under load — use `crypto.randomUUID()` instead.

---

## 4. Code Quality & Maintainability

**Grade: B-**  
Readable code, consistent patterns, no obvious spaghetti. Main issues are structural.

### Important Improvements

**[QUAL-1] Schema management belongs outside application code.**  
As covered in Architecture: `CREATE TABLE IF NOT EXISTS` + `ALTER TABLE ADD COLUMN IF NOT EXISTS` inside route IIFEs is an antipattern. It means you cannot roll back migrations, cannot tell what the DB state was at any given commit, and any error in the bootstrap silently continues (`catch (err) => { console.error(err.message) }`).

**[QUAL-2] Sequential client codes are business-logic-critical and race-condition-prone.**  
```js
// clients.js:151-152
const codeResult = await pool.query(
    'SELECT COALESCE(MAX(client_code), 0) + 1 AS next_code FROM clients WHERE coach_id = $1',
    [req.user.id]
);
```
Two concurrent client creations for the same coach will read the same `MAX` and insert duplicate codes. Fix with a `SERIAL` per-coach sequence or wrap in a transaction with a `SELECT ... FOR UPDATE`.

**[QUAL-3] Inconsistent field naming `workspace_id` vs `coach_id`.**  
The forms route uses `workspace_id` in queries but populates it with `req.user.id` (the coach's ID). This naming suggests a future multi-workspace design that isn't implemented — but in the meantime it confuses anyone reading the code.

**[QUAL-4] Magic strings for statuses, types, and modes scattered across files.**  
```js
// transactions.js
const VALID_STATUSES = ['completed', 'refunded'];
const VALID_TYPES = ['subscription', 'session', 'one-time', 'other'];
```
These are defined per-file and not shared. When you add a new status you'll forget to update one of them. Centralize in `server/constants.js`.

**[QUAL-5] `console.log` / `console.error` everywhere with no structure.**  
Auth registration logs the registered user object: `console.log('Registration successful:', result.rows[0])` — that's the user's DB row including their email in plain text to stdout. Use a proper logger with log levels and redact sensitive fields.

### Nice to Haves
- No JSDoc on any of the utility functions.
- `subscriptionStatus.js` is actually well-commented — that standard should apply everywhere.

---

## 5. Multi-Tenancy & SaaS-Specific Concerns

**Grade: B-**  
Tenant isolation (coach_id checks) is present on most routes. The critical gap is the client portal.

### Critical Issues
- **[SEC-3 repeated]** Client portal login doesn't scope by coach — covered above.

### Important Improvements

**[MT-1] Subscription status persisted to DB but computed fresh on every read.**  
`subscription_status` exists as a column in `clients` but is always overwritten by the computed value in the GET response. The column is essentially unused as a persistent cache, meaning a future background job can't rely on it to find "all clients whose subscription expired today" without re-running all the computation. Decide: either use it as a persistent field (updated on transaction/freeze write) or remove the column and only ever compute it on read.

**[MT-2] No plan/feature gates enforced server-side.**  
There's no concept of subscription tiers, client limits, or feature gating in any route. If this is a SaaS with paid plans, a coach on a "5 clients" plan can add 500 clients today without any check. Even if that's not the pricing model now, the hook needs to exist at the service layer, not bolted onto the UI later.

**[MT-3] File uploads not scoped per-coach.**  
All proof images go to `/uploads/transactions/` with no coach-level directory. There's no way to quickly audit "all files belonging to coach X" or bulk-delete a churned coach's data.

### Nice to Haves
- No onboarding state tracking (first client created, first plan activated, etc.) — useful for activation funnel analytics.
- No audit log of plan activations, subscription changes, etc.

---

## 6. API Design

**Grade: C+**

### Important Improvements

**[API-1] No versioning.** All routes under `/api/` with no version prefix. The first breaking change forces a flag day.

**[API-2] PUT `/api/transactions` takes `id` in the body, not the URL.**
```js
router.put('/', async (req, res) => {
    const { id, ... } = req.body;
```
This isn't REST. The resource identifier belongs in the path: `PUT /api/transactions/:id`. Same issue in similar routes.

**[API-3] DELETE `/api/transactions` uses a query param `?id=X`.**
```js
router.delete('/', async (req, res) => {
    const id = req.query.id;
```
Should be `DELETE /api/transactions/:id`. Query params on DELETE are unconventional and some HTTP clients/proxies drop them.

**[API-4] No consistent error envelope.** Some routes return `{ error: '...' }`, others return `{ message: '...' }`. Pick one shape and standardize it across every error response.

**[API-5] No rate limiting, no API documentation (OpenAPI/Swagger).**

### Nice to Haves
- `GET /api/clients` returns all clients with no filtering or pagination.

---

## 7. Database & Data Layer

**Grade: C**

### Critical Issues
- **[DB-1] No formal migration system** — covered in Architecture.
- **[DB-2] `plain_password` column** — covered in Security.

### Important Improvements

**[DB-3] No check constraints on enum-like TEXT columns.**  
`status`, `type`, `start_mode` are validated in app code but not at the DB level. A direct SQL insert or a bug bypasses the validation silently.
```sql
ALTER TABLE transactions ADD CONSTRAINT chk_tx_status
    CHECK (status IN ('completed', 'refunded'));
ALTER TABLE transactions ADD CONSTRAINT chk_tx_type
    CHECK (type IN ('subscription', 'session', 'one-time', 'other'));
```

**[DB-4] No unique constraint on client email within a coach scope.**  
```sql
ALTER TABLE clients ADD CONSTRAINT uq_client_email_per_coach UNIQUE (coach_id, email);
```
Currently a coach can create two clients with the same email. The client portal lookup (`WHERE email = $1`) would then behave unpredictably.

**[DB-5] Inconsistent cascade behavior.**  
`transactions` has `ON DELETE CASCADE` for `coach_id` (deleting a coach wipes all their transactions). `client_id` uses `ON DELETE SET NULL`. This means deleting a client preserves all their transaction history with `client_id = NULL` — probably intentional, but the `by-client` query then has to do a `ILIKE` name match fallback which is fragile and locale-sensitive.

**[DB-6] No `updated_at` on any table.**  
Impossible to tell when a record last changed. Add it with a trigger or update it in every UPDATE handler.

**[DB-7] Subscription freeze validation gap.**  
`freezeDurationDays` is validated as a positive integer in the route, but there's no check that `freeze_start_date` falls within an active subscription period. A freeze starting after the subscription ends silently extends nothing but is still stored.

### Nice to Haves
- `client_code` sequential generation is a race condition (covered in QUAL-2).
- No soft deletes — deleted clients are gone forever with no recovery path.

---

## 8. DevOps, CI/CD & Observability

**Grade: D**

### Critical Issues
- **No CI/CD pipeline.** No `Dockerfile`, no `docker-compose.yml`, no GitHub Actions / CircleCI config. Every deploy is presumably manual.

### Important Improvements
- **No structured logging.** Every log is `console.log`/`console.error` printing raw objects. In production these become unqueryable noise. Adopt `pino` or `winston` with JSON output and log levels immediately.
- **No error tracking.** No Sentry, no Rollbar. You'll find out about production errors when a user complains.
- **No health check beyond `/api/health`.** The health endpoint doesn't check DB connectivity. Add:
  ```js
  server.get('/api/health', async (req, res) => {
      try {
          await pool.query('SELECT 1');
          res.json({ status: 'ok', db: 'ok' });
      } catch {
          res.status(503).json({ status: 'error', db: 'unreachable' });
      }
  });
  ```
- **Environment variable schema not validated at startup.** If `JWT_SECRET` is missing, the server starts and then crashes on first login. Add startup validation:
  ```js
  const required = ['JWT_SECRET', 'DB_USER', 'DB_PASSWORD', 'DB_NAME'];
  for (const key of required) {
      if (!process.env[key]) throw new Error(`Missing required env var: ${key}`);
  }
  ```

### Nice to Haves
- No automated DB backups visible.
- No rollback strategy documented.

---

## 9. Frontend Quality

**Grade: C+**

### Important Improvements

**[FE-1] Auth layout has a flash of unauthenticated content.**
```js
// app/(coach)/layout.js
useEffect(() => {
    const checkAuth = async () => {
        try {
            await api.get('/api/auth/me');
            setLoading(false);
        } catch (err) {
            router.push('/login');
        }
    };
    checkAuth();
}, [router]);
```
Until the `await` resolves, `loading` is `false` and children render. Reverse the default: start with `loading = true`, set `false` only on successful auth. Also this fires on every navigation — use Next.js middleware (`middleware.ts`) for server-side auth redirect instead.

**[FE-2] Login errors are swallowed silently.**
```js
// app/(auth)/login/page.js
} catch (err) {
    console.log(err);  // user sees nothing
}
```
The user gets no feedback on wrong credentials. This is both a UX failure and a debugging nightmare.

**[FE-3] No Axios interceptors for global error handling or 401 redirect.**  
Every component reinvents the error handling wheel. Add a response interceptor in `lib/axios.js`:
```js
api.interceptors.response.use(
    res => res,
    err => {
        if (err.response?.status === 401) router.push('/login');
        return Promise.reject(err);
    }
);
```

**[FE-4] API URL is `NEXT_PUBLIC_` prefixed.**  
`NEXT_PUBLIC_API_URL` is baked into the client bundle. This is correct for client-side calls but means the URL is visible in the compiled JS — not a security issue for a backend URL, but worth noting.

### Nice to Haves
- No loading skeletons visible — just blank states.
- No global error boundary.
- No accessibility audit (a11y).

---

## 10. Testing & Reliability

**Grade: F**  
Zero automated tests. The `test` script in both `package.json` files prints an error message.

### Critical Issues
- **No tests.** None. Zero coverage on auth, billing, subscription computation, CRUD operations.

### Important Improvements
The one function that most deserves tests is `computeSubscriptionStatus` — it handles all the subscription timeline edge cases and it's pure JS, so it's trivially testable:
```js
// test/subscriptionStatus.test.js
describe('computeSubscriptionStatus', () => {
    test('returns Pre-start with no transactions', () => {
        expect(computeSubscriptionStatus([], [], null)).toBe('No Subscriptions');
    });
    test('returns Active for current subscription', () => {
        const tx = [{
            status: 'completed', duration: 30,
            start_mode: 'custom',
            subscription_start_date: new Date(Date.now() - 5 * 86400000),
            created_at: new Date(),
        }];
        expect(computeSubscriptionStatus(tx, [], null)).toBe('Active');
    });
    // ... freeze scenarios, queued chains, refunded transactions
});
```

Add `vitest` or `jest`, start here, then cover the auth routes with supertest integration tests.

---

## 11. Documentation & Team Scalability

**Grade: B-**  
`subscription-logic.md` is genuinely good — detailed, accurate, covers edge cases. That standard needs to apply to the rest of the codebase.

### Important Improvements
- No README at the project root. There's no "how to run this locally" guide.
- No API documentation. No Swagger, no Postman collection, nothing.
- No `CONTRIBUTING.md` or `ARCHITECTURE.md`.
- The forms system (form requests, scheduling, post-actions) has zero documentation despite being non-trivial logic.

---

## Top 10 Priority List

| # | Issue | Severity | Effort | Impact |
|---|-------|----------|--------|--------|
| 1 | **[SEC-1]** Drop `plain_password` — currently leaking raw passwords in every clients API response | 🔴 CRITICAL | 30 min | Stops active data exposure |
| 2 | **[SEC-2]** Gate `/uploads` behind auth — transaction proof images are world-readable | 🔴 CRITICAL | 2 hrs | Stops active data exposure |
| 3 | **[SEC-3]** Fix client portal login `WHERE email = $1` — scope to coach + add email uniqueness constraint | 🔴 CRITICAL | 1 hr | Fixes cross-tenant IDOR |
| 4 | **[SEC-4]** Add `express-rate-limit` to both login endpoints | 🔴 HIGH | 30 min | Stops brute-force attacks |
| 5 | **[SEC-5/6]** Fix cookie flags (`sameSite: 'strict'`, `secure`) + JWT/cookie expiry alignment | 🔴 HIGH | 1 hr | CSRF protection + correct session behavior |
| 6 | **[SEC-9]** Add input validation to `/api/auth/register` | 🟠 HIGH | 1 hr | Prevents 500s and bad data |
| 7 | **[DB-1/QUAL-1]** Replace inline schema bootstrap with a proper migration system | 🟠 HIGH | 1 day | Makes deploys safe |
| 8 | **[PERF-2/4]** Add DB indexes + fix N+1 in client portal plans | 🟠 HIGH | 2 hrs | Prevents performance degradation at scale |
| 9 | **[API-2/3]** Fix PUT/DELETE to use path params not body/query | 🟡 MEDIUM | 2 hrs | Correctness + forwards-compatibility |
| 10 | **[TEST]** Add `vitest` and start with `subscriptionStatus` unit tests | 🟡 MEDIUM | 1 day | Foundation for reliability |

---

## "If I Were Joining This Team Tomorrow"

### Week 1 — Stop the bleeding
1. **PR #1:** Drop `plain_password` column. Remove from `mapClient()`. Write a migration.
2. **PR #2:** Gate `/uploads` with auth middleware. Remove the `express.static` line.
3. **PR #3:** Fix client portal login query. Add `UNIQUE(coach_id, email)` constraint.
4. **PR #4:** Add `express-rate-limit` to both login endpoints. Fix cookie flags (`sameSite`, `secure`). Fix JWT/cookie expiry to 7d/7d.
5. **Rotate** the current JWT secret and DB password — even if `.env` isn't in git, the values are known to anyone who's seen the repo.

### Month 1 — Make it safe to ship
6. Adopt `node-pg-migrate`. Convert all the inline `CREATE TABLE IF NOT EXISTS` blocks into numbered migration files.
7. Add `pino` for structured logging. Remove all `console.log` that touches user data.
8. Add `express-validator` or `zod` — at minimum on register, client create, and transaction create.
9. Write 20 unit tests for `computeSubscriptionStatus` covering all the edge cases in `subscription-logic.md`.
10. Add startup env-var validation. Add a real health check that pings the DB.
11. Fix the REST violations in `PUT /api/transactions` and `DELETE /api/transactions`.
12. Add the 8 missing DB indexes listed in PERF-4.

### Quarter 1 — Make it ready to grow
13. Extract a `services/` layer: `subscriptionService.js`, `clientService.js`, `transactionService.js`. Move business logic out of route handlers.
14. Add integration tests for the core flows: auth, client create, transaction create, subscription status computation.
15. Set up CI (GitHub Actions): lint, test, schema validation on every PR.
16. Add Sentry (or equivalent) for production error tracking.
17. Implement API versioning with `/v1/` prefix.
18. Implement proper feature gates for plan limits (client count cap, etc.) in the service layer — do not leave this as UI-only.
19. Migrate to TypeScript — start with the server and the domain objects.
20. Write the README, the API docs (Postman collection is fine), and document the forms system.

---

*The bones are fine. The patterns are consistent. The subscription logic is actually thoughtfully designed and documented. But there are active data exposure bugs in production-candidate code that need to be fixed before any real user data touches this system. Fix those five things first, then the rest is velocity.*
