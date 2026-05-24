# LEARNING.md — Growth Tracker

Format per session:
```
## [date]
**What we built:**
**New concepts learned:**
**Concepts I understood immediately:**
**Concepts I am still fuzzy on:**
**Question I want to explore next:**
**Confidence today (1–10):**
```

---

> Note: Entries below were backfilled from memory on 2026-05-25. Session entries from this point forward are logged live at session close.

---

## 2026-05-06 (approx.) — Phase 8: Subscription Plan Gating
**What we built:** Seat usage bar, upgrade banners, workspace count gate in create-workspace modal. Frontend gating of invite form based on plan limits.
**New concepts learned:** The difference between frontend gates (UX) and backend gates (enforcement). Why client-side gating can never be the real security boundary.
**Concepts I understood immediately:** `max_team_seats === 0` falsy bug — learned that 0 is falsy in JS and explicit null/undefined checks matter.
**Concepts I am still fuzzy on:** How to handle the edge case where a subscription expires mid-session — does the frontend know?
**Question I want to explore next:** How does polling for payment status work and when should we stop polling?
**Confidence today (1–10):** 7

---

## 2026-05-25 — Session opening debt fix
**What we built:** All 7 missing project documentation files (PROJECT.md, DEBT.md, DEPENDENCIES.md, GLOSSARY.md, WHY.md, LEARNING.md, REVIEWS.md). Identified 6 debt items from code review.
**New concepts learned:** The CLAUDE.md documentation scaffold exists so that decisions, debts, and learning don't live only in conversation history or memory.
**Concepts I understood immediately:** Why commit message format matters — searchable, scannable history.
**Concepts I am still fuzzy on:** (nothing new this session — pure housekeeping)
**Question I want to explore next:** Should we create a `dev` branch before continuing Phase 9 billing work?
**Confidence today (1–10):** 8
