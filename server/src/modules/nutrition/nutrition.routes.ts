import { Router, Request, Response, NextFunction } from 'express';
import authMiddleware from '../../middleware/auth';
import requirePermission from '../../middleware/requirePermission';
import * as nutritionController from './nutrition.controller';

const router = Router();

router.use(authMiddleware);
router.use((req: Request, res: Response, next: NextFunction) => {
    const action = req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('nutrition', action)(req, res, next);
});

// ── Food Items ────────────────────────────────────────────────────────────────
router.get('/food-items',          nutritionController.getFoodItems);
router.post('/food-items',         nutritionController.createFoodItem);
router.put('/food-items/:id',      nutritionController.updateFoodItem);
router.delete('/food-items/:id',   nutritionController.deleteFoodItem);

// ── Food Categories ───────────────────────────────────────────────────────────
router.get('/food-categories',          nutritionController.getFoodCategories);
router.post('/food-categories',         nutritionController.createFoodCategory);
router.put('/food-categories/:id',      nutritionController.updateFoodCategory);
router.delete('/food-categories/:id',   nutritionController.deleteFoodCategory);

// ── Nutrition Plans ───────────────────────────────────────────────────────────
router.get('/plans/workspace-library', nutritionController.getWorkspaceLibrary);
router.get('/plans',                   nutritionController.getPlans);
router.get('/plans/:id',               nutritionController.getPlan);
router.post('/plans',                  nutritionController.createPlan);
router.post('/plans/save-draft',       nutritionController.saveDraft);
router.post('/plans/save-plan-draft',  nutritionController.savePlanDraft);
router.put('/plans/:id',               nutritionController.updatePlan);
router.delete('/plans/:id',            nutritionController.deletePlan);
router.post('/plans/:id/activate',     nutritionController.activatePlan);
router.post('/plans/:id/duplicate',    nutritionController.duplicatePlan);

// ── Cycles ────────────────────────────────────────────────────────────────────
router.post('/cycles',             nutritionController.createCycle);
router.post('/cycles/:id/duplicate', nutritionController.duplicateCycle);
router.put('/cycles/:id',          nutritionController.updateCycle);
router.delete('/cycles/:id',       nutritionController.deleteCycle);

// ── Meals ─────────────────────────────────────────────────────────────────────
router.post('/meals',              nutritionController.createMeal);
router.post('/meals/:id/duplicate', nutritionController.duplicateMeal);
router.put('/meals/:id',           nutritionController.updateMeal);
router.delete('/meals/:id',        nutritionController.deleteMeal);

// ── Meal Items ────────────────────────────────────────────────────────────────
router.post('/meal-items',                         nutritionController.createMealItem);
router.put('/meal-items/reorder',                  nutritionController.reorderMealItems);
router.put('/meal-items/:id',                      nutritionController.updateMealItem);
router.delete('/meal-items/:id',                   nutritionController.deleteMealItem);

// ── Meal Item Alternatives ────────────────────────────────────────────────────
router.post('/meal-items/:id/alternatives',        nutritionController.createMealItemAlternative);
router.put('/meal-item-alternatives/:id',          nutritionController.updateMealItemAlternative);
router.delete('/meal-item-alternatives/:id',       nutritionController.deleteMealItemAlternative);

export default router;
