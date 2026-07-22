# The Insights System — Implementation Plan

> **Status update:** originally scoped to Phase 1+2 only (see below), with Phase 3/4 explicitly deferred pending a real scale trigger. On explicit instruction, Phase 3 and Phase 4 were subsequently built as well — see "Phase 3 & 4 — built" at the bottom for what shipped and how it differs from the original deferral reasoning. The Phase 1+2 plan below is left as originally written for the historical record.

Scope: **Phase 1 (Insights Inbox + Closed Loop)** and **Phase 2 (Founder Prompts)**, plus the four schema seeds from the ten-year-lens review (`insight_events`, `release_tag`, archive-don't-delete, indexes). Phase 3 (contextual triggers) and Phase 4 (full research platform) are explicitly **out of scope** here — see "Deferred" at the bottom.

Grounded directly in this codebase: `server/src/modules/forms/`, `server/src/modules/notifications/`, `server/src/modules/admin/`, `server/src/middleware/*`, `server/prisma/schema.prisma`, and `server/migrations/*.js`. Every file path, function signature, and convention below was read from the actual repo, not assumed.

**Reality checks that override the generic CLAUDE.md template for this repo:**
- No `.js` extensions on local imports — this server runs on `ts-node`/CJS (`nodemon --exec ts-node`), not native ESM. `import x from '../../lib/prisma'`, not `.../prisma.js`.
- Migrations are **not** `prisma migrate dev`. Schema changes are hand-written `node-pg-migrate` files in `server/migrations/*.js` (numbered, `up`/`down`, raw SQL via `pgm.db.query`), and `prisma/schema.prisma` is updated by hand afterward to match. Last migration on disk is `050_fix_forms_status_check.js` — this feature is `051`.
- There is no `routes/index.ts` aggregator. Every router is mounted directly in `server/src/app.ts`.
- Permissions are a stored JSONB snapshot per `workspace_member` row (`{ module: { read, write, delete } }`), copied from `DEFAULT_PERMISSIONS` **at invite time** — not read live from the const. Adding a new module to the const does **not** retroactively grant it to existing team members. This has a real consequence for step 2 below.

---

## Step 0 — Confirm before starting (5 min, don't skip)

- [ ] Locate the admin-panel **frontend** app (the surface behind `admin`/`management` subdomain + `adminAuthMiddleware`) — it wasn't in scope of this repo audit. Confirm its path before starting Step 9.
- [ ] Confirm whether active clients primarily use the web client-portal or the Flutter mobile app, so Step 8's client-facing UI lands on the surface people actually use (build the API in Step 5 either way — it's surface-agnostic).
- [ ] Confirm `attachmentUploader` (imported in `clientPortal.routes.ts` from `../../lib/messageAttachments`) is reusable as-is for `screenshot_url` uploads, or needs a thin wrapper.

---

## Step 1 — Database migration

New file: `server/migrations/051_insights_system.js`

```js
exports.up = async (pgm) => {
    await pgm.db.query(`
        CREATE TABLE IF NOT EXISTS roadmap_items (
            id            TEXT PRIMARY KEY,
            workspace_id  TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
            title         TEXT NOT NULL,
            status        TEXT NOT NULL DEFAULT 'proposed', -- 'proposed'|'planned'|'in_progress'|'shipped'|'declined'
            release_tag   TEXT,                             -- e.g. 'v1.42' — settable by hand today, by a deploy hook later
            archived_at   TIMESTAMPTZ,
            created_at    TIMESTAMPTZ DEFAULT NOW(),
            resolved_at   TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_roadmap_items_status    ON roadmap_items (status);
        CREATE INDEX IF NOT EXISTS idx_roadmap_items_workspace ON roadmap_items (workspace_id);

        CREATE TABLE IF NOT EXISTS insight_prompts (
            id               TEXT PRIMARY KEY,
            workspace_id     TEXT REFERENCES workspaces(id) ON DELETE CASCADE, -- null = platform-wide prompt
            question_en      TEXT NOT NULL,
            question_ar      TEXT,
            response_type    TEXT NOT NULL,                  -- 'rating' | 'multiple_choice' | 'text'
            options          JSONB,                          -- for multiple_choice
            target_audience  TEXT NOT NULL DEFAULT 'everyone', -- 'coach' | 'client' | 'everyone'
            trigger_event    TEXT,                           -- null = shown immediately (Phase 2); set = contextual (Phase 3, not built yet)
            status           TEXT NOT NULL DEFAULT 'active', -- 'active' | 'ended'
            created_by       TEXT NOT NULL,
            created_at       TIMESTAMPTZ DEFAULT NOW(),
            ended_at         TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_insight_prompts_status_audience ON insight_prompts (status, target_audience);
        CREATE INDEX IF NOT EXISTS idx_insight_prompts_workspace       ON insight_prompts (workspace_id);

        CREATE TABLE IF NOT EXISTS insights (
            id                 TEXT PRIMARY KEY,
            workspace_id       TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
            source_type        TEXT NOT NULL,                -- 'bug' | 'feature_request' | 'rating' | 'prompt_response'
            prompt_id          TEXT REFERENCES insight_prompts(id) ON DELETE SET NULL,
            submitted_by_type  TEXT NOT NULL,                -- 'coach' | 'client'
            submitted_by_id    TEXT NOT NULL,
            module             TEXT,                         -- e.g. 'nutrition_builder' — origin context
            app_version        TEXT,
            rating_value       INTEGER,
            text_value         TEXT,
            selected_option    TEXT,
            screenshot_url     TEXT,
            status             TEXT NOT NULL DEFAULT 'new',  -- 'new' | 'triaged' | 'resolved'
            roadmap_item_id    TEXT REFERENCES roadmap_items(id) ON DELETE SET NULL,
            resolution_note    TEXT,
            archived_at        TIMESTAMPTZ,
            created_at         TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_insights_workspace_status ON insights (workspace_id, status);
        CREATE INDEX IF NOT EXISTS idx_insights_roadmap_item     ON insights (roadmap_item_id);
        CREATE INDEX IF NOT EXISTS idx_insights_prompt           ON insights (prompt_id);
        CREATE INDEX IF NOT EXISTS idx_insights_created          ON insights (created_at DESC);

        CREATE TABLE IF NOT EXISTS insight_events (
            id           TEXT PRIMARY KEY,
            entity_type  TEXT NOT NULL,   -- 'insight' | 'roadmap_item'
            entity_id    TEXT NOT NULL,
            from_status  TEXT,
            to_status    TEXT NOT NULL,
            note         TEXT,            -- the human "why" behind this transition
            actor_id     TEXT NOT NULL,
            created_at   TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_insight_events_entity ON insight_events (entity_type, entity_id, created_at DESC);
    `);
};

exports.down = async (pgm) => {
    await pgm.db.query(`
        DROP TABLE IF EXISTS insight_events;
        DROP TABLE IF EXISTS insights;
        DROP TABLE IF EXISTS insight_prompts;
        DROP TABLE IF EXISTS roadmap_items;
    `);
};
```

- [ ] Create the file above.
- [ ] `npm run migrate` against a local/dev database.
- [ ] Confirm a fresh DB (or a fresh shadow DB) applies all 51 migrations cleanly, in order — the Schema Change routine's standing requirement.

---

## Step 2 — Permissions: add the module, then backfill existing members

**2a. Add to `server/src/lib/defaultPermissions.ts`** — every role gets it, because reporting a bug shouldn't be gated behind a business-sensitive permission:

```ts
manager:      { ...existing, insights: { read: true, write: true, delete: false } },
trainer:      { ...existing, insights: { read: true, write: true, delete: false } },
nutritionist: { ...existing, insights: { read: true, write: true, delete: false } },
receptionist: { ...existing, insights: { read: true, write: true, delete: false } },
viewer:       { ...existing, insights: { read: true, write: false, delete: false } },
```

- [ ] Update `server/src/lib/defaultPermissions.ts`.
- [ ] **Also update `server/lib/defaultPermissions.js`** — this compiled/legacy mirror exists alongside the `.ts` source (used by `dev:js`) and will silently drift out of sync if only one copy is edited. Confirm at commit time both files agree.

**2b. Backfill existing `workspace_member` rows.** Permissions are a stored snapshot, not computed live — existing members' JSONB blobs have no `insights` key, so `requirePermission('insights', 'write')` denies them (only the workspace owner bypasses, via `isOwner`). Write a one-off script mirroring the existing pattern in `server/src/scripts/migrate-incremental-catchup.ts`:

- [ ] `server/src/scripts/backfill-insights-permission.ts` — for every `workspace_member` row, merge `{ insights: { read: true, write: <true unless role is viewer>, delete: false } }` into the existing `permissions` JSONB if the key is missing. Idempotent (skip rows that already have `insights`).
- [ ] Run it once against the dev DB, verify a sample member's permissions now include `insights`, then run once against staging/production before this feature ships (**not** before — running it early with no feature behind it is harmless, but treat it as part of this feature's deploy, not a separate unrelated change).

---

## Step 3 — Prisma schema

Add to `server/prisma/schema.prisma` (matches the `notifications` model's style — non-nullable `created_at` with a default, `Timestamptz(6)`):

```prisma
model roadmap_items {
  id           String    @id
  workspace_id String?
  title        String
  status       String    @default("proposed")
  release_tag  String?
  archived_at  DateTime? @db.Timestamptz(6)
  created_at   DateTime  @default(now()) @db.Timestamptz(6)
  resolved_at  DateTime? @db.Timestamptz(6)
  insights     insights[]

  @@index([status])
  @@index([workspace_id])
}

model insight_prompts {
  id              String    @id
  workspace_id    String?
  question_en     String
  question_ar     String?
  response_type   String
  options         Json?
  target_audience String    @default("everyone")
  trigger_event   String?
  status          String    @default("active")
  created_by      String
  created_at      DateTime  @default(now()) @db.Timestamptz(6)
  ended_at        DateTime? @db.Timestamptz(6)
  insights        insights[]

  @@index([status, target_audience])
  @@index([workspace_id])
}

model insights {
  id                String          @id
  workspace_id      String?
  source_type       String
  prompt_id         String?
  submitted_by_type String
  submitted_by_id   String
  module            String?
  app_version       String?
  rating_value      Int?
  text_value        String?
  selected_option   String?
  screenshot_url    String?
  status            String          @default("new")
  roadmap_item_id   String?
  resolution_note   String?
  archived_at       DateTime?       @db.Timestamptz(6)
  created_at        DateTime        @default(now()) @db.Timestamptz(6)
  prompt            insight_prompts? @relation(fields: [prompt_id], references: [id])
  roadmap_item      roadmap_items?   @relation(fields: [roadmap_item_id], references: [id])

  @@index([workspace_id, status])
  @@index([roadmap_item_id])
  @@index([prompt_id])
  @@index([created_at(sort: Desc)])
}

model insight_events {
  id          String   @id
  entity_type String
  entity_id   String
  from_status String?
  to_status   String
  note        String?
  actor_id    String
  created_at  DateTime @default(now()) @db.Timestamptz(6)

  @@index([entity_type, entity_id, created_at(sort: Desc)])
}
```

- [ ] Add the four models above.
- [ ] `npx prisma generate` — regenerate the client before writing any controller that references these models.

---

## Step 4 — Backend module: `server/src/modules/insights/`

Mirrors the `forms/` module's shape (`*.routes.ts` + `*.controller.ts` + `*.service.ts` + `index.ts`):

| File | Responsibility |
|---|---|
| `insights.service.ts` | All shared logic — the only file that touches `insight_events` and `notifications` directly. |
| `insights.controller.ts` | Coach-facing: submit organic insight, list own submissions, get/answer active prompt. |
| `admin.controller.ts` | Admin-facing: triage inbox, prompts management, roadmap management. |
| `insights.routes.ts` | Coach-facing router, mounted at `/api/insights`. |
| `admin.routes.ts` | Admin-facing router, mounted under `/api/admin` (see Step 7). |
| `index.ts` | Barrel export, matching `forms/index.ts`. |

**`insights.service.ts` — function signatures:**

```ts
recordEvent(entityType: 'insight' | 'roadmap_item', entityId: string, fromStatus: string | null, toStatus: string, note: string | null, actorId: string): Promise<void>
// One INSERT into insight_events. Called by every function below that changes a status — never call it from a controller directly, so no transition can happen without being logged.

notifySubmittersForRoadmapItem(roadmapItemId: string, kind: 'shipped' | 'declined'): Promise<void>
// SELECT DISTINCT submitted_by_type, submitted_by_id FROM insights WHERE roadmap_item_id = X
// (dedupes a person who submitted the same request twice), then one notifications INSERT per submitter:
//   workspace_id:   insight.workspace_id
//   recipient_type: insight.submitted_by_type   -- 'user' | 'client' maps directly, no translation needed
//   recipient_id:   insight.submitted_by_id
//   type:           kind === 'shipped' ? 'insight.roadmap_shipped' : 'insight.roadmap_declined'
//   importance:     kind === 'shipped' ? 'actionable' : 'info'
//   title/body:      see Step 10 for exact copy
//   entity_type:    'roadmap_item'
//   entity_id:      roadmapItemId
//   actor_type:     'system'

getActivePrompt(audience: 'coach' | 'client', workspaceId: string | null, submitterId: string): Promise<InsightPrompt | null>
// WHERE status = 'active' AND target_audience IN (audience, 'everyone')
//   AND (workspace_id IS NULL OR workspace_id = :workspaceId)
//   AND trigger_event IS NULL                      -- Phase 2 only fires manual prompts
//   AND NOT EXISTS (SELECT 1 FROM insights WHERE prompt_id = insight_prompts.id AND submitted_by_id = :submitterId)
// ORDER BY created_at DESC LIMIT 1

activatePrompt(data: NewPromptInput, actorId: string): Promise<InsightPrompt>
// Transaction: end any other 'active' prompt whose target_audience overlaps (data.target_audience, 'everyone')
// — enforces "one active question at a time" per audience — then INSERT the new one, recordEvent('insight_prompt' fold into 'roadmap_item'? NO — prompts aren't part of the triage lifecycle, skip recordEvent here; only insights and roadmap_items get logged, per the schema's entity_type enum).

triageInsight(id: string, input: { status?, roadmapItemId?, newRoadmapItemTitle?, note? }, actorId: string): Promise<Insight>
// If newRoadmapItemTitle given and no roadmapItemId: create the roadmap_items row on the spot (status 'proposed'), use its id.
// UPDATE insights SET status, roadmap_item_id, resolution_note = note WHERE id = :id, then recordEvent('insight', id, oldStatus, newStatus, note, actorId).

updateRoadmapItemStatus(id: string, newStatus: string, releaseTag: string | null, note: string | null, actorId: string): Promise<RoadmapItem>
// UPDATE roadmap_items, recordEvent('roadmap_item', id, oldStatus, newStatus, note, actorId).
// If newStatus is 'shipped' or 'declined': also set resolved_at = now(), mark every linked insight status = 'resolved',
// and call notifySubmittersForRoadmapItem(id, newStatus as 'shipped' | 'declined').
```

- [ ] Write `insights.service.ts` with the five functions above.
- [ ] Write `insights.controller.ts`: `submitInsight`, `listMyInsights` (optional/should-have — filters `submitted_by_id = req.user.userId`), `getActivePromptForCoach`, `respondToPrompt`.
- [ ] Write `admin.controller.ts`: `listInsights`, `triageInsight`, `listPrompts`, `createPrompt` (calls `activatePrompt`), `endPrompt`, `listRoadmapItems` (with a `COUNT(insights)` and `AVG(rating_value)` aggregate per item — this is the free request-count/prioritization signal), `createRoadmapItem`, `updateRoadmapItem` (calls `updateRoadmapItemStatus`).

---

## Step 5 — Routes (all three surfaces)

| Method | Path | Guard | Purpose |
|---|---|---|---|
| `POST` | `/api/insights` | `authMiddleware` + `requirePermission('insights','write')` | Coach submits bug / feature_request / rating |
| `GET` | `/api/insights/mine` | `authMiddleware` + `requirePermission('insights','read')` | *(should-have)* Coach's own submission history |
| `GET` | `/api/insights/prompts/active` | `authMiddleware` + `requirePermission('insights','read')` | Fetch the active prompt targeted at this coach, if any |
| `POST` | `/api/insights/prompts/:id/respond` | `authMiddleware` + `requirePermission('insights','write')` | Answer a prompt — creates an `insights` row with `source_type='prompt_response'` |
| `POST` | `/api/client-portal/insights` | `clientAuthMiddleware` + `loadClientAccess` | Client submits bug / feature_request / rating |
| `GET` | `/api/client-portal/prompts/active` | `clientAuthMiddleware` + `loadClientAccess` | Fetch the active prompt targeted at this client, if any |
| `POST` | `/api/client-portal/prompts/:id/respond` | `clientAuthMiddleware` + `loadClientAccess` | Answer a prompt |
| `GET` | `/api/admin/insights` | `adminAuthMiddleware` | Unified triage inbox — filter by `status`, `source_type`, `workspace_id` |
| `PATCH` | `/api/admin/insights/:id` | `adminAuthMiddleware` | Triage: set status, link/create roadmap item, add a note |
| `GET` | `/api/admin/prompts` | `adminAuthMiddleware` | Prompts list, filter `?status=active\|ended` — replaces "Active Questions" + "Research History" as one view |
| `POST` | `/api/admin/prompts` | `adminAuthMiddleware` | Create + activate a prompt |
| `PATCH` | `/api/admin/prompts/:id/end` | `adminAuthMiddleware` | Manually end a prompt |
| `GET` | `/api/admin/roadmap` | `adminAuthMiddleware` | Roadmap items with linked-insight counts |
| `POST` | `/api/admin/roadmap` | `adminAuthMiddleware` | Create a roadmap item ad hoc |
| `PATCH` | `/api/admin/roadmap/:id` | `adminAuthMiddleware` | Update status/`release_tag` — triggers closed-loop notifications on `shipped`/`declined` |

**Client-portal routing note:** follow the existing precedent of `clientPortalNotifications.controller.ts` — add a thin `clientPortalInsights.controller.ts` inside `clientPortal/` that delegates to `insights.service.ts` for all actual logic, rather than duplicating business logic across modules (§2 layering rule: shared logic goes down, not sideways).

- [ ] Write `insights.routes.ts` (coach-facing), mirroring `forms.routes.ts`'s `router.use(authMiddleware)` + per-method `requirePermission` pattern.
- [ ] Write `admin.routes.ts` for this module, mirroring the existing `admin/admin.routes.ts` style — `adminAuthMiddleware` applied per-route, not globally.
- [ ] Add `clientPortalInsights.controller.ts` and wire its routes into `clientPortal.routes.ts`'s existing `open` guard chain (`clientAuthMiddleware`, `loadClientAccess`, `requirePortalOpen`).
- [ ] Specific routes before parameterized ones where both exist (`/prompts/active` before any future `/prompts/:id` GET, `/insights/mine` before `/insights/:id` if that's ever added).

---

## Step 6 — Mount in `app.ts`

```ts
app.use('/api/insights', apiLimiter, insightsRouter);
app.use('/api/admin/insights', requireAdminSubdomain, apiLimiter, insightsAdminRouter);
```

- [ ] Add both lines near the existing `app.use('/api/forms', ...)` / `app.use('/api/admin', ...)` calls.
- [ ] Decide: mount the admin insights/prompts/roadmap routes as a sub-router under the existing `/api/admin` router (consistent with how `forms-templates` and `libraries` are nested inside `admin.routes.ts` today) rather than a second top-level `/api/admin/insights` mount — **prefer nesting inside the existing `admin.routes.ts`** to match current convention exactly; the two-line snippet above is the fallback if nesting proves awkward.

---

## Step 7 — Notification copy (Step 10 referenced above)

Exact `notifications` row content for `notifySubmittersForRoadmapItem`:

| Field | `shipped` | `declined` |
|---|---|---|
| `type` | `insight.roadmap_shipped` | `insight.roadmap_declined` |
| `importance` | `actionable` | `info` |
| `title` | "You asked, we listened 🎉" | "An update on your feedback" |
| `body` | `"{roadmap_item.title} is now available."` | `"We looked into '{roadmap_item.title}' and won't be building it right now — {note, if present}."` |
| `entity_type` / `entity_id` | `'roadmap_item'` / the roadmap item's id | same |

- [ ] Confirm this copy with whoever owns product voice before shipping — it's the one part of this feature actual users read directly.

---

## Step 8 — Frontend (web client)

- [ ] `client/app/components/insights/FeedbackEntryModal.js` — wraps the existing `AppModal` (`client/app/components/Modal.js`). Fields: type (bug/feature/rating radio), rating (1–10, matching the forms module's existing `scale` question convention — don't invent a new rating scale), text, optional screenshot (reuse `attachmentUploader`/S3 pattern per Step 0).
- [ ] Add a persistent entry point (nav or settings menu) that opens it. **Not a banner, not a modal-on-load** — opt-in only, per the UX evaluation already on record.
- [ ] `client/app/components/insights/InsightBanner.js` — inline, non-blocking banner (bottom of viewport). On mount, `GET /api/insights/prompts/active`; if a prompt exists, render its `response_type` (rating stars / multiple-choice buttons / text field) and `POST .../respond` on submit. Dismiss is client-side/session-only for Phase 2 — no `dismissed_at` persistence yet (that's a Phase 3 concern, not needed while only one prompt is ever active).
- [ ] Mount `InsightBanner` at the main dashboard layout level so it's visible regardless of which page a coach is on.

---

## Step 9 — Admin frontend

*(Path to confirm per Step 0.)* Three screens, matching Step 7 of the architecture memo exactly:

- [ ] **Insights** — unified inbox, filterable by `status` / `source_type` / `workspace_id`; each row: triage action (status, link/create roadmap item, note).
- [ ] **Prompts** — one list, `status` filter toggle (`active` / `ended`) — do **not** build these as two separate screens.
- [ ] **Roadmap** — list of roadmap items, each showing linked-insight count and avg rating (from the aggregate query in `listRoadmapItems`), status dropdown (`proposed → planned → in_progress → shipped/declined`), `release_tag` field.

---

## Step 10 — OpenAPI docs

- [ ] `@openapi` JSDoc block on every route above, matching the style already used in `forms.routes.ts` / `admin.routes.ts` (tags, security, parameters, responses) — this is the only API documentation that stays current, per this codebase's own standard.

---

## Step 11 — Tests

Per this framework's testing standard (auth-denied / authz-denied / validation-fail / tenant-isolation / happy path):

| Endpoint group | Must cover |
|---|---|
| `POST /api/insights` | 401 no token · 403 missing `insights.write` · 400 invalid `source_type` or missing text · happy path creates a row with correct `workspace_id`/`submitted_by_*` |
| `POST /api/client-portal/insights` | 401 no client token · 400 invalid input · happy path |
| `GET /api/insights/prompts/active` | Returns null when no active prompt targets this audience · returns null when this user already answered (the `NOT EXISTS` clause) · returns the right prompt when one is eligible |
| `PATCH /api/admin/insights/:id` | 401 no admin token · happy path updates status **and** writes an `insight_events` row · creating a roadmap item ad hoc via `newRoadmapItemTitle` works |
| `PATCH /api/admin/roadmap/:id` (→ shipped) | Fires exactly one notification per **distinct** submitter (not one per insight) · all linked insights flip to `resolved` · `insight_events` row written |
| `POST /api/admin/prompts` | Activating a new prompt ends the prior active prompt for an overlapping audience (the "one at a time" rule) — this is the one non-obvious behavior most worth a dedicated test |
| Tenant isolation | An insight submitted in workspace A never appears when an admin filters `workspace_id=B`; a coach in workspace A can never fetch/answer a prompt scoped to workspace B |

- [ ] Unit tests for `insights.service.ts` functions in isolation (mock Prisma).
- [ ] Integration tests (`supertest`, `tests/integration/`) for the route table in Step 5.

---

## Step 12 — Manual QA script (run once before calling Phase 1+2 done)

1. As a coach: submit a bug report with a screenshot → appears in admin Insights inbox with correct workspace/module context.
2. As admin: triage it, create a roadmap item on the spot, link it.
3. As a second coach: submit a feature request → link to the **same** roadmap item → confirm the roadmap view shows "2 requests."
4. As admin: mark the roadmap item `shipped` with a `release_tag` → confirm **both** coaches receive exactly one notification each, and both linked insights flip to `resolved`.
5. As admin: create a second roadmap item, mark it `declined` with a note → confirm the submitter gets the "declined" notification copy, not silence.
6. As admin: create an active Founder Prompt targeted at `client`, rating type → as a client, confirm the banner appears once, submitting it removes it, and a second client not yet answering still sees it.
7. As admin: create a second active prompt targeted at `everyone` → confirm the first prompt auto-ends (the "one at a time" rule).
8. Confirm `insight_events` has a row for every status change made across steps 1–7.

---

## Definition of done

- [ ] All Step 1–7 checkboxes complete; migration applies cleanly on a fresh DB.
- [ ] Both `defaultPermissions` files updated and in sync; backfill script run against dev **and** staging/production.
- [ ] All Step 11 tests passing; Step 12 manual script walked end-to-end.
- [ ] Code Review routine run (tenancy scoping, `asyncHandler` on every route, thrown errors not returned, no hardcoded copy that should live in Step 7's table).
- [ ] `DEBT.md` updated if anything from this plan was deliberately shortcut.

---

## Explicitly deferred (not in this plan)

- **Phase 3 — contextual triggers** (`trigger_event` beyond null/manual): wait until Founder Prompts (Phase 2) shows which moments produce the best answers. The column already exists in the schema above; only the hook-per-feature and dismissal-tracking are missing.
- **Phase 4 — full research platform** (multi-prompt scheduling, segmentation beyond coach/client/everyone, funnels, NPS trend dashboards): gated on a real scale trigger (workspace count, inbound volume outpacing manual triage), not a calendar date.
- **AI hooks** (embeddings/clustering/dedup, sentiment trend, CI-driven `release_tag`): all additive later — an `embedding` column on `insights` (pgvector, already supported by Postgres) and reading `insight_events` history are the only prerequisites, and both already exist after this plan ships. Building the pipelines themselves now would solve a triage-volume problem FitForce doesn't have yet.

---

## Phase 3 & 4 — built (superseding the deferral above)

Built on explicit instruction to proceed regardless of the scale-trigger reasoning above. Scope was held to exactly what was already documented in the architecture memo's Phase 3/4 definitions — nothing improvised beyond that. The **AI hooks** line above is a separate, permanent "don't build this" stance (not phase-numbered) and stayed out of scope.

**Migrations:** `052_insights_phase3_triggers.js` (`insight_prompt_dismissals`), `053_insights_phase4_platform.js` (`starts_at`/`ends_at`/`max_shows_per_user` on `insight_prompts`, plus `insight_prompt_workspaces`, `insight_prompt_conditions`, `insight_prompt_impressions`), `054_insight_prompts_allow_concurrent.js`. All applied to dev and test DBs; `schema.prisma` updated and client regenerated after each.

**Phase 3 — contextual triggers:**
- A fixed, code-level catalog in `insights.service.ts` (`TRIGGER_EVENTS`/`TRIGGER_CHECKS`) — `first_workout_logged`, `first_checkin_completed`, `nutrition_builder_used_10x` — deliberately not a generic rules engine.
- `getPromptForTrigger()` evaluates the named condition server-side and checks eligibility (audience, workspace, not answered, not dismissed); `GET /api/insights/prompts/for-trigger/:event` and the client-portal equivalent expose it.
- Persistent dismissal (`insight_prompt_dismissals`, `POST .../prompts/:id/dismiss`) — contextual prompts stay dismissed, unlike the session-only dismiss on manual prompts.
- Exclusivity is scoped to delivery mode: a new contextual prompt only ends another active prompt on the *same* `trigger_event`; different triggers and the manual prompt coexist.
- Frontend: `PromptCard.js` extracted as the shared question UI; `InsightBanner.js` (manual, unchanged behavior) and new `TriggerInsightBanner.js` (contextual) both render it. Hooks mounted on the landing page right after each triggering action — `/portal/training/history` (workout), `/portal/forms` (check-in), the coach's client nutrition builder (10th plan) — checked on page load rather than mid-flow, since the actions themselves navigate away before a banner could render.
- Admin: the Prompts form gained a "When to show it" selector (immediate vs. named trigger).

**Phase 4 — research platform:**
- **Scheduling**: `starts_at`/`ends_at` on `insight_prompts`, enforced in the eligibility query; `scheduleInsightPromptExpiry()` (new cron tick, `middleware/scheduler.ts`, every 15 min) auto-ends expired prompts.
- **Concurrency**: `allow_concurrent` opts a specific prompt out of the one-at-a-time exclusivity in both directions — it doesn't end others, and a later exclusive prompt doesn't end it.
- **Segmentation beyond coach/client/everyone**: `insight_prompt_workspaces` (multiple specific workspaces — falls back to the original single-`workspace_id`-or-platform-wide behavior when empty) and `insight_prompt_conditions` (bounded — only `subscription_status`/`package_variation_id`, the two attributes that were actually filterable on `clients` per the original codebase audit; a coach/user submitter fails any prompt with conditions, since neither field applies to them). Deliberately not a generic rule engine.
- **Frequency capping**: `max_shows_per_user` checked against `insight_prompt_impressions` count.
- **Funnel**: `insight_prompt_impressions` records sent/viewed (one event, no separate push channel exists) and started (a new `POST .../prompts/:id/started` ping fired from `PromptCard.js` on first interaction); completed is read from the existing `insights` table. `getPromptFunnel()` + `GET /api/admin/prompts/:id/analytics` expose it.
- **NPS-style breakdown**: for `rating`-type prompts, average score plus a 9–10/7–8/0–6 promoter/passive/detractor split, computed from existing data — no new tracking beyond what completed responses already capture.
- Admin: an "Advanced" section on prompt creation (scheduling, max shows, concurrent toggle, workspace ids, conditions) and an expandable analytics panel per prompt row (funnel numbers + NPS bar + option distribution).

**Tests:** `tests/integration/insightsPhase3And4.test.ts` — 10 tests covering trigger eligibility transitions, persistent dismissal, trigger-scoped exclusivity, scheduling window + expiry, frequency capping, concurrency in both directions, multi-workspace targeting, condition-based targeting (including the coach-always-excluded case), and the funnel/NPS analytics endpoint.

**Verification:** server typechecks clean; full suite (224 tests across both new files plus all pre-existing) passes; client builds cleanly including all new routes; `react-hooks/set-state-in-effect` remains the only lint finding, and it's the same pre-existing codebase-wide pattern noted in the Phase 1+2 summary, not something these phases introduced.
