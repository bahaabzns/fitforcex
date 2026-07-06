# Notification System — Enhancement Implementation Plan

**Date:** 2026-07-05
**Type:** Planning document only. No code was written or modified to produce this plan.
**Builds on:** `docs/NOTIFICATIONS_AUDIT.md`, plus work already completed since that audit was written (see below) — this plan reflects the **current** state of the code, not the audit's original snapshot.

> Note on numbering: the request that shaped this plan numbered phases 1–6 and 8–14 — there is no "Phase 7." That gap is preserved here for traceability rather than silently renumbered.

---

## 0. What's already done (baseline for this plan)

Since the original audit, the following audit recommendations have already been implemented and live-verified — this plan does **not** re-propose them, and treats them as the current baseline:

- Click navigation for all 6 original coach notification types now uses `entity_type`/`entity_id`/`metadata`, not a single hardcoded case.
- `message.received` label is direction-aware (`actor_type`-based), not hardcoded to "from a client."
- The messenger unread signal and the notification unread signal are reconciled (opening a thread clears its notification).
- `teamRecipients()`/`ownerRecipients()` now correctly include the workspace owner (a real, independent bug found and fixed along the way — previously a solo coach with no invited teammates received **zero** notifications, ever).
- Full client-portal notification delivery exists: `GET/PATCH /api/client-portal/notifications*`, a real list UI (replacing the old "coming soon" page), and an unread badge on `ClientPortalNav.js`.
- Two new triggers exist: `checkin.reviewed` (notifies the client when a coach reviews their check-in) and `checkin.assigned` (notifies the teammate a check-in was routed to).
- Subscription state transitions (`Active ↔ Frozen ↔ Expired`) now write a durable notification (`subscription.expired` / `subscription.frozen` / `subscription.reactivated`) to both the client and the workspace owner, in addition to the live-computed portal banner.
- Both the coach bell and the client-portal page have loading skeletons, a real error state with retry, and use the shared `EmptyState` component.

**Current notification types (11 distinct `type` values):**
`message.received`, `plan.assigned`, `checkin.submitted`, `checkin.assigned`, `checkin.reviewed`, `client.created`, `billing.payment_received`, `billing.payment_failed`, `subscription.expired`, `subscription.frozen`, `subscription.reactivated`.

---

## 1. Executive Summary

The notification system's foundation — one table, one write choke point (`recordEvent`), correctly-scoped recipients, a working coach UI and a working client UI — is now solid. What's missing is everything that turns a flat list of rows into a *notification center*: richer cards, sensible categories, priority-aware styling, grouping, filtering, search, and a bigger surface than a 320px dropdown to hold all of it.

This plan is deliberately conservative: it works entirely within the existing `notifications` table, the existing `recordEvent` event system, the existing two UI surfaces (coach bell, client-portal page), and the existing HeroUI component library already used throughout the app. The only backend touches proposed are small, additive `metadata` JSON fields on existing `recordEvent` calls (no migration required in most cases) and one optional nullable-column addition for preferences. Nothing here requires a new service, a new delivery channel, or a schema redesign.

One correctness finding surfaced while researching this plan (see §2) that should be folded into Phase 1's work regardless of sequencing.

---

## 2. Current Architecture Constraints

These are the hard facts this plan has to design around:

1. **One shared `title` per event, not per recipient.** `recordEvent` writes the same `title` string to every recipient's row in one `createMany`. Direction-aware or audience-aware copy (like the `message.received` fix) must live in the **frontend**, keyed off fields already on the row (`type`, `actor_type`, `recipient_type` implicitly by which API served it) — never by adding more stored title variants.
2. **No actor identity beyond a bare ID.** `actor_id`/`actor_type` are stored, but nothing resolves them to a display name or avatar. `notifications` has no FK relations (by design — polymorphic recipient), so there's no server-side join today. **Phase 2 (rich cards) cannot show a real avatar/name without a small backend addition** — see Phase 2 for the minimal fix (store it in `metadata`, not a new column).
3. **`plan.assigned` is recipient-scoped to the client only** — `recordEvent` for plan activation only ever lists `{ type: 'client', id }` as a recipient. The coach's own `/api/notifications` is hardcoded to `recipient_type: 'user'`. **Consequence: `NotificationBell.js`'s existing `'plan.assigned'` case (in both `displayText` and `getDestination`) is dead code — it can never fire for a coach.** This predates this session's other work and was inherited, not introduced by it. Recommend removing it as part of Phase 1's cleanup (near-zero cost, pure correctness).
4. **List size is small today** (`limit` capped at 30–100, UI defaults to 15). Several phases below (search, filter chips) are trivially frontend-only *at this volume*. If pagination/infinite scroll is added later, some of those need to move server-side — flagged explicitly where relevant.
5. **`importance` already has exactly three values**: `info`, `actionable`, `alert`. Every phase below reuses these; none introduces a fourth.
6. **The `metadata` JSON column already exists and is already used** (`plan.assigned` stores `{ clientId }`). It is the natural, migration-free place to add anything else a card needs to render (actor name, client name, amounts, etc.) — preferred over new columns everywhere it's sufficient.
7. **HeroUI's full component set is already an installed dependency** (`@heroui/react`), even though only a subset is used today. Recommending an unused-but-installed component (e.g. `Popover`, `Badge`, `Disclosure`) is not "introducing a new technology" — it's using more of what's already there.

---

## 3. Phase-by-Phase Plan

### Phase 1 — Make Notifications Actionable

**Objective:** Every notification tells the user what to do next, not just where a click lands.
**User value:** Fewer "now what?" moments; the notification *is* the shortcut to finishing the task it's about.
**Technical approach:** Keep today's whole-row-click-to-navigate behavior, but add an explicit primary (and where useful, secondary) CTA label rendered on the card, using the destinations already computed by `getDestination`. Where the ideal destination needs a bit more context than `entity_id` alone provides, add it to `metadata` (mirrors the `plan.assigned` → `metadata.clientId` pattern already shipped). Remove the dead `plan.assigned` branch from the coach bell (§2, point 3).
**Components to reuse:** Existing `getDestination`/`displayText` functions in both `NotificationBell.js` and the client-portal page; existing routes.
**Backend impact:** Add `metadata.clientId` to `checkin.submitted` and `checkin.assigned` (mirrors `plan.assigned`), so the coach can be routed to `/clients/{clientId}/forms` instead of the generic `/plans-queue`. No schema change — `metadata` already exists.
**Frontend impact:** Add a CTA button/label per card; wire it to the same `getDestination()` result already computed today.
**Complexity:** Low–Medium.
**Dependencies:** None — this is foundational for Phase 2's card layout.
**Risks:** None material; the dead-code removal is a pure subtraction.

| Type | Current behavior | Current destination | Recommended destination | Primary CTA | Secondary CTA |
|---|---|---|---|---|---|
| `message.received` (coach view) | Row click marks read + navigates | `/messenger?threadId=X` (already deep-linked) | Same | "Reply" | "Mark as read" (explicit, not just implicit on click) |
| `message.received` (client view) | Row click marks read + navigates | `/portal/messages` | Same | "Reply" | — |
| `checkin.submitted` (coach) | Row click → queue | `/plans-queue` | `/clients/{clientId}/forms` (needs `metadata.clientId`) | "Review check-in" | "View client" |
| `checkin.assigned` (assignee) | Row click → queue | `/plans-queue` | Same as above, once `metadata.clientId` exists | "Start review" | "Mark as read" |
| `checkin.reviewed` (client) | Row click → the specific submission | `/portal/forms/{requestId}` (already correct) | Same | "View feedback" | — |
| `plan.assigned` (client — the only real recipient) | Row click → plan | `/portal/nutrition` or `/portal/training` (already correct) | Same | "View plan" | — |
| `plan.assigned` (coach bell) | **Dead code — never fires** (see §2.3) | n/a | n/a | *Remove this branch* | — |
| `client.created` (team) | Row click → client profile | `/clients/{id}` | Same | "View client" | — |
| `billing.payment_received` (owner) | Row click → billing settings | `/settings/billing` | Same | "View invoice" | — |
| `billing.payment_failed` (owner) | Row click → billing settings | `/settings/billing` | Same, or `/finance/payment-methods` if that's the intended fix flow (confirm with product) | "Update payment method" | "View billing" |
| `subscription.expired`/`frozen` (coach) | Row click → client profile | `/clients/{id}` | Consider `/clients/{id}/transactions` if a renew action lives there | "Renew subscription" (if applicable) | "View client" |
| `subscription.expired`/`frozen` (client) | Row click → home | `/portal/home` (banner already explains next steps) | Same | "View details" | — |
| `subscription.reactivated` (both) | Row click → profile/home | Same as above | Same | "View client" / — | "Dismiss" |

---

### Phase 2 — Rich Notification Cards

**Objective:** Upgrade the current single-line text row into a card that carries enough context to act without opening the destination.
**User value:** Scannable at a glance — who, what, when, and what to do — instead of a generic type label.
**Technical approach:** A card anatomy of: icon-or-avatar (leading) → title + optional one-line context → timestamp + importance indicator (trailing) → CTA row (from Phase 1). For person-triggered events (`message.received`, `checkin.submitted`, `client.created`), show the actor's identity; for system/plan/billing events, show a category icon in a circle (same visual language `EmptyState.js` already uses: `bg-muted/40` circle + lucide icon).
**Components to reuse:** `Avatar` (already used in `ClientPortalNav.js`, messenger page, dashboard) for person-triggered cards; plain icon-in-circle (same pattern as `EmptyState`) for system events; `lucide-react` icons already imported elsewhere in the app (`MessageSquare`, `Dumbbell`, `Salad`, `ClipboardList`, `UserPlus`/similar for client created, a billing icon, `AlertTriangle` for alerts).
**Backend impact:** **The one necessary backend touch in this whole plan.** `notifications` has no join to `users`/`clients`, so there's no way to render a real name/initials today. Add `actorName` (and optionally `actorAvatarUrl` if avatars beyond initials matter) into the existing `metadata` JSON at each `recordEvent` call site that has a person actor — a one-line addition per call site, no migration.
**Frontend impact:** New card sub-component (or restructure of the existing `<li><button>` row) in both `NotificationBell.js` and the client-portal page; icon/avatar mapping table per `type`.
**Complexity:** Medium (mostly the backend `metadata.actorName` plumbing across ~5 call sites; the frontend card itself is straightforward).
**Dependencies:** Phase 1 (CTA labels feed into the card's action row).
**Risks:** Low — additive JSON fields don't affect any existing consumer of `notifications` rows.

Per-type visual mapping:

| Type | Icon (system events) or Avatar (person events) | Status indicator |
|---|---|---|
| `message.received` | Avatar (initials of the sender) | Unread dot (existing) |
| `checkin.submitted` | Avatar (client) | `actionable` accent |
| `checkin.assigned` | `ClipboardList` icon | `actionable` accent |
| `checkin.reviewed` | Coach/workspace icon (no client avatar needed — client is the recipient) | `info` (neutral) |
| `plan.assigned` | `Dumbbell` (training) / `Salad` (nutrition), chosen by `entity_type` | `info` |
| `client.created` | `UserPlus`-style icon | `info` |
| `billing.payment_received` | Billing/wallet icon | `info` |
| `billing.payment_failed` | Billing/wallet icon | `alert` accent |
| `subscription.*` | `AlertTriangle` (expired/frozen) or a check icon (reactivated) | `alert` / `info` |

**Compact vs. expanded:** the dropdown/panel stays compact (single line + meta line, current density). A future full-page notification center (Phase 6) can afford a slightly taller expanded card with the CTA row always visible instead of only on hover/focus.
**Mobile responsiveness:** the client-portal page is already full-width, single-column, touch-sized rows — the card redesign should keep the same tap-target height (`py-3` already in place) and let the CTA row wrap under the text on narrow widths rather than truncating it.

---

### Phase 3 — Notification Categories

**Objective:** Give the 11 types a small, stable taxonomy other phases (filters, preferences) can hang off of.
**User value:** "Show me just my messages" is a much smaller mental model than 11 raw type names.
**Technical approach:** Purely a frontend mapping (`type → category`) layered on top of the existing `type` field — no backend change.
**Components to reuse:** N/A (pure logic).
**Backend impact:** None.
**Frontend impact:** One small lookup table, shared by Phases 4, 9, 11.
**Complexity:** Low.
**Dependencies:** None — but several later phases depend on this one, so it should land early.
**Risks:** None.

Recommended categories (kept to 3, per "minimize categories"):

- **Messages** — `message.received`. Kept on its own: highest frequency, most time-sensitive, already has its own mental model (a chat inbox).
- **Coaching** — `plan.assigned`, `checkin.submitted`, `checkin.assigned`, `checkin.reviewed`, `client.created`. All represent the coach↔client program-delivery loop; grouping them avoids a category-per-feature explosion.
- **Billing & Subscription** — `billing.payment_received`, `billing.payment_failed`, `subscription.expired`, `subscription.frozen`, `subscription.reactivated`. All money/access-related, and the one category where "alert"-importance items concentrate.

---

### Phase 4 — Notification Priority

**Objective:** Make the existing `importance` field do visible work instead of only existing in the API response.
**User value:** An `alert` (payment failed, subscription expired) should not look identical to an `info` item (payment received, plan assigned).
**Technical approach:** Reuse the three existing values as-is — no new value. Map to a treatment:
  - `info` → neutral, current styling (no accent beyond the existing unread dot/tint).
  - `actionable` → primary-color accent (already the "unread" tint uses `bg-primary/5`; extend the same primary hue to a small left-border or icon tint so `actionable` reads as "wants a response" even once read).
  - `alert` → destructive/amber accent + the alert-triangle icon from Phase 2, kept even after the item is marked read (an alert shouldn't visually disappear into the read pile the way an `info` item can).
**Components to reuse:** Existing Tailwind semantic tokens already in use elsewhere (`text-destructive`, `bg-destructive/10` — seen in `ClientPortalNav.js`'s frozen/expired banner).
**Backend impact:** None — every trigger already sets (or defaults) `importance` correctly today.
**Frontend impact:** A small `importance → className` map; apply at render time.
**Sorting:** Currently pure `created_at desc`. Recommend a **client-side** re-sort of the already-fetched page only: unread first, then `alert` > `actionable` > `info` within the unread group, then recency — read items stay in pure recency order underneath. No backend query change needed at current list sizes.
**Complexity:** Low.
**Dependencies:** None.
**Risks:** None — purely additive styling + a stable client-side sort.

---

### Phase 5 — Better Grouping

**Objective:** Collapse repetitive notifications (several messages from the same thread, several check-ins submitted back-to-back) into one line with a count.
**User value:** A busy coach's dropdown doesn't turn into 10 near-identical "New message from a client" rows.
**Technical approach:** Group **client-side**, over the already-fetched page, by `(type, entity_type, entity_id)` for `message.received` (same thread) and by `(type, created within the same rolling window, e.g. same day)` for `checkin.submitted`. Rendered as: most recent item's card, with a "+N more" affordance that expands in place.
**Grouping rules:**
  - `message.received`: group when `entity_id` (thread id) repeats — "3 new messages" collapses to the thread, not per-message.
  - `checkin.submitted`: group same-day submissions when there are 3+ — "5 check-ins submitted today," expandable to the individual clients.
  - `billing.*`, `subscription.*`, `client.created`: never group — these are inherently low-frequency and losing the individual line loses information (which client, which payment).
**Expand/collapse behavior:** Collapsed by default when a group has 3+ members; a `Disclosure`/`DisclosureGroup` (HeroUI, unused elsewhere today but installed) is a natural fit — native expand/collapse semantics without hand-rolling state.
**Edge cases:**
  - Mixed read/unread within a group — show the unread count in the group header ("2 of 3 unread"), and mark-all-in-group-read as a single action.
  - A group of exactly 1 — render as a normal ungrouped card (no collapse chrome for a single item).
  - Grouping across the fetch-size boundary (e.g. messages 15 and 16 belong to the same thread but land on different pages) — acceptable known limitation at current pagination; revisit if/when server-side pagination (Phase 8/10 future) changes the page boundary semantics.
**Backend impact:** None — grouping is a render-time transform over existing rows.
**Complexity:** Medium (the interaction/state handling, not the grouping logic itself).
**Dependencies:** Benefits from Phase 2's actor identity (to name who sent the grouped messages) and Phase 3's categories (grouping only really matters within "Messages" and "Coaching").
**Risks:** Over-grouping can hide something the user actually wanted to see individually — keep the 3+ threshold conservative and always make the group expandable, never collapse-only.

---

### Phase 6 — Smart Notification Center

**Objective:** Give both portals a "view all" surface bigger than the current 320px dropdown, without discarding the quick-glance dropdown.
**User value:** The dropdown stays for "what just happened," a dedicated page/drawer serves "let me go through everything."
**Technical approach:** The client portal *already* has exactly this pattern — a dedicated full-page list (`/portal/notifications`), separate from a quick-glance affordance. **Reuse that same shape for the coach side**: add a `/{workspaceSlug}/notifications` page mirroring the client-portal page's structure (skeleton/error/empty states, categories from Phase 3, grouping from Phase 5), and add a "View all" link at the bottom of the existing dropdown that navigates there. This directly satisfies the "keep both portals consistent" goal by having the coach adopt the client portal's already-proven full-page pattern, rather than inventing a third layout.
**Layout:** Header (title + mark-all-read) → category filter chips (Phase 11) → grouped, prioritized list (Phases 4–5) → day-timeline dividers (Phase 12).
**Sections:** By category (Phase 3) as filter chips, not permanent visual sections — keeps the list a single scannable column rather than fragmenting it into three separate lists.
**Navigation:** Dropdown gets a persistent "View all notifications" footer link; the full page is reachable from the sidebar too if the coach shell has room (optional, low priority).
**Responsive behavior:** Coach: full page at any width (already how every other coach module works). Client: already a full page today (bottom-nav-driven), no change needed.
**Components to reuse:** The client-portal notifications page's existing structure, wholesale, as the template for the coach version.
**Backend impact:** None — same `GET /api/notifications` endpoint, just called from a new page instead of only the dropdown.
**Complexity:** Medium.
**Dependencies:** Best done after Phases 1–5 so the new page showcases the improved cards/categories/grouping rather than needing a second pass.
**Risks:** Low — additive page, doesn't change the dropdown's existing behavior.

---

### Phase 8 — Bulk Actions

*(Phase 7 was not specified in the originating request.)*

**Objective:** Let a coach or client clear a backlog of notifications quickly.
**User value:** "Mark all as read" already exists; the question is whether more is worth the complexity.

| Action | Coach Portal | Client Portal | Existing backend support | Required backend work | Recommendation |
|---|---|---|---|---|---|
| Mark all as read | ✅ works today | ✅ works today | `PATCH .../read-all` already implemented both sides | None | Keep as-is |
| Mark selected as read | Not built | Not built | `PATCH .../:id/read` exists per-item; no batch-by-id endpoint | Small: accept an array of ids in one PATCH instead of N calls | Build only once Phase 6's bigger list makes multi-select worthwhile — low priority otherwise |
| Clear / dismiss all (read) | Not built | Not built | No delete/dismiss endpoint exists | New endpoint + (per audit) a "soft delete" or hard-delete decision | Defer — overlaps with the audit's separately-recommended cleanup job (§9 audit, Phase 4 there); don't build a user-facing bulk-delete before the retention policy is decided |
| Bulk category mute ("stop notifying me about billing") | Not built | Not built | None | Ties into Phase 9 preferences | Fold into Phase 9 rather than building separately |

**Recommendation overall:** Ship nothing new in this phase beyond what already exists, until Phase 6's full-page view makes a multi-select UI worth the interaction cost. Avoid building bulk-delete ahead of a retention/cleanup decision.
**Complexity:** Low (for the one item worth building — batch mark-read).
**Dependencies:** Phase 6.
**Risks:** Building bulk-delete before a retention policy exists risks a UX/data mismatch (user "deletes" something the backend never actually retains a cleanup story for).

---

### Phase 9 — Notification Preferences

**Objective:** Let a user turn off categories they don't want to see, without building delivery-channel infrastructure that doesn't exist yet.
**User value:** A coach who doesn't care about `client.created` noise can quiet it without losing billing alerts.
**Can be implemented now:**
  - **Categories:** the three from Phase 3 (Messages / Coaching / Billing & Subscription).
  - **Delivery channel:** in-app only — email/push channels don't exist in this system yet (confirmed in the original audit; no email/push consumer of `notifications` rows exists).
  - **UI:** a simple settings section (coach: `/settings/...`; client: `/portal/profile` or a new lightweight page) with a toggle per category, using the existing `Switch` component (already used in `clients/page.js`).
  - **Database requirement:** avoid a new table. Add one nullable JSON column — `notification_prefs` on `users` and `clients` (e.g. `{ muted: ['client.created'] }`) — mirrors the `metadata` JSON pattern already established, no join needed.
  - **Enforcement:** `recordEvent` checks the recipient's `notification_prefs` before including them (skip muted categories at write time, not read time — keeps `listNotifications`/`getUnreadCount` untouched and avoids ever writing rows nobody will see).
**Requires future backend work (do not build now):**
  - Email/push delivery channel toggles — meaningless until an email/push consumer exists (tracked as a "Future Consideration" below and in the original audit).
  - Per-client-relationship muting (e.g. "mute messages from this one client") — a finer grain than category-level; not requested and adds real complexity for unclear value.
**Backend impact:** One nullable JSON column per identity table; a lookup + filter inside `recordEvent`.
**Frontend impact:** New settings UI section; reuses `Switch`.
**Complexity:** Medium.
**Dependencies:** Phase 3 (categories).
**Risks:** Muting at write time (not read time) means a muted category's history genuinely never accumulates — confirm that's the desired behavior (vs. muting only stopping the badge/alert but keeping a record) before building.

---

### Phase 10 — Search

**Objective:** Let a user find a specific notification without scrolling.
**Can this work on the current model?** Yes, but **only client-side at current volumes**. The stored `title` is a generic fallback in English; the text the user actually *sees* is computed client-side per `type` via i18n (Phase 1–3 already established this pattern). A backend `LIKE '%query%'` against `title` would miss translated labels entirely and wouldn't match what's on screen. Searching the *rendered* label — computed the same way `displayText()` already computes it — client-side, over the already-fetched page (max 30–100 rows), is both correct and effectively instant.
**Search fields:** the computed display label, plus (optionally) any `metadata.actorName`/`metadata.clientName` once Phase 2 adds them — lets "Jane" match a message from Jane even if the visible label is generic.
**UI:** a `SearchField` (HeroUI, already used in the messenger page and elsewhere) above the list; filters the in-memory array as-you-type.
**Backend query changes:** **None required now.**
**Performance considerations:** Trivial at current list sizes (client-side `.filter()` over ≤100 items). **If pagination/infinite scroll is added later** (see Phase 12/Future Considerations), search must move server-side — and at that point it should search `type` (exact/prefix match) and any `metadata`/`entity` fields directly, not the localized label, since the server can't reproduce every locale's translated string.
**Complexity:** Low (now) / Medium (later, if pagination changes the picture).
**Dependencies:** Phase 2 (for actor-name matching, optional enhancement, not a blocker).
**Risks:** None at current scale; the only real risk is under-scoping if this ships alongside real pagination and the client-side approach silently stops covering the full list — flag that dependency clearly to whoever picks up pagination later.

---

### Phase 11 — Filter Chips

**Objective:** One-tap filtering by the categories from Phase 3.
**Recommended chips:** `All` · `Unread` · `Messages` · `Coaching` · `Billing & Subscription` — five total, directly derived from Phase 3's three categories plus the two states already meaningful today (`All`, `Unread` — `Unread` is already a supported query param on the backend, `?unread=true`).
**Technical approach:** Client-side filter over the fetched page for the category chips (same reasoning as Phase 10 — no backend change needed at current volumes); the `Unread` chip can keep using the existing `?unread=true` query param since that's already a real, cheap, indexed backend filter.
**Components to reuse:** `Chip`, already the established filter-pill pattern elsewhere in the app (clients page, transactions page) — do not introduce `ToggleButtonGroup`/`tag-group` even though HeroUI ships them, to stay consistent with the pattern already in use.
**Backend impact:** None beyond the `unread` param that already exists.
**Frontend impact:** A small row of `Chip`s above the list, filtering the in-memory array (category chips) or re-fetching with `?unread=true` (the `Unread` chip).
**Complexity:** Low.
**Dependencies:** Phase 3.
**Risks:** None.

---

### Phase 12 — Notification Timeline

**Objective:** Break a long list into "Today / Yesterday / This Week / Earlier" bands instead of an undifferentiated scroll.
**Frontend-only or backend?** Entirely frontend — `created_at` is already returned on every row; day-bucketing is pure client-side date math.
**Reuse note:** The coach messenger page (`messenger/page.js`) **already has this exact logic** — `getDateLabel()` groups messages into Today/Yesterday/weekday-name bands. Rather than write a second version for notifications, extract that helper into a shared util (e.g. `utils/dateGrouping.js`) and use it in both places. This is a genuine reuse opportunity, not a new pattern.
**Components to reuse:** `Separator` (already used for exactly this kind of divider in the messenger and client-messages pages).
**Backend impact:** None.
**Complexity:** Low.
**Dependencies:** None, but pairs naturally with Phase 6 (more useful on a longer, full-page list than a 15-item dropdown).
**Risks:** None.

---

### Phase 13 — Better Empty States

**Objective:** Confirm every state (empty, loading, error, offline, no-search-results) is covered, consistently, on both surfaces.
**Current status:** Loading (Skeleton) ✅ both surfaces. Empty (shared `EmptyState`, `variant="firstTime"`) ✅ both surfaces. Error (`EmptyState`, `variant="error"`, retry action) ✅ both surfaces — this was closed out already in this session's Phase 3 work.
**Offline:** No project-wide offline-detection pattern exists elsewhere in the app today, so don't invent a bespoke one just for notifications. A network failure while offline already surfaces through the existing error state's `.catch()` path — no additional state is needed; if the app ever adds a global offline banner, notifications inherit it for free.
**No-search-results (once Phase 10/11 ship):** `EmptyState` already defines `variant="search"` and `variant="filter"` (light-tone, recovery-action treatments) — use those directly rather than defining a new variant. "Clear search" / "Clear filters" as the recovery action, per the component's existing convention.
**Components to reuse:** `EmptyState` (the project's own shared component — not the raw `@heroui/react/empty-state` primitive used elsewhere in the app, to stay consistent with this project's established convention of wrapping it).
**Backend impact:** None.
**Complexity:** Low (mostly already done; this phase is a verification + the two new `variant="search"`/`"filter"` usages once Phase 10/11 exist).
**Dependencies:** Phase 10, Phase 11 (for the search/filter empty states specifically).
**Risks:** None.

---

### Phase 14 — HeroUI Polish

**Objective:** Replace hand-rolled markup with the HeroUI primitives the rest of the app already standardizes on, now that HeroUI's full component inventory is confirmed available (`popover`, `badge`, `disclosure`/`disclosure-group`, `menu`, `toast`, `spinner`, alongside the already-used `card`, `chip`, `avatar`, `scroll-shadow`, `separator`, `skeleton`, `empty-state`).

| Area | Current | Recommended | Why |
|---|---|---|---|
| Dropdown panel container | Hand-rolled `absolute` `div` with manual outside-click listener | `Popover` (HeroUI, installed, unused elsewhere) | Free focus trap, dismiss-on-escape/outside-click, positioning — removes the hand-rolled `mousedown` listener entirely |
| Unread count pill | Hand-rolled `<span>` with manual pill styling (both coach button and client nav) | `Badge` (HeroUI) | Purpose-built for exactly this icon-button-overlay-count pattern |
| Scrollable list | Plain `overflow-y-auto` div | `ScrollShadow` | Already the established pattern for scrollable panels (messenger page, client messages page) — adds the fade-edge affordance for free |
| Notification row container | Bare `<li><button>` | `Card` (or keep the button but wrap content in `Card`'s internal structure) | Matches list-item containers used elsewhere |
| Category/filter chips (Phase 11) | New | `Chip` | Already the app's established filter-pill component |
| Day-group dividers (Phase 12) | New | `Separator` | Already used for this exact purpose elsewhere |
| Grouped notification expand/collapse (Phase 5) | New | `Disclosure`/`DisclosureGroup` | Native expand/collapse semantics, no hand-rolled state needed |
| In-flight mark-read feedback | None today | `Spinner` (small, inline) | Currently a click gives no feedback while the PATCH is in flight |
| "Mark all read" confirmation | Silent state change only | `Toast` | Cheap, optional polish — confirms the bulk action fired |
| Importance/alert explanation | None | `Tooltip` | Already the app's established micro-interaction for "why does this look different" |
| Empty states | Custom `EmptyState` wrapper | Keep as-is | This is the project's own convention (see memory: shared `EmptyState` strategy) — do **not** switch to the raw `@heroui/react/empty-state` used elsewhere in the app; that would be a step *away* from this project's established pattern, not toward it |

**Backend impact:** None — purely a component-swap pass.
**Frontend impact:** Touches both `NotificationBell.js` and the client-portal notifications page; best done incrementally as each phase above lands its feature, plus one final consistency pass.
**Complexity:** Low–Medium (mechanical component swaps; the only interaction-design work is `Disclosure` for grouping, already scoped under Phase 5).
**Dependencies:** Best sequenced *after* Phases 1–6 settle their behavior, so components aren't swapped twice.
**Risks:** Low. `Popover` swap needs a quick check that its default z-index/portal behavior doesn't fight the existing `z-50` layering used elsewhere in the coach shell.

---

## 4. Recommended Implementation Order

Ordered by dependency, not by the phase numbers above:

1. **Phase 1** — foundational correctness (CTAs + the dead-code fix + the two `metadata.clientId` additions). Everything visual downstream assumes this is done.
2. **Phase 13** — already ~90% done; close it out now while touching these files anyway.
3. **Phase 4** — cheap, standalone, immediately visible improvement.
4. **Phase 3** — defines the taxonomy Phases 9 and 11 depend on.
5. **Phase 2** — the core visual upgrade; includes the one real backend touch (`metadata.actorName`).
6. **Phase 11** — direct application of Phase 3's categories.
7. **Phase 12** — cheap, frontend-only, and a good opportunity to extract the shared date-grouping util while it's fresh from Phase 2/11 work.
8. **Phase 5** — grouping benefits from Phase 2's actor identity and Phase 3's categories both being in place.
9. **Phase 6** — assembles Phases 1–5 into the bigger "view all" surface; doing it earlier just means redoing the page once those land.
10. **Phase 10** — natural fit once Phase 6 gives search somewhere meaningful to live.
11. **Phase 8** — bulk actions only earn their complexity once Phase 6's list is big enough to need them.
12. **Phase 9** — the most net-new backend surface (preferences storage + enforcement); do last among the "can build now" items since it's the most self-contained.
13. **Phase 14** — run continuously alongside 1–6 for whatever each phase touches, then a dedicated final pass.

---

## 5. Quick Wins

High value, minimal effort, can ship independently of the sequencing above:

- **Remove the dead `plan.assigned` branch** from the coach `NotificationBell.js` (§2.3) — pure cleanup, zero risk, a few minutes.
- **Phase 4's priority styling** — the `importance` field already exists and is already correct at every call site; only the frontend mapping is missing.
- **Phase 11's filter chips** — reuses `Chip`, no backend change, immediately useful.
- **Phase 12's timeline grouping** — frontend-only, and a chance to deduplicate logic that already exists in the messenger page.
- **`Badge` swap for the hand-rolled unread pill** (Phase 14, one line item) — cosmetic but visible on every page load.
- **`Toast` confirmation on "mark all read"** — small, cheap, immediately noticeable polish.

---

## 6. Future Considerations (intentionally postponed)

These require backend/architecture work beyond what this plan's constraints allow, and are better tracked against the original audit's Phase 4 rather than folded into this plan:

- **Real Socket.IO consumption in the web client** (or removing the currently-dead realtime plumbing) — genuine real-time push requires wiring `socket.io-client` into the frontend; today's improvements are all still poll-based by design, per this plan's "no architecture change" constraint.
- **Email/push notification delivery** — no delivery-channel infrastructure exists yet; Phase 9's preferences are scoped to in-app-only specifically because of this.
- **Notification cleanup/expiration job** — a background retention job is a prerequisite for safely offering user-facing bulk-delete (Phase 8); it's an infrastructure task, not a UI phase.
- **Cross-tab real-time sync** — blocked on the same Socket.IO work above.
- **Per-relationship muting** (e.g. mute one specific client's messages) — finer-grained than the category-level preferences in Phase 9; real complexity for a need that hasn't been demonstrated yet.
- **AI-assisted summarization/triage** — explicitly out of scope per this plan's constraints.
