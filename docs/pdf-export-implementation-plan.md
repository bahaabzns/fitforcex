# PDF Export (Nutrition & Training Plans) — Implementation Plan

> Status: Draft v1 — ready for build
> Author: Bahaa Ahmed (with Claude)
> Date: 2026-07-28

---

## Table of Contents

1. [Overview & Goals](#1-overview--goals)
2. [Current State (grounded in the real codebase)](#2-current-state-grounded-in-the-real-codebase)
3. [Key Decisions](#3-key-decisions)
4. [Open Design Issue — `pdf_settings` tenancy](#4-open-design-issue--pdf_settings-tenancy)
5. [Database Schema Changes](#5-database-schema-changes)
6. [Permissions](#6-permissions)
7. [Backend Architecture](#7-backend-architecture)
8. [API Endpoints](#8-api-endpoints)
9. [PDF Template Design](#9-pdf-template-design)
10. [Frontend Changes](#10-frontend-changes)
11. [File Manifest](#11-file-manifest)
12. [New Dependency — Puppeteer](#12-new-dependency--puppeteer)
13. [Deployment Considerations](#13-deployment-considerations)
14. [Testing Plan](#14-testing-plan)
15. [Risk Register](#15-risk-register)
16. [Implementation Phases](#16-implementation-phases)

---

## 1. Overview & Goals

**What we're building:** A coach-triggered "Export as PDF" action on both the nutrition plan builder and the training plan builder. Clicking it synchronously renders a branded, print-ready PDF (using the coach's configurable branding settings) and downloads it. A new **PDF Settings** page lets the coach configure that branding (logo, colors, footer, cover page, per-section toggles) once, reused across every export.

**What this is not (v1 non-goals):**
- No client-triggered export from the client portal.
- No bulk/batch export ("export all clients").
- No async job queue / email delivery of the PDF.
- No per-plan override of branding — one settings record applies to everything a coach exports.

---

## 2. Current State (grounded in the real codebase)

Findings from auditing the actual code (not the aspirational patterns in `CLAUDE.md` Part A — this project has real deviations, noted below so the plan doesn't fight the codebase):

- **`pdf_settings` already exists** in `server/prisma/schema.prisma:854-893`, fully scaffolded, **completely unused** — no controller, route, or frontend references it anywhere. It's nutrition-shaped: `cover_title` defaults to `"Nutrition Plan"`, and toggles like `show_meal_totals` / `show_cycle_summary_page` have no training equivalent.
- **No PDF library** in `server/package.json` or `client/package.json` (checked for puppeteer, jspdf, pdfkit, react-pdf, pdf-lib — none present).
- **Full plan data already has read endpoints**: `GET /api/nutrition/plans/:id` (`nutrition.controller.ts:229`, function `getPlan`) returns cycles → meals → items (+ alternatives). `GET /api/training/plans/:id` (`training.controller.ts`, `training.routes.ts:257`) returns days → exercises → sets. Both will be reused as the data source for rendering, not re-queried from scratch.
- **Controllers use raw `pg` (`pool.query`) with hand-written SQL**, not Prisma queries, despite Prisma being the schema source of truth. New controllers in this codebase should match that — Prisma is used for schema/migrations, `pool` for reads/writes.
- **No `asyncHandler` / `ApiError` utilities exist.** The real pattern is `try { ... } catch (err) { next(err); }` inside each controller function, funneling to the global error handler at `server/src/app.ts:197`.
- **Tenancy field is `req.user.workspaceId`**, not `req.tenantId` (confirmed in `server/src/types/express.d.ts:7`). All new queries filter on this.
- **Permission model is `requirePermission(module, action)`**, checking `req.user.permissions[module][action] === true` (`server/src/middleware/requirePermission.ts`), not dotted `domain.action` string keys. Modules currently registered in `server/src/lib/defaultPermissions.ts`: `clients`, `training`, `nutrition`, `forms`, `finance`, `databases`, `team`, `insights`.
- **File upload pattern**: `makeUploader(prefix, exts, opts)` + `toPublicUrl` from `server/src/lib/storage.ts` (S3-backed, local fallback) — see `server/src/lib/formAttachments.ts` for a working example. Reuse this for the logo/background-image uploads in PDF Settings.
- **Route mounting**: every module router is mounted once in `server/src/app.ts` (e.g. `app.use('/api/training', apiLimiter, trainingRouter)` at line 131). New router mounts the same way.

---

## 3. Key Decisions

Decided in scoping conversation (2026-07-28):

| Question | Decision | Why |
|---|---|---|
| Who triggers export? | Coach only, from the builder | No client-portal export in v1 — smaller surface, matches `pdf_settings` being coach-owned |
| Generation method | Server-side Puppeteer (HTML/CSS → PDF) | Full CSS control, easiest to match branding pixel-for-pixel, can reuse existing macro-donut-style visuals |
| Plan types covered | Both nutrition and training in v1 | One shared export pipeline, two templates |
| Reuse `pdf_settings`? | Yes — extend it, don't replace it | Already models exactly what's needed; extending avoids a redundant parallel model |
| Settings UI | New page needed | Nothing exists today; branding is unusable without it |
| Sync vs async | **Sync** — request blocks until the PDF streams back | Single-plan export is fast (~1-3s expected), infrequent, not bulk. Revisit only if batch export is added later or render times creep up in practice |

---

## 4. Open Design Issue — `pdf_settings` tenancy

**The problem:** `pdf_settings.coach_id` is `@unique`, FK'd to `users`, i.e. **one settings row per user account**. But this app's tenancy model is workspace-based — `clients`, `nutrition_plans`, `training_plans` are all scoped by `workspace_id`, and a single user can own or be a member of multiple workspaces (per the team-feature architecture in `docs/team-feature-plan.md`). A coach with two workspaces would get **one shared brand identity across both** — likely wrong if the workspaces are, e.g., two different client bases or white-label sub-brands.

**Recommendation:** rename `coach_id` → `workspace_id` on `pdf_settings`, unique on `workspace_id`, FK to `workspaces` instead of `users`. This aligns branding with the same tenant boundary as everything else it touches (`nutrition_plans.workspace_id`, `training_plans.workspace_id`), and matches the multi-tenancy rule in `CLAUDE.md` §5 — every tenant-scoped table is filtered/keyed by tenant id.

**Alternative (rejected):** keep `coach_id`. Simpler migration (no FK swap), but bakes in a same-brand-across-workspaces assumption that will need a bigger fix later once someone has two differently-branded workspaces. Flagging as `DEBT.md`-worthy if chosen instead.

**Decision needed before Phase 1 migration.** Plan below assumes the rename to `workspace_id`.

---

## 5. Database Schema Changes

Single migration, additive + one rename, no destructive drops (table is unused so this is low-risk):

```prisma
model pdf_settings {
  id                          String    @id
  workspace_id                String?   @unique          // was coach_id → users
  coach_name                  String    @default("FitForce")
  footer_text                 String    @default("Generated by FitForce")
  primary_color                String    @default("#007AFF")
  header_text_color           String    @default("#FFFFFF")
  table_header_bg_color       String    @default("#E8E8ED")
  table_alt_bg_color          String    @default("#F9F9FB")
  page_width                  Float     @default(595.28) @db.Real
  page_height                 Float     @default(841.89) @db.Real
  logo_url                    String?
  page_bg_image_url           String?
  cover_image_url             String?
  cover_subtitle               String?   @default("")
  back_cover_bg_image_url     String?
  show_cover_page              Boolean   @default(true)
  show_back_cover_page         Boolean   @default(false)
  show_plan_summary_page       Boolean   @default(true)
  updated_at                  DateTime? @default(now()) @db.Timestamp(6)

  // Nutrition-specific (existing, unchanged)
  show_notes                  Boolean   @default(true)
  show_alternatives           Boolean   @default(true)
  show_macros_summary         Boolean   @default(true)
  show_cycle_totals            Boolean   @default(true)
  show_meal_totals             Boolean   @default(true)
  show_food_calories           Boolean   @default(true)
  show_food_macros             Boolean   @default(true)
  show_meal_summary_page       Boolean   @default(true)
  show_cycle_summary_page      Boolean   @default(true)
  summary_bg_image_url         String?
  cover_title                  String    @default("Plan")    // generalized default (was "Nutrition Plan")
  plan_summary_bg_image_url    String?
  meal_summary_bg_image_url    String?
  cycle_summary_bg_image_url   String?
  max_meals_per_page           Int       @default(0)
  meals_content_primary_color  String?
  plan_summary_primary_color   String?
  cycle_summary_primary_color  String?

  // Training-specific (NEW)
  show_exercise_notes          Boolean   @default(true)
  show_exercise_equipment      Boolean   @default(true)
  show_sets_detail             Boolean   @default(true)      // reps/rest/tempo/rir table
  show_day_summary_page        Boolean   @default(true)
  day_summary_bg_image_url     String?
  exercise_content_primary_color String? 
  day_summary_primary_color    String?
  max_exercises_per_page       Int       @default(0)

  workspaces                   workspaces? @relation(fields: [workspace_id], references: [id], onDelete: Cascade, onUpdate: NoAction)
}
```

Steps (per `CLAUDE.md` §10 — Schema Change routine):
1. Edit `schema.prisma` as above.
2. `npm run db:migrate` (server) → named migration, e.g. `extend_pdf_settings_workspace_and_training`.
3. Data note: table is currently empty in every environment (unused), so the `coach_id → workspace_id` rename needs no backfill script — confirm row count is 0 before applying in prod, just in case.
4. Regenerate Prisma client (`db:generate`) — used only for the settings CRUD controller; export rendering itself reads via `pool` like the rest of the codebase.
5. No seed data needed — settings are created lazily (first `PUT` from the new settings page, or a sane default object returned by `GET` when no row exists yet).

---

## 6. Permissions

New permission module: **`pdfExport`**, added to `server/src/lib/defaultPermissions.ts` alongside the existing modules:

```ts
pdfExport: { read: true, write: true, delete: false },   // per role, tune per table below
```

| Action | Meaning | Guard |
|---|---|---|
| `read` | Trigger an export (nutrition or training) | `requirePermission('pdfExport', 'read')` on both export routes — but **also** re-check the underlying plan's own module permission (`nutrition`/`training` `read`) since exporting shouldn't bypass "can this role see this client's plan at all" |
| `write` | Edit branding settings (logo, colors, toggles) | `requirePermission('pdfExport', 'write')` on the settings `PUT`/logo-upload routes |

Suggested per-role defaults (mirroring the existing table's shape):

| Role | export (read) | settings (write) |
|---|---|---|
| manager | ✅ | ✅ |
| trainer | ✅ (training only, gated by existing `training.read`) | ❌ |
| nutritionist | ✅ (nutrition only, gated by existing `nutrition.read`) | ❌ |
| receptionist | ❌ | ❌ |
| viewer | ✅ | ❌ |

Owner bypasses all of this per the existing `isOwner` short-circuit in `requirePermission.ts`.

---

## 7. Backend Architecture

New module: `server/src/modules/pdfExport/`

```
server/src/modules/pdfExport/
├── pdfExport.routes.ts       ← GET /nutrition/:planId, GET /training/:planId,
│                                 GET /settings, PUT /settings, POST /settings/logo
├── pdfExport.controller.ts   ← validate → fetch plan (reuse existing query shape) →
│                                 fetch/default settings → render → stream buffer
├── pdfExport.service.ts      ← data-shaping helpers (map raw plan rows → template view-model)
└── templates/
    ├── layout.ts              ← shared HTML shell: fonts, page-size CSS from settings, header/footer
    ├── nutritionPlan.ts        ← cover + summary + per-cycle/meal pages
    └── trainingPlan.ts         ← cover + summary + per-day/exercise pages
```

New singleton: `server/src/lib/pdfRenderer.ts`
```ts
// One headless browser instance for the process lifetime — launching Chromium
// per request is the #1 cause of slow/expensive PDF export services.
let browserPromise: Promise<Browser> | null = null;
export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) browserPromise = puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  return browserPromise;
}
export async function renderHtmlToPdf(html: string, pageSize: { width: number; height: number }): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle0' });
    return await page.pdf({ width: `${pageSize.width}pt`, height: `${pageSize.height}pt`, printBackground: true });
  } finally {
    await page.close();   // close the page, not the browser — browser stays warm
  }
}
```
Register a `server.ts` shutdown hook to close the browser on process exit (mirrors how other singletons in `lib/` are expected to clean up).

**Controller flow for `GET /pdf-export/nutrition/:planId`** (mirrors real patterns from §2, not the Part A ideal):
```ts
export async function exportNutritionPlan(req: Request, res: Response, next: NextFunction) {
  try {
    const plan = await fetchFullNutritionPlan(req.params.planId, req.user!.workspaceId); // reuses nutrition.controller.ts's getPlan query logic, factored into a shared helper
    if (!plan) return res.status(404).json({ error: 'Nutrition plan not found' });

    const settings = await getOrDefaultPdfSettings(req.user!.workspaceId);
    const html = renderNutritionPlanHtml(plan, settings);
    const pdfBuffer = await renderHtmlToPdf(html, { width: settings.page_width, height: settings.page_height });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${slugify(plan.name)}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) { next(err); }
}
```

**Reuse note:** rather than duplicating the nested cycles→meals→items / days→exercises→sets queries, factor the existing `getPlan` query bodies out of `nutrition.controller.ts` / `training.controller.ts` into small shared helpers (`fetchFullNutritionPlan`, `fetchFullTrainingPlan`) that both the existing JSON endpoints and the new export controller call. This is a **Refactor**-flavored side step — small, mechanical, behavior-preserving — done as part of Phase 2 below, not a rewrite.

---

## 8. API Endpoints

All mounted under `/api/pdf-export` in `app.ts` (`app.use('/api/pdf-export', apiLimiter, pdfExportRouter)`), behind `authMiddleware` + `requirePermission('pdfExport', ...)`.

| Method | Path | Purpose | Guard |
|---|---|---|---|
| `GET` | `/pdf-export/nutrition/:planId` | Stream a nutrition plan PDF | `pdfExport.read` + plan must belong to `req.user.workspaceId` |
| `GET` | `/pdf-export/training/:planId` | Stream a training plan PDF | `pdfExport.read` + plan must belong to `req.user.workspaceId` |
| `GET` | `/pdf-export/settings` | Fetch current workspace's branding settings (defaults if none saved yet) | `pdfExport.read` |
| `PUT` | `/pdf-export/settings` | Upsert branding settings (colors, toggles, text fields) | `pdfExport.write` |
| `POST` | `/pdf-export/settings/logo` | Upload/replace logo image (multipart, via `makeUploader`) | `pdfExport.write` |
| `POST` | `/pdf-export/settings/background/:slot` | Upload a background image for a given slot (`cover`, `summary`, `backCover`, `plan-summary`, `meal-summary`, `cycle-summary`, `day-summary`) | `pdfExport.write` |

Each gets an `@openapi` JSDoc block per `CLAUDE.md` §8.7.

---

## 9. PDF Template Design

Both templates share a **layout shell** (`templates/layout.ts`) driven entirely by `pdf_settings` fields — no hardcoded brand values in the template HTML itself:

- Page size from `page_width` / `page_height` (defaults to A4 in points: 595.28 × 841.89).
- Header: logo (`logo_url`) + `coach_name`, background from `page_bg_image_url` if set.
- Footer: `footer_text`, page number.
- Color tokens: `primary_color`, `header_text_color`, `table_header_bg_color`, `table_alt_bg_color`.

**Nutrition plan page flow** (each gated by its `show_*` toggle):
1. Cover page (`show_cover_page`) — `cover_title`, `cover_subtitle`, client name, date range, `cover_image_url`.
2. Plan summary page (`show_plan_summary_page`) — cycle list with goal macros.
3. Per-cycle summary (`show_cycle_summary_page`) — cycle goal calories/protein/carbs/fats, `show_cycle_totals`.
4. Per-meal breakdown (`show_meal_summary_page`, `max_meals_per_page` for pagination) — meal name, food items table (`show_food_calories`, `show_food_macros`), alternatives (`show_alternatives`), notes (`show_notes`), meal totals (`show_meal_totals`).
5. Back cover (`show_back_cover_page`).

**Training plan page flow** (mirrors the structure, training vocabulary):
1. Cover page — same fields, generic `cover_title` default now just `"Plan"` so it reads correctly for either type (export controller passes the concrete title, e.g. plan.name, rather than relying on the settings default alone).
2. Plan summary — day list overview.
3. Per-day summary (`show_day_summary_page`) — day name, exercise count, notes.
4. Per-exercise breakdown (`max_exercises_per_page` for pagination) — exercise name, equipment (`show_exercise_equipment`), sets table (reps/rest/tempo/rir, `show_sets_detail`), notes (`show_exercise_notes`).
5. Back cover.

No charts/donut visuals in v1 — a plain macros table is sufficient and avoids porting `MacrosDonut.js`'s canvas/SVG rendering into a server template. Flag as a `🔵 nice-to-have` for a v2 pass once the base export is validated.

---

## 10. Frontend Changes

**New page:** `client/app/(coach)/[workspaceSlug]/settings/pdf/page.js` (or wherever other workspace settings live, e.g. alongside `settings/subscription/page.js`) — form for every `pdf_settings` field: logo upload, color pickers, text inputs, toggle switches grouped by "Branding", "Cover Page", "Nutrition Sections", "Training Sections". Saves via `PUT /api/pdf-export/settings`.

**Export buttons:**
- `client/app/(coach)/[workspaceSlug]/clients/[id]/nutrition/page.js` — add an "Export PDF" action near the existing plan controls. On click: `window.location` or a fetch-then-blob-download to `GET /api/pdf-export/nutrition/:planId`, with a loading spinner state for the ~1-3s sync wait (per the sync decision in §3) and a toast on failure.
- `client/app/(coach)/[workspaceSlug]/clients/[id]/training/page.js` (equivalent training builder page) — same pattern against the training endpoint.

Both buttons disabled while a draft is unsaved (exporting a stale/unsaved plan would be confusing) — check whatever "dirty" state the builder already tracks.

---

## 11. File Manifest

**Backend — new:**
- `server/migrations/0XX_extend_pdf_settings.js` (generated by `db:migrate`)
- `server/src/modules/pdfExport/pdfExport.routes.ts`
- `server/src/modules/pdfExport/pdfExport.controller.ts`
- `server/src/modules/pdfExport/pdfExport.service.ts`
- `server/src/modules/pdfExport/templates/layout.ts`
- `server/src/modules/pdfExport/templates/nutritionPlan.ts`
- `server/src/modules/pdfExport/templates/trainingPlan.ts`
- `server/src/lib/pdfRenderer.ts`

**Backend — modified:**
- `server/prisma/schema.prisma` (§5)
- `server/src/lib/defaultPermissions.ts` (add `pdfExport` module)
- `server/src/app.ts` (mount new router)
- `server/src/modules/nutrition/nutrition.controller.ts` (extract `fetchFullNutritionPlan` helper)
- `server/src/modules/training/training.controller.ts` (extract `fetchFullTrainingPlan` helper)

**Frontend — new:**
- `client/app/(coach)/[workspaceSlug]/settings/pdf/page.js`
- Small `ExportPdfButton` component if reused in both builder pages

**Frontend — modified:**
- Nutrition builder page (add export button)
- Training builder page (add export button)

**Docs:**
- `DEPENDENCIES.md` — log `puppeteer` addition (§12)
- `DECISIONS.md` — log the `pdf_settings` tenancy fix (§4) as a recorded decision

---

## 12. New Dependency — Puppeteer

Vetting per `CLAUDE.md` §B6 before adding:
1. **Needed vs. trivial to write ourselves?** Needed — HTML-to-PDF rendering with real CSS support isn't something to hand-roll.
2. **Maintained?** Yes, actively maintained by the Chrome team, frequent releases.
3. **Adoption?** Extremely high — one of the most-used Node packages for headless browser automation.
4. **Known CVEs?** None specific to the library itself at the time of writing; standard practice is to keep it current since it bundles Chromium.
5. **Install/footprint cost?** Meaningful — bundles a full Chromium binary (~300MB+), the main real cost. Consider `puppeteer-core` + a system-installed Chromium if the VPS should stay lean (trade-off: server needs Chromium installed and kept updated independently).

**Recommendation:** add `puppeteer` (not `-core`) for v1 simplicity; revisit `puppeteer-core` + system Chromium only if the bundled-binary footprint becomes an actual deploy problem.

---

## 13. Deployment Considerations

`deploy.sh` targets a bare VPS via PM2 (no Docker/container layer) — Puppeteer's Chromium needs its shared library dependencies present on that VPS (`libnss3`, `libatk1.0-0`, `libgbm1`, etc. on Debian/Ubuntu). This is a **one-time ops step**, not app code:
```bash
sudo apt-get install -y libnss3 libatk1.0-0 libatk-bridge2.0-0 libgbm1 libasound2 libxshmfence1 libx11-xcb1
```
Confirm this before Phase 4 (deploy) — verify by running `npx puppeteer browsers install chrome` and a smoke-test render on the actual target VPS, not just locally.

Memory note: each concurrent export holds one Chromium page in memory briefly. At current expected usage (occasional single-plan export, not bulk) this is a non-issue; revisit if usage patterns change.

---

## 14. Testing Plan

Per `CLAUDE.md` §B5, covering the four buckets:

- **Happy path:** export a nutrition plan with 2 cycles / multiple meals → valid PDF, correct page count, branding applied. Same for training.
- **Edges:** plan with zero cycles/days (empty plan) → PDF still renders (no crash on `[].map()`), zero-meal cycle, a single food item, `max_meals_per_page` boundary (exactly N vs N+1 items).
- **Sad path:** `planId` that doesn't exist → 404, not a Puppeteer crash. `planId` belonging to a different workspace → 404 (tenant isolation — never leak existence). No `pdf_settings` row yet → falls back to schema defaults, doesn't throw. Missing/broken `logo_url` (e.g. deleted S3 object) → template renders without the image, doesn't fail the whole export.
- **Weird:** Arabic client/food names (`name_ar`) — verify RTL/font rendering doesn't break Puppeteer's PDF output; very long plan (many cycles/days) — confirm pagination and memory are fine; concurrent exports from two different coaches — confirm the singleton browser handles parallel pages correctly.
- **Auth/authz/tenancy suite** (per §B5's endpoint checklist): no token → 401; token without `pdfExport.read` → 403; workspace A's coach requesting workspace B's `planId` → 404; settings `PUT` without `pdfExport.write` → 403.

---

## 15. Risk Register

| Risk | Impact | Mitigation |
|---|---|---|
| Chromium missing/misconfigured on prod VPS | Export endpoint 500s in prod only | Smoke-test on the actual VPS before calling Phase 4 done (§13) |
| `pdf_settings` tenancy rename breaks something unseen (unlikely, table unused) | Low — confirm row count is 0 first | Trivial to verify before migrating |
| Puppeteer render is slower than expected under real data volume | Sync request feels slow/times out | Time a real render with a large plan during Phase 3; move to async only if actually needed (§3) |
| Duplicated plan-fetch logic between JSON endpoints and export drifts over time | Export shows stale/different data than the builder | Phase 2's extraction into shared helpers prevents two copies existing at all |
| Arabic content / RTL rendering issues in generated PDF | Broken layout for Arabic-first coaches | Explicit test case in §14 "weird" bucket before calling the feature done |

---

## 16. Implementation Phases

Each phase ends in a working, reviewable state — no "big bang" merge.

**Phase 0 — Confirm the open decision**
- Confirm §4 (rename `coach_id` → `workspace_id`) before writing the migration.

**Phase 1 — Schema Change** (`CLAUDE.md` Schema Change routine)
- Extend `pdf_settings` per §5, migrate, regenerate client.

**Phase 2 — Backend plumbing**
- Extract `fetchFullNutritionPlan` / `fetchFullTrainingPlan` helpers (behavior-preserving refactor, verify existing endpoints still work identically).
- Add `pdfExport` permission module + seed defaults (§6).
- Build `lib/pdfRenderer.ts` singleton + Puppeteer install/vet (§12).

**Phase 3 — Export endpoints + templates**
- Build the two export routes/controllers and the two HTML templates (§7, §9).
- Manual test: real plan data → real PDF, eyeball it against the branding settings.

**Phase 4 — Settings CRUD + logo/background uploads**
- Build `GET`/`PUT /pdf-export/settings` and image upload routes reusing `lib/storage.ts`.

**Phase 5 — Frontend**
- Build the PDF Settings page (§10).
- Add export buttons to both builder pages.
- Manual click-through test in the browser (per `CLAUDE.md`'s UI-change rule — don't claim done without actually clicking it).

**Phase 6 — Deploy readiness**
- Install Chromium deps on the target VPS (§13), smoke-test a real export in that environment before calling the feature shipped.

**Phase 7 — Code Review + Pre-Commit + Pre-Merge**
- Run the standard routines from `CLAUDE.md` Part C before merging.

---
