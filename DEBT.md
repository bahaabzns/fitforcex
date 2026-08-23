# DEBT.md — Technical Debt Register

Format:
```
## [date] — [file]
**Type:** Shortcut / Knowledge / Dependency / Documentation
**What:** One sentence
**Why it matters:** Consequence if ignored
**Effort:** Small / Medium / Large
**Priority:** High / Medium / Low
```

---

## 2026-05-25 — All recent commits
**Type:** Knowledge
**What:** Last 5 commits use non-standard messages ("payments, landing", "payment", "fix stuff"-style) that violate the commit format rule in CLAUDE.md.
**Why it matters:** History becomes unreadable. Can't grep for `feat:` / `fix:` to understand what changed and when.
**Effort:** Small (adopt format going forward — no retroactive rewrite needed)
**Priority:** High
✅ RESOLVED 2026-06-04 — Adopted correct format in all subsequent commits. No retroactive rewrite needed.

---

## 2026-06-24 — client (no toast system)
**Type:** Shortcut
**What:** The Client Archiving spec asked for toast notifications, but the app has no toast/sonner system wired up (only documented in DESIGN_SYSTEM.md). Archive/restore/delete feedback uses inline success messages + redirect instead.
**Why it matters:** Inconsistent UX vs. the design intent; future success/error feedback will keep reinventing inline banners until a shared toaster exists.
**Effort:** Medium (add a Toaster provider + useToast hook, migrate inline banners)
**Priority:** Low

## 2026-06-24 — server/prisma (unused workspaces column)
**Type:** Shortcut
**What:** workspaces.client_deletion_strategy is no longer read or written — the deletion strategy is now chosen per-deletion in the danger-zone modal. The column remains with its default.
**Why it matters:** Dead column; a future reader may assume it drives behavior.
**Effort:** Small (drop column in a follow-up migration)
**Priority:** Low

## 2026-06-24 — server/src/modules/clients (anonymize scope)
**Type:** Shortcut
**What:** Permanent-delete "anonymize" scrubs the clients-table PII (name/email/phone/password) only; coaching notes in client_observations are left intact (the modal copy reflects this — name/email/phone).
**Why it matters:** If "notes" anonymization is later required, anonymizeClient must be extended.
**Effort:** Small (clear client_observations.content on anonymize)
**Priority:** Low

---

## 2026-05-25 — Project root (all doc files)
**Type:** Documentation
**What:** PROJECT.md, DEBT.md, DEPENDENCIES.md, GLOSSARY.md, WHY.md, LEARNING.md, REVIEWS.md were never created at project start.
**Why it matters:** No record of decisions, dependencies, or learning. Debt accumulates invisibly.
**Effort:** Small (addressed this session — files created 2026-05-25)
**Priority:** High
✅ RESOLVED 2026-05-25 — All documentation files created in session opening debt fix.

---

## 2026-05-25 — client/app/components/LandingPricing.js (lines 131–134)
**Type:** Shortcut
**What:** Commented-out `<h3>` and `<p>` header block left inside the `isInline` branch — dead code, never rendered.
**Why it matters:** Violates "no commented-out code" rule. Adds noise and confusion for future readers.
**Effort:** Small (delete 4 lines)
**Priority:** Medium
✅ RESOLVED 2026-05-25 — Removed commented-out block.

---

## 2026-05-25 — client/app/(coach)/[workspaceSlug]/settings/billing/page.js (line 43)
**Type:** Shortcut
**What:** `loadBilling` is a plain function defined inside the component body, referenced in two `useEffect` hooks. This creates a stale closure risk — if state or props it depends on change, the effects won't re-run with fresh values.
**Why it matters:** Could cause silent data staleness bugs if `loadBilling` ever needs to read component state or props.
**Effort:** Small (wrap in `useCallback` with correct deps array)
**Priority:** Medium
✅ RESOLVED 2026-06-04 — Wrapped in `useCallback([t])`, mount effect deps updated to `[loadBilling]`.

---

## 2026-05-25 — client/app/(coach)/[workspaceSlug]/settings/billing/page.js (lines 113–114)
**Type:** Knowledge
**What:** `isFreePlan` expression uses mixed `&&` / `||` without parentheses, making operator precedence non-obvious. The last `|| subscription?.planDisplay?.toLowerCase() === 'free'` evaluates independently of the first condition.
**Why it matters:** Logic is harder to reason about and could produce unexpected `true` values. Not currently a bug but fragile.
**Effort:** Small (add explicit parentheses or rewrite as a single clear condition)
**Priority:** Low
✅ RESOLVED 2026-06-04 — Added explicit outer parens; simplified `=== null || === undefined` to `== null`.

---

## 2026-05-25 — client/app/components/Sidebar.js (line 77)
**Type:** Shortcut
**What:** `handleLogout` uses `console.log(err)` on error instead of `console.error(err)`.
**Why it matters:** Minor — errors won't appear in browser error filters, and sensitive stack traces could be logged at wrong severity.
**Effort:** Small (one-character fix)
**Priority:** Low
✅ RESOLVED 2026-05-25 — Changed to `console.error`.

---

## 2026-05-25 — Project structure
**Type:** Knowledge
**What:** No `dev` branch exists — all active development is committed directly to `main`.
**Why it matters:** `main` should be production-only per CLAUDE.md branch strategy. Direct commits to main skip the safety buffer of a dev branch.
**Effort:** Small (create `dev` branch, establish branch workflow going forward)
**Priority:** High
✅ RESOLVED 2026-05-25 — Created `dev` branch from `main`. `feature/load-plan` merged and cleaned up. All future feature branches will branch off `dev`.

---

## 2026-05-25 — server/server.js + all API routes
**Type:** Shortcut
**What:** `mutationLimiter` (100 req/min) is applied to all HTTP methods including GETs on every API route. The training and nutrition pages trigger N+1 fetches on load (1 summary + 1 per plan), so a coach with many clients could hit the cap.
**Why it matters:** Could cause 429s on the training/nutrition pages for workspaces with large plan counts — the same root cause that caused the `uploadLimiter` 429 on `workspace-library`.
**Effort:** Medium (split into `readLimiter` with higher cap and `mutationLimiter` applied only to POST/PUT/DELETE, or migrate plan fetching to a single bulk endpoint)
**Priority:** Medium
✅ RESOLVED 2026-06-04 — Added `readLimiter` (500/min). Added `apiLimiter` middleware that routes GETs to `readLimiter` and mutations to `mutationLimiter`. All API routes now use `apiLimiter`.

---

## 2026-05-25 — client/app/components/LoadPlanModal.js (line 87)
**Type:** Shortcut
**What:** The workspace-library fetch in `useEffect` has no AbortController cleanup, so `setPlans` can be called after the modal unmounts if the request is still in flight.
**Why it matters:** Benign in React 18 (no crash), but produces a stale state update. Clean pattern is to abort on cleanup.
**Effort:** Small (add AbortController, pass `signal` to axios)
**Priority:** Low
✅ RESOLVED 2026-06-04 — Added AbortController; signal passed to axios; cleanup returns `controller.abort()`.

---

## 2026-06-04 — server/lib/planEngine.js
**Type:** Knowledge
**What:** planEngine.js was refactored (~426 line diff) with no automated test coverage in place.
**Why it matters:** Any regression in plan creation, insertion, or serialization will only surface at runtime when a coach reports broken plan behaviour. No safety net exists.
**Effort:** Medium (write integration tests covering insertPlanTree, serializePlanRow, and the main CRUD paths)
**Priority:** High
⚠️ BLOCKED 2026-06-04 — No test runner configured (package.json has no `test` script). Requires Jest setup before tests can be written. Remains High priority.

---

## 2026-06-04 — client/app/(client)/portal/login/*
**Type:** Knowledge
**What:** portal/login/error.js, portal/login/loading.js, portal/login/page.js, and portal/page.js were deleted. The assumption is that root-level auth covers these routes, but no redirect audit was done.
**Why it matters:** A broken or missing redirect leaves clients hitting a dead-end URL with no visible error.
**Effort:** Small (audit middleware redirect paths for /portal and /portal/login)
**Priority:** Medium
✅ RESOLVED 2026-06-04 — Audited: login now lives at `/portal/[coachSlug]`. Old `/portal` fallback in layout.js pointed to deleted page — fixed to redirect to `/` instead.

---

## 2026-06-08 — client/app/(auth)/verify-email-required/page.js
**Type:** Shortcut
**What:** The "Verify later" `onPress` handler is inlined inside the JSX instead of being extracted to a named function above the return.
**Why it matters:** Inline handlers cause the function to be re-created on every render and make the component harder to read and test.
**Effort:** Small (extract to `const handleVerifyLater = () => ...` above the return statement)
**Priority:** Low

---

## 2026-06-08 — client/app/(auth)/login/page.js
**Type:** Documentation
**What:** `<a href="/forgot-password">Forgot password?</a>` uses a hardcoded string instead of `t('forgotPassword')` like all other text in that file.
**Why it matters:** This string won't be translated when Arabic locale is active — a broken experience for Arabic users.
**Effort:** Small (add `forgotPassword` key to auth translation files and use `t('forgotPassword')`)
**Priority:** Medium

---

## 2026-06-08 — client/app/(coach)/[workspaceSlug]/nutrition/page.js (line 952)
**Type:** Shortcut
**What:** `console.error` left in the nutrition page (line 952) — logs internal error details to the browser console.
**Why it matters:** Exposes implementation details in production; violates the pre-commit checklist rule on sensitive console output.
**Effort:** Small (remove the console.error call)
**Priority:** Low

---

## 2026-06-08 — messenger/page.js + portal/messages/page.js
**Type:** Shortcut
**What:** handleSend and handleToggleStatus swallow errors silently — user gets no feedback when a send or status toggle request fails.
**Why it matters:** A network failure looks identical to success; user thinks message sent but it didn't.
**Effort:** Small (add inline error state or toast on catch blocks)
**Priority:** Medium

---

## 2026-06-08 — messenger/page.js (566 lines)
**Type:** Knowledge
**What:** Coach messenger page exceeds the 200-line file limit (566 lines). Helper functions and three panel sections are all in one file.
**Why it matters:** Increasingly hard to navigate and review as more features are added.
**Effort:** Medium (extract helpers to messengerHelpers.js; extract ThreadListPanel, ChatPanel, ClientProfilePanel components)
**Priority:** Low

---

## 2026-06-08 — messenger/page.js + portal/messages/page.js
**Type:** Shortcut
**What:** buildSegments, bubbleRadius, getDateLabel, and formatGroupTime are duplicated identically in both files.
**Why it matters:** A change to message grouping logic must be applied in two places — will drift over time.
**Effort:** Small (extract to src/utils/messengerHelpers.js and import in both)
**Priority:** Medium

---

## 2026-06-08 — messenger/page.js line 61 + portal/messages/page.js line 39
**Type:** Shortcut
**What:** Magic number 5 * 60 * 1000 (5-minute grouping window) is inline with no name.
**Why it matters:** A product decision about grouping threshold is invisible and hard to change.
**Effort:** Small (extract to MESSAGE_GROUP_WINDOW_MS constant at top of file or in messengerHelpers.js)
**Priority:** Low

---

## 2026-06-10 — server/src/middleware/auth.ts + server/src/modules/auth/auth.service.ts
**Type:** Shortcut
**What:** hashToken was duplicated — identical SHA-256 function defined privately in auth.ts and exported from auth.service.ts.
**Why it matters:** Algorithm divergence would silently break all session lookups.
**Effort:** Small
**Priority:** Medium
✅ RESOLVED 2026-06-10 — Removed private copy in auth.ts; now imports hashToken from auth.service.

---

## 2026-06-10 — server/src/modules/auth/auth.routes.ts
**Type:** Shortcut
**What:** GET /me had no authMiddleware — it called jwt.verify() directly without checking the user_sessions table. A revoked token could still read user profile data.
**Why it matters:** Phase 4 security guarantee was broken for the /me endpoint.
**Effort:** Small
**Priority:** High
✅ RESOLVED 2026-06-10 — Added authMiddleware to /me route; getMe now uses req.user from validated session.

---

## 2026-06-10 — server/user_sessions table
**Type:** Knowledge
**What:** The user_sessions table has no automatic cleanup. Revoked and expired rows accumulate forever without a scheduled job.
**Why it matters:** Table will grow unboundedly in production. Phase 7 (schedulers) adds scheduleSessionCleanup() — must run Phase 7 before production deploy.
**Effort:** Small (resolved when Phase 7 is implemented)
**Priority:** Medium
✅ RESOLVED 2026-06-10 — scheduleSessionCleanup() deletes sessions with revoked_at or expires_at older than 30 days, runs daily at 2 AM.

---

## 2026-06-10 — server/src/middleware/scheduler.ts
**Type:** Shortcut
**What:** scheduleFormDispatcher() updates pending forms one at a time in a loop — one DB round-trip per form.
**Why it matters:** Degrades under a large backlog of pending forms; each update is a separate query.
**Effort:** Small (replace loop with a single updateMany call when needed)
**Priority:** Low

---

## 2026-06-10 — messenger, clientPortal, nutrition, training controllers
**Type:** Knowledge
**What:** getIo() throws if called before initSocket(). Phase 9 integration tests that hit sendMessage or activatePlan will fail unless testServer.ts calls initSocket() with a mock http server, or getIo is mocked via jest.mock.
**Why it matters:** Any integration test covering these endpoints will crash with "Socket.io not initialised" until a test helper is wired up.
**Effort:** Small (add initSocket call in testServer.ts helpers during Phase 9)
**Priority:** Medium

---

## 2026-06-10 — server/src/config/swagger.ts
**Type:** Knowledge
**What:** The Swagger spec uses a .ts file glob (`./src/modules/**/*.routes.ts`) that works in development but resolves to nothing in a compiled production build (dist/) where only .js files exist.
**Why it matters:** /api-docs will render empty in production unless the glob is updated to point at .js files or the spec is pre-generated at build time.
**Effort:** Small (either switch glob to dist/src/modules/**/*.routes.js or add a build step that runs swagger-jsdoc CLI to output swagger.json)
**Priority:** Low

---

## 2026-06-10 — server/tests/helpers/setup.ts
**Type:** Knowledge
**What:** Global `beforeEach` in setup.ts calls `resetTestDb()` for every test in every suite, including pure unit tests that have no DB dependencies.
**Why it matters:** Unit tests are slower than necessary; if the test DB is unavailable, unit tests fail even though they never query the DB.
**Effort:** Small (move DB reset into integration test files directly, remove it from the global setup file)
**Priority:** Low

---

## 2026-06-10 — server/package.json
**Type:** Dependency
**What:** `ts-jest@^29.4.11` installed alongside `jest@^30.3.0` — peer dep mismatch (ts-jest v29 declares jest v29 as peer).
**Why it matters:** Tests pass today but future Jest 30-only APIs could hit the compatibility shim and produce unexpected failures.
**Effort:** Small (upgrade ts-jest to v30 once stable, or pin jest to ^29 until ts-jest v30 ships)
**Priority:** Medium

---

## 2026-06-10 — server/src/app.ts
**Type:** Knowledge
**What:** `totalRequests` counter in `/api/metrics` lives in-process memory and resets to zero on every server restart or deploy.
**Why it matters:** Metrics will silently undercount traffic after any redeploy — misleading in production where restarts are frequent.
**Effort:** Medium (replace with Redis counter or prometheus-client for persistent counters)
**Priority:** Low

---

## 2026-06-11 — server/tests (jest harness)
**Type:** Knowledge
**What:** Running multiple test suites in one `npm test` run crashes with "Jest worker ran out of memory"; suites only pass when run one at a time. Root cause is the global `resetTestDb()` setup (see setup.ts entry above) plus per-worker Prisma clients not being torn down.
**Why it matters:** `npm test` cannot produce a green full-suite run locally, so the Pre-Commit / Pre-Merge "all tests pass" gate can't be satisfied as written — reviewers fall back to running suites individually.
**Effort:** Medium (tear down Prisma per worker, or set `--workerIdleMemoryLimit`, and move DB reset out of global setup)
**Priority:** Medium

---

## 2026-06-11 — client/package.json (next 16.2.4)
**Type:** Dependency
**What:** `next@16.2.4` has known CVEs (high), fixed by a non-major bump to `next@16.2.9`. Several are "Middleware/Proxy bypass" issues — directly relevant since the subdomain feature will add a `proxy.ts`.
**Why it matters:** Proxy-bypass and cache-poisoning bugs could let requests skip tenant/auth handling once we rely on proxy for subdomain routing.
**Effort:** Small (npm install next@16.2.9, then re-run build + smoke test against the modified-Next conventions)
**Priority:** High
✅ RESOLVED 2026-06-11 — Upgraded to next@16.2.9. Build clean. HIGH CVEs cleared; 3 moderate remain in postcss via next-intl (fix requires breaking downgrade — not viable).

---

## 2026-06-11 — client/app/(client)/portal/layout.js
**Type:** Shortcut
**What:** Pre-existing `react-hooks/set-state-in-effect` error: `setLoading(false)` is called synchronously in the effect body (line ~17). Left untouched during the subdomain feature to avoid unrelated refactoring.
**Why it matters:** React 19 flags this as an error (cascading renders); will surface if/when ESLint is wired into CI or the build.
**Effort:** Small (derive initial loading from isLoginPage, or guard the set)
**Priority:** Low

---

## 2026-06-11 — client (deferred: subdomain root redirect)
**Type:** Knowledge
**What:** Bare workspace subdomain root (slug.fitforce.io/) shows the landing page instead of the portal. Planned fix is a `proxy.ts` rewrite to /portal, deferred until next@16.2.9 (see next security debt above).
**Why it matters:** Minor UX — clients who omit /portal see the marketing page. Blocked on the Next upgrade so we don't add a proxy on a proxy-bypass-vulnerable Next.
**Effort:** Small (add proxy.ts after upgrade; keep it cosmetic, never an auth gate)
**Priority:** Low

---

## 2026-06-11 — server/src/app.ts (helmet CSP)
**Type:** Shortcut
**What:** CSP directives hardcode production domains: connectSrc uses fitforce.io/*.fitforce.io, but frameAncestors uses fitforceapp.com/*.fitforceapp.com. Canonical domain CONFIRMED as fitforce.io, so frameAncestors is stale and should be fitforce.io/*.fitforce.io. Domains should derive from ROOT_DOMAIN.
**Why it matters:** frame-ancestors allowing fitforceapp.com (an unused domain) weakens clickjacking protection — it permits an unintended host to embed API responses. Hardcoding also drifts from the real domain over time.
**Effort:** Small (build CSP arrays from env.ROOT_DOMAIN; replace fitforceapp.com with fitforce.io)
**Priority:** Medium

---

## 2026-06-11 — Bug: packages page crashes on create (package_variations vs variations)
**Severity:** High
**Root Cause:** The packages API returned the Prisma relation as `package_variations`, but request bodies and the entire client use `variations`. The packages page iterates `pkg.variations`, so the first time a workspace had any package the response shape mismatch threw "pkg.variations is not iterable".
**How It Was Found:** Manual testing — creating the first package while smoke-testing the subdomain feature.
**Fix Applied:** Added `serializePackage`/`serializePackages` (packages.serializer.ts) and applied them at all four `packages.controller` response sites, so the relation is exposed as `variations`. API is now symmetric (variations in both request and response).
**Why It Was Not Caught Earlier:** Workspaces had zero packages, so the empty list never iterated; no integration test covered the create→list response shape.
**Prevention:**
  → New test added: yes (tests/unit/packages.serializer.test.ts)
  → New validation added: no
  → DEBT.md item added: this entry

---

## 2026-06-11 — deploy.sh + server/package.json
**Type:** Knowledge
**What:** PM2 runs `server/server.js` (JavaScript). The TypeScript server (`src/`) is not deployed — `deploy.sh` has no `npm run build` step, and `typescript` is a devDependency so `npm ci --omit=dev` cannot compile it. The TS rewrite is effectively dev-only until the deploy path is updated.
**Why it matters:** All new feature code in `src/` (auth refactor, session validation, RBAC, schedulers, Prisma controllers) is unreachable on staging and production. The old JavaScript server continues to serve all requests.
**Effort:** Small (add `npm install --include=dev && npm run build && npm prune --omit=dev` to deploy.sh; update PM2 ecosystem to point at `dist/server.js`)
**Priority:** High
✅ RESOLVED (confirmed 2026-07-15) — `deploy.sh` now builds the server (`npm run build`) before restarting PM2, and `pm2 describe fitforce-api` on the VPS confirms `script path: /home/fitforce/app/server/dist/server.js`. The compiled TypeScript server is what's actually live. Not clear exactly when this was fixed; left unmarked until verified during this session's Pre-Deploy check.

---

## 2026-06-11 — server/src/modules/auth/auth.controller.ts (switchWorkspace + JWT) + client/app/(coach)/layout.js
**Type:** Knowledge
**What:** Active workspace is a mutable claim baked into the JWT and stored in one shared `token` cookie; the URL slug is reconciled to match the token rather than the URL being the source of truth. Industry best practice for multi-tenant SaaS (Vercel/Linear/GitHub) is the inverse: the session authenticates the user + which workspaces they may access, and the active workspace is derived per request from the URL slug. Decision made 2026-06-11 to keep the current design for now.
**Why it matters:** Multi-tab correctness bug — because the cookie holds a single "active" workspace shared across tabs, switching workspace in tab B silently changes the active workspace for in-flight requests in tab A, even though tab A's URL still shows the old slug. The reconciliation effect in layout.js (line ~93) only fixes this on navigation, not for API calls already in flight. Low impact while coaches use one workspace at a time; bites once they genuinely juggle multiple workspaces.
**Effort:** Large (move active-workspace authority out of the JWT to per-request derivation from the URL slug; authorize membership of the slug's workspace on every protected endpoint; `switch-workspace` mostly disappears — switching becomes navigation)
**Priority:** Medium
**Mitigation in place:** `buildTokenForWorkspace` validates the user is a member before issuing a token for a workspace, so the current model is safe (no cross-tenant access) — just not multi-tab-correct.

---

## 2026-06-24 — server/src/modules/subscriptionPolicies/subscriptionPolicies.service.ts (resolveClientPackageId)
**Type:** Shortcut
**What:** A client is mapped to its package for per-package policy override resolution by matching `clients.current_package` (a package-variation *name* string) to `package_variations.name`. There is no FK from clients/transactions to packages.
**Why it matters:** If two variations share a name, or a variation is renamed/deleted, override resolution can match the wrong package or silently fall back to the global policy. Affects only the package-override feature, not the global policy.
**Effort:** Medium (add a `package_id` column to transactions and/or clients, backfill, and resolve by id)
**Priority:** Medium
✅ RESOLVED 2026-07-06 — Package Lifecycle project, Phase 0. Added `transactions.package_variation_id` / `clients.current_package_variation_id` FK columns (migration `029_package_variation_fk.js`), backfilled from the composed "Package — Variation" label (`scripts/backfill-package-variation-ids.ts`), and rewrote `resolveClientPackageId()` to read the FK directly — no name matching remains in the resolver. The backfill also surfaced that the *old* name-matching logic compared the composed label against the bare variation name and had never actually matched any real row (0/23 transactions, 0/19 clients on local data before the fix), meaning package-specific policy overrides likely never took effect in production either; see `docs/package-lifecycle-implementation-plan.md` §18.4 for the full writeup and the recommended production heads-up.

---

## 2026-06-24 — server/src/middleware/scheduler.ts (scheduleClientStatusSync)
**Type:** Shortcut
**What:** The daily client status-sync job recomputes status one client at a time (3 queries per client via computeClientStatus), instead of the bulk per-workspace query pattern used by clients.controller getClients.
**Why it matters:** Fine at current scale, but the per-client round-trips will degrade as client counts grow; it's a single-instance in-process cron with no horizontal-scale story.
**Effort:** Medium (batch per workspace; reuse a shared bulk status helper extracted from getClients)
**Priority:** Low

---

## 2026-07-07 — server/src/modules/forms, server/prisma (Forms Versioning follow-ups)
**Type:** Knowledge
**What:** Three items deliberately deferred during the Forms Versioning project (see `docs/forms-architecture-investigation.md`, `docs/forms-versioning-architecture-decision.md`, `docs/forms-versioning-implementation-plan.md`):
1. `notifications.entity_id` has no FK to anything (plain string). A `form_request` a notification points at can still be deleted (`cancelQueue`/`deleteRequest`, pending/scheduled only) leaving a dangling pointer — pre-existing, unrelated to this project, not introduced or fixed by it.
2. Form-level metadata (`title_en`, `form_type`, `post_action`) is deliberately NOT versioned per the ADR — only the question set is. `post_action` is already denormalized onto `form_requests` at creation time (unaffected by later edits); `form_type`/`title_en` are not. If this ever becomes a real coach complaint (a historical submission showing the *current* form title/type instead of what it was at submission time), the fix is an independent, small addition (denormalize onto `form_requests` the same way `post_action` already is) — not a reopening of the versioning architecture.
3. The Phase 1 backfill's "when was version 1 sealed" timestamp for pre-existing forms is best-effort (earliest `form_requests.requested_at`, or left unsealed if the form had none) — pre-migration provenance is inherently approximate, since multiple silent edits may already have blurred what "version 1" meant for old data. This is a one-time cutover limitation, not an ongoing gap.
**Why it matters:** None of these block correctness of the shipped feature; they're follow-up candidates if product priorities surface them.
**Effort:** Small each
**Priority:** Low

---

## 2026-07-07 — server/prisma (pre-existing unindexed FKs, out of Forms Versioning's scope)
**Type:** Shortcut
**What:** `forms.workspace_id`, `form_requests.workspace_id`/`client_id`, and `check_in_schedules.workspace_id` are FK columns with no index. Discovered during the Forms Versioning Release-Readiness Review's FK-indexing audit, alongside (now-fixed, migration 041) unindexed Forms-Versioning-owned columns — these four predate the project and were never touched by any of its migrations, so they were deliberately left alone to keep migration 041 scoped to what the project actually introduced or modified.
**Why it matters:** Same category of risk as the ones just fixed — tenant-scoped queries filtering by `workspace_id` on these tables do a sequential scan rather than an index scan as row counts grow.
**Effort:** Small (a single additive migration, same shape as 041)
**Priority:** Low-Medium

## 2026-07-07 — server/src/modules/clients/clients.controller.ts (buildTransformationPayload)
**Type:** Shortcut → ✅ RESOLVED 2026-07-07
**What:** `buildTransformationPayload` (backs both the coach's client-transformation view and the client portal's progress page) only included `form_requests` with `status: 'submitted'` — the moment a coach reviewed a check-in/assessment (`status` → `'reviewed'`), it silently dropped out of progress charts and metric history. Pre-existing, predates Forms Versioning (this function's JOIN target changed in Phase 3; this filter did not) — found by Forms Versioning's Release-Readiness Review end-to-end lifecycle test (`tests/integration/formsVersioningLifecycle.test.ts`), which was the first test to exercise "submit → review → check the chart" in sequence.
**Why it matters:** Every reviewed submission's data point was invisible to the exact people who needed to see it (the coach tracking progress, the client checking their own history) — arguably the single most product-visible bug found during this whole project.
**Effort:** Small — one-line filter change (`status: { in: ['submitted', 'reviewed'] } }`)
**Priority:** High
✅ RESOLVED 2026-07-07 — fixed in the same commit as the Forms Versioning Release-Readiness Review pass.

---

## 2026-07-12 — Metric Management UI (deferred Phase 6 of Question→Metric/Attachment/Save-Workflow work)
**Type:** Shortcut (deliberately deferred, not a bug)
**What:** "Track as Metric" (server/src/modules/forms/forms.controller.ts's `trackQuestionAsMetric`) has no corresponding "untrack" action — once a question is linked to a metric and its history backfilled, reversing it requires a manual DB update. There's also no UI for renaming/archiving a metric or jumping from a metric back to its originating question, even though the underlying CRUD (`metrics.controller.ts`'s `updateMetric`/`deleteMetric`) and the reverse FK (`form_version_questions.metric_id`) already support it.
**Why it matters:** A coach who tracks the wrong question as a metric can't cleanly undo it from the UI. Low risk in practice — the preview-count confirmation step is the safety gate before tracking — but worth closing before "Track as Metric" sees heavy use.
**Effort:** Medium — one new `untrackMetric` endpoint (clear `metric_id`, decide whether to leave backfilled `form_responses.metric_id` in place or revert it) + a small `GET /metrics/:id/questions` endpoint + a metrics-management UI section.
**Priority:** Low

---

## 2026-07-15 — client/lib/coachSlug.js (buildPortalUrlFromParts)
**Type:** Knowledge — failing test, pre-existing, not caused by any change in this session
**What:** `buildPortalUrlFromParts` returns `https://pola.fitforce.io` but its test (`lib/coachSlug.test.js`) expects `https://pola.fitforce.io/portal`. Either the function is missing a `/portal` suffix it should produce, or the test's expectation is stale from a routing change. Last touched by commit `75032ac` (fitforce.app domain parity work), predates this session's secret-rotation/Pre-Deploy work.
**Why it matters:** `npm test` in `client/` fails (2/25 tests), blocking a clean "tests green" gate on every deploy until resolved. Unclear whether portal links built by `buildPortalUrl`/`buildPortalUrlFromParts` are missing a required `/portal` path segment in production — worth confirming this isn't a live link-building bug, not just a stale test.
**Effort:** S
**Priority:** M — not blocking this deploy (unrelated to what's shipping), but should be resolved soon since it currently masks the Pre-Deploy tests-green gate.

---

## 2026-07-12 — Mobile Forms (no coach-side response viewer)
**Type:** Shortcut (pre-existing, confirmed during the Attachment question type work)
**What:** The Flutter app has no coach-facing surface for viewing submitted form answers — `forms_page.dart` only lists/manages requests. This meant the Attachment question type's category-aware preview (image inline / PDF / file chip) built for the web Coach Portal (Phase 3/5) has no mobile equivalent to extend, since there's nothing there to begin with.
**Why it matters:** A coach using the mobile app has no way to review a client's check-in/assessment answers, attachments included — they must switch to the web app.
**Effort:** Large — a new mobile page/feature, not a small addition.
**Priority:** Low (matches the existing product gap; not a regression introduced by this work)

---

## 2026-07-23 — server/.env.test database (fitforce_x_test) has no migration history and pre-existing FK drift
**Type:** Knowledge
**What:** Adding the `insight_prompts.repeat_interval_days` column (this session's Founder Prompts recurring-pulse feature) required a migration on the dev DB, which applied cleanly via `prisma migrate deploy`. The same command against the test DB failed with P3005 ("schema is not empty") — its `_prisma_migrations` history table was never initialized, so Prisma can't tell what's already applied. Falling back to `prisma db push` against the test DB also failed, independently, on a pre-existing FK violation: orphaned `check_in_schedules` rows referencing missing `clients`. Worked around by hand-patching just the one new column directly via `pg` against `TEST_DATABASE_URL` — the test suite passes, but the test DB's schema history is unmanaged.
**Why it matters:** Every future migration will hit the same P3005 wall on the test DB until it's baselined (`prisma migrate resolve --applied <migration>` for the history, plus cleaning the orphaned `check_in_schedules` rows so `db push`/`migrate deploy` can run cleanly). Until then, schema changes require the same manual-patch workaround every time, which is easy to forget and silently drifts the test DB from `schema.prisma`.
**Effort:** Small–Medium (delete/fix orphaned `check_in_schedules` rows, then `prisma migrate resolve --applied` for each of the 3 existing migrations to establish history, or re-seed the test DB from scratch)
**Priority:** Medium

---

## 2026-07-15 — Recurring class of bug: schema.prisma edited without a committed migration
**Type:** Process gap (root cause behind three separate incidents: 043/044, 045, and 046)
**What:** At least three times now, a column got added to `schema.prisma` and the app code started writing to it, without a `server/migrations/*.js` file ever being committed for it. Locally the bug is invisible because dev databases pick the column up via an out-of-band `prisma db push`/`db pull`; production only runs committed migrations (`npm run migrate`), so it 500s on the first write to the missing column. Migration 046 (`form_responses.metric_id`) is the latest instance — client-portal form submission was 500ing in production with `The column metric_id does not exist in the current database` until this migration shipped.
**Why it matters:** This is silent until a real user hits the write path in production — nothing in CI or local dev catches it, because `schema.prisma` and the DB agree locally even when the migration history doesn't.
**Effort:** Small — a CI/pre-deploy check that runs `prisma migrate diff --from-migrations server/migrations --to-schema-datamodel server/prisma/schema.prisma` (or applies all committed migrations to a scratch DB and diffs against `schema.prisma`) and fails the build on drift.
**Priority:** High — cheap to add, and each incidence so far has meant a real production outage on a live write path before anyone noticed.

---

## 2026-07-23 — deploy.sh built Next.js in-place under the live process ✅ RESOLVED 2026-07-23
**Type:** Shortcut
**What:** `deploy.sh` ran `npm run build` directly into `client/.next` while `pm2`'s `fitforce-web` (`next start`) was still serving traffic from that same directory. Turbopack/webpack rewrite content-hashed chunk filenames on every build, so any SSR request landing mid-build looked up a chunk the build had just deleted or renamed, throwing `Error [ChunkLoadError]` / `MODULE_NOT_FOUND` as an **unhandled rejection** — the request never got a response, so affected users saw an infinite loading spinner / blank page (not a clean error), reproducible for anyone hitting the site during that window regardless of browser/network/device. Confirmed in `web-error-1.log` across three separate incidents (2026-07-21 10:24, 2026-07-22 21:48–22:05) and matched a client-reported blank-page incident.
**Why it matters:** Every deploy had a live window (build duration, easily 30s+) where any client-portal page load could hang forever. No error surfaced to monitoring because the process itself never crashed — it just failed to respond to the specific in-flight requests.
**Fix:** Added `distDir: process.env.NEXT_DIST_DIR || '.next'` to `client/next.config.mjs`. `deploy.sh` now builds into `.next-staging` (untouched by the live process), then atomically swaps it into `.next` via `mv` only after the build completes successfully, before restarting pm2.
**Effort:** Small
**Priority:** High

---

## 2026-07-28 — server (Puppeteer PDF export not covered by Jest for real rendering)
**Type:** Dependency
**What:** `puppeteer` (added for the PDF export feature) ships as a pure-ESM package with no CJS build. Jest's module runtime (`ts-jest`, CJS target) routes even a lazy `await import('puppeteer')` through the same transform pipeline used for `require()`, which can't parse puppeteer's `export * from ...` syntax — confirmed by isolating a standalone `renderHtmlToPdf()` call in a throwaway test, which hit the identical parse error. Applies equally to the PDF Settings live-preview endpoint (`POST /pdf-export/settings/preview`), added later on the same renderer. `tests/integration/pdfExport.test.ts` covers everything that doesn't reach the actual render call (auth, permission, validation, tenant isolation, settings CRUD); the render call itself is only verified manually via `server/src/scripts/smoke-test-pdf-export.ts` and `smoke-test-pdf-preview.ts` against real dev-DB data.
**Why it matters:** A regression that breaks HTML->PDF rendering specifically (a broken template, a Puppeteer API change, a `page.pdf()` option error) would not be caught by `npm test` — only by re-running the manual smoke script.
**Effort:** Medium — either move to `puppeteer-core` + a system Chromium (may not fix the ESM issue, `puppeteer-core` should be checked separately) or add Jest ESM support (`--experimental-vm-modules` + config changes), which risks affecting the whole suite and needs its own careful rollout.
**Priority:** Medium

## 2026-07-28 — server (Chromium system libs not yet confirmed on the deploy VPS)
**Type:** Shortcut
**What:** `deploy.sh` targets a bare VPS via PM2 (no Docker). Puppeteer's bundled Chromium needs shared libs (`libnss3`, `libatk1.0-0`, `libgbm1`, etc.) installed on that VPS — not yet verified on the actual production host, only confirmed working in local dev.
**Why it matters:** The PDF export feature will 500 in production on first use if those libs aren't present, even though it works locally.
**Effort:** Small — `sudo apt-get install` the required libs once, then smoke-test a real export against the deployed instance before announcing the feature as live.
**Update 2026-08-12:** This was the confirmed root cause of a real "PDF export fails" bug report (compounded by two independent error-swallowing bugs — a bare frontend `catch {}` and the backend's always-generic 500 body — that made the real Chromium-launch failure invisible; both now log/surface the real status+message). `deploy.sh` now runs a non-fatal Puppeteer launch check after migrations and prints the exact `apt-get install` command if it fails, so this surfaces loudly on the next deploy instead of silently failing on the coach's first PDF export. Not marked ✅ RESOLVED — deliberately left as a manual step (installing system packages during an unattended deploy is a separate, riskier decision) until someone actually runs it against the production VPS and confirms the check passes.

---

## 2026-07-29 — Three coach-reported bugs (clients package filter, messenger client list, plans-queue filter menu) ✅ RESOLVED 2026-07-29
**Type:** Shortcut (root causes, all fixed same day)
**What:** Three separate reports from the fitsavior-com workspace, all root-caused and fixed:
1. Clients page package filter showed extra/renamed variations beyond the Packages module's actual 4 — it built its option list from `distinct(clients.current_package)`, a denormalized text snapshot stamped at creation/transaction time that never updates after a package/variation rename. Fixed by sourcing filter options from the live `packages`/`package_variations` list and matching client rows by `current_package_variation_id` (the FK) instead of the label string. `mapClient()` now also returns `current_package_variation_id`.
2. Messenger showed far fewer clients (4) than the clients page's "Active" filter (23), and the messenger/dashboard "Active"/"Expired" counts disagreed with the clients page generally. Two compounding causes: (a) `messenger.controller.ts`'s `getThreads` inner-joined `threads → clients`, silently excluding any client who had never been messaged — same query also fed the package filter dropdown, so it was thin too; (b) messenger and the dashboard both read the raw `clients.subscription_status` column, which is only a once-daily snapshot written by the scheduler for change-detection (see `middleware/scheduler.ts`) — the clients page has always computed status live from transactions/freezes/plan-activation instead. Fixed by rewriting `getThreads` to `LEFT JOIN` from `clients` (so a client with no conversation yet still appears, with `id: null` until the coach sends a first message — the messenger frontend lazily creates the thread at that point) and adding a shared `computeStatusesForClients` helper (`server/src/lib/clientSubscriptionStatus.ts`), now used by `clients.controller.ts`, `messenger.controller.ts`, and `dashboard.controller.ts` so the three can't drift apart again.
3. On the plans-queue page, the "Other Filters" dropdown (and the per-column pinned filter popovers) rendered visually behind the table's pinned `stickyEnd` "Actions" column. Both used `z-20`; ties break by DOM order, and the table (rendered after the toolbar) won. Fixed by raising the toolbar dropdowns to `z-50`/`z-60` in `DataTable.js` — fixes the bug class for any current or future table using `stickyEnd` columns, not just plans-queue.
**Why it matters:** (1) and (2) were data-correctness bugs a coach could act on incorrectly (e.g. broadcasting to what looked like "all active clients" but was actually a small subset); (3) blocked a UI feature outright.
**Follow-up not yet fixed:** `clients.current_package` (the same stale text snapshot from bug 1) is also read directly by `clientPortal.controller.ts` and `forms.controller.ts`, and `subscriptionPolicies.service.ts`'s `resolveClientPackageId` matches package overrides by this same name string (see the 2026-06-24 entry above) — none of these were touched by today's fix and remain the same class of risk if a package/variation is renamed.
**Effort:** Medium (already spent) — follow-up above is Small–Medium per call site.
**Priority:** High (resolved) / Medium (follow-up)
**Priority:** High (blocks this feature from being production-ready, not just a nice-to-have)

---

## 2026-08-03 — LoadPlanModal / workspace-library endpoints (fetch-everything-every-open, no server-side filtering)
**Type:** Shortcut
**What:** Coaches reported the "Load Plan" picker (`client/app/components/LoadPlanModal.js`) taking a long time to open. Root cause: `getWorkspaceLibrary` (`nutrition.controller.ts` and `training.controller.ts`) is a nested-LATERAL query that recomputes real macros/day-exercise-set counts for *every* plan in the whole workspace on *every* modal open, and the frontend then does all search/filter/pagination client-side over that full payload — nothing is server-side paginated or filtered by search/creator/client/macro-range. The immediate cause (missing indexes on every FK the nutrition query joins through — `nutrition_plans.workspace_id`/`client_id`, `nutrition_cycles.plan_id`, `nutrition_meals.cycle_id`, `nutrition_meal_items.meal_id`/`food_item_id`/`original_food_item_id`) was fixed today via migration `073_nutrition_fk_indexes.js` (training's equivalent FKs were already indexed, which is why only the nutrition picker was reported as slow). That fix should resolve today's complaint, but the "compute the entire workspace library on every open" pattern itself doesn't scale indefinitely — a workspace with a few hundred clients × several plans each will eventually feel slow again even with the missing indexes fixed.
**Why it matters:** As a workspace's plan history grows, this endpoint's cost grows with total plan/cycle/meal count for the *whole workspace*, not with what's actually displayed (10 plans per page after client-side pagination). Eventually this becomes slow again regardless of indexing.
**Effort:** Large — move search/creator/client/macro-range filtering and pagination into the query (`WHERE`/`LIMIT`/`OFFSET` server-side, debounced requests from `LoadPlanModal.js`), likely also worth caching or precomputing cycle-level macro aggregates instead of recomputing from meal items on every read.
**Priority:** Medium — not urgent post-index-fix, but worth planning before the next workspace-scale complaint.

---

## 2026-08-05 — server/src/modules/pdfExport (summary-page tables still unbounded)
**Type:** Shortcut
**What:** Fixed the reported bug where a training day's (or nutrition cycle's) exercise/meal *content* pages would silently stretch a `.page` div past one physical page when `max_exercises_per_page`/`max_meals_per_page` was `0` ("no limit") — Chromium's native print pagination would then fragment that div across extra physical pages with no background (cut off to white) and no top padding on the continuation. Fixed via real Puppeteer-measured auto-chunking (`templates/pagination.ts`'s `chunkByHeight`, wired into `trainingPlan.ts`/`nutritionPlan.ts`). That fix does **not** cover `renderDaySummaryPage`/`renderPlanSummaryPage` (training) or `renderCycleSummaryPage`/`renderPlanSummaryPage` (nutrition) — each is still exactly one `<div class="page">` with a table that has zero chunking logic. A plan with enough days/exercises (or cycles/meals) that one of *those* tables alone overflows a page would hit the identical background/padding bug, unfixed.
**Why it matters:** Same bug shape, just triggered by row count instead of exercise/meal count — would resurface as a "new" bug report on a large enough plan before anyone connects it to this fix.
**Effort:** Medium — the same `measureBlockHeights`/`chunkByHeight` machinery this fix introduced could be extended to `<tr>`-level chunking for these four summary tables; row heights are more uniform (no thumbnails/notes/badges) than exercise/meal blocks, so a simpler static per-row-height estimate might even suffice here without a full measurement pass.
**Priority:** Low — requires an unusually large plan to trigger; not reported yet.
**Update 2026-08-18:** A coach reported exported PDFs still coming out with mostly-blank pages after the header-height fix above (`aa9c8cb`). Traced to two bugs in `measureBlockHeights` (`lib/pdfRenderer.ts`) itself, both now fixed: (1) `offsetTop`/`scrollHeight` are always in CSS pixels, but every caller treats the returned numbers as points — every measured block came out ~1.33x (96/72) taller than it really is, so the chunking budget looked smaller than the physical page actually had room for and packed roughly 25% fewer exercises/meals per page than truly fit; (2) `renderFooter()`'s `.footer` is `position: absolute`, which takes it out of normal flow entirely, so the offsetTop-delta technique always measured it as exactly 0pt regardless of its real size — the header-height fix's footer term was silently a no-op the whole time. Fixed by converting every measured height px→pt (`pagination.ts`'s new `pxToPt`) and by measuring `.footer` via `getBoundingClientRect()` instead of the offsetTop delta. Verified by rendering a synthetic multi-exercise plan before/after: an 8-exercise day went from 4 chunks (2 exercises each, most of every page blank) to 3 (3/3/2). No unit test for `measureBlockHeights` itself — see the 2026-07-28 Puppeteer/Jest entry above for why; `pagination.pxToPt` has a pure unit test.

---

## 2026-08-06 — plans/plan_variations/addons/plan_period_links (payment_link columns vestigial after Paymob swap)
**Type:** Shortcut
**What:** Swapping the payment gateway from Fawaterak to Paymob (`server/src/lib/paymob.ts`) means checkout now creates a real server-side order for the computed amount instead of resolving a static admin-configured link. `plans.payment_link`, `plan_variations.payment_link`, `addons.payment_link`, and the whole `plan_period_links` table (period-specific links, already flagged unused pre-swap per `docs/billing-architecture-audit.md` F-06) are no longer read anywhere. Only the admin UI inputs that edited them were removed (`client/app/(admin)/admin/plans/page.js`) — the columns/table themselves were left in place rather than dropped in the same migration, to keep the gateway-swap migration (`server/migrations/084_paymob_gateway_columns.js`) focused.
**Why it matters:** Dead columns/table are harmless but misleading to a future reader who doesn't know they're vestigial.
**Effort:** Small — a follow-up migration to drop the columns + table once nobody needs the old data for reference.
**Priority:** Low

## 2026-08-06 — server/src/lib/paymob.ts (HMAC field order / transaction-inquiry shape unverified against live Paymob)
**Type:** Knowledge
**What:** `verifyWebhookHmac`'s ordered-field-concatenation list and `getTransactionStatus`'s order-inquiry endpoint shape were written from Paymob's Accept API as documented at integration time — no live Paymob credentials exist yet to test against (both `.env` and `.env.example` carry empty `PAYMOB_*` placeholders). Both are flagged in-file with a comment to re-verify against Paymob's current docs (https://developers.paymob.com/egypt) before going live.
**Why it matters:** A wrong HMAC field order silently breaks webhook signature verification — every real Paymob webhook would fail the check and get rejected (safe-but-broken: payments would only confirm via the slower `payment-status` poll fallback, never instantly via webhook). A wrong inquiry endpoint just fails polling gracefully (falls back to the webhook), lower risk.
**Effort:** Small — once a Paymob sandbox account exists, send one real test transaction and confirm the computed HMAC matches Paymob's, and confirm the inquiry call returns the expected shape.
**Priority:** High — block relying on card/wallet checkout in production until verified against a real Paymob webhook payload.

---

## 2026-08-23 — mobile/lib/features/training (history pages duplicate `_n`/`_fieldLabel`)
**Type:** Shortcut
**What:** `history_page.dart` and `history_detail_page.dart` each define their own local `_n()`, and `history_detail_page.dart` also duplicates `_fieldLabel()` from `training_page.dart`/`exercise_log_card.dart` verbatim, found during the pre-deploy review of this session's mobile parity work.
**Why it matters:** Same "extract on the third copy" rule this session already applied to amount formatting (see `shared/utils/format_amount.dart`) — these are the next candidates for drift.
**Effort:** Small — pull both into `shared/utils/`.
**Priority:** Low

## 2026-08-23 — mobile/lib/features/training/widgets/exercise_log_card.dart (misleading param name)
**Type:** Documentation
**What:** `weightFocusNode` no longer always targets the weight field — for `time_based` exercises it targets whichever field renders first.
**Why it matters:** Misleading to a future reader; harmless today.
**Effort:** Small — rename next time the file is touched.
**Priority:** Low

## 2026-08-23 — mobile/lib/features/profile/subscription_page.dart (day-count truncates instead of rounds)
**Type:** Shortcut
**What:** The progress bar's `totalDays`/`daysRemaining` use `.inDays` (truncating) where web uses `Math.round()`. Only affects the progress bar's displayed day count, not access control.
**Why it matters:** A DST-only edge case; cosmetic only.
**Effort:** Small
**Priority:** Low
