# Billing Period Toggle + Per-Seat Pricing — Implementation Plan

Two linked features wired end-to-end from DB → admin panel → public API → landing page.

---

## Overview

| Feature | What it does |
|---|---|
| **Billing period toggle** | Monthly / Quarterly / Semi-Annual / Annual pill selector above pricing cards. Each period applies a global discount (e.g. Annual = 20% off). Cards animate to show the discounted per-month effective price. |
| **Per-seat pricing** | Plans with `has_team_counter = true` gain a `price_per_seat` field. The Team Members counter on the landing page adds `(teamMembers - 1) × price_per_seat` to the base price in real time, also subject to the selected billing period discount. |

---

## Data Model

### New table: `billing_discounts`

Stores the four billing periods globally (same discounts apply to all plans).

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `period_key` | TEXT UNIQUE NOT NULL | `monthly`, `quarterly`, `semi_annual`, `annual` |
| `label` | TEXT NOT NULL | Display label: "Monthly", "Quarterly", etc. |
| `save_label` | TEXT | Shown inside the pill: `null`, "Save 5%", "Save 10%", "Save 20%" |
| `discount_percent` | INTEGER NOT NULL DEFAULT 0 | 0 / 5 / 10 / 20 |
| `months` | INTEGER NOT NULL DEFAULT 1 | Billing cycle length: 1 / 3 / 6 / 12 |
| `sort_order` | INTEGER NOT NULL DEFAULT 0 | Left-to-right order in the toggle |
| `is_active` | BOOLEAN NOT NULL DEFAULT true | Hidden periods are excluded from public API |

### Amended table: `plans`

Three new columns:

| Column | Type | Notes |
|---|---|---|
| `price_per_seat` | DECIMAL(10,2) | Monthly cost per additional team member. `NULL` = no per-seat charge. Only meaningful when `has_team_counter = true`. |
| `min_seat_count` | INTEGER NOT NULL DEFAULT 1 | Minimum selectable value in the counter widget. Counter cannot go below this. |
| `max_seat_count` | INTEGER NOT NULL DEFAULT 20 | Maximum selectable value in the counter widget. Counter cannot go above this. |

> `min_seat_count` / `max_seat_count` control the **UI counter bounds** on the landing page. They are independent of `max_team_seats`, which is the hard server-side enforcement limit for the workspace subscription.

---

## Price Calculation Logic

```
effectivePricePerMonth = (price_monthly + max(0, teamMembers - 1) × price_per_seat) × (1 − discount_percent / 100)
billedTotal            = effectivePricePerMonth × months         // shown as tooltip / sub-label
```

- `teamMembers` initialises to `plan.min_seat_count`. Counter clamps between `min_seat_count` and `max_seat_count`.
- When `price_per_seat` is null or 0, the counter still shows (if `has_team_counter = true`) but the price does not change.
- Plans with `price_monthly = null` ("Custom pricing") are never affected by either widget.

---

## Step 1 — DB Migration

**File:** `server/migrations/006_billing_discounts_and_seat_price.js`

```js
exports.up = (pgm) => {
    pgm.createTable('billing_discounts', {
        id:               { type: 'serial',  primaryKey: true },
        period_key:       { type: 'text',    notNull: true, unique: true },
        label:            { type: 'text',    notNull: true },
        save_label:       { type: 'text',    notNull: false, default: null },
        discount_percent: { type: 'integer', notNull: true, default: 0 },
        months:           { type: 'integer', notNull: true, default: 1 },
        sort_order:       { type: 'integer', notNull: true, default: 0 },
        is_active:        { type: 'boolean', notNull: true, default: true },
    });

    pgm.addColumns('plans', {
        price_per_seat: { type: 'decimal(10,2)', notNull: false, default: null },
    });
};

exports.down = (pgm) => {
    pgm.dropTable('billing_discounts');
    pgm.dropColumns('plans', ['price_per_seat']);
};
```

### 1.2 Seed `billing_discounts`

Run once after migration:

```sql
INSERT INTO billing_discounts (period_key, label, save_label, discount_percent, months, sort_order)
VALUES
    ('monthly',     'Monthly',     null,        0,  1,  1),
    ('quarterly',   'Quarterly',   'Save 5%',   5,  3,  2),
    ('semi_annual', 'Semi-Annual', 'Save 10%',  10, 6,  3),
    ('annual',      'Annual',      'Save 20%',  20, 12, 4);
```

---

## Step 2 — Public API Endpoint

### 2.1 Add `GET /api/billing-discounts` to `server/routes/plans.js`

Append below the existing `GET /` handler:

```js
router.get('/billing-discounts', async (req, res, next) => {
    try {
        const { rows } = await pool.query(`
            SELECT id, period_key, label, save_label, discount_percent, months
            FROM billing_discounts
            WHERE is_active = true
            ORDER BY sort_order ASC
        `);
        res.json(rows);
    } catch (err) {
        next(err);
    }
});
```

### 2.2 Mount in `server/server.js`

Already mounted as `/api/plans` — no change needed. The new route resolves at `/api/plans/billing-discounts`.

### 2.3 Update `GET /api/plans` query to include `price_per_seat`

In the existing SELECT in `server/routes/plans.js`, add `price_per_seat` to the column list:

```sql
SELECT
    id, name, display_name, subtitle,
    price_monthly, price_per_seat,   -- ← add price_per_seat
    currency, is_popular, cta_text, cta_variant,
    payment_link, features_header, features_subheader,
    has_team_counter, features
FROM plans
WHERE is_active = true AND show_on_landing = true
ORDER BY sort_order ASC, id ASC
```

---

## Step 3 — Admin CRUD for Billing Discounts

### 3.1 Add routes to `server/routes/admin.js`

Add a new section after the plans block:

```js
// ── Billing Discounts ──────────────────────────────────────────────────────────

router.get('/billing-discounts', adminAuthMiddleware, async (req, res, next) => {
    try {
        const { rows } = await pool.query(
            'SELECT * FROM billing_discounts ORDER BY sort_order ASC'
        );
        res.json(rows);
    } catch (err) { next(err); }
});

router.put('/billing-discounts/:id', adminAuthMiddleware, async (req, res, next) => {
    const { label, save_label, discount_percent, months, sort_order, is_active } = req.body;
    try {
        const { rows } = await pool.query(`
            UPDATE billing_discounts
            SET label            = COALESCE($1, label),
                save_label       = $2,
                discount_percent = COALESCE($3, discount_percent),
                months           = COALESCE($4, months),
                sort_order       = COALESCE($5, sort_order),
                is_active        = COALESCE($6, is_active)
            WHERE id = $7
            RETURNING *
        `, [
            label?.trim() || null,
            save_label !== undefined ? (save_label?.trim() || null) : null,
            discount_percent ?? null,
            months ?? null,
            sort_order ?? null,
            is_active ?? null,
            req.params.id,
        ]);
        if (!rows.length) return res.status(404).json({ message: 'Not found' });
        res.json(rows[0]);
    } catch (err) { next(err); }
});
```

> No POST/DELETE — the four periods are seeded and fixed. Only their values (discount %, label, active state) are editable.

### 3.2 Update admin `POST /plans` and `PUT /plans/:id` for `price_per_seat`

**POST** — add to destructuring and INSERT:
```js
const { ..., price_per_seat } = req.body;

// In VALUES list add $19:
price_per_seat ?? null
// In column list add:
price_per_seat
```

**PUT** — add to destructuring and SET clause:
```js
const { ..., price_per_seat } = req.body;

// In SET clause add:
price_per_seat = $21   // use next available param number
// In values array add:
price_per_seat !== undefined ? (price_per_seat ?? null) : null
```

---

## Step 4 — Admin Plans UI (`client/app/(admin)/admin/plans/page.js`)

### 4.1 Add `price_per_seat` to `EMPTY_FORM`

```js
const EMPTY_FORM = {
    // ... existing fields ...
    price_per_seat: '',
};
```

### 4.2 Populate edit form

In the `isEdit` branch of `useState` initializer:
```js
price_per_seat: plan.price_per_seat ?? '',
```

### 4.3 Add field to `PlanModal` — inside "Landing Page Display" section

Place it directly below the `has_team_counter` checkbox, conditionally shown:

```jsx
{form.has_team_counter && (
    <div className="flex flex-col gap-1.5 ml-6">
        <label className="text-xs font-medium text-foreground">
            Price per additional team member / month
            <span className="text-muted-foreground ml-1">(blank = no seat charge)</span>
        </label>
        <input
            type="number" min="0" step="0.01" placeholder="0.00"
            value={form.price_per_seat}
            onChange={e => set('price_per_seat', e.target.value)}
            className={INPUT_CLS}
        />
    </div>
)}
```

### 4.4 Include in `handleSave` payload

```js
price_per_seat: parseOptFloat(form.price_per_seat),
```

### 4.5 Add a new "Billing Periods" card below the plans table

This lives on the same page as plans (no new route needed):

```jsx
// State:
const [discounts, setDiscounts] = useState([]);
const [discountsLoading, setDiscountsLoading] = useState(true);
const [editingDiscount, setEditingDiscount] = useState(null);

// Load alongside plans:
api.get('/api/admin/billing-discounts')
    .then(res => setDiscounts(res.data))
    .finally(() => setDiscountsLoading(false));
```

Render a compact inline-edit table:

```jsx
<div className="rounded-xl border border-border overflow-hidden">
    <div className="px-4 py-3 bg-secondary/50 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Billing Periods</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
            Discount applied to the base monthly price for each billing cycle.
        </p>
    </div>

    {/* Header row */}
    <div className="grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 px-4 py-2 bg-secondary/30 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
        <span>Period</span>
        <span>Label</span>
        <span>Save label</span>
        <span>Discount %</span>
        <span>Months</span>
        <span>Active</span>
    </div>

    {discounts.map((d, idx) => (
        editingDiscount?.id === d.id
            ? <BillingDiscountEditRow
                key={d.id}
                discount={d}
                onSave={updated => { /* PUT then reload */ }}
                onCancel={() => setEditingDiscount(null)}
              />
            : <div key={d.id} className={`grid grid-cols-[1fr_auto_auto_auto_auto_auto] gap-4 items-center px-4 py-3 ${idx > 0 ? 'border-t border-border' : ''}`}>
                <span className="text-sm font-mono text-muted-foreground">{d.period_key}</span>
                <span className="text-sm text-foreground w-28">{d.label}</span>
                <span className="text-sm text-foreground w-20">{d.save_label ?? '—'}</span>
                <span className="text-sm text-foreground w-20 text-center">{d.discount_percent}%</span>
                <span className="text-sm text-foreground w-16 text-center">{d.months} mo</span>
                <span className="w-16 flex items-center gap-2">
                    <span className={`text-xs ${d.is_active ? 'text-green-500' : 'text-muted-foreground'}`}>
                        {d.is_active ? 'On' : 'Off'}
                    </span>
                    <button onClick={() => setEditingDiscount(d)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-default hover:text-foreground transition-colors">
                        <Pencil size={14} />
                    </button>
                </span>
              </div>
    ))}
</div>
```

#### `BillingDiscountEditRow` component

Inline row with inputs for `label`, `save_label`, `discount_percent`, `months`, `is_active` + Save / Cancel buttons. On save, calls `api.put('/api/admin/billing-discounts/:id', payload)` then reloads discounts.

---

## Step 5 — Update `LandingPricing.js`

### 5.1 Fetch billing discounts in parallel with plans

```js
const [discounts, setDiscounts] = useState([]);
const [selectedPeriod, setSelectedPeriod] = useState(null); // set to first active period after load

useEffect(() => {
    Promise.all([
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/plans`).then(r => r.ok ? r.json() : Promise.reject()),
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/plans/billing-discounts`).then(r => r.ok ? r.json() : Promise.reject()),
    ])
    .then(([plansData, discountsData]) => {
        setPlans(plansData);
        setDiscounts(discountsData);
        setSelectedPeriod(discountsData[0] ?? null); // default to first (Monthly)
    })
    .catch(() => setError(true))
    .finally(() => setLoading(false));
}, []);
```

### 5.2 Add `BillingPeriodToggle` component

```jsx
function BillingPeriodToggle({ discounts, selected, onSelect }) {
    return (
        <div className="flex justify-center">
            <div className="inline-flex items-center gap-1 rounded-full bg-white/5 border border-white/10 p-1">
                {discounts.map(d => {
                    const isActive = selected?.period_key === d.period_key;
                    return (
                        <button
                            key={d.period_key}
                            onClick={() => onSelect(d)}
                            className={`
                                flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-medium transition-all
                                ${isActive
                                    ? 'bg-primary text-primary-foreground shadow-sm'
                                    : 'text-foreground/60 hover:text-foreground hover:bg-white/5'}
                            `}
                        >
                            {d.label}
                            {d.save_label && (
                                <span className={`text-xs font-semibold ${isActive ? 'text-primary-foreground/80' : 'text-primary'}`}>
                                    {d.save_label}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
```

Render it inside the `!loading && !error` block, above the cards grid:

```jsx
{discounts.length > 1 && (
    <BillingPeriodToggle
        discounts={discounts}
        selected={selectedPeriod}
        onSelect={setSelectedPeriod}
    />
)}
```

### 5.3 Update `TeamMemberCounter` to show per-seat cost

Pass `pricePerSeat` and `currency` as props so the counter can show the running cost:

```jsx
function TeamMemberCounter({ value, onChange, pricePerSeat, currency }) {
    const extraSeats = Math.max(0, value - 1);
    const extraCost  = pricePerSeat ? extraSeats * Number(pricePerSeat) : 0;

    return (
        <div className="flex flex-col gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3">
            <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground/70">Team Members</span>
                <div className="flex items-center gap-3">
                    <button onClick={() => onChange(Math.max(1, value - 1))} ...>−</button>
                    <span className="w-5 text-center font-bold text-foreground">{value}</span>
                    <button onClick={() => onChange(Math.min(20, value + 1))} ...>+</button>
                </div>
            </div>
            {pricePerSeat && extraCost > 0 && (
                <p className="text-xs text-foreground/40">
                    +{extraCost.toLocaleString('en-EG')} {currency} / month for {extraSeats} extra seat{extraSeats !== 1 ? 's' : ''}
                </p>
            )}
        </div>
    );
}
```

### 5.4 Calculate displayed price per card

Inside the `plans.map(...)`:

```js
const discount     = selectedPeriod?.discount_percent ?? 0;
const months       = selectedPeriod?.months ?? 1;
const base         = plan.price_monthly ? Number(plan.price_monthly) : null;
const seatAdd      = plan.price_per_seat
    ? Math.max(0, teamMembers - 1) * Number(plan.price_per_seat)
    : 0;

// Effective per-month price after discount
const effectiveMonthly = base != null
    ? Math.round((base + seatAdd) * (1 - discount / 100))
    : null;

// Total billed this period (shown as subtitle under the price)
const periodTotal = effectiveMonthly != null
    ? effectiveMonthly * months
    : null;

const priceDisplay = effectiveMonthly != null
    ? effectiveMonthly.toLocaleString('en-EG')
    : null;

const periodLabel = months > 1
    ? `billed ${periodTotal.toLocaleString('en-EG')} ${plan.currency} every ${months} mo`
    : null;
```

### 5.5 Update the price block in `Card.Header`

Replace the current price block:

```jsx
<div className="flex flex-col gap-1">
    <div className="flex items-end gap-1.5">
        {priceDisplay ? (
            <>
                <span className="text-4xl font-extrabold text-foreground leading-none transition-all">
                    {priceDisplay}
                </span>
                <div className="flex flex-col leading-tight pb-0.5">
                    <span className="text-sm font-semibold text-foreground/70">{plan.currency}</span>
                    <span className="text-xs text-foreground/40">/ month</span>
                </div>
            </>
        ) : (
            <span className="text-3xl font-bold text-foreground leading-none">Custom pricing</span>
        )}
    </div>
    {periodLabel && (
        <p className="text-xs text-foreground/30">{periodLabel}</p>
    )}
</div>
```

### 5.6 Pass new props to `TeamMemberCounter`

```jsx
{plan.has_team_counter && (
    <TeamMemberCounter
        value={teamMembers}
        onChange={setTeamMembers}
        pricePerSeat={plan.price_per_seat}
        currency={plan.currency}
    />
)}
```

---

## Step 6 — Verify End-to-End

1. Run migration: `cd server && npm run migrate`
2. Seed billing_discounts (one-time SQL above).
3. In admin panel → Plans → edit "Pro" → set `price_per_seat = 500` → Save.
4. In admin panel → Plans page → Billing Periods table → edit "Annual" → change discount to 25% → Save.
5. Visit landing page `/#pricing`:
   - Toggle shows Monthly / Quarterly / Semi-Annual / Annual.
   - Selecting "Annual" updates all card prices (e.g. 2,000 → 1,500 LE/mo, billed 18,000 every 12 mo).
   - Pro card counter: increment team members → price updates per seat.
   - Reload after admin edits → new values reflected immediately.
6. Set a period `is_active = false` → toggle pill disappears on landing page.
7. Set `price_per_seat = null` → counter still shows but price stays flat.

---

## Summary of Files Changed

| File | Change |
|---|---|
| `server/migrations/006_billing_discounts_and_seat_price.js` | **New** — `billing_discounts` table + `price_per_seat` on plans |
| `server/routes/plans.js` | **Edit** — add `GET /billing-discounts`; add `price_per_seat` to plans SELECT |
| `server/routes/admin.js` | **Edit** — `GET/PUT /billing-discounts`; plans POST/PUT handle `price_per_seat` |
| `client/app/(admin)/admin/plans/page.js` | **Edit** — `price_per_seat` field in PlanModal; billing periods inline-edit table |
| `client/app/components/LandingPricing.js` | **Edit** — parallel fetch; `BillingPeriodToggle` component; dynamic price calculation; updated `TeamMemberCounter` |
