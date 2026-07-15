# FitForce Client — Deep Code Review Plan

**Reviewer Role:** Senior Developer & Code Reviewer
**Target:** `/client` (Next.js 16 frontend)
**Total Scope:** 213 JS files, ~38k lines, 3 user roles, 60+ components

---

## Review Phases

Each phase produces a dedicated report file in this `reports/` folder.
Phases are ordered from foundation → architecture → features → quality.

| # | Phase | Report File | Focus |
|---|-------|-------------|-------|
| 1 | Foundation & Config | `01_foundation.md` | package.json deps audit, config files, env vars, path aliases, build setup |
| 2 | Routing & Layout | `02_routing_layout.md` | Route groups, layouts, proxy.js, subdomain routing, navigation hierarchy |
| 3 | Auth & Security | `03_auth_security.md` | Login/register flow, session management, route protection, cookie handling, CORS |
| 4 | Data Layer & State | `04_data_state.md` | Axios config, API patterns, 3 custom hooks, Context usage, caching gaps |
| 5 | Design System & UI | `05_design_system.md` | Reusable primitives, styling approach, globals.css tokens, icon strategy, dark mode |
| 6 | Coach Features | `06_coach_features.md` | Dashboard, clients, training/nutrition/forms builders, messenger, finance, team, settings |
| 7 | Client Portal | `07_client_portal.md` | Portal layout, training, nutrition, forms, messaging, profile, notifications |
| 8 | Admin Panel | `08_admin_panel.md` | Admin dashboard, users, workspaces, plans, templates, libraries, payments |
| 9 | Landing & Marketing | `09_landing.md` | Landing page, PWA manifest, SEO, metadata |
| 10 | Performance | `10_performance.md` | SSR vs CSR ratio, memoization, code splitting, bundle, polling, re-render analysis |
| 11 | i18n & Accessibility | `11_i18n_a11y.md` | Translation coverage, RTL implementation, ARIA attributes, keyboard nav |
| 12 | Testing | `12_testing.md` | Coverage gaps, test patterns, what needs tests first |
| 13 | Final Verdict | `13_final_verdict.md` | Consolidated scorecard, priority action items, refactoring roadmap |

---

## Review Methodology

For each phase, the review covers:

1. **Map** — List all files in scope, their sizes, relationships
2. **Read** — Deep-read every file in the phase (not sampling)
3. **Analyze** — Pattern identification, anti-pattern detection, consistency check
4. **Score** — Rate on 5-point scale: Critical / Poor / Fair / Good / Excellent
5. **Recommend** — Specific, actionable fix with file path and line reference

---

## Scoring Rubric

| Score | Meaning |
|-------|---------|
| **Excellent** | Best practice, no changes needed |
| **Good** | Minor improvements possible, production-ready |
| **Fair** | Works but has notable gaps or inconsistencies |
| **Poor** | Significant issues, needs refactoring before scaling |
| **Critical** | Blocking risk, must fix before production |

---

## File Inventory (for reference)

```
client/
├── app/                    # 148 files (pages, layouts, components, contexts)
│   ├── components/         # 60+ shared components
│   │   ├── charts/         # 2 files
│   │   ├── forms/          # 5 files
│   │   ├── nutrition/      # 9 files
│   │   ├── plansQueue/     # 1 file
│   │   ├── training/       # 6 files
│   │   └── training-mode/  # 5 files
│   ├── (auth)/             # 6 page files + layout
│   ├── (admin)/            # ~15 page files + layout
│   ├── (client)/           # ~12 page files + layout
│   └── (coach)/            # ~40 page files + layout
├── hooks/                  # 4 files
├── lib/                    # 6 files (1 test)
├── utils/                  # 8 files (1 test)
├── i18n/                   # 1 file
├── messages/               # 2 JSON files
└── config files            # 8 files
```
