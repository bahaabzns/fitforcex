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

## vitest v4.1.8
**Installed:** 2026-06-11
**Why:** Client had no test runner; needed to unit-test the portal subdomain-slug helper and future client code.
**Used in:** client/lib/coachSlug.test.js (client test suite via `npm test`)
**Review date:** 2026-09-11

---

## file_picker v11.0.2 (Flutter)
**Installed:** 2026-07-12
**Why:** The new Attachment form question type needs a generic native file picker for the "documents"/"any" categories — `image_picker` (already in use) only handles photos/videos, not arbitrary files (PDF, Word, etc.). Vetted: actively maintained, by far the most widely-adopted file-picker plugin on pub.dev, no known CVEs, thin wrapper over platform-native pickers (no realistic hand-rolled alternative).
**Used in:** `mobile/lib/core/media/attachment_answer_field.dart` (Forms `attachment` question renderer)
**Review date:** 2026-10-12

---

## puppeteer v25.4.0
**Installed:** 2026-07-28
**Why:** PDF export feature needs to render a branded HTML template (nutrition/training plan) to a PDF server-side. Vetted: actively maintained by the Chrome team, extremely high adoption, no known CVEs in the library itself (`npm audit` after install showed zero vulnerabilities attributable to puppeteer). Main cost is footprint — bundles a full Chromium binary; accepted for v1 simplicity, `puppeteer-core` + a system-installed Chromium is the fallback if the bundled binary becomes a real deploy problem.
**Used in:** `server/src/lib/pdfRenderer.ts`, `server/src/modules/pdfExport/`
**Review date:** 2026-10-28

---

## image-size v2.0.2
**Installed:** 2026-07-28
**Why:** The PDF cover-page image must exactly match the page's pixel dimensions (it's rendered full-bleed, not scaled/cropped to fit), so the upload needs to be rejected server-side if it doesn't. Vetted: used internally by Next.js itself, zero runtime dependencies, ships a proper CJS build (`require`-safe, unlike puppeteer) so it works fine under this repo's Jest/ts-jest setup, no known CVEs (`npm audit` showed zero vulnerabilities attributable to it). Reads dimensions from the file's header bytes only — no full image decode, no native binary.
**Used in:** `server/src/modules/pdfExport/pdfExport.controller.ts` (`uploadCoverImage`)
**Review date:** 2026-10-28
