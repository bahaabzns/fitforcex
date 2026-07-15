# Phase 10: Performance — Deep Review

**Date:** 2026-07-14
**Scope:** SSR vs CSR ratio, memoization, code splitting, bundle, polling, re-render analysis
**Score: FAIR** (2.5/5) — No code splitting, no React.memo, no caching layer, but good loading boundaries and consistent patterns

---

## 1. CODEBASE METRICS

| Metric | Value |
|--------|-------|
| Total JS files | 213 |
| Total lines | ~38,000 |
| Pages | 62 |
| Client components (`'use client'`) | 43 |
| Server components | ~170 |
| Files using `useMemo`/`useCallback` | 32 |
| `React.memo` usage | **0** |
| `dynamic()` imports (code splitting) | **0** |
| `loading.js` boundaries | 16 |
| `error.js` boundaries | 16 |

---

## 2. SSR vs CSR — Score: **Fair**

### 2.1 Client-Side Rendering Ratio

**43 out of 213 files** (20%) are marked `'use client'`. However, the critical pages are all client-rendered:

| Area | CSR? | Impact |
|------|------|--------|
| Landing page | Yes | No static HTML for SEO |
| Coach layout + all pages | Yes | Full client render |
| Client portal + all pages | Yes | Full client render |
| Admin panel + all pages | Yes | Full client render |
| Auth pages (login, register) | Yes | Full client render |

**Issue:** The entire application is client-side rendered. Next.js 16's server components are not leveraged for any page. This means:
- Search engines see JavaScript-dependent content
- Initial paint requires JavaScript to load and execute
- No static generation for public pages (landing, pricing)

### 2.2 What's Server-Rendered

Only the root `layout.js` is a server component. It handles:
- Cookie reading (theme preference)
- Locale detection
- Font loading
- Provider wrapping

Everything else is client-rendered.

---

## 3. CODE SPLITTING — Score: **Poor**

### 3.1 Dynamic Imports

**Zero `dynamic()` imports** across the entire codebase. This means:
- Every page loads its full JavaScript bundle on mount
- Heavy components (charts, modals, date pickers) are loaded eagerly
- No lazy loading for below-the-fold content

### 3.2 Impact

| Component | Lines | Loaded When |
|-----------|-------|-------------|
| `DataTable` | 791 | Any page using it (immediately) |
| `LandingPricing` | 304 | Landing page (immediately) |
| `AreaChart` | ~200 | Client detail + portal home (immediately) |
| `DatePickerField` | 57 | Any form with dates (immediately) |

### 3.3 Recommendation

```javascript
// Example: Lazy load heavy components
const DataTable = dynamic(() => import('@/app/components/DataTable'), { loading: () => <Skeleton /> });
const AreaChart = dynamic(() => import('@/app/components/charts/AreaChart'), { loading: () => <Skeleton /> });
```

---

## 4. MEMOIZATION — Score: **Fair**

### 4.1 useMemo/useCallback Usage

32 files use `useMemo` or `useCallback`. The builder hooks are the primary users:

| Hook | useMemo | useCallback | Quality |
|------|---------|-------------|---------|
| `useTrainingPlan` | 1 (`sortedPlans`) | 15+ handlers | Very Good |
| `useNutritionPlan` | 0 | 0 | Poor |
| `useFormBuilder` | 0 | 1 (`handleSaveDraft`) | Fair |

### 4.2 Issues

1. **`useNutritionPlan` has zero `useCallback`** — All 32+ handlers are recreated on every render. Child components receiving these handlers re-render unnecessarily.

2. **`useNutritionPlan` has zero `useMemo`** — `sortedPlans` is computed inline (not memoized), re-sorting on every render.

3. **No `React.memo` anywhere** — Not a single component uses `React.memo()` for render optimization. Components like `EmptyState`, `KpiCardGroup`, `SaveStatusIndicator` could benefit.

4. **Landing components have no memoization** — `LandingFeatures`, `LandingTestimonials`, etc. re-render on every state change in the root page.

---

## 5. POLLING — Score: **Poor**

### 5.1 Active Polling Locations

| Component | What | Interval | Impact |
|-----------|------|----------|--------|
| `Sidebar.js` | `/api/messenger/threads` | 5s | High — always mounted |
| `NotificationBell.js` | `/api/notifications/unread-count` | Configurable | Medium |
| `ClientPortalNav.js` | `/api/client-portal/notifications/unread-count` | Configurable | Medium |
| `messenger/page.js` | Message list | 5s | Medium — only when on page |
| `portal/messages/page.js` | Message list | 5s | Medium — only when on page |
| `subscription/page.js` | Payment status | Configurable | Low — one-time check |

### 5.2 Bandwidth Impact

The Sidebar polls every 5 seconds **on every coach page** (it's always mounted). Each poll:
1. Calls `/api/messenger/threads` → returns all threads with unread counts
2. Server queries database for thread list + unread counts
3. Client processes and updates state

With 10 concurrent coaches, that's **120 requests per minute** just for unread badges.

### 5.3 No Backoff

Polling interval doesn't change based on activity. A user idle for 30 minutes still gets polled every 5 seconds.

---

## 6. LOADING & ERROR BOUNDARIES — Score: **Good**

### 6.1 Loading States

16 `loading.js` files provide instant navigation feedback:

```
app/(coach)/[workspaceSlug]/loading.js
app/(coach)/[workspaceSlug]/clients/loading.js
app/(coach)/[workspaceSlug]/clients/[id]/loading.js
app/(client)/portal/loading.js
...
```

**Good:** Next.js streaming SSR shows these loading states immediately while the page component loads.

### 6.2 Error Boundaries

16 `error.js` files catch runtime errors:

```
app/(coach)/[workspaceSlug]/error.js
app/(coach)/[workspaceSlug]/clients/error.js
app/(client)/portal/error.js
...
```

**Good:** Errors are contained to specific routes. A crash in the training page doesn't take down the entire app.

---

## 7. RE-RENDER ANALYSIS — Score: **Fair**

### 7.1 Root Causes

1. **No `React.memo`** — Components re-render when parent re-renders, even if props haven't changed.

2. **No `useCallback` in nutrition hook** — 32+ handler functions recreated every render. Every child component receiving these handlers re-renders.

3. **Polling triggers re-renders** — Sidebar's 5-second poll updates `totalUnread` state, causing the entire Sidebar (and its children) to re-render.

4. **ClientPortalProvider re-fetches on pathname** — Every portal navigation triggers a full auth check, updating context and re-rendering all consumers.

### 7.2 Mitigation

The builder hooks return stable references via `useCallback` (training) or inline functions (nutrition). The training hook's approach is better.

---

## 8. CRITICAL ISSUES SUMMARY

| # | Issue | Severity | Impact |
|---|-------|----------|--------|
| 1 | **No code splitting** — 0 dynamic imports | HIGH | Larger initial bundles, slower first paint |
| 2 | **No caching layer** — every navigation refetches | HIGH | Redundant network requests |
| 3 | **No React.memo** — 0 usages | MEDIUM | Unnecessary re-renders |
| 4 | **No useMemo/useCallback in nutrition hook** | MEDIUM | 32+ handlers recreated every render |
| 5 | **5-second polling on every page** | MEDIUM | Bandwidth waste, server load |
| 6 | **Entire app is CSR** — no server components for pages | MEDIUM | No static generation, poor SEO |
| 7 | **Landing page is CSR** — no static HTML | MEDIUM | Poor SEO for public pages |

---

## 9. WHAT'S WELL DONE

1. **Loading boundaries** — 16 `loading.js` files provide instant navigation feedback. Users see loading states immediately.

2. **Error boundaries** — 16 `error.js` files contain errors to specific routes. A crash doesn't take down the entire app.

3. **Builder hooks memoization** — `useTrainingPlan` properly uses `useCallback` for all handlers. This is the right pattern.

4. **Context preservation** — `fetchClientPlans(preserveContext)` keeps user selections after refetch. No jarring UI resets.

5. **Optimistic UI** — Plan activation sets status immediately, reverts on error. User sees instant feedback.

6. **SSR-safe components** — `useMediaQuery` defaults to `false` on server, `ThemeToggle` renders skeleton during SSR.

---

## 10. RECOMMENDED ACTIONS (Priority Order)

### Immediate
1. Add React.memo to frequently-rendered components (EmptyState, KpiCardGroup, SaveStatusIndicator)
2. Add useMemo to `sortedPlans` in `useNutritionPlan`
3. Add useCallback to `useNutritionPlan` handlers

### Short-term
4. Add `dynamic()` imports for heavy components (DataTable, AreaChart, DatePicker)
5. Add React Query / SWR for API caching
6. Consolidate polling into a single provider

### Medium-term
7. Consider server components for static pages (landing, pricing)
8. Add bundle analysis (`@next/bundle-analyzer`)
9. Implement WebSocket/SSE for real-time features

---

*Report generated: 2026-07-14 | Reviewer: Senior Code Reviewer | Next: Phase 11 — i18n & Accessibility*
