# Data Migration: fitforce.io (old) → fitforce.app (new)

> Generated 2026-07-15. Based on direct inspection of the fitforce.app codebase
> (`server/prisma/schema.prisma`, `server/migrations/*.js`, `server/src/**`) and a full
> `pg_restore` of the actual fitforce.io production snapshot
> (`docs/old_db/fitforce-db-backups-2026-06-11_03-00-01.sql.gz`, taken 2026-06-11).
> Row counts below are **real counts from that snapshot**, not estimates.
>
> Read alongside the existing `docs/MigrationGapAnalysis.md` and `docs/MigrationStrategy.md`
> — those documents cover the **feature-parity rebuild** (closing functional gaps between the
> two codebases) and are marked complete. This document covers the **data merge**: taking the
> final fitforce.io snapshot and folding it into fitforce.app's live database, which by now
> has its own organically-created production data. That is a different, harder problem than
> either prior document anticipated, and is the subject of this one.

---

## Confirmed decisions (clarification round, 2026-07-15)

The first draft of this document flagged several open questions rather than guessing. Answers
below are now load-bearing — they change §0, §2, §4.2, and §6.2 from "recommended default" to
"confirmed policy."

| # | Question | Confirmed answer |
|---|---|---|
| 1 | Is the 2026-06-11 dump fresh enough? | **No** — a fresh snapshot will be provided (new `.sql.gz`/`.dump` file). §3's compatibility report and §17's row counts must be **re-run against it** before this plan is executed; treat every number in this document as provisional until that re-verification pass happens. |
| 2 | Are fitforce.io and fitforce.app definitely separate physical databases? | **Yes, confirmed separate.** The §2 open item asking to verify this is resolved — proceed on that basis. |
| 3 | Cutover mode during the real import (Phase E)? | **Full maintenance window.** fitforce.app goes fully unavailable for the duration of the real import — not read-only, not live. Simplifies §4.5/§9 considerably: no concurrent-write race to defend against, only the schedulers. |
| 4 | Rotate the Postgres password read from `server/.env` during this analysis? | **Not necessary.** No action taken. |
| 5 | Mobile app in scope? | **No** — the Flutter app talks only to fitforce.app. Out of scope for this migration entirely. |
| 6 | Recurring/mid-cycle payments (Paymob) at risk during cutover? | **No** — Paymob was never actually live in production (consistent with `docs/MigrationGapAnalysis.md` Gap 0-B). No special mid-cycle-billing handling needed. |
| 7 | **The workspace-merge rule (replaces §6.2's original decision tree):** | Two scenarios, not a spectrum: **(a)** a workspace exists on **both** systems for the same coach → **the fitforce.io version is migrated in and replaces the fitforce.app workspace's own data.** This is a **deliberate, scoped exception** to the general "never overwrite fitforce.app data" rule (§0), confirmed explicitly — it applies **only** to a workspace with a matched fitforce.io counterpart, never to any other workspace. **(b)** a workspace exists on fitforce.app **only** (no fitforce.io counterpart) → left completely untouched, exactly the original zero-loss rule. See the rewritten §6.2 below for the mechanics. |
| 7b | **Revised, second clarification round:** should case (a) archive the superseded fitforce.app workspace, or hard-delete it? | **Hard delete, confirmed explicitly** — the original "archive, don't hard-delete" safety net (still described as the rejected alternative in the text below) is deliberately not used. A hard delete here has no per-row undo; the only recovery path is a full pre-migration backup restore, which would also undo every other change made since. Every case-2 match must be surfaced and confirmed individually before deletion, never applied as a batch sweep, precisely because there's no cheap way back. |
| 8 | **A migration pipeline already exists and already ran against real fitforce.app** (`server/src/scripts/migrate.ts` + `migrate-phase2.ts` + `migrate-phase3.ts` + `migrate-queue.ts` + three patch scripts), confirmed run to completion. | This changes the whole document's framing — see the new **Part 0** below, inserted before the original §0. The rest of this document (§1–§18) is no longer "the plan," it's "the plan for the delta" — what's new on fitforce.io since that pipeline ran, plus repairs to anything Part 0's audit finds broken. Exact timing of that run relative to fitforce.app's organic signups is **unconfirmed** — Part 0 §0.1 explains why that timing detail matters and gives the exact queries to establish it against the real database. |

---

## Part 0 — This migration already partially happened: audit this first

`server/src/scripts/` contains a full data-migration pipeline that isn't hypothetical — it's
real code, and per direct confirmation it already ran **to completion, including its patch
scripts, against real fitforce.app** (staging or production). Discovering this changes the task:
the question is no longer "how do we migrate," it's "what did that migration actually do, is it
correct, and what's changed since." Everything below §0.4 in this Part is a concrete, runnable
audit — do this before writing or running anything new.

### 0.1 What already ran

| Script | Covers |
|---|---|
| `inspect-old-forms.ts` | Read-only recon of old form/request/queue tables — a Phase 0 investigation tool, not a migration step. |
| `migrate.ts` | `users`, `workspaces`, `workspace_members`, `clients`, `food_items`, `exercise_library`, `nutrition_plans` (+cycles/meals/items), `training_plans` (+days/exercises/sets), `threads`+`messages`, `workout_logs`, `client_observations`, `transactions` (from `Payment`), and forms (into the **now-retired** `form_questions` table — see §0.2). |
| `migrate-phase2.ts` | `food_categories`/`exercise_muscle_groups`/`exercise_equipments` (derived from already-migrated rows), `packages`+`package_variations` (from `ClientPackageTemplate`+`ClientPackage`). `client_measurements` explicitly skipped — old system never tracked measurements. |
| `migrate-phase3.ts` | `WorkspacePackage`→`plans` **(see §0.3 — contradicts this document's §6.4)**, `WorkspaceSubscription`→update existing `workspace_subscriptions`, `WorkspacePayment`→`workspace_payments`, a second `ClientPackageTemplate`/`ClientPackage` pass. |
| `migrate-queue.ts` | `FormSubmission`→`form_requests`+`form_responses`, matched against the (also now-retired) `form_questions` table for validity. |
| `migrate-add-queue-assignee.ts` | Pure DDL patch (`ALTER TABLE ... ADD COLUMN IF NOT EXISTS`) — not data migration, unrelated to the risks below. |
| `patch-transactions.ts` | Fixes `client_id`/`duration`/`client_name` gaps from the original `migrate.ts` transactions pass — its own docstring confirms these were missing from "the original migration" and broke `computeSubscriptionStatus` for every migrated client until patched. |
| `patch-question-labels.ts` | Recovers real question text for rows stuck at the `label_en = 'Question'` default, by re-reading the old `FormTemplate.questions` JSON. Explicitly logs an unrecoverable remainder when it can't. |

None of these scripts implement anything from §4–§9 of this document — no workspace-slug
collision handling, no user-merge decision tree, no maintenance-window/scheduler-pause
discipline, and no audit/mapping table. They rely solely on `skipDuplicates: true` /
`ON CONFLICT DO NOTHING` for idempotency. That's fine for a first bulk load into an empty or
near-empty target; it is exactly the gap this document's §4–§9 exists to close for the delta.

### 0.2 Audited and CLOSED — no form data was silently dropped

`form_questions` was the live table when this pipeline ran (referenced directly by `migrate.ts`,
`migrate-queue.ts`, and `patch-question-labels.ts`) and was permanently dropped by migration
`039_drop_form_questions.js`, **after** migration `036_form_versions_backfill.js` ran its
one-time backfill. The theoretical risk: if the pipeline ran in the window *after* 036 but
*before* 039, any forms it inserted then would have been left with `current_version_id IS NULL`
and their questions stranded in `form_questions` — permanently lost the moment 039 dropped it.

**Audited directly against real production 2026-07-15 — this did not happen:**
```
forms_missing_version:    0
requests_missing_version: 0
```
Both zero. This risk is closed, confirmed, no further action needed.

### 0.3 Audited and CLOSED — `plans` has no duplicates (mechanism still unclear, but harmless)

`migrate-phase3.ts`'s `migratePlans()` inserts old `WorkspacePackage` rows directly into `plans`
with no matching against fitforce.app's existing tiers — the opposite of what §6.4 below
recommends. **Audited directly: no duplication exists.** Production `plans` has exactly 14 rows,
all organic-looking custom tiers (`Free Trial`, `1 Month`, `Team 1 Month`, `Offer 4 months 2500`,
etc., spanning October 2025 → June 2026), zero rows traceable to old `WorkspacePackage` data.

This means one of: `migrate-phase3.ts`'s `migratePlans()` step specifically never ran (even
though `workspace_payments` = 233, an exact match to old `WorkspacePayment`, confirming *other*
steps of that same script did run — see below), or it ran against a version of the script that
matched by name instead of blind-inserting, or a cleanup happened afterward that isn't captured
in any script here. **Not worth chasing further** — there is no live problem, only an
unexplained gap between what the checked-in script does today and what evidently happened in
production. Flagging so a future reader doesn't waste time assuming corruption exists; it
doesn't. If a fresh run of `migrate-phase3.ts` is ever needed for the delta (§0.6), do **not**
run its `migratePlans()` step as currently written — use §6.4's match-by-name approach instead,
regardless of how the historical run avoided this.

### 0.4 Confirmed, negligible remainder

- **Question labels:** audited directly — `SELECT count(*) FROM form_version_questions WHERE
  label_en = 'Question'` returns **1** in production (versus 11 in the small local dev DB, for
  scale comparison). `patch-question-labels.ts` did its job at real scale; one single legacy
  question out of the full migrated set couldn't be recovered. Not worth further effort.
- **Transactions:** not independently re-verified row-by-row, but `computeSubscriptionStatus`
  depending on it (per the patch script's own stated motivation) has had no reported issue since
  — treat as resolved unless something surfaces.

### 0.5 The real scale, confirmed directly against production (2026-07-15)

| Table | fitforce.io (source, same day) | fitforce.app (target, now) | Diff |
|---|---|---|---|
| `workspaces` | 185 | 189 | +4 |
| `users` | — | 2,557 | — |
| `clients` | — | 2,314 | — |
| `forms` | — | 125 | — |
| `form_requests` | — | 7,520 | — |
| `transactions` | — | 2,465 | — |

(Users/clients/forms/etc. above are compared against the June 11 snapshot in the executive
summary's table further down, not this fresher one — the workspace-level comparison is the one
that matters here and was re-run against the July 15 dump specifically.) The historical
migration succeeded at full scale — fitforce.app's numbers track fitforce.io's original dataset
almost exactly, with small, expected losses from the scripts' own soft-delete/orphan filters,
plus real organic growth on top.

**Of fitforce.app's 189 workspaces, 8 are confirmed pure-organic** (never existed on
fitforce.io — verified by direct ID lookup against the old dump, zero matches): these are native
fitforce.app signups and are never touched by anything in this document.

### 0.6 The actual, final, confirmed delta: 4 workspaces

fitforce.io grew from 181 workspaces (June 11 snapshot, used by the original migration) to 185
(July 15). Those 4 new ones were checked directly against fitforce.app production by exact ID
lookup and **confirmed absent (zero rows returned)**:

| fitforce.io id | slug | created (fitforce.io) |
|---|---|---|
| `cmqemmesbtdxkmv07cmi2iucv` | `ali` | 2026-06-15 |
| `cmqf9xb4auujrmv079i1bhc7g` | `setpalaudit99` | 2026-06-15 |
| `cmr6o7rpbuiazmv06t5kjppd9` | `mocoachihg` | 2026-07-04 |
| `cmrauug2g21cemv06g1shrixg` | `canavar` | 2026-07-07 |

**This is the entire remaining scope of this migration.** Not 181 workspaces, not 2,345
clients — 4 named workspaces and whatever clients/plans/forms/messages/transactions belong to
them. Before executing, size each one precisely (cheap, since it's 4 workspaces):

```sql
-- Run against the old fitforce.io snapshot for just these 4 workspace ids
SELECT 'Client' t, count(*) FROM "Client" WHERE "workspaceId" IN (
  'cmqemmesbtdxkmv07cmi2iucv','cmqf9xb4auujrmv079i1bhc7g',
  'cmr6o7rpbuiazmv06t5kjppd9','cmrauug2g21cemv06g1shrixg')
UNION ALL SELECT 'FormSubmission', count(*) FROM "FormSubmission" WHERE "workspaceId" IN (
  'cmqemmesbtdxkmv07cmi2iucv','cmqf9xb4auujrmv079i1bhc7g',
  'cmr6o7rpbuiazmv06t5kjppd9','cmrauug2g21cemv06g1shrixg')
UNION ALL SELECT 'Message', count(*) FROM "Message" WHERE "workspaceId" IN (
  'cmqemmesbtdxkmv07cmi2iucv','cmqf9xb4auujrmv079i1bhc7g',
  'cmr6o7rpbuiazmv06t5kjppd9','cmrauug2g21cemv06g1shrixg')
UNION ALL SELECT 'Payment', count(*) FROM "Payment" WHERE "workspaceId" IN (
  'cmqemmesbtdxkmv07cmi2iucv','cmqf9xb4auujrmv079i1bhc7g',
  'cmr6o7rpbuiazmv06t5kjppd9','cmrauug2g21cemv06g1shrixg');
```

Also worth checking, since it's the one genuine duplication case this whole document is built
around (§6.2): whether any of these 4 workspaces' **owner emails** already have a fitforce.app
account with real data of their own — that's the only scenario left where §6.2's
archive-and-replace rule would actually fire. With only 4 workspaces, this is a 4-row manual
check, not something that needs automation.

### 0.7 What this means for the rest of the document

§1–§18 below (dependency order, per-entity conflict rules, ID strategy, dry-run/rollback
approach) are **still the right method** and still apply verbatim — they just now apply to a
tiny, fully-enumerable scope (4 workspaces) instead of a from-scratch migration of the entire
old dataset. Concretely, before doing anything else:

1. Run §0.6's sizing query to know exactly how many clients/forms/messages/transactions these
   4 workspaces carry.
2. Check each of the 4 owners' emails against existing fitforce.app users (§6.2) — with only 4
   rows, do this by hand, not with tooling.
3. Everything the original 8-script pipeline never touched regardless of timing —
   `AuditLog`, `Notification`, `ClientAttachment`, `PdfTemplate`/`VisualPdfTemplate`, `Recipe`,
   `TutorialVideo`, any Promo* table, any food-replacement table, Admin*/`Role`/`Permission` —
   is **still a fully open gap for the entire dataset**, not just these 4 workspaces, per §3.1
   and §17. Decide separately whether any of that is worth backfilling now or stays
   export-only/deferred, independent of the 4-workspace delta.
4. Given the scale (4 workspaces, almost certainly low hundreds of rows total across every
   child table), this is small enough to migrate with a **hand-reviewed one-off script**
   extending the existing `migrate.ts` pattern (same connection setup, same `createId()`/
   `skipDuplicates` idioms, filtered to just these 4 `workspaceId`s), rather than needing the
   full dry-run/reporting machinery §14 describes for a dataset two orders of magnitude larger.
   §14's method (simulate first, resolve every flagged row, then commit) still applies — it's
   just now sized to 4 workspaces' worth of review, not 181.

---

## 0. Executive Summary — and one assumption worth challenging

**The two systems are not two deployments of the same schema.** fitforce.io is the
pre-rebuild legacy codebase: PascalCase Prisma models (`Workspace`, `Client`, `FormTemplate`),
camelCase columns, `cuid()` v1 IDs (`clxyz3f4k0000...`), flat un-versioned forms, no metrics
system, no Package-Lifecycle model. fitforce.app (this repository) is a full rewrite:
snake_case tables, `@paralleldrive/cuid2` IDs, Forms Versioning, a metrics engine, a
subscription-policy engine, package lifecycle scheduling. This was confirmed by decompressing
the actual dump: its table names are `"Workspace"`, `"Client"`, `"FormTemplate"` etc., which
matches `docs/MigrationGapAnalysis.md`'s description of "Old FitForce" exactly, not this
repo's `schema.prisma`.

**This means the "conflict resolution" framing in the brief needs a correction.** The brief
asks, for nearly every entity, "what happens on conflict — rename, skip, merge?" as if
duplicate detection is the central problem. It mostly isn't. fitforce.io coaches and
fitforce.app coaches are, with one exception, **disjoint populations** — different people who
signed up independently on two different systems. The real risk is not "the same workspace
exists twice and must be reconciled"; it's "two unrelated workspaces independently chose the
same URL slug," which is a **unique-constraint collision**, not an entity-resolution problem.
Treating every table as needing fuzzy-merge logic (as the brief's structure implies) would add
risk and complexity for a problem that mostly doesn't exist.

The one place real duplication *does* need to be anticipated: **`users`**. Nothing stopped a
fitforce.io coach from also registering fresh on fitforce.app during the parallel-running
period (to try the new product, or because they forgot they already had an old account). That
is a genuine "same human, two accounts" case and gets its own rule in §6 — and per the
confirmed decision above, it is the **one deliberate, scoped exception** to this document's
otherwise-absolute "never overwrite fitforce.app data" rule: where a matched workspace exists
on both systems, fitforce.io's version wins and replaces the fitforce.app workspace's own data.
Nowhere else in this document does that exception apply.

The rest of this document is organized around that correction: §3 is a real schema
compatibility report built from the actual dump DDL, §4 covers genuine risks (mostly
unique-constraint and NOT NULL mismatches, not duplication), §6 gives per-entity rules that are
mostly "insert with a collision guard," and only `users` gets a real merge decision tree.

---

## 1. Phase 0 — Investigated Architecture

### 1.1 fitforce.app (new) — what actually governs correctness

- **Multi-tenancy.** `workspaces` is the tenant root. Every tenant-scoped table carries a
  `workspace_id` FK with `onDelete: Cascade`. There is no framework-level tenant guard — it is
  enforced by controller discipline (per `CLAUDE.md` §5). A migration script that forgets to
  scope an insert is exactly the class of bug that framework guards against elsewhere in this
  codebase; the migration tooling must supply that discipline manually.
- **Identity.** `users` (coaches/team members, global unique `email`), `clients`
  (workspace-scoped, unique on `(workspace_id, email)` and `(workspace_id, client_code)`),
  `admins` (operator accounts, separate and much simpler than fitforce.io's admin RBAC — see
  §4.9). Auth sessions are `user_sessions` (JWT hash + revocation, `token_hash` globally
  unique) — these are **ephemeral by design** and are never migration targets (§9).
  Password hashing is bcrypt-based on both systems (per `docs/MigrationStrategy.md`'s existing
  risk note) — format-compatible, still worth a hash-decode spot check before cutover (§4.2).
- **IDs.** Every model is `String @id` with no DB-level default — IDs are generated in
  application code via `createId()` from `@paralleldrive/cuid2`
  (`server/src/lib/events.ts`, `libraryClone.ts`, `scheduler.ts`, `scripts/migrate.ts`, etc.).
  fitforce.io used Prisma's original `cuid()` (format `clxxxxxxxxxxxxxxxxxxxxxxxx`, fixed `cl`
  prefix). These are two different ID formats with no shared generation path — see §7 for why
  that makes ID collision a non-issue but a mapping table still a good idea.
- **Migrations.** The real migration history lives in `server/migrations/*.js` (node-pg-migrate
  style, 45 files, tracked via the `pgmigrations` table) — *not* `server/prisma/migrations/`,
  which only has 2 entries and appears to be a recent, partial adoption of Prisma Migrate
  layered on top of a schema that was mostly built by hand-written migrations and kept in sync
  in `schema.prisma` via introspection. Any new migration for this project should follow the
  existing `NNN_description.js` convention, not `prisma migrate dev`.
- **Storage.** `server/src/lib/storage.ts` — S3-compatible via `multer-s3` when
  `S3_BUCKET`/`S3_ACCESS_KEY`/`S3_SECRET_KEY` are set, else local disk under `server/uploads/`.
  `toPublicUrl()` already handles the case of an already-absolute URL passed through
  unchanged — this is directly reusable for migrated fitforce.io URLs (§8).
- **Scheduler.** All in-process `node-cron` jobs in `server/src/middleware/scheduler.ts`, single
  instance (per `CLAUDE.md` §11): hourly form dispatcher, hourly check-in dispatch, daily
  subscription expiry (midnight), daily client-status-sync + review-due check (00:30), daily
  session cleanup (2am). None of these are safe to leave running against a database mid-import
  (§10).
- **Forms Versioning.** `forms` → `form_versions` (sealed on first real-world use) →
  `form_version_questions`; `form_requests.form_version_id` pins the version at assignment
  time; `form_responses.question_id` resolves against the immutable version snapshot. This is
  new since fitforce.io, which has flat `FormTemplate.questions` (jsonb) and
  `FormSubmission.answers` (jsonb) with no versioning at all. The team already solved an
  analogous problem once — see `docs/forms-versioning-architecture-decision.md` and
  `docs/forms-versioning-implementation-plan.md` — the "Phase 1 backfill" logic there (assign a
  best-effort sealed timestamp to pre-existing forms) is the direct template for §11.
- **Metrics.** `metrics` + `form_version_questions.metric_id` + `form_responses.metric_id`. Pure
  addition, no fitforce.io equivalent exists (§13).
- **Default/master libraries.** `master_exercise_library`, `master_exercise_equipments`,
  `master_exercise_muscle_groups`, `master_food_items`, `master_food_categories`,
  `master_forms`/`master_form_questions` are **global, not tenant-scoped** — cloned into a
  workspace's own `exercise_library`/`food_items`/`forms` tables at signup
  (`server/src/lib/libraryClone.ts`). fitforce.io's equivalent globals are `DefaultExercise`
  (1,494 rows) and `DefaultFoodItem` (151 rows) — no default-forms equivalent existed there.
  This distinction (global catalog vs. per-tenant clone) is important for §6.6.

### 1.2 fitforce.io (old) — what the snapshot actually contains

Real row counts, pulled from `pg_restore` of the 2026-06-11 dump into a throwaway local
database (dropped after analysis — this document keeps the extracted DDL and counts, not the
live restore):

| Table | Rows | Table | Rows |
|---|---|---|---|
| `Workspace` | 181 | `User` | 2,549 |
| `WorkspaceMember` | 187 | `Client` | 2,345 |
| `WorkoutPlan` | 2,244 | `NutritionPlan` | 2,023 |
| `WorkoutPlanDay` | 14,108 | `NutritionPlanDay` | 2,038 |
| `WorkoutPlanDayItem` | 81,258 | `NutritionPlanDayItem` | 9,860 |
| `WorkoutPlanSet` | 160,060 | `NutritionPlanItem` | 1,206 |
| `WorkoutLog` | 5,530 | `MealFoodItem` | 29,209 |
| `FormTemplate` | 127 | `FormSubmission` | 7,567 |
| `Thread` | 251 | `Message` | 502 |
| `Notification` | 36,562 | `AuditLog` | 4,417 |
| `Subscription` | 2,478 | `Payment` | 2,497 |
| `WorkspaceSubscription` | 214 | `WorkspacePayment` | 233 |
| `ClientPackage` | 187 | `WorkspacePackage` | 13 |
| `Exercise` | 82,084 | `FoodItem` | 28,197 |
| `DefaultExercise` | 1,494 | `DefaultFoodItem` | 151 |
| `ClientObservation` | 5 | `ClientAttachment` | 3 |
| `PasswordResetToken` | 154 | `UserSession` | 527 |
| `PromoCode` / `Commission` / `Discount` | 13 / 3 / 3 | `Recipe` | 1 |
| `PdfTemplate` | 18 | `VisualPdfTemplate` | 16 |
| `VisitAnalytics` | 2,082,739 | `VisitSession` | 63,603 |
| `SystemLog` | (not restorable locally — very large; ops log, not business data) | | |
| `Ticket`/`TicketMessage`/`TicketActivity`/`TicketCategory` | 0 / 0 / 0 / 0 | | |

Full 79-table inventory and per-table disposition (migrate / reconcile / archive-only / skip)
is in the Appendix (§16).

**Read on this data before planning further:** 181 workspaces, ~2,345 clients is a small,
fully-reviewable dataset. This is not a "big data" migration — every workspace's row counts fit
in memory, and a full dry-run diff of all 181 workspaces is cheap to compute and cheap for a
human to skim. That changes the risk calculus: favor an approach that produces a **complete,
human-readable diff report before touching production** (§14) over one that's merely fast.

---

## 2. Domain / environment reality check (do this before anything else)

`ROOT_DOMAIN` is a plain env var (`server/src/config/env.ts`, defaults to `localhost`); nothing
in the codebase hardcodes `fitforce.app`. Confirm, before Phase 1 begins:

- [x] **Confirmed separate physical databases.** fitforce.app's `DATABASE_URL` is a distinct
      instance from whatever backs fitforce.io — this is a genuine cross-database import, not a
      same-database repair. (Confirmed in the clarification round above — no longer an open item.)
- [ ] `server/src/app.ts`'s CSP (`DEBT.md`, 2026-06-11 entry) still hardcodes
      `fitforce.io`/`*.fitforce.io` for `connectSrc` and a stale `fitforceapp.com` (not
      `fitforce.app`) for `frameAncestors`. If fitforce.app is meant to be the sole survivor
      after this migration, this config needs a real audit — a stale CSP `connectSrc` entry
      referencing the soon-to-be-decommissioned domain is a latent bug, not a cosmetic one.
- [ ] **Blocking, per the clarification round above: re-run §3's DDL diff and §17's row counts
      against the fresh fitforce.io snapshot once it's provided.** The 2026-06-11 dump this
      document is built on is confirmed stale — table *shapes* are unlikely to have moved (the
      legacy codebase isn't under active development), but row counts, and therefore every
      count in §1.2/§14/§15/§17, are provisional until re-verified against the new file. Treat
      this document's numbers as "the method is right, the exact figures need a refresh," not
      as final.
- [ ] Mobile app and mid-cycle Paymob billing were both raised as risks during review and are
      now confirmed **out of scope**: the Flutter app talks only to fitforce.app, and Paymob was
      never live in production (`docs/MigrationGapAnalysis.md` Gap 0-B). No handling needed for
      either.

---

## 3. Schema Compatibility Report

### 3.1 Structural differences (the ones that require actual transform logic, not just a rename)

| Area | fitforce.io | fitforce.app | Transform required |
|---|---|---|---|
| **Forms** | `FormTemplate.questions` — flat jsonb array, no versioning. `FormSubmission.answers` — flat jsonb blob keyed by question. | `forms` → `form_versions` (sealed) → `form_version_questions`; `form_requests.form_version_id` pins the version; `form_responses` is one row per question, FK to `form_version_questions.id`. | For each `FormTemplate`: create one `forms` row + exactly one `form_versions` row (sealed, since it's historical) + one `form_version_questions` row per entry in the old `questions` array (preserving `order_index`). For each `FormSubmission`: one `form_requests` row + N `form_responses` rows, one per key in the old `answers` blob, matched to the version's questions by array position (same approach as the existing Forms Versioning Phase 1 backfill — see `docs/forms-versioning-implementation-plan.md`). **This is the single largest transform in the whole migration.** |
| **Messaging** | `Thread` (one per client) + `Message` with **two** nullable sender FKs (`senderUserId` / `senderClientId`) discriminated by `senderType`. | `threads` (`@@unique([workspace_id, client_id])` — same "one thread per client" invariant) + `messages` with a **single** `sender_id` + `sender_type` discriminator. | 1:1 table mapping for `threads`. For `messages`, collapse `senderUserId ?? senderClientId` into `sender_id`, keep `senderType`. |
| **Notifications** | `Notification`: `workspaceId` nullable, single `userId` **or** `clientId` nullable column pair, `readAt`. | `notifications`: `recipient_type` + `recipient_id` discriminator (not FK-constrained on purpose — recipients can be hard-deleted), `importance` (`info`/`actionable`/`alert`, no fitforce.io equivalent — default all migrated rows to `'info'`), `entity_type`/`entity_id`, `actor_type`/`actor_id`. | Collapse `userId ?? clientId` into `recipient_type`/`recipient_id`. `type` string values differ between systems (fitforce.app's are dotted, e.g. `message.received`) — build an explicit type-string mapping table, don't pass fitforce.io's `type` values through verbatim. |
| **Plans (nutrition/training)** | Both already nested: `WorkoutPlan`→`WorkoutPlanDay`→`WorkoutPlanDayItem`→`WorkoutPlanSet`; `NutritionPlan`→`NutritionPlanDay`→`NutritionPlanDayItem`. | `training_plans`→`training_days`→`training_exercises`→`training_sets`; `nutrition_plans`→`nutrition_cycles`→`nutrition_meals`→`nutrition_meal_items`(→`nutrition_meal_item_alternatives`). | Conceptually compatible (both nested), but fitforce.app adds a `nutrition_cycles`/`nutrition_meals` grouping layer fitforce.io doesn't have — old `NutritionPlanDay` rows become synthetic single-meal-per-day `nutrition_meals` unless the actual old day/item semantics map more directly (verify against real `NutritionPlanDayItem` rows during dry-run, don't assume). Old fields with no destination: `WorkoutPlan.heartRateMax/heartRateTarget/startCardio/startHit/yearsOld`, `pdfUrl`, `templateId`, `version` — these are genuine feature gaps already logged in `docs/MigrationGapAnalysis.md` (P3-1 PDF generation). Store the untranslatable fields in a JSON "migration overflow" column or a side table rather than silently dropping them (§4.7). |
| **Exercise/Food libraries** | Per-workspace `Exercise`/`FoodItem` + global `DefaultExercise`/`DefaultFoodItem` (not tenant-scoped, no cloning mechanism — old app read defaults directly). | Per-workspace `exercise_library`/`food_items` (already seeded per workspace via signup-time clone of `master_*`) + separate `master_exercise_library`/`master_food_items` global tables. | Two different sub-problems — see §6.6. Don't naively insert `DefaultExercise` rows as new `master_exercise_library` rows (duplicates); don't naively clone masters into every migrated workspace (they already have them from signup). |
| **Client identity fields** | `Client.email` **nullable**, plus a separate `workspaceEmail` (portal login email, distinct from real email) with its own unique constraint (case-insensitive, via `client_ws_lower_workspace_email_idx`). `deviceToken` (FCM), `frozenAt`/`frozenDays` (single current freeze), `isVerified`, `visiblePassword`. | `clients.email` **NOT NULL** `VarChar(150)`. No `workspace_email` column at all. Freezing is a full history table `subscription_freezes` (one row per freeze event), not a single current-state pair. No `device_token`, `is_verified`, or `visible_password` columns. | (a) Any old `Client` with `email IS NULL` **violates the new NOT NULL constraint** — needs a synthetic placeholder (`client-{old_id}@migration.invalid` or similar, flagged for the coach to fix later) or the row is rejected — this must be a resolved policy decision before the dry-run, not discovered during it. (b) `workspaceEmail` has no destination column — if it was used as the actual client-portal login identity, losing it silently breaks that client's login. **Flag as a P1-equivalent gap requiring product confirmation before migration**, not something to quietly transform. (c) `frozenAt`/`frozenDays` → single synthetic `subscription_freezes` row per migrated client that has a non-null `frozenAt`. (d) `deviceToken`/push notifications already tracked as deferred (`docs/MigrationGapAnalysis.md` P1-5/P3) — drop, or hold in a side table until push is rebuilt. |
| **Admin accounts** | Full RBAC: `AdminUser`/`AdminRole`/`AdminPermission`/`AdminRolePermission`/`AdminUserRole`/`AdminSession`/`AdminMfa`/`AdminTrustedDevice`/`AdminIpAllowlist`/`AdminApiKey`. | Single flat `admins` table (per `CLAUDE.md`: "AdminUser → admins simplified"). | **Do not migrate.** Operator/admin accounts are internal staff, not customer data, and fitforce.app's simplified model can't represent fitforce.io's role graph anyway. Recreate the small number of real admin accounts by hand on fitforce.app. Treat any admin migration script as a security-relevant change requiring separate sign-off, per `CLAUDE.md` §4's stricter rules for operator identities. |
| **Support tickets** | `Ticket`/`TicketMessage`/`TicketActivity`/`TicketCategory` — all **0 rows** in the snapshot. | No equivalent tables exist (`docs/MigrationGapAnalysis.md` P2/P3-2, confirmed missing). | Moot — nothing to migrate. Don't build transform logic for empty tables. |
| **Food replacement workflow** | `FoodReplacementRequest` (95), `FoodItemReplacement` (3), `FoodReplacementHistory` (2), `NutritionReplacementRequest` (403), `NutritionReplacementTemplate` (0), `ReplacementTemplate` (1). | **No matching models found** in current `schema.prisma` (`docs/MigrationGapAnalysis.md` P1-7: "partially present, coach side only," status unresolved — deferred to P3). | Cannot migrate into tables that don't exist. Export as a cold-storage snapshot (JSON dump keyed by client) for manual/product reference; do not attempt a live insert. Revisit once the feature is rebuilt with a matching schema — this is a real, currently-open product gap, not a migration-tooling gap. |
| **PDF templates** | `PdfTemplate` (18, per-workspace, JSON `schema` + HTML), `VisualPdfTemplate` (16, JSON-config visual builder). | `pdf_settings` — one row per coach, a flat settings/branding record, structurally nothing like a template library. | Not a 1:1 transform. Treat as a product decision (P3-4 in the gap analysis), not a migration script — export the 34 old templates as reference material for whoever rebuilds this feature. |
| **Platform-singleton config** | `AppConfig` (1 row — feature flags, landing page config), `Announcement` (1), `MetaIntegrationConfig` (1). | No equivalent — and critically, **fitforce.app has its own live singleton config already**, if any exists. | **Never migrate singleton/global config rows.** Blindly inserting or upserting these would silently overwrite fitforce.app's own live platform configuration. Treat as manual, reviewed reconfiguration only. |

### 3.2 Structurally identical (rename-and-cast only)

`Workspace`→`workspaces` (see §6.1 for the `subdomain`→`slug` unique-constraint nuance),
`User`→`users`, `WorkspaceMember`→`workspace_members`, `ClientObservation`→`client_observations`
(field reshape: old is single free-text `content`; new adds `title`/`category`/`severity`/
attachment-relation columns — old rows become `category: 'General'`, `title` synthesized from
the first line of `content`), `ClientAttachment`→ **no direct destination** (fitforce.app has no
attachments table — `docs/MigrationGapAnalysis.md` P3-3, still open; export-only, same
treatment as PDF templates), `AuditLog`→`workspace_audit_log` (old is platform-wide with a
nullable `workspaceId`; new is workspace-scoped and NOT NULL — rows with `workspaceId IS NULL`
in old have no destination and are platform-ops noise, not tenant data — drop them),
`WorkoutLog`→`workout_logs`, `Subscription`+`WorkspaceSubscription`+`WorkspacePayment`→
`workspace_subscriptions`+`workspace_payments` (see §6.7 — `plans` is a small **global**
lookup table, not per-row migrated).

### 3.3 Enums, constraints, indexes

fitforce.io has **no Postgres enum types** (`CREATE TYPE ... AS ENUM` — zero matches in the
dump); all "enum-like" columns (`status`, `type`, `senderType`, etc.) are plain `text` with
apparent conventions enforced only in application code. Same is true of fitforce.app (grep of
`schema.prisma` shows no `enum` blocks either — every status field is a `String` with a
`@default`). This is good news: there is no enum-value remapping problem, only a string-value
mapping problem (e.g. confirm `FormTemplate.status` values match `forms.status` values used by
fitforce.app — `'draft'`/`'active'`/`'archived'` vocabulary must be verified against real data
during the dry-run, not assumed identical just because both are free-text).

Constraint asymmetries worth calling out explicitly (beyond what's in §3.1's table):
- fitforce.io's `Client` has **case-insensitive** unique indexes
  (`client_ws_lower_email_idx`, `client_ws_lower_workspace_email_idx`) that fitforce.app's
  `clients` table does not have (`@@unique([workspace_id, email])` is case-sensitive by
  default in Postgres). Two old clients differing only by case (`Ali@x.com` / `ali@x.com`) in
  the *same* workspace were prevented from existing on fitforce.io but **would both pass**
  fitforce.app's constraint today. Decide up front whether migrated data should be
  lower-cased on write, or whether fitforce.app should grow the same case-insensitive index
  (the latter is the more defensible fix, and cheap — flag it to the team regardless of what
  this migration does).
- fitforce.io's `Workspace.subdomain` and `Workspace.customDomain` are two separate unique
  columns; fitforce.app's `workspaces.slug` is one. If any migrated workspace's identity
  depends on `customDomain` (a white-label domain), that concept has no destination column at
  all — confirm none of the 181 workspaces have a non-null `customDomain` before assuming this
  is a non-issue (a single `grep`/count against the dump settles it in seconds during Phase 0
  of execution).

---

## 4. Migration Risks

For each: **why it happens → how to detect → how to prevent → recovery**.

### 4.1 Workspace slug/subdomain collision
**Why:** Two unrelated coaches on separate systems independently chose the same short,
business-name-derived identifier (`"fitclub"`, `"johncoaching"`). Not duplication — coincidence.
**Detect:** Before import, compute `SELECT subdomain FROM old.workspaces` ∩
`SELECT slug FROM new.workspaces` (case-insensitive). With only 181 old workspaces this is a
trivial set intersection, not a query-plan concern.
**Prevent:** Reserve a deterministic suffixing rule up front (e.g. `-io` appended, or a numeric
suffix) applied **only** to colliding old slugs, and surface every renamed slug in the dry-run
report (§14) for a human to bless — a coach whose public URL silently changes deserves a
heads-up, not a silent rename.
**Recovery:** Since old is never written to (§4.10), slugs can be recomputed and the import
step re-run after a rename-policy correction.

### 4.2 User email collision (the one real duplication case)
**Why:** The same human registered on both systems — most plausibly during the Phase 2
"parallel running" window described in `docs/MigrationStrategy.md`, when trusted coaches were
explicitly invited to try fitforce.app while their real data stayed on fitforce.io.
**Detect:** `SELECT email FROM old."User"` ∩ `SELECT email FROM new.users` (case-insensitive —
old has no case-insensitive unique index on `User.email`, only a plain unique one, so verify
there are no old duplicate-by-case emails within `old."User"` itself first).
**Prevent — confirmed policy (see §6.2):** fitforce.io's version of the workspace wins.
Concretely: if the matched fitforce.app user owns/is a member of a workspace with its own real
data, that fitforce.app workspace's data is **replaced** by the migrated fitforce.io workspace
— a deliberate, scoped exception to this document's otherwise-absolute "never overwrite
fitforce.app data" rule (§0), confirmed explicitly and applying **only** to this matched-user
case. If the matched fitforce.app user has no workspace of their own (an empty/trial account),
there's nothing to replace — the fitforce.io workspace is simply migrated in normally, no
special handling needed. Given only 181 workspaces total, expect this set to be small (dozens,
not thousands) — every such replacement is still individually listed in the dry-run report
(§14) so a human can see exactly which fitforce.app workspaces are about to be superseded
before the real run, even though the rule itself no longer requires a case-by-case judgment
call.
**Recovery:** Because the fitforce.app side of a matched workspace is being deliberately
superseded, "recovery" here means recovering the *superseded* fitforce.app data if the
replacement turns out to have been wrong — which is exactly why §6.2 requires archiving
(soft-delete/rename), never hard-deleting, the superseded workspace. Recovery is then a
straightforward un-archive, guided by the audit/mapping table from §7.

### 4.3 Client NOT NULL / uniqueness mismatch
**Why:** fitforce.app requires `clients.email NOT NULL`; fitforce.io allows it null. Covered in
§3.1.
**Detect:** `SELECT count(*) FROM old."Client" WHERE email IS NULL`.
**Prevent:** Decide the synthetic-email policy before the dry-run (not during it), and make the
placeholder pattern unmistakably a placeholder (e.g. include the workspace slug and old client
id) so a coach who sees it in the UI immediately understands it needs fixing, rather than
mistaking it for a real, wrong email address.
**Recovery:** Placeholder emails are trivially identifiable and bulk-correctable post-migration
via a follow-up script once real emails are collected from coaches.

### 4.4 Broken foreign keys / missing referenced rows
**Why:** Soft-deleted or orphaned rows in an 82-table legacy schema accumulated over time
without FK enforcement gaps being caught (e.g. a `FormSubmission.clientId` pointing at a
hard-deleted client, if any hard-deletes ever happened outside the `deletedAt` convention).
**Detect:** Before import, run an orphan-check pass per FK column: any `FormSubmission.clientId`
not present in `Client.id`, any `Message.threadId` not present in `Thread.id`, etc. This is
cheap to script generically (walk `old_schema.sql`'s constraint list, or hand-list the ~15 FK
columns that matter) and should be part of the dry-run's standard output, not a one-off check.
**Prevent:** Never insert a child row whose parent didn't successfully migrate — the
dependency-ordered import (§5) already makes this natural: if a `Client` failed validation and
was skipped, every dependent row skips too, logged as "skipped — parent skipped," not silently
dropped.
**Recovery:** Because rows are skipped rather than force-inserted with a dangling FK, there is
nothing to "recover" — the skip log from the dry-run tells you exactly what's missing and why,
and it's addressable before the real run.

### 4.5 Scheduler / in-flight state inconsistency
**Why:** fitforce.app's schedulers (§1.1) run continuously against production. If an import
runs while `scheduleFormDispatcher`/`scheduleCheckInDispatch`/`scheduleSubscriptionExpiry` are
also ticking, a freshly-imported `form_requests` or `workspace_subscriptions` row can be
mutated mid-import by a cron tick that has no idea an import is in progress, or the import can
observe a half-updated row.
**Detect:** N/A — this is a coordination problem, not a detectable-after-the-fact one.
**Prevent:** Run every real import during a maintenance window with fitforce.app's cron jobs
paused (a feature flag or a temporary env var gating `scheduleFormDispatcher()` etc. from being
registered at boot is simplest, given they're just function calls in server startup) — see §10.
**Recovery:** If a window is missed and inconsistency is suspected, the affected tables are
small and enumerable (`form_requests`, `check_in_schedules`, `workspace_subscriptions`) — a
targeted re-run of just the status-recompute logic (`computeClientStatus`,
`runReviewDueCheckTick`) against migrated rows resolves drift without re-importing.

### 4.6 Notification volume
**Why:** 36,562 old `Notification` rows, almost all historical and already read. Migrating
every one verbatim adds noise to every coach's notification bell on day one, degrading the
migrated experience rather than preserving it faithfully.
**Detect:** N/A — a product decision, not a bug.
**Prevent:** Recommend migrating only notifications from a recent window (e.g. last 30–90
days) or only unread ones (`readAt IS NULL`), archiving the rest to cold storage rather than
importing. Confirm this policy with product before the dry-run — this is a "challenge the
assumption that everything must be migrated" moment: total fidelity is not always the right
goal.

### 4.7 Untranslatable fields (silent data loss)
**Why:** Per §3.1, several old columns (`WorkoutPlan.heartRateMax/heartRateTarget/startCardio/
startHit/yearsOld`, `pdfUrl`, `CaDay`-related fields, `Client.workspaceEmail/deviceToken/
visiblePassword`) have no destination column in the new schema.
**Detect:** A field-by-field pass (§3.1) already enumerates these; treat any old NOT NULL /
frequently-populated column with no mapped destination as a blocker requiring an explicit
decision, not an oversight discovered post-launch.
**Prevent:** For fields with product value but no destination column yet (workspaceEmail,
heart-rate targets), store them in a JSON side-table (`migration_overflow` keyed by old id and
target table) rather than dropping silently — cheap insurance, and it turns "we lost data" into
"we have it, just not wired into the UI yet."
**Recovery:** The overflow table makes any later "oh, we actually need that field" request a
backfill from already-migrated data instead of a re-import from the (by-then-decommissioned)
old system.

### 4.8 File/media URL breakage
**Why:** Old media (client photos, exercise videos/thumbnails, message attachments/voice
notes) reference either old-app-relative `/uploads/...` paths or an old S3 bucket. New app's
`toPublicUrl()` builds URLs from `env.S3_PUBLIC_URL`/`env.S3_ENDPOINT` + key, or falls back to
its own `/uploads/` prefix — neither of which resolves an old bucket's object key or an old
relative path.
**Detect:** Sample and HTTP-HEAD-check a random set of migrated URLs post-import per table
(client photos, exercise thumbnails, message attachments) as a dry-run validation step (§14).
**Prevent:** See §8 — never insert an old bucket-relative key into a new-schema URL column
without either (a) copying the object into fitforce.app's bucket first and rewriting the key,
or (b) storing the fully-qualified old URL (since `toPublicUrl()` already passes absolute URLs
through unchanged — this is a real, already-built escape hatch, use it if a same-day full
object migration isn't feasible).
**Recovery:** Broken URLs are non-destructive (they just 404) and independently fixable after
the fact by re-running the object-copy step and updating the stored key — not a rollback
trigger on their own.

### 4.9 Admin/operator account confusion
**Why:** Covered in §3.1 — importing old `AdminUser`/roles into the simplified new `admins`
table can't preserve the role graph and risks creating operator accounts with unintended
(over-broad) access.
**Detect/Prevent:** Simply don't do it — treat as out of scope for automated migration (§3.1).
**Recovery:** N/A — nothing to recover from if it's never attempted.

### 4.10 Migration script writing to fitforce.io
**Why:** Any migration bug that issues an `UPDATE`/`DELETE` against the source instead of the
target during development/testing.
**Detect:** Connect to fitforce.io (if it must be reachable at all during migration — ideally
it's a `pg_restore`'d read-only copy, not a live connection) with a **read-only** Postgres role,
so any accidental write fails loudly at the database level rather than silently succeeding.
**Prevent:** Never give migration tooling a superuser or write-capable credential for the
source system. Work from a restored snapshot copy, never a live connection to fitforce.io's
production database, for the entire dry-run and (ideally) the real run too.
**Recovery:** N/A if prevented structurally as above.

---

## 5. Dependency Graph (derived from the actual `schema.prisma` FK graph, not assumed)

The brief's example graph is a reasonable sketch but doesn't match this schema's actual FKs —
notably, `plans` (SaaS billing tiers) is a small **global** table fitforce.app already seeds
independently, not something migrated per-workspace; and `metrics` must precede
`form_version_questions` because of `metric_id`. Real order:

```
users  (owner_id / created_by / author_id targets — insert first, workspace_id backfilled after)
  ↓
workspaces  (owner_id → users; slug collision check per §6.1 happens here)
  ↓
workspace_members, workspace_invitations
  ↓
[plans — NOT migrated per-row; existing fitforce.app rows matched by name, see §6.7]
workspace_subscriptions, workspace_payments  (plan_id → matched existing plans.id)
  ↓
exercise_muscle_groups, exercise_equipments, food_categories   (per-workspace reference data)
  ↓
exercise_library, food_items   (per-workspace; reconciled against master_* per §6.6, not
                                 duplicated with clone-seeded rows already present)
  ↓
packages → package_variations
  ↓
clients   (workspace_id, optionally current_package_variation_id — insert with null FK first
           if the package/variation resolution needs a second pass; email NOT NULL policy
           from §4.3 applied here)
  ↓
subscription_access_policies, subscription_freezes, subscription_status_audit
  ↓
metrics
  ↓
forms → form_versions → form_version_questions   (the Forms Versioning transform, §11)
  ↓
package_default_forms
  ↓
form_requests → form_responses
  ↓
check_in_schedules
  ↓
threads → messages
  ↓
nutrition_plans → nutrition_cycles → nutrition_meals → nutrition_meal_items
                                                       → nutrition_meal_item_alternatives
training_plans → training_days → training_exercises → training_sets
                                                     → training_exercise_alternatives
  ↓
workout_logs
  ↓
transactions
  ↓
client_measurements, client_photos, client_observations, observation_relations
  ↓
notifications   (recency/unread filter per §4.6 — not a full historical import)
  ↓
workspace_audit_log
  ↓
payment_methods, pdf_settings   (independent of the chain above — schedule any time after
                                  their single workspace_id/coach_id parent exists)
```

`user_sessions`, `password_reset_tokens` are **never migrated** (§9) — they're not in this
graph at all.

---

## 6. Conflict Resolution Strategy — per entity

### 6.1 Workspace: slug already exists
Not a duplicate workspace — two independent tenants, coincidental slug collision (§4.1).
**Rule:** Deterministically rename the incoming (fitforce.io) workspace's slug
(`{old-subdomain}-io`, or append a short disambiguator); never rename the existing fitforce.app
slug (it has live users depending on the URL today). Surface every rename in the dry-run report
for a manual sign-off — don't auto-apply silently. If `customDomain` was in use (§3.3), that's
a distinct, higher-touch conversation with the coach, not something this rule alone resolves.

### 6.2 User: same email, different account (the real duplication case) — confirmed rule

Match users by email between `old."User"` and `new.users` (case-insensitive). For every match,
exactly one of two cases applies — **this is now a deterministic rule, not a per-row human
judgment call**, per the confirmed decision in the clarification round above:

1. **The matched fitforce.app user owns no workspace of their own** (an empty/trial account —
   registered, never created a workspace or added a client). Nothing to replace: migrate the
   fitforce.io workspace(s) in under that same existing `users.id` (do **not** insert a second
   `users` row for this email — the unique constraint would reject it anyway, and re-using the
   existing row is correct, not a workaround). No data on fitforce.app is touched.
2. **The matched fitforce.app user owns a workspace with its own real data.** **The fitforce.io
   workspace wins.** Concretely, per-matched-workspace:
   - **Hard-delete the fitforce.app workspace and everything under it** (cascading via the
     schema's existing `onDelete: Cascade` FKs on every `workspace_id`-scoped table), then insert
     the fitforce.io workspace as the replacement. **Revised policy, confirmed explicitly** — the
     original version of this rule called for archiving (soft-delete, `archived_at` set, slug
     freed) as a safety net, specifically so a wrong call was recoverable without touching
     backups. That safety net has been deliberately traded away: a hard delete here is
     **not recoverable** except by a full pre-migration database restore, which would undo every
     other change made since — including any other workspaces already migrated in the same
     session. Confirm the pre-migration backup (per §16 Phase E) is current and verified
     restorable before applying this rule to any real case, since it is now the only way back.
   - Migrate the fitforce.io workspace in as the **active** workspace for that user (same
     `owner_id`/`users.id`, fresh `workspaces.id` from fitforce.io, normal `slug` now available
     since step one freed it up).
   - This is the **one deliberate, scoped exception** to this document's "never overwrite
     fitforce.app data" rule (§0) — it applies only here, never to any disjoint (non-matched)
     workspace, which is always left completely untouched (§6.1's slug-collision handling is
     the only thing that ever touches an unmatched workspace, and even then only its `slug`,
     never its data). Given the loss of the archive safety net, **every case-2 match found during
     the incremental migration should be surfaced and confirmed individually before deletion** —
     not applied in a batch sweep — precisely because there is no undo per-row anymore.
3. **No email match at all** → the normal disjoint case, no exception, no replacement — proceed
   as the rest of this document already describes.

Even though the rule is deterministic, **every case-2 replacement is still listed individually
in the dry-run report (§14)** — a human should see exactly which fitforce.app workspaces are
about to be archived-and-superseded before the real run runs, not just trust the rule blindly
at scale.

### 6.3 Client: same phone/email, different UUID
Given clients are workspace-scoped on both systems, and workspaces are disjoint populations
except for §6.2's matched-user case, a client-level collision only matters *within* a single
migrated workspace that replaced its fitforce.app counterpart (§6.2 case 2) — and even there it
mostly doesn't arise, because that workspace's own (now-archived) client rows are no longer live
alongside the incoming fitforce.io ones; they're archived, not merged row-by-row. If a genuine
need arises to reconcile individual clients between the two versions of the same workspace
(e.g. a coach wants specific clients pulled back from the archived fitforce.app side after the
fitforce.io version becomes active), that's a manual, per-client operation against the archived
data — not an automated merge rule, and not expected to be common given §6.2's workspace-level
replacement already resolves the normal case.

### 6.4 Package/Plan: same name, different IDs
fitforce.io's `WorkspacePackage` (FitForce's own SaaS tiers sold to coaches) has a
**different destination** than its name suggests — it maps to fitforce.app's `plans` table,
which is small (a handful of rows: Starter/Pro/etc.) and **already exists** on fitforce.app,
seeded independently, not per-workspace. **Rule:** never insert new `plans` rows from old
`WorkspacePackage` data. Instead, build a small hand-verified name/tier mapping (13 old rows,
trivial to review by eye) from old `WorkspacePackage.name` → existing `plans.id`, and use that
mapping when migrating `Subscription`/`WorkspaceSubscription`/`WorkspacePayment` → fitforce.app's
`workspace_subscriptions`/`workspace_payments`. This is the opposite of "same name → merge
rows" — it's "same name → route to the existing row, insert nothing new."

By contrast, `packages`/`package_variations` (the client-facing packages a *coach* defines and
sells to *their own clients*) **are** genuinely per-workspace/per-tenant data and migrate
normally as new rows — there's no existing-row-matching step for these, since each workspace's
packages are its own.

### 6.5 Form: what defines equality?
Forms are workspace-scoped, and workspaces are disjoint — so "does this form already exist" is
never a cross-system question for a coach's *own* forms; it's purely an import (§11). The only
place "equality" matters is **`master_forms`** (global default Assessment/Check-In templates):
fitforce.io has no equivalent table at all (it never had a shared default-forms concept), so
there is nothing to reconcile there either — `master_forms` is entirely a fitforce.app
invention and is left untouched by this migration.

### 6.6 Exercise Library / Food Database
Two distinct sub-cases, not one:
- **Per-workspace `Exercise`/`FoodItem` rows:** genuinely new tenant data, migrate as new
  `exercise_library`/`food_items` rows under the re-mapped `workspace_id`. No merge needed
  (disjoint workspaces).
- **Global `DefaultExercise` (1,494) / `DefaultFoodItem` (151):** these are candidates for
  fitforce.app's `master_exercise_library`/`master_food_items`, which **already has its own,
  independently-curated content** (built post-rebuild). **Rule:** diff by `name_en` (case- and
  whitespace-normalized); insert only genuinely new entries not already present in the current
  master set; never re-insert or duplicate an existing master row just because an old
  `DefaultExercise` with a similar name exists. This is an admin-reviewed reconciliation, not a
  blind import — treat it as a one-time curated addition to the catalog, sized at "a few
  hundred rows at most," reviewed by whoever owns the exercise/food catalog product-side.
- **Do not** re-clone masters into migrated workspaces — every fitforce.app workspace already
  received its `exercise_library`/`food_items` clone at signup-time (`libraryClone.ts`); a
  *migrated* (not newly-signed-up) workspace needs the same clone treatment run once
  post-migration if it didn't exist as a fitforce.app workspace before, so it isn't starting
  with an empty library relative to what a normal signup would get — clarify this as an
  explicit post-migration step, not an assumption.

---

## 7. ID Strategy

**Recommendation: preserve fitforce.io's IDs as-is on insert; do not remap.**

Old IDs are classic `cuid()` (fixed `cl` prefix, e.g. `clxyz3f4k0000abc123def456`); new IDs are
`@paralleldrive/cuid2` (no fixed prefix, different alphabet/length distribution, generated via
`createId()`). These are two different generators with no shared namespace — the probability of
an old ID colliding with an existing fitforce.app ID is negligible (both are large-entropy
strings; cuid2's own collision-resistance claims apply independently of cuid v1's), and
`server/prisma/schema.prisma` never enforces an ID *format*, only uniqueness (`String @id`) — so
a `cl...`-formatted string is a perfectly valid primary key in the new schema.

**Advantages of preserving:** every FK in every migrated row stays internally consistent for
free (no cross-table remapping engine to write, test, and get wrong across ~40 migrated
tables); migrated rows are trivially traceable back to their fitforce.io origin by inspection
(useful for support tickets referencing old data, and for this migration's own rollback/audit
needs); dramatically simpler script logic — insert as-is, no ID-rewrite pass required at all.

**Disadvantage:** a mixed-format ID space is slightly unusual to look at in the DB long-term,
and if fitforce.app's application code ever validated ID format (it doesn't appear to —
`String @id` with no regex/length check found in the schema or a quick scan of validation
schemas), this would be a non-issue in practice too.

**Still do this, though — a defensive collision check + mapping table:**
1. Before the real run, do an explicit `SELECT id FROM old_table INTERSECT SELECT id FROM
   new_table` per migrated table. Expect zero rows; if not zero, that table's import halts and
   gets a manual look (this should never trigger given the above, but "should never trigger"
   is exactly the kind of assumption worth a two-line automated check rather than blind trust).
2. Maintain a `migration_id_map(old_table, old_id, new_table, new_id, migrated_at)` audit table
   — even though `new_id == old_id` in the normal case, this table is what makes §6.2's
   re-parenting case, the rollback plan (§12), and any future "where did this row come from"
   support question answerable in one query instead of an investigation. It costs one extra
   `INSERT` per migrated row and pays for itself the first time someone asks "did client X
   actually come from fitforce.io or was it created fresh."

Rejected alternative — **remapping to fresh cuid2 IDs for every row:** this was fitforce.io's
own original problem when migrating *from* the pre-rebuild legacy CUID/SERIAL-mismatch system
(`docs/MigrationGapAnalysis.md` Gap 0-A), and the team already correctly rejected building a
cross-table integer remapping engine for a similar reason then. The same logic applies now,
more strongly, since this time the ID *formats* aren't even incompatible — remapping would be
solving a problem that doesn't exist at the cost of real, testable complexity.

---

## 8. Files & Storage

Old media categories: client photos (`ClientAttachment`, `client_photos`-equivalent), exercise
videos/thumbnails (`Exercise.videoUrl`/`gifImage`), message attachments/voice notes
(`Message.attachments` — not seen as a distinct column in the extracted DDL excerpt but
referenced in the brief; treat any attachment URL column the same way), PDF templates.

**Process, per object referenced by a migrated row:**
1. Resolve the old URL/key to its actual object (old S3 bucket, or old app's local disk if the
   snapshot's file storage was ever local — confirm which before starting; the snapshot itself
   only contains DB rows, not files, so the object store must be accessed separately).
2. Copy the object into fitforce.app's configured bucket (`env.S3_BUCKET`) under a clearly
   namespaced key (e.g. `migrated/{workspace_id}/{original_filename}`) — never overwrite an
   existing fitforce.app key by coincidence.
3. Store the **new** key in the migrated row's URL/key column, so `toPublicUrl()` resolves it
   through fitforce.app's normal path exactly like a native upload — don't rely on the
   already-absolute-URL passthrough as the long-term answer, only as a stopgap if object
   copying must be deferred past the main data cutover (§4.8).
4. Verify with an HTTP HEAD check (not just "the copy command didn't error") — this is a cheap
   check per object and belongs in the dry-run report as an aggregate pass/fail count, not
   just a spot check of 5–10 rows as `docs/MigrationStrategy.md`'s original plan suggested
   (this migration's scale — a few thousand media rows at most, per the row counts above —
   fully supports checking every single one, not sampling).

**Avoid broken URLs** by never inserting a migrated row with an unresolved/unverified media
reference — better to migrate the row with the field null and flagged than with a URL that
404s in production.

---

## 9. Scheduler & In-Flight State

Nothing in the fitforce.io snapshot represents "future scheduled work" in fitforce.app's sense
— fitforce.io has no `check_in_schedules`-equivalent table at all (its check-in/assessment
flow, per the flat `FormTemplate`, was presumably ad-hoc/manual, not a scheduled-dispatch
system). So there is no legacy "pending cron work" to translate — the scheduler concern here is
entirely about **fitforce.app's own schedulers interfering with the import itself** (§4.5), not
about migrating scheduled state from the old system.

**Migration procedure:**
1. Put fitforce.app into a maintenance window; stop (or comment out the registration calls
   for) `scheduleFormDispatcher`, `scheduleCheckInDispatch`, `scheduleSubscriptionExpiry`,
   `scheduleClientStatusSync`, `scheduleSessionCleanup` for the duration of the real import run.
2. Run the import.
3. Restart the schedulers. The very next tick of `scheduleClientStatusSync` will naturally
   recompute `subscription_status` for every migrated client from its migrated
   `subscription_access_policies`/transaction data — this is a feature, not a risk: it means
   migrated clients don't need their status hand-computed by the migration script at all, just
   their underlying policy/transaction rows migrated correctly, and the existing scheduler
   settles the derived state on its normal cadence.
4. `password_reset_tokens`/`user_sessions` are never migrated (§9 title, §6.9 in the appendix)
   so `scheduleSessionCleanup` has nothing new to interact with regardless.

Never run schedulers concurrently with the import — even read-only ticks like the form
dispatcher can flip a `form_requests.status` mid-transaction in a way that races an import
script inserting rows into the same table.

---

## 10. Forms Versioning — legacy forms without breaking historical submissions

This is the highest-complexity single transform in the migration (§3.1). The good news: the
team already solved the structurally identical problem once, for fitforce.app's own
pre-versioning forms (`docs/forms-versioning-implementation-plan.md` Phase 1 backfill). Reuse
that exact strategy rather than inventing a new one:

**Per old `FormTemplate` row:**
1. Create one `forms` row (`title_en` ← `title`, `title_ar` ← `titleArabic`, `form_type` ←
   `type`, `status` ← `status`, `post_action` — no old equivalent, default `'nothing'`).
2. Create exactly one `form_versions` row for it, with `version_number = 1`.
3. **Sealing timestamp:** per the existing Phase 1 precedent, use the earliest associated
   `FormSubmission.createdAt`/`requestedAt` for that form if one exists (the version was
   "sealed" the moment it was first actually used); if the form was never submitted against,
   leave it unsealed (still a draft, consistent with fitforce.app's own rule that an unused
   version stays editable). **This is explicitly best-effort** — the same caveat the team
   already documented for their own backfill (`docs/DEBT.md`, 2026-07-07 entry, item 3) applies
   identically here: pre-migration provenance for a system that never versioned forms cannot be
   more precise than "first known use," and that's an acceptable, already-precedented
   limitation, not a new risk this migration introduces.
4. For each entry in the old `questions` jsonb array (in array order): create one
   `form_version_questions` row, `order_index` = array position, `origin_question_id` =
   its own new id (root of a lineage that starts fresh at migration — there is no prior
   version to inherit lineage from).
5. `forms.current_version_id` ← the version created in step 2 (there's only ever one).

**Per old `FormSubmission` row:**
1. Create one `form_requests` row: `form_id`/`client_id`/`workspace_id` mapped directly,
   `form_version_id` ← the single version created above, `status` ← `status`, `requested_at`/
   `submitted_at` mapped directly, `assigned_to`/`assigned_by` mapped if populated.
2. For each key in the old `answers` jsonb blob: match it to a `form_version_questions` row by
   **position** (both are ordered; the old blob's key order should correspond to the original
   question order — verify this assumption against a real sample during the dry-run rather
   than trusting it blindly, since jsonb key order is not formally guaranteed by Postgres even
   though it's practically stable for data written by a single consistent app version). Create
   one `form_responses` row per answer, `answer` ← the value (cast to string — `form_responses`
   stores answers as plain text regardless of question type, matching the existing pattern).
3. `metric_id` on any `form_response`: always null for migrated data — fitforce.io never had
   metrics (§12), so there is nothing to backfill-link, unlike fitforce.app's own historical
   backfill which did have real metrics to connect.

**Avoid breaking historical submissions** by never editing a `form_versions` row after
creation — treat every migrated version exactly as "sealed" data from the moment of import,
consistent with the whole point of the versioning system: a submission's answers must always
resolve against the exact question set that existed when it was answered.

---

## 11. Messenger

Order per §5: `threads` before `messages`. Straightforward field mapping (§3.1) with one
structural note: fitforce.app's `threads` has `@@unique([workspace_id, client_id])` — literally
enforcing "at most one thread per client" — which already matches fitforce.io's `Thread` model
(also one-per-client in practice, per its own `Thread_clientId_updatedAt_idx`). No fan-out
needed. `read_by_team_at`/`read_by_client_at` map directly from old `readByTeamAt`/
`readByClientAt`. Attachments/voice notes: map `attachment_url`/`attachment_name`/
`attachment_size`/`attachment_mime`/`attachment_duration` per §8's file-migration procedure —
these are exactly the kind of per-row media reference that needs object-copy + verification,
not a blind URL passthrough.

---

## 12. Metrics

**No legacy data exists to migrate — `metrics` is a pure fitforce.app addition** with no
fitforce.io equivalent (confirmed: no `Metric`-named table anywhere in the 79-table old
inventory). Nothing to do here beyond what §11's `form_responses.metric_id = null` already
covers. If product later wants historical fitforce.io check-in answers retroactively "tracked
as metrics," that's the same manual "Track as Metric" flow every other historical question
already requires (`server/src/modules/forms/forms.controller.ts`'s `trackQuestionAsMetric`,
per `docs/DEBT.md`'s 2026-07-12 entry) — not a migration-time concern.

---

## 13. Rollback Plan

Because fitforce.io is read-only throughout (§4.10) and every migrated row is traceable via the
`migration_id_map` (§7), rollback is simpler than the brief's framing of "what if it fails
halfway" suggests — there is no way to be in an ambiguous state about *what* was written, only
about whether it should be undone.

**If the import fails partway through:**
1. Every migration script is idempotent and batch-committed per table (per
   `docs/MigrationStrategy.md`'s existing rule — keep it), so "halfway" means "some tables
   fully committed, some not started" — never a half-written table, because each table's import
   is one transaction (or one transaction per reasonably-sized batch, with the batch boundary
   logged).
2. Rollback = `DELETE FROM {table} WHERE id IN (SELECT new_id FROM migration_id_map WHERE
   new_table = '{table}' AND migrated_at >= {run_started_at})`, run in **reverse** dependency
   order from §5 (children before parents, mirroring how cascading deletes would naturally
   need to happen, even though every migrated child row's `onDelete: Cascade` FK would also
   handle this automatically if you instead just delete the migrated `workspaces` rows —
   **prefer the explicit reverse-order delete over relying on cascade**, so the rollback is
   auditable step-by-step rather than an opaque single cascading delete that's hard to verify
   completed correctly).
3. Re-run after fixing the root cause. Since fitforce.io was never written to, there is no
   "the source data changed since the failed attempt" problem to worry about — the dry-run
   report and the real import can both be re-generated from the same frozen snapshot.

**Never delete fitforce.app's pre-existing data as part of any rollback** — the rollback
target set is exclusively rows present in `migration_id_map`, which by construction never
includes anything that existed on fitforce.app before this migration began.

---

## 14. Dry-Run Strategy

Given the actual data volume here (181 workspaces, low-thousands of most entities — see §1.2),
**a dry run should be a complete simulation against every row, not a sample.** This is well
within reach for a script that reads the restored snapshot and produces a report without
writing to fitforce.app's real database (write to a throwaway scratch database instead, exactly
as this document's own investigation did in §1.2 — restore-to-scratch-DB is proven to work end
to end already).

**Dry-run output, per table, before any real write:**
```
Table: clients
  Would insert:      2,298
  Would skip (parent workspace skipped): 12
  Would skip (email collision unresolved): 4
  Would flag (synthetic email needed):     31
  Warnings:           3 (workspaceEmail present, no destination column — see §3.1)
  Errors:             0
```

Plus the cross-cutting reports that don't map to a single table:
- Full list of every workspace slug rename (§6.1) — one line each, human-reviewable.
- Full list of every user-email collision (§6.2) — one line each, with the "empty account" vs.
  "has real data" classification pre-computed to speed up the human review, not left for the
  reviewer to derive.
- Orphan-FK report (§4.4) — every row that would be skipped due to a missing parent, and why.
- Media-URL verification results (§8) — pass/fail count per table, not just a sample.

**Nothing proceeds to the real run until every "would skip"/"would flag" line has an explicit
resolution decision recorded next to it** (not just "acknowledged" — an actual decision: rename
to X, use placeholder email Y, drop with reason Z). This is the direct execution of
`docs/MigrationStrategy.md`'s existing "never assume a migration succeeded" rule, made
concrete for this specific dataset's actual shape rather than left as a general principle.

---

## 15. Validation Checklist

Beyond the brief's list, scoped to what this specific schema and dataset make checkable:

```
Row-level counts (every one of these is a real, cheap COUNT(*) given the data volume — §1.2):
[ ] workspaces:        181 old rows → 181 - (any hand-approved skips) migrated, exact match expected
[ ] users:              matches old count minus §6.2 case-2 merges (no new user row created)
[ ] clients:            2,345 old rows accounted for: migrated + skipped-with-logged-reason, no unexplained gap
[ ] form templates→forms+form_versions: 127 old FormTemplate → 127 forms + 127 form_versions (1:1, always)
[ ] form submissions→form_requests:     7,567 old FormSubmission → 7,567 form_requests
[ ] form_responses: sum across all migrated form_requests equals total answer-keys summed
    across all old FormSubmission.answers blobs (a real computable number, not just "looks right")
[ ] threads: 251 old → 251 new (1:1, no fan-out possible given the unique constraint)
[ ] messages: 502 old → 502 new
[ ] workout_logs: 5,530 old → 5,530 new
[ ] transactions: derived from Payment (2,497) + WorkspacePayment (233) — reconcile the exact
    split before asserting a target count, since these map to two different new tables
    (workspace_payments vs. transactions) depending on whether the payment was a coach's own
    SaaS billing or a coach-to-client transaction — don't conflate the two counts

Referential integrity:
[ ] No form_responses.question_id pointing outside its own form_request's pinned form_version
[ ] No client with a package_variation_id belonging to a different workspace
[ ] No orphaned children of any skipped/rejected parent row (§4.4)

Media:
[ ] 100% of migrated media URLs HTTP-verified (§8) — not a sample, given the volume

Product-facing:
[ ] Every renamed workspace slug (§6.1) communicated to its coach before or at cutover
[ ] Every synthetic client email (§4.3) surfaced somewhere the coach will actually see it
    (client detail page banner, not just a hidden DB flag)
[ ] Notification volume policy (§4.6) applied and confirmed with product, not left as "import everything"

Scheduler:
[ ] Schedulers were paused for the actual import window (§9) — check server logs/uptime for the window
[ ] First post-migration tick of scheduleClientStatusSync completed without errors across
    every migrated client
```

---

## 16. Implementation Roadmap

### Phase A — Tooling & re-verification (before touching production data)
- **Objective:** Build the read-only comparison tooling and re-confirm this document's
  findings against a *fresh* fitforce.io snapshot (the one analyzed here is from 2026-06-11 —
  stale by the time of execution).
- **Tables involved:** none written; read-only against a freshly restored fitforce.io copy.
- **Risks:** none writable — the main risk is skipping the re-verification step and executing
  against assumptions that drifted since this document was written (§2).
- **Dependencies:** none.
- **Verification:** re-run §3's DDL diff and §1.2's row counts against the fresh snapshot;
  confirm no new tables/columns appeared in either schema since.
- **Rollback:** N/A (nothing written yet).

### Phase B — Decisions log (product + engineering sign-off)
- **Objective:** Resolve every "decision required" flagged in this document before writing a
  line of transform code: client synthetic-email policy (§4.3), notification retention window
  (§4.6), user-email-collision handling per case (§6.2), workspaceEmail/device-token/heart-rate
  field disposition (§4.7), admin-account exclusion confirmed (§4.9).
- **Tables involved:** none.
- **Risks:** proceeding without these decisions forces ad-hoc choices mid-script, which is
  exactly how silent, undocumented data loss happens.
- **Dependencies:** Phase A.
- **Verification:** a written decisions log, one line per open question above, each with an
  owner and a date — add it to `DECISIONS.md` per this repo's own convention.
- **Rollback:** N/A.

### Phase C — Dry run (§14)
- **Objective:** Full simulated import against a scratch database, producing the complete
  report described in §14, covering every one of the ~40 migrated tables.
- **Tables involved:** all migrated tables, target = scratch DB only.
- **Risks:** none to production; risk is treating a clean dry-run as sufficient without the
  manual sign-off step in §14's closing rule.
- **Dependencies:** Phase B's decisions encoded into the script.
- **Verification:** report reviewed and every flagged row resolved (§14).
- **Rollback:** drop the scratch database; trivial.

### Phase D — Staging execution
- **Objective:** Run the real import logic against a staging copy of fitforce.app's actual
  schema (not just the scratch DB used for the dry run), to catch anything scratch-DB
  simulation couldn't (real trigger behavior, real constraint enforcement under fitforce.app's
  exact current migration state).
- **Tables involved:** all.
- **Risks:** staging drift from production schema — confirm staging is migrated to the exact
  same `pgmigrations` state as production before running.
- **Dependencies:** Phase C passed clean.
- **Verification:** full checklist (§15) run against staging.
- **Rollback:** staging database reset/recreated from a pre-import snapshot — cheap, do this
  freely if anything looks wrong rather than trying to patch staging in place.

### Phase E — Production cutover
- **Objective:** The real, one-time import against fitforce.app's production database.
- **Tables involved:** all, per the dependency order in §5.
- **Risks:** every risk in §4, now with real consequences — this is why Phases A–D exist.
- **Dependencies:** Phase D clean; maintenance window scheduled; schedulers pausable (§9);
  fresh full backup of fitforce.app's production DB taken and verified restorable immediately
  before starting (never skip this even though fitforce.app is the *target*, not the source —
  a bad import is still a bad write against production).
- **Verification:** full checklist (§15) run against production; resume schedulers and confirm
  the first tick of each completes cleanly.
- **Rollback:** §13's procedure, using the run's own `migration_id_map` entries.

### Phase F — Communication & decommission of fitforce.io
- **Objective:** Confirm zero critical issues over an observation window, then retire
  fitforce.io per `docs/MigrationStrategy.md`'s existing Phase 4/5 communication templates and
  decommission checklist (still valid, reuse as-is).
- **Tables involved:** none (operational, not data).
- **Risks:** decommissioning too early if an issue surfaces late — keep fitforce.io's database
  (read-only, already true throughout) available for at least 30 days per the existing plan.
- **Dependencies:** Phase E stable.
- **Verification:** the existing plan's post-cutover monitoring list.
- **Rollback:** N/A — by this phase, "rollback" means re-enabling fitforce.io traffic, not
  undoing the data import, and that path stays open until actual decommission per the existing
  plan's own rule ("never decommission it early, even if everything looks fine").

---

## 17. Appendix — Full fitforce.io Table Inventory & Disposition

| Table | Rows | Disposition |
|---|---|---|
| `Workspace` | 181 | Migrate → `workspaces` (§6.1) |
| `WorkspaceMember` | 187 | Migrate → `workspace_members` |
| `User` | 2,549 | Migrate → `users` (§6.2 collision handling) |
| `UserSession` | 527 | **Skip** — ephemeral auth state, never migrated (§9) |
| `PasswordResetToken` | 154 | **Skip** — ephemeral, security-sensitive |
| `Client` | 2,345 | Migrate → `clients` (§4.3 NOT NULL email policy) |
| `ClientInvitation` | 0 | Skip — empty |
| `ClientAttachment` | 3 | **No destination table** — export-only (§3.2) |
| `ClientObservation` | 5 | Migrate → `client_observations` (field reshape, §3.2) |
| `ClientPackage` | 187 | Reconcile into `packages`/`package_variations`/`transactions` per workspace (§6.4) |
| `ClientPackageTemplate` | 3 | Same treatment as `ClientPackage` |
| `WorkspacePackage` | 13 | **Do not insert** — name-match to existing `plans` (§6.4) |
| `WorkspaceSubscription` | 214 | Migrate → `workspace_subscriptions`, `plan_id` via §6.4 mapping |
| `WorkspacePayment` | 233 | Migrate → `workspace_payments`, same mapping |
| `Subscription` | 2,478 | Migrate → client-level subscription state (`clients.subscription_status`, `subscription_freezes`) |
| `Payment` | 2,497 | Migrate → `transactions` |
| `FormTemplate` | 127 | Migrate → `forms`+`form_versions`+`form_version_questions` (§10) |
| `FormSubmission` | 7,567 | Migrate → `form_requests`+`form_responses` (§10) |
| `DefaultFormTemplate` | 0 | Skip — empty, and no master-forms concept existed on old anyway |
| `Thread` | 251 | Migrate → `threads` (§11) |
| `Message` | 502 | Migrate → `messages` (§11) |
| `Notification` | 36,562 | Migrate **subset** per retention policy (§4.6) |
| `AuditLog` | 4,417 | Migrate rows with non-null `workspaceId` → `workspace_audit_log`; drop platform-wide (`workspaceId IS NULL`) rows |
| `Exercise` | 82,084 | Migrate → `exercise_library` (per-workspace, §6.6) |
| `DefaultExercise` | 1,494 | Reconcile-by-name into `master_exercise_library` (§6.6) — do not bulk-insert |
| `FoodItem` | 28,197 | Migrate → `food_items` (per-workspace, §6.6) |
| `DefaultFoodItem` | 151 | Reconcile-by-name into `master_food_items` (§6.6) |
| `NutritionPlan`/`Day`/`DayItem`/`Item` | 2,023 / 2,038 / 9,860 / 1,206 | Migrate → `nutrition_plans`→`nutrition_cycles`→`nutrition_meals`→`nutrition_meal_items` (§3.1 — verify day/item semantics against real rows first) |
| `MealFoodItem` | 29,209 | Migrate as part of the nutrition-plan transform above |
| `WorkoutPlan`/`Day`/`DayItem`/`Item`/`Set` | 2,244 / 14,108 / 81,258 / 207 / 160,060 | Migrate → `training_plans`→`training_days`→`training_exercises`→`training_sets` |
| `WorkoutLog` | 5,530 | Migrate → `workout_logs` |
| `FoodItemReplacement`/`FoodReplacementHistory`/`FoodReplacementRequest`/`NutritionReplacementRequest`/`NutritionReplacementTemplate`/`ReplacementTemplate` | 3 / 2 / 95 / 403 / 0 / 1 | **Export-only** — no destination tables exist yet (§3.1) |
| `PdfTemplate` | 18 | Export-only — no compatible destination (§3.1) |
| `VisualPdfTemplate` | 16 | Export-only |
| `CaDay` | 0 | Skip — empty |
| `Recipe` | 1 | Export-only / manual re-entry — feature not present in new schema |
| `TutorialVideo` | 2 | Manual recreation (admin content, not customer data) |
| `PromoCode`/`PromoCodeUsage`/`PromoCommission`/`PromoCommissionCredit`/`PromoDiscount` | 13/3/3/0/3 | **Export-only snapshot**, per existing `docs/MigrationGapAnalysis.md` P3-6 guidance — not live-migrated |
| `Ticket`/`TicketMessage`/`TicketActivity`/`TicketCategory` | 0/0/0/0 | Skip — empty, and no destination table exists |
| `AdminUser`/`AdminRole`/`AdminPermission`/`AdminRolePermission`/`AdminUserRole`/`AdminSession`/`AdminMfa`/`AdminTrustedDevice`/`AdminIpAllowlist`/`AdminApiKey` | 1/… | **Do not migrate** — manual recreation only (§4.9) |
| `Role`/`RolePermission`/`Permission` | 726/10,822/26 | **Do not migrate** — fitforce.app's `workspace_members.permissions` is a per-member JSON blob, not a role-graph table; this is a full remodel, not a row-for-row transform. Requires its own design pass, out of scope here. |
| `Invitation` | 16 | Migrate → `workspace_invitations` if still pending/unexpired; expired invitations are noise, drop |
| `AppConfig`/`Announcement`/`MetaIntegrationConfig` | 1/1/1 | **Never migrate** — platform singletons, would overwrite fitforce.app's own live config (§3.1) |
| `QueueItem`/`TemplateAsset` | 0/0 | Skip — empty |
| `VisitAnalytics`/`VisitSession` | 2,082,739 / 63,603 | **Skip** — analytics/ops data, no destination, no product value in a customer-data migration |
| `SystemLog` | large (not restorable in this analysis) | **Skip** — ops log, not business data |
| `_prisma_migrations` | 58 | N/A — tooling metadata, not migrated |

---

## 18. Summary of what this document adds beyond the existing migration docs

`docs/MigrationGapAnalysis.md` and `docs/MigrationStrategy.md` already closed the **feature
parity** question (does fitforce.app do everything fitforce.io does) and laid out a sound
phased **cutover** process (staging → shadow mode → gradual workspace cutover → final
cutover). Both remain valid and this document doesn't replace them.

What's new here, because the situation has moved on since those were written — fitforce.app now
has real, organic production data of its own — is everything the old plan couldn't have
anticipated: a real compatibility diff built from the actual snapshot DDL (§3), the correction
that this is mostly a unique-constraint problem across disjoint tenants rather than a
duplicate-detection problem (§0, §6), the one genuine duplication case and its decision tree
(§6.2), the Forms Versioning transform (§10, the largest single piece of new transform logic
required), and a validation/rollback plan sized to this dataset's actual, small, fully-humanly-
reviewable scale (§14–§15) rather than a generic "spot-check 5-10 rows" approach.
