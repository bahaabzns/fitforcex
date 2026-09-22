import { Router } from 'express';
import adminAuthMiddleware from '../../middleware/adminAuth';
import * as adminController from './admin.controller';

const router = Router();

/**
 * @openapi
 * /admin/insights:
 *   get:
 *     summary: Unified Insights inbox — every bug report, feature request, rating, and prompt response
 *     tags: [Admin, Insights]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: query, name: status, schema: { type: string } }
 *       - { in: query, name: sourceType, schema: { type: string } }
 *       - { in: query, name: workspaceId, schema: { type: string } }
 *     responses:
 *       200: { description: Array of insights }
 *
 * /admin/insights/{id}:
 *   patch:
 *     summary: Triage an insight — set status and/or link (or create) a roadmap item
 *     tags: [Admin, Insights]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Insight updated }
 *       404: { description: Insight not found }
 */
router.get('/insights',      adminAuthMiddleware, adminController.listInsights);
router.patch('/insights/:id', adminAuthMiddleware, adminController.triageInsight);

/**
 * @openapi
 * /admin/prompts:
 *   get:
 *     summary: "List Founder Prompts (one view, filter ?status=active|ended — replaces separate Active/History screens)"
 *     tags: [Admin, Insights]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: query, name: status, schema: { type: string } }
 *     responses:
 *       200: { description: Array of prompts }
 *   post:
 *     summary: Create and activate a prompt (ends any other active prompt with an overlapping audience)
 *     tags: [Admin, Insights]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201: { description: Prompt created and active }
 *       400: { description: Invalid input }
 *
 * /admin/prompts/{id}/end:
 *   patch:
 *     summary: Manually end an active prompt
 *     tags: [Admin, Insights]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Prompt ended }
 *
 * /admin/prompts/{id}/reactivate:
 *   patch:
 *     summary: Bring an ended prompt back to active (runs the same exclusivity gate as creating a new prompt)
 *     tags: [Admin, Insights]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Prompt reactivated }
 *       404: { description: Prompt not found }
 *
 * /admin/prompts/{id}/analytics:
 *   get:
 *     summary: "Phase 4 — funnel (sent/started/completed) and response breakdown for a prompt"
 *     tags: [Admin, Insights]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: PromptFunnel }
 *       404: { description: Prompt not found }
 *
 * /admin/prompts/{id}/question:
 *   patch:
 *     summary: Edit a created prompt's question text only (never audience, trigger, response type, or status)
 *     tags: [Admin, Insights]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Prompt updated }
 *       400: { description: Invalid input }
 *       404: { description: Prompt not found }
 */
router.get('/prompts',                adminAuthMiddleware, adminController.listPrompts);
router.post('/prompts',               adminAuthMiddleware, adminController.createPrompt);
router.patch('/prompts/:id/end',      adminAuthMiddleware, adminController.endPromptHandler);
router.patch('/prompts/:id/reactivate', adminAuthMiddleware, adminController.reactivatePromptHandler);
router.patch('/prompts/:id/question', adminAuthMiddleware, adminController.updatePromptQuestion);
router.get('/prompts/:id/analytics',  adminAuthMiddleware, adminController.getPromptAnalytics);

/**
 * @openapi
 * /admin/roadmap:
 *   get:
 *     summary: List roadmap items, each with its linked insight count and average rating (free prioritization signal)
 *     tags: [Admin, Insights]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: Array of roadmap items with insight_count/avg_rating }
 *   post:
 *     summary: Create a roadmap item ad hoc (also creatable inline from insight triage)
 *     tags: [Admin, Insights]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201: { description: Roadmap item created }
 *
 * /admin/roadmap/{id}:
 *   patch:
 *     summary: Update a roadmap item's status/release_tag — shipped/declined triggers closed-loop notifications to every linked submitter
 *     tags: [Admin, Insights]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Roadmap item updated }
 *       400: { description: Invalid status }
 *       404: { description: Roadmap item not found }
 */
router.get('/roadmap',      adminAuthMiddleware, adminController.listRoadmapItems);
router.post('/roadmap',     adminAuthMiddleware, adminController.createRoadmapItem);
router.patch('/roadmap/:id', adminAuthMiddleware, adminController.updateRoadmapItem);

export default router;
