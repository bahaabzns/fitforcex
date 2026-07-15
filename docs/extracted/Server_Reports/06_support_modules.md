# Phase 6: Business Logic — Support Modules — Deep Review

**Date:** 2026-07-14
**Scope:** messenger, notifications, transactions, billing, subscriptionPolicies, invitations, metrics, paymentsWebhook, paymentMethods, dashboard, admin
**Score: GOOD** (3.5/5) — Feature-complete with good patterns, but SQL injection risks and webhook security gap

---

## 1. MODULE OVERVIEW

| Module | Controller | Routes | Service | Endpoints | Lines |
|--------|-----------|--------|---------|-----------|-------|
| admin | 633 + 304 + 187 | 452 | — | 36 | 1,576 |
| messenger | 358 | 245 | — | 9 | 603 |
| transactions | 428 | 116 | — | 7 | 544 |
| subscriptionPolicies | 100 | 89 | 248 | 4 | 437 |
| billing | 223 | 91 | — | 5 | 314 |
| metrics | 138 | 72 | — | 4 | 210 |
| paymentsWebhook | 124 | 33 | — | 1 | 157 |
| invitations | 101 | 51 | — | 3 | 152 |
| notifications | 77 | 61 | — | 4 | 138 |
| paymentMethods | 64 | 55 | — | 4 | 119 |
| dashboard | 35 | 23 | — | 1 | 58 |

**Total: 78 endpoints across 11 modules, ~4,834 lines**

---

## 2. SQL INJECTION RISKS — Score: **Poor**

### 2.1 transactions.controller.ts

```typescript
const clientIds = [...new Set(rows.map(r => r.client_id).filter(Boolean))];
const txns = await prisma.$queryRaw`
    SELECT ... FROM transactions
    WHERE workspace_id = ${workspaceId}
      AND client_id = ANY(ARRAY[${Prisma.raw(clientIds.map(id => `'${id}'`).join(',')}]}::text[])
`;
```

**Issue:** `Prisma.raw()` interpolates cuid2 IDs directly into SQL. While cuid2 IDs are unlikely to be user-controlled strings, this pattern is unsafe.

### 2.2 admin.controller.ts

Same pattern for `getPlans`:
```typescript
ARRAY[${planIds.map(id => `'${id}'`).join(',')}]
```

**Fix:** Use `Prisma.join()` or parameterized queries instead of `Prisma.raw()`.

---

## 3. WEBHOOK SECURITY — Score: **Fair**

### 3.1 paymentsWebhook.controller.ts

```typescript
const signature = req.headers['x-fawaterak-signature'];
const expected = crypto.createHmac('sha256', env.FAWATERAK_SECRET_KEY).update(rawBody).digest('hex');
const isValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));

if (!isValid) {
    logger.warn({ requestId }, 'Webhook signature mismatch');
    // NOTE: Does NOT return here — request proceeds regardless
}
```

**Issue:** Failed signature verification is logged but not rejected. The webhook proceeds even with an invalid signature.

### 3.2 Sensitive Payload Logging

```typescript
console.log('[Webhook] Full payload:', req.body.toString());
```

**Issue:** Full webhook payload (including payment data) logged to stdout.

---

## 4. TRANSACTION PATTERNS — Score: **Very Good**

| Module | Pattern | Quality |
|--------|---------|---------|
| billing | `pool.connect()` + `BEGIN`/`COMMIT`/`ROLLBACK` + `FOR UPDATE` | Excellent |
| invitations | `prisma.$transaction` for accept | Good |
| admin | `prisma.$transaction` for plan CRUD | Good |
| messenger | `prisma.$transaction` for broadcast | Good |
| transactions | Retry loop on P2002 for unique codes | Good |

**Excellent:** Billing uses raw PG transactions with `FOR UPDATE` for idempotent payment application.

---

## 5. MODULE HIGHLIGHTS

### 5.1 messenger (603 lines, 9 endpoints)

- Raw SQL with lateral joins for thread listing
- `recordEvent()` for durable + realtime notifications
- Multer file upload for attachments
- Soft-delete for messages
- Workspace scoping on all queries

### 5.2 subscriptionPolicies (437 lines, 4 endpoints)

- Zod validation schemas (only module using Zod)
- Service layer separation (`service.ts`)
- Audit logging (`logSubscriptionAudit`)
- Grace period logic for expired subscriptions
- Package override fallback to global policy

### 5.3 admin (1,576 lines, 36 endpoints)

- Separate admin auth middleware
- Raw SQL for complex aggregates
- Config-driven generic CRUD for 5 library resources
- Bulk import with per-row error isolation
- Draft save workflow with transactional diff-and-replace

### 5.4 billing (314 lines, 5 endpoints)

- HMAC-signed payment callback
- Owner-only billing
- `applyPayment` with `FOR UPDATE` row locking
- Fawaterak integration

---

## 6. CRITICAL ISSUES SUMMARY

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | **SQL injection via `Prisma.raw()`** | HIGH | Use `Prisma.join()` or parameterized queries |
| 2 | **Webhook signature not rejected** | HIGH | Return 401 on signature mismatch |
| 3 | **Sensitive payload logging** | MEDIUM | Remove or redact payment data from logs |
| 4 | **`console.error` inconsistency** | LOW | Use `next(err)` pattern |

---

## 7. WHAT'S WELL DONE

1. **Billing transaction safety** — `FOR UPDATE` row locking for idempotent payment application.

2. **Webhook best practice** — Always returns 200, processes asynchronously.

3. **Subscription policies** — Zod validation, service layer, audit logging.

4. **Messenger** — Durable notifications via `recordEvent()`, workspace scoping.

5. **Admin module** — Config-driven CRUD for library resources, bulk import with error isolation.

6. **Invitations** — Transactional accept with seat limit check and P2002 handling.

7. **OpenAPI docs** — All routes documented with Swagger JSDoc.

8. **Permission middleware** — `requirePermission('finance', ...)` on billing/transactions.

---

## 8. RECOMMENDED ACTIONS (Priority Order)

### Immediate
1. Fix SQL injection in `transactions.controller.ts` and `admin.controller.ts`
2. Reject webhooks with invalid signatures

### Short-term
3. Remove sensitive payload logging from webhook
4. Standardize `console.error` to `next(err)` pattern

### Medium-term
5. Add idempotency keys for webhook processing
6. Add webhook retry queue for failed processing

---

*Report generated: 2026-07-14 | Reviewer: Senior Code Reviewer | Next: Phase 7 — Client Portal*
