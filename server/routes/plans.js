const express = require('express');
const router = express.Router();
const pool = require('../db');

router.get('/', async (req, res, next) => {
    const billingContext = req.query.billing === 'true';
    try {
        const { rows: plans } = await pool.query(`
            SELECT
                id, name, display_name, subtitle,
                price_monthly, price_per_seat, min_seat_count, max_seat_count,
                currency, is_popular, cta_text, cta_variant, payment_link,
                features_header, features_subheader, has_team_counter, features
            FROM plans
            WHERE is_active = true AND (show_on_landing = true OR $1 = true)
            ORDER BY sort_order ASC, id ASC
        `, [billingContext]);

        if (plans.length === 0) return res.json([]);

        const planIds = plans.map(p => p.id);
        const { rows: links } = await pool.query(`
            SELECT ppl.plan_id, bd.period_key, ppl.payment_link
            FROM plan_period_links ppl
            JOIN billing_discounts bd ON bd.id = ppl.billing_discount_id
            WHERE ppl.plan_id = ANY($1) AND ppl.payment_link IS NOT NULL
        `, [planIds]);

        // Build a map: { [plan_id]: { [period_key]: payment_link } }
        const linkMap = {};
        links.forEach(({ plan_id, period_key, payment_link }) => {
            if (!linkMap[plan_id]) linkMap[plan_id] = {};
            linkMap[plan_id][period_key] = payment_link;
        });

        const result = plans.map(p => ({ ...p, period_links: linkMap[p.id] ?? {} }));
        res.json(result);
    } catch (err) {
        next(err);
    }
});

router.get('/billing-discounts', async (req, res, next) => {
    try {
        const { rows } = await pool.query(`
            SELECT id, period_key, label, save_label, discount_percent, months
            FROM billing_discounts
            WHERE is_active = true
            ORDER BY sort_order ASC
        `);
        res.json(rows);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
