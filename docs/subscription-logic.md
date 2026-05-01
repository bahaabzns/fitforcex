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

## Two levels of status

### Client-level status (shown on the clients list)

Represents the overall state of the client's subscription right now.

| Status | Meaning |
|--------|---------|
| **No Subscriptions** | The client has zero transactions of any kind |
| **Pre-start** | A subscription exists but its start date hasn't arrived yet |
| **Active** | Today falls inside a subscription period |
| **Frozen** | Today falls inside a freeze window that overlaps the active period |
| **Expired** | All subscription periods have ended |

### Per-transaction status (shown in each transaction row)

Represents the subscription period contributed by *that specific transaction*.

| Status | Meaning |
|--------|---------|
| **Active** | This transaction's period contains today |
| **Pre-start** | This transaction's period hasn't started yet |
| **Expired** | This transaction's period is in the past |
| **Frozen** | Today falls inside a freeze that overlaps this transaction's period |
| **Refunded** | This transaction was refunded — it is excluded from all period calculations but kept as history |

> **Key rule:** A refunded transaction is **never** used to compute a subscription period. It is kept in the database purely as a payment history record. Refunding a transaction does not affect the client's overall subscription status — only the remaining active/completed transactions matter.

---

## Step-by-Step Computation (client-level)

### 1 — No Subscriptions (immediate exit)

```
if allTransactions.length === 0  →  "No Subscriptions"
```

The client has never had any transaction recorded.

---

### 2 — Build the timeline

Only **completed** transactions with a **positive duration** participate in the timeline. Refunded transactions are excluded. The remaining transactions are sorted by `created_at` ascending (oldest first).

Each transaction produces one **period** (start date → end date). The start date depends on the transaction's `start_mode`:

#### `start_mode` values

| Mode | Set by | Start date rule |
|------|--------|-----------------|
| `on_first_plan` | Default — no custom date provided | Use `MIN(activated_at)` across training + nutrition plans. If no plan activated yet → **Pre-start** |
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

#### Subsequent transactions

Once a first period exists, every subsequent completed transaction — regardless of its `start_mode` — starts immediately after the previous period ends (`prevEnd`). This is how queuing chains work.

---

### 3 — Evaluate today against the timeline

After building all periods, the algorithm walks through them in order (oldest first):

```
for each period (start → end):
    if today < start   →  "Pre-start"
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
Client status: No Subscriptions
```

---

### Scenario 2 — Transaction exists but no plan activated yet (on_first_plan)

```
Transactions : [{ duration: 30, start_mode: 'on_first_plan', status: 'completed' }]
Plan activations: none
Client status: Pre-start
Per-tx status: Pre-start
```

---

### Scenario 3 — Transaction exists, plan activated (2025-06-01), today is day 14

```
Transactions      : [{ duration: 30, start_mode: 'on_first_plan' }]
First activation  : 2025-06-01
Today             : 2025-06-15
Period            : 2025-06-01 → 2025-07-01
Client status     : Active
Per-tx status     : Active
```

---

### Scenario 4 — Custom start date in the future

```
Transactions : [{ duration: 30, start_mode: 'custom', subscription_start_date: '2025-08-01' }]
Today        : 2025-07-20
Period       : 2025-08-01 → 2025-08-31
Client status: Pre-start
Per-tx status: Pre-start
```

---

### Scenario 5 — Custom start date, currently active

```
Transactions : [{ duration: 30, start_mode: 'custom', subscription_start_date: '2025-06-01' }]
Today        : 2025-06-15
Period       : 2025-06-01 → 2025-07-01
Client status: Active
Per-tx status: Active
```

---

### Scenario 6 — Subscription expired

```
Transactions : [{ duration: 30, start_mode: 'custom', subscription_start_date: '2025-04-01' }]
Today        : 2025-06-15
Period       : 2025-04-01 → 2025-05-01
Client status: Expired
Per-tx status: Expired
```

---

### Scenario 7 — Transaction refunded

```
Transactions : [{ duration: 30, status: 'refunded', ... }]
Timeline     : (empty — refunded transactions are excluded)
Client status: Pre-start  (no completed transactions with duration)
Per-tx status: Refunded   (shown only on the transaction row itself)
```

The refunded transaction stays visible in the table for history. It does not affect the client's subscription period.

---

### Scenario 8 — Mix of completed and refunded transactions

```
Transactions :
  tx1: { duration: 30, status: 'completed', start_mode: 'custom', subscription_start_date: '2025-06-01' }
  tx2: { duration: 30, status: 'refunded' }
Today        : 2025-06-15

Timeline built from tx1 only (tx2 excluded):
  Period 1 : 2025-06-01 → 2025-07-01

Client status : Active       (based on tx1's period)
tx1 per-tx status : Active
tx2 per-tx status : Refunded
```

---

### Scenario 9 — Subscription with a freeze (active, not currently frozen)

```
Transactions : [{ duration: 30, start_mode: 'custom', subscription_start_date: '2025-06-01' }]
Freezes      : [{ freeze_start_date: '2025-06-10', freeze_duration_days: 7 }]
Today        : 2025-07-05

Period without freeze : 2025-06-01 → 2025-07-01
Freeze falls within period → extend end by 7 days
Period with freeze    : 2025-06-01 → 2025-07-08
Today (Jul 05) is inside the period but outside the freeze window (Jun 10–17).
Client status: Active
Per-tx status: Active
```

---

### Scenario 10 — Subscription currently frozen

```
Transactions : [{ duration: 30, start_mode: 'custom', subscription_start_date: '2025-06-01' }]
Freezes      : [{ freeze_start_date: '2025-06-20', freeze_duration_days: 14 }]
Today        : 2025-06-22

Period with freeze : 2025-06-01 → 2025-07-15  (Jul 01 + 14 days)
Today is inside period AND inside freeze window [Jun 20, Jul 04).
Client status: Frozen
Per-tx status: Frozen
```

---

### Scenario 11 — Queued subscription (second subscription while first is active)

```
tx1: custom, start 2025-06-01, duration 30
tx2: queued, duration 30  ← auto-set when tx2 was created while tx1 was Active

Today : 2025-06-15
Period 1 : 2025-06-01 → 2025-07-01  (tx1)
Period 2 : 2025-07-01 → 2025-07-31  (tx2, queued after period 1)

Client status      : Active    (today inside period 1)
tx1 per-tx status  : Active
tx2 per-tx status  : Pre-start (period 2 hasn't started)
```

---

### Scenario 12 — Queued subscription becomes active

```
Today        : 2025-07-10
Period 1     : 2025-06-01 → 2025-07-01  (expired)
Period 2     : 2025-07-01 → 2025-07-31  (active)

Client status      : Active    (inside period 2)
tx1 per-tx status  : Expired
tx2 per-tx status  : Active
```

---

### Scenario 13 — Three subscriptions (1 expired, 1 active, 1 queued)

```
tx1: custom, start 2025-04-01, duration 30  → period: Apr 01 – May 01
tx2: queued, duration 30                    → period: May 01 – May 31
tx3: queued, duration 30                    → period: May 31 – Jun 30

Today : 2025-05-15
Client status      : Active
tx1 per-tx status  : Expired
tx2 per-tx status  : Active
tx3 per-tx status  : Pre-start
```

---

### Scenario 14 — Freeze shifts a queued period

```
tx1: custom, start 2025-06-01, duration 30 → raw end: 2025-07-01
freeze: start 2025-06-25, duration 10 days

Freeze starts within period 1 → extend period 1 end by 10 days
Period 1 : 2025-06-01 → 2025-07-11

tx2: queued, duration 30 → starts at prevEnd = 2025-07-11
Period 2 : 2025-07-11 → 2025-08-10

Today : 2025-07-05
Client status      : Frozen    (inside period 1, inside freeze window Jun 25 – Jul 05)
tx1 per-tx status  : Frozen
tx2 per-tx status  : Pre-start
```

---

## Data Flow Summary

```
Coach adds client
    └── No transactions → "No Subscriptions"

Coach records a payment (POST /api/transactions)
    ├── Backend checks current status for this client
    │   └── Active → start_mode = 'queued'
    │   └── Otherwise → start_mode = 'on_first_plan' (or 'custom' if date provided)
    └── Transaction saved; refunded transactions are excluded from all period logic

Coach refunds a transaction (PUT /api/transactions status='refunded')
    └── Transaction kept for history
    └── Excluded from timeline — other transactions compute status as if it never existed

Coach activates a training or nutrition plan
    └── activated_at recorded once (COALESCE — never overwritten)
    └── on_first_plan subscriptions now have an anchor date

GET /api/clients or GET /api/clients/:id
    └── Fetches transactions + freezes + first plan activation per client
    └── Runs computeSubscriptionStatus() → client-level status
    └── Per-transaction status is computed on the frontend from the same timeline
```

---

## Edge Cases

| Situation | Result |
|-----------|--------|
| Transaction with `duration = 0` or `duration = null` | Excluded from timeline |
| All transactions are refunded | `completed.length === 0` → client status "Pre-start"; each tx shows "Refunded" |
| Freeze start date after period end | Freeze is ignored for that period |
| Freeze start date before period start | Freeze is ignored (only counted if it starts *within* the period) |
| Multiple freezes | Each applied independently to whichever period it falls within |
| `on_first_plan` second transaction (after queued one) | Picks up from `prevEnd`; `firstPlanActivationDate` is not used |
| Custom date in the past, no plan activated | Timeline builds from the custom date; plan activation irrelevant for `custom` mode |
| Finance page per-tx status (queued/on_first_plan) | Shown as "Pre-start" — full chain context not available without client-scoped fetch |
