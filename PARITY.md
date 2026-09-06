# PARITY.md — Web ↔ Mobile Parity Tracker

Companion to [`docs/mobile-parity-audit.md`](docs/mobile-parity-audit.md) (the full baseline audit, 2026-07-08) and
[`docs/mobile-parity-implementation-report.md`](docs/mobile-parity-implementation-report.md) (the catch-up pass that
followed it). Those were one-time, full-codebase reads — too expensive to repeat for every change. This file is the
lightweight, ongoing version: every commit that touches the client web portal gets a one-line entry here, and entries
get worked off into `mobile/` periodically instead of via another full audit.

**Scope:** `client/app/(client)/portal/**` (and shared code it pulls in, e.g. `client/app/components/nutrition/*`,
`client/utils/*`) vs. `mobile/lib/`.

A `post-commit` git hook (`.githooks/post-commit`) auto-appends a stub line to **Pending** whenever a commit touches
scoped paths — see the one-time setup note at the bottom. The hook only knows a matching file changed; it can't know
*what* changed semantically or whether it's mobile-relevant (pure refactors, copy tweaks, etc. still get logged) —
fill in the real one-liner and prune non-relevant stubs when you triage.

Format:
```
- [ ] YYYY-MM-DD — <commit-sha> — <area> — <one-line what changed, and why it matters for mobile>
```
Move a line to **Ported** when mobile catches up, with the mobile commit sha.

---

## Pending
- [ ] 2026-09-05 — b575bc3 — TODO(area) — "fix(messenger): show generic coach label instead of real name to clients" touched: client/app/(client)/portal/messages/page.js — fill in what changed and why it matters for mobile
Nothing outstanding. The two stub lines the post-commit hook added for `feb9e68` (subscription page) and `76da43d`
(food diary/adherence) were re-logs of features already tracked below under their prior "(uncommitted)" placeholder —
pruned here, real SHAs filled in on the existing **Ported** rows instead. The 2026-08-23 audit backlog (17 items) and
both web features that triggered it are all ported.

## Ported

- [x] 2026-09-05 — 1a55d96 — forms — Check-in stayed 'pending' after the check-in dispatcher tick, then went invisible/unfillable once the unrelated scheduleFormDispatcher cron stamped it 'sent' (every client surface only recognized 'pending'), fixed. Mobile fixed in the same commit (forms_page.dart, form_fill_page.dart, form.dart) — no separate mobile sha.
- [x] 2026-08-23 — fbf2f9e — training — Stale/invalid resumed session redirect loop, fixed. mobile `62991d3`.
- [x] 2026-08-23 — 55801f1 — training — YouTube Shorts embed regex, fixed. mobile `216fa6a`.
- [x] 2026-08-23 — 5a00416 — messenger/access — Logout on the expired/frozen trap screen, added. mobile `c866912`.
- [x] 2026-08-23 — 3b13794 — messenger — Composer send/edit/attachment failures now surfaced, fixed. mobile `49ea234`.
- [x] 2026-08-23 — 6d7e627 — home — Duplicate Progress-tab submission timeline, removed. mobile `dc8185d`.
- [x] 2026-08-23 — 19e00c0 — training — Arabic exercise/muscle/equipment names, added. mobile `9ea06d5`.
- [x] 2026-08-23 — cd6f287 — training — History cards redesigned, client-initiated delete added. mobile `c8e5410`.
- [x] 2026-08-23 — 1cd7303 — training — YouTube playback-error fallback (external link), added. mobile `a5aee7d`.
- [x] 2026-08-23 — 6d7e627 — home — Action Needed strip, added. mobile `6fd9bb0`.
- [x] 2026-08-23 — dd9c85f — forms — Edit a submitted answer + view its edit history, added. mobile `9c3f133`.
- [x] 2026-08-23 — fa12b25 — insights — Insights/Feedback subsystem (banner, prompts, feedback entry), added. mobile `843c8a7`.
- [x] 2026-08-23 — 93424dc — nutrition — Food swap (search/swap/reset, allow_food_swap flag), added. mobile `e2b527f`.
- [x] 2026-08-23 — 0c7b7fa — training — Exercise tracking categories (Sets&Reps/Time-Based) + RPE, added. mobile `302f612`.
- [x] 2026-08-23 — 17a0627 — training — Autosave/draft-resume (debounced PUT + server-side draft recovery), added. mobile `0b17c32`.
- [x] 2026-08-23 — cf0500a — training — Day-preview re-architecture (shared session UI, resumable/minimizable sessions, live "Continue {day}" state), added. mobile `9298d1c`.
- [x] 2026-08-23 — 0a7f9bc — training — Post-session completion page (stats, star+text feedback via the Insights subsystem), added. mobile `43bb7af`. Chime omitted — no audio-synthesis dependency added for it; see the commit note.
- [x] 2026-08-23 — 83821a8 — training — First-time hint mechanism (5 surfaces), added. mobile `f73765a`, re-ported to an anchored popover matching web (uncommitted) — see the commit note on `f73765a` for why it originally shipped as a SnackBar.
- [x] 2026-08-23 — 76da43d — nutrition — Food Diary + Adherence (checklist + history), added. mobile `54e22a6`.
- [x] 2026-08-23 — feb9e68 — profile — Subscription page (plan card, period/progress, renew CTA, payment history), added. mobile `e9260b4`.

---

## One-time setup (per clone/machine)

Git hooks in `.git/hooks/` aren't version-controlled or auto-active, so this repo points git at a tracked hooks dir
instead. Run once per machine:

```sh
git config core.hooksPath .githooks
```

Without this, the hook exists in the repo but won't fire, and nothing gets logged automatically.
