# The Insights System — Manual Test Checklist

Covers all 4 phases across all 3 identities (admin, coach, client). Every item below was actually walked through and passed during live testing (Playwright-driven, real dev DB) — this is the reusable version of that pass, plus the local-dev routing quirks that aren't obvious from the code alone.

---

## 0 — Environment: how to actually reach each surface locally

This app does **subdomain-based routing** in dev via `client/proxy.js`, driven by `NEXT_PUBLIC_ROOT_DOMAIN=lvh.me` (`lvh.me` and all its subdomains resolve to `127.0.0.1`). Getting the host wrong is the single most confusing failure mode — symptoms are silent redirects or `ERR_CONNECTION_REFUSED`, not a clear error.

| Surface | Correct URL | Why |
|---|---|---|
| Marketing / coach login / register | `http://lvh.me:3000/login` | Root domain — public auth routes stay here. |
| **Coach dashboard** (post-login) | `http://my.lvh.me:3000/{workspaceSlug}/dashboard` | `/{slug}/...` on the bare root domain gets redirected here automatically; going directly to `my.lvh.me` skips the extra hop. |
| **Client portal** | `http://my.lvh.me:3000/portal/...` | `my` is a reserved subdomain that passes through untouched, `/portal` paths work as-is. |
| **Admin panel** | `http://admin.lvh.me:3000/login` — **not** `lvh.me:3000/admin/login` | The `admin` subdomain rewrites `/login` → `/admin/login` internally. Hitting `/admin/login` directly on the plain host bypasses that rewrite and the page's own `pathname === '/login'` check sends you to the wrong (coach) login page. This isn't a bug — it only works via the subdomain. |

- [ ] Start the backend: `cd server && npm run dev` (port 4000).
- [ ] Start the frontend: `cd client && npm run dev` (port 3000) — **check first** whether one is already running (`curl -s -o /dev/null -w "%{http_code}" http://localhost:3000`); Next.js will silently fall back to 3001 if 3000 is taken, and if that "taken" server is yours, don't kill it.
- [ ] Seeded super-admin: `admin@fitforce.app` / `Admin@123` (from `server/prisma/seedAdmin.ts`'s defaults — change before staging/production).
- [ ] For coach/client accounts, either use existing dev fixtures or register fresh ones through the UI/API — see §4 for the exact API shortcut used during automated verification.

---

## 1 — Admin panel

Log in at `http://admin.lvh.me:3000/login`.

### Insights inbox (`/insights`)
- [ ] Page loads with status filter chips (All / New / Triaged / Resolved) and an empty state when nothing matches.
- [ ] A submitted insight (bug/feature/rating/prompt response) appears in the list with the right type chip, content preview, status, and submitted date.
- [ ] Clicking a row opens the triage drawer showing full content (description, rating, screenshot if present, module context).
- [ ] Changing status and saving persists (row updates, drawer closes).
- [ ] Linking to an existing roadmap item via the dropdown works.
- [ ] Typing a new title in "…or create a new roadmap item on the spot" and saving creates the roadmap item **and** links it in one step — check the Roadmap page afterward.
- [ ] Filtering by `workspaceId` (via the query param / a second workspace's data) shows only that workspace's insights — tenant isolation.

### Prompts (`/prompts`)
- [ ] "New Prompt" opens the form; response type (rating/multiple_choice/text), audience (everyone/coaches/client), and "When to show it" (immediate vs. named trigger) all render.
- [ ] Multiple-choice response type reveals the options list with "+ Add option".
- [ ] The "Advanced" section expands to show: Starts/Ends datetime pickers, Max shows per user, the Exclusive/Concurrent toggle, a workspace-ids text field, and condition rows (field dropdown + value).
- [ ] Activating a prompt succeeds (201) and appears in the "active" list with its trigger label if contextual.
- [ ] Activating a **second manual** prompt for an overlapping audience ends the first one (check it moved to the "ended" tab).
- [ ] Activating a **contextual** prompt does **not** end an active manual prompt, and vice versa.
- [ ] "End" on an active prompt moves it to "ended".
- [ ] Expanding a prompt row shows the analytics panel: Sent / Started / Completed / Completion rate, and — for rating prompts — the average score plus the promoter/passive/detractor bar; for multiple-choice, the option-count breakdown.

### Roadmap (`/roadmap`)
- [ ] "New item" creates a roadmap item, shows up with `0` linked insights and status `proposed`.
- [ ] Linking multiple insights to the same item (via the Insights triage drawer) increases its insight count — this is the free prioritization signal.
- [ ] Expanding a row and changing status to `shipped` with a release tag saves, and **every distinct submitter linked to that item receives exactly one notification** (check via the coach/client notification bell, or query the `notifications` table) — not one per insight if the same person submitted twice.
- [ ] Changing status to `declined` with a note saves, and linked submitters get the "declined" notification copy (not silence).
- [ ] After shipping/declining, all linked insights flip to `resolved` in the Insights inbox.

---

## 2 — Coach dashboard

Register or log in at `http://lvh.me:3000/login`, land on `http://my.lvh.me:3000/{slug}/dashboard`.

- [ ] The feedback entry icon (chat-bubble-plus, in the header next to the notification bell) is present and opens `FeedbackEntryModal`.
- [ ] Type chips (Report a bug / Suggest a feature / Rate FitForce) switch the form: text description for bug/feature, a 1–10 rating grid for rating.
- [ ] Description label sits above the textarea (not beside it); no duplicated "Screenshot (optional)" text.
- [ ] Submitting creates a row visible in the admin Insights inbox afterward.
- [ ] Screenshot upload (bug type only) accepts an image and shows a thumbnail + remove control.
- [ ] An active prompt targeted at `everyone` or `coaches` shows as a bottom banner (`InsightBanner`) — not a modal, not blocking.
- [ ] Answering it submits and shows a brief "Thanks" state before auto-dismissing (~1.8s).
- [ ] Dismissing without answering ("Not now") hides it for the session; a fresh page load can show it again — this is intentional for manual prompts (unlike contextual ones).
- [ ] A `nutrition_builder_used_10x` contextual prompt (create one via Admin → Prompts, trigger = "After a coach's 10th nutrition plan") appears at the top of the client's Nutrition Builder page once that coach has created ≥10 nutrition plans, and **not** before.
- [ ] Dismissing a contextual prompt persists — it does not reappear on a later visit (unlike the manual banner).

---

## 3 — Client portal

Log in a client, land on `http://my.lvh.me:3000/portal/home`.

- [ ] Profile page (`/portal/profile`) has a "Feedback" row (chat-bubble-plus icon) that opens the same `FeedbackEntryModal`, wired to the client-portal endpoints.
- [ ] An `everyone`/`client`-targeted prompt banner appears **above** the bottom tab nav, fully clickable (not obscured by it) — this was a real bug (z-index/offset) found and fixed during verification; if it regresses, the banner will visually sit behind or under the nav bar.
- [ ] Answering/dismissing behaves the same as the coach side.
- [ ] `first_workout_logged` contextual prompt: create one via Admin → Prompts (trigger = "After a client logs their first workout"), have the client log exactly one workout, then visit `/portal/training/history` — the prompt should appear. Log a second workout and reload — it should no longer be eligible (condition is `count === 1`).
- [ ] `first_checkin_completed` contextual prompt: same pattern, visit `/portal/forms` after submitting exactly one check-in.
- [ ] Submitting organic feedback (bug/feature/rating) from the client portal creates an insight with `submitted_by_type: 'client'`, visible in the admin inbox.

---

## 4 — Fast path: API shortcuts for repeatable testing

Going through the UI signup/login flow every time is slow. These create a working session cookie directly (used throughout automated verification):

```bash
# Admin session
curl -s -c - -X POST http://lvh.me:4000/api/admin/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@fitforce.app","password":"Admin@123"}'

# Fresh coach (auto-logged-in, returns workspace_slug + a `token` cookie)
curl -s -c - -X POST http://lvh.me:4000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"fname":"Test","lname":"Coach","email":"qa-'"$(date +%s)"'@example.com","password":"TestPass123","phone":"+201000000000"}'

# Client (requires a coach's `token` cookie from above; sets a known password)
curl -s -X POST http://lvh.me:4000/api/clients \
  -H 'Content-Type: application/json' -H 'Cookie: token=<coach token>' \
  -d '{"fname":"Test","lname":"Client","email":"client-qa@example.com","phone":"+201234567890","password":"ClientPass123"}'

# Client login
curl -s -c - -X POST http://lvh.me:4000/api/client-portal/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"client-qa@example.com","password":"ClientPass123","workspace_slug":"<slug from register>"}'
```

Take the `Set-Cookie` value from each response and either paste it into the browser's dev tools (Application → Cookies → `lvh.me`) or inject it via a Playwright `context.addCookies(...)` call — domain must be `lvh.me` (host-only, no subdomain wildcard), matching the actual cookie the server issues.

---

## 5 — Known gotchas (don't re-debug these)

- **Cookies are `SameSite=Strict`/`Lax` and host-only for `lvh.me`.** Testing against plain `localhost:3000` instead of `lvh.me:3000` silently drops every cookie on cross-origin API calls — looks like a 401 auth failure, isn't one.
- **`Chip` (HeroUI) has no `startContent` prop.** Render icons as a plain child with `inline-flex items-center gap-1` on the Chip instead — passing `startContent` produces a React DOM warning and the icon never renders.
- **Fixed-position elements need to clear the client portal's bottom tab nav** (`ClientPortalNav`, `h-16`, `z-50`). Anything `fixed bottom-*` on portal pages needs `z-60`+ and `bottom-[calc(4rem+1rem+env(safe-area-inset-bottom))]` or it becomes invisible-but-present and blocks clicks without any visible sign why.
- **`react-hooks/set-state-in-effect` ESLint findings on the fetch-on-mount pattern** (`useEffect(() => { fetchX(); }, [fetchX])`) are a pre-existing, codebase-wide lint gap — it fires identically on `admin/users/page.js`, which predates this feature. Not something to "fix" locally without a wider pass.
