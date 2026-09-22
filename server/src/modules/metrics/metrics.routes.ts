import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import subscriptionAccessGate from '../../middleware/subscriptionAccessGate';
import requirePermission from '../../middleware/requirePermission';
import * as metricsController from './metrics.controller';

const router = Router();

router.use(authMiddleware, subscriptionAccessGate);

/**
 * @openapi
 * /metrics:
 *   get:
 *     summary: List all active metrics for the workspace (auto-seeds defaults on first call)
 *     tags: [Metrics]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of metrics ordered by name
 *   post:
 *     summary: Create a custom metric
 *     tags: [Metrics]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, type]
 *             properties:
 *               name:        { type: string }
 *               type:        { type: string, enum: [number, image] }
 *               unit:        { type: string, nullable: true }
 *               icon:        { type: string, nullable: true }
 *               description: { type: string, nullable: true }
 *     responses:
 *       201:
 *         description: Metric created
 *       409:
 *         description: Name already in use
 *
 * /metrics/{id}:
 *   put:
 *     summary: Rename or update a metric (historical answers stay linked by id)
 *     tags: [Metrics]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Metric updated
 *   delete:
 *     summary: Soft-delete a metric (historical answers are preserved)
 *     tags: [Metrics]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Metric soft-deleted
 */
router.get('/',      requirePermission('forms', 'read'),   metricsController.listMetrics);
router.post('/',     requirePermission('forms', 'write'),  metricsController.createMetric);
router.put('/:id',   requirePermission('forms', 'write'),  metricsController.updateMetric);
router.delete('/:id', requirePermission('forms', 'delete'), metricsController.deleteMetric);

export default router;
