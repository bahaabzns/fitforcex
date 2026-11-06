import { Router, Request, Response, NextFunction } from 'express';
import authMiddleware from '../../middleware/auth';
import requirePermission from '../../middleware/requirePermission';
import * as demoClientController from './demoClient.controller';

const router = Router();

router.use(authMiddleware);
router.use((req: Request, res: Response, next: NextFunction) => {
    requirePermission('clients', req.method === 'GET' ? 'read' : 'write')(req, res, next);
});

/**
 * @openapi
 * /demo-client:
 *   get:
 *     summary: Create the demo client on first call (if eligible) and return its status
 *     tags: [Demo client]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: hasDemoClient, demoClientId, showWelcome, portalSlug, login
 *   delete:
 *     summary: Delete the demo client and all its demo data (it never comes back)
 *     tags: [Demo client]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Deleted
 *       404:
 *         description: No demo client
 */
router.get('/', demoClientController.getStatus);
router.delete('/', demoClientController.removeDemoClient);

/**
 * @openapi
 * /demo-client/welcome-seen:
 *   post:
 *     summary: Mark the one-time demo welcome screen as seen
 *     tags: [Demo client]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Recorded
 */
router.post('/welcome-seen', demoClientController.acknowledgeWelcome);

export default router;
