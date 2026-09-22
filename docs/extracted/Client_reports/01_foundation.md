# Phase 1: Foundation & Config — Deep Review

**Date:** 2026-07-13
**Scope:** package.json, config files, globals.css, lib/, proxy.js, docs, .gitignore
**Score: FAIR** (3.0/5) — Solid architecture, but significant dead weight and documentation drift

---

## 1. DEPENDENCY AUDIT — `package.json`

### 1.1 Dead Dependencies (UNUSED — zero imports found)

| Package | Version | Imports Found | Action |
|---------|---------|---------------|--------|
| `@fortawesome/fontawesome-svg-core` | ^7.2.0 | **0** | **REMOVE** |
| `@fortawesome/free-solid-svg-icons` | ^7.2.0 | **0** | **REMOVE** |
| `@fortawesome/react-fontawesome` | ^3.3.1 | **0** | **REMOVE** |
| `@phosphor-icons/react` | ^2.1.10 | **0** | **REMOVE** |
| `framer-motion` | ^12.38.0 | **0** | **REMOVE** |
| `class-variance-authority` | ^0.7.1 | **0** | **REMOVE** |

**6 dead packages** — these add to `node_modules` size, install time, and potential security surface without being used anywhere in the 213 source files.

**Estimated dead weight:** ~15-25 MB in node_modules (FontAwesome alone is ~8MB, framer-motion ~4MB).

**Note:** `.github/copilot-instructions.md:181` explicitly says "Use **lucide-react** only. Never use other icon libraries." — yet FontAwesome and Phosphor are still in dependencies. This was likely a migration that was never completed (packages removed from imports but never from package.json).

### 1.2 Active Dependencies (used in codebase)

| Package | Version | Usage | Verdict |
|---------|---------|-------|---------|
| `next` | ^16.2.9 | Core framework | KEEP — latest major |
| `react` / `react-dom` | 19.2.4 | UI library | KEEP — pin exact version (already done) |
| `@heroui/react` | ^3.0.4 | UI component library (80%+ of UI) | KEEP |
| `axios` | ^1.15.0 | HTTP client (`lib/axios.js`) | KEEP |
| `next-intl` | ^4.12.0 | i18n (EN/AR) | KEEP |
| `next-themes` | ^0.4.6 | Dark/light mode | KEEP |
| `lucide-react` | ^1.17.0 | Icons (81 import sites) | KEEP |
| `clsx` | ^2.1.1 | ClassName utility | KEEP |
| `tailwind-merge` | ^3.5.0 | Tailwind class dedup | KEEP |
| `tailwindcss` | ^4 | Styling | KEEP |
| `@tailwindcss/postcss` | ^4 | PostCSS plugin | KEEP |
| `eslint` / `eslint-config-next` | ^9 / 16.2.4 | Linting | KEEP |
| `vitest` | ^4.1.8 | Test runner | KEEP |

### 1.3 Dependency Concerns

1. **`@heroui/react` is a barrel import** — importing from `@heroui/react` loads the entire component library. The `transpilePackages` config in `next.config.mjs:10` helps with tree-shaking at build time, but this is still a heavy import path. Consider importing specific components: `import { Button } from "@heroui/react/button"`.

2. **No lock on `@heroui/react` version** — `^3.0.4` allows any 3.x. HeroUI is still relatively young (post-NextUI rename) and may have breaking changes in minor versions. Consider pinning to `3.0.4` exactly.

3. **React 19.2.4 is pinned exactly** (no caret) — good practice for the core runtime.

4. **No `engines` field** — `package.json` doesn't specify Node.js version requirements. With Next.js 16, Node 20+ is likely required.

### 1.4 Scripts Audit

| Script | Command | Assessment |
|--------|---------|------------|
| `dev` | `next dev` | OK — but no `--turbo` flag despite Turbopack config in `next.config.mjs:16-18` |
| `build` | `next build` | OK |
| `start` | `next start` | OK |
| `lint` | `eslint` | OK — runs flat config |
| `test` | `vitest run` | OK — but **no vitest.config file exists** (see section 4) |
| `test:watch` | `vitest` | OK |

**Missing scripts:**
- No `lint:fix` for auto-fixing
- No `typecheck` (no TypeScript, so N/A)
- No `format` (no Prettier configured)

---

## 2. CONFIG FILES ANALYSIS

### 2.1 `next.config.mjs` — Score: **Good**

```
next.config.mjs (35 lines)
```

**What it does:**
- Integrates `next-intl` plugin via `createNextIntlPlugin` — correct
- `transpilePackages: ["@heroui/react", "@heroui/styles"]` — needed for HeroUI's ESM exports
- `allowedDevOrigins` — allows subdomain-based dev on `lvh.me` and `localhost` — smart for testing proxy routing locally
- `turbopack.root` — pins root to prevent monorepo detection issues
- 2 redirects: `/client/forms/:id` → `/portal/forms/:id` (permanent), `/portal/transformation` → `/portal/home` (permanent)

**Issues:**
- `dev` script doesn't pass `--turbo` but Turbopack config exists — either enable it or remove the config
- No `images` config for external image domains (coach avatars, food images, etc.) — may cause runtime errors if `next/image` is used with remote URLs
- No `poweredByHeader: false` — minor security improvement
- No `reactStrictMode: true` — recommended for catching side-effect bugs

### 2.2 `eslint.config.mjs` — Score: **Poor**

```
eslint.config.mjs (16 lines)
```

**What it does:** Uses `eslint-config-next/core-web-vitals` with flat config format.

**Issues:**
- **Zero custom rules** — no `no-console` (70 console.errors in codebase), no import ordering, no unused-vars enforcement
- No `react-hooks/exhaustive-deps` override (may produce noise or miss real deps issues)
- No `no-alert` rule (12 `window.alert`/`window.confirm` usages)
- No Prettier integration — formatting inconsistencies possible

### 2.3 `postcss.config.mjs` — Score: **Excellent**

```
postcss.config.mjs (7 lines)
```

Clean, minimal. Tailwind v4 via `@tailwindcss/postcss`. No issues.

### 2.4 `jsconfig.json` — Score: **Good**

```
jsconfig.json (7 lines)
```

Single path alias: `@/*` → `./*`. Works correctly. Enables clean imports like `import api from "@/lib/axios"`.

**Note:** If TypeScript migration ever happens, this will convert directly to `tsconfig.json` with the same `paths` config.

### 2.5 `proxy.js` (Middleware) — Score: **Excellent**

```
proxy.js (87 lines)
```

**Architecture:** Subdomain-based multi-tenancy routing. This is the most sophisticated piece of infrastructure in the project.

| Subdomain | Routes To | Mechanism |
|-----------|-----------|-----------|
| `fitforce.app` (root) | Marketing + auth pages | `NextResponse.next()` |
| `my.fitforce.app` | Coach workspace (`/{slug}/...`) | Pass-through |
| `admin.fitforce.app` | Admin panel (`/admin/...`) | Rewrite `/login` → `/admin/login` |
| `{coach}.fitforce.app` | Client portal (`/portal/{slug}/...`) | Rewrite `/{path}` → `/portal/{slug}/{path}` |
| `www`, `api`, `mail`, `smtp` | Reserved, pass-through | `NextResponse.next()` |

**Quality observations:**
- Well-structured with `RESERVED` Set for non-coach subdomains
- `PUBLIC_ROOT_SEGMENTS` Set cleanly defines which root paths are public
- Correct `http:` protocol forcing for internal rewrites (avoids EPROTO on localhost)
- `config.matcher` correctly excludes static files and `_next` internals
- Admin 404 on `/admin/*` paths prevents double-prefixing

**Minor concern:** The function is exported as `proxy` (line 8) but Next.js middleware expects `middleware` as the default export. This file works because it's likely referenced/renamed in the actual middleware setup, or used as a utility within the real middleware file. Worth verifying.

### 2.6 `.gitignore` — Score: **Good**

- Properly ignores `node_modules`, `.next`, `coverage`, `.env*`
- No `.env.example` in the repo — missed opportunity for developer onboarding

---

## 3. GLOBALS.CSS — DESIGN TOKENS & THEME SYSTEM — Score: **Excellent**

```
app/globals.css (377 lines)
```

This is the best-architected file in the project. Detailed analysis:

### 3.1 Token System

**Light mode (`:root`)**:
| Token | Value | Purpose |
|-------|-------|---------|
| `--accent` | `oklch(0.675 0.18 249)` | Brand blue (#159bff) |
| `--destructive` | `hsl(0 84% 60%)` | Error/delete red |
| `--muted-foreground` | `hsl(220 9% 46%)` | Secondary text |
| `--border` | `hsl(220 13% 91%)` | Default borders |
| `--sidebar-*` | 5 tokens | Sidebar-specific |
| `--app-surface-*` | 4 tokens | Surface elevation system |

**Dark mode (`.dark`)**:
- Accent lightened from `0.675` → `0.72` lightness for WCAG contrast
- Muted foreground raised from `46%` → `65%` lightness for WCAG AA
- Border raised from `91%` → `26%` for visibility
- Surface elevation uses deliberate oklch spacing: panel→card +3pp, card→input +5pp, card→hover +7pp
- Shadow restored via glass-edge highlight (`surface-shadow`)

**Quality notes:**
- Uses modern `oklch` color space — better perceptual uniformity than HSL
- Comments document WCAG contrast decisions
- Surface elevation system is well-thought-out with explicit lightness deltas
- Brand wordmark swap (dark/light) is flash-free via CSS-only (no JS)

### 3.2 Tailwind v4 `@theme inline` Block

Maps CSS custom properties to Tailwind utility values:
- `--color-primary` → `var(--primary)`
- `--color-sidebar-*` → sidebar tokens
- `--color-app-surface-*` → elevation tokens
- `--radius-lg/md/sm` → derived from `--radius` base
- `--font-sans` → Inter + system fallbacks

### 3.3 Base Layer

```css
* {
  border-color: var(--border);
  transition: background-color 200ms ease, border-color 200ms ease, color 150ms ease;
}
```

**CONCERN:** The universal `transition` on `*` applies to ALL elements. While this creates smooth theme transitions, it can:
- Cause layout thrashing on dynamically inserted elements
- Create unexpected transitions on elements that shouldn't transition
- Slightly hurt performance on pages with many DOM nodes

### 3.4 Component Helpers

- `.auth-wrapper`, `.auth-card`, `.auth-title`, `.auth-form`, `.auth-link` — clean auth page styling
- `.sidebar` — width `16rem` → `4rem` collapsed, with transition
- `.action-bar` — sophisticated floating pill toolbar with `data-open` gating, gradient scrim, sidebar-aware positioning
- RTL overrides for sidebar border, table corner rounding, tab separators, search icon margins

### 3.5 RTL Support

Comprehensive RTL handling (lines 267-377):
- Sidebar border direction swap
- Table corner rounding reversal (`:first-child`/`:last-child` radii)
- Tab separator positioning
- Search field icon margin mirroring

### 3.6 Sets Table Styling

Lines 282-326: Specialized `.sets-table` styling for the training plan exercise sets grid:
- Ghost inputs (transparent → surface on hover → prominent on focus)
- Flattened headers (no card surface, single underline)
- Row borders stripped

---

## 4. LIB/ FILES — Score: **Good**

```
lib/
├── axios.js              (7 lines)   — Axios instance
├── coachSlug.js          (?)         — Subdomain slug extraction
├── coachSlug.test.js     (60 lines)  — Tests for coachSlug
├── formCompatibility.js  (10 lines)  — Check-in form type matching
├── normalizeEmail.js     (9 lines)   — Trim + lowercase
├── nutritionCalc.js      (43 lines)  — Macro calculations
└── utils.js              (6 lines)   — cn() helper
```

| File | Lines | Assessment |
|------|-------|------------|
| `axios.js` | 7 | Minimal — no interceptors, no retry, no error transformation. Intentionally thin. |
| `utils.js` | 6 | Standard `cn()` using clsx + tailwind-merge. No issues. |
| `formCompatibility.js` | 10 | Clean single-purpose function with clear JSDoc. |
| `normalizeEmail.js` | 9 | Clean. Good defensive `(email || '')` handling. |
| `nutritionCalc.js` | 43 | Pure functions, no side effects. Uses `r2()` for rounding. Clean. |

**Missing from lib/:**
- No error reporting utility (Sentry, etc.)
- No API response type definitions
- No shared constants file
- No date utility (lives in `utils/date.js` instead)

---

## 5. I18N REQUEST CONFIG — Score: **Good**

```
i18n/request.js (25 lines)
```

- Validates against `VALID_LOCALES = ['en', 'ar']`
- Falls back to `NEXT_LOCALE` cookie → default `'en'`
- Dynamic `import()` for locale messages — enables code-splitting of translation bundles

---

## 6. DOCUMENTATION FILES — Score: **Poor**

### 6.1 `DESIGN_SYSTEM.md` — OUTDATED / CONFLICTING

This 846-line document describes a **shadcn/ui** design system with:
- Radix UI primitives
- TypeScript-first components
- HSL color tokens
- `tailwindcss-animate` plugin
- Geist Sans/Mono fonts

**The actual codebase uses:**
- **HeroUI** (not shadcn/ui)
- **Plain JavaScript** (not TypeScript)
- **oklch/HSL mixed tokens** (not pure HSL)
- **Inter font** (not Geist)
- **No `tailwindcss-animate`** (uses framer-motion — which is also unused)

This document is **actively misleading** for AI agents and new developers. It references a design system that was never implemented (or was replaced by HeroUI).

### 6.2 `DISCLOSURE_CLEANUP.md` — Useful Migration Guide

463-line document detailing how to migrate collapsible sections from manual state to HeroUI's `Disclosure`/`DisclosureGroup` components. Includes:
- Step-by-step code changes for 4 files
- Surface component migration guidance
- Verification checklist
- Visual smoke test URLs

This is **current and actionable** — likely from a recent migration effort.

### 6.3 `.github/copilot-instructions.md` — PARTIALLY OUTDATED

209-line document with design system instructions for AI coding assistants:
- References CSS tokens like `--background: #F5F5F7` — but `globals.css` uses `oklch()` and `hsl()` values
- Defines `.card`, `.input-field`, `.btn-primary` classes — but the actual codebase uses HeroUI components
- Says "Use **lucide-react** only" — this IS correct and followed in practice
- References collapsible panel patterns that match the OLD pattern (pre-Disclosure migration)

**The document is ~70% outdated** — only the icon policy, API call convention, and error boundary pattern are still accurate.

### 6.4 `AGENTS.md` / `CLAUDE.md` — Minimal

Both are 1-5 lines pointing to Next.js 16 docs. Minimal but correct.

### 6.5 `README.md` — Not reviewed in detail (not critical for code review)

---

## 7. MANIFEST.JS (PWA) — Score: **Fair**

```
app/manifest.js (18 lines)
```

- PWA manifest with `display: 'standalone'`
- 3 icons: 192px, 512px, 512px maskable
- `background_color: '#0c0c14'`, `theme_color: '#159bff'` — matches brand

**Issues:**
- No `service-worker.js` registered — PWA manifest alone doesn't enable offline support
- No `scope` property defined
- No `categories` or `screenshots` for richer install prompts
- `start_url: '/'` doesn't account for subdomain routing (portal users would land on root, not their portal)

---

## 8. CRITICAL ISSUES SUMMARY

| # | Issue | Severity | File | Fix |
|---|-------|----------|------|-----|
| 1 | **6 dead dependencies** adding ~15-25MB | HIGH | `package.json` | Run `npm uninstall @fortawesome/fontawesome-svg-core @fortawesome/free-solid-svg-icons @fortawesome/react-fontawesome @phosphor-icons/react framer-motion class-variance-authority` |
| 2 | **DESIGN_SYSTEM.md describes shadcn/ui, not HeroUI** | HIGH | `DESIGN_SYSTEM.md` | Rewrite to match actual HeroUI-based system, or delete |
| 3 | **copilot-instructions.md ~70% outdated** | MEDIUM | `.github/copilot-instructions.md` | Update CSS tokens and class references to match globals.css |
| 4 | **Universal `transition` on `*` selector** | MEDIUM | `globals.css:147` | Scope to specific selectors or use `@media (prefers-reduced-motion)` |
| 5 | **No vitest.config file** | MEDIUM | project root | Create `vitest.config.js` with proper setup |
| 6 | **No Prettier config** | LOW | project root | Add `.prettierrc` for consistent formatting |
| 7 | **No `.env.example`** | LOW | project root | Create with `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_ROOT_DOMAIN` |
| 8 | **Turbopack config exists but not used in dev script** | LOW | `next.config.mjs` + `package.json` | Either add `--turbo` to dev script or remove turbopack config |
| 9 | **`@heroui/react` version not pinned** | LOW | `package.json` | Pin to exact version to prevent breaking minor updates |
| 10 | **No `reactStrictMode`** | LOW | `next.config.mjs` | Add `reactStrictMode: true` |

---

## 9. WHAT'S WELL DONE

1. **Surface elevation system** in globals.css — deliberate oklch lightness deltas with WCAG-compliant contrast ratios. This is senior-level design engineering.

2. **RTL implementation** — comprehensive CSS overrides for Arabic support, covering sidebar, tables, tabs, and search icons. Flash-free brand swap via CSS-only class toggling.

3. **Subdomain proxy** — sophisticated multi-tenancy routing with clean reserved-subdomain handling, admin rewrite, and coach-slug-to-portal rewrite. Production-grade routing logic.

4. **Minimal, focused lib/ files** — each file is single-purpose, well-documented, and has no side effects. `nutritionCalc.js` is a textbook example of pure utility functions.

5. **Clean `cn()` utility** — standard clsx + tailwind-merge pattern, correctly placed in `lib/utils.js`.

6. **i18n request config** — locale validation with cookie fallback, dynamic imports for translation bundles.

7. **Consistent error boundary pattern** — `DISCLOSURE_CLEANUP.md` shows active attention to component architecture and migration planning.

---

## 10. RECOMMENDED ACTIONS (Priority Order)

### Immediate (Before Next Commit)
1. Remove 6 dead dependencies from `package.json`
2. Create `vitest.config.js` for test runner configuration

### Short-term (This Sprint)
3. Rewrite or remove `DESIGN_SYSTEM.md` — it contradicts the actual stack
4. Update `.github/copilot-instructions.md` to match current globals.css tokens
5. Add `reactStrictMode: true` to `next.config.mjs`
6. Create `.env.example` with required variables

### Medium-term
7. Scope the universal `transition` in globals.css or add `prefers-reduced-motion`
8. Add Prettier config and `format` script
9. Add `--turbo` to dev script or remove Turbopack config
10. Consider pinning `@heroui/react` to exact version

---

*Report generated: 2026-07-13 | Reviewer: Senior Code Reviewer | Next: Phase 2 — Routing & Layout*
