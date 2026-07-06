# Notification System Audit — Coach Portal & Client Portal

**Date:** 2026-07-05
**Branch:** `feature/subscription-access-policy`
**Scope:** Read-only audit. No code changed. Covers `server/src/lib/events.ts`, `server/src/modules/notifications/*`, every `recordEvent(...)` call site, `client/app/components/NotificationBell.js`, the client-portal notifications page/nav, and the Socket.IO layer end to end.

---

## 1. Architecture Review

### 1.1 Data model

One table backs everything, defined in `server/prisma/schema.prisma:529`:

```prisma
model notifications {
  id             String    @id
  workspace_id   String
  recipient_type String  // 'user' | 'client'
  recipient_id   String
  type           String  // event key, e.g. 'message.received'
  importance     String  @default("info") // 'info' | 'actionable' | 'alert'
  title          String
  body           String?
  entity_type    String?
  entity_id      String?
  actor_type     String?
  actor_id       String?
  metadata       Json?
  read_at        DateTime? @db.Timestamptz(6)
  created_at     DateTime  @default(now()) @db.Timestamptz(6)

  @@index([recipient_type, recipient_id, read_at, created_at(sort: Desc)], map: "idx_notifications_recipient")
  @@index([workspace_id, created_at(sort: Desc)], map: "idx_notifications_workspace")
}
```

It was introduced inside the `20260628073700_add_metrics_system` migration (not its own migration — a naming/traceability quirk, not a functional bug).

### 1.2 The single choke point — `server/src/lib/events.ts`

`recordEvent(event: DomainEvent)` is the **only** place that writes a notification row or emits a realtime event. Its own doc comment explains the intent well: before this existed, controllers hand-rolled `getIo().emit(...)`, so anything that happened while the recipient's tab was closed was lost forever. `recordEvent` now:

1. Writes one `notifications` row per recipient (`recipients: [{ type: 'user'|'client', id }]`) — durable.
2. Emits a lightweight `notification` socket event to each recipient's own room (`user:<id>` / `client:<id>`) — a "ping," not the payload; the client is expected to refetch.
3. Optionally replays a **legacy** `realtime` event (e.g. `new_message`, `plan_assigned`) to a workspace/client room, preserved verbatim for older listeners.
4. Is best-effort: failures are caught and logged, never thrown — a notification bug can't break the request that triggered it.

Helper functions `teamRecipients(workspaceId, excludeUserId?)` and `ownerRecipients(workspaceId)` build recipient lists from `workspace_members`.

### 1.3 API surface — `server/src/modules/notifications/`

Mounted at `/api/notifications` (`app.ts:133`), behind `authMiddleware` only:

| Method | Path | Handler |
|---|---|---|
| GET | `/api/notifications` | `listNotifications` — newest first, `?unread=true`, `?limit=` (default 30, max 100) |
| GET | `/api/notifications/unread-count` | `getUnreadCount` — `{ count }` |
| PATCH | `/api/notifications/read-all` | `markAllRead` |
| PATCH | `/api/notifications/:id/read` | `markRead` |

`recipientScope(req)` **hardcodes `recipient_type: 'user'`** — every query is `{ workspace_id, recipient_type: 'user', recipient_id: req.user.userId }`. This module is coach/team-only by construction, not by an oversight in one query — the whole module was built for one audience.

There is **no client-portal equivalent**. `clientPortal.routes.ts` has no `/notifications` route at all, and `notifications.routes.ts` only wires `authMiddleware` (team JWT), which a client's `client_token` cookie won't satisfy.

### 1.4 Realtime layer — `server/src/lib/socket.ts`

Socket.IO is initialized in `initSocket()`, authenticates the handshake with the same JWT used for HTTP (cookie, `Authorization: Bearer`, or `auth.token`), and on connection joins the socket to up to three rooms: `workspace:<id>`, `client:<id>`, `user:<id>`. This is solid, standard infrastructure.

**However:** grepping the entire `client/` tree for `socket.io-client`, `socket`, or any of the emitted event names (`notification`, `new_message`, `plan_assigned`) returns **zero matches**, and `socket.io-client` is not even in `client/package.json`. The frontend never opens a socket connection. Every "realtime" emit the backend sends — the bell ping and the legacy `new_message`/`plan_assigned` events — is emitted into a room with nobody listening. The entire Socket.IO layer is currently dead weight from the browser's perspective (mobile/Flutter may be a different story and was out of scope for this pass — worth a quick check before assuming it's dead there too).

### 1.5 Frontend — Coach Portal

`client/app/components/NotificationBell.js`, mounted once in `(coach)/layout.js:240`:

- Polls `GET /api/notifications/unread-count` every 15s (`UNREAD_POLL_MS`), regardless of whether the dropdown is open.
- On open, fetches `GET /api/notifications?limit=15`.
- `displayText()` maps `notification.type` to a translated string via `next-intl`, falling back to the stored `title` for unmapped types.
- Click handling: marks read (optimistic local state + PATCH), then **only** navigates if `type === 'message.received'` (to `/${workspaceSlug}/messenger`). Every other type (`plan.assigned`, `checkin.submitted`, `client.created`, `billing.*`) marks read but does not navigate anywhere.
- "Mark all read" does an optimistic bulk update.
- No pagination/infinite scroll — a hard 15-item cap with a scrollable `max-h-96` div.

### 1.6 Frontend — Client Portal

- `ClientPortalNav.js` renders a static bell **icon** linking to `/portal/notifications` — no unread count, no badge, no dropdown, no fetch of any kind.
- `(client)/portal/notifications/page.js` is a literal placeholder: a centered icon + "Coming soon" copy. It renders no data.
- `(client)/portal/layout.js` does not mount anything resembling `NotificationBell`.

So: the backend has been recording `recipient_type: 'client'` notification rows since this system was introduced (`message.received` when a coach messages a client, `plan.assigned` on plan activation) — and nothing on the client side can ever read them. They accumulate in the table, unread, forever.

### 1.7 Notification lifecycle diagram

```
                    ┌───────────────────────────────────────────┐
                    │  Trigger fires inside a controller         │
                    │  (sendMessage, activatePlan, submitForm,   │
                    │   createClient, payment webhook, …)        │
                    └───────────────────┬────────────────────────┘
                                        │  await recordEvent({...})
                                        ▼
                    ┌───────────────────────────────────────────┐
                    │  events.ts :: recordEvent()                 │
                    │  1. INSERT notifications (1 row/recipient) │
                    │  2. io.to(`user:<id>`|`client:<id>`)        │
                    │       .emit('notification', {type,title})   │
                    │  3. legacy realtime: io.to(room).emit(...)  │
                    │     (new_message / plan_assigned)           │
                    │  — best-effort, errors swallowed & logged   │
                    └───────────────────┬────────────────────────┘
                                        │
                     ┌──────────────────┴───────────────────┐
                     ▼                                      ▼
        durable row in `notifications`          socket emit → an EMPTY room
        (survives closed tabs, reload)          (no client.js ever connects
                     │                            socket.io-client — dead end)
                     ▼
        ┌─────────────────────────────┐
        │ COACH: NotificationBell.js   │        ┌────────────────────────────┐
        │  polls unread-count /15s     │        │ CLIENT: no equivalent.     │
        │  fetches list on open        │        │ No route, no fetch,        │
        │  PATCH read on click          │        │ no polling, no bell.       │
        │  navigates only for          │        │ Row sits unread forever.   │
        │  'message.received'          │        └────────────────────────────┘
        └─────────────────────────────┘
```

The realtime path in step 2/3 is fully wired server-side and fully unconsumed client-side — the "instant" part of the design never happens today; only the 15s poll (coach) delivers anything, and the client gets nothing at all.

---

## 2. Trigger Audit

Every `recordEvent(...)` call site in the codebase, in full:

| # | Event (`type`) | Trigger | Backend file:line | Target | Importance | Status |
|---|---|---|---|---|---|---|
| 1 | `message.received` | Coach sends a text message | `messenger.controller.ts:125` (`sendMessage`) | `client:<clientId>` | actionable | **Broken** — client can't receive it (no client-side consumer) |
| 2 | `message.received` | Coach sends an attachment | `messenger.controller.ts:180` (`sendAttachment`) | `client:<clientId>` | actionable | **Broken** — same as above |
| 3 | `message.received` | Coach broadcasts to N threads | `messenger.controller.ts:301` (`broadcastMessage`) | `client:<clientId>` × N | actionable | **Broken** — same as above |
| 4 | `message.received` | Client sends a text message | `clientPortal.controller.ts:521` (`sendMessage`) | `teamRecipients(workspaceId)` | actionable | **Working** (coach side consumes via NotificationBell + polling) |
| 5 | `message.received` | Client sends an attachment | `clientPortal.controller.ts:577` (`sendMessageAttachment`) | `teamRecipients(workspaceId)` | actionable | **Working** |
| 6 | `plan.assigned` | Coach activates a training plan | `training.controller.ts:565` | `client:<clientId>` | info (default) | **Broken** — client-side dead end |
| 7 | `plan.assigned` | Coach activates a nutrition plan | `nutrition.controller.ts:550` | `client:<clientId>` | info (default) | **Broken** — client-side dead end |
| 8 | `client.created` | Coach adds a new client | `clients.controller.ts:222` | `teamRecipients(workspaceId, excludeCreator)` | info | **Working** but low value (see §9) |
| 9 | `checkin.submitted` | Client submits a form/check-in | `clientPortal.controller.ts:441` (`submitFormRequest`) | assigned reviewer, else `teamRecipients` | actionable | **Working** |
| 10 | `billing.payment_received` | Fawaterak webhook, payment succeeded | `paymentsWebhook.controller.ts:92` | `ownerRecipients(workspaceId)` | info | **Working** |
| 11 | `billing.payment_failed` | Fawaterak webhook, payment failed/expired/cancelled | `paymentsWebhook.controller.ts:103` | `ownerRecipients(workspaceId)` | alert | **Working** |

**Notable non-triggers** — places you'd expect a notification and there isn't one:

- **Form/check-in reviewed** (`forms.controller.ts` `reviewQueue`) — coach marks a submitted check-in reviewed/actioned; the client is never notified their check-in was seen. No `recordEvent` call in `reviewQueue`, `assignQueue`, `cancelQueue`, or `deleteRequest`.
- **Form/check-in assigned to a teammate** (`assignQueue`) — the assignee isn't notified they now own a review.
- **Form request scheduled/created for a client** (`createRequests`) — client isn't told a new check-in/assessment is waiting.
- **Message read receipts** — no notification-layer signal when a coach reads a client's message or vice versa (this is handled separately via `read_by_team_at`/`read_by_client_at` on `messages`, entirely disconnected from the `notifications` table — see §5).
- **Subscription/access state changes** (freeze, expire, grace-window entry) — the client sees a banner (`ClientPortalNav.js` `showBanner`) computed live from `useClientPortal()`, not a notification row; nothing durable is recorded.
- **Workspace invitations / team membership changes** — no `recordEvent` found in workspace/team modules.

---

## 3. Feature Matrix

| Feature | Coach | Client | Implemented | Working | Needs Review |
|---|---|---|---|---|---|
| Unread badge | ✅ | ❌ | Partial | Coach only | Client bell has no badge at all |
| Notification dropdown/list | ✅ | ❌ | Partial | Coach only | Client page is a "coming soon" stub |
| Mark as read (single) | ✅ | ❌ | Partial | Coach only | No client API exists |
| Mark all as read | ✅ | ❌ | Partial | Coach only | No client API exists |
| Real-time updates (socket) | ❌ | ❌ | Backend only | **No** | Server emits, nothing ever listens (no `socket.io-client` anywhere in `client/`) |
| Polling | ✅ (15s badge, list on open) | ❌ | Coach only | Works | Two independent pollers already exist in coach UI (bell @15s, messenger threads @5s) — see §5 |
| Browser refresh persistence | ✅ | N/A | Yes | Works | Backed by DB, not client state |
| Click navigation | Partial | N/A | Partial | Only `message.received` navigates | 5 of 6 notification types are dead-end clicks (see §6) |
| Grouping | ❌ | ❌ | No | — | Flat reverse-chronological list only |
| Time ago / relative time | ✅ | ❌ | Coach only | Works | `Intl.RelativeTimeFormat`, recalculated once per list fetch |
| Pagination | ❌ | ❌ | No | — | Hard `limit=15` cap, no "load more" |
| Infinite scroll | ❌ | ❌ | No | — | — |
| Push notifications (mobile/web push) | ❌ | ❌ | No | — | Doc comment in `events.ts` anticipates "a later email/push consumer" — not built |
| Email notifications | ❌ | ❌ | No | — | Same — anticipated, not built |
| Sound | ❌ | ❌ | No | — | — |
| Desktop notifications (Notification API) | ❌ | ❌ | No | — | — |

---

## 4. UI Audit

**Coach `NotificationBell.js`:**
- Uses raw `Bell`/`Check` (lucide) + a HeroUI `Button` for the trigger; the dropdown panel itself is hand-rolled `div`s (`bg-card`, `border-border`, `rounded-xl`, `shadow-xl`) rather than a HeroUI `Popover`/`Dropdown` primitive — inconsistent with components elsewhere that do use HeroUI compound components (worth checking against the rest of the coach shell for the prevailing pattern).
- Empty state: centered `Bell` icon at 25% opacity + muted text — reasonable and consistent with other empty states in the app (per memory: an `EmptyState` shared component exists for exactly this — this bell doesn't use it; it inlines its own markup instead of the shared component).
- Loading state: a single centered text line ("Loading…") — no skeleton, inconsistent with panels elsewhere in the app that use skeleton rows for lists.
- Error handling: every fetch's `.catch()` silently swallows and either does nothing or resets to an empty array — a network failure looks identical to "no notifications," which is misleading.
- Read vs unread: unread rows get a `bg-primary/5` tint and a small primary dot; read rows get `ps-4` to align text without the dot. This is a legible, minimal treatment.
- Badge: primary-colored pill, `99+` cap — fine, standard.

**Client portal:**
- `ClientPortalNav.js` bell: plain icon-only link, no badge, no active-state distinction beyond the usual nav highlight — visually it looks identical whether there are 0 or 40 unread notifications, which will read as "notifications don't work" to a client even once the backend starts serving them.
- `/portal/notifications` page: literally a "Coming soon" empty-state screen. No loading state, no error state, no list — there is nothing to be inconsistent *with* yet, because nothing renders.
- Because the client page renders no data, none of the read/unread visual language from the coach bell exists on this side to compare against.

**Cross-portal inconsistency:** the coach experience is a dropdown-from-header pattern; the client experience is a dedicated full page reached via bottom-tab-adjacent nav. That's a defensible product decision given the client portal's mobile-first bottom-nav layout, but it means the *eventual* client notification UI cannot just reuse `NotificationBell.js` as-is — it needs its own list-page component, which doesn't exist yet.

---

## 5. Code Quality Review

- **Duplicate logic:** `message.received` recording is duplicated four times nearly verbatim (`messenger.controller.ts` ×3, `clientPortal.controller.ts` ×2) — each call site repeats the same `recordEvent({...})` shape with only recipient direction and title text varying. Not yet a "rule of three" violation to block on, but a natural extraction point (`notifyNewMessage(direction, thread, message, actor)`).
- **Mislabeled type reuse:** `NotificationBell.js`'s `displayText()` hardcodes `case 'message.received': return t('types.messageReceived')` → *"New message from a client"*. This is correct today only because the bell is coach-only. The same `message.received` type is recorded for coach→client messages too (trigger #1–3 above); if a client-side bell is ever built by pointing it at the same translation map, coach-authored messages would render with the label "New message from a client" — backwards. The stored per-event `title` field (which *does* correctly differ: "New message from your coach" vs "New message from a client") is discarded in favor of this generic mapping. This needs a recipient-aware type or split event types (`message.received.by_coach` / `message.received.by_client`) before the client UI is built, not after.
- **Two disconnected "unread" systems for messaging:** the messenger thread list computes its own `unread_count` per thread from `messages.read_by_team_at IS NULL` (raw SQL in `getThreads`), while the notification bell's unread count comes from `notifications.read_at IS NULL`. These are written independently and read independently — nothing keeps them in sync. It's possible for the bell to show 3 unread while the thread list shows a different count, or for a coach to open a thread (clearing `read_by_team_at` via `getMessages`) without ever touching the corresponding `notifications` row, leaving the bell's badge stuck.
- **Missing optimistic-update rollback:** `NotificationBell.js`'s `markAllRead`/`handleClick` update local state optimistically *before* awaiting confirmation in one case and *after* in the try body in another — inconsistent, and neither rolls back on failure (the `catch {}` is empty), so a failed PATCH silently leaves the UI in a "read" state that the server never persisted.
- **No error state, ever:** every network call in `NotificationBell.js` ends in `.catch(() => setX(...))` or `.catch(() => {})` — there is no user-visible "couldn't load notifications, retry" path anywhere in this feature.
- **Race condition potential:** the 15s badge poll and the on-open list fetch (`fetchList`) are entirely independent requests with no shared cache/dedup; opening the dropdown right as the interval fires can produce two in-flight requests whose responses can land out of order (no request-id/abort guard), occasionally leaving `unread` and `items` briefly inconsistent.
- **Dead/unconsumed code:** the entire `realtime` parameter of `DomainEvent` (and the bell-ping emit in `recordEvent`) is unreachable from any current frontend code path — see §1.4. Not unused in the "delete it" sense (mobile may use it, unverified), but worth confirming before investing further in the socket layer, or ripping it out if truly dead.
- **Performance:** `listNotifications` and `getUnreadCount` are simple, indexed, cheap queries — no concern there. `teamRecipients`/`ownerRecipients` do a full `workspace_members` scan per event; fine at current scale, but `broadcastMessage`'s `Promise.all(threads.map(... recordEvent))` fires one `createMany` + one socket emit *per thread* rather than batching into a single `createMany` across all recipients — for the documented cap of 500 threads that's up to 500 individual round-trips to the DB and to socket.io in the worst case, all sequentially awaited in the parent `Promise.all`. Worth batching into one `recordEvent`-equivalent call with N recipients when this path is revisited.
- **Missing loading state on click-triggered actions:** clicking a notification (`handleClick`) shows no spinner/disabled state while the mark-read PATCH is in flight; double-clicking before it resolves can double-fire the read PATCH (harmless here since `markRead` is idempotent server-side, but worth noting as a general pattern gap).

---

## 6. Navigation Audit

| Notification type | Expected destination | Actual destination | Status |
|---|---|---|---|
| `message.received` (coach viewing) | Open the specific client thread | `/${workspaceSlug}/messenger` (thread list, not the specific thread) | **Partially broken** — lands on the messenger module but does not deep-link to the thread from `entity.id` (a `thread` id is recorded and available) |
| `plan.assigned` | Open the assigned plan (training/nutrition) for that client | No navigation at all — click only marks read | **Broken** |
| `checkin.submitted` | Open the forms/check-in queue, ideally the specific submission | No navigation at all | **Broken** |
| `client.created` | Open the new client's profile | No navigation at all | **Broken** |
| `billing.payment_received` | Open billing/subscription settings | No navigation at all | **Broken** |
| `billing.payment_failed` | Open billing/subscription settings | No navigation at all | **Broken** |
| Any client-facing type | Relevant portal page | N/A — no client notification UI exists to click | **Not implemented** |

Every notification carries `entity: { type, id }` in `recordEvent`'s payload (`thread`, `training_plan`, `nutrition_plan`, `client`, `form_request`, `workspace_payment`) but this `entity_type`/`entity_id` is stored on the row and returned by `GET /api/notifications` **unused** by the frontend — `handleClick` never reads `notification.entity_type`/`entity_id`, it only special-cases the `type` string for one case out of six. This is the fix with the highest leverage-to-effort ratio in the whole audit: the data needed for correct navigation is already there, just not read.

No workspace-slug or invalid-ID issues were found in the one navigation path that exists (`message.received` → `/${workspaceSlug}/messenger`), since `workspaceSlug` comes from `useParams()` and is guarded (`if (... && workspaceSlug)`).

---

## 7. Real-Time Audit

- **How notifications "arrive" today:** exclusively via polling. Coach: 15s interval for the badge count; list only refreshed on dropdown open. Client: never (no fetch exists).
- **Does the badge update instantly?** No. Worst case is a 15s delay after an event; there is no push path that shortens this, despite the infrastructure existing server-side.
- **Does the dropdown update instantly?** No — it only refetches when opened.
- **Multi-tab sync:** none. Two tabs of the coach portal each run their own independent 15s poller and their own local `items`/`unread` state; marking read in one tab does not update the other until its next poll tick.
- **Do coach and client receive notifications at the correct time relative to each other?** The write (durable row) happens synchronously and correctly scoped in all 11 trigger sites. The *delivery* is where it diverges: the coach eventually sees it (≤15s); the client never does, at any latency, because there's no consumer.
- **Reconnect logic:** N/A — there is no live connection to reconnect, since no socket client exists in the web app. If/when one is added, `socket.ts`'s JWT-in-handshake auth (cookie → auth payload → bearer header) is a reasonable, already-built foundation to build reconnect logic on top of.

---

## 8. Database Audit

- **Schema:** flat, single-table, reasonably normalized for a notification feed (recipient polymorphism via `recipient_type`/`recipient_id` rather than two FK columns — appropriate given `user`/`client` live in different tables).
- **Read state:** nullable `read_at` timestamp — simple and sufficient; no separate "seen vs read" distinction (not needed at this feature's current maturity).
- **Soft delete:** none. There's no `deleted_at`, and no delete endpoint exists — rows accumulate forever. For an actively messaging product this table will grow unbounded; combined with the client-side rows that can *never* be marked read today (§1.6), this table's dead-row percentage will only climb.
- **Expiration/cleanup:** none. CLAUDE.md's own §11 pattern (in-process interval jobs, wrapped in try/catch, documented cadence) is used elsewhere in this codebase (per the framework doc) but has not been applied here — there is no scheduled purge of old/read notifications.
- **Indexes:** two composite indexes, both sensible —`(recipient_type, recipient_id, read_at, created_at desc)` for the list/unread queries, and `(workspace_id, created_at desc)` for potential workspace-wide feeds (currently unused by any query, since all reads are scoped to a single recipient — dead index, low cost to keep, worth confirming it's actually needed before the workspace-wide feed exists).
- **Foreign keys:** none declared (`workspace_id`, `recipient_id`, `actor_id`, `entity_id` are all bare strings, no `@relation`). Consistent with this table's polymorphic design (a strict FK can't point at "either `users` or `clients`" cleanly in Prisma without a join table), but it does mean an orphaned `workspace_id`/`recipient_id` (e.g., a deleted client) leaves stale, unfetchable-by-normal-means rows behind rather than cascading.
- **Recommendations:**
  1. Add a client-facing read path (this is a product gap, not a schema gap — the schema already supports `recipient_type: 'client'` fully).
  2. Add a scheduled cleanup job (e.g., hard-delete read notifications older than N days, or all notifications older than N months) per the CLAUDE.md §11 in-process-job pattern already used elsewhere.
  3. Consider whether `entity_type`/`entity_id` should be indexed if a future "jump to entity" or "collapse duplicate notifications for the same entity" feature is built.

---

## 9. Missing Product Features

**High Priority**
- **Client-facing notifications, end to end** — API route, auth-scoped list/unread-count/mark-read endpoints (mirroring the coach module but keyed off `req.client`), and a real UI replacing the "coming soon" page + a badge on the nav bell. This is the single largest gap in the whole system.
- **Notification click → correct destination**, using the `entity_type`/`entity_id` already stored (§6). Currently 5 of 6 coach notification types are dead ends.
- **Check-in reviewed → notify client.** Right now a client who submits a check-in gets no signal that their coach ever looked at it — this is a core coaching-loop feedback moment and it's silent today.

**Medium Priority**
- **Check-in/form assigned → notify the assignee.** Currently invisible to the teammate it was routed to; they'd only discover it by manually checking the queue.
- **New form/check-in request created for a client → notify the client** that something is waiting on them.
- **Subscription state changes (frozen, expiring soon, expired) → a durable notification**, not just a live-computed banner. A banner disappears once fixed and is invisible if the client isn't in the portal when it happens; a durable row plus (eventually) an email gives the coach a paper trail and the client a heads-up before they lose access.
- **Real delivery latency fix**: either wire the frontend to the existing Socket.IO server (small, since auth/rooms already exist) or shorten/adjust polling — right now the "durable" half of the `recordEvent` design is solid but the "instant" half is entirely unrealized in the browser.

**Low Priority**
- Grouping ("5 new messages from clients" collapsed) once volume justifies it.
- Pagination/infinite scroll past the current 15-item cap.
- Email notification consumer (explicitly anticipated in `events.ts`'s own doc comment: "a later email/push consumer can read the same rows" — the durable-row design was built with this in mind).
- Sound/desktop `Notification` API for the coach portal when a tab is backgrounded.
- Notification preferences (mute a category, per-client mute, etc.) — no infrastructure for this today (no per-user/per-type settings table).

---

## 10. Final Report

### A. Current Architecture
A single `notifications` table, written through one disciplined choke point (`recordEvent`) that guarantees every event is both durable and (in principle) realtime. Eleven trigger sites across messenger, client portal, training/nutrition activation, client creation, and the payment webhook all funnel through it correctly and scope recipients correctly (`user` vs `client`, per-workspace). The design is sound; the *consumption* side is where it falls apart.

### B. Everything Working
- Durable recording for all 11 trigger sites, correctly scoped, best-effort (never breaks the parent request).
- Coach-side list/unread-count/mark-read/mark-all-read API, and a functioning polling-based `NotificationBell` UI with sensible empty/read/unread visuals.
- Coach → client and client → coach messaging both correctly write `message.received` rows (delivery to the client is the broken half, not the writing).
- Payment webhook notifications to workspace owners (received + failed), correctly scoped and importance-tagged.
- Indexing is appropriate for current query patterns.

### C. Everything Broken
- **No client-portal notification delivery at all** — no API route, no fetch, no badge, page is a placeholder. Every `recipient_type: 'client'` row ever written is permanently unread and unreadable through normal means.
- **Realtime is fully unconsumed** — Socket.IO is authenticated and room-scoped server-side; zero frontend code (web) ever connects. All "instant" delivery claims in the code's own comments are aspirational, not real, in the browser today.
- **5 of 6 coach notification types don't navigate anywhere** on click, despite the data (`entity_type`/`entity_id`) needed to do so already being stored and returned.
- **Two independent, unsynced "unread" signals** for messaging (`messages.read_by_team_at` vs `notifications.read_at`) can drift from each other.
- **Type-to-label mapping is direction-blind** (`message.received` always renders as "from a client"), which will silently mis-render the moment a client-facing bell reuses the same map.

### D. Missing Features
See §9 in full — headline items: client notification delivery, check-in-reviewed feedback loop, assignment notifications, click-to-destination navigation, subscription-state notifications, email/push consumers.

### E. UX Improvements
- Give the client portal bell a real badge and a real list, matching the visual language already established by the coach bell (read/unread tint, empty state via the shared `EmptyState` component rather than inlined markup).
- Add a loading skeleton instead of a bare "Loading…" line.
- Surface fetch failures instead of silently rendering an empty list.
- Make every notification clickable to somewhere real.

### F. Technical Improvements
- Extract the duplicated `message.received` recording (4 call sites) into one helper.
- Split or parameterize the `message.received` type so direction is explicit before building the client UI on top of it.
- Batch `broadcastMessage`'s per-thread `recordEvent` calls into a single durable insert + minimized socket fan-out.
- Either wire up `socket.io-client` in the web app (the server-side auth/rooms are ready) or strip the now-dead `realtime` plumbing and lean fully into a well-tuned poll — don't leave both half-built.
- Add a scheduled cleanup/expiration job for old read notifications, following the existing in-process-interval pattern used elsewhere in this codebase.
- Reconcile or merge the messenger unread-count signal with the notifications unread signal so they can't drift.

### G. Recommended Implementation Order

**Phase 1 — Critical bugs / correctness**
1. Fix notification click navigation to use `entity_type`/`entity_id` for all 6 existing coach types.
2. Resolve the `message.received` direction-blind label before it's reused client-side.
3. Reconcile the two messaging unread signals (or explicitly document why they're allowed to diverge, if that's intentional).

**Phase 2 — Missing functionality**
4. Build the client-portal notification API (mirror the coach module, scoped to `req.client`).
5. Build the client-portal notification UI (badge + list), replacing the placeholder page.
6. Add the check-in-reviewed → notify-client trigger.
7. Add the assignment → notify-assignee trigger.

**Phase 3 — UX improvements**
8. Loading skeletons, visible error states, and shared `EmptyState` usage across both bells.
9. Deep-link `message.received` to the specific thread, not just the messenger module root.
10. Subscription-state notifications (durable rows, not just a live banner).

**Phase 4 — Future enhancements**
11. Wire real Socket.IO consumption in the web client (or remove the dead realtime plumbing).
12. Notification cleanup/expiration job.
13. Email/push consumer reading the same durable rows.
14. Grouping, pagination/infinite scroll, notification preferences, sound/desktop notifications.

---

*No code was modified in the course of this audit.*
