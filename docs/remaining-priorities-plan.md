# FitForce X — Remaining Priority List & Implementation Plan
**Follows:** Top 10 from `codebase-review.md` (all completed)  
**Date:** 2026-05-06

---

## Remaining Priority List

| # | Issue | Section | Urgency |
|---|-------|---------|---------|
| 11 | **Add global error handler to `server.js`** | Architecture | Fix this week |
| 12 | **Fix hardcoded `PORT` and `CORS` origin** | Architecture | Fix this week |
| 13 | **Fix REST violations: `PUT`/`DELETE /api/transactions`** | API Design | Fix this week |
| 14 | **Add input validation on registration** | Security | Fix this week |
| 15 | **Fix `lname.trim() !== undefined` always-true bug** | Code Quality | Fix this week |
| 16 | **Remove `GET /api/auth/test` from production** | Security | Fix this week |
| 17 | **Add database indexes on FK columns** | Performance / DB | Fix this sprint |
| 18 | **Fix race condition in client code generation** | Performance | Fix this sprint |
| 19 | **Standardize error response shape (`error` vs `message`)** | Code Quality | Fix this sprint |
| 20 | **Extract magic strings to `constants.js`** | Code Quality | Fix this sprint |
| 21 | **Add Helmet.js security headers** | Security | Fix this sprint |
| 22 | **Add rate limiting to all mutation endpoints** | Security | Fix this sprint |
| 23 | **Fix stale JWT permissions (shorten TTL or version counter)** | Security | Fix this sprint |
| 24 | **Add API versioning prefix `/api/v1/`** | Architecture | Fix this sprint |
| 25 | **Fix seat-limit race condition (SELECT FOR UPDATE)** | Multi-tenancy | Fix this sprint |
| 26 | **Persist `subscription_status` to DB column** | Performance | Fix this month |
| 27 | **Set up GitHub Actions CI/CD pipeline** | DevOps | Fix this month |
| 28 | **Add structured logging (pino) + error tracking (Sentry)** | DevOps | Fix this month |
| 29 | **Move file uploads from disk to S3 / Cloudflare R2** | DevOps | Fix this month |
| 30 | **Add `README.md` and `.env.example`** | Documentation | Fix this month |
| 31 | **Fix `checkWorkspaceLimit` query logic** | DB | Fix this month |
| 32 | **Add `workspace_subscriptions.starts_at` / `expires_at` columns** | Multi-tenancy | Fix this month |
| 33 | **Integrate Stripe payment gateway** | Multi-tenancy | Quarter 1 |
| 34 | **Soft-delete consistency across all tables** | DB | Quarter 1 |
| 35 | **Document subscription state machine + permission matrix** | Documentation | Quarter 1 |

---

## Step-by-Step Implementation Plan

---

### Priority 11 — Global Error Handler

**File:** `server/server.js`

1. Open `server/server.js`.
2. After all `app.use(router)` lines and before `server.listen`, add:

```js
// Must be last — Express identifies error handlers by 4-arg signature
app.use((err, req, res, next) => {
    const status = err.status ?? err.statusCode ?? 500;
    console.error({ err, path: req.path, userId: req.user?.userId });
    res.status(status).json({ error: err.message ?? 'Internal server error' });
});
```

3. Remove any bare `try/catch` blocks that end with `console.error` + `res.status(500)` and replace them with `next(err)` — Express 5 already propagates async throws, but explicit `next(err)` is still best practice.

---

### Priority 12 — Hardcoded PORT and CORS Origin

**File:** `server/server.js`

1. Replace the hardcoded `PORT` constant:

```js
// Before
const PORT = 4000;

// After
const PORT = process.env.PORT || 4000;
```

2. Replace the hardcoded CORS origin:

```js
// Before
app.use(cors({ origin: 'http://localhost:3000', credentials: true }));

// After
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
app.use(cors({
    origin: (origin, cb) => {
        if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: ${origin} not allowed`));
    },
    credentials: true,
}));
```

3. Add `ALLOWED_ORIGINS` to `.env.example`:

```
ALLOWED_ORIGINS=http://localhost:3000
```

---

### Priority 13 — Fix REST Violations in Transactions

**File:** `server/routes/transactions.js`

**Problem:** `PUT /api/transactions` reads `id` from `req.body`; `DELETE /api/transactions` reads `id` from `req.query`.

1. Change the PUT route signature:

```js
// Before
router.put('/', async (req, res) => {
    const { id, ... } = req.body;

// After
router.put('/:id', async (req, res) => {
    const id = parseInt(req.params.id);
    const { ... } = req.body; // id removed from body
```

2. Change the DELETE route signature:

```js
// Before
router.delete('/', async (req, res) => {
    const id = req.query.id;

// After
router.delete('/:id', async (req, res) => {
    const id = parseInt(req.params.id);
```

3. Update the frontend calls in `client/` that reference these endpoints. Search for `DELETE /api/transactions` and `PUT /api/transactions` in the frontend and update the URL to include the ID in the path.

4. Verify no other routes in `transactions.js` use the same pattern.

---

### Priority 14 — Input Validation on Registration

**File:** `server/routes/auth.js`

1. Install the validation library:

```bash
npm install zod
```

2. Add a shared schema near the top of `auth.js`:

```js
const { z } = require('zod');

const registerSchema = z.object({
    fname: z.string().min(1).max(50),
    lname: z.string().min(1).max(50),
    email: z.string().email(),
    password: z.string().min(8).max(128),
});
```

3. At the top of the `POST /register` handler, validate before any DB work:

```js
router.post('/register', async (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
    }
    const { fname, lname, email, password } = parsed.data;
    // ... rest of handler unchanged
```

4. Do the same for `POST /login` — validate `email` and `password` are non-empty strings before hitting the DB.

5. Consider creating `server/middleware/validate.js` as a reusable wrapper:

```js
const validate = (schema) => (req, res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ error: parsed.error.errors[0].message });
    }
    req.body = parsed.data;
    next();
};
module.exports = validate;
```

---

### Priority 15 — Fix `lname.trim() !== undefined` Bug

**File:** `server/routes/auth.js` (profile update route, around line 379)

1. Find the profile update block that reads:

```js
if (lname?.trim() !== undefined) updates.lname = lname.trim();
```

2. Replace with the correct guard:

```js
if (lname !== undefined) updates.lname = lname?.trim() ?? '';
```

3. Audit every other field in that same block for the same pattern — `fname`, `email`, etc. — and apply the same fix where needed.

---

### Priority 16 — Remove `GET /api/auth/test` from Production

**File:** `server/routes/auth.js`

1. Find the `/test` route handler.
2. Either delete it entirely or guard it:

```js
if (process.env.NODE_ENV !== 'production') {
    router.get('/test', (req, res) => res.json({ ok: true }));
}
```

3. Prefer deletion — test routes should never exist in application code.

---

### Priority 17 — Add Database Indexes

**Where to add:** In the migration system (if already set up per Priority 7 from the top 10) or in a new migration file `migrations/002_add_indexes.sql`.

Add all of the following:

```sql
-- High-frequency FK lookups
CREATE INDEX IF NOT EXISTS idx_clients_workspace_id       ON clients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_transactions_workspace_id  ON transactions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_transactions_client_id     ON transactions(client_id);
CREATE INDEX IF NOT EXISTS idx_training_plans_client_id   ON training_plans(client_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id  ON workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON workspace_members(workspace_id);

-- Status/type columns used in WHERE filters
CREATE INDEX IF NOT EXISTS idx_transactions_status        ON transactions(status);
CREATE INDEX IF NOT EXISTS idx_training_plans_status      ON training_plans(status);
CREATE INDEX IF NOT EXISTS idx_clients_subscription_status ON clients(subscription_status);
```

Run via `npm run migrate` and verify with `\d clients` in psql.

---

### Priority 18 — Fix Race Condition in Client Code Generation

**File:** `server/routes/clients.js`

**Problem:** Two concurrent `POST /api/clients` calls can both read the same `MAX(client_code)` and produce duplicate codes.

**Option A — DB-level SERIAL (recommended):**

1. Add a migration to make `client_code` a proper sequence per workspace:

```sql
-- If client_code is currently just an INTEGER column:
CREATE SEQUENCE IF NOT EXISTS clients_code_seq_ws_{workspace_id};
-- This per-workspace approach is complex; see Option B instead.
```

**Option B — SELECT FOR UPDATE (simpler, correct):**

1. Wrap the code generation in a transaction:

```js
const client = await pool.connect();
try {
    await client.query('BEGIN');

    const codeResult = await client.query(
        `SELECT COALESCE(MAX(client_code), 0) + 1 AS next_code
         FROM clients WHERE workspace_id = $1
         FOR UPDATE`,  // ← locks the max row
        [req.user.workspaceId]
    );
    const clientCode = codeResult.rows[0].next_code;

    // ... insert using clientCode ...

    await client.query('COMMIT');
    res.status(201).json(...);
} catch (err) {
    await client.query('ROLLBACK');
    next(err);
} finally {
    client.release();
}
```

**Option C — DB sequence (cleanest long-term):**

1. Add a migration:

```sql
ALTER TABLE clients ADD COLUMN IF NOT EXISTS client_code SERIAL;
```

Then remove the manual `MAX + 1` logic entirely.

---

### Priority 19 — Standardize Error Response Shape

**Goal:** Every error response uses `{ error: '...' }`. Every success response uses `{ message: '...' }` (or a data object).

1. Create `server/utils/respond.js`:

```js
const ok      = (res, data, status = 200)  => res.status(status).json(data);
const created = (res, data)                => res.status(201).json(data);
const fail    = (res, message, status = 500) => res.status(status).json({ error: message });
const notFound = (res, msg = 'Not found')  => res.status(404).json({ error: msg });
const badReq   = (res, msg)                => res.status(400).json({ error: msg });
const forbidden = (res, msg = 'Forbidden') => res.status(403).json({ error: msg });

module.exports = { ok, created, fail, notFound, badReq, forbidden };
```

2. Grep for `res.status(4` and `res.status(5` across all route files.
3. Replace `{ message: '...' }` error responses with `{ error: '...' }`.
4. Replace `res.status(500).json({ message: ... })` with `next(new Error(...))` to route through the global error handler (Priority 11).

---

### Priority 20 — Extract Magic Strings to `constants.js`

**File:** Create `server/constants.js`

```js
const ROLES = Object.freeze({
    OWNER:   'owner',
    MANAGER: 'manager',
    TRAINER: 'trainer',
    VIEWER:  'viewer',
});

const SUBSCRIPTION_STATUS = Object.freeze({
    PRE_START:   'Pre-start',
    ACTIVE:      'Active',
    FROZEN:      'Frozen',
    OVERDUE:     'Overdue',
    ENDED:       'Ended',
    QUEUED:      'Queued',
});

const TRANSACTION_STATUS = Object.freeze({
    PENDING:   'pending',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
});

const TRANSACTION_TYPES = Object.freeze({
    PAYMENT:  'payment',
    REFUND:   'refund',
    DISCOUNT: 'discount',
});

const PLAN_STATUS = Object.freeze({
    ACTIVE:    'active',
    COMPLETED: 'completed',
    CANCELLED: 'cancelled',
});

module.exports = { ROLES, SUBSCRIPTION_STATUS, TRANSACTION_STATUS, TRANSACTION_TYPES, PLAN_STATUS };
```

Then grep for bare string literals like `=== 'active'`, `=== 'owner'`, etc. and replace with constants references throughout all route files, middleware, and utils.

---

### Priority 21 — Add Helmet.js Security Headers

**File:** `server/server.js`

1. Install:

```bash
npm install helmet
```

2. Add near the top of `server.js`, before all routes:

```js
const helmet = require('helmet');
app.use(helmet());
```

This sets `X-Content-Type-Options`, `X-Frame-Options`, `Strict-Transport-Security`, `X-XSS-Protection`, and `Referrer-Policy` automatically.

3. If the frontend is served from a different origin, configure the `contentSecurityPolicy` option in `helmet()` to allow the correct sources. For now, the defaults are fine.

---

### Priority 22 — Rate Limiting on All Mutation Endpoints

**File:** `server/middleware/rateLimit.js` and all route files

1. Add a general mutation limiter to `rateLimit.js`:

```js
const { rateLimit } = require('express-rate-limit');

const mutationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 minutes
    max: 100,                    // 100 writes per IP per 15 min
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' },
});

const uploadLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,   // 1 hour
    max: 20,                     // 20 uploads per IP per hour
    message: { error: 'Upload limit reached, please try again later.' },
});

module.exports = { loginLimiter, mutationLimiter, uploadLimiter };
```

2. Apply `mutationLimiter` to all POST/PUT/DELETE route registrations in `server.js`:

```js
app.use('/api/clients',     mutationLimiter, clientsRouter);
app.use('/api/transactions',mutationLimiter, transactionsRouter);
app.use('/api/workspaces',  mutationLimiter, workspacesRouter);
```

3. Apply `uploadLimiter` specifically to any file-upload routes (training, transactions proof images).

---

### Priority 23 — Fix Stale JWT Permissions

**Problem:** Role/permission changes take up to 7 days to propagate because they're baked into the JWT.

**Option A — `permissions_version` counter (recommended, no extra infra):**

1. Add a migration:

```sql
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS permissions_version INTEGER NOT NULL DEFAULT 1;
```

2. Whenever permissions or role change (in the `PATCH /api/workspaces/:id/members/:userId` handler), increment the counter:

```sql
UPDATE workspace_members
SET permissions = $1, role = $2, permissions_version = permissions_version + 1
WHERE workspace_id = $3 AND user_id = $4
```

3. Include `permissions_version` in the JWT payload at login (in `buildTokenForWorkspace`).

4. In `requirePermission` middleware, add a DB check:

```js
const { rows } = await pool.query(
    `SELECT permissions_version FROM workspace_members
     WHERE workspace_id = $1 AND user_id = $2`,
    [req.user.workspaceId, req.user.userId]
);
if (rows[0]?.permissions_version !== req.user.permissions_version) {
    return res.status(401).json({ error: 'Session expired, please log in again.' });
}
```

**Option B — Shorten JWT TTL to 1 hour (simpler but worse UX):**

Change `expiresIn: '7d'` to `expiresIn: '1h'` and add a refresh-token flow. More work, better security.

---

### Priority 24 — Add API Versioning Prefix

**File:** `server/server.js`

1. Change all route registrations from:

```js
app.use('/api/clients', clientsRouter);
```

to:

```js
app.use('/api/v1/clients', clientsRouter);
// Keep old path as alias for 90 days, then remove:
app.use('/api/clients', (req, res) => res.redirect(308, req.url.replace('/api/', '/api/v1/')));
```

2. Update the Next.js API base URL in `client/` (look for `NEXT_PUBLIC_API_URL` or wherever the base URL is set) to point to `/api/v1`.

3. Add `API_VERSION=v1` to `.env.example`.

---

### Priority 25 — Fix Seat-Limit Race Condition

**File:** `server/lib/seatLimits.js` and the routes that call `checkSeatLimit`

**Problem:** Two concurrent client-creation requests can both pass `checkSeatLimit`, then both insert, exceeding the plan limit.

1. In `server/lib/seatLimits.js`, export the raw SQL limit value (not a boolean check):

```js
async function getSeatLimit(workspaceId) {
    const { rows } = await pool.query(
        `SELECT p.max_clients FROM workspace_subscriptions ws
         JOIN plans p ON p.id = ws.plan_id
         WHERE ws.workspace_id = $1 AND ws.status = 'active'`,
        [workspaceId]
    );
    return rows[0]?.max_clients ?? 0;
}
module.exports = { checkSeatLimit, checkWorkspaceLimit, getSeatLimit };
```

2. In `POST /api/clients`, wrap the seat check + insert in a single transaction:

```js
const conn = await pool.connect();
try {
    await conn.query('BEGIN');

    // Lock the count row — prevents concurrent inserts past the limit
    const { rows: countRows } = await conn.query(
        `SELECT COUNT(*) AS cnt FROM clients WHERE workspace_id = $1 FOR UPDATE`,
        [req.user.workspaceId]
    );
    const limit = await getSeatLimit(req.user.workspaceId);
    if (parseInt(countRows[0].cnt) >= limit) {
        await conn.query('ROLLBACK');
        return res.status(403).json({ error: 'Client seat limit reached for your plan.' });
    }

    // Safe to insert — we hold the lock
    const result = await conn.query(`INSERT INTO clients ...`, [...]);

    await conn.query('COMMIT');
    res.status(201).json(mapClient(result.rows[0]));
} catch (err) {
    await conn.query('ROLLBACK');
    next(err);
} finally {
    conn.release();
}
```

---

### Priority 26 — Persist `subscription_status` to DB Column

**Problem:** `clients.subscription_status` column exists but is never written — every read recomputes it in memory, causing O(N) JS overhead per request.

1. Create a migration to ensure the column exists:

```sql
ALTER TABLE clients ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'Pre-start';
```

2. In `server/routes/transactions.js`, after any transaction INSERT/UPDATE/DELETE that affects a client, call an updater:

```js
const { computeSubscriptionStatus } = require('../utils/subscriptionStatus');

async function refreshClientStatus(clientId) {
    const { rows: txRows } = await pool.query(
        `SELECT * FROM transactions WHERE client_id = $1 ORDER BY created_at`,
        [clientId]
    );
    const { rows: freezeRows } = await pool.query(
        `SELECT * FROM client_freezes WHERE client_id = $1`,
        [clientId]
    );
    const status = computeSubscriptionStatus(txRows, freezeRows);
    await pool.query(
        `UPDATE clients SET subscription_status = $1 WHERE id = $2`,
        [status.label, clientId]
    );
}
```

3. Call `refreshClientStatus(clientId)` after every transaction mutation.

4. In `GET /api/clients`, read `subscription_status` directly from the DB column — remove the in-memory computation loop.

5. Remove the duplicate `computePerTxStatuses` function from `routes/transactions.js` and use only `utils/subscriptionStatus.js`.

---

### Priority 27 — GitHub Actions CI/CD Pipeline

**File:** Create `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, master]
  pull_request:
    branches: [main, master]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: fitforce_test
        ports: ['5432:5432']
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: server/package-lock.json

      - name: Install server deps
        run: npm ci
        working-directory: server

      - name: Run migrations
        run: npm run migrate
        working-directory: server
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/fitforce_test
          NODE_ENV: test

      - name: Run tests
        run: npm test
        working-directory: server
        env:
          DATABASE_URL: postgresql://test:test@localhost:5432/fitforce_test
          JWT_SECRET: test_secret_for_ci_only
          NODE_ENV: test

  lint:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: server/package-lock.json
      - run: npm ci
        working-directory: server
      - run: npm run lint
        working-directory: server
```

Add a `lint` script to `server/package.json`:

```json
"scripts": {
  "lint": "eslint . --ext .js --max-warnings 0"
}
```

Install ESLint if not already present: `npm install --save-dev eslint`.

---

### Priority 28 — Structured Logging (pino) + Error Tracking (Sentry)

**Files:** `server/server.js`, `server/logger.js`

**Step 1 — Install:**

```bash
npm install pino pino-http @sentry/node
```

**Step 2 — Create `server/logger.js`:**

```js
const pino = require('pino');

const logger = pino({
    level: process.env.LOG_LEVEL || 'info',
    ...(process.env.NODE_ENV !== 'production' && {
        transport: { target: 'pino-pretty' },
    }),
});

module.exports = logger;
```

**Step 3 — Add to `server.js`:**

```js
const logger    = require('./logger');
const pinoHttp  = require('pino-http');
const Sentry    = require('@sentry/node');

Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    enabled: !!process.env.SENTRY_DSN,
});

// Request logging — add before routes
app.use(pinoHttp({ logger }));

// Update global error handler (Priority 11) to use pino + Sentry:
app.use((err, req, res, next) => {
    const status = err.status ?? err.statusCode ?? 500;
    if (status >= 500) {
        req.log.error({ err }, 'Unhandled server error');
        Sentry.captureException(err);
    }
    res.status(status).json({ error: err.message ?? 'Internal server error' });
});
```

**Step 4 — Replace all `console.error` / `console.log` in route files:**

```js
// Before
console.error(err);

// After — req.log is injected by pino-http
req.log.error({ err }, 'Handler failed');
```

Add `SENTRY_DSN` and `LOG_LEVEL` to `.env.example`.

---

### Priority 29 — Move File Uploads to S3 / Cloudflare R2

**Problem:** Uploaded files are stored on local disk. This breaks with any horizontal scaling or container restart.

**Step 1 — Install:**

```bash
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner multer-s3
```

**Step 2 — Create `server/lib/storage.js`:**

```js
const { S3Client, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');
const multer   = require('multer');
const path     = require('path');

const s3 = new S3Client({
    region: process.env.S3_REGION || 'auto',
    endpoint: process.env.S3_ENDPOINT,           // set for R2
    credentials: {
        accessKeyId:     process.env.S3_ACCESS_KEY,
        secretAccessKey: process.env.S3_SECRET_KEY,
    },
});

function makeUploader(folder, allowedExts) {
    return multer({
        storage: multerS3({
            s3,
            bucket: process.env.S3_BUCKET,
            key: (req, file, cb) => {
                const ext = path.extname(file.originalname).toLowerCase();
                if (!allowedExts.includes(ext)) return cb(new Error('Invalid file type'));
                cb(null, `${folder}/${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
            },
        }),
        limits: { fileSize: 50 * 1024 * 1024 },
    });
}

async function deleteFile(key) {
    await s3.send(new DeleteObjectCommand({ Bucket: process.env.S3_BUCKET, Key: key }));
}

module.exports = { makeUploader, deleteFile };
```

**Step 3 — Replace `multer` disk storage in route files** (`training.js`, `transactions.js`) with `makeUploader(...)` from `storage.js`.

**Step 4 — Serve files via signed URLs or a public CDN path** instead of `express.static`.

**Step 5 — Add to `.env.example`:**

```
S3_REGION=auto
S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
S3_BUCKET=fitforce-uploads
S3_ACCESS_KEY=
S3_SECRET_KEY=
```

---

### Priority 30 — Add `README.md` and `.env.example`

**File:** `README.md` at project root

```markdown
# FitForce X

Fitness coaching SaaS — multi-tenant workspace platform.

## Prerequisites
- Node.js 20+
- PostgreSQL 16+

## Setup

```bash
# 1. Install dependencies
cd server && npm install
cd ../client && npm install

# 2. Configure environment
cp server/.env.example server/.env
# Fill in values (see .env.example for descriptions)

# 3. Run migrations
cd server && npm run migrate

# 4. Seed admin user (first run only)
cd server && npm run seed:admin

# 5. Start dev servers
cd server && npm run dev     # API on :4000
cd client && npm run dev     # Next.js on :3000
```

## Environment Variables
See `server/.env.example` for all required keys.

## Running Tests
```bash
cd server && npm test
```
```

**File:** `server/.env.example`

```
# Database
DATABASE_URL=postgresql://user:password@localhost:5432/fitforce

# Auth
JWT_SECRET=                       # openssl rand -base64 64
ADMIN_JWT_SECRET=                 # openssl rand -base64 64

# Server
PORT=4000
NODE_ENV=development
ALLOWED_ORIGINS=http://localhost:3000

# S3 / Cloudflare R2 file storage
S3_REGION=auto
S3_ENDPOINT=
S3_BUCKET=fitforce-uploads
S3_ACCESS_KEY=
S3_SECRET_KEY=

# Observability
SENTRY_DSN=
LOG_LEVEL=info

# Stripe (payment gateway)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
```

---

### Priority 31 — Fix `checkWorkspaceLimit` Query Logic

**File:** `server/lib/seatLimits.js`

**Problem:** The current query groups by `max_workspaces` and returns the first result, which is wrong when a user has workspaces on different plans.

Replace with:

```js
async function checkWorkspaceLimit(userId) {
    // Count workspaces this user owns
    const { rows: owned } = await pool.query(
        `SELECT COUNT(*) AS cnt FROM workspaces WHERE owner_id = $1 AND archived_at IS NULL`,
        [userId]
    );

    // Find their current plan's workspace limit (look at the subscription
    // for ANY of their owned workspaces — they all share the same owner plan)
    const { rows: plan } = await pool.query(
        `SELECT p.max_workspaces
         FROM workspace_subscriptions ws
         JOIN plans p ON p.id = ws.plan_id
         JOIN workspaces w ON w.id = ws.workspace_id
         WHERE w.owner_id = $1 AND ws.status = 'active'
         ORDER BY ws.updated_at DESC
         LIMIT 1`,
        [userId]
    );

    const maxWorkspaces = plan[0]?.max_workspaces ?? 1;
    const currentCount  = parseInt(owned[0].cnt);

    return { allowed: currentCount < maxWorkspaces, current: currentCount, max: maxWorkspaces };
}
```

---

### Priority 32 — Add `starts_at` / `expires_at` to `workspace_subscriptions`

**Problem:** `server/routes/admin.js` queries `ws.starts_at` and `ws.expires_at` but these columns don't exist, so the admin panel shows `null` silently.

1. Add a migration:

```sql
ALTER TABLE workspace_subscriptions
    ADD COLUMN IF NOT EXISTS starts_at  TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
```

2. Update the admin route that assigns plans to set these values:

```js
// When assigning a plan (e.g., POST /api/admin/workspaces/:id/plan)
const startsAt  = new Date();
const expiresAt = new Date();
expiresAt.setMonth(expiresAt.getMonth() + 1); // 30-day billing cycle

await pool.query(
    `UPDATE workspace_subscriptions
     SET plan_id = $1, status = 'active', starts_at = $2, expires_at = $3
     WHERE workspace_id = $4`,
    [planId, startsAt, expiresAt, workspaceId]
);
```

---

### Priority 33 — Integrate Stripe Payment Gateway

This is a multi-week effort. Below is the minimal implementation path:

**Step 1 — Install:**

```bash
npm install stripe
```

**Step 2 — Create `server/lib/stripe.js`:**

```js
const Stripe = require('stripe');
module.exports = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-12-18.acacia' });
```

**Step 3 — Create webhook handler `server/routes/stripeWebhooks.js`:**

```js
const express = require('express');
const router  = express.Router();
const stripe  = require('../lib/stripe');

// Raw body required for webhook signature verification
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
    const sig = req.headers['stripe-signature'];
    let event;
    try {
        event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
        return res.status(400).json({ error: `Webhook error: ${err.message}` });
    }

    switch (event.type) {
        case 'invoice.paid':
            // Update workspace_subscriptions: set status='active', extends expires_at
            break;
        case 'invoice.payment_failed':
            // Set workspace_subscriptions.status = 'past_due'
            break;
        case 'customer.subscription.deleted':
            // Downgrade to free plan
            break;
    }

    res.json({ received: true });
});

module.exports = router;
```

**Step 4 — Register in `server.js` BEFORE `express.json()` middleware** (raw body required):

```js
app.use('/api/v1/stripe/webhooks', stripeWebhookRouter);
app.use(express.json()); // after webhook route
```

**Step 5 — Add checkout session endpoint** for coaches to subscribe:

```js
// POST /api/v1/billing/checkout
router.post('/checkout', authMiddleware, async (req, res) => {
    const { planId } = req.body;
    const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        line_items: [{ price: planId, quantity: 1 }],
        success_url: `${process.env.CLIENT_URL}/dashboard?upgraded=1`,
        cancel_url:  `${process.env.CLIENT_URL}/billing`,
        metadata: { workspaceId: req.user.workspaceId },
    });
    res.json({ url: session.url });
});
```

---

### Priority 34 — Soft-Delete Consistency

**Problem:** Workspaces use `archived_at` (soft delete), but clients, transactions, and members use hard `DELETE`.

1. Decide which tables need audit trails — at minimum: `clients`, `transactions`, `workspace_members`.

2. Add a migration:

```sql
ALTER TABLE clients           ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE transactions      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE workspace_members ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
```

3. Replace `DELETE FROM clients WHERE id = $1` with:

```sql
UPDATE clients SET deleted_at = NOW() WHERE id = $1 AND workspace_id = $2
```

4. Add `AND deleted_at IS NULL` to all SELECT queries on these tables.

5. Create a scheduled cleanup job (or admin endpoint) to hard-delete rows with `deleted_at` older than 90 days if needed.

---

### Priority 35 — Document Subscription State Machine

**File:** `docs/subscription-state-machine.md`

Create a diagram and explanation of all possible `subscription_status` values, what triggers transitions, and the business rules behind `on_first_plan`, `queued`, and `custom` modes in `computeSubscriptionStatus`.

Include:
- A Mermaid state diagram:

```mermaid
stateDiagram-v2
    [*] --> Pre-start : client created, no transactions
    Pre-start --> Active : first payment recorded
    Active --> Frozen : freeze applied
    Frozen --> Active : freeze ends
    Active --> Overdue : end date passed, no renewal
    Overdue --> Active : renewal payment recorded
    Active --> Ended : manually ended
    Pre-start --> Queued : payment recorded, plan not started yet
    Queued --> Active : start date reached
```

- A table mapping input conditions (transactions, freezes, dates) to output statuses
- The `on_first_plan` / `queued` / `custom` mode logic explained in plain English

---

## Summary Timeline

| Week | Items |
|------|-------|
| This week | 11, 12, 13, 14, 15, 16 |
| This sprint | 17, 18, 19, 20, 21, 22, 23, 24, 25 |
| This month | 26, 27, 28, 29, 30, 31, 32 |
| Quarter 1 | 33, 34, 35 |
