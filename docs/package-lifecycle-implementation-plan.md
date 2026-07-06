# Package Lifecycle — Implementation Plan

**Status:** Draft for team execution · **Scope:** Server (`server/`) + Client (`client/`) · **Type:** Architecture RFC + phased build plan
**Owner input:** Product vision (below) · **Prior art:** Package Lifecycle Roadmap (previous session) · **Grounding:** Current codebase, cited by file:line throughout

This document is the single source of truth for implementing Packages as the central configuration point for a client's lifecycle. It supersedes the prior roadmap conversation — where this document and that roadmap disagree, this document wins. No code has been changed to produce this document; every claim about "today's behavior" is a citation, not a guess.

---

## Table of contents

1. [Vision comparison](#1-vision-comparison) — each product idea vs. the architecture
2. [Architecture review](#2-architecture-review) — challenging the prior roadmap
3. [Final architecture](#3-final-architecture) — the official design
4. [Phase-by-phase action plan](#4-phase-by-phase-action-plan)
5. [UI planning](#5-ui-planning) — screen by screen
6. [Business logic](#6-business-logic) — deterministic rules
7. [Edge cases](#7-edge-cases)
8. [Future enhancements](#8-future-enhancements-out-of-scope) — explicitly out of MVP
9. [Final review](#9-final-review) — open questions, decisions, risks, milestones

---

## 1. Vision comparison

Each paragraph of the original vision, mapped to the architecture.

### 1.1 "Coach should define subscription policy when creating or editing a package"

| | |
|---|---|
| **Current state** | `subscription_access_policies` (`schema.prisma:534-557`) already models per-package overrides of 10 portal permission flags across `expired`/`frozen` scopes. The **Edit** Package modal already embeds `PackagePolicyOverride` (`packages/page.js:699`), which loads/saves via `GET`/`PUT /api/subscription-policies/packages/:packageId`. |
| **Gap found** | The policy editor is **only reachable after the package already exists** — the **Create** Package modal (`packages/page.js:532-617`) has no policy section at all, because `PackagePolicyOverride` needs a real `packageId` to call its API. A coach must create the package, close the modal, reopen it in edit mode, and set the policy in a second pass. This directly contradicts "when creating **or** editing." |
| **Verdict** | **Partially covered, needs a fix — not a redesign.** The backend and the override component are correct and reusable as-is. This is a create-flow sequencing problem, solved in [Phase 1](#phase-1--package-configuration-surface). |
| **Recommendation** | Create the package record first (silently, on first "Next"/blur, or via a two-step submit), then render the same `PackagePolicyOverride` inline before the modal's final "Create" button — see [§5.1](#51-finance--packages-page). |

### 1.2 "Default Assessment Forms" — prefill on Add Subscription

| | |
|---|---|
| **Current state** | The add-client wizard's "assign forms" step (`clients/page.js:151-426`) is a fully independent multi-select (`selectedForms`) with zero relationship to the chosen package. Package selection in the same wizard is a free-text label (`packageOptions`, `clients/page.js:213-221`) fed to `POST /api/transactions` — not even an id. |
| **Gap found** | No `package → default forms` relationship exists anywhere in the schema. |
| **Verdict** | **Not covered — net-new, but the wizard's shape doesn't need to change.** The forms step already exists exactly where the vision wants the prefill to appear; it just needs a data source. |
| **Recommendation** | New `package_default_forms` join table (kind=`assessment`) + one `useEffect` in the wizard that seeds `selectedForms` when a package is chosen, without touching the step structure. See [Phase 1](#phase-1--package-configuration-surface) and [Phase 2](#phase-2--wizard-integration). |

### 1.3 "Default Check-in Forms" — Activate Plan modal asks Duration + Check-in Forms, prefilled from package

| | |
|---|---|
| **Current state** | Nutrition and Training both already have an **Activate Plan modal** (`MiddlePanel.js:397-410` for nutrition; the training builder mirrors it) — but today it is a bare confirmation dialog ("Activate & Mark as Done") that only appears when the plan originated from a form submission, purely to close the loop on that submission. It has no duration field and no check-in selector. |
| **Gap found** | (a) No plan has a duration/end-date field at all — `nutrition_plans`/`training_plans` only carry `status` + `activated_at` (`schema.prisma:490,776`). (b) No check-in cadence concept exists — `form_requests` is a one-off row with a single `scheduled_at` (`schema.prisma:350-370`); there is no recurrence field anywhere. |
| **Verdict** | **Not covered — this is the largest net-new piece of the whole initiative**, and it collides with an existing modal that serves a different purpose. |
| **Recommendation** | Don't repurpose the existing "Mark as Done" modal — it has a narrow, correct job tied to form-submission review. Add a **new** "Configure Activation" modal that runs immediately before it (or standalone, when there's no submission to close), pre-filled from the package's `nutrition_cycle_days`/`training_cycle_days` and default check-in forms, editable, and it is this modal's submission that actually calls `POST /plans/:id/activate` with the resolved duration + check-in selection. See [Phase 3](#phase-3--plan-lifecycle-engine) and [§5.3](#53-nutrition-builder)/[§5.4](#54-training-builder). This is called out explicitly as [Architectural Decision AD-3](#93-architectural-decisions). |

### 1.4 "After duration ends, client automatically receives scheduled check-in forms and notifications"

| | |
|---|---|
| **Current state** | An hourly cron (`scheduleFormDispatcher`, `middleware/scheduler.ts:14-37`) already flips one-off `form_requests` from `pending`→`sent` at their `scheduled_at` time. `recordEvent()` (`lib/events.ts`) is already the single notification choke point, with an established `checkin.*`/`plan.*` event-key namespace (`checkin.submitted`, `checkin.reviewed`, `checkin.assigned`, `plan.assigned` — confirmed live in `forms.controller.ts:507-573`, `nutrition.controller.ts:550-556`). |
| **Gap found** | Nothing recurring exists. "After duration ends" implies a repeating schedule, which needs a new model. |
| **Verdict** | **Not covered, but the delivery mechanism is 90% reusable.** The scheduler pattern, the notification chokepoint, and the event-key vocabulary all extend cleanly — this is new data (a schedule row) driving old machinery (cron tick → `form_requests` row → `recordEvent`), not a new pipeline. |
| **Recommendation** | New `check_in_schedules` table + one new cron function following the exact try/catch-per-tick pattern every existing job in `scheduler.ts` already uses. New event keys `checkin.requested` (client-facing) and `plan.review_due` (coach-facing), consistent with the existing namespace. See [Phase 4](#phase-4--scheduled-check-ins--review-workflow). |

### 1.5 "Nutrition and Training builders should display Remaining days / Activation date / End date"

| | |
|---|---|
| **Current state** | Neither builder shows any of this — there's no data to show yet (no duration/end-date fields exist). |
| **Gap found** | Straightforward once [Phase 3](#phase-3--plan-lifecycle-engine)'s `cycle_end_at` field exists — this is a read-only header addition, not new logic. |
| **Verdict** | **Not covered today; trivial once Phase 3 lands.** |
| **Recommendation** | A small stat row in the builder's plan header (`LeftPanel.js` for both nutrition and training) computing `remaining = cycle_end_at - today` client-side from the already-fetched plan record. No new endpoint needed. See [§5.3](#53-nutrition-builder)/[§5.4](#54-training-builder). |

### 1.6 "If an active plan is edited, ask: Continue remaining duration OR Restart plan duration. Restarting changes the scheduled review date."

| | |
|---|---|
| **Current state** | The shared `activateSinglePlan()` helper (`lib/planEngine.ts:92-129`) uses `activated_at = COALESCE(activated_at, NOW())` — written with the clear *intent* to preserve the original activation date across re-saves. But the actual save path (`saveSinglePlanDraft`, same file, `:144-197`) deletes the plan row and every child row, then re-inserts; `loadExistingPlan` in both `nutrition.controller.ts` and `training.controller.ts` selects only `id, created_at, created_by` — **never `activated_at`** — so the fresh row starts `NULL` and the COALESCE always resolves to "now." |
| **Gap found** | Two, layered: (1) no duration field to restart-or-continue *from* yet (same root gap as §1.3); (2) a **pre-existing latent bug** — today, every edit-and-save of an active plan silently resets its activation clock, regardless of intent. This isn't a difference of opinion with the prior roadmap; it's an observable defect in shipped code. |
| **Verdict** | **Not covered — and building this feature correctly requires fixing the bug in (2) as a side effect**, because "continue remaining duration" cannot work while `activated_at` is silently reset on every save. |
| **Recommendation** | Prompt the coach only when editing a plan that is currently `active` (a no-op prompt otherwise); the prompt's answer selects between the `extend` and `restart` code paths added in Phase 3, which also fix `loadExistingPlan` to actually read forward the prior `activated_at`/`cycle_end_at`. See [Phase 3](#phase-3--plan-lifecycle-engine) and [Business Logic §6.4–6.5](#6-business-logic). |

### 1.7 Summary table

| Vision item | Covered today? | Where it lands |
|---|---|---|
| Policy at package create/edit | Partially (edit only) | Phase 1 |
| Default assessment forms | No | Phase 1 + 2 |
| Default check-in forms + Activate modal | No | Phase 1 + 3 |
| Auto check-ins + notifications after duration | No (scheduler/notification plumbing reusable) | Phase 4 |
| Builder header: remaining/activation/end date | No | Phase 3 |
| Restart vs. extend prompt | No (and fixes a live bug) | Phase 3 |

---

## 2. Architecture review

Challenging the prior roadmap's decisions before finalizing. Each item below is a **decision**, not a restatement.

### 2.1 Kept as-is (validated, not re-litigated)

- **FK the package relationship first** (`transactions.package_variation_id`, `clients.current_package_variation_id`). This remains Phase 0/1's foundation — nothing else can be built on a string match. Confirmed still correct after re-reading `subscriptionPolicies.service.ts:181-195`'s own `DEBT` comment.
- **Reuse `subscription_access_policies` unchanged.** It is already package-scoped, already has the override/global fallback semantics needed. No schema change to this table.
- **Reuse `computeSubscriptionDetails`/the period-chaining engine unchanged.** It correctly handles freezes as period extensions; the plan-lifecycle engine in Phase 3 should mirror its arithmetic pattern rather than diverge.
- **Reuse `recordEvent()` and the hourly cron pattern.** Confirmed against five real call sites across `forms`, `nutrition`, `training`, `clientPortal`, and `messenger` controllers — this is a stable, load-bearing convention, not incidental.

### 2.2 Changed from the prior roadmap

| Prior roadmap said | This document says instead | Why |
|---|---|---|
| Policy config is "already correct, nothing to do" | Policy config has a **live UX gap**: create-modal doesn't expose it | Verified directly against `packages/page.js` — the prior roadmap analyzed the *data model* (correct) but not the *entry points* (incomplete). Folded into Phase 1. |
| New "Activate Plan" modal implied as the only activation UI | There are now **two** modals in sequence: the existing "Mark as Done" confirmation (submission-linked) and the new "Configure Activation" modal (duration + check-ins) | Found a real, already-shipped modal with a narrow, different purpose (`MiddlePanel.js:397-410`). Conflating them would either break the submission-review flow or force duration/check-in fields into a dialog that fires conditionally. Kept as two single-responsibility modals — see [AD-3](#93-architectural-decisions). |
| Package defaults keyed loosely between "package" and "package variation" | **All plan/form defaults are keyed on `package_variation_id`**, not `package_id`. Only the *policy* stays keyed on `package_id`. | A package (e.g. "Shred") can have variations of very different lengths (4-week vs. 12-week) — cycle length and check-in cadence are properties of the *variation* (which already owns `duration`), not the parent package. Policy, by contrast, is a coarser "what can an expired/frozen client do" concern that reasonably applies to the whole package family. This wasn't made explicit before. |
| `plan_update_mode` defaults to "extend" | Confirmed, but now explicit that **this is a per-package-variation default, always overridable per activation** via the new modal (§1.6) — not a fire-and-forget config | The product vision asks the coach at the moment of editing, every time. A silent default alone doesn't satisfy "ask the coach." Phase 3 now requires the modal prompt as a hard business rule ([§6.5](#6-business-logic)), not just a config field. |
| Check-in schedule seeded once at subscription start | Check-in schedule is **re-seeded at each plan activation**, sourced from whatever the coach confirms in the Configure Activation modal (which may differ from the package default) | The vision explicitly says the modal's check-in selection is what's prefilled *and editable* per activation — the schedule must reflect the coach's actual choice for *this* activation, not a workspace-wide package snapshot taken once. |
| No explicit mention of what happens to in-flight `check_in_schedules` when a plan is edited (restart vs. extend) | **Restart** resets the schedule's `next_due_at` to `activated_at(new) + interval_days`; **extend** leaves `next_due_at` untouched | Missing business rule in the prior roadmap — added in [§6.9](#6-business-logic). |

### 2.3 Simplifications applied

- **No new "plan_cycles" abstraction.** The prior roadmap considered whether nutrition/training needed a shared cycle-length concept beyond a single `cycle_end_at` column. Rejected: `nutrition_cycles`/training's day-structure already mean something different (macro targets / workout structure) in this codebase, and overloading that word would confuse two unrelated concepts. `cycle_end_at` and `cycle_days` live directly on `nutrition_plans`/`training_plans`, no intermediate table.
- **No new generic "package snapshot" table.** Considered snapshotting the entire resolved package config onto the client at subscription time (a full JSON blob). Rejected in favor of the narrower, already-established pattern this codebase uses for transactions: `transactions.duration` already snapshots the variation's duration at purchase time without a general snapshot mechanism. Each new "default-derived" record (a plan's `cycle_days`, a `check_in_schedules` row) independently snapshots only the one number it needs, at the moment it needs it. Simpler, consistent with existing precedent, and avoids a speculative generic mechanism nothing else asks for.
- **`package_default_forms.interval_days` lives on the join row, not a separate schedule-template table.** A dedicated "schedule template" model was considered and rejected as premature — the join table already scopes cleanly to `(package_variation, form, kind)`, and `check_in_schedules` (client-level, Phase 4) is the only place recurrence actually executes.

### 2.4 Missing pieces the prior roadmap didn't call out — now added

- **Missing UX:** the create-vs-edit policy gap (§1.1/§2.2), and the two-modal sequencing for activation (§1.3/§2.2).
- **Missing business rule:** what "extend" means for `check_in_schedules`, not just for the plan's own dates (§2.2, §6.9).
- **Missing permission consideration:** the Configure Activation modal must respect the same identity/authorization split as everything else — only a coach with `training.write`/`nutrition.write` (whichever the workspace already uses for plan mutation) can choose "restart," since it has a client-visible consequence (a pushed-back review date). Added as a business rule, not a new permission key — reuses whatever guard already protects `POST /plans/:id/activate`.
- **Missing notification:** a **client-facing** notice when a coach chooses "restart" on their active plan, since it silently changes their review timeline — the client should not have to discover this from the portal UI alone. Added to [Phase 4](#phase-4--scheduled-check-ins--review-workflow)/[§6.10](#6-business-logic).
- **Missing migration consideration:** existing *active* plans, at the moment Phase 3 ships, have no `cycle_days`/`cycle_end_at`. The prior roadmap allowed this to stay `NULL` indefinitely. This document adds an explicit, optional one-time backfill *and* a rule for what the builder displays when both are `NULL` (§6.6, §7).

---

## 3. Final architecture

### 3.1 Executive summary

Today, a **Package** is pricing metadata — a name, one or more priced/duration'd variations — connected to a client only by matching text strings in a `transactions` table. Every other lifecycle concern (portal permissions after expiry, which forms a new client gets, how long a nutrition/training plan runs, when a check-in is due) is either manually configured per client or doesn't exist as a concept at all.

This plan turns Package into the **configuration root** for those concerns, without discarding anything that works. Two systems are already correctly built and package-aware — the portal permission engine (`subscription_access_policies`) and the subscription-period engine (`computeSubscriptionDetails`) — and are reused untouched. Three things are genuinely new: a real foreign key from client to package variation, a set of default-value fields/tables on the package variation, and a plan-lifecycle engine (duration, restart/extend, recurring check-ins) that does not exist in any form today.

### 3.2 Product vision (restated, unambiguous)

> A coach configures, once, on the Package: the portal permission policy for expired/frozen clients, the default assessment forms for new clients on this variation, the default check-in forms and cadence, and the default plan cycle length. When a coach creates a client and picks this package, the assessment forms are pre-selected (editable). When a coach activates a nutrition or training plan for a client on this package, a modal pre-fills the plan's duration and check-in forms from the package (editable) before activation proceeds. Once activated, the plan's remaining days/activation date/end date are visible in the builder, and check-ins fire automatically and on schedule until the plan ends. If the coach edits an already-active plan, they are asked whether to keep the existing end date (and check-in schedule) or restart both from today.

### 3.3 Current architecture (as of this document)

```
┌─────────────┐        text match        ┌──────────────┐
│   clients   │ ───────────────────────▶ │package_       │
│ current_    │   (current_package ==    │variations     │
│ package:str │    variation.name)       │(duration,     │
└─────────────┘                          │ price)        │
      │                                  └──────────────┘
      │ subscription_status: string             │
      ▼ (recomputed daily by scheduler)          │ package_id
┌──────────────────┐                             ▼
│  transactions     │                     ┌──────────────┐
│ package_variation: │                    │  packages     │
│  string, duration,│                     └──────────────┘
│  start_mode        │                             │ package_id (nullable)
└──────────────────┘                               ▼
      │                                   ┌──────────────────────────┐
      │  feeds                           │subscription_access_       │
      ▼                                  │policies (expired/frozen)  │
┌─────────────────────────┐              └──────────────────────────┘
│ computeSubscriptionDetails│                       ▲
│ (Active/Frozen/Expired)  │──────────────resolveClientPackageId()
└─────────────────────────┘               (name-match — the one gap)

┌───────────────┐        independent, unlinked        ┌───────────────┐
│  nutrition_    │                                     │ form_requests  │
│  plans /       │   status + activated_at only.       │ one-off,       │
│  training_plans│   no duration, no end date.          │ single         │
└───────────────┘                                       │ scheduled_at   │
                                                          └───────────────┘
```

### 3.4 Target architecture

```
                         ┌─────────────────────────────┐
                         │        packages              │
                         │  (name, active)               │
                         └──────────────┬────────────────┘
                                        │ 1:N
                         ┌──────────────▼────────────────┐
                         │    package_variations           │
                         │  duration, price,               │
                         │  nutrition_cycle_days,          │
                         │  training_cycle_days,           │
                         │  review_offset_days,            │
                         │  plan_update_mode                │
                         └───┬─────────────┬───────────────┘
                             │ 1:N          │ FK (new)
              ┌──────────────▼──┐    ┌──────▼─────────────────┐
              │package_default_  │    │ transactions             │
              │forms (assessment/│    │ package_variation_id     │
              │checkin, interval)│    │ (+ legacy string kept)   │
              └──────────────────┘    └──────┬───────────────────┘
                                              │ syncs
                                       ┌──────▼───────────────────┐
                                       │ clients                    │
                                       │ current_package_variation_id│
                                       │ (+ legacy string kept)      │
                                       └──────┬────────────────────┘
                                              │ FK read directly (no name-match)
                              ┌───────────────▼────────────────────┐
                              │ subscription_access_policies (unchanged)│
                              └─────────────────────────────────────┘

  client creation wizard ── seeds ──▶ selectedForms (from package_default_forms, kind=assessment)

  plan activation modal ── seeds ──▶ cycle_days, check-in form ids (from package_variation +
                                       package_default_forms kind=checkin) ── coach edits ──▶
                                       nutrition_plans/training_plans.cycle_days, cycle_end_at
                                       + check_in_schedules rows

  scheduler (existing cron) ── extended ──▶ dispatches check_in_schedules → form_requests
                                              → recordEvent() (existing chokepoint)
                                              → notifications (existing table/bell)
```

### 3.5 Core concepts

| Concept | Definition | Lives in |
|---|---|---|
| **Package** | A named product family a workspace sells (e.g. "Shred Program"). Holds the portal-permission policy (via override) and groups variations. | `packages` |
| **Package Variation** | A specific priced, duration'd offering within a package (e.g. "Shred — 12 Weeks"). Owns the defaults: assessment/check-in forms, cycle lengths, review offset, update mode. This is what a client is actually subscribed to. | `package_variations` |
| **Subscription** | Not a standalone table — a *derived* concept computed from the chain of `transactions` (+ `subscription_freezes`) for a client, exactly as today. A client "has" a package variation via `current_package_variation_id`; their subscription *status* (Active/Frozen/Expired/Pre-start) is computed, never stored as ground truth. | `transactions`, `clients`, `computeSubscriptionDetails` |
| **Package Defaults** | The set of values a package variation proposes when a coach takes an action (create client → forms; activate plan → duration + check-ins). Defaults are copied at the moment of action — never read live afterward. | `package_default_forms`, `package_variations.*_days` |
| **Package Automation** | What runs without a human clicking anything once defaults are accepted: the recurring check-in dispatch and the review-due notification. | `check_in_schedules`, extended `scheduler.ts` |
| **Portal Permissions** | The 10 boolean flags a client's portal enforces once Expired/Frozen, resolved package-override-first, global-fallback-second. Unchanged by this initiative except for how the package is looked up. | `subscription_access_policies`, `getEffectiveAccessForClient()` |
| **Plan Lifecycle** | The state a nutrition/training plan moves through: `draft` → `active` (with `activated_at`, `cycle_days`, `cycle_end_at`) → edited (`extend` keeps dates, `restart` resets them) → naturally ends at `cycle_end_at`. | `nutrition_plans`/`training_plans`, `lib/planEngine.ts` |
| **Scheduled Check-ins** | Per-client, per-form recurring dispatch rows seeded at plan activation from the coach's confirmed selection, ticked by a cron extension. | `check_in_schedules` |
| **Review Workflow** | The coach-facing notice that a plan is approaching its `cycle_end_at` (offset by `review_offset_days`), prompting a proactive check-in/renewal conversation before the plan silently lapses. | `plan.review_due` event via `recordEvent()` |

**How they interact (single narrative):** A coach configures a **Package Variation**'s **Package Defaults** once. A client subscribes to that variation (**Subscription**, computed from transactions as today). Creating the client seeds assessment forms from the defaults. Activating a plan opens a modal seeded from the same defaults, producing a **Plan Lifecycle** record with real dates and, in parallel, one or more **Scheduled Check-ins** rows. **Package Automation** (the extended scheduler) ticks those rows forward, dispatching forms and firing the **Review Workflow** notice as `cycle_end_at` approaches — all through the existing `recordEvent()`/notifications pipeline. **Portal Permissions** remain a separate, already-correct concern that only needs the FK fix to resolve the right package.

---

## 4. Phase-by-phase action plan

Six phases. Each is independently shippable and independently revertible. Recommended order is given in [§9.7](#9-final-review); phases are numbered for reference, not strict chronology.

### Phase 0 — Data model foundation

#### Objective
Replace the name-matching between a client's subscription and `package_variations` with a real foreign key.

#### Why this phase exists
Every later phase needs to answer "which package variation is this client actually on" reliably. Today that answer is a string comparison the codebase's own comments flag as debt (`subscriptionPolicies.service.ts:189`). Nothing else can be correctly package-driven until this is fixed.

#### Database changes
```sql
ALTER TABLE transactions ADD COLUMN package_variation_id TEXT NULL
  REFERENCES package_variations(id) ON DELETE SET NULL;
CREATE INDEX idx_transactions_package_variation ON transactions(package_variation_id);

ALTER TABLE clients ADD COLUMN current_package_variation_id TEXT NULL
  REFERENCES package_variations(id) ON DELETE SET NULL;
CREATE INDEX idx_clients_current_package_variation ON clients(current_package_variation_id);
```
The existing `transactions.package_variation` (string) and `clients.current_package` (string) columns are **kept, untouched** — they remain the historical/display snapshot. The FK is the new authoritative reference.

#### Backend changes
- `transactions.controller.ts`: `createTransaction`/`updateTransaction` accept optional `packageVariationId`; when present, look up the row server-side and derive `amount`/`currency`/`duration`/`package_variation` (the label) from the database instead of trusting client-supplied values (closes a quiet trust gap while touching this code — see [AD-1](#93-architectural-decisions)).
- `syncClientPackage()` (`transactions.controller.ts:128-141`) additionally writes `current_package_variation_id`.
- `subscriptionPolicies.service.ts`: `resolveClientPackageId()` re-implemented to read `clients.current_package_variation_id → package_variations.package_id` directly. Delete the `DEBT` comment along with the code it describes.

#### Frontend changes
- `clients/page.js` wizard: `packageOptions` (`:213-221`) already derives from the real `/api/packages` payload — add the variation's `id` to each option and send it as `packageVariationId` in the `POST /api/transactions` call (`:399-413`), alongside the existing label. No visible UI change this phase.

#### API changes
- `POST/PUT /api/transactions`: new optional field `packageVariationId` (string). Backward compatible — omitting it behaves exactly as today.

#### Scheduler changes
None this phase.

#### Notification changes
None this phase.

#### Business rules
- The FK is authoritative going forward; the string is cosmetic/historical only and must never be parsed again by application logic.
- Deleting a package/variation must never cascade-delete transactions or clients — `ON DELETE SET NULL` only.
- A `NULL` FK (unmatched backfill, or a client who transacted before this phase) falls back to workspace-global policy — identical to today's effective behavior for those clients.

#### UX changes
None visible this phase — purely structural.

#### HeroUI changes
None.

#### Files likely to change
```
server/prisma/schema.prisma
server/prisma/migrations/<new>/migration.sql
server/src/modules/transactions/transactions.controller.ts
server/src/modules/subscriptionPolicies/subscriptionPolicies.service.ts
client/app/(coach)/[workspaceSlug]/clients/page.js
```

#### Dependencies
None — this is the foundation phase.

#### Risks
| Risk | Mitigation |
|---|---|
| Backfill matches the wrong variation where names collide across packages in the same workspace | Log every ambiguous match for manual review; do not block migration completion on it (§7) |
| `resolveClientPackageId` rewrite changes effective policy for some client due to a subtle behavior difference | Verification step below diffs old vs. new resolution for every client before cutover |

#### Rollback strategy
Both new columns are additive and nullable. Rollback = stop writing to them (revert the two controller changes) and drop the columns in a follow-up migration if needed; no data loss to existing string columns. The `resolveClientPackageId` rewrite can be reverted independently by restoring the name-match implementation — it's a single function.

#### Verification checklist
- [ ] Migration applies cleanly on a fresh DB and on a copy of production data.
- [ ] Backfill dry-run: for every client with a resolvable `current_package`, the derived `package_id` via the new FK path matches the `package_id` the *old* `resolveClientPackageId()` returned, 1:1.
- [ ] Unmatched-row report generated and reviewed (renamed/deleted variations, typos).
- [ ] `npm run build` (server) passes with `noEmitOnError`.

#### Manual QA checklist
- [ ] Create a client through the real wizard with a package selected; inspect the created `transactions` row — `package_variation_id` is populated.
- [ ] Delete a package variation that has an existing client on it; load that client's portal — access still resolves (falls back to global policy), no 500.
- [ ] Edit an existing transaction's package variation via the Transactions page; confirm `current_package_variation_id` updates on the client.

#### Acceptance criteria
Every active client's effective portal-permission resolution is unchanged after this phase ships, verified by an automated before/after diff — this phase must be a no-behavior-change refactor from the user's point of view.

---

### Phase 1 — Package configuration surface

#### Objective
Give package variations the default-value fields the rest of the system will read, and close the create-vs-edit policy gap identified in §1.1.

#### Why this phase exists
Phases 2–4 need somewhere to read defaults *from*. This phase builds that surface and fixes the one concrete, already-shipped UX gap in the existing policy editor.

#### Database changes
```sql
ALTER TABLE package_variations
  ADD COLUMN nutrition_cycle_days INT NULL,
  ADD COLUMN training_cycle_days INT NULL,
  ADD COLUMN review_offset_days  INT NULL,
  ADD COLUMN plan_update_mode    TEXT NOT NULL DEFAULT 'extend'
    CHECK (plan_update_mode IN ('restart', 'extend'));

CREATE TABLE package_default_forms (
  id                    TEXT PRIMARY KEY,
  package_variation_id  TEXT NOT NULL REFERENCES package_variations(id) ON DELETE CASCADE,
  form_id               TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  kind                  TEXT NOT NULL CHECK (kind IN ('assessment', 'checkin')),
  interval_days         INT NULL, -- required when kind = 'checkin', ignored otherwise
  sort_order            INT NOT NULL DEFAULT 1,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_pkg_default_forms_variation ON package_default_forms(package_variation_id);
CREATE INDEX idx_pkg_default_forms_form ON package_default_forms(form_id);
```
`subscription_access_policies` — **no schema change.**

#### Backend changes
- `packages.controller.ts`: `createPackage`/`updatePackage` accept the new variation fields and a `defaultForms: [{ formId, kind, intervalDays? }]` array per variation, written inside the same `$transaction` that already writes variations (`packages.controller.ts:30-63`, `:75-113`).
- `packages.serializer.ts`: include the new fields + resolved form titles in the payload (avoids a second round trip from the wizard/builder).
- **New endpoint** `POST /api/packages/:id/policy` — not new REST surface, but a **sequencing change**: the Create Package flow now performs `POST /api/packages` (as today) immediately followed by the *existing* `PUT /api/subscription-policies/packages/:packageId` the moment the package id is known, both inside the same modal submission before the modal closes (see [§5.1](#51-finance--packages-page)).

#### Frontend changes
- Packages page (`packages/page.js`): both the **Create Package** modal and the **Edit Package** modal render `PackagePolicyOverride`. In Create mode, the package is created first (on submit of the base fields), then the same override component mounts against the new id, with a final "Done" step — see [AD-2](#93-architectural-decisions) for the exact interaction sequence.
- Variation editor (inside both Create Package and Edit Variation modals): add a multi-select for default assessment forms, a multi-select + interval-days input for check-in forms, two numeric cycle-length inputs (nutrition/training), and a segmented control for restart/extend.

#### API changes
| Endpoint | Change |
|---|---|
| `POST /api/packages` | Body gains `variations[].defaultForms`, `variations[].nutritionCycleDays`, `variations[].trainingCycleDays`, `variations[].reviewOffsetDays`, `variations[].planUpdateMode` |
| `PUT /api/packages` | Same additions |
| `GET /api/packages` | Response includes the new fields + `defaultForms` (with resolved `title_en`/`title_ar`) per variation |

#### Scheduler changes
None this phase.

#### Notification changes
None this phase.

#### Business rules
- Every new field is optional; a package with nothing configured behaves exactly as today.
- `plan_update_mode` defaults to `extend` (least-surprise: an edit shouldn't cost a client days) but is always coach-overridable at the moment of activation (Phase 3) — the package value is a default, not an enforced policy.
- Cycle-length fields are defaults the activation modal pre-fills, not hard caps — a coach can hand-set a different value per activation.
- A form referenced by `package_default_forms` that gets archived/deleted cascades the join row away silently; the package editor surfaces "a linked form was removed" rather than showing a dangling reference.

#### UX changes
See [§5.1](#51-finance--packages-page) for full detail. Summary: Create Package modal grows a policy section (reusing `PackagePolicyOverride`) and a defaults section (new) on each variation card.

#### HeroUI changes
- New: `ListBox`/`ComboBox` multi-select for form pickers (same components already used elsewhere, e.g. `CurrencySelect` in this file already demonstrates the `ComboBox` pattern to copy).
- New: `Switch`/segmented toggle for `plan_update_mode` — reuse the existing `Switch` pattern from `PackagePolicyOverride.js:77-79`.
- Reuse: `TextField`/`Input` for the numeric day fields, identical to the existing duration/price inputs in the same modal.

#### Files likely to change
```
server/prisma/schema.prisma
server/prisma/migrations/<new>/migration.sql
server/src/modules/packages/packages.controller.ts
server/src/modules/packages/packages.serializer.ts
client/app/(coach)/[workspaceSlug]/finance/packages/page.js
client/app/components/PackagePolicyOverride.js  (minor: allow mount before final submit)
client/messages/en.json, ar.json  (new field labels)
```

#### Dependencies
Phase 0 (package variation is the FK target; not strictly required for this phase's schema, but required before Phase 2 can seed anything meaningfully).

#### Risks
| Risk | Mitigation |
|---|---|
| Create-modal two-step submit (package first, then policy) leaves an orphaned package if the coach abandons the modal after step one | Package creation with zero variations/policy is already a valid, harmless state today (a coach can create a bare package); worst case is an unused package row, not corrupted data |
| Multi-select form pickers with many forms become unwieldy | Reuse the existing `SearchField`/filter pattern already on the Packages page (`packages/page.js:759-771`) inside the picker |

#### Rollback strategy
All schema changes are additive/nullable; a revert simply stops the frontend from sending the new fields. `package_default_forms` can be dropped independently without affecting `package_variations`.

#### Verification checklist
- [ ] Configure every new field for a package variation via the real admin UI; reload; every field round-trips exactly (no enum/interval coercion bugs).
- [ ] Delete a form referenced by a package default; confirm the editor reflects the removal, not a dangling id or a crash.
- [ ] Create a brand-new package end-to-end (base fields → policy → defaults) in one modal session; confirm all three land correctly in one flow.

#### Manual QA checklist
- [ ] As a coach, create a package with a policy override and default forms in a single sitting — no page reload required between steps.
- [ ] Edit an existing package's defaults; confirm existing clients on that package are unaffected until their *next* activation/creation event (defaults are not retroactive).

#### Acceptance criteria
A coach can fully configure a package — pricing, policy, default forms, cycle lengths, update mode — without leaving the Packages page or reopening a modal after initial creation.

---

### Phase 2 — Wizard integration

#### Objective
Auto-populate the add-client wizard's forms step from the selected package's assessment-form defaults.

#### Why this phase exists
Directly implements §1.2 — the smallest, most self-contained slice of new user-facing value, and a good place to prove the Phase 1 data shape works end-to-end before the bigger Phase 3 build.

#### Database changes
None.

#### Backend changes
None — `GET /api/packages` (Phase 1) already returns everything needed; `POST /api/forms/requests` already accepts an arbitrary `form_ids` array (`clients/page.js:419-424`), unchanged.

#### Frontend changes
- `clients/page.js`: an `onChange`/`onSelectionChange` handler on the package `Select` (Step 2, "Subscription") looks up the chosen variation's `defaultForms` (kind=`assessment`) from the already-fetched `packages` state and calls `setSelectedForms(ids)`.
- Auto-selected forms are visually tagged (small "from package" badge) in the existing multi-select so the coach understands why items are pre-checked — matches the existing empty-state/tag visual language already in this file (`EmptyStateNote`, `:65-75`).
- Switching packages mid-wizard **adds** the new package's defaults to whatever is already selected; it never removes a form the coach explicitly picked or unchecked.

#### API changes
None.

#### Scheduler changes
None.

#### Notification changes
None — `checkin.assigned`/`plan.assigned`-style events are unaffected; the one-off assessment `form_requests` created here already exist as a code path.

#010 #### Business rules
- Package defaults are a starting point, never enforced — the existing `assignFormsEnabled` toggle (`clients/page.js:163`) still lets a coach opt out entirely.
- Only **assessment**-kind defaults are seeded here. **Check-in**-kind defaults (with `interval_days`) are explicitly out of scope for this phase — they need `check_in_schedules` (Phase 4), not a bigger one-off list, or they'd fire once and never recur.

#### UX changes
See [§5.2](#52-clients--create-client-wizard).

#### HeroUI changes
None new — reuses the existing multi-select exactly as built.

#### Files likely to change
```
client/app/(coach)/[workspaceSlug]/clients/page.js
client/messages/en.json, ar.json  (badge label)
```

#### Dependencies
Phase 1 (needs `defaultForms` in the `/api/packages` payload).

#### Risks
| Risk | Mitigation |
|---|---|
| Coach confusion about why forms are pre-checked | Explicit "from package" tag, not silent |
| Re-selecting the same package re-triggers the seed and duplicates already-selected ids | Seed logic is idempotent — union of ids, not append |

#### Rollback strategy
Single-file frontend change; revert the `onChange` handler to restore fully-manual behavior. No data implication.

#### Verification checklist
- [ ] Configure a package with 2 default assessment forms; run the wizard, select that package, confirm both appear pre-checked.
- [ ] Manually remove one pre-checked form before submitting; confirm only the remaining one is created via `form_requests`.
- [ ] Switch packages mid-wizard after manually adding an unrelated form; confirm the manual addition survives.

#### Manual QA checklist
- [ ] Full wizard run: account → subscription (package + auto-filled forms) → data → review → submit; confirm the created client has exactly the expected `form_requests` rows.
- [ ] "Add subscription" toggle off: forms step behaves exactly as before this phase (fully manual).

#### Acceptance criteria
Selecting a package with configured assessment defaults pre-fills the forms step with zero additional clicks; the coach can still freely add/remove before submit.

---

### Phase 3 — Plan lifecycle engine

#### Objective
Give nutrition/training plans a real duration, an end date, and a deterministic restart-vs-extend behavior on edit — the largest and highest-risk phase, because it touches the shared `planEngine.ts` used by both builders.

#### Why this phase exists
Directly implements §1.3, §1.5, and §1.6. This is the true dependency root for Phase 4 (review timing needs `cycle_end_at`).

#### Database changes
```sql
ALTER TABLE nutrition_plans
  ADD COLUMN cycle_days INT NULL,
  ADD COLUMN cycle_end_at TIMESTAMPTZ NULL,
  ADD COLUMN review_notified_at TIMESTAMPTZ NULL;

ALTER TABLE training_plans
  ADD COLUMN cycle_days INT NULL,
  ADD COLUMN cycle_end_at TIMESTAMPTZ NULL,
  ADD COLUMN review_notified_at TIMESTAMPTZ NULL;
```
`nutrition_cycles`/`training_days` — **unchanged**; these remain macro-target/workout-structure concepts, unrelated to the new time dimension (see [§2.3](#23-simplifications-applied)).

#### Backend changes
`lib/planEngine.ts` — the shared engine both modules call:
```ts
interface ActivateSinglePlanParams {
  // ...existing params
  cycleDays?:            number | null; // resolved by the caller (package default or coach override)
  updateMode?:           'restart' | 'extend';
  previousActivatedAt?:  Date | null;   // read by the caller BEFORE delete+reinsert
  previousCycleEndAt?:   Date | null;
}
```
- `extend`: `activated_at = previousActivatedAt ?? NOW()`; `cycle_end_at = previousCycleEndAt ?? (activated_at + cycleDays)`.
- `restart`: `activated_at = NOW()`; `cycle_end_at = cycleDays ? NOW() + cycleDays : null`.
- **Bug fix included in this phase:** `loadExistingPlan` in both `nutrition.controller.ts` and `training.controller.ts` must additionally select `activated_at, cycle_days, cycle_end_at, review_notified_at` (today it selects only `id, created_at, created_by`) so "extend" has something to read before the old row is deleted. This closes the gap identified in §1.6 as a natural consequence of building the feature correctly — called out explicitly, not silently bundled.
- Freeze interaction: mirror `computeSubscriptionDetails`'s own pattern — if a `subscription_freezes` row starts within `[activated_at, cycle_end_at)`, extend `cycle_end_at` by the freeze duration. One shared arithmetic helper (extracted from `utils/subscriptionStatus.ts`'s freeze-extension logic) used by both the subscription engine and the plan engine, not two divergent copies.

#### Frontend changes
- **New "Configure Activation" modal** (nutrition + training, same component shape, parameterized by module) — fields: Plan Duration (days, pre-filled from `package_variations.nutrition_cycle_days`/`training_cycle_days`), Check-in Forms (multi-select, pre-filled from `package_default_forms` kind=`checkin`). Fires on every activation, **before** the existing "Mark as Done" confirmation when a `submissionId` is present ([AD-3](#93-architectural-decisions)).
- **New "Continue vs. Restart" prompt** — appears only when saving an edit to a plan whose current `status === 'active'`. A simple two-button dialog: "Continue remaining duration" / "Restart plan duration," with a one-line consequence statement ("Restarting sets a new end date of {date} and reschedules check-ins").
- **Builder header** (`LeftPanel.js`, both modules): a small stat row — Activation date, Remaining days (computed client-side from `cycle_end_at - today`), End date — shown only when the plan is active and `cycle_end_at` is non-null; hidden entirely otherwise (see §7 for the null case).

#### API changes
| Endpoint | Change |
|---|---|
| `POST /api/nutrition/plans/:id/activate` / training equivalent | Body gains `cycleDays`, `checkInFormIds: string[]` |
| `POST /api/nutrition/plans/save-draft` (single-plan save) / training equivalent | Body gains `durationChoice?: 'restart' \| 'extend'`, required only when the plan being saved is currently active; ignored otherwise |

#### Scheduler changes
None this phase — `check_in_schedules` rows are *created* here (from the modal's confirmed selection) but *dispatched* in Phase 4.

#### Notification changes
None fired directly by this phase; `review_notified_at` is added now so Phase 4 has an idempotency guard ready to use.

#### Business rules
See [§6.4–§6.7](#6-business-logic) for the full deterministic ruleset. Headline: the restart/extend prompt appears **only** when the plan being saved is currently `active`; a draft or newly-created plan is always "restart" semantics trivially (there's nothing to extend from).

#### UX changes
See [§5.3](#53-nutrition-builder) and [§5.4](#54-training-builder).

#### HeroUI changes
- New modal built from the existing `Modal`/`Modal.Backdrop`/`Modal.Container`/`Modal.Dialog` primitives already used for the "Mark as Done" modal (`MiddlePanel.js:397-410`) — same component family, new content.
- Numeric duration field: reuse `TextField`+`Input type="number"` exactly as used throughout `packages/page.js`.
- Check-in multi-select: reuse the same picker built in Phase 1/2.
- Restart/Extend prompt: reuse `Modal.Footer` two-button layout already established across the app's confirmation dialogs.

#### Files likely to change
```
server/prisma/schema.prisma
server/prisma/migrations/<new>/migration.sql
server/src/lib/planEngine.ts
server/src/modules/nutrition/nutrition.controller.ts
server/src/modules/training/training.controller.ts
client/app/components/nutrition/MiddlePanel.js
client/app/components/nutrition/LeftPanel.js
client/app/components/training/MiddlePanel.js
client/app/components/training/LeftPanel.js
client/app/(coach)/[workspaceSlug]/clients/[id]/nutrition/page.js
client/app/(coach)/[workspaceSlug]/clients/[id]/training/page.js
client/messages/en.json, ar.json
```

#### Dependencies
Phase 0 (package resolution for the client being activated), Phase 1 (cycle-day/check-in defaults to seed the modal with).

#### Risks
| Risk | Mitigation |
|---|---|
| `planEngine.ts` is shared, heavily-exercised code — a regression here breaks both builders simultaneously | Land the `loadExistingPlan` fix and the new params as additive/optional first; run the full existing manual QA pass for both builders before enabling the new modal in the UI |
| Coaches confused by two sequential modals (Configure Activation → Mark as Done) | Configure Activation modal's copy explicitly states "next: confirm review" when a submission is pending, so the sequence reads as one flow, not two unrelated interruptions |
| Freeze-extension arithmetic diverges subtly from the subscription engine's | Extract the shared day-math helper once, used by both — see Backend changes above |

#### Rollback strategy
New columns are additive/nullable — revert by reverting the frontend modal (plans simply stop asking, `cycleDays`/`checkInFormIds` become absent, `activateSinglePlan` falls back to its pre-phase COALESCE-only behavior when `updateMode` is undefined). The `loadExistingPlan` bug fix can ship independently of the modal UI and should not be reverted even if the modal is rolled back — recommend shipping it as a **separate, prior commit** explicitly labeled as a bug fix (see [§9.7](#9-final-review)).

#### Verification checklist
- [ ] Set a package to `extend`; activate a plan, note `activated_at`/`cycle_end_at`; edit and re-save the same plan through the real builder UI, choosing "Continue"; confirm both timestamps are byte-identical to before the edit.
- [ ] Repeat choosing "Restart"; confirm both timestamps advance to "now"/"now + cycleDays."
- [ ] Regression: re-verify `computeClientStatus`'s `firstActivation` query (MIN across both plan tables) still classifies Active/Frozen/Expired correctly for a sample of existing clients after this phase ships.
- [ ] Freeze a client mid-cycle; confirm `cycle_end_at` extends by the freeze duration, matching the subscription period's own extension for the same freeze.

#### Manual QA checklist
- [ ] Activate a brand-new nutrition plan for a client on a configured package; confirm the modal pre-fills duration + check-ins correctly, and the builder header shows the three new stats afterward.
- [ ] Repeat for training.
- [ ] Edit an active plan without changing anything structural; confirm the Continue/Restart prompt appears and both choices behave as documented.
- [ ] Activate a plan for a client with **no** resolvable package (Phase 0 FK is null); confirm the modal still opens with empty/manual fields and does not error.

#### Acceptance criteria
A coach can activate a plan with duration/check-ins pre-filled from the package, see remaining/activation/end date in the builder afterward, and get an explicit, working choice between continuing or restarting the clock on every subsequent edit of an active plan.

---

### Phase 4 — Scheduled check-ins & review workflow

#### Objective
Turn the check-in selections confirmed in Phase 3's activation modal into an actually-recurring, automatically-dispatched schedule, and notify the coach when a plan is approaching its end.

#### Why this phase exists
Directly implements §1.4. Builds on Phase 3's `cycle_end_at` for review timing and reuses the existing scheduler/notification infrastructure almost unchanged.

#### Database changes
```sql
CREATE TABLE check_in_schedules (
  id                      TEXT PRIMARY KEY,
  workspace_id            TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id               TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  form_id                 TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  interval_days           INT NOT NULL,
  next_due_at             TIMESTAMPTZ NOT NULL,
  source_plan_type        TEXT NOT NULL CHECK (source_plan_type IN ('nutrition', 'training')),
  source_plan_id          TEXT NOT NULL,
  paused_at               TIMESTAMPTZ NULL, -- set while the client's subscription is Frozen
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_checkin_sched_due ON check_in_schedules(next_due_at) WHERE paused_at IS NULL;
CREATE INDEX idx_checkin_sched_client ON check_in_schedules(client_id);
```

#### Backend changes
- `check_in_schedules` rows are created transactionally alongside plan activation (Phase 3's endpoint), one row per confirmed check-in form.
- Editing an active plan: `extend` leaves existing schedule rows' `next_due_at` untouched; `restart` recomputes `next_due_at = NOW() + interval_days` for every schedule row tied to that plan (§6.9).
- Freezing a client (existing `subscription_freezes` flow) sets `paused_at` on that client's schedule rows; unfreezing clears it and shifts `next_due_at` forward by the freeze duration (mirrors the plan/subscription freeze-extension pattern).

#### Frontend changes
None required for MVP dispatch (fully backend/scheduler-driven). Optional, non-blocking: a read-only "upcoming check-ins" list on the client detail page — explicitly deferred, see [§8](#8-future-enhancements-out-of-scope) if not trivial; include only if it fits in this phase's budget without expanding scope.

#### API changes
- New (internal-facing, low priority): `GET /api/clients/:id/check-in-schedules` for the optional UI above.

#### Scheduler changes
New `scheduleCheckInDispatch()` in `middleware/scheduler.ts`, following the exact try/catch-per-tick, cadence-logged pattern every existing job in that file already uses (`scheduleFormDispatcher`, `scheduleSubscriptionExpiry`, `scheduleClientStatusSync`, `scheduleSessionCleanup`):
```ts
export function scheduleCheckInDispatch(): void {
    cron.schedule('0 * * * *', async () => { // same hourly cadence as scheduleFormDispatcher
        try {
            const due = await prisma.check_in_schedules.findMany({
                where: { next_due_at: { lte: new Date() }, paused_at: null },
            });
            for (const row of due) {
                await prisma.$transaction([
                    prisma.form_requests.create({ data: { /* ... */ status: 'pending', scheduled_at: new Date() } }),
                    prisma.check_in_schedules.update({
                        where: { id: row.id },
                        data: { next_due_at: new Date(Date.now() + row.interval_days * 86400000) },
                    }),
                ]);
                await recordEvent({ /* checkin.requested, see below */ });
            }
        } catch (err) { console.error('[Scheduler] Check-in dispatch error:', err); }
    });
}
```
Extend `scheduleClientStatusSync()`'s existing daily per-client loop (already iterating every client, `scheduler.ts:61-120`) with a review-due check: for each active plan where `cycle_end_at - review_offset_days <= now` and `review_notified_at IS NULL`, fire the review notice and stamp `review_notified_at`.

#### Notification changes
Two new event keys, consistent with the existing `checkin.*`/`plan.*` namespace (confirmed live: `checkin.submitted`, `checkin.reviewed`, `checkin.assigned`, `plan.assigned`):
| Event key | Recipient | Fired by |
|---|---|---|
| `checkin.requested` | client | `scheduleCheckInDispatch` tick |
| `plan.review_due` | coach (workspace owners, same `ownerRecipients()` helper the status-sync job already uses) | `scheduleClientStatusSync` extension |
| `plan.duration_restarted` | client | Phase 3's "Restart" action, fired synchronously at save time (not scheduler-driven) — see [§2.4](#24-missing-pieces-the-prior-roadmap-didnt-call-out--now-added) |

All three go through the existing `recordEvent()` — no new notification pipeline.

#### Business rules
See [§6.8–§6.10](#6-business-logic).

#### UX changes
Notification bell surfaces the three new event types using the app's existing per-type icon/label convention (`NotificationBell.js`) — no new notification UI shell.

#### HeroUI changes
None — this phase is scheduler/backend-heavy by design.

#### Files likely to change
```
server/prisma/schema.prisma
server/prisma/migrations/<new>/migration.sql
server/src/middleware/scheduler.ts
server/src/modules/nutrition/nutrition.controller.ts   (schedule rows on activate/edit)
server/src/modules/training/training.controller.ts
server/src/lib/events.ts   (only if new event-key constants are centralized there)
```

#### Dependencies
Phase 1 (interval config), Phase 3 (cycle end dates for review timing, plan activation creating the schedule rows).

#### Risks
| Risk | Mitigation |
|---|---|
| Cron dispatch creates a `form_requests` row for a client whose subscription has since expired | Dispatch checks the client's current computed status before creating the row; skip and log if not Active/within-grace — expired clients already can't act on `allow_submit_checkins` per existing portal gating |
| Duplicate dispatch on scheduler restart mid-tick | Wrap the create-and-advance in one `$transaction` (shown above) so a crash between the two can't double-fire |

#### Rollback strategy
New table only — disable by removing the two cron registrations in `scheduler.ts` (a one-line change per job, matching how every existing job is already registered/unregistered at startup). No existing table is touched.

#### Verification checklist
- [ ] Seed a `check_in_schedules` row with a 1-day interval in staging; let the real cron tick run; confirm a `form_requests` row and a `checkin.requested` notification both appear without manual intervention.
- [ ] Freeze the client mid-schedule; confirm no new check-in fires during the freeze window; unfreeze and confirm `next_due_at` shifts forward correctly and dispatch resumes.
- [ ] Trigger a plan review-due condition; confirm exactly one `plan.review_due` notification fires (not one per daily tick thereafter) via the `review_notified_at` guard.

#### Manual QA checklist
- [ ] Activate a plan with two check-in forms selected; confirm two `check_in_schedules` rows are created with correct `interval_days`.
- [ ] Restart an active plan with live schedules; confirm `next_due_at` resets for its schedule rows and the client receives `plan.duration_restarted`.
- [ ] Let a plan approach its review offset in a staging environment with compressed intervals; confirm the coach notification fires exactly once.

#### Acceptance criteria
Once a plan is activated with check-in forms selected, those forms are delivered to the client on schedule with zero further coach action, and the coach is proactively notified before the plan lapses — matching the vision's "automatically receives scheduled check-in forms and notifications" verbatim.

---

### Phase 5 — Portal-gating hardening

#### Objective
Retire the name-matching fallback path entirely now that Phase 0's FK has been live and verified.

#### Why this phase exists
Phase 0 already makes `resolveClientPackageId()` read the FK directly — this phase is the cleanup/removal of anything left over (the `DEBT.md` entry, any remaining string-based fallback code, dead imports) once the team is confident in the new path. Low complexity, low risk, mostly bookkeeping.

#### Database changes
None.

#### Backend changes
Final confirmation that `resolveClientPackageId()` contains no residual name-matching branch; remove it if any defensive fallback was left in place during Phase 0's initial rollout.

#### Frontend changes
None.

#### API changes
None.

#### Scheduler changes
None.

#### Notification changes
None.

#### Business rules
Unchanged from Phase 0 — this phase asserts them, doesn't add new ones.

#### UX changes
None.

#### HeroUI changes
None.

#### Files likely to change
```
server/src/modules/subscriptionPolicies/subscriptionPolicies.service.ts
DEBT.md
```

#### Dependencies
Phase 0, fully verified and stable in production for at least one full billing cycle (recommend: don't schedule this phase until Phase 0 has been live long enough to build confidence — see [§9.7](#9-final-review)).

#### Risks
Minimal — this is a deletion of already-dead code, not new logic.

#### Rollback strategy
N/A — no behavior change, pure cleanup.

#### Verification checklist
- [ ] Grep the codebase for any remaining reference to name-based package matching; confirm none remain outside historical/display code paths (the string columns themselves stay, by design).
- [ ] `DEBT.md` entry for this item marked `✅ RESOLVED`.

#### Manual QA checklist
- [ ] Spot-check five clients' effective portal permissions against the Packages/Policy admin UI — matches expectations.

#### Acceptance criteria
No code path in the repository resolves a client's package by string comparison.

---

## 5. UI planning

### 5.1 Finance → Packages page

| | |
|---|---|
| **New UX** | Create Package modal gains: (a) the same policy-override section already in the Edit modal, appearing once the base package fields are submitted (a "Next" step within the same modal, not a page navigation); (b) per-variation default-forms pickers and cycle-length/update-mode fields, added to the existing per-variation `Surface` card (`packages/page.js:552-597`). |
| **Already covered / reused** | `Modal`/`ModalFooter`, `TextField`/`Input`, `PackagePolicyOverride` (unchanged component, just mounted earlier in the flow), `Surface` per-variation cards, the existing `CurrencySelect` `ComboBox` pattern as the template for new multi-selects. |
| **New components required** | `PackageFormsPicker` (multi-select over `/api/forms`, split by kind=assessment/checkin, with an interval-days input revealed per checked check-in form) and `PlanUpdateModeToggle` (two-option segmented control). Both are small, package-scoped, and live in `client/app/components/`. |
| **State changes** | `PackagesPage` gains `variations[].defaultForms`, `.nutritionCycleDays`, `.trainingCycleDays`, `.reviewOffsetDays`, `.planUpdateMode` in its local `variations`/`editingVariation` shape; `editingPackage` gains a `createdId` transitional state during the two-step create flow. |
| **Data flow** | `GET /api/forms` (already fetched elsewhere in the app) feeds the picker; on submit, package + variations + defaults + policy are written in sequence (`POST /api/packages` → `PUT /api/subscription-policies/packages/:id`), both before the modal closes — the coach experiences it as one action. |

### 5.2 Clients → Create Client Wizard

| | |
|---|---|
| **New UX** | Step 2 ("Subscription")'s existing forms multi-select auto-checks the selected package variation's default assessment forms, with a small "from package" tag per auto-checked item. |
| **Already covered / reused** | The wizard's step structure, `Stepper`, the existing package `Select`, the existing forms multi-select — all unchanged in shape. |
| **New components required** | None — a badge/tag addition to existing list items, not a new component. |
| **State changes** | `selectedForms` is now seeded (not just manually set) by a package-selection side effect; no new state variables. |
| **Data flow** | `GET /api/packages` (already called on wizard mount, `clients/page.js:199-209`) now includes `defaultForms`; a derived lookup (no new request) drives the seed. |

### 5.3 Nutrition Builder

| | |
|---|---|
| **New UX** | (1) "Configure Activation" modal before/alongside the existing "Mark as Done" confirmation, asking Plan Duration + Check-in Forms, pre-filled from the package. (2) A "Continue vs. Restart" prompt on saving an edit to an already-active plan. (3) A header stat row: Activation date / Remaining days / End date, shown when the plan is active with a known `cycle_end_at`. |
| **Already covered / reused** | The existing `Modal`/`Modal.Backdrop`/`Modal.Container`/`Modal.Dialog`/`Modal.Footer` family (`MiddlePanel.js:397-410`) as the template for both new modals; the existing `activateModal`/`setActivateModal` state wiring pattern extended with a second modal flag rather than replaced. |
| **New components required** | `ConfigureActivationModal` (duration input + check-in picker, shared shape with training via a small module-agnostic component taking `planType` as a prop), `ContinueOrRestartPrompt` (two-button dialog). |
| **State changes** | `nutrition/page.js` gains `configureActivationModal`/`durationChoicePrompt` state alongside the existing `activateModal` (`:29`); `handleActivatePlan` (`:101`) becomes a two-step function: open Configure Activation → on confirm, proceed to the existing activate-and-mark flow with the resolved `cycleDays`/`checkInFormIds`. |
| **Data flow** | Package defaults arrive with the already-fetched client/package context (no new fetch on modal open, assuming the page already resolves the client's package — confirm during implementation, flagged in [§9.1](#91-open-questions)); the header stat row computes from the plan object already in state, no new fetch. |

### 5.4 Training Builder

Mirrors §5.3 exactly — same modal shape, same state pattern, same header addition — parameterized by `planType: 'training'`. `training/page.js` has the identical `activateModal` state shape (`:27`) confirmed against the nutrition page, so the two builders can share the new modal components rather than duplicating them.

### 5.5 Forms

| | |
|---|---|
| **New UX** | None directly visible in the Forms library screen itself — automatic scheduling and the review workflow are backend/scheduler-driven (Phase 4). The only new visible surface is the notification bell picking up the two new event types. |
| **Already covered / reused** | `form_requests` creation path, the existing hourly dispatcher, `recordEvent()`. |
| **New components required** | None. |
| **State changes** | None in the Forms module itself. |
| **Data flow** | `check_in_schedules` (new, Phase 4) sits between plan activation and `form_requests` creation — the Forms module's own code is untouched. |

### 5.6 Client Portal

| | |
|---|---|
| **New UX** | None — permission *behavior* is unchanged; only the internal resolution path (Phase 0/5) changes. |
| **Already covered / reused** | `loadClientAccess` middleware, `getEffectiveAccessForClient()`, `/me`/`/access` endpoints — all untouched. |
| **New components required** | None. |
| **State changes** | None. |
| **Data flow** | Identical shape; only the internal `resolveClientPackageId()` implementation changes (string match → FK read). |

### 5.7 Notifications

| | |
|---|---|
| **New UX** | Three new notification types appear in the existing bell/notifications list: `checkin.requested` (client-facing), `plan.review_due` (coach-facing), `plan.duration_restarted` (client-facing). |
| **Already covered / reused** | `NotificationBell.js`'s existing per-type icon/label switch, the `notifications` table, `recordEvent()`. |
| **New components required** | None — extend the existing type→label/icon mapping with three new cases. |
| **State changes** | None beyond the existing unread-count polling already in place. |
| **Data flow** | Unchanged pipeline: `recordEvent()` → `notifications` table → existing bell polling/read-state flow. |

---

## 6. Business logic

Deterministic rules, grouped by concern. Each rule is written to be directly translatable into a controller-level guard or a single `if`/`switch` branch.

### 6.1 Subscription
- A client's subscription status is **always computed**, never stored as ground truth (`computeSubscriptionDetails`) — this phase set does not change that.
- A client's package variation is resolved via `clients.current_package_variation_id` (Phase 0+), falling back to `NULL` (→ workspace-global policy) if unset or if the referenced variation was deleted.

### 6.2 Package
- A package variation's default fields (`nutrition_cycle_days`, `training_cycle_days`, `review_offset_days`, `plan_update_mode`, `package_default_forms`) are **read only at the moment of a triggering action** (client creation, plan activation) — never re-read live afterward for an already-created record.
- Editing a package variation's defaults affects only *future* client-creation/activation events; it never retroactively modifies an existing client, plan, or schedule.

### 6.3 Package snapshot
- Every value copied from a package default into a client-specific record (a plan's `cycle_days`, a `check_in_schedules.interval_days`) is a **one-time copy**, matching the precedent already set by `transactions.duration` (itself a snapshot of the variation's duration at purchase time, immune to later variation edits).

### 6.4 Plan activation
- Activation always requires resolving (from the package, defaulting to empty/manual if none) a proposed `cycleDays` and a proposed check-in form list; the coach may accept, edit, or clear either before confirming.
- On confirm: `activated_at = NOW()`, `cycle_end_at = cycleDays ? NOW() + cycleDays : NULL`, one `check_in_schedules` row per confirmed check-in form with `next_due_at = NOW() + interval_days`.
- A plan activated with no resolvable `cycleDays` (no package, or coach clears the field) has `cycle_end_at = NULL` indefinitely — the builder header omits the stat row entirely in this case (never shows "Remaining: —" or similar ambiguous placeholder).

### 6.5 Plan editing (the restart/extend rule)
- The Continue/Restart prompt appears **if and only if** the plan being saved currently has `status = 'active'` **and** already has a non-null `activated_at`.
- **Extend** (coach chooses "Continue remaining duration"): `activated_at`, `cycle_end_at`, and every associated `check_in_schedules.next_due_at` are carried forward unchanged from the pre-edit row.
- **Restart** (coach chooses "Restart plan duration"): `activated_at = NOW()`; `cycle_end_at` recomputed from the plan's current `cycle_days` (or a newly-provided value if the coach also changes it in the same edit); every associated `check_in_schedules.next_due_at` recomputed as `NOW() + interval_days`; `review_notified_at` reset to `NULL` (a restarted plan is eligible for a fresh review-due notice on its new timeline).
- A plan that is `draft` (never activated) or brand-new never triggers this prompt — there is nothing to extend from; saving simply persists the draft as today.

### 6.6 Freeze
- While a client's computed status is `Frozen`, `check_in_schedules` rows for that client are marked `paused_at = NOW()` and do not advance or dispatch.
- On unfreeze, `paused_at` clears and `next_due_at` shifts forward by the freeze's duration — mirroring exactly how `computeSubscriptionDetails` already extends a subscription period's end by a freeze's duration (same arithmetic, applied to a different date field).
- A plan's `cycle_end_at` is extended by a freeze's duration using the same shared helper (§Phase 3 Backend changes) — a frozen client does not lose plan time to the freeze window, consistent with how their subscription itself doesn't.

### 6.7 Expire
- Once a client's computed status is `Expired` and outside any grace window, `scheduleCheckInDispatch` skips creating new `form_requests` for that client's schedules (checked at dispatch time, not by mutating the schedule rows) — an expired client's portal already blocks `allow_submit_checkins` via the existing, unchanged policy engine, so dispatching would be a dead end.
- Expiring does **not** delete or reset `check_in_schedules`/plan dates — if the client resubscribes and their status returns to `Active`, dispatch resumes from wherever `next_due_at` already was (potentially immediately, if it's in the past), not from a reset point.

### 6.8 Manual override
- At every point a package default is proposed (wizard forms, activation modal), the coach's manual edit **always wins** over the package's proposed value for that specific action — package configuration is a convenience default, never an enforced constraint, at any layer.

### 6.9 Recurring check-ins
- `check_in_schedules.next_due_at` advances by exactly `interval_days` on each successful dispatch, computed from the *previous* `next_due_at` (not from "now"), so a temporarily-delayed cron tick doesn't compound drift.
- Editing an active plan's check-in selection (adding/removing forms in a future "edit activation" affordance, if built — see [§9.1](#91-open-questions)) is out of MVP scope; today's MVP only sets check-ins at activation time and lets restart/extend govern their timing thereafter.

### 6.10 Review reminder / notification timing
- `plan.review_due` fires exactly once per cycle, guarded by `review_notified_at` (set the moment the notice fires, cleared only by a restart — §6.5).
- `checkin.requested` fires once per dispatched `form_requests` row — no batching, matching the existing one-notification-per-event granularity used elsewhere (e.g. `checkin.submitted`).
- `plan.duration_restarted` fires synchronously at the moment a coach confirms "Restart" — not scheduler-driven — so the client is informed promptly, not on the next daily tick.

---

## 7. Edge cases

| Edge case | Expected behavior |
|---|---|
| **Package deleted** while clients are subscribed to one of its variations | Variation rows cascade-delete is **not** allowed to cascade to `transactions`/`clients` (`ON DELETE SET NULL` on those FKs only); affected clients' package resolution returns `NULL` → workspace-global policy; their existing plans/schedules are unaffected (they don't hold a package FK directly, only a snapshotted `cycle_days`). |
| **Variation renamed** after a transaction/plan referencing it | FK-based resolution (Phase 0+) is unaffected (id-based); the historical string snapshot (`transactions.package_variation`) legitimately goes stale — expected, it's a receipt, not a live pointer. |
| **Client changes package** (new transaction with a different variation) | `current_package_variation_id` updates to the new variation (via `syncClientPackage`, unchanged trigger point); does **not** retroactively alter any already-active plan's `cycle_days`/schedules — those only change on the next activation or edit-with-restart. |
| **Subscription renewed** (a new `transactions` row extends the period) | Subscription status/period computation is unchanged (`computeSubscriptionDetails` already chains periods); plan lifecycle is independent — a renewal does not automatically restart or extend any in-progress plan. |
| **Plan expires while frozen** — i.e. `cycle_end_at` would have passed during a freeze window | Freeze extension (§6.6) means `cycle_end_at` is pushed out by the freeze duration before this can happen in the normal case; if a plan somehow has no freeze-extension applied (e.g. freeze recorded after the fact), the builder simply shows a past/zero "remaining days" — not an error state, just an accurate (if awkward) number prompting the coach to act. |
| **Coach edits an active plan** without answering the restart/extend prompt (e.g. closes the modal) | Save is blocked until a choice is made when the plan is active — this is not a dismissible/optional prompt (§6.5's "if and only if" condition always requires an answer to complete the save). |
| **Missing forms** — a package's default check-in/assessment form was archived before being consumed | `package_default_forms` join row cascades away with the form; the wizard/activation modal simply shows fewer (or zero) pre-filled defaults, never a broken reference. |
| **Archived forms** referenced by an already-created `check_in_schedules` row | Dispatch skips rows whose `form_id` no longer resolves to an active form, logs it, and does not throw — matching the try/catch-per-row resilience already used by every existing scheduler job. |
| **Deleted package** with no variations left (all deleted individually) | Matches existing behavior in `packages.controller.ts:132-136` — deleting the last variation already deletes the parent package; unaffected by this initiative. |
| **Deleted variation** referenced by a live `check_in_schedules` row's `source_plan_id`/provenance | Provenance fields are informational only (for future auditing/UI); dispatch logic depends solely on the schedule row's own `form_id`/`interval_days`/`next_due_at`, never on the source plan or package still existing. |
| **Concurrent edits** — two coaches (or the wizard and a direct edit) modify the same client's package/plan simultaneously | Out of scope for new locking logic in this initiative; inherits the app's existing last-write-wins behavior for `clients`/plan tables. Flagged as an assumption in [§9.5](#95-assumptions), not solved here. |
| **Migration failures** during Phase 0's backfill | Backfill is a separate, idempotent, re-runnable script (not embedded in the schema migration itself) — a partial failure leaves already-matched rows correctly set and unmatched rows `NULL` (safe default), and can be re-run without side effects. |
| **Scheduler retries** — the hourly check-in dispatch tick throws partway through a batch | Per-row `$transaction` (create + advance) means a mid-batch crash leaves already-processed rows correctly advanced and unprocessed rows untouched for the next tick — no duplicate dispatch, no lost rows. |
| **Notification failures** — `recordEvent()` throws | Every existing call site treats `recordEvent()` as best-effort (fire-and-forget or wrapped); the new call sites follow the same convention — a notification failure must never block or roll back the underlying business action (plan activation, check-in dispatch). |

---

## 8. Future enhancements (out of scope)

Explicitly **not** part of this MVP. Listed to prevent scope creep during implementation — do not build these now even if they seem like a natural extension mid-phase.

- **Analytics** — package performance, plan-completion/renewal-rate dashboards.
- **Automation templates** — reusable bundles of defaults shareable across packages/workspaces.
- **AI recommendations** — suggesting a package or cycle length based on client history.
- **Advanced recurrence** — non-fixed-interval check-in cadences (e.g. "every 2nd Monday"), calendar-aware scheduling.
- **Multi-stage workflows** — packages that auto-transition a client through a sequence of different variations over time.
- **Package cloning** — duplicate an existing package/variation as a starting point for a new one.
- **Versioning** — historical snapshots of a package's configuration over time (beyond the per-record snapshot fields this plan already includes).
- **Reports** — exportable summaries of check-in compliance, review outcomes, or plan-restart frequency.
- **Client-facing "upcoming check-ins" UI** on the client portal itself (distinct from the coach-facing optional list mentioned in Phase 4) — defer until real usage data suggests it's needed.
- **Editing an active plan's check-in selection independent of a full restart/extend decision** (§6.9) — MVP only sets check-ins at activation; a dedicated "manage schedules" affordance is a later iteration.

---

## 9. Final review

### 9.1 Open questions

1. Does the Nutrition/Training builder page already have the active client's resolved package variation in state at the point the Configure Activation modal opens, or does it need a new fetch? (Affects whether §5.3/§5.4's "Data flow" needs a new endpoint call.) **Needs a 15-minute implementation-time check against `nutrition/page.js`/`training/page.js`'s existing data-loading effects before Phase 3 starts.**
2. Should `package_default_forms` for check-ins support more than one interval per form (e.g. a form used both as a one-off assessment and, separately, as a recurring check-in on a different package)? Current design allows this naturally (the `kind` column disambiguates per join row), but confirm this dual-use case is real before building UI for it.
3. Is there an existing "form assigned to client" notification fired today when a coach manually assigns a one-off form (outside the wizard)? Not confirmed during this analysis — worth a quick check before Phase 4 finalizes the `checkin.requested` event key, to avoid a near-duplicate.

### 9.2 Architectural decisions

**AD-1 — Server re-derives price/currency/duration from `packageVariationId` when present, rather than trusting client-supplied values.**
Rationale: while adding the FK (Phase 0), the frontend already sends these values independently (snapshotted client-side from an earlier `GET`); once a real id is available, deriving server-side is strictly safer and costs nothing extra. Not a scope expansion — a natural tightening enabled by the same code change.

**AD-2 — Package creation becomes a two-step submit (create, then policy) inside one modal, rather than blocking the whole modal until both are ready.**
Rationale: `PackagePolicyOverride` is an existing, working component that needs a real `packageId`. Rebuilding it to work against a not-yet-created package (e.g., holding policy in local state and submitting it as part of the original `POST /api/packages` payload) would require changing a stable, correct component's contract. Sequencing the *modal's* interaction instead is a smaller, safer change with an identical end-user outcome (one modal session, no reopening).

**AD-3 — The new "Configure Activation" modal and the existing "Mark as Done" modal remain two separate, sequenced modals rather than one merged dialog.**
Rationale: they have different triggers (every activation vs. only submission-linked activations), different consequences (setting duration/check-ins vs. closing a review loop), and merging them would mean the duration/check-in fields either don't appear on the common path (defeating the vision) or the "mark as done" language appears even when there's no submission (confusing). Kept separate; sequenced so the flow reads as one continuous action.

**AD-4 — `plan_update_mode` and cycle-length defaults are keyed on `package_variation_id`, while portal-permission policy stays keyed on `package_id`.**
Rationale: variations within one package legitimately differ in length (a 4-week vs. 12-week "Shred" variation shouldn't share a cycle-length default), while portal access after expiry/freeze is a coarser, family-level policy decision a coach is unlikely to want to vary per-variation. Confirmed against the existing schema, where `subscription_access_policies.package_id` already made this exact choice for policy.

### 9.3 Trade-offs

| Decision | What we gained | What we gave up |
|---|---|---|
| Snapshot-only defaults (never re-read live) | Predictability — editing a package never silently changes an existing client/plan | A coach cannot retroactively apply an improved default to existing clients without manually re-triggering the action |
| Two sequential activation modals (AD-3) | Single-responsibility, lower regression risk on the existing submission-review flow | One extra click/screen in the sequential-modal path vs. a single merged dialog |
| No generic package-config snapshot table (§2.3) | Simplicity, consistency with existing `transactions.duration` precedent | Each new snapshot field must be added individually to its own table rather than read generically from one blob |

### 9.4 Technical debt

- **Acknowledged, not resolved by this plan:** concurrent-edit handling on `clients`/plan tables remains last-write-wins (§7, "Concurrent edits"). Out of scope; flag for a future locking/optimistic-concurrency pass if it becomes a real incident, not a theoretical one.
- **Newly retired debt:** the `subscriptionPolicies.service.ts:189` `DEBT` comment and the name-matching it describes are fully removed by Phase 0/5.
- **Newly fixed, pre-existing bug:** the `activated_at`-reset-on-every-save defect (§1.6) is fixed as a documented part of Phase 3, not silently.

### 9.5 Assumptions

- The workspace's existing permission model already has a guard (e.g. `training.write`/`nutrition.write`) protecting `POST /plans/:id/activate` and the save-draft endpoints; this plan reuses whichever guard already exists rather than minting a new permission key (§2.4).
- `GET /api/forms` is already available and workspace-scoped in a form usable directly by the new pickers (confirmed via its existing use in the client wizard, `clients/page.js:203`).
- The team is comfortable with "extend" as the safer default for `plan_update_mode` (§2.2) absent further product input; flagged, not unilaterally overridden.

### 9.6 Risks

Consolidated from per-phase risk tables — the two risks worth the whole team's attention, not just the implementer's:

1. **Phase 3 touches `lib/planEngine.ts`, shared by both builders.** A subtle regression here is the single highest-blast-radius risk in this entire plan. Mitigate by shipping the `loadExistingPlan` bug fix as its own preceding commit (§Phase 3 Rollback strategy), independently verifiable before the larger feature lands on top of it.
2. **Phase 0's backfill quality directly determines every later phase's correctness.** An under-verified backfill silently mis-resolves policy for some clients. Mitigate with the mandatory before/after diff in Phase 0's verification checklist — do not proceed to Phase 1 without it passing.

### 9.7 Implementation order

Recommended sequence, with rationale:

```
Phase 0 (foundation) 
   │
   ├──▶ Phase 5 (gating cleanup) — cheap, do once Phase 0 is confidently stable
   │
   ▼
Phase 1 (package config surface)
   │
   ▼
Phase 2 (wizard integration) ──▶ ships independently, low risk, good confidence-builder
   │
   ▼
Phase 3 (plan lifecycle engine) ──▶ critical path, highest complexity/risk, budget the most review time
   │
   ▼
Phase 4 (scheduled check-ins & review workflow)
```
Phase 5 can slot in any time after Phase 0 is stable — it's cleanup, not a dependency for anything downstream. Everything else follows strict dependency order.

### 9.8 Estimated complexity per phase

| Phase | Complexity | Why |
|---|---|---|
| 0 — Data model foundation | **Medium** | Simple schema change; complexity is entirely in verifying the backfill is behavior-neutral |
| 1 — Package config surface | **Medium** | Mostly additive CRUD + a UI sequencing fix; no tricky business logic |
| 2 — Wizard integration | **Low** | Small, self-contained, single file |
| 3 — Plan lifecycle engine | **High** | Shared engine, new time-dimension modeling, two new modals, a real bug fix, freeze-interaction arithmetic |
| 4 — Scheduled check-ins & review workflow | **Medium-High** | New table + new cron jobs, but reuses existing scheduler/notification patterns closely |
| 5 — Portal-gating hardening | **Low** | Cleanup only |

### 9.9 Recommended git milestones

```
milestone/package-lifecycle-phase-0   — FK + backfill + resolver rewrite
milestone/package-lifecycle-phase-1   — package defaults schema + admin UI
milestone/package-lifecycle-phase-2   — wizard forms prefill
milestone/package-lifecycle-phase-3a  — planEngine bug fix (activated_at preservation), shipped alone
milestone/package-lifecycle-phase-3b  — cycle_days/cycle_end_at + Configure Activation modal + restart/extend prompt
milestone/package-lifecycle-phase-4   — check_in_schedules + scheduler + notifications
milestone/package-lifecycle-phase-5   — cleanup, DEBT.md resolution
```
Splitting Phase 3 into `3a`/`3b` at the git-milestone level (while keeping it one logical phase in this document) lets the bug fix land, get verified in isolation, and de-risk before the larger feature builds on top of it — directly reflecting the Rollback strategy called out in Phase 3.

---

*End of document. This plan is implementation-ready: every phase specifies its own database, backend, frontend, API, scheduler, notification, and UX changes, its own verification and QA checklists, and its own rollback path. No further architectural discussion should be required before starting Phase 0.*
