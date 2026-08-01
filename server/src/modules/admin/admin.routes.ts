import { Router } from 'express';
import adminAuthMiddleware from '../../middleware/adminAuth';
import { loginLimiter } from '../../middleware/rateLimit';
import * as adminController from './admin.controller';
import * as libraryController from './defaultLibraries.controller';
import * as templateController from './adminFormTemplates.controller';
import insightsAdminRouter from '../insights/insightsAdmin.routes';

const router = Router();

// The Insights System's admin surface (Insights inbox, Prompts, Roadmap) —
// mounted here rather than as its own top-level /api/admin/insights router so
// it goes through the exact same subdomain/auth gate as every other admin
// route without a second registration in app.ts.
router.use(insightsAdminRouter);

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
 *
 * /admin/workspaces/{id}/resync-price:
 *   post:
 *     summary: Opt a workspace into its variation's current public price (no payment)
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Locked price resynced
 *
 * /admin/workspaces/{id}/manual-payment:
 *   post:
 *     summary: Record a payment that happened outside Fawaterak and activate it immediately
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [planId, variationId]
 *             properties:
 *               planId:      { type: string }
 *               variationId: { type: string }
 *               amount:       { type: number }
 *               currency:     { type: string }
 *               durationDays: { type: integer }
 *               notes:        { type: string }
 *     responses:
 *       201:
 *         description: Payment recorded and subscription activated
 */
router.get('/workspaces',                     adminAuthMiddleware, adminController.getWorkspaces);
router.get('/workspaces/:id',                 adminAuthMiddleware, adminController.getWorkspaceById);
router.put('/workspaces/:id/subscription',    adminAuthMiddleware, adminController.updateWorkspaceSubscription);
router.post('/workspaces/:id/manual-payment', adminAuthMiddleware, adminController.createManualPayment);
router.post('/workspaces/:id/resync-price',   adminAuthMiddleware, adminController.resyncSubscriptionPrice);
router.post('/workspaces/:id/restore',        adminAuthMiddleware, adminController.restoreWorkspace);
router.post('/workspaces/:id/archive',        adminAuthMiddleware, adminController.archiveWorkspace);

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
 * /admin/addons:
 *   get:
 *     summary: List all add-ons (catalog)
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of add-ons
 *   post:
 *     summary: Create an add-on
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201:
 *         description: Add-on created
 *
 * /admin/addons/{id}:
 *   put:
 *     summary: Update an add-on
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Add-on updated
 *   delete:
 *     summary: Delete an add-on
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       204:
 *         description: Add-on deleted
 *
 * /admin/trial-settings:
 *   get:
 *     summary: Get the global trial toggle/duration
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Trial settings
 *   put:
 *     summary: Update the global trial toggle/duration
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Trial settings updated
 */
router.get('/addons',           adminAuthMiddleware, adminController.getAddons);
router.post('/addons',          adminAuthMiddleware, adminController.createAddon);
router.put('/addons/:id',       adminAuthMiddleware, adminController.updateAddon);
router.delete('/addons/:id',    adminAuthMiddleware, adminController.deleteAddon);

router.get('/trial-settings',   adminAuthMiddleware, adminController.getTrialSettings);
router.put('/trial-settings',   adminAuthMiddleware, adminController.updateTrialSettings);

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

/**
 * @openapi
 * /admin/libraries/{resource}:
 *   get:
 *     summary: "List Default Library records (resource: muscle-groups, equipment, exercises, food-categories, food-items)"
 *     tags: [Admin, DefaultLibraries]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: resource, required: true, schema: { type: string } }
 *       - { in: query, name: search, schema: { type: string } }
 *       - { in: query, name: limit, schema: { type: integer } }
 *       - { in: query, name: offset, schema: { type: integer } }
 *     responses:
 *       200: { description: "records and total count" }
 *   post:
 *     summary: Create a Default Library record
 *     tags: [Admin, DefaultLibraries]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: resource, required: true, schema: { type: string } }
 *     responses:
 *       201: { description: Record created }
 *
 * /admin/libraries/{resource}/import:
 *   post:
 *     summary: "Bulk-import Default Library records from a records array"
 *     tags: [Admin, DefaultLibraries]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: resource, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: "imported, skipped and errors summary" }
 *
 * /admin/libraries/{resource}/seed-workspace:
 *   post:
 *     summary: "Clone this resource's master rows into a chosen workspace (dedupes by name_en)"
 *     tags: [Admin, DefaultLibraries]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: resource, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [workspace_id]
 *             properties:
 *               workspace_id: { type: string }
 *     responses:
 *       200: { description: "seeded and skipped counts" }
 *       404: { description: Workspace not found }
 *
 * /admin/libraries/{resource}/{id}:
 *   put:
 *     summary: Update a Default Library record
 *     tags: [Admin, DefaultLibraries]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: resource, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Record updated }
 *   delete:
 *     summary: Delete a Default Library record
 *     tags: [Admin, DefaultLibraries]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: resource, required: true, schema: { type: string } }
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       204: { description: Record deleted }
 */
// Specific (/import, /seed-workspace) before parameterized (/:id) so they are not shadowed.
router.get('/libraries/:resource',                  adminAuthMiddleware, libraryController.listRecords);
router.post('/libraries/:resource',                 adminAuthMiddleware, libraryController.createRecord);
router.post('/libraries/:resource/import',          adminAuthMiddleware, libraryController.importRecords);
router.post('/libraries/:resource/seed-workspace',  adminAuthMiddleware, libraryController.seedWorkspace);
router.put('/libraries/:resource/:id',              adminAuthMiddleware, libraryController.updateRecord);
router.delete('/libraries/:resource/:id',           adminAuthMiddleware, libraryController.deleteRecord);

/**
 * @openapi
 * /admin/forms-templates:
 *   get:
 *     summary: List all Master Form Templates (default Assessment & Check-In forms)
 *     tags: [Admin, FormTemplates]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: "Array of templates with question_count" }
 *   post:
 *     summary: Create a Master Form Template
 *     tags: [Admin, FormTemplates]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201: { description: Template created }
 *
 * /admin/forms-templates/{id}:
 *   put:
 *     summary: Update a Master Form Template
 *     tags: [Admin, FormTemplates]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Template updated }
 *   delete:
 *     summary: Delete a Master Form Template
 *     tags: [Admin, FormTemplates]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Template deleted }
 *
 * /admin/forms-templates/{id}/questions:
 *   get:
 *     summary: List questions for a Master Form Template
 *     tags: [Admin, FormTemplates]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Array of questions }
 *   post:
 *     summary: Add a question to a Master Form Template
 *     tags: [Admin, FormTemplates]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       201: { description: Question created }
 *
 * /admin/forms-templates/{id}/questions/reorder:
 *   put:
 *     summary: Reorder questions in a Master Form Template
 *     tags: [Admin, FormTemplates]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Questions reordered }
 *
 * /admin/forms-templates/{id}/questions/{qid}:
 *   put:
 *     summary: Update a question in a Master Form Template
 *     tags: [Admin, FormTemplates]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: qid, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Question updated }
 *   delete:
 *     summary: Delete a question from a Master Form Template
 *     tags: [Admin, FormTemplates]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: qid, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Question deleted }
 */
// Specific (/questions/reorder) before parameterized (/questions/:qid) so it is not shadowed.
router.get('/forms-templates',                          adminAuthMiddleware, templateController.listTemplates);
router.post('/forms-templates',                         adminAuthMiddleware, templateController.createTemplate);
router.put('/forms-templates/:id',                      adminAuthMiddleware, templateController.updateTemplate);
router.delete('/forms-templates/:id',                   adminAuthMiddleware, templateController.deleteTemplate);
router.get('/forms-templates/:id/questions',            adminAuthMiddleware, templateController.getTemplateQuestions);
router.post('/forms-templates/:id/questions',           adminAuthMiddleware, templateController.createTemplateQuestion);
router.put('/forms-templates/:id/questions/reorder',    adminAuthMiddleware, templateController.reorderTemplateQuestions);
router.put('/forms-templates/:id/questions/:qid',       adminAuthMiddleware, templateController.updateTemplateQuestion);
router.delete('/forms-templates/:id/questions/:qid',    adminAuthMiddleware, templateController.deleteTemplateQuestion);
router.post('/forms-templates/:id/save-draft',          adminAuthMiddleware, templateController.saveTemplateDraft);

export default router;
