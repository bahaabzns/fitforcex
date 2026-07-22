import { Router, Request, Response, NextFunction } from 'express';
import authMiddleware from '../../middleware/auth';
import requirePermission from '../../middleware/requirePermission';
import * as insightsController from './insights.controller';

const router = Router();

router.use(authMiddleware);
router.use((req: Request, res: Response, next: NextFunction) => {
    const action = req.method === 'GET' ? 'read' : 'write';
    requirePermission('insights', action)(req, res, next);
});

/**
 * @openapi
 * /insights:
 *   post:
 *     summary: Submit organic feedback (bug, feature request, or a standalone rating)
 *     tags: [Insights]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201:
 *         description: Insight created
 *       400:
 *         description: Invalid sourceType or missing required field
 *
 * /insights/screenshot:
 *   post:
 *     summary: Upload a screenshot attachment for a bug report (multipart, field name "file")
 *     tags: [Insights]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201:
 *         description: "{ url }"
 *       400:
 *         description: No file uploaded
 *
 * /insights/mine:
 *   get:
 *     summary: List the caller's own submitted insights
 *     tags: [Insights]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of insights
 */
router.post('/',            insightsController.submitInsight);
router.post('/screenshot',  insightsController.screenshotUploader.single('file'), insightsController.uploadScreenshot);
router.get('/mine',         insightsController.listMyInsights);

/**
 * @openapi
 * /insights/prompts/active:
 *   get:
 *     summary: Get the currently active Founder Prompt targeted at this coach, if any and not yet answered
 *     tags: [Insights]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: The active prompt, or null
 *
 * /insights/prompts/{id}/respond:
 *   post:
 *     summary: Answer an active Founder Prompt
 *     tags: [Insights]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       201:
 *         description: Response recorded
 *       404:
 *         description: This prompt is no longer active
 *
 * /insights/prompts/for-trigger/{event}:
 *   get:
 *     summary: "Phase 3 — get the contextual prompt (if any) eligible right after this named trigger event fires"
 *     tags: [Insights]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: event, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: The eligible prompt, or null
 *       400:
 *         description: Unknown trigger event
 *
 * /insights/prompts/{id}/dismiss:
 *   post:
 *     summary: Persistently dismiss a contextual prompt so it stops being offered to this coach
 *     tags: [Insights]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Dismissed
 */
router.get('/prompts/active',              insightsController.getActivePromptForCoach);
router.get('/prompts/for-trigger/:event',  insightsController.getPromptForTrigger);
router.post('/prompts/:id/respond',        insightsController.respondToPrompt);
router.post('/prompts/:id/dismiss',        insightsController.dismissPrompt);
router.post('/prompts/:id/started',        insightsController.startPrompt);

export default router;
