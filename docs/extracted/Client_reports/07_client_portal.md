# Phase 7: Client Portal — Deep Review

**Date:** 2026-07-14
**Scope:** Portal layout, training, nutrition, forms, messaging, profile, notifications
**Score: GOOD** (3.5/5) — Clean architecture with subscription-based access gating, but code duplication with coach pages and some large files

---

## 1. PORTAL ARCHITECTURE — Score: **Very Good**

### 1.1 Layout & Provider

```javascript
// portal/layout.js (53 lines)
export default function ClientLayout({ children }) {
    const isLoginPage = !PROTECTED.some(p => pathname.startsWith(p));
    if (isLoginPage) return <>{children}</>;
    return (
        <ClientPortalProvider>
            <PortalShell>{children}</PortalShell>
        </ClientPortalProvider>
    );
}
```

**Quality:**
- **Access gating** — `PortalShell` checks `access.keep_portal_access` and shows status card if restricted
- **Login bypass** — Login page renders without the provider (no auth check needed)
- **Loading skeleton** — Shows skeleton while auth state loads
- **Subscription status** — Shows frozen/expired status card when portal is restricted

### 1.2 ClientPortalProvider

```javascript
// Re-fetches on every portal navigation
useEffect(() => {
    let active = true;
    api.get("/api/client-portal/me")
        .then(res => { if (active) applyMe(res.data); })
        .catch(() => { if (active) router.push("/portal"); });
    return () => { active = false; };
}, [pathname, applyMe, router]);
```

**Very Good:**
- Pathname-based re-fetch ensures access flags update after status changes
- Cancellation flag prevents stale state after unmount
- Redirects to login on session expiry
- Exposes `refresh()` for manual re-fetch after actions

### 1.3 Read-Heavy, Write-Light Pattern

The portal is primarily a **read interface**:
- **Reads:** Active plans, messages, notifications, form requests, workout logs, profile
- **Writes:** Workout logs (training session), form submissions, messages, profile updates, notification read states

This is appropriate for a client-facing portal — clients view their plans and log workouts, but don't create/edit plans.

---

## 2. PAGE INVENTORY

| Page | Lines | Focus | Quality |
|------|-------|-------|---------|
| Portal Login | 86 | Client authentication | Good |
| Home | 479 | Metrics, transformation, charts | Fair |
| Training List | 401 | Active plan viewer | Good |
| Training Session | 344 | Workout logging | Very Good |
| Training Progress | 135 | Exercise progress charts | Good |
| Training History | 83 | Workout log list | Good |
| Nutrition | 374 | Meal plan viewer + shopping list | Good |
| Forms List | 166 | Pending form requests | Good |
| Form Fill | 430 | Dynamic form submission | Good |
| Messages | 248 | Coach-client chat | Good |
| Notifications | 338 | Notification list | Good |
| Profile | 126 | Client profile editing | Good |

**Total: ~3,147 lines across 12 portal pages**

---

## 3. TRAINING SESSION — Score: **Very Good**

The most complex portal page (344 lines) implements a full workout logging experience:

### 3.1 Features

- **Session persistence** — Saves to `localStorage` under `ff_training_session` key. Resume after page refresh.
- **Exercise logging** — Weight, reps, RIR (Rate of Intensity) per set
- **Rest timer** — Configurable rest period with visual countdown bar
- **Previous values** — Shows last session's weights/reps for reference
- **Volume tracking** — Real-time total volume calculation
- **Completion tracking** — Set-level completion with checkbox
- **Discard confirmation** — Prevents accidental data loss
- **Empty set warning** — Warns if finishing with no logged sets

### 3.2 Session Architecture

```javascript
function buildSession(plan, day, dayIndex) {
    return {
        plan_id, day_id, day_index, day_name, started_at,
        exercises: day.exercises.map(ex => ({
            exercise_id, name, prescribed: ex.sets,
            sets: Array.from({ length: setCount }, (_, i) => ({
                set_order: i + 1, weight: "", reps: "", rir: "",
                rest_seconds: null, completed: false,
            })),
        })),
    };
}
```

**Good:** Clean session structure. Prescribed values stored alongside actual values for comparison.

### 3.3 localStorage Persistence

```javascript
const STORAGE_KEY = "ff_training_session";
// Save on every state change
useEffect(() => {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}, [session]);
```

**Good:** Enables resume-after-refresh. The session is rebuilt from localStorage if it exists for the same day.

---

## 4. NUTRITION VIEWER — Score: **Good**

### 4.1 Features

- Cycle tab navigation with scroll shadows
- Meal expansion/collapse
- Food item details with macros
- Shopping list generation (aggregates all items across meals)
- Macro donut chart
- RTL-aware tab scrolling

### 4.2 Shopping List

```javascript
const shoppingList = useMemo(() => {
    const items = new Map();
    plan.cycles[activeCycleIndex]?.meals.forEach(meal => {
        meal.items.forEach(item => {
            const key = item.name;
            if (items.has(key)) {
                items.get(key).amount += item.amount;
            } else {
                items.set(key, { name: item.name, amount: item.amount, unit: item.serving_unit });
            }
        });
    });
    return Array.from(items.values());
}, [plan, activeCycleIndex]);
```

**Good:** Aggregates duplicate items across meals into a single shopping list entry.

---

## 5. FORM SUBMISSION — Score: **Good**

### 5.1 Dynamic Form Rendering

The form fill page (`forms/[requestId]/page.js`, 430 lines) renders forms dynamically based on question types:

- **text** — Text input
- **number** — Number input with min/max
- **select** — Single choice dropdown
- **multiselect** — Multiple choice checkboxes
- **scale** — Numeric scale (1-10)

### 5.2 Photo Upload

Supports photo uploads for form responses:
- Client can upload progress photos with form submissions
- Photos are stored as attachments linked to the form response

### 5.3 Pre-fill

```javascript
if (res.data.responses?.length > 0) {
    const filled = {};
    res.data.responses.forEach(r => { filled[r.question_id] = r.answer; });
    setAnswers(filled);
}
```

**Good:** If the form was already partially submitted, pre-fills existing answers.

---

## 6. MESSAGES — Score: **Good**

### 6.1 Features

- Single-thread chat (coach-client)
- Message grouping (5-minute window)
- Date separators
- Real-time polling (5 seconds)
- Message composer with text input
- File attachment support

### 6.2 Code Duplication

The `buildSegments` and `getDateLabel` functions are **duplicated** between:
- `portal/messages/page.js` (lines 25-60)
- `messenger/page.js` (lines 40-80)

These are nearly identical implementations. Should be extracted to a shared utility.

---

## 7. HOME PAGE — Score: **Fair**

### 7.1 Features

- Metric charts with date range filtering
- Transformation before/after comparison slider
- Date range presets (30d, 90d, 6m, All)
- Delta calculation (change over time)

### 7.2 Code Duplication

The home page defines several components/functions that are **duplicated** from the coach's client detail page:

| Function/Component | Portal Home | Coach Client Detail |
|-------------------|-------------|-------------------|
| `filterByRange` | Lines 27-34 | Lines 37-44 |
| `rangeForDays` | Lines 36-39 | Lines 46-49 |
| `deltaInfo` | Lines 48-52 | Lines 58-62 |
| `MetricChart` | Lines 54-77 | Lines 64-86 |
| `ComparisonSlider` | Lines 79+ | Lines 88+ |
| `PRESETS` | Lines 41-46 | Lines 51-56 |

**Issue:** 6 functions/components are duplicated between the two pages. These should be extracted to shared utilities.

---

## 8. NOTIFICATIONS — Score: **Good**

### 8.1 Features

- Notification list with read/unread states
- Bulk "mark all as read"
- Individual notification read
- Unread count badge (polling)
- Notification types (system, form, message, etc.)

### 8.2 Polling

```javascript
const POLL_INTERVAL_MS = 5000;
// Polls for unread count
```

Same 5-second polling pattern as coach messenger. As noted in Phase 4, this could be replaced with WebSocket/SSE.

---

## 9. CRITICAL ISSUES SUMMARY

| # | Issue | Severity | File(s) | Fix |
|---|-------|----------|---------|-----|
| 1 | **6 functions duplicated** between portal home and coach client detail | MEDIUM | `portal/home/page.js`, `clients/[id]/page.js` | Extract to shared utility |
| 2 | **`buildSegments`/`getDateLabel` duplicated** between portal messages and coach messenger | MEDIUM | `portal/messages/page.js`, `messenger/page.js` | Extract to shared utility |
| 3 | **`portal/home/page.js` is 479 lines** — should split MetricChart, ComparisonSlider | LOW | `portal/home/page.js` | Extract sub-components |
| 4 | **5-second polling in messages** — bandwidth waste | LOW | `portal/messages/page.js` | Consider WebSocket |

---

## 10. WHAT'S WELL DONE

1. **Access gating** — The portal layout checks subscription status and shows appropriate status cards (frozen, expired, restricted). This is server-enforced via the `ClientPortalProvider`.

2. **Training session persistence** — localStorage-based session resume is excellent UX. Clients can refresh mid-workout without losing data.

3. **Dynamic form rendering** — The form fill page handles 5 question types with proper validation, pre-fill, and photo upload support.

4. **Shopping list aggregation** — Automatically deduplicates food items across meals. Practical feature for clients.

5. **RTL support** — Nutrition tab scrolling, message layout, and form rendering all handle RTL correctly.

6. **i18n** — All portal pages use `useTranslations()`. No hardcoded strings.

7. **Skeleton loading** — Every page has appropriate loading states.

8. **Rest timer** — Visual countdown bar for workout rest periods. Nice touch for the training experience.

9. **Previous values** — Training session shows last session's weights/reps for progressive overload tracking.

10. **Transformation slider** — Before/after photo comparison with draggable slider. Good visual impact.

---

## 11. RECOMMENDED ACTIONS (Priority Order)

### Immediate
1. Extract `filterByRange`, `rangeForDays`, `deltaInfo`, `MetricChart`, `ComparisonSlider`, `PRESETS` to shared utility
2. Extract `buildSegments` and `getDateLabel` to shared utility

### Short-term
3. Split `portal/home/page.js` (479 lines) into sub-components
4. Consider WebSocket for real-time messaging (replace 5s polling)

### Medium-term
5. Add push notifications for form requests and messages
6. Add offline support for training session (Service Worker)

---

*Report generated: 2026-07-14 | Reviewer: Senior Code Reviewer | Next: Phase 8 — Admin Panel*
