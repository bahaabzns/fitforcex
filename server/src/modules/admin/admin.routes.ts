import { Router } from 'express';
import adminAuthMiddleware from '../../middleware/adminAuth';
import { loginLimiter } from '../../middleware/rateLimit';
import * as adminController from './admin.controller';

const router = Router();

/**
 * @openapi
 * /admin/login:
 *   post:
 *     summary: Admin login (management subdomain only in production)
 *     tags: [Admin]
 *     security: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:    { type: string, format: email }
 *               password: { type: string }
 *     responses:
 *       200:
 *         description: Admin authenticated; cookie set
 *       401:
 *         description: Invalid credentials
 *
 * /admin/me:
 *   get:
 *     summary: Get the authenticated admin's profile
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Admin profile
 *
 * /admin/logout:
 *   post:
 *     summary: Log out of the admin panel
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logged out
 */
router.post('/login',  loginLimiter, adminController.adminLogin);
router.get('/me',      adminAuthMiddleware, adminController.adminMe);
router.post('/logout', adminAuthMiddleware, adminController.adminLogout);

/**
 * @openapi
 * /admin/stats:
 *   get:
 *     summary: Get platform-wide aggregate statistics
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Platform stats
 *
 * /admin/users:
 *   get:
 *     summary: List all registered users
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of users
 *
 * /admin/users/{id}:
 *   get:
 *     summary: Get a user by ID
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: User details
 */
router.get('/stats',     adminAuthMiddleware, adminController.getStats);
router.get('/users',     adminAuthMiddleware, adminController.getUsers);
router.get('/users/:id', adminAuthMiddleware, adminController.getUserById);

/**
 * @openapi
 * /admin/workspaces:
 *   get:
 *     summary: List all workspaces
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of workspaces
 *
 * /admin/workspaces/{id}:
 *   get:
 *     summary: Get a workspace by ID
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Workspace details
 *
 * /admin/workspaces/{id}/subscription:
 *   put:
 *     summary: Override a workspace's subscription
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Subscription updated
 *
 * /admin/workspaces/{id}/restore:
 *   post:
 *     summary: Restore an archived workspace
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Workspace restored
 *
 * /admin/workspaces/{id}/archive:
 *   post:
 *     summary: Archive a workspace
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Workspace archived
 */
router.get('/workspaces',                  adminAuthMiddleware, adminController.getWorkspaces);
router.get('/workspaces/:id',              adminAuthMiddleware, adminController.getWorkspaceById);
router.put('/workspaces/:id/subscription', adminAuthMiddleware, adminController.updateWorkspaceSubscription);
router.post('/workspaces/:id/restore',     adminAuthMiddleware, adminController.restoreWorkspace);
router.post('/workspaces/:id/archive',     adminAuthMiddleware, adminController.archiveWorkspace);

/**
 * @openapi
 * /admin/plans:
 *   get:
 *     summary: List all subscription plans (admin)
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of plans
 *   post:
 *     summary: Create a subscription plan
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201:
 *         description: Plan created
 *
 * /admin/plans/{id}:
 *   put:
 *     summary: Update a subscription plan
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Plan updated
 *   delete:
 *     summary: Delete a subscription plan
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Plan deleted
 *
 * /admin/billing-discounts:
 *   get:
 *     summary: List billing discounts
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of billing discounts
 *
 * /admin/billing-discounts/{id}:
 *   put:
 *     summary: Update a billing discount
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Discount updated
 */
router.get('/plans',               adminAuthMiddleware, adminController.getPlans);
router.post('/plans',              adminAuthMiddleware, adminController.createPlan);
router.put('/plans/:id',           adminAuthMiddleware, adminController.updatePlan);
router.delete('/plans/:id',        adminAuthMiddleware, adminController.deletePlan);

router.get('/billing-discounts',       adminAuthMiddleware, adminController.getBillingDiscounts);
router.put('/billing-discounts/:id',   adminAuthMiddleware, adminController.updateBillingDiscount);

/**
 * @openapi
 * /admin/payments/stats:
 *   get:
 *     summary: Get payment aggregate stats
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Payment statistics
 *
 * /admin/payments:
 *   get:
 *     summary: List all payment records
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of payments
 *
 * /admin/payments/{id}/mark-paid:
 *   post:
 *     summary: Manually mark a payment as paid
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Payment marked as paid
 *
 * /admin/payments/{id}/status:
 *   patch:
 *     summary: Update a payment status
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Status updated
 */
router.get('/payments/stats',              adminAuthMiddleware, adminController.getPaymentStats);
router.get('/payments',                    adminAuthMiddleware, adminController.getPayments);
router.post('/payments/:id/mark-paid',     adminAuthMiddleware, adminController.markPaymentPaid);
router.patch('/payments/:id/status',       adminAuthMiddleware, adminController.updatePaymentStatus);

export default router;
