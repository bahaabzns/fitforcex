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

Backlog from the 2026-08-23 full audit ([`docs/mobile-parity-audit-2026-08-23.md`](docs/mobile-parity-audit-2026-08-23.md)) — drift since the 2026-07-10 baseline. Two more uncommitted web features (Food Diary/Adherence, Subscription page) are tracked separately — already fully planned, not listed here.

**Training Mode**
- [ ] 2026-08-23 — 17a0627 — training — Autosave/draft-resume: web PUTs progress every 700ms + recovers an in-progress session on reload; mobile only POSTs once at Finish and loses everything if killed mid-workout. Large.
- [ ] 2026-08-23 — 0c7b7fa — training — Exercise tracking categories (Sets&Reps vs Time-Based) + coach-selectable metrics + RPE; mobile's session model has none of these fields. Large.
- [ ] 2026-08-23 — cf0500a — training — Day-preview re-architecture: shares session-page UI, resumable/minimizable sessions, live "Continue {day}" state; mobile still has the old separate card layout. Large.
- [ ] 2026-08-23 — 0a7f9bc — training — Post-session completion page (chime, stats, star+text feedback); mobile goes straight from Finish to History. Medium-Large, depends on the Insights subsystem item below.
- [ ] 2026-08-23 — 83821a8 — training — First-time hint tooltip mechanism doesn't exist on mobile at all; mostly blocked until the features above ship. Small.

**Nutrition**
- [ ] 2026-08-23 — 93424dc — nutrition — Food swap (swap a prescribed food for an equivalent, gated behind a new `allow_food_swap` access flag); entirely absent on mobile — no flag, no model fields, no endpoints called. Large.

**Insights / Feedback (new subsystem)**
- [ ] 2026-08-23 — fa12b25 — insights — Entire feedback/prompts subsystem (banner host, feedback modal, contextual triggers on Messages/Forms/Training-history) has zero mobile equivalent. Large.

## Ported

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

---

## One-time setup (per clone/machine)

Git hooks in `.git/hooks/` aren't version-controlled or auto-active, so this repo points git at a tracked hooks dir
instead. Run once per machine:

```sh
git config core.hooksPath .githooks
```

Without this, the hook exists in the repo but won't fire, and nothing gets logged automatically.
