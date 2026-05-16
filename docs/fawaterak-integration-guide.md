# Fawaterak Payment Gateway — Coach Subscription Billing Guide

> **Goal:** Coaches pay for their FitForce X workspace subscriptions online via Fawaterak.  
> **Admin** sees all incoming payments in the admin panel.  
> **Coach** sees their plan, remaining days, payment history, and can renew or upgrade.

---

## Table of Contents

1. [How the System Currently Works](#1-how-the-system-currently-works)
2. [What We Are Adding](#2-what-we-are-adding)
3. [Fawaterak Account Setup](#3-fawaterak-account-setup)
4. [End-to-End Payment Flow](#4-end-to-end-payment-flow)
5. [Database Changes](#5-database-changes)
6. [Environment Variables](#6-environment-variables)
7. [Backend — Fawaterak API Wrapper](#7-backend--fawaterak-api-wrapper)
8. [Backend — Billing Routes (Coach)](#8-backend--billing-routes-coach)
9. [Backend — Webhook Handler](#9-backend--webhook-handler)
10. [Backend — Admin Payments Route](#10-backend--admin-payments-route)
11. [Coach UI — Billing Tab in Settings](#11-coach-ui--billing-tab-in-settings)
12. [Coach UI — Payment Success & Failure Pages](#12-coach-ui--payment-success--failure-pages)
13. [Admin UI — Payments Page](#13-admin-ui--payments-page)
14. [Wiring Everything Up](#14-wiring-everything-up)
15. [Testing in Sandbox](#15-testing-in-sandbox)
16. [Going Live Checklist](#16-going-live-checklist)
17. [Error Handling Reference](#17-error-handling-reference)
18. [Security Checklist](#18-security-checklist)

---

## 1. How the System Currently Works

Before building anything, understand the existing data model:

| Table | Purpose |
|---|---|
| `plans` | Subscription tiers (free, pro, etc.) — created by admin. Has `price_monthly`, `trial_days`, `max_team_seats`. |
| `workspaces` | Each coach's workspace. Owned by a user (`owner_id`). |
| `workspace_subscriptions` | One row per workspace. Has `plan_id`, `status`, `starts_at`, `expires_at`. |
| `users` | All registered coaches and team members. |

**Current subscription management:**  
The admin manually changes a workspace's plan via the Admin → Workspaces → "Override Subscription Plan" drawer. There is no self-serve payment. We are adding that.

---

## 2. What We Are Adding

| What | Where |
|---|---|
| `workspace_payments` table | New DB table — records every payment a coach initiates |
| `server/lib/fawaterak.js` | New file — Fawaterak API wrapper |
| `server/routes/billing.js` | New file — coach-facing billing routes |
| `server/routes/payments-webhook.js` | New file — Fawaterak webhook handler (separate file, raw body) |
| `server/routes/admin.js` | Modified — add payments endpoints |
| Coach Settings page | Modified — add a "Billing" tab showing plan info + renewal |
| `client/app/(coach)/[workspaceSlug]/billing/success/page.js` | New page — post-payment confirmation |
| `client/app/(coach)/[workspaceSlug]/billing/failure/page.js` | New page — post-payment failure |
| `client/app/(admin)/admin/payments/page.js` | New page — admin view of all coach payments |

---

## 3. Fawaterak Account Setup

### Step 1 — Register

1. Go to [https://fawaterak.com](https://fawaterak.com) → click **"ابدأ الآن"**.
2. Fill in your business details (name, phone, email, commercial registration if applicable).
3. Wait 1–3 business days for approval email.

### Step 2 — Get Your API Credentials

1. Log in to [https://app.fawaterak.com](https://app.fawaterak.com).
2. Go to **Settings → API Keys**.
3. Copy:
   - `API_KEY` — sent in every request header
   - `SECRET_KEY` — used only to verify webhook signatures (never send to the frontend)
4. Note your **Vendor ID** — shown in Settings or the dashboard header.

### Step 3 — Configure Redirect URLs

In the Fawaterak dashboard → **Settings → Redirect URLs**:

- **Success URL:** `https://your-domain.com/[workspaceSlug]/billing/success`
- **Failure URL:** `https://your-domain.com/[workspaceSlug]/billing/failure`

> We will pass the actual `workspaceSlug` dynamically in the invoice creation call, so these URLs in the dashboard are just defaults/fallbacks.

### Step 4 — Set Webhook URL

In **Settings → Webhooks**:

```
https://your-domain.com/api/payments/webhook
```

This is the URL Fawaterak calls after every payment status change.

---

## 4. End-to-End Payment Flow

```
Coach opens Billing tab in workspace settings
          │
          │  Sees: current plan, expiry date, days remaining, price
          │
          ▼
Coach clicks "Renew" or "Upgrade to Pro"
          │
          ▼
POST /api/billing/create-invoice
  Server looks up: workspace, current subscription, selected plan, plan price
  Server creates a row in workspace_payments (status = 'pending')
  Server calls Fawaterak API → gets { invoiceId, paymentUrl }
  Server saves invoiceId to that workspace_payments row
  Server returns { paymentUrl } to frontend
          │
          ▼
Frontend redirects coach to paymentUrl
  (Fawaterak-hosted page — coach chooses card / wallet / Fawry, completes payment)
          │
          ├─── Fawaterak redirects coach back to:
          │    /[workspaceSlug]/billing/success?payment=<paymentId>   (if paid)
          │    /[workspaceSlug]/billing/failure?payment=<paymentId>   (if failed)
          │
          ▼
Fawaterak POSTs to POST /api/payments/webhook
  Server verifies HMAC signature
  Server finds workspace_payments row by invoiceId
  If paid:
    - Updates workspace_payments.status = 'paid'
    - Extends workspace_subscriptions.expires_at by plan duration
    - Sets workspace_subscriptions.status = 'active'
  If failed:
    - Updates workspace_payments.status = 'failed'
          │
          ▼
Success page polls GET /api/billing/payment-status/:paymentId
  until fawaterak_status = 'paid', then shows confirmation
```

**Critical rule:** Only mark a subscription as active after the webhook arrives. Never trust the redirect URL alone — a user could manually type `/billing/success` in the browser.

---

## 5. Database Changes

Run this migration on your PostgreSQL database.

```sql
-- workspace_payments: one row per payment attempt a coach makes
CREATE TABLE workspace_payments (
    id                    SERIAL PRIMARY KEY,
    workspace_id          INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    plan_id               INTEGER NOT NULL REFERENCES plans(id),
    amount                NUMERIC(10, 2) NOT NULL,
    currency              TEXT NOT NULL DEFAULT 'EGP',
    duration_days         INTEGER NOT NULL,              -- how many days this payment buys
    fawaterak_invoice_id  TEXT,
    fawaterak_payment_url TEXT,
    fawaterak_status      TEXT NOT NULL DEFAULT 'pending',
    -- 'pending' | 'paid' | 'failed' | 'refunded'
    fawaterak_raw_webhook JSONB,                         -- full webhook payload for audit
    notes                 TEXT,
    created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    paid_at               TIMESTAMPTZ
);

-- Fast webhook lookup by invoiceId
CREATE INDEX idx_workspace_payments_invoice_id
    ON workspace_payments (fawaterak_invoice_id);

-- Fast per-workspace payment history
CREATE INDEX idx_workspace_payments_workspace_id
    ON workspace_payments (workspace_id);

-- Add duration_days to plans so each plan knows how many days it grants
-- (e.g. monthly plan = 30, quarterly = 90, annual = 365)
ALTER TABLE plans
    ADD COLUMN IF NOT EXISTS duration_days INTEGER NOT NULL DEFAULT 30;

-- Update your existing plans with the correct duration:
-- UPDATE plans SET duration_days = 30  WHERE name = 'monthly';
-- UPDATE plans SET duration_days = 90  WHERE name = 'quarterly';
-- UPDATE plans SET duration_days = 365 WHERE name = 'annual';
```

Apply it:
```bash
psql -U your_db_user -d your_db_name -f add_workspace_payments.sql
```

---

## 6. Environment Variables

Add to `server/.env`:

```env
# Fawaterak
FAWATERAK_API_KEY=your_api_key_here
FAWATERAK_SECRET_KEY=your_secret_key_here
FAWATERAK_BASE_URL=https://staging.fawaterak.com/api/v2
# Switch to https://app.fawaterak.com/api/v2 in production

# Your frontend origin — used to build the success/failure redirect URLs
CLIENT_URL=http://localhost:3000
```

---

## 7. Backend — Fawaterak API Wrapper

Create `server/lib/fawaterak.js`:

```js
const axios = require('axios');

const BASE_URL = process.env.FAWATERAK_BASE_URL;
const API_KEY  = process.env.FAWATERAK_API_KEY;

/**
 * Creates an invoice on Fawaterak.
 * Returns { invoiceId: string, paymentUrl: string }
 */
async function createInvoice({ coachName, coachEmail, coachPhone, amount, description, referenceId, successUrl, failureUrl }) {
    const payload = {
        payment_method_id: 1,   // 1 = all payment methods (card, wallet, Fawry, etc.)
        cartTotal: amount,
        currency: 'EGP',
        customer: {
            first_name: coachName.split(' ')[0] || coachName,
            last_name:  coachName.split(' ').slice(1).join(' ') || '-',
            email:      coachEmail,
            phone:      coachPhone || '01000000000',
        },
        redirectionUrls: {
            successUrl,
            failUrl: failureUrl,
        },
        cartItems: [
            { name: description, price: amount, quantity: 1 },
        ],
        metaData: {
            reference_id: String(referenceId),
        },
    };

    const response = await axios.post(`${BASE_URL}/invoices`, payload, {
        headers: {
            Authorization: `Bearer ${API_KEY}`,
            'Content-Type': 'application/json',
        },
        timeout: 15000,
    });

    if (response.data?.status !== 'success') {
        throw new Error(`Fawaterak error: ${JSON.stringify(response.data)}`);
    }

    return {
        invoiceId:  String(response.data.data.invoiceId),
        paymentUrl: response.data.data.url,
    };
}

/**
 * Fetches the current status of an invoice directly from Fawaterak.
 * Used as a fallback if the webhook is delayed.
 */
async function getInvoiceStatus(invoiceId) {
    const response = await axios.get(`${BASE_URL}/invoices/${invoiceId}`, {
        headers: { Authorization: `Bearer ${API_KEY}` },
        timeout: 10000,
    });
    return response.data?.data ?? null;
}

module.exports = { createInvoice, getInvoiceStatus };
```

---

## 8. Backend — Billing Routes (Coach)

Create `server/routes/billing.js`:

```js
const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const authMiddleware = require('../middleware/auth');
const { createInvoice, getInvoiceStatus } = require('../lib/fawaterak');

router.use(authMiddleware);

const CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';

// ─── GET /api/billing/subscription ───────────────────────────────────────────
// Returns the coach's current subscription info:
// plan name, status, expiry date, days remaining, and recent payment history.
router.get('/subscription', async (req, res, next) => {
    try {
        const { rows } = await pool.query(`
            SELECT
                ws.id,
                ws.status,
                ws.starts_at,
                ws.expires_at,
                ws.notes,
                p.id           AS plan_id,
                p.name         AS plan_name,
                p.display_name AS plan_display,
                p.price_monthly,
                p.duration_days,
                p.max_team_seats,
                p.max_workspaces,
                p.trial_days
            FROM workspace_subscriptions ws
            JOIN plans p ON p.id = ws.plan_id
            WHERE ws.workspace_id = $1
        `, [req.user.workspaceId]);

        if (!rows.length) return res.status(404).json({ error: 'Subscription not found' });

        const sub = rows[0];
        const now = new Date();
        const expiresAt = sub.expires_at ? new Date(sub.expires_at) : null;
        const daysRemaining = expiresAt
            ? Math.max(0, Math.ceil((expiresAt - now) / 86400000))
            : null;

        // Last 10 payments for this workspace
        const { rows: payments } = await pool.query(`
            SELECT
                wp.id,
                wp.amount,
                wp.currency,
                wp.duration_days,
                wp.fawaterak_status,
                wp.created_at,
                wp.paid_at,
                p.display_name AS plan_display
            FROM workspace_payments wp
            JOIN plans p ON p.id = wp.plan_id
            WHERE wp.workspace_id = $1
            ORDER BY wp.created_at DESC
            LIMIT 10
        `, [req.user.workspaceId]);

        res.json({
            subscription: {
                status:       sub.status,
                planId:       sub.plan_id,
                planName:     sub.plan_name,
                planDisplay:  sub.plan_display,
                priceMonthly: sub.price_monthly,
                durationDays: sub.duration_days,
                maxTeamSeats: sub.max_team_seats,
                maxWorkspaces: sub.max_workspaces,
                trialDays:    sub.trial_days,
                startsAt:     sub.starts_at,
                expiresAt:    sub.expires_at,
                daysRemaining,
            },
            payments,
        });
    } catch (err) {
        next(err);
    }
});

// ─── GET /api/billing/plans ───────────────────────────────────────────────────
// Returns all active plans the coach can choose from.
router.get('/plans', async (req, res, next) => {
    try {
        const { rows } = await pool.query(
            `SELECT id, name, display_name, price_monthly, duration_days, max_team_seats, max_workspaces, features
             FROM plans WHERE is_active = TRUE ORDER BY price_monthly ASC NULLS FIRST`
        );
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

// ─── POST /api/billing/create-invoice ────────────────────────────────────────
// Coach selects a plan and clicks "Pay". This creates the Fawaterak invoice
// and returns the payment URL to redirect to.
//
// Body: { planId }
router.post('/create-invoice', async (req, res, next) => {
    const { planId } = req.body;
    if (!planId) return res.status(400).json({ error: 'planId is required' });

    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');

        // 1. Fetch the selected plan
        const { rows: planRows } = await dbClient.query(
            'SELECT * FROM plans WHERE id = $1 AND is_active = TRUE',
            [planId]
        );
        if (!planRows.length) return res.status(404).json({ error: 'Plan not found' });
        const plan = planRows[0];

        if (!plan.price_monthly || Number(plan.price_monthly) <= 0) {
            return res.status(400).json({ error: 'This plan does not have a payment amount configured. Contact support.' });
        }

        // 2. Fetch workspace + owner details (need email for Fawaterak)
        const { rows: wsRows } = await dbClient.query(`
            SELECT w.id, w.name, w.slug, u.fname, u.lname, u.email, u.phone
            FROM workspaces w
            JOIN users u ON u.id = w.owner_id
            WHERE w.id = $1
        `, [req.user.workspaceId]);
        if (!wsRows.length) return res.status(404).json({ error: 'Workspace not found' });
        const ws = wsRows[0];

        // 3. Create a pending workspace_payments row
        const { rows: paymentRows } = await dbClient.query(`
            INSERT INTO workspace_payments (workspace_id, plan_id, amount, currency, duration_days, fawaterak_status)
            VALUES ($1, $2, $3, 'EGP', $4, 'pending')
            RETURNING id
        `, [req.user.workspaceId, plan.id, Number(plan.price_monthly), plan.duration_days]);
        const paymentId = paymentRows[0].id;

        // 4. Create the Fawaterak invoice
        const coachName = `${ws.fname} ${ws.lname}`.trim();
        const { invoiceId, paymentUrl } = await createInvoice({
            coachName,
            coachEmail:  ws.email,
            coachPhone:  ws.phone || '01000000000',
            amount:      Number(plan.price_monthly),
            description: `FitForce X — ${plan.display_name} (${plan.duration_days} days)`,
            referenceId: paymentId,
            successUrl:  `${CLIENT_URL}/${ws.slug}/billing/success?payment=${paymentId}`,
            failureUrl:  `${CLIENT_URL}/${ws.slug}/billing/failure?payment=${paymentId}`,
        });

        // 5. Save the invoice ID and URL back to the payment row
        await dbClient.query(
            `UPDATE workspace_payments
             SET fawaterak_invoice_id = $1, fawaterak_payment_url = $2
             WHERE id = $3`,
            [invoiceId, paymentUrl, paymentId]
        );

        await dbClient.query('COMMIT');
        res.json({ paymentUrl, paymentId });
    } catch (err) {
        await dbClient.query('ROLLBACK');
        console.error('[Billing] create-invoice error:', err.message);
        next(err);
    } finally {
        dbClient.release();
    }
});

// ─── GET /api/billing/payment-status/:paymentId ───────────────────────────────
// Frontend polls this after the coach returns from Fawaterak.
// Falls back to a direct Fawaterak status check if the webhook hasn't arrived yet.
router.get('/payment-status/:paymentId', async (req, res, next) => {
    try {
        const { rows } = await pool.query(
            `SELECT wp.id, wp.fawaterak_status, wp.fawaterak_invoice_id, wp.amount, wp.currency, p.display_name AS plan_display
             FROM workspace_payments wp
             JOIN plans p ON p.id = wp.plan_id
             WHERE wp.id = $1 AND wp.workspace_id = $2`,
            [req.params.paymentId, req.user.workspaceId]
        );
        if (!rows.length) return res.status(404).json({ error: 'Payment not found' });
        const payment = rows[0];

        // If still pending and we have an invoiceId, check Fawaterak directly
        if (payment.fawaterak_status === 'pending' && payment.fawaterak_invoice_id) {
            try {
                const fawData = await getInvoiceStatus(payment.fawaterak_invoice_id);
                if (fawData?.status === 'paid') {
                    // Webhook may be delayed — apply the payment manually
                    await applyPayment(payment.id, req.user.workspaceId);
                    payment.fawaterak_status = 'paid';
                }
            } catch (_) {
                // Fawaterak unreachable — rely on webhook arriving shortly
            }
        }

        res.json({
            paymentId:    payment.id,
            status:       payment.fawaterak_status,   // 'pending' | 'paid' | 'failed'
            planDisplay:  payment.plan_display,
            amount:       payment.amount,
            currency:     payment.currency,
        });
    } catch (err) {
        next(err);
    }
});

/**
 * Applies a confirmed payment:
 * - Updates workspace_payments.fawaterak_status = 'paid'
 * - Extends workspace_subscriptions.expires_at by plan.duration_days
 * - Sets workspace_subscriptions.status = 'active'
 *
 * Safe to call multiple times (idempotent via the `paid_at IS NULL` guard).
 */
async function applyPayment(paymentId, workspaceId) {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');

        // Lock the payment row and check it hasn't been applied already
        const { rows } = await dbClient.query(
            `SELECT wp.id, wp.plan_id, wp.duration_days, wp.paid_at
             FROM workspace_payments wp
             WHERE wp.id = $1 AND wp.workspace_id = $2
             FOR UPDATE`,
            [paymentId, workspaceId]
        );
        if (!rows.length || rows[0].paid_at !== null) {
            // Already applied or not found — skip silently
            await dbClient.query('COMMIT');
            return;
        }
        const payment = rows[0];

        // Mark payment as paid
        await dbClient.query(
            `UPDATE workspace_payments
             SET fawaterak_status = 'paid', paid_at = NOW()
             WHERE id = $1`,
            [paymentId]
        );

        // Extend the subscription:
        // If it has an existing expiry in the future → add days from that date
        // If expired or no expiry → start from today
        await dbClient.query(`
            UPDATE workspace_subscriptions
            SET
                plan_id    = $1,
                status     = 'active',
                starts_at  = COALESCE(starts_at, NOW()),
                expires_at = GREATEST(NOW(), COALESCE(expires_at, NOW())) + ($2 || ' days')::INTERVAL
            WHERE workspace_id = $3
        `, [payment.plan_id, payment.duration_days, workspaceId]);

        await dbClient.query('COMMIT');
    } catch (err) {
        await dbClient.query('ROLLBACK');
        throw err;
    } finally {
        dbClient.release();
    }
}

module.exports = { router, applyPayment };
```

---

## 9. Backend — Webhook Handler

Create a **separate file** `server/routes/payments-webhook.js`. It must be registered **before** the global `express.json()` middleware in your main `index.js` so that the raw body is preserved for HMAC verification.

```js
const express = require('express');
const crypto  = require('crypto');
const router  = express.Router();
const pool    = require('../db');
const { applyPayment } = require('./billing');

const SECRET_KEY = process.env.FAWATERAK_SECRET_KEY;

// ─── POST /api/payments/webhook ───────────────────────────────────────────────
// Fawaterak POSTs here when payment status changes.
// Uses express.raw() to preserve the body for HMAC signature verification.
// NO authMiddleware — Fawaterak is the caller, not a logged-in user.
router.post(
    '/',
    express.raw({ type: '*/*' }),
    async (req, res) => {
        try {
            // 1. Verify the HMAC signature
            const signature = req.headers['x-fawaterak-signature']
                           || req.headers['x-signature']
                           || '';

            if (!signature) {
                console.warn('[Webhook] Missing signature header');
                return res.status(400).send('Missing signature');
            }

            const rawBody = req.body.toString('utf8');
            const expected = crypto
                .createHmac('sha256', SECRET_KEY)
                .update(rawBody)
                .digest('hex');

            const sigBuffer = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');
            const expBuffer = Buffer.from(expected, 'hex');

            if (sigBuffer.length !== expBuffer.length ||
                !crypto.timingSafeEqual(sigBuffer, expBuffer)) {
                console.warn('[Webhook] Invalid signature — rejecting');
                return res.status(401).send('Invalid signature');
            }

            const payload = JSON.parse(rawBody);

            // 2. Extract key fields from the Fawaterak payload
            // Fawaterak sends: { invoiceId, status, metaData: { reference_id } }
            const invoiceId   = String(payload.invoiceId || payload.invoice_id || '');
            const fawStatus   = payload.status;  // 'paid' | 'failed' | 'expired' | 'refunded'

            if (!invoiceId) {
                console.warn('[Webhook] No invoiceId in payload');
                return res.status(200).send('OK');  // Return 200 to stop Fawaterak retrying
            }

            // 3. Find the workspace_payments row by invoice ID
            const { rows } = await pool.query(
                `SELECT wp.id, wp.workspace_id, wp.fawaterak_status
                 FROM workspace_payments wp
                 WHERE wp.fawaterak_invoice_id = $1`,
                [invoiceId]
            );

            if (!rows.length) {
                console.warn(`[Webhook] No payment found for invoiceId=${invoiceId}`);
                return res.status(200).send('OK');
            }

            const payment = rows[0];

            // 4. Save the raw webhook payload for audit regardless of status
            await pool.query(
                `UPDATE workspace_payments SET fawaterak_raw_webhook = $1 WHERE id = $2`,
                [payload, payment.id]
            );

            // 5. Act on the status
            if (fawStatus === 'paid') {
                await applyPayment(payment.id, payment.workspace_id);
                console.log(`[Webhook] Payment ${payment.id} confirmed → subscription extended`);
            } else if (fawStatus === 'failed' || fawStatus === 'expired') {
                await pool.query(
                    `UPDATE workspace_payments SET fawaterak_status = 'failed' WHERE id = $1`,
                    [payment.id]
                );
                console.log(`[Webhook] Payment ${payment.id} failed`);
            } else if (fawStatus === 'refunded') {
                await pool.query(
                    `UPDATE workspace_payments SET fawaterak_status = 'refunded' WHERE id = $1`,
                    [payment.id]
                );
                console.log(`[Webhook] Payment ${payment.id} refunded`);
            }

            // Always respond 200 to Fawaterak — any other code triggers a retry
            res.status(200).send('OK');
        } catch (err) {
            console.error('[Webhook] Unhandled error:', err.message);
            res.status(200).send('OK');  // Still 200 — we don't want infinite retries
        }
    }
);

module.exports = router;
```

### Register routes in the correct order in `server/index.js`

```js
// IMPORTANT: webhook BEFORE express.json() — needs raw body
app.use('/api/payments/webhook', require('./routes/payments-webhook'));

// Global JSON parsing for all other routes
app.use(express.json());

// Other routes
const { router: billingRouter } = require('./routes/billing');
app.use('/api/billing', billingRouter);
// ... rest of your routes
```

---

## 10. Backend — Admin Payments Route

Add these two endpoints to the bottom of `server/routes/admin.js` (before `module.exports`):

```js
// ── Payments ──────────────────────────────────────────────────────────────────

// GET /api/admin/payments  — paginated list of all workspace payments
router.get('/payments', adminAuthMiddleware, async (req, res, next) => {
    const { page = 1, limit = 25, status = '', search = '' } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
        const conditions = ['1=1'];
        const params     = [];

        if (status) {
            params.push(status);
            conditions.push(`wp.fawaterak_status = $${params.length}`);
        }
        if (search) {
            params.push(`%${search}%`);
            conditions.push(`(w.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
        }

        const where = conditions.join(' AND ');

        const { rows } = await pool.query(`
            SELECT
                wp.id,
                wp.amount,
                wp.currency,
                wp.duration_days,
                wp.fawaterak_status,
                wp.fawaterak_invoice_id,
                wp.created_at,
                wp.paid_at,
                w.id   AS workspace_id,
                w.name AS workspace_name,
                w.slug AS workspace_slug,
                p.display_name AS plan_display,
                u.fname AS owner_fname,
                u.lname AS owner_lname,
                u.email AS owner_email
            FROM workspace_payments wp
            JOIN workspaces w ON w.id = wp.workspace_id
            JOIN plans p ON p.id = wp.plan_id
            JOIN users u ON u.id = w.owner_id
            WHERE ${where}
            ORDER BY wp.created_at DESC
            LIMIT $${params.length + 1} OFFSET $${params.length + 2}
        `, [...params, parseInt(limit), offset]);

        const { rows: countRows } = await pool.query(
            `SELECT COUNT(*)
             FROM workspace_payments wp
             JOIN workspaces w ON w.id = wp.workspace_id
             JOIN users u ON u.id = w.owner_id
             WHERE ${where}`,
            params
        );

        res.json({
            payments:   rows,
            total:      parseInt(countRows[0].count),
            page:       parseInt(page),
            limit:      parseInt(limit),
            totalPages: Math.ceil(parseInt(countRows[0].count) / parseInt(limit)),
        });
    } catch (err) {
        next(err);
    }
});

// GET /api/admin/payments/stats  — summary numbers for the admin payments page
router.get('/payments/stats', adminAuthMiddleware, async (req, res, next) => {
    try {
        const { rows } = await pool.query(`
            SELECT
                COUNT(*) FILTER (WHERE fawaterak_status = 'paid')    AS total_paid,
                COUNT(*) FILTER (WHERE fawaterak_status = 'pending') AS total_pending,
                COUNT(*) FILTER (WHERE fawaterak_status = 'failed')  AS total_failed,
                COALESCE(SUM(amount) FILTER (WHERE fawaterak_status = 'paid'), 0) AS total_revenue
            FROM workspace_payments
        `);
        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
});
```

---

## 11. Coach UI — Billing Tab in Settings

The existing settings page (`[workspaceSlug]/settings/page.js`) already has a tab system. Add a **"Billing"** tab to it.

### Add to the tab list

In the settings page, find the tab buttons and add:
```jsx
<TabButton active={tab === 'billing'} onClick={() => setTab('billing')}>Billing</TabButton>
```

### Add the BillingTab component

Add this component to the settings page file (or import it from a new file):

```jsx
function BillingTab({ workspaceSlug }) {
    const [data, setData]     = useState(null);
    const [plans, setPlans]   = useState([]);
    const [loading, setLoading] = useState(true);
    const [paying, setPaying] = useState(false);
    const [error, setError]   = useState('');

    useEffect(() => {
        Promise.all([
            api.get('/api/billing/subscription'),
            api.get('/api/billing/plans'),
        ]).then(([subRes, plansRes]) => {
            setData(subRes.data);
            setPlans(plansRes.data);
        }).catch(() => setError('Failed to load billing info'))
          .finally(() => setLoading(false));
    }, []);

    async function handlePay(planId) {
        setPaying(true);
        setError('');
        try {
            const res = await api.post('/api/billing/create-invoice', { planId });
            window.location.href = res.data.paymentUrl;
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to start payment. Please try again.');
            setPaying(false);
        }
    }

    if (loading) return (
        <div className="flex flex-col gap-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
    );

    const { subscription, payments } = data ?? {};
    const isExpired  = subscription?.daysRemaining === 0;
    const isExpiring = subscription?.daysRemaining !== null && subscription.daysRemaining <= 7;

    return (
        <div className="flex flex-col gap-6">
            {/* Current Plan Card */}
            <div className="rounded-xl border border-border p-5 flex flex-col gap-4">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Current Plan</p>
                        <p className="text-2xl font-bold text-foreground mt-1">{subscription?.planDisplay ?? '—'}</p>
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        subscription?.status === 'active'
                            ? 'bg-green-500/15 text-green-600'
                            : 'bg-red-500/15 text-red-600'
                    }`}>
                        {subscription?.status ?? 'unknown'}
                    </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div className="rounded-lg bg-secondary/50 p-3">
                        <p className="text-xs text-muted-foreground">Days Remaining</p>
                        <p className={`text-xl font-bold mt-0.5 ${isExpired ? 'text-red-500' : isExpiring ? 'text-orange-500' : 'text-foreground'}`}>
                            {subscription?.daysRemaining ?? '∞'}
                        </p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-3">
                        <p className="text-xs text-muted-foreground">Expires</p>
                        <p className="text-sm font-medium text-foreground mt-0.5">
                            {subscription?.expiresAt
                                ? new Date(subscription.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                                : '—'}
                        </p>
                    </div>
                    <div className="rounded-lg bg-secondary/50 p-3">
                        <p className="text-xs text-muted-foreground">Team Seats</p>
                        <p className="text-sm font-medium text-foreground mt-0.5">
                            {subscription?.maxTeamSeats ?? '∞'}
                        </p>
                    </div>
                </div>

                {(isExpired || isExpiring) && (
                    <p className={`text-sm rounded-lg px-3 py-2 ${
                        isExpired
                            ? 'bg-red-500/10 text-red-600 border border-red-500/20'
                            : 'bg-orange-500/10 text-orange-600 border border-orange-500/20'
                    }`}>
                        {isExpired
                            ? 'Your subscription has expired. Renew to continue using FitForce X.'
                            : `Your subscription expires in ${subscription.daysRemaining} days. Renew now to avoid interruption.`}
                    </p>
                )}
            </div>

            {/* Plans */}
            <div>
                <p className="text-sm font-semibold text-foreground mb-3">
                    {isExpired ? 'Choose a plan to reactivate' : 'Renew or change your plan'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {plans.map(plan => (
                        <div key={plan.id} className={`rounded-xl border p-4 flex flex-col gap-3 ${
                            subscription?.planId === plan.id
                                ? 'border-primary bg-primary/5'
                                : 'border-border'
                        }`}>
                            <div>
                                <p className="font-semibold text-foreground">{plan.display_name}</p>
                                {plan.max_team_seats && (
                                    <p className="text-xs text-muted-foreground mt-0.5">Up to {plan.max_team_seats} team seats</p>
                                )}
                            </div>
                            <div>
                                <span className="text-2xl font-bold text-foreground">
                                    {plan.price_monthly ? `${Number(plan.price_monthly).toLocaleString()} EGP` : 'Free'}
                                </span>
                                {plan.price_monthly && (
                                    <span className="text-xs text-muted-foreground ml-1">/ {plan.duration_days} days</span>
                                )}
                            </div>
                            {plan.price_monthly ? (
                                <button
                                    onClick={() => handlePay(plan.id)}
                                    disabled={paying}
                                    className="w-full py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                                >
                                    {paying ? 'Redirecting…' : subscription?.planId === plan.id ? 'Renew' : 'Switch & Pay'}
                                </button>
                            ) : (
                                <span className="text-xs text-muted-foreground italic">No payment required</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            {/* Payment History */}
            {payments?.length > 0 && (
                <div>
                    <p className="text-sm font-semibold text-foreground mb-3">Payment History</p>
                    <div className="rounded-xl border border-border overflow-hidden">
                        {payments.map((p, idx) => (
                            <div key={p.id} className={`flex items-center justify-between px-4 py-3 ${idx > 0 ? 'border-t border-border' : ''}`}>
                                <div>
                                    <p className="text-sm font-medium text-foreground">{p.plan_display}</p>
                                    <p className="text-xs text-muted-foreground">
                                        {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        {' · '}{p.duration_days} days
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-semibold text-foreground">
                                        {Number(p.amount).toLocaleString()} {p.currency}
                                    </span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                                        p.fawaterak_status === 'paid'    ? 'bg-green-500/15 text-green-600' :
                                        p.fawaterak_status === 'pending' ? 'bg-yellow-500/15 text-yellow-600' :
                                        p.fawaterak_status === 'failed'  ? 'bg-red-500/15 text-red-600' :
                                        'bg-secondary text-muted-foreground'
                                    }`}>
                                        {p.fawaterak_status}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
```

Then render it in the tab switcher:
```jsx
{tab === 'billing' && <BillingTab workspaceSlug={params.workspaceSlug} />}
```

---

## 12. Coach UI — Payment Success & Failure Pages

### Success page

Create `client/app/(coach)/[workspaceSlug]/billing/success/page.js`:

```jsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useParams } from "next/navigation";
import Link from "next/link";
import api from "@/lib/axios";

export default function BillingSuccessPage() {
    const params    = useParams();
    const search    = useSearchParams();
    const paymentId = search.get("payment");
    const slug      = params.workspaceSlug;

    const [status, setStatus]   = useState("checking");  // 'checking' | 'confirmed' | 'pending'
    const [detail, setDetail]   = useState(null);

    useEffect(() => {
        if (!paymentId) { setStatus("pending"); return; }

        let attempts = 0;
        const maxAttempts = 10;   // poll for ~20 seconds

        const poll = async () => {
            try {
                const res = await api.get(`/api/billing/payment-status/${paymentId}`);
                setDetail(res.data);
                if (res.data.status === "paid") {
                    setStatus("confirmed");
                } else if (res.data.status === "failed") {
                    setStatus("failed");
                } else if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(poll, 2000);
                } else {
                    setStatus("pending");
                }
            } catch {
                setStatus("pending");
            }
        };
        poll();
    }, [paymentId]);

    return (
        <div className="min-h-screen flex items-center justify-center p-8">
            <div className="max-w-md w-full flex flex-col items-center gap-6 text-center">

                {status === "checking" && (
                    <>
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center animate-pulse">
                            <span className="text-3xl">⏳</span>
                        </div>
                        <h1 className="text-2xl font-bold text-foreground">Confirming payment…</h1>
                        <p className="text-muted-foreground text-sm">Please wait while we verify your payment with Fawaterak.</p>
                    </>
                )}

                {status === "confirmed" && (
                    <>
                        <div className="w-16 h-16 rounded-full bg-green-500/10 flex items-center justify-center">
                            <span className="text-3xl text-green-600">✓</span>
                        </div>
                        <h1 className="text-2xl font-bold text-foreground">Payment Confirmed!</h1>
                        <p className="text-muted-foreground text-sm">
                            Your <strong>{detail?.planDisplay}</strong> subscription has been activated.
                        </p>
                        <Link href={`/${slug}/dashboard`} className="py-2.5 px-6 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors">
                            Go to Dashboard
                        </Link>
                    </>
                )}

                {status === "pending" && (
                    <>
                        <div className="w-16 h-16 rounded-full bg-yellow-500/10 flex items-center justify-center">
                            <span className="text-3xl">⏳</span>
                        </div>
                        <h1 className="text-2xl font-bold text-foreground">Payment Processing</h1>
                        <p className="text-muted-foreground text-sm">
                            Your payment is being processed. Your subscription will activate automatically once confirmed — this can take a few minutes.
                        </p>
                        <Link href={`/${slug}/settings`} className="py-2.5 px-6 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors">
                            Back to Settings
                        </Link>
                    </>
                )}

                {status === "failed" && (
                    <>
                        <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                            <span className="text-3xl text-red-500">✕</span>
                        </div>
                        <h1 className="text-2xl font-bold text-foreground">Payment Failed</h1>
                        <p className="text-muted-foreground text-sm">Something went wrong. No charge was made. Please try again.</p>
                        <Link href={`/${slug}/settings`} className="py-2.5 px-6 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors">
                            Try Again
                        </Link>
                    </>
                )}
            </div>
        </div>
    );
}
```

### Failure page

Create `client/app/(coach)/[workspaceSlug]/billing/failure/page.js`:

```jsx
"use client";

import { useParams } from "next/navigation";
import Link from "next/link";

export default function BillingFailurePage() {
    const { workspaceSlug } = useParams();

    return (
        <div className="min-h-screen flex items-center justify-center p-8">
            <div className="max-w-md w-full flex flex-col items-center gap-6 text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center">
                    <span className="text-3xl text-red-500">✕</span>
                </div>
                <h1 className="text-2xl font-bold text-foreground">Payment Cancelled</h1>
                <p className="text-muted-foreground text-sm">
                    Your payment was not completed. No charge has been made. You can try again from the Billing tab in your settings.
                </p>
                <div className="flex gap-3">
                    <Link href={`/${workspaceSlug}/settings`} className="py-2.5 px-6 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors">
                        Back to Settings
                    </Link>
                    <Link href={`/${workspaceSlug}/dashboard`} className="py-2.5 px-6 rounded-lg border border-border text-foreground font-medium text-sm hover:bg-secondary transition-colors">
                        Dashboard
                    </Link>
                </div>
            </div>
        </div>
    );
}
```

---

## 13. Admin UI — Payments Page

### Add to the admin sidebar

In `client/app/(admin)/admin/layout.js`, add a "Payments" nav item to the `NAV` array:

```js
import { CreditCard } from 'lucide-react';

const NAV = [
    { href: '/admin',           label: 'Overview',   icon: LayoutDashboard, exact: true },
    { href: '/admin/users',     label: 'Users',      icon: Users },
    { href: '/admin/workspaces',label: 'Workspaces', icon: Building2 },
    { href: '/admin/plans',     label: 'Plans',      icon: Package },
    { href: '/admin/payments',  label: 'Payments',   icon: CreditCard },   // ← add this
];
```

### Create the payments page

Create `client/app/(admin)/admin/payments/page.js`:

```jsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/axios';
import { Skeleton } from '@heroui/react/skeleton';
import { Chip } from '@heroui/react/chip';
import { Button } from '@heroui/react/button';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

const STATUS_COLORS = {
    paid:     'bg-green-500/15 text-green-600',
    pending:  'bg-yellow-500/15 text-yellow-600',
    failed:   'bg-red-500/15 text-red-600',
    refunded: 'bg-orange-500/15 text-orange-600',
};

function StatCard({ label, value, accent }) {
    return (
        <div className={`rounded-xl border border-border p-4 flex flex-col gap-1 ${accent ? 'border-primary/30 bg-primary/5' : ''}`}>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value ?? '—'}</p>
        </div>
    );
}

export default function AdminPaymentsPage() {
    const [payments, setPayments] = useState([]);
    const [stats, setStats]       = useState(null);
    const [total, setTotal]       = useState(0);
    const [page, setPage]         = useState(1);
    const [statusFilter, setStatusFilter] = useState('');
    const [search, setSearch]     = useState('');
    const [loading, setLoading]   = useState(true);

    const limit      = 25;
    const totalPages = Math.ceil(total / limit);

    const fetchPayments = useCallback(() => {
        setLoading(true);
        api.get('/api/admin/payments', { params: { page, limit, status: statusFilter, search } })
            .then(res => { setPayments(res.data.payments); setTotal(res.data.total); })
            .finally(() => setLoading(false));
    }, [page, statusFilter, search]);

    useEffect(() => { fetchPayments(); }, [fetchPayments]);
    useEffect(() => {
        api.get('/api/admin/payments/stats').then(res => setStats(res.data));
    }, []);
    useEffect(() => { setPage(1); }, [statusFilter, search]);

    return (
        <div className="p-8 flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">Payments</h1>
                <p className="text-sm text-muted-foreground mt-1">All coach subscription payments via Fawaterak</p>
            </div>

            {/* Stats */}
            {stats && (
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard label="Total Revenue (EGP)" value={Number(stats.total_revenue).toLocaleString()} accent />
                    <StatCard label="Paid" value={stats.total_paid} />
                    <StatCard label="Pending" value={stats.total_pending} />
                    <StatCard label="Failed" value={stats.total_failed} />
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <div className="relative max-w-sm w-full">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                    <input
                        className="w-full pl-8 pr-3 py-2 text-sm text-foreground bg-card border border-border rounded-lg outline-none placeholder:text-muted-foreground"
                        placeholder="Search workspace or email…"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none"
                >
                    <option value="">All statuses</option>
                    <option value="paid">Paid</option>
                    <option value="pending">Pending</option>
                    <option value="failed">Failed</option>
                    <option value="refunded">Refunded</option>
                </select>
            </div>

            {/* Table */}
            <div className="rounded-xl border border-border overflow-hidden">
                <div className="grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-4 px-4 py-2.5 bg-secondary/50 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                    <span>Workspace</span>
                    <span>Owner</span>
                    <span>Plan</span>
                    <span className="text-right">Amount</span>
                    <span>Status</span>
                    <span>Date</span>
                </div>

                {loading ? (
                    Array.from({ length: 10 }).map((_, i) => (
                        <Skeleton key={i} className="h-12 border-t border-border rounded-none" />
                    ))
                ) : payments.length === 0 ? (
                    <div className="py-14 text-center text-sm text-muted-foreground border-t border-border">No payments found.</div>
                ) : (
                    payments.map((p, idx) => (
                        <div key={p.id} className={`grid grid-cols-[1fr_1fr_auto_auto_auto_auto] gap-4 items-center px-4 py-3 ${idx > 0 ? 'border-t border-border' : ''}`}>
                            <div className="min-w-0">
                                <p className="text-sm font-medium text-foreground truncate">{p.workspace_name}</p>
                                <p className="text-xs text-muted-foreground">/{p.workspace_slug}</p>
                            </div>
                            <div className="min-w-0">
                                <p className="text-sm text-foreground truncate">{p.owner_fname} {p.owner_lname}</p>
                                <p className="text-xs text-muted-foreground truncate">{p.owner_email}</p>
                            </div>
                            <span className="text-sm text-foreground whitespace-nowrap">{p.plan_display}</span>
                            <span className="text-sm font-semibold text-foreground text-right whitespace-nowrap">
                                {Number(p.amount).toLocaleString()} {p.currency}
                            </span>
                            <Chip size="sm" className={STATUS_COLORS[p.fawaterak_status] ?? 'bg-secondary text-muted-foreground'}>
                                {p.fawaterak_status}
                            </Chip>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                                {new Date(p.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                            </span>
                        </div>
                    ))
                )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">{total} payments · Page {page} of {totalPages}</p>
                    <div className="flex gap-2">
                        <Button isIconOnly variant="outline" size="sm" isDisabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                            <ChevronLeft size={15} />
                        </Button>
                        <Button isIconOnly variant="outline" size="sm" isDisabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                            <ChevronRight size={15} />
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
```

---

## 14. Wiring Everything Up

Summary of every file touch point in order:

### 1. Run the database migration
```bash
psql -U your_db_user -d your_db_name -f add_workspace_payments.sql
# Then update your existing plans with duration_days:
psql -U your_db_user -d your_db_name -c "UPDATE plans SET duration_days = 30 WHERE name = 'monthly';"
```

### 2. Add env vars to `server/.env`
```env
FAWATERAK_API_KEY=...
FAWATERAK_SECRET_KEY=...
FAWATERAK_BASE_URL=https://staging.fawaterak.com/api/v2
CLIENT_URL=http://localhost:3000
```

### 3. Create `server/lib/fawaterak.js` — section 7

### 4. Create `server/routes/billing.js` — section 8

### 5. Create `server/routes/payments-webhook.js` — section 9

### 6. Update `server/routes/admin.js` — add payments endpoints from section 10

### 7. Update `server/index.js` — register routes in the correct order
```js
// FIRST — webhook needs raw body before express.json() parses it
app.use('/api/payments/webhook', require('./routes/payments-webhook'));

// THEN — global JSON parser
app.use(express.json());

// THEN — all other routes
const { router: billingRouter } = require('./routes/billing');
app.use('/api/billing', billingRouter);
// ... existing routes
```

### 8. Add BillingTab to the coach settings page — section 11

### 9. Create success/failure pages — section 12

### 10. Add "Payments" to admin sidebar and create admin payments page — section 13

---

## 15. Testing in Sandbox

### Configure sandbox
```env
FAWATERAK_BASE_URL=https://staging.fawaterak.com/api/v2
```

### Test card numbers

| Result | Card Number | Expiry | CVV |
|---|---|---|---|
| Payment succeeds | 4111 1111 1111 1111 | Any future | Any 3 digits |
| Payment fails | 4000 0000 0000 0002 | Any future | Any 3 digits |

**Mobile wallet sandbox:** Phone number and OTP provided in Fawaterak sandbox docs. OTP is usually `123456`.

### Testing webhooks locally with ngrok

The Fawaterak sandbox can't reach `localhost`. Use ngrok to expose your server:

```bash
# Start your server
node server/index.js

# In another terminal
ngrok http 5000   # replace 5000 with your server port
# ngrok gives you: https://abc123.ngrok.io
```

Set the webhook URL in the Fawaterak dashboard to:
```
https://abc123.ngrok.io/api/payments/webhook
```

Watch incoming webhooks in the ngrok inspector at `http://localhost:4040`.

### Full test checklist

1. Make sure your plans have `price_monthly` and `duration_days` set
2. Log in as a coach → open Workspace Settings → Billing tab
3. Verify current plan info and days remaining show correctly
4. Click "Renew" on a paid plan → you should be redirected to Fawaterak
5. On the Fawaterak page, enter the test success card
6. Complete payment → you land on `/[slug]/billing/success?payment=X`
7. The success page polls and shows "Payment Confirmed!" within ~5 seconds
8. Check DB:
   ```sql
   SELECT * FROM workspace_payments ORDER BY created_at DESC LIMIT 1;
   -- fawaterak_status should be 'paid', paid_at should be set

   SELECT expires_at, status FROM workspace_subscriptions WHERE workspace_id = YOUR_ID;
   -- expires_at should be extended by plan.duration_days
   ```
9. Log in to Admin panel → Payments page → payment appears with status "paid"
10. Repeat with the failure card → lands on failure page, payment row shows "failed", subscription NOT extended

---

## 16. Going Live Checklist

### Fawaterak account
- [ ] Production account approved
- [ ] `FAWATERAK_BASE_URL` changed to `https://app.fawaterak.com/api/v2`
- [ ] Production API Key and Secret Key set in production environment (not in git)
- [ ] Webhook URL in dashboard: `https://your-production-domain.com/api/payments/webhook`
- [ ] Redirect URLs updated to production domain

### Server
- [ ] `FAWATERAK_SECRET_KEY` set in production — never hardcoded
- [ ] Webhook signature verification is active
- [ ] Webhook route registered **before** `express.json()` in `index.js`
- [ ] HTTPS enabled (required for Fawaterak webhooks)

### Database
- [ ] Migration ran on production database
- [ ] `duration_days` set correctly on all active plans
- [ ] `price_monthly` set correctly on all paid plans

### Frontend
- [ ] `CLIENT_URL` points to the production domain
- [ ] Success and failure pages exist and do not require auth to render (coach may be redirected before session is verified)

### End-to-end production test
- [ ] Paid 1 EGP with a real card on production
- [ ] Webhook fired and `workspace_subscriptions.expires_at` was extended
- [ ] Admin panel shows the payment
- [ ] Coach billing tab shows the updated expiry

---

## 17. Error Handling Reference

| Scenario | What happens | Resolution |
|---|---|---|
| Fawaterak API is unreachable during `create-invoice` | Route catches error, returns 503 | Show "Payment service temporarily unavailable, try again" |
| Coach returns to success URL but webhook not yet received | `fawaterak_status` is still `pending` | Success page polls for 20s then shows "Payment Processing" — webhook will arrive |
| Webhook arrives with invalid HMAC signature | Returns 401, logs warning | Check that `FAWATERAK_SECRET_KEY` matches exactly what is in the Fawaterak dashboard |
| Duplicate webhook (Fawaterak retries on timeout) | `applyPayment` checks `paid_at IS NULL` — skips silently | Idempotent, no double-extension of subscription |
| Coach closes browser mid-payment | No redirect received | `workspace_payments` row stays `pending` until webhook arrives, then subscription is extended |
| Payment failed, coach wants to retry | Coach clicks Renew again | A new `workspace_payments` row is created with a new invoice — previous `failed` row stays for audit |
| Admin overrides subscription manually | Existing admin flow via `/api/admin/workspaces/:id/subscription` | This still works and takes precedence |
| Plan has no `price_monthly` set | `create-invoice` returns 400 with clear error | Admin must set `price_monthly` and `duration_days` on the plan first |

---

## 18. Security Checklist

- **API Key and Secret Key must never reach the browser.** All Fawaterak calls are server-side only.
- **Always verify the HMAC signature** before trusting any webhook payload. An unverified webhook is fraud risk.
- **Use `crypto.timingSafeEqual`** for signature comparison — prevents timing attacks.
- **Parse webhook body as raw bytes** — any JSON parsing first breaks the HMAC.
- **`applyPayment` is idempotent** via the `paid_at IS NULL` guard — duplicate webhooks cannot extend a subscription twice.
- **Subscription extension happens only in the webhook handler and the polling fallback** — never based on the redirect URL alone.
- **The `workspace_payments` table is append-only** — never delete payment records. Mark refunds with `fawaterak_status = 'refunded'`.
- **Store `fawaterak_raw_webhook` JSONB** for every webhook received — needed for dispute resolution.
- **Rate-limit the `/api/billing/create-invoice` route** — prevents a coach from spamming invoice creation.
- **The webhook endpoint has no `authMiddleware`** — that is intentional. Protect it with HMAC only, not session auth.
