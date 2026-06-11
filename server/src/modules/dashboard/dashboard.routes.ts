import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import * as dashboardController from './dashboard.controller';

const router = Router();

/**
 * @openapi
 * /dashboard:
 *   get:
 *     summary: Get dashboard summary stats for the workspace
 *     tags: [Dashboard]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Dashboard stats including client counts, plan stats, and recent activity
 *       401:
 *         description: Not authenticated
 */
router.get('/', authMiddleware, dashboardController.getDashboard);

export default router;
