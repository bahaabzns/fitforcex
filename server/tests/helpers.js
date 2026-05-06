const pool = require('../db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

/**
 * Reset all test data between tests.
 * Truncates in dependency order (children before parents).
 */
async function resetDatabase() {
    await pool.query('UPDATE users SET default_workspace_id = NULL');
    await pool.query(`
        TRUNCATE TABLE
            form_responses, form_requests, form_questions, forms,
            training_sets, training_exercise_alternatives, training_exercises,
            training_days, training_plans,
            nutrition_meal_item_alternatives, nutrition_meal_items,
            nutrition_meals, nutrition_cycles, nutrition_plans,
            subscription_freezes, transactions,
            workspace_audit_log, workspace_invitations, workspace_members,
            workspace_subscriptions, clients, workspaces,
            users, admins
        RESTART IDENTITY CASCADE
    `);

    // Re-seed the plans table (required for workspace creation).
    // Plans are not truncated (other workspaces may depend on them across test runs),
    // so use ON CONFLICT DO NOTHING to keep this idempotent.
    await pool.query(`
        INSERT INTO plans (name, display_name, max_team_seats, max_workspaces, price_monthly)
        VALUES
            ('free',       'Free',       1,    1,    0),
            ('starter',    'Starter',    5,    3,    29),
            ('pro',        'Pro',        null, null, 79)
        ON CONFLICT (name) DO NOTHING
    `);
}

/**
 * Create a coach user + default workspace + free plan subscription.
 * Returns { user, workspace, token }
 */
async function createCoach({ email = 'coach@test.com', password = 'password123' } = {}) {
    const hashed = await bcrypt.hash(password, 10);
    const { rows: [user] } = await pool.query(
        `INSERT INTO users (fname, lname, email, password) VALUES ('Test', 'Coach', $1, $2) RETURNING *`,
        [email, hashed]
    );

    const slug = `coach-${user.id}`;
    const { rows: [workspace] } = await pool.query(
        `INSERT INTO workspaces (slug, name, owner_id, slug_customized) VALUES ($1, $2, $3, false) RETURNING *`,
        [slug, "Test Workspace", user.id]
    );

    await pool.query(
        `UPDATE users SET default_workspace_id = $1 WHERE id = $2`,
        [workspace.id, user.id]
    );

    await pool.query(
        `INSERT INTO workspace_subscriptions (workspace_id, plan_id)
         VALUES ($1, (SELECT id FROM plans WHERE name = 'free'))`,
        [workspace.id]
    );

    const token = jwt.sign(
        { userId: user.id, workspaceId: workspace.id, role: 'owner', permissions: null },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
    );

    return { user, workspace, token };
}

/**
 * Create a client belonging to a specific workspace.
 */
async function createClient(workspaceId, { email = 'client@test.com' } = {}) {
    const { rows: [client] } = await pool.query(
        `INSERT INTO clients (client_code, fname, lname, email, workspace_id, subscription_status)
         VALUES (1, 'Test', 'Client', $1, $2, 'Pre-start') RETURNING *`,
        [email, workspaceId]
    );
    return client;
}

module.exports = { resetDatabase, createCoach, createClient };
