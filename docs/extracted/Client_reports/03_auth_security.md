# Phase 3: Auth & Security — Deep Review

**Date:** 2026-07-14
**Scope:** Login/register flows, session management, route protection, cookie handling, CORS, password handling, rate limiting, role-based access
**Score: FAIR** (3.0/5) — Solid foundation with three auth systems, but dual codebase (JS/TS) creates inconsistencies and old middleware lacks session validation

---

## 1. AUTH SYSTEM ARCHITECTURE

### 1.1 Three Isolated Auth Systems

| System | Cookie | JWT Secret | Session Table | Middleware |
|--------|--------|-----------|---------------|------------|
| **Coach** | `token` | `JWT_SECRET` | `user_sessions` (TS only) | `auth.ts` / `auth.js` |
| **Admin** | `admin_token` | `ADMIN_JWT_SECRET` | None | `adminAuth.ts` / `adminAuth.js` |
| **Client Portal** | `client_token` | `JWT_SECRET` (shared with coach) | None | `clientAuth.ts` / `clientAuth.js` |

**Assessment:** Three separate cookies with separate names is correct — prevents cross-role token reuse. However, coach and client portal share `JWT_SECRET`, meaning a client token could theoretically be verified by the coach middleware (the payload structure differs, but the signing key is the same).

### 1.2 Dual Codebase Problem

The server has **two parallel implementations**:

| Layer | JS (routes/) | TS (src/) |
|-------|-------------|-----------|
| Auth routes | `routes/auth.js` (606 lines) | `src/modules/auth/auth.routes.ts` (284 lines) |
| Auth middleware | `middleware/auth.js` (22 lines) | `src/middleware/auth.ts` (38 lines) |
| Session tracking | **None** | `user_sessions` table + `createSession`/`revokeSession` |
| Client auth | `middleware/clientAuth.js` (18 lines) | `src/middleware/clientAuth.ts` (27 lines) |

**Which one is actually used?** `server.js` imports from `routes/` (the JS versions). The TS versions in `src/` appear to be the intended replacement but aren't wired into the running server yet.

---

## 2. COACH AUTH FLOW — Score: **Fair**

### 2.1 Login Flow

```
Client POST /api/auth/login { email, password }
  → rate limit check (loginLimiter: 10/15min)
  → find user by email (case-insensitive)
  → bcrypt.compare(password, user.password)
  → buildToken(userId) → resolves default workspace
  → issueToken({ userId, workspaceId, role, permissions }) → JWT, 7d expiry
  → [TS: createSession(userId, token)] ← NOT in JS version
  → res.cookie('token', token, cookieOptions)
```

**Quality:**
- Rate limiting on login endpoint — good brute force protection
- Case-insensitive email matching — prevents duplicate account issues
- bcrypt with salt rounds 10 — appropriate cost factor
- JWT 7-day expiry — reasonable for a SaaS app
- Cookie httpOnly + secure + sameSite:lax — correct security flags

**Issues:**
1. **JS routes don't create sessions** — `routes/auth.js:login` issues a JWT but never calls `createSession()`. This means the `user_sessions` table is never populated by the running code, making session revocation impossible
2. **JS `/me` endpoint skips session validation** — `routes/auth.js:268-310` verifies the JWT but never checks `user_sessions`. A stolen JWT remains valid for 7 days with no way to revoke it
3. **No password complexity requirements** — Only `length >= 8` is enforced. No uppercase, lowercase, number, or special character requirements
4. **Registration not rate-limited** — `router.post('/register')` has no `loginLimiter`. An attacker could create bulk accounts

### 2.2 Session Management (TS Version)

```typescript
// auth.service.ts:116-125
export async function createSession(userId: string, token: string): Promise<void> {
    await prisma.user_sessions.create({
        data: {
            id: createId(),
            user_id: userId,
            token_hash: hashToken(token),
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
    });
}
```

**Quality:**
- Tokens stored as SHA-256 hashes (not plaintext) — correct
- Sessions have expiry timestamps — enables cleanup
- `revoked_at` field for soft deletion — supports logout revocation

**Issues:**
1. **No session cleanup job** — Expired sessions accumulate in the database forever. Need a periodic cleanup (e.g., `DELETE FROM user_sessions WHERE expires_at < NOW()`)
2. **One session per login** — No limit on concurrent sessions. A user could have unlimited active sessions
3. **Workspace switch creates new session, revokes old** — `switchWorkspace` correctly revokes the previous session and creates a new one. This is good

### 2.3 Auth Middleware Comparison

**JS version (`middleware/auth.js`):**
```javascript
function authMiddleware(req, res, next) {
    const token = req.cookies.token;
    if (!token) return res.status(401).json({ message: 'Not authenticated' });
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;  // ← trusts JWT payload entirely
        req.user.userId = decoded.userId;
        req.user.workspaceId = decoded.workspaceId;
        req.user.isOwner = decoded.role === 'owner';
        next();
    } catch {
        res.status(401).json({ message: 'Invalid token' });
    }
}
```

**TS version (`src/middleware/auth.ts`):**
```typescript
export async function authMiddleware(req, res, next) {
    const token = req.cookies.token;
    if (!token) { res.status(401)...; return; }
    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
        const session = await prisma.user_sessions.findUnique({
            where: { token_hash: hashToken(token) },
        });
        if (!session || session.revoked_at || session.expires_at < new Date()) {
            res.status(401).json({ message: 'Session expired or revoked' });
            return;
        }
        req.user = { /* validated from DB session */ };
        next();
    } catch {
        res.status(401).json({ message: 'Invalid token' });
    }
}
```

**Critical difference:** The TS version validates against the session table. The JS version (which is what's actually running) does not. This is the single biggest security gap in the codebase.

---

## 3. ADMIN AUTH — Score: **Fair**

### 3.1 Admin Login

```javascript
// routes/admin.js:12-42
router.post('/login', loginLimiter, async (req, res, next) => {
    const token = jwt.sign(
        { adminId: admin.id, isAdmin: true },
        process.env.ADMIN_JWT_SECRET,
        { expiresIn: '8h' }
    );
    res.cookie('admin_token', token, { httpOnly: true, secure: ..., sameSite: 'Lax', maxAge: 8h });
});
```

**Quality:**
- Separate `ADMIN_JWT_SECRET` — good isolation from coach tokens
- 8-hour expiry (shorter than coach's 7 days) — appropriate for admin
- Rate limited on login

**Issues:**
1. **No session table for admin** — Admin tokens can't be revoked. A stolen admin token is valid for 8 hours
2. **No admin session tracking** — No way to see who's logged in or force logout
3. **`isAdmin: true` in JWT payload** — The middleware checks `decoded.isAdmin`, but this is self-declared in the token. If `ADMIN_JWT_SECRET` is weak, an attacker could forge admin tokens
4. **Admin auth doesn't validate admin exists** — The middleware doesn't check if the admin record still exists in the database. A deleted admin's token remains valid until expiry

### 3.2 Admin Subdomain Restriction (TS Only)

```typescript
// src/middleware/adminAuth.ts:24-47
export function requireAdminSubdomain(req, res, next) {
    if (env.NODE_ENV !== 'production') return next();  // ← bypass in dev
    const origin = req.get('origin');
    subdomain = new URL(origin).hostname.split('.')[0];
    if (!['admin', 'management'].includes(subdomain)) {
        res.status(403).json({ error: 'Admin access not permitted from this domain' });
    }
}
```

**Quality:** Smart use of Origin header to verify the request comes from admin subdomain. The comment explains why `req.hostname` doesn't work (API has a fixed host).

**Issue:** This middleware is in `src/` but `server.js` uses `routes/admin.js` which doesn't reference it. Admin API endpoints are accessible from any subdomain in the current running code.

---

## 4. CLIENT PORTAL AUTH — Score: **Fair**

### 4.1 Portal Login

```javascript
// routes/clientPortal.js:25-79
router.post('/login', loginLimiter, async (req, res, next) => {
    const { email, password, workspace_slug, coach_slug } = req.body;
    const slug = workspace_slug || coach_slug;
    // Find client by email + workspace slug
    const result = await pool.query(
        `SELECT c.* FROM clients c
         JOIN workspaces w ON w.id = c.workspace_id
         WHERE c.email = $1 AND w.slug = $2 AND w.archived_at IS NULL`,
        [email, slug.trim()]
    );
    // bcrypt.compare, then issue JWT
    const token = jwt.sign(
        { id: client.id, workspaceId: client.workspace_id },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
    );
    res.cookie('client_token', token, { ... });
});
```

**Quality:**
- Workspace-scoped login — client can only access their own workspace
- Checks `archived_at IS NULL` — prevents login to archived workspaces
- Rate limited

**Issues:**
1. **Shares `JWT_SECRET` with coach tokens** — A client token could be verified by coach auth middleware (payload structure differs, but same key)
2. **No session tracking** — Client tokens can't be revoked
3. **JWT payload uses `id` (client ID) not `userId`** — The TS `clientAuth.ts` expects `decoded.clientId` but the JS `clientPortal.js` signs `{ id: client.id }`. This is a field name mismatch between the two implementations
4. **No workspace status check** — If a workspace is archived after login, the client's token remains valid for 7 days
5. **`coach_slug` accepted as alias** — `const slug = workspace_slug || coach_slug` — backward compatibility is fine, but should be deprecated

### 4.2 Client Access Policy (TS Only)

```typescript
// src/middleware/clientAccessPolicy.ts
export function requirePortalOpen(req, res, next) {
    if (!access || access.access.keep_portal_access) { next(); return; }
    res.status(403).json({ error: 'Your portal access is currently restricted.', code: 'PORTAL_RESTRICTED' });
}

export function requireClientAccess(permission) {
    return (req, res, next) => {
        if (access && access.access[permission] !== true) {
            res.status(403).json({ error: 'This action is not available on your current subscription.' });
        }
    };
}
```

**Excellent:** Granular subscription-based access control. The `loadClientAccess` middleware computes effective access once per request, then `requirePortalOpen` and `requireClientAccess` gates check specific flags. This is well-designed.

**Issue:** This is in `src/` but the running `routes/clientPortal.js` doesn't use it. The subscription gating is only enforced client-side (via `ClientPortalProvider` filtering nav items), not server-side. A determined user could call restricted API endpoints directly.

---

## 5. PASSWORD HANDLING — Score: **Good**

### 5.1 Hashing

```javascript
const hashed = await bcrypt.hash(password, 10);
```

- bcrypt with 10 salt rounds — appropriate (cost factor 10 = ~100ms per hash)
- Password stored as bcrypt hash in `users.password` column

### 5.2 Password Reset Flow

```
1. POST /api/auth/forgot-password { email }
   → Find user by email (case-insensitive)
   → Generate 6-digit code
   → Invalidate previous unused codes
   → Store code with 15min expiry
   → Send email (always returns same response — prevents enumeration)

2. POST /api/auth/reset-password { email, code, newPassword }
   → Find user by email
   → Validate code + expiry + not used
   → Hash new password with bcrypt
   → Update password + mark code as used
```

**Quality:**
- Email enumeration prevention — consistent response regardless of email existence
- Previous codes invalidated on new request
- Code expiry (15 minutes) — appropriate
- Code is 6-digit numeric — easy to type, 1M combinations

**Issues:**
1. **Password reset doesn't invalidate existing sessions** — After reset, old JWT tokens remain valid. Should revoke all sessions for the user: `DELETE FROM user_sessions WHERE user_id = $1`
2. **No "password changed" notification email** — User should be notified when their password changes
3. **6-digit code has only 1M combinations** — With rate limiting (10 req/15min), brute force would take ~100,000 minutes (69 days). This is adequate given the 15min expiry, but a longer code would be more secure

### 5.3 Password Change (Authenticated)

```javascript
// routes/auth.js:558-604
if (newPassword) {
    if (!currentPassword) return res.status(400).json({ message: 'Current password is required' });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(401).json({ message: 'Current password is incorrect' });
    updates.password = await bcrypt.hash(newPassword, 10);
}
```

**Good:** Requires current password verification before allowing change.

**Issue:** Same as reset — doesn't invalidate other sessions after password change.

---

## 6. COOKIE SECURITY — Score: **Good**

### 6.1 Cookie Configuration

```javascript
function cookieOptions() {
    return {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'Lax',
        domain: process.env.COOKIE_DOMAIN || undefined,
        maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
    };
}
```

**Quality:**
- `httpOnly: true` — Prevents XSS access to cookie
- `secure: true` in production — HTTPS only
- `sameSite: 'Lax'` — Good balance (allows top-level navigation, blocks cross-site POST)
- Configurable domain — Supports `.fitforce.app` for cross-subdomain sharing
- 7-day maxAge — Matches JWT expiry

### 6.2 Cookie Clearing on Logout

```javascript
// routes/auth.js:549-555
router.post('/logout', (req, res) => {
    const base = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'Lax' };
    res.clearCookie('token', { ...base, domain: process.env.COOKIE_DOMAIN || undefined });
    res.clearCookie('token', base);  // ← clears without domain too
    res.status(200).json({ message: 'Logged out successfully' });
});
```

**Smart:** Clears cookie with and without domain — handles both pre-COOKIE_DOMAIN and post-COOKIE_DOMAIN deployments.

**Issue:** The JS version doesn't call `revokeSession(token)` — the session remains valid even after logout. Only the TS version (`auth.controller.ts:443-451`) revokes the session.

---

## 7. RATE LIMITING — Score: **Good**

### 7.1 Rate Limit Configuration

| Limiter | Window | Max Requests | Applied To |
|---------|--------|-------------|------------|
| `loginLimiter` | 15 min | 10 | Login, forgot-password, reset-password, send-verification |
| `readLimiter` | 1 min | 500 | GET requests (via apiLimiter) |
| `mutationLimiter` | 1 min | 100 | POST/PUT/PATCH/DELETE (via apiLimiter) |
| `uploadLimiter` | 1 min | 20 | Upload endpoints |

**Quality:**
- Separate limiters for different action types — prevents read traffic from blocking mutations
- Login limiter is aggressive (10/15min) — good for brute force prevention
- Standard headers enabled — clients can see rate limit state

**Issues:**
1. **Registration not rate-limited** — `POST /api/auth/register` has no `loginLimiter`. Bulk account creation is possible
2. **IP-based only** — Behind a reverse proxy, all users share the same IP. Need to consider `X-Forwarded-For` or user-based limiting for authenticated routes
3. **No rate limit on `/api/auth/me`** — This endpoint is called 2-3 times per page load (see Phase 2). Under load, this could be a bottleneck

---

## 8. CORS & SECURITY HEADERS — Score: **Good**

### 8.1 CORS Configuration

```javascript
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(',');
const FITFORCE_DOMAIN_RE = /^https:\/\/([a-z0-9-]+\.)?fitforce\.app$/;

server.use(cors({
    origin: (origin, cb) => {
        if (!origin) return cb(null, true);                    // Allow non-browser requests
        if (ALLOWED_ORIGINS.includes(origin)) return cb(null, true);  // Explicit origins
        if (FITFORCE_DOMAIN_RE.test(origin)) return cb(null, true);   // *.fitforce.app
        cb(new Error(`CORS: ${origin} not allowed`));
    },
    credentials: true,
}));
```

**Quality:**
- Regex-based domain matching for `*.fitforce.app` — supports all subdomains
- `credentials: true` — Allows cookie-based auth cross-origin
- Non-browser requests allowed (no Origin header) — needed for server-to-server
- Explicit allowed origins for dev environments

**Issue:** The regex `^https:\/\/([a-z0-9-]+\.)?fitforce\.app$` allows any subdomain. If an attacker registers `evil.fitforce.app` (if the domain isn't properly locked), they could make cross-origin requests. However, this requires controlling a subdomain of fitforce.app, which is unlikely if the domain is properly managed.

### 8.2 Helmet

```javascript
server.use(helmet());
```

**Good:** Default Helmet configuration adds:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `X-XSS-Protection: 0` (modern browsers)
- `Strict-Transport-Security` (in production)
- And others

---

## 9. ROLE-BASED ACCESS CONTROL — Score: **Good**

### 9.1 Middleware Stack

| Middleware | Purpose | Used By |
|-----------|---------|---------|
| `authMiddleware` | Validates coach JWT + session | Coach routes |
| `adminAuthMiddleware` | Validates admin JWT | Admin routes |
| `clientAuthMiddleware` | Validates client JWT | Portal routes |
| `requireOwner` | Blocks non-owners | Slug update, subscription changes |
| `requirePermission(module, action)` | Granular permissions | Feature-specific routes |
| `requirePortalOpen` (TS) | Blocks restricted clients | Portal feature routes |
| `requireClientAccess(key)` (TS) | Per-feature subscription gates | Portal feature routes |

**Quality:** Well-layered. The `requirePermission` middleware is particularly well-designed:

```javascript
function requirePermission(module, action = 'read') {
    return (req, res, next) => {
        if (user.isOwner) return next();  // Owners bypass all permissions
        const allowed = user.permissions?.[module]?.[action] === true;
        if (!allowed) return res.status(403).json({ message: 'Permission denied' });
        next();
    };
}
```

**Issue:** The permissions are stored in the JWT payload (`decoded.permissions`), not validated against the database on each request. If a member's permissions are changed, the old JWT (with old permissions) remains valid for up to 7 days.

---

## 10. INPUT VALIDATION — Score: **Fair**

### 10.1 Registration Validation

```javascript
// routes/auth.js:147-164
if (!email || typeof email !== 'string' || !email.trim()) { ... }
if (!/^\S+@\S+\.\S+$/.test(email.trim())) { ... }
if (!password || typeof password !== 'string' || !password.trim()) { ... }
if (password.length < 8) { ... }
```

**Quality:** Basic validation present — checks for required fields, email format, password length.

**Issues:**
1. **No validation library** — All validation is manual. Using `zod` or `joi` would provide consistent, type-safe validation
2. **No fname/lname validation** — Names are accepted as-is with no length or character limits
3. **No phone number format validation** — Phone is trimmed but not validated against a pattern
4. **SQL injection safe** — All queries use parameterized queries (`$1`, `$2`, etc.) — this is correct

### 10.2 Profile Update SQL Construction

```javascript
// routes/auth.js:593-598
const setClauses = Object.keys(updates).map((k, i) => {
    params.push(updates[k]);
    return `${k} = $${i + 1}`;
});
params.push(req.user.userId);
const { rows: updated } = await pool.query(
    `UPDATE users SET ${setClauses.join(', ')} WHERE id = $${params.length} RETURNING ...`,
    params
);
```

**Security note:** The column names (`k`) come from `Object.keys(updates)`, which are hardcoded in the `updates` object above. The values are parameterized. This is safe because the keys are not user-controlled. However, if this pattern were reused with user-controlled keys, it would be a SQL injection vector.

---

## 11. DUAL CODEBASE IMPACT — Score: **Poor**

### 11.1 What's Actually Running vs What's Written

| Feature | JS (routes/) — RUNNING | TS (src/) — NOT RUNNING |
|---------|----------------------|------------------------|
| Session creation on login | **No** | Yes |
| Session revocation on logout | **No** | Yes |
| Session validation in middleware | **No** | Yes |
| Admin subdomain restriction | **No** | Yes |
| Client access policy (subscription gates) | **No** | Yes |
| Client Bearer token support | **No** | Yes |
| Auto-login on registration | **No** | Yes |
| OpenAPI/Swagger docs | **No** | Yes |

### 11.2 Risk Assessment

The TS codebase has significantly better security than the JS codebase. The fact that the JS version is what's running means:

1. **No session revocation** — Logged-out sessions remain valid for 7 days
2. **No subscription enforcement** — Client portal access restrictions are client-side only
3. **No admin subdomain check** — Admin API accessible from any origin
4. **No session validation** — Stolen JWTs can't be detected or revoked

---

## 12. CRITICAL ISSUES SUMMARY

| # | Issue | Severity | File | Fix |
|---|-------|----------|------|-----|
| 1 | **JS auth middleware doesn't validate sessions** — stolen tokens can't be revoked | CRITICAL | `middleware/auth.js` | Switch to TS auth middleware or add session validation |
| 2 | **JS logout doesn't revoke sessions** — logged-out tokens remain valid | HIGH | `routes/auth.js:549` | Add `revokeSession(token)` call |
| 3 | **Password reset doesn't invalidate sessions** — old tokens survive password change | HIGH | `routes/auth.js:502-547` | Add session revocation after password reset |
| 4 | **Client access policy not enforced server-side** — subscription gates are client-side only | HIGH | `routes/clientPortal.js` | Wire TS `clientAccessPolicy` middleware |
| 5 | **Admin subdomain restriction not enforced** — admin API accessible from any origin | HIGH | `routes/admin.js` | Wire TS `requireAdminSubdomain` middleware |
| 6 | **Registration not rate-limited** — bulk account creation possible | MEDIUM | `routes/auth.js:147` | Add `loginLimiter` to register route |
| 7 | **JWT permissions not revalidated** — stale permissions in token for up to 7 days | MEDIUM | `middleware/auth.js` | Revalidate permissions against DB or shorten token expiry |
| 8 | **Shared JWT_SECRET for coach and client portal** — cross-role token verification possible | MEDIUM | `.env` | Use separate secrets for each auth system |
| 9 | **No session cleanup job** — expired sessions accumulate in DB | LOW | — | Add periodic cleanup cron job |
| 10 | **Admin token not validated against DB** — deleted admin's token remains valid | MEDIUM | `middleware/adminAuth.js` | Add admin existence check |

---

## 13. WHAT'S WELL DONE

1. **Three isolated auth cookies** — Separate `token`, `admin_token`, `client_token` prevents cross-role token reuse at the cookie level.

2. **TS auth architecture** — The session tracking, token hashing, revocation, and subscription-based access policies in `src/` are production-grade. When fully migrated, this will be a strong auth system.

3. **bcrypt with proper salt rounds** — 10 rounds is the right balance of security and performance.

4. **Email enumeration prevention** — `forgot-password` always returns the same response regardless of email existence.

5. **Rate limiting hierarchy** — Separate limiters for login (aggressive), reads (generous), mutations (moderate), and uploads (strict).

6. **CORS with domain regex** — Properly supports the multi-tenant subdomain architecture while blocking unknown origins.

7. **Cookie security flags** — httpOnly, secure, sameSite:lax, configurable domain — all correct.

8. **Workspace-scoped client login** — Client must provide their workspace slug, preventing cross-workspace login attempts.

9. **requirePermission middleware** — Clean, composable permission checks with owner bypass. Well-designed for team-based access.

10. **Parameterized queries throughout** — No SQL injection vectors in any route handler.

---

## 14. RECOMMENDED ACTIONS (Priority Order)

### Immediate (Before Next Commit)
1. **Complete the JS → TS migration for auth routes** — The TS version has session tracking, revocation, and access policies that the JS version lacks. This is the single most impactful security improvement.
2. **Add `revokeSession(token)` to JS logout** — Quick fix until full TS migration

### Short-term (This Sprint)
3. Add session invalidation to password reset flow
4. Add `loginLimiter` to registration endpoint
5. Use separate `CLIENT_JWT_SECRET` for client portal tokens
6. Add admin existence check to admin auth middleware

### Medium-term
7. Implement session cleanup cron job (delete expired sessions daily)
8. Add account lockout after N failed attempts (e.g., 5 failures → 30min lock)
9. Add "password changed" notification email
10. Add password complexity requirements (uppercase + number + special char)
11. Consider shorter JWT expiry (e.g., 24h) with refresh token pattern

---

*Report generated: 2026-07-14 | Reviewer: Senior Code Reviewer | Next: Phase 4 — Data Layer & State*
