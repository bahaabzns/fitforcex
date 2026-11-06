import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import * as gettingStartedController from './gettingStarted.controller';

const router = Router();

router.use(authMiddleware);

/**
 * @openapi
 * /getting-started:
 *   get:
 *     summary: The new owner's getting-started checklist (hidden for non-owners, old workspaces, dismissed or finished)
 *     tags: [Getting started]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: visible, steps [{ key, done }], doneCount, total, demoClientId, firstRealClientId, portalSlug
 */
router.get('/', gettingStartedController.getStatus);

/**
 * @openapi
 * /getting-started/dismiss:
 *   post:
 *     summary: Hide the checklist for good (owner only)
 *     tags: [Getting started]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Hidden
 *       403:
 *         description: Not the owner
 */
router.post('/dismiss', gettingStartedController.dismiss);

/**
 * @openapi
 * /getting-started/starter-package:
 *   post:
 *     summary: Create one editable starter package linked to the default forms (owner only; no-op if a package exists)
 *     tags: [Getting started]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: { packageId, created }
 *       403:
 *         description: Not the owner
 */
router.post('/starter-package', gettingStartedController.starterPackage);

export default router;
