# DEPENDENCIES.md — Dependencies Log

Format per package:
```
## [package] v[version]
**Installed:** [date]
**Why:** One sentence
**Used in:** [files or areas]
**Review date:** [3 months from install]
```

---

> Note: Packages below were backfilled from code review on 2026-05-25 — install dates are approximate.

---

## next (App Router)
**Installed:** Project start
**Why:** Full-stack React framework with SSR, file-based routing, and layout nesting for the coach and client portals.
**Used in:** `client/` — every page, layout, and route
**Review date:** 2026-08-25

---

## @heroui/react
**Installed:** Early development
**Why:** Accessible UI component library (Tabs, Card, Avatar, Button, Chip, Skeleton, Disclosure, Separator) that avoids building primitives from scratch.
**Used in:** `client/app/` — throughout all pages and components
**Review date:** 2026-08-25

---

## tailwindcss
**Installed:** Project start
**Why:** Utility-first CSS for rapid, consistent styling without maintaining a separate stylesheet.
**Used in:** All `.js` component files via className strings
**Review date:** 2026-08-25

---

## axios
**Installed:** Early development
**Why:** HTTP client with interceptors for attaching auth credentials and handling 401 redirects globally in `@/lib/axios`.
**Used in:** All components that call the API
**Review date:** 2026-08-25

---

## lucide-react
**Installed:** Early development
**Why:** Consistent icon set used throughout the sidebar and UI components.
**Used in:** `client/app/components/Sidebar.js`, billing page, settings pages
**Review date:** 2026-08-25

---

## express
**Installed:** Project start
**Why:** Minimal Node.js HTTP framework for the REST API backend.
**Used in:** `server/` — all routes and middleware
**Review date:** 2026-08-25

---

## pg (node-postgres)
**Installed:** Project start
**Why:** PostgreSQL client for Node.js. All database queries go through a connection pool.
**Used in:** `server/` — all route handlers and lib files
**Review date:** 2026-08-25

---

## jsonwebtoken
**Installed:** Project start
**Why:** JWT generation and verification for stateless auth. Tokens stored in httpOnly cookies.
**Used in:** `server/middleware/auth.js`, `server/routes/auth.js`
**Review date:** 2026-08-25

---

## Fawaterak (via REST API — not an npm package)
**Integrated:** Phase 9 (2026-05 approx.)
**Why:** Egyptian payment gateway. Supports creating invoices and checking payment status via polling.
**Used in:** `server/routes/billing.js`, `client/app/(coach)/[workspaceSlug]/settings/billing/page.js`
**Review date:** 2026-08-25
