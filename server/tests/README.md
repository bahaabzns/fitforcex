# Integration Tests — FitForce X

## Overview

Comprehensive integration tests covering critical business logic paths that were previously untested:
- **Auth & Security**: Registration validation, login flows, token handling
- **Multi-tenancy**: Cross-workspace isolation, data leak prevention
- **Client Portal**: Cross-workspace client access (IDOR vulnerability)
- **Subscriptions**: State machine, plan activation, freeze logic
- **Plan Limits**: Seat limits, workspace creation limits, race conditions
- **File Uploads**: Authentication requirements
- **Permissions**: Role-based access control

## Running Tests

### Setup
```bash
cd server
npm install --save-dev supertest  # if not already installed
```

### Run All Tests
```bash
npm test
```

### Run Integration Tests Only
```bash
npx jest tests/integration.test.js
```

### Run Specific Test Suite
```bash
npx jest tests/integration.test.js -t "Workspace Isolation"
```

### Watch Mode (auto-rerun on file changes)
```bash
npx jest tests/integration.test.js --watch
```

### Run with Coverage
```bash
npx jest --coverage tests/
```

## Test Structure

### 1. Registration & Login Security (`POST /api/auth/register`, `POST /api/auth/login`)

**What's tested:**
- Empty email/password rejection
- Minimum password length enforcement
- Workspace auto-creation on registration
- No plaintext password in API response ✅ **Security-critical**
- httpOnly cookie token handling ✅ **Security-critical**
- Token NOT sent in response body ✅ **Security-critical**
- Wrong password rejection
- Credential enumeration prevention

**Why it matters:** Active data leaks identified in codebase review. Tests verify fixes are working.

### 2. Cross-Workspace Isolation (`/api/clients/`, `/api/training/`)

**What's tested:**
- Coach A cannot read clients from workspace B
- Coach A cannot update clients from workspace B
- Coach A cannot delete clients from workspace B
- GET /api/clients only returns current workspace's clients
- Same isolation for training plans

**Why it matters:** Multi-tenancy is core to the SaaS model. A failure here is a data breach.

### 3. Client Portal Cross-Workspace Access (`POST /api/client-portal/login`)

**What's tested:**
- Client cannot login WITHOUT workspace_slug ✅ **Security-critical (IDOR)**
- Client CAN login WITH workspace_slug
- Prevents cross-workspace client authentication

**Why it matters:** The codebase review flagged this as an active IDOR vulnerability:
```
A client with the same email in two workspaces will be authenticated into 
whichever row comes back first. This is an IDOR.
```

### 4. Subscription Status Computation

**What's tested:**
- "No Subscriptions" with no transactions
- "Pre-start" for unpurchased plans
- "Active" within subscription window
- "Expired" after window passes
- Freeze duration extending subscriptions ✅ **Complex business logic**
- "Frozen" status during freeze windows
- Queue logic (second subscription starts when first ends) ✅ **Complex**

**Why it matters:** Subscription logic is the financial backbone. Mistakes here cause:
- Incorrect billing
- Clients locked out when they shouldn't be
- Reverse billing issues (charging expired clients)

### 5. Plan Limit Enforcement

**What's tested:**
- Free plan limits workspace to 1 seat
- Starter plan allows 5 seats
- Free plan user limited to 1 workspace
- Starter plan user can create 3 workspaces
- Concurrent client creation generates unique codes (race condition prevention)

**Why it matters:** Plan limits are enforced to drive paid upgrades. Allowing free users unlimited capacity is lost revenue.

### 6. File Upload Authentication

**What's tested:**
- Unauthenticated uploads to `/api/training/upload` return 401
- Unauthenticated uploads to `/api/transactions/proof-image` return 401
- Authenticated users can upload

**Why it matters:** Without auth checks, any internet user could fill your storage.

### 7. Permission Checks

**What's tested:**
- Non-owner cannot update workspace settings
- Manager role properly restricted

**Why it matters:** Permission escapes allow lower-privilege users to perform admin actions.

## Database Setup for Tests

Tests use a separate test database. Configure via `.env`:

```env
# .env (development)
DB_NAME=fitforce_dev
DB_USER=postgres
DB_PASSWORD=password
DB_HOST=localhost

# .env.test (testing)
DB_NAME=fitforce_test
DB_USER=postgres
DB_PASSWORD=password
DB_HOST=localhost
NODE_ENV=test
```

The test runner automatically:
1. Uses `fitforce_test` database
2. Truncates all tables before each test
3. Re-seeds the `plans` table (required for workspace creation)
4. Resets auto-increment sequences

**First-time setup:**
```bash
# Create test database
createdb fitforce_test

# Run migrations
DB_NAME=fitforce_test npm run migrate
```

## Extending Tests

### Adding a New Integration Test

```js
describe('My Feature', () => {
    beforeEach(async () => {
        await resetDatabase();
    });

    it('should do something', async () => {
        const { token, workspace } = await createCoach({ email: 'coach@test.com' });
        const client = await createClient(workspace.id, { email: 'client@test.com' });

        const res = await request(app)
            .post('/api/clients/' + client.id + '/assign-plan')
            .set('Cookie', `token=${token}`)
            .send({ planId: 1 });

        expect(res.status).toBe(200);
    });
});
```

### Available Helper Functions

```js
// Create coach + workspace + free subscription
const { user, workspace, token } = await createCoach({ 
    email: 'coach@test.com', 
    password: 'password123' 
});

// Create client in workspace
const client = await createClient(workspace.id, { 
    email: 'client@test.com',
    password: 'password123' // optional, for testing login
});

// Create training/nutrition plans
const trainPlan = await createTrainingPlan(client.id, workspace.id);
const nutrition = await createNutritionPlan(client.id, workspace.id);

// Create nested entities
const day = await createTrainingDay(trainPlan.id);
const cycle = await createNutritionCycle(nutrition.id);

// Manage workspace members
const member = await createWorkspaceMember(workspace.id, user.id, { role: 'manager' });

// Create transactions and freezes
const tx = await createTransaction(client.id, workspace.id, { duration: 30 });
const freeze = await createSubscriptionFreeze(client.id);

// Reset between tests
await resetDatabase();
```

## Known Issues / TODOs

### Tests Expecting Future Fixes

Some tests will fail until corresponding code fixes are merged:

1. **Client Portal IDOR** (`should client cannot log in without providing workspace slug`)
   - Currently fails because the endpoint doesn't require `workspace_slug`
   - Fix: [#security-issues](../../docs/codebase-review.md#critical-issues)

2. **Input Validation** (`rejects empty password`, `rejects very short password`)
   - Currently fails because registration has no validation middleware
   - Fix: Add Zod/express-validator

3. **File Upload Auth** 
   - Tests may fail if upload endpoints don't properly check authentication
   - Fix: Verify clientAuth/auth middleware on all upload routes

### Concurrent Execution

Some tests use `Promise.all()` to test race conditions. If you see flaky tests:
- Increase retry attempts
- Add database-level constraints (e.g., unique constraint on client_code per workspace)

## Continuous Integration

### GitHub Actions Setup

Add to `.github/workflows/test.yml`:

```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:18
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: fitforce_test
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v3
```

## Coverage Goals

Current coverage (before integration tests):
- Auth middleware: ~60%
- Routes: ~5%
- Business logic: ~15%

**Target after these tests:**
- Auth: 85%+
- Routes: 40%+
- Business logic: 60%+

Run coverage report:
```bash
npm test -- --coverage --collectCoverageFrom="server/**/*.js" --coverageDirectory=coverage
```

## References

- **Codebase Review**: [docs/codebase-review.md](../../docs/codebase-review.md) — Section 10 (Testing & Reliability)
- **Critical Issues**: Lines 543–544 (N+1 queries, integration tests)
- **Test Helpers**: [server/tests/helpers.js](./helpers.js)
- **Existing Tests**: [server/tests/](./auth.test.js), [isolation.test.js](./isolation.test.js), etc.

## Troubleshooting

### Test hangs
```bash
# Kill any lingering Node processes
pkill -f "jest|node"
```

### Database locked
```bash
# Reset test database
dropdb fitforce_test && createdb fitforce_test
```

### Tests fail with "Connection refused"
```bash
# Make sure PostgreSQL is running
psql postgres -c "SELECT 1"
```

### "Cannot find module 'supertest'"
```bash
npm install --save-dev supertest
```

## Contributing

When adding features:
1. Write integration test first (TDD)
2. Run full test suite: `npm test`
3. Check coverage: `npm test -- --coverage`
4. Commit both feature code + tests

Tests are your safety net for refactoring.
