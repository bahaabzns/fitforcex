import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import subscriptionAccessGate from '../../middleware/subscriptionAccessGate';
import requirePermission from '../../middleware/requirePermission';
import * as operationsController from './operations.controller';

const router = Router();

router.use(authMiddleware, subscriptionAccessGate);

/**
 * @openapi
 * /operations/summary:
 *   get:
 *     summary: Plan demand vs team capacity (owner/manager see the team; plan-producing roles see only their own row)
 *     tags: [Operations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: query, name: horizonDays, schema: { type: integer, enum: [1, 3, 7] } }
 *       - { in: query, name: package, schema: { type: string }, description: "Exact package name, or __none__" }
 *       - { in: query, name: action, schema: { type: string, enum: [nutrition, workout] } }
 *       - { in: query, name: type, schema: { type: string, enum: [assessment, check-in] } }
 *     responses:
 *       200: { description: Operations summary }
 *       403: { description: Role cannot see this dashboard }
 */
router.get('/summary', requirePermission('forms', 'read'), operationsController.getSummary);

/**
 * @openapi
 * /operations/demand-trend:
 *   get:
 *     summary: Plans submitted per day (area chart data), owner/manager only
 *     tags: [Operations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: query, name: days, schema: { type: integer, enum: [1, 7, 30, 90] } }
 *       - { in: query, name: from, schema: { type: string, format: date }, description: "Custom range start (with `to`); overrides `days`, max 366 days" }
 *       - { in: query, name: to, schema: { type: string, format: date } }
 *       - { in: query, name: timeZone, schema: { type: string }, description: "IANA zone used to bucket days; falls back to UTC" }
 *       - { in: query, name: package, schema: { type: string } }
 *       - { in: query, name: action, schema: { type: string, enum: [nutrition, workout] } }
 *       - { in: query, name: type, schema: { type: string, enum: [assessment, check-in] } }
 *     responses:
 *       200: { description: "{ days, timeZone, points: [{ date, count }], total, currentDailyCapacity }" }
 *       403: { description: Not an owner or manager }
 */
router.get('/demand-trend', requirePermission('forms', 'read'), operationsController.getDemandTrend);

/**
 * @openapi
 * /operations/kpi-trend:
 *   get:
 *     summary: Last 14 days of waiting plans, team capacity and how full the team was (owner/manager only)
 *     tags: [Operations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: query, name: timeZone, schema: { type: string } }
 *       - { in: query, name: package, schema: { type: string } }
 *       - { in: query, name: action, schema: { type: string, enum: [nutrition, workout] } }
 *       - { in: query, name: type, schema: { type: string, enum: [assessment, check-in] } }
 *     responses:
 *       200: { description: "{ from, to, timeZone, points: [{ date, waiting, capacity, fullPct }] }" }
 *       403: { description: Not an owner or manager }
 */
router.get('/kpi-trend', requirePermission('forms', 'read'), operationsController.getKpiTrend);

/**
 * @openapi
 * /operations/finished-trend:
 *   get:
 *     summary: Plans each team member finished per day (owner/manager: everyone; trainers: own row only)
 *     tags: [Operations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: query, name: days, schema: { type: integer, enum: [1, 7, 30, 90] } }
 *       - { in: query, name: from, schema: { type: string, format: date } }
 *       - { in: query, name: to, schema: { type: string, format: date } }
 *       - { in: query, name: timeZone, schema: { type: string } }
 *       - { in: query, name: package, schema: { type: string } }
 *       - { in: query, name: action, schema: { type: string, enum: [nutrition, workout] } }
 *       - { in: query, name: type, schema: { type: string, enum: [assessment, check-in] } }
 *     responses:
 *       200: { description: "{ scope, team, people[{ points[{ date, count, capacity }] }], unattributed }" }
 *       403: { description: Role cannot see this }
 */

router.get('/finished-trend', requirePermission('forms', 'read'), operationsController.getFinishedTrend);

/**
 * @openapi
 * /operations/service-level:
 *   get:
 *     summary: How quickly plans were finished against the workspace goal (owner/manager only)
 *     tags: [Operations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: query, name: days, schema: { type: integer, enum: [1, 7, 30, 90] } }
 *       - { in: query, name: from, schema: { type: string, format: date } }
 *       - { in: query, name: to, schema: { type: string, format: date } }
 *       - { in: query, name: timeZone, schema: { type: string } }
 *       - { in: query, name: package, schema: { type: string } }
 *       - { in: query, name: action, schema: { type: string, enum: [nutrition, workout] } }
 *       - { in: query, name: type, schema: { type: string, enum: [assessment, check-in] } }
 *     responses:
 *       200: { description: "{ targetDays, finished, onTime, onTimePct, averageHours, medianHours, waiting, daily[], people[] }" }
 *       403: { description: Not an owner or manager }
 */
router.get('/service-level', requirePermission('forms', 'read'), operationsController.getServiceLevel);

/**
 * @openapi
 * /operations/service-target:
 *   put:
 *     summary: Set the goal, in days, for finishing a plan after the client submits (owner/manager only)
 *     tags: [Operations]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: "{ targetDays }" }
 *       400: { description: targetDays must be a whole number from 1 to 30 }
 */
router.put('/service-target', operationsController.updateServiceTarget);

/**
 * @openapi
 * /operations/capacity:
 *   get:
 *     summary: Owner-level capacity setting (owner/manager only)
 *     tags: [Operations]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: "{ ownerDailyCapacity: number | null }" }
 */
router.get('/capacity', operationsController.getCapacitySettings);
router.put('/capacity/owner', operationsController.updateOwnerCapacity);
router.put('/capacity/members/:memberId', operationsController.updateMemberCapacity);
router.get('/capacity/history/:userId', operationsController.getCapacityHistory);
router.post('/capacity/bulk', operationsController.setCapacityForEveryoneUnset);
router.post('/assign-waiting', operationsController.assignWaitingPlans);

export default router;
