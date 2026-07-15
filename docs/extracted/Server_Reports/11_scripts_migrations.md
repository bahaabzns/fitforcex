# Phase 11: Scripts & Migrations — Deep Review

**Date:** 2026-07-14
**Scope:** src/scripts/ (18 files, 4,524 lines), scripts/ (9 files, 1,369 lines), migrations/ (45 files)
**Score: GOOD** (3.5/5) — Comprehensive migration history with data backfills, but no rollback scripts

---

## 1. SCRIPTS OVERVIEW

### 1.1 TS Scripts (src/scripts/, 18 files, 4,524 lines)

| Script | Lines | Purpose |
|--------|-------|---------|
| `migrate.ts` | 864 | Main DB migration runner |
| `seed-full-clients.ts` | 590 | Full client seeding |
| `seed-exercises.ts` | 319 | Exercise library seeding |
| `seed-plans-queue.ts` | 296 | Plans queue seeding |
| `seed-default-libraries.ts` | 259 | Default master library seeding |
| `verify.ts` | 249 | Data verification |
| `migrate-phase3.ts` | 261 | Phase 3 data migration |
| `migrate-phase2.ts` | 240 | Phase 2 data migration |
| `migrate-queue.ts` | 204 | Queue migration |
| `seed-transactions.ts` | 192 | Transaction seeding |
| `patch-question-labels.ts` | 128 | Question label patching |
| `backfill-package-variation-ids.ts` | 127 | Package variation ID backfill |
| `seed-nutrition.ts` | 105 | Nutrition data seeding |
| `seed-clients.ts` | 102 | Basic client seeding |
| `patch-transactions.ts` | 95 | Transaction patching |
| `inspect-old-forms.ts` | 68 | Old forms inspection |
| `migrate-add-queue-assignee.ts` | 33 | Add queue assignee |
| `seed-chats-forms.ts` | 392 | Chat and forms seeding |

### 1.2 JS Scripts (scripts/, 9 files, 1,369 lines)

| Script | Lines | Purpose |
|--------|-------|---------|
| `migrate.js` | 561 | Legacy DB migration runner |
| `patch-db.js` | 324 | Legacy DB patching |
| `seed-library.js` | 211 | Legacy library seeding |
| `reset-dev-db.js` | 74 | Dev DB reset |
| `migrateUploadsToS3.ts` | 65 | S3 upload migration |
| `seed-admin.js` | 57 | Admin seeding |
| `fix-migrations.js` | 40 | Migration repair |
| `migrate019.js` | 37 | Specific migration |

---

## 2. MIGRATION HISTORY — Score: **Very Good**

### 2.1 45 Migrations (node-pg-migrate)

| Range | Focus |
|-------|-------|
| 001-009 | Baseline — core tables, plans, billing |
| 010-016 | User features — created_by, email verification, messaging |
| 017-021 | Observations & fixes — client observations, PK fixes |
| 022-026 | Libraries & policies — default libraries, subscription policies |
| 027-031 | Enrichment — observation enrichment, package variation FK |
| 032-037 | Package lifecycle — check-in schedules, form versions |
| 038-042 | Hardening — cascade hardening, drop old form_questions |
| 043-045 | Latest — question lineage, messenger attachments |

### 2.2 Quality

**Good:**
- Sequential numbering
- Descriptive names
- Data backfills paired with schema changes
- Cascade hardening in migration 038

**Issues:**
1. **No rollback scripts** — Only `migrate:down` (sequential)
2. **Some migrations mix schema + data** — Harder to reason about

---

## 3. SEED DATA — Score: **Good**

### 3.1 Seed Scripts

| Script | Purpose |
|--------|---------|
| `seed-exercises.ts` | Exercise library (319 lines) |
| `seed-foods.ts` | Food items |
| `seed-forms.ts` | Form templates |
| `seed-admin.ts` | Admin user |
| `seed-workspace-sub.ts` | Workspace subscription |

**Quality:** Comprehensive seed data for development.

---

## 4. ISSUES

| # | Issue | Severity |
|---|-------|----------|
| 1 | **No per-migration rollback** | MEDIUM |
| 2 | **Dual migration systems** (Prisma + node-pg-migrate) | MEDIUM |
| 3 | **Legacy JS scripts coexist with TS** | LOW |

---

## 5. WHAT'S WELL DONE

1. **45 sequential migrations** — Well-organized migration history.
2. **Data backfills** — Schema changes paired with data migrations.
3. **Comprehensive seed data** — Exercises, foods, forms, admin.
4. **Verification scripts** — `verify.ts` checks data integrity.
5. **Phase-specific migrations** — `migrate-phase2.ts`, `migrate-phase3.ts`.

---

*Report generated: 2026-07-14 | Next: Phase 12 — Testing*
