# Migration Strategy
## Old FitForce (Production) → FitForce X (Rebuilt)

> This document describes the full plan for replacing the old codebase with the
> rebuilt one without disrupting active coaches, clients, or their data.
>
> Read `MigrationGapAnalysis.md` first — this document assumes all P1 gaps are closed.

---

## Overview

The old system has live users, active subscriptions, and real data across ~45 database
tables. The new system is a full rebuild with a different stack, different schema, and
different payment provider.

The goal is a **zero-data-loss, zero-surprise cutover** — every coach and client lands
on the new system with all their data intact, and nothing they relied on is gone.

---

## The Two Decisions That Gate Everything

Before any migration work starts, two architectural decisions must be confirmed.
All planning below assumes these are resolved.

### Decision 1 — ID Strategy

Old DB primary keys are **CUID strings** (`clxyz3f4k0000abc123def456`).
New DB uses **integer SERIAL** IDs.

**Resolution chosen:** Change new server schema to use `TEXT` primary keys.

This means updating the new server's migration files to use `TEXT` instead of `SERIAL`
for all primary and foreign keys. This is safer than building a cross-table integer
remapping engine for 45 tables of live data.

**What must change in new server:**
- All `SERIAL PRIMARY KEY` → `TEXT PRIMARY KEY`
- All integer FK columns → `TEXT`
- All raw SQL queries that assume integer IDs (no `parseInt`, no `Number(id)`)
- Confirm: `billing.js` lines 26 and 29 already had `Number(paymentId)` removed

### Decision 2 — Payment Strategy

Old system used **Paymob** but it was never fully integrated — no real transactions
were processed. **No Paymob records need to be preserved.**

Fawaterak is the only active payment provider going forward. No dual-provider period needed.

---

## Phase 0 — Pre-Migration Preparation

*Do all of this before touching any production system.*

### 0-1. Close All P1 Gaps

Refer to `MigrationGapAnalysis.md`. Every P1 item must be complete, tested,
and deployed to staging before Phase 1 begins.

P1 checklist:
```
[ ] P1-1: Forgot/reset password flow
[ ] P1-2: Email verification flow
[ ] P1-3: Client-coach messaging (Thread + Message + Socket.io)
[ ] P1-4: Workout logs
[ ] P1-5: Push notifications (FCM)
[ ] P1-6: Client subscription + payment flow (Fawaterak)
[ ] P1-7: Food replacement request loop (client → coach → approve)
[ ] P1-8: Team invitation accept flow
```

### 0-2. Schema Alignment

Produce a column-by-column mapping for every migrated table.
For each old Prisma model, document:

| Old Field | Old Type | New Column | New Type | Transform Needed |
|---|---|---|---|---|
| `User.id` | CUID string | `users.id` | TEXT | None |
| `User.passwordHash` | String | `users.password_hash` | TEXT | Rename only |
| `User.fullName` | String | `users.fname` + `users.lname` | TEXT | Split on first space |
| ... | ... | ... | ... | ... |

Complete this table for every model before writing a single migration script.

### 0-3. Data Migration Scripts

Write scripts that read from old DB → transform → insert into new DB.

Rules for every script:
- **Read-only on old DB.** Never write to old DB during migration.
- **Idempotent.** Safe to re-run. Use `INSERT ... ON CONFLICT DO NOTHING`.
- **Batch processing.** Process in chunks of 100–500 rows to avoid timeouts.
- **Logging.** Log every inserted row count and every skipped/failed row.
- **Count verification.** After each table: assert `SELECT COUNT(*) FROM new` matches
  source count.

Migration script order (dependency-safe):

```
1.  users                  (no dependencies)
2.  workspaces             (depends on users)
3.  workspace_members      (depends on workspaces + users)
4.  roles + permissions    (depends on workspaces)
5.  clients                (depends on workspaces)
6.  packages               (depends on workspaces)
7.  subscriptions          (depends on clients + packages)
8.  transactions           (depends on subscriptions)
9.  forms                  (depends on workspaces)
10. form_requests          (depends on forms + clients)
11. food_categories        (depends on workspaces)
12. food_items             (depends on food_categories)
13. exercise_library       (depends on workspaces)
14. nutrition_plans        (depends on clients + workspaces)
15. training_plans         (depends on clients + workspaces)
16. threads + messages     (depends on clients + workspaces)
17. notifications          (depends on users + clients)
18. workout_logs           (depends on clients + training_plans)
19. client_observations    (depends on clients + users)
20. client_attachments     (depends on clients + users)
```

### 0-4. Environment Setup

New server must have all production environment variables configured:

```
[ ] DATABASE_URL        (new production DB)
[ ] JWT_SECRET          (must match old — see auth note below)
[ ] S3_BUCKET / AWS_*   (same bucket as old, or contents copied)
[ ] SMTP_*              (email credentials)
[ ] FAWATERAK_*         (payment provider)
[ ] FIREBASE_*          (FCM push notifications)
[ ] COOKIE_DOMAIN       (set to production domain)
[ ] NODE_ENV=production
```

**Critical — JWT_SECRET:**
If the new `JWT_SECRET` is different from the old one, every logged-in user will be
silently logged out the moment the new server goes live. Either:
- Use the same `JWT_SECRET` value, **or**
- Accept a one-time logout event and communicate it to users in advance.

### 0-5. S3 Asset Continuity

Old server and new server both use S3. If they share the same bucket, no action is needed.
If different buckets:
- Copy all objects from old bucket to new bucket before cutover
- Update `CORS` and bucket policy on new bucket to match old
- Verify all S3-stored URLs in the migrated DB point to the accessible new bucket

---

## Phase 1 — Staging Validation

*New system runs in isolation. No real users. No production data yet.*

### 1-1. Deploy New Server to Staging

Deploy the new server to a staging environment at a separate URL
(e.g., `api-staging.fitforce.app`).

Confirm:
```
[ ] Server starts with zero errors
[ ] All routes respond (run a smoke test suite)
[ ] DB migrations apply cleanly on a fresh PostgreSQL instance
[ ] Socket.io connects successfully
[ ] Email sends (test SMTP with a real address)
[ ] S3 upload/download works
[ ] FCM push notification reaches a test device
[ ] Fawaterak payment flow completes end-to-end in sandbox mode
```

### 1-2. Run Migration Scripts on Staging DB

Take a full export of the old production DB.
Restore it to a staging copy.
Run all migration scripts against the staging copy → new staging DB.

Verify after each script:
- Row counts match
- Foreign key relationships intact
- Spot-check 5–10 random records per table for data accuracy

### 1-3. Smoke Test with Real Accounts

Create 2–3 test accounts that mirror real coach + client data.
Manually walk every critical path:

```
Coach flows:
[ ] Login → dashboard loads with correct data
[ ] Open a client → see their plans, forms, notes
[ ] Send a message to a client
[ ] Assign a new nutrition plan
[ ] Assign a new workout plan
[ ] View subscription status
[ ] Team member can log in and access their permitted areas

Client flows:
[ ] Client login → portal loads with correct plan
[ ] View nutrition plan (all meals, foods visible)
[ ] View workout plan (all days, exercises visible)
[ ] Log a completed workout
[ ] Submit a food replacement request
[ ] Send a message to coach
[ ] View subscription status

Payment flows:
[ ] Coach can initiate a client subscription via Fawaterak
[ ] Fawaterak webhook fires and activates subscription
[ ] Client sees active subscription in portal
```

Fix any issue found before continuing to Phase 2.

---

## Phase 2 — Parallel Running (Shadow Mode)

*Old system stays fully live. New system runs alongside it on a staging URL.
Real coaches test the new system voluntarily.*

### 2-1. Invite Trusted Coaches to Test

Select 3–5 coaches with low-risk client loads (smaller client lists, less active).
Give them access to the new staging URL.
Migrate their workspace data specifically into the staging new DB.

Brief them: *"This is a preview. Your real clients are still on the old system.
Nothing you do here affects them."*

### 2-2. Run Dual-Write Sync (Optional but Safer)

For the duration of parallel running, any write to the old production DB can
trigger a sync job that replicates the change to the new staging DB.
This keeps the new DB current without users ever touching it directly.

Implement as a lightweight cron job or DB trigger that runs every 15 minutes:
- New clients added in old → inserted in new
- Plans updated in old → updated in new
- Subscriptions changed in old → reflected in new

This is optional but strongly recommended — it means when you do cut over,
the delta to sync is minimal (minutes, not hours of data).

### 2-3. Parallel Running Period

Minimum: **2 weeks** of parallel running before any production traffic is moved.

During this period:
- Monitor new system for errors, performance, and broken flows
- Fix every bug found before increasing traffic
- Keep old system untouched

---

## Phase 3 — Gradual Workspace Cutover

*Real coaches migrate one at a time. Old system still handles everyone else.*

Never flip all users at once.

### 3-1. Cutover Order

```
Week 1:  Internal team + 2-3 volunteer coaches (low-risk)
Week 2:  5-10% of coaches (select by client count, smallest first)
Week 3:  25% of coaches
Week 4:  75% of coaches
Week 5:  100% + old system goes read-only
Week 6:  Old system decommissioned
```

### 3-2. Per-Workspace Migration Process

For each coach workspace being migrated:

```
1. Notify coach 48 hours in advance:
   "Your account will move to the new platform on [date].
    You'll be logged in automatically. Nothing will be lost."

2. Run migration scripts scoped to this workspace's data:
   - Migrate clients
   - Migrate plans (nutrition + workout)
   - Migrate forms + submissions
   - Migrate messages + threads
   - Migrate subscriptions + transactions

3. Verify counts and spot-check records

4. Update DNS / routing to direct this workspace's subdomain to new server

5. Coach logs in via new URL — confirm everything is visible

6. Monitor for 24 hours — watch for errors or missing data reports
```

### 3-3. Rollback Trigger

At any point during cutover, if a coach reports a critical issue:

```
1. Assess in under 10 minutes:
   - Is data missing?  → rollback immediately
   - Is a feature broken?  → hotfix or rollback depending on severity

2. Rollback = repoint their subdomain back to old server
   (old server stays running until Week 6 specifically for this)

3. Investigate root cause, fix, re-test, re-migrate
```

---

## Phase 4 — Final Cutover

*All workspaces are now on the new system.*

### 4-1. Old Server → Read-Only

```
1. Put old server into read-only mode (disable all write endpoints)
2. Display a banner: "This version is retired. Please use [new URL]."
3. Keep it running for 30 days as a safety net
```

### 4-2. Final Data Sync

Run a final delta sync to catch any writes that happened during the
gradual cutover period. This should be a small set of records.

Verify final counts between old and new DB.

### 4-3. DNS Final Switch

Update all DNS records to point fully to new server.
Remove old server from load balancer.

### 4-4. Post-Cutover Monitoring

Stay present for 24 hours after final switch:
```
[ ] Error rate normal (check server logs)
[ ] Response times normal
[ ] No spike in failed logins
[ ] Socket.io connections healthy
[ ] S3 uploads working
[ ] FCM notifications delivering
[ ] Fawaterak webhooks firing correctly
```

---

## Phase 5 — Decommission

*30 days after full cutover with zero incidents.*

```
[ ] Export full final backup of old DB (keep for 1 year minimum)
[ ] Export old server codebase as a ZIP archive (keep for 1 year)
[ ] Shut down old server instances
[ ] Cancel old server hosting/infrastructure
[ ] Revoke old environment credentials (Paymob keys, old JWT secret if changed)
[ ] Update DNS to remove any remaining old server records
[ ] Document decommission date in PROJECT.md
```

---

## Rollback Protocol (At Any Phase)

| Situation | Action | Time Target |
|---|---|---|
| Individual workspace bug | Repoint that workspace to old server | Under 5 minutes |
| Widespread data issue | Repoint all traffic to old server | Under 10 minutes |
| DB corruption discovered | Restore old DB from pre-migration backup | Under 30 minutes |

**The old server must stay running until Phase 5. This is the safety net.**
Never decommission it early, even if everything looks fine.

---

## Data Migration Rules (Non-Negotiable)

```
🔴 Never write to old production DB during migration
🔴 Never delete old DB records — mark deleted_at if needed
🔴 Never run migration scripts without a verified DB backup taken in the last hour
🔴 Never migrate a workspace without counting rows before and after
🔴 Never assume a migration succeeded — always verify counts + spot-check
🟡 Always test migration scripts on staging before running on production data
🟡 Always run scripts during low-traffic hours (2am–5am local time)
🟡 Always have a rollback path before running any production migration step
🔵 Log every migration run with timestamp, rows affected, and operator name
🔵 Keep all migration scripts in version control — never run a one-off query
```

---

## Communication Plan

### Before migration starts
Send to all coaches:
> *"We're upgrading FitForce to a new, faster version. Your data will be
> automatically moved. We'll notify you 48 hours before your account switches.
> Nothing will be lost and you don't need to do anything."*

### 48 hours before workspace migration
Send to each coach:
> *"Your FitForce account moves to the new platform on [date] at [time].
> You'll be logged in at [new URL]. All your clients, plans, and data will be there."*

### After workspace migration
Send to each coach:
> *"Your account is now on the new FitForce. Login at [new URL].
> If anything looks wrong, reply to this email and we'll fix it immediately."*

---

## Risks and Mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| Password hash mismatch → users locked out | Low — both use bcryptjs | Verify hash format from old `passwordHash` column matches new `password_hash` column before migrating any users |
| JWT secret mismatch → all sessions invalidated | Medium | Use same JWT_SECRET or communicate planned logout in advance |
| S3 URLs broken after migration | Medium | Verify bucket access from new server before cutover; keep old bucket accessible |
| Missing data discovered post-cutover | Medium | Old server stays live for 30 days; can re-run delta sync at any time |
| FCM device tokens stale | Low | Tokens are per-device, not per-server; they remain valid after migration |
| Fawaterak webhook misconfiguration | Medium | Test end-to-end payment flow in staging before any production cutover; verify webhook URL is updated |
| Coach subdomain not resolving to new server | Low | Test DNS propagation in staging before production switch |
| Socket.io connection failures at scale | Medium | Load test Socket.io with simulated concurrent connections in staging |

---

## Go / No-Go Gate

Before Phase 3 (gradual cutover) can begin, all of the following must be true:

```
[ ] All P1 gaps closed and tested (see MigrationGapAnalysis.md)
[ ] Staging smoke test 100% passing
[ ] At least 2 trusted coaches completed parallel running with no critical bugs
[ ] Migration scripts verified: counts match on staging DB
[ ] Rollback procedure tested at least once on staging
[ ] JWT_SECRET strategy decided and confirmed
[ ] S3 access confirmed from new server
[ ] Fawaterak payment flow tested end-to-end in staging
[ ] FCM push notification tested on real device in staging
[ ] Old server backup taken and verified restorable
[ ] Communication sent to coaches
```

If any item is unchecked: **do not proceed to Phase 3.**
