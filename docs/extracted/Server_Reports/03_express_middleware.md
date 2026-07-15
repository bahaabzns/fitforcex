# Phase 3: Express App & Middleware — Deep Review

**Date:** 2026-07-14
**Scope:** app.ts, server.ts, all middleware (8 TS + 6 JS), security stack, error handling
**Score: VERY GOOD** (4.0/5) — Well-composed app with strong security stack, but admin auth lacks session DB validation

---

## 1. APP COMPOSITION — Score: **Excellent**

### 1.1 app.ts (197 lines)

Clean, well-organized Express app composition:

```
1. Security stack (Helmet, CORS, compression)
2. Webhook route (before express.json)
3. Body parsing + cookie parsing
4. Request counting
5. Rate limiting router
6. 18 module routers
7. Swagger docs
8. Health check
9. Server metrics
10. Global error handler
```

**Quality:**
- Middleware ordering is correct (webhook before body parsing, security before routes)
- `trust proxy: 1` for reverse proxy support
- Request counter for server metrics
- Graceful shutdown via SIGINT/SIGTERM

### 1.2 server.ts (25 lines)

```typescript
const httpServer = http.createServer(app);
initSocket(httpServer);
httpServer.listen(env.PORT, env.HOST);
```

**Good:** Clean separation. Socket.IO initialized after HTTP server created. Migrations run on startup (skipped in test).

---

## 2. SECURITY STACK — Score: **Very Good**

### 2.1 Helmet (Custom CSP)

```typescript
helmet({
    frameguard: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc:     ["'self'"],
            scriptSrc:      ["'self'", "'unsafe-inline'"],
            styleSrc:       ["'self'", "'unsafe-inline'"],
            imgSrc:         ["'self'", "data:", "https:"],
            connectSrc:     ["'self'", "https://api.fitforce.io", "https://*.fitforce.io"],
            fontSrc:        ["'self'", "https:", "data:"],
            objectSrc:      ["'none'"],
            mediaSrc:       ["'self'"],
            frameSrc:       ["'self'"],
            frameAncestors: ["'self'", "https://fitforceapp.com", "https://*.fitforceapp.com"],
        },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
})
```

**Quality:**
- `frameguard: false` — Replaced by custom `frameAncestors` (correct)
- `objectSrc: 'none'` — Blocks plugins
- `connectSrc` scoped to API domains
- `frameAncestors` allows only fitforceapp.com (prevents clickjacking)
- HSTS with 1-year max-age + preload

**Issues:**
1. **`scriptSrc: 'unsafe-inline'`** — Necessary for Next.js SSR but weakens CSP. Consider nonces.
2. **`styleSrc: 'unsafe-inline'`** — Same concern.

### 2.2 CORS

```typescript
// lib/cors.ts
export function isAllowedOrigin(origin: string | undefined): boolean {
    if (!origin) return true;
    if (env.ALLOWED_ORIGINS.includes(origin)) return true;
    // Development: allow any localhost port
    // Production: allow root domain + subdomains
    return hostname === root || hostname.endsWith(`.${root}`);
}
```

**Excellent:**
- Explicit allowlist + regex pattern
- Development mode allows any localhost port
- Production scoped to root domain + subdomains
- Malformed Origin header → reject (not guess)

### 2.3 Rate Limiting (5 Tiers)

| Limiter | Window | Max | Purpose |
|---------|--------|-----|---------|
| `loginLimiter` | 15 min | 10 | Brute force protection |
| `workspaceDiscoveryLimiter` | 15 min | 10 | Slug enumeration prevention |
| `readLimiter` | 1 min | 500 | GET request cap |
| `mutationLimiter` | 1 min | 100 | POST/PUT/PATCH/DELETE cap |
| `uploadLimiter` | 1 min | 20 | File upload cap |

**Quality:**
- Standard headers enabled (`RateLimit-*`)
- Legacy headers disabled
- Skipped in test environment (prevents test flakiness)
- `apiLimiter` dynamically selects read vs mutation based on HTTP method

### 2.4 Compression

```typescript
app.use(compression());
```

**Good:** Gzip compression enabled globally.

---

## 3. AUTH MIDDLEWARE — Score: **Good**

### 3.1 Coach Auth (`auth.ts`)

```typescript
export async function authMiddleware(req, res, next) {
    const token = req.cookies.token;
    const decoded = jwt.verify(token, env.JWT_SECRET);
    const session = await prisma.user_sessions.findUnique({
        where: { token_hash: hashToken(token) },
    });
    if (!session || session.revoked_at || session.expires_at < new Date()) {
        return res.status(401).json({ message: 'Session expired or revoked' });
    }
    req.user = { userId, workspaceId, role, permissions, isOwner };
}
```

**Excellent:**
- JWT verification + session DB validation
- Checks `revoked_at` and `expires_at`
- Sets `req.user` with full context

### 3.2 Admin Auth (`adminAuth.ts`)

```typescript
export function adminAuthMiddleware(req, res, next) {
    const token = req.cookies.admin_token;
    const decoded = jwt.verify(token, env.ADMIN_JWT_SECRET);
    if (!decoded.isAdmin) throw new Error('Not an admin token');
    req.admin = decoded;
}
```

**Issue:** No session DB validation. Admin tokens are valid indefinitely until JWT expiry.

### 3.3 Client Auth (`clientAuth.ts`)

```typescript
export function clientAuthMiddleware(req, res, next) {
    const token = req.cookies.client_token
        ?? (bearer?.startsWith('Bearer ') ? bearer.slice('Bearer '.length) : undefined);
    const decoded = jwt.verify(token, env.JWT_SECRET);
    req.client = { clientId, workspaceId };
}
```

**Issue:** No session DB validation. Client tokens are valid indefinitely until JWT expiry.

### 3.4 RBAC Middleware

```typescript
// requireOwner.ts
export function requireOwner(req, res, next) {
    if (!req.user?.isOwner) return res.status(403);
    next();
}

// requirePermission.ts
export function requirePermission(module, action) {
    return (req, res, next) => {
        if (req.user.isOwner) return next();  // Owner bypasses all checks
        const allowed = req.user.permissions?.[module]?.[action] === true;
        if (!allowed) return res.status(403);
        next();
    };
}
```

**Excellent:**
- Owner bypasses all permission checks (correct)
- Permission matrix: `permissions[module][action] === true`
- Factory pattern for `requirePermission` (reusable)

---

## 4. SCHEDULER — Score: **Very Good**

### 4.1 Cron Jobs (5)

| Scheduler | Cron | Purpose |
|-----------|------|---------|
| `scheduleFormDispatcher` | `0 * * * *` (hourly) | Dispatch pending forms |
| `scheduleSubscriptionExpiry` | `0 0 * * *` (daily) | Expire workspace subscriptions |
| `scheduleSessionCleanup` | `0 2 * * *` (daily 2am) | Delete old sessions (30+ days) |
| `scheduleClientStatusSync` | `30 0 * * *` (daily 00:30) | Recompute client subscription status |
| `scheduleCheckInDispatch` | `0 * * * *` (hourly) | Dispatch due check-in forms |

### 4.2 Quality

**Excellent:**
- All schedulers skip in test environment
- Each has try/catch with error logging
- `runCheckInDispatchTick` uses bounded concurrency (chunks of 50)
- `scheduleClientStatusSync` includes review-due notifications
- Batched processing prevents memory balloons

**Issues:**
1. **No distributed lock** — Multiple server instances could run same scheduler simultaneously
2. **`console.log` instead of `logger`** — Inconsistent logging in scheduler

---

## 5. ERROR HANDLING — Score: **Very Good**

### 5.1 Global Error Handler

```typescript
app.use((err, _req, res, _next) => {
    const status = err.status ?? err.statusCode ?? 500;
    if (status >= 500) {
        logger.error({ err }, 'Unhandled server error');
        Sentry.captureException(err);
    }
    res.status(status).json({ error: err.message ?? 'Internal server error' });
});
```

**Quality:**
- 5xx errors logged + sent to Sentry
- 4xx errors returned without logging (correct)
- Fallback message for undefined errors

### 5.2 Health Check

```typescript
app.get('/api/health', async (_req, res) => {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
        status: 'healthy',
        database: { status: 'connected', responseTimeMs },
        memory: { heapUsedMB, heapTotalMB },
    });
});
```

**Excellent:**
- DB ping with response time
- Memory stats
- 503 on DB failure

### 5.3 Graceful Shutdown

```typescript
process.on('SIGINT',  async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });
```

**Good:** Clean Prisma disconnect on shutdown.

---

## 6. CRITICAL ISSUES SUMMARY

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | **Admin auth lacks session DB validation** | HIGH | Add session check like coach auth |
| 2 | **Client auth lacks session DB validation** | HIGH | Add session check like coach auth |
| 3 | **No distributed lock for schedulers** | MEDIUM | Add mutex/lock before cron execution |
| 4 | **`console.log` in scheduler** | LOW | Replace with `logger` |
| 5 | **`unsafe-inline` in CSP** | LOW | Consider nonces |

---

## 7. WHAT'S WELL DONE

1. **Clean app composition** — 197 lines, correct middleware ordering, well-organized.

2. **Custom CORS logic** — Supports multi-tenant subdomains + dev mode.

3. **5-tier rate limiting** — Login, workspace discovery, read, mutation, upload.

4. **Coach auth with session DB validation** — JWT + session check + revocation + expiry.

5. **RBAC with owner bypass** — Owner skips all checks; permissions are granular.

6. **5 cron schedulers** — Form dispatch, subscription expiry, session cleanup, status sync, check-in dispatch.

7. **Bounded concurrency** — Scheduler processes in chunks of 50 to prevent memory balloons.

8. **Health check with DB ping** — Response time + memory stats.

9. **Server metrics endpoint** — Owner-only uptime, request count, memory.

10. **Global error handler** — 5xx → Sentry, 4xx → silent.

---

## 8. RECOMMENDED ACTIONS (Priority Order)

### Immediate
1. Add session DB validation to admin auth middleware
2. Add session DB validation to client auth middleware

### Short-term
3. Add distributed lock for schedulers (Redis mutex)
4. Replace `console.log` with `logger` in scheduler

### Medium-term
5. Add CSP nonces to replace `unsafe-inline`
6. Add request ID for tracing

---

*Report generated: 2026-07-14 | Reviewer: Senior Code Reviewer | Next: Phase 4 — Authentication & Authorization*
