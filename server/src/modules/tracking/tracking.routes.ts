import { Router } from 'express';
import * as trackingController from './tracking.controller';
import { trackLimiter } from '../../middleware/rateLimit';

const router = Router();

/**
 * @openapi
 * /track/visit:
 *   post:
 *     summary: Record an anonymous public-page visit (public, rate-limited)
 *     tags: [Tracking]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [visitorId, path]
 *             properties:
 *               visitorId: { type: string, format: uuid }
 *               path: { type: string }
 *               referrer: { type: string, nullable: true }
 *               utmSource: { type: string, nullable: true }
 *               utmMedium: { type: string, nullable: true }
 *               utmCampaign: { type: string, nullable: true }
 *               hasFbclid: { type: boolean }
 *     responses:
 *       204:
 *         description: Visit recorded (or ignored for bots)
 *       400:
 *         description: Invalid payload
 */
router.post('/visit', trackLimiter, trackingController.trackVisit);

export default router;
