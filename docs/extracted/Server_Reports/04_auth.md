# Phase 4: Authentication & Authorization — Deep Review

**Date:** 2026-07-14
**Scope:** Auth module, middleware, RBAC, session management, cookie config, password flows
**Score: GOOD** (3.5/5) — Strong auth with session DB tracking and RBAC, but registration not rate-limited and password reset doesn't invalidate sessions

---

## 1. AUTH MODULE — Score: **Very Good**

### 1.1 Files (921 lines)

| File | Lines | Purpose |
|------|-------|---------|
| `auth.controller.ts` | 492 | All auth handlers |
| `auth.routes.ts` | 284 | 13 routes with Swagger |
| `auth.service.ts` | 144 | Token/session/workspace logic |
| `auth/index.ts` | 1 | Barrel export |

### 1.2 Routes (13)

| Route | Method | Rate Limited | Auth Required |
|-------|--------|-------------|---------------|
| `/register` | POST | **No** | No |
| `/login` | POST | Yes (loginLimiter) | No |
| `/me` | GET | No | Yes |
| `/clone-status` | GET | No | Yes |
| `/logout` | POST | No | No |
| `/switch-workspace` | POST | No | Yes |
| `/default-workspace` | PUT | No | Yes |
| `/workspace-slug` | PUT | No | Yes + Owner |
| `/send-verification` | POST | Yes (loginLimiter) | Yes |
| `/verify-email` | POST | No | Yes |
| `/forgot-password` | POST | Yes (loginLimiter) | No |
| `/reset-password` | POST | Yes (loginLimiter) | No |
| `/profile` | PATCH | No | Yes |

---

## 2. TOKEN MANAGEMENT — Score: **Excellent**

### 2.1 Token Generation

```typescript
export function issueToken(payload: Record<string, unknown>): string {
    return jwt.sign(payload, env.JWT_SECRET, { expiresIn: '7d' });
}
```

**Quality:**
- 7-day expiry
- Payload includes: `userId`, `workspaceId`, `role`, `permissions`
- Signed with `JWT_SECRET`

### 2.2 Session Tracking

```typescript
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

export async function revokeSession(token: string): Promise<void> {
    await prisma.user_sessions.updateMany({
        where: { token_hash: hashToken(token) },
        data: { revoked_at: new Date() },
    });
}

export function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}
```

**Excellent:**
- Tokens stored as SHA-256 hashes (not plaintext)
- Session creation on login/register
- Session revocation on logout/switch-workspace
- Expiry tracked in DB

### 2.3 Auth Middleware Validation

```typescript
const session = await prisma.user_sessions.findUnique({
    where: { token_hash: hashToken(token) },
});
if (!session || session.revoked_at || session.expires_at < new Date()) {
    return res.status(401).json({ message: 'Session expired or revoked' });
}
```

**Excellent:** Three-layer validation: JWT verify → session exists → not revoked + not expired.

---

## 3. RBAC — Score: **Excellent**

### 3.1 Roles (5)

| Role | Clients | Training | Nutrition | Forms | Finance | Databases | Team |
|------|---------|----------|-----------|-------|---------|-----------|------|
| **Manager** | R/W/D | R/W/D | R/W/D | R/W/D | — | R/W | R/W |
| **Trainer** | R/W | R/W/D | — | R/W | — | R/W | — |
| **Nutritionist** | R/W | — | R/W/D | R/W | — | R/W | — |
| **Receptionist** | R | — | — | — | R/W | — | — |
| **Viewer** | R | R | R | — | — | R | — |

**Excellent:**
- 7 modules × 3 actions (read/write/delete) = 21 permission booleans
- Owner bypasses all checks
- Permissions stored as JSONB in `workspace_members`
- Default permissions per role defined in code

### 3.2 Permission Check

```typescript
export function requirePermission(module: string, action = 'read') {
    return (req, res, next) => {
        if (req.user.isOwner) return next();  // Owner bypasses
        const allowed = req.user.permissions?.[module]?.[action] === true;
        if (!allowed) return res.status(403);
        next();
    };
}
```

**Quality:** Factory pattern, owner bypass, granular module+action check.

---

## 4. COOKIE CONFIG — Score: **Excellent**

```typescript
export function cookieOptions() {
    return {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
        maxAge: 7 * 24 * 60 * 60 * 1000,  // 7 days
    };
}
```

**Excellent:**
- `httpOnly: true` — No JavaScript access
- `secure: true` in production — HTTPS only
- `sameSite: 'lax'` — CSRF protection
- Configurable `COOKIE_DOMAIN` for cross-subdomain sharing
- 7-day expiry matching JWT expiry

---

## 5. AUTH FLOWS — Score: **Very Good**

### 5.1 Registration

```
1. Validate input (email, password, phone)
2. Check email + phone uniqueness (case-insensitive)
3. Hash password (bcrypt, 10 rounds)
4. Generate workspace slug from email
5. Create user + workspace + subscription in transaction
6. Send verification email (background)
7. Clone default libraries (background)
8. Auto-login: create session + set cookie
```

**Quality:**
- Transaction for user + workspace creation
- Background library cloning (non-blocking)
- Auto-login after registration
- Email verification code (6-digit, 15-min expiry)

### 5.2 Login

```
1. Validate input
2. Find user by email (case-insensitive)
3. Compare password (bcrypt)
4. Build workspace context (role, permissions)
5. Fetch workspaces + pending invitations
6. Issue token + create session
7. Set cookie
```

**Quality:**
- Case-insensitive email matching
- Workspace context includes role + permissions
- Parallel fetch of workspaces + invitations

### 5.3 Password Reset

```
1. Find user by email
2. Invalidate unused reset tokens
3. Create new reset token (6-digit, 15-min expiry)
4. Send reset email (background)
5. User submits code + new password
6. Validate token + expiry
7. Hash new password + update user
8. Mark token as used
```

**Issue:** Password reset does NOT invalidate existing sessions. A compromised token remains valid after password change.

### 5.4 Workspace Switch

```
1. Validate user has access to target workspace
2. Revoke old session
3. Create new session with new workspace context
4. Set new cookie
```

**Excellent:** Old session revoked on workspace switch.

---

## 6. CRITICAL ISSUES SUMMARY

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | **Registration not rate-limited** | HIGH | Add `loginLimiter` to `/register` |
| 2 | **Password reset doesn't invalidate sessions** | HIGH | Add `prisma.user_sessions.deleteMany({ where: { user_id } })` after reset |
| 3 | **`ADMIN_JWT_SECRET` defaults to empty string** | HIGH | Make required or fallback to JWT_SECRET |
| 4 | **Admin auth lacks session DB validation** | MEDIUM | Add session check like coach auth |
| 5 | **Client auth lacks session DB validation** | MEDIUM | Add session check like coach auth |
| 6 | **No account lockout after failed attempts** | MEDIUM | Add progressive lockout or CAPTCHA |

---

## 7. WHAT'S WELL DONE

1. **Session DB tracking** — Tokens stored as SHA-256 hashes, revocation supported, expiry checked.

2. **Three-layer auth validation** — JWT verify → session exists → not revoked + not expired.

3. **RBAC with 5 roles** — Granular permissions across 7 modules. Owner bypasses all checks.

4. **Secure cookie config** — httpOnly, secure, sameSite lax, configurable domain.

5. **Workspace switch revokes old session** — Prevents session fixation.

6. **Background library cloning** — Registration returns immediately, cloning happens async.

7. **Email verification** — 6-digit code with 15-minute expiry.

8. **Password reset prevents email enumeration** — Always returns 200 regardless of email existence.

9. **Swagger documentation** — All 13 routes documented with OpenAPI specs.

10. **Input validation** — Email format, password length, phone required.

---

## 8. RECOMMENDED ACTIONS (Priority Order)

### Immediate
1. Add rate limiting to `/register` endpoint
2. Invalidate all sessions on password reset
3. Make `ADMIN_JWT_SECRET` required or fallback to `JWT_SECRET`

### Short-term
4. Add session DB validation to admin auth middleware
5. Add session DB validation to client auth middleware
6. Add account lockout after 5 failed login attempts

### Medium-term
7. Add refresh token rotation
8. Add session listing (user can see active sessions)
9. Add "revoke all sessions" feature

---

*Report generated: 2026-07-14 | Reviewer: Senior Code Reviewer | Next: Phase 5 — Business Logic (Core Modules)*
