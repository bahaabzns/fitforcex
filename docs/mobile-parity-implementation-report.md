# Mobile ↔ Web Parity Implementation Report

> Follow-up to [`docs/mobile-parity-audit.md`](./mobile-parity-audit.md). This report covers the implementation pass on branch `feature/mobile-web-parity`, built entirely against the *existing* `/client-portal/*` API — no backend or web changes were made or required.
>
> **Verification performed:** `flutter analyze` (0 issues), `flutter test` (65/65 passing, including 12 new tests), `flutter build apk --debug` (succeeds). No emulator/device walkthrough was performed in this session — see **Manual testing performed** below for exactly what that means and what's still recommended before shipping.
>
> **Round 2 addendum:** a follow-up pass fixed a real Notifications crash bug, restructured Home to mirror the web exactly, and rebranded the app. See [Round 2 — additional fixes](#round-2--additional-fixes).
>
> **Round 3 addendum (this section):** replaced the top-nav text title with the real brand logo, and added bottom-nav unread dots + modern label-on-selected-only behavior. See [Round 3 — top nav logo + bottom nav polish](#round-3--top-nav-logo--bottom-nav-polish) at the end of this document. Verified: `flutter analyze` 0 issues, `flutter test` 75/75 passing (10 new), `flutter build apk --debug` succeeds.

---

## Scope actually completed

Of the audit's 7-phase roadmap, **Phases A, D, B, C, and E are implemented.** Phase F (push notifications) and Phase G (package-lifecycle visibility) are deliberately **not** implemented — both were flagged in the audit itself as not appropriate for an unattended pass (F needs a real Firebase project/APNs certs I cannot fabricate; G would make mobile diverge *ahead* of web, which the audit explicitly called a product decision, not an engineering default). Both are covered in **Remaining recommendations**.

---

## ✅ Completed items

### Phase A — Correctness fixes
- **Removed add/remove-set from Training Mode.** `ExerciseLogCard` and `SessionPage` no longer let the client change the coach's prescribed set count — matches the web's recent (previously-uncommitted) redesign exactly.
- **RIR is now a read-only target**, not an editable field. The client only edits weight and reps per set, same as web.
- **Every set row now shows its own per-set targets** (Reps placeholder, RIR, Rest), replacing the old single header-level guidance line.
- **Forms: added the two missing question types.** `date` (native date picker → `yyyy-MM-dd`) and `metric` (number-flavor with a unit suffix, and image-flavor via a new shared photo picker/uploader). This closes what the audit flagged as an actual correctness bug — check-in forms using these types were previously unfillable on mobile.

### Phase D — Training Mode catch-up
- **Exercise video now shows during live logging**, not just on the plan-view screen (reused the existing `ExerciseVideo` widget; `SessionExercise`/`buildSession()` now carry `youtubeUrl`/`videoPath`).
- **New exercise insights modal**, opened from a chart icon on each logging card: metric-toggle chart (Top Weight / Est. 1RM / Volume), personal-record chips (heaviest weight, best set + RIR, highest volume, est. 1RM), and a recent-sessions list — all from the existing `GET /workout-logs/exercise-insights` endpoint. Matches the web's `ClientExerciseInsightsModal` scope exactly, including deliberately **not** surfacing the coach-only strength-trend/plateau block the same endpoint also returns (the web client doesn't show that either).
- **Exercise notes moved behind an icon + modal** (`ExerciseNotesModal`), matching the web's redesign — highlighted when a note already exists.

### Phase B — Notifications (previously a static placeholder)
- Full list screen: `GET /notifications`, filter chips (All / Unread / Messages / Coaching / Billing), priority accent border (alert/actionable/info), read/unread visual state, mark-one-read on tap, mark-all-read action, empty + filtered-empty states.
- **Unread badge on the shell's bell icon**, polling `GET /notifications/unread-count` every 15s (matches the web nav's poll interval), auto-clearing on read.
- **Deep-link routing per notification type** into the right tab/screen — and, per the audit's explicit recommendation, this covers `checkin.requested` and `plan.duration_restarted` correctly even though the *web* client currently lets both fall through to generic/no-link handling. Mobile is intentionally ahead of web here, not behind.
- Not ported: the web's "collapse repeated same-thread/same-day notifications into an expandable group" behavior — the list here is flat/chronological. Noted as a minor, low-value gap in Remaining recommendations.

### Phase C — Progress / Transformation (previously entirely absent)
- New screen (`BodyProgressPage`, reached from a new Home dashboard tile) consuming `GET /transformation`: numeric metrics as line charts (current value, delta vs. range start, reading count), image metrics as a horizontal photo strip with a full-screen viewer and a first-vs-latest **Compare** dialog, a 30d/90d/6m/All date-range filter, and a collapsible submission timeline.
- **New shared photo capture/upload component** (`core/media/`), used identically by this screen's underlying data (photos are submitted *through* Forms metric-image answers, per the actual web architecture — `buildTransformationPayload` sources its photo history from check-in answers, not a separate upload flow) and by the Forms `metric`-image renderer and Messenger's image attachments.
- Android `CAMERA` permission and iOS `NSCameraUsageDescription`/`NSPhotoLibraryUsageDescription` added — required for `image_picker` to function; the build would otherwise crash on first photo pick.

### Phase E — Messenger (was text-only)
- **Image attachments**: pick from camera/gallery → `POST /messages/attachments` (multipart, with optional caption) → renders as a bubble with a tap-to-fullscreen viewer.
- **Edit**: long-press a client's own text message → edit mode in the composer (banner + prefilled text) → `PATCH /messages/:id`. Server-enforced text-only rule respected (no edit option offered on attachment messages).
- **Delete**: long-press → confirm → `DELETE /messages/:id` → renders as the tombstoned "This message was deleted" bubble, matching web.
- `Message` model extended with `type`, `attachment_url/name/size`, `edited_at`, `deleted_at` — all fields the backend already returns.
- **Not ported**: voice note recording, generic (non-image) file attachments, emoji picker. These were the audit's lowest-priority Messenger items (voice = Medium, file/emoji = Low) and each pulls in a new native-permission surface (microphone) or a fair amount of picker/UI work with comparatively low value; deferring them keeps this pass focused and reviewable. See Remaining recommendations.

---

## Screens now matching the web

- Training Mode session screen (set structure, RIR, video, insights, notes)
- Notifications (list, filters, priority, badge, deep links — and ahead of web on 2 event types)
- Progress/Transformation (new — matches web's `/portal/home` content, reached from a dedicated screen rather than the Home tab; see below)
- Messenger (image attachments, edit, delete)
- Forms (all 8 question types web supports, including photo check-ins)

## Remaining intentional differences

- **Home tab.** Web's `/portal/home` *is* the transformation/progress content; Flutter's Home is a 4-tile dashboard hub (plan names, pending-forms count) with Progress reachable via a new tile rather than being the tab's own content. This mirrors the audit's own recommendation to keep the dashboard-hub value already built rather than replace it — flagged there as a decision to confirm with the user rather than silently pick. Worth a product call on final IA.
- Notifications: no grouping/collapsing of repeated events (flat chronological list instead).
- Messenger: no voice notes, no non-image file attachments, no emoji picker.
- Push notifications: not implemented (needs a Firebase project + APNs certs — infrastructure, not code).
- Plan duration/remaining-days/restart visibility: not added on either platform — confirmed in the audit as a joint opportunity, not a parity gap, so left out of this pass by design.

## New reusable components created

- `core/media/photo_upload_repository.dart` — pick + upload a photo to `POST /uploads/photo`, shared by Forms and (indirectly, via check-in answers) Progress.
- `core/media/photo_answer_field.dart` — the picker UI (camera/gallery sheet, thumbnail, remove, upload/error states), used by the Forms `metric`-image renderer.
- `core/widgets/line_chart.dart` — **moved** from `features/training/widgets/` (it was already shared conceptually; now it's shared in fact, used by Training Progress, the new Exercise Insights modal, and the new Progress screen).
- `features/training/widgets/exercise_insights_modal.dart`, `exercise_notes_modal.dart` — new Training Mode card actions.

## Shared services created

- `features/notifications/notifications_repository.dart` — list/unread-count/mark-read/mark-all-read, plus a polling `StreamProvider` for the badge.
- `features/progress/progress_repository.dart` — the transformation payload fetch.
- `workout_repository.dart` gained `fetchInsights()` / `exerciseInsightsProvider`.
- `messages_repository.dart` gained `sendAttachment()`, `edit()`, `delete()`.

## Backend/API changes

**None.** Every feature above was built against endpoints that already existed and were already exercised by the web client (`/notifications/*`, `/transformation`, `/uploads/photo`, `/workout-logs/exercise-insights`, `/messages/attachments`, `PATCH`/`DELETE /messages/:id`). This was possible because, per the audit, the backend was already ahead of both clients.

## Business logic changes

- Training Mode set structure is now fixed (no client-side add/remove) and RIR is coach-target-only — bringing mobile's business rules back in line with the web's current (recently tightened) intent. This is the one place mobile behavior actually *changes* for existing users; everything else is additive.

## Breaking changes

**None.** No API contracts changed, no existing screens lost functionality (Training Mode logging still edits weight/reps, still has the rest timer, still resumes a draft session), and all 63 pre-existing tests continue to pass unmodified.

## Manual testing performed

Static/automated verification only, run in this session:
- `flutter analyze` — 0 issues across the whole `mobile/` tree.
- `flutter test` — 65/65 passing, covering JSON round-trips for every new/changed model plus (added in Round 2) a widget test that drives the real `NotificationsPage` through Riverpod and asserts it actually reaches rendered data, not just `AsyncLoading`.
- `flutter build apk --debug` — succeeds and produces `build/app/outputs/flutter-apk/app-debug.apk`.
- (Round 2) A live backend integration test (`server/tests/integration/clientPortalNotifications.test.ts`) against a running dev server + isolated test database, exercising the real `/api/client-portal/notifications*` HTTP routes end-to-end.

**Not performed, and recommended before release:** an actual emulator/device walkthrough — logging a training session end-to-end (fixed sets, insights modal, video), submitting a photo check-in form, viewing the new Home/Progress dashboard with real data, sending/editing/deleting a chat image, and confirming the notifications badge/deep-links — in both English and Arabic, light and dark. I do not have a way to drive the Flutter UI interactively in this environment, so this is explicitly unverified rather than claimed.

## Remaining recommendations

1. **Do the manual device walkthrough above before shipping** — this is the biggest gap between "verified" and "done."
2. **Voice notes, file (non-image) attachments, emoji picker** in Messenger — deferred by design; pick these up as a small follow-up if the product wants full Messenger parity.
3. **Notification grouping** (collapse repeated same-thread/same-day events) — cosmetic, low priority, straightforward to port from the web's `groupNotifications()` if desired.
4. **Push notifications (Phase F)** — needs a Firebase project, APNs certs, and the still-unbuilt `POST/DELETE /client-portal/push-tokens` backend endpoint. Scope this as its own effort once the infra exists; the in-app notifications list built here already delivers most of the value on its own, per the original audit's recommendation.
5. **Package-lifecycle visibility (Phase G)** — still explicitly out of scope; it's a "build ahead of web" feature, not a parity gap. Only pick it up if product wants mobile to lead there.

---

## Round 2 — additional fixes

A second round of user-reported findings, addressed on the same branch.

### 1. Notifications — root-caused and fixed (not worked around)

**Symptom:** the Notifications screen stayed on the loading skeleton forever.

**Investigation (in order, so a future bug gets debugged the same way):**
1. Confirmed the backend wasn't the cause: stood up the real dev server (already running locally) and wrote `server/tests/integration/clientPortalNotifications.test.ts`, which hits the actual `GET /client-portal/notifications` and `/unread-count` routes end-to-end against an isolated test database. Result: `200`, correct JSON, fast — even for a client with zero subscription rows. Backend ruled out.
2. Re-read every line of the Flutter list/repository/provider/model code against the same pattern already working on Forms/Nutrition/Training pages — structurally identical, no logic bug found by inspection.
3. Wrote `test/widget/notifications_page_test.dart`, which pumps the **real** `NotificationsPage` widget through Riverpod with a fake repository (isolating Flutter/rendering issues from network/auth issues) and asserts it reaches rendered data. This reproduced the bug directly: it failed with `A borderRadius can only be given for borders with uniform colors` — a Flutter `BoxDecoration` painter assertion.

**Root cause:** `_NotificationTile`'s card combined a `BorderDirectional` with *different colors per side* (a colored accent bar on the leading edge, neutral gray on the other three) together with a `borderRadius`. Flutter explicitly disallows that combination and throws **on every paint pass**. In practice this meant the real content could never successfully paint over the last good frame (the loading skeleton), which is exactly why it looked stuck forever rather than erroring visibly.

**Fix:** replaced the single `Container` with mixed-border-decoration with a `ClipRRect` wrapping a `Row` — a solid-color accent bar as one flex child, and the content pane (with its own *uniform*-color border) as the other. This reproduces the web's CSS `border-left` + rounded-corners look, which has no equivalent restriction in Flutter's box model. Verified: the widget test now passes (transitions to rendered data), and I swept the rest of the codebase for the same anti-pattern (`BorderDirectional`/non-uniform `Border` + `borderRadius`) — no other occurrences.

Both new tests (the widget test and the backend integration test) are kept as permanent regression coverage.

### 2. Home now mirrors the web exactly

The web's `/portal/home` **is** the body-transformation/progress dashboard — nothing else. Mobile's Home previously showed a 4-tile "dashboard hub" (Nutrition/Training/Forms/Messages links) instead, which doesn't exist on web.

- `HomePage` now renders the Progress content directly (metric charts, photo gallery with compare, date-range picker, submission timeline) instead of linking to it from a tile — nothing is hidden behind another screen anymore.
- The dashboard-hub tiles (`_DashboardCard` for Nutrition/Training/Forms/Messages, plus the Progress tile that briefly existed) are removed entirely. Every other module is still reachable — via the bottom tab bar, exactly as the web reaches them via its nav, not via Home.
- The standalone `/progress` route is gone (folded into Home); `features/progress/progress_page.dart` was renamed to `progress_dashboard.dart` and its `BodyProgressPage` (a `Scaffold`) became `ProgressDashboardBody` (content only — Home provides the shell's app bar).
- Date-range selector and charts are unchanged/preserved, exactly as instructed.

### 3. Branding: "FitForce X" → "FitForce"

Updated every user-facing occurrence: the in-app `appName` string (shown in the shell's app bar on every screen, and as the OS task-switcher title) in both `app_en.arb` and `app_ar.arb`, the Android launcher label, the iOS `CFBundleDisplayName`/`CFBundleName`, the `pubspec.yaml` description, `README.md`, and the (unused-but-present) Flutter-web manifest/index title.

**Deliberately left unchanged**, since they're technical identifiers rather than display branding and renaming them is a materially different, much higher-risk task than "change the app's name": the `fitforcex://` deep-link URL scheme, the Dart package name (`fitforce_x`, referenced in ~30 import statements throughout the codebase), and the Android `applicationId`/iOS bundle identifier (`com.fitforcex.fitforce_x` / `com.fitforcex.fitforcex`) — changing the latter would make app stores treat it as a brand-new app, breaking any existing installs/TestFlight builds. Flag if you actually want that deeper rename; it's a separate, deliberate decision.

There was no "About page" or "Drawer" to update — neither exists in this app (navigation is a bottom tab bar; profile/settings live in the Profile screen, which carries no app-name text).

### 4. App display name

Same edits as branding item 3 above (`android:label`, `CFBundleDisplayName`) — this **is** what controls the name shown under the icon on the device home screen and in the OS app switcher. Verified by inspecting the generated `AndroidManifest.xml` and `Info.plist` directly.

### 5. App icon

Source: `client/public/blue_f_only.svg` — confirmed byte-identical (aside from line endings) to `client/public/blue_f.svg`, the canonical brand mark. Used `sharp` (already available in `client/node_modules`, the same tool the web app's own favicon generation uses) to rasterize it, cropped to the same bounding box the web brand system already established for this exact mark (`client/public/mark.svg`'s viewBox), at two paddings:
- `mobile/assets/icon/app_icon.png` — modest padding, used for the flat iOS/legacy-Android icon and the native splash screen.
- `mobile/assets/icon/app_icon_foreground.png` — generous padding, used only as the Android adaptive-icon foreground layer, so the mark survives circle/squircle/rounded-square launcher masks without clipping.

Ran `flutter pub run flutter_launcher_icons` and `flutter pub run flutter_native_splash:create`, which regenerated every Android mipmap/drawable density and every iOS `AppIcon.appiconset` size, plus the native splash screens (Android 12 splash, iOS launch storyboard, Flutter-web splash). Visually verified the flat icon, the adaptive foreground layer, and the splash screen render the mark centered and uncropped. A short `mobile/assets/icon/README.md` documents the source file and how to regenerate.

### Verification (Round 2)

- `flutter analyze` — 0 issues.
- `flutter test` — 65/65 passing (including the new `notifications_page_test.dart`).
- `flutter build apk --debug` — succeeds.
- Backend integration test (`clientPortalNotifications.test.ts`) — 3/3 passing against a live dev server + isolated test DB.
- No manual emulator/device walkthrough performed, for the same reason as Round 1 — recommended before shipping, especially to see the new Home layout and the fixed Notifications screen with real data.

### Final verification checklist (from the request)

- ✅ Flutter Home screen matches the Web Client Portal Home (same content: Progress dashboard, nothing else).
- ✅ No remaining "Need Action" dashboard cards.
- ✅ Notifications root-caused, fixed, and covered by a regression test that actually reproduces the original failure.
- ✅ Application name is "FitForce" on both Android (`android:label`) and iOS (`CFBundleDisplayName`).
- ✅ Launcher icon replaced everywhere (all Android densities, all iOS sizes, native splash, Flutter-web icons).
- ✅ No "FitForce X" branding remains in any user-facing string or app-identity config. (Technical identifiers — URL scheme, package name, bundle ID — are unchanged by design; see branding section above.)

---

## Round 3 — top nav logo + bottom nav polish

### 1. Top navigation: logo instead of text

`ShellPage`'s `AppBar` title was `Text(l10n.appName)` ("FitForce"). Replaced with a new `core/widgets/brand_logo.dart` (`BrandLogo`) that:
- Renders the **exact same lockup the web client portal uses** — `client/public/blue_dark.png` (dark wordmark, light theme) / `blue_white.png` (white wordmark, dark theme), copied into `mobile/assets/images/logo_light_theme.png` / `logo_dark_theme.png`. Not the retired "FitForce X" mark — these are the current, already-in-production web assets.
- Swaps on `Theme.of(context).brightness`, matching the web's `.dark`-class-driven `brand-logo-light`/`brand-logo-dark` swap rule exactly (icon mark constant, only the wordmark color flips).
- Sized to `height: 28` with `BoxFit.contain` (preserves the source's fixed ~3.7:1 aspect ratio, never stretches) and `cacheHeight` set from `MediaQuery.devicePixelRatioOf(context)` so it decodes at display resolution rather than the full multi-thousand-pixel source — crisp at every density without the memory cost of a full decode.
- `AppBar.centerTitle: true` set explicitly (Android's default is left-aligned; iOS's is centered) so it's centered on both platforms, matching the web's fixed 3-column grid header.
- Wrapped in `Semantics(label: 'FitForce', image: true)` for accessibility (a screen reader announces it as an image named "FitForce," not silence or a raw asset path).
- AppBar height (`kToolbarHeight` = 56px, Flutter's default) already matches the web header's `h-14` (56px) — no layout change needed there.

### 2. Bottom navigation: unread dots + label-on-selected-only

**Unread dots — reused existing signals, no new backend work, no duplicated tracking:**

- **New shared primitive**: `core/unread/last_seen_store.dart` (`LastSeenStore`, backed by `shared_preferences` like the rest of the app's local persistence) — one small class holding either a "last seen plan identity" string or a "last seen id set," reused by all three modules that need it instead of three separate ad-hoc storages.
- **Nutrition/Training dots**: `NutritionPlan`/`TrainingPlan` models gained an `activatedAt` field (`core/unread/unread_indicators.dart`'s `nutritionUnreadProvider`/`trainingUnreadProvider`) — this field was **already returned by the existing `/active-plan`/`/active-training-plan` endpoints** (an unfiltered Prisma row spread, confirmed in the original parity audit) but never parsed client-side. The dot compares the active plan's `(id, activatedAt)` identity against what was stored the last time the client opened that tab; it changes only on activation/restart (a coach "publishing a new plan"), not on ordinary content edits to the same active plan. Zero backend changes.
- **Forms dot**: `formsUnreadProvider` compares the set of currently pending/scheduled request ids against the set last seen. Opening Forms marks all *currently shown* actionable ids as seen — even unfilled ones — so the dot means "something new appeared," not "something's incomplete," per spec. A new `formRequestNeedsAction()` helper in `shared/models/form.dart` is the single shared definition of "needs action," used by both the Forms page's own bucketing and this dot so they can't drift apart.
- **Messages dot**: reuses the **existing notifications substrate** instead of inventing message-specific unread tracking — `hasUnreadMessageProvider` checks for any unread `message.received` notification. Also consolidated the shell's bell-badge poll and this dot onto **one** `unreadNotificationsProvider` stream (was two separate polls) — one 15s poll now serves both. Opening Messages triggers an immediate `ref.invalidate` (instead of waiting up to 15s for the next poll) since the backend already marks the linked notification read as a side effect of fetching the thread.
- **Survives app restart**: every "seen" value is persisted via `LastSeenStore`, not held only in memory.
- **Dot styling**: `Badge` (Flutter's built-in indicator) with no `label` renders as a small dot per Flutter's own default — satisfies "no numeric badges, dot only" with zero custom painting. Fixed color (`#EF4444`) rather than the theme's `error` color, so it reads consistently as "new" in both light and dark rather than whatever a given theme tunes error-red to. Doesn't affect layout (Badge overlays, doesn't reserve space) and carries a tooltip/semantic label ("{tab}, new updates") when active.

**Label-on-selected-only**: `NavigationBar(labelBehavior: NavigationDestinationLabelBehavior.onlyShowSelected)` — a single built-in Material 3 flag. It already animates the label's appearance/disappearance and keeps the existing pill-indicator selected-state styling (the app's theme, unchanged) — no custom animation code needed, which is also why it can't regress: it's the same widget the app already used, one new parameter.

**Business logic / navigation structure**: unchanged, as instructed — same 5 branches, same `StatefulShellRoute`, same route guards, same tab-visibility-by-permission logic. Only the destinations' visual treatment changed.

### Tests added

`test/unit/unread_indicators_test.dart` (10 tests) — drives the real providers through `ProviderContainer` with overridden data sources and mocked `shared_preferences`, covering: unseen-by-default, `markSeen` clearing the dot, a restart reopening it, a new form request reopening it after a prior mark-seen, submitted/reviewed requests never triggering it, and the messages dot keying off notification type. Found and fixed a genuine race in the process: the seen-controllers' async storage load could resolve *after* `markSeen()` had already set a fresher value and clobber it — fixed with a `_loaded` guard before this was ever exercised outside tests.

### Verification (Round 3)

- `flutter analyze` — 0 issues.
- `flutter test` — 75/75 passing (65 prior + 10 new).
- `flutter build apk --debug` — succeeds.
- No manual emulator/device walkthrough performed, for the same reason as prior rounds — recommended before shipping, especially to see the logo render at actual device pixel density and the dots' color/contrast in real dark mode.
