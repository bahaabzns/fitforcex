const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const clientAuthMiddleware = require('../middleware/clientAuth');

// POST /api/client-portal/login
router.post('/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ message: 'Email and password are required' });
    }

    try {
        const result = await pool.query(
            'SELECT * FROM clients WHERE email = $1',
            [email]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const client = result.rows[0];

        if (!client.password) {
            return res.status(401).json({ message: 'Account not activated. Contact your coach.' });
        }

        const match = await bcrypt.compare(password, client.password);
        if (!match) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        const token = jwt.sign(
            { id: client.id, coach_id: client.coach_id },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        res.cookie('client_token', token, {
            httpOnly: true,
            maxAge: 7 * 24 * 60 * 60 * 1000,
        }).status(200).json({ message: 'Login successful' });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Login failed' });
    }
});

// POST /api/client-portal/logout
router.post('/logout', (req, res) => {
    res.clearCookie('client_token').status(200).json({ message: 'Logged out' });
});

// GET /api/client-portal/me  — protected
router.get('/me', clientAuthMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT id, fname, lname, email, phone, client_code, coach_id FROM clients WHERE id = $1',
            [req.client.id]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ message: 'Client not found' });
        }
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/client-portal/active-plan  — protected
router.get('/active-plan', clientAuthMiddleware, async (req, res) => {
    try {
        const planResult = await pool.query(
            `SELECT * FROM nutrition_plans
             WHERE client_id = $1 AND status = 'active'
             ORDER BY updated_at DESC
             LIMIT 1`,
            [req.client.id]
        );

        if (planResult.rows.length === 0) {
            return res.status(404).json({ message: 'No active plan found' });
        }

        const plan = planResult.rows[0];

        const cyclesResult = await pool.query(
            'SELECT * FROM nutrition_cycles WHERE plan_id = $1 ORDER BY cycle_order ASC',
            [plan.id]
        );

        const cycles = await Promise.all(
            cyclesResult.rows.map(async (cycle) => {
                const mealsResult = await pool.query(
                    'SELECT * FROM nutrition_meals WHERE cycle_id = $1 ORDER BY meal_order ASC',
                    [cycle.id]
                );

                const mealsWithItems = await Promise.all(
                    mealsResult.rows.map(async (meal) => {
                        const itemsResult = await pool.query(
                            `SELECT nmi.id, nmi.food_item_id, nmi.amount, nmi.meal_item_order,
                                    fi.name, fi.serving_unit, fi.calories_per_serving,
                                    fi.protein_per_serving, fi.carbs_per_serving, fi.fats_per_serving,
                                    fi.serving_size, fi.food_category
                             FROM nutrition_meal_items nmi
                             JOIN food_items fi ON fi.id = nmi.food_item_id
                             WHERE nmi.meal_id = $1
                             ORDER BY nmi.meal_item_order ASC`,
                            [meal.id]
                        );

                        const itemsWithAlts = await Promise.all(
                            itemsResult.rows.map(async (item) => {
                                const altsResult = await pool.query(
                                    `SELECT nmia.id, nmia.meal_item_id, nmia.food_item_id, nmia.amount, nmia.alt_order,
                                            fi.name, fi.serving_unit, fi.calories_per_serving,
                                            fi.protein_per_serving, fi.carbs_per_serving, fi.fats_per_serving,
                                            fi.serving_size, fi.food_category
                                     FROM nutrition_meal_item_alternatives nmia
                                     JOIN food_items fi ON fi.id = nmia.food_item_id
                                     WHERE nmia.meal_item_id = $1
                                     ORDER BY nmia.alt_order ASC`,
                                    [item.id]
                                );
                                return { ...item, alternatives: altsResult.rows };
                            })
                        );

                        return { ...meal, items: itemsWithAlts };
                    })
                );

                return { ...cycle, meals: mealsWithItems };
            })
        );

        res.json({ ...plan, cycles });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── Form Requests (client side) ───────────────────────────────────────────────

// GET /api/client-portal/form-requests — list all form requests for this client
router.get('/form-requests', clientAuthMiddleware, async (req, res) => {
    try {
        const result = await pool.query(
            `SELECT fr.id, fr.status, fr.requested_at, fr.submitted_at,
                    f.id AS form_id, f.title AS form_title, f.description AS form_description
             FROM form_requests fr
             JOIN forms f ON f.id = fr.form_id
             WHERE fr.client_id = $1
             ORDER BY fr.requested_at DESC`,
            [req.client.id]
        );
        res.json(result.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// GET /api/client-portal/form-requests/:request_id — get form + questions for a specific request
router.get('/form-requests/:request_id', clientAuthMiddleware, async (req, res) => {
    try {
        const reqResult = await pool.query(
            `SELECT fr.id, fr.status, fr.requested_at, fr.submitted_at,
                    f.id AS form_id, f.title AS form_title, f.description AS form_description
             FROM form_requests fr
             JOIN forms f ON f.id = fr.form_id
             WHERE fr.id = $1 AND fr.client_id = $2`,
            [req.params.request_id, req.client.id]
        );
        if (reqResult.rows.length === 0) return res.status(404).json({ error: 'Request not found' });

        const request = reqResult.rows[0];

        const questions = await pool.query(
            'SELECT * FROM form_questions WHERE form_id = $1 ORDER BY order_index ASC, id ASC',
            [request.form_id]
        );

        let responses = [];
        if (request.status === 'submitted') {
            const respResult = await pool.query(
                'SELECT question_id, answer FROM form_responses WHERE request_id = $1',
                [request.id]
            );
            responses = respResult.rows;
        }

        res.json({ ...request, questions: questions.rows, responses });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/client-portal/form-requests/:request_id/submit — submit answers
router.post('/form-requests/:request_id/submit', clientAuthMiddleware, async (req, res) => {
    const { answers } = req.body; // [{ question_id, answer }]
    if (!answers || !Array.isArray(answers)) {
        return res.status(400).json({ error: 'answers array is required' });
    }
    try {
        const reqResult = await pool.query(
            `SELECT fr.id, fr.form_id FROM form_requests fr
             WHERE fr.id = $1 AND fr.client_id = $2 AND fr.status = 'pending'`,
            [req.params.request_id, req.client.id]
        );
        if (reqResult.rows.length === 0) {
            return res.status(404).json({ error: 'Request not found or already submitted' });
        }

        for (const { question_id, answer } of answers) {
            await pool.query(
                'INSERT INTO form_responses (request_id, question_id, answer) VALUES ($1, $2, $3)',
                [req.params.request_id, question_id, answer ?? '']
            );
        }

        await pool.query(
            `UPDATE form_requests SET status = 'submitted', submitted_at = NOW() WHERE id = $1`,
            [req.params.request_id]
        );

        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
