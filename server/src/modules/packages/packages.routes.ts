import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import subscriptionAccessGate from '../../middleware/subscriptionAccessGate';
import requirePermission, { requireAnyPermission } from '../../middleware/requirePermission';
import * as packagesController from './packages.controller';

const router = Router();

router.use(authMiddleware, subscriptionAccessGate);
router.use((req, res, next) => {
    // Reading the package catalog isn't finance-only: it's needed wherever a client
    // gets assigned a package variation (Clients page, client transactions), so any
    // role that can read clients is let in too. Creating/editing/deleting packages
    // (pricing, cycles) stays a finance.write/delete action — see DEBT.md.
    if (req.method === 'GET') {
        requireAnyPermission([['finance', 'read'], ['clients', 'read']])(req, res, next);
        return;
    }
    const action = req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('finance', action)(req, res, next);
});

/**
 * @openapi
 * /packages:
 *   get:
 *     summary: List all service packages in the workspace
 *     tags: [Packages]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of packages
 *   post:
 *     summary: Create a service package
 *     tags: [Packages]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, price]
 *             properties:
 *               name:  { type: string }
 *               price: { type: number }
 *     responses:
 *       201:
 *         description: Package created
 *   put:
 *     summary: Update a service package
 *     tags: [Packages]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Package updated
 *   delete:
 *     summary: Delete a service package
 *     tags: [Packages]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Package deleted
 */
router.get('/',    packagesController.getPackages);
router.post('/',   packagesController.createPackage);
router.put('/',    packagesController.updatePackage);
router.delete('/', packagesController.deletePackage);

export default router;
