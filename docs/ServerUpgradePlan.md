# FitForce X — Server Architecture Upgrade Plan
## Bringing the New Server to Old Server Parity

> **Purpose:** Step-by-step guide to upgrade `d:\fitforce-x\server` to match the
> architectural quality of `d:\FitForceOld\fitforce-oldserver` across 10 dimensions.
>
> **Scope:** Structural improvements only. No new product features.
> Skipped features (PDF, push notifications, tickets, promo codes, client
> subscriptions, client attachments) are **not touched** — they do not block
> migration and this plan must not interfere with them.
>
> **Guiding rule:** Every phase ends with a working, deployable server.
> No phase breaks existing functionality.

---

## Quick Reference — Phase Map

| Phase | Title | Risk | Est. Time |
|---|---|---|---|
| 0 | Preparation & Branch Setup | None | 30 min |
| 1 | TypeScript Migration | Medium | 2–3 days |
| 2 | Data Access Layer — Prisma ORM | Medium | 2 days |
| 3 | Module Structure Refactor | Low | 1–2 days |
| 4 | Security Hardening | Medium | 1 day |
| 5 | File Storage — AWS S3 | High | 1 day |
| 6 | Real-Time — Socket.io | Low | 4–6 hours |
| 7 | Background Schedulers | Low | 4 hours |
| 8 | API Documentation — Swagger | None | 4 hours |
| 9 | Testing Foundation | Medium | 2 days |
| 10 | Observability Completion | None | 2 hours |

**Total estimated time: 10–14 working days**

---

## Dependency Order

Phases must run in order. Each phase depends on the previous:

```
Phase 0 (branch)
  └─ Phase 1 (TypeScript)  ← everything else requires types
       └─ Phase 2 (Prisma) ← typed queries before restructure
            └─ Phase 3 (Module structure) ← clean structure before the rest
                 ├─ Phase 4 (Security)
                 ├─ Phase 5 (S3)
                 ├─ Phase 6 (Socket.io)
                 ├─ Phase 7 (Schedulers)
                 ├─ Phase 8 (Swagger)
                 ├─ Phase 9 (Testing)
                 └─ Phase 10 (Observability)
```

Phases 4–10 are independent of each other and can run in any order after
Phase 3 is complete.

---

## Target Directory Structure

After all phases complete:

```
server/
├── src/
│   ├── config/
│   │   ├── env.ts              ← validated env variables (Phase 1)
│   │   └── swagger.ts          ← Swagger spec config (Phase 8)
│   ├── lib/
│   │   ├── prisma.ts           ← Prisma client singleton (Phase 2)
│   │   ├── s3.ts               ← S3 upload helpers (Phase 5)
│   │   ├── socket.ts           ← Socket.io instance (Phase 6)
│   │   ├── email.ts            ← email sending helpers (Phase 1 — move existing)
│   │   └── planEngine.ts       ← plan activation logic (Phase 1 — convert)
│   ├── middleware/
│   │   ├── auth.ts             ← JWT + session DB validation (Phase 4)
│   │   ├── clientAuth.ts
│   │   ├── adminAuth.ts
│   │   ├── requireOwner.ts
│   │   ├── requirePermission.ts
│   │   ├── rateLimit.ts
│   │   ├── scheduler.ts        ← Background job runner (Phase 7)
│   │   └── upload.ts           ← Multer-S3 upload (Phase 5)
│   ├── modules/
│   │   ├── auth/
│   │   │   ├── auth.routes.ts
│   │   │   ├── auth.controller.ts
│   │   │   └── auth.service.ts
│   │   ├── clients/
│   │   │   ├── clients.routes.ts
│   │   │   └── clients.controller.ts
│   │   ├── clientPortal/
│   │   │   ├── clientPortal.routes.ts
│   │   │   └── clientPortal.controller.ts
│   │   ├── messenger/
│   │   │   ├── messenger.routes.ts
│   │   │   └── messenger.controller.ts
│   │   ├── nutrition/
│   │   │   ├── nutrition.routes.ts
│   │   │   ├── nutrition.controller.ts
│   │   │   └── nutrition.service.ts
│   │   ├── training/
│   │   │   ├── training.routes.ts
│   │   │   ├── training.controller.ts
│   │   │   └── training.service.ts
│   │   ├── forms/
│   │   │   ├── forms.routes.ts
│   │   │   └── forms.controller.ts
│   │   ├── workspaces/
│   │   │   ├── workspaces.routes.ts
│   │   │   └── workspaces.controller.ts
│   │   ├── transactions/
│   │   │   ├── transactions.routes.ts
│   │   │   └── transactions.controller.ts
│   │   ├── billing/
│   │   │   ├── billing.routes.ts
│   │   │   └── billing.controller.ts
│   │   ├── packages/
│   │   │   ├── packages.routes.ts
│   │   │   └── packages.controller.ts
│   │   ├── invitations/
│   │   │   ├── invitations.routes.ts
│   │   │   └── invitations.controller.ts
│   │   ├── plans/
│   │   │   ├── plans.routes.ts
│   │   │   └── plans.controller.ts
│   │   ├── dashboard/
│   │   │   ├── dashboard.routes.ts
│   │   │   └── dashboard.controller.ts
│   │   ├── admin/
│   │   │   ├── admin.routes.ts
│   │   │   └── admin.controller.ts
│   │   └── paymentsWebhook/
│   │       ├── paymentsWebhook.routes.ts
│   │       └── paymentsWebhook.controller.ts
│   ├── types/
│   │   └── express.d.ts        ← typed Request extensions
│   ├── db.ts                   ← pg pool (kept for planEngine transactions)
│   └── app.ts                  ← Express app (no listen call)
├── prisma/
│   └── schema.prisma           ← generated from DB pull (Phase 2)
├── migrations/                 ← existing migration files (unchanged)
├── scripts/
│   └── migrateUploadsToS3.ts   ← one-time S3 migration (Phase 5)
├── tests/
│   ├── unit/
│   │   ├── planEngine.test.ts
│   │   └── auth.service.test.ts
│   ├── integration/
│   │   ├── auth.test.ts
│   │   ├── clients.test.ts
│   │   └── messenger.test.ts
│   └── helpers/
│       ├── testDb.ts
│       └── testServer.ts
├── server.ts                   ← HTTP + Socket.io entry point
├── tsconfig.json
├── jest.config.ts
└── package.json
```

---

---

# PHASE 0 — Preparation & Branch Setup

**Time estimate:** 30 minutes
**Risk:** None

---

### Step 0.1 — Confirm clean working state

```bash
cd d:\fitforce-x
git status
```

Expected: clean working tree. If not clean, commit or stash all changes before
continuing. Never start this plan on a dirty branch.

### Step 0.2 — Create the upgrade branch

```bash
git checkout dev
git pull origin dev
git checkout -b refactor/server-architecture-upgrade
```

### Step 0.3 — Record the baseline route inventory

Before touching any file, record the current line count of every route file.
This is the baseline you verify against after each phase.

```powershell
cd d:\fitforce-x\server
Get-ChildItem routes/*.js | Select-Object Name, @{N='Lines';E={(Get-Content $_.FullName).Count}}
```

Save this output. After every phase, re-run and confirm line counts changed
only in files you intended to touch.

### Step 0.4 — Verify the server starts clean

```bash
npm run dev
```

Hit `GET http://localhost:4000/api/health` — must return `{ "message": "All is good!" }`.
Stop the server. This is your smoke test for every phase.

---

---

# PHASE 1 — TypeScript Migration

**Time estimate:** 2–3 days
**Risk:** Medium — renaming files and adding types can surface hidden bugs
**Strategy:** Incremental. Use `allowJs: true` so TypeScript and JavaScript files
coexist while you convert one file at a time. Never convert everything at once.
Convert bottom-up: config → db → lib → middleware → modules → app → server.

---

### Step 1.1 — Install TypeScript dependencies

```bash
cd d:\fitforce-x\server
npm install --save-dev typescript ts-node tsconfig-paths @types/node @types/express @types/bcrypt @types/jsonwebtoken @types/cookie-parser @types/cors @types/pg @types/multer @types/nodemailer
```

### Step 1.2 — Create `tsconfig.json`

Create `d:\fitforce-x\server\tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": ".",
    "strict": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "resolveJsonModule": true,
    "allowJs": true,
    "checkJs": false,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["src/**/*", "server.ts"],
  "exclude": ["node_modules", "dist", "tests", "migrations", "scripts"]
}
```

> **Why `allowJs: true`:** TypeScript and JavaScript files can coexist.
> The server keeps running while you migrate file by file.

### Step 1.3 — Update `package.json` scripts

```json
{
  "scripts": {
    "dev":     "ts-node -r tsconfig-paths/register server.ts",
    "build":   "tsc --project tsconfig.json",
    "start":   "node dist/server.js",
    "migrate": "node scripts/migrate.js"
  }
}
```

### Step 1.4 — Create `src/config/env.ts`

Centralise all environment variable access in one validated file. Eliminates the
`process.env.ANYTHING` pattern scattered through every route handler — if a
required variable is missing the server fails at startup with a clear message,
not at runtime in a random request.

Create `d:\fitforce-x\server\src\config\env.ts`:

```typescript
function requireEnv(key: string): string {
    const val = process.env[key];
    if (!val) throw new Error(`Missing required environment variable: ${key}`);
    return val;
}

export const env = {
    NODE_ENV:        process.env.NODE_ENV ?? 'development',
    PORT:            parseInt(process.env.PORT ?? '4000', 10),
    JWT_SECRET:      requireEnv('JWT_SECRET'),
    DB_USER:         requireEnv('DB_USER'),
    DB_HOST:         requireEnv('DB_HOST'),
    DB_NAME:         requireEnv('DB_NAME'),
    DB_PASSWORD:     requireEnv('DB_PASSWORD'),
    DB_PORT:         parseInt(process.env.DB_PORT ?? '5432', 10),
    ALLOWED_ORIGINS: (process.env.ALLOWED_ORIGINS ?? 'http://localhost:3000').split(','),
    SENTRY_DSN:      process.env.SENTRY_DSN ?? '',
    EMAIL_HOST:      requireEnv('EMAIL_HOST'),
    EMAIL_PORT:      parseInt(process.env.EMAIL_PORT ?? '587', 10),
    EMAIL_USER:      requireEnv('EMAIL_USER'),
    EMAIL_PASS:      requireEnv('EMAIL_PASS'),
    EMAIL_FROM:      process.env.EMAIL_FROM ?? 'noreply@fitforce.io',
    AWS_REGION:      process.env.AWS_REGION ?? 'us-east-1',
    AWS_BUCKET:      process.env.AWS_BUCKET ?? '',
    AWS_ACCESS_KEY:  process.env.AWS_ACCESS_KEY_ID ?? '',
    AWS_SECRET_KEY:  process.env.AWS_SECRET_ACCESS_KEY ?? '',
    UPLOAD_MAX_MB:   parseInt(process.env.UPLOAD_MAX_MB ?? '20', 10),
} as const;
```

After creating this file, do a global search for `process.env.` across the server
and replace each occurrence with `env.VARIABLE_NAME` as you convert each file.

### Step 1.5 — Convert `db.js` → `src/db.ts`

Create `d:\fitforce-x\server\src\db.ts`:

```typescript
import { Pool, types } from 'pg';
import { env } from './config/env';

function parseTimestamp(val: string | null): string | null {
    if (!val) return null;
    const iso = val.replace(' ', 'T');
    const withZ = /[zZ]|[+-]\d{2}:?\d{2}$/.test(iso) ? iso : iso + 'Z';
    const d = new Date(withZ);
    return Number.isNaN(d.getTime()) ? val : d.toISOString();
}

types.setTypeParser(1114, parseTimestamp); // TIMESTAMP WITHOUT TIME ZONE
types.setTypeParser(1184, parseTimestamp); // TIMESTAMPTZ

const pool = new Pool({
    user:     env.DB_USER,
    host:     env.DB_HOST,
    database: env.DB_NAME,
    password: env.DB_PASSWORD,
    port:     env.DB_PORT,
});

export default pool;
```

Keep the old `db.js` until every file importing from it has been converted.
Delete `db.js` only in Step 1.13.

### Step 1.6 — Add typed Request extension

Create `d:\fitforce-x\server\src\types\express.d.ts`:

```typescript
declare global {
    namespace Express {
        interface Request {
            user?: {
                userId:      string;
                workspaceId: string;
                role:        string;
                permissions: Record<string, boolean> | null;
                isOwner:     boolean;
            };
            client?: {
                clientId:    string;
                workspaceId: string;
            };
        }
    }
}

export {};
```

This eliminates all `(req as any).user` casts throughout the codebase.

### Step 1.7 — Convert middleware files

Convert one file at a time. After each file, run the smoke test.

**Conversion order:**
1. `middleware/rateLimit.js` → `src/middleware/rateLimit.ts`
2. `middleware/auth.js` → `src/middleware/auth.ts`
3. `middleware/clientAuth.js` → `src/middleware/clientAuth.ts`
4. `middleware/adminAuth.js` → `src/middleware/adminAuth.ts`
5. `middleware/requireOwner.js` → `src/middleware/requireOwner.ts`
6. `middleware/requirePermission.js` → `src/middleware/requirePermission.ts`

The conversion pattern for every middleware file:

```typescript
// Before (JavaScript)
const jwt = require('jsonwebtoken');
function authMiddleware(req, res, next) { ... }
module.exports = authMiddleware;

// After (TypeScript)
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
    ...
}
```

### Step 1.8 — Convert `lib/` files

Convert in this order:
1. `lib/email.js` → `src/lib/email.ts`
2. `lib/planEngine.js` → `src/lib/planEngine.ts`

For `planEngine.ts`, add explicit parameter and return types to every exported
function. This is the highest-value typing work in the codebase — planEngine is
the most complex logic and currently has zero tests. Types will catch errors that
tests haven't caught yet.

```typescript
// Example typed signature in planEngine.ts
import { Pool, PoolClient } from 'pg';

export async function withTransaction<T>(
    pool: Pool,
    work: (client: PoolClient) => Promise<T>
): Promise<T> {
    const dbClient = await pool.connect();
    try {
        await dbClient.query('BEGIN');
        const result = await work(dbClient);
        await dbClient.query('COMMIT');
        return result;
    } catch (err) {
        await dbClient.query('ROLLBACK');
        throw err;
    } finally {
        dbClient.release();
    }
}
```

### Step 1.9 — Install and add Zod input validation

```bash
npm install zod
```

Create `d:\fitforce-x\server\src\lib\validate.ts`:

```typescript
import { ZodSchema } from 'zod';
import { Request, Response, NextFunction } from 'express';

export function validateBody<T>(schema: ZodSchema<T>) {
    return (req: Request, res: Response, next: NextFunction): void => {
        const result = schema.safeParse(req.body);
        if (!result.success) {
            res.status(400).json({
                error:   'Validation failed',
                details: result.error.flatten().fieldErrors,
            });
            return;
        }
        req.body = result.data;
        next();
    };
}
```

Add Zod schemas per module as you convert them. Start with the highest-risk
inputs: auth registration, login, message body, workout log submission.

```typescript
// src/modules/auth/auth.schemas.ts
import { z } from 'zod';

export const registerSchema = z.object({
    name:     z.string().min(2).max(100),
    email:    z.string().email(),
    password: z.string().min(8).max(128),
});

export const loginSchema = z.object({
    email:    z.string().email(),
    password: z.string().min(1),
});

export const resetPasswordSchema = z.object({
    token:    z.string().min(1),
    password: z.string().min(8).max(128),
});

export const sendMessageSchema = z.object({
    body: z.string().min(1).max(5000).transform(s => s.trim()),
});
```

### Step 1.10 — Convert route files to `src/modules/`

Convert one route file at a time. After each one, run the smoke test and
manually hit 2–3 endpoints from that module.

**Conversion order — smallest to largest to build confidence:**

| Order | Old file | New location | Lines |
|---|---|---|---|
| 1 | `routes/plans.js` | `src/modules/plans/index.ts` | 56 |
| 2 | `routes/dashboard.js` | `src/modules/dashboard/index.ts` | 61 |
| 3 | `routes/payment-methods.js` | `src/modules/paymentMethods/index.ts` | 97 |
| 4 | `routes/invitations.js` | `src/modules/invitations/index.ts` | 123 |
| 5 | `routes/payments-webhook.js` | `src/modules/paymentsWebhook/index.ts` | 148 |
| 6 | `routes/messenger.js` | `src/modules/messenger/index.ts` | 158 |
| 7 | `routes/packages.js` | `src/modules/packages/index.ts` | 176 |
| 8 | `routes/billing.js` | `src/modules/billing/index.ts` | 279 |
| 9 | `routes/transactions.js` | `src/modules/transactions/index.ts` | 437 |
| 10 | `routes/clients.js` | `src/modules/clients/index.ts` | 451 |
| 11 | `routes/forms.js` | `src/modules/forms/index.ts` | 518 |
| 12 | `routes/workspaces.js` | `src/modules/workspaces/index.ts` | 550 |
| 13 | `routes/clientPortal.js` | `src/modules/clientPortal/index.ts` | 696 |
| 14 | `routes/admin.js` | `src/modules/admin/index.ts` | 689 |
| 15 | `routes/auth.js` | `src/modules/auth/index.ts` | 601 |
| 16 | `routes/training.js` | `src/modules/training/index.ts` | 776 |
| 17 | `routes/nutrition.js` | `src/modules/nutrition/index.ts` | 1384 |

During Phase 1, each module lives as a single `index.ts` file. The controller/routes
split happens in Phase 3. Do not try to do both at once.

The minimum conversion for each file during Phase 1:
- `require()` → `import`
- `module.exports` → `export default router`
- Add `Request`, `Response`, `NextFunction` types to handlers
- Replace `process.env.X` with `env.X`
- Fix all TypeScript errors the compiler surfaces

### Step 1.11 — Add compression middleware

```bash
npm install compression
npm install --save-dev @types/compression
```

Add to the entry app file:
```typescript
import compression from 'compression';
app.use(compression());
```

### Step 1.12 — Convert `server.js` → `src/app.ts` + `server.ts`

Split the current `server.js` into two files:

**`src/app.ts`** — the Express application, no `listen` call:

```typescript
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import pinoHttp from 'pino-http';
import * as Sentry from '@sentry/node';
import { env } from './config/env';
import logger from './logger';
import { execSync } from 'child_process';

// Module routers
import authRouter from './modules/auth';
import dashboardRouter from './modules/dashboard';
import messengerRouter from './modules/messenger';
// ... all other routers

if (env.NODE_ENV !== 'test') {
    try {
        execSync('npm run migrate', { cwd: __dirname + '/..', stdio: 'inherit' });
    } catch (err: any) {
        console.error('Failed to run migrations:', err.message);
        process.exit(1);
    }
}

Sentry.init({
    dsn:         env.SENTRY_DSN,
    environment: env.NODE_ENV,
    enabled:     !!env.SENTRY_DSN,
});

const app = express();

app.set('trust proxy', 1);
app.use(helmet());
app.use(compression());
app.use(cors({
    origin:      (origin, cb) => {
        if (!origin || env.ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
        cb(new Error(`CORS: ${origin} not allowed`));
    },
    credentials: true,
}));

app.use('/api/payments/webhook', require('./modules/paymentsWebhook'));
app.use(express.json());
app.use(cookieParser());
app.use(pinoHttp({ logger }));

// Routes
app.use('/api/auth',            authRouter);
app.use('/api/dashboard',       dashboardRouter);
// ... all other routers

app.get('/api/health', (_req, res) => res.status(200).json({ message: 'All is good!' }));

app.use((err: any, req: any, res: any, next: any) => {
    const status = err.status ?? err.statusCode ?? 500;
    if (status >= 500) {
        req.log?.error({ err }, 'Unhandled server error');
        Sentry.captureException(err);
    }
    res.status(status).json({ error: err.message ?? 'Internal server error' });
});

export default app;
```

**`server.ts`** — the HTTP server entry point only:

```typescript
import app from './src/app';
import { env } from './src/config/env';

app.listen(env.PORT, '127.0.0.1', () => {
    console.log(`Server running on http://127.0.0.1:${env.PORT}`);
});
```

> Separating `app` from the HTTP listener is required for Phase 9 testing.
> Tests import `app` directly without binding to a port.

### Step 1.13 — Zero TypeScript errors check

```bash
npx tsc --noEmit
```

This must report zero errors before proceeding. Fix every error before moving on.

### Step 1.14 — Delete old JavaScript files

Only after `tsc --noEmit` is clean and the smoke test passes:

```powershell
Remove-Item server\routes -Recurse -Force
Remove-Item server\db.js
Remove-Item server\server.js
Remove-Item server\middleware -Recurse -Force
Remove-Item server\lib -Recurse -Force
```

### Step 1.15 — Commit

```bash
git add -A
git commit -m "refactor: migrate server from JavaScript to TypeScript"
```

---

---

# PHASE 2 — Data Access Layer — Prisma ORM

**Time estimate:** 2 days
**Risk:** Medium — all SQL queries are replaced. Requires careful verification.
**Strategy:** Pull the existing database schema into Prisma automatically using
`prisma db pull`. Then replace `pool.query()` calls with Prisma calls, one module
at a time. Keep raw `pool` available for `planEngine.ts` transactions — Prisma
interactive transactions can replace these in a future cleanup session.

---

### Step 2.1 — Install Prisma

```bash
npm install @prisma/client
npm install --save-dev prisma
```

### Step 2.2 — Initialise Prisma

```bash
npx prisma init --datasource-provider postgresql
```

This creates `prisma/schema.prisma`. Update `.env` with:

```
DATABASE_URL="postgresql://DB_USER:DB_PASSWORD@DB_HOST:DB_PORT/DB_NAME"
```

### Step 2.3 — Pull the existing schema from the database

```bash
npx prisma db pull
```

This introspects your live PostgreSQL database and generates `prisma/schema.prisma`
from the actual table definitions created by your 17 existing migration files.

After pulling, open `prisma/schema.prisma` and verify every table is represented:
`users`, `workspaces`, `workspace_members`, `clients`, `plans`, `packages`,
`forms`, `form_requests`, `food_items`, `food_categories`, `nutrition_plans`,
`training_plans`, `exercise_library`, `threads`, `messages`, `workout_logs`,
`client_observations`, `password_reset_tokens`, `transactions`,
`workspace_subscriptions`, `workspace_audit_log`.

### Step 2.4 — Customise the generated schema

The auto-generated schema uses raw DB column names. Add Prisma field names with
`@map` so your application code uses camelCase consistently:

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

model User {
  id                  String    @id
  name                String
  email               String    @unique
  passwordHash        String    @map("password_hash")
  emailVerified       Boolean   @default(false) @map("email_verified")
  preferredLanguage   String    @default("en") @map("preferred_language")
  defaultWorkspaceId  String?   @map("default_workspace_id")
  createdAt           DateTime  @default(now()) @map("created_at")
  updatedAt           DateTime  @updatedAt @map("updated_at")

  workspaces  Workspace[]       @relation("WorkspaceOwner")
  memberships WorkspaceMember[]
  sessions    UserSession[]
  resetTokens PasswordResetToken[]

  @@map("users")
}

model Workspace {
  id         String    @id
  name       String
  slug       String    @unique
  ownerId    String    @map("owner_id")
  archivedAt DateTime? @map("archived_at")
  createdAt  DateTime  @default(now()) @map("created_at")
  updatedAt  DateTime  @updatedAt @map("updated_at")

  owner   User              @relation("WorkspaceOwner", fields: [ownerId], references: [id])
  members WorkspaceMember[]
  clients Client[]
  threads Thread[]

  @@map("workspaces")
}

// Continue this pattern for all models.
// Use the column names from the existing migration files as the source of truth.
```

> Map every `snake_case` DB column to a `camelCase` Prisma field using `@map`.
> Add `@@map("table_name")` to every model. This keeps DB names and code names
> cleanly separated.

### Step 2.5 — Generate the Prisma Client

```bash
npx prisma generate
```

Re-run this command after every change to `schema.prisma`.

### Step 2.6 — Create the Prisma singleton

Create `d:\fitforce-x\server\src\lib\prisma.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { env } from '../config/env';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
    globalForPrisma.prisma ??
    new PrismaClient({
        log: env.NODE_ENV === 'development'
            ? ['query', 'warn', 'error']
            : ['warn', 'error'],
    });

if (env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prisma;
}
```

> The singleton pattern prevents multiple Prisma client instances in development
> when ts-node hot-reloads modules.

### Step 2.7 — Replace `pool.query` calls — module by module

Work through each module in the same order as Phase 1. For each module:

1. Import `prisma` from `../../lib/prisma`
2. Replace each `pool.query(SQL, params)` with the Prisma equivalent
3. Run the smoke test
4. Manually test the 2–3 most important endpoints in that module

**Pattern reference:**

```typescript
// Before — raw SQL find
const { rows } = await pool.query(
    `SELECT * FROM clients WHERE workspace_id = $1 AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [req.user.workspaceId]
);
res.json(rows);

// After — Prisma
const clients = await prisma.client.findMany({
    where:   { workspaceId: req.user!.workspaceId, deletedAt: null },
    orderBy: { createdAt: 'desc' },
});
res.json(clients);
```

```typescript
// Before — raw SQL insert
const { rows } = await pool.query(`
    INSERT INTO messages (id, thread_id, sender_type, sender_id, body, read_by_team_at)
    VALUES ($1, $2, 'team', $3, $4, NOW())
    RETURNING *
`, [createId(), threadId, userId, body]);

// After — Prisma
const message = await prisma.message.create({
    data: {
        id:           createId(),
        threadId,
        senderType:   'team',
        senderId:     userId,
        body,
        readByTeamAt: new Date(),
    },
});
```

```typescript
// Before — raw SQL update
await pool.query(
    `UPDATE threads SET updated_at = NOW() WHERE id = $1`,
    [threadId]
);

// After — Prisma
await prisma.thread.update({
    where: { id: threadId },
    data:  { updatedAt: new Date() },
});
```

**Keep raw pool for these specific cases:**

- `planEngine.ts` — uses `withTransaction(pool, ...)` with manual `BEGIN`/`COMMIT`/`ROLLBACK`.
  This is safe and working. Leave it alone during this phase.
- Complex `WITH` CTEs or recursive queries that are awkward in Prisma.
  Use `prisma.$queryRaw` for these:

  ```typescript
  const result = await prisma.$queryRaw<RowType[]>`
      WITH ranked AS (
          SELECT ..., ROW_NUMBER() OVER (PARTITION BY client_id ORDER BY created_at DESC) as rn
          FROM nutrition_plans WHERE workspace_id = ${workspaceId}
      )
      SELECT * FROM ranked WHERE rn = 1
  `;
  ```

### Step 2.8 — Add Prisma to shutdown handler

In `src/app.ts`:

```typescript
import { prisma } from './lib/prisma';

process.on('SIGINT',  async () => { await prisma.$disconnect(); process.exit(0); });
process.on('SIGTERM', async () => { await prisma.$disconnect(); process.exit(0); });
```

### Step 2.9 — Commit

```bash
git add -A
git commit -m "refactor: replace raw pool.query with Prisma ORM across all modules"
```

---

---

# PHASE 3 — Module Structure Refactor

**Time estimate:** 1–2 days
**Risk:** Low — no logic changes, only file organisation
**Goal:** Split each `src/modules/xxx/index.ts` into `routes.ts` + `controller.ts`,
matching the old server's domain module pattern. Three large modules also get a
`service.ts` for extracted business logic.

---

### Step 3.1 — The split rule

**Routes file** (`xxx.routes.ts`) contains only:
- `express.Router()` declaration
- Route registrations: `router.get(path, ...middleware, controller.handler)`
- Auth middleware application
- Zod `validateBody` middleware
- Import from controller

**Controller file** (`xxx.controller.ts`) contains only:
- The async handler functions
- Prisma DB calls
- Business logic
- Response shaping (`res.json(...)`, `res.status(...).json(...)`)

The route file calls the controller. The controller does the work. Nothing else.

### Step 3.2 — Split pattern — messenger module example

**`src/modules/messenger/messenger.routes.ts`:**

```typescript
import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import { validateBody } from '../../lib/validate';
import { sendMessageSchema } from './messenger.schemas';
import * as messenger from './messenger.controller';

const router = Router();
router.use(authMiddleware);

router.get('/threads',                         messenger.getThreads);
router.post('/threads',                        messenger.createThread);
router.get('/threads/:threadId/messages',      messenger.getMessages);
router.post('/threads/:threadId/messages',     validateBody(sendMessageSchema), messenger.sendMessage);
router.patch('/threads/:threadId/status',      messenger.updateThreadStatus);

export default router;
```

**`src/modules/messenger/messenger.controller.ts`:**

```typescript
import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../../lib/prisma';

export async function getThreads(req: Request, res: Response, next: NextFunction) {
    try {
        const threads = await prisma.thread.findMany({
            where: { workspaceId: req.user!.workspaceId },
            include: {
                client: { select: { fname: true, lname: true } },
                messages: { orderBy: { createdAt: 'desc' }, take: 1 },
            },
            orderBy: { updatedAt: 'desc' },
        });
        res.json(threads);
    } catch (err) {
        next(err);
    }
}

export async function sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
        const threadCheck = await prisma.thread.findFirst({
            where: { id: req.params.threadId, workspaceId: req.user!.workspaceId },
        });
        if (!threadCheck) return res.status(404).json({ error: 'Thread not found' });

        const message = await prisma.message.create({
            data: {
                id:           createId(),
                threadId:     req.params.threadId,
                senderType:   'team',
                senderId:     req.user!.userId,
                body:         req.body.body,
                readByTeamAt: new Date(),
            },
        });
        await prisma.thread.update({
            where: { id: req.params.threadId },
            data:  { updatedAt: new Date() },
        });
        res.status(201).json(message);
    } catch (err) {
        next(err);
    }
}

// ... other handlers
```

### Step 3.3 — Split order

Split in the same order as Phase 1 (smallest first). After each split:
- `npx tsc --noEmit` — zero errors
- Smoke test — server starts
- Hit the 2 most important endpoints for that module

### Step 3.4 — Modules that require a service layer

Three modules are large enough to need a third file:

**`auth.service.ts`** — JWT building, cookie options, slug normalisation, email
sending helpers, `buildToken` and `buildTokenForWorkspace`. These are helpers
shared by multiple auth controller functions.

**`nutrition.service.ts`** — Plan serialisation (the large `serializePlanRow`/
`serializePlanRows` logic), plan tree building, food replacement processing.
`nutrition.controller.ts` will still be large — the service removes the
data transformation layer from it.

**`training.service.ts`** — Exercise plan serialisation and plan tree
manipulation (days, exercises, ordering logic).

### Step 3.5 — Update `src/app.ts` router imports

After all modules are split, update `app.ts` to import from the routes files:

```typescript
import authRouter       from './modules/auth/auth.routes';
import clientsRouter    from './modules/clients/clients.routes';
import messengerRouter  from './modules/messenger/messenger.routes';
import nutritionRouter  from './modules/nutrition/nutrition.routes';
// ... and so on
```

### Step 3.6 — Commit

```bash
git add -A
git commit -m "refactor: split flat module files into controller/routes structure"
```

---

---

# PHASE 4 — Security Hardening

**Time estimate:** 1 day
**Risk:** Medium — auth middleware change affects every protected route.
Test thoroughly after each step.

---

### Step 4.1 — JWT session table (token revocation)

This is the most critical security gap in the new server. A stolen JWT is valid
for 7 days with no way to invalidate it. The fix: store a hash of every issued
token and validate it against the database on every request.

**Create migration `018_user_sessions.js`:**

```javascript
// server/migrations/018_user_sessions.js
exports.up = async (pool) => {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS user_sessions (
            id          TEXT PRIMARY KEY,
            user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            token_hash  TEXT NOT NULL UNIQUE,
            expires_at  TIMESTAMPTZ NOT NULL,
            created_at  TIMESTAMPTZ DEFAULT NOW(),
            revoked_at  TIMESTAMPTZ
        );
        CREATE INDEX idx_user_sessions_user_id   ON user_sessions(user_id);
        CREATE INDEX idx_user_sessions_token_hash ON user_sessions(token_hash);
    `);
};

exports.down = async (pool) => {
    await pool.query('DROP TABLE IF EXISTS user_sessions');
};
```

**Update `prisma/schema.prisma`** to add the `UserSession` model, then run
`npx prisma generate`.

**Update `src/middleware/auth.ts`** to validate every request against the DB:

```typescript
import crypto from 'crypto';
import jwt, { JwtPayload } from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma';
import { env } from '../config/env';

function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export async function authMiddleware(
    req: Request, res: Response, next: NextFunction
): Promise<void> {
    const token = req.cookies.token;
    if (!token) {
        res.status(401).json({ message: 'Not authenticated' });
        return;
    }
    try {
        const decoded = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
        const session = await prisma.userSession.findUnique({
            where: { tokenHash: hashToken(token) },
        });
        if (!session || session.revokedAt || session.expiresAt < new Date()) {
            res.status(401).json({ message: 'Session expired or revoked' });
            return;
        }
        req.user = {
            userId:      decoded.userId,
            workspaceId: decoded.workspaceId,
            role:        decoded.role,
            permissions: decoded.permissions ?? null,
            isOwner:     decoded.role === 'owner',
        };
        next();
    } catch {
        res.status(401).json({ message: 'Invalid token' });
    }
}
```

**Update `src/modules/auth/auth.service.ts`** to create and revoke sessions:

```typescript
import crypto from 'crypto';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../../lib/prisma';

function hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
}

export async function createSession(userId: string, token: string): Promise<void> {
    await prisma.userSession.create({
        data: {
            id:        createId(),
            userId,
            tokenHash: hashToken(token),
            expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
    });
}

export async function revokeSession(token: string): Promise<void> {
    await prisma.userSession.updateMany({
        where: { tokenHash: hashToken(token) },
        data:  { revokedAt: new Date() },
    });
}
```

Call `createSession(userId, token)` inside the login and register handlers
immediately after the JWT is signed.

**Add logout endpoint** to `auth.controller.ts`:

```typescript
export async function logout(req: Request, res: Response, next: NextFunction) {
    try {
        const token = req.cookies.token;
        if (token) await revokeSession(token);
        res.clearCookie('token');
        res.status(200).json({ message: 'Logged out' });
    } catch (err) {
        next(err);
    }
}
```

Register in `auth.routes.ts`:
```typescript
router.post('/logout', authMiddleware, auth.logout);
```

### Step 4.2 — Upgrade Helmet with full CSP

Replace the bare `helmet()` call in `src/app.ts`:

```typescript
app.use(helmet({
    frameguard: false,
    contentSecurityPolicy: {
        directives: {
            defaultSrc:     ["'self'"],
            scriptSrc:      ["'self'", "'unsafe-inline'"],
            styleSrc:       ["'self'", "'unsafe-inline'"],
            imgSrc:         ["'self'", "data:", "https:"],
            connectSrc:     ["'self'", "https://api.fitforce.io", "https://*.fitforce.io"],
            fontSrc:        ["'self'", "https:", "data:"],
            objectSrc:      ["'none'"],
            mediaSrc:       ["'self'"],
            frameSrc:       ["'self'"],
            frameAncestors: ["'self'", "https://fitforceapp.com", "https://*.fitforceapp.com"],
        },
    },
    hsts: {
        maxAge:            31536000,
        includeSubDomains: true,
        preload:           true,
    },
}));
```

### Step 4.3 — Admin subdomain isolation

The old server protected admin routes by requiring a management subdomain,
so the admin API is not reachable from the main app domain. Add this to
`src/middleware/adminAuth.ts`:

```typescript
import { Request, Response, NextFunction } from 'express';

export function requireAdminSubdomain(
    req: Request, res: Response, next: NextFunction
): void {
    if (process.env.NODE_ENV !== 'production') {
        // Dev: skip subdomain check — admin subdomain routing is not available locally
        return next();
    }
    const subdomain = req.hostname?.split('.')[0] ?? '';
    if (!['admin', 'management'].includes(subdomain)) {
        res.status(403).json({ error: 'Admin access not permitted from this domain' });
        return;
    }
    next();
}
```

Apply to the admin router in `src/app.ts`:

```typescript
import { requireAdminSubdomain } from './middleware/adminAuth';
app.use('/api/admin', requireAdminSubdomain, adminRouter);
```

### Step 4.4 — Commit

```bash
git add -A
git commit -m "feat: add JWT session table, CSP headers, logout endpoint, admin subdomain isolation"
```

---

---

# PHASE 5 — File Storage — AWS S3

**Time estimate:** 1 day
**Risk:** High — all upload and file-serving paths change.

This is a deployment-critical fix. Local disk storage (`server/uploads/`) is
wiped on every cloud redeploy. Every exercise video, thumbnail, and coach-uploaded
file disappears the moment you deploy to Railway, Render, Fly.io, or any container
platform. This must be resolved before going live.

---

### Step 5.1 — Install dependencies

```bash
npm install @aws-sdk/client-s3 @aws-sdk/lib-storage multer-s3
npm install --save-dev @types/multer-s3
```

### Step 5.2 — Add S3 variables to `.env`

```
AWS_REGION=eu-central-1
AWS_BUCKET=fitforce-uploads
AWS_ACCESS_KEY_ID=your_key
AWS_SECRET_ACCESS_KEY=your_secret
```

> **Cloudflare R2 alternative:** R2 is S3-compatible with no egress fees.
> To use R2, add one line to the S3 client config:
> `endpoint: 'https://<ACCOUNT_ID>.r2.cloudflarestorage.com'`
> Everything else in this phase is identical.

### Step 5.3 — Create `src/lib/s3.ts`

```typescript
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { env } from '../config/env';

export const s3 = new S3Client({
    region:      env.AWS_REGION,
    credentials: {
        accessKeyId:     env.AWS_ACCESS_KEY,
        secretAccessKey: env.AWS_SECRET_KEY,
    },
});

export const S3_BUCKET = env.AWS_BUCKET;

export async function deleteFromS3(key: string): Promise<void> {
    await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
}

export function s3PublicUrl(key: string): string {
    return `https://${S3_BUCKET}.s3.${env.AWS_REGION}.amazonaws.com/${key}`;
}
```

### Step 5.4 — Create `src/middleware/upload.ts`

```typescript
import multer from 'multer';
import multerS3 from 'multer-s3';
import path from 'path';
import { createId } from '@paralleldrive/cuid2';
import { s3, S3_BUCKET } from '../lib/s3';
import { env } from '../config/env';

const MAX_BYTES = env.UPLOAD_MAX_MB * 1024 * 1024;

function resolveStorage(folder: string): multer.StorageEngine {
    // Fallback to local disk when AWS_BUCKET is not configured (development)
    if (!env.AWS_BUCKET) {
        return multer.diskStorage({
            destination: `uploads/${folder}`,
            filename:    (_req, file, cb) =>
                cb(null, `${createId()}${path.extname(file.originalname)}`),
        });
    }
    return multerS3({
        s3,
        bucket:      S3_BUCKET,
        acl:         'public-read',
        contentType: multerS3.AUTO_CONTENT_TYPE,
        key:         (_req, file, cb) =>
            cb(null, `${folder}/${createId()}${path.extname(file.originalname)}`),
    });
}

export const uploadExerciseVideo = multer({
    storage: resolveStorage('exercises/videos'),
    limits:  { fileSize: MAX_BYTES },
});

export const uploadExerciseThumbnail = multer({
    storage: resolveStorage('exercises/thumbnails'),
    limits:  { fileSize: 5 * 1024 * 1024 },
});

export const uploadAvatar = multer({
    storage: resolveStorage('avatars'),
    limits:  { fileSize: 5 * 1024 * 1024 },
});

export const uploadWorkspaceLogo = multer({
    storage: resolveStorage('workspace-logos'),
    limits:  { fileSize: 5 * 1024 * 1024 },
});
```

### Step 5.5 — Update all routes that handle file uploads

Find every `multer` usage in `training` and `clientPortal` controllers and
replace the old disk upload with the new S3-backed upload middleware.

The S3 `req.file` object has `location` instead of `path`:

```typescript
// Before
const fileUrl = `/uploads/exercises/${req.file.filename}`;

// After
const fileUrl = (req.file as Express.MulterS3.File).location;
```

### Step 5.6 — Remove static file serving from Express

In `src/app.ts`, delete this line:

```typescript
// DELETE — S3 serves files directly via CDN URL
app.use('/uploads', express.static('uploads'));
```

### Step 5.7 — One-time migration script for existing uploads

Create `d:\fitforce-x\server\scripts\migrateUploadsToS3.ts`:

```typescript
import fs from 'fs';
import path from 'path';
import { Upload } from '@aws-sdk/lib-storage';
import { s3, S3_BUCKET } from '../src/lib/s3';

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');

async function uploadFile(localPath: string, s3Key: string): Promise<string> {
    const stream = fs.createReadStream(localPath);
    const upload = new Upload({
        client: s3,
        params: { Bucket: S3_BUCKET, Key: s3Key, Body: stream, ACL: 'public-read' },
    });
    await upload.done();
    return `https://${S3_BUCKET}.s3.amazonaws.com/${s3Key}`;
}

async function walk(dir: string, prefix: string): Promise<void> {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);
        const s3Key   = `${prefix}/${entry.name}`;
        if (entry.isDirectory()) await walk(fullPath, s3Key);
        else {
            const url = await uploadFile(fullPath, s3Key);
            console.log(`Uploaded: ${s3Key} → ${url}`);
        }
    }
}

walk(UPLOADS_DIR, 'legacy').catch(console.error);
```

Run this once against the production server before switching to S3 in production.
It uploads all locally stored files to S3 under the `legacy/` prefix, preserving
file names so existing DB URLs can be updated if needed.

### Step 5.8 — Commit

```bash
git add -A
git commit -m "feat: replace local disk uploads with AWS S3 storage"
```

---

---

# PHASE 6 — Real-Time — Socket.io

**Time estimate:** 4–6 hours
**Risk:** Low — additive. HTTP routes continue to work regardless of Socket.io state.
**Scope:** Real-time message delivery for the existing messenger module.
Plan assignment notifications for the client portal.

---

### Step 6.1 — Install Socket.io

```bash
npm install socket.io
npm install --save-dev @types/socket.io
```

### Step 6.2 — Create `src/lib/socket.ts`

```typescript
import { Server as SocketServer, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';

let io: SocketServer;

export function initSocket(httpServer: HttpServer): SocketServer {
    io = new SocketServer(httpServer, {
        cors: { origin: env.ALLOWED_ORIGINS, credentials: true },
    });

    // Auth handshake — client reads the httpOnly cookie from handshake headers
    io.use((socket, next) => {
        const cookieHeader = socket.handshake.headers?.cookie ?? '';
        const token = cookieHeader
            .split(';')
            .map(c => c.trim())
            .find(c => c.startsWith('token='))
            ?.split('=')[1];

        if (!token) return next(new Error('Not authenticated'));

        try {
            const decoded = jwt.verify(token, env.JWT_SECRET) as any;
            socket.data.userId      = decoded.userId;
            socket.data.workspaceId = decoded.workspaceId;
            socket.data.clientId    = decoded.clientId ?? null;
            next();
        } catch {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', (socket: Socket) => {
        const { userId, workspaceId, clientId } = socket.data;

        // Coach users join their workspace room
        if (workspaceId) socket.join(`workspace:${workspaceId}`);
        // Client portal users join their own private room
        if (clientId)    socket.join(`client:${clientId}`);
        // All users join a personal room (for direct notifications)
        if (userId)      socket.join(`user:${userId}`);
    });

    return io;
}

export function getIo(): SocketServer {
    if (!io) throw new Error('Socket.io not initialised — call initSocket() first');
    return io;
}
```

### Step 6.3 — Update `server.ts` to use a raw HTTP server

Socket.io must attach to a Node `http.Server`, not the Express app directly:

```typescript
import http from 'http';
import app from './src/app';
import { initSocket } from './src/lib/socket';
import { env } from './src/config/env';

const httpServer = http.createServer(app);
initSocket(httpServer);

httpServer.listen(env.PORT, '127.0.0.1', () => {
    console.log(`Server running on http://127.0.0.1:${env.PORT}`);
});
```

### Step 6.4 — Emit from messenger controller after message insert

In `src/modules/messenger/messenger.controller.ts`:

```typescript
import { getIo } from '../../lib/socket';

export async function sendMessage(req: Request, res: Response, next: NextFunction) {
    try {
        // ... thread validation and message creation ...

        // Broadcast to all connected workspace members
        getIo()
            .to(`workspace:${req.user!.workspaceId}`)
            .emit('new_message', { threadId: req.params.threadId, message });

        res.status(201).json(message);
    } catch (err) {
        next(err);
    }
}
```

### Step 6.5 — Emit from client portal controller after client sends a message

In `src/modules/clientPortal/clientPortal.controller.ts`:

```typescript
import { getIo } from '../../lib/socket';

// After inserting the client's message:
getIo()
    .to(`workspace:${req.client!.workspaceId}`)
    .emit('new_message', { threadId, message, fromClient: true });
```

### Step 6.6 — Emit on plan assignment

When a coach activates a nutrition or training plan, notify the client's
portal in real time so it refreshes without polling:

```typescript
// In nutrition.controller.ts — after plan activation
getIo()
    .to(`client:${clientId}`)
    .emit('plan_assigned', {
        type:    'nutrition',
        planId:  plan.id,
    });
```

Apply the same pattern in `training.controller.ts` after workout plan activation.

### Step 6.7 — Commit

```bash
git add -A
git commit -m "feat: add Socket.io real-time messaging and plan assignment events"
```

---

---

# PHASE 7 — Background Schedulers

**Time estimate:** 4 hours
**Risk:** Low — schedulers run on an independent cron loop and do not touch
the HTTP request path.

---

### Step 7.1 — Install node-cron

```bash
npm install node-cron
npm install --save-dev @types/node-cron
```

### Step 7.2 — Create `src/middleware/scheduler.ts`

```typescript
import cron from 'node-cron';
import { prisma } from '../lib/prisma';

/**
 * Dispatches forms to clients whose scheduled dispatch time has passed.
 * Runs every hour.
 */
export function scheduleFormDispatcher(): void {
    cron.schedule('0 * * * *', async () => {
        try {
            const pending = await prisma.formRequest.findMany({
                where: {
                    dispatchAt:  { lte: new Date() },
                    dispatchedAt: null,
                    status:      'pending',
                },
            });
            for (const form of pending) {
                await prisma.formRequest.update({
                    where: { id: form.id },
                    data:  { dispatchedAt: new Date(), status: 'sent' },
                });
            }
            if (pending.length > 0) {
                console.info(`[Scheduler] Dispatched ${pending.length} form(s)`);
            }
        } catch (err) {
            console.error('[Scheduler] Form dispatcher error:', err);
        }
    });
}

/**
 * Marks workspace subscriptions as expired when their end date has passed.
 * Runs daily at midnight.
 */
export function scheduleSubscriptionExpiry(): void {
    cron.schedule('0 0 * * *', async () => {
        try {
            const { count } = await prisma.workspaceSubscription.updateMany({
                where: { status: 'active', endsAt: { lt: new Date() } },
                data:  { status: 'expired' },
            });
            if (count > 0) {
                console.info(`[Scheduler] Expired ${count} subscription(s)`);
            }
        } catch (err) {
            console.error('[Scheduler] Subscription expiry error:', err);
        }
    });
}

/**
 * Deletes revoked and expired user sessions older than 30 days.
 * Runs daily at 2 AM.
 */
export function scheduleSessionCleanup(): void {
    cron.schedule('0 2 * * *', async () => {
        try {
            const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
            const { count } = await prisma.userSession.deleteMany({
                where: {
                    OR: [
                        { revokedAt: { lt: cutoff } },
                        { expiresAt: { lt: cutoff } },
                    ],
                },
            });
            if (count > 0) {
                console.info(`[Scheduler] Cleaned up ${count} expired session(s)`);
            }
        } catch (err) {
            console.error('[Scheduler] Session cleanup error:', err);
        }
    });
}
```

### Step 7.3 — Register schedulers in `src/app.ts`

```typescript
import {
    scheduleFormDispatcher,
    scheduleSubscriptionExpiry,
    scheduleSessionCleanup,
} from './middleware/scheduler';

// Skip in test environment to avoid cron interference during tests
if (env.NODE_ENV !== 'test') {
    scheduleFormDispatcher();
    scheduleSubscriptionExpiry();
    scheduleSessionCleanup();
}
```

### Step 7.4 — Commit

```bash
git add -A
git commit -m "feat: add background schedulers for form dispatch, subscription expiry, session cleanup"
```

---

---

# PHASE 8 — API Documentation — Swagger

**Time estimate:** 4 hours
**Risk:** None — additive only, zero changes to existing code

---

### Step 8.1 — Install dependencies

```bash
npm install swagger-jsdoc swagger-ui-express
npm install --save-dev @types/swagger-jsdoc @types/swagger-ui-express
```

### Step 8.2 — Create `src/config/swagger.ts`

```typescript
import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title:       'FitForce X API',
            version:     '1.0.0',
            description: 'Coach-client fitness management SaaS platform',
        },
        servers: [
            { url: 'http://localhost:4000/api', description: 'Development' },
            { url: 'https://api.fitforce.io/api', description: 'Production' },
        ],
        components: {
            securitySchemes: {
                cookieAuth: {
                    type: 'apiKey',
                    in:   'cookie',
                    name: 'token',
                },
            },
        },
        security: [{ cookieAuth: [] }],
    },
    apis: ['./src/modules/**/*.routes.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
```

### Step 8.3 — Add Swagger UI endpoint to `src/app.ts`

```typescript
import swaggerUi from 'swagger-ui-express';
import { swaggerSpec } from './config/swagger';

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
```

### Step 8.4 — Add JSDoc annotations to route files

Add `@openapi` annotations to every route. Prioritise the modules that are
called most frequently or are most likely to be consumed by an external client.

**Priority order:**
1. `auth.routes.ts` — registration, login, logout, reset password
2. `clients.routes.ts` — client CRUD
3. `messenger.routes.ts` — threads and messages
4. `clientPortal.routes.ts` — portal endpoints
5. All remaining modules

Example annotation:

```typescript
/**
 * @openapi
 * /messenger/threads:
 *   get:
 *     summary: List all message threads for the workspace
 *     tags: [Messenger]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of threads with latest message and unread count
 *       401:
 *         description: Not authenticated
 *
 * /messenger/threads/{threadId}/messages:
 *   post:
 *     summary: Send a message to a thread
 *     tags: [Messenger]
 *     parameters:
 *       - in: path
 *         name: threadId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [body]
 *             properties:
 *               body:
 *                 type: string
 *                 maxLength: 5000
 *     responses:
 *       201:
 *         description: Message created
 *       400:
 *         description: Validation error
 *       404:
 *         description: Thread not found
 */
```

Add shared component schemas for the most commonly returned objects
(`Thread`, `Message`, `Client`, `NutritionPlan`, `WorkoutPlan`) directly in
`src/config/swagger.ts` under `components.schemas`.

### Step 8.5 — Commit

```bash
git add -A
git commit -m "docs: add Swagger OpenAPI 3.0 documentation for all API routes"
```

---

---

# PHASE 9 — Testing Foundation

**Time estimate:** 2 days
**Risk:** Medium — test setup requires DB isolation. Wrong setup creates
false-positive test results.

**Priority order:**
1. `planEngine.ts` — 426 lines of core business logic, zero tests (DEBT.md item)
2. `auth.service.ts` — JWT, session, cookie helpers
3. Integration tests for the 3 P1 flows marked "built, needs verify" in MigrationGapAnalysis.md

---

### Step 9.1 — Install testing dependencies

```bash
npm install --save-dev jest ts-jest @types/jest supertest @types/supertest
```

### Step 9.2 — Create `jest.config.ts`

```typescript
import type { Config } from 'jest';

const config: Config = {
    preset:                    'ts-jest',
    testEnvironment:           'node',
    rootDir:                   '.',
    testMatch:                 ['**/tests/**/*.test.ts'],
    setupFilesAfterFramework:  ['./tests/helpers/setup.ts'],
    collectCoverageFrom: [
        'src/**/*.ts',
        '!src/config/**',
        '!src/**/*.d.ts',
    ],
    coverageThresholds: {
        global: { lines: 70, functions: 70, branches: 60 },
    },
};

export default config;
```

### Step 9.3 — Create test database helper

Add to `.env` (create `.env.test` for test overrides):

```
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fitforce_test
NODE_ENV=test
JWT_SECRET=test_jwt_secret_32chars_minimum_x
```

Create `d:\fitforce-x\server\tests\helpers\testDb.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

export const testPrisma = new PrismaClient({
    datasources: { db: { url: process.env.TEST_DATABASE_URL } },
});

export async function resetTestDb(): Promise<void> {
    // Truncate in reverse dependency order to respect foreign keys
    await testPrisma.$executeRawUnsafe(`
        TRUNCATE TABLE
            messages, threads,
            workout_logs, form_requests, forms,
            client_observations, clients,
            workspace_members, workspace_subscriptions,
            workspaces, user_sessions,
            password_reset_tokens, users
        RESTART IDENTITY CASCADE
    `);
}

export async function closeTestDb(): Promise<void> {
    await testPrisma.$disconnect();
}
```

Create `d:\fitforce-x\server\tests\helpers\setup.ts`:

```typescript
import { resetTestDb, closeTestDb } from './testDb';

beforeEach(async () => { await resetTestDb(); });
afterAll(async ()  => { await closeTestDb(); });
```

### Step 9.4 — Create `testServer.ts` helper

```typescript
// tests/helpers/testServer.ts
import supertest from 'supertest';
import app from '../../src/app';
import { testPrisma } from './testDb';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { createId } from '@paralleldrive/cuid2';

export const request = supertest(app);

export async function createTestUser(overrides: Record<string, any> = {}) {
    return testPrisma.user.create({
        data: {
            id:            createId(),
            name:          'Test Coach',
            email:         `coach-${createId()}@test.com`,
            passwordHash:  await bcrypt.hash('password123', 10),
            emailVerified: true,
            ...overrides,
        },
    });
}

export async function createTestWorkspace(ownerId: string) {
    return testPrisma.workspace.create({
        data: { id: createId(), name: 'Test Workspace', slug: `ws-${createId()}`, ownerId },
    });
}

export function makeAuthCookie(userId: string, workspaceId: string, role = 'owner'): string {
    const token = jwt.sign(
        { userId, workspaceId, role, permissions: null },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' }
    );
    return `token=${token}`;
}
```

### Step 9.5 — Write `planEngine` unit tests (highest priority)

Create `d:\fitforce-x\server\tests\unit\planEngine.test.ts`:

```typescript
import {
    normalizeOrderedList,
    serializePlanRow,
    serializePlanRows,
    withTransaction,
} from '../../src/lib/planEngine';
import { Pool } from 'pg';
import { getTestPool } from '../helpers/testDb';

describe('normalizeOrderedList', () => {
    test('assigns order key starting at 1', () => {
        const result = normalizeOrderedList(
            [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
            'order_index'
        );
        expect(result.map(r => r.order_index)).toEqual([1, 2, 3]);
    });

    test('returns empty array for null input', () => {
        expect(normalizeOrderedList(null as any, 'order')).toEqual([]);
    });

    test('returns empty array for empty input', () => {
        expect(normalizeOrderedList([], 'order')).toEqual([]);
    });

    test('does not mutate the original array', () => {
        const items = [{ name: 'A' }];
        normalizeOrderedList(items, 'order_index');
        expect((items[0] as any).order_index).toBeUndefined();
    });
});

describe('serializePlanRow', () => {
    test('converts Date to ISO string', () => {
        const row = {
            id:         'abc',
            created_at: new Date('2026-01-15T10:00:00.000Z'),
            updated_at: new Date('2026-01-16T10:00:00.000Z'),
        };
        const result = serializePlanRow(row);
        expect(result.created_at).toBe('2026-01-15T10:00:00.000Z');
        expect(result.updated_at).toBe('2026-01-16T10:00:00.000Z');
    });

    test('returns null for null input', () => {
        expect(serializePlanRow(null)).toBeNull();
    });

    test('handles null date fields', () => {
        const row = { id: '1', created_at: null, updated_at: null };
        const result = serializePlanRow(row);
        expect(result.created_at).toBeNull();
    });

    test('handles invalid date strings gracefully', () => {
        const row = { id: '1', created_at: 'not-a-date', updated_at: null };
        const result = serializePlanRow(row);
        expect(result.created_at).toBeNull();
    });
});

describe('serializePlanRows', () => {
    test('maps all rows', () => {
        const rows = [
            { id: '1', created_at: new Date('2026-01-01'), updated_at: null },
            { id: '2', created_at: new Date('2026-01-02'), updated_at: null },
        ];
        const result = serializePlanRows(rows);
        expect(result).toHaveLength(2);
        expect(result[0].created_at).toBe('2026-01-01T00:00:00.000Z');
    });

    test('returns empty array for null', () => {
        expect(serializePlanRows(null as any)).toEqual([]);
    });
});

describe('withTransaction', () => {
    let pool: Pool;

    beforeAll(() => { pool = getTestPool(); });

    test('commits on success and returns value', async () => {
        const result = await withTransaction(pool, async (_client) => 'committed');
        expect(result).toBe('committed');
    });

    test('rolls back on thrown error', async () => {
        await expect(
            withTransaction(pool, async () => { throw new Error('fail'); })
        ).rejects.toThrow('fail');
    });
});
```

### Step 9.6 — Write `auth.service` unit tests

Create `d:\fitforce-x\server\tests\unit\auth.service.test.ts`:

```typescript
import { normalizeSlug, cookieOptions } from '../../src/modules/auth/auth.service';

describe('normalizeSlug', () => {
    test('lowercases and replaces spaces with hyphens', () => {
        expect(normalizeSlug('My Workspace')).toBe('my-workspace');
    });

    test('strips leading and trailing hyphens', () => {
        expect(normalizeSlug('--test--')).toBe('test');
    });

    test('collapses multiple special characters into one hyphen', () => {
        expect(normalizeSlug('hello   world!!!')).toBe('hello-world');
    });

    test('handles numeric input', () => {
        expect(normalizeSlug('Coach123')).toBe('coach123');
    });
});

describe('cookieOptions', () => {
    test('is always httpOnly', () => {
        expect(cookieOptions().httpOnly).toBe(true);
    });

    test('secure is true in production', () => {
        const original = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';
        expect(cookieOptions().secure).toBe(true);
        process.env.NODE_ENV = original;
    });

    test('secure is false in development', () => {
        const original = process.env.NODE_ENV;
        process.env.NODE_ENV = 'development';
        expect(cookieOptions().secure).toBe(false);
        process.env.NODE_ENV = original;
    });

    test('expires in 7 days', () => {
        const seven_days_ms = 7 * 24 * 60 * 60 * 1000;
        expect(cookieOptions().maxAge).toBe(seven_days_ms);
    });
});
```

### Step 9.7 — Write P1 integration tests

These tests verify the three flows marked "built, needs verify" in
`docs/MigrationGapAnalysis.md`.

Create `d:\fitforce-x\server\tests\integration\auth.test.ts`:

```typescript
import { request, createTestUser } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';

describe('P1-1 — Forgot / Reset Password', () => {
    test('POST /auth/forgot-password returns 200 for known email', async () => {
        await createTestUser({ email: 'known@test.com' });
        const res = await request.post('/api/auth/forgot-password')
            .send({ email: 'known@test.com' });
        expect(res.status).toBe(200);
    });

    test('POST /auth/forgot-password returns 200 for unknown email (no enumeration)', async () => {
        const res = await request.post('/api/auth/forgot-password')
            .send({ email: 'nobody@test.com' });
        expect(res.status).toBe(200);
    });

    test('creates a password_reset_tokens row for known email', async () => {
        const user = await createTestUser({ email: 'tokenuser@test.com' });
        await request.post('/api/auth/forgot-password').send({ email: 'tokenuser@test.com' });
        const row = await testPrisma.passwordResetToken.findFirst({ where: { userId: user.id } });
        expect(row).not.toBeNull();
    });

    test('POST /auth/reset-password succeeds with a valid token', async () => {
        const user = await createTestUser({ email: 'resetme@test.com' });
        await request.post('/api/auth/forgot-password').send({ email: 'resetme@test.com' });
        const row = await testPrisma.passwordResetToken.findFirst({ where: { userId: user.id } });
        const res = await request.post('/api/auth/reset-password')
            .send({ token: row!.token, password: 'NewPassword123!' });
        expect(res.status).toBe(200);
    });

    test('POST /auth/reset-password rejects an expired token', async () => {
        const user = await createTestUser({ email: 'expired@test.com' });
        await testPrisma.passwordResetToken.create({
            data: {
                id:        'exp-token-id',
                userId:    user.id,
                token:     'EXPIRED123',
                expiresAt: new Date(Date.now() - 1000),
            },
        });
        const res = await request.post('/api/auth/reset-password')
            .send({ token: 'EXPIRED123', password: 'newpass123' });
        expect(res.status).toBe(400);
    });
});
```

Create `d:\fitforce-x\server\tests\integration\messenger.test.ts`:

```typescript
import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { createId } from '@paralleldrive/cuid2';

describe('P1-3 — Messenger', () => {
    let cookie: string;
    let workspaceId: string;
    let clientId: string;

    beforeEach(async () => {
        const user      = await createTestUser();
        const workspace = await createTestWorkspace(user.id);
        workspaceId     = workspace.id;
        cookie          = makeAuthCookie(user.id, workspaceId);

        const client = await testPrisma.client.create({
            data: { id: createId(), fname: 'Test', lname: 'Client', workspaceId },
        });
        clientId = client.id;
    });

    test('POST /messenger/threads creates a thread', async () => {
        const res = await request
            .post('/api/messenger/threads')
            .set('Cookie', cookie)
            .send({ clientId });
        expect(res.status).toBe(201);
        expect(res.body.clientId).toBe(clientId);
    });

    test('POST /messenger/threads is idempotent (same client returns existing thread)', async () => {
        await request.post('/api/messenger/threads').set('Cookie', cookie).send({ clientId });
        const res2 = await request.post('/api/messenger/threads').set('Cookie', cookie).send({ clientId });
        expect(res2.status).toBe(201);
        const threads = await testPrisma.thread.findMany({ where: { clientId } });
        expect(threads).toHaveLength(1);
    });

    test('POST /messenger/threads/:id/messages sends a message', async () => {
        const thread = await testPrisma.thread.create({
            data: { id: createId(), workspaceId, clientId },
        });
        const res = await request
            .post(`/api/messenger/threads/${thread.id}/messages`)
            .set('Cookie', cookie)
            .send({ body: 'Hello client!' });
        expect(res.status).toBe(201);
        expect(res.body.body).toBe('Hello client!');
        expect(res.body.senderType).toBe('team');
    });

    test('GET /messenger/threads/:id/messages marks client messages as read', async () => {
        const thread = await testPrisma.thread.create({
            data: { id: createId(), workspaceId, clientId },
        });
        const msg = await testPrisma.message.create({
            data: {
                id: createId(), threadId: thread.id,
                senderType: 'client', senderId: clientId,
                body: 'Hi coach', readByTeamAt: null,
            },
        });
        await request.get(`/api/messenger/threads/${thread.id}/messages`).set('Cookie', cookie);
        const updated = await testPrisma.message.findUnique({ where: { id: msg.id } });
        expect(updated?.readByTeamAt).not.toBeNull();
    });
});
```

### Step 9.8 — Add test scripts to `package.json`

```json
{
  "scripts": {
    "test":          "jest --runInBand",
    "test:unit":     "jest tests/unit --runInBand",
    "test:int":      "jest tests/integration --runInBand",
    "test:coverage": "jest --coverage --runInBand"
  }
}
```

### Step 9.9 — Coverage targets

| File | Minimum target |
|---|---|
| `src/lib/planEngine.ts` | 85% |
| `src/modules/auth/auth.service.ts` | 80% |
| `src/modules/auth/auth.controller.ts` | 70% |
| `src/modules/messenger/messenger.controller.ts` | 70% |
| All other modules | 50% (first pass) |

### Step 9.10 — Commit

```bash
git add -A
git commit -m "test: configure Jest, write planEngine unit tests and P1 integration tests"
```

---

---

# PHASE 10 — Observability Completion

**Time estimate:** 2 hours
**Risk:** None — additive only

---

### Step 10.1 — Upgrade the health check endpoint

The current `/api/health` returns a static string. Replace it with a real probe
that verifies the DB connection is live and reports memory usage:

```typescript
// In src/app.ts — replace the existing health route
import { prisma } from './lib/prisma';

app.get('/api/health', async (_req, res) => {
    const start = Date.now();
    try {
        await prisma.$queryRaw`SELECT 1`;
        const dbResponseTime = Date.now() - start;
        const mem = process.memoryUsage();

        res.status(200).json({
            status:    'healthy',
            timestamp: new Date().toISOString(),
            uptime:    Math.round(process.uptime()),
            database: {
                status:       'connected',
                responseTimeMs: dbResponseTime,
            },
            memory: {
                heapUsedMB:  Math.round(mem.heapUsed  / 1024 / 1024),
                heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
            },
            version: process.env.npm_package_version ?? '1.0.0',
        });
    } catch {
        res.status(503).json({
            status:    'unhealthy',
            timestamp: new Date().toISOString(),
            database:  { status: 'disconnected' },
        });
    }
});
```

### Step 10.2 — Add a metrics endpoint

```typescript
// In src/app.ts
const serverStartTime = Date.now();
let totalRequests = 0;

app.use((_req, _res, next) => { totalRequests++; next(); });

app.get('/api/metrics', authMiddleware, (req, res) => {
    if (!req.user?.isOwner) return res.status(403).json({ error: 'Forbidden' });

    const mem = process.memoryUsage();
    res.json({
        uptimeSeconds: Math.round((Date.now() - serverStartTime) / 1000),
        requestsTotal: totalRequests,
        memory: {
            heapUsedMB:  Math.round(mem.heapUsed  / 1024 / 1024),
            heapTotalMB: Math.round(mem.heapTotal / 1024 / 1024),
        },
        timestamp: new Date().toISOString(),
    });
});
```

### Step 10.3 — Configure Sentry release tracking

Update the `Sentry.init` call in `src/app.ts`:

```typescript
Sentry.init({
    dsn:              env.SENTRY_DSN,
    environment:      env.NODE_ENV,
    release:          process.env.npm_package_version,
    enabled:          !!env.SENTRY_DSN,
    tracesSampleRate: env.NODE_ENV === 'production' ? 0.1 : 1.0,
    integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Express({ app }),
    ],
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.tracingHandler());
// Add Sentry.Handlers.errorHandler() just before the global error handler
```

### Step 10.4 — Configure pino log levels by environment

Update `src/logger.ts`:

```typescript
import pino from 'pino';
import { env } from './config/env';

const logger = pino({
    level: env.NODE_ENV === 'production' ? 'warn' : 'debug',
    transport: env.NODE_ENV !== 'production'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
});

export default logger;
```

```bash
npm install --save-dev pino-pretty
```

### Step 10.5 — Commit

```bash
git add -A
git commit -m "feat: upgrade health check with DB probe, add metrics endpoint, configure Sentry releases"
```

---

---

# Final Merge

After all 10 phases are committed and the full test suite is green:

```bash
# Zero TypeScript errors
npx tsc --noEmit

# Full test suite green
npm test

# Server starts and health check passes
npm run dev
# GET http://localhost:4000/api/health
# Expected: { status: 'healthy', database: { status: 'connected' } }

# Merge to dev
git checkout dev
git merge refactor/server-architecture-upgrade
git push origin dev
```

---

## Post-Upgrade Verification Checklist

```
TYPESCRIPT
[ ] npx tsc --noEmit reports zero errors
[ ] No .js files remain in src/ directory
[ ] Every process.env.X replaced with env.X from src/config/env.ts

PRISMA
[ ] prisma/schema.prisma matches all 17 existing migration tables
[ ] npx prisma generate completes without errors
[ ] All pool.query() calls replaced except planEngine.ts

MODULE STRUCTURE
[ ] All 17 modules exist in src/modules/
[ ] Each module has routes.ts + controller.ts
[ ] auth, nutrition, training each have a service.ts
[ ] routes/ directory deleted

SECURITY
[ ] migration 018_user_sessions.js applied to DB
[ ] POST /api/auth/logout revokes session — subsequent request returns 401
[ ] Admin route returns 403 from non-admin subdomain in production
[ ] Helmet CSP headers visible in browser DevTools Network tab

FILE STORAGE
[ ] New file upload URL starts with https://...s3.amazonaws.com (not /uploads/)
[ ] Express static /uploads route removed
[ ] Existing uploads migrated to S3 via migration script

REAL-TIME
[ ] Socket.io connects from browser using httpOnly cookie
[ ] Coach sends message → client portal updates without page refresh
[ ] Client sends message → coach inbox unread count updates in real time

SCHEDULERS
[ ] Server startup log shows 3 scheduler registrations
[ ] Session cleanup deletes expired rows (verify manually after test insertion)

API DOCS
[ ] GET http://localhost:4000/api-docs renders Swagger UI
[ ] All routes appear with correct methods and paths

TESTING
[ ] npm test — all tests pass
[ ] npm run test:coverage — planEngine.ts at 85%+
[ ] P1-1 password reset integration test: green
[ ] P1-3 messenger integration test: green

OBSERVABILITY
[ ] GET /api/health returns { status: 'healthy', database: { status: 'connected' } }
[ ] GET /api/metrics returns uptime and memory (requires auth cookie)
[ ] Error sent to Sentry appears in Sentry dashboard within 60 seconds
[ ] pino logs are colourised in dev, plain JSON in production
```

---

## What This Plan Does NOT Touch

The following features were intentionally skipped in the original rebuild and
remain skipped. This plan does not implement them. The architectural upgrades
here (TypeScript, Prisma, S3, Socket.io) make all of them significantly easier
to add in future sprints.

| Feature | Priority | Future addition note |
|---|---|---|
| PDF generation (Puppeteer) | P2-1 | Add `pdf_url` column to plans; use existing S3 lib |
| Push notifications (FCM) | P1-5 | Add `device_token` to clients; Firebase Admin SDK |
| Support ticket system | P2-2 | New `tickets` module following Phase 3 pattern |
| Client attachments | P2-4 | New upload type in `src/middleware/upload.ts` |
| In-app notifications | P2-6 | Socket.io from Phase 6 is the delivery foundation |
| Promo / affiliate codes | P3-1 | New `promo` module |
| Admin analytics | P3-3 | Build on top of Phase 10 metrics endpoint |
| Recipes library | P3-2 | New `recipes` module |
| Tutorial videos | P3-4 | Admin-only, post-stabilisation |
| Client self-serve subscription | P1-6 | Payment flow, standalone addition |
| CaDay custom workout visuals | P3-9 | Schema columns only, no logic |
| Visual PDF templates | P3-7 | Config-based builder, post-stabilisation |
