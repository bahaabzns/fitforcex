# FitForce X — Mobile (Flutter) ↔ Web Client Portal Parity Audit

> **Scope:** `mobile/lib/` (Flutter client app) vs. `client/app/(client)/portal/` (Next.js web client portal), both consuming `server/src/modules/clientPortal/*`. Coach/admin web app is out of scope except where it defines business logic (package lifecycle, forms versioning) that the client-facing surfaces depend on.
>
> **Method:** full-codebase read of both clients plus the shared backend module (`clientPortal.controller.ts`, `clientPortal.routes.ts`, `clientPortalNotifications.controller.ts`, `clientAccessPolicy.ts`, `planEngine.ts`, `scheduler.ts`, `forms.service.ts`), including uncommitted web changes on `feature/forms-versioning` (new exercise-insights modal, exercise-notes modal, dedicated video player). No code was changed to produce this report.
>
> **Baseline date:** 2026-07-08. Web reference commit: uncommitted work on top of `b96736a`. Flutter reference: `mobile/pubspec.yaml` v0.1.0+1.

---

## Executive Summary

```
Home / Progress (Transformation) ....  15%
Nutrition ............................ 95%
Training — Plan View ................. 95%
Training — Session (Training Mode) ... 60%
Training — History ................... 100%
Training — Progress (exercise charts)  90%
Forms ................................ 65%
Messenger ............................ 55%
Notifications ......................... 5%
Profile .............................. 100%
Package Lifecycle (client-visible) ... N/A — neither client shows it (see §11)
Observations (client-facing) ......... N/A — not a web feature either (see §12)

Overall parity (weighted by user-facing value): ~64%
```

**The three findings that matter most:**

1. **Notifications and body-transformation/Progress are essentially 0% built on mobile**, despite both having a complete, working backend (`/client-portal/notifications/*`, `/client-portal/transformation`) and a complete web UI. These are the two highest-value, lowest-backend-risk gaps to close.
2. **Forms is silently missing two question types** (`date`, `metric` — including the photo-upload variant that feeds the transformation/progress charts). A client cannot fully complete certain check-in forms on mobile today; this is a correctness bug, not just a missing feature.
3. **Training Mode has drifted apart on business logic, not just UI.** The web very recently (uncommitted) locked set structure to the coach's plan and made RIR a read-only target. Mobile still allows the client to add/remove sets and freely edit RIR — mobile is now *more* permissive than the product currently intends.

Also load-bearing: **`Home` means two different things on each platform.** Web's `/portal/home` is exclusively the body-transformation/progress-photo screen. Flutter's Home is a 4-tile dashboard hub (plan names, pending-forms count) with zero transformation content. Neither is a subset of the other — treat this as "build the missing half," not "catch mobile up."

---

## 1. Home / Progress (Transformation)

### Current Web Status
`client/app/(client)/portal/home/page.js` renders **only** a `ProgressSection` — there is no next-workout widget, no pending-forms widget, no unread-messages widget, no quick actions. It is a body-transformation tracker:
- `GET /api/client-portal/transformation` → `{ metrics: [...], timeline: [...] }`, built by the same `buildTransformationPayload()` the coach dashboard uses.
- Numeric metrics (weight, measurements, etc., extracted from **form answers tagged with a `metric_id`**) render as `AreaChart`s with a date-range picker (30d/90d/6m/All presets + custom range).
- Image metrics (progress photos) render as a horizontal `PhotoGallery` with a full-screen lightbox and a draggable before/after **comparison slider**.
- A collapsible submission timeline lists every check-in that contributed data.
- States: loading skeleton, error (silently falls back to empty rather than a distinct error view), and an explicit empty state ("submit a check-in with body measurements").

### Current Flutter Status
`mobile/lib/features/home/home_page.dart` is a 4-card link hub: Nutrition (active plan name), Training (active plan name), Forms (pending count badge), Messages (static). Pull-to-refresh invalidates the underlying providers. **No transformation/measurement/photo content exists anywhere in the Flutter app** — `GET /transformation` and `POST /uploads/photo` are not called from any of the 18 endpoints the mobile app uses.

### Missing Features
- Entire transformation feature: metric charts, photo gallery, comparison slider, submission timeline, date-range picker.
- No photo upload capability at all (also blocks the Forms gap in §7).

### Backend Changes Required
None — `GET /client-portal/transformation` and `POST /client-portal/uploads/photo` already exist and are workspace/client-scoped correctly.

### API Changes Required
None.

### UI Changes Required
Build a Progress/Transformation screen (new `mobile/lib/features/progress/`): area/line chart per numeric metric (fl_chart or a `CustomPainter` port matching the existing training line chart), a photo strip + full-screen viewer + before/after slider, a submission timeline list, and a date-range filter. Decide where it lives in the mobile IA — either fold into the existing Home tab (matching web's information architecture) or keep Home as the dashboard hub and add Progress as a new destination reachable from a Home tile (a pragmatic option that preserves the dashboard-hub value Flutter already built, at the cost of diverging slightly from web's IA — flag this choice explicitly with the user before building).

### Business Logic Changes Required
None — this is a pure read/render feature; all aggregation is server-side.

### Estimated Complexity
**High** — new feature end-to-end (photo capture/upload, image compare UI, multi-metric charting), not a port of an existing simple screen.

---

## 2. Nutrition

### Current Web Status
`client/app/(client)/portal/nutrition/page.js`: single fetch of `GET /active-plan` (full nested hierarchy: cycles → meals → items → alternatives), cycle tabs, macros donut (hidden when zero), collapsible cycle-level coach note, expandable meal cards with a local-only (non-persisted) shopping checklist, per-item macros via `calcItem`/`calcMeal`/`calcCycle` (`client/lib/nutritionCalc.js`), food alternatives (name + amount only, no macros shown for alts), and a floating **shopping list** bottom sheet that aggregates items across the plan scaled by a per-cycle "days" stepper (0–14). Route has dedicated `loading.js`/`error.js` boundaries.

### Current Flutter Status
`mobile/lib/features/nutrition/`: same single-fetch pattern, same macros donut (custom-painted), same cycle tabs, same collapsible note, same expandable meal cards with local checkable items, same alternatives list, same shopping-list bottom sheet with per-cycle day stepper. RTL numbers/units explicitly forced LTR, matching web's convention.

### Missing Features
None found. This module is at effective parity.

### Backend Changes Required
None.

### API Changes Required
None.

### UI Changes Required
None required for parity. (Optional: neither client shows plan lifecycle info — see §11 for a shared, backend-already-supports-it opportunity.)

### Business Logic Changes Required
None.

### Estimated Complexity
**N/A** (already at parity).

---

## 3. Training — Plan View

### Current Web Status
`client/app/(client)/portal/training/page.js`: `GET /active-training-plan`, day tabs, action row (Start Training / History / Progress) shown only when the active day has exercises, plan-level note (amber) + day-level note (primary), exercise cards with thumbnail, video toggle (inline YouTube iframe or native `<video>` via `client/utils/video.js`), muscle-group/equipment chips, sets grid (Reps/Rest/Tempo/RIR), and an alternatives list (thumbnail + name + tags, no sets/video). No route-level `loading.js`/`error.js` (handled inline, unlike Nutrition — a web-side inconsistency, not a mobile gap).

### Current Flutter Status
`mobile/lib/features/training/training_page.dart`: same single-fetch pattern, same day tabs, same action row, same two-level notes, same exercise cards (thumbnail with `errorBuilder` fallback, inline video toggle, chips, sets grid, alternatives with thumbnails).

### Missing Features
One UX-level difference: web's video toggle plays YouTube **inline** (iframe); Flutter's `ExerciseVideo` widget opens YouTube **externally** via `url_launcher` (a deliberate choice — the build doc's comment cites an AGP/Gradle incompatibility with in-app webview players). Native uploaded videos (`video_path`) still play in-app via `video_player` on both platforms. This is a known, documented trade-off, not an oversight.

### Backend Changes Required
None.

### API Changes Required
None.

### UI Changes Required
Optional: revisit an in-app YouTube player if the Gradle/AGP blocker is later resolved, for full inline-playback parity.

### Business Logic Changes Required
None.

### Estimated Complexity
**Low** (only the optional YouTube-inline item, itself Medium if pursued).

---

## 4. Training — Session ("Training Mode" live logging)

This is the most recently and heavily changed area of the web app (largely uncommitted at audit time) and where mobile has fallen furthest behind — both in features and in business rules.

### Current Web Status (as of the uncommitted diff)
- **Fixed set structure.** Add/remove-set controls were **removed entirely**; the client logs exactly the sets the coach prescribed. (`ExerciseLogCard.js` doc comment: *"the client logs the assigned workout only — set structure is fixed by the coach's plan"*.)
- **RIR is now read-only**, shown as the coach's per-set target, not something the client edits. The client only edits **weight and reps** per set.
- **Every set row now shows its own per-set target** (Reps / RIR / Rest), not just a single header-level guidance line as before.
- **New: `ExerciseVideoPlayer`** — full-width lazy video block at the top of every card (thumbnail + play button; iframe/video only mounts on click), replacing a tiny 36×36 header thumbnail.
- **New: `ExerciseNotesModal`** — per-exercise notes moved from an always-visible single-line input into a modal (`NotebookPen` icon, highlighted when a note exists) backed by a multi-line `TextArea`.
- **New: `ClientExerciseInsightsModal`** — opened from a `LineChart` icon in the card header. Calls the brand-new **`GET /client-portal/workout-logs/exercise-insights`** endpoint and shows: a metric-toggle chart (Top Weight / Est. 1RM / Volume), **personal-record chips** (heaviest weight, best set incl. RIR, highest volume, est. 1RM), and a **recent-sessions list** (last 10, with best set + note). It deliberately does **not** show the coach-only "insights" block (strength-trend %, plateau flag, consistency %) that the same endpoint also returns and that the *coach's* parallel modal does render — worth knowing if mobile ever mirrors this endpoint, since the payload contains more than the client UI uses.
- Native `window.confirm()` dialogs for discard/finish-with-zero-sets were replaced with in-app HeroUI modals.
- Unchanged: rest-timer-on-set-complete logic (measures actual elapsed rest, feeds it back as `rest_seconds`), localStorage session-resume, finish→POST payload shape.

### Current Flutter Status
`mobile/lib/features/training/session_page.dart` + `session_store.dart` + `widgets/exercise_log_card.dart` + `widgets/rest_timer_bar.dart`:
- **Still allows add/remove set** and **still allows freely editing RIR** per set — the old, now-superseded web behavior.
- Per-set "previous" hint column exists (parity with web's "previous" hints), but there is **no per-set target Reps/RIR/Rest display** matching the new web row layout.
- **No exercise video during logging** — `ExerciseVideo` exists only on the plan-view screen (`training_page.dart`), not in `exercise_log_card.dart`/`session_page.dart`.
- Notes: a plain always-visible free-text field (the *old* web pattern), not a modal — functionally present, but UX-inconsistent with where web has moved, and the note is not surfaced anywhere in a "recent sessions" or coach-facing view on mobile (there is no such view yet — see below).
- **No exercise insights / personal records anywhere.** Grepped the whole training feature for "insight"/"personal record"/"PR" — zero matches.
- `+15s` / Skip on the rest timer matches web (web never had a `+30s` button either — the original build-plan doc overstated this; not an actual gap).
- Finish/discard confirmations use Flutter `AlertDialog`s already (parity, just a different toolkit).
- No offline retry-queue for a failed finish `POST` (build doc's own §7 goal, never implemented — failure surfaces via a snackbar and keeps the in-memory session, which is a reasonable fallback but not what was originally scoped).

### Missing Features
- Exercise insights modal (PRs + recent sessions + metric chart) — entirely absent.
- Exercise video during live logging — entirely absent (only exists pre-session, on the plan view).
- Per-set target display (Reps/RIR/Rest) matching the new 7-column web layout.
- Notes-as-modal UX (minor — current inline field is functionally equivalent, just inconsistent).

### Backend Changes Required
None — `GET /client-portal/workout-logs/exercise-insights` already exists, already scoped to `view_progress_history`, and returns exactly the data the new web modal needs.

### API Changes Required
None. Mobile needs a new repository method for the one new endpoint; everything else is already consumed.

### UI Changes Required
- Build a `ClientExerciseInsightsModal` equivalent: metric toggle + PR chips + recent-sessions list, using the existing `LineChart` `CustomPainter`.
- Add per-set target columns (Reps/RIR/Rest) to `exercise_log_card.dart`, sourced the same way as the existing "previous" hints.
- Add the `ExerciseVideo` widget to the logging card.
- Optional: move the note field behind an icon+modal to match the new web pattern (low priority, cosmetic).

### Business Logic Changes Required — **highest priority item in this entire audit**
- **Remove add/remove-set from the mobile session screen.** This is not just a UI gap — a client on mobile can currently create a workout log with a different set count than the coach prescribed, which the web intentionally prevents now. Confirm with product whether this was a deliberate mobile-specific choice or drift; treat as drift unless told otherwise.
- **Make RIR read-only** (target display only), matching web. Stop sending client-entered RIR as if it were a coach target.

### Estimated Complexity
**High** — one new endpoint integration + new modal UI, one new widget placement, and two business-rule removals that touch the session state model (`session_store.dart`) and the log payload shape.

---

## 5. Training — History

### Current Web Status
List (`GET /workout-logs`): day name, date, duration, volume, set count, empty state. Detail (`GET /workout-logs/:id`): summary trio + per-exercise table (Set/Weight/Reps/RIR), incomplete sets dimmed, exercise note in italic. Read-only, does not use the new insights/video/notes modals.

### Current Flutter Status
`history_page.dart` / `history_detail_page.dart`: same list fields, same detail table, same per-exercise note rendering. Gated by `canViewProgress` (matches web's use of the same permission for this data class).

### Missing Features
None found.

### Backend / API / UI / Business Logic Changes Required
None.

### Estimated Complexity
**N/A** (already at parity).

---

## 6. Training — Progress (exercise charts)

### Current Web Status
`client/app/(client)/portal/training/progress/page.js`: exercise picker pills (from `GET /workout-logs/exercises`), 3-way metric toggle (Weight/Est.1RM/Volume), chart from `GET /workout-logs/exercise-progress` (the **older**, PR/insights-free endpoint — this standalone page was **not** upgraded to the new `/exercise-insights` endpoint; that richer data currently only lives inside the new in-session modal from §4). Empty states for no-exercises / no-logs-for-exercise.

### Current Flutter Status
`progress_page.dart` + `widgets/line_chart.dart`: identical picker, identical 3-way toggle, identical endpoint (`/exercise-progress`), identical empty states, via a hand-rolled `CustomPainter` line chart mirroring web's dependency-free SVG chart.

### Missing Features
None — this screen is at parity with web's *current* (also not-yet-upgraded) implementation. Note for the roadmap: if/when web upgrades this standalone page to the richer `/exercise-insights` data, mobile should follow in the same pass as §4, since it's the same underlying data and UI pattern.

### Backend / API / UI / Business Logic Changes Required
None for parity today.

### Estimated Complexity
**N/A** (already at parity).

---

## 7. Forms (incl. Forms Versioning)

### Current Web Status
List (`client/app/(client)/portal/forms/page.js`): Pending/Submitted filter pills (Submitted bucket includes `submitted` + `reviewed`), pending-count chip, scheduled requests shown as "not open yet" with no fill CTA until `scheduled_at` passes.

Fill/detail (`[requestId]/page.js`) renders **eight** question shapes, not six: `text`, `long_text`/`textarea`, `number`, `date`, `scale` (slider), `select`, `multiselect`, and **`metric`** — where a metric-typed question further branches on `metric_type`: `number` (numeric input + unit suffix) or **`image`** (photo capture/upload via `MetricPhotoInput` → `POST /client-portal/uploads/photo`). Submitted/reviewed requests render fully read-only with prefilled answers.

**Versioning**, confirmed from the backend: every `form_requests` row pins a `form_version_id` at assignment time (`sealVersionForAssignment`); `GET /form-requests/:id` always serves the **pinned** version's questions, never the form's live/current draft — this is what guarantees an old submission still shows exactly what was asked at the time. The web UI has **no visible version indicator** — correctness is structural (the server always serves the right snapshot), not something the UI needs to render. `form_version_id` is present on the **detail** response but **absent from the list** response.

### Current Flutter Status
`form_fill_page.dart` renders exactly **six** question types: `text`, `textarea`, `number`, `scale`, `select`, `multiselect`. **`date` and `metric` (both number- and image-flavored) are not handled** — grepped `shared/models/form*.dart` and the whole forms feature for "version": zero matches, but per the backend analysis, mobile doesn't need any version-specific code — it already gets the pinned snapshot for free from the existing endpoint.

List behavior (Pending/Submitted split, submitted-bucket inclusion of `reviewed`, pending-count badge, required-field validation, read-only submitted rendering, `canSubmitCheckins` access-gating with a disabled-but-viewable submit button) all matches web.

### Missing Features
- **`date` question type** — falls through to an unhandled/default case today.
- **`metric` question type, both flavors** — most critically the **image/photo flavor**, since mobile has no photo-upload capability anywhere (see §1). A client filling a body-measurement check-in with a photo requirement on mobile today either sees a broken field or cannot complete the form — needs to be verified against the actual fallback behavior in `_QuestionField._input`'s `default` branch and fixed regardless.
- This is the **only correctness bug** (not just a missing feature) found in this audit: existing check-in forms that use `metric`/`date` questions may already be unfillable on mobile.

### Backend Changes Required
None — the detail endpoint already returns `metric_type`/`metric_unit`/`metric_name`/`metric_icon` flattened onto each question, and `/uploads/photo` already exists.

### API Changes Required
None. Mobile needs to call `POST /client-portal/uploads/photo` (net-new for the app) and needs the `form.dart` model to carry the `metric_type`/`metric_unit`/`metric_name`/`metric_icon` fields it's presumably currently dropping or never requested.

### UI Changes Required
- Add a `date` field renderer (native date picker).
- Add a `metric`-number renderer (numeric input + unit suffix, essentially a styled variant of the existing `number` case).
- Add a `metric`-image renderer: camera/gallery picker → upload → thumbnail preview, reusing whatever image-handling groundwork the Progress screen build (§1) produces.

### Business Logic Changes Required
None — validation/required-field rules are unchanged; this is purely a rendering gap.

### Estimated Complexity
**Medium** (date picker + numeric variant are Low; photo upload/preview is Medium and should be built once, shared with §1's Progress screen).

---

## 8. Messenger

### Current Web Status
Polling-only on the client-portal side (5s interval; **no socket.io client** on this page despite the backend emitting realtime events — those exist for the coach UI and the notification bell ping). Full feature set: text send, **image/voice/file attachments** (`POST /messages/attachments`, MIME-sniffed into image/voice/file), **voice note recording** via `MediaRecorder`/`getUserMedia` with an in-composer recording UI, **edit** (`PATCH /messages/:messageId`, text-only), **delete** (`DELETE /messages/:messageId`, soft-delete/tombstone that also purges the stored file), single-image lightbox (no multi-image carousel), an emoji picker (curated 90-emoji grid, not a system/external picker), 5-minute message clustering + date separators, Enter-to-send. No visual read receipts (tracked server-side, used only to drive the unread badge).

### Current Flutter Status
`messages_page.dart` + `messages_repository.dart` + `message_segments.dart`: text-only send/receive. `Message` model has only `id, senderType, body, createdAt` — no attachment fields at all. **No attachments, no voice notes, no edit, no delete, no emoji picker.** Grouping/date-separator logic matches web's clustering pattern. **Realtime is actually better than web here**: mobile connects `socket_io_client` with token auth and falls back to 5s polling only on disconnect — the web client portal never adopted the socket it could use.

### Missing Features
Image/voice/file attachments, voice recording, message edit, message delete, emoji picker, image lightbox. No unread-count badge anywhere in mobile (Home's Messages tile has a static subtitle; the shell's bell icon has no badge — though that's the *notifications* bell, not a messages-specific badge, which web also doesn't have separately).

### Backend Changes Required
None — `POST /messages/attachments`, `PATCH /messages/:messageId`, `DELETE /messages/:messageId` all already exist and are exercised by web today.

### API Changes Required
None. Mobile's `Message` model needs `type`, `attachment_url/name/size/mime/duration`, `edited_at`, `deleted_at` fields added and mapped from the existing response shape (`serializeMessage()` on the backend already returns them).

### UI Changes Required
- Attachment picker (image/voice/file) + upload flow, mirroring web's MIME-based kind detection.
- In-app voice recorder (Flutter has mature packages for this; web uses raw `MediaRecorder`).
- Edit-in-place UI (banner + composer prefill) and delete-with-confirm.
- Single-image lightbox (reuse whatever full-screen image viewer §1/§7 build).
- Optional: emoji picker (lowest priority of this list — cosmetic).

### Business Logic Changes Required
None — all rules (edit text-only, delete tombstones + purges file, 5000-char cap) are server-enforced already.

### Estimated Complexity
**High** — attachments + voice recording + edit/delete together are a substantial feature set, though each piece is independently well-scoped and the backend needs zero changes.

---

## 9. Notifications

### Current Web Status
Fully built, not a placeholder: `GET /notifications?limit=30`, `PATCH /notifications/read-all`, `PATCH /notifications/{id}/read`, plus a nav-bar bell that polls `GET /notifications/unread-count` every 15s. Filter chips (All/Unread/Messages/Coaching/Billing), priority-accent left border (alert/actionable/info), read/unread visual state, grouping of repeated same-thread/same-day events into expandable disclosures, day separators, and type-specific icon/CTA/deep-link mapping for: `message.received`, `plan.assigned`, `checkin.reviewed`, and the three `subscription.*` types. **Known web-side gap, not mobile's fault:** `checkin.requested`, `plan.duration_restarted`, `checkin.dispatch_skipped_archived_form`, and `plan.review_due` are not in the web's category/icon/destination maps either — they render generically with no deep link. Mobile should not copy this gap; see §11.

### Current Flutter Status
`notifications_page.dart` is a static 28-line placeholder: an `EmptyState` with "coming soon" copy. **Zero API calls, zero state.** No push registration exists anywhere (`firebase_messaging` is commented out in `pubspec.yaml` as a future roadmap line only), no badge on the shell's bell icon, no unread-count anywhere in the app.

### Missing Features
The entire feature: list, filters, grouping, priority styling, read/unread state, mark-read/mark-all-read, unread badge, deep links, push notifications.

### Backend Changes Required
None for the in-app list (fully built and correctly scoped by `recipient_type: 'client'`). Push specifically needs the still-unbuilt `POST/DELETE /client-portal/push-tokens` endpoint (tracked as a known gap in the original mobile build plan, `docs/_FlutterClientApp.md` §12 item 3) plus a Firebase project — this is the one place in the whole audit where backend work is actually required.

### API Changes Required
None for the REST list/read endpoints — mobile just needs to consume what already exists. Push requires the new endpoint above.

### UI Changes Required
Port the web notifications page essentially 1:1: list with filter chips, grouping, priority accent, mark-read interactions, bell badge (poll `unread-count` the same way the web nav does, or push-driven once available), and deep-link routing into the right tab/screen per notification type — this time covering **all** event types the client can receive (including the ones web currently mis-handles), using go_router's existing route table.

### Business Logic Changes Required
None beyond deciding the deep-link mapping for the four event types web doesn't handle either (recommend: `checkin.requested` → Forms tab; `plan.duration_restarted` → Nutrition or Training tab per `entity_type`, matching `plan.assigned`'s existing pattern; the other two are coach-facing and shouldn't appear for a client anyway per `recipientScope`).

### Estimated Complexity
**Medium** for the in-app list/badge (pure port of an existing, well-specified web feature, zero backend risk). **High** for push end-to-end (new backend endpoint, Firebase project setup, platform-specific registration/permission flows) — treat as a separate, later phase.

---

## 10. Profile

### Current Web Status
Identity (avatar initials, name, email, `#client_code`), Appearance (theme toggle), Language (EN/AR switcher), Logout with confirm modal. No password change, no avatar upload, no editable fields, no subscription info shown here.

### Current Flutter Status
Identical: identity block, theme mode segmented control (system/light/dark), language dropdown (persisted, drives RTL), logout confirm dialog.

### Missing Features
None.

### Backend / API / UI / Business Logic Changes Required
None.

### Estimated Complexity
**N/A** (already at parity).

---

## 11. Package Lifecycle — client-visible surface

This is a **cross-cutting architecture**, not a screen, so it's reported once rather than per-module.

### What exists (backend, confirmed)
- `nutrition_plans`/`training_plans` carry `activated_at`, `cycle_days`, `cycle_end_at`, `review_offset_days`, `review_notified_at`.
- `planEngine.ts` (`activateSinglePlan`, `reconcileCheckInSchedules`) governs activation/restart/extend: `extend` preserves `activated_at`/`cycle_end_at`; `restart` stamps a fresh cycle and resets `review_notified_at`; restart never duplicates or erases already-delivered check-in history, only retargets not-yet-delivered ones.
- Check-in forms are **one-shot**, created as a `scheduled` `form_requests` row **at activation time** (not deferred to a dispatch cron) and fired exactly once at `cycle_end_at` by the hourly scheduler tick, which flips status to `pending` and notifies the client (`checkin.requested`).
- `client/lib/formCompatibility.js`'s `isCompatibleCheckInForm()` — a check-in form is only valid for a plan type if its `post_action` matches (`workout-plan` for training, `nutrition-plan` for nutrition); `package_default_forms.kind` is now split into `assessment | checkin-nutrition | checkin-training`.

### The key finding: **the client-facing API already returns this data; neither client renders it**
`GET /active-plan` and `GET /active-training-plan` do an **unfiltered** Prisma `findFirst` and spread the full row (`{ ...plan, cycles }` / `{ ...plan, days }`) — so `activated_at`, `cycle_days`, `cycle_end_at`, `review_offset_days`, `review_notified_at` are **already present in the JSON payload today**, with zero backend changes needed. Neither `nutrition/page.js` nor `training/page.js` (web) reads any of these fields, and neither does any Flutter model (`NutritionPlan`/`TrainingPlan` carry no lifecycle fields at all). A restart is only ever communicated to the client as a generic, undifferentiated `plan.duration_restarted` notification with no structured before/after dates.

### Recommendation
This is **not a mobile parity gap** (web has nothing to copy) — it's a **shared product opportunity**, and mobile could legitimately ship it *first* since the data is already on the wire. If pursued: add a small "Plan ends in N days" / "Renews on {date}" affordance to the Nutrition/Training plan-view headers on whichever platform builds it first, and extend the Notifications work in §9 to give `plan.duration_restarted`/`checkin.requested` real deep-link/date context instead of generic titles.

### Estimated Complexity
**Low** if pursued (pure client-side rendering of already-available fields) — but explicitly **out of parity scope** since it would make mobile diverge *ahead* of web, not catch up. Flag to the user as an opportunity, not a requirement, before scheduling it.

---

## 12. Observations — not applicable

The audit brief asked about client-facing Observations (list, detail, related exercises/food/forms, attachments, coach-created observations, client exercise notes). Investigation found: **`ObservationCard.js`, `ObservationModal.js`, `ObservationsFeed.js`, `RelatedObservationsPanel.js`, and `LinkedItemsPicker.js` are all exclusively used on the coach/admin side** (`client/app/(coach)/[workspaceSlug]/clients/[id]/observations/page.js` and the coach's exercise/food insights modals). Grepped the entire `client/app/(client)/portal/` tree for "observation" — **zero matches**. There is no client-facing Observations feature on web today for Flutter to be behind on.

The one adjacent thing that *does* reach the client is the new "Client Notes" section added to the coach's `ExerciseInsightsModal.js` (§4) — the coach can now see the notes a client wrote during Training Mode. That's a coach-side consumption of client-authored data, not a client-facing Observations feature, and requires no mobile work.

**Recommendation:** remove Observations from the mobile roadmap entirely unless/until the product decides to build a client-facing version on web first.

---

## Missing Features Matrix

| Feature | Web | Flutter | Backend Ready | Priority |
|---|---|---|---|---|
| Body-transformation charts (metrics, area chart, date range) | ✅ | ❌ | ✅ | High |
| Progress photo gallery + before/after comparison slider | ✅ | ❌ | ✅ | High |
| Notifications list (filters, grouping, priority, read state) | ✅ | ❌ | ✅ | High |
| Notifications unread badge | ✅ | ❌ | ✅ | High |
| Push notifications (device registration + delivery) | ❌ (web has no push either) | ❌ | ❌ (needs `push-tokens` endpoint + Firebase project) | Medium |
| Forms: `date` question type | ✅ | ❌ | ✅ | High |
| Forms: `metric` question type (number flavor) | ✅ | ❌ | ✅ | High |
| Forms: `metric` question type (image/photo flavor) | ✅ | ❌ | ✅ | High |
| Photo upload endpoint usage (`/uploads/photo`) | ✅ | ❌ | ✅ | High |
| Exercise insights modal (PRs, recent sessions, metric chart) in Training Mode | ✅ | ❌ | ✅ | High |
| Exercise video during live logging | ✅ | ❌ (only on plan view) | ✅ | Medium |
| Per-set target display (Reps/RIR/Rest) in logging card | ✅ | ❌ | ✅ | Medium |
| **Fixed set structure (no add/remove) in Training Mode** | ✅ (new) | ❌ still editable | ✅ | **High — correctness/business-rule drift** |
| **Read-only RIR target in Training Mode** | ✅ (new) | ❌ still editable | ✅ | **High — correctness/business-rule drift** |
| Message attachments (image/voice/file) | ✅ | ❌ | ✅ | High |
| Voice note recording | ✅ | ❌ | ✅ | Medium |
| Message edit | ✅ | ❌ | ✅ | Medium |
| Message delete | ✅ | ❌ | ✅ | Medium |
| Emoji picker in composer | ✅ | ❌ | ✅ | Low |
| Image lightbox in chat | ✅ | ❌ | ✅ | Medium |
| Realtime chat via Socket.IO | ❌ (web polls only) | ✅ | ✅ | — (mobile ahead) |
| Home dashboard hub (plan names, pending-forms count) | ❌ | ✅ | ✅ | — (mobile-only, keep) |
| Plan duration / remaining days / end date display | ❌ | ❌ | ✅ (unused by both) | Low / opportunity |
| Exercise-notes-as-modal UX | ✅ (new) | ❌ (inline field, functionally OK) | ✅ | Low |
| Client-facing Observations | ❌ | ❌ | N/A | N/A — not a real gap |

---

## Implementation Roadmap

Ordered highest business value → lowest, front-loading correctness fixes and features with zero backend risk.

### Phase A — Correctness fixes (no new UI, close a real bug/drift)
**Objective:** stop mobile from diverging from the product's current business rules and from silently failing on real check-in forms.
**Includes:**
- Remove add/remove-set from Training Mode; make RIR read-only (§4).
- Add `date` and `metric`-number question rendering to the forms fill screen (§7) — do the image/photo variant in Phase C once the shared image-upload plumbing exists, but at minimum make the field visibly "unsupported, contact your coach" rather than silently broken until then.
**Dependencies:** none — pure client-side changes against endpoints already in use.
**Estimated effort:** Small (1–2 days).
**Risk:** Low, but skipping this phase means shipping known-incorrect behavior; do it first regardless of what else is prioritized.

### Phase B — Notifications (in-app list only, no push)
**Objective:** close the single largest all-or-nothing feature gap, entirely backend-ready.
**Includes:** list screen with filters/grouping/priority, unread badge on the shell bell, mark-read/mark-all-read, deep-link routing — extended to correctly handle `checkin.requested` and `plan.duration_restarted` (which even web mishandles today; don't copy that gap).
**Dependencies:** none.
**Estimated effort:** Medium (3–5 days).
**Risk:** Low — pure port of a fully-specified, already-working web feature.

### Phase C — Body-Transformation / Progress + Photo pipeline
**Objective:** close the second largest all-or-nothing gap and simultaneously unblock the Forms photo question type.
**Includes:** Progress screen (charts, photo gallery, comparison slider, timeline, date-range filter), plus the shared image-capture/upload component reused by the Forms `metric`-image renderer (§7).
**Dependencies:** decide IA placement (fold into Home vs. new tab/destination) before starting.
**Estimated effort:** Large (1.5–2 weeks) — the single most build-heavy item in this roadmap.
**Risk:** Medium — new UI patterns (comparison slider, multi-metric charting) with no existing mobile precedent to port from.

### Phase D — Training Mode feature catch-up
**Objective:** bring live logging to full parity with the recently-shipped web redesign.
**Includes:** exercise-insights modal (reuse the new `/exercise-insights` endpoint), exercise video in the logging card, per-set target columns.
**Dependencies:** none beyond Phase A's business-rule fixes landing first (both touch the same card widget — sequencing avoids rework).
**Estimated effort:** Medium (4–6 days).
**Risk:** Low — backend is ready and the equivalent web component is a working reference implementation.

### Phase E — Messenger richness
**Objective:** close the remaining messaging gap (attachments, voice, edit, delete).
**Includes:** attachment picker/upload, voice recorder, edit/delete UI, image lightbox (reuse Phase C's viewer if feasible), emoji picker last (cosmetic).
**Dependencies:** none functionally, but sequencing after Phase C lets it reuse the image-viewer/upload groundwork.
**Estimated effort:** Large (1.5 weeks).
**Risk:** Medium — voice recording is the one genuinely new platform-integration surface (mic permissions, background recording UX).

### Phase F — Push notifications
**Objective:** complete the Notifications story with real device delivery.
**Includes:** backend `POST/DELETE /client-portal/push-tokens` endpoint (new backend work — the only phase requiring it), Firebase project setup, `firebase_messaging` integration, permission flow, deep-link-on-tap.
**Dependencies:** Phase B (in-app notifications) should exist first so a tapped push has somewhere correct to land.
**Estimated effort:** Medium (backend: 1–2 days; mobile: 3–5 days; plus Firebase/App Store/Play Console setup overhead).
**Risk:** Medium — the only phase with an external dependency (Firebase project, platform push certificates) outside engineering's direct control.

### Phase G (optional, opportunity not parity) — Package lifecycle client visibility
**Objective:** surface plan duration/remaining-days/end-date, since the data is already free on the wire.
**Includes:** small UI addition to Nutrition/Training plan-view headers; extend Phase B's deep-link mapping for `plan.duration_restarted` with real dates.
**Dependencies:** Phase B.
**Estimated effort:** Small (1–2 days).
**Risk:** Low. **Not required for web parity** — confirm with the user/product before scheduling, since it would make mobile lead rather than follow.

---

## Final Recommendation

Do Phase A immediately, regardless of anything else — it's the only item in this audit that's an active correctness problem rather than a missing feature, and it's cheap. Then sequence B → C → D → E → F, in that order: B and C are both "wire is ready, web is a complete reference implementation, zero backend risk" — the highest-value, lowest-risk work available, and doing them first means the biggest visible gaps (a placeholder Notifications tab, a Home screen with no Progress content at all) close before touching anything more speculative. D is next because it's cheap and high-fidelity (a working web component to port almost directly). C's photo-upload/viewer groundwork should be built once and deliberately reused by D... by E's image lightbox... and by Phase A's eventual `metric`-image forms support — treat "capture/upload/view an image" as a single shared mobile component from the start rather than rebuilding it three times, since Progress, Forms, and Messenger all need it. Push (F) is last because it's the only phase with a real backend dependency and external setup overhead, and because it degrades gracefully — the in-app notifications list from Phase B delivers most of the value on its own. Treat Phase G (package-lifecycle visibility) as a product decision, not an engineering default, since — uniquely in this audit — building it would put mobile ahead of web rather than catching it up; raise it as a "while we're in there" option when scoping Phase B/D, not as a standalone commitment.

Across every phase, keep the backend as a fixed, unmoving target: **every single feature gap identified in this audit — except push notifications — is already fully supported by the existing `/client-portal/*` API with zero required backend changes.** That containment is the strongest argument for treating this as a pure mobile build-out exercise: sequence by mobile engineering effort and user-facing value, not by any coordination tax with the backend team.
