# Phase 4: Data Layer & State — Deep Review

**Date:** 2026-07-14
**Scope:** Axios config, API patterns, custom hooks, Context usage, caching, polling, data flow
**Score: FAIR** (3.0/5) — Consistent patterns across 84 files and 3 large hooks, but no caching layer, redundant `/api/auth/me` calls, and missing request deduplication

---

## 1. AXIOS INSTANCE — Score: **Good**

### 1.1 Configuration

```javascript
// client/lib/axios.js (7 lines)
import axios from 'axios';
const api = axios.create({
    baseURL: process.env.NEXT_PUBLIC_API_URL,
    withCredentials: true
});
export default api;
```

**Quality:**
- Single shared instance — 84 files import from `@/lib/axios`. Zero direct `fetch()` calls (except 1 in `LandingPricing.js`)
- `withCredentials: true` — cookie-based auth works cross-origin (needed for subdomain architecture)
- `baseURL` from env — supports dev/staging/production switching

**Issues:**
1. **No interceptors** — No request interceptor (e.g., attach token header, refresh token). No response interceptor (e.g., auto-redirect on 401, retry on network error). Every component handles errors individually.
2. **No error normalization** — Each page does its own `try/catch` with `console.error`. No centralized error toast/notification system.
3. **No request cancellation** — No AbortController support. If a user navigates away during a fetch, the stale response still updates state (mitigated by `let active = true` pattern in `ClientPortalProvider`, but not in hooks or pages).
4. **No retry logic** — Network blips cause immediate failure. No exponential backoff.

### 1.2 Direct fetch() Bypass

`LandingPricing.js` uses native `fetch()` instead of the shared `api` instance:

```javascript
fetch(plansUrl).then(r => r.json()),
fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/plans/billing-discounts`).then(r => r.json()),
```

This bypasses `withCredentials: true` and any future interceptors. The landing page is unauthenticated so it works, but it's inconsistent.

---

## 2. API CALL PATTERNS — Score: **Good**

### 2.1 Scale

| Metric | Count |
|--------|-------|
| Files importing `api` | **84** |
| Unique API domains | **18** |
| Unique endpoint patterns | **~132** |
| Total call sites | **~220+** |
| Direct fetch() calls | **2** (1 file) |

### 2.2 Endpoint Distribution

| Domain | Call Sites | Files |
|--------|-----------|-------|
| `/api/auth/*` | 22 | 16 |
| `/api/clients/*` | 40 | 16 |
| `/api/training/*` | 25 | 8 |
| `/api/nutrition/*` | 21 | 6 |
| `/api/forms/*` | 30 | 9 |
| `/api/client-portal/*` | 30 | 12 |
| `/api/admin/*` | 26 | 7 |
| `/api/workspaces/*` | 19 | 4 |
| `/api/messenger/*` | 9 | 2 |
| Other | ~28 | ~15 |

### 2.3 Pattern Consistency

The codebase follows a consistent pattern across all 84 files:

```javascript
// Fetch on mount
useEffect(() => {
    api.get('/api/some-endpoint')
        .then(res => setData(res.data))
        .catch(err => console.error('Error:', err));
}, []);
```

**Quality:** Consistent, readable, predictable. Every developer can navigate any file and understand the data flow.

**Issue:** No shared abstraction for "fetch on mount". Each page duplicates the same `useEffect` + `useState` + `try/catch` + `finally(setLoading(false))` boilerplate. A `useFetch` or `useQuery` hook would eliminate ~500 lines of duplicated code.

---

## 3. CUSTOM HOOKS — Score: **Good**

### 3.1 Architecture

| Hook | Lines | State Variables | Handlers | Pattern |
|------|-------|----------------|----------|---------|
| `useTrainingPlan` | 791 | 14 | 22 | local-edit + explicit-save |
| `useNutritionPlan` | 1117 | 18 | 32 | local-edit + explicit-save |
| `useFormBuilder` | 437 | 14 | 16 | local-edit + explicit-save |
| `useMediaQuery` | 25 | 1 | 0 | matchMedia subscription |

All three builder hooks follow the same architecture:
1. **Fetch** — Load data on mount (summary list + detail per item)
2. **Local edit** — All mutations happen in React state, not on the server
3. **Dirty tracking** — `dirtyPlanIds` Set tracks which items have unsaved changes
4. **Explicit save** — User clicks Save → batch POST → server resolves IDs → update local state
5. **Save status** — `idle → saving → saved → idle` (with 1.8-2.2s timeout)
6. **Optimistic UI** — Plan activation sets status immediately, reverts on error

### 3.2 Quality Assessment

**Strengths:**
- **Temp ID system** — `makeTempId()` generates unique IDs for new items before server assigns real IDs. Prevents ID collision and enables "undo" via local state.
- **Context preservation** — `fetchClientPlans(preserveContext)` keeps the selected plan/meal/day after refetch. User doesn't lose their place.
- **Dirty tracking** — Prevents accidental data loss. `window.confirm` before switching forms with unsaved changes.
- **Blocked delete recovery** — `useFormBuilder` caches deleted questions in `deletedQuestionsCacheRef` and restores them if the server blocks the delete (recorded answers exist).
- **Version fork awareness** — Both nutrition and training hooks handle `oldPlanId → newPlanId` transitions when the server creates a new version.

**Issues:**
1. **`useNutritionPlan` is 1117 lines** — This is a god hook. It handles plan CRUD, cycle CRUD, meal CRUD, food item search, alternatives, reordering, activation, saving, and dirty tracking. Should be split into smaller, composable hooks.
2. **`useNutritionPlan` N+1 fetch** — `fetchClientPlans` fetches summaries, then `Promise.all(summaries.map(plan => api.get(...)))` fetches each plan's detail. With 10 plans, this is 11 API calls on mount.
3. **No memoization of `sortedPlans` in nutrition** — `useNutritionPlan` computes `sortedPlans` inline (not `useMemo`), while `useTrainingPlan` correctly uses `useMemo`. The nutrition hook re-sorts on every render.
4. **`useTrainingPlan` uses `useCallback` correctly** — All handlers are properly memoized. `useNutritionPlan` does NOT use `useCallback` for most handlers, causing unnecessary re-renders in child components.
5. **`handleDeletePlan` in training has a stale closure** — `setSelectedPlan((prev) => { const remaining = plans.filter(...) })` captures `plans` from the closure rather than using the functional updater for `plans`. If multiple deletes happen rapidly, the second delete could use stale data.

### 3.3 useMediaQuery

```javascript
export function useMediaQuery(query) {
    const [matches, setMatches] = useState(false);
    useEffect(() => {
        const mql = window.matchMedia(query);
        const update = () => setMatches(mql.matches);
        update();
        mql.addEventListener("change", update);
        return () => mql.removeEventListener("change", update);
    }, [query]);
    return matches;
}
```

**Excellent.** SSR-safe (defaults to `false`), properly cleans up listener, re-subscribes when query changes. Desktop-first design documented in the JSDoc.

---

## 4. CONTEXT USAGE — Score: **Good**

### 4.1 Context Inventory

| Context | Provider | Consumers | Purpose |
|---------|----------|-----------|---------|
| `HeaderCollapseContext` | Coach layout | 2 files | Sidebar collapse toggle |
| `PageHeaderActionsContext` | Coach layout | 2 files | Dynamic header button injection |
| `ClientPortalContext` | Portal layout | All portal pages | Auth state + subscription access |

### 4.2 ClientPortalProvider — Score: **Very Good**

```javascript
// Re-fetch on every portal navigation
useEffect(() => {
    let active = true;
    api.get("/api/client-portal/me")
        .then(res => { if (active) applyMe(res.data); })
        .catch(() => { if (active) { setState(s => ({ ...s, loading: false })); router.push("/portal"); } });
    return () => { active = false; };
}, [pathname, applyMe, router]);
```

**Quality:**
- Re-fetches on `pathname` change — ensures access flags update after status changes without requiring logout
- Cancellation via `active` flag — prevents stale state updates after unmount
- Redirects to login on failure — proper session expiry handling
- Exposes `refresh()` for manual re-fetch — used after actions that change access

**Issue:** Every portal navigation triggers a fresh `/api/client-portal/me` call. This is a full auth check + subscription computation. For rapid navigation between portal pages, this could feel slow.

### 4.3 Missing Contexts

**No shared auth context for coaches.** The coach layout (`(coach)/layout.js`) fetches `/api/auth/me` and stores user in local state. The Sidebar also fetches `/api/auth/me` independently. The settings pages each fetch `/api/auth/me` independently. This means 2-3 redundant auth calls per page load (see Section 5).

---

## 5. REDUNDANT API CALLS — Score: **Poor**

### 5.1 `/api/auth/me` Duplication

The `/api/auth/me` endpoint is called **22 times across 16 files**. On a typical coach page load:

1. **`app/page.js`** → calls `/api/auth/me` (root redirect)
2. **`(coach)/layout.js`** → calls `/api/auth/me` (workspace validation)
3. **`Sidebar.js`** → calls `/api/auth/me` (user profile for avatar/name)
4. **Page component** → may call `/api/auth/me` again (e.g., `team/page.js` calls it 3 times)

**Worst case:** Team page calls `/api/auth/me` 3 times in the same component (lines 644, 659, 839), plus the layout and sidebar each call it once. That's **5 calls to the same endpoint** on a single page load.

### 5.2 `/api/messenger/threads` Polling

```javascript
// Sidebar.js:85
const interval = setInterval(fetchUnread, 5000);

// NotificationBell.js:215
const interval = setInterval(fetchUnread, UNREAD_POLL_MS);

// ClientPortalNav.js:31
const interval = setInterval(fetchUnread, UNREAD_POLL_MS);
```

Three separate components poll `/api/messenger/threads` or `/api/notifications/unread-count` independently. The Sidebar polls every 5 seconds. If the NotificationBell is also mounted, there are 2 concurrent polls for unread counts.

### 5.3 N+1 Fetch in Hooks

Both `useTrainingPlan` and `useNutritionPlan` do:
1. Fetch summary list: `GET /api/training/plans?clientId=X` → returns N plans
2. For each plan: `GET /api/training/plans/{id}` → returns full detail

With 5 training plans + 5 nutrition plans, that's **12 API calls** just to load a client's plans page.

---

## 6. CACHING — Score: **Poor**

### 6.1 No Caching Layer

The codebase has **zero caching**. Every page load, every navigation, every re-render triggers fresh API calls. There is:
- No React Query / SWR / TanStack Query
- No localStorage caching
- No in-memory cache
- No ETag / If-None-Match support
- No stale-while-revalidate pattern

### 6.2 Impact

| Scenario | API Calls | With Caching |
|----------|-----------|-------------|
| Navigate to client detail, back, then back again | 6+ | 0 (cache hit) |
| Open sidebar (already fetched auth/me) | 1 redundant | 0 |
| Switch between training/nutrition tabs | 12+ | 0 |
| Coach with 10 plans, load page 3 times | 36 | 3 |

### 6.3 What Exists Instead

The hooks implement a **manual caching pattern** via `fetchClientPlans(preserveContext)`:
- After a save, the hook refetches all data with `silent: true` (no loading spinner)
- The `preserveContext` parameter keeps the user's selection after refetch

This is a good UX pattern but it's not a cache — it's a refetch-and-replace strategy.

---

## 7. POLLING — Score: **Fair**

### 7.1 Polling Inventory

| Component | What | Interval | Purpose |
|-----------|------|----------|---------|
| `Sidebar.js` | `/api/messenger/threads` | 5s | Unread message badge |
| `NotificationBell.js` | `/api/notifications/unread-count` | Configurable | Unread notification badge |
| `ClientPortalNav.js` | `/api/client-portal/notifications/unread-count` | Configurable | Portal unread badge |
| `messenger/page.js` | Message list | Configurable | New messages |
| `subscription/page.js` | Payment status | Configurable | Payment confirmation |
| `portal/messages/page.js` | Message list | Configurable | New messages |
| `portal/training/session/page.js` | Clock ticker | 1s | Timer display (not API) |
| `WelcomeOnboarding.js` | Clone status | Configurable | Onboarding completion |

### 7.2 Issues

1. **No WebSocket/SSE** — All real-time features (messaging, notifications) use polling. The messenger polls every 5 seconds, which means:
   - 12 messages per minute of wasted bandwidth
   - 1-5 second delay before new messages appear
   - Multiple clients polling simultaneously multiply server load

2. **Independent polling** — Sidebar and NotificationBell poll independently. If both are mounted, there are 2 concurrent 5-second polls for unread counts.

3. **No backoff** — Polling interval doesn't change based on activity. A user idle for 30 minutes still gets polled every 5 seconds.

4. **Cleanup is correct** — All `setInterval` calls are properly cleaned up in `useEffect` return functions.

---

## 8. ERROR HANDLING — Score: **Fair**

### 8.1 Pattern

The dominant pattern across 84 files:

```javascript
useEffect(() => {
    api.get('/api/some-endpoint')
        .then(res => setData(res.data))
        .catch(err => console.error('Error fetching:', err));
}, []);
```

**Quality:**
- Consistent — every file follows the same pattern
- Non-blocking — errors don't crash the app
- Loading state always resolved — `finally(() => setLoading(false))` in hooks

**Issues:**
1. **No user-facing error messages** — Most errors are silently logged to console. The user sees a blank/loading screen with no indication something went wrong.
2. **No retry mechanism** — A single network blip means the page shows nothing. No "Retry" button, no auto-retry.
3. **No error boundary integration** — API errors don't trigger React error boundaries. They're caught and swallowed.
4. **Some pages show error state** — A few pages (e.g., `dashboard/page.js`) show an error message, but most don't.

---

## 9. STATE ARCHITECTURE — Score: **Good**

### 9.1 Where State Lives

| State | Location | Pattern |
|-------|----------|---------|
| Auth/user | Layout `useState` | Fetched in layout, passed via props |
| Plans (training) | `useTrainingPlan` hook | Self-contained, returned to page |
| Plans (nutrition) | `useNutritionPlan` hook | Self-contained, returned to page |
| Forms | `useFormBuilder` hook | Self-contained, returned to page |
| Portal auth | `ClientPortalProvider` context | Shared across all portal pages |
| UI state (collapse) | `HeaderCollapseContext` | Shared across coach layout |
| Page-specific | Page `useState` | Local to each page |

### 9.2 Quality

- **No prop drilling beyond 2 levels** — Hooks return all needed data. Pages don't pass plan data down more than one level.
- **Hooks own their state** — The builder hooks are self-contained. Pages just destructure the return value.
- **Context is minimal** — Only 3 contexts, all with clear purposes. No "god context" holding the entire app state.
- **No Redux/Zustand/etc.** — The app uses React's built-in state management. For this scale (3 user roles, ~58 pages), this is appropriate.

---

## 10. CRITICAL ISSUES SUMMARY

| # | Issue | Severity | File(s) | Fix |
|---|-------|----------|---------|-----|
| 1 | **No caching layer** — every navigation refetches everything | HIGH | All 84 files | Add React Query / SWR |
| 2 | **`/api/auth/me` called 2-5x per page load** — redundant workspace validation | HIGH | Sidebar, layout, pages | Create shared auth context |
| 3 | **`useNutritionPlan` is 1117 lines** — god hook, no `useCallback`, N+1 fetch | MEDIUM | `useNutritionPlan.js` | Split into composable hooks, add `useMemo`/`useCallback` |
| 4 | **3 independent unread-badge polls** — Sidebar, NotificationBell, ClientPortalNav | MEDIUM | 3 files | Unify into single polling provider |
| 5 | **No request cancellation** — stale responses update state after navigation | MEDIUM | All pages | Add AbortController to axios instance |
| 6 | **No user-facing error messages** — errors silently logged to console | MEDIUM | 84 files | Add error interceptor + toast system |
| 7 | **`sortedPlans` not memoized** in nutrition hook — re-sorts on every render | LOW | `useNutritionPlan.js:643` | Wrap in `useMemo` |
| 8 | **`handleDeletePlan` stale closure** in training hook | LOW | `useTrainingPlan.js:148` | Use functional updater for `plans` |
| 9 | **No retry/backoff on network errors** | LOW | `lib/axios.js` | Add axios retry interceptor |
| 10 | **Direct `fetch()` in LandingPricing** bypasses shared instance | LOW | `LandingPricing.js:94` | Use `api` instance |

---

## 11. WHAT'S WELL DONE

1. **Single axios instance** — 84 files, zero deviations (except 1 landing page). This is remarkable consistency.

2. **Builder hooks architecture** — The local-edit + explicit-save + dirty-tracking pattern is well-designed for complex nested data (plans → cycles → meals → items → alternatives). It avoids optimistic updates for data where the server assigns IDs.

3. **Temp ID system** — `makeTempId()` enables creating new items before saving. The prefix (`tmp-plan-`, `tmp-cycle-`, etc.) makes it easy to distinguish temp from real IDs.

4. **Blocked delete recovery** — `useFormBuilder` caches deleted questions and restores them if the server refuses the delete. This prevents data loss gracefully.

5. **Context preservation on refetch** — `fetchClientPlans(preserveContext)` keeps the user's selected plan/meal/day after a save-triggered refetch. This is excellent UX.

6. **Optimistic activation** — Plan activation sets status immediately, reverts on error. The user sees instant feedback.

7. **useMediaQuery** — SSR-safe, properly cleaned up, documented. A small but well-crafted hook.

8. **ClientPortalProvider** —pathname-based re-fetch with cancellation flag. Simple, correct, effective.

9. **`nutritionCalc.js`** — Pure functions for calorie/macro calculations. Testable, reusable, no side effects.

10. **`formCompatibility.js`** — Single source of truth for check-in form compatibility, shared between activation modal and package page.

---

## 12. RECOMMENDED ACTIONS (Priority Order)

### Immediate (This Sprint)
1. **Add React Query (TanStack Query)** — Replace manual `useEffect` + `useState` fetch patterns with `useQuery`. This adds caching, deduplication, background refetch, and retry automatically. Highest ROI change.
2. **Create a shared auth context** — Move `/api/auth/me` fetch to a single provider. Eliminate 2-4 redundant calls per page load.

### Short-term (Next Sprint)
3. Split `useNutritionPlan` into composable hooks (`usePlanList`, `usePlanBuilder`, `useFoodItems`)
4. Add `useMemo` to `sortedPlans` in nutrition hook
5. Add `useCallback` to nutrition hook handlers
6. Unify unread-badge polling into a single provider
7. Add error interceptor to axios (toast notification on 4xx/5xx)

### Medium-term
8. Add AbortController support to axios for request cancellation
9. Add retry/backoff with `axios-retry`
10. Implement WebSocket or SSE for real-time messaging (replace 5s polling)
11. Fix stale closure in `handleDeletePlan`

---

*Report generated: 2026-07-14 | Reviewer: Senior Code Reviewer | Next: Phase 5 — Design System & UI*
