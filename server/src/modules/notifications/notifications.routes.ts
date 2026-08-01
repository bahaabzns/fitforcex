import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import subscriptionAccessGate from '../../middleware/subscriptionAccessGate';
import * as notificationsController from './notifications.controller';

const router = Router();

router.use(authMiddleware, subscriptionAccessGate);

/**
 * @openapi
 * /notifications:
 *   get:
 *     summary: List the current user's notifications (newest first)
 *     tags: [Notifications]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: query, name: unread, required: false, schema: { type: boolean }, description: When true, only unread notifications }
 *       - { in: query, name: limit,  required: false, schema: { type: integer, default: 30, maximum: 100 } }
 *     responses:
 *       200: { description: Array of notifications }
 *       401: { description: Not authenticated }
 *
 * /notifications/unread-count:
 *   get:
 *     summary: Count the current user's unread notifications (bell badge)
 *     tags: [Notifications]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: "{ count: number }" }
 *
 * /notifications/read-all:
 *   patch:
 *     summary: Mark all of the current user's notifications as read
 *     tags: [Notifications]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: "{ updated: number }" }
 *
 * /notifications/{id}/read:
 *   patch:
 *     summary: Mark a single notification as read
 *     tags: [Notifications]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: "{ updated: number }" }
 *       404: { description: Notification not found }
 */

// Specific routes before the parameterized one (CLAUDE.md §8.6).
router.get('/',              notificationsController.listNotifications);
router.get('/unread-count',  notificationsController.getUnreadCount);
router.patch('/read-all',    notificationsController.markAllRead);
router.patch('/:id/read',    notificationsController.markRead);

export default router;
