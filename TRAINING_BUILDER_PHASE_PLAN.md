# Training Builder + Exercise Library + Client Portal Plan

## Scope Summary
This plan covers only planning, grouped into phases, for the following requested outcomes:
1. Exercise Library page in databases route and Training Builder integration via Add Exercise flow.
2. Client portal active training endpoint and dashboard card.
3. Training Builder left panel Form Submissions section (collapsible) parity with nutrition.
4. Training Builder UX parity upgrades (notes relocation/collapsible, button styling, CRUD actions, rename/focus flow, drag and drop, alternatives, close panel buttons).

## Phase 0 - Baseline Audit and Contract Lock
### Goal
Freeze current behavior and define target contracts before implementation.

### Steps
1. Map existing nutrition builder patterns to mirror in training:
   - Triple-panel structure and divider behavior.
   - Save selected vs Save All semantics.
   - Activate + queue review flow with submissionId.
   - Naming/autofocus behavior and close panel controls.
2. Lock API contracts for training entities to avoid frontend/backend drift.
3. Validate current training schema (already expanded with library, alternatives, sets) and list any missing indexes/constraints.
4. Define upload/static serving policy for exercise media.

### Deliverables
- Final request/response shapes for training plan and exercise library APIs.
- Agreement on where uploaded media URLs are served from.

### Acceptance Criteria
- No ambiguous payload fields remain.
- Frontend and backend naming conventions match (snake_case on API, mapped client-side as needed).

---

## Phase 1 - Exercise Library Module (Databases Route) + Training Add Exercise Wiring
### Goal
Ship a complete exercise library management flow and connect it to Training Builder Add Exercise, mirroring food items in nutrition.

### Backend Work
1. Verify and complete taxonomy routes:
   - GET/POST/PUT/DELETE for muscle groups.
   - GET/POST/PUT/DELETE for equipments.
2. Verify and complete exercise library routes:
   - GET list.
   - POST create with upload handling.
   - PUT update with replacement media support.
   - DELETE remove.
3. Validation rules:
   - Exercise name required.
   - At least one media source: video file or youtube url.
   - Video max 5 MB.
   - Thumbnail accepts standard images and gif.
4. Static file exposure:
   - Serve uploaded videos and thumbnails from server static route.
   - Ensure URLs returned are directly usable by client.
5. Data integrity:
   - Keep denormalized text fields for muscle_group/equipment aligned when taxonomy names are edited.

### Frontend Work (Databases)
1. Build Exercise Library page under coach databases route:
   - Filters/search.
   - Create/edit modal or split view form.
   - Media upload controls and preview.
2. create nav bar containing (exercises, muscle groups and equipments) similar to food items and food category  management.
3. Add error/loading/empty states matching current design system.

### Frontend Work (Training Builder)
1. Replace current Add Exercise action with library picker modal.
2. Modal capabilities:
   - Search by name.
   - Filter by muscle group/equipment.
   - Show thumbnail and key metadata.
3. On selection:
   - Insert exercise row into selected day.
   - Persist exercise_library_id and display name/equipment.

### Deliverables
- Exercise Library management UI and routes fully wired.
- Training Add Exercise now uses Exercise Library picker.

### Acceptance Criteria
- Coach can CRUD library items and taxonomy values.
- Uploaded media respects limits and is accessible by URL.
- Add Exercise from builder creates exercises linked to library entries.

---

## Phase 2 - Client Portal Active Training Plan Endpoint + UI Card
### Goal
Expose active training plan to clients exactly like active nutrition.

### Backend Work
1. Add client-portal endpoint for active training plan:
   - Returns active plan with nested days, exercises, sets, and alternatives summary if needed.
   - 404 when none exists.
2. Keep timestamp serialization and ordering consistent (updated_at descending for active pick fallback).
3. Apply client auth middleware and ownership checks.

### Frontend Work (Client Portal Dashboard)
1. Add Training card/section parallel to Nutrition card:
   - Plan name.
   - Day tabs/list.
   - Exercises and sets for selected day.
2. Add loading, empty, and error states that mirror current dashboard style.
3. Preserve responsive behavior for mobile and desktop.

### Deliverables
- Active training endpoint in client portal.
- Dashboard training card fully visible for clients.

### Acceptance Criteria
- Activating a training plan in coach view makes it visible in client portal immediately after refresh.
- If no active training plan exists, client sees clear empty state (not crash/error page).

---

## Phase 3 - Training Left Panel Form Submissions Section
### Goal
Add collapsible Form Submissions section in training left panel with nutrition parity.

### Steps
1. Fetch client form requests in training left panel.
2. Apply same visibility rules as nutrition:
   - Show submitted/reviewed-like actionable history.
   - Exclude pending/scheduled from submissions list view where appropriate.
3. Build collapsible section with count badge.
4. Expand row to show responses.
5. Preserve panel scroll behavior and section divider rhythm.

### Deliverables
- Collapsible Form Submissions section in training left panel.

### Acceptance Criteria
- Section behavior and styling matches nutrition counterpart.
- No layout regression with long plan lists or large response bodies.

---

## Phase 4 - Training Builder UX Parity Enhancements
### Goal
Bring training UX to nutrition-level parity for editing flow, notes placement, actions, and interaction model.

### A) Notes relocation + collapsible behavior
1. Move Day Notes to right panel (with selected day context).
2. Move Plan Notes to bottom area in middle panel.
3. Make both notes sections collapsible with persisted expanded state during session.

### B) Button style and action parity
1. Update Add Day and Add Set buttons to match Create button style.
2. Add hover action controls with nutrition-like affordances:
   - Delete Plan.
   - Duplicate Plan.
   - Delete Day.
   - Duplicate Day.
   - Delete Exercise.

### C) Naming flow + focus parity
1. On create new plan, auto-focus plan name in middle panel rename field.
2. On create day, auto-focus day name field in right panel.
3. Match nutrition rename input styling and inline-edit behavior.

### D) Structural interaction parity
1. Add drag and drop reordering for days and exercises.
2. Persist order to state and backend payload order fields.
3. Add exercise alternatives flow like food item alternatives:
   - Open alternatives picker from exercise card.
   - Store alternative links with ordering.
4. Add close buttons for middle and right panels.

### Deliverables
- Training Builder UI/UX parity with nutrition for requested behaviors.

### Acceptance Criteria
- All listed actions are available and styled consistently.
- Focus behavior works reliably after create actions.
- Reordering is reflected after save/reload.
- Alternatives can be added/removed and persist correctly.

---

## Phase 5 - Integration, QA, and Hardening
### Goal
Stabilize full vertical slice and prevent regressions.

### Test Matrix
1. Queue integration:
   - Open Workout from queue does not mark done prematurely.
   - Activate in training with submissionId marks reviewed only after confirmation.
   - Stay vs Go Queue actions work.
2. Save flows:
   - Save selected and Save All keep DB and UI aligned.
   - Timestamps show correct relative values.
3. Client portal:
   - Active training appears correctly.
   - No active plan state handled.
4. Exercise library:
   - Taxonomy CRUD works.
   - Upload limits enforced.
   - Media URLs load in UI.
5. UX parity:
   - Collapsible sections, notes relocation, drag/drop, alternatives, close panel controls.

### Hardening Tasks
1. Add indexes for common lookups (coach_id/client_id/plan_id/day_id).
2. Add route-level validation and friendly error payloads.
3. Add cleanup strategy for orphaned uploads when replacing/deleting media.

### Deliverables
- Stable, tested vertical slice ready for release.

### Acceptance Criteria
- End-to-end workflow passes from queue to builder to activation to client portal visibility.
- No critical UI regressions compared to nutrition builder.

---

## Implementation Order Recommendation
1. Phase 1 backend first (library + static media + taxonomy).
2. Phase 1 frontend databases page.
3. Phase 1 training add-exercise wiring.
4. Phase 2 client portal active training.
5. Phase 3 form submissions in left panel.
6. Phase 4 parity upgrades (notes, actions, focus, DnD, alternatives, panel close).
7. Phase 5 QA and hardening.

## Risk Notes
1. Drag/drop with nested editing can cause selection/focus glitches; isolate reorder state updates and avoid re-mounting edited rows.
2. Media uploads need strict validation and safe path handling to avoid inconsistent URLs.
3. Alternatives UX can become noisy; enforce same category/equipment rules only if product requires, otherwise keep permissive with clear labels.
