# CLAUDE.md — Backend Engineering Framework

> How I build TypeScript/Node backends. These are the defaults — match them unless the project has a documented reason not to. The goal is a codebase where every feature looks like it was written by the same person on the same day: predictable structure, one way to do each thing, no surprises.
>
> **Map:** **Part A** = architecture & patterns (the *what*). **Part B** = code craft standards (naming, git, testing, deps — the *how well*). **Part C** = routines (the *when & in what order*). **Part D** = report templates & working modes. Read Part A + B once; invoke Part C by name; reach for Part D when a routine asks for it.

---

## ⚠️ CURRENT REALITY GAP

> Read this before you trust anything below. This document is the **target**, not a description of the code as it stands today. The patterns in Part A are real and worth matching; the *standards* in Part B describe where we're going, not where we are. Don't cite the manifesto to win an argument the codebase would lose. New code meets the bar; legacy code mostly predates it. When you touch a file, leave it closer to the target — don't pretend it's already there.

| The doc says | The repo actually does | Severity |
|---|---|---|

---

## 0 — THE MINDSET

1. **One way to do each thing.** Pick a pattern, write it down here, repeat it everywhere. A reader should be able to predict where code lives and how it behaves before opening the file.
2. **The pipeline decides behavior, not the handler.** Cross-cutting concerns (auth, tenancy, validation gates, error shaping) live in middleware/wrappers. Handlers stay thin and boring.
3. **Make the dangerous thing the hard thing.** Multi-tenant data leaks, unhandled rejections, leaked secrets, and missing auth should require *going out of your way* — the default path should be safe.
4. **Fail fast and loud at the edges, never in the middle.** Validate input at the boundary, validate config at startup. Once data is inside, trust it.
5. **The schema is the source of truth.** The database shape drives the types, not the other way around.
6. **Boring is a feature.** No clever abstractions until the same code appears three times. Prefer explicit and obvious over DRY-and-magic.

---

## 1 — DEFAULT STACK

This is the starting stack. Swap a layer only with a reason, and record the reason.

| Layer | Default | Why |
|---|---|---|
| Runtime | Node LTS, **native ESM** (`"type": "module"`) | Modern, standard. See the ESM rule in §9. |
| Language | TypeScript, `strict: true`, `noEmitOnError: true` | Types are not optional; a build that doesn't typecheck doesn't ship. |
| Web | Express | Small, explicit, well-understood middleware model. |
| ORM / DB | Prisma + PostgreSQL | Typed queries, migrations as first-class, one schema file. |
| AuthN | JWT (`jsonwebtoken`) + `bcrypt` | Token in httpOnly cookie *and* `Authorization: Bearer` fallback. |
| Validation | One schema lib (Joi **or** Zod) — pick one per project | Validate at the controller boundary. |
| Realtime | Socket.IO *(only if needed)* | Don't add until a feature requires push. |
| API docs | OpenAPI via JSDoc on routes (swagger-jsdoc) | Docs live next to the route or they rot. |
| Files | Multer → object storage (S3-compatible) | Local fallback in dev. |
| Email / Push | Nodemailer / FCM behind a service module | Never call providers inline from controllers. |
| Dev runner | `tsx watch` | Fast ESM reload, no separate compile step in dev. |
| Lint / format | ESLint + Prettier | Non-negotiable, run in CI. |

---

## 2 — LAYERED ARCHITECTURE

Strict layering. Dependencies point downward only. A controller never imports another module's controller; shared logic moves down into `lib/` or `utils/`.

```
src/
├── server.ts          ← process entry: validate env → create server → start listeners/jobs
├── app.ts             ← framework wiring: middleware chain + route mounting + error handler
├── config/            ← typed env accessor, env validation, api-docs spec. The ONLY place that reads process.env.
├── lib/               ← shared singletons & integrations (db client, socket server, storage, mailer, push)
├── middleware/        ← the request pipeline: auth, tenancy, authz, validation gates, monitoring
├── modules/           ← ONE FOLDER PER FEATURE. routes.ts + controller.ts is the atomic unit.
├── routes/index.ts    ← mounts every module router under a common prefix
├── types/             ← ambient type augmentation (e.g. extending the request object)
└── utils/             ← pure, dependency-light helpers (asyncHandler, encryption, domain helpers)
prisma/ (or db/)
├── schema.prisma      ← single source of truth for the data model
├── migrations/        ← ordered, committed, never hand-edited after apply
└── seed*.ts           ← seed scripts
```

**Rules of the layout:**
- `config/` is the *only* place `process.env` is touched. Everything else imports a typed `env` object.
- `lib/` holds **singletons** — the database client, the realtime server, the storage client are instantiated **once** and imported. Never `new`-up a second DB client.
- `modules/` is self-contained per feature. If two modules need the same thing, it goes down to `lib/` or `utils/`, not sideways.
- `server.ts` vs `app.ts` split: `app.ts` is the testable, importable Express app; `server.ts` owns the process (env validation, HTTP server, sockets, background intervals).

---

## 3 — THE REQUEST PIPELINE (the heart of the design)

Define a single, global middleware chain in `app.ts` and **know it cold**. Most behavior is decided here, before any handler runs. A representative order:

```
security headers (helmet, CSP)
  → CORS (explicit allowlist, credentials as needed)
  → body parsers (with a size limit from env)
  → cookie parser → compression → request logging
  → performance/observability hooks
  → static assets (if any)
  → identity parsers      ← NON-BLOCKING: populate req.userId / req.clientId if a valid token exists, else next()
  → context resolvers     ← tenancy, locale, feature flags → attach to req
  → global gates          ← e.g. subscription/quota checks with a path allowlist
  → public routes (health, docs)
  → strict-scoped routers (e.g. admin) behind their own guards
  → main router
  → error monitor → error handler   ← LAST. The single funnel for all errors.
```

**The identity vs. authorization split — internalize this:**
- **Identity parsing is global and non-blocking.** "Who is this caller?" runs for everyone; if there's no valid token it just continues without setting the identity. It never throws.
- **Authorization is per-route and blocking.** "Is this caller allowed to do *this*?" is a route guard (`requirePermission(...)`, `requireClientAuth`, etc.) that throws when denied.

This separation is what lets the same endpoint serve multiple caller types cleanly and keeps controllers free of auth branching.

**Path allowlists over per-route opt-outs.** Global gates (auth-required, subscription-required) keep an explicit regex allowlist of exceptions in one place, rather than scattering "skip this" flags across routes. One file tells you everything that's public.

---

## 4 — IDENTITY & AUTH

Model auth as **distinct identity types**, each with its own token carrier, its own request field, and its own route guard. Never overload one identity to mean several things.

A typical multi-audience setup:

| Identity | Token carrier | Request field | Guard | Source of truth |
|---|---|---|---|---|
| Primary user | httpOnly cookie or Bearer | `req.userId` | permission/role guard | user + membership tables |
| Scoped end-user | separate cookie / Bearer with scoped claims | `req.clientId` (+ scope) | dedicated guard | scoped-entity table |
| Operator/admin | Bearer only (no cookies), restricted origin | `req.isAppAdmin` | strict guard + origin check | admin table |

**Auth defaults:**
- JWT signed with a secret from env; short, explicit expiry. Verify on every request.
- **Server-side session validation for sensitive identities.** Don't trust the JWT alone — back it with a session row (revocable, expiring) and compare a `sha256` hash of the token. This enables "log out everywhere" and single-device enforcement (a new login revokes the prior session).
- Token transport: prefer httpOnly cookies for browsers; accept `Authorization: Bearer` as a fallback for mobile/API clients.
- Cookie domain derived from config so auth works across subdomains.
- Augment the Express `Request` type in `types/` for every identity field — never use `(req as any)`.
- Admin/operator surfaces get **stricter** rules than users: no persistent cookies, restricted origin/subdomain, separate permission stack.

---

## 5 — MULTI-TENANCY & DATA SCOPING

If the product has tenants (workspaces, orgs, accounts), this is the **single most important correctness rule**:

- A context resolver turns a header / subdomain / token claim into `req.tenantId` early in the pipeline.
- **Every query against a tenant-scoped table MUST filter by the tenant id.** A missing tenant filter is a data-leak bug, not a style nit — treat it with the severity of a security vulnerability.
- There is usually no framework guardrail enforcing this — it is the controller's discipline. Code review checks it explicitly.
- Tenant-unique constraints are compound: `@@unique([tenantId, name])`, not just `name`.

---

## 6 — AUTHORIZATION (RBAC)

- Model permissions as dotted `domain.action` string keys (`clients.read`, `billing.write`, `team.manage`). Granular and self-describing.
- Chain: `Member → Role → RolePermission → Permission(key)`. Roles are per-tenant.
- Guards are middleware factories: `requirePermission(key)`, `requireAnyPermission([...])`, `requireRole(name)`.
- Pick the **narrowest** key that fits: read = `.read`, mutate = `.write`, full feature control = `.manage`. Only mint a new key when none fits, and seed it.
- Operators/admins bypass tenant RBAC via an explicit short-circuit, and have their own separate permission stack.

---

## 7 — MODULE CONVENTION (how to add a feature)

A module is `src/modules/<feature>/` with at minimum `routes.ts` + `controller.ts`. Larger modules split controllers by concern (`subscription.controller.ts`, `invitation.controller.ts`) and add a `service.ts` for reusable domain logic and an `emailService.ts` for notifications. The unit never changes: **routes wire HTTP + guards; controllers validate + orchestrate; services hold reusable logic.**

**routes.ts**
```ts
import { Router } from "express";
import { asyncHandler } from "../../utils/asyncHandler.js";      // note .js (§9)
import { requirePermission } from "../../middleware/permissions.js";
import { listThings, createThing } from "./controller.js";

const router = Router();

/**
 * @openapi
 * /api/things:
 *   get: { tags: [Things], summary: List things in tenant }
 */
router.get("/",  requirePermission("things.read"),  asyncHandler(listThings));
router.post("/", requirePermission("things.write"), asyncHandler(createThing));

export default router;
```

**controller.ts**
```ts
import { Request, Response } from "express";
import Joi from "joi";
import { StatusCodes } from "http-status-codes";
import { prisma } from "../../lib/prisma.js";
import { ApiError } from "../../middleware/error.js";

const createSchema = Joi.object({ name: Joi.string().min(2).required() });

export async function createThing(req: Request, res: Response) {
  const { error, value } = createSchema.validate(req.body);
  if (error) throw new ApiError(StatusCodes.BAD_REQUEST, error.message);
  if (!req.tenantId) throw new ApiError(StatusCodes.BAD_REQUEST, "Tenant context required");

  const thing = await prisma.thing.create({
    data: { ...value, tenantId: req.tenantId },     // ALWAYS scope to tenant
  });
  res.status(StatusCodes.CREATED).json(thing);
}
```

Then mount once in `routes/index.ts`: `router.use("/things", thingsRoutes);`

---

## 8 — NON-NEGOTIABLE CODE RULES

1. **Wrap every async handler** in `asyncHandler(...)` so rejections funnel to the error handler instead of crashing silently:
   ```ts
   export const asyncHandler = (fn) => (req, res, next) =>
     Promise.resolve(fn(req, res, next)).catch(next);
   ```
2. **Errors are thrown, not returned.** Controllers `throw new ApiError(status, message)`. A single global error handler is the *only* place that writes an error response, and it always uses one shape (`{ error: message }`). No try/catch for control flow in handlers.
3. **Validate input at the top of every controller** with the project's chosen schema lib. Never trust `req.body`/`req.query`/`req.params`.
4. **Scope every tenant query** by `req.tenantId` (§5).
5. **Respect soft deletes.** Filter `deletedAt: null` (and status exclusions) on every read of a soft-deletable model.
6. **Declare specific routes before parameterized ones.** `/things/active` must come before `/things/:id`, or the param route shadows it. This is a real, recurring bug.
7. **Document each route** with an `@openapi` JSDoc block. It's the only API documentation that stays current.
8. **Import shared singletons** (`prisma`, `env`, `io`) — never instantiate your own.
9. **No secrets, URLs, or magic numbers in code.** Config from `env`; constants named and grouped.
10. **Keep handlers thin.** Reusable or cross-module logic goes to `services`/`utils`/`lib`, not copy-pasted.

---

## 9 — ESM DISCIPLINE (the recurring footgun)

Native ESM means **every relative import includes the `.js` extension**, even though the source is `.ts`:
```ts
import { prisma } from "../../lib/prisma.js";   // ✅
import { prisma } from "../../lib/prisma";      // ❌ runtime crash
```
This is the most common mistake when adding files. Both the dev runner and the compiled output require it. If you skip CommonJS, commit to this fully.

---

## 10 — DATABASE & MIGRATIONS

- **Single schema file** is the source of truth. IDs default to collision-resistant strings (`cuid()`/`uuid`), not auto-increment ints.
- **Standard columns** on most models: `createdAt`, `updatedAt`, and a nullable `deletedAt` for soft deletes (indexed).
- **Index every foreign key and every column you filter or look up by.** Compound `@@unique` for tenant-scoped uniqueness.
- **Migrations are immutable history.** Generate them, commit them, deploy with the non-interactive deploy command in CI/prod. Never hand-edit an applied migration; never run dev migrations against production. Keep a documented recovery path for migration drift.
- **Seeds are scripts, not magic.** Idempotent where possible. Separate "reference data" seeds (permissions, default templates) from "demo data" seeds.
- Regenerate the client after every schema change before relying on new types.

---

## 11 — BACKGROUND WORK & REALTIME

- In-process schedulers (`setInterval`/recursive `setTimeout`) are fine for a single-instance app: dispatching scheduled items, expiring records, cleanup. **Always wrap each tick in try/catch** and reschedule in `finally` so one failure doesn't kill the loop. Document each job (cadence + effect) in this file.
- Know the ceiling: in-process jobs don't survive horizontal scaling cleanly. When you scale out, move to a real queue/cron — flag it before that day, not after.
- Realtime (Socket.IO): authenticate the handshake with the same token logic as HTTP, attach identity to the socket, mirror the HTTP CORS allowlist, and export the server instance from `lib/` so any module can emit.

---

## 12 — CONFIG & SECRETS

- All env access through one typed accessor module with `getEnv` / `getEnvNumber` / `getEnvBoolean` helpers and sane fallbacks for dev only.
- **Validate configuration at startup and exit on failure** — a misconfigured process should never accept traffic.
- Secrets live in env (and a real secret manager in prod), never in the repo. Provide a committed `.env.example`.
- Secrets stored in the DB (e.g. per-tenant API keys) are encrypted at rest with a key from env.

---

## 13 — STANDARD SCRIPTS

```bash
npm run dev               # tsx watch (hot reload, ESM)
npm run build             # tsc → dist/  (must pass with noEmitOnError)
npm start                 # run compiled output
npm run lint / format     # eslint / prettier — run in CI

npm run db:generate       # regenerate ORM client after schema change
npm run db:migrate        # create + apply migration (dev)
npm run db:deploy         # apply migrations (prod/CI, non-interactive)
npm run db:studio         # DB GUI
npm run seed              # reference/demo data
```
Containerize for parity (app + DB + DB-admin in compose). Keep the production deploy path documented and repeatable.

---

## 14 — CHECKLIST FOR ANY NEW ENDPOINT

Before writing:
- [ ] Which identity is this for — user (permission guard), scoped end-user, or operator (strict guard)?
- [ ] Is it tenant-scoped? Then every query filters `tenantId` + `deletedAt: null`.
- [ ] Does a global gate (auth/subscription/quota) apply, or does this path belong on an allowlist?
- [ ] Reusing an existing permission key, or seeding a new one?

While writing:
- [ ] `routes.ts` + `controller.ts`, mounted once in `routes/index.ts`.
- [ ] Every handler wrapped in `asyncHandler`; errors via `throw new ApiError(...)`.
- [ ] Input validated at the top of the controller.
- [ ] All local imports end in `.js`.
- [ ] `@openapi` JSDoc on the route.
- [ ] Specific routes before `/:id` param routes.

After a schema change:
- [ ] Named migration generated + committed; client regenerated.
- [ ] Indexes + `deletedAt` on new models; compound `@@unique` where tenant-unique.

Never:
- [ ] Instantiate a second DB client, or read `process.env` outside `config/`.
- [ ] Return ad-hoc error shapes — the global handler owns error responses.
- [ ] Ship a tenant query without a tenant filter.
- [ ] Leave an async route unwrapped.

---

## 15 — KEEPING THIS FILE HONEST

This document is a contract, not decoration. When a pattern here stops matching reality, **fix the code or fix this file** — never let them drift. New cross-cutting decision → record it here with its rationale. The test of success: a new contributor reads this file, opens any module, and finds exactly what they expected.

---

# PART B — CODE CRAFT STANDARDS

> Part A is *where code goes and how it's wired*. Part B is *how good the code itself is*. These apply to every file, every commit, every language — they're the quality bar the routines enforce.

## B1 — NAMING

| Thing | Rule | Good | Bad |
|---|---|---|---|
| Variables | name what the data **is** | `userAge`, `pendingInvites` | `x`, `data`, `temp`, `obj` |
| Functions | name what they **do** | `calculateTotal`, `getUserById` | `run`, `handle`, `func1` |
| Booleans | a yes/no question | `isActive`, `hasPermission`, `canEdit` | `flag`, `status`, `check` |
| Files | match what's inside | `userService.ts`, `pricing.ts` | `utils2.ts`, `stuff.ts` |
| Constants | `ALL_CAPS_SNAKE` | `MAX_RETRIES`, `TOKEN_TTL_DAYS` | `maxR`, `t` |
| Branches | `type/short-description` | `feature/client-invites`, `fix/login-loop` | `new`, `test`, `wip` |

- No abbreviations except universal ones (`id`, `url`, `api`, `db`).
- Never the generic words: `data`, `info`, `stuff`, `temp`, `obj`, `result`, `val`, `item` (when something specific fits).
- If a name needs "and", it's doing two jobs — split it.

## B2 — FUNCTIONS

- **One function, one job.** No "fetch and format and save."
- **≤ 3 positional params.** More → pass a single typed object.
- **≤ ~30 lines.** Longer → flag and split.
- **No surprise side effects.** `getX` reads; it never writes, sends, or deletes.
- **Return what the name promises**, always — never a silent `undefined`.
- **Every async function handles its failure path** (or deliberately lets it bubble to `asyncHandler`). No swallowed rejections.

## B3 — CODE QUALITY

- **No magic values.** `if (status === ORDER_SHIPPED)` not `if (status === 3)`. Name it, group it.
- **Comments explain WHY, not WHAT.** `// retry ceiling hit — stop polling`, not `// add 1 to i`.
- **Error messages say what happened AND what to do.** `"Could not save profile — check your connection and retry"`, not `"Error"`. (User-facing copy only; internal `ApiError` messages stay terse and never leak internals.)
- **Flag on sight:** 🔴 duplicated logic (extract on the 3rd copy) · empty `catch` that swallows · commented-out code (git remembers) · nesting > 3 deep · dead code · mixed concerns · hardcoded secrets/URLs. 🟡 unused imports · debug logging of sensitive data.
- **FSMR** — every change should be **F**ixed (simple & stable over clever), **S**calable (loops & config, not copy-paste & hardcode), **M**aintainable (understandable in < 60s), **R**eusable (parameterized, not one-off).

## B4 — GIT

**Branches:** `main` (always deployable, never direct commits) ← `dev`/integration ← `feature/*` · `fix/*` · `refactor/*` · `chore/*`.

**Commit format:** `type: imperative summary (≤ ~60 chars)`

| type | for |
|---|---|
| `feat:` | new feature | 
| `fix:` | bug fix |
| `refactor:` | behavior-preserving restructure |
| `perf:` | performance |
| `test:` | tests only |
| `docs:` | docs/comments |
| `chore:` | config, deps, scaffolding |

- One commit = one logical change. If the message needs "and", split it.
- Never commit broken code; never force-push shared branches.
- **Never commit:** `.env*`, `node_modules/`, `dist/`/`build/`, logs, key files, dumps. Warn loudly if any appear staged.

## B5 — TESTING

The original project leaned on manual verification + `console.log`; the *standard* is real tests. Add a runner on day one (`vitest` or node's built-in test runner; `supertest` for HTTP). A feature isn't done until its core paths are covered.

- **AAA per test** — Arrange, Act, Assert. One behavior per test; tests fully independent.
- **Cover four buckets per unit:** happy path · edges (0, 1, max, empty) · sad path (null, wrong type, missing field) · weird (huge input, unicode, concurrent).
- **For endpoints**, test the layers that matter here: auth-denied (wrong/no identity), authz-denied (missing permission), validation-fail (bad body → 400), **tenant isolation** (caller A cannot read caller B's rows), happy path.
- **Names are sentences:** `"returns 403 when caller lacks clients.write"`, not `"test1"`.
- **Red → Green → Refactor:** write the failing test, make it pass minimally, clean up with B1–B3 still green.
- **Rough coverage targets:** pure utils 90% · domain/services 85% · endpoints 80% · skip config/glue.
- **Bad tests to reject:** ones that can't fail, that assert implementation not behavior, that depend on each other or on test order, or `skip` with no logged reason.

## B6 — DEPENDENCIES

Before adding a package, vet it (show the result): (1) needed, or trivial to write ourselves? (2) maintained — last release < ~1yr? (3) adoption — downloads/stars sane? (4) known CVEs? (5) install/footprint cost? Two or more red flags → find an alternative or build it. Log non-obvious additions in `DEPENDENCIES.md` (what, why, where used) so the next person doesn't have to guess.

## B7 — COMPANION DOCS (lightweight tracking)

The routines reference a few living docs. Keep whichever earn their keep; don't ceremony-pad. At minimum:

| File | Holds | Touched |
|---|---|---|
| `CLAUDE.md` | this contract | when a pattern changes |
| `DEBT.md` | known shortcuts/risks: what, why it matters, effort, priority | as debt is taken or paid |
| `DECISIONS.md` | significant choices: the question, what we picked, what we rejected, why | per significant decision |
| `DEPENDENCIES.md` | non-obvious packages and the reason | per add |
| `README.md` | run/setup/deploy + endpoint overview | when those change |

`DEBT.md` entry: `## [date] — [area]` then **Type / What / Why it matters / Effort (S·M·L) / Priority (H·M·L)`. When you take a deliberate shortcut, drop a `// DEBT: <what> — proper fix: <what>` at the line *and* log it. Mark paid items `✅ RESOLVED [date]`.

---

# PART C — ROUTINES

> Repeatable procedures. Invoke one by name ("run the New Feature routine") and follow it step by step. Each routine is built on the patterns in Part A and the standards in Part B — it tells you *when* to apply them and *in what order*. Don't skip steps; if a step doesn't apply, say so and move on.

## TRIGGER MAP

| When this happens | Run this routine |
|---|---|
| Starting a brand-new backend | **New Project** |
| Opening any work session | **Session Opening** |
| Adding a feature / endpoint(s) | **New Feature** |
| Changing the data model | **Schema Change** |
| A bug is reported or found | **Bug Fix** |
| A feature is working, before commit | **Code Review** |
| About to commit | **Pre-Commit** |
| About to merge a branch | **Pre-Merge** |
| Shipping to staging/production | **Pre-Deploy** |
| Code feels messy / hard to navigate | **Refactor** |
| Every few features | **Tech-Debt Sweep** |
| Closing a work session | **Session Closing** |

---

## ROUTINE — New Project
**Trigger: greenfield backend.** Scaffold to Part A before any feature code.

1. **Define it in one line.** What it does, who it's for, the one thing it must do well. Identify whether it's multi-tenant — that decision shapes everything (§5).
2. **Lock the stack** (§1). Start from the defaults; record every deviation and its reason.
3. **Scaffold the layout** (§2): `config/ lib/ middleware/ modules/ routes/ types/ utils/` + `prisma/`. Create `app.ts` / `server.ts` split.
4. **Wire the spine first, no features:**
   - Typed `env` accessor + startup validation that exits on failure (§12).
   - One DB client singleton in `lib/` (§2).
   - `asyncHandler` + global `ApiError` error handler (§8).
   - The middleware chain skeleton in `app.ts` (§3), even if some stages are stubs.
   - `requireAuth` identity parsing + `types/` request augmentation (§4).
   - Tenant resolver if multi-tenant (§5).
   - `/health` route, OpenAPI at `/api-docs`.
5. **Init the schema** (§10): base models with `createdAt`/`updatedAt`/`deletedAt`, IDs as `cuid`/`uuid`, first migration committed.
6. **Tooling:** ESLint + Prettier, `tsx watch` dev script, build with `noEmitOnError`, `.env.example`, container/compose for parity.
7. **Confirm the spine runs** (server boots, `/health` green, a migration applies) before writing feature #1.
8. **Pick the smallest first feature** that proves the core idea — not auth, not styling. Then run **New Feature**.

---

## ROUTINE — Session Opening
**Trigger: start of a work session.**

1. `git status` and recent log — anything uncommitted or half-done?
2. Skim this file's Part A so the patterns are fresh.
3. State the one goal for the session in a sentence.
4. Check the tech-debt notes / TODOs touching the files you're about to open — fix-now or log.

---

## ROUTINE — New Feature
**Trigger: adding an endpoint or a feature module.** This is the workhorse; it drives §7 + §8 + §14.

1. **Describe** the feature in one sentence. If it needs an "and," it's two features — split.
2. **Plan before code:**
   - Which **identity** is this for — user, scoped end-user, or operator (§4)?
   - **Tenant-scoped?** Then every query filters `tenantId` + `deletedAt: null` (§5).
   - Does a **global gate** (auth/subscription/quota) apply, or does the path need allowlisting (§3)?
   - Which **permission key** — reuse the narrowest existing one, or seed a new one (§6)?
   - Which files change? New `modules/<feature>/`? Schema touched (→ run **Schema Change** first)?
3. **Branch:** `feature/<short-name>` off the integration branch, clean tree.
4. **Build the module** (§7): `routes.ts` (HTTP + guards + `@openapi`) and `controller.ts` (validate at top → orchestrate → respond). Reusable logic to `service.ts`/`utils`/`lib`, never sideways into another module.
5. **Mount once** in `routes/index.ts`. Specific routes before `/:id` (§8.6).
6. **Self-check against §14** before declaring done: `asyncHandler` everywhere, errors thrown as `ApiError`, input validated, tenant-scoped, `.js` imports, docs present.
7. **Test it** (B5): cover happy path + auth-denied + authz-denied + validation-fail + tenant-isolation. Write the test first where it's cheap (red → green → refactor). At minimum, manually exercise those paths and say which you covered which way.
8. Run **Code Review**, then **Pre-Commit**.

---

## ROUTINE — Schema Change
**Trigger: any data-model change.** Follow §10 precisely — migrations are immutable history.

1. Edit the single schema file. New models get `createdAt`/`updatedAt`/`deletedAt`, `cuid`/`uuid` id, indexes on every FK + filtered column, compound `@@unique([tenantId, …])` where tenant-unique (§10).
2. Generate a **named** migration (`db:migrate`) — never hand-edit after apply. Commit the migration with the code that needs it.
3. Regenerate the ORM client before relying on new types.
4. If reference data is involved (permissions, defaults), update the idempotent seed.
5. Confirm a clean apply on a fresh DB. Document any drift-recovery step if the change is destructive.
6. Return to whatever routine called this.

---

## ROUTINE — Bug Fix
**Trigger: a bug is reported or found.** Understand → reproduce → fix small → prove.

1. **Triage:** severity (data loss / security / core-broken / minor) and blast radius. Critical → stop other work.
2. **Gather facts:** exact wrong behavior vs. expected, repro steps, when it started, scope. Don't touch code until you can state the bug in one sentence.
3. **Branch:** `fix/<short-desc>`.
4. **Reproduce first.** Write a failing test or a precise manual repro that *proves* the bug exists. If you can't reproduce it, you don't understand it yet.
5. **Trace to the exact line** — don't guess. State: "receives X, produces Y, because Z."
6. **Smallest possible fix.** Fix only the bug. No drive-by refactors or renames — log those separately.
7. **Prove it:** the repro now passes, nothing else broke, manual path confirmed.
8. **Root cause + prevention:** why it happened, why it wasn't caught, what stops the *class* of bug (a guard? a validation? an index? a tenant filter?). Check whether the same pattern exists elsewhere.
9. Run **Pre-Commit**; commit `fix: …`.

---

## ROUTINE — Code Review
**Trigger: feature works, before commit/merge.** "It works" is the floor, not the bar.

Review in passes, flag 🔴 blocker / 🟡 fix-soon / 🔵 nice-to-have:

- **Correctness:** matches the description; handles empty/null/wrong-type input; every async path has error handling; functions return what their name promises.
- **Security & tenancy:** 🔴 every tenant query is scoped (§5); 🔴 no hardcoded secrets; input validated at the boundary; right guard for the identity (§4); error messages don't leak internals.
- **Pattern fit:** module shape per §7; `asyncHandler` + thrown `ApiError` (§8); `.js` imports (§9); routes ordered (§8.6); `@openapi` present; narrowest permission key (§6).
- **Clarity & reuse:** names say what they hold/do; no duplicated logic (extract on the third copy); no dead/commented code; functions do one job.

Resolve all 🔴 before commit; log 🟡 to tech-debt.

---

## ROUTINE — Pre-Commit
**Trigger: before every commit.**

- [ ] Build typechecks (`noEmitOnError` clean); lint passes.
- [ ] Tests for changed code pass (if a suite exists).
- [ ] No secrets / `.env` / build artifacts staged.
- [ ] No stray debug logging or commented-out code.
- [ ] Tenant filters present on touched queries.
- [ ] Message format `type: imperative summary` (`feat:` `fix:` `refactor:` `chore:` `docs:`). One logical change per commit.

---

## ROUTINE — Pre-Merge
**Trigger: before merging a branch.**

- [ ] Full build + lint + tests green on the branch.
- [ ] **Code Review** passed; all 🔴 resolved.
- [ ] New migrations apply cleanly on a fresh DB.
- [ ] No tenant-scoping regressions.
- [ ] Branch rebased/updated on the integration branch; conflicts resolved.

---

## ROUTINE — Pre-Deploy
**Trigger: shipping to an environment.** Never deploy a dirty branch or without a rollback path.

1. **Gates:** correct branch, clean tree, build + tests green, no secrets in config.
2. **Env:** every required var set in the target (§12); prod-grade keys, not dev keys.
3. **Migrations:** apply with the **non-interactive deploy** command; destructive changes need a written rollback and a backup first.
4. **Staging first:** deploy, smoke-test the critical path (boot, auth, one core read, one core write, no error spike). Hold before promoting.
5. **Production:** deploy, then immediately verify health + core path + error dashboard. Stay present through the observation window.
6. **Rollback ready:** know the previous-good version and the one command to restore it before you start.
7. Tag the release; record what shipped.

---

## ROUTINE — Refactor
**Trigger: code is messy or hard to navigate.** Cleanup only — no features, no fixes, no behavior change.

1. Snapshot: clean commit, branch `refactor/<scope>`.
2. **Audit, change nothing first:** map the messy area, list problems (duplication, misplaced files, oversized handlers, mixed concerns, sideways imports, missing tenant scoping noted-but-not-touched).
3. Move/rename in small steps — one concern at a time, imports fixed immediately (`.js`!), behavior identical.
4. Verify after each step (build + smoke). Commit per coherent step.
5. Anything that needs a real fix → log it, don't fix it here.

---

## ROUTINE — Tech-Debt Sweep
**Trigger: every few features, or before it compounds.** No new features this pass.

1. Collect: TODO/FIXME, duplicated logic, oversized handlers, missing indexes, untyped `any`, unscoped queries, missing validation/tests.
2. Prioritize: **security & tenancy first**, then high-leverage duplication, then quick wins.
3. Fix in small reviewed commits. Leave the code measurably better than you found it.

---

## ROUTINE — Session Closing
**Trigger: end of a work session.**

- [ ] Everything committed with proper messages, or deliberately stashed.
- [ ] Build/lint/tests green.
- [ ] New debt or follow-ups noted in `DEBT.md` where the next session will see them.
- [ ] Boy-Scout rule: leave the touched code a little better than you found it.
- [ ] One-line state: what's done, what's next.

---

## MASTER WORKFLOW (how the routines connect)

```
Session Opening
   → New Feature ──(schema?)──► Schema Change ──┐
        │                                        │
        └──► build module ──► Test (B5) ──► Code Review ──► Pre-Commit ──► Pre-Merge
                                   ▲                                          │
                              Bug Fix (same path, repro-first)               │
   every few features → Tech-Debt Sweep / Refactor                          │
   ship it → Pre-Deploy ──► (staging → prod → verify → tag) ◄───────────────┘
   → Session Closing
```

---

# PART D — REPORT TEMPLATES & MODES

> Routines say *produce a report* or *switch modes*. The formats live here so the routines stay short. Use them verbatim; they make output skimmable and comparable across sessions.

## D1 — Code Review Report
Emitted by the Code Review routine. Severity: 🔴 blocker (fix before commit) · 🟡 fix-soon (log to `DEBT.md`) · 🔵 nice-to-have · 📚 worth learning.

```
CODE REVIEW — <file(s)>   <date>   feature: <what it does>
Blockers: n  Warnings: n  Suggestions: n     Verdict: PASS / PASS-WITH-WARNINGS / FAIL

🔴 <title>  (<file>:<line>)
   Problem: …   Why it matters: …   Fix: …
🟡 <title>  (<file>:<line>)
   Problem: …   Risk: …   Fix: …
🔵 <title> — current → better, because …
```
Verdict rule: any 🔴 → **FAIL** (fix and re-review). No 🔴 → **PASS** (log 🟡 to `DEBT.md`).

## D2 — Bug Fix Report
Emitted by the Bug Fix routine.

```
BUG FIX — fix/<name>   <date>   severity: <Critical/High/Medium/Low>
Bug:      <wrong behavior>  →  expected: <right behavior>
Repro:    <numbered steps>
Cause:    <one sentence>   (found at <file>:<line>)
Fix:      <what changed>   regression risk: <none/low/med + why>
Proof:    repro test ✅  full suite ✅  manual ✅
Prevent:  why-not-caught: <…>   new test: y/n   new guard/validation: y/n   same bug elsewhere: <where>/no
```

## D3 — Deploy Report
Emitted by the Pre-Deploy routine (pass *or* rollback).

```
DEPLOY — <version/tag>   <date>   target: <staging/production>
Gates:    all ✅ / failed at <gate>
Shipped:  <bulleted changes>
Env+DB:   vars ✅   migrations ✅/N-A   build ✅
Staging:  deployed ✅   smoke ✅   observed <n>min
Prod:     deployed ✅   post-check ✅   errors: none/<desc>   rollback: no / yes→<reason>
```
Rollback golden rules: know the previous-good version and the one command to restore it *before* deploying; destructive migration needs a written rollback + backup first; never deploy on a failing suite or right before you're unavailable.

## D4 — Project Health Milestones
Run a quick health pass periodically so debt doesn't compound silently.

- **Every ~5 features:** scope still accurate? `DEBT.md` anything urgent? unused deps? full review of the most-churned file; pay down high-priority debt.
- **Every ~10 features / monthly:** does the folder structure still fit (→ Refactor)? full `DEBT.md` review; dep updates + CVE check; indexes still match query patterns.
- **At a version cut:** review every touched area, pay down high-priority debt, tag the release, merge to `main`, open the next version's scope.

## D5 — Learning Mode *(optional — off by default; turn on by saying "learning mode on")*
For when the goal is to *understand*, not just ship. When on:

- **Explain before code:** WHAT we're building → WHY this way (and not the alternative) → HOW it works → a real-world ANALOGY → then the code.
- **Comment for a learner:** a plain-English line above each block saying what it does and why.
- **Understanding check** after each new concept (rotate): "explain it back in one sentence" · "predict the output of this input" · "spot the difference between these two versions" · "find the planted bug." Don't advance until it lands; if it misses, re-explain *differently*.
- **Guided discovery:** when something is hint-able, hint instead of answering — unless they've genuinely tried, it's too advanced to hint, or they say "just tell me."
- **Flag new terms** with 📚 and a one-line plain-English definition (optionally logged to a `GLOSSARY.md`).
- **Connect new → known:** "this is like <X> we built earlier; the difference is <Y>."
- Optional close-of-session log (`LEARNING.md`): what we built · concepts that clicked · concepts still fuzzy · what to explore next · confidence 1–10.

When off, default to concise expert-to-expert output.
