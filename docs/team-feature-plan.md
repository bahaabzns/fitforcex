# Team Feature — Implementation Plan (v2)

> Status: Draft v2 — revised after design review  
> Author: Bahaa Ahmed  
> Date: 2026-05-05  

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [Core Identity Model](#2-core-identity-model)
3. [Roles & Permissions Matrix](#3-roles--permissions-matrix)
4. [Database Schema](#4-database-schema)
5. [Auth Flow](#5-auth-flow)
6. [Workspace Lifecycle](#6-workspace-lifecycle)
7. [Invitation Flow](#7-invitation-flow)
8. [Admin Dashboard](#8-admin-dashboard)
9. [Backend API Changes](#9-backend-api-changes)
10. [Frontend Changes](#10-frontend-changes)
11. [Ownership Transfer](#11-ownership-transfer)
12. [Subscription Plan Gating](#12-subscription-plan-gating)
13. [Data Migration Strategy](#13-data-migration-strategy)
14. [Risk Register](#14-risk-register)
15. [Implementation Phases](#15-implementation-phases)

---

## 1. Overview & Goals

### What we're building

A workspace model where a single FitForce account (one email, one password) can:
- Own multiple workspaces (each with its own clients, plans, slug, subscription)
- Be a team member in other coaches' workspaces
- Switch between workspaces without logging out
- Accept or decline invitations from other workspace owners

### What changes from the original plan

| Area | Original Plan (v1) | This Plan (v2) |
|------|--------------------|----------------|
| Identity model | Coaches in `users`, team members in `team_members` (separate passwords) | Everyone in `users`. Membership tracked in `workspace_members` junction table |
| Login | Two separate login pages + two cookies | Single `/login` page, single cookie |
| Invite flow | Coach creates credentials directly | Owner invites by email (must be registered), invited user accepts/declines |
| URL structure | No slug prefix on dashboard | All dashboard routes under `/[workspaceSlug]/` |
| `coach_slug` | On `users` table (one per user) | On `workspaces` table (one per workspace) |
| Workspaces | 1 user = 1 workspace | 1 user = N workspaces (owner or member) |
| Admin | Not planned | Separate admin account + admin dashboard |

---

## 2. Core Identity Model

```
users (1 account per email, globally unique)
  │
  ├──▶ workspaces (owns N workspaces, is owner via workspaces.owner_id)
  │         │
  │         └──▶ workspace_members (is a member in M other workspaces, with a role)
  │
  └──▶ workspace_invitations (pending invites to join other workspaces)
```

### Key Rules

- A `user` is an identity. It has no "role" on its own.
- A `workspace` is a tenant. It has exactly one owner (`owner_id` → `users.id`).
- A `workspace_member` is the link: user X has role Y in workspace Z.
- The **owner is not in `workspace_members`** — ownership is tracked by `workspaces.owner_id` alone. This prevents the owner being accidentally deleted from their own workspace.
- All data tables (`clients`, `transactions`, etc.) belong to a `workspace`, not a `user`.
- When a user logs in, their JWT contains `{ userId, workspaceId, role }`. Role is `owner` or a member role. Switching workspace = new JWT.

---

## 3. Roles & Permissions Matrix

### 3.1 Built-in Roles

| Role | Who holds it | Where |
|------|-------------|-------|
| `owner` | Current workspace owner | `workspaces.owner_id` |
| `manager` | Full access except finance & settings | `workspace_members.role` |
| `trainer` | Clients + training + forms | `workspace_members.role` |
| `nutritionist` | Clients + nutrition + forms | `workspace_members.role` |
| `receptionist` | Finance + read-only clients | `workspace_members.role` |
| `viewer` | Read-only across all modules | `workspace_members.role` |

### 3.2 Permission Modules & Default Values

Each `workspace_member` row has a `permissions JSONB` column. The role is a **template** that sets defaults. The owner can override individual toggles per member after creation.

```json
{
  "clients":   { "read": true,  "write": true,  "delete": false },
  "training":  { "read": true,  "write": true,  "delete": false },
  "nutrition": { "read": false, "write": false, "delete": false },
  "forms":     { "read": true,  "write": true,  "delete": false },
  "finance":   { "read": false, "write": false, "delete": false },
  "databases": { "read": true,  "write": false, "delete": false },
  "team":      { "read": false, "write": false, "delete": false }
}
```

#### Default Permissions by Role

| Module | owner | manager | trainer | nutritionist | receptionist | viewer |
|--------|-------|---------|---------|--------------|--------------|--------|
| clients | RWD | RWD | RW | RW | R | R |
| training | RWD | RWD | RWD | — | — | R |
| nutrition | RWD | RWD | — | RWD | — | R |
| forms | RWD | RWD | RW | RW | — | R |
| finance | RWD | — | — | — | RW | — |
| databases | RWD | RW | RW | RW | — | R |
| team | RWD | R+W* | — | — | — | — |

> `R` = read, `W` = write/create/edit, `D` = delete  
> `*` Manager can manage trainer/nutritionist/receptionist/viewer only — cannot touch other managers or the owner

### 3.3 Always Owner-Only (not in permissions JSONB)

Enforced by `requireOwner` middleware — no override possible:

- Workspace settings (slug, name)
- `POST /api/workspaces/:id/transfer-ownership`
- `DELETE /api/workspaces/:id` (archive)
- Subscription and billing management

---

## 4. Database Schema

### 4.1 Updated: `users` Table

Add two columns to the existing table:

```sql
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS default_workspace_id INTEGER REFERENCES workspaces(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_admin              BOOLEAN NOT NULL DEFAULT FALSE;

-- Remove coach_slug from users — it moves to workspaces
-- (do this AFTER backfilling workspaces.slug from users.coach_slug)
ALTER TABLE users DROP COLUMN IF EXISTS coach_slug;
ALTER TABLE users DROP COLUMN IF EXISTS slug_customized;
```

### 4.2 New: `workspaces` Table

```sql
CREATE TABLE IF NOT EXISTS workspaces (
    id             SERIAL PRIMARY KEY,
    slug           TEXT    NOT NULL UNIQUE,
    name           TEXT    NOT NULL,
    owner_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    slug_customized BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at    TIMESTAMPTZ,           -- NULL = active, NOT NULL = soft-deleted
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspaces_owner    ON workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspaces_slug     ON workspaces(slug);
CREATE INDEX IF NOT EXISTS idx_workspaces_archived ON workspaces(archived_at) WHERE archived_at IS NULL;
```

**Business rules:**
- `slug` is globally unique — used in both the coach dashboard URL and the client portal URL
- `archived_at IS NOT NULL` = soft-deleted. All data is preserved.
- `owner_id` cannot be deleted (ON DELETE RESTRICT) — transfer or archive the workspace first

### 4.3 New: `workspace_members` Table

Replaces the `team_members` table from v1 of this plan entirely.

```sql
CREATE TABLE IF NOT EXISTS workspace_members (
    id           SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role         TEXT    NOT NULL CHECK (role IN ('manager','trainer','nutritionist','receptionist','viewer')),
    permissions  JSONB   NOT NULL DEFAULT '{}',
    is_active    BOOLEAN NOT NULL DEFAULT TRUE,
    joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace ON workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user      ON workspace_members(user_id);
```

**Key difference from v1 `team_members`:** No `fname`, `lname`, `email`, `password` here — those live on `users`. This table is a pure junction.

### 4.4 New: `workspace_invitations` Table

Handles the invite-accept-decline flow. Also serves as the in-app notification mechanism — no separate notifications table needed.

```sql
CREATE TABLE IF NOT EXISTS workspace_invitations (
    id                 SERIAL PRIMARY KEY,
    workspace_id       INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    invited_by_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    invited_user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role               TEXT    NOT NULL CHECK (role IN ('manager','trainer','nutritionist','receptionist','viewer')),
    status             TEXT    NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending','accepted','declined')),
    message            TEXT,              -- optional note from the inviting owner
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    responded_at       TIMESTAMPTZ,
    UNIQUE (workspace_id, invited_user_id)  -- one pending invite per user per workspace
);

CREATE INDEX IF NOT EXISTS idx_invitations_invited_user ON workspace_invitations(invited_user_id, status);
CREATE INDEX IF NOT EXISTS idx_invitations_workspace    ON workspace_invitations(workspace_id);
```

### 4.5 New: `workspace_audit_log` Table

```sql
CREATE TABLE IF NOT EXISTS workspace_audit_log (
    id           SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    actor_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    action       TEXT    NOT NULL,  -- 'invite_sent','member_added','member_removed','role_changed','permissions_updated','ownership_transferred','workspace_archived'
    target_type  TEXT,              -- 'workspace_member', 'workspace', 'invitation'
    target_id    INTEGER,
    metadata     JSONB,             -- before/after state snapshot
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_workspace ON workspace_audit_log(workspace_id, created_at DESC);
```

### 4.6 New: `plans` Table (Admin-Managed)

```sql
CREATE TABLE IF NOT EXISTS plans (
    id               SERIAL PRIMARY KEY,
    name             TEXT    NOT NULL UNIQUE,   -- 'free', 'starter', 'pro', 'business'
    display_name     TEXT    NOT NULL,
    max_team_seats   INTEGER,                   -- NULL = unlimited
    max_workspaces   INTEGER,                   -- NULL = unlimited (workspaces owned, not memberships)
    features         JSONB   NOT NULL DEFAULT '{}',
    price_monthly    NUMERIC(10,2),
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed default plans
INSERT INTO plans (name, display_name, max_team_seats, max_workspaces, price_monthly) VALUES
    ('free',     'Free',     0,    1,    0),
    ('starter',  'Starter',  2,    1,    null),
    ('pro',      'Pro',      5,    3,    null),
    ('business', 'Business', null, null, null)
ON CONFLICT DO NOTHING;
```

### 4.7 New: `workspace_subscriptions` Table

Each workspace has its own subscription — a user can own a Pro workspace and a Free workspace.

```sql
CREATE TABLE IF NOT EXISTS workspace_subscriptions (
    id           SERIAL PRIMARY KEY,
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    plan_id      INTEGER NOT NULL REFERENCES plans(id),
    status       TEXT    NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
    starts_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at   TIMESTAMPTZ,                          -- NULL = no expiry (lifetime / manually managed)
    notes        TEXT,                                 -- admin notes
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id)                              -- one active subscription per workspace
);

-- Every workspace starts on free plan
-- (inserted automatically when workspace is created)
```

### 4.8 New: `admins` Table

Completely separate from `users`. Admin accounts have no workspace context.

```sql
CREATE TABLE IF NOT EXISTS admins (
    id         SERIAL PRIMARY KEY,
    email      TEXT    NOT NULL UNIQUE,
    password   TEXT    NOT NULL,  -- bcrypt hash, managed separately
    fname      TEXT,
    lname      TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.9 Existing Tables — Column Rename

All data tables rename `coach_id` → `workspace_id`. The numeric values do not change (see Migration Strategy, Section 13).

| Table | Column Rename | FK Target Change |
|-------|--------------|-----------------|
| `clients` | `coach_id` → `workspace_id` | `users(id)` → `workspaces(id)` |
| `transactions` | `coach_id` → `workspace_id` | `users(id)` → `workspaces(id)` |
| `training_plans` | `coach_id` → `workspace_id` | `users(id)` → `workspaces(id)` |
| `nutrition_plans` | `coach_id` → `workspace_id` | `users(id)` → `workspaces(id)` |
| `forms` | `coach_id` → `workspace_id` | `users(id)` → `workspaces(id)` |
| `packages` | `coach_id` → `workspace_id` | `users(id)` → `workspaces(id)` |
| `payment_methods` | `coach_id` → `workspace_id` | `users(id)` → `workspaces(id)` |

---

## 5. Auth Flow

### 5.1 Login Flow (Unified)

**Endpoint:** `POST /api/auth/login`  
**Body:** `{ email, password }`

```
1. Verify email + password against users table
2. Fetch all workspaces the user can access:
   a. Owned:  SELECT * FROM workspaces WHERE owner_id = $userId AND archived_at IS NULL
   b. Member: SELECT w.*, wm.role, wm.permissions
              FROM workspace_members wm JOIN workspaces w ON w.id = wm.workspace_id
              WHERE wm.user_id = $userId AND wm.is_active = TRUE AND w.archived_at IS NULL
3. Fetch pending invitations count:
   SELECT COUNT(*) FROM workspace_invitations
   WHERE invited_user_id = $userId AND status = 'pending'
4. Determine target workspace:
   a. If user.default_workspace_id is set AND that workspace is in the accessible list → use it
   b. If user has exactly one accessible workspace → use it
   c. Otherwise → return workspaces list to frontend; frontend shows workspace picker
5. If a workspace is resolved:
   Issue JWT: { userId, workspaceId, role, permissions } (see 5.3)
   Set 'token' cookie (httpOnly, 7d)
6. Return: { workspaces[], pendingInvitationsCount, selectedWorkspace?, token? }
```

### 5.2 Workspace Switcher

**Endpoint:** `POST /api/auth/switch-workspace`  
**Body:** `{ workspaceId }`  
**Auth:** existing `token` cookie (any valid user)

```
1. Verify user has access to the requested workspaceId (owner or active member)
2. Fetch role + permissions for that workspace
3. Issue new JWT with new workspaceId + role
4. Set new 'token' cookie (resets expiry to 7d)
5. Return: { token, workspace: { id, slug, name } }
```

Frontend redirects to `/[newWorkspaceSlug]/dashboard`.

### 5.3 JWT Payload

**Single token shape for all users:**

```json
{
  "userId": 42,
  "workspaceId": 7,
  "role": "owner",
  "permissions": null,
  "iat": 1746393600,
  "exp": 1746998400
}
```

- `role` is `"owner"` if `workspaces.owner_id = userId`, else the `workspace_members.role`
- `permissions` is `null` when role is `"owner"` (owner has all permissions implicitly)
- `permissions` is the JSONB object when role is a member role

### 5.4 Updated `authMiddleware`

```js
// server/middleware/auth.js
function authMiddleware(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Not authenticated' });

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        // Convenience flags used throughout route handlers
        req.user.workspaceId = decoded.workspaceId;
        req.user.isOwner     = decoded.role === 'owner';
        next();
    } catch {
        res.status(401).json({ message: 'Invalid token' });
    }
}
```

All route handlers then use `req.user.workspaceId` wherever they previously used `req.user.id` as the tenant filter.

### 5.5 Admin Auth (Separate)

**Endpoint:** `POST /api/admin/login`  
**Cookie:** `admin_token` (separate from `token`)  
**JWT payload:** `{ adminId, isAdmin: true }`

Admin middleware:
```js
// server/middleware/adminAuth.js
function adminAuthMiddleware(req, res, next) {
    const token = req.cookies.admin_token;
    if (!token) return res.status(401).json({ message: 'Not authenticated' });
    try {
        const decoded = jwt.verify(token, process.env.ADMIN_JWT_SECRET);
        if (!decoded.isAdmin) throw new Error();
        req.admin = decoded;
        next();
    } catch {
        res.status(401).json({ message: 'Invalid admin token' });
    }
}
```

Admin uses a **separate JWT secret** (`ADMIN_JWT_SECRET` env var) so admin tokens are cryptographically isolated from user tokens.

### 5.6 `GET /api/auth/me` — Updated Response

Returns context-aware identity including current workspace:

```json
{
  "userId": 42,
  "fname": "John",
  "lname": "Doe",
  "email": "john@example.com",
  "currentWorkspace": {
    "id": 7,
    "slug": "john-fitness",
    "name": "John's Fitness",
    "role": "owner",
    "permissions": null
  },
  "workspaces": [
    { "id": 7,  "slug": "john-fitness",  "name": "John's Fitness",  "role": "owner" },
    { "id": 12, "slug": "elite-coaches", "name": "Elite Coaches",   "role": "trainer" }
  ],
  "pendingInvitationsCount": 2,
  "defaultWorkspaceId": 7
}
```

---

## 6. Workspace Lifecycle

### 6.1 Workspace Creation (on Register)

When a new user registers, the server automatically:
1. Inserts the user into `users`
2. Generates a slug from their email prefix (same normalization as today)
3. Inserts a row into `workspaces` (`owner_id = user.id`)
4. Inserts a row into `workspace_subscriptions` (`plan_id = free plan id`)
5. Sets `users.default_workspace_id` = the new workspace id

### 6.2 Creating Additional Workspaces

**Endpoint:** `POST /api/workspaces`  
**Body:** `{ name, slug? }`  
**Auth:** any logged-in user

Gated by plan: `SELECT max_workspaces FROM plans p JOIN workspace_subscriptions ws ...`  
Count of owned workspaces the user has:  
`SELECT COUNT(*) FROM workspaces WHERE owner_id = $userId AND archived_at IS NULL`

If over limit → 403 with upgrade message.

### 6.3 Setting Default Workspace

**Endpoint:** `PUT /api/auth/default-workspace`  
**Body:** `{ workspaceId }`

User must be owner or active member of that workspace. Sets `users.default_workspace_id`.

### 6.4 Workspace Archival (Soft Delete)

**Endpoint:** `DELETE /api/workspaces/:id`  
**Auth:** owner only

```sql
UPDATE workspaces SET archived_at = NOW() WHERE id = $id AND owner_id = $userId
```

- All data (clients, transactions, plans) is preserved and queryable by admins
- Workspace no longer appears in any user's workspace list
- If it was a user's `default_workspace_id`, that field is set to NULL (ON DELETE SET NULL constraint)
- Restoration is admin-only via the admin dashboard

### 6.5 Workspace Slug Customization

Slug is on `workspaces`, not `users`. Same one-time customization rule applies. Only the owner can change it.

**Endpoint:** `PUT /api/workspaces/:id/slug`  
**Body:** `{ slug }`

```
1. requireOwner check
2. Check slug_customized — if TRUE, reject (one-time only)
3. Normalize slug (lowercase, alphanumeric, hyphens)
4. Check global uniqueness in workspaces table
5. Update workspaces SET slug = $slug, slug_customized = TRUE
6. Log to workspace_audit_log
```

---

## 7. Invitation Flow

### 7.1 Sending an Invitation

**Endpoint:** `POST /api/workspaces/:id/invitations`  
**Body:** `{ email, role, message? }`  
**Auth:** owner or manager with `team.write` permission

```
1. Verify requester is owner or manager of workspaceId
2. Check seat limit: count active members + pending invitations ≤ plan.max_team_seats
3. Look up users WHERE email = $email
   → Not found: 400 "This email is not registered on FitForce"
4. Check the user is not already an active member: workspace_members WHERE workspace_id AND user_id
   → Already member: 409 "This person is already in your workspace"
5. Check for duplicate pending invitation: workspace_invitations WHERE workspace_id AND invited_user_id AND status='pending'
   → Exists: 409 "A pending invitation already exists for this user"
6. Check you're not inviting yourself:
   → Same user: 400 "You cannot invite yourself"
7. Check you're not inviting the current workspace owner:
   → Is owner: 400 "This person is already the workspace owner"
8. INSERT INTO workspace_invitations (workspace_id, invited_by_user_id, invited_user_id, role, message)
9. Log to workspace_audit_log
10. Return 201: { invitation }
```

### 7.2 Viewing Pending Invitations

The invited user sees their invitations in two places:
- **Login response** — `pendingInvitationsCount` badge drives a notification indicator
- **Invitations page** — `GET /api/invitations/me` returns all pending invitations with workspace details

**Endpoint:** `GET /api/invitations/me`  
**Auth:** any logged-in user

Returns:
```json
[
  {
    "id": 3,
    "workspace": { "id": 7, "slug": "john-fitness", "name": "John's Fitness" },
    "invitedBy": { "fname": "John", "lname": "Doe" },
    "role": "trainer",
    "message": "Hey, join my coaching team!",
    "createdAt": "..."
  }
]
```

### 7.3 Accepting an Invitation

**Endpoint:** `POST /api/invitations/:id/accept`  
**Auth:** the invited user (confirmed by matching `invited_user_id = req.user.userId`)

```
1. Fetch invitation: must be status='pending' and invited_user_id = req.user.userId
2. Re-check seat limit (in case plan was downgraded since invite was sent)
3. BEGIN transaction
   a. INSERT INTO workspace_members (workspace_id, user_id, role, permissions)
      permissions = DEFAULT_PERMISSIONS[role]
   b. UPDATE workspace_invitations SET status='accepted', responded_at=NOW()
4. COMMIT
5. Log to workspace_audit_log
6. Return 200: { member, workspace }
```

### 7.4 Declining an Invitation

**Endpoint:** `POST /api/invitations/:id/decline`  
**Auth:** the invited user

```
1. Fetch invitation: must be status='pending' and invited_user_id = req.user.userId
2. UPDATE workspace_invitations SET status='declined', responded_at=NOW()
3. Return 200
```

### 7.5 Cancelling an Invitation (Owner/Manager)

**Endpoint:** `DELETE /api/workspaces/:id/invitations/:invitationId`  
**Auth:** owner or manager with `team.write`

```
1. Verify invitation belongs to this workspace
2. Must be status='pending' (can't cancel already responded)
3. DELETE FROM workspace_invitations WHERE id = $invitationId
4. Log to workspace_audit_log
```

---

## 8. Admin Dashboard

### 8.1 Admin Account Setup

No self-registration. Admin accounts are seeded directly in the database:

```sql
INSERT INTO admins (email, password, fname, lname)
VALUES ('admin@fitforce.app', $bcrypt_hash, 'Bahaa', 'Ahmed');
```

A one-time setup script creates the first admin account. Additional admins can be created via the admin dashboard itself.

### 8.2 Admin Login

**Route:** `POST /api/admin/login`  
**Cookie:** `admin_token` (httpOnly, separate from `token`)  
**Separate JWT secret:** `ADMIN_JWT_SECRET`

Admin login page: `/admin/login` (already exists as a placeholder)

### 8.3 Admin Pages & API Endpoints

The `app/admin/` directory already exists. Build out:

#### Users Management (`/admin/users`)
- List all users (search by email/name, filter by plan, pagination)
- View user profile + their workspaces (owned and member)
- Disable/enable user account

**API:** `GET /api/admin/users`, `GET /api/admin/users/:id`, `PUT /api/admin/users/:id/status`

#### Workspaces Management (`/admin/workspaces`)
- List all workspaces (search by slug/name, filter by plan, show archived)
- View workspace details: member count, client count, subscription
- Restore archived workspace
- Force-archive a workspace
- Override workspace subscription plan

**API:** `GET /api/admin/workspaces`, `GET /api/admin/workspaces/:id`, `PUT /api/admin/workspaces/:id/subscription`, `POST /api/admin/workspaces/:id/restore`

#### Plans Management (`/admin/plans`) — new page
- List all plans with their limits
- Edit plan limits (max_team_seats, max_workspaces, features)
- Create new plan tiers

**API:** `GET /api/admin/plans`, `POST /api/admin/plans`, `PUT /api/admin/plans/:id`

#### Stats Overview (`/admin`) — already placeholder
- Total users, total workspaces, active subscriptions by plan
- Recent registrations

**API:** `GET /api/admin/stats`

### 8.4 Admin Route Protection

```
client/app/admin/
  login/
    page.js        ← no auth required
  layout.js        ← new: checks admin_token cookie, redirects to /admin/login if missing
  page.js          ← stats overview
  users/
    page.js
  workspaces/
    page.js
  plans/           ← new page
    page.js
```

The admin layout calls `GET /api/admin/me` to verify the admin token. If it fails, redirect to `/admin/login`. No auth currently protects the admin pages — this is a **security gap that must be closed in Phase 1** before any admin feature ships.

---

## 9. Backend API Changes

### 9.1 All Existing Routes

Two changes on every existing route:

**a) Replace `req.user.id` with `req.user.workspaceId`** in every SQL `coach_id = $X` parameter.

**b) Rename the parameter column from `coach_id` to `workspace_id`** in SQL queries (after migration).

**c) Add `requirePermission(module, action)`** middleware per verb:

```js
// server/routes/nutrition.js — example after changes
router.use(authMiddleware);
router.get('/',    requirePermission('nutrition', 'read'),   handler);
router.post('/',   requirePermission('nutrition', 'write'),  handler);
router.put('/:id', requirePermission('nutrition', 'write'),  handler);
router.delete('/:id', requirePermission('nutrition', 'delete'), handler);
```

#### Route → Module Mapping

| Route File | Module | Notes |
|-----------|--------|-------|
| `routes/clients.js` | `clients` | |
| `routes/nutrition.js` | `nutrition` | |
| `routes/training.js` | `training` | |
| `routes/forms.js` | `forms` | |
| `routes/transactions.js` | `finance` | |
| `routes/packages.js` | `finance` | |
| `routes/payment-methods.js` | `finance` | |
| `routes/dashboard.js` | `clients` (read only) | |
| `routes/auth.js` | n/a | Add `requireOwner` to slug route — slug moves to workspace route |
| `routes/clientPortal.js` | n/a | Client portal auth unchanged; `coach_slug` lookup → `workspaces.slug` |

### 9.2 New Route Files

```
server/routes/
  workspaces.js      — workspace CRUD, slug update, archive
  team.js            — workspace members CRUD, permissions
  invitations.js     — send/accept/decline/cancel invitations
  admin.js           — all /api/admin/* endpoints
```

Register in `server.js`:
```js
server.use('/api/workspaces',   require('./routes/workspaces'));
server.use('/api/invitations',  require('./routes/invitations'));
server.use('/api/admin',        require('./routes/admin'));
```

### 9.3 Updated Client Portal Route

The client portal currently resolves the coach by `users.coach_slug`. After migration:

```sql
-- BEFORE
SELECT id FROM users WHERE coach_slug = $1

-- AFTER
SELECT id FROM workspaces WHERE slug = $1 AND archived_at IS NULL
```

This returns `workspace_id` which is then used to authenticate the client and scope their data. The URL `/portal/[workspaceSlug]` remains unchanged.

### 9.4 New Route: `POST /api/auth/switch-workspace`

Issues a new JWT for a different workspace the user has access to. The frontend calls this from the workspace switcher in the top bar.

### 9.5 New Middleware Files

```
server/middleware/
  auth.js                 — updated (adds workspaceId, isOwner to req.user)
  requirePermission.js    — new (module + action check)
  requireOwner.js         — new (blocks non-owners)
  adminAuth.js            — new (validates admin_token)
```

### 9.6 New Lib Files

```
server/lib/
  defaultPermissions.js   — role → permissions JSONB mapping constants
  seatLimits.js           — reads plan limits from DB (replaces env var hack)
```

---

## 10. Frontend Changes

### 10.1 URL Structure Overhaul

All coach dashboard routes move under a dynamic `[workspaceSlug]` segment:

**Current structure:**
```
app/(coach)/
  dashboard/page.js
  clients/page.js
  clients/[id]/...
  settings/page.js
  ...
```

**New structure:**
```
app/
  (auth)/
    login/page.js          ← unified login (unchanged path)
    register/page.js       ← unchanged
  [workspaceSlug]/
    (workspace)/           ← route group: workspace auth layout
      dashboard/page.js
      clients/
        page.js
        [id]/
          page.js
          training/page.js
          nutrition/page.js
          ...
      settings/
        page.js            ← general settings (owner only for sensitive parts)
        team/page.js       ← team members management
      finance/page.js
      forms/page.js
      nutrition/page.js
      training/page.js
      databases/page.js
      layout.js            ← workspace auth guard (reads workspaceSlug from params)
  portal/
    [workspaceSlug]/...    ← unchanged path
  admin/
    login/page.js          ← new
    layout.js              ← new (admin auth guard)
    page.js
    users/page.js
    workspaces/page.js
    plans/page.js          ← new
  page.js                  ← root redirect (to default workspace or login)
```

### 10.2 Workspace Auth Layout

`app/[workspaceSlug]/(workspace)/layout.js` replaces the current `app/(coach)/layout.js`:

```js
// Key changes from current layout:
// 1. Reads workspaceSlug from params
// 2. Calls /api/auth/me to get current user + workspace context
// 3. Verifies the workspaceSlug in the URL matches the workspace in the JWT
//    (if mismatch, calls /api/auth/switch-workspace automatically)
// 4. Stores permissions in a React context for use by child components
// 5. Redirects to /login if not authenticated
```

### 10.3 Workspace Switcher (Top Bar)

A dropdown component in the top navigation bar showing:
- Current workspace name + role badge
- List of all accessible workspaces
- "Set as default" option per workspace
- "Create new workspace" link
- Pending invitations badge (count from `/api/auth/me`)

On workspace selection: calls `POST /api/auth/switch-workspace`, then navigates to `/[newSlug]/dashboard`.

### 10.4 Permissions Hook

```js
// client/hooks/usePermissions.js
export function usePermissions() {
    const { user } = useWorkspaceContext();
    return {
        can: (module, action = 'read') => {
            if (user?.role === 'owner') return true;
            return !!user?.permissions?.[module]?.[action];
        },
        isOwner: user?.role === 'owner',
    };
}
```

### 10.5 Sidebar Updates

Permission-gated navigation items (same logic as before, now using the hook):

| Item | Permission |
|------|-----------|
| Dashboard | always visible |
| Clients | `clients.read` |
| Training | `training.read` |
| Nutrition | `nutrition.read` |
| Forms | `forms.read` |
| Finance | `finance.read` |
| Databases | `databases.read` |
| Settings | always visible (content inside is gated) |
| Team (inside Settings) | `team.read` |

### 10.6 Invitations UI

Shown on the workspace picker / after login if user has pending invitations:

- A dismissible card or modal: *"You have 2 pending workspace invitations"*
- Clicking opens an invitations list page (`/invitations`) with Accept / Decline buttons
- Notification badge on the top bar for logged-in users

### 10.7 Internal API Calls

Every API call from the frontend currently has no workspace context (the server reads it from the JWT). This remains true — **no URL changes are needed in API calls**, only in the frontend routing. The workspace context is always read from the JWT on the server side.

---

## 11. Ownership Transfer

### 11.1 Updated Flow

With the new model, both owner and transferee are already in `users`, so no `INSERT INTO users` is needed. The transfer is a simpler operation:

```sql
BEGIN;

-- 1. Find the target member
SELECT user_id, role FROM workspace_members
WHERE id = $memberId AND workspace_id = $workspaceId;
-- Must exist and be an active member

-- 2. Transfer ownership
UPDATE workspaces SET owner_id = $targetUserId WHERE id = $workspaceId;

-- 3. Remove target from workspace_members (now they're the owner)
DELETE FROM workspace_members WHERE user_id = $targetUserId AND workspace_id = $workspaceId;

-- 4. Add old owner as a manager
INSERT INTO workspace_members (workspace_id, user_id, role, permissions)
VALUES ($workspaceId, $oldOwnerId, 'manager', $managerDefaultPermissions);

-- 5. Audit log
INSERT INTO workspace_audit_log ...;

COMMIT;
```

### 11.2 Post-Transfer Behavior

- The old owner's JWT still says `role: 'owner'` until it expires (max 1h with current expiry)
- On next `GET /api/auth/me`, the server re-reads the workspace ownership and will see the mismatch
- The `/api/auth/me` response derives role from the database, not from the JWT — so the old owner immediately gets `role: 'manager'` in the response even before re-login
- The new owner must log out and back in to get an `owner`-scoped JWT

**Recommended:** After transfer completes, force both parties to call `POST /api/auth/switch-workspace` with their workspace — this issues a fresh JWT with the correct role. The frontend can trigger this automatically after a successful transfer.

### 11.3 API Endpoint

```
POST /api/workspaces/:id/transfer-ownership
Body: { memberId, ownerPassword }
Auth: requireOwner
```

### 11.4 Edge Cases

| Situation | Handling |
|-----------|----------|
| Target member is a manager | Allowed |
| Target member is not active | 400 — "Member is not active" |
| Old owner has no memberships left after transfer | They become a manager in this workspace (see step 4) |
| User's `default_workspace_id` pointed to this workspace | Unaffected — they still have access as manager |

---

## 12. Subscription Plan Gating

### 12.1 What's Gated per Plan

| Limit | Free | Starter | Pro | Business |
|-------|------|---------|-----|----------|
| Team seats (active members) | 0 | 2 | 5 | Unlimited |
| Workspaces owned | 1 | 1 | 3 | Unlimited |

### 12.2 Seat Limit Enforcement

Checked on **two events**:
1. `POST /api/workspaces/:id/invitations` — before creating an invitation
2. `POST /api/invitations/:id/accept` — before creating the membership (plan may have changed since invite)

```js
async function checkSeatLimit(workspaceId) {
    const { rows } = await pool.query(`
        SELECT p.max_team_seats,
               COUNT(wm.id) AS active_members,
               COUNT(wi.id) AS pending_invitations
        FROM workspace_subscriptions ws
        JOIN plans p ON p.id = ws.plan_id
        LEFT JOIN workspace_members wm ON wm.workspace_id = $1 AND wm.is_active = TRUE
        LEFT JOIN workspace_invitations wi ON wi.workspace_id = $1 AND wi.status = 'pending'
        WHERE ws.workspace_id = $1
        GROUP BY p.max_team_seats
    `, [workspaceId]);

    const { max_team_seats, active_members, pending_invitations } = rows[0];
    if (max_team_seats === null) return;  // unlimited
    const used = parseInt(active_members) + parseInt(pending_invitations);
    if (used >= max_team_seats) {
        throw { status: 403, message: `Your plan allows ${max_team_seats} team seat(s). Upgrade to add more.` };
    }
}
```

Pending invitations count toward the seat limit (prevents over-inviting while waiting for accepts).

### 12.3 Workspace Limit Enforcement

Checked on `POST /api/workspaces`:

```js
async function checkWorkspaceLimit(userId) {
    // Find the plan of the user's primary (oldest) workspace subscription
    // or the highest-tier plan if they have multiple workspaces
    const { rows } = await pool.query(`
        SELECT MIN(p.max_workspaces) AS max_workspaces,
               COUNT(w.id) AS owned_count
        FROM workspaces w
        JOIN workspace_subscriptions ws ON ws.workspace_id = w.id
        JOIN plans p ON p.id = ws.plan_id
        WHERE w.owner_id = $1 AND w.archived_at IS NULL
        GROUP BY w.owner_id
    `, [userId]);
    // ... limit check
}
```

### 12.4 Admin Override

Admin can manually set a workspace's subscription plan via the admin dashboard, bypassing the normal limits. This covers enterprise deals, trials, or support situations.

---

## 13. Data Migration Strategy

This is the riskiest part of the entire feature. Do this in a single transaction with a rollback plan.

### 13.1 Why It's Safe

The key insight: **existing `coach_id` values equal existing `users.id` values**. If we backfill `workspaces` with `id = users.id`, then:
- `clients.coach_id = 42` → `clients.workspace_id = 42` (same number)
- The FK target changes from `users(id)` to `workspaces(id)`, but the value `42` is valid in both

This means the data migration is **a rename + FK retarget with no value changes**. Zero rows of application data need updating.

### 13.2 Migration Steps (in order)

```sql
BEGIN;

-- Step 1: Create workspaces table (with no FK from workspaces to users yet, to allow arbitrary id seeding)
CREATE TABLE workspaces (
    id              INTEGER PRIMARY KEY,   -- not SERIAL yet
    slug            TEXT NOT NULL UNIQUE,
    name            TEXT NOT NULL,
    owner_id        INTEGER NOT NULL,
    slug_customized BOOLEAN NOT NULL DEFAULT FALSE,
    archived_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Step 2: Backfill one workspace per existing user, preserving user.id as workspace.id
INSERT INTO workspaces (id, slug, name, owner_id, slug_customized, created_at)
SELECT
    u.id,
    COALESCE(u.coach_slug, 'workspace-' || u.id::text),
    COALESCE(u.fname || '''s Workspace', 'Workspace ' || u.id::text),
    u.id,
    COALESCE(u.slug_customized, FALSE),
    u.created_at
FROM users u;

-- Step 3: Now add the FK from workspaces to users (safe now that data is inserted)
ALTER TABLE workspaces
    ADD CONSTRAINT fk_workspaces_owner FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT;

-- Step 4: Switch workspaces.id from plain INTEGER to SERIAL for future inserts
CREATE SEQUENCE workspaces_id_seq START WITH <max_user_id + 1>;
ALTER TABLE workspaces ALTER COLUMN id SET DEFAULT nextval('workspaces_id_seq');
ALTER SEQUENCE workspaces_id_seq OWNED BY workspaces.id;

-- Step 5: Add default_workspace_id to users
ALTER TABLE users
    ADD COLUMN IF NOT EXISTS default_workspace_id INTEGER REFERENCES workspaces(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Step 6: Set default_workspace_id for all existing users (= their single workspace)
UPDATE users SET default_workspace_id = id;  -- workspace.id = user.id for all existing rows

-- Step 7: Drop old slug columns from users (AFTER workspaces has the data)
ALTER TABLE users
    DROP COLUMN IF EXISTS coach_slug,
    DROP COLUMN IF EXISTS slug_customized;

-- Step 8: Rename coach_id → workspace_id on all data tables
-- (drop old FK, rename column, add new FK)
ALTER TABLE clients
    DROP CONSTRAINT IF EXISTS clients_coach_id_fkey,
    RENAME COLUMN coach_id TO workspace_id;
ALTER TABLE clients
    ADD CONSTRAINT fk_clients_workspace FOREIGN KEY (workspace_id) REFERENCES workspaces(id);

-- Repeat for: transactions, training_plans, nutrition_plans, forms, packages, payment_methods

-- Step 9: Create workspace_members, workspace_invitations, workspace_audit_log, plans, workspace_subscriptions, admins

-- Step 10: Seed plans table (free, starter, pro, business)

-- Step 11: Seed workspace_subscriptions — all existing workspaces start on free plan
INSERT INTO workspace_subscriptions (workspace_id, plan_id)
SELECT w.id, (SELECT id FROM plans WHERE name = 'free')
FROM workspaces w;

COMMIT;
```

### 13.3 Rollback Plan

If the migration fails at any step:
- `ROLLBACK` restores the DB to pre-migration state
- No application code changes are deployed until the migration succeeds
- Test the migration on a copy of the production database first

### 13.4 Code Deployment Order

```
1. Run migration script (DB changes)
2. Deploy server changes (auth middleware, new routes, renamed columns)
3. Deploy client changes (new URL structure, workspace switcher)
```

Steps 1 and 2 must happen together — the old code uses `coach_id`, the new code uses `workspace_id`. There will be a brief downtime window during deployment.

---

## 14. Risk Register

### RISK-1 — Migration Failure on Production
**Severity: CRITICAL**  
The `coach_id` → `workspace_id` rename touches every core data table. If it fails mid-transaction, data could be inconsistent.  
**Mitigation:** Test on a full copy of production data first. Run inside a single `BEGIN/COMMIT`. Take a full DB backup immediately before running. Have a rollback plan ready.

### RISK-2 — Code Still Using `req.user.id` as Tenant Key
**Severity: HIGH**  
Any route handler that still uses `req.user.id` (= `userId`) instead of `req.user.workspaceId` will return empty results for team members (their userId won't match any workspace_id) or expose wrong workspace data.  
**Mitigation:** Grep the entire codebase for `req.user.id` before deploying. Write an integration test per route using a team member token.

### RISK-3 — Missing `requirePermission` on a Destructive Route
**Severity: HIGH**  
If one route is missing the middleware, a team member with read-only permissions could write or delete.  
**Mitigation:** Zero-permissions team member integration test suite. Review every route file in code review before merge.

### RISK-4 — Admin Route Currently Unprotected
**Severity: HIGH**  
`/admin` pages have no auth protection today. Anyone who knows the URL can access them.  
**Mitigation:** Ship admin layout.js with adminAuth guard in Phase 1 (before any admin feature content is visible).

### RISK-5 — Next.js Route Collision: `[workspaceSlug]` vs Static Routes
**Severity: MEDIUM**  
The `[workspaceSlug]` segment at the root level will catch all paths, including `/login`, `/register`, `/admin`, `/portal`. Next.js resolves static routes before dynamic ones, so `/login` resolves to `app/(auth)/login/` first. But confirm with Next.js route priority testing.  
**Mitigation:** Test all top-level routes after restructure. Add `notFound()` in the workspace layout if the slug doesn't resolve to a real workspace.

### RISK-6 — Stale JWT After Workspace Switch / Ownership Transfer
**Severity: MEDIUM**  
The JWT contains `role` and `permissions`. If these change (transfer, role update) the existing JWT is stale until expiry (1h).  
**Mitigation:** Short JWT expiry (1h). `/api/auth/me` always re-derives role from the database — the UI reflects the real state even with a stale token. Forceful re-issuance after ownership transfer.

### RISK-7 — Seat Limit Race Condition
**Severity: MEDIUM**  
Two concurrent invite-accepts could both read `count < limit` and both insert, exceeding the limit.  
**Mitigation:** Use `SELECT ... FOR UPDATE` on the seat count check inside a transaction on the accept endpoint.

### RISK-8 — Client Portal Slug Change
**Severity: MEDIUM**  
Existing clients bookmarked their portal at `/portal/[coachSlug]`. After migration, that slug moves from `users` to `workspaces` — but the value is the same (we backfill it). No URL changes for existing clients.  
**Mitigation:** Verify in migration Step 2 that every user's `coach_slug` is copied to `workspaces.slug` before dropping the column.

### RISK-9 — Manager Self-Escalation
**Severity: MEDIUM**  
A manager could try to update their own role or permissions via `PUT /api/workspaces/:id/members/:memberId`.  
**Mitigation:** If `req.user.userId === targetMember.user_id`, return 403. Only owners can update their own team role.

### RISK-10 — Workspace Slug in URL Breaks on Rename
**Severity: LOW**  
If an owner renames their workspace slug, all existing bookmarks and shared URLs break (both client portal and dashboard).  
**Mitigation:** One-time slug customization rule (same as today) limits this. Warn the owner in the slug change UI that all links will change.

### RISK-11 — Admin JWT Uses Same Secret as User JWT
**Severity: HIGH** (if not addressed)  
If admin and user JWTs share a secret, a crafted user token with `isAdmin: true` could gain admin access.  
**Mitigation:** Separate `ADMIN_JWT_SECRET` env var. Admin middleware verifies using this secret exclusively. A user token signed with `JWT_SECRET` cannot be verified with `ADMIN_JWT_SECRET`.

---

## 15. Implementation Phases

### Phase 1 — Foundation & Security Baseline
*Est. effort: 3–4 days*  
**Nothing else should ship before this phase is complete.**

- [ ] Close the open admin security gap: add `admin/layout.js` with auth check (even if it just shows "Coming soon")
- [ ] Create `admins` table + seed first admin account
- [ ] Add `server/middleware/adminAuth.js`
- [ ] Add `POST /api/admin/login` and `GET /api/admin/me`
- [ ] Create `defaultPermissions.js` constants
- [ ] Create `requirePermission.js` and `requireOwner.js` middleware
- [ ] Write unit tests for `requirePermission` and `requireOwner`

### Phase 2 — Database Migration
*Est. effort: 2–3 days*

- [ ] Test migration script on a local copy of production data
- [ ] Run migration: create `workspaces`, `workspace_members`, `workspace_invitations`, `workspace_audit_log`, `plans`, `workspace_subscriptions`, `admins`
- [ ] Backfill `workspaces` from `users`
- [ ] Rename `coach_id` → `workspace_id` on all data tables
- [ ] Seed `plans` table
- [ ] Seed `workspace_subscriptions` (all existing workspaces = free plan)
- [ ] Verify all existing data is intact and queryable

### Phase 3 — Auth Middleware & Existing Routes
*Est. effort: 3–4 days*

- [ ] Update `authMiddleware` to set `req.user.workspaceId` and `req.user.isOwner`
- [ ] Replace `req.user.id` with `req.user.workspaceId` in ALL route handlers
- [ ] Update `clientPortal.js` to resolve workspace by `workspaces.slug` instead of `users.coach_slug`
- [ ] Add `requirePermission()` to every verb in every existing route
- [ ] Add `requireOwner` to auth settings routes in `auth.js`
- [ ] Deploy and regression test all existing coach flows

### Phase 4 — Workspace & Team API
*Est. effort: 3–4 days*

- [ ] `server/routes/workspaces.js`: CRUD, slug update, archive, switch-workspace
- [ ] `server/routes/invitations.js`: send, accept, decline, cancel
- [ ] Update `POST /api/auth/login` to return workspace list + pending invitations count
- [ ] `POST /api/auth/switch-workspace`
- [ ] `PUT /api/auth/default-workspace`
- [ ] `GET /api/auth/me` — updated response shape
- [ ] `GET/POST/PUT/DELETE /api/workspaces/:id/members` — team member management
- [ ] `PUT /api/workspaces/:id/members/:memberId/permissions`
- [ ] `POST /api/workspaces/:id/transfer-ownership`
- [ ] `POST /api/workspaces` — create additional workspace
- [ ] Register all new routes in `server.js`

### Phase 5 — Frontend Restructure
*Est. effort: 4–5 days*

- [ ] Move all `app/(coach)/` pages under `app/[workspaceSlug]/(workspace)/`
- [ ] Rewrite workspace layout (`layout.js`) to handle slug validation + workspace context
- [ ] Create `WorkspaceContext` React context with user identity + permissions
- [ ] Implement `usePermissions()` hook
- [ ] Gate sidebar nav items by permissions
- [ ] Gate write/delete buttons throughout all pages
- [ ] Build workspace switcher top-bar component
- [ ] Update root `page.js` to redirect based on login state + default workspace
- [ ] Update internal links everywhere (they now include `/[workspaceSlug]/` prefix)
- [ ] Test Next.js route priority (static routes vs `[workspaceSlug]`)

### Phase 6 — Invitation UX
*Est. effort: 2–3 days*

- [ ] Invitations page (`/invitations`) — list pending invites with Accept / Decline
- [ ] Notification badge in top bar (driven by `pendingInvitationsCount`)
- [ ] Team management page (`/[slug]/settings/team`): list members, invite by email, cancel invite, edit role, deactivate
- [ ] Permissions editor UI (per-module toggles)
- [ ] Seat usage display

### Phase 7 — Admin Dashboard
*Est. effort: 3–4 days*

- [ ] `/admin/login` page
- [ ] Admin stats overview page (`/admin`)
- [ ] Users management page (`/admin/users`)
- [ ] Workspaces management page (`/admin/workspaces`) + subscription override
- [ ] Plans management page (`/admin/plans`)

### Phase 8 — Subscription Plan Gating
*Est. effort: 1–2 days*

- [ ] Replace any hardcoded seat limits with DB-driven plan lookup
- [ ] Enforce workspace creation limit per plan
- [ ] Surface upgrade CTA when seat or workspace limit is reached
- [ ] Admin plan override tested end-to-end

---

## Appendix A — New Files Summary

| File | Type | Purpose |
|------|------|---------|
| `server/middleware/requirePermission.js` | Server | Per-module permission gating |
| `server/middleware/requireOwner.js` | Server | Blocks non-owners from owner-only endpoints |
| `server/middleware/adminAuth.js` | Server | Validates admin_token cookie |
| `server/routes/workspaces.js` | Server | Workspace CRUD, slug, archive, switch |
| `server/routes/invitations.js` | Server | Invite flow (send, accept, decline, cancel) |
| `server/routes/admin.js` | Server | All `/api/admin/*` endpoints |
| `server/lib/defaultPermissions.js` | Server | Role → permissions constants |
| `server/lib/seatLimits.js` | Server | DB-driven seat + workspace limit checks |
| `client/app/[workspaceSlug]/(workspace)/layout.js` | Client | Workspace auth guard + context provider |
| `client/app/[workspaceSlug]/(workspace)/settings/team/page.js` | Client | Team management UI |
| `client/app/invitations/page.js` | Client | Accept/decline invitations |
| `client/app/admin/login/page.js` | Client | Admin login |
| `client/app/admin/layout.js` | Client | Admin auth guard |
| `client/app/admin/plans/page.js` | Client | Plan management |
| `client/hooks/usePermissions.js` | Client | Permission check hook |
| `client/context/WorkspaceContext.js` | Client | Workspace + permissions React context |

## Appendix B — Environment Variables to Add

```env
ADMIN_JWT_SECRET=<separate secret for admin tokens>
```
