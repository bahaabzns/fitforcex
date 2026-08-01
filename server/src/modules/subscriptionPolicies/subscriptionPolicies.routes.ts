import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import subscriptionAccessGate from '../../middleware/subscriptionAccessGate';
import requirePermission from '../../middleware/requirePermission';
import * as controller from './subscriptionPolicies.controller';

const router = Router();

router.use(authMiddleware, subscriptionAccessGate);
router.use((req, res, next) => {
    const action = req.method === 'GET' ? 'read' : 'write';
    requirePermission('finance', action)(req, res, next);
});

/**
 * @openapi
 * /subscription-policies:
 *   get:
 *     summary: Get the workspace global Expired & Frozen access policies
 *     tags: [Subscription Policies]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: "{ expired, frozen } policy objects (defaults if never saved)"
 *   put:
 *     summary: Replace the workspace global Expired & Frozen access policies
 *     tags: [Subscription Policies]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [expired, frozen]
 *             properties:
 *               expired: { type: object }
 *               frozen:  { type: object }
 *     responses:
 *       200:
 *         description: Updated policies
 *       400:
 *         description: Validation failed
 */
router.get('/', controller.getPolicies);
router.put('/', controller.updatePolicies);

/**
 * @openapi
 * /subscription-policies/packages/{packageId}:
 *   get:
 *     summary: Get a package's policy overrides (null scope = uses global)
 *     tags: [Subscription Policies]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: packageId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: "{ expired: object|null, frozen: object|null }"
 *       404:
 *         description: Package not found
 *   put:
 *     summary: Set or clear a package's policy overrides
 *     tags: [Subscription Policies]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: packageId, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               expired: { type: object, nullable: true }
 *               frozen:  { type: object, nullable: true }
 *     responses:
 *       200:
 *         description: Updated overrides
 *       404:
 *         description: Package not found
 */
router.get('/packages/:packageId', controller.getPackagePolicy);
router.put('/packages/:packageId', controller.updatePackagePolicy);

export default router;
