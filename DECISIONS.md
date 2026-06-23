# Decisions

Significant choices: the question, what we picked, what we rejected, and why.

## 2026-06-22 — Unified date display format

### One shared formatter, fixed `D MMM YYYY` shape
- **Question:** How should user-facing dates render across the client app?
- **Picked:** A single utility [client/utils/date.js](client/utils/date.js) exporting
  `formatDate` → `D MMM YYYY` ("4 Mar 2024") and `formatDateTime` →
  `D MMM YYYY, h:mm A` ("4 Mar 2024, 3:45 PM"). Every screen imports it.
- **Rejected:** Per-screen `toLocaleDateString(...)` calls (the prior state — each
  page picked its own options: `en-US`, `en-GB`, bare locale, 2-digit years, etc.),
  and locale-numeric output like `6/22/2026`.
- **Why:** Numeric dates are ambiguous internationally (`3/4` reads as Mar 4 or Apr 3).
  A fixed day-month-year shape with a spelled-out month is unambiguous and consistent.
- **Presentation only:** never used for API payloads, DB values, or date-picker values —
  those stay raw ISO/`Date`. Sorting, filtering (`dateRange`), and search are untouched.
- **Scope left as-is:** chat timestamp separators (Today / Yesterday / time / weekday) and
  compact chart-axis ticks keep their relative/compact forms — they aren't ambiguous dates.

### Localized via `Intl.formatToParts`, bound to the locale through a hook
- **Question (follow-up):** How do dates localize to the active language (en / ar)
  without scattering locale handling or losing the fixed shape?
- **Picked:** `formatDate`/`formatDateTime` in [client/utils/date.js](client/utils/date.js)
  take a locale and build the string from `Intl.DateTimeFormat(...).formatToParts()`,
  reassembled in our own `D MMM YYYY` order. Month names and AM/PM markers come from
  `Intl` (English "Mar"/"PM", Arabic "مارس"/"م"); we force Western digits with the
  `-u-nu-latn` extension and pick the separator per language (`,` vs Arabic `،`).
  React components consume them through [client/utils/useDateFormatter.js](client/utils/useDateFormatter.js),
  a hook that reads next-intl's `useLocale()` and returns the formatters pre-bound to the
  current locale — so the display switches language automatically.
- **Rejected:**
  - *Hardcoded month/meridiem tables* — `Intl` already has every locale's names; no upkeep.
  - *Relying on `Intl`'s own format string* — locale pattern order ("Mar 4" vs "4 Mar")
    and digit system vary by ICU version; assembling from parts keeps output stable.
  - *A mutable module-level "current locale"* — would race across concurrent SSR requests.
    The hook reads locale per render, which is request-safe.
- **Why parts, not `.format()`:** it gives localized month + meridiem while letting us keep
  the exact ordering, Western digits, and uppercase English meridiem the spec requires.
- Validated in [client/utils/date.test.js](client/utils/date.test.js): `4 Mar 2024`,
  `4 Mar 2024, 3:45 PM`, `4 مارس 2024`, `4 مارس 2024، 3:45 م`.

## 2026-06-17 — Training Mode (workout logging)

### Store logged sets as a JSON snapshot, not normalized tables
- **Question:** Where do per-set logged values (weight/reps/RIR/rest) live?
- **Picked:** The existing `workout_logs.exercises` JSONB column — one object per
  logged exercise, each with a `sets[]` array. No schema change, no migration.
- **Rejected:** New `workout_log_exercises` / `workout_log_sets` tables.
- **Why:** A log is a point-in-time *snapshot* of what was performed; it must not
  change when the coach later edits the plan. JSON keeps the snapshot self-contained
  and the table already existed (dormant) with this exact column. Aggregations
  (volume, est-1RM, progress) run over a bounded per-client set of logs in app code
  ([server/src/utils/workoutLogStats.ts](server/src/utils/workoutLogStats.ts)).

### Progress is keyed by `exercise_library_id` (fallback name)
- **Why:** So a client's progress for "Bench Press" persists across plan changes,
  where the plan-specific `training_exercises.id` would differ. Logging still records
  `exercise_id` too, for the "previous set" lookup within a plan.

### Custom SVG `LineChart` instead of a charting dependency
- **Picked:** A ~150-line dependency-free SVG component
  ([client/app/components/charts/LineChart.js](client/app/components/charts/LineChart.js)).
- **Rejected:** recharts / chart.js.
- **Why:** The client had no chart library; the need is a single themeable line series.
  recharts has known React 19 friction, and the bundled Next is a customized build
  (see [client/AGENTS.md](client/AGENTS.md)) — fewer moving parts is safer. Revisit if
  richer interactions (zoom, multi-series, annotations) are needed.

### Weight unit assumed kg
- **What:** Logged `weight` is a unitless number rendered as "kg".
- **Why:** No per-workspace unit setting exists today (primary market is Egypt).
- **Follow-up:** Add a per-workspace/client kg⇄lb preference; the stored number stays
  unit-agnostic so only display/entry conversion is needed later.

### In-progress session persisted to localStorage, saved only on Finish
- **Why:** Avoids a server-side draft model and extra endpoints for v1. A refresh
  resumes the session (keyed by `day_id`); Finish does the single POST. Trade-off:
  no cross-device resume — noted as a follow-up.

---

## Default Libraries & zero-friction onboarding (2026-06-22)

### Separate `master_*` tables for the global library (not a flag on tenant tables)
- **Picked:** Five dedicated tables — `master_exercise_library`, `master_exercise_equipments`,
  `master_exercise_muscle_groups`, `master_food_items`, `master_food_categories`
  (migration [022_default_libraries.js](server/migrations/022_default_libraries.js)).
- **Rejected:** (a) treating `workspace_id IS NULL` rows in the existing tables as the
  master set; (b) an `is_master` boolean on the tenant tables.
- **Why:** Master and tenant data never mix, so the Super Admin CRUD and the clone source
  can never accidentally leak across the tenant boundary, and tenant queries keep their
  `NOT NULL workspace_id` invariant. Cost: parallel models kept in sync by the clone engine.

### Libraries cloned in the background after signup commits (not inside the transaction)
- **Picked:** Signup commits user+workspace fast with `clone_status: 'pending'`; the response
  returns immediately and `cloneDefaultLibraries(workspaceId)` runs fire-and-forget
  ([server/src/lib/libraryClone.ts](server/src/lib/libraryClone.ts)). The onboarding screen
  polls `GET /auth/clone-status` until `ready`.
- **Rejected:** Cloning ~2,000 rows inside the signup transaction (slow signup, large tx).
- **Why:** Keeps signup latency flat regardless of catalogue size. `clone_status`
  (`pending|cloning|ready|failed`) makes the work observable and the clone idempotent
  (it short-circuits unless the workspace is fresh/failed), preventing duplicate cloning.
- **Follow-up:** In-process per CLAUDE.md §11 — single-instance only. Move to a real queue
  before horizontal scaling, and add a retry/sweep for `failed` workspaces.

### Builders create library records in context on empty search
- **What:** The exercise and food pickers show a "Create …" CTA when a search has no match;
  it creates the record (prefilled with the query) and adds it straight to the plan.
- **Why:** Removes the "go set up your library first" detour — fastest time-to-value.
