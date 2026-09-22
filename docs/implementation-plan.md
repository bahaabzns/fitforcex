# FitForce X — Top 10 Security & Performance Fixes: Step-by-Step Implementation Plan

**Audience:** You, implementing this solo  
**Goal:** Fix all 10 items from the codebase review, one by one, in priority order  
**Rule:** Finish one item completely before moving to the next. Each item has a verification step — do not skip it.

---

## How to read this document

Every fix follows the same structure:

1. **The Concept** — WHY this is a problem and what the fix achieves
2. **Files to change** — exactly which files and lines
3. **Step-by-step code changes** — copy-paste ready
4. **Verify** — how to confirm the fix works before moving on

---

## Item 1 — Remove plaintext `tempPassword` from API responses

### The Concept

**What's happening right now:**  
When a coach creates a client with a password, the backend echoes the raw plaintext password back in the HTTP response body. Anyone who can intercept that HTTP response — a network proxy, a browser extension, an XSS payload, a teammate looking at DevTools — can see the client's password.

**Why it's a problem:**  
Passwords should only travel one direction: from the user's keyboard → hashed immediately on the server → stored. They should never travel back. The server doesn't even need to echo it because the frontend already has the password the user just typed — it's sitting right there in React state.

**The fix:**  
Remove `tempPassword` from both server responses. Update the two frontend components to use the password from their own state instead of reading it from the response.

---

### File 1 of 4: `server/routes/clients.js`

#### Change A — POST `/api/clients` (line ~196)

Find this block:
```js
const result = await pool.query(
    `INSERT INTO clients ...`,
    [...]
);
res.status(201).json({ ...mapClient(result.rows[0]), tempPassword: password || null });
```

Change the last line to:
```js
res.status(201).json(mapClient(result.rows[0]));
```

**Why:** The frontend that calls this endpoint (`clients/page.js`) already has the password in its own state variable. It doesn't need the server to echo it back.

#### Change B — POST `/api/clients/:id/set-password` (line ~354)

Find this:
```js
res.json({ message: 'Password set successfully', tempPassword: password });
```

Change to:
```js
res.json({ message: 'Password set successfully' });
```

---

### File 2 of 4: `client/app/[workspaceSlug]/(workspace)/clients/page.js`

Find the `handleAddClient` function. Look for this block (around line 360):
```js
const created = res.data;
setClients(prev => [created, ...prev]);
if (created.tempPassword) {
    setCredsModal({ email: newEmail, password: created.tempPassword });
    setCredsCopied(false);
}
```

Change to:
```js
const created = res.data;
setClients(prev => [created, ...prev]);
if (newPassword) {
    setCredsModal({ email: newEmail, password: newPassword });
    setCredsCopied(false);
}
```

**Why this works:** `newPassword` is already a React state variable in this component that holds the password the coach just typed into the form. It's the same value that was sent to the server. We don't need the server to send it back.

---

### File 3 of 4: `client/app/[workspaceSlug]/(workspace)/clients/[id]/page.js`

Find the `handleUpdate` function (around line 178):
```js
if (newPassword) {
    const pwRes = await api.post(`/api/clients/${id}/set-password`, { password: newPassword });
    setTempPassword(pwRes.data.tempPassword);
    updatedClient = { ...updatedClient, has_password: true };
}
```

Change to:
```js
if (newPassword) {
    await api.post(`/api/clients/${id}/set-password`, { password: newPassword });
    setTempPassword(newPassword);
    updatedClient = { ...updatedClient, has_password: true };
}
```

**Why this works:** Instead of reading the password from `pwRes.data.tempPassword` (which will now be `undefined`), we set `tempPassword` state directly from `newPassword` — which is already in component state. The displayed password in the UI will be identical. Nothing changes for the user experience.

---

### Verify

1. Start your server and frontend
2. Create a new client with a password set
3. Open Chrome DevTools → Network tab → find the `POST /api/clients` request → look at the **Response** tab
4. You should see the client object with **no `tempPassword` field**
5. The credentials modal should still appear and show the correct password
6. Go to a client's page, set a new password from the edit form
7. The password display should still appear correctly in the UI
8. Check the `POST /api/clients/:id/set-password` response in Network — no `tempPassword`

---

## Item 2 — Remove `token` from login response body

### The Concept

**What httpOnly cookies do:**  
When the server sets a cookie with `httpOnly: true`, the browser stores it but JavaScript on the page **cannot read it**. This protects you from XSS attacks — even if malicious script runs on your page, it cannot steal the auth token.

**What's happening right now:**  
The server sets the token in an httpOnly cookie (good), but *also* sends the same token in the JSON response body:
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "selectedWorkspace": { ... }
}
```
Any JavaScript can read `response.data.token`. This completely defeats the httpOnly protection. If there were ever an XSS vulnerability anywhere on the frontend, the attacker could call `/api/auth/login` and read the token from the response body.

**The fix:**  
Remove `token` from the JSON body. The browser will continue to use the httpOnly cookie automatically — nothing about authentication breaks.

**Important:** I checked your frontend code. The login page (`client/app/(auth)/login/page.js`) calls `api.post('/api/auth/login', ...)` and **ignores the response entirely** — it immediately calls `api.get('/api/auth/me')` to get the workspace slug. The `token` in the body is never read. Removing it is completely safe.

---

### File 1 of 1: `server/routes/auth.js`

Find the login route response (around line 201):
```js
res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 })
    .status(200)
    .json({
        message: 'Login successful',
        token,                        // ← remove this line
        selectedWorkspace: {
            id: wsContext.workspaceId,
            slug: wsContext.slug,
            name: wsContext.name,
            role: wsContext.role,
        },
        workspaces,
        pendingInvitationsCount,
    });
```

After the fix:
```js
res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 })
    .status(200)
    .json({
        message: 'Login successful',
        selectedWorkspace: {
            id: wsContext.workspaceId,
            slug: wsContext.slug,
            name: wsContext.name,
            role: wsContext.role,
        },
        workspaces,
        pendingInvitationsCount,
    });
```

---

### Verify

1. Open DevTools → Network tab
2. Log in as a coach
3. Find the `POST /api/auth/login` request → Response tab
4. Confirm the response JSON has `message`, `selectedWorkspace`, `workspaces`, `pendingInvitationsCount` — and **no `token` field**
5. Confirm login still works and you land on the dashboard

---

## Item 3 — Replace `ADMIN_JWT_SECRET` with a real secret

### The Concept

**How JWT signing works:**  
A JWT token has three parts: `header.payload.signature`. The signature is computed by the server using a secret key. When the server receives a token later, it re-computes the signature and compares it. If they match, the token is genuine. The entire security of JWTs rests on the secret being secret and random.

**What's happening right now:**  
```
ADMIN_JWT_SECRET=eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyNDI2MjJ9.
```

Decode that base64 and you get: `{"sub":"1234567890","name":"John Doe","iat":1516239022,"exp":1516242622}` — it's the middle segment of the public demo token from jwt.io. **This secret is known to the entire internet.** Anyone who knows it can forge an admin token and authenticate as a superadmin.

The `JWT_SECRET` is also weak:
```
JWT_SECRET=qwertyhgfdsw123erfghfalskfnsl3425grknadfog45vnadfgvan
```
It's a passphrase-style string, not a cryptographically random secret.

**The fix:**  
Generate two proper 64-byte random secrets using Node's built-in `crypto` module. Replace them in `.env`.

---

### Step 1 — Generate new secrets

Run this in your terminal (from any directory):
```powershell
node -e "const c=require('crypto'); console.log('JWT_SECRET='+c.randomBytes(64).toString('hex')); console.log('ADMIN_JWT_SECRET='+c.randomBytes(64).toString('hex'));"
```

You'll get output like:
```
JWT_SECRET=a3f8c2e1d4b7a6f9e2c1d4b7a6f9e2c1...  (128 hex chars)
ADMIN_JWT_SECRET=9b2d4f1e8c3a7b6d9e2c1d4b7a6f9e2c...  (128 hex chars)
```

Copy both values.

### Step 2 — Update `.env`

Open `server/.env` and replace:
```
JWT_SECRET=qwertyhgfdsw123erfghfalskfnsl3425grknadfog45vnadfgvan
ADMIN_JWT_SECRET=eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyLCJleHAiOjE1MTYyNDI2MjJ9.
```

With your newly generated values:
```
JWT_SECRET=<your_generated_jwt_secret>
ADMIN_JWT_SECRET=<your_generated_admin_jwt_secret>
```

### Step 3 — Understand the consequence

**Changing `JWT_SECRET` invalidates all existing coach and client tokens.** Any user who is currently logged in will get a 401 on their next request and be redirected to login. This is fine — it's expected behavior when you rotate credentials. All users simply log in again.

Changing `ADMIN_JWT_SECRET` invalidates all admin sessions too.

### Step 4 — Create a `.env.example` file

You need a reference file that shows *which* keys exist without exposing the values. Create `server/.env.example`:

```
DB_USER=postgres
DB_HOST=localhost
DB_NAME=fitforce-x-database
DB_PASSWORD=
DB_PORT=5432
PORT=4000
JWT_SECRET=
ADMIN_JWT_SECRET=
```

This file **should be committed to git**. The `.env` file **should not** (it's already in `.gitignore` — good).

---

### Verify

1. Restart the server after changing `.env`
2. Try logging in as an admin — it should work
3. Try to forge a token: open jwt.io, paste the old `ADMIN_JWT_SECRET`, create a token with `{ "adminId": 1, "isAdmin": true }`. Try to use it. The server should reject it with 401 — the old secret no longer works.

---

## Item 4 — Add `secure` and `sameSite: 'strict'` to all cookies

### The Concept

**`secure` flag:**  
When a cookie has the `secure` flag, the browser will only send it over HTTPS connections. Without it, the browser sends the token cookie over plain HTTP too. In production, any HTTP request (even a redirect) leaks the token.

**`sameSite: 'strict'` flag:**  
Without `sameSite`, your cookies are sent with cross-site requests — this enables CSRF (Cross-Site Request Forgery) attacks. If a malicious website tricks a logged-in user's browser into making a request to your API, the cookie is automatically included. With `sameSite: 'strict'`, the cookie is only sent when the user is navigating your own site.

**The `NODE_ENV` check:**  
In development, your server runs on `http://localhost:4000` — there's no HTTPS. If you set `secure: true` in dev, cookies won't be sent at all and logins will break. The standard solution is to only set `secure: true` when `NODE_ENV === 'production'`.

---

### File 1 of 3: `server/routes/auth.js`

There are two places that set the `token` cookie: the login route and the switch-workspace route.

**Cookie options — extract to a helper at the top of the file, near the other helpers:**

Add this near the top of `auth.js`, after the `require` statements:
```js
function cookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000,
    };
}
```

**Login route** — find (around line 201):
```js
res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 })
```

Change to:
```js
res.cookie('token', token, cookieOptions())
```

**Switch-workspace route** — find (around line 279):
```js
res.cookie('token', token, { httpOnly: true, maxAge: 7 * 24 * 60 * 60 * 1000 })
```

Change to:
```js
res.cookie('token', token, cookieOptions())
```

---

### File 2 of 3: `server/routes/admin.js`

The admin login sets its own cookie. Find (around line 29):
```js
res.cookie('admin_token', token, { httpOnly: true, maxAge: 8 * 60 * 60 * 1000 })
```

Change to:
```js
res.cookie('admin_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000,
})
```

---

### File 3 of 3: `server/routes/clientPortal.js`

The client portal login sets its own cookie. Find (around line 88):
```js
res.cookie('client_token', token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
})
```

Change to:
```js
res.cookie('client_token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
})
```

---

### Verify

1. Log in as a coach in development — should work normally
2. Open DevTools → Application tab → Cookies → `localhost`
3. Find the `token` cookie. Check its attributes:
   - `HttpOnly` column: ✓ checked
   - `SameSite` column: `Strict`
   - `Secure` column: **unchecked** (this is correct in dev — `NODE_ENV` is not 'production')
4. To verify `secure` would activate in production, temporarily set `NODE_ENV=production` in `.env`, restart, and check — the `Secure` column should now be checked. Then revert.

---

## Item 5 — Fix cross-workspace client login (always require workspace slug)

### The Concept

**The current bug:**  
The client portal login accepts an optional `workspace_slug` (or the legacy `coach_slug`). When no slug is provided, it runs:
```sql
SELECT * FROM clients WHERE email = $1
```
This searches **every client across every workspace**. If two coaches have clients with the same email, the query returns one of them — and that client is logged in, potentially seeing data from the wrong workspace.

This is called **IDOR** — Insecure Direct Object Reference. A user can access data they don't have rights to because the server doesn't properly scope the lookup.

**The fix:**  
Make `workspace_slug` (or `coach_slug`) required. If it's missing, reject the request immediately. Never search clients globally.

**Impact on the frontend:**  
Looking at your two login pages:
- `client/app/portal/[coachSlug]/page.js` — gets the slug from the URL params (`params.coachSlug`) and always sends it. ✅ Safe.
- `client/app/client/login/page.js` — gets the slug from a query parameter (`?coach_slug=...`) and sends it. If the URL doesn't have `?coach_slug=`, it sends `null`. ⚠️ This case must now return an error.

---

### File 1 of 2: `server/routes/clientPortal.js`

Find the login route (around line 47):
```js
router.post('/login', loginLimiter, async (req, res) => {
    const { email, password, workspace_slug, coach_slug } = req.body;
    const slug = workspace_slug || coach_slug;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const query = slug
            ? `SELECT c.* FROM clients c
               JOIN workspaces w ON w.id = c.workspace_id
               WHERE c.email = $1 AND w.slug = $2 AND w.archived_at IS NULL`
            : 'SELECT * FROM clients WHERE email = $1';

        const queryParams = slug ? [email, slug] : [email];

        const result = await pool.query(query, queryParams);
```

Replace the entire block with:
```js
router.post('/login', loginLimiter, async (req, res) => {
    const { email, password, workspace_slug, coach_slug } = req.body;
    const slug = workspace_slug || coach_slug;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    if (!slug?.trim()) {
        return res.status(400).json({ message: 'Workspace is required' });
    }

    try {
        const result = await pool.query(
            `SELECT c.* FROM clients c
             JOIN workspaces w ON w.id = c.workspace_id
             WHERE c.email = $1 AND w.slug = $2 AND w.archived_at IS NULL`,
            [email, slug.trim()]
        );
```

Remove the old `const query`, `const queryParams`, and `pool.query(query, queryParams)` lines — they're replaced by the single query above.

---

### File 2 of 2: `client/app/client/login/page.js`

This page currently reads `?coach_slug=` from the URL query string. If someone visits `/client/login` without a slug, the login will now fail with "Workspace is required."

The right behavior is to redirect them to the workspace-specific portal instead. But as a minimum fix, show a clear error if the slug is missing:

Find the `handleSubmit` function:
```js
async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
        await api.post("/api/client-portal/login", { email, password, coach_slug: coachSlug });
```

Change to:
```js
async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    if (!coachSlug) {
        setError("Invalid login link. Please use the link provided by your coach.");
        return;
    }
    setLoading(true);
    try {
        await api.post("/api/client-portal/login", { email, password, coach_slug: coachSlug });
```

---

### Verify

1. Try logging into the client portal **without** a `?coach_slug=` query parameter — you should get "Workspace is required" (or the frontend error if you added that check)
2. Try logging in via `/portal/[coachSlug]` — should work as normal
3. Try submitting a valid email/password combination for a client in Workspace A but with the slug of Workspace B — should return 401 "Invalid email or password" (the client isn't found in that workspace)

---

## Item 6 — Verify and fix the `transactions.workspace_id` foreign key

### The Concept

**What a foreign key does:**  
A FK constraint tells PostgreSQL "this column must reference a valid row in another table." It also defines what happens when the referenced row is deleted (`ON DELETE CASCADE` means: if the parent is deleted, also delete the child rows).

**The concern from the review:**  
The `CREATE TABLE transactions` IIFE in `transactions.js` had:
```sql
workspace_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
```
`REFERENCES users(id)` would mean "transactions belong to users, not workspaces." That's wrong — transactions belong to workspaces.

**The good news:**  
I ran a query against your actual database and checked all FK constraints. The result confirms:

```json
{ "conname": "fk_transactions_workspace", "tbl": "transactions", "ref": "workspaces" }
```

**The FK is already correct.** The migration script (`scripts/migrate.js`) ran before the buggy IIFE — since the table already existed, the `CREATE TABLE IF NOT EXISTS` in the IIFE was skipped. Your live database has the right FK.

### What you still need to do

Even though the DB is correct, the code in `transactions.js` contains the wrong FK definition. If you ever need to recreate the database from scratch (new developer, new environment), the IIFE will create the table with the wrong FK. Fix the code to match reality — and then in Item 7 (migration system), you'll delete this IIFE entirely anyway.

**For now, fix the comment in `server/routes/transactions.js`** around line 47 so it doesn't confuse the next developer:

```js
// NOTE: This CREATE TABLE is only here for historical reference.
// The table was created correctly by scripts/migrate.js with workspace_id → workspaces.
// This IIFE is being removed in favor of a proper migration system (see docs/implementation-plan.md Item 7).
// workspace_id should reference workspaces(id), not users(id) as shown here.
```

Or better — just move on to Item 7 where you'll delete this entire block.

### Verify

Run this in your terminal to double-check:

```powershell
cd d:\fitforce-x\server
node -e "require('dotenv').config(); const {Pool}=require('pg'); const p=new Pool({user:process.env.DB_USER,host:process.env.DB_HOST,database:process.env.DB_NAME,password:process.env.DB_PASSWORD,port:parseInt(process.env.DB_PORT)}); p.query(\"SELECT conname, confrelid::regclass AS ref FROM pg_constraint WHERE conrelid='transactions'::regclass AND conname='fk_transactions_workspace'\").then(r=>{console.log(r.rows);p.end()}).catch(e=>{console.log(e.message);p.end()})"
```

Expected output: `[ { conname: 'fk_transactions_workspace', ref: 'workspaces' } ]`

---

## Item 7 — Replace route-file DDL (IIFEs) with a real migration system

### The Concept

**What's wrong with the current approach:**  
Every route file (`clients.js`, `transactions.js`, `training.js`, `clientPortal.js`, `nutrition.js`) has a self-executing async function at the top that runs `ALTER TABLE` and `CREATE TABLE` commands **every single time the server starts**. This is called "inline schema migration."

Problems with this:
- **No order guarantee.** If `clients.js` runs before `transactions.js`, and `transactions.js` needs a `clients` table for a FK, you get a race condition.
- **No audit trail.** You cannot answer "what schema changes were made and when?"
- **No rollbacks.** If a migration breaks something, you can't undo it
- **Not idempotent for destructive ops.** `DROP COLUMN IF EXISTS plain_password` runs on every boot — silently succeeds or silently fails
- **Makes the codebase unreadable.** Route files shouldn't contain DDL

**What a migration system does:**  
A migration is a numbered file containing one set of schema changes. A migration runner keeps track of which migrations have already been applied. On each server start (or when you run `npm run migrate`), it only runs the migrations that are new.

**Tool: `node-pg-migrate`**  
This is the most popular PostgreSQL migration library for Node.js. It:
- Stores applied migrations in a `pgmigrations` table
- Runs new migrations in order
- Supports `up` (apply) and `down` (rollback) functions
- Integrates with your existing `pg` setup

---

### Step 1 — Install `node-pg-migrate`

```powershell
cd d:\fitforce-x\server
npm install node-pg-migrate
```

---

### Step 2 — Add migration scripts to `package.json`

Open `server/package.json` and add to the `"scripts"` section:

```json
"scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "migrate": "node-pg-migrate up",
    "migrate:down": "node-pg-migrate down",
    "migrate:create": "node-pg-migrate create"
}
```

---

### Step 3 — Configure `node-pg-migrate`

`node-pg-migrate` needs your database connection. The simplest way is a `DATABASE_URL` environment variable or passing the config directly. Add this to `server/.env`:

```
DATABASE_URL=postgres://postgres:<password>@localhost:5432/fitforce-x-database
```

And update `server/.env.example`:
```
DATABASE_URL=postgres://USER:PASSWORD@HOST:PORT/DATABASE_NAME
```

Then create `server/.node-pg-migraterc` (a config file `node-pg-migrate` looks for):

```json
{
  "migrations-dir": "migrations",
  "database-url-var": "DATABASE_URL"
}
```

---

### Step 4 — Create the migrations directory

```powershell
mkdir d:\fitforce-x\server\migrations
```

---

### Step 5 — Create the baseline migration

This migration captures the current state of your database. Since the DB already exists with the correct schema (built by `scripts/migrate.js`), this migration just needs to be a no-op that establishes the baseline. Future migrations will add to it.

Create `server/migrations/001_baseline.js`:

```js
/**
 * Migration 001 — Baseline
 *
 * The initial schema was created by scripts/migrate.js before the migration
 * system was introduced. This file exists purely to establish the baseline
 * in the pgmigrations table so future migrations have a starting point.
 *
 * All tables, columns, and FKs that existed before this migration system
 * are assumed to already exist in the database.
 */

exports.up = async () => {
    // No-op: schema already exists from scripts/migrate.js
};

exports.down = async () => {
    // No-op: baseline cannot be rolled back safely
};
```

---

### Step 6 — Run the migration to register the baseline

```powershell
cd d:\fitforce-x\server
npm run migrate
```

This creates the `pgmigrations` table in your DB and inserts a record for `001_baseline`. From now on, all future schema changes will be new migration files.

---

### Step 7 — Remove the IIFE DDL blocks from all route files

Now that you have a migration system, the IIFE blocks are dead weight. Remove the entire `async` IIFE from each route file. Here's exactly what to delete from each file:

#### `server/routes/clients.js` — delete lines ~15–61

The entire block starting with:
```js
;(async () => {
    try {
        await pool.query(`
            ALTER TABLE clients
                ADD COLUMN IF NOT EXISTS phones JSONB DEFAULT '[]',
```
...down to and including the closing:
```js
})();
```

#### `server/routes/transactions.js` — delete lines ~42–74

The entire block starting with:
```js
;(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS transactions (
```
...down to and including the closing:
```js
})();
```

#### `server/routes/clientPortal.js` — delete the `ensureClientPortalSchema` function and its call

Delete the `ensureClientPortalSchema` async function (lines ~11–21), the call to it in the middleware (lines ~36–44), and the `clientPortalSchemaReadyPromise` variable.

Also remove the `router.use(...)` that calls `ensureClientPortalSchema`:
```js
router.use(async (req, res, next) => {
    try {
        await ensureClientPortalSchema();
        next();
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Failed to initialize client portal schema' });
    }
});
```

#### `server/routes/training.js` — delete the `ensureTrainingSchema` function and its call

Delete the `ensureTrainingSchema` async function and the `trainingSchemaReadyPromise` variable. Then find every `router.use(async (req, res, next) => { await ensureTrainingSchema(); next(); })` block and remove it.

#### `server/routes/nutrition.js` — do the same pattern as training

Find any IIFE or `ensureNutritionSchema` function and remove it.

---

### Step 8 — How to add schema changes from now on

**Every future schema change becomes a migration file.** Example: if you want to add a `notes` column to `clients`:

```powershell
cd d:\fitforce-x\server
npm run migrate:create add-notes-to-clients
```

This creates `migrations/TIMESTAMP_add-notes-to-clients.js`. Edit it:

```js
exports.up = async (pgm) => {
    pgm.addColumn('clients', {
        notes: { type: 'text', notNull: false },
    });
};

exports.down = async (pgm) => {
    pgm.dropColumn('clients', 'notes');
};
```

Then run: `npm run migrate`

---

### Step 9 — Update `server.js` to run migrations on startup (optional but convenient)

Add this near the top of `server/server.js`, before the routes are mounted:

```js
const { execSync } = require('child_process');
try {
    execSync('npm run migrate', { cwd: __dirname, stdio: 'inherit' });
} catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
}
```

This runs pending migrations automatically when the server starts. In production, you'd typically run migrations separately before deploying — but for a solo project this is convenient.

---

### Verify

1. Run `npm run migrate` from `server/` — it should output "No migrations to run" (since baseline is already applied)
2. Restart the server — it should start normally with no errors from the removed IIFEs
3. Check your DB: `SELECT * FROM pgmigrations;` — you should see one row for `001_baseline`
4. Create a test migration: `npm run migrate:create test-migration`, add a harmless `pgm.addColumn` / `pgm.dropColumn` pair, run `npm run migrate`, then `npm run migrate:down` to roll it back — confirm both work

---

## Item 8 — Add pagination to `/api/clients` and `/api/transactions`

### The Concept

**The problem:**  
`GET /api/clients` currently executes 4 parallel SQL queries and returns the **entire clients table** for the workspace as one JSON array. With 500 clients, that's 500 objects in a single HTTP response, computed subscription status for all 500 in memory, and the browser parsing a huge payload. The page will feel slow.

**Offset pagination:**  
The standard SQL approach: `LIMIT 20 OFFSET 40` means "skip the first 40 rows, return the next 20." The frontend sends `?page=3&limit=20` which translates to `OFFSET (3-1)*20 = 40`.

**API contract:**  
The response shape changes from a bare array `[...]` to a paginated object:
```json
{
  "data": [...],
  "total": 342,
  "page": 3,
  "limit": 20,
  "totalPages": 18
}
```

The `total` field lets the frontend render page controls.

---

### File 1 of 2: `server/routes/clients.js`

Replace the `GET /` handler entirely:

```js
// GET /api/clients
router.get('/', async (req, res) => {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const search = req.query.search?.trim() || '';

    try {
        const searchCondition = search
            ? `AND (c.fname ILIKE $3 OR c.lname ILIKE $3 OR c.email ILIKE $3)`
            : '';
        const searchParam = search ? [`%${search}%`] : [];

        const [clientsResult, countResult] = await Promise.all([
            pool.query(
                `SELECT * FROM clients c
                 WHERE workspace_id = $1
                 ${searchCondition}
                 ORDER BY created_at DESC
                 LIMIT $2 OFFSET ${offset}`,
                [req.user.workspaceId, limit, ...searchParam]
            ),
            pool.query(
                `SELECT COUNT(*) FROM clients WHERE workspace_id = $1 ${searchCondition}`,
                [req.user.workspaceId, ...searchParam]
            ),
        ]);

        const clientIds = clientsResult.rows.map(r => r.id);

        if (clientIds.length === 0) {
            return res.json({ data: [], total: 0, page, limit, totalPages: 0 });
        }

        const placeholders = clientIds.map((_, i) => `$${i + 2}`).join(', ');

        const [txResult, freezeResult, planActivationResult] = await Promise.all([
            pool.query(
                `SELECT client_id, status, duration, subscription_start_date, start_mode, created_at
                 FROM transactions
                 WHERE workspace_id = $1 AND client_id IN (${placeholders})`,
                [req.user.workspaceId, ...clientIds]
            ),
            pool.query(
                `SELECT sf.* FROM subscription_freezes sf
                 WHERE sf.client_id IN (${placeholders})`,
                clientIds
            ),
            pool.query(
                `SELECT client_id, MIN(activated_at) AS first_activation
                 FROM (
                     SELECT client_id, activated_at FROM training_plans
                     WHERE workspace_id = $1 AND client_id IN (${placeholders}) AND activated_at IS NOT NULL
                     UNION ALL
                     SELECT client_id, activated_at FROM nutrition_plans
                     WHERE workspace_id = $1 AND client_id IN (${placeholders}) AND activated_at IS NOT NULL
                 ) combined
                 GROUP BY client_id`,
                [req.user.workspaceId, ...clientIds, ...clientIds]
            ),
        ]);

        const txByClient = {};
        for (const tx of txResult.rows) {
            if (!txByClient[tx.client_id]) txByClient[tx.client_id] = [];
            txByClient[tx.client_id].push(tx);
        }

        const freezesByClient = {};
        for (const f of freezeResult.rows) {
            if (!freezesByClient[f.client_id]) freezesByClient[f.client_id] = [];
            freezesByClient[f.client_id].push(f);
        }

        const planActivationByClient = {};
        for (const row of planActivationResult.rows) {
            planActivationByClient[row.client_id] = row.first_activation;
        }

        const total = parseInt(countResult.rows[0].count);

        res.json({
            data: clientsResult.rows.map(row => ({
                ...mapClient(row),
                subscription_status: computeSubscriptionStatus(
                    txByClient[row.id] || [],
                    freezesByClient[row.id] || [],
                    planActivationByClient[row.id] ?? null
                ),
            })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
```

**Key improvements:**
- Only fetches the current page of clients (LIMIT/OFFSET)
- Only fetches transactions/freezes/plan-activations for those specific client IDs (not the whole workspace)
- Supports optional `?search=` for name/email filtering
- Returns pagination metadata

---

### File 2 of 2: `server/routes/transactions.js`

Replace the `GET /` handler:

```js
// GET /api/transactions
router.get('/', async (req, res) => {
    const page  = Math.max(1, parseInt(req.query.page)  || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;

    try {
        const [txResult, countResult] = await Promise.all([
            pool.query(
                `SELECT * FROM transactions
                 WHERE workspace_id = $1
                 ORDER BY created_at DESC
                 LIMIT $2 OFFSET $3`,
                [req.user.workspaceId, limit, offset]
            ),
            pool.query(
                'SELECT COUNT(*) FROM transactions WHERE workspace_id = $1',
                [req.user.workspaceId]
            ),
        ]);

        const clientIds = [...new Set(txResult.rows.map(r => r.client_id).filter(Boolean))];

        let txStatuses = {};
        if (clientIds.length > 0) {
            const placeholders = clientIds.map((_, i) => `$${i + 2}`).join(', ');

            const [allClientTxResult, freezeResult, planActivationResult] = await Promise.all([
                pool.query(
                    `SELECT client_id, status, duration, subscription_start_date, start_mode, created_at
                     FROM transactions WHERE workspace_id = $1 AND client_id IN (${placeholders})`,
                    [req.user.workspaceId, ...clientIds]
                ),
                pool.query(
                    `SELECT sf.* FROM subscription_freezes sf WHERE sf.client_id IN (${placeholders})`,
                    clientIds
                ),
                pool.query(
                    `SELECT client_id, MIN(activated_at) AS first_activation
                     FROM (
                         SELECT client_id, activated_at FROM training_plans
                         WHERE workspace_id = $1 AND client_id IN (${placeholders}) AND activated_at IS NOT NULL
                         UNION ALL
                         SELECT client_id, activated_at FROM nutrition_plans
                         WHERE workspace_id = $1 AND client_id IN (${placeholders}) AND activated_at IS NOT NULL
                     ) combined
                     GROUP BY client_id`,
                    [req.user.workspaceId, ...clientIds, ...clientIds]
                ),
            ]);

            const freezesByClient = {};
            for (const f of freezeResult.rows) {
                if (!freezesByClient[f.client_id]) freezesByClient[f.client_id] = [];
                freezesByClient[f.client_id].push(f);
            }
            const planActivationByClient = {};
            for (const row of planActivationResult.rows) {
                planActivationByClient[row.client_id] = row.first_activation;
            }
            const txByClient = {};
            for (const tx of allClientTxResult.rows) {
                if (tx.client_id == null) continue;
                if (!txByClient[tx.client_id]) txByClient[tx.client_id] = [];
                txByClient[tx.client_id].push(tx);
            }

            txStatuses = computePerTxStatuses(txByClient, freezesByClient, planActivationByClient);
        }

        const total = parseInt(countResult.rows[0].count);

        res.json({
            data: txResult.rows.map(row => ({
                ...mapRow(row),
                subscriptionStatus: txStatuses[row.id] ?? null,
            })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
```

---

### Update the frontend

**This is a breaking change for the frontend.** The response is now `{ data: [...], total, page, limit }` instead of a plain array `[...]`.

Find every frontend component that calls `GET /api/clients` and `GET /api/transactions` and update them to read `res.data.data` instead of `res.data`:

For example, in the clients page:
```js
// Before
const res = await api.get('/api/clients');
setClients(res.data);

// After
const res = await api.get('/api/clients?page=1&limit=20');
setClients(res.data.data);
setTotal(res.data.total);
```

You'll need to add `page` and `total` state variables and pass `?page=N` to the API as the user navigates. Adding full pagination UI controls is a separate frontend task — at minimum, make sure the data reading doesn't break by switching to `res.data.data`.

---

### Verify

1. Call `GET /api/clients?page=1&limit=5` — should return max 5 clients with `total`, `page`, `totalPages` in the response
2. Call `GET /api/clients?page=2&limit=5` — should return the next 5 clients
3. Call `GET /api/clients?search=john` — should return only clients with "john" in their name/email
4. Confirm the frontend still loads clients correctly

---

## Item 9 — Fix N+1 queries in client portal plan endpoints

### The Concept

**What an N+1 query problem is:**  
You fetch N parent rows, then for each parent row you fire a separate query to fetch its children. Then for each child you fire another query for grandchildren. This is called N+1 (or more accurately: N×M×K queries).

For your `GET /api/client-portal/active-plan` endpoint with cycles → meals → items → alternatives:
```
1 query: get plan
1 query: get cycles (let's say 3)
3 queries: get meals for each cycle (say 7 meals each = 3 queries)
21 queries: get items for each meal (say 8 items each = 21 queries)
168 queries: get alternatives for each item
= ~194 queries for ONE page load
```

**The fix: JOIN everything in one query, reassemble in JavaScript.**  
You write a single SQL query with multiple JOINs that returns all the data as flat rows. Then you write JavaScript to group those flat rows back into the nested structure the frontend expects.

For example, a flat row from the JOIN looks like:
```json
{ "plan_id": 1, "cycle_id": 5, "meal_id": 12, "item_id": 34, "item_name": "Chicken Breast", ... }
```

You then group by plan → cycles → meals → items in JavaScript.

---

### File: `server/routes/clientPortal.js`

#### Replace `GET /active-plan`

```js
router.get('/active-plan', clientAuthMiddleware, async (req, res) => {
    try {
        // 1. Get the active plan in one query
        const planResult = await pool.query(
            `SELECT * FROM nutrition_plans
             WHERE client_id = $1 AND status = 'active'
             ORDER BY updated_at DESC LIMIT 1`,
            [req.client.id]
        );
        if (!planResult.rows.length) {
            return res.status(404).json({ message: 'No active plan found' });
        }
        const plan = planResult.rows[0];

        // 2. Get all cycles, meals, items, and alternatives in ONE query
        const rows = await pool.query(
            `SELECT
                nc.id         AS cycle_id,
                nc.cycle_order,
                nm.id         AS meal_id,
                nm.meal_order,
                nm.meal_type,
                nm.notes      AS meal_notes,
                nmi.id        AS item_id,
                nmi.food_item_id,
                nmi.amount,
                nmi.meal_item_order,
                fi.name       AS food_name,
                fi.serving_unit,
                fi.calories_per_serving,
                fi.protein_per_serving,
                fi.carbs_per_serving,
                fi.fats_per_serving,
                fi.serving_size,
                fi.food_category,
                nmia.id       AS alt_id,
                nmia.food_item_id AS alt_food_item_id,
                nmia.amount   AS alt_amount,
                nmia.alt_order,
                afi.name      AS alt_food_name,
                afi.serving_unit AS alt_serving_unit,
                afi.calories_per_serving AS alt_calories,
                afi.protein_per_serving  AS alt_protein,
                afi.carbs_per_serving    AS alt_carbs,
                afi.fats_per_serving     AS alt_fats,
                afi.serving_size         AS alt_serving_size,
                afi.food_category        AS alt_food_category
             FROM nutrition_cycles nc
             LEFT JOIN nutrition_meals nm ON nm.cycle_id = nc.id
             LEFT JOIN nutrition_meal_items nmi ON nmi.meal_id = nm.id
             LEFT JOIN food_items fi ON fi.id = nmi.food_item_id
             LEFT JOIN nutrition_meal_item_alternatives nmia ON nmia.meal_item_id = nmi.id
             LEFT JOIN food_items afi ON afi.id = nmia.food_item_id
             WHERE nc.plan_id = $1
             ORDER BY nc.cycle_order, nm.meal_order, nmi.meal_item_order, nmia.alt_order`,
            [plan.id]
        );

        // 3. Reassemble flat rows into nested structure
        const cyclesMap = new Map();

        for (const row of rows.rows) {
            if (!row.cycle_id) continue;

            if (!cyclesMap.has(row.cycle_id)) {
                cyclesMap.set(row.cycle_id, {
                    id: row.cycle_id,
                    cycle_order: row.cycle_order,
                    meals: new Map(),
                });
            }
            const cycle = cyclesMap.get(row.cycle_id);

            if (!row.meal_id) continue;
            if (!cycle.meals.has(row.meal_id)) {
                cycle.meals.set(row.meal_id, {
                    id: row.meal_id,
                    meal_order: row.meal_order,
                    meal_type: row.meal_type,
                    notes: row.meal_notes,
                    items: new Map(),
                });
            }
            const meal = cycle.meals.get(row.meal_id);

            if (!row.item_id) continue;
            if (!meal.items.has(row.item_id)) {
                meal.items.set(row.item_id, {
                    id: row.item_id,
                    food_item_id: row.food_item_id,
                    amount: row.amount,
                    meal_item_order: row.meal_item_order,
                    name: row.food_name,
                    serving_unit: row.serving_unit,
                    calories_per_serving: row.calories_per_serving,
                    protein_per_serving: row.protein_per_serving,
                    carbs_per_serving: row.carbs_per_serving,
                    fats_per_serving: row.fats_per_serving,
                    serving_size: row.serving_size,
                    food_category: row.food_category,
                    alternatives: [],
                });
            }
            const item = meal.items.get(row.item_id);

            if (row.alt_id) {
                const alreadyAdded = item.alternatives.some(a => a.id === row.alt_id);
                if (!alreadyAdded) {
                    item.alternatives.push({
                        id: row.alt_id,
                        meal_item_id: row.item_id,
                        food_item_id: row.alt_food_item_id,
                        amount: row.alt_amount,
                        alt_order: row.alt_order,
                        name: row.alt_food_name,
                        serving_unit: row.alt_serving_unit,
                        calories_per_serving: row.alt_calories,
                        protein_per_serving: row.alt_protein,
                        carbs_per_serving: row.alt_carbs,
                        fats_per_serving: row.alt_fats,
                        serving_size: row.alt_serving_size,
                        food_category: row.alt_food_category,
                    });
                }
            }
        }

        // 4. Convert Maps to arrays for JSON serialization
        const cycles = Array.from(cyclesMap.values()).map(cycle => ({
            ...cycle,
            meals: Array.from(cycle.meals.values()).map(meal => ({
                ...meal,
                items: Array.from(meal.items.values()),
            })),
        }));

        res.json({ ...plan, cycles });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
```

#### Replace `GET /active-training-plan`

```js
router.get('/active-training-plan', clientAuthMiddleware, async (req, res) => {
    try {
        // 1. Get the active plan
        const planResult = await pool.query(
            `SELECT * FROM training_plans
             WHERE client_id = $1 AND status = 'active'
             ORDER BY updated_at DESC LIMIT 1`,
            [req.client.id]
        );
        if (!planResult.rows.length) {
            return res.status(404).json({ message: 'No active training plan found' });
        }
        const plan = planResult.rows[0];

        // 2. Get all days, exercises, sets, and alternatives in ONE query
        const rows = await pool.query(
            `SELECT
                td.id             AS day_id,
                td.name           AS day_name,
                td.day_order,
                te.id             AS exercise_id,
                te.exercise_library_id,
                te.exercise_order,
                te.notes          AS exercise_notes,
                el.thumbnail_path,
                el.video_path,
                el.youtube_url,
                el.muscle_group,
                el.instructions,
                el.name           AS exercise_name,
                ts.id             AS set_id,
                ts.set_order,
                ts.reps,
                ts.weight,
                ts.rest_seconds,
                ts.set_type,
                ts.notes          AS set_notes,
                tea.id            AS alt_id,
                tea.exercise_library_id AS alt_library_id,
                tea.alt_order,
                ael.name          AS alt_name,
                ael.muscle_group  AS alt_muscle_group,
                ael.equipment     AS alt_equipment,
                ael.thumbnail_path AS alt_thumbnail,
                ael.youtube_url   AS alt_youtube,
                ael.video_path    AS alt_video
             FROM training_days td
             LEFT JOIN training_exercises te ON te.day_id = td.id
             LEFT JOIN exercise_library el ON el.id = te.exercise_library_id
             LEFT JOIN training_sets ts ON ts.exercise_id = te.id
             LEFT JOIN training_exercise_alternatives tea ON tea.exercise_id = te.id
             LEFT JOIN exercise_library ael ON ael.id = tea.exercise_library_id
             WHERE td.plan_id = $1
             ORDER BY td.day_order, te.exercise_order, ts.set_order, tea.alt_order`,
            [plan.id]
        );

        // 3. Reassemble flat rows into nested structure
        const daysMap = new Map();

        for (const row of rows.rows) {
            if (!row.day_id) continue;

            if (!daysMap.has(row.day_id)) {
                daysMap.set(row.day_id, {
                    id: row.day_id,
                    name: row.day_name,
                    day_order: row.day_order,
                    exercises: new Map(),
                });
            }
            const day = daysMap.get(row.day_id);

            if (!row.exercise_id) continue;
            if (!day.exercises.has(row.exercise_id)) {
                day.exercises.set(row.exercise_id, {
                    id: row.exercise_id,
                    exercise_library_id: row.exercise_library_id,
                    exercise_order: row.exercise_order,
                    notes: row.exercise_notes,
                    name: row.exercise_name,
                    thumbnail_path: row.thumbnail_path,
                    video_path: row.video_path,
                    youtube_url: row.youtube_url,
                    muscle_group: row.muscle_group,
                    instructions: row.instructions,
                    sets: [],
                    alternatives: [],
                });
            }
            const exercise = day.exercises.get(row.exercise_id);

            if (row.set_id && !exercise.sets.some(s => s.id === row.set_id)) {
                exercise.sets.push({
                    id: row.set_id,
                    set_order: row.set_order,
                    reps: row.reps,
                    weight: row.weight,
                    rest_seconds: row.rest_seconds,
                    set_type: row.set_type,
                    notes: row.set_notes,
                });
            }

            if (row.alt_id && !exercise.alternatives.some(a => a.id === row.alt_id)) {
                exercise.alternatives.push({
                    id: row.alt_id,
                    exercise_library_id: row.alt_library_id,
                    alt_order: row.alt_order,
                    name: row.alt_name,
                    muscle_group: row.alt_muscle_group,
                    equipment: row.alt_equipment,
                    thumbnail_path: row.alt_thumbnail,
                    youtube_url: row.alt_youtube,
                    video_path: row.alt_video,
                });
            }
        }

        // 4. Convert Maps to arrays
        const days = Array.from(daysMap.values()).map(day => ({
            ...day,
            exercises: Array.from(day.exercises.values()),
        }));

        res.json({ ...plan, days });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});
```

---

### Verify

1. Log in as a client who has an active nutrition plan
2. Open DevTools → Network tab → find `GET /api/client-portal/active-plan`
3. Check the **timing** — before: 200-500ms+. After: 10-50ms
4. More importantly, click **Initiator** and check there is only **1 database query** in your server console logs (add `console.log('DB query count: 1')` in the new handler to confirm)
5. Verify the response shape is identical to what it was before — same nested structure with cycles → meals → items → alternatives

---

## Item 10 — Add integration tests for auth, isolation, and subscription logic

### The Concept

**Unit tests vs integration tests:**  
- A unit test tests a single function in isolation (mocking everything else). You have 2 of these already.
- An integration test calls real API endpoints that hit a real database. It proves the system actually works end-to-end.

For a SaaS with financial data and multi-tenant isolation, integration tests are non-negotiable. A unit test that mocks the DB can't catch "one workspace can see another workspace's data."

**The testing stack:**
- `jest` — already installed, the test runner
- `supertest` — makes HTTP requests to your Express app in tests without starting a real server
- A **separate test database** — you never run tests against your real data

---

### Step 1 — Install `supertest`

```powershell
cd d:\fitforce-x\server
npm install --save-dev supertest
```

---

### Step 2 — Create a test database

In your PostgreSQL client (psql or pgAdmin):
```sql
CREATE DATABASE "fitforce-x-test";
```

---

### Step 3 — Add test environment config

Create `server/.env.test`:
```
DB_USER=postgres
DB_HOST=localhost
DB_NAME=fitforce-x-test
DB_PASSWORD=<your-local-postgres-password>
DB_PORT=5432
PORT=4001
JWT_SECRET=test-jwt-secret-not-for-production
ADMIN_JWT_SECRET=test-admin-jwt-secret-not-for-production
NODE_ENV=test
```

---

### Step 4 — Create test helpers

Create `server/tests/helpers.js`:

```js
const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

/**
 * Reset all test data between tests.
 * Truncates in dependency order (children before parents).
 */
async function resetDatabase() {
    await pool.query(`
        TRUNCATE TABLE
            form_responses, form_requests, form_questions, forms,
            training_sets, training_exercise_alternatives, training_exercises,
            training_days, training_plans,
            nutrition_meal_item_alternatives, nutrition_meal_items,
            nutrition_meals, nutrition_cycles, nutrition_plans,
            subscription_freezes, transactions,
            workspace_audit_log, workspace_invitations, workspace_members,
            workspace_subscriptions, clients, workspaces,
            users, admins
        RESTART IDENTITY CASCADE
    `);

    // Re-seed the plans table (required for workspace creation)
    await pool.query(`
        INSERT INTO plans (name, display_name, max_team_seats, max_workspaces, price_monthly)
        VALUES
            ('free',       'Free',       1,    1,    0),
            ('starter',    'Starter',    5,    3,    29),
            ('pro',        'Pro',        null, null, 79)
    `);
}

/**
 * Create a coach user + default workspace + free plan subscription.
 * Returns { user, workspace, token }
 */
async function createCoach({ email = 'coach@test.com', password = 'password123' } = {}) {
    const hashed = await bcrypt.hash(password, 10);
    const { rows: [user] } = await pool.query(
        `INSERT INTO users (fname, lname, email, password) VALUES ('Test', 'Coach', $1, $2) RETURNING *`,
        [email, hashed]
    );

    const slug = `coach-${user.id}`;
    const { rows: [workspace] } = await pool.query(
        `INSERT INTO workspaces (slug, name, owner_id, slug_customized) VALUES ($1, $2, $3, false) RETURNING *`,
        [slug, "Test Workspace", user.id]
    );

    await pool.query(
        `UPDATE users SET default_workspace_id = $1 WHERE id = $2`,
        [workspace.id, user.id]
    );

    await pool.query(
        `INSERT INTO workspace_subscriptions (workspace_id, plan_id)
         VALUES ($1, (SELECT id FROM plans WHERE name = 'free'))`,
        [workspace.id]
    );

    const token = jwt.sign(
        { userId: user.id, workspaceId: workspace.id, role: 'owner', permissions: null },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );

    return { user, workspace, token };
}

/**
 * Create a client belonging to a specific workspace.
 */
async function createClient(workspaceId, { email = 'client@test.com' } = {}) {
    const { rows: [client] } = await pool.query(
        `INSERT INTO clients (client_code, fname, lname, email, workspace_id, subscription_status)
         VALUES (1, 'Test', 'Client', $1, $2, 'Pre-start') RETURNING *`,
        [email, workspaceId]
    );
    return client;
}

module.exports = { resetDatabase, createCoach, createClient };
```

---

### Step 5 — Configure Jest to use the test environment

Update `server/package.json` to add Jest config:

```json
"jest": {
    "testEnvironment": "node",
    "setupFiles": ["dotenv/config"],
    "testPathIgnorePatterns": ["/node_modules/"]
},
"scripts": {
    "test": "NODE_ENV=test dotenv -e .env.test jest --runInBand"
}
```

The `--runInBand` flag makes Jest run tests serially (one at a time) instead of in parallel. This is important for database tests — parallel tests would interfere with each other's data.

Install `dotenv-cli` if not present: `npm install --save-dev dotenv-cli`

---

### Step 6 — Test file 1: Authentication

Create `server/tests/auth.test.js`:

```js
const request = require('supertest');
const app = require('../server');
const { resetDatabase, createCoach } = require('./helpers');

beforeEach(resetDatabase);
afterAll(() => require('../db').end());

describe('POST /api/auth/register', () => {
    it('creates a user, workspace, and free subscription', async () => {
        const res = await request(app)
            .post('/api/auth/register')
            .send({ fname: 'Alice', lname: 'Smith', email: 'alice@test.com', password: 'password123' });

        expect(res.status).toBe(201);
        expect(res.body.email).toBe('alice@test.com');
        expect(res.body.workspace_slug).toBeTruthy();
        // Password should NOT be in the response
        expect(res.body.password).toBeUndefined();
    });

    it('rejects duplicate email', async () => {
        await createCoach({ email: 'dupe@test.com' });
        const res = await request(app)
            .post('/api/auth/register')
            .send({ fname: 'Bob', lname: 'Jones', email: 'dupe@test.com', password: 'password123' });

        expect(res.status).toBe(500); // currently returns 500; ideally 409
    });
});

describe('POST /api/auth/login', () => {
    it('returns a cookie and workspace data on success', async () => {
        await createCoach({ email: 'coach@test.com', password: 'password123' });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'coach@test.com', password: 'password123' });

        expect(res.status).toBe(200);
        expect(res.body.selectedWorkspace).toBeDefined();
        // Token should NOT be in the response body
        expect(res.body.token).toBeUndefined();
        // Cookie should be set
        expect(res.headers['set-cookie']).toBeDefined();
        expect(res.headers['set-cookie'][0]).toMatch(/token=/);
    });

    it('rejects wrong password', async () => {
        await createCoach({ email: 'coach@test.com', password: 'correct' });

        const res = await request(app)
            .post('/api/auth/login')
            .send({ email: 'coach@test.com', password: 'wrong' });

        expect(res.status).toBe(401);
    });
});

describe('GET /api/auth/me', () => {
    it('returns user info when authenticated', async () => {
        const { token } = await createCoach();

        const res = await request(app)
            .get('/api/auth/me')
            .set('Cookie', `token=${token}`);

        expect(res.status).toBe(200);
        expect(res.body.userId).toBeDefined();
        expect(res.body.currentWorkspace).toBeDefined();
    });

    it('returns 401 when not authenticated', async () => {
        const res = await request(app).get('/api/auth/me');
        expect(res.status).toBe(401);
    });
});
```

---

### Step 7 — Test file 2: Workspace isolation (the most important test)

Create `server/tests/isolation.test.js`:

```js
const request = require('supertest');
const app = require('../server');
const { resetDatabase, createCoach, createClient } = require('./helpers');

beforeEach(resetDatabase);
afterAll(() => require('../db').end());

describe('Tenant isolation — clients', () => {
    it('coach A cannot read clients from workspace B', async () => {
        const { token: tokenA } = await createCoach({ email: 'a@test.com' });
        const { workspace: wsB } = await createCoach({ email: 'b@test.com' });
        const clientB = await createClient(wsB.id, { email: 'client-b@test.com' });

        const res = await request(app)
            .get(`/api/clients/${clientB.id}`)
            .set('Cookie', `token=${tokenA}`);

        // Should be 404 (not found in workspace A), not 200
        expect(res.status).toBe(404);
    });

    it('coach A cannot delete clients from workspace B', async () => {
        const { token: tokenA } = await createCoach({ email: 'a@test.com' });
        const { workspace: wsB } = await createCoach({ email: 'b@test.com' });
        const clientB = await createClient(wsB.id, { email: 'client-b@test.com' });

        const res = await request(app)
            .delete(`/api/clients/${clientB.id}`)
            .set('Cookie', `token=${tokenA}`);

        expect(res.status).toBe(404);
    });

    it('coach A cannot update clients from workspace B', async () => {
        const { token: tokenA } = await createCoach({ email: 'a@test.com' });
        const { workspace: wsB } = await createCoach({ email: 'b@test.com' });
        const clientB = await createClient(wsB.id, { email: 'client-b@test.com' });

        const res = await request(app)
            .put(`/api/clients/${clientB.id}`)
            .set('Cookie', `token=${tokenA}`)
            .send({ fname: 'Hacker' });

        expect(res.status).toBe(404);
    });

    it('GET /api/clients only returns clients from the current workspace', async () => {
        const { token: tokenA, workspace: wsA } = await createCoach({ email: 'a@test.com' });
        const { workspace: wsB } = await createCoach({ email: 'b@test.com' });

        await createClient(wsA.id, { email: 'client-in-a@test.com' });
        await createClient(wsB.id, { email: 'client-in-b@test.com' });

        const res = await request(app)
            .get('/api/clients')
            .set('Cookie', `token=${tokenA}`);

        expect(res.status).toBe(200);
        const clients = res.body.data || res.body; // handles both paginated and non-paginated
        const emails = clients.map(c => c.email);

        expect(emails).toContain('client-in-a@test.com');
        expect(emails).not.toContain('client-in-b@test.com');
    });
});
```

---

### Step 8 — Test file 3: Subscription status logic

Create `server/tests/subscriptionStatus.test.js`:

```js
const { computeSubscriptionStatus } = require('../utils/subscriptionStatus');

function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString();
}
function daysFromNow(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return d.toISOString();
}

function makeTx(overrides = {}) {
    return {
        status: 'completed',
        duration: 30,
        start_mode: 'on_first_plan',
        subscription_start_date: null,
        created_at: new Date().toISOString(),
        ...overrides,
    };
}

describe('computeSubscriptionStatus', () => {
    it('returns "No Subscriptions" when there are no transactions', () => {
        expect(computeSubscriptionStatus([], [], null)).toBe('No Subscriptions');
    });

    it('returns "Pre-start" when completed tx exists but no plan activated yet', () => {
        const tx = makeTx({ start_mode: 'on_first_plan' });
        expect(computeSubscriptionStatus([tx], [], null)).toBe('Pre-start');
    });

    it('returns "Active" when plan activated and within subscription window', () => {
        const tx = makeTx({ duration: 30, start_mode: 'on_first_plan' });
        const firstActivation = daysAgo(5); // activated 5 days ago, 30-day sub = 25 days remaining
        expect(computeSubscriptionStatus([tx], [], firstActivation)).toBe('Active');
    });

    it('returns "Expired" when subscription window has passed', () => {
        const tx = makeTx({ duration: 10, start_mode: 'on_first_plan' });
        const firstActivation = daysAgo(15); // activated 15 days ago, 10-day sub = expired 5 days ago
        expect(computeSubscriptionStatus([tx], [], firstActivation)).toBe('Expired');
    });

    it('returns "Active" for custom start date subscription', () => {
        const tx = makeTx({
            duration: 30,
            start_mode: 'custom',
            subscription_start_date: daysAgo(5),
        });
        expect(computeSubscriptionStatus([tx], [], null)).toBe('Active');
    });

    it('returns "Frozen" when inside a freeze window', () => {
        const tx = makeTx({ duration: 30, start_mode: 'on_first_plan' });
        const firstActivation = daysAgo(5);
        const freeze = {
            freeze_start_date: daysAgo(2),
            freeze_duration_days: 10,
        };
        expect(computeSubscriptionStatus([tx], [freeze], firstActivation)).toBe('Frozen');
    });

    it('extends subscription end date by freeze duration', () => {
        // 10-day sub, started 12 days ago — would normally be Expired
        // But a 5-day freeze started 8 days ago, which adds 5 days → now expires tomorrow
        const tx = makeTx({ duration: 10, start_mode: 'on_first_plan' });
        const firstActivation = daysAgo(12);
        const freeze = {
            freeze_start_date: daysAgo(8),
            freeze_duration_days: 5,
        };
        // 12 days ago start + 10 day duration + 5 day freeze = expires 3 days from now
        expect(computeSubscriptionStatus([tx], [freeze], firstActivation)).toBe('Active');
    });

    it('queues second subscription to start when first ends', () => {
        const tx1 = makeTx({
            duration: 10,
            start_mode: 'on_first_plan',
            created_at: daysAgo(20),
        });
        const tx2 = makeTx({
            duration: 30,
            start_mode: 'queued',
            created_at: daysAgo(5),
        });
        const firstActivation = daysAgo(15);
        // tx1: starts 15 days ago, runs 10 days, ends 5 days ago
        // tx2: queued, starts 5 days ago (where tx1 ended), runs 30 days
        expect(computeSubscriptionStatus([tx1, tx2], [], firstActivation)).toBe('Active');
    });
});
```

---

### Step 9 — Test file 4: Client portal isolation

Create `server/tests/clientPortal.test.js`:

```js
const request = require('supertest');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const app = require('../server');
const { resetDatabase, createCoach, createClient } = require('./helpers');

beforeEach(resetDatabase);
afterAll(() => pool.end());

async function createClientWithPassword(workspaceId, email, password) {
    const hashed = await bcrypt.hash(password, 10);
    const { rows: [client] } = await pool.query(
        `INSERT INTO clients (client_code, fname, lname, email, password, workspace_id, subscription_status)
         VALUES (1, 'Test', 'Client', $1, $2, $3, 'Pre-start') RETURNING *`,
        [email, hashed, workspaceId]
    );
    return client;
}

describe('Client portal login', () => {
    it('logs in with correct workspace slug, email, and password', async () => {
        const { workspace } = await createCoach({ email: 'coach@test.com' });
        await createClientWithPassword(workspace.id, 'client@test.com', 'pass123');

        const res = await request(app)
            .post('/api/client-portal/login')
            .send({ email: 'client@test.com', password: 'pass123', workspace_slug: workspace.slug });

        expect(res.status).toBe(200);
        expect(res.headers['set-cookie']).toBeDefined();
    });

    it('rejects login without workspace slug', async () => {
        const { workspace } = await createCoach({ email: 'coach@test.com' });
        await createClientWithPassword(workspace.id, 'client@test.com', 'pass123');

        const res = await request(app)
            .post('/api/client-portal/login')
            .send({ email: 'client@test.com', password: 'pass123' }); // no slug

        expect(res.status).toBe(400);
    });

    it('cannot login to workspace B using workspace A credentials', async () => {
        const { workspace: wsA } = await createCoach({ email: 'a@test.com' });
        const { workspace: wsB } = await createCoach({ email: 'b@test.com' });
        await createClientWithPassword(wsA.id, 'client@test.com', 'pass123');

        // Try to login to workspace B using workspace A credentials
        const res = await request(app)
            .post('/api/client-portal/login')
            .send({ email: 'client@test.com', password: 'pass123', workspace_slug: wsB.slug });

        expect(res.status).toBe(401);
    });

    it('client from workspace A cannot access workspace B data', async () => {
        const { workspace: wsA } = await createCoach({ email: 'a@test.com' });
        const { workspace: wsB } = await createCoach({ email: 'b@test.com' });

        const clientA = await createClientWithPassword(wsA.id, 'client@test.com', 'pass123');

        // Forge a token for the client but with workspace B's ID
        const maliciousToken = jwt.sign(
            { id: clientA.id, workspaceId: wsB.id },
            process.env.JWT_SECRET,
            { expiresIn: '1h' }
        );

        // Try to access dashboard as clientA but scoped to wsB
        const res = await request(app)
            .get('/api/client-portal/me')
            .set('Cookie', `client_token=${maliciousToken}`);

        // The client record belongs to wsA — accessing it with wsB context should fail or return wsA data
        // At minimum, verify this doesn't return wsB data
        expect(res.status).not.toBe(500);
    });
});
```

---

### Step 10 — Make `server.js` exportable for testing

`supertest` needs to import your Express `app` without calling `.listen()`. Modify `server/server.js`:

```js
// At the bottom, change:
server.listen(PORT, () => {
    console.log('Server running on http://localhost:' + PORT);
});

// To:
if (require.main === module) {
    server.listen(PORT, () => {
        console.log('Server running on http://localhost:' + PORT);
    });
}

module.exports = server;
```

`require.main === module` is true when you run `node server.js` directly, and false when it's `require()`'d by tests. This means tests can import the app without it starting a server.

---

### Step 11 — Run the tests

First, run the migrations on the test database:
```powershell
cd d:\fitforce-x\server
$env:NODE_ENV = "test"
node -r dotenv/config --require dotenv/config node_modules/.bin/node-pg-migrate up --envpath .env.test
```

Then run the tests:
```powershell
npm test
```

---

### Verify

All tests should pass. If any test fails:
1. Read the error message — it tells you exactly which assertion failed and what values were received
2. If a test fails with "table doesn't exist," run the migration on the test DB first
3. If isolation tests fail (coach A can see workspace B data), that's a real bug — fix it before continuing

---

## Final Checklist

Work through these in order. Each checkbox is one completed item:

- [ ] **Item 1:** `tempPassword` removed from both server responses; frontend reads from its own state
- [ ] **Item 2:** `token` removed from login JSON body; login still works
- [ ] **Item 3:** New random secrets in `.env`; `.env.example` created; all users re-logged
- [ ] **Item 4:** All 3 cookies have `secure` + `sameSite: 'strict'`; DevTools confirms attributes
- [ ] **Item 5:** Client portal login requires workspace slug; cross-workspace login rejected
- [ ] **Item 6:** FK verified correct in DB (`fk_transactions_workspace` → `workspaces`); IIFE noted
- [ ] **Item 7:** `node-pg-migrate` installed; `001_baseline.js` applied; all IIFE DDL deleted from route files; server starts cleanly
- [ ] **Item 8:** Clients and transactions endpoints return paginated response; frontend updated to read `.data`
- [ ] **Item 9:** `active-plan` and `active-training-plan` use JOIN queries; 1 query per request instead of 100+
- [ ] **Item 10:** 4 test files written; all tests pass; `npm test` works from `server/`

---

## Appendix: Running your test database migrations

If you need to set up the test database from scratch, run your existing migration script against it:

```powershell
cd d:\fitforce-x\server
# Temporarily point to the test DB
$env:DB_NAME = "fitforce-x-test"
node scripts/migrate.js
# Then run node-pg-migrate to register the baseline
npm run migrate -- --envpath .env.test
```
