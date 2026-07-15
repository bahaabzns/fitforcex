# Phase 5: Business Logic — Core Modules — Deep Review

**Date:** 2026-07-14
**Scope:** clients, training, nutrition, forms, workspaces, packages, plans
**Score: GOOD** (3.5/5) — Feature-complete with good patterns, but critical N+1 queries and god controllers

---

## 1. MODULE OVERVIEW

| Module | Controller | Routes | Service | Endpoints | Total Lines |
|--------|-----------|--------|---------|-----------|-------------|
| clients | 1,320 | 368 | — | 22 | 1,688 |
| nutrition | 1,252 | 427 | 5 | 36 | 1,684 |
| forms | 1,078 | 275 | 234 | 20 | 1,637 |
| training | 733 | 262 | 22 | 18 | 1,017 |
| workspaces | 562 | 218 | — | 15 | 780 |
| packages | 274 | 65 | 72 | 4 | 411 |
| plans | 59 | 29 | — | 2 | 88 |

**Total: 5,278 lines across 7 modules, 117 endpoints**

---

## 2. N+1 QUERY ANALYSIS — Score: **Poor**

### 2.1 Critical: `training.getPlan()` and `nutrition.getPlan()`

Both modules have identical nested N+1 patterns:

```
getPlan()
├── Query 1: Get plan
├── Query 2: Get days/cycles
└── For each day/cycle:
    ├── Query 3: Get exercises/meals
    └── For each exercise/meal:
        ├── Query 4: Get sets/items
        └── Query 5: Get alternatives
```

**Impact:** A plan with 5 days × 8 exercises = **87 queries**. A nutrition plan with 3 cycles × 4 meals × 5 items = **63 queries**.

### 2.2 High: `forms.getRequestsByClient()` and `forms.getQueue()`

```typescript
for (const row of results) {
    const responses = await prisma.form_responses.findMany({
        where: { request_id: row.id },
    });
}
```

**Impact:** 100 form requests = 100 additional queries.

### 2.3 Moderate: `clients.resolveRelatedItemsInput()`

```typescript
for (const item of relatedItems) {
    if (item.exercise_library_id) {
        const ex = await prisma.exercise_library.findFirst({ ... });
    }
    if (item.food_item_id) {
        const food = await prisma.food_items.findFirst({ ... });
    }
}
```

**Impact:** 10 related items = 10 queries.

### 2.4 Well-Optimized: `packages` module

```typescript
const VARIATIONS_INCLUDE = {
    package_variations: {
        include: { package_default_forms: { include: { forms: { select: { title_en: true } } } } },
    },
};
```

**Excellent:** Explicit N+1 prevention documented in code.

---

## 3. GOD CONTROLLERS — Score: **Fair**

### 3.1 File Size Analysis

| File | Lines | Verdict |
|------|-------|---------|
| `clients.controller.ts` | 1,320 | God component |
| `nutrition.controller.ts` | 1,252 | God component |
| `forms.controller.ts` | 1,078 | God component |
| `training.controller.ts` | 733 | Large |
| `workspaces.controller.ts` | 562 | Acceptable |
| `packages.controller.ts` | 274 | Good |
| `plans.controller.ts` | 59 | Excellent |

### 3.2 clients.controller.ts Breakdown

The 1,320-line controller handles:
- Client CRUD (create, read, update, archive, restore, hard delete)
- Subscription management (freezes, audit)
- Workout analytics (logs, exercise progress, insights)
- Transformation data (metric history + timeline)
- Observations (CRUD with attachments)
- Password management (portal password)

**Recommendation:** Split into `clients.crud.ts`, `clients.workouts.ts`, `clients.observations.ts`, `clients.subscription.ts`.

### 3.3 nutrition.controller.ts Breakdown

The 1,252-line controller handles:
- Food items/categories CRUD
- Plan CRUD (create, read, update, delete, duplicate)
- Cycle CRUD (create, read, update, delete, duplicate)
- Meal CRUD (create, read, update, delete, duplicate)
- Meal items CRUD (create, update, reorder, delete)
- Alternatives CRUD (create, update, delete)
- Plan activation

**Recommendation:** Split into `nutrition.food.ts`, `nutrition.plans.ts`, `nutrition.cycles.ts`, `nutrition.meals.ts`.

---

## 4. TRANSACTION PATTERNS — Score: **Good**

### 4.1 Prisma Transactions

| Module | Usage | Quality |
|--------|-------|---------|
| clients | Hard delete, observation update | Good |
| forms | Form creation, draft save, metric tracking | Excellent |
| packages | Package create/update | Excellent |
| workspaces | Ownership transfer | Good |

### 4.2 Raw PG Transactions

| Module | Usage | Quality |
|--------|-------|---------|
| training | `replaceClientPlansTransactional` | Good |
| nutrition | `duplicatePlan`, `duplicateCycle`, `duplicateMeal` | Fair |

**Issue:** Nutrition uses manual `dbClient.connect()`/`BEGIN`/`COMMIT`/`ROLLBACK` instead of the `withTransaction` helper. Error-prone.

### 4.3 Missing Transactions

| Module | Endpoint | Risk |
|--------|----------|------|
| nutrition | `reorderMealItems` | Partial reorder on failure |

---

## 5. ERROR HANDLING — Score: **Very Good**

### 5.1 Consistent Pattern

```typescript
export async function handler(req: Request, res: Response, next: NextFunction) {
    try {
        // ... business logic
    } catch (err) {
        next(err);
    }
}
```

**Excellent:** Every handler delegates to the global error handler.

### 5.2 Custom Error Classes (Forms)

```typescript
class FormNotFoundError extends Error {
    status = 404;
}
class FormArchivedError extends Error {
    status = 409;
}
```

**Excellent:** Domain-specific errors with HTTP status codes.

### 5.3 Consistent Status Codes

| Code | Usage |
|------|-------|
| 400 | Validation errors |
| 401 | Authentication required |
| 403 | Permission denied |
| 404 | Resource not found |
| 409 | Conflict (already archived, slug taken) |
| 500 | Unhandled errors |

---

## 6. SPECIAL PATTERNS — Score: **Excellent**

### 6.1 Forms Versioning (forms.module)

The most architecturally sophisticated module:

```
createForm → createVersion (version 1)
saveDraft → resolveWritableVersion → batch delete/update/create
assignForm → sealVersionForAssignment (pessimistic locking)
```

**Excellent:**
- Pessimistic row locking (`FOR UPDATE`) for concurrent access
- Question lineage tracking (`origin_question_id`)
- Version sealing on assignment
- Automatic fork on save-draft

### 6.2 Master Library Clone (workspaces.module)

```
register → cloneDefaultLibraries(workspaceId)
├── Clone exercises from master_exercise_library
├── Clone foods from master_food_items
├── Clone forms from master_forms
└── Background, non-blocking
```

**Excellent:** New workspaces get default data without blocking registration.

### 6.3 Package Lifecycle (packages.module)

```
package_variations → package_default_forms → form_requests
                                           → check_in_schedules
```

**Excellent:** Packages define default forms that are auto-assigned on plan activation.

### 6.4 Subscription Access Policies

```
subscription_access_policies:
  workspace_id + package_id (NULL = global default)
  scope: 'expired' | 'frozen'
  10 boolean feature flags
  grace_period_days
```

**Excellent:** Granular per-package access control with global defaults.

---

## 7. CRITICAL ISSUES SUMMARY

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | **N+1 in training.getPlan()** | CRITICAL | Batch queries or use JOINs |
| 2 | **N+1 in nutrition.getPlan()** | CRITICAL | Batch queries or use JOINs |
| 3 | **N+1 in forms.getRequestsByClient()** | HIGH | Batch response fetching |
| 4 | **God controllers** (1,320 lines) | MEDIUM | Split into sub-modules |
| 5 | **Manual transactions in nutrition** | MEDIUM | Use `withTransaction` helper |
| 6 | **Missing transaction in reorderMealItems** | MEDIUM | Wrap in transaction |

---

## 8. WHAT'S WELL DONE

1. **Forms versioning system** — Pessimistic locking, question lineage, automatic fork. Production-grade.

2. **Packages module** — Explicit N+1 prevention, serializer pattern, clean file sizes.

3. **Consistent error handling** — Every handler delegates to global error handler.

4. **Custom error classes** — Domain-specific errors with HTTP status codes.

5. **Master library clone** — Background cloning on registration.

6. **Subscription access policies** — Granular per-package feature gating.

7. **Audit logging** — Workspace mutations logged to `workspace_audit_log`.

8. **Input validation** — Email format, password length, slug normalization.

9. **Inline documentation** — Extensive comments explaining business rationale.

10. **CUID2 IDs** — No auto-increment, no sequential IDs.

---

## 9. RECOMMENDED ACTIONS (Priority Order)

### Immediate
1. Fix N+1 in `training.getPlan()` and `nutrition.getPlan()` with batched queries
2. Fix N+1 in `forms.getRequestsByClient()` and `forms.getQueue()`

### Short-term
3. Split `clients.controller.ts` into sub-modules
4. Split `nutrition.controller.ts` into sub-modules
5. Standardize nutrition transactions to use `withTransaction` helper

### Medium-term
6. Add transaction to `reorderMealItems`
7. Extract shared plan save logic between training and nutrition
8. Add response caching for read-heavy endpoints

---

*Report generated: 2026-07-14 | Reviewer: Senior Code Reviewer | Next: Phase 6 — Business Logic (Support Modules)*
