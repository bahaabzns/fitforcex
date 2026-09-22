# User Bugs & Features — Investigation Findings and Implementation Plan

Status: **DRAFT — pending approval. Do not implement until explicitly approved.**

This document covers six user reports. Each section has: description, investigation findings, root cause, proposed solution, schema/API/frontend changes, edge cases, tests, and ordered implementation steps.

Product decisions confirmed with the user before writing this plan are called out inline as **Decision:**.

---

## 1 & 2. Training Plan PDF Export Fails + Blank Pages

These are two independent bugs in the same feature (`server/src/modules/pdfExport/`), sharing no code path. Fixed together because they touch the same files.

### 1. PDF export fails

**Root cause (best-supported hypothesis, not yet log-confirmed):** Puppeteer/Chromium fails to launch on the production VPS due to missing OS shared libraries (`libnss3`, `libatk1.0-0`, `libgbm1`, etc.). `deploy.sh` deploys straight to a bare VPS via PM2 — no Docker, no verified Chromium dependency install step. This is already flagged, unresolved, in `DEBT.md` (2026-07-28): *"Puppeteer's bundled Chromium needs shared libs... not yet verified on the actual production host, only confirmed working in local dev."* `getBrowser()` (`server/src/lib/pdfRenderer.ts`) launches with only `--no-sandbox --disable-setuid-sandbox`, no `executablePath` override, no `PUPPETEER_EXECUTABLE_PATH` env var anywhere in `server/src/config/env.ts`.

Whatever the real exception is, it's fully masked by two independent layers before it ever reaches the user:
- **Backend:** the global error handler (`server/src/app.ts:199-211`) always responds `500 { error: 'Internal server error' }` for unhandled errors — correct behavior for not leaking internals, but it means the real cause never surfaces anywhere except server logs/Sentry.
- **Frontend:** `handleExportPdf` catches with a bare, parameterless `catch {}` (`client/app/(coach)/[workspaceSlug]/clients/[id]/training/page.js:135-136`, and the identical pattern in the nutrition PDF export at `.../nutrition/page.js:151-152`), discarding the real error entirely and always showing the same hardcoded string. Because the request uses `responseType: "blob"`, even a JSON error body arrives as an unparsed `Blob` — unreadable without an extra `await blob.text()` step that isn't there.
- **Test gap:** `server/tests/integration/pdfExport.test.ts` covers auth/permissions/validation/tenant isolation but explicitly does not exercise the real Puppeteer render (blocked by Jest/ESM incompatibility, per its own `DEBT.md` entry) — a Chromium launch failure would never be caught before a real user hits it in production.

**Secondary possibility (cannot rule out from code alone):** `server/src/scripts/backfill-pdf-export-permission.ts` exists specifically because the `pdfExport` permission key was added after some workspace members' `permissions` JSON was already seeded — if that backfill was never run against production, a non-owner workspace member would get a `403` (not a `500`), which would present identically to the user (same generic frontend message, since the catch block ignores the status code too).

### 2. Blank pages

**Root cause (confirmed by reading the code, not a hypothesis):** In both `server/src/modules/pdfExport/templates/trainingPlan.ts` and `nutritionPlan.ts`, the auto-fit pagination pass measures every block's height including the page header (`renderHeader`, pushed at `blocks[0]`, `trainingPlan.ts:157`), but the per-page content budget only subtracts the footer's height:

```ts
// trainingPlan.ts:186-187 (identical pattern in nutritionPlan.ts)
const footerHeight = heights[1];
const usableHeight = settings.page_height - PAGE_PADDING_PT - footerHeight;
// heights[0] — the header's measured height — is computed but never used anywhere else in the file.
```

Every real content page renders the header too (`trainingPlan.ts:244`, `${renderHeader(settings)}`), which takes up real vertical space by default (`coach_name: 'FitForce'` and/or a logo, per `pdfExport.service.ts:50` — most workspaces have this on). So `usableHeight` is systematically too large by roughly one header's height, and `chunkByHeight` (`templates/pagination.ts`) packs more exercises/meals onto a page than will physically fit once the header is added back at render time. The overflow, combined with `.section { page-break-inside: avoid }` (`layout.ts:130`), pushes the last item that doesn't fit onto a Chromium-generated continuation page — which can end up nearly empty — immediately followed by the deliberately forced `page-break` div into the next real page. That sequence is what the user sees as a spurious blank/near-blank page.

This was a known, partially-fixed problem: commit `f766403` ("rework training/nutrition PDF rendering... auto-pagination") introduced the current measurement-based approach specifically to stop Chromium's native pagination from fragmenting content, but the header-height omission means the fix is incomplete.

**Lower-confidence secondary contributor:** the measurement pass renders blocks bare (not wrapped in `.page`'s padding), so text-wrap width during measurement doesn't match the real render width — under-measuring height for any exercise/meal name long enough to wrap, compounding the same overflow.

### Proposed solution

1. **Fix the pagination math** (`trainingPlan.ts`, `nutritionPlan.ts`): subtract `heights[0]` (header height) from `usableHeight` alongside the existing footer subtraction. Wrap the measurement pass's blocks in the same `.page` padding container used at render time, so measured widths match real render widths.
2. **Stop masking errors:**
   - Backend: keep the generic `500` body for the client (security-correct), but make sure the real error is actually being captured — confirm `Sentry.captureException` fires from the global handler for this path (it should already, per `app.ts:199-211`; verify during implementation) and add a specific log line identifying the PDF export route so it's easy to find.
   - Frontend: change the bare `catch {}` in both `training/page.js` and `nutrition/page.js` to `catch (err)`, read the status code, and — since the response is a blob — `await err.response?.data?.text()` to parse the JSON body when present, so a `403` (permission) is distinguishable from a `500` (render failure) in logs/telemetry, even though the user-facing message can stay generic. Add `console.error` so this is visible in browser dev tools / any error-monitoring the client already has.
3. **Verify (and fix if needed) the production Chromium environment as an explicit deploy step:** add a Chromium/Puppeteer dependency check to `deploy.sh` (install the OS packages Puppeteer's install docs specify for Debian/Ubuntu, or verify they're already present) so this doesn't silently keep failing after future deploys. This is infrastructure, not application code — flagging it clearly since it's the most likely actual fix for bug 1.
4. **Verification steps before/while implementing** (not product decisions, just facts to check):
   - Check Sentry / server logs for the actual exception the next time export is attempted, to confirm or replace the Chromium-libs hypothesis.
   - Check whether Nutrition PDF export currently works — it shares the exact same `renderHtmlToPdf`/`getBrowser()` path. If it also fails, that confirms the shared-infra hypothesis; if it works, the training-specific data path needs a second look (e.g. `tracking_type`/`tracked_metrics` columns from migrations 080-083 not applied in production).
   - Confirm whether `backfill-pdf-export-permission.ts` was run against production; if the reporting user is a non-owner workspace member, run it if not.

### Files likely to change
- `server/src/modules/pdfExport/templates/trainingPlan.ts` — pagination budget fix.
- `server/src/modules/pdfExport/templates/nutritionPlan.ts` — same fix.
- `server/src/modules/pdfExport/templates/layout.ts` (if the measurement-wrapper padding fix needs a shared helper).
- `client/app/(coach)/[workspaceSlug]/clients/[id]/training/page.js` — error handling.
- `client/app/(coach)/[workspaceSlug]/clients/[id]/nutrition/page.js` — same fix, same file already has the identical bug.
- `deploy.sh` — Chromium OS dependency verification/install step.
- `DEBT.md` — mark the "Chromium system libs not yet confirmed" entry ✅ RESOLVED once verified, or update with findings.

### Edge cases
- Plans with `show_cover_page`/`show_plan_summary_page`/`show_day_summary_page` all off — header-height fix must not change page count for plans that already paginate correctly.
- A day/cycle with zero exercises/meals — already returns `[]` early (`trainingPlan.ts:192`), unaffected by this fix.
- Workspaces with no logo and no coach name set — header may render smaller/empty; the fix should use the actually-measured height (already dynamic), not a hardcoded constant, so this self-adjusts.
- Very long exercise/meal names that wrap to two lines — covered by the padding-width fix (point 1 above).

### Tests to add/update
- `server/tests/unit/pdfExport.pagination.test.ts`: add a case asserting the computed `usableHeight` accounts for header height (currently only tests `chunkByHeight` in isolation with hand-fed budgets — extend or add a test that exercises `measureDayGroups`'s budget calculation directly, mocking the measurement call).
- Manual smoke test via `server/src/scripts/smoke-test-pdf-export.ts` — run before/after with a plan that currently produces a blank page, confirm it no longer does.
- Frontend: no existing test file for this component; add a basic test that a non-2xx response with a parseable JSON blob body surfaces the parsed error to `console.error`/telemetry (not necessarily changing the user-facing string).

### Implementation order
1. Fix `usableHeight` calculation (subtract header height) in both templates — this is the highest-confidence, self-contained fix.
2. Fix measurement-pass padding-width mismatch.
3. Run `smoke-test-pdf-export.ts` against a known blank-page-producing plan to confirm.
4. Fix frontend error swallowing in both training and nutrition export handlers.
5. Add the Sentry/log verification for the backend path.
6. Investigate the actual production failure (logs, Nutrition export check, permission backfill check) and apply whichever fix that reveals (Chromium libs install step in `deploy.sh` is the leading candidate).
7. Update `DEBT.md`.

---

## 3. Incorrect/Literal Arabic Translation in Food Alternatives (fitsavior-com)

### Investigation findings

Two features show food "alternatives": coach-curated alternatives (`nutrition_meal_item_alternatives`, joined to `food_items` in `nutrition.controller.ts`) and the client-initiated swap search (`clientPortalFoodSwap.controller.ts`). Both read from the same table.

`food_items` (and the global `master_food_items` template) already store bilingual names: `name_en` (required) and `name_ar` (optional, nullable, free-text, coach-entered via a plain `<input dir="rtl">` in `FoodForm.js` with **no validation and no requirement**). The default library's Arabic names (`seed-default-libraries.ts`) are correctly hand-typed by a developer — e.g. `'Chicken Breast' → 'صدر فراخ'` — so any bad Arabic would come from a **custom food item added later** by a coach, not the default library.

**Ruled out with high confidence:**
- FitForce's own i18n system (`ar.json`/`en.json`) — grepped both files; zero food-name keys exist. Food names are DB values interpolated into templates, never looked up through the translation catalog. The i18n layer cannot mistranslate a food name because it never touches one.
- AI/LLM-based translation — no OpenAI/GPT/Anthropic/translation-API calls exist anywhere in the nutrition or food pipeline; every Arabic food string in the codebase is hand-typed (dev seed or coach input).
- Workspace-level customization for `fitsavior-com` — no locale override exists at the workspace level; locale is a per-user preference (`PATCH /api/auth/profile { preferred_language }`), so the client explicitly chose Arabic.

**Confirmed, independent FitForce bug found during investigation:** every place that renders a localized food name uses this fallback, duplicated across four files (`client/app/(client)/portal/nutrition/page.js:25`, `RightPanel.js:37`, `FoodSwapModal.js:79,108,135`):
```js
const localizedFoodName = (food) => (isRTL && food?.name_ar) || food?.name || food?.name_ar || '';
```
If `name_ar` is empty/null, this silently falls back to the **English** name even while the rest of the page is in Arabic (`isRTL` true). This means any food item missing an Arabic name renders in plain English inside an otherwise fully-Arabic screen — independent of any translation system, and a real, demonstrable bug regardless of what the client actually saw.

`<html lang="ar" dir="rtl">` is set correctly (`client/app/layout.js:26`), and no `notranslate`/`translate="no"` attribute exists anywhere in the client — so nothing in the code either invites or suppresses Chrome's built-in translate feature. A page with English text embedded in an Arabic page (caused by the bug above) is exactly the kind of mixed-language content that triggers Chrome's translate prompt, and Google Translate is well known for producing literal, context-blind translations of food/dish names — matching the reported symptom.

**Assessment:** most likely a compounding scenario, not one single cause — a coach at `fitsavior-com` added a custom food item without a (good) `name_ar`; the fallback bug displayed English inside the Arabic UI; Chrome's translate feature engaged (automatically or by the client clicking "Translate") and rendered a literal, incorrect Arabic version. The bad-manual-Arabic-data possibility and the browser-translation possibility aren't mutually exclusive, and both are architecturally supported by what's in the code — the fallback bug is real either way.

### Proposed solution

This does not require the exact repro mechanism to be confirmed — the fixes below are correct regardless of whether Chrome translation was involved for this specific report:

1. **Fix the RTL fallback bug.** Never silently substitute the English name into an Arabic-rendered UI without any indication. Proposed default: when `name_ar` is missing on an Arabic page, show the English name with a small visual marker (e.g. a subtle "(EN)" suffix or distinct styling) so it's clearly not being mistaken for a real Arabic term — applied consistently across all four call sites.
2. **Prevent the browser from re-translating our own localized content.** Add `translate="no"` / `className="notranslate"` to the food-name elements specifically (not the whole page — other content should remain translatable for genuinely English-only workspaces). This stops Chrome from mangling food names we've already localized correctly, and removes it as a factor going forward regardless of what happened in this specific report.
3. **Improve data quality at the source.** In the coach-facing `FoodForm.js` and the admin Food Items table, surface a visible warning/indicator when `name_ar` is empty for a workspace whose members use Arabic — nudging coaches to fill it in, without making it a hard-required field (some workspaces may be English-only).

### What's still needed from you to fully confirm root cause for this specific report
- The exact food item name(s) the client says looked wrong (as shown, in both languages if visible).
- A screenshot showing whether Chrome's "Translate this page?" prompt or the "translated to Arabic" banner was visible at the time.
- Whether the affected item, checked in `fitsavior-com`'s own Food Items admin table (`.../nutrition/food-items`), already shows the bad/literal Arabic text there (confirms bad data at rest, not live browser translation) or shows correct/blank Arabic (points to live browser translation as the dominant factor).

### Files likely to change
- `client/app/(client)/portal/nutrition/page.js`, `client/app/components/nutrition/RightPanel.js`, `client/app/components/portal/FoodSwapModal.js` — shared `localizedFoodName` fallback fix + `notranslate` attribute. Given the fallback logic is duplicated 4 times identically, consider extracting it to one shared utility while fixing it (matches the "extract on the third copy" rule already in this repo's engineering standards).
- `client/app/components/nutrition/FoodForm.js` — missing-`name_ar` indicator.
- `client/app/(coach)/[workspaceSlug]/nutrition/food-items/page.js` — same indicator in the admin table.

### Edge cases
- Workspace that intentionally has no Arabic-speaking clients — the missing-`name_ar` nudge must not become a blocking requirement.
- A food item where `name_ar` exists but is itself poor-quality text a coach typed — no code fix can detect "bad Arabic text," only "missing Arabic text." This case can only be caught by manual data review, not automatically.

### Tests to add/update
- Unit test for the (now shared/extracted) `localizedFoodName` helper: happy path (both names present), `name_ar` missing on an RTL page (must not silently look identical to real Arabic), `name` missing (reverse fallback), both missing (empty string, no crash).
- No backend changes in this fix, so no new backend tests.

### Implementation order
1. Extract and fix the shared fallback helper; apply the "(EN)"-style marker.
2. Add `notranslate` to food-name elements.
3. Add the missing-`name_ar` indicator in `FoodForm.js` and the admin table.
4. Ask the user for the confirmation details above; if they reveal a `fitsavior-com`-specific bad data row, fix that data directly (not a code change).

---

## 4. Food Diary / Daily Food Tracking

### Investigation findings

The current "check mark" (`client/app/(client)/portal/nutrition/page.js:34,130-136`, `checkedItems`/`toggleItem`) is **pure ephemeral React state** — `useState(new Set())`, mutated locally, never sent to any API. There is no save call to have a bug in; it resets on every reload/navigation and was introduced (`git log`, commit `4b68d62`) purely as local UI state, never wired to a backend. Confirmed via a full read of both the client-portal and coach-side nutrition route tables: **no endpoint exists** for marking food as eaten anywhere in the codebase.

There is **no per-day tracking/diary/adherence model anywhere in `schema.prisma`** (grepped all ~70 models for `FoodLog`/`DietLog`/`MealLog`/`Adherence`/`DailyLog`/`Diary` — zero matches). The only "Adherence" string in the codebase is a manually-typed free-text category on `client_observations` — a coach can tag a note "Adherence" but nothing computes it.

The nutrition plan data model is a static tree with **no calendar-day dimension**:
```
nutrition_plans (status, activated_at, cycle_days, cycle_end_at)
  → nutrition_cycles (a manually-switched "phase" tab, e.g. "Cycle 1" — NOT a calendar day)
    → nutrition_meals
      → nutrition_meal_items (→ food_items)
```
`cycle_days`/`cycle_end_at` only drive when a coach is prompted to review/restart a plan — never a day-by-day meal rotation. Only one plan can be `active` per client at a time.

**Critical constraint for any future design:** every coach save (`saveDraft`, `nutrition.controller.ts:290-420`) **deletes and re-inserts the client's entire plan tree** — every cycle, meal, and meal item gets a brand-new `createId()`, even for a trivial edit. There is no plan versioning/history table. This means any tracking data keyed by `meal_item_id` would be silently orphaned on the very next coach edit, not just on a full plan replacement.

By contrast, `training`'s `workout_logs` model already implements exactly the per-day-log pattern nutrition is missing: `date @db.Date`, `day_id`, `day_index`, `completed: Boolean`, `exercises: Json`, indexed on `[client_id, date]` — a useful structural precedent, and confirmed (via `DECISIONS.md`) to store a **snapshot** specifically so a finished log doesn't change when the coach later edits the plan.

There is **zero coach-facing view** of client eating behavior/adherence, even partial — `insights` module is unrelated (customer feedback/NPS), the coach dashboard has no nutrition data, and the coach-side client nutrition page has no adherence/history concept.

### Decisions confirmed with the user
- **Decision — adherence metric:** calorie/macro-based — sum the nutrition values of items the client marked eaten against the active cycle's `goal_calories`/`goal_protein`/`goal_carbs`/`goal_fats`.
- **Decision — daily assignment model:** "today's assigned foods" = whatever meal/item list is in the client's currently active cycle, every day, unchanged from how plans work today. No day-of-week meal scheduling is being added. A diary entry for a given date just needs to reference which meal items were checked/how much was eaten that day.
- **Decision — tracking granularity:** support partial amounts eaten (not just binary checked/unchecked), since calorie/macro adherence needs to reflect how much of a prescribed amount was actually consumed.
- **Decision — history depth:** unlimited/full history for both client and coach — no rolling window or purge, matching how `workout_logs` and everything else in this codebase already behaves (nothing here does time-based deletion).

### Proposed solution

**New model, following the `workout_logs` snapshot precedent (given plan items get new IDs on every coach edit — a snapshot avoids orphaning):**

```prisma
model food_diary_entries {
  id            String   @id
  client_id     String
  workspace_id  String
  plan_id       String?          // nutrition_plans.id at time of logging (nullable — plan may later be deleted)
  cycle_id      String?          // nutrition_cycles.id at time of logging
  date          DateTime @db.Date
  items         Json     @default("[]")   // snapshot: [{ meal_item_id, food_item_id, name_en, name_ar, meal_name,
                                            //   prescribed_amount, serving_unit, amount_eaten, calories, protein, carbs, fats }]
  total_calories   Decimal? @db.Decimal
  total_protein    Decimal? @db.Decimal
  total_carbs      Decimal? @db.Decimal
  total_fats       Decimal? @db.Decimal
  goal_calories    Int?     // copied from the cycle at time of logging, for stable historical % display
  goal_protein     Int?
  goal_carbs       Int?
  goal_fats        Int?
  created_at    DateTime @default(now()) @db.Timestamptz(6)
  updated_at    DateTime @default(now()) @db.Timestamptz(6)
  clients       clients     @relation(fields: [client_id], references: [id], onDelete: Cascade)
  workspaces    workspaces  @relation(fields: [workspace_id], references: [id], onDelete: Cascade)

  @@unique([client_id, date])   // one entry per client per day — updated throughout the day as items are (un)checked
  @@index([client_id, date])
  @@index([workspace_id])
}
```

Why a JSON snapshot of `items` rather than a child table keyed by live `meal_item_id`: the same orphaning problem that led to the `workout_logs` design applies here — a coach editing the plan mid-day must not retroactively corrupt what the client already logged for that day. The snapshot is built/refreshed from the live plan the first time the client interacts with the diary that day, then items are updated in place as the client checks/unchecks or adjusts amounts, independent of any later plan edits.

**Why one row per client per day (not one row per item):** matches `workout_logs`' one-row-per-session shape and keeps calorie/macro rollups (`total_calories`, etc.) as simple stored aggregates recomputed on every write — consistent with how `workout_logs`' summary stats are computed at write/read time rather than normalized into child tables.

**API (new module `server/src/modules/foodDiary/`, or a sub-area of `clientPortal` — recommend a new module since this has both client-write and coach-read surfaces, matching the module-per-feature convention):**
```
GET  /api/client-portal/food-diary/today          # returns today's entry, creating/refreshing the item snapshot from the active plan if none exists yet
PATCH /api/client-portal/food-diary/today          # upsert: { meal_item_id, amount_eaten } — client checks/adjusts one item at a time
GET  /api/client-portal/food-diary/history         # paginated list of past entries for the logged-in client
GET  /api/nutrition/clients/:clientId/food-diary    # coach view: paginated history + adherence trend for a specific client (tenant + client-ownership scoped)
```
`PATCH` recomputes `total_calories`/`total_protein`/`total_carbs`/`total_fats` server-side from `food_items`' per-serving values × `amount_eaten` every time, rather than trusting client-sent totals.

**Frontend:**
- Client Nutrition page: replace the local-only `checkedItems`/`toggleItem` with real API-backed state — on check/amount change, `PATCH` the diary entry (debounced, following the same pattern proposed for Training Mode's autosave in section 5, for consistency). Add a simple history view (reuse the existing cycle-switcher UI pattern to switch between dates instead of cycles, or a dedicated `/portal/nutrition/diary` route).
- Coach client-nutrition page: add an adherence view — daily %, and a trend over a selected period — using the stored `total_*`/`goal_*` columns for the % calculation (`total_calories / goal_calories`, etc., averaged appropriately across macros).

### Database/schema changes
- New model `food_diary_entries` (above), migration named e.g. `add_food_diary_entries`.
- No changes needed to `nutrition_plans`/`cycles`/`meals`/`meal_items` — the snapshot approach avoids touching the fragile delete-and-reinsert save flow.

### Edge cases
- Client has no active plan yet — `GET .../today` returns an empty/null state, no entry created.
- Coach swaps a food item or edits the plan **after** the client already logged today — per the snapshot design, today's already-logged entry is unaffected; the next day's fresh snapshot reflects the new plan. Flag this behavior explicitly to the client/coach in the UI copy so it's not surprising.
- Client checks an item, then the coach deletes that food item from the global library entirely — snapshot already captured `name_en`/`name_ar`/nutrition values at log time, so history remains readable even if the source `food_items` row is later removed re food-diary display (though `food_item_id` itself has no FK constraint from this table, by design, to avoid `onDelete` cascading deleting historical diary data).
- Client logs partial amount greater than the prescribed amount (e.g., ate extra) — allow it; adherence math should not clamp at 100% per item unless the user wants over-consumption visible as >100%. Flag: worth surfacing this design choice in a quick follow-up rather than assuming — see "Open question" below.
- Multiple devices/tabs open at once — `PATCH` should be a per-item upsert (not "replace whole day"), so concurrent edits to different items don't clobber each other; last-write-wins per item is acceptable (matches this codebase's general risk tolerance elsewhere, e.g. the assignee-picker's optimistic-update pattern in Plans Queue).

### Open question worth a quick follow-up during implementation (not blocking the plan)
Should over-consumption (client logs more than the prescribed amount of an item) be capped at the prescribed amount for adherence math, or allowed to push the day's % above 100? Recommend allowing it (more honest data) but flagging for confirmation once the UI is being built, since it's a small, easily-adjusted detail rather than an architectural fork.

### Tests to add/update
- `server/tests/integration/foodDiary.test.ts` (new): auth-denied, tenant-isolation (client A cannot read/write client B's diary), validation-fail (bad `meal_item_id`/negative amount), happy path (check item → totals update correctly), snapshot-stability (edit the plan after logging, confirm today's already-created entry is untouched), coach-read endpoint scoped correctly to their own workspace's client.
- `server/tests/unit/foodDiaryStats.test.ts` (new): calorie/macro rollup math from a snapshot's `items` array, adherence % calculation against `goal_*` fields.
- Client: add the first test file for the nutrition portal page's diary interaction (there are currently zero client-side tests for this page).

### Implementation order
1. Schema: add `food_diary_entries`, migrate, regenerate Prisma client.
2. Backend: build `foodDiary` module (`GET today`, `PATCH today`, `GET history`) with the snapshot-creation-on-first-access logic and server-side nutrition rollup.
3. Backend: coach-read endpoint + tenant/ownership scoping.
4. Backend tests (per above).
5. Frontend: wire the client Nutrition page's existing checkboxes to the new API (replace local `checkedItems` state), add partial-amount input UI.
6. Frontend: client-facing history view.
7. Frontend: coach-facing adherence view (daily % + trend).
8. Client-side tests.

---

## 5. Training Mode — Instant Save

### Investigation findings

Training Mode (`client/app/(client)/portal/training/session/page.js`) holds the entire in-progress session in a single React `useState` object (no Context/Redux/form-lib). Every input change (`changeSet`, `toggleSet`, `changeNote`) updates local state only; the sole side effect is a `useEffect` that writes the whole session to `localStorage` on every change (`client/lib/trainingSessionStore.js`) — a client-only draft, never sent to the server. The only API call in the entire flow is the final `POST /api/client-portal/workout-logs` on Finish, which does exactly one `prisma.workout_logs.create()` — a single JSONB blob of the whole session.

This was a **deliberate, documented v1 trade-off**, not an oversight — `DECISIONS.md` (dated 2026-06-17) explicitly records: *"Store logged sets as a JSON snapshot, not normalized tables"* (rejected child tables because a finished log is an immutable point-in-time snapshot) and *"In-progress session persisted to localStorage, saved only on Finish... avoids a server-side draft model... trade-off: no cross-device resume — noted as a follow-up."* This is exactly the follow-up now being requested.

**Finish Workout's full responsibilities** (confirmed by reading `submitFinish` and the backend `createWorkoutLog` end to end) are narrower than they might seem: (1) insert one `workout_logs` row, (2) compute and return a volume/duration/set-count summary for the completion screen (calculated on the fly, not stored separately), (3) clear the localStorage draft. There is no streak update, no plan/day auto-advancement, and no coach notification tied to Finish — confirmed no such features exist anywhere in `server/src`. This is good news: an autosave design has very little competing "Finish-only" behavior to preserve.

**Existing precedent worth reusing**, found in `client/app/(coach)/[workspaceSlug]/settings/pdf/page.js`: a `useDebouncedValue` hook (700ms) paired with a request-id guard (`previewRequestId` ref, incremented per request, stale responses discarded) — a clean, already-working "debounce input → fire request → ignore out-of-order responses" pattern directly applicable here. A smaller 300ms `setTimeout`/`clearTimeout` debounce also exists in `FoodSwapModal.js`'s search box.

**No existing pattern in this codebase does true server-side autosave with an id-based upsert** — this part is new. There is also no toast system anywhere in the client (`grep` for toast/useToast returns nothing); every failure path, including Finish's own, uses a blocking `window.alert`. No retry-with-backoff exists anywhere in `client/` or `server/src`.

### Proposed solution

Per the task's own instruction to choose the approach from the investigation rather than asking for every parameter, here is the proposed design — flagged clearly for adjustment if you'd prefer differently:

**Save granularity:** debounce (mirroring the 700ms PDF-preview precedent) on every `changeSet`/`toggleSet`/`changeNote` change, not just on `toggleSet` (set-completion). The prompt's premise — protecting against a tab closing mid-entry, before a set is even marked done — requires saving finer-grained than "only on set completion," so a short debounce on every field change is the right level.

**Storage shape change (the one real architectural change required):** `workout_logs.exercises` currently only exists as a completed snapshot written once via `create()`. Add a `status` column and allow an `upsert`:
```prisma
model workout_logs {
  // ...existing fields...
  status String @default("completed")   // "draft" | "completed"
}
```
- A session mints its `id` client-side (or via an initial "start session" call) the moment Training Mode opens, not just at Finish.
- Each debounced autosave does `prisma.workout_logs.upsert({ where: { id }, update: { exercises, ... }, create: { ..., status: "draft" } })`.
- Finish does the same upsert but sets `status: "completed"` and computes the final summary — the "immutable snapshot" invariant from `DECISIONS.md` is preserved for `completed` rows; only `draft` rows are ever mutated in place.
- On session resume (page reopens, same or different device), fetch the most recent `draft` row for that client+plan+day instead of relying solely on localStorage — this closes the cross-device gap flagged in `DECISIONS.md` as a matter of course, without extra design.
- Abandoned drafts (client never returns) simply remain `status: "draft"` rows — harmless, matches the "log everything, no purging" pattern already established for `workout_logs`/diary data in this codebase. No cleanup job needed.

**Failure UX:** background autosave failures should not interrupt the client with a blocking `window.alert` on every failed save (which could recur often on a flaky connection) — that would be a materially worse experience than today's "only alert once, at Finish." Proposed: fail silently and retry on the next debounced change; only surface something if saves have been failing for a sustained period (e.g., a small persistent "not saved — check connection" indicator after N consecutive failures), consistent with keeping the existing alert-based pattern for Finish itself (Finish failing is still a blocking `window.alert`, since that's the one moment data really must not be lost silently).

**Race/idempotency handling:** reuse the PDF-preview's request-id-guard pattern — increment a ref per outgoing save, discard the response if a newer save has since been fired. If a Finish request fires while an autosave is in flight, let Finish supersede it (Finish's payload is the full, current state anyway, so a slightly-stale autosave response arriving after is harmless to discard).

**Mobile parity:** the Flutter app has the identical `SharedPreferences`-only limitation (`mobile/lib/features/training/session_store.dart`). This plan is web-only; flagging that mobile has the same gap as a separate, explicitly deferred follow-up rather than in scope here, unless you'd like it bundled.

### Files likely to change
- `server/prisma/schema.prisma` — add `status` to `workout_logs`.
- `server/src/modules/clientPortal/clientPortal.controller.ts` — new/changed autosave endpoint (`PATCH /workout-logs/:id` upsert, or reuse `POST` with an idempotent id), adjust `createWorkoutLog`/Finish to upsert-with-`completed` instead of always `create()`.
- `server/src/modules/clientPortal/clientPortal.routes.ts` — new route.
- `client/app/(client)/portal/training/session/page.js` — debounced autosave wired into `changeSet`/`toggleSet`/`changeNote`; resume-from-server-draft logic alongside the existing localStorage resume.
- `client/lib/trainingSessionStore.js` — likely keep as a fast local cache/fallback, now secondary to the server draft.

### Edge cases
- Client starts a session, immediately closes the tab with zero sets touched — no draft row needed until the first real change; avoid minting a `workout_logs` row on session open alone if nothing has been entered yet (only create on first autosave-worthy change), to avoid littering the table with empty drafts.
- Client resumes a draft, then the coach changes the assigned plan/day before they finish — mirror the existing logic in `session/page.js:123-130` that already clears a stale local session when the plan/day no longer matches; extend the same check to a server-fetched draft.
- Two devices open the same in-progress session simultaneously — last-write-wins per the request-id-guard/debounce design; not solving true multi-device concurrent editing (out of scope, no existing precedent in this codebase attempts that level of conflict resolution).
- Autosave firing right as the client presses Finish — covered by "Finish supersedes" above.

### Tests to add/update
- `server/tests/integration/workoutLogs.test.ts`: extend with draft-upsert cases — creating a draft, updating it multiple times (idempotent on `id`), finishing a draft transitions `status` to `completed`, tenant/ownership isolation on the new upsert endpoint, and a case confirming a `completed` row is never mutated by a stray late autosave request (should be rejected/ignored once finished).
- New client-side tests for `session/page.js`'s debounce/resume logic — currently zero test coverage exists for Training Mode on the client; this is a good place to start it, per the debounce/request-id behavior which is easy to unit test in isolation.

### Implementation order
1. Schema: add `status` to `workout_logs`, migrate.
2. Backend: add the draft-upsert endpoint; adjust Finish to upsert-to-completed; guard against mutating an already-`completed` row.
3. Backend tests.
4. Frontend: wire debounced autosave (reusing the `useDebouncedValue` + request-id-guard pattern) into the three change handlers.
5. Frontend: server-draft-aware resume logic (fetch latest draft on session open, reconcile with/supersede localStorage).
6. Frontend: minimal "not saved" indicator after sustained autosave failure.
7. Client-side tests.

---

## 6. Plans Queue — Custom Labels

### Investigation findings

A Plans Queue row is a `form_requests` row (`server/prisma/schema.prisma:347-375`), joined with `forms`/`clients`/`users` in `getQueue` (`server/src/modules/forms/forms.controller.ts:926-1031`). It's workspace-scoped via a plain `workspace_id` column (not a composite key — every query manually filters). `status`/`post_action` are free-text strings, not DB enums. New columns on this table have historically been added via raw `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` DDL run as middleware (`ensureFormsQueueSchema()`) rather than a normal migration, for `assigned_to`, `archived_at`, etc.

**No `Label`/`Tag` model exists anywhere in the schema.** The closest precedents are workspace-scoped picklists: `exercise_muscle_groups`, `exercise_equipments`, `food_categories` — all shaped `{ id, workspace_id, name_en, name_ar? }`, unique per workspace on `name_en`, with **no color field**, and consumed by the target table as a **plain string matched by name** (not an FK) — renaming cascades via a raw `UPDATE ... WHERE column = oldName` across the consuming rows. The UI precedent for a per-row inline picker is the existing `assignedTo` column in `PlansQueueTable.js` (lines 655-716): an inline `Select` + optimistic local state (`assignMap`) + `PATCH` call, with an accompanying bulk-assign action in the floating `ActionBar` when rows are multi-selected.

`workspace_members` confirms multiple coaches per workspace, each with a `role` (`manager`/`trainer`/`nutritionist`/`receptionist`/`viewer`) and coarse per-module JSON permissions (`{ module: { read, write, delete } }`) via `requirePermission(module, action)`. No granular permission key like `X.manage` exists anywhere — muscle-groups/equipment CRUD piggybacks on `'training'`, food-categories on `'nutrition'`, Plans Queue actions on `'forms'`.

### Decisions confirmed with the user
- **Decision — scope:** workspace-shared (not per-user).
- **Decision — multiplicity:** one label per queue item.
- **Decision — color:** name + a coach-chosen color, stored on the label.
- **Decision — permission:** restricted to workspace owner/managers only (a new, more granular permission than the existing `forms` write gate that other Plans Queue actions use).

### Proposed solution

**New model** (a real table with a color field, since this is genuinely new — unlike the muscle-group/food-category precedent, so no need to inherit their string-matching fragility; use a proper FK):
```prisma
model plans_queue_labels {
  id           String         @id
  workspace_id String
  name         String
  color        String         // e.g. a hex value or a fixed palette key — recommend a fixed palette key (small enum-like set of allowed swatches) for visual consistency with the rest of the app's chip styling, rather than a freeform hex picker
  created_at   DateTime       @default(now()) @db.Timestamptz(6)
  updated_at   DateTime       @default(now()) @db.Timestamptz(6)
  workspaces   workspaces     @relation(fields: [workspace_id], references: [id], onDelete: Cascade)
  form_requests form_requests[]

  @@unique([workspace_id, name])
  @@index([workspace_id])
}
```
Add `label_id String?` to `form_requests`, FK to `plans_queue_labels.id` with `onDelete: SetNull` (deleting a label un-labels affected items rather than blocking deletion or cascading — simplest behavior, consistent with how `assigned_to` already handles a removed user reference elsewhere in this codebase). Since this table doesn't yet exist and isn't part of the queue-schema-via-middleware pattern, add it as a normal Prisma migration rather than following the raw-DDL `ensureFormsQueueSchema()` convention used for older ad-hoc columns.

**New permission key:** `plansQueueLabels.manage` (or similar) — the first granular key in this codebase's permission model. Since decision was "owner/managers only," gate label CRUD with an explicit role check (`role in ['owner', 'manager']`) rather than the standard `requirePermission(module, action)` JSON-permission path, unless you'd prefer to actually seed this as a real permission key applied only to those roles by default — recommend the latter for consistency with how every other permission in this app works (a real key, not a hardcoded role list), seeded as granted-by-default only to `manager`/owner roles in `defaultPermissions.ts`.

**API** (new endpoints in `server/src/modules/forms/` since labels are queue-specific, or a small dedicated `plansQueueLabels` module — recommend keeping it inside `forms` given labels only exist for this one entity today):
```
GET    /api/forms/queue/labels          # list workspace's labels
POST   /api/forms/queue/labels          # create { name, color } — gated by plansQueueLabels.manage
PATCH  /api/forms/queue/labels/:id      # rename/recolor — same gate
DELETE /api/forms/queue/labels/:id      # delete — same gate; sets label_id = null on affected form_requests
PATCH  /api/forms/queue/label           # { formRequestId, labelId | null } — assign/clear a label on one item; gated by the existing 'forms' write permission (same as assignedTo), since applying an existing label to an item is a normal queue action, not label management
```

**Frontend:**
- New "Label" column in `PlansQueueTable.js`, cloning the `assignedTo` column's shape: inline `Select` populated from `GET /queue/labels`, optimistic local state + `PATCH`, a "none" option to clear. Add the equivalent bulk-assign action in the `ActionBar`.
- A small "Manage Labels" entry point (create/rename/recolor/delete), visible only to owner/manager roles — likely a modal, following the styling of the existing `FoodForm.js`/category-management modals as the closest UI precedent for "manage a small named list."
- Add the same column to `ArchivedSubmissionsTable.js` for consistency (currently has no equivalent column at all).
- Color rendering: reuse the existing `Chip` component already used for `status`/`clientPackage`, applying the label's stored color.

### Database/schema changes
- New model `plans_queue_labels`.
- New column `form_requests.label_id` (nullable FK, `onDelete: SetNull`).
- New permission key `plansQueueLabels.manage`, seeded in `defaultPermissions.ts` granted to `owner`/`manager` roles only.
- Migration: proper named Prisma migration (not raw DDL), since this is a clean new addition, not patching an existing ad-hoc-managed table's columns.

### Edge cases
- Deleting a label currently applied to many queue items — `SetNull` clears it from all of them; no confirmation-count UI is strictly required but a "used on N items" note in the delete confirmation would be a reasonable, low-effort addition.
- Duplicate label names within a workspace — enforced by the `@@unique([workspace_id, name])` constraint; surface a friendly validation error rather than a raw DB constraint error.
- A non-owner/manager coach viewing the queue — they can still select/apply an existing label (per the `forms` write gate) and see label colors; they simply can't create/rename/delete labels. Make sure the "Manage Labels" entry point is hidden (not just blocked server-side) for those roles.
- Archived queue items — decide during implementation whether their label remains visible/editable in `ArchivedSubmissionsTable.js`, or read-only there; recommend read-only, matching how other archived-table fields already behave (no editable columns exist in that table today).

### Tests to add/update
- `server/tests/integration/plansQueueLabels.test.ts` (new): CRUD auth-denied (non-manager blocked from create/rename/delete), tenant isolation (workspace A cannot see/use workspace B's labels), validation (duplicate name → clean 400, not a raw DB error), assign/clear on a `form_requests` row (any `forms`-write user allowed), delete cascades to `SetNull` on affected rows.
- Extend `server/tests/integration/formsQueueArchiving.test.ts` if archived-item label behavior needs coverage.
- Client-side: first test file for `PlansQueueTable.js` — cover the label picker's optimistic-update + revert-on-error path, mirroring how the existing `assignedTo` column behaves (no test exists for that either today — worth doing both together, or at minimum the new label column).

### Implementation order
1. Schema: add `plans_queue_labels` + `form_requests.label_id`, migrate.
2. Seed the new `plansQueueLabels.manage` permission key, granted by default to `owner`/`manager`.
3. Backend: label CRUD endpoints + assign/clear endpoint.
4. Backend tests.
5. Frontend: Label column in `PlansQueueTable.js` (clone `assignedTo` pattern) + bulk-assign action.
6. Frontend: Manage Labels modal (role-gated visibility).
7. Frontend: extend `ArchivedSubmissionsTable.js`.
8. Client-side tests.

---

## Cross-cutting notes

- None of these six items overlap in files except #1/#2 (already merged above) — safe to implement independently/in parallel if desired.
- Recommended implementation order across all six, by risk/dependency: **6 (Labels)** and **1/2 (PDF)** are the most self-contained and lowest-risk — good to start with. **3 (Translation)** is a small, independent fix. **5 (Training autosave)** and **4 (Food Diary)** are the largest schema/API changes and share the "snapshot to avoid orphaning by future edits" design principle — consider sequencing 5 before 4 since Training Mode's `workout_logs` snapshot pattern is the direct template Food Diary's `food_diary_entries` design borrows from, so any refinements learned while building 5 (e.g. around debounce/request-id handling, if you want the diary's autosave to follow the exact same client pattern) will directly inform 4.
- All new endpoints must follow this repo's existing conventions per `CLAUDE.md`: `asyncHandler` wrapping, `ApiError` throwing, tenant scoping on every query, `.js` extensions on relative imports (note: this repo's actual server module uses non-`.js`-suffixed imports per the project memory override — follow whatever convention `server/src/modules/forms/forms.routes.ts` currently uses, not the generic template in `CLAUDE.md`), and `@openapi` JSDoc blocks on new routes.

---

## Approval

This plan is presented for review. Per the task instructions: **no implementation will begin until this plan is explicitly approved.** Flag anything you'd like changed, and call out if any of the "proposed defaults" in sections 1/2, 3, or 5 (where no explicit question was asked) should be adjusted before work starts.
