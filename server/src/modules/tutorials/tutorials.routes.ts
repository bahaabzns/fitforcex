import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import * as tutorialsController from './tutorials.controller';

const router = Router();

/**
 * @openapi
 * /tutorials:
 *   get:
 *     summary: List all coach-portal tutorial videos (platform-wide, not tenant-scoped)
 *     tags: [Tutorials]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of { page_key, youtube_url, title }
 *       401:
 *         description: Not authenticated
 */
router.get('/', authMiddleware, tutorialsController.listTutorials);

export default router;
