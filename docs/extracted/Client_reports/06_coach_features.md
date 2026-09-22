# Phase 6: Coach Features — Deep Review

**Date:** 2026-07-14
**Scope:** Dashboard, clients, training/nutrition/forms builders, messenger, finance, team, settings
**Score: GOOD** (3.5/5) — Comprehensive feature set across 19 pages (~9,300 lines), but largest pages exceed 1,000 lines with inline component definitions

---

## 1. FEATURE MAP

### 1.1 Page Inventory

| Page | Lines | Complexity | Quality |
|------|-------|-----------|---------|
| Dashboard | 175 | Low | Very Good |
| Clients List | 1,382 | Very High | Fair |
| Client Detail | 950 | High | Good |
| Client Training | ~200 | Medium | Good |
| Client Nutrition | ~200 | Medium | Good |
| Client Forms | ~250 | Medium | Good |
| Client Observations | ~200 | Medium | Good |
| Client Transactions | ~200 | Medium | Good |
| Client Transformation | ~300 | Medium | Good |
| Client Workout Logs | ~200 | Medium | Good |
| Messenger | 859 | High | Good |
| Finance Packages | 1,098 | Very High | Fair |
| Finance Payment Methods | 495 | Medium | Good |
| Finance Transactions | 396 | Medium | Good |
| Team | 956 | High | Good |
| Training Library | 162 | Low | Good |
| Nutrition Library | 171 | Low | Good |
| Forms Metrics | 380 | Medium | Good |
| Settings (5 pages) | 1,189 | Medium | Good |

**Total: ~9,289 lines across 19 coach pages**

### 1.2 Client Detail Architecture

The client detail page (`clients/[id]/page.js`, 950 lines) is a tabbed interface with 11 sub-pages:

```
clients/[id]/
├── page.js              (950 lines — overview, metrics, transformation)
├── layout.js            (tab navigation)
├── training/page.js     (training plan builder)
├── nutrition/page.js    (nutrition plan builder)
├── forms/page.js        (form submissions)
├── observations/page.js (coach observations)
├── transactions/page.js (payment history)
├── transformation/page.js (before/after photos)
├── workout-logs/page.js (client workout history)
├── loading.js           (skeleton)
└── error.js             (error boundary)
```

**Quality:** Clean separation of concerns. Each sub-page is focused and self-contained. The layout handles tab navigation, each page handles its own data fetching.

---

## 2. DASHBOARD — Score: **Very Good**

```javascript
// 175 lines — clean, focused, i18n-ready
const { fname, stats, recentClients } = data;
```

**Strengths:**
- Skeleton loading state with 4 card placeholders + 3 row placeholders
- i18n-ready with `useTranslations('dashboard')`
- Welcome onboarding gate for new coaches (checks `/api/auth/clone-status`)
- Status chip color mapping with semantic colors
- "View All" link to clients page
- Empty state with CTA when no clients exist

**Issues:**
1. **Onboarding check uses `window.location.search`** — Direct DOM access in a React component. Should use `useSearchParams()` from Next.js for SSR compatibility.
2. **`useEffect` dependency on `router`** — The dashboard fetches `/api/dashboard` with `[router]` as dependency, but `router` is stable. Should be `[]`.

---

## 3. CLIENTS LIST — Score: **Fair**

At **1,382 lines**, this is the largest page in the codebase. It handles:
- DataTable with sorting, filtering, search
- Multi-step "Add Client" modal (Stepper with 4 steps)
- Client creation with subscription, payment, and form assignment
- Bulk selection with ActionBar
- Client freeze/unfreeze management
- Credential copy-to-clipboard
- Client deletion with confirmation
- Client archival and restoration

### 3.1 Inline Component Definitions

The page defines several components inline:

```javascript
// Lines 64-75 — defined inside the page file
function EmptyStateNote({ icon: Icon, title, description }) { ... }

// Lines 78-115 — DatePickerField (duplicate of shared component!)
function DatePickerField({ value, onChange, ariaLabel, isInvalid, isDisabled }) { ... }
```

**Issue:** `DatePickerField` is already defined in `app/components/DatePickerField.js` (a shared component). The clients page redefines it inline — this is code duplication.

### 3.2 Multi-Step Add Client Modal

The add client flow uses the `Stepper` component with 4 steps:
1. **Personal Info** — Name, email, phone (with country code)
2. **Subscription** — Package selection, start date
3. **Payment** — Amount, method, proof upload
4. **Forms** — Optional check-in form assignment

**Quality:** Well-structured flow. Each step has validation. The `Stepper` provides clear progress indication.

### 3.3 Password Generation

```javascript
function generatePassword() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let result = "";
    for (let i = 0; i < 10; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
    return result;
}
```

**Issue:** Uses `Math.random()` which is not cryptographically secure. Should use `crypto.getRandomValues()` for password generation.

---

## 4. MESSENGER — Score: **Good**

At **859 lines**, the messenger is a full chat interface.

### 4.1 Features

- Thread list with client avatars and unread badges
- Message list with sender grouping (5-minute window)
- Date separators between message groups
- Message composer with text input
- File attachment support
- Observation cards inline in messages
- Broadcast messaging to all clients
- Thread filtering and sorting
- Polling for new messages (5-second interval)

### 4.2 Message Grouping

```javascript
function buildSegments(messages, locale, dateLabels) {
    // Groups consecutive messages from same sender within 5-minute window
    // Adds date separators between days
}
```

**Good:** Smart grouping reduces visual clutter. The 5-minute window prevents fragmented conversations.

### 4.3 Issues

1. **859 lines in a single file** — Should be split into sub-components (ThreadList, MessageList, MessageComposer, etc.)
2. **5-second polling** — As noted in Phase 4, this creates 12 requests per minute. WebSocket/SSE would be better.
3. **No message search** — Users can't search within a conversation.

---

## 5. FINANCE — Score: **Good**

### 5.1 Packages (1,098 lines)

The packages page manages subscription packages with:
- Package CRUD (create, rename, toggle active)
- Variation management (different pricing tiers per package)
- Duration configuration (cycle days, check-in forms)
- Default library linking
- Package deletion with client impact warning

**Quality:** Comprehensive package management. The variation system supports flexible pricing.

### 5.2 Payment Methods (495 lines)

Standard CRUD for payment methods (Cash, Bank Transfer, etc.) with:
- Active/inactive toggle
- Inline editing
- Deletion with confirmation

### 5.3 Transactions (396 lines)

Transaction list with:
- DataTable with filtering
- Status management (Pending → Completed / Refunded)
- Proof of payment upload
- Client linking

---

## 6. TEAM MANAGEMENT — Score: **Good**

At **956 lines**, the team page handles:
- Member list with roles and permissions
- Invitation system (email-based)
- Permission management (granular per-module access)
- Ownership transfer
- Member removal

### 6.1 Permission System

The permission editor uses a matrix UI:
- Rows: Team members
- Columns: Modules (Clients, Training, Nutrition, Finance, Forms, Messenger)
- Cells: Read/Write checkboxes

**Quality:** Granular permission control. The owner role bypasses all permission checks.

### 6.2 Issues

1. **956 lines** — Should be split into sub-components (MemberList, InvitationForm, PermissionEditor, OwnershipTransfer)
2. **Permission changes are immediate** — No "Save" button for permission changes. Each toggle fires an API call immediately.

---

## 7. TRAINING & NUTRITION BUILDERS — Score: **Very Good**

Both builders follow the same architecture:
- **LeftPanel** — Plan list (sorted, searchable)
- **MiddlePanel** — Day/Cycle list with reorder
- **RightPanel** — Detail editor (exercises/meals)

### 7.1 Training Builder

Uses `useTrainingPlan` hook (791 lines). Features:
- Plan CRUD with local editing
- Day management (create, rename, reorder, duplicate)
- Exercise management (add from library, reorder, notes)
- Set management (add, duplicate, apply-to-all, delete)
- Save with dirty tracking
- Plan activation with optimistic UI

### 7.2 Nutrition Builder

Uses `useNutritionPlan` hook (1,117 lines). Features:
- Plan CRUD with local editing
- Cycle management (create, rename, reorder, goals)
- Meal management (create, rename, reorder, notes)
- Food item management (add from library, alternatives, amount adjustment)
- Calorie/macro calculations
- Plan activation with optimistic UI

**Quality:** Both builders are production-grade with complex nested data management. The hooks handle all state, making the page components relatively thin.

---

## 8. FORMS BUILDER — Score: **Good**

Uses `useFormBuilder` hook (437 lines). Features:
- Form list with sorting
- Form CRUD
- Question management (create, edit, reorder, delete)
- Question types (text, number, select, multiselect, scale)
- Metric tracking (link questions to metrics)
- Draft saving with version awareness
- Delete protection (blocked if form has submissions)

### 8.1 Forms Metrics (380 lines)

A separate page for managing tracked metrics:
- Metric CRUD
- Type selection (weight, calories, reps, etc.)
- Unit configuration

---

## 9. SETTINGS — Score: **Good**

| Page | Lines | Focus |
|------|-------|-------|
| Subscription | 307 | Billing, plan status, payment |
| Workspace | 255 | Slug, name, branding |
| Advanced | 248 | Ownership transfer, workspace deletion |
| Client Experience | 195 | Portal access policies |
| Account | 184 | Profile, password |

### 9.1 Client Experience Settings

```javascript
// subscriptionPolicyPresets.js
export const POLICY_PRESETS = {
    fullAccess: { keep_portal_access: true, view_training_plans: true, ... },
    viewOnly: { keep_portal_access: true, view_training_plans: true, view_nutrition_plans: true, ... },
    restricted: { keep_portal_access: true, view_training_plans: false, ... },
};
```

**Good:** Preset-based policy configuration. Coaches can choose a preset and customize per-feature.

---

## 10. CRITICAL ISSUES SUMMARY

| # | Issue | Severity | File(s) | Fix |
|---|-------|----------|---------|-----|
| 1 | **`clients/page.js` is 1,382 lines** — god component with inline sub-components | MEDIUM | `clients/page.js` | Extract sub-components to separate files |
| 2 | **`DatePickerField` duplicated** — defined inline in `clients/page.js` AND in `components/DatePickerField.js` | MEDIUM | `clients/page.js:78` | Import from shared component |
| 3 | **`packages/page.js` is 1,098 lines** — god component | MEDIUM | `packages/page.js` | Extract sub-components |
| 4 | **`messenger/page.js` is 859 lines** — should be split | MEDIUM | `messenger/page.js` | Extract ThreadList, MessageList, etc. |
| 5 | **`Math.random()` for password generation** — not cryptographically secure | LOW | `clients/page.js:54` | Use `crypto.getRandomValues()` |
| 6 | **Dashboard uses `window.location.search`** — not SSR-compatible | LOW | `dashboard/page.js:44` | Use `useSearchParams()` |
| 7 | **Team page permission changes are immediate** — no undo/save | LOW | `team/page.js` | Add confirmation step |

---

## 11. WHAT'S WELL DONE

1. **Feature completeness** — The coach experience is comprehensive: clients, training, nutrition, forms, messaging, finance, team, settings. This is a production-ready SaaS.

2. **Client detail tab architecture** — 11 sub-pages, each focused and self-contained. The layout handles navigation, pages handle data.

3. **Builder hooks** — `useTrainingPlan` and `useNutritionPlan` handle complex nested data with local editing, dirty tracking, and batch saves. The page components are thin.

4. **Multi-step add client modal** — 4-step flow with validation, stepper progress, and optional steps. Good UX for a complex form.

5. **Messenger** — Full chat interface with message grouping, date separators, file attachments, and broadcast messaging.

6. **Permission system** — Granular per-module access control with preset-based configuration. Owner bypass is clean.

7. **i18n** — All coach pages use `useTranslations()`. No hardcoded strings (except a few status labels).

8. **Skeleton loading** — Every page has appropriate skeleton states. No jarring loading spinners.

9. **Empty states** — Pages handle empty data gracefully with CTAs.

10. **Plan activation flow** — Optimistic UI with save-before-activate pattern. Handles dirty state correctly.

---

## 12. RECOMMENDED ACTIONS (Priority Order)

### Immediate
1. Extract inline `DatePickerField` from `clients/page.js` — import from shared component
2. Replace `Math.random()` with `crypto.getRandomValues()` in password generation

### Short-term
3. Split `clients/page.js` (1,382 lines) into sub-components (AddClientModal, ClientFilters, etc.)
4. Split `packages/page.js` (1,098 lines) into sub-components
5. Split `messenger/page.js` (859 lines) into sub-components
6. Split `team/page.js` (956 lines) into sub-components

### Medium-term
7. Add confirmation step for team permission changes
8. Add message search to messenger
9. Consider extracting DataTable configurations into reusable column definitions

---

*Report generated: 2026-07-14 | Reviewer: Senior Code Reviewer | Next: Phase 7 — Client Portal*
