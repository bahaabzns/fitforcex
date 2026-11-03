import { Router } from 'express';
import * as plansController from './plans.controller';
import { readLimiter } from '../../middleware/rateLimit';

const router = Router();

/**
 * @openapi
 * /plans:
 *   get:
 *     summary: List all available subscription plans (public)
 *     tags: [Plans]
 *     security: []
 *     responses:
 *       200:
 *         description: Array of subscription plans with seat limits and pricing
 *
 * /plans/landing-stats:
 *   get:
 *     summary: Aggregate coach, client and plan counts for the landing page (public, cached)
 *     tags: [Plans]
 *     security: []
 *     responses:
 *       200:
 *         description: Object with coaches, clients and plans totals
 *
 * /plans/billing-discounts:
 *   get:
 *     summary: List available billing discounts (public)
 *     tags: [Plans]
 *     security: []
 *     responses:
 *       200:
 *         description: Array of discount codes and their values
 */
router.get('/', plansController.getPlans);
router.get('/billing-discounts', plansController.getBillingDiscounts);
router.get('/landing-stats', readLimiter, plansController.getLandingStats);

export default router;
