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
