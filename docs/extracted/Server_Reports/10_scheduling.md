# Phase 10: Scheduling & Cron Jobs — Deep Review

**Date:** 2026-07-14
**Scope:** scheduler.ts (346 lines), 5 cron jobs
**Score: VERY GOOD** (4.0/5) — Well-structured schedulers with bounded concurrency, but no distributed lock

---

## 1. SCHEDULER OVERVIEW

| Scheduler | Cron | Purpose | Exported Tick |
|-----------|------|---------|---------------|
| `scheduleFormDispatcher` | `0 * * * *` (hourly) | Dispatch pending forms | No |
| `scheduleSubscriptionExpiry` | `0 0 * * *` (daily) | Expire workspace subscriptions | No |
| `scheduleSessionCleanup` | `0 2 * * *` (daily 2am) | Delete old sessions (30+ days) | No |
| `scheduleClientStatusSync` | `30 0 * * *` (daily 00:30) | Recompute client status | No |
| `scheduleCheckInDispatch` | `0 * * * *` (hourly) | Dispatch due check-ins | Yes |

---

## 2. QUALITY — Score: **Very Good**

### 2.1 Error Handling

```typescript
cron.schedule('0 * * * *', async () => {
    try {
        // ... work
    } catch (err) {
        console.error('[Scheduler] Form dispatcher error:', err);
    }
});
```

**Good:** Each scheduler has try/catch. Failures don't crash the process.

### 2.2 Bounded Concurrency

```typescript
for (const batch of chunk(due, 50)) {
    await Promise.all(batch.map(async (row) => {
        // ... process row
    }));
}
```

**Excellent:** Check-in dispatch processes in chunks of 50 to prevent memory balloons.

### 2.3 Idempotency

- Form dispatcher: Only processes `status: 'pending'` rows
- Subscription expiry: Only processes `status: 'active'` with `expires_at < now()`
- Session cleanup: Only deletes sessions older than 30 days
- Check-in dispatch: Deletes schedule row after dispatch (one-shot)

**Good:** Each tick is idempotent — re-running doesn't cause duplicates.

### 2.4 Testability

```typescript
export async function runCheckInDispatchTick(): Promise<number> { ... }
export async function runReviewDueCheckTick(): Promise<number> { ... }
```

**Excellent:** Tick functions exported separately from cron registration for direct testing.

---

## 3. ISSUES

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | **No distributed lock** | MEDIUM | Add Redis mutex |
| 2 | **`console.log` instead of `logger`** | LOW | Replace with `logger` |
| 3 | **Form dispatcher has no batch limit** | LOW | Add `take: 500` like check-in dispatch |

---

## 4. WHAT'S WELL DONE

1. **Bounded concurrency** — Chunks of 50 for check-in dispatch.
2. **Idempotent ticks** — Re-running doesn't cause duplicates.
3. **Exported tick functions** — Testable without waiting for cron.
4. **Error isolation** — Each scheduler has its own try/catch.
5. **Review-due notifications** — Integrated into status sync tick.
6. **Form versioning awareness** — Check-in dispatch handles archived forms.

---

*Report generated: 2026-07-14 | Next: Phase 11 — Scripts & Migrations*
