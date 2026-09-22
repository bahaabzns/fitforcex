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

## 2026-09-17 — client/app/components/MessageComposer.js (voice note filename doesn't match recorded codec)
**Type:** Shortcut
**What:** `handleStopRecording` (MessageComposer.js:92) always names the recorded blob `"voice-message.webm"`, regardless of the codec `useVoiceRecorder` actually used. On Safari/iOS, `MediaRecorder` falls back to a non-webm container (typically fragmented MP4), so the uploaded file is a `.webm`-named MP4. Found while fixing the client-portal voice-note playback bug (fix/client-portal-voice-notes) — that fix made the server trust the browser-declared `mimetype` for the S3 Content-Type instead of sniffing, which is why the wrong extension no longer breaks playback, but the filename itself is still misleading (e.g. in downloaded-file names).
**Why it matters:** Cosmetic/metadata-only today (playback now relies on `attachment_mime`, not the extension), but a future feature that trusts the filename extension (e.g. a "save as" download, an external integration, an admin export) would mislabel Safari-recorded voice notes.
**Effort:** Small — derive the extension from `recorder.mimeType` in `useVoiceRecorder.js`'s `stop()` result instead of hardcoding it in the composer.
**Priority:** Low

---

## 2026-09-22 — server/src/modules/paymentMethods/paymentMethods.routes.ts (same over-scoped GET gate as packages, not fixed)
**Type:** Shortcut
**What:** Found while fixing "packages don't show up for Team Member users" (`GET /api/packages` was gated on `finance.read` alone, which only `owner`/`receptionist` have by default — see `packages.routes.ts`, now fixed via `requireAnyPermission([['finance','read'],['clients','read']])`). `paymentMethods.routes.ts` has the identical blanket `requirePermission('finance', action)` gate on GET, and `client/app/(coach)/[workspaceSlug]/clients/page.js` fetches both `/api/packages` and `/api/payment-methods` in the same `Promise.all` (used to populate the package/payment-method pickers when creating or editing a client). For `manager`/`trainer`/`nutritionist`/`viewer` roles, `GET /api/payment-methods` still 403s today, which still rejects that `Promise.all` and blanks the entire Clients page (clients list, packages, payment methods, forms all fail to render) for those roles — a more severe, but differently-shaped, symptom than the packages bug. Left unfixed deliberately: payment methods (unlike packages) sit squarely in Finance and changing who can read them is a real access-control decision, not a mechanical mirror of the packages fix.
**Why it matters:** Same class of bug (over-restrictive default RBAC blocking a legitimately cross-module read), with a worse blast radius (whole page, not one list) — likely to surface as its own "clients page is empty for X role" report.
**Effort:** Small — same shape as the packages fix, `requireAnyPermission([['finance','read'],['clients','read']])` on GET only, once someone confirms payment-method names/details aren't meant to be finance-restricted from clients.read roles.
**Priority:** Medium

---

## 2026-09-22 — server/migrations (043–091 missing from this branch, DB already has them)
**Type:** Knowledge
**What:** Found while adding an index migration for the messenger performance fix. This checkout's `server/migrations/` only has files through `042_split_checkin_forms_by_plan_type.js` (matches `git log`, last touched by commit `369fa4d`), but the shared `.env.test` database's `pgmigrations` tracking table already has `043_form_version_questions_lineage` through `091_pdf_branding_profiles` recorded as run — 49 migration files that don't exist anywhere in this branch's git history. `node-pg-migrate up` refuses to run anything new because its `checkOrder` check requires the Nth file on disk to positionally match the Nth migration ever run; it can't, since the files are missing. My new migration is numbered `092_messenger_missing_indexes.js` (validated by applying its SQL directly and rolling it back — see the messenger performance fix report) to avoid colliding with that already-run range, but it cannot actually be executed via `npm run migrate` in this environment until the drift is resolved.
**Why it matters:** This isn't cosmetic — either this branch is missing 49 commits' worth of real schema history (meaning the Prisma client/types here could already be stale relative to the live DB), or the shared test DB was pointed at a snapshot from a different, more-advanced branch. Either way, nobody can run a clean migration against this DB from `dev` right now, and it's worth confirming before it surprises someone in CI or on a fresh clone.
**Effort:** Medium — first confirm which branch actually has 043–091 (or whether they were squashed/renamed) and reconcile; then `092_messenger_missing_indexes.js` can be renumbered into its correct place if needed.
**Priority:** High

---

## 2026-09-22 — server/src/modules/messenger, client messenger page (deferred messenger perf follow-ups)
**Type:** Shortcut
**What:** Two structural causes behind "the messenger is slow" were diagnosed but deliberately not built, to keep the bug fix scoped (see the messenger performance fix report for the fixes that *were* shipped — composite indexes + pausing the poll on a hidden tab):
1. `getMessages` (`messenger.controller.ts`) has no `take`/pagination — it fetches a thread's *entire* message history on every open AND every 5s poll of an open thread. Fine today at low message counts, but unbounded growth is a real time bomb for long-running client relationships. The proper fix is a paginated/"load earlier" contract plus matching infinite-scroll UI in `messenger/page.js` — there's currently no scroll-triggered loading affordance at all, so this is a UI feature, not a one-line change.
2. The coach messenger page polls every 5s for both the thread list and the open thread's messages, but `socket.io-client` isn't a dependency anywhere in this repo — the server's Socket.IO infra (`lib/socket.ts`, `lib/events.ts`) already authenticates the same cookie, joins `workspace:${workspaceId}` on connect, and already emits `new_message` on every send/broadcast (`messenger.controller.ts`'s `recordEvent(...).realtime`), but nothing on the coach web client listens for it. Wiring the messenger page to that existing event and dropping the poll to an infrequent safety net (instead of the primary sync mechanism) is the real fix for polling load, not just tuning the interval.
**Why it matters:** (1) bounds a query that will only get slower as real conversations accumulate; (2) is the single biggest lever left for messenger responsiveness — the backend real-time plumbing already exists and is unused.
**Effort:** Medium-Large each — both are real UI/feature work (pagination UI, socket wiring + reconnect/cleanup handling), not safe to bundle into a "fix the bug" pass.
**Priority:** High
