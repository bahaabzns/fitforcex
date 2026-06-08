/**
 * Phase 2 — Database Migration
 *
 * Creates the workspace model tables, backfills workspaces from users,
 * renames coach_id → workspace_id on all data tables, and seeds the plans.
 *
 * Usage:
 *   node server/scripts/migrate.js
 *
 * Safe to re-run: every step uses IF NOT EXISTS / IF EXISTS / DO NOTHING.
 * The rename steps check information_schema so they are skipped if already applied.
 *
 * Run this BEFORE deploying Phase 3 server code.
 * Take a full DB backup immediately before running on production.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const pool = require('../db');
const { createId } = require('@paralleldrive/cuid2');

// ─── helpers ──────────────────────────────────────────────────────────────────

async function columnExists(client, table, column) {
    const { rows } = await client.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_name = $1 AND column_name = $2`,
        [table, column]
    );
    return rows.length > 0;
}

async function constraintExists(client, table, constraint) {
    const { rows } = await client.query(
        `SELECT 1 FROM information_schema.table_constraints
         WHERE table_name = $1 AND constraint_name = $2`,
        [table, constraint]
    );
    return rows.length > 0;
}

async function tableExists(client, table) {
    const { rows } = await client.query(
        `SELECT 1 FROM information_schema.tables WHERE table_name = $1`,
        [table]
    );
    return rows.length > 0;
}

async function indexExists(client, indexName) {
    const { rows } = await client.query(
        `SELECT 1 FROM pg_indexes WHERE indexname = $1`,
        [indexName]
    );
    return rows.length > 0;
}

// ─── migration steps ───────────────────────────────────────────────────────────

async function step1_createWorkspacesTable(client) {
    console.log('Step 1: Create workspaces table…');
    if (await tableExists(client, 'workspaces')) {
        console.log('  → already exists, skipped');
        return;
    }
    await client.query(`
        CREATE TABLE workspaces (
            id              TEXT    PRIMARY KEY,
            slug            TEXT    NOT NULL UNIQUE,
            name            TEXT    NOT NULL,
            owner_id        TEXT    NOT NULL,
            slug_customized BOOLEAN NOT NULL DEFAULT FALSE,
            archived_at     TIMESTAMPTZ,
            created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    console.log('  → created');
}

async function step2_backfillWorkspaces(client) {
    console.log('Step 2: Backfill one workspace per existing user…');
    const { rows: alreadyFilled } = await client.query('SELECT COUNT(*) AS n FROM workspaces');
    if (parseInt(alreadyFilled[0].n) > 0) {
        console.log('  → workspaces already has rows, skipped');
        return;
    }
    const { rowCount } = await client.query(`
        INSERT INTO workspaces (id, slug, name, owner_id, slug_customized, created_at)
        SELECT
            u.id,
            COALESCE(NULLIF(TRIM(u.coach_slug), ''), 'workspace-' || u.id::text),
            COALESCE(NULLIF(TRIM(u.fname), '') || '''s Workspace', 'Workspace ' || u.id::text),
            u.id,
            COALESCE(u.slug_customized, FALSE),
            u.created_at
        FROM users u
    `);
    console.log(`  → inserted ${rowCount} workspace(s)`);
}

async function step3_addWorkspaceForeignKey(client) {
    console.log('Step 3: Add FK workspaces.owner_id → users(id)…');
    if (await constraintExists(client, 'workspaces', 'fk_workspaces_owner')) {
        console.log('  → already exists, skipped');
        return;
    }
    await client.query(`
        ALTER TABLE workspaces
            ADD CONSTRAINT fk_workspaces_owner
            FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE RESTRICT
    `);
    console.log('  → added');
}

async function step4b_addWorkspaceIndexes(client) {
    console.log('Step 4b: Add indexes on workspaces…');
    if (!await indexExists(client, 'idx_workspaces_owner')) {
        await client.query(`CREATE INDEX idx_workspaces_owner ON workspaces(owner_id)`);
    }
    if (!await indexExists(client, 'idx_workspaces_slug')) {
        await client.query(`CREATE INDEX idx_workspaces_slug ON workspaces(slug)`);
    }
    if (!await indexExists(client, 'idx_workspaces_archived')) {
        await client.query(`CREATE INDEX idx_workspaces_archived ON workspaces(archived_at) WHERE archived_at IS NULL`);
    }
    console.log('  → done');
}

async function step5_addUsersColumns(client) {
    console.log('Step 5: Add default_workspace_id and is_admin to users…');
    if (!await columnExists(client, 'users', 'default_workspace_id')) {
        await client.query(`
            ALTER TABLE users
                ADD COLUMN default_workspace_id TEXT REFERENCES workspaces(id) ON DELETE SET NULL
        `);
        console.log('  → default_workspace_id added');
    } else {
        console.log('  → default_workspace_id already exists');
    }
    if (!await columnExists(client, 'users', 'is_admin')) {
        await client.query(`ALTER TABLE users ADD COLUMN is_admin BOOLEAN NOT NULL DEFAULT FALSE`);
        console.log('  → is_admin added');
    } else {
        console.log('  → is_admin already exists');
    }
}

async function step6_setDefaultWorkspace(client) {
    console.log('Step 6: Set users.default_workspace_id…');
    // workspace.id = user.id for all existing users
    const { rowCount } = await client.query(`
        UPDATE users u
        SET default_workspace_id = u.id
        WHERE u.default_workspace_id IS NULL
          AND EXISTS (SELECT 1 FROM workspaces w WHERE w.id = u.id)
    `);
    console.log(`  → updated ${rowCount} row(s)`);
}

async function step7_dropSlugColumnsFromUsers(client) {
    console.log('Step 7: Drop coach_slug and slug_customized from users…');
    if (await columnExists(client, 'users', 'coach_slug')) {
        await client.query(`ALTER TABLE users DROP COLUMN coach_slug`);
        console.log('  → coach_slug dropped');
    } else {
        console.log('  → coach_slug already gone');
    }
    if (await columnExists(client, 'users', 'slug_customized')) {
        await client.query(`ALTER TABLE users DROP COLUMN slug_customized`);
        console.log('  → slug_customized dropped');
    } else {
        console.log('  → slug_customized already gone');
    }
}

// Generic helper: rename coach_id → workspace_id and retarget FK on a given table.
async function renameCoachIdToWorkspaceId(client, table, oldFkName, newFkName) {
    console.log(`  Renaming coach_id → workspace_id on ${table}…`);

    // If workspace_id already exists (e.g. forms, form_requests), skip column rename
    // but still fix the FK target if needed.
    const hasCoachId     = await columnExists(client, table, 'coach_id');
    const hasWorkspaceId = await columnExists(client, table, 'workspace_id');

    if (hasCoachId) {
        // Drop old FK if it exists
        if (oldFkName && await constraintExists(client, table, oldFkName)) {
            await client.query(`ALTER TABLE ${table} DROP CONSTRAINT ${oldFkName}`);
        }
        // Rename column
        await client.query(`ALTER TABLE ${table} RENAME COLUMN coach_id TO workspace_id`);
        console.log(`    → renamed`);
    } else if (hasWorkspaceId) {
        console.log(`    → workspace_id already present; checking FK…`);
        // Drop the FK pointing to users if it exists (name unknown — find it)
        const { rows: fkRows } = await client.query(`
            SELECT tc.constraint_name
            FROM information_schema.table_constraints tc
            JOIN information_schema.key_column_usage kcu
                ON tc.constraint_name = kcu.constraint_name AND tc.table_name = kcu.table_name
            JOIN information_schema.referential_constraints rc
                ON rc.constraint_name = tc.constraint_name
            JOIN information_schema.table_constraints ccu
                ON ccu.constraint_name = rc.unique_constraint_name
            WHERE tc.constraint_type = 'FOREIGN KEY'
              AND tc.table_name = $1
              AND kcu.column_name = 'workspace_id'
              AND ccu.table_name = 'users'
        `, [table]);
        for (const row of fkRows) {
            await client.query(`ALTER TABLE ${table} DROP CONSTRAINT ${row.constraint_name}`);
            console.log(`    → dropped stale FK ${row.constraint_name}`);
        }
    } else {
        console.log(`    → neither coach_id nor workspace_id found, skipped`);
        return;
    }

    // Add new FK → workspaces(id)
    if (!await constraintExists(client, table, newFkName)) {
        await client.query(`
            ALTER TABLE ${table}
                ADD CONSTRAINT ${newFkName}
                FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
        `);
        console.log(`    → FK ${newFkName} added`);
    } else {
        console.log(`    → FK ${newFkName} already exists`);
    }
}

async function step8_renameCoachIds(client) {
    console.log('Step 8: Rename coach_id → workspace_id on all data tables…');

    // clients: has UNIQUE(coach_id, email) that needs renaming too
    if (await columnExists(client, 'clients', 'coach_id')) {
        if (await constraintExists(client, 'clients', 'clients_coach_id_fkey')) {
            await client.query(`ALTER TABLE clients DROP CONSTRAINT clients_coach_id_fkey`);
        }
        // Drop the unique constraint that references coach_id
        if (await constraintExists(client, 'clients', 'clients_coach_id_email_key')) {
            await client.query(`ALTER TABLE clients DROP CONSTRAINT clients_coach_id_email_key`);
        }
        await client.query(`ALTER TABLE clients RENAME COLUMN coach_id TO workspace_id`);
        if (!await constraintExists(client, 'clients', 'fk_clients_workspace')) {
            await client.query(`
                ALTER TABLE clients
                    ADD CONSTRAINT fk_clients_workspace
                    FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE
            `);
        }
        if (!await constraintExists(client, 'clients', 'clients_workspace_id_email_key')) {
            await client.query(`
                ALTER TABLE clients
                    ADD CONSTRAINT clients_workspace_id_email_key UNIQUE (workspace_id, email)
            `);
        }
        console.log('  clients → done (unique constraint updated)');
    } else {
        console.log('  clients → workspace_id already present');
    }

    // transactions
    await renameCoachIdToWorkspaceId(client, 'transactions', 'transactions_coach_id_fkey', 'fk_transactions_workspace');

    // training_plans
    await renameCoachIdToWorkspaceId(client, 'training_plans', 'training_plans_coach_id_fkey', 'fk_training_plans_workspace');

    // nutrition_plans (FK name may vary — pass null to let helper find it)
    await renameCoachIdToWorkspaceId(client, 'nutrition_plans', null, 'fk_nutrition_plans_workspace');

    // forms — already has workspace_id; helper will fix the FK target
    await renameCoachIdToWorkspaceId(client, 'forms', null, 'fk_forms_workspace');

    // form_requests — already has workspace_id
    await renameCoachIdToWorkspaceId(client, 'form_requests', null, 'fk_form_requests_workspace');

    // packages
    await renameCoachIdToWorkspaceId(client, 'packages', 'packages_coach_id_fkey', 'fk_packages_workspace');

    // payment_methods
    await renameCoachIdToWorkspaceId(client, 'payment_methods', 'payment_methods_coach_id_fkey', 'fk_payment_methods_workspace');

    // exercise_library
    await renameCoachIdToWorkspaceId(client, 'exercise_library', null, 'fk_exercise_library_workspace');

    // exercise_muscle_groups
    await renameCoachIdToWorkspaceId(client, 'exercise_muscle_groups', null, 'fk_exercise_muscle_groups_workspace');

    // exercise_equipments
    await renameCoachIdToWorkspaceId(client, 'exercise_equipments', null, 'fk_exercise_equipments_workspace');

    // food_items (coach-scoped nutrition database)
    await renameCoachIdToWorkspaceId(client, 'food_items', null, 'fk_food_items_workspace');

    // food_categories
    await renameCoachIdToWorkspaceId(client, 'food_categories', null, 'fk_food_categories_workspace');
}

async function step9_createNewTables(client) {
    console.log('Step 9: Create workspace_members, workspace_invitations, workspace_audit_log…');

    await client.query(`
        CREATE TABLE IF NOT EXISTS workspace_members (
            id           TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role         TEXT NOT NULL CHECK (role IN ('manager','trainer','nutritionist','receptionist','viewer')),
            permissions  JSONB   NOT NULL DEFAULT '{}',
            is_active    BOOLEAN NOT NULL DEFAULT TRUE,
            joined_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (workspace_id, user_id)
        )
    `);
    if (!await indexExists(client, 'idx_workspace_members_workspace')) {
        await client.query(`CREATE INDEX idx_workspace_members_workspace ON workspace_members(workspace_id)`);
    }
    if (!await indexExists(client, 'idx_workspace_members_user')) {
        await client.query(`CREATE INDEX idx_workspace_members_user ON workspace_members(user_id)`);
    }

    await client.query(`
        CREATE TABLE IF NOT EXISTS workspace_invitations (
            id                 TEXT PRIMARY KEY,
            workspace_id       TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            invited_by_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            invited_user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            role               TEXT NOT NULL CHECK (role IN ('manager','trainer','nutritionist','receptionist','viewer')),
            status             TEXT NOT NULL DEFAULT 'pending'
                                       CHECK (status IN ('pending','accepted','declined')),
            message            TEXT,
            created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            responded_at       TIMESTAMPTZ,
            UNIQUE (workspace_id, invited_user_id)
        )
    `);
    if (!await indexExists(client, 'idx_invitations_invited_user')) {
        await client.query(`CREATE INDEX idx_invitations_invited_user ON workspace_invitations(invited_user_id, status)`);
    }
    if (!await indexExists(client, 'idx_invitations_workspace')) {
        await client.query(`CREATE INDEX idx_invitations_workspace ON workspace_invitations(workspace_id)`);
    }

    await client.query(`
        CREATE TABLE IF NOT EXISTS workspace_audit_log (
            id            TEXT PRIMARY KEY,
            workspace_id  TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
            action        TEXT NOT NULL,
            target_type   TEXT,
            target_id     TEXT,
            metadata      JSONB,
            created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);
    if (!await indexExists(client, 'idx_audit_workspace')) {
        await client.query(`CREATE INDEX idx_audit_workspace ON workspace_audit_log(workspace_id, created_at DESC)`);
    }

    await client.query(`
        CREATE TABLE IF NOT EXISTS admins (
            id         TEXT PRIMARY KEY,
            email      TEXT NOT NULL UNIQUE,
            password   TEXT NOT NULL,
            fname      TEXT,
            lname      TEXT,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    console.log('  → done');
}

async function step10_createAndSeedPlans(client) {
    console.log('Step 10: Create and seed plans table…');

    await client.query(`
        CREATE TABLE IF NOT EXISTS plans (
            id               TEXT    PRIMARY KEY,
            name             TEXT    NOT NULL UNIQUE,
            display_name     TEXT    NOT NULL,
            max_team_seats   INTEGER,
            max_workspaces   INTEGER,
            features         JSONB   NOT NULL DEFAULT '{}',
            price_monthly    NUMERIC(10,2),
            is_active        BOOLEAN NOT NULL DEFAULT TRUE,
            created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    `);

    const planSeeds = [
        { name: 'free',     display_name: 'Free',     max_team_seats: 0,    max_workspaces: 1,    price_monthly: 0 },
        { name: 'starter',  display_name: 'Starter',  max_team_seats: 2,    max_workspaces: 1,    price_monthly: null },
        { name: 'pro',      display_name: 'Pro',      max_team_seats: 5,    max_workspaces: 3,    price_monthly: null },
        { name: 'business', display_name: 'Business', max_team_seats: null, max_workspaces: null, price_monthly: null },
    ];
    for (const plan of planSeeds) {
        await client.query(`
            INSERT INTO plans (id, name, display_name, max_team_seats, max_workspaces, price_monthly)
            VALUES ($1, $2, $3, $4, $5, $6)
            ON CONFLICT (name) DO NOTHING
        `, [createId(), plan.name, plan.display_name, plan.max_team_seats, plan.max_workspaces, plan.price_monthly]);
    }

    console.log('  → done');
}

async function step11_seedWorkspaceSubscriptions(client) {
    console.log('Step 11: Create workspace_subscriptions and seed all workspaces on free plan…');

    await client.query(`
        CREATE TABLE IF NOT EXISTS workspace_subscriptions (
            id           TEXT PRIMARY KEY,
            workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
            plan_id      TEXT NOT NULL REFERENCES plans(id),
            status       TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','cancelled')),
            starts_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            expires_at   TIMESTAMPTZ,
            notes        TEXT,
            created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE (workspace_id)
        )
    `);

    const { rows: unseeded } = await client.query(`
        SELECT w.id AS workspace_id, (SELECT id FROM plans WHERE name = 'free') AS plan_id
        FROM workspaces w
        WHERE NOT EXISTS (
            SELECT 1 FROM workspace_subscriptions ws WHERE ws.workspace_id = w.id
        )
    `);
    for (const row of unseeded) {
        await client.query(
            `INSERT INTO workspace_subscriptions (id, workspace_id, plan_id) VALUES ($1, $2, $3)`,
            [createId(), row.workspace_id, row.plan_id]
        );
    }
    console.log(`  → subscriptions seeded for ${unseeded.length} workspace(s)`);
}

async function step13_addIsDefaultToPlan(client) {
    console.log('Step 13: Add is_default column to plans…');
    if (!await columnExists(client, 'plans', 'is_default')) {
        await client.query(`ALTER TABLE plans ADD COLUMN is_default BOOLEAN NOT NULL DEFAULT FALSE`);
        console.log('  → is_default column added');
    } else {
        console.log('  → is_default already exists');
    }

    if (!await indexExists(client, 'plans_one_default')) {
        await client.query(`
            CREATE UNIQUE INDEX plans_one_default ON plans (is_default) WHERE is_default = TRUE
        `);
        console.log('  → unique partial index created');
    } else {
        console.log('  → index already exists');
    }

    // Mark the free plan as default if no plan is currently marked default
    const { rows } = await client.query(`SELECT id FROM plans WHERE is_default = TRUE`);
    if (rows.length === 0) {
        await client.query(`UPDATE plans SET is_default = TRUE WHERE name = 'free'`);
        console.log('  → free plan marked as default');
    } else {
        console.log('  → a default plan already set, skipped');
    }
}

async function step12_verify(client) {
    console.log('Step 12: Verification checks…');

    const tables = [
        'workspaces', 'workspace_members', 'workspace_invitations',
        'workspace_audit_log', 'plans', 'workspace_subscriptions', 'admins'
    ];
    for (const t of tables) {
        const exists = await tableExists(client, t);
        console.log(`  ${exists ? '✓' : '✗'} ${t}`);
    }

    const colChecks = [
        ['clients',            'workspace_id'],
        ['transactions',       'workspace_id'],
        ['training_plans',     'workspace_id'],
        ['nutrition_plans',    'workspace_id'],
        ['forms',              'workspace_id'],
        ['form_requests',      'workspace_id'],
        ['packages',           'workspace_id'],
        ['payment_methods',    'workspace_id'],
        ['exercise_library',   'workspace_id'],
        ['exercise_muscle_groups', 'workspace_id'],
        ['exercise_equipments',    'workspace_id'],
        ['food_items',             'workspace_id'],
        ['food_categories',        'workspace_id'],
        ['users', 'default_workspace_id'],
        ['users', 'is_admin'],
    ];
    for (const [table, col] of colChecks) {
        const exists = await columnExists(client, table, col);
        console.log(`  ${exists ? '✓' : '✗'} ${table}.${col}`);
    }

    const noCoachId = [
        'clients', 'transactions', 'training_plans', 'nutrition_plans',
        'packages', 'payment_methods', 'exercise_library',
        'exercise_muscle_groups', 'exercise_equipments',
        'food_items', 'food_categories',
    ];
    for (const table of noCoachId) {
        const still = await columnExists(client, table, 'coach_id');
        if (still) console.log(`  ✗ ${table}.coach_id still exists — rename failed!`);
    }

    const { rows: wCount }   = await client.query('SELECT COUNT(*) AS n FROM workspaces');
    const { rows: uCount }   = await client.query('SELECT COUNT(*) AS n FROM users');
    const { rows: subCount } = await client.query('SELECT COUNT(*) AS n FROM workspace_subscriptions');
    const { rows: planCount} = await client.query('SELECT COUNT(*) AS n FROM plans');
    console.log(`  workspaces=${wCount[0].n} users=${uCount[0].n} subscriptions=${subCount[0].n} plans=${planCount[0].n}`);
    if (wCount[0].n !== uCount[0].n) {
        console.warn('  ⚠ workspace count does not match user count — investigate!');
    }
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function run() {
    const client = await pool.connect();
    try {
        console.log('Starting Phase 2 migration…\n');
        await client.query('BEGIN');

        await step1_createWorkspacesTable(client);
        await step2_backfillWorkspaces(client);
        await step3_addWorkspaceForeignKey(client);
        await step4b_addWorkspaceIndexes(client);
        await step5_addUsersColumns(client);
        await step6_setDefaultWorkspace(client);
        await step7_dropSlugColumnsFromUsers(client);
        await step8_renameCoachIds(client);
        await step9_createNewTables(client);
        await step10_createAndSeedPlans(client);
        await step11_seedWorkspaceSubscriptions(client);
        await step13_addIsDefaultToPlan(client);

        await client.query('COMMIT');
        console.log('\nMigration committed successfully.\n');

        // Verify outside the transaction (so we can read the committed state)
        await step12_verify(client);

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\nMigration ROLLED BACK due to error:', err.message);
        console.error(err.stack);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

run();
