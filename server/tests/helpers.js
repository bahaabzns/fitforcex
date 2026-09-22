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

    // Verify the reset actually cleared tables
    const { rows: wsRows } = await pool.query('SELECT COUNT(*) FROM workspaces');
    const { rows: userRows } = await pool.query('SELECT COUNT(*) FROM users');
    const { rows: dbRows } = await pool.query('SELECT current_database() AS db');
    console.log(`[resetDatabase] workspaces=${wsRows[0].count} users=${userRows[0].count} db=${dbRows[0].db} DB_NAME=${process.env.DB_NAME}`);

    // Re-seed the plans table (required for workspace creation).
    // Plans are not truncated (other workspaces may depend on them across test runs),
    // so use ON CONFLICT DO NOTHING to keep this idempotent.
    await pool.query(`
        INSERT INTO plans (name, display_name, max_team_seats, price_monthly)
        VALUES
            ('free',       'Free',       1,    0),
            ('starter',    'Starter',    5,    29),
            ('pro',        'Pro',        null, 79)
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

    console.log(`[createCoach] email=${email} user.id=${user.id} workspace.id=${workspace.id}`);
    return { user, workspace, token };
}

/**
 * Create a client belonging to a specific workspace.
 */
async function createClient(workspaceId, { email = 'client@test.com', password = null } = {}) {
    const clientCode = Math.floor(Math.random() * 10000) + 1; // Random unique code
    const hashedPassword = password ? await bcrypt.hash(password, 10) : null;
    
    const { rows: [client] } = await pool.query(
        `INSERT INTO clients (client_code, fname, lname, email, password, workspace_id, subscription_status)
         VALUES ($1, 'Test', 'Client', $2, $3, $4, 'Pre-start') RETURNING *`,
        [clientCode, email, hashedPassword, workspaceId]
    );
    return client;
}

/**
 * Create a training plan for a client.
 */
async function createTrainingPlan(clientId, workspaceId, { name = 'Test Plan', status = 'active' } = {}) {
    const { rows: [plan] } = await pool.query(
        `INSERT INTO training_plans (name, client_id, workspace_id, status)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [name, clientId, workspaceId, status]
    );
    return plan;
}

/**
 * Create a training day within a plan.
 */
async function createTrainingDay(planId, { name = 'Day 1', dayOrder = 1 } = {}) {
    const { rows: [day] } = await pool.query(
        `INSERT INTO training_days (plan_id, name, day_order)
         VALUES ($1, $2, $3) RETURNING *`,
        [planId, name, dayOrder]
    );
    return day;
}

/**
 * Create a nutrition plan for a client.
 */
async function createNutritionPlan(clientId, workspaceId, { name = 'Test Plan', status = 'active' } = {}) {
    const { rows: [plan] } = await pool.query(
        `INSERT INTO nutrition_plans (name, client_id, workspace_id, status)
         VALUES ($1, $2, $3, $4) RETURNING *`,
        [name, clientId, workspaceId, status]
    );
    return plan;
}

/**
 * Create a nutrition cycle within a plan.
 */
async function createNutritionCycle(planId, { name = 'Cycle 1', cycleOrder = 1 } = {}) {
    const { rows: [cycle] } = await pool.query(
        `INSERT INTO nutrition_cycles (plan_id, name, cycle_order)
         VALUES ($1, $2, $3) RETURNING *`,
        [planId, name, cycleOrder]
    );
    return cycle;
}

/**
 * Create a workspace member with a specific role.
 */
async function createWorkspaceMember(workspaceId, userId, { role = 'member' } = {}) {
    const { rows: [member] } = await pool.query(
        `INSERT INTO workspace_members (workspace_id, user_id, role)
         VALUES ($1, $2, $3) RETURNING *`,
        [workspaceId, userId, role]
    );
    return member;
}

/**
 * Create a transaction for a client.
 */
async function createTransaction(clientId, workspaceId, { status = 'completed', duration = 30 } = {}) {
    const { rows: [tx] } = await pool.query(
        `INSERT INTO transactions (client_id, workspace_id, status, duration, start_mode)
         VALUES ($1, $2, $3, $4, 'on_first_plan') RETURNING *`,
        [clientId, workspaceId, status, duration]
    );
    return tx;
}

/**
 * Create a subscription freeze for a client.
 */
async function createSubscriptionFreeze(clientId, { freezeStartDate = new Date().toISOString().split('T')[0], freezeDurationDays = 7 } = {}) {
    const { rows: [freeze] } = await pool.query(
        `INSERT INTO subscription_freezes (client_id, freeze_start_date, freeze_duration_days)
         VALUES ($1, $2, $3) RETURNING *`,
        [clientId, freezeStartDate, freezeDurationDays]
    );
    return freeze;
}

module.exports = {
    resetDatabase,
    createCoach,
    createClient,
    createTrainingPlan,
    createTrainingDay,
    createNutritionPlan,
    createNutritionCycle,
    createWorkspaceMember,
    createTransaction,
    createSubscriptionFreeze,
};
