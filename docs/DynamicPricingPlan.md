# Dynamic Pricing Section — Implementation Plan

Wire `LandingPricing.js` to the admin panel so that pricing cards are driven by the `plans` table instead of hard-coded data.

---

## Current State

| Layer | What exists |
|---|---|
| DB | `plans` table: `id`, `name` (slug), `display_name`, `max_team_seats`, `max_workspaces`, `features` (JSONB `{}`), `price_monthly`, `is_active`, `is_default`, `trial_days`, `payment_link`, `created_at` |
| Server | `GET /api/admin/plans` — protected by `adminAuthMiddleware`, returns all plans |
| Admin UI | Full CRUD at `/admin/plans` — but only manages the fields above, no landing-page display fields |
| Landing | `LandingPricing.js` — static `const plans = [...]` array; never touches the API |

**Gap:** The DB has no columns for the visual/display properties the landing page needs (`subtitle`, `is_popular`, `cta_text`, `cta_variant`, `features_header`, `features_subheader`, `has_team_counter`, `sort_order`, `currency`, `show_on_landing`). There is also no public API endpoint.

---

## Step 1 — DB Migration

### 1.1 Create migration file

Create `server/migrations/YYYYMMDDHHMMSS_plans_landing_fields.js` (using `node-pg-migrate` which is already installed).

```js
exports.up = (pgm) => {
    pgm.addColumns('plans', {
        subtitle:           { type: 'text',    notNull: false, default: null },
        is_popular:         { type: 'boolean', notNull: true,  default: false },
        cta_text:           { type: 'text',    notNull: true,  default: 'Get Started' },
        cta_variant:        { type: 'text',    notNull: true,  default: 'outline' },
        features_header:    { type: 'text',    notNull: true,  default: "What's included:" },
        features_subheader: { type: 'text',    notNull: false, default: null },
        has_team_counter:   { type: 'boolean', notNull: true,  default: false },
        sort_order:         { type: 'integer', notNull: true,  default: 0 },
        currency:           { type: 'text',    notNull: true,  default: 'LE' },
        show_on_landing:    { type: 'boolean', notNull: true,  default: true },
    });
};

exports.down = (pgm) => {
    pgm.dropColumns('plans', [
        'subtitle', 'is_popular', 'cta_text', 'cta_variant',
        'features_header', 'features_subheader', 'has_team_counter',
        'sort_order', 'currency', 'show_on_landing',
    ]);
};
```

### 1.2 Seed existing plans with correct values

After the migration runs, execute one-time SQL to populate the new columns on existing plans so the landing page immediately reflects the current hard-coded data:

```sql
-- OneForce
UPDATE plans SET
    subtitle           = 'For solo coaches',
    is_popular         = false,
    cta_text           = 'Get Started – It''s FREE!',
    cta_variant        = 'outline',
    features_header    = 'What''s included:',
    features_subheader = null,
    has_team_counter   = false,
    sort_order         = 1,
    currency           = 'LE',
    show_on_landing    = true,
    features           = '["∞ Unlimited clients","Workout & nutrition plan delivery (PDF, Client Portal, Mobile App)","Exercise & food databases","Client tracking (Check-ins, Workout Logs, Progress Photos)","In-portal chat system","Reports and insights","Branded client interface (logo + colors)","Basic support"]'
WHERE name = 'oneforce';  -- adjust to your actual slug

-- TeamForce
UPDATE plans SET
    subtitle           = 'For coaches with teams',
    is_popular         = true,
    cta_text           = 'Get Started – It''s FREE!',
    cta_variant        = 'primary',
    features_header    = 'Everything in OneForce, and:',
    features_subheader = 'Team Features',
    has_team_counter   = true,
    sort_order         = 2,
    currency           = 'LE',
    show_on_landing    = true,
    features           = '["Add team members","Role-based permissions","Team performance tracking","Queue dashboard for request management","Client distribution among team members","Full activity log","Priority support"]'
WHERE name = 'teamforce';

-- EnterpriseForce
UPDATE plans SET
    subtitle           = 'For large coaching businesses & brands',
    is_popular         = false,
    cta_text           = 'Contact Us',
    cta_variant        = 'ghost',
    features_header    = 'Everything in TeamForce, and:',
    features_subheader = 'Enterprise Features',
    has_team_counter   = false,
    sort_order         = 3,
    currency           = null,
    price_monthly      = null,
    show_on_landing    = true,
    features           = '["Unlimited team members","Fully branded mobile app (App Store & Play Store)","Custom automation flows","Advanced workflow settings","Custom dashboards","Integrations (Payment Gateways, CRM, APIs)","Full team onboarding & training","Custom reports & feature development","Dedicated account manager","VIP 24/7 support"]'
WHERE name = 'enterpriseforce';
```

> **Note on `features` column:** The default is `'{}'` (empty JSON object). Once we start storing arrays, always use a JSON array `[]`. The migration does not change existing rows' `features` — the seed SQL above handles the three existing plans. For new plans created through the admin UI, the server must default to `'[]'` (handled in Step 2).

---

## Step 2 — Public Plans API Endpoint

The landing page is public and has no auth cookies. We need a **new, unauthenticated** endpoint.

### 2.1 Add `GET /api/plans` to `server/server.js`

Mount a new lightweight public router **before** the existing `/api/admin` route:

```js
// server/server.js  (add near other route mounts)
server.use('/api/plans', require('./routes/plans'));
```

### 2.2 Create `server/routes/plans.js`

```js
const express = require('express');
const router = express.Router();
const pool = require('../db');

// Public — no auth required
router.get('/', async (req, res, next) => {
    try {
        const { rows } = await pool.query(`
            SELECT
                id,
                name,
                display_name,
                subtitle,
                price_monthly,
                currency,
                is_popular,
                cta_text,
                cta_variant,
                payment_link,
                features_header,
                features_subheader,
                has_team_counter,
                features
            FROM plans
            WHERE is_active = true AND show_on_landing = true
            ORDER BY sort_order ASC, id ASC
        `);
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
```

**Response shape** (one row example):

```json
{
  "id": 1,
  "name": "oneforce",
  "display_name": "OneForce",
  "subtitle": "For solo coaches",
  "price_monthly": "2000.00",
  "currency": "LE",
  "is_popular": false,
  "cta_text": "Get Started – It's FREE!",
  "cta_variant": "outline",
  "payment_link": null,
  "features_header": "What's included:",
  "features_subheader": null,
  "has_team_counter": false,
  "features": ["∞ Unlimited clients", "..."]
}
```

> `payment_link` is used as the CTA href when set; otherwise the component falls back to `/register`.

### 2.3 Update `server/routes/admin.js` — handle new fields in CRUD

**`POST /api/admin/plans`** — add new fields to `INSERT`:

```js
const {
    name, display_name, max_team_seats, max_workspaces, price_monthly,
    features, trial_days, payment_link,
    // new fields
    subtitle, is_popular, cta_text, cta_variant,
    features_header, features_subheader, has_team_counter,
    sort_order, currency, show_on_landing,
} = req.body;

// In the INSERT:
INSERT INTO plans (
    name, display_name, max_team_seats, max_workspaces, price_monthly,
    features, trial_days, payment_link,
    subtitle, is_popular, cta_text, cta_variant,
    features_header, features_subheader, has_team_counter,
    sort_order, currency, show_on_landing
) VALUES (
    $1, $2, $3, $4, $5,
    $6, $7, $8,
    $9, $10, $11, $12,
    $13, $14, $15,
    $16, $17, $18
) RETURNING *
```

Values for the new fields:
```js
subtitle?.trim() || null,
is_popular ?? false,
cta_text?.trim() || 'Get Started',
cta_variant?.trim() || 'outline',
features_header?.trim() || "What's included:",
features_subheader?.trim() || null,
has_team_counter ?? false,
sort_order ?? 0,
currency?.trim() || 'LE',
show_on_landing ?? true,
```

Also ensure `features` defaults to `'[]'` (array), not `'{}'`:
```js
features ? JSON.stringify(features) : '[]'
```

**`PUT /api/admin/plans/:id`** — add the same new fields to the `UPDATE SET` clause using `COALESCE` or direct assignment following the existing pattern.

---

## Step 3 — Update Admin Plans UI (`client/app/(admin)/admin/plans/page.js`)

The admin panel needs to expose all the new display fields so the content team can manage them without touching code.

### 3.1 Extend `EMPTY_FORM`

```js
const EMPTY_FORM = {
    name: '', display_name: '',
    subtitle: '',
    max_team_seats: '', max_workspaces: '',
    price_monthly: '', currency: 'LE',
    trial_days: '', payment_link: '',
    is_active: true, is_default: false,
    is_popular: false, show_on_landing: true,
    cta_text: "Get Started – It's FREE!", cta_variant: 'outline',
    features_header: "What's included:", features_subheader: '',
    has_team_counter: false, sort_order: 0,
    features: [],           // array of strings
};
```

### 3.2 Add a features list editor inside `PlanModal`

Add a section below the payment link field:

```jsx
{/* Features list */}
<div className="flex flex-col gap-2">
    <label className="text-xs font-medium text-foreground">
        Features <span className="text-muted-foreground">(one per line, displayed on pricing card)</span>
    </label>
    <textarea
        rows={6}
        placeholder={"∞ Unlimited clients\nWorkout plan delivery\n..."}
        value={Array.isArray(form.features) ? form.features.join('\n') : ''}
        onChange={e => set('features', e.target.value.split('\n'))}
        className="w-full px-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground hover:border-primary/40 transition-colors resize-y"
    />
</div>
```

When saving, trim empty lines:
```js
features: form.features.filter(f => f.trim() !== ''),
```

### 3.3 Add the remaining new fields to `PlanModal`

Add these fields in a logical grouping (e.g. "Landing page display" section):

```jsx
{/* Landing page section */}
<p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground pt-2">
    Landing Page Display
</p>

{/* Subtitle */}
<input type="text" placeholder="For solo coaches" value={form.subtitle} ... />

{/* Features header */}
<input type="text" placeholder="What's included:" value={form.features_header} ... />

{/* Features sub-header (optional) */}
<input type="text" placeholder="Team Features (optional)" value={form.features_subheader} ... />

{/* CTA text */}
<input type="text" placeholder="Get Started – It's FREE!" value={form.cta_text} ... />

{/* CTA variant */}
<select value={form.cta_variant} onChange={e => set('cta_variant', e.target.value)} ...>
    <option value="outline">Outline</option>
    <option value="primary">Primary (filled)</option>
    <option value="ghost">Ghost</option>
</select>

{/* Currency */}
<input type="text" placeholder="LE" value={form.currency} ... />

{/* Sort order */}
<input type="number" min="0" placeholder="0" value={form.sort_order} ... />

{/* Checkboxes */}
<label>
    <input type="checkbox" checked={form.is_popular} onChange={e => set('is_popular', e.target.checked)} />
    Show "Most Popular" badge
</label>
<label>
    <input type="checkbox" checked={form.has_team_counter} onChange={e => set('has_team_counter', e.target.checked)} />
    Show team member counter widget
</label>
<label>
    <input type="checkbox" checked={form.show_on_landing} onChange={e => set('show_on_landing', e.target.checked)} />
    Show on landing page
</label>
```

### 3.4 Pass new fields in `handleSave` payload

```js
const payload = {
    // existing
    display_name: form.display_name.trim() || undefined,
    max_team_seats: parseOptInt(form.max_team_seats),
    max_workspaces: parseOptInt(form.max_workspaces),
    price_monthly: parseOptFloat(form.price_monthly),
    trial_days: parseOptInt(form.trial_days),
    payment_link: form.payment_link.trim() || null,
    is_active: form.is_active,
    is_default: form.is_default,
    features: form.features.filter(f => f.trim() !== ''),
    // new
    subtitle: form.subtitle.trim() || null,
    is_popular: form.is_popular,
    cta_text: form.cta_text.trim() || 'Get Started',
    cta_variant: form.cta_variant,
    features_header: form.features_header.trim() || "What's included:",
    features_subheader: form.features_subheader.trim() || null,
    has_team_counter: form.has_team_counter,
    sort_order: parseOptInt(form.sort_order) ?? 0,
    currency: form.currency.trim() || 'LE',
    show_on_landing: form.show_on_landing,
};
```

### 3.5 Populate edit form with new fields

In the edit branch of `PlanModal`:
```js
isEdit
    ? {
        // existing fields...
        subtitle: plan.subtitle ?? '',
        is_popular: plan.is_popular ?? false,
        cta_text: plan.cta_text ?? "Get Started – It's FREE!",
        cta_variant: plan.cta_variant ?? 'outline',
        features_header: plan.features_header ?? "What's included:",
        features_subheader: plan.features_subheader ?? '',
        has_team_counter: plan.has_team_counter ?? false,
        sort_order: plan.sort_order ?? 0,
        currency: plan.currency ?? 'LE',
        show_on_landing: plan.show_on_landing ?? true,
        features: Array.isArray(plan.features) ? plan.features : [],
      }
```

---

## Step 4 — Update `LandingPricing.js`

Replace the static `const plans = [...]` with a `useEffect` fetch from `GET /api/plans`, and add skeleton loading + error states.

### 4.1 New component structure

```jsx
'use client';

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card } from "@heroui/react/card";
import { Chip } from "@heroui/react/chip";
import { Separator } from "@heroui/react/separator";
import { Skeleton } from "@heroui/react/skeleton";
import { CheckCircle2 } from "lucide-react";

// TeamMemberCounter stays exactly as-is

export default function LandingPricing() {
    const [plans, setPlans] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [teamMembers, setTeamMembers] = useState(3);

    useEffect(() => {
        fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/plans`)
            .then(res => {
                if (!res.ok) throw new Error();
                return res.json();
            })
            .then(data => setPlans(data))
            .catch(() => setError(true))
            .finally(() => setLoading(false));
    }, []);

    return (
        <section id="pricing" className="py-16 md:py-24 px-6">
            <div className="mx-auto max-w-7xl flex flex-col gap-14">

                {/* Heading stays unchanged */}
                <div className="text-center flex flex-col gap-4">
                    <Chip color="accent" size="sm" className="mx-auto">Pricing</Chip>
                    <h2 className="text-4xl sm:text-5xl font-bold text-white">Choose Your Plan</h2>
                    <p className="text-white/50 max-w-lg mx-auto leading-relaxed">
                        Start free, scale as you grow. No hidden fees, cancel anytime.
                    </p>
                </div>

                {/* Loading state */}
                {loading && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {[1, 2, 3].map(i => (
                            <Skeleton key={i} className="h-[480px] rounded-2xl" />
                        ))}
                    </div>
                )}

                {/* Error state */}
                {!loading && error && (
                    <p className="text-center text-white/40 text-sm">
                        Could not load pricing. Please refresh.
                    </p>
                )}

                {/* Cards grid */}
                {!loading && !error && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
                        {plans.map((plan) => {
                            // Derive ctaHref: use payment_link if present, else /register
                            const ctaHref = plan.payment_link || '/register';
                            // Format price: price_monthly is a decimal string from DB ("2000.00")
                            const priceDisplay = plan.price_monthly
                                ? Number(plan.price_monthly).toLocaleString('en-EG')
                                : null;
                            const features = Array.isArray(plan.features) ? plan.features : [];

                            return (
                                <div
                                    key={plan.id}
                                    className={plan.is_popular ? "md:-mt-4 md:mb-4" : ""}
                                >
                                    <Card
                                        className="flex flex-col h-full"
                                        style={
                                            plan.is_popular
                                                ? {
                                                      border: "1px solid oklch(0.72 0.18 249 / 0.5)",
                                                      boxShadow: "0 0 0 1px oklch(0.72 0.18 249 / 0.15), 0 24px 60px rgba(0,0,0,0.4), 0 0 50px oklch(0.72 0.18 249 / 0.12)",
                                                  }
                                                : undefined
                                        }
                                    >
                                        <Card.Header className="flex flex-col gap-3 pb-0">
                                            {plan.is_popular && (
                                                <Chip color="accent" size="sm" className="self-start">Most Popular</Chip>
                                            )}
                                            <div className="flex flex-col gap-1">
                                                <h3 className="text-xl font-bold text-foreground">{plan.display_name}</h3>
                                                {plan.subtitle && (
                                                    <p className="text-sm text-foreground/50 leading-snug">{plan.subtitle}</p>
                                                )}
                                            </div>
                                            <div className="flex items-end gap-1.5 pt-1">
                                                {priceDisplay ? (
                                                    <>
                                                        <span className="text-4xl font-extrabold text-foreground leading-none">
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
                                        </Card.Header>

                                        <Card.Content className="flex flex-col gap-4 flex-1">
                                            <Separator />

                                            {plan.has_team_counter && (
                                                <TeamMemberCounter value={teamMembers} onChange={setTeamMembers} />
                                            )}

                                            <p className="text-xs font-semibold uppercase tracking-widest text-foreground/40">
                                                {plan.features_header}
                                            </p>

                                            {plan.features_subheader && (
                                                <p className="text-xs font-bold text-primary -mt-2">
                                                    {plan.features_subheader}
                                                </p>
                                            )}

                                            <ul className="flex flex-col gap-3">
                                                {features.map((f) => (
                                                    <li key={f} className="flex items-start gap-2.5">
                                                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                                                        <span className="text-sm text-foreground/65 leading-snug">{f}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        </Card.Content>

                                        <Card.Footer className="flex flex-col gap-2">
                                            <Link
                                                href={ctaHref}
                                                className={`button button--${plan.cta_variant} button--md button--full-width`}
                                            >
                                                {plan.cta_text}
                                            </Link>
                                            {priceDisplay && (
                                                <p className="text-center text-xs text-foreground/40">
                                                    ✓ No credit card needed, cancel any time
                                                </p>
                                            )}
                                        </Card.Footer>
                                    </Card>
                                </div>
                            );
                        })}
                    </div>
                )}

            </div>
        </section>
    );
}
```

**Key mapping from DB → component:**

| DB column | Component usage |
|---|---|
| `display_name` | Card title (`h3`) |
| `subtitle` | Subtitle paragraph |
| `price_monthly` | Formatted as `toLocaleString('en-EG')` |
| `currency` | Currency label (e.g. "LE") |
| `is_popular` | "Most Popular" chip + highlighted border/shadow |
| `cta_text` | Button label |
| `cta_variant` | CSS class suffix: `button--outline`, `button--primary`, `button--ghost` |
| `payment_link` | CTA `href` (falls back to `/register` if null) |
| `features_header` | Section label above feature list |
| `features_subheader` | Colored sub-label above feature list (nullable) |
| `has_team_counter` | Renders `<TeamMemberCounter>` widget |
| `features` (JSONB array) | `<ul>` of feature strings |

---

## Step 5 — Verify End-to-End

1. Run the migration: `cd server && npm run migrate`
2. Execute the seed SQL against the DB (psql or admin tool).
3. Start the server: `cd server && npm start`
4. Verify public endpoint: `curl http://localhost:4000/api/plans` — expect 3 plan objects with all fields.
5. Start the client: `cd client && npm run dev`
6. Visit `http://localhost:3000/#pricing` — cards should render identically to the current hard-coded layout.
7. Log in to admin, go to `/admin/plans`, edit a plan (e.g. change "OneForce" subtitle to "Best for solo coaches"), save.
8. Hard-reload the landing page — the updated subtitle should appear.
9. In admin, uncheck "Show on landing page" for a plan and save. Reload landing — that card should disappear.

---

## Summary of Files Changed

| File | Change |
|---|---|
| `server/migrations/YYYYMMDD_plans_landing_fields.js` | **New** — adds 10 columns to `plans` |
| `server/routes/plans.js` | **New** — public `GET /api/plans` endpoint |
| `server/server.js` | **Edit** — mount `require('./routes/plans')` at `/api/plans` |
| `server/routes/admin.js` | **Edit** — `POST /plans` and `PUT /plans/:id` handle new fields; `features` default `'[]'` |
| `client/app/(admin)/admin/plans/page.js` | **Edit** — add all new fields to `EMPTY_FORM`, `PlanModal`, and save payload |
| `client/app/components/LandingPricing.js` | **Edit** — replace static array with `fetch('/api/plans')`, add loading/error states |
