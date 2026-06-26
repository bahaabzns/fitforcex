# Test Scenarios — Features Shipped in the Last 48 Hours

> Window: **2026-06-23 → 2026-06-25**. Derived from the feature commits on
> `feature/subscription-access-policy` and the mobile client-app phases.
> Each section lists what to test and how, organized by the testing buckets in
> CLAUDE.md §B5: **happy path · auth-denied · authz-denied · validation-fail ·
> tenant-isolation · edge/weird**. Endpoints are relative to the API base
> (`/api`); portal routes are under `/client-portal`.

## Legend / conventions
- **Coach / team user** — authenticated via cookie or `Bearer`, scoped to a workspace.
- **Client** — portal end-user, separate token, `req.client`.
- **Owner** — workspace member with role `owner` (required for danger-zone actions).
- **Super admin** — operates the global admin surface (`/admin/*`), not workspace-scoped.
- ✅ expected pass · ⛔ expected block/error · 🔁 reversible · 🧪 automated coverage exists.

Commits covered:
`a59c0b7` subscription access policy + client archiving · `b67cba6` notification system ·
`9c8177d` master form templates + default library cloning · `75032ac` default libraries / onboarding / signup auto-login ·
`e181d62` web empty states · `610c35f` mobile empty states + forms filter recovery ·
`644cbe3` mobile client access gating · plus mobile phases 4–7 (`52bea69`, `5456842`, `c3ab155`, `49ef14c`, `a1a2d29`).

---

## 1 — Subscription Access Policy (Coach config + enforcement)

**What it does:** Once a client's subscription is no longer Active, what they may still see/do in the portal is governed by two policy scopes — **expired** and **frozen** — each carrying the same 10 permission flags. Expired also carries a `grace_period_days` window. Policies exist at workspace **global** level and may be **overridden per package**.

The 10 flags: `keep_portal_access`, `view_training_plans`, `view_nutrition_plans`, `view_progress_history`, `view_assessments`, `view_checkins`, `allow_messaging`, `allow_submit_checkins`, `allow_booking_appointments`, `allow_download_files`.

Key files: `utils/subscriptionPolicy.ts`, `subscriptionPolicies.service.ts`, `middleware/clientAccessPolicy.ts`.

### 1.1 Global policy CRUD (`/subscription-policies`)
| # | Scenario | Steps | Expected |
|---|---|---|---|
| 1.1.1 | Defaults when unset (happy) | Fresh workspace, GET global policies before any save | ✅ Returns spec default = **read-only** (all `view_*` + `keep_portal_access` true; all `allow_*` false; `grace_period_days = 0`) for both expired and frozen |
| 1.1.2 | Save + read back | Save global expired with `allow_messaging=true, grace_period_days=7`; GET | ✅ Returned policy reflects the saved flags + grace 7 |
| 1.1.3 | Grace only on expired | Save frozen scope with a non-zero grace value | ✅ Frozen persists grace as **0** (frozen has no grace; service forces 0) |
| 1.1.4 | Audit on edit | Save any policy | ✅ A `policy.update` audit row is written (`logSubscriptionAudit`) |
| 1.1.5 | Auth-denied | Call without a session | ⛔ 401 |
| 1.1.6 | Authz-denied | Call as a member lacking the settings/subscription permission | ⛔ 403 |
| 1.1.7 | Tenant isolation | Workspace A saves policy; workspace B GET | ✅ B sees its **own** defaults, never A's rows |

### 1.2 Per-package overrides
| # | Scenario | Expected |
|---|---|---|
| 1.2.1 | Object upserts override | Save package override `expired={...}` → that package now uses the override, others still use global |
| 1.2.2 | `null` clears override | Save `expired: null` for the package → `deleteMany` removes the row; package reverts to global default for that scope |
| 1.2.3 | `undefined` leaves untouched | Save only `frozen`, omit `expired` → existing expired override unchanged |
| 1.2.4 | Resolution precedence | Client on package P with P-override → effective policy = override, NOT global (🧪 `subscriptionPolicies.test.ts`) |
| 1.2.5 | No package mapping | Client whose `current_package` matches no `package_variations` row → falls back to global (resolves package id by variation name — DEBT documented) |

### 1.3 Effective access resolution (`getEffectiveAccessForClient`) 🧪 `subscriptionPolicy.test.ts`
| # | Status | Expected effective access |
|---|---|---|
| 1.3.1 | Active | All 10 flags **true** (full access) |
| 1.3.2 | Pre-start | All flags **true** (onboarding never blocked) |
| 1.3.3 | No Subscriptions (new client, no payment) | All flags **true** |
| 1.3.4 | Expired (grace = 0) | Expired policy flags applied as-is; `withinGrace=false`; `status=Expired` |
| 1.3.5 | Expired within grace window | `today < currentPeriodEnd + grace_days` → treated as **Active** (all flags true), `withinGrace=true`, but reported `status` still `Expired` |
| 1.3.6 | Expired past grace window | `today >= graceEnd` → expired policy applied, `withinGrace=false` |
| 1.3.7 | Expired, grace set but no `currentPeriodEnd` | No grace applied (guard requires a period end) |
| 1.3.8 | Frozen | Frozen policy flags applied; grace never applies |
| 1.3.9 | Archived | `status='Archived'`, every flag **denied** (resolveAccess('Cancelled')) regardless of subscription state |

**Edge/weird:** grace boundary exactly at midnight (`today` is normalized to 00:00 — confirm `today < graceEnd` is strict); a client with multiple transactions where status is recomputed; a frozen client whose freeze just ended (should compute back to Active/Expired on next read).

---

## 2 — Portal Access Gating (middleware enforcement)

**What it does:** `loadClientAccess` computes effective access once per request → `req.clientAccess`. `requirePortalOpen` blocks feature routes when `keep_portal_access=false`. `requireClientAccess(flag)` / `requireAnyClientAccess([flags])` block per-action. `/me` and `/access` are intentionally **never** gated so the portal can render a restricted status card.

| # | Route | Guard | Test |
|---|---|---|---|
| 2.1 | `GET /client-portal/me` | authed only | ✅ Always returns for an authenticated client, even archived/expired (embeds access) |
| 2.2 | `GET /client-portal/access` | authed only | ✅ Returns `{ status, withinGrace, access:{...10 flags} }` |
| 2.3 | `GET /active-training-plan` | `view_training_plans` | ⛔ 403 `ACCESS_RESTRICTED` when flag off; ✅ when on |
| 2.4 | `GET /active-plan` (nutrition) | `view_nutrition_plans` | ⛔ 403 / ✅ |
| 2.5 | `GET/POST /messages` | `allow_messaging` | ⛔ 403 when messaging disabled; ✅ when on |
| 2.6 | `GET /form-requests`, `/:id` | **any of** `view_assessments`/`view_checkins` | ✅ passes if either flag on; ⛔ 403 only if both off |
| 2.7 | `POST /form-requests/:id/submit` | `allow_submit_checkins` | ⛔ 403 when off (view allowed but submit blocked) |
| 2.8 | `POST /workout-logs` | `view_training_plans` | ⛔ 403 / ✅ |
| 2.9 | `GET /workout-logs` + progress/exercise routes | `view_progress_history` | ⛔ 403 / ✅ |
| 2.10 | Portal fully closed | Client status maps to `keep_portal_access=false` | ⛔ Every feature route 403 `PORTAL_RESTRICTED`; `/me` + `/access` still 200 |
| 2.11 | Response shape | Any blocked route | ⛔ JSON includes `code` (`PORTAL_RESTRICTED`/`ACCESS_RESTRICTED`), `status`, and the offending `permission(s)` |
| 2.12 | Unauthenticated | No client token | ⛔ 401 from `loadClientAccess` |

**Negative/weird:** archived client login attempt (should be blocked at portal login — verify); deep-link directly to a restricted route (403); access flag toggled by coach mid-session → next request reflects new policy (computed per-request, not cached server-side).

---

## 3 — Client Archiving & Danger Zone

**What it does:** `DELETE /clients/:id` now **archives** (never destroys). Restore reverses it. Owner-only permanent delete supports **anonymize** (default, keeps analytics rows) or **hard** (FK-safe destroy). All transitions write audit rows.

Key files: `clients.controller.ts` (`archiveClient`, `restoreClient`, `permanentDeleteClient`, `getClientAudit`), `requireOwner` middleware. 🧪 `clientArchiving.test.ts`.

### 3.1 Archive (`DELETE /clients/:id`)
| # | Scenario | Expected |
|---|---|---|
| 3.1.1 | Archive active client (happy) | ✅ Sets `archived_at` + `archived_by`; removed from active lists; `client.archive` audit row; portal login/access blocked thereafter |
| 3.1.2 | Already archived | ⛔ 409 "Client is already archived" |
| 3.1.3 | Non-existent / other workspace | ⛔ 404 (tenant-scoped `findFirst`) |
| 3.1.4 | Data preserved | After archive, all transactions/plans/logs still exist |

### 3.2 Restore (`POST /clients/:id/restore`) 🔁
| # | Scenario | Expected |
|---|---|---|
| 3.2.1 | Restore archived (happy) | ✅ Clears `archived_at`/`archived_by`, sets `restored_at`/`restored_by`; `client.restore` audit (`Archived→Active`) |
| 3.2.2 | Restore a non-archived client | ⛔ 409 "Client is not archived" |
| 3.2.3 | Cross-workspace | ⛔ 404 |

### 3.3 Permanent delete (`DELETE /clients/:id/permanent`, owner-only)
| # | Scenario | Expected |
|---|---|---|
| 3.3.1 | Anonymize (default) | ✅ Scrubs PII (`fname='Deleted'`, `lname='Client'`, email → `deleted+<id>@anonymized.invalid`, phone/phones/password cleared), sets `deleted_at`; related rows preserved; `client.delete` audit `strategy=anonymize` |
| 3.3.2 | Hard delete | `strategy:'hard'` → transactions detached (`client_id=null`, revenue preserved), training_plans + threads deleted, client row deleted; audit `clientId=null` with id in metadata |
| 3.3.3 | Not archived | ⛔ 409 "Only archived clients can be permanently deleted" |
| 3.3.4 | Name confirmation mismatch | ⛔ 400 `name_mismatch` when `confirmName` ≠ exact `"First Last"` |
| 3.3.5 | Missing confirmName | ⛔ 400 `name_mismatch` |
| 3.3.6 | Non-owner caller | ⛔ 403 (requireOwner) — even with other permissions |
| 3.3.7 | Email-unique after anonymize | Two clients anonymized in same workspace → no unique-constraint clash (per-row token) |
| 3.3.8 | Tenant isolation | Owner of A cannot permanently delete B's client | ⛔ 404 |

### 3.4 Audit timeline (`GET /clients/:id/audit`)
| # | Scenario | Expected |
|---|---|---|
| 3.4.1 | Returns timeline | ✅ archive/restore/delete + system `status.change` rows, newest first, capped at 100 |
| 3.4.2 | Mapped shape | Each row exposes `actorType`, `eventType`, `fromStatus`, `toStatus`, `metadata`, `createdAt` |
| 3.4.3 | Tenant-scoped | Only this workspace+client's rows |

**Weird:** archive → restore → archive again (multiple cycles produce multiple audit rows); permanent-delete a client that has a freeze and active plan (FK-safe transaction should not error).

---

## 4 — Daily Client Status Sync (scheduler)

**What it does:** Cron `30 0 * * *` recomputes every client's status, persists the `clients.subscription_status` snapshot when it changed, and logs a `status.change` system audit row. Read path stays computed; snapshot is only for change detection.

| # | Scenario | Expected |
|---|---|---|
| 4.1 | Active→Expired transition | Client whose period ended → snapshot updated, audit `Active→Expired`, counter incremented |
| 4.2 | No change | Status unchanged → no update, no audit row |
| 4.3 | Per-client failure isolation | One client throws → logged, loop continues for the rest (try/catch inside loop) |
| 4.4 | Null workspace skipped | Clients with `workspace_id=null` are skipped |
| 4.5 | Manual invoke | Trigger the job function directly in a test and assert DB + audit effects |

---

## 5 — Notification System (durable bell + event substrate)

**What it does:** `recordEvent()` in `lib/events.ts` is the single choke point: it writes one `notifications` row per recipient **and** fans out a realtime bell ping to `user:<id>` / `client:<id>` rooms (plus optional legacy realtime emit). Best-effort — failures are logged, never propagated. Coach bell UI at `NotificationBell.js`. 🧪 `notifications.test.ts`.

### 5.1 Event emission (domain triggers)
Verify each trigger writes durable rows to the right recipients:
| # | Trigger | Event type | Recipients |
|---|---|---|---|
| 5.1.1 | Client created | `client.created` | team members |
| 5.1.2 | Client submits check-in | `checkin.submitted` | team |
| 5.1.3 | Client sends portal message | `message.received` | team |
| 5.1.4 | Coach/messenger message | `message.received` | recipient (client/user) |
| 5.1.5 | Nutrition plan assigned | `plan.assigned` | client |
| 5.1.6 | Training plan assigned | `plan.assigned` | client |
| 5.1.7 | Payment received (webhook) | `billing.payment_received` | owners |
| 5.1.8 | Payment failed (webhook) | `billing.payment_failed` | owners |

For each: ✅ durable rows created for all recipients; ✅ bell ping emitted to each recipient room; ✅ actor excluded where applicable (`teamRecipients(excludeUserId)`).

### 5.2 Bell API (`/notifications`, coach)
| # | Scenario | Expected |
|---|---|---|
| 5.2.1 | List (happy) | ✅ Newest-first, scoped to `recipient_type='user'` + current user + workspace |
| 5.2.2 | `?unread=true` | Only rows with `read_at=null` |
| 5.2.3 | `?limit=` clamping | limit clamped to `[1,100]`; non-numeric → default 30 |
| 5.2.4 | Unread count | `GET /unread-count` → `{ count }` matching unread rows |
| 5.2.5 | Mark one read | `PATCH /:id/read` → `{updated:1}`, sets `read_at` |
| 5.2.6 | Mark already-read / foreign id | ⛔ 404 (updateMany scope prevents cross-user/workspace marking) |
| 5.2.7 | Mark all read | `PATCH /read-all` → `{updated:n}`, all unread cleared |
| 5.2.8 | Auth-denied | No session → ⛔ 401 |
| 5.2.9 | **Tenant/recipient isolation** 🧪 | User B cannot list, count, or mark User A's notifications; marking A's id returns 404 |
| 5.2.10 | Route ordering | `/unread-count` + `/read-all` resolve before `/:id/read` (specific-before-param) |

### 5.3 Durability & realtime
| # | Scenario | Expected |
|---|---|---|
| 5.3.1 | Offline recipient | Recipient offline at emit → row persists; appears on next list/count fetch |
| 5.3.2 | Reconnect | On socket connect the client refetches; bell badge correct |
| 5.3.3 | recordEvent failure | Force a DB error → logged, **originating request still succeeds** |
| 5.3.4 | Zero recipients | `recipients=[]` → no rows, no crash |
| 5.3.5 | Legacy realtime preserved | `realtime.rooms` emit still fires unchanged for existing UI-sync listeners |

---

## 6 — Master Form Templates (Super Admin) + Default Library Cloning

**What it does:** Global master form templates (`master_forms` / `master_form_questions`) — NOT workspace-scoped — are the single defaults cloned into every new workspace. Super-admin CRUD mirrors the coach form-builder. Cloning via `lib/libraryClone.ts`. 🧪 `libraryClone.test.ts`.

### 6.1 Template CRUD (`/admin/templates`)
| # | Scenario | Expected |
|---|---|---|
| 6.1.1 | List templates | ✅ Each carries `question_count`; newest first |
| 6.1.2 | Create template | ✅ Defaults `title_en='Untitled Form'`, normalized `post_action`/`form_type`; 201 with `question_count:0` |
| 6.1.3 | Update template | ✅ `updateMany`; 404 when id unknown; only provided fields change; touches `updated_at` |
| 6.1.4 | Delete template | ✅ 200 `{deleted:id}`; 404 when unknown |
| 6.1.5 | Add question | ✅ `order_index = max+1`; scale type defaults `min=1/max=10`; select/multiselect default `options=[]`; touches parent `updated_at` |
| 6.1.6 | Add question to missing template | ⛔ 404 |
| 6.1.7 | Update question | ✅ Field-by-field merge; 404 when q not under template |
| 6.1.8 | Delete question | ✅ 404 when not found |
| 6.1.9 | Reorder questions | ✅ Transactional `order_index` update for the listed ids |
| 6.1.10 | Authz | Non-super-admin blocked from `/admin/*` |

### 6.2 Cloning into a new workspace
| # | Scenario | Expected |
|---|---|---|
| 6.2.1 | Clone on register | New workspace gets copies of master forms + questions, default exercises/equipment/muscle-groups/food, etc. |
| 6.2.2 | Independence | Editing a workspace's cloned form does NOT touch the master or other workspaces |
| 6.2.3 | Counts | `getLibraryCounts` reflects cloned rows |
| 6.2.4 | Idempotent seed | Re-running `seed-default-libraries` does not duplicate master rows |

---

## 7 — Zero-Friction Onboarding & Signup Auto-Login

**What it does:** `register` creates user + workspace, **fires library cloning** (`void cloneDefaultLibraries(workspaceId)`), and sets the auth cookie so the new coach is logged in immediately. Welcome onboarding UI + dashboard hints. 🧪 `auth.test.ts`.

| # | Scenario | Expected |
|---|---|---|
| 7.1 | Register happy path | ✅ User+workspace created, auth cookie set, response usable without a separate login |
| 7.2 | Library clone kicked off | ✅ New workspace populated with defaults (async, non-blocking on the response) |
| 7.3 | Duplicate email | ⛔ Rejected, no partial workspace |
| 7.4 | Validation | Missing/invalid fields → 400 |
| 7.5 | Cookie attributes | httpOnly cookie with correct domain/options |
| 7.6 | Workspace lookup endpoint | `/client-portal/workspace` resolves slug for the mobile/portal client |
| 7.7 | Welcome onboarding | First dashboard visit shows `WelcomeOnboarding`; dismiss persists |

---

## 8 — Empty States — Web (CTA-by-variant standardization)

**What it does:** One `EmptyState` component encodes the CTA strategy in a `variant` so callers can't drift. A **creation CTA belongs only to `firstTime`**; `search`/`filter` get recovery actions (Clear), never "create". Wired into DataTable, FormsPanel, and ~10 coach/portal pages. i18n keys added (en/ar).

| # | Variant | Expected rendering | Test page examples |
|---|---|---|---|
| 8.1 | `firstTime` | Prominent: big icon (Inbox), title, description, **primary create CTA** | exercises, equipment, muscle-groups, food-items, food-categories, packages, payment-methods (empty, no filter) |
| 8.2 | `search` | Light: small SearchX icon, one-line hint, **Clear search** action — no create | any list after a no-match search term |
| 8.3 | `filter` | Light: FilterX icon, hint, **Clear filters** — no create | packages/payment-methods after a filter yields nothing |
| 8.4 | `permission` | Prominent: Lock icon + recovery CTA | a section the user can't access |
| 8.5 | `integration` | Prominent: Plug icon + Connect/Configure | setup-required surface |
| 8.6 | `error` | Prominent: TriangleAlert + Retry | failed list load |
| 8.7 | DataTable integration | Table with no rows shows correct variant based on whether a search/filter is active vs. truly empty |
| 8.8 | FormsPanel | Empty forms list shows firstTime; filtered-out shows filter recovery |
| 8.9 | i18n | All titles/hints/CTAs resolve in **en and ar**; RTL layout intact in Arabic |
| 8.10 | CTA discipline | Confirm `search`/`filter` never render a "create" button (regression guard for the whole point of the change) |

**Edge:** switch from "no data" → add data → search with no match (variant should flip firstTime→search); clearing search/filter restores the list.

---

## 9 — Empty States & Forms Filter Recovery — Mobile

**What it does:** `EmptyState` widget gains variants; `forms_page.dart` adds filter recovery; `restricted_view.dart` uses the `permission` variant. 🧪 `empty_state_test.dart`, plus existing widget test.

| # | Scenario | Expected |
|---|---|---|
| 9.1 | Forms list empty (no forms) | firstTime-style empty state |
| 9.2 | Forms filtered to nothing | Filter recovery empty state with a **Clear/Reset filter** action that restores the full list |
| 9.3 | Restricted module | `RestrictedView` renders `permission` variant: lock icon, restricted title, message, **Refresh** button that calls `accessController.refresh()` |
| 9.4 | Variant rendering | Widget test asserts each variant renders its icon/title/action |
| 9.5 | i18n | `app_en.arb` / `app_ar.arb` new keys present and resolve; Arabic RTL correct |

---

## 10 — Mobile Client Access Gating

**What it does:** Mobile mirrors the backend access policy. `ClientAccess` is a read-only mirror of `/client-portal/access` (also embedded in `/me`); pages query `access.canMessage` etc. via a permission layer. Cached, controller-driven, with a permissive `allAllowed()` default while loading. Key files under `core/access/`. 🧪 `client_access_test.dart`.

| # | Scenario | Expected |
|---|---|---|
| 10.1 | Parse `/access` JSON | `ClientAccess.fromJson` maps the 10 snake_case flags + `status`+`withinGrace` |
| 10.2 | Null/absent `access` | Falls back to `allAllowed()` (new/unknown client never locked out; backend still enforces) |
| 10.3 | Status parsing | `active`/`pre-start`/`expired`/`frozen`/`cancelled`/`no subscriptions` + aliases → enum; unknown → `unknown` |
| 10.4 | `isRestricted` | True only when (expired or frozen) AND not within grace |
| 10.5 | `canViewForms` | True if assessments OR check-ins allowed |
| 10.6 | Permission layer per tab | Training/Nutrition/Messages/Forms/Progress tabs hide or gate content per the corresponding flag |
| 10.7 | Restricted nav | Direct nav / deep-link / push / saved route into a disallowed module → `RestrictedView`; backend also returns 403 (defense in depth) |
| 10.8 | Status banner/card | Expired/frozen (not in grace) surfaces `SubscriptionStatusBanner` / `SubscriptionStatusCard` |
| 10.9 | Refresh | Refresh action re-fetches `/access`; UI updates when coach changes policy |
| 10.10 | Cache | `access_cache` persists last access; survives app restart, re-validated on launch |
| 10.11 | Optimistic load | While access loads, an active client never sees content briefly hidden (allAllowed default) |
| 10.12 | Grace window | Expired-in-grace client behaves as Active (no banner, full access) |
| 10.13 | Archived client | Portal closed → all modules restricted / login blocked |

---

## 11 — Mobile Client App Phases 4–7 (regression smoke)

These landed within the window; smoke-test the core paths.

| # | Feature (commit) | Smoke test |
|---|---|---|
| 11.1 | Training Mode session/history/progress (`52bea69`) | Start a session, log sets, finish → history entry created; progress charts render; history detail opens |
| 11.2 | Forms list + dynamic form fill (`5456842`) | Open assigned form, fill each field type, submit → success; required-field validation blocks submit |
| 11.3 | Coach chat / messages (`c3ab155`) | Send a message → appears in thread; receive reply |
| 11.4 | Home dashboard (`49ef14c`) | Dashboard loads real data (active plan, next session, status) without errors |
| 11.5 | Realtime chat via Socket.IO + polling fallback (`a1a2d29`) | Message arrives in realtime when connected; with socket down, polling still delivers; reconnect resumes realtime |
| 11.6 | Login show/hide password (`36b1e66`) | Toggle reveals/hides password field |

**Gating interaction (cross-feature):** for each of 11.1–11.5, repeat with an **expired/frozen** client whose policy disables that module → content gated + backend 403 (ties §2 + §10).

---

## Cross-cutting / non-functional checks
- **Tenant isolation everywhere:** every new query (policies, notifications, audit, archive) is filtered by `workspace_id`; add a paired-workspace test for each surface.
- **Migrations apply clean** on a fresh DB: `022_default_libraries`, `023_master_forms`, `024_subscription_access_policies`, `025_client_archiving`, `026_notifications`.
- **Audit best-effort:** `logSubscriptionAudit` / `recordEvent` failures never break the originating request.
- **i18n parity:** en/ar catalogs (web `messages/*.json`, mobile `*.arb`) have matching keys; no missing-key fallbacks; Arabic RTL intact.
- **Route ordering:** specific-before-param confirmed in clients, notifications routes.
- **Build/lint/tests green** before merge (Pre-Merge routine).

---

## Suggested automated-test gaps to add
- Portal gating: an integration test per flag asserting 403 vs 200 (only `subscriptionPolicies`/`clientArchiving` integration tests exist today).
- Scheduler: a unit test invoking `scheduleClientStatusSync`'s tick directly against seeded clients.
- Notifications: assert actor-exclusion and owner-only recipients for billing events.
- Onboarding: assert library clone actually populated the new workspace (not just that register returns a cookie).
