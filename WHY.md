# WHY.md — Decision Journal

Format:
```
## [date] — [what we decided]
**The question we faced:**
**Why we chose this:**
**What we rejected and why:**
**What I learned:**
```

---

## Early — httpOnly cookie for JWT storage
**The question we faced:** Where to store the auth token — localStorage, sessionStorage, or a cookie?
**Why we chose this:** httpOnly cookies are immune to XSS attacks. JavaScript cannot read them, so even if malicious script runs on the page, it cannot steal the token.
**What we rejected and why:** localStorage — readable by any JS on the page, making it vulnerable to XSS. sessionStorage — same XSS problem, plus tokens are lost on tab close.
**What I learned:** Security decisions should default to the most restrictive option. Convenience (reading the token in JS) is never worth sacrificing security at the auth layer.

---

## Phase 4 — Multi-tenant workspace model
**The question we faced:** Should each coach have a single account, or should coaches be able to own and belong to multiple workspaces?
**Why we chose this:** Real coaching businesses have teams. An owner might manage multiple gym locations or brands. The workspace model supports this without duplicate accounts.
**What we rejected and why:** Single-tenant (one account = one team) — would require coaches to create separate accounts for each business, which is bad UX and hard to switch between.
**What I learned:** Modeling around the user's real-world context (a coaching business, not just a coach) makes the system more flexible. It costs more up front but prevents painful migrations later.

---

## Phase 8 — Seat limits enforced server-side, not client-side
**The question we faced:** Where should we enforce plan limits — in the frontend UI or the backend API?
**Why we chose this:** Client-side code can always be bypassed — inspect element, remove the disabled attribute, call the API directly. The API is the only trustworthy enforcement point.
**What we rejected and why:** Frontend-only gates — a user with minimal technical knowledge could bypass them by calling the API directly. This would allow unpaid access to paid features.
**What I learned:** Frontend gates are UX (show the right message at the right time). Backend gates are security (the actual enforcement). Never confuse the two.

---

## Phase 9 — Fawaterak for payments
**The question we faced:** Which payment gateway to use for subscriptions?
**Why we chose this:** Fawaterak supports Egyptian payment methods (Visa, Mastercard, Fawry, mobile wallets) and is commonly used in the Egyptian SaaS market. Stripe is not available in Egypt.
**What we rejected and why:** Stripe — not available for Egyptian merchants without a US entity. PayMob — similar to Fawaterak but Fawaterak was already set up.
**What I learned:** Payment gateway availability is region-specific. Always verify before assuming a popular global option works in the target market.

---

## Phase 9 — iframe for payment flow (not redirect)
**The question we faced:** Should the Fawaterak payment page open in an iframe overlay or redirect the user away from our app?
**Why we chose this:** An iframe keeps the user on our page. We can show a success state directly, poll for payment confirmation, and reload billing data without the user navigating away and losing context.
**What we rejected and why:** Full redirect — the user leaves our app, completes payment on Fawaterak, then we'd need to handle a return URL and reload state. More complex and a worse UX.
**What I learned:** Iframes have a bad reputation but are practical for third-party payment widgets where you control the parent page. The key is the `postMessage` event for cross-origin communication.
