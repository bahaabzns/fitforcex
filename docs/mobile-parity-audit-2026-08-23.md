# FitForce X — Mobile ↔ Web Parity Audit: Drift Since 2026-07-10

> **Scope:** Everything committed to `client/app/(client)/portal/**` (and shared client-facing components/utils it pulls in) between the last parity baseline and today, compared against the current Flutter app (`mobile/lib/`). Coach/admin-only web changes are explicitly screened out and listed at the bottom for traceability, not treated as gaps.
>
> **This is a delta audit, not a re-score.** It builds on [`docs/mobile-parity-audit.md`](./mobile-parity-audit.md) (baseline 2026-07-08) and [`docs/mobile-parity-implementation-report.md`](./mobile-parity-implementation-report.md) (the catch-up pass that followed it) — both frozen at commit `7243344` (2026-07-10, the commit that added them). Everything below is what changed on web **after** that commit and was never reconciled against mobile. Anything the original audit/report already covers is not re-litigated here.
>
> **Baseline commit:** `7243344` (2026-07-10). **Audit date:** 2026-08-23. **Method:** `git log`/`git show` over every client-portal-relevant commit in that range, cross-checked file-by-file against the current mobile codebase (three parallel research passes: Training Mode; Home + Nutrition-extras; Forms/Messenger/Insights). No code was changed to produce this report.
>
> **Two more web features are also new since the baseline — Food Diary/Adherence and a Subscription page — but they're still uncommitted locally, fully researched, and already have a complete mobile implementation plan (models, repositories, controllers, widgets, routing, i18n, tests) ready to execute. They aren't re-covered here; ask for that plan directly if picking this up cold.**

---

## Executive summary

```
Training Mode ..................... 10 open gaps (2 Large, 1 Med-Large, 2 Medium, 5 Small)
Home ............................... 1 open gap (Medium) + 1 cleanup (Small)
Nutrition (beyond Food Diary) ...... 1 open gap (Large — food swap)
Forms ............................... 1 open gap (Medium)
Messenger ........................... 1 open gap (Small)
Insights / Feedback (new subsystem) . 1 open gap (Large — entirely missing)

Total open gaps: 17
Confirmed non-gaps (verified, no action needed): 12 commits/features
```

**The findings that matter most:**

1. **Training Mode has drifted the furthest.** Two Large, independent features shipped on web with zero mobile equivalent: a client-side autosave/draft-resume system (mobile still loses all progress if the app is killed mid-workout) and an entirely new exercise-tracking data model (Sets&Reps vs. Time-Based categories, coach-selectable metrics, RPE) that mobile's session model has no fields for at all.
2. **A whole new subsystem — Insights/Feedback (in-app prompts, a feedback modal, contextual banners) — was built for the client portal and has no mobile equivalent whatsoever.** This is not a page-level gap like the others; it's missing infrastructure that a few of the Training Mode items (the post-session feedback prompt) also depend on.
3. **Good news: several suspected gaps turned out to already be fine.** Arabic-name rendering, nav unread badges, and attachment-type form questions are already correct on mobile — in the nav-badge case, mobile was the *original* implementation and web copied it. Verify-before-build paid off here; see "Confirmed non-gaps" below.

---

## Training Mode (10 gaps)

Scope checked: `client/app/(client)/portal/training/**`, `client/app/components/training-mode/**`, `client/lib/trainingSessionStore.js`, `client/utils/video.js`, `client/utils/workout.js`, `client/utils/exerciseTrackingTypes.js` vs. `mobile/lib/features/training/**` and related shared models.

### 1. Autosave / draft-resume — **Large**
Web mints the `workout_logs.id` client-side, then PUTs every edit (700ms-debounced, `completed:false`) to `PUT /client-portal/workout-logs/:id`, upserting the same row; Finish PUTs `completed:true`. A new `GET /client-portal/workout-logs/draft?day_id=` recovers an in-progress session (bounded to last 24h) on a fresh page load if local state is empty. All read endpoints now filter `completed:true`.
**Mobile:** `workout_repository.dart` only has `createLog()` → one `POST` at Finish. No PUT, no draft-fetch, no debounce loop. `session_store.dart` is purely local (shared_preferences) with no server sync — a killed app loses everything.
**To port:** client-generated id, debounced PUT plumbing, draft-resume-on-launch logic, reconciling with the existing local `SessionStore`.

### 2. Exercise tracking categories + RPE + Time-Based exercises — **Large**
New `sets_reps`/`time_based` exercise categories, coach-selectable tracked metrics (Tempo/RIR/RPE for Sets&Reps; Duration/Distance/Incline/Speed for Time-Based) driven by a shared config (`client/utils/exerciseTrackingTypes.js`, mirrored server-side). RPE (1–10, 0.5 steps) is new. 4 backend migrations, `exercise_library.tracking_type`, new `training_sets` columns.
**Mobile:** `SessionSet` model has only `weight/reps/rir/restSeconds/completed` — no `rpe`, `durationSeconds`, `distanceKm`, `inclinePercent`, `speedKmh`, no category concept anywhere. `_SetRow` hardcodes a fixed weight/reps/RIR grid; a Time-Based exercise would render meaninglessly. The Finish payload drops all the new fields.
**To port:** new model fields end-to-end (session/log/history/progress), a log-card UI with dynamic columns per category, RPE stepper, time-based logging UI, payload serialization.

### 3. Day preview re-architecture + resumable/minimizable sessions — **Large**
Web's day-preview screen now shares the session page's video player, compact set-grid, and Progress/Instructions icon buttons instead of a separate card layout. Sessions can be minimized (not discarded); "Start This Day" becomes a live "Continue {day}" indicator and blocks starting a second session. Tempo/RIR columns hide per-exercise when the coach left them blank. New shared `client/lib/trainingSessionStore.js`.
**Mobile:** `training_page.dart` is still the older card-based layout (per its own header comment, a port of the *pre-redesign* web page). Start button is static; no "Continue" state; no minimize concept; no conditional tempo/RIR hiding.
**To port:** effectively a re-architecture of the day-preview screen plus a new minimize/resume state machine shared with the session screen.

### 4. Post-session completion page + feedback prompt — **Medium-Large**
New route: success chime, motivational phrase, session stats, and an inline 1–5 star + text feedback box posting to the new prompts endpoints (see Insights, below).
**Mobile:** `_finish()` goes straight from `createLog` → clear session → History. No completion screen, no chime, no stats, no prompt integration (the whole prompts/insights client integration is absent — see item 17).
**To port:** new screen + navigation flow; depends partly on the Insights subsystem (item 17) for the feedback half — sequence together.

### 5. Training history redesign + client-initiated delete — **Medium**
Restyled cards (icon avatar, title/subtitle, chevron, full weekday/date/time); clients can now delete a logged session via `DELETE /client-portal/workout-logs/:id` with a confirm modal.
**Mobile:** `history_page.dart` still uses the pre-redesign bare-stats-row card (date-only, no time-of-day). No delete method, no confirm UI.
**To port:** UI restyle + swipe-to-delete/confirm dialog + one new repository method.

### 6. Arabic exercise/muscle/equipment names — **Medium**
Training screens now prefer `library_name_ar`/`muscle_group_ar`/`equipment_ar` over English when locale is Arabic (nutrition already got this fix correctly in an earlier pass — training was missed).
**Mobile:** `training_plan.dart`/`workout_session.dart` have no `*_ar` fields at all; exercise names/muscle group/equipment always render in English even in Arabic locale.
**To port:** model fields (backend already returns the data) + `isRTL` selection logic across the training screens — mostly UI wiring, no new backend work.

### 7. YouTube embed error → external-link fallback — **Small-Medium**
Web switched to the real YouTube IFrame Player API to catch playback errors (owner-restricted, region-locked) and show a "Watch on YouTube" fallback instead of a dead player.
**Mobile:** `exercise_video.dart` has no error listener at all on its `youtube_player_iframe` controller — a playback failure has no defined fallback UI.
**To port:** add an error listener + an "open externally" affordance (`url_launcher`).

### 8. Stale/invalid resumed session not cleared — **Small (bug fix)**
Web now clears the cached session before bouncing back to Training when the resumed day is invalid/empty or the plan 404s, preventing a redirect loop.
**Mobile:** same bug still present — `session_page.dart`'s invalid/error branches call `_exit()` without ever calling `sessionStore.clear()`.
**To port:** one-line fix — clear the session store before exiting on both branches.

### 9. YouTube Shorts embed support — **Small**
Web's URL-matching regex now also matches `/shorts/<id>` links.
**Mobile:** `media_url.dart`'s `youtubeVideoId` still only matches `watch?v=`/`youtu.be/`/`embed/` — a Shorts-linked exercise video silently renders nothing.
**To port:** one regex change.

### 10. First-time hint tooltips (mechanism) — **Small, mostly blocked**
Web wires its existing `NewFeatureTooltip` (localStorage, shown once) onto 5 Training Mode surfaces.
**Mobile:** no onboarding-tooltip mechanism exists at all, and 4 of the 5 target surfaces (minimize/resume, delete-session, star rating) don't exist yet anyway (items 3, 5, 4). Only the Instructions-icon hint has anything to attach to today.
**To port:** small on its own, but mostly moot until the underlying features ship.

*Note: commit `0532c5d` (the empty/rest-day SQL-alias fix) touched `training_page.dart` in the same commit and is already synced — not a gap.*

---

## Home (2 items)

### 11. Action Items strip — **Medium**
New Home-page section aggregating pending check-in forms, unread plan-assigned/restarted notifications, and a subscription-in-grace-window prompt into one tap-to-navigate list, above the Progress section. Backend (`GET /client-portal/action-items`) is already built and generic.
**Mobile:** has all the underlying data already (`withinGrace`, unread providers per tab) but no aggregation or UI surfaces it on Home.
**To port:** a repository call + small model, an "action needed" list widget above `ProgressDashboardBody`, icon/copy mapping per kind, tap-to-navigate + mark-read wiring. No new access-flag plumbing needed.

### 12. Progress tab: duplicate submission timeline — **Small (cleanup, not a missing feature)**
Web removed its Progress-page submission timeline, deduping it into the Forms > Submitted tab (which mobile also already has independently).
**Mobile:** `progress_dashboard.dart` still renders the full timeline too — not missing anything, just redundant with the Forms tab now that web has de-duplicated.
**To do:** delete the `_TimelineEntry` block (~15 lines) from `progress_dashboard.dart`.

---

## Nutrition — extras beyond Food Diary (1 item)

*(Food Diary/Adherence itself, Arabic food names, and empty-day handling are covered elsewhere — this section is only what's left.)*

### 13. Food swap — **Large**
Clients can swap a prescribed food for an equivalent (server recalculates grams), gated behind a new `allow_food_swap` subscription-access flag (off by default). Two new endpoints, a new modal (`FoodSwapModal.js`), migration-backed swap history/audit table.
**Mobile:** entirely absent — no access-flag getter, no `is_swapped`/`original_*` model fields, no repository calls for either endpoint.
**To port:** access-flag plumbing, model fields, repository methods (search + apply + reset), a search/preview modal, i18n.

---

## Forms (1 item)

### 14. Edit submitted form answers + visible history — **Medium**
Clients can now edit an answer after submitting (per-question inline edit/save/cancel), with an "Edited" chip + expandable before/after history. Backend (`PATCH .../form-requests/:request_id/answers/:question_id`) is generic and platform-agnostic.
**Mobile:** `form_fill_page.dart` hard-disables every input once submitted, with no unlock path at all.
**To port:** a per-question edit-mode toggle, wire to the existing PATCH endpoint, an edit-history display widget.

*(Attachment question type and type-based answer/attachment rendering are already at parity — mobile shipped its side the same day as the backend work. See "Confirmed non-gaps.")*

---

## Messenger (1 item)

### 15. Logout from the expired/frozen access trap screen — **Small (bug fix)**
Web added a Logout button to the full-screen "your access is restricted" card so a client isn't permanently stuck.
**Mobile:** `subscription_status_card.dart` (the mobile equivalent of this trap screen) still has no way out — same bug. Mobile already has a logout controller used elsewhere in the app.
**To port:** one button wired to the existing sign-out call.

### 16. Message composer: surface send failures — **Small**
Web now shows the server's actual error message when a send/edit/attachment-upload fails, instead of swallowing it silently.
**Mobile:** `messages_page.dart` still silently swallows all three failure paths (`catch (_) {}` with no user-visible error).
**To port:** wire the existing catch blocks to a SnackBar/inline error.

*(Voice-message preview, the other half of the source web commit, doesn't apply — mobile has no voice-recording feature at all, a separate large pre-existing gap, out of scope here.)*

---

## Insights / Feedback — new subsystem (1 item)

### 17. Insights/Feedback subsystem — **Large**
An entirely new client-facing subsystem, not just a page: a global dismissible banner mounted in the portal shell (`InsightBanner`), a feedback modal (category/rating/text/screenshot, reachable from Profile), contextual trigger banners on Messages/Forms/Training-history, a `rating_with_text` prompt type with recurrence, all backed by `/client-portal/prompts/*`.
**Mobile:** zero equivalent — no banner host, no feedback modal, no prompts calls anywhere in the codebase. (The similarly-named "exercise insights" modal in Training Mode is unrelated — a different, pre-existing feature.)
**To port:** a global banner host in the app shell, a feedback modal, contextual trigger placement on the relevant screens, prompts-endpoint wiring, local dismiss/impression state. Item 4 (post-session feedback prompt) depends on this — sequence together.

---

## Confirmed non-gaps (verified — no action needed)

- **Nav unread badges** — mobile was the *source*; web's commit explicitly ports mobile's existing `unread_indicators.dart` pattern to the web nav. No drift.
- **Arabic nutrition food names** — already correct on mobile since before the baseline; the bug the web commit fixed was web/coach-portal-specific.
- **Empty nutrition days** — both platforms handle it identically (generic empty-state message); neither got special "rest day" polish the way training did, so there's no asymmetry.
- **Attachment question type + type-based answer rendering** — mobile shipped its side in the same commit as the backend work; field-for-field equivalent to web's later, richer version.
- **Last-edited-by attribution on nutrition plans** — coach-builder-only UI, never surfaced to clients on either platform.
- **Descriptive browser tab titles** — a `document.title` concern with no native-app analog.
- **Submission archiving in Plans Queue** — coach-only despite "client forms" appearing in the commit message; zero files under `(client)/portal/` touched.
- **Delete-account page** — a public, unauthenticated informational/compliance page, not linked from the client portal.
- **Privacy policy page** — linked only from the marketing landing page, not the portal.
- **Portal login styling (secondary variant, password toggle)** — mobile has a fully separate native login flow sharing no code with the web login page; not a parity concern.
- **"Show who last edited a plan"** — coach-only, not client-visible on any platform.
- **0532c5d empty/rest-day fix (training half)** — already ported to mobile in the same commit.

---

## Recommended phasing

1. **Quick wins first** (small, independently shippable correctness fixes): #8 stale-session redirect loop, #9 YouTube Shorts embed, #15 logout-from-trap-screen, #16 composer send-failure surfacing, #12 duplicate-timeline cleanup.
2. **Medium features, one at a time**: #6 Arabic training names, #5 history redesign + delete, #11 Action Items strip, #14 edit form answers + history, #7 YouTube error fallback.
3. **Large features, each its own scoped implementation plan** (do not bundle): #1 autosave/draft-resume, #2 exercise tracking categories + RPE, #3 day-preview re-architecture, #13 food swap, #17 Insights subsystem. Sequence #4 (post-session completion) alongside or after #17, since it depends on the same prompts plumbing.
4. Food Diary + Subscription (already fully planned separately) can proceed in parallel with any of the above — independent of this list.

See `PARITY.md` for these 17 items tracked as pending entries.
