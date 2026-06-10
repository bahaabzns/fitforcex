# LEARNING.md — Growth Tracker

Format per session:
```
## [date]
**What we built:**
**New concepts learned:**
**Concepts I understood immediately:**
**Concepts I am still fuzzy on:**
**Question I want to explore next:**
**Confidence today (1–10):**
```

---

> Note: Entries below were backfilled from memory on 2026-05-25. Session entries from this point forward are logged live at session close.

---

## 2026-05-06 (approx.) — Phase 8: Subscription Plan Gating
**What we built:** Seat usage bar, upgrade banners, workspace count gate in create-workspace modal. Frontend gating of invite form based on plan limits.
**New concepts learned:** The difference between frontend gates (UX) and backend gates (enforcement). Why client-side gating can never be the real security boundary.
**Concepts I understood immediately:** `max_team_seats === 0` falsy bug — learned that 0 is falsy in JS and explicit null/undefined checks matter.
**Concepts I am still fuzzy on:** How to handle the edge case where a subscription expires mid-session — does the frontend know?
**Question I want to explore next:** How does polling for payment status work and when should we stop polling?
**Confidence today (1–10):** 7

---

## 2026-05-25 — Load Plan feature (training + nutrition builders)
**What we built:** A shared "Load Plan" modal that lets a coach browse all plans across their workspace, filter by stats (days, exercises, macros) and team member, and load any plan as a new draft for the current client. Applied to both training and nutrition builders simultaneously.
**New concepts learned:** Closure pattern to thread extra data (created_by) through a callback-based engine (planEngine's insertPlanTree) without modifying the engine's interface. Rate limiter scope — applying a limiter at the router level affects ALL methods including GETs, not just mutations. AbortController pattern for cleaning up in-flight fetch calls on component unmount.
**Concepts I understood immediately:** Why `null ?? fallback` works for the created_by inheritance logic. Why the workspace-library endpoint must be registered before `/:id` to avoid Express matching "workspace-library" as an ID param.
**Concepts I am still fuzzy on:** The right long-term fix for the N+1 fetch pattern in useTrainingPlan/useNutritionPlan — whether that's a bulk endpoint or something like React Query.
**Question I want to explore next:** Should we consolidate plan fetching to a single endpoint that returns full plan trees in one query instead of N+1?
**Confidence today (1–10):** 9

---

## 2026-05-25 — Session opening debt fix
**What we built:** All 7 missing project documentation files (PROJECT.md, DEBT.md, DEPENDENCIES.md, GLOSSARY.md, WHY.md, LEARNING.md, REVIEWS.md). Identified 6 debt items from code review.
**New concepts learned:** The CLAUDE.md documentation scaffold exists so that decisions, debts, and learning don't live only in conversation history or memory.
**Concepts I understood immediately:** Why commit message format matters — searchable, scannable history.
**Concepts I am still fuzzy on:** (nothing new this session — pure housekeeping)
**Question I want to explore next:** Should we create a `dev` branch before continuing Phase 9 billing work?
**Confidence today (1–10):** 8

---

## 2026-06-04 — Arabic i18n Phase 1: RTL layout, DataTable, Sidebar, portal wiring
**What we built:** Wired Arabic i18n into DataTable (RTL detection via `useLocale`), Sidebar (`text-left` → `text-start` for bidirectional correctness), FoodItemsModal, portal pages, and client layout tab navigation. Added RTL-aware CSS in globals.css. Deleted legacy portal login pages consolidated into root auth. Large planEngine.js refactor and server route updates.
**New concepts learned:** `text-start` vs `text-left` — `text-left` is always left regardless of direction; `text-start` respects the document's writing direction (`dir="rtl"` or `dir="ltr"`). This is the correct choice for any bilingual layout.
**Concepts I understood immediately:** Why `isRtl = locale === 'ar'` is needed alongside CSS — some layout decisions (icon flipping, scroll direction) require JS-side awareness, not just CSS.
**Concepts I am still fuzzy on:** How to handle mixed-direction content within a single cell (e.g., Arabic label + English number) — does HeroUI's Table handle this automatically or does each cell need a `dir` attr?
**Question I want to explore next:** Are there remaining hardcoded `text-left` or `justify-start` patterns in other components that will break under RTL?
**Confidence today (1–10):** 8

---

## 2026-06-10 — Phase 7: Background Schedulers
**What we built:** Three cron jobs using `node-cron`: hourly form dispatcher (marks `scheduled_at` forms as sent), daily subscription expiry checker, and daily session cleanup (deletes revoked/expired `user_sessions` rows older than 30 days). All three skip in test environment. Resolves the DEBT.md item about `user_sessions` growing unboundedly.
**New concepts learned:** Cron syntax — `'0 * * * *'` means "at minute 0 of every hour" (hourly). `'0 0 * * *'` means midnight daily. `'0 2 * * *'` means 2 AM daily. The five fields are: minute, hour, day-of-month, month, day-of-week. Why cron jobs must be guarded by `NODE_ENV !== 'test'` — a cron that fires during tests can corrupt test DB state or cause random test failures due to concurrent writes.
**Concepts I understood immediately:** Why session cleanup uses a 30-day cutoff rather than deleting immediately on expiry — gives a safety window to audit or investigate recent sessions.
**Concepts I am still fuzzy on:** What happens if the server restarts mid-cron-window. Does `node-cron` pick up missed runs after a restart or silently skip them? Answer: it skips — each run only fires if the process is alive when the cron ticks.
**Question I want to explore next:** Should we add a startup check that runs session cleanup immediately on boot (rather than waiting up to 24h for the first 2 AM tick)?
**Confidence today (1–10):** 9

---

## 2026-06-10 — Phase 6: Real-Time — Socket.io
**What we built:** Socket.io layer on top of the existing Express server. `initSocket(httpServer)` creates a SocketServer attached to the Node http.Server, authenticates connections via the httpOnly JWT cookie, and places each socket in workspace/client/user rooms. After a coach sends a message, `new_message` is broadcast to the whole workspace room. After a client sends a message, the same event goes to the coach workspace. After plan activation (nutrition or training), `plan_assigned` fires into the client's private room so the portal can refresh without polling.
**New concepts learned:** Why Socket.io must attach to a `http.Server` rather than the Express `app` directly — WebSocket upgrades are handled at the HTTP layer, not by Express middleware. Why the auth handshake reads the cookie from the raw `socket.handshake.headers.cookie` string — Socket.io doesn't parse cookies automatically like `cookie-parser` does for HTTP requests.
**Concepts I understood immediately:** Room-based targeting: workspace room lets all coach team members see new messages; client room lets a specific client portal react to events without broadcasting to others.
**Concepts I am still fuzzy on:** Whether `getIo()` emits should be fire-and-forget (as implemented) or awaited. Socket.io emit is synchronous/non-blocking, so there's nothing to await — but if delivery guarantees matter, does the app need acknowledgements?
**Question I want to explore next:** How does the client-side (Next.js) subscribe to these rooms? What happens if a client portal user is not connected when plan_assigned fires — does the event get queued?
**Confidence today (1–10):** 8

---

## 2026-06-10 — Phase 4: Security Hardening (JWT session revocation, CSP, admin subdomain) + Phase 5: File Storage (AWS S3)
**What we built:** DB-backed JWT session revocation — every issued token is stored as a SHA-256 hash in `user_sessions` and validated on every request. Logout and workspace-switch revoke the old token. Full Helmet CSP with HSTS. `requireAdminSubdomain` middleware. S3 upload library (`storage.ts`) with signed URL generation and disk fallback for dev. One-time upload migration script.
**New concepts learned:** Why token revocation requires a DB — pure JWT validation is stateless and cannot be un-done before expiry. The SHA-256 hash trick: we never store the raw token, only its hash, so the table is safe even if leaked. Why `getMe` needed `authMiddleware` even though it already called `jwt.verify()` directly — `jwt.verify` checks the signature but not whether the session was revoked. The two failure modes are different: one catches forgeries, the other catches revocation.
**Concepts I understood immediately:** CSP directive names and what each controls. Why HSTS `preload: true` requires `includeSubDomains: true`. Why `hashToken` should live in one place (auth.service.ts) rather than being duplicated in middleware.
**Concepts I am still fuzzy on:** S3 pre-signed URLs vs public-read ACL — when to use each. Pre-signed URLs expire and require backend involvement for each view; public-read is simpler but exposes the bucket.
**Question I want to explore next:** Should exercise videos use signed URLs (access control) or public-read (performance)? What is the right expiry window?
**Confidence today (1–10):** 8
