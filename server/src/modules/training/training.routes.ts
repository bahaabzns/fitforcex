import { Router, Request, Response, NextFunction } from 'express';
import authMiddleware from '../../middleware/auth';
import requirePermission from '../../middleware/requirePermission';
import { uploadLimiter } from '../../middleware/rateLimit';
import { upload } from './training.service';
import * as trainingController from './training.controller';

const router = Router();

router.use(authMiddleware);
router.use((req: Request, res: Response, next: NextFunction) => {
    const action = req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('training', action)(req, res, next);
});

// ── Muscle Groups ─────────────────────────────────────────────────────────────
router.get('/muscle-groups',       trainingController.getMuscleGroups);
router.post('/muscle-groups',      trainingController.createMuscleGroup);
router.put('/muscle-groups/:id',   trainingController.updateMuscleGroup);
router.delete('/muscle-groups/:id', trainingController.deleteMuscleGroup);

// ── Equipment ─────────────────────────────────────────────────────────────────
router.get('/equipments',          trainingController.getEquipments);
router.post('/equipments',         trainingController.createEquipment);
router.put('/equipments/:id',      trainingController.updateEquipment);
router.delete('/equipments/:id',   trainingController.deleteEquipment);

// ── Exercise Library ──────────────────────────────────────────────────────────
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

// ── Training Plans ────────────────────────────────────────────────────────────
router.get('/plans/workspace-library', trainingController.getWorkspaceLibrary);
router.get('/plans',                   trainingController.getPlans);
router.get('/plans/:id',               trainingController.getPlan);
router.post('/plans/save-draft',       trainingController.saveDraft);
router.post('/plans/save-plan-draft',  trainingController.savePlanDraft);
router.post('/plans/:id/activate',     trainingController.activatePlan);

export default router;
