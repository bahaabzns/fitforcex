# Feature Development Guide

Adding features safely to FitForce X — Express 5 + raw PostgreSQL backend, Next.js App Router frontend, multi-tenant workspace model, JWT/cookie auth with RBAC.

---

## Step 1 — Plan Before You Touch Anything

Answer these 4 questions before writing a single line:

1. **Which workspace role(s) need access?** (manager / trainer / nutritionist / receptionist / viewer / owner)
2. **Is this a new module or extending an existing one?** (clients, training, nutrition, forms, finance, databases, team)
3. **Does it need new DB columns/tables?** → migration required
4. **Does it touch file uploads?** → must go through `lib/storage.js`

---

## Step 2 — Database Migration First

Never change the DB schema without a migration.

```bash
# In server/
npm run migrate:create -- your_feature_name
```

This creates `server/migrations/00X_your_feature_name.js`. Write both `up` and `down`:

```js
// server/migrations/00X_add_feature.js
exports.up = (pgm) => {
  pgm.addColumn('existing_table', {
    new_column: { type: 'text', notNull: false }
  });
};

exports.down = (pgm) => {
  pgm.dropColumn('existing_table', 'new_column');
};
```

**Rules:**
- Always write `down` — it's your rollback
- Use `notNull: false` or provide a `default` when adding columns to existing tables (avoids locking large tables)
- Never modify `001_baseline.js` — add new migration files only
- Run `npm run migrate` locally before writing any route code

---

## Step 3 — Add Permissions (if new module)

If this is a new feature area, register its permissions in `server/lib/defaultPermissions.js`:

```js
// Add to the permissions object for each role that should have access
manager: {
  // ...existing...
  your_module: { read: true, write: true, delete: true }
},
trainer: {
  your_module: { read: true, write: false, delete: false }
}
```

> Existing workspace members won't auto-get new permissions — you'll need a migration to backfill the `workspace_members.permissions` JSONB column if needed.

---

## Step 4 — Write the Route File

Create `server/routes/yourFeature.js`. Follow this exact pattern from the existing routes:

```js
const express = require('express');
const router = express.Router();
const db = require('../db');
const auth = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');
const { mutationLimiter } = require('../middleware/rateLimit');

// READ — no rate limit needed
router.get('/', auth, requirePermission('your_module', 'read'), async (req, res) => {
  const { workspaceId } = req.user; // ALWAYS scope to workspace
  const result = await db.query(
    'SELECT * FROM your_table WHERE workspace_id = $1',
    [workspaceId]
  );
  res.json(result.rows);
});

// WRITE — use mutationLimiter
router.post('/', auth, mutationLimiter, requirePermission('your_module', 'write'), async (req, res) => {
  const { workspaceId, userId } = req.user;
  const { name } = req.body;
  const result = await db.query(
    'INSERT INTO your_table (workspace_id, created_by, name) VALUES ($1, $2, $3) RETURNING *',
    [workspaceId, userId, name]
  );
  res.status(201).json(result.rows[0]);
});

module.exports = router;
```

**Non-negotiable rules:**
- Every query must filter by `workspace_id = req.user.workspaceId` — this is your multi-tenancy guard
- Never trust client-supplied `workspace_id` — always use `req.user.workspaceId`
- Always use parameterized queries (`$1, $2`) — never string interpolate into SQL
- Use `req.user.userId` for audit columns (`created_by`, `updated_by`)

---

## Step 5 — Register the Route in server.js

Open `server/server.js` and add it alongside the others:

```js
const yourFeatureRoutes = require('./routes/yourFeature');
app.use('/api/your-feature', yourFeatureRoutes);
```

---

## Step 6 — Write the Tests

Tests live in `server/tests/`. Add `your_feature.test.js`. Use the existing helpers:

```js
const request = require('supertest');
const app = require('../server');
const { createCoach, createClient, resetDatabase } = require('./helpers');

beforeEach(resetDatabase);

describe('Your Feature', () => {
  it('requires authentication', async () => {
    const res = await request(app).get('/api/your-feature');
    expect(res.status).toBe(401);
  });

  it('is scoped to the workspace', async () => {
    const coach1 = await createCoach();
    const coach2 = await createCoach(); // different workspace
    // create data as coach1, verify coach2 cannot see it
  });

  it('rejects unauthorized roles', async () => {
    // test with a role that lacks the permission
  });
});
```

Run tests against the isolated test DB:

```bash
# In server/
npm test
```

---

## Step 7 — Frontend: API Call

Add the API call to the relevant hook or create a new one in `client/hooks/`. Use the pre-configured axios instance:

```js
// client/hooks/useYourFeature.js
import api from '@/lib/axios'; // already has baseURL + credentials
import { useState } from 'react';

export function useYourFeature() {
  const [data, setData] = useState([]);

  async function fetchData() {
    const res = await api.get('/api/your-feature');
    setData(res.data);
  }

  async function create(payload) {
    const res = await api.post('/api/your-feature', payload);
    return res.data;
  }

  return { data, fetchData, create };
}
```

---

## Step 8 — Frontend: Add the Page

Pages live under `client/app/[workspaceSlug]/`. Follow the App Router pattern:

```
client/app/[workspaceSlug]/your-feature/
├── page.js               ← Server Component (data fetching)
└── components/
    └── YourFeatureForm.js  ← Client Component ('use client')
```

Keep data fetching in server components when possible. Use `'use client'` only for interactivity.

---

## Step 9 — Handle Errors Consistently

**Backend** — return HTTP status codes; the global handler in `server.js` catches unhandled errors:

```js
if (!item) return res.status(404).json({ error: 'Not found' });
if (!authorized) return res.status(403).json({ error: 'Forbidden' });
```

**Frontend** — use the existing `ErrorState` component:

```js
if (error) return <ErrorState message={error.message} />;
```

---

## Step 10 — Pre-Merge Checklist

- [ ] Migration has both `up` and `down`
- [ ] All queries filter by `workspace_id`
- [ ] No raw string interpolation in SQL (always use `$1, $2, ...`)
- [ ] `requirePermission` middleware on every route
- [ ] `mutationLimiter` on all POST / PUT / DELETE routes
- [ ] Tests cover: unauthenticated, wrong workspace, wrong role, happy path
- [ ] No secrets hardcoded (use `process.env.*`)
- [ ] `npm test` passes with no failures

---

## Quick Reference

| What | Where |
|------|-------|
| DB migrations | `server/migrations/` |
| Permission definitions | `server/lib/defaultPermissions.js` |
| Auth middleware | `server/middleware/auth.js` |
| Permission middleware | `server/middleware/requirePermission.js` |
| Rate limiters | `server/middleware/rateLimit.js` |
| File uploads | `server/lib/storage.js` |
| Axios instance | `client/lib/axios.js` |
| Tailwind utils | `client/lib/utils.js` |
| Subscription limits | `server/lib/seatLimits.js` |

---

> **The two most common security mistakes in this codebase:**
> 1. Forgetting `workspace_id` in a query → cross-tenant data leak
> 2. Skipping `requirePermission` on a route → privilege escalation
>
> The checklist above guards both.
