import { Router, Request, Response, NextFunction } from 'express';
import authMiddleware from '../../middleware/auth';
import subscriptionAccessGate from '../../middleware/subscriptionAccessGate';
import requirePermission from '../../middleware/requirePermission';
import * as nutritionController from './nutrition.controller';
import * as mergeController from './foodCategoryMerge.controller';
import * as bulkController from './foodItemsBulk.controller';

const router = Router();

router.use(authMiddleware, subscriptionAccessGate);
router.use((req: Request, res: Response, next: NextFunction) => {
    const action = req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('nutrition', action)(req, res, next);
});

/**
 * @openapi
 * /nutrition/food-items:
 *   get:
 *     summary: List all food items in the workspace
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of food items
 *   post:
 *     summary: Create a food item
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201:
 *         description: Food item created
 *
 * /nutrition/food-items/{id}:
 *   put:
 *     summary: Update a food item
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Food item updated
 *   delete:
 *     summary: Delete a food item
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Food item deleted
 */
/**
 * @openapi
 * /nutrition/food-items/bulk-category:
 *   put:
 *     summary: Change the category of several food items at once
 *     description: Body is { ids, food_category } — food_category must be one of the workspace's categories, or empty to clear it. All ids must belong to the workspace (404 otherwise; nothing is written).
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Number of food items updated
 *
 * /nutrition/food-items/bulk-usage:
 *   post:
 *     summary: How many diet plan entries use the given food items
 *     description: Used to warn before a bulk delete. Requires nutrition.write and nutrition.delete.
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Counts of plan entries (meal_items), distinct plans, and alternatives that use the foods
 *
 * /nutrition/food-items:
 *   delete:
 *     summary: Delete several food items at once
 *     description: Body is { ids }. Also removes the diet plan entries that use them (database cascade). Requires nutrition.delete.
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Number of food items deleted
 */
// Bulk routes are declared before the /:id routes so '/:id' can't shadow them.
router.put('/food-items/bulk-category',  bulkController.bulkChangeFoodItemCategory);
router.post('/food-items/bulk-usage',    requirePermission('nutrition', 'delete'), bulkController.getFoodItemsUsage);
router.delete('/food-items',             bulkController.bulkDeleteFoodItems);

router.get('/food-items',        nutritionController.getFoodItems);
router.post('/food-items',       nutritionController.createFoodItem);
router.put('/food-items/:id',    nutritionController.updateFoodItem);
router.delete('/food-items/:id', nutritionController.deleteFoodItem);

/**
 * @openapi
 * /nutrition/food-categories:
 *   get:
 *     summary: List food categories
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of food categories
 *   post:
 *     summary: Create a food category
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201:
 *         description: Category created
 *
 * /nutrition/food-categories/{id}:
 *   put:
 *     summary: Update a food category
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Category updated
 *   delete:
 *     summary: Delete a food category
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Category deleted
 */
/**
 * @openapi
 * /nutrition/food-categories/merge/preview:
 *   post:
 *     summary: Preview merging several food categories into one (writes nothing)
 *     description: Requires nutrition.write and nutrition.delete. Body is { sourceIds, target }, where target is { id } (keep a selected category) or { name_en, name_ar } (new or existing name).
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Target, number of food items that would move, and the categories that would be removed
 *
 * /nutrition/food-categories/merge:
 *   post:
 *     summary: Merge several food categories into one (undoable)
 *     description: Moves the workspace's food items from the source categories to the target, deletes the source categories and logs the merge. Requires nutrition.write and nutrition.delete.
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201:
 *         description: Merge performed
 *
 * /nutrition/food-categories/merges:
 *   get:
 *     summary: List the most recent category merges (newest first, with can_undo)
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of merges
 *
 * /nutrition/food-categories/merges/{mergeId}/undo:
 *   post:
 *     summary: Undo the most recent category merge
 *     description: Restores the source categories and the items that are still in the target; items edited or deleted since are skipped and reported. Requires nutrition.write and nutrition.delete.
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: mergeId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Undo report
 */
// A merge removes categories, so on top of the router-wide POST => nutrition.write it also needs nutrition.delete.
const requireDelete = requirePermission('nutrition', 'delete');
router.post('/food-categories/merge/preview',        requireDelete, mergeController.previewFoodCategoryMerge);
router.post('/food-categories/merge',                requireDelete, mergeController.mergeFoodCategories);
router.get('/food-categories/merges',                mergeController.getFoodCategoryMerges);
router.post('/food-categories/merges/:mergeId/undo', requireDelete, mergeController.undoFoodCategoryMerge);

router.get('/food-categories',        nutritionController.getFoodCategories);
router.post('/food-categories',       nutritionController.createFoodCategory);
router.put('/food-categories/:id',    nutritionController.updateFoodCategory);
router.delete('/food-categories/:id', nutritionController.deleteFoodCategory);

/**
 * @openapi
 * /nutrition/plans/workspace-library:
 *   get:
 *     summary: List all nutrition plans across the workspace (library view)
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of nutrition plans with summary stats
 *
 * /nutrition/plans:
 *   get:
 *     summary: List nutrition plans for a client
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: query, name: clientId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Array of plans for the client
 *   post:
 *     summary: Create a new nutrition plan
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201:
 *         description: Plan created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/NutritionPlan'
 *
 * /nutrition/plans/save-draft:
 *   post:
 *     summary: Save a plan as a draft (upsert by clientId)
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Draft saved
 *
 * /nutrition/plans/save-plan-draft:
 *   post:
 *     summary: Save a template plan draft (no client)
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Template draft saved
 */
router.get('/plans/workspace-library', nutritionController.getWorkspaceLibrary);
router.get('/plans',                   nutritionController.getPlans);
router.get('/plans/:id',               nutritionController.getPlan);
router.post('/plans',                  nutritionController.createPlan);
router.post('/plans/save-draft',       nutritionController.saveDraft);
router.post('/plans/save-plan-draft',  nutritionController.savePlanDraft);
router.put('/plans/:id',               nutritionController.updatePlan);
router.delete('/plans/:id',            nutritionController.deletePlan);

/**
 * @openapi
 * /nutrition/plans/{id}:
 *   get:
 *     summary: Get a full nutrition plan tree
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Full plan with cycles, meals, and meal items
 *       404:
 *         description: Plan not found
 *   put:
 *     summary: Update a nutrition plan
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Plan updated
 *   delete:
 *     summary: Delete a nutrition plan
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Plan deleted
 *
 * /nutrition/plans/{id}/activate:
 *   post:
 *     summary: Activate a nutrition plan for its client
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Plan activated; real-time plan_assigned event emitted to client room
 *       404:
 *         description: Plan not found
 *
 * /nutrition/plans/{id}/duplicate:
 *   post:
 *     summary: Duplicate a nutrition plan
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       201:
 *         description: Duplicated plan
 */
router.post('/plans/:id/activate',  nutritionController.activatePlan);
router.post('/plans/:id/duplicate', nutritionController.duplicatePlan);

/**
 * @openapi
 * /nutrition/cycles:
 *   post:
 *     summary: Create a cycle within a nutrition plan
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201:
 *         description: Cycle created
 *
 * /nutrition/cycles/{id}:
 *   put:
 *     summary: Update a cycle
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Cycle updated
 *   delete:
 *     summary: Delete a cycle
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Cycle deleted
 *
 * /nutrition/cycles/{id}/duplicate:
 *   post:
 *     summary: Duplicate a cycle
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       201:
 *         description: Duplicated cycle
 */
router.post('/cycles',               nutritionController.createCycle);
router.post('/cycles/:id/duplicate', nutritionController.duplicateCycle);
router.put('/cycles/:id',            nutritionController.updateCycle);
router.delete('/cycles/:id',         nutritionController.deleteCycle);

/**
 * @openapi
 * /nutrition/meals:
 *   post:
 *     summary: Create a meal within a cycle
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201:
 *         description: Meal created
 *
 * /nutrition/meals/{id}:
 *   put:
 *     summary: Update a meal
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Meal updated
 *   delete:
 *     summary: Delete a meal
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Meal deleted
 *
 * /nutrition/meals/{id}/duplicate:
 *   post:
 *     summary: Duplicate a meal
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       201:
 *         description: Duplicated meal
 */
router.post('/meals',               nutritionController.createMeal);
router.post('/meals/:id/duplicate', nutritionController.duplicateMeal);
router.put('/meals/:id',            nutritionController.updateMeal);
router.delete('/meals/:id',         nutritionController.deleteMeal);

/**
 * @openapi
 * /nutrition/meal-items:
 *   post:
 *     summary: Add a food item to a meal
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201:
 *         description: Meal item created
 *
 * /nutrition/meal-items/reorder:
 *   put:
 *     summary: Reorder items within a meal
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Items reordered
 *
 * /nutrition/meal-items/{id}:
 *   put:
 *     summary: Update a meal item
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Meal item updated
 *   delete:
 *     summary: Remove a meal item
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Meal item removed
 *
 * /nutrition/meal-items/{id}/alternatives:
 *   post:
 *     summary: Add an alternative food item
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       201:
 *         description: Alternative created
 *
 * /nutrition/meal-item-alternatives/{id}:
 *   put:
 *     summary: Update an alternative food item
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Alternative updated
 *   delete:
 *     summary: Remove an alternative food item
 *     tags: [Nutrition]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Alternative removed
 */
router.post('/meal-items',              nutritionController.createMealItem);
router.put('/meal-items/reorder',       nutritionController.reorderMealItems);
router.put('/meal-items/:id',           nutritionController.updateMealItem);
router.delete('/meal-items/:id',        nutritionController.deleteMealItem);

router.post('/meal-items/:id/alternatives',  nutritionController.createMealItemAlternative);
router.put('/meal-item-alternatives/:id',    nutritionController.updateMealItemAlternative);
router.delete('/meal-item-alternatives/:id', nutritionController.deleteMealItemAlternative);

router.get('/meal-items/:id/swap-history', nutritionController.getMealItemSwapHistory);

export default router;
