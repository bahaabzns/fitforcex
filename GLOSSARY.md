# GLOSSARY.md — Project Glossary

Format:
```
## [term]
**Plain English:** One sentence explanation
**In our project:** Where and why we use it
**Example:** Short code snippet or concrete example
```

---

## Workspace
**Plain English:** An isolated environment that belongs to one owner and can have multiple team members — like a separate company account.
**In our project:** The core multi-tenant unit. Every coach-facing page lives under `/:workspaceSlug/`. A user can belong to multiple workspaces with different roles.
**Example:** Coach "Ahmed" creates a workspace called "Elite Fitness" with slug `elite-fitness`. His assistant joins and sees only that workspace's clients.

---

## Slug
**Plain English:** A URL-safe, human-readable identifier — lowercase letters, numbers, and hyphens only.
**In our project:** Each workspace has a slug used in the URL (`/elite-fitness/dashboard`). Slugs are set by the owner in Workspace Settings and must be unique.
**Example:** `elite-fitness`, `bahaa-coaching-2024`

---

## Seat
**Plain English:** One slot for a team member inside a workspace. Plans have a maximum seat count.
**In our project:** `max_team_seats` on the subscription controls how many members can be in a workspace. `SeatUsageBar` shows current usage. When full, the invite form is hidden and `UpgradeBanner` appears.
**Example:** A "Pro" plan with 5 seats can have an owner + 4 invited members.

---

## Plan Gating
**Plain English:** Restricting features or limits based on what subscription plan the workspace is on.
**In our project:** Enforced server-side in `seatLimits.js` (`checkSeatLimit`, `checkWorkspaceLimit`). Frontend gates are UX-only (hide buttons, show banners) — the real enforcement is in the API.
**Example:** A Free plan workspace trying to invite a 6th member gets a 403 from the API even if they somehow bypass the frontend gate.

---

## httpOnly Cookie
**Plain English:** A browser cookie that JavaScript cannot read — only the browser sends it automatically on each request.
**In our project:** Our JWT auth token is stored in an httpOnly cookie. This protects against XSS attacks stealing the token. The frontend cannot read the token; it just makes API calls and the cookie is attached automatically.
**Example:** After login, the server calls `res.cookie('token', jwt, { httpOnly: true })`.

---

## JWT (JSON Web Token)
**Plain English:** A self-contained, signed token that proves who you are — the server can verify it without a database lookup.
**In our project:** Issued on login, stored in an httpOnly cookie, decoded by the `requireAuth` middleware on every protected route. Contains `userId`, `workspaceId`, and role.
**Example:** `GET /api/auth/me` decodes the JWT from the cookie and returns the current user's full profile.

---

## Fawaterak
**Plain English:** An Egyptian online payment gateway — the equivalent of Stripe for the Egyptian market.
**In our project:** Used for subscription payments on the Billing page. We create an invoice via `POST /api/billing/create-invoice`, get back a `paymentUrl`, and open it in an iframe. We then poll `GET /api/billing/payment-status/:id` until the payment is confirmed.
**Example:** Coach clicks "Upgrade to Pro" → iframe opens with Fawaterak checkout → payment confirmed → subscription activated.

---

## App Router (Next.js)
**Plain English:** Next.js's modern routing system where folders equal URL segments, and `page.js` files define what renders at each route.
**In our project:** All coach pages live in `client/app/(coach)/[workspaceSlug]/`. The `(coach)` part is a route group (doesn't appear in the URL). `[workspaceSlug]` is a dynamic segment.
**Example:** `client/app/(coach)/[workspaceSlug]/settings/billing/page.js` renders at `/my-workspace/settings/billing`.

---

## Route Group
**Plain English:** A Next.js folder wrapped in parentheses that groups routes together without adding to the URL path.
**In our project:** `(coach)` groups all coach-authenticated pages. `(workspace)` (in some areas) groups workspace-scoped routes. The parentheses mean these folder names are invisible in the browser URL.
**Example:** `app/(coach)/[workspaceSlug]/dashboard/page.js` → URL is `/my-workspace/dashboard`, not `/coach/my-workspace/dashboard`.

---

## Disclosure (HeroUI)
**Plain English:** An accessible expand/collapse component — like an accordion section.
**In our project:** Used in `Sidebar.js` for the Finance, Nutrition, Training, and Settings collapsible nav menus.
**Example:** Clicking "Settings" in the sidebar opens a `Disclosure` that reveals Profile, Workspace, and Billing sub-links.
