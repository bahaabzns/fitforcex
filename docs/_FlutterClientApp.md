# FitForce X — Flutter Client App — Full Build Plan

> **Goal:** ship a native iOS + Android client app that mirrors the existing web **client portal** (`client/app/(client)/portal/*`) flow-for-flow and feature-for-feature, reusing the **exact same backend API** (`/api/client-portal/*`). No backend rewrites — only additive endpoints where mobile genuinely needs them (token auth, workspace lookup, push tokens).
>
> This document is the source of truth for the mobile build. It is the parallel of `CLAUDE.md` for the Flutter side: it defines the stack, architecture, conventions, and a phased roadmap. Keep it honest — when a pattern changes, fix the code or fix this file.

---

## 0 — Scope & Source of Truth

The web portal we are porting lives in:

| Area | Web source |
|---|---|
| Shell / nav | `client/app/components/ClientPortalNav.js`, `client/app/(client)/portal/layout.js` |
| Login | `client/app/(client)/portal/page.js` |
| Home | `client/app/(client)/portal/home/page.js` (placeholder "coming soon") |
| Nutrition | `client/app/(client)/portal/nutrition/page.js` + `components/nutrition/MacrosDonut.js` + `components/ShoppingListDrawer.js` + `lib/nutritionCalc.js` |
| Training plan | `client/app/(client)/portal/training/page.js` |
| Training Mode (session) | `client/app/(client)/portal/training/session/page.js` + `components/training-mode/*` + `utils/workout.js` |
| Training history | `client/app/(client)/portal/training/history/page.js` + `history/[logId]/page.js` |
| Training progress | `client/app/(client)/portal/training/progress/page.js` + `components/charts/LineChart.js` |
| Forms list | `client/app/(client)/portal/forms/page.js` |
| Form fill | `client/app/(client)/portal/forms/[requestId]/page.js` |
| Messages | `client/app/(client)/portal/messages/page.js` |
| Profile | `client/app/(client)/portal/profile/page.js` |
| Notifications | `client/app/(client)/portal/notifications/page.js` (placeholder) |
| Backend API | `server/src/modules/clientPortal/clientPortal.routes.ts` (+ legacy `server/routes/clientPortal.js`) |
| i18n | `client/messages/en.json` → `portal.*`, `client/messages/ar.json` |

**Out of scope:** the coach/admin web app (`my.*` dashboard), team/billing, plan builders. Mobile is **client-facing only**.

---

## 1 — Backend API Contract (what the app consumes)

All endpoints are under `/api/client-portal` and (except login/logout) require client auth. The web uses an **httpOnly cookie** (`client_token`, JWT, 7-day). **Mobile cannot rely on cookies cleanly** → see §4 for the auth adaptation.

### Auth
| Method | Path | Body / Query | Returns |
|---|---|---|---|
| POST | `/login` | `{ email, password, workspace_slug \| coach_slug }` | sets `client_token` cookie; `{ message }` |
| POST | `/logout` | — | clears cookie |
| GET | `/me` | — | `{ id, fname, lname, email, phone, client_code, workspace_id }` |

### Nutrition
| GET | `/active-plan` | — | nutrition plan tree: `{ id, name, cycles[] }`; cycle → `meals[]` → `items[]` (food macros, `serving_unit`, `amount`, `alternatives[]`); `note` per cycle/meal. `404` = no plan. |

### Training
| GET | `/active-training-plan` | — | `{ id, name, notes, days[] }`; day → `exercises[]` (name, `muscle_group`, `equipment`, `thumbnail_path`, `video_path`, `youtube_url`, `instructions_en/ar`, `sets[]`={reps,rest_seconds,tempo,rir}, `alternatives[]`). `404` = no plan. |
| GET | `/workout-logs` | — | session summaries: `{ id, day_name, date, duration_seconds, total_volume, total_sets }` |
| POST | `/workout-logs` | `{ plan_id, day_id, day_index, notes, started_at, ended_at, exercises[] }` | saved session; each exercise has `sets[]`={set_order,weight,reps,rir,rest_seconds,completed} |
| GET | `/workout-logs/previous?day_id=` | `day_id` | map `exercise_id → previous sets` (for "last time" hints) |
| GET | `/workout-logs/exercise-progress?exercise_library_id=&exercise_id=` | — | ascending points `{ date, top_weight, est_1rm, total_volume }` |
| GET | `/workout-logs/exercises` | — | unique logged exercises `{ exercise_id, exercise_library_id, name }` |
| GET | `/workout-logs/:id` | — | full session detail with sets |

### Forms
| GET | `/form-requests` | — | `[{ id, status(pending\|scheduled\|submitted\|reviewed), requested_at, submitted_at, scheduled_at, form_title_en/ar, form_description_en/ar }]` |
| GET | `/form-requests/:request_id` | — | `{ ...request, questions[], responses[] }`; question types: `text, textarea, number, scale, select, multiselect` |
| POST | `/form-requests/:request_id/submit` | `{ answers:[{question_id, answer}] }` | `{ success }` |

### Messages
| GET | `/messages` | — | `{ thread, messages:[{id, sender_type(client\|team), body, created_at, read_*}], coachName }`; auto-marks team msgs read |
| POST | `/messages` | `{ body }` (≤5000) | created message |

> Web polls `/messages` every 5s. Backend TS module mentions a real-time socket event on send — mobile should prefer the socket if available, fall back to polling.

### Gaps to add for mobile (new, additive — see §12)
- `POST /client-portal/login` returning a **bearer token in the JSON body** (not only the cookie), or a dedicated `/client-portal/token` exchange.
- `GET /client-portal/workspace?slug=` → resolve slug to `{ name, logo, brand_color }` for a branded login (mobile has no subdomain).
- `POST /client-portal/push-tokens` / `DELETE` → register FCM/APNs device tokens for notifications.

---

## 2 — Tech Stack (Flutter)

| Layer | Choice | Why |
|---|---|---|
| Framework | **Flutter (stable)**, Dart 3, null-safe | Single codebase iOS+Android; native perf for the training-mode timers/animations. |
| State mgmt | **Riverpod v2** (`flutter_riverpod` + `riverpod_generator`) | Compile-safe DI, async providers map 1:1 to the portal's "load → loading/empty/error/data" pattern. |
| Routing | **go_router** | Declarative, deep-link & auth-redirect friendly (mirrors the web `PROTECTED` guard). |
| HTTP | **dio** + interceptors | Base URL, auth header injection, 401 refresh/redirect, retry — the parallel of `lib/axios.js`. |
| Models | **freezed** + **json_serializable** | Immutable models + generated `fromJson` for the nested plan trees. |
| Local storage | **flutter_secure_storage** (token) + **shared_preferences** (prefs) + **Hive/Isar** (offline session draft, cache) | Secure token; Hive replaces the web's `localStorage` for the in-progress training session. |
| i18n | **flutter_localizations** + **slang** (or ARB + gen_l10n) | EN/AR with **full RTL**; reuse the existing `portal.*` keys. |
| Charts | **fl_chart** | Replaces `components/charts/LineChart.js` for progress. |
| Video | **youtube_player_flutter** + **video_player** | YouTube embeds + uploaded `video_path` exercise demos. |
| Push | **firebase_messaging** (+ APNs) + **flutter_local_notifications** | Notifications tab + chat/forms alerts. |
| Realtime | **socket_io_client** | Live chat to match the backend socket; polling fallback. |
| Theming | Material 3 `ThemeData` light/dark + brand tokens | Mirror the web design tokens (primary, radius, muted, etc.). |
| Testing | `flutter_test`, `mocktail`, `patrol`/`integration_test` | Unit + widget + e2e. |
| CI/CD | GitHub Actions + **Fastlane**; **Codemagic** optional | Build, sign, ship to TestFlight/Play. |
| Crash/analytics | Firebase Crashlytics + Analytics (or Sentry) | Field diagnostics. |

**Min OS:** iOS 13+, Android 8 (API 26)+.

---

## 3 — Architecture

Feature-first, layered — the Dart parallel of the backend's `modules/` discipline. Dependencies point downward only.

```
lib/
├── main.dart                      # bootstrap: env, DI scope, run app
├── app.dart                       # MaterialApp.router, theme, locale, go_router
├── core/
│   ├── config/                    # env (flavors: dev/staging/prod), constants — the ONLY place reading env
│   ├── network/
│   │   ├── dio_client.dart        # base url, interceptors (auth header, 401 → logout, logging)
│   │   └── api_exception.dart     # one error shape, parsed from {message}/{error}
│   ├── auth/
│   │   ├── auth_controller.dart   # session state: unknown → authed/unauthed
│   │   ├── auth_repository.dart   # login/logout/me, token persistence
│   │   └── token_storage.dart     # secure storage wrapper
│   ├── router/                    # go_router + redirect guard (mirrors web PROTECTED list)
│   ├── theme/                     # colors, typography, radii, light/dark — design tokens
│   ├── i18n/                      # generated localizations, locale controller, RTL helpers
│   └── widgets/                   # shared: AppScaffold, EmptyState, LoadingSkeleton, ErrorView,
│                                  #         CollapsibleNote, PillTabs, MacroChips, BottomTabBar
├── features/
│   ├── shell/                     # bottom nav + top app bar (ClientPortalNav parallel)
│   ├── home/
│   ├── nutrition/                 # plan view, cycle tabs, meals, macros donut, shopping list
│   ├── training/                  # plan view + day tabs + exercise cards + video
│   ├── training_session/          # Training Mode: live logging, rest timer, persistence
│   ├── training_history/          # list + detail
│   ├── training_progress/         # exercise picker + metric toggle + chart
│   ├── forms/                     # list + dynamic form renderer + submit
│   ├── messages/                  # chat thread (socket + polling)
│   ├── profile/                   # identity, theme, language, logout
│   └── notifications/             # list (when backend ready)
└── shared/
    ├── models/                    # freezed models for every API shape (§5)
    └── utils/                     # nutritionCalc.dart, workout.dart, localization.dart (ports)
```

**Each feature folder** = `*_page.dart` (UI) + `*_controller.dart`/providers (state) + `*_repository.dart` (API). One feature never imports another feature's internals; shared logic drops to `core/` or `shared/`.

**Ports of pure web logic** (translate 1:1, keep names):
- `lib/nutritionCalc.js` → `shared/utils/nutrition_calc.dart` (`calcItem`, `calcMeal`, `calcCycle`).
- `utils/workout.js` → `shared/utils/workout.dart` (`formatDuration`, `totalVolume`, `completedSetCount`).
- `utils/localization.js` (`getLocalizedField`) → `shared/utils/localization.dart`.
- `lib/coachSlug.js` slug logic → only the validation part is reused; subdomain logic is replaced by explicit workspace entry (§4).

---

## 4 — Auth & Tenancy (the key mobile adaptation)

**The problem:** the web identifies the workspace by **subdomain** (`acme.fitforce.app` → slug `acme`) and authenticates with an **httpOnly cookie**. A mobile app has neither a subdomain nor good cookie ergonomics.

**The solution:**

1. **Workspace selection is explicit.** First launch shows a **workspace step**: the client enters their coach's workspace slug *or* opens a deep link / scans a QR / taps an invite link (`fitforcex://w/<slug>` or a universal link). We resolve it via the new `GET /client-portal/workspace?slug=` to show a **branded login** (coach name + logo) — the parallel of the web showing `Portal: {slug}`. Persist the slug in secure storage (parallel of `localStorage.setItem('portal_slug')`).
2. **Token auth instead of cookies.** Send credentials to `/login`; backend returns a **bearer JWT in the body** (additive change, §12). Store it in `flutter_secure_storage`. Dio interceptor attaches `Authorization: Bearer <token>` to every request. (Backend `clientAuth` middleware already accepts Bearer per `CLAUDE.md` §4 — verify it reads the header, else add it.)
3. **Auth state machine** (`auth_controller`): `unknown → checking (/me) → authenticated | unauthenticated`. go_router redirect sends unauthenticated users to the workspace/login flow — the parallel of `layout.js` redirecting to `/portal`.
4. **Session expiry:** on any `401`, clear token + bounce to login (parallel of axios catch → `router.push('/portal')`).
5. **Logout:** call `/logout`, clear secure storage, reset providers, route to login.

> **Decision to confirm with backend owner:** add body-token to `/login` vs. a separate `/token` endpoint. Until then, the app can technically use a cookie jar (`dio_cookie_manager`) as a stopgap, but bearer is the target.

---

## 5 — Data Models (freezed)

One model per API shape, generated `fromJson`. Mirror server field names (snake_case JSON → keep snake in `@JsonKey`).

- **Client**: id, fname, lname, email, phone, clientCode, workspaceId.
- **Workspace** (login branding): slug, name, logoUrl, brandColor.
- **NutritionPlan** → `Cycle` (name, goals, note, meals) → `Meal` (name, note, items) → `MealItem` (name/nameAr, amount, servingUnit, per-serving macros, alternatives) → `Alternative`.
- **TrainingPlan** → `TrainingDay` (name, notes, exercises) → `Exercise` (name, muscleGroup, equipment, thumbnailPath, videoPath, youtubeUrl, instructionsEn/Ar, sets, alternatives) → `ExerciseSet` (reps, restSeconds, tempo, rir) + `ExerciseAlternative`.
- **WorkoutSession** (in-progress, Hive-persisted): planId, dayId, dayIndex, dayName, startedAt, exercises[{exerciseId, exerciseLibraryId, name, prescribed[], note, sets[{setOrder, weight, reps, rir, restSeconds, completed}]}]. — port of `buildSession()`.
- **WorkoutLogSummary** + **WorkoutLogDetail**.
- **ProgressPoint**: date, topWeight, est1rm, totalVolume.
- **FormRequest** (status enum), **FormQuestion** (type enum, options/optionsAr, min/max, required), **FormResponse**.
- **Message** (senderType enum, body, createdAt, read flags), **Thread**.

Localized fields use a `localized(field, locale)` helper (port of `getLocalizedField`): pick `_ar` when locale==ar and non-empty, else `_en`/base.

---

## 6 — Feature-by-Feature Plan

Each below lists: **flow**, **API**, **UI parity notes**, **edge/empty/error states** (the portal is meticulous about these — match them).

### 6.1 Shell & Navigation
- **Top bar:** profile avatar (initials, ring when active) · centered logo (theme-aware) · notifications bell. — `ClientPortalNav` header.
- **Bottom tab bar:** Home · Nutrition · Training · Forms · Messages (5 items). Profile + Notifications reached from the top bar.
- Active-state logic: exact-match for Home/Nutrition, prefix-match for the rest.
- Use `StatefulShellRoute` (go_router) so each tab keeps its own nav stack.

### 6.2 Login / Workspace
- Workspace step → branded login (email, password) → on success route to Home.
- "Already authenticated" check on launch (call `/me`) — splash while checking.
- Errors surface inline (invalid credentials, account not activated, workspace required). Login is rate-limited server-side — handle `429`.

### 6.3 Home
- Currently a placeholder ("coming soon"). Build the placeholder now; design a real dashboard later (next-plan summary, today's workout, pending forms count, unread messages). Keep it a thin screen.

### 6.4 Nutrition
- Load `/active-plan` (+ `/me`). States: loading skeleton · `404`/empty → "no active plan" card · data.
- **Sticky header:** plan name + **MacrosDonut** (carbs/protein/fats/kcal) computed via `nutrition_calc.dart`. Donut hidden when macros are zero.
- **Cycle tabs:** horizontal scrollable pills with edge-fade + chevrons; RTL-aware. (In Flutter use a scrollable `Row`/`ListView` with fade; chevrons optional on mobile.)
- **Coach note** (cycle-level): collapsible amber card, first line preview.
- **Meals:** expandable cards; header shows item count + meal macro totals; expanded body shows items with checkbox (strike-through when checked, local-only "shopping check"), per-item macros, amount+unit, and **alternatives** (indented).
- **Shopping list:** floating button → bottom sheet (`ShoppingListDrawer` parallel) aggregating items across the plan, checkable.
- RTL: macro string order flips (`C 25g` ↔ `25g ك`).

### 6.5 Training (plan view)
- Load `/active-training-plan`. States like nutrition.
- **Day tabs** (scrollable pills, RTL-aware).
- **Action row:** **Start Training** (primary, → session) · History (icon) · Progress (icon). Shown only when the active day has exercises.
- **Plan note** (amber) + **Day note** (primary) collapsibles.
- **Exercise cards:** index badge, thumbnail (fallback icon, broken-image handling), name, muscle-group/equipment chips, **Watch video** toggle → inline YouTube embed or `video_player` for uploaded `video_path`; notes + localized instructions; **sets grid** (set/reps/rest/tempo/rir); **alternatives** list with thumbnails.

### 6.6 Training Mode (session) — the most complex screen
Port of `training/session/page.js` + `ExerciseLogCard` + `RestTimerBar`.
- **Resume/build:** load active plan + `/workout-logs/previous?day_id=`; if a Hive-saved session matches `day_id`, **resume** it, else `buildSession()`.
- **Persist on every change** to Hive (parallel of `localStorage` write) so app-kill/restart resumes.
- **Per-exercise card:** prescribed vs. actual sets; editable weight/reps/rir; "previous" values shown as hints; add/remove set; per-exercise note.
- **Set completion** toggles a checkbox; completing measures **actual rest** since the previous set and starts the **RestTimerBar** (countdown, +15s/+30s, skip). Default rest 90s.
- **Sticky header:** discard (trash) · day name + **elapsed clock** (1s tick) + **total volume** · **Finish** (flag).
- **Finish:** POST `/workout-logs` with mapped numeric fields; clear Hive; route to history. Confirm dialog when zero completed sets. Discard → confirm → clear → back.
- Edge cases: day has no exercises → redirect back; `404` plan → back; save failure → alert, keep session.
- Use a single `Timer.periodic(1s)` driving both elapsed + rest, like the web `now` tick. Keep wall-clock reads out of build.

### 6.7 Training History
- Load `/workout-logs`. Empty state. List cards: day name, date (localized), duration, volume, sets → tap → detail (`/workout-logs/:id`) showing per-exercise sets.

### 6.8 Training Progress
- `/workout-logs/exercises` → exercise picker pills (default first).
- `/workout-logs/exercise-progress` → series; **metric toggle**: Top Weight · Est. 1RM · Volume.
- **fl_chart** line chart (port of `LineChart.js`), localized date labels. Empty states for no-exercises / no-logs-for-exercise.

### 6.9 Forms
- `/form-requests` → filter pills **Pending / Submitted** (submitted includes `reviewed`); pending count chip.
- Card per request: title/desc (localized), status chip (pending/scheduled/submitted), CTA (Fill / view answers / "not open yet" for scheduled).
- **Fill screen** (`/form-requests/:id`): dynamic renderer for `text, textarea, number, scale(slider), select, multiselect(checkbox CSV)`; localized labels/placeholders/options; required validation; submitted forms render **read-only** with answers prefilled and an "already submitted" banner. Submit → POST → back to list.

### 6.10 Messages
- `/messages` (auto-creates thread, marks team read). Render WhatsApp-style: date separators, sender grouping within 5-min window, bubble tails, time stamps.
- Send via POST `/messages`; optimistic append.
- **Realtime:** connect `socket_io_client` to the workspace room (same JWT) for live receive; **fall back to 5s polling** when socket unavailable. Auto-scroll to bottom on new messages. Empty state.

### 6.11 Profile
- Identity (avatar initials, name, email, `#client_code`).
- **Preferences:** Appearance (theme toggle: light/dark/system) · Language (EN/AR switcher → triggers RTL).
- **Logout** with confirm modal → `/logout`.

### 6.12 Notifications
- Placeholder now ("coming soon"), matching web. Wire to push + an in-app list once `notifications` endpoints + `push-tokens` exist (§12).

---

## 7 — Cross-Cutting Concerns

### i18n & RTL
- Two locales: **en**, **ar**. Reuse the existing `portal.*` keys from `client/messages/{en,ar}.json` — convert to ARB/slang once; keep keys identical so copy stays in sync.
- Full **RTL** layout via `Directionality` driven by locale (Arabic). Use logical `EdgeInsetsDirectional`, `start/end`, and flip macro/chevron ordering exactly as the web does.
- Persist chosen locale in `shared_preferences`.

### Theming
- Material 3 light/dark themes built from the web design tokens (primary, secondary, muted, border, radius scale, foreground). Theme-aware logo asset (dark/light). Honor system theme + manual override.

### Networking & errors
- Dio interceptors: base URL (per flavor), bearer auth header, request/response logging (dev only), unified `ApiException` from `{message}`/`{error}`, global `401 → logout`.
- One reusable async-UI pattern: `AsyncValue` (Riverpod) → `loading` skeleton / `error` view / `data`. Mirror the portal's skeleton placeholders.

### Offline & resilience
- Training session draft in Hive (must survive offline & app-kill).
- Cache last-fetched plans (nutrition/training) so the app opens instantly and works read-only offline; revalidate on focus.
- Queue a workout-log POST for retry if offline at finish.

### Push notifications
- Firebase Messaging (Android) + APNs (iOS). Register device token via new `push-tokens` endpoint. Notification types: new coach message, new/Scheduled form opened, plan updated. Deep-link taps into the right screen.

### Media
- Exercise thumbnails/videos served from object storage (`toPublicUrl`); handle broken images and the `NEXT_PUBLIC_API_URL`-prefixed `video_path` (mobile uses the API base URL).

### Security
- Token in secure storage only; never logged. Certificate pinning (optional, prod). Obfuscate release builds. No secrets in the repo — use `--dart-define` / flavor configs.

---

## 8 — Project Structure & Tooling

- **Flavors:** `dev`, `staging`, `prod` (different API base URL, app id suffix, app name). `--dart-define-from-file` per flavor.
- **Repo location:** new top-level `mobile/` folder in this monorepo (sibling to `client/` and `server/`).
- **Lint:** `flutter_lints` + custom analysis_options (strict). Format with `dart format` in CI.
- **Codegen:** `build_runner` for freezed/json/riverpod; commit generated files or run in CI (decide once).
- **Env contract:** `mobile/.env.example` documenting `API_BASE_URL`, `ROOT_API`, Firebase keys.

---

## 9 — Phased Roadmap

> Each phase ends with a runnable, testable build. Order front-loads the auth spine and the highest-value flows (nutrition + training), matching how the portal proved itself.

> **Status (live):** Phase 0 ✅ · Phase 1 ✅ · Phase 2 ✅ (nutrition) · Phase 3 ✅ (training) · Phase 4 ✅ (Training Mode) · Phase 5 ✅ (forms) · Phase 6 ✅ (messages) · Phase 7 🟡 (real Home dashboard done; **push + notifications list blocked** on backend changes #3/#4 + a Firebase project) — verified with `flutter analyze` + tests green (45 tests) + debug APK builds. Chat uses 5s polling (socket is a follow-up); session draft via shared_preferences; charts via CustomPainter.

**Phase 0 — Spine (no features)** ✅
- Flutter project, flavors, theme tokens, i18n scaffold (EN/AR + RTL), go_router with auth redirect, dio client + interceptors, secure token storage, `AsyncValue` UI pattern, shared widgets (EmptyState, Skeleton, ErrorView, CollapsibleNote, PillTabs), CI build green.
- **Backend coordination:** confirm/add bearer-token login + `workspace?slug=` (§12).
- Exit: app boots → splash → login → `/me` → empty Home shell with bottom tabs.

**Phase 1 — Auth & Shell** ✅ (incl. backend bearer login + workspace lookup + branded login + deep links)
- Workspace selection (manual + deep link), branded login, `/me`, logout, profile screen (theme + language + logout), session expiry handling.
- Exit: full auth loop + profile working in both locales.

**Phase 2 — Nutrition** ✅
- `/active-plan` model + screen: macros donut, cycle tabs, collapsible notes, expandable meals, alternatives, shopping-list sheet. `nutrition_calc.dart` port + unit tests.
- Exit: nutrition parity with web, RTL verified.

**Phase 3 — Training plan view** ✅
- `/active-training-plan` model + screen: day tabs, notes, exercise cards, chips, sets grid, alternatives, inline video (YouTube + uploaded).
- Exit: training plan parity.

**Phase 4 — Training Mode (session) + History + Progress** ✅
- Session screen with live logging, rest timer, Hive persistence/resume, finish→POST. History list+detail. Progress picker + fl_chart + metric toggle. `workout.dart` port + tests.
- Exit: the full train→log→review→progress loop works offline-resilient.

**Phase 5 — Forms** ✅
- List + filters + dynamic renderer (all 6 question types) + validation + submit + read-only submitted view.
- Exit: forms parity.

**Phase 6 — Messages** ✅ (polling; socket realtime is a follow-up)
- Chat thread, grouping/date separators, send, polling; then socket realtime with polling fallback.
- Exit: chat parity + live updates.

**Phase 7 — Notifications & polish**
- Push registration + notification list + deep links (pending backend). Real Home dashboard. Empty/error-state pass, animations, accessibility, app icons/splash.
- Exit: store-ready.

**Phase 8 — Release**
- App Store + Play setup, Fastlane lanes, TestFlight/internal track, crash/analytics, store listings, privacy manifests.

---

## 10 — Testing Strategy

- **Unit:** `nutrition_calc.dart`, `workout.dart`, `localization.dart`, slug validation, model `fromJson` round-trips, auth state machine.
- **Widget:** each screen's loading/empty/error/data states; form renderer per question type; training-mode set toggle + rest timer logic; RTL rendering.
- **Integration (patrol/integration_test):** login → load plans → run a training session → finish → see it in history; submit a form; send a message.
- **Golden tests** for key screens in EN + AR (light/dark) to lock visual parity.
- Coverage targets: utils 90%, controllers/repos 85%, screens (smoke) 70%.

---

## 11 — CI/CD & Release

- **GitHub Actions:** `flutter analyze` + `dart format --set-exit-if-changed` + `flutter test` on PR; build artifacts on `main`.
- **Fastlane:** `beta` (TestFlight + Play internal) and `release` lanes; match/keystore for signing (secrets in CI, never repo).
- Versioning: semantic `x.y.z+build`; tag releases.
- Staging flavor points at the staging API; smoke-test before promoting prod.

---

## 12 — Backend Changes Required (additive only)

Track these as backend tickets; the app is blocked on (1) and degraded without (2)–(3).

1. **Bearer token on login** — return `{ token }` in `/client-portal/login` body (keep cookie for web). Confirm `clientAuth` middleware accepts `Authorization: Bearer`.
2. **Workspace lookup** — `GET /client-portal/workspace?slug=` → `{ name, logoUrl, brandColor }` for branded mobile login (no subdomain).
3. **Push tokens** — `POST/DELETE /client-portal/push-tokens` to register device tokens; emit pushes on new message / form opened / plan updated.
4. *(Later)* **Notifications list** — `GET /client-portal/notifications` + read-state, to fill the Notifications tab.
5. Confirm CORS / no cookie-domain assumptions break token auth from a mobile origin.

---

## 13 — Open Decisions (resolve before/early in Phase 0)

- **Bearer vs. cookie jar** for auth transport (recommend bearer).
- **Workspace onboarding UX:** manual slug entry vs. invite deep-link/QR primary path (recommend deep-link primary, manual fallback).
- **Codegen committed or CI-generated.**
- **Realtime now or polling-first** for chat (recommend polling in Phase 6.0, socket in 6.1).
- **slang vs. gen_l10n** for i18n.
- **Firebase vs. Sentry** for crash reporting.

---

## 14 — Parity Checklist (definition of done per flow)

A flow is "done" when, in **both EN and AR (light + dark)**, it matches the web portal on: loading skeleton · empty state · error/`404` handling · the data layout · all interactive states (tabs, collapsibles, toggles, checkboxes) · localized + RTL formatting · and it uses the same API contract with no client-side data leaks across workspaces.
