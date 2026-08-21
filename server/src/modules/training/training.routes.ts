import { Router, Request, Response, NextFunction } from 'express';
import authMiddleware from '../../middleware/auth';
import subscriptionAccessGate from '../../middleware/subscriptionAccessGate';
import requirePermission from '../../middleware/requirePermission';
import { uploadLimiter } from '../../middleware/rateLimit';
import { upload } from './training.service';
import * as trainingController from './training.controller';

const router = Router();

router.use(authMiddleware, subscriptionAccessGate);
router.use((req: Request, res: Response, next: NextFunction) => {
    const action = req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('training', action)(req, res, next);
});

/**
 * @openapi
 * /training/muscle-groups:
 *   get:
 *     summary: List all muscle groups in the workspace
 *     tags: [Training]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of muscle groups
 *   post:
 *     summary: Create a muscle group
 *     tags: [Training]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201:
 *         description: Muscle group created
 *
 * /training/muscle-groups/{id}:
 *   put:
 *     summary: Update a muscle group
 *     tags: [Training]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Muscle group updated
 *   delete:
 *     summary: Delete a muscle group
 *     tags: [Training]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Muscle group deleted
 */
router.get('/muscle-groups',        trainingController.getMuscleGroups);
router.post('/muscle-groups',       trainingController.createMuscleGroup);
router.put('/muscle-groups/:id',    trainingController.updateMuscleGroup);
router.delete('/muscle-groups/:id', trainingController.deleteMuscleGroup);

/**
 * @openapi
 * /training/equipments:
 *   get:
 *     summary: List all equipment in the workspace
 *     tags: [Training]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of equipment
 *   post:
 *     summary: Create an equipment entry
 *     tags: [Training]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201:
 *         description: Equipment created
 *
 * /training/equipments/{id}:
 *   put:
 *     summary: Update an equipment entry
 *     tags: [Training]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Equipment updated
 *   delete:
 *     summary: Delete an equipment entry
 *     tags: [Training]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Equipment deleted
 */
router.get('/equipments',        trainingController.getEquipments);
router.post('/equipments',       trainingController.createEquipment);
router.put('/equipments/:id',    trainingController.updateEquipment);
router.delete('/equipments/:id', trainingController.deleteEquipment);

/**
 * @openapi
 * /training/exercise-library:
 *   get:
 *     summary: List exercises in the workspace library
 *     tags: [Training]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of exercises
 *   post:
 *     summary: Create an exercise with optional video and thumbnail uploads
 *     tags: [Training]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:      { type: string }
 *               video:     { type: string, format: binary }
 *               thumbnail: { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Exercise created; files stored in S3
 *
 * /training/exercise-library/{id}:
 *   put:
 *     summary: Update an exercise (with optional file replacement)
 *     tags: [Training]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               name:      { type: string }
 *               video:     { type: string, format: binary }
 *               thumbnail: { type: string, format: binary }
 *     responses:
 *       200:
 *         description: Exercise updated
 *   delete:
 *     summary: Delete an exercise
 *     tags: [Training]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Exercise deleted
 */
router.get('/exercise-library', trainingController.getExercises);
router.post('/exercise-library',
    uploadLimiter,
    upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]),
    trainingController.createExercise
);
router.put('/exercise-library/:id',
    uploadLimiter,
    upload.fields([{ name: 'video', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]),
    trainingController.updateExercise
);
router.delete('/exercise-library/:id', trainingController.deleteExercise);

/**
 * @openapi
 * /training/plans/workspace-library:
 *   get:
 *     summary: List all training plans across the workspace (library view)
 *     tags: [Training]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of training plans with summary stats
 *
 * /training/plans:
 *   get:
 *     summary: List training plans for a client
 *     tags: [Training]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: query, name: clientId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Array of plans for the client
 *
 * /training/plans/{id}:
 *   get:
 *     summary: Get a full training plan tree
 *     tags: [Training]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Full plan with days and exercises
 *       404:
 *         description: Plan not found
 *
 * /training/plans/save-draft:
 *   post:
 *     summary: Save a training plan draft (upsert by clientId)
 *     tags: [Training]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Draft saved
 *
 * /training/plans/save-plan-draft:
 *   post:
 *     summary: Save a template training plan draft (no client)
 *     tags: [Training]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Template draft saved
 *
 * /training/plans/{id}/activate:
 *   post:
 *     summary: Activate a training plan for its client
 *     tags: [Training]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Plan activated; real-time plan_assigned event emitted to client room
 *       404:
 *         description: Plan not found
 */
router.get('/plans/workspace-library', trainingController.getWorkspaceLibrary);
router.get('/plans',                   trainingController.getPlans);
router.get('/plans/:id',               trainingController.getPlan);
router.post('/plans/save-draft',       trainingController.saveDraft);
router.post('/plans/save-plan-draft',  trainingController.savePlanDraft);
router.post('/plans/:id/activate',     trainingController.activatePlan);

export default router;
