# Phase 2: Routing & Layout — Deep Review

**Date:** 2026-07-14
**Scope:** Route groups, layouts, proxy.js, subdomain routing, navigation, loading/error boundaries
**Score: GOOD** (3.5/5) — Ambitious multi-tenant architecture with solid patterns, but proxy.js is dead code and auth guards are inconsistent

---

## 1. ROUTING ARCHITECTURE OVERVIEW

### 1.1 Route Groups (4)

| Group | Purpose | URL Pattern | Subdomain |
|-------|---------|-------------|-----------|
| `(auth)` | Authentication | `/login`, `/register`, etc. | Root domain |
| `(admin)` | Admin panel | `/admin/...` | `admin.fitforce.app` |
| `(client)` | Client portal | `/portal/...` | `{coach}.fitforce.app` |
| `(coach)` | Coach workspace | `/{workspaceSlug}/...` | `my.fitforce.app` |

**Assessment:** Clean separation. Each role has its own route group with isolated layouts. The use of explicit URL segments (`/admin/`, `/portal/`, `/{slug}/`) inside route groups (which don't add segments) is correct App Router convention.

### 1.2 File Counts

| Type | Count | Coverage |
|------|-------|----------|
| Route groups | 4 | Complete |
| Layout files | 9 | Good — covers all major areas |
| Page files | 58 | Comprehensive |
| Loading files | 16 | Coach-heavy, gaps elsewhere |
| Error files | 16 | Same coverage as loading |
| Not-found files | **0** | **Missing entirely** |
| Template files | 0 | N/A |
| Route handlers | 0 | API lives on separate backend |

---

## 2. PROXY.JS — SUBDOMAIN ROUTING — Score: **Fair**

```
proxy.js (87 lines)
```

### 2.1 Architecture

The subdomain routing system is the most sophisticated piece of infrastructure:

| Subdomain | Behavior | Internal Rewrite |
|-----------|----------|------------------|
| `fitforce.app` (root) | Marketing + auth | None — serves directly |
| `admin.fitforce.app` | Admin panel | `/login` → `/admin/login`, `/users` → `/admin/users` |
| `my.fitforce.app` | Coach workspace | Pass-through |
| `{coach}.fitforce.app` | Client portal | `/{path}` → `/portal/{coachSlug}/{path}` |

### 2.2 Critical Issue: proxy.js Is Dead Code

**The file is named `proxy.js` but Next.js middleware must be named `middleware.js`.**

- Exports `proxy(request)` — Next.js expects `middleware(request)` as default export
- No file in the project imports or references `proxy.js`
- No `middleware.js` exists anywhere in the project
- The `config.matcher` export is correct but meaningless without the right filename

**This means the entire subdomain routing logic is NOT running as Next.js middleware.** The routing must be handled by an external proxy (e.g., Vercel edge, Nginx, Cloudflare Workers) that rewrites requests before they hit Next.js.

**Impact:** If deployed on Vercel with domain configuration, the external proxy handles routing. But the code in `proxy.js` is unreachable dead code — it looks like it should work but doesn't.

### 2.3 Admin Rewrite Logic

```javascript
// proxy.js:47-61
if (subdomain === 'admin') {
    if (pathname.startsWith('/admin')) {
        return new NextResponse(null, { status: 404 });  // Prevent double-prefix
    }
    if (!pathname.startsWith('/api')) {
        const url = request.nextUrl.clone();
        url.protocol = 'http:';
        url.pathname = `/admin${pathname === '/' ? '' : pathname}`;
        return NextResponse.rewrite(url);
    }
    return NextResponse.next();
}
```

**Smart:** The 404 on `/admin` paths prevents double-prefixing (someone manually navigating to `admin.fitforce.app/admin/users`). The `http:` protocol forcing avoids EPROTO on localhost.

**Concern:** If this code were actually running, the `http:` protocol forcing would only work in dev. In production behind HTTPS, this could cause issues depending on the proxy setup.

### 2.4 Coach Slug Rewrite

```javascript
// proxy.js:68-79
if (pathname.startsWith('/portal')) {
    return NextResponse.next();  // Already rewritten
}
const url = request.nextUrl.clone();
url.protocol = 'http:';
url.pathname = `/portal/${subdomain}${pathname === '/' ? '' : pathname}`;
return NextResponse.rewrite(url);
```

**Clean:** Handles the coach subdomain → portal mapping. The `/portal` check prevents double-rewriting.

### 2.5 Config Matcher

```javascript
config: {
    matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.[\\w]+$).*)'],
}
```

**Good:** Correctly excludes static assets, Next.js internals, and files with extensions (prevents rewriting image/CSS/JS requests into portal routes).

---

## 3. LAYOUT HIERARCHY — Score: **Good**

### 3.1 Root Layout (`app/layout.js`)

```javascript
export default async function RootLayout({ children }) {
    const cookieStore = await cookies();
    const theme = cookieStore.get("theme")?.value ?? "system";
    const locale = await getLocale();
    const messages = await getMessages();
    const dir = locale === "ar" ? "rtl" : "ltr";
    // ... renders <Providers> with theme, locale, messages
}
```

**Quality:**
- Server component — correct for reading cookies and i18n
- Theme from cookie (not localStorage) — avoids hydration mismatch
- RTL via `dir` attribute — proper approach
- `suppressHydrationWarning` on `<html>` and `<body>` — necessary for theme class injection
- Inter font loaded via `next/font` — optimal

**Issue:** No `loading.js` at root level — initial page load shows nothing until the root layout's async work completes.

### 3.2 Providers Wrapper (`app/providers.js`)

```javascript
<NextIntlClientProvider locale={locale} messages={messages}>
    <ThemeProvider attribute="class" defaultTheme={defaultTheme} enableSystem>
        <RouterProvider>{children}</RouterProvider>
    </ThemeProvider>
</NextIntlClientProvider>
```

**Clean nesting:** i18n → theme → router. Each layer has a single responsibility.

**Note:** `RouterProvider` from `@heroui/react` is needed for HeroUI's internal routing hooks. This is a HeroUI-specific requirement, not a pattern you'd see in standard Next.js.

### 3.3 Auth Layout (`(auth)/layout.js`)

```javascript
useEffect(() => {
    const { hostname, protocol, port, pathname, search, hash } = window.location;
    const root = ROOT_DOMAIN.split(':')[0].toLowerCase();
    if (hostname.toLowerCase() === `my.${root}`) {
        const host = port ? `${root}:${port}` : root;
        window.location.replace(`${protocol}//${host}${pathname}${search}${hash}`);
    }
}, []);
```

**Purpose:** Strips `my.` subdomain if auth pages are accidentally accessed from workspace subdomain.

**Issues:**
1. **Full page reload** — `window.location.replace()` causes a full page reload instead of client-side navigation
2. **Only checks `my.`** — doesn't handle `admin.` or coach slug subdomains accessing auth pages
3. **No SSR guard** — relies entirely on `useEffect` (client-side), so the redirect flashes the auth page briefly before redirecting
4. **Missing dependency** — `ROOT_DOMAIN` is read from `process.env` at module scope, but the `useEffect` has no dependencies (empty array) — this is fine since it's a constant, but the linter might flag it

### 3.4 Admin Layout (`(admin)/admin/layout.js`)

**Auth guard pattern:**
```javascript
useEffect(() => {
    if (isLoginPage) { setLoading(false); return; }
    api.get('/api/admin/me')
        .then(res => { setAdmin(res.data); setLoading(false); })
        .catch(() => { window.location.href = '/login'; });
}, [isLoginPage]);
```

**Issues:**
1. **Client-side only auth** — no middleware protection. An unauthenticated user sees the loading skeleton before being redirected
2. **`window.location.href`** for logout/redirect — causes full page reload, losing any in-memory state
3. **No role validation** — once authenticated, any admin can access all admin pages (no role-based routing)
4. **Hardcoded strings** — "FitForce X", "Admin Panel", "Sign out" are not i18n-ized (unlike the coach layout which uses `useTranslations`)
5. **Missing `loading.js` for admin login** — the admin login page has no loading boundary
6. **Sidebar is inline** — the entire admin sidebar (80+ lines) is defined inside the layout component instead of being extracted to `app/components/`

**Admin login redirect:**
```javascript
// admin/login/page.js:25
await api.post('/api/admin/login', { email, password });
router.push('/');
```

After login, `router.push('/')` on `admin.fitforce.app` goes to root `/`. But the proxy.js (if it were running) would rewrite this to `/admin/`. Without the proxy, this navigates to the marketing landing page — which is wrong for admin. This only works if the external proxy handles the rewrite.

### 3.5 Coach Layout (`(coach)/layout.js`) — Score: **Good**

The most complex layout at 260 lines. Handles:
- Authentication via `/api/auth/me`
- Workspace validation (slug must match current workspace)
- Workspace switching (if slug doesn't match, switch or redirect)
- Breadcrumb generation
- Header collapse state
- Client label fetching for breadcrumbs

**Auth guard pattern:**
```javascript
useEffect(() => {
    api.get('/api/auth/me')
        .then(res => {
            const data = res.data;
            const currentSlug = data?.currentWorkspace?.slug;
            if (!currentSlug) { router.push('/login'); return; }
            if (currentSlug !== workspaceSlug) {
                // Try to switch workspace, or redirect
            } else {
                setLoading(false);
            }
        })
        .catch(() => router.push('/login'));
}, [router, workspaceSlug]);
```

**Quality observations:**
- Handles workspace mismatch gracefully (auto-switch if user has access)
- Falls back to current workspace dashboard if target workspace isn't in user's list
- Client label fetched separately to avoid blocking the main render

**Issues:**
1. **Redundant `/api/auth/me` calls** — The coach layout calls `/api/auth/me`, and the Sidebar component ALSO calls `/api/auth/me` independently. That's 2 identical API calls on every page load
2. **`getPageInfo()` is a 100-line if/else chain** — Uses `pathname.includes()` for matching, which can produce false positives (e.g., `/clients` matches `/clients/[id]` paths). A route map or regex-based approach would be more reliable
3. **Missing `useCallback`** — The `load` function in settings layout has `useCallback` but the coach layout's auth check doesn't
4. **No error state** — If `/api/auth/me` returns unexpected data (e.g., `currentWorkspace` is null but user is authenticated), the layout silently redirects to login without explanation

### 3.6 Client Portal Layout (`(client)/portal/layout.js`) — Score: **Good**

```javascript
const PROTECTED = ['/portal/home', '/portal/nutrition', '/portal/training', ...];

function PortalShell({ children }) {
    const { loading, access, status } = useClientPortal();
    // Shows status card if portal access is restricted
    // Shows nav + children otherwise
}

export default function ClientLayout({ children }) {
    const isLoginPage = !PROTECTED.some(p => pathname.startsWith(p));
    if (isLoginPage) return <>{children}</>;
    return <ClientPortalProvider><PortalShell>{children}</PortalShell></ClientPortalProvider>;
}
```

**Quality:**
- Clean separation: login pages skip the provider/nav entirely
- Subscription status gating (frozen/expired) with dedicated status card
- Access-based nav item filtering

**Issues:**
1. **Hardcoded protected routes** — The `PROTECTED` array must be kept in sync manually. If a new portal route is added but not to this array, it renders without the provider
2. **No `not-found.js`** — Invalid portal routes show Next.js default 404 instead of a branded page
3. **`ClientPortalProvider` re-fetches on every route change** — `useEffect` with `[pathname]` dependency means every navigation triggers a new `/api/client-portal/me` call. This is intentional (to reflect access updates) but adds latency

### 3.7 Client Detail Layout (`(coach)/[workspaceSlug]/clients/[id]/layout.js`) — Score: **Fair**

The most innovative layout — implements keep-alive for Nutrition and Training tabs:

```javascript
// Lazy keep-alive: once visited, tab stays mounted
const [nutriMounted, setNutriMounted] = useState(isNutrition);
const [trainMounted, setTrainMounted] = useState(isTraining);
if (isNutrition && !nutriMounted) setNutriMounted(true);
if (isTraining  && !trainMounted) setTrainMounted(true);
```

**Smart patterns:**
- Tabs rendered as HeroUI `TabsRoot` with segment variant
- Sliding indicator with CSS transitions for tab highlight animation
- Dirty state interception via document click handler
- `PageHeaderActionsContext` lets child pages inject header buttons
- Keep-alive via `display: none` — preserves React state without remounting

**Issues:**
1. **Direct page imports** — `import NutritionPage from "./nutrition/page"` and `import TrainingPage from "./training/page"` — these page components are imported as React components and rendered directly, bypassing Next.js routing for these two tabs. This means `/clients/[id]/nutrition` URL shows the page, but the component is actually rendered by the layout, not by Next.js routing
2. **Dirty state uses `window.confirm()`** — native browser dialog, not a styled modal. Inconsistent with the rest of the UI which uses HeroUI Modal
3. **Tab click interception** — The `useEffect` that intercepts link clicks to check dirty state uses event delegation on `document`. This could conflict with other click handlers
4. **Missing tabs** — "Transformation" and "Workout Logs" routes exist (`/clients/[id]/transformation`, `/clients/[id]/workout-logs`) but are NOT in the tab list. These routes render via `isOther` path, meaning they don't get keep-alive
5. **SlidingIndicator uses DOM queries** — `container.querySelector('[data-slot="tabs-tab"][data-selected="true"]')` depends on HeroUI's internal data attributes. If HeroUI changes these attributes in a minor version, the indicator breaks silently

### 3.8 Settings Layout (`(coach)/[workspaceSlug]/settings/layout.js`)

```javascript
const TAB_KEYS = ["account", "workspace", "subscription", "client-experience", "advanced"];
// ...
const activeKeyMatch = pathname.match(/\/settings\/([^/]+)/);
const activeKey = TAB_KEYS.includes(activeKeyMatch?.[1]) ? activeKeyMatch[1] : "account";
```

**Quality:**
- Role-based tab visibility (`isOwner` controls subscription and advanced tabs)
- Loads workspace + members data for settings context
- Vertical tabs with HeroUI Tabs component

**Issues:**
1. **No `billing` tab** — The route `/{slug}/settings/billing` exists as a page, but `billing` is not in `TAB_KEYS`. Navigating to `/settings/billing` falls back to showing the "account" tab as active while rendering the billing page content — confusing UX
2. **Data loading is sequential** — `meRes` → then `wsId` → then `Promise.all([ws, members])`. The workspace and members calls could start as soon as `wsId` is known, which they do, but the initial `/api/auth/me` blocks everything
3. **`use(params)` for workspaceSlug** — Correct Next.js 16 pattern for unwrapping params in client components

### 3.9 Training & Nutrition Layouts

Both are identical 7-line server components:
```javascript
export default function TrainingLayout({ children }) {
    return <div className="p-6 flex flex-col h-full"><div className="flex-1 min-h-0">{children}</div></div>;
}
```

**Assessment:** Minimal wrappers. Fine for their purpose but could be consolidated into a shared layout if more sections need this pattern.

---

## 4. NAVIGATION COMPONENTS — Score: **Good**

### 4.1 Sidebar (`app/components/Sidebar.js`) — 582 lines

The largest navigation component. Features:
- Collapsible sidebar with brand logo swap (light/dark)
- Expandable disclosure sections (Finance, Forms, Nutrition, Training)
- Workspace switcher with dropdown
- Client portal link with copy-to-clipboard
- Unread message count (polled every 5 seconds)
- Logout confirmation modal
- User badge with avatar

**Quality:**
- Clean use of HeroUI Disclosure for expandable sections
- i18n-ized via `useTranslations('nav')` and `useTranslations('sidebar')`
- RTL-aware with `rtl:rotate-180` class on chevrons
- Collapsed state collapses all disclosure sections

**Issues:**
1. **Own `/api/auth/me` call** — Sidebar fetches user data independently from the coach layout. Both components make this call on mount, resulting in duplicate requests
2. **5-second polling for unread messages** — `setInterval(fetchUnread, 5000)` runs indefinitely. This is aggressive — 15 seconds (like the portal nav uses) would be more appropriate for a desktop app
3. **Inline styles for badge** — Lines 215-220 use inline `style={{...}}` instead of Tailwind classes. Inconsistent with the rest of the component
4. **No keyboard navigation for disclosure sections** — The Disclosure.Trigger has `disabled={collapsed}` but doesn't handle Escape key to close
5. **Logout uses `window.location.href`** — Full page reload. The comment explains why (to reset auth state), but this could be handled with a proper logout flow that clears cookies and redirects via router

### 4.2 ClientPortalNav (`app/components/ClientPortalNav.js`) — 159 lines

Mobile-first bottom tab bar for the client portal.

**Quality:**
- Access-based nav filtering (`can('view_nutrition_plans')`, etc.)
- Sticky header with profile avatar + notifications
- Subscription status banner
- Unread notification count (polled every 15 seconds — better than Sidebar's 5s)

**Issues:**
1. **No safe area padding** — The fixed bottom bar doesn't account for `env(safe-area-inset-bottom)` on iOS devices with notches. Content behind the bar may be inaccessible
2. **Hardcoded `/portal/` prefix** — All hrefs use `/portal/...` directly instead of being derived from the proxy rewrite. If the routing changes, all links break
3. **No active state for profile** — Profile link uses ring styling for active state, but notifications use bg styling — inconsistent active indicators
4. **Missing `notifications` in PROTECTED array** — The layout's `PROTECTED` array includes `/portal/notifications` but the nav component shows it regardless of access permissions

### 4.3 Breadcrumb Generation (`getPageInfo()` in coach layout)

```javascript
function getPageInfo(pathname, { slug, clientId, clientLabel, tNav } = {}) {
    if (p.includes('/dashboard')) return { ... };
    if (p.includes('/clients')) return { ... };
    // ... 100 lines of if/else
}
```

**Issues:**
1. **`pathname.includes()` is fragile** — `/training/exercises` matches both `/training` and `/training/exercises` checks. The order of checks matters and could break if routes are reordered
2. **Client label fetched separately** — The breadcrumb needs the client name, which requires an API call. This means breadcrumbs may flash "Loading..." or show stale data
3. **No route map** — A structured route config object would be more maintainable and testable than if/else chains

---

## 5. LOADING & ERROR BOUNDARIES — Score: **Fair**

### 5.1 Coverage Map

| Route Group | loading.js | error.js | not-found.js |
|-------------|-----------|----------|--------------|
| Root `/` | **No** | **No** | **No** |
| `(auth)/*` | **No** | **No** | **No** |
| `(admin)/admin/` | Yes | Yes | **No** |
| `(admin)/admin/users` | Yes | Yes | **No** |
| `(admin)/admin/workspaces` | Yes | Yes | **No** |
| `(client)/portal/` | **No** | **No** | **No** |
| `(client)/portal/nutrition` | Yes | Yes | **No** |
| `(coach)/*/dashboard` | Yes | Yes | **No** |
| `(coach)/*/clients` | Yes | Yes | **No** |
| `(coach)/*/clients/[id]` | Yes | Yes | **No** |
| `(coach)/*/clients/[id]/*` | 4 of 7 | 4 of 7 | **No** |
| `(coach)/*/forms` | Yes | Yes | **No** |
| `(coach)/*/nutrition/*` | 2 of 2 | 2 of 2 | **No** |
| `(coach)/*/training/*` | 1 of 3 | 1 of 3 | **No** |
| `(coach)/*/team` | Yes | Yes | **No** |
| `(coach)/*/settings/*` | **No** | **No** | **No** |
| `(coach)/*/finance/*` | **No** | **No** | **No** |
| `(coach)/*/messenger` | **No** | **No** | **No** |
| `(coach)/*/plans-queue` | **No** | **No** | **No** |
| `(coach)/*/billing/*` | **No** | **No** | **No** |

### 5.2 Issues

1. **Zero `not-found.js` files** — The entire app relies on Next.js default 404. For a multi-tenant app, this is a missed opportunity for branded 404 pages and redirect suggestions
2. **Auth pages have no loading/error boundaries** — Login, register, forgot-password pages show raw loading spinners instead of skeleton-based loading states
3. **Portal pages (except nutrition) have no loading/error boundaries** — Training, forms, messages, profile pages have no loading state — users see blank content until data loads
4. **Settings pages have no loading/error boundaries** — All 6 settings sub-pages lack loading states
5. **Finance, messenger, plans-queue, billing** — These entire sections have zero loading/error coverage
6. **Inconsistent error component** — Coach and admin sections use `ErrorState` component, but the admin login uses raw `<p className="text-red-500">` for errors

### 5.3 ErrorState Component

```javascript
export default function ErrorState({ error, reset }) {
    return (
        <div className="p-6 flex flex-col items-center justify-center min-h-[60vh]">
            <Alert>
                <Alert.Indicator />
                <Alert.Content>
                    <Alert.Title>{t('somethingWentWrong')}</Alert.Title>
                    <Alert.Description>{error?.message || t('unexpectedError')}</Alert.Description>
                </Alert.Content>
            </Alert>
            <Button variant="primary" onClick={() => reset()}>{t('tryAgain')}</Button>
        </div>
    );
}
```

**Quality:** Clean, i18n-ized, uses HeroUI Alert. Good reusable pattern.

**Issue:** The `reset()` function only resets the error boundary — it doesn't re-fetch data. For pages that fetch data in `useEffect`, the error boundary reset won't trigger a refetch.

---

## 6. AUTH GUARD PATTERNS — Score: **Poor**

### 6.1 Pattern Inventory

| Component | Auth Check | Redirect Method | Protection Level |
|-----------|-----------|-----------------|-----------------|
| `(auth)/layout.js` | None (strips subdomain) | `window.location.replace` | Subdomain correction only |
| `(admin)/admin/layout.js` | `/api/admin/me` | `window.location.href` | Client-side, loading flash |
| `(coach)/layout.js` | `/api/auth/me` | `router.push` | Client-side, loading flash |
| `(client)/portal/layout.js` | `/api/client-portal/me` via provider | `router.push` | Client-side, loading flash |
| `(coach)/[workspaceSlug]/dashboard/page.js` | `/api/dashboard` | `router.push` | Redundant with layout |
| `(client)/portal/page.js` | `/api/client-portal/me` | `router.replace` | Session check |

### 6.2 Problems

1. **No server-side protection** — Every auth check is client-side via `useEffect`. An unauthenticated user always sees the loading skeleton before being redirected. This is a security concern (layout structure leaks) and UX concern (flash of loading state)

2. **Redundant auth calls** — On a typical coach page load:
   - Coach layout: `/api/auth/me` (1 call)
   - Sidebar: `/api/auth/me` (1 call)
   - Dashboard page: `/api/dashboard` (1 call, which likely also validates auth)
   - Total: 3+ API calls before content renders

3. **Inconsistent redirect methods** — Some use `router.push()` (client-side nav), others use `window.location.href` (full reload). The choice seems arbitrary rather than intentional

4. **No auth middleware** — The `proxy.js` file handles subdomain routing but not authentication. A proper `middleware.js` could check auth cookies server-side and redirect before the layout even renders

5. **Portal re-fetches on every navigation** — `ClientPortalProvider` has `[pathname]` dependency, meaning every route change triggers a new auth check. This is 2-3x more auth calls than the coach layout

---

## 7. REDIRECTS & NAVIGATION FLOWS — Score: **Good**

### 7.1 next.config.mjs Redirects

```javascript
async redirects() {
    return [
        { source: '/client/forms/:id', destination: '/portal/forms/:id', permanent: true },
        { source: '/portal/transformation', destination: '/portal/home', permanent: true },
    ];
}
```

**Quality:** Clean, permanent redirects for URL structure changes. The `/client/forms/:id` → `/portal/forms/:id` suggests a previous URL structure migration.

### 7.2 Login Flow

**Coach login:**
1. `/login` → POST `/api/auth/login` → GET `/api/auth/me` → `redirectToDashboard(slug)`
2. `redirectToDashboard` navigates to `my.{domain}/{slug}/dashboard`
3. Coach layout validates slug matches workspace

**Client portal login:**
1. `/{coachSlug}.domain/portal` → POST `/api/client-portal/login` → `router.push("/portal/home")`
2. Portal layout validates session via provider

**Admin login:**
1. `/admin/login` → POST `/api/admin/login` → `router.push('/')`
2. On admin subdomain, `/` is rewritten to `/admin/` (by proxy, if running)

### 7.3 Legacy Redirect

```javascript
// portal/[coachSlug]/page.js
// Redirects old /portal/{slug} URLs to {slug}.domain/portal
useEffect(() => {
    window.location.replace(`${protocol}//${host}/portal`);
}, [coachSlug]);
```

**Good:** Backward compatibility for old portal URLs. Full redirect (not rewrite) to avoid URL confusion.

---

## 8. CONTEXT & STATE MANAGEMENT — Score: **Good**

### 8.1 Contexts Used in Routing

| Context | Location | Purpose |
|---------|----------|---------|
| `HeaderCollapseContext` | Coach layout | Toggle header visibility for client detail view |
| `PageHeaderActionsContext` | Client detail layout | Let child pages inject header action buttons |
| `ClientPortalContext` | Portal layout | Share auth state, access flags, subscription status |

**Quality:** All three are lightweight, single-purpose contexts. No prop drilling through layout hierarchy.

### 8.2 HeaderCollapseProvider

```javascript
const [headerCollapsed, setHeaderCollapsed] = useState(false);
```

Simple boolean state. Used by:
- Coach layout (reads to conditionally render header)
- Client detail layout (provides toggle button and auto-collapse for non-client routes)

**Issue:** No persistence — header state resets on navigation. Could use `sessionStorage` to remember preference.

---

## 9. CRITICAL ISSUES SUMMARY

| # | Issue | Severity | File | Fix |
|---|-------|----------|------|-----|
| 1 | **proxy.js is dead code** — named export, wrong filename, never imported | HIGH | `proxy.js` | Rename to `middleware.js`, change to default export, or document that external proxy handles routing |
| 2 | **Zero not-found.js files** — no branded 404 anywhere | HIGH | `app/` | Add `not-found.js` at root, in each route group, and in the portal |
| 3 | **No server-side auth guards** — all auth is client-side useEffect | HIGH | All layouts | Add auth middleware or server-side session checks |
| 4 | **Redundant /api/auth/me calls** — 2-3 per page load | MEDIUM | Sidebar, layout | Consolidate auth data fetching into a single provider or middleware |
| 5 | **Loading/error gaps** — 40%+ of routes lack boundaries | MEDIUM | Various | Add loading.js and error.js to all route segments |
| 6 | **Auth pages not i18n-ized** — admin login, portal login have hardcoded English | MEDIUM | Auth pages | Use useTranslations like coach layout does |
| 7 | **Client detail keep-alive uses DOM queries** — fragile HeroUI coupling | MEDIUM | `clients/[id]/layout.js` | Abstract DOM queries behind a stable API or use ref-based measurement |
| 8 | **Settings billing tab missing from TAB_KEYS** — wrong active state | LOW | `settings/layout.js` | Add "billing" to TAB_KEYS array |
| 9 | **Sidebar polls every 5 seconds** — aggressive for desktop | LOW | `Sidebar.js` | Increase to 15s like portal nav |
| 10 | **No safe-area-inset on portal bottom nav** — iOS notch overlap | LOW | `ClientPortalNav.js` | Add `pb-safe` or `env(safe-area-inset-bottom)` |

---

## 10. WHAT'S WELL DONE

1. **Subdomain multi-tenancy architecture** — The conceptual design of root/my./admin./{coach}. subdomains is production-grade. Each role has its own isolated URL space and layout.

2. **Client detail keep-alive pattern** — The lazy-mount + display:none approach for Nutrition and Training tabs preserves form state across tab switches. This is a sophisticated UX pattern rarely seen in Next.js apps.

3. **Dirty state interception** — The document-level click handler that intercepts navigation when unsaved changes exist is clever. It prevents data loss without requiring a custom router.

4. **Access-based portal navigation** — The `can()` helper that filters nav items based on subscription access flags is clean and maintainable.

5. **Provider architecture** — Three focused contexts (HeaderCollapse, PageHeaderActions, ClientPortal) instead of one monolithic state store. Each has a clear single responsibility.

6. **Loading skeleton consistency** — Where loading.js exists, it uses HeroUI Skeleton consistently. The visual language is uniform.

7. **Legacy URL redirect** — The backward-compatible redirect for old portal URLs shows attention to existing user bookmarks and shared links.

8. **RTL breadcrumb handling** — The `isRtl` check on TabSeparator positioning shows awareness of directional layout needs.

---

## 11. RECOMMENDED ACTIONS (Priority Order)

### Immediate (Before Next Commit)
1. **Rename `proxy.js` → `middleware.js`** and change `export function proxy` to `export default function middleware` — or add a comment explaining why it's dead code
2. **Add root `not-found.js`** with branded 404 page and navigation links

### Short-term (This Sprint)
3. Add `loading.js` and `error.js` to all coach settings, finance, messenger, plans-queue, and billing routes
4. Add `loading.js` and `error.js` to all client portal routes (training, forms, messages, profile, notifications)
5. Consolidate `/api/auth/me` calls — either use a single auth provider at root layout level, or remove the redundant call from Sidebar
6. I18n-ize admin login and portal login pages (replace hardcoded strings with `useTranslations`)
7. Add `"billing"` to `TAB_KEYS` in settings layout

### Medium-term
8. Add server-side auth middleware (or at minimum, cookie-based checks in middleware.js)
9. Add `not-found.js` to each route group with role-appropriate navigation
10. Increase Sidebar unread poll interval from 5s to 15s
11. Add `env(safe-area-inset-bottom)` to portal bottom nav
12. Extract admin sidebar into a separate component file
13. Replace `pathname.includes()` breadcrumb matching with a route map config

---

*Report generated: 2026-07-14 | Reviewer: Senior Code Reviewer | Next: Phase 3 — Auth & Security*
