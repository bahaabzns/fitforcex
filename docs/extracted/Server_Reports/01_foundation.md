# Phase 1: Foundation & Configuration — Deep Review

**Date:** 2026-07-14
**Scope:** package.json, tsconfig, env config, build setup, Swagger, entry points
**Score: GOOD** (3.5/5) — Clean setup with proper env validation, but dual entry points and Swagger gaps

---

## 1. DEPENDENCY AUDIT — Score: **Very Good**

### 1.1 Production Dependencies (20)

| Package | Version | Purpose | Verdict |
|---------|---------|---------|---------|
| express | 5.2.1 | Web framework | Latest Express 5 |
| @prisma/client | 5.22 | ORM | Current |
| socket.io | 4.8.3 | Realtime | Current |
| jsonwebtoken | 9.0.3 | JWT auth | Current |
| bcrypt | 6.0 | Password hashing | Current |
| zod | 4.4.3 | Validation | Latest Zod 4 |
| helmet | 8.1.0 | Security headers | Current |
| cors | 2.8.6 | CORS | Stable |
| express-rate-limit | 8.4.1 | Rate limiting | Current |
| @sentry/node | 10.51 | Error tracking | Current |
| pino | 10.3.1 | Logging | Current |
| pino-http | 11.0 | HTTP logging | Current |
| @aws-sdk/client-s3 | 3.1044 | S3 uploads | Current |
| @aws-sdk/s3-request-presigner | 3.1044 | Presigned URLs | Current |
| multer | 2.1.1 | File uploads | Current |
| multer-s3 | 3.0.1 | S3 integration | Current |
| nodemailer | 8.0.10 | Email | Current |
| node-cron | 4.2.1 | Scheduling | Current |
| node-pg-migrate | 8.0.4 | Migrations | Current |
| pg | 8.20 | PostgreSQL client | Current |
| compression | 1.8.1 | Gzip | Stable |
| cookie-parser | 1.4.7 | Cookies | Stable |
| dotenv | 17.4.2 | Env loading | Current |
| @paralleldrive/cuid2 | 2.2.2 | ID generation | Current |
| swagger-jsdoc | 6.3 | API docs | Stable |
| swagger-ui-express | 5.0.1 | API docs UI | Stable |

**Verdict:** Zero dead dependencies. All packages are current versions. No deprecated packages.

### 1.2 Dev Dependencies (17)

| Package | Version | Purpose |
|---------|---------|---------|
| typescript | 6.0.3 | TS compiler (latest) |
| ts-node | 10.9.2 | TS execution |
| tsconfig-paths | 4.2 | Path aliases |
| jest | 30.3 | Test runner (latest) |
| ts-jest | 29.4.11 | TS transform |
| supertest | 7.2.2 | HTTP testing |
| @types/* | various | Type definitions |
| prisma | 5.22 | Prisma CLI |
| nodemon | 3.1.14 | Dev server |
| pino-pretty | 13.1.3 | Log formatting |
| dotenv-cli | 11.0 | Env for tests |

**Verdict:** All dev dependencies are current and necessary.

---

## 2. TYPESCRIPT CONFIG — Score: **Very Good**

```json
{
  "target": "ES2022",
  "module": "commonjs",
  "strict": true,
  "rootDir": "./src",
  "outDir": "./dist",
  "declaration": true,
  "declarationMap": true,
  "sourceMap": true
}
```

**Quality:**
- `strict: true` — Full type checking enabled
- `target: ES2022` — Modern JS features
- `declaration: true` — Generates `.d.ts` files
- `declarationMap: true` — Source maps for declarations
- `sourceMap: true` — Debuggable in production
- `rootDir: ./src` — Clean separation from legacy JS

**Issues:**
1. **`allowJs: true, checkJs: false`** — Legacy JS files are included but not type-checked. This is intentional for the migration period but should be removed once legacy JS is eliminated.

---

## 3. ENV CONFIGURATION — Score: **Good**

### 3.1 Validation

```typescript
function requireEnv(key: string): string {
    const val = process.env[key];
    if (!val) throw new Error(`Missing required environment variable: ${key}`);
    return val;
}
```

**Required vars (validated):**
- `JWT_SECRET`, `DB_USER`, `DB_HOST`, `DB_NAME`, `DB_PASSWORD`

**Optional vars (with defaults):**
- `ADMIN_JWT_SECRET` — defaults to `''` (empty string)
- `SMTP_*` — defaults to empty strings
- `S3_*` — defaults to empty strings
- `FAWATERAK_*` — defaults to empty strings
- `SENTRY_DSN` — defaults to empty string

### 3.2 Issues

| # | Issue | Severity |
|---|-------|----------|
| 1 | **`ADMIN_JWT_SECRET` defaults to empty string** | HIGH |
| 2 | **No validation that SMTP/S3/Fawaterak configs are complete** | MEDIUM |
| 3 | **No `.env.example` file** | LOW |

**Issue 1 detail:** `ADMIN_JWT_SECRET` falls back to `''` if not set. This means admin tokens are signed with an empty string, which is insecure. Should either be required or have a secure fallback.

---

## 4. ENTRY POINTS — Score: **Fair**

### 4.1 Dual Entry Points

| Entry | File | Lines | Status |
|-------|------|-------|--------|
| Legacy JS | `server.js` | 111 | Still in use (`dev:js` script) |
| TypeScript | `src/server.ts` → `src/app.ts` | 25 + 197 | Active entry |

### 4.2 server.js (Legacy)

- CommonJS (`require()`)
- Manual route mounting (16 routes)
- Sentry init
- `execSync('npm run migrate')` on startup
- Health check at `/api/health`
- Global error handler

### 4.3 src/app.ts (Active)

- ES modules (`import`)
- 18 module routers imported from `src/modules/`
- 5 cron schedulers started
- Swagger docs at `/api-docs`
- Health check with DB ping + memory stats
- Server metrics endpoint
- Graceful shutdown via SIGINT/SIGTERM

### 4.4 Issues

| # | Issue | Severity |
|---|-------|----------|
| 1 | **Two entry points with different feature sets** | HIGH |
| 2 | **Legacy `server.js` lacks cron schedulers** | MEDIUM |
| 3 | **Legacy `server.js` lacks graceful shutdown** | MEDIUM |
| 4 | **Legacy `server.js` health check is simpler** | LOW |

**Issue 1 detail:** `server.js` and `src/app.ts` mount different routes, have different middleware stacks, and different feature sets. This creates confusion about which is "production."

---

## 5. BUILD & DEV SETUP — Score: **Very Good**

### 5.1 Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| `dev` | `nodemon --exec ts-node -r tsconfig-paths/register src/server.ts` | TS dev server |
| `dev:js` | `nodemon server.js` | Legacy JS dev server |
| `build` | `tsc --project tsconfig.json` | Compile TS |
| `start` | `node dist/server.js` | Run compiled TS |
| `test` | `dotenv -e .env.test jest --runInBand` | Run tests |
| `test:unit` | `dotenv -e .env.test jest tests/unit --runInBand` | Unit tests only |
| `test:int` | `dotenv -e .env.test jest tests/integration --runInBand` | Integration tests |
| `test:coverage` | `dotenv -e .env.test jest --coverage --runInBand` | Coverage report |
| `migrate` | `node-pg-migrate up` | Run migrations |
| `migrate:down` | `node-pg-migrate down` | Rollback migrations |
| `migrate:create` | `node-pg-migrate create` | Create new migration |

**Quality:**
- `dotenv-cli` loads `.env.test` for tests (isolated from dev/prod)
- `tsconfig-paths` resolves path aliases in dev
- `--runInBand` prevents test parallelism (DB conflicts)
- Separate `dev` and `dev:js` scripts for TS and legacy

### 5.2 nodemon

```json
{
  "watch": ["src"],
  "ext": "ts,json",
  "ignore": ["src/**/*.test.ts"]
}
```

**Good:** Watches only `src/`, ignores test files, supports JSON changes.

### 5.3 Jest Config

```typescript
{
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.ts'],
  maxWorkers: 1,
  coverageThreshold: { global: { lines: 70, functions: 70, branches: 60 } }
}
```

**Quality:**
- `maxWorkers: 1` — Serial execution prevents DB conflicts
- Coverage thresholds enforced (70% lines, 70% functions, 60% branches)
- `tsconfig.test.json` extends base config with Jest types

---

## 6. SWAGGER / API DOCS — Score: **Fair**

### 6.1 Config

```typescript
apis: ['./src/modules/**/*.routes.ts'],
```

Scans all route files for JSDoc annotations.

### 6.2 Defined Schemas (6)

- Client, Thread, Message, NutritionPlan, WorkoutPlan, Error

### 6.3 Issues

| # | Issue | Severity |
|---|-------|----------|
| 1 | **Only 6 schemas defined** — API has 20+ resource types | MEDIUM |
| 2 | **No response schemas** — Only request schemas | MEDIUM |
| 3 | **No error response schemas** — Error handling not documented | LOW |

---

## 7. CRITICAL ISSUES SUMMARY

| # | Issue | Severity | Fix |
|---|-------|----------|-----|
| 1 | **`ADMIN_JWT_SECRET` defaults to empty string** | HIGH | Make it required or use JWT_SECRET as fallback |
| 2 | **Two entry points with different features** | HIGH | Deprecate `server.js`, use only `src/app.ts` |
| 3 | **Legacy `server.js` lacks cron + graceful shutdown** | MEDIUM | Migrate to TS entry |
| 4 | **Swagger schemas incomplete** | MEDIUM | Add schemas for all 20+ resource types |
| 5 | **`allowJs: true` in tsconfig** | LOW | Remove after legacy JS migration |

---

## 8. WHAT'S WELL DONE

1. **Zero dead dependencies** — Every package is current and necessary.

2. **Strict TypeScript** — `strict: true` with full declaration maps.

3. **Env validation** — `requireEnv()` catches missing vars at startup.

4. **Test isolation** — `dotenv-cli` loads `.env.test`, `--runInBand` prevents DB conflicts.

5. **Coverage thresholds** — 70% lines, 70% functions, 60% branches enforced.

6. **Express 5** — Latest version with modern features.

7. **Zod 4** — Latest validation library.

8. **Clean script organization** — Separate dev/test/build/migrate commands.

9. **nodemon config** — Watches only `src/`, ignores tests.

10. **Swagger setup** — Auto-scans route files for documentation.

---

## 9. RECOMMENDED ACTIONS (Priority Order)

### Immediate
1. Make `ADMIN_JWT_SECRET` required or fallback to `JWT_SECRET`
2. Deprecate `server.js` — remove `dev:js` script

### Short-term
3. Complete Swagger schemas for all resource types
4. Remove `allowJs: true` from tsconfig after legacy migration

### Medium-term
5. Add `.env.example` with all variables documented
6. Add pre-commit hooks (husky + lint-staged)

---

*Report generated: 2026-07-14 | Reviewer: Senior Code Reviewer | Next: Phase 2 — Database Schema & Migrations*
