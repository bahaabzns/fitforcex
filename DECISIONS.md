# Decisions

Significant choices: the question, what we picked, what we rejected, and why.

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
