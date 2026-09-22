# Phase 8: Shared Libraries — Deep Review

**Date:** 2026-07-14
**Scope:** src/lib/ (15 files, 1,205 lines), src/utils/ (4 files, 568 lines)
**Score: GOOD** (3.5/5) — Well-structured libraries with good patterns, but planEngine is complex and some libs lack error handling

---

## 1. LIBRARY OVERVIEW

| File | Lines | Purpose |
|------|-------|---------|
| `planEngine.ts` | 337 | Plan lifecycle (save, activate, replace) |
| `libraryClone.ts` | 188 | Clone master libraries to workspace |
| `events.ts` | 122 | Durable notifications + realtime |
| `storage.ts` | 84 | S3/R2 file uploads |
| `email.ts` | 74 | Nodemailer SMTP |
| `fawaterak.ts` | 70 | Payment gateway |
| `socket.ts` | 64 | Socket.IO setup |
| `seatLimits.ts` | 59 | Workspace seat validation |
| `defaultPermissions.ts` | 54 | RBAC permission matrix |
| `formAttachments.ts` | 43 | Form attachment handling |
| `cors.ts` | 32 | CORS origin validation |
| `messageAttachments.ts` | 36 | Messenger attachments |
| `prisma.ts` | 14 | Prisma singleton |
| `validate.ts` | 17 | Zod validation helper |
| `observationAttachments.ts` | 11 | Observation attachments |

---

## 2. KEY LIBRARIES — Score: **Very Good**

### 2.1 planEngine.ts (337 lines)

Plan lifecycle engine used by both training and nutrition controllers.

**Functions:**
- `replaceClientPlansTransactional` — Bulk save (delete old + insert new)
- `saveSinglePlanDraft` — Single plan save
- `activatePlan` — Plan activation with cycle calculation
- `computeNextCycleEnd` — Cycle end date computation
- `advanceCheckInSchedule` — Check-in schedule advancement

**Quality:**
- Uses raw PG transactions (`pool.connect()` + `BEGIN`/`COMMIT`)
- Preserves `activated_at`/`cycle_days`/`cycle_end_at` across saves
- Integrates with forms versioning (`sealVersionForAssignment`)

**Issues:**
1. **Complex** — 337 lines with multiple transaction patterns
2. **Raw SQL** — Uses `pool.query()` instead of Prisma for plan operations

### 2.2 events.ts (122 lines)

```typescript
export async function recordEvent(event: DomainEvent): Promise<void> {
    // 1. Write notification rows (createMany)
    // 2. Emit realtime to recipient rooms
    // 3. Legacy realtime emit
}
```

**Excellent:**
- Single choke point for all domain events
- Durable (DB) + realtime (Socket.IO)
- Best-effort (failures logged, not propagated)
- `teamRecipients` and `ownerRecipients` helpers

### 2.3 socket.ts (64 lines)

```typescript
io.use((socket, next) => {
    const token = authToken ?? bearer ?? cookieToken;
    const decoded = jwt.verify(token, env.JWT_SECRET);
    socket.data.userId = decoded.userId;
});

io.on('connection', (socket) => {
    socket.join(`workspace:${workspaceId}`);
    socket.join(`client:${clientId}`);
    socket.join(`user:${userId}`);
});
```

**Quality:**
- JWT auth on connect (cookie + Bearer + handshake)
- Room joining for workspace, client, user
- CORS reuses `isAllowedOrigin`

**Issue:** No session DB validation on socket auth.

### 2.4 libraryClone.ts (188 lines)

```typescript
export async function cloneDefaultLibraries(workspaceId: string): Promise<void> {
    // Clone exercises, foods, categories, forms from master tables
    // Background, non-blocking
}
```

**Excellent:**
- Background cloning on registration
- Error handling with `clone_status` tracking
- Library count verification

---

## 3. UTILITIES — Score: **Very Good**

| File | Lines | Purpose |
|------|-------|---------|
| `workoutLogStats.ts` | 355 | Workout statistics computation |
| `subscriptionStatus.ts` | 104 | Client subscription status |
| `subscriptionPolicy.ts` | 97 | Access policy resolution |
| `email.ts` | 12 | Email helpers |

### 3.1 workoutLogStats.ts (355 lines)

Comprehensive workout analytics:
- `summarizeLog` — Log summary
- `buildExerciseProgress` — Progress over time
- `computePersonalRecords` — PR tracking
- `computeCoachInsights` — Coach-facing insights
- `extractRecentSessions` — Session history

**Excellent:** Pure functions, well-typed, reusable.

---

## 4. ISSUES

| # | Issue | Severity |
|---|-------|----------|
| 1 | **planEngine uses raw SQL** | MEDIUM |
| 2 | **Socket auth lacks session DB validation** | MEDIUM |
| 3 | **events.ts uses `console.error`** | LOW |

---

## 5. WHAT'S WELL DONE

1. **events.ts** — Single choke point for durable + realtime notifications.
2. **libraryClone** — Background cloning with status tracking.
3. **workoutLogStats** — Pure functions for analytics.
4. **cors.ts** — Multi-tenant origin validation.
5. **prisma.ts** — Singleton with dev hot-reload support.
6. **defaultPermissions** — 5 roles × 7 modules permission matrix.

---

*Report generated: 2026-07-14 | Next: Phase 9 — Real-Time & File Handling*
