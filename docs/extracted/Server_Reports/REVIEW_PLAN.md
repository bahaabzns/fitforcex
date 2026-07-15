# FitForce X — Server Deep Review Plan

**Scope:** `server/` — Express + TypeScript + Prisma + PostgreSQL
**Date:** 2026-07-14
**Structure:** 13 phases, one report per phase

---

## Codebase Overview

| Area | Files | Lines |
|------|-------|-------|
| `src/modules/` (TS) | 70 | 14,189 |
| `src/middleware/` (TS) | 8 | 635 |
| `src/config/` (TS) | 2 | 153 |
| `src/types/` (TS) | 1 | 28 |
| `src/lib/` (TS) | 15 | 1,205 |
| `src/utils/` (TS) | 4 | 568 |
| `src/scripts/` (TS) | 18 | 4,524 |
| `routes/` (JS legacy) | 17 | 6,936 |
| `middleware/` (JS legacy) | 6 | 144 |
| `lib/` (JS legacy) | 6 | 517 |
| `utils/` (JS legacy) | 1 | 76 |
| `migrations/` | 45 | 1,725 |
| `scripts/` (legacy) | 9 | 1,369 |
| `prisma/` | 5 | 1,522 |
| `tests/` | 32 | 4,014 |
| **Total** | **~247** | **~39,842** |

---

## Phases

### Phase 1: Foundation & Configuration
**Files:** `package.json`, `tsconfig.json`, `jest.config.ts`, `nodemon.json`, `.node-pg-migraterc`, `src/config/env.ts`, `src/config/swagger.ts`
**Focus:** Dependency audit, config quality, env validation, build setup, Swagger config
**Score criteria:** Dependency hygiene, env validation, build reliability

### Phase 2: Database Schema & Migrations
**Files:** `prisma/schema.prisma`, `migrations/` (45 files), `schema.sql`, `src/scripts/migrate.ts`
**Focus:** Schema design, relation quality, index strategy, migration safety, naming conventions, documentation
**Score criteria:** Schema correctness, migration safety, index coverage

### Phase 3: Express App & Middleware
**Files:** `src/app.ts`, `src/server.ts`, `server.js`, `src/middleware/` (8 files), `middleware/` (6 files)
**Focus:** App composition, security stack (Helmet, CORS, rate limiting), error handling, graceful shutdown, middleware ordering
**Score criteria:** Security hardening, error handling, middleware quality

### Phase 4: Authentication & Authorization
**Files:** `src/modules/auth/`, `src/middleware/auth.ts`, `src/middleware/adminAuth.ts`, `src/middleware/clientAuth.ts`, `src/middleware/requireOwner.ts`, `src/middleware/requirePermission.ts`, `src/lib/defaultPermissions.ts`, `src/types/express.d.ts`, legacy `middleware/auth.js`, `middleware/adminAuth.js`, `middleware/clientAuth.js`
**Focus:** JWT flow, session management, RBAC, permission matrix, cookie config, password hashing, token refresh
**Score criteria:** Security completeness, session tracking, RBAC correctness

### Phase 5: Business Logic — Core Modules
**Files:** `src/modules/clients/`, `src/modules/training/`, `src/modules/nutrition/`, `src/modules/forms/`, `src/modules/workspaces/`, `src/modules/packages/`, `src/modules/plans/`
**Focus:** Controller quality, service extraction, query patterns, error handling, data validation, N+1 queries
**Score criteria:** Code organization, query efficiency, error handling

### Phase 6: Business Logic — Support Modules
**Files:** `src/modules/messenger/`, `src/modules/notifications/`, `src/modules/transactions/`, `src/modules/billing/`, `src/modules/subscriptionPolicies/`, `src/modules/invitations/`, `src/modules/metrics/`, `src/modules/paymentsWebhook/`, `src/modules/paymentMethods/`, `src/modules/dashboard/`, `src/modules/admin/`
**Focus:** Messenger architecture, notification system, payment integration, subscription lifecycle, admin tools
**Score criteria:** Feature completeness, integration quality, edge case handling

### Phase 7: Client Portal
**Files:** `src/modules/clientPortal/`, `src/middleware/clientAccessPolicy.ts`, `src/utils/subscriptionStatus.ts`, `src/utils/subscriptionPolicy.ts`, `src/lib/subscriptionPolicies/`
**Focus:** Portal auth flow, access policy engine, subscription gating, portal-specific controllers, feature isolation
**Score criteria:** Security isolation, access control correctness, portal completeness

### Phase 8: Shared Libraries
**Files:** `src/lib/` (15 files), `src/utils/` (4 files)
**Focus:** `planEngine.ts` (337 lines), `libraryClone.ts` (188 lines), `events.ts` (122 lines), `socket.ts` (64 lines), `storage.ts` (84 lines), `email.ts`, `fawaterak.ts`, `validate.ts`, `seatLimits.ts`, `prisma.ts`
**Score criteria:** Library quality, reusability, error handling, type safety

### Phase 9: Real-Time & File Handling
**Files:** `src/lib/socket.ts`, `src/lib/events.ts`, `src/lib/storage.ts`, `src/lib/formAttachments.ts`, `src/lib/messageAttachments.ts`, `src/lib/observationAttachments.ts`, `src/modules/messenger/`, `src/modules/notifications/`
**Focus:** Socket.IO setup, room management, event broadcasting, S3/R2 uploads, attachment handling, file validation
**Score criteria:** Real-time reliability, file security, upload robustness

### Phase 10: Scheduling & Cron Jobs
**Files:** `src/middleware/scheduler.ts` (346 lines), `src/modules/forms/` (form dispatcher), `src/modules/subscriptionPolicies/` (expiry), session cleanup, client status sync, check-in dispatch
**Focus:** Cron job reliability, idempotency, error handling, logging, race conditions, graceful degradation
**Score criteria:** Scheduler robustness, error recovery, monitoring

### Phase 11: Scripts & Migrations
**Files:** `src/scripts/` (18 files, 4,524 lines), `scripts/` (9 files, 1,369 lines)
**Focus:** Migration safety, seed data quality, data migration patterns, rollback support, script documentation
**Score criteria:** Migration safety, data integrity, script maintainability

### Phase 12: Testing
**Files:** `tests/` (32 files, 4,014 lines), `jest.config.ts`, `tests/helpers/`
**Focus:** Test coverage, test quality, integration test patterns, unit test patterns, test infrastructure, mocking strategy
**Score criteria:** Coverage depth, test reliability, infrastructure quality

### Phase 13: Final Verdict
**Files:** All
**Focus:** Overall assessment, cross-cutting concerns, security audit, performance analysis, prioritized recommendations
**Score criteria:** Production readiness, technical debt, security posture

---

## Scoring Scale

| Score | Grade | Meaning |
|-------|-------|---------|
| 1.0-1.5 | POOR | Critical issues, not production-ready |
| 2.0-2.5 | FAIR | Significant gaps, needs work before production |
| 3.0-3.5 | GOOD | Solid with some improvements needed |
| 4.0-4.5 | VERY GOOD | Production-ready with minor improvements |
| 5.0 | EXCELLENT | Best practices, no significant issues |

---

*Plan created: 2026-07-14*
