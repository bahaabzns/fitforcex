# Phase 2: Database Schema & Migrations — Deep Review

**Date:** 2026-07-14
**Scope:** Prisma schema (43 models), migrations (45 files), index strategy, naming conventions
**Score: VERY GOOD** (4.0/5) — Excellent schema design with documented patterns, but dual migration systems and string-based enums

---

## 1. SCHEMA OVERVIEW — Score: **Very Good**

### 1.1 Model Count

**43 models** across 10 domains:

| Domain | Models | Key Tables |
|--------|--------|------------|
| Auth/Users | 4 | `users`, `admins`, `user_sessions`, `password_reset_tokens` |
| Workspaces | 6 | `workspaces`, `workspace_members`, `workspace_invitations`, `workspace_audit_log`, `workspace_payments`, `workspace_subscriptions` |
| Clients | 4 | `clients`, `client_measurements`, `client_photos`, `client_observations` |
| Plans | 3 | `plans`, `plan_period_links`, `billing_discounts` |
| Nutrition | 6 | `nutrition_plans`, `nutrition_cycles`, `nutrition_meals`, `nutrition_meal_items`, `nutrition_meal_item_alternatives`, `food_items`, `food_categories` |
| Training | 6 | `training_plans`, `training_days`, `training_exercises`, `training_sets`, `training_exercise_alternatives`, `exercise_library` |
| Forms | 6 | `forms`, `form_versions`, `form_version_questions`, `form_requests`, `form_responses`, `metrics` |
| Master Libraries | 5 | `master_exercise_library`, `master_exercise_muscle_groups`, `master_exercise_equipments`, `master_food_items`, `master_food_categories`, `master_forms`, `master_form_questions` |
| Packages/Billing | 5 | `packages`, `package_variations`, `package_default_forms`, `transactions`, `subscription_access_policies`, `subscription_status_audit`, `subscription_freezes` |
| Messaging/Notifications | 3 | `threads`, `messages`, `notifications` |
| Scheduling | 1 | `check_in_schedules` |
| Other | 3 | `payment_methods`, `pdf_settings`, `pgmigrations` |

### 1.2 Schema Documentation

**Excellent:** The schema has extensive inline comments explaining:
- Why certain columns exist (e.g., `form_request_id` in `check_in_schedules`)
- Why relations are not modeled (e.g., `check_in_schedules` FKs)
- Deprecation status (e.g., `form_questions` superseded by `form_versions`)
- Migration context (e.g., `observation_relations` replacing single FK columns)

---

## 2. RELATION DESIGN — Score: **Very Good**

### 2.1 Cascade Strategy

| Pattern | Usage | Verdict |
|---------|-------|---------|
| `onDelete: Cascade` | Most parent→child (workspace→clients, plan→days) | Correct |
| `onDelete: SetNull` | Optional FKs (client→package_variation, form→version) | Correct |
| `onDelete: Restrict` | forms→form_requests (prevent form deletion if requests exist) | Correct |
| `onUpdate: NoAction` | Universal | Correct (no UUID updates) |

**Quality:** Cascade deletes are well-thought-out. `Restrict` on `forms` prevents accidental data loss. `SetNull` on optional FKs preserves records.

### 2.2 Junction Tables

| Junction | Purpose | Quality |
|----------|---------|---------|
| `observation_relations` | Links observations to exercises/foods/forms | Excellent — replaces single-FK columns |
| `workspace_members` | Users ↔ Workspaces with role + permissions | Excellent |
| `workspace_invitations` | Invitation workflow | Good |
| `plan_period_links` | Plans ↔ Billing discounts | Good |

### 2.3 Multi-Tenancy

Every workspace-scoped table has:
- `workspace_id` foreign key
- `onDelete: Cascade` from workspace
- Index on `workspace_id`

**Excellent:** Consistent multi-tenancy pattern across all 20+ workspace-scoped tables.

---

## 3. INDEX STRATEGY — Score: **Very Good**

### 3.1 Index Coverage

| Table | Indexes | Quality |
|-------|---------|---------|
| `client_observations` | 7 | Excellent — composite index for feed query |
| `notifications` | 2 | Good — recipient + workspace |
| `training_plans` | 2 | Good — client + composite |
| `workout_logs` | 4 | Excellent — client+date, client, plan, workspace |
| `workspace_members` | 2 | Good — user + workspace |
| `form_version_questions` | 3 | Good — version + metric + lineage |

### 3.2 Composite Indexes

```prisma
@@index([client_id, deleted_at, created_at(sort: Desc)], map: "idx_observations_client_feed")
@@index([recipient_type, recipient_id, read_at, created_at(sort: Desc)], map: "idx_notifications_recipient")
@@index([workspace_id, client_code], map: "clients_coach_id_client_code_key")
```

**Excellent:** Composite indexes are designed for actual query patterns (feed queries, notification lookups).

### 3.3 Missing Indexes

| Table | Missing Index | Impact |
|-------|---------------|--------|
| `messages` | `[thread_id, created_at]` | Message list queries sort by date |
| `nutrition_plans` | `[workspace_id, client_id]` | Plan listing per client |
| `form_requests` | `[workspace_id, status]` | Queue queries filter by status |
| `transactions` | `[workspace_id, transaction_date]` | Transaction list sorted by date |

---

## 4. MIGRATION SYSTEM — Score: **Fair**

### 4.1 Dual Migration Systems

| System | Scope | Files |
|--------|-------|-------|
| Prisma Migrate | Schema sync | `prisma/migrations/` (1 lock file) |
| node-pg-migrate | Data migrations | `migrations/` (45 files) |

**Issue:** Two migration systems running simultaneously. Prisma manages schema structure; node-pg-migrate manages data migrations and some schema changes. This creates confusion about which system is authoritative.

### 4.2 Migration Quality

**Good:**
- Migrations are numbered and sequential (001-045)
- Each migration has a descriptive name
- Data backfills are paired with schema changes (e.g., `035_form_versions_schema.js` + `036_form_versions_backfill.js`)
- Cascade hardening in `038_cascade_hardening.js`

**Issues:**
1. **`schema.sql` (2,145 lines) is superseded by Prisma** — Should be removed or marked as reference-only
2. **No rollback scripts** — Only `migrate:down` (sequential rollback), no per-migration rollback
3. **Some migrations mix schema + data** — Harder to reason about

### 4.3 Migration Naming

```
001_baseline.js
002_add_trial_days.js
...
035_form_versions_schema.js
036_form_versions_backfill.js
...
045_messenger_attachments.js
```

**Good:** Consistent naming convention. Schema changes prefixed with topic, data migrations suffixed with `_backfill`.

---

## 5. ENUM HANDLING — Score: **Fair**

### 5.1 String-Based Enums

**All status/type fields use `String` instead of Prisma `enum`:**

| Field | Values | Should Be Enum |
|-------|--------|----------------|
| `clients.subscription_status` | "Active", "Expired", "Frozen" | Yes |
| `training_plans.status` | "inactive", "active", "completed" | Yes |
| `nutrition_plans.status` | "draft", "active" | Yes |
| `forms.status` | "draft", "active" | Yes |
| `forms.form_type` | "assessment", "check-in" | Yes |
| `threads.status` | "open", "closed" | Yes |
| `messages.type` | "text", "image", "voice", "file" | Yes |
| `notifications.importance` | "info", "actionable", "alert" | Yes |
| `subscription_access_policies.scope` | "expired", "frozen" | Yes |
| `workspace_members.role` | "manager", "trainer", etc. | Yes |

**Issue:** Using `String` instead of `enum` loses type safety and allows invalid values. However, this may be intentional for flexibility (adding new values without migration).

### 5.2 Documentation as Constraints

The schema uses inline comments to document valid values:

```prisma
scope                      String // 'expired' | 'frozen'
actor_type                 String // 'coach' | 'system'
source_plan_type           String // 'nutrition' | 'training'
```

**Good:** Comments document intended values, even without formal enums.

---

## 6. SPECIAL PATTERNS — Score: **Excellent**

### 6.1 Master Library Clone Pattern

```
master_exercise_library → (clone on signup) → exercise_library
master_food_items → (clone on signup) → food_items
master_forms → (clone on signup) → forms
```

**Excellent:** Global master libraries are cloned into workspace-scoped tables on coach signup. This provides default data while allowing workspace customization.

### 6.2 Forms Versioning

```
forms → form_versions → form_version_questions
                    ↑ origin_question_id (lineage tracking)
```

**Excellent:** Full versioning system with:
- Version numbers (`version_number`)
- Sealing (`sealed_at` — NULL = editable draft)
- Question lineage (`origin_question_id` — tracks question identity across forks)
- Current version pointer (`forms.current_version_id`)

### 6.3 Subscription Access Policies

```
subscription_access_policies:
  workspace_id + package_id (NULL = global default)
  scope: 'expired' | 'frozen'
  10 boolean feature flags
  grace_period_days
```

**Excellent:** Granular per-package access control. Global defaults with package-level overrides.

### 6.4 Durable Notifications

```prisma
model notifications {
  recipient_type String  // 'user' | 'client'
  recipient_id   String
  type           String  // event key
  importance     String  // 'info' | 'actionable' | 'alert'
  entity_type    String?
  entity_id      String?
  actor_type     String?
  actor_id       String?
  metadata       Json?
  read_at        DateTime?
}
```

**Excellent:** Generic notification system that works for both users and clients. No FK constraints on recipient (allows hard-deletion).

---

## 7. CRITICAL ISSUES SUMMARY

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | **Dual migration systems** (Prisma + node-pg-migrate) | MEDIUM | Document which system is authoritative |
| 2 | **All enums are strings** | MEDIUM | Consider Prisma enums for type safety |
| 3 | **`schema.sql` superseded** | LOW | Remove or mark as reference |
| 4 | **Missing indexes on messages, nutrition_plans** | LOW | Add composite indexes |
| 5 | **No per-migration rollback** | LOW | Add rollback scripts |

---

## 8. WHAT'S WELL DONE

1. **43 models with comprehensive documentation** — Every model has inline comments explaining purpose and relationships.

2. **Consistent multi-tenancy** — Every workspace-scoped table has `workspace_id` + cascade delete.

3. **Master library clone pattern** — Global defaults cloned into workspace-scoped tables on signup.

4. **Forms versioning with lineage** — Question identity tracked across forks via `origin_question_id`.

5. **Subscription access policies** — Granular per-package feature gating with global defaults.

6. **Composite indexes designed for queries** — `idx_observations_client_feed`, `idx_notifications_recipient` match actual query patterns.

7. **Cascade strategy** — `Cascade`, `SetNull`, `Restrict` used appropriately based on data integrity needs.

8. **Durable notifications** — Generic system works for both users and clients without FK constraints.

9. **Audit trail** — `subscription_status_audit` and `workspace_audit_log` track all changes.

10. **Soft deletes** — `deleted_at` on clients, metrics, observations preserves data.

---

## 9. RECOMMENDED ACTIONS (Priority Order)

### Immediate
1. Add missing composite indexes (messages, nutrition_plans, form_requests, transactions)
2. Document which migration system is authoritative

### Short-term
3. Consider Prisma enums for status/type fields
4. Remove or deprecate `schema.sql`

### Medium-term
5. Add per-migration rollback scripts
6. Add `@@map` annotations for snake_case table names (currently implicit)

---

*Report generated: 2026-07-14 | Reviewer: Senior Code Reviewer | Next: Phase 3 — Express App & Middleware*
