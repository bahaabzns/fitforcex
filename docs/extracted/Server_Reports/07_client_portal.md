# Phase 7: Client Portal — Deep Review

**Date:** 2026-07-14
**Scope:** clientPortal module, clientAccessPolicy, portal auth, access gating
**Score: VERY GOOD** (4.0/5) — Sophisticated access policy engine with subscription-based gating, but client auth lacks session DB validation

---

## 1. PORTAL ARCHITECTURE — Score: **Excellent**

### 1.1 Files

| File | Lines | Purpose |
|------|-------|---------|
| `clientPortal.controller.ts` | 1,016 | All portal handlers |
| `clientPortal.routes.ts` | 542 | 24 routes with Swagger |
| `clientPortalNotifications.controller.ts` | 77 | Portal notifications |
| `clientAccessPolicy.ts` | 81 | Access policy middleware |

### 1.2 Routes (24)

| Category | Endpoints | Auth |
|----------|-----------|------|
| Auth | discover-workspace, login, logout, me, access | Public/client |
| Training | training-plans, training-plans/:id | clientAuth + portalOpen + access |
| Nutrition | nutrition-plans, nutrition-plans/:id | clientAuth + portalOpen + access |
| Forms | form-requests, form-requests/:id/submit | clientAuth + portalOpen + access |
| Messages | threads, threads/:id/messages | clientAuth + portalOpen + access |
| Progress | progress/history, progress/transformation | clientAuth + portalOpen + access |
| Workout | workout-logs | clientAuth + portalOpen + access |
| Notifications | notifications, unread-count | clientAuth + loadClientAccess |
| Profile | profile (PATCH) | clientAuth + loadClientAccess |

### 1.3 Middleware Chain

```typescript
// Feature routes:
const open = [clientAuthMiddleware, loadClientAccess, requirePortalOpen];

// Per-feature routes:
router.get('/training-plans', ...open, requireClientAccess('view_training_plans'), handler);
router.post('/threads/:id/messages', ...open, requireClientAccess('allow_messaging'), handler);
```

**Excellent:** Three-layer access control:
1. `clientAuthMiddleware` — JWT verification
2. `loadClientAccess` — Compute effective access from subscription policy
3. `requirePortalOpen` / `requireClientAccess` — Gate based on access flags

---

## 2. ACCESS POLICY ENGINE — Score: **Excellent**

### 2.1 clientAccessPolicy.ts (81 lines)

```typescript
export async function loadClientAccess(req, res, next) {
    const effective = await getEffectiveAccessForClient(req.client.clientId, req.client.workspaceId);
    req.clientAccess = effective;
    next();
}

export function requirePortalOpen(req, res, next) {
    if (!access || access.access.keep_portal_access) return next();
    res.status(403).json({ error: 'Portal access restricted', code: 'PORTAL_RESTRICTED' });
}

export function requireClientAccess(permission: PermissionKey) {
    return (req, res, next) => {
        if (access && access.access[permission] !== true) {
            return res.status(403).json({ error: 'Action not available', code: 'ACCESS_RESTRICTED' });
        }
        next();
    };
}
```

**Excellent:**
- Computed once per request (not per route)
- Granular per-feature gating (10 permission keys)
- Clear error codes (`PORTAL_RESTRICTED`, `ACCESS_RESTRICTED`)
- `requireAnyClientAccess` for OR logic (assessments + check-ins)

### 2.2 Permission Keys (10)

| Key | Default (Active) | Expired | Frozen |
|-----|-----------------|---------|--------|
| `keep_portal_access` | true | true | true |
| `view_training_plans` | true | true | true |
| `view_nutrition_plans` | true | true | true |
| `view_progress_history` | true | true | true |
| `view_assessments` | true | true | true |
| `view_checkins` | true | true | true |
| `allow_messaging` | true | false | false |
| `allow_submit_checkins` | true | false | false |
| `allow_booking_appointments` | true | false | false |
| `allow_download_files` | true | false | false |

**Quality:** Expired/frozen clients retain read access but lose write access.

---

## 3. PORTAL AUTH — Score: **Good**

### 3.1 Login Flow

```
1. discover-workspace (email → workspace list)
2. login (coachSlug + email + password → client_token cookie)
3. me (client profile + workspace info)
4. access (effective permissions)
```

**Quality:**
- Email-first discovery for mobile flow
- Rate-limited login (loginLimiter)
- Rate-limited discovery (workspaceDiscoveryLimiter)
- Bearer token support for mobile clients

### 3.2 Issues

| # | Issue | Severity |
|---|-------|----------|
| 1 | **Client auth lacks session DB validation** | HIGH |
| 2 | **No session revocation on password change** | MEDIUM |

---

## 4. N+1 QUERY OPTIMIZATION — Score: **Excellent**

### 4.1 Flat Query + In-Memory Assembly

```typescript
// Instead of nested queries:
const flatRows = await prisma.$queryRaw`...`; // Single query with JOINs
const plan = buildNutritionPlanHierarchy(plan, flatRows); // In-memory assembly
```

**Excellent:** The portal avoids the N+1 patterns found in the coach modules by using flat queries with JOINs and assembling hierarchies in memory.

### 4.2 Comparison

| Module | Pattern | Queries for 5-day plan |
|--------|---------|----------------------|
| `training.getPlan()` (coach) | Nested N+1 | ~87 |
| `clientPortal.getTrainingPlan()` | Flat + assembly | ~3 |

---

## 5. CRITICAL ISSUES SUMMARY

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | **Client auth lacks session DB validation** | HIGH | Add session check like coach auth |
| 2 | **No session revocation on password change** | MEDIUM | Add `deleteMany` on password update |
| 3 | **`buildNutritionPlanHierarchy` is 100+ lines** | LOW | Extract to utility module |

---

## 6. WHAT'S WELL DONE

1. **Three-layer access control** — Auth → access policy → feature gating.

2. **Subscription-based permissions** — 10 granular flags per client status.

3. **Flat query optimization** — Avoids N+1 with JOINs + in-memory assembly.

4. **Swagger documentation** — All 24 routes documented.

5. **Rate limiting** — Login and workspace discovery rate-limited.

6. **Bearer token support** — Mobile clients can use Authorization header.

7. **Soft notifications** — Portal notifications separate from coach notifications.

8. **Error codes** — `PORTAL_RESTRICTED`, `ACCESS_RESTRICTED` for client-side handling.

---

## 7. RECOMMENDED ACTIONS (Priority Order)

### Immediate
1. Add session DB validation to client auth middleware

### Short-term
2. Add session revocation on password change
3. Extract `buildNutritionPlanHierarchy` to utility module

### Medium-term
4. Add refresh token rotation for portal sessions
5. Add session listing for portal clients

---

*Report generated: 2026-07-14 | Reviewer: Senior Code Reviewer | Next: Phase 8 — Shared Libraries*
