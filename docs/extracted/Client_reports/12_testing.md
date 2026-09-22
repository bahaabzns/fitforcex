# Phase 12: Testing — Deep Review

**Date:** 2026-07-14
**Scope:** Unit tests, integration tests, test infrastructure, coverage
**Score: POOR** (1.5/5) — Server has solid test infrastructure with 28 files; client has only 2 unit tests and zero component/E2E tests

---

## 1. TEST INFRASTRUCTURE

### 1.1 Server — Jest + Supertest

| Aspect | Status |
|--------|--------|
| Framework | Jest (via ts-jest) |
| HTTP testing | Supertest |
| Config | `jest.config.ts` with coverage thresholds |
| Test runner | `npm test` (serial, `--runInBand`) |
| Coverage threshold | 70% lines, 70% functions, 60% branches |
| Test DB | `.env.test` via `dotenv -e .env.test` |
| Setup | `tests/helpers/setup.ts`, `testDb.ts`, `testServer.ts` |
| Organization | `tests/unit/` + `tests/integration/` |

### 1.2 Client — Vitest (Unconfigured)

| Aspect | Status |
|--------|--------|
| Framework | Vitest (in `devDependencies`) |
| Config file | **Missing** — no `vitest.config.js` or `vitest.config.ts` |
| Test runner | `npm test` → `vitest run` |
| Watch mode | `npm run test:watch` → `vitest` |
| Component testing | None |
| E2E testing | None (no Playwright, no Cypress) |

---

## 2. SERVER TESTS — Score: **Good**

### 2.1 Test Files (28 total)

**Unit tests (6):**
- `subscriptionPolicy.test.ts` — Subscription policy logic
- `workoutLogStats.test.ts` — Workout log statistics
- `cors.test.ts` — CORS configuration
- `planEngine.test.ts` — Plan engine logic
- `packages.serializer.test.ts` — Package serialization
- `auth.service.test.ts` — Auth service

**Integration tests (12):**
- `packageLifecycleRestart.test.ts` — Package lifecycle + restart
- `formsVersioningLifecycle.test.ts` — Forms versioning lifecycle
- `clientPortalAuth.test.ts` — Client portal auth flow
- `formsVersioning.test.ts` — Forms versioning
- `formsSaveDraftAndTrackAsMetric.test.ts` — Form save + metric tracking
- `clientArchiving.test.ts` — Client archiving
- `auth.test.ts` — Auth flow
- `libraryClone.test.ts` — Library clone
- `packageDefaultCheckinForms.test.ts` — Package default checkin forms
- `workoutLogs.test.ts` — Workout logs
- `messenger.test.ts` — Messenger
- `clientPortalNotifications.test.ts` — Client portal notifications
- `subscriptionPolicies.test.ts` — Subscription policies
- `notifications.test.ts` — Notifications

**Legacy JS tests (6):**
- `auth.test.js` — Auth (old format)
- `clientPortal.test.js` — Client portal (old format)
- `requireOwner.test.js` — Owner middleware
- `requirePermission.test.js` — Permission middleware
- `isolation.test.js` — Isolation tests
- `integration.test.js` — Integration tests

### 2.2 Quality

**Good:**
- Well-organized (unit/ + integration/)
- Proper test helpers (testDb, testServer, setup)
- Coverage thresholds enforced
- Serial execution (`--runInBand`) prevents DB conflicts
- Uses `.env.test` for test-specific config

**Issues:**
1. **Legacy JS tests coexist with TS tests** — 6 old `.js` tests alongside 18 new `.ts` tests
2. **No API contract tests** — Integration tests test flows, not API contracts
3. **No performance tests** — No load testing or benchmarks

---

## 3. CLIENT TESTS — Score: **Poor**

### 3.1 Test Files (2 total)

- `utils/date.test.js` — Tests `formatDate` and `formatDateTime` (English + Arabic)
- `lib/coachSlug.test.js` — Tests `getCoachSlugFromHost` and `buildPortalUrlFromParts`

### 3.2 Quality

The 2 existing tests are **well-written**:
- `date.test.js`: 8 test cases covering English/Arabic, edge cases (null, invalid), midnight/noon
- `coachSlug.test.js`: 11 test cases covering subdomain extraction, port stripping, edge cases

**But the coverage is abysmal:**
- 2 test files out of 213 JS files (0.9%)
- Zero component tests
- Zero hook tests
- Zero integration tests
- Zero E2E tests

### 3.3 Missing Tests

| Category | Files | Tests |
|----------|-------|-------|
| Components | 43 client components | **0** |
| Hooks | 10+ custom hooks | **0** |
| Pages | 62 pages | **0** |
| Utils | 5+ utility modules | **1** (`date.test.js`) |
| Lib | 2+ library modules | **1** (`coachSlug.test.js`) |
| E2E | All user flows | **0** |

### 3.4 Critical Untested Code

| Component | Lines | Risk |
|-----------|-------|------|
| `useNutritionPlan` | 1,117 | Highest — god hook, zero tests |
| `DataTable` | 791 | High — complex filtering/sorting |
| `useTrainingPlan` | 791 | High — builder logic |
| `LandingPricing` | 304 | Medium — payment flow |
| `useFormBuilder` | 437 | High — form builder logic |
| `Sidebar` | 227 | Medium — navigation + polling |
| `ClientPortalProvider` | 105 | High — auth context |

---

## 4. CRITICAL ISSUES SUMMARY

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 1 | **Client has 2 tests total** | CRITICAL | Zero confidence in UI changes |
| 2 | **No component tests** | CRITICAL | Components can break silently |
| 3 | **No E2E tests** | HIGH | User flows untested end-to-end |
| 4 | **No vitest.config.js** | MEDIUM | Vitest may use wrong config |
| 5 | **Legacy JS tests coexist with TS** | LOW | Inconsistent test patterns |

---

## 5. WHAT'S WELL DONE

1. **Server test infrastructure** — Jest + Supertest + test DB helpers. Production-grade setup.

2. **Server integration tests** — 12 integration tests covering critical flows: auth, forms versioning, client archiving, messenger, notifications.

3. **Server coverage thresholds** — 70% lines, 70% functions, 60% branches enforced.

4. **Existing client tests are high quality** — `date.test.js` and `coachSlug.test.js` are thorough with edge cases.

5. **Test organization** — Server tests are well-organized in `unit/` and `integration/` directories.

6. **Test helpers** — `testDb.ts`, `testServer.ts`, `setup.ts` provide reusable test infrastructure.

---

## 6. RECOMMENDED ACTIONS (Priority Order)

### Immediate
1. Add `vitest.config.js` to client
2. Add component tests for `DataTable`, `EmptyState`, `Stepper`
3. Add hook tests for `useNutritionPlan`, `useTrainingPlan`

### Short-term
4. Add E2E tests with Playwright for critical flows (login, client creation, form submission)
5. Add API contract tests for server routes
6. Migrate legacy JS tests to TS

### Medium-term
7. Add visual regression tests (Chromatic, Percy)
8. Add performance benchmarks
9. Target 50% client test coverage

---

*Report generated: 2026-07-14 | Reviewer: Senior Code Reviewer | Next: Phase 13 — Final Verdict*
