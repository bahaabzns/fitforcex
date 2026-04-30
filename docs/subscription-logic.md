# Subscription Logic — Full Reference

## Overview

A client's subscription status is computed **on every request** from three data sources:

| Source | Table | Key Fields |
|--------|-------|------------|
| Transactions | `transactions` | `status`, `duration`, `start_mode`, `subscription_start_date`, `created_at` |
| Freezes | `subscription_freezes` | `freeze_start_date`, `freeze_duration_days` |
| Plan activations | `training_plans`, `nutrition_plans` | `activated_at` |

Nothing is persisted to a `subscription_status` column — it is always derived. The function `computeSubscriptionStatus(transactions, freezes, firstPlanActivationDate)` lives in `server/utils/subscriptionStatus.js` and is shared by the clients list endpoint and the transactions endpoint.

---

## Status Values

| Status | Meaning |
|--------|---------|
| **No Subscriptions** | The client has zero transactions of any kind |
| **Pre-start** | A subscription exists but its start date hasn't arrived yet |
| **Active** | Today falls inside a subscription period |
| **Frozen** | Today falls inside a freeze window that overlaps the active period |
| **Expired** | All subscription periods have ended |
| **Refunded** | At least one transaction is marked `refunded` |

---

## Step-by-Step Computation

### 1 — No Subscriptions (immediate exit)

```
if allTransactions.length === 0  →  "No Subscriptions"
```

The client has never had any transaction recorded — not even a refund.

---

### 2 — Refunded (immediate exit)

```
if any transaction.status === 'refunded'  →  "Refunded"
```

Checked before anything else. A single refunded transaction makes the whole client "Refunded" regardless of other transactions.

---

### 3 — Build the timeline

Only **completed** transactions with a **positive duration** participate in the timeline. They are sorted by `created_at` ascending (oldest first).

Each transaction produces one **period** (a start date → end date span). The start date depends on the transaction's `start_mode`:

#### `start_mode` values

| Mode | Set by | Start date rule |
|------|--------|-----------------|
| `on_first_plan` | Default — no custom date provided when creating | Use the date of the client's first plan activation (`MIN(activated_at)` across training + nutrition plans). If no plan has been activated yet → **Pre-start** |
| `custom` | Coach explicitly set a subscription start date | Use `subscription_start_date` from the transaction |
| `queued` | Auto-set by the backend when an Active subscription already exists at insert time | Use the end date of the previous period |

> **Auto-queuing rule:** When a new transaction is created (POST `/api/transactions`), the backend runs `computeSubscriptionStatus` against the *existing* transactions for that client. If the result is `"Active"`, the new transaction's `start_mode` is automatically set to `"queued"`. The coach does not set this manually.

#### Period end date

```
end = start + duration_days
```

Then every freeze that falls **within** this period extends the end:

```
for each freeze:
    if freeze_start >= period_start AND freeze_start < period_end:
        period_end += freeze_duration_days
```

Freezes are applied to the period they *start inside*. A freeze cannot start after a period has already ended.

#### Subsequent transactions (queued or on_first_plan #2+)

Once a first period exists, every subsequent completed transaction — regardless of its `start_mode` — starts immediately after the previous period ends (`prevEnd`). This is how queuing chains work: each period picks up exactly where the last one left off.

---

### 4 — Evaluate today against the timeline

After building all periods, the algorithm walks through them in order (oldest first):

```
for each period (start → end):
    if today < start   →  "Pre-start"   (subscription hasn't started)
    if today in [start, end):
        if today falls inside any freeze window  →  "Frozen"
        else                                     →  "Active"

if no period matched  →  "Expired"
```

---

## All Possible Scenarios

### Scenario 1 — New client, no transactions

```
Transactions : []
Status       : No Subscriptions
```

---

### Scenario 2 — Transaction added, mode = on_first_plan, no plan activated yet

```
Transactions : [{ duration: 30, start_mode: 'on_first_plan', status: 'completed' }]
Plan activations: none
Status       : Pre-start
```

The subscription exists but there is no plan activation date to anchor it to. The clock hasn't started.

---

### Scenario 3 — Transaction added, mode = on_first_plan, plan activated today (2025-06-01)

```
Transactions      : [{ duration: 30, start_mode: 'on_first_plan' }]
First plan activated: 2025-06-01
Today             : 2025-06-15   (day 14 of 30)
Period            : 2025-06-01 → 2025-07-01
Status            : Active
```

---

### Scenario 4 — Custom start date in the future

```
Transactions : [{ duration: 30, start_mode: 'custom', subscription_start_date: '2025-08-01' }]
Today        : 2025-07-20
Period       : 2025-08-01 → 2025-08-31
Status       : Pre-start
```

The coach set an explicit start date that hasn't arrived yet.

---

### Scenario 5 — Custom start date in the past, still active

```
Transactions : [{ duration: 30, start_mode: 'custom', subscription_start_date: '2025-06-01' }]
Today        : 2025-06-15
Period       : 2025-06-01 → 2025-07-01
Status       : Active
```

---

### Scenario 6 — Subscription expired

```
Transactions : [{ duration: 30, start_mode: 'custom', subscription_start_date: '2025-04-01' }]
Today        : 2025-06-15
Period       : 2025-04-01 → 2025-05-01
Status       : Expired
```

Today is past the end of the only period.

---

### Scenario 7 — Subscription with a freeze (active, not currently frozen)

```
Transactions : [{ duration: 30, start_mode: 'custom', subscription_start_date: '2025-06-01' }]
Freezes      : [{ freeze_start_date: '2025-06-10', freeze_duration_days: 7 }]
Today        : 2025-07-05

Period without freeze : 2025-06-01 → 2025-07-01
Freeze falls within period → extend end by 7 days
Period with freeze    : 2025-06-01 → 2025-07-08
Status       : Active  (today 2025-07-05 < 2025-07-08, and today is not inside the freeze window)
```

The freeze already ended (June 10–17), but it extended the expiry by 7 days. The client is still active.

---

### Scenario 8 — Subscription currently frozen

```
Transactions : [{ duration: 30, start_mode: 'custom', subscription_start_date: '2025-06-01' }]
Freezes      : [{ freeze_start_date: '2025-06-20', freeze_duration_days: 14 }]
Today        : 2025-06-22

Period with freeze : 2025-06-01 → 2025-07-15  (2025-07-01 + 14 days)
Today is inside period AND inside freeze window [2025-06-20, 2025-07-04)
Status       : Frozen
```

---

### Scenario 9 — Queued subscription (second subscription while first is active)

```
Transactions (created_at order):
  tx1: { duration: 30, start_mode: 'custom', subscription_start_date: '2025-06-01' }
  tx2: { duration: 30, start_mode: 'queued' }  ← auto-set at insert time

Today : 2025-06-15

Period 1 : 2025-06-01 → 2025-07-01  (tx1, custom)
Period 2 : 2025-07-01 → 2025-07-31  (tx2, starts where tx1 ends)
Status   : Active (today is inside period 1)
```

When the coach adds tx2 while tx1 is active, the backend detects `Active` status and marks tx2 as `queued`. It doesn't start immediately — it starts the day period 1 ends.

---

### Scenario 10 — Queued subscription becomes active

Same as Scenario 9, but:

```
Today : 2025-07-10
Period 1 : 2025-06-01 → 2025-07-01  (expired)
Period 2 : 2025-07-01 → 2025-07-31  (active)
Status   : Active
```

The algorithm walks periods in order. Period 1 is fully in the past, so it falls through. Period 2 contains today → Active.

---

### Scenario 11 — Both subscriptions expired

```
Today : 2025-08-15
Period 1 : 2025-06-01 → 2025-07-01
Period 2 : 2025-07-01 → 2025-07-31
No period contains today, all are in the past.
Status   : Expired
```

---

### Scenario 12 — Three subscriptions (1 expired, 1 active, 1 queued)

```
tx1: custom, start 2025-04-01, duration 30  → period: Apr 01 – May 01
tx2: queued, duration 30                    → period: May 01 – May 31
tx3: queued, duration 30                    → period: May 31 – Jun 30

Today : 2025-05-15
Status : Active  (inside period 2)
```

---

### Scenario 13 — Refunded transaction overrides everything

```
Transactions :
  [{ status: 'completed', duration: 30, ... },
   { status: 'refunded' }]
Status       : Refunded
```

Even if one completed transaction would result in Active, the presence of any refunded transaction short-circuits the whole computation.

---

### Scenario 14 — Freeze extends into a queued period

Freezes are applied **per period** — only if the freeze start date falls within that period's current window. A freeze that starts in period 1 extends period 1's end, which also pushes period 2's start forward (since period 2 starts where period 1 ends).

```
tx1: custom, start 2025-06-01, duration 30 → raw end: 2025-07-01
freeze: start 2025-06-25, duration 10

Freeze starts within period 1 (Jun 25 < Jul 01) → extend period 1 end by 10 days
Period 1: 2025-06-01 → 2025-07-11

tx2: queued, duration 30 → starts at prevEnd = 2025-07-11
Period 2: 2025-07-11 → 2025-08-10

Today : 2025-07-05
Status : Active (inside period 1, and today is inside freeze window Jun 25 – Jul 05)
→ Actually: Frozen
```

---

## Data Flow Summary

```
Coach adds client
    └── No transactions yet → "No Subscriptions"

Coach records a payment (POST /api/transactions)
    ├── Backend checks current status of existing transactions
    │   └── If Active → start_mode = 'queued'
    │   └── Otherwise → start_mode = 'on_first_plan' (or 'custom' if date provided)
    └── Transaction saved

Coach activates a training or nutrition plan
    └── activated_at recorded once (COALESCE so it never overwrites)
    └── on_first_plan subscriptions now have an anchor date

GET /api/clients or GET /api/clients/:id
    └── Fetches transactions + freezes + first plan activation per client
    └── Runs computeSubscriptionStatus()
    └── Returns computed status — nothing is stored
```

---

## Edge Cases

| Situation | Result |
|-----------|--------|
| Transaction with `duration = 0` or `duration = null` | Excluded from timeline (treated as non-subscription payment) |
| Freeze start date after period end | Freeze is ignored for that period (no effect) |
| Freeze start date before period start | Freeze is ignored (only counted if it starts *within* the period) |
| Multiple freezes | Each is applied independently to whichever period it falls within |
| `on_first_plan` second transaction (after a queued one expires) | Picks up from `prevEnd`, so `firstPlanActivationDate` is not used for subsequent transactions |
| Client has only refunded transactions | Returns "Refunded" before timeline is evaluated |
| Custom date in the past + plan not activated | Timeline builds normally from the custom date; plan activation is irrelevant for `custom` mode |
