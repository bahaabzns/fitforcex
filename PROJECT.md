# PROJECT.md — FitForce X

## Identity

**Name:** FitForce X
**What it does:** A multi-tenant SaaS platform for fitness coaches to manage clients, workouts, nutrition, finances, and team members across isolated workspaces.
**Who it's for:** Fitness coaches and coaching teams (gyms, online coaches, personal trainers).
**Core thing it must do well:** Let a coach log in, manage their clients, and assign workout/nutrition plans — reliably, in one place.

---

## Scope

### MUST HAVE (v1)
1. Coach authentication and workspace management
2. Client portal (client-facing login, forms, training pages)
3. Team management (invite members, roles, permissions, seat limits)
4. Subscription plan gating (free tier, paid plans via Fawaterak)
5. Billing dashboard (current plan, payment history, plan switching)

### NICE TO HAVE
- Mobile app or PWA
- Automated nutrition plan generation
- Client progress tracking with charts
- Email notifications for form submissions and invitations

### FUTURE
- Public coach profile/marketplace
- API for third-party integrations
- White-label offering for gym chains

---

## Definition of Done (v1)

- A user can register as a coach, create a workspace, and invite team members.
- A user can add clients, assign training plans, and track form responses.
- A user can subscribe to a paid plan through the billing page.
- A user can switch between workspaces they belong to.
- A user can manage their profile and workspace settings.

**Out of scope for v1:**
- Native mobile apps
- Automated plan generation (AI or rule-based)
- Third-party calendar integrations

---

## Tech Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | Next.js (App Router) | SSR, file-based routing, good DX |
| UI components | HeroUI (@heroui/react) | Consistent, accessible component library |
| Styling | Tailwind CSS | Rapid, consistent utility styling |
| Backend | Express.js (Node.js) | Simple REST API, team familiarity |
| Database | PostgreSQL (via `pg` pool) | Relational, reliable, suits multi-tenant data |
| Auth | JWT via httpOnly cookie | Stateless, secure, no session store needed |
| Payment | Fawaterak | Egypt-market payment gateway |
| HTTP client | Axios (`@/lib/axios`) | Interceptors for auth and error handling |

---

## Build Phases Completed

| Phase | What was built |
|---|---|
| 1 | Client portal login/registration with coach_slug support |
| 2 | Client dashboard, forms, training pages |
| 3 | Coach settings: profile and portal slug customization |
| 4 | Admin auth, workspace model migration, workspace/team backend |
| 5 | Frontend team management: workspace switcher, /team page |
| 6 | Dashboard real data + Settings overhaul (Profile, Workspace, Danger Zone tabs) |
| 7 | Admin dashboard: stats, users, workspaces, plans CRUD |
| Backfill | Permissions editor on team page (per-module read/write/delete) |
| Backfill | Workspace slug in URL — all routes moved to /[workspaceSlug]/ |
| 8 | Subscription plan gating (seat/workspace limits, SeatUsageBar, UpgradeBanner) |
| 9 (WIP) | Billing page: plan list, payment history, Fawaterak iframe checkout |

---

## Decisions Log

| Date | Decision | Why |
|---|---|---|
| Early | Next.js App Router over Pages Router | Modern, supports server components, cleaner layout nesting |
| Early | httpOnly cookie JWT over localStorage | Security: XSS cannot steal token from httpOnly cookies |
| Phase 4 | Workspace model (multi-tenant) over single-tenant | Coaches can own or belong to multiple teams |
| Phase 8 | Seat limits enforced server-side only | Client-side gates are UX only; business logic lives in API |
| Phase 9 | Fawaterak for payments | Primary payment processor available in Egypt market |

---

## Repository

**Remote:** (add URL here)
**Main branch:** `main` (production)
**Dev branch:** `main` (currently — no separate dev branch established)

> Note: All work is currently committed directly to `main`. A `dev` branch should be created for Phase 9+ work.
