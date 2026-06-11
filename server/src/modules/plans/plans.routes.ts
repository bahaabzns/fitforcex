import { Router } from 'express';
import * as plansController from './plans.controller';

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

export default router;
