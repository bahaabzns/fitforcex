import { Router } from 'express';
import adminAuthMiddleware from '../../middleware/adminAuth';
import { loginLimiter } from '../../middleware/rateLimit';
import * as adminController from './admin.controller';

const router = Router();

// ── Auth ──────────────────────────────────────────────────────────────────────
router.post('/login',  loginLimiter, adminController.adminLogin);
router.get('/me',      adminAuthMiddleware, adminController.adminMe);
router.post('/logout', adminAuthMiddleware, adminController.adminLogout);

// ── Stats ─────────────────────────────────────────────────────────────────────
router.get('/stats', adminAuthMiddleware, adminController.getStats);

// ── Users ─────────────────────────────────────────────────────────────────────
router.get('/users',     adminAuthMiddleware, adminController.getUsers);
router.get('/users/:id', adminAuthMiddleware, adminController.getUserById);

// ── Workspaces ────────────────────────────────────────────────────────────────
router.get('/workspaces',                    adminAuthMiddleware, adminController.getWorkspaces);
router.get('/workspaces/:id',                adminAuthMiddleware, adminController.getWorkspaceById);
router.put('/workspaces/:id/subscription',   adminAuthMiddleware, adminController.updateWorkspaceSubscription);
router.post('/workspaces/:id/restore',       adminAuthMiddleware, adminController.restoreWorkspace);
router.post('/workspaces/:id/archive',       adminAuthMiddleware, adminController.archiveWorkspace);

// ── Plans ─────────────────────────────────────────────────────────────────────
router.get('/plans',       adminAuthMiddleware, adminController.getPlans);
router.post('/plans',      adminAuthMiddleware, adminController.createPlan);
router.put('/plans/:id',   adminAuthMiddleware, adminController.updatePlan);
router.delete('/plans/:id', adminAuthMiddleware, adminController.deletePlan);

// ── Billing Discounts ─────────────────────────────────────────────────────────
router.get('/billing-discounts',       adminAuthMiddleware, adminController.getBillingDiscounts);
router.put('/billing-discounts/:id',   adminAuthMiddleware, adminController.updateBillingDiscount);

// ── Payments ──────────────────────────────────────────────────────────────────
router.get('/payments/stats',              adminAuthMiddleware, adminController.getPaymentStats);
router.get('/payments',                    adminAuthMiddleware, adminController.getPayments);
router.post('/payments/:id/mark-paid',     adminAuthMiddleware, adminController.markPaymentPaid);
router.patch('/payments/:id/status',       adminAuthMiddleware, adminController.updatePaymentStatus);

export default router;
