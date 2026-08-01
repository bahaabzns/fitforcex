import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import authMiddleware from '../../middleware/auth';
import subscriptionAccessGate from '../../middleware/subscriptionAccessGate';
import requirePermission from '../../middleware/requirePermission';
import { makeUploader } from '../../lib/storage';
import * as controller from './pdfExport.controller';

const router = Router();
const imageUploader = makeUploader('pdf-settings/images', ['.jpg', '.jpeg', '.png', '.webp'], { maxSize: 5 * 1024 * 1024 });

// Memory storage (not S3/disk) so the controller can measure the image's
// pixel dimensions before deciding whether to persist it at all — see
// readAndValidateCoverImage's comment in pdfExport.controller.ts.
const coverImageUploader = multer({
    storage: multer.memoryStorage(),
    limits:  { fileSize: 5 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) return cb(new Error('File must be an image'));
        cb(null, true);
    },
});

router.use(authMiddleware, subscriptionAccessGate);
router.use((req: Request, res: Response, next: NextFunction) => {
    const action = req.method === 'GET' ? 'read' : 'write';
    requirePermission('pdfExport', action)(req, res, next);
});

/**
 * @openapi
 * /pdf-export/nutrition/{planId}:
 *   get:
 *     summary: Export a nutrition plan as a branded PDF
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: planId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: PDF file stream
 *       404:
 *         description: Nutrition plan not found
 */
router.get('/nutrition/:planId', controller.exportNutritionPlan);

/**
 * @openapi
 * /pdf-export/training/{planId}:
 *   get:
 *     summary: Export a training plan as a branded PDF
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: planId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: PDF file stream
 *       404:
 *         description: Training plan not found
 */
router.get('/training/:planId', controller.exportTrainingPlan);

/**
 * @openapi
 * /pdf-export/settings/preview:
 *   post:
 *     summary: Render a sample plan with draft (unsaved) branding settings, for the live preview panel
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: query, name: type, schema: { type: string, enum: [nutrition, training] }, description: "Defaults to nutrition" }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, description: "Any subset of that type's settings fields, merged over the workspace's saved settings for the same type" }
 *     responses:
 *       200:
 *         description: PDF file stream (inline, not an attachment)
 */
router.post('/settings/preview', controller.previewSettings);

/**
 * @openapi
 * /pdf-export/settings/nutrition:
 *   get:
 *     summary: Get the workspace's nutrition PDF branding settings (defaults if never saved)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: nutrition_pdf_settings object
 *   put:
 *     summary: Update the workspace's nutrition PDF branding settings
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Updated settings
 *       400:
 *         description: Validation failed
 */
router.get('/settings/nutrition', controller.getNutritionSettings);
router.put('/settings/nutrition', controller.updateNutritionSettings);

/**
 * @openapi
 * /pdf-export/settings/training:
 *   get:
 *     summary: Get the workspace's training PDF branding settings (defaults if never saved)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: training_pdf_settings object
 *   put:
 *     summary: Update the workspace's training PDF branding settings
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Updated settings
 *       400:
 *         description: Validation failed
 */
router.get('/settings/training', controller.getTrainingSettings);
router.put('/settings/training', controller.updateTrainingSettings);

/**
 * @openapi
 * /pdf-export/settings/nutrition/logo:
 *   post:
 *     summary: Upload/replace the logo used on exported nutrition plan PDFs
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema: { type: object, properties: { logo: { type: string, format: binary } } }
 *     responses:
 *       200:
 *         description: Updated settings
 */
router.post('/settings/nutrition/logo', imageUploader.single('logo'), controller.uploadNutritionLogo);

/**
 * @openapi
 * /pdf-export/settings/nutrition/logo:
 *   delete:
 *     summary: Remove the nutrition plan logo (no replacement)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Updated settings
 */
router.delete('/settings/nutrition/logo', controller.removeNutritionLogo);

/**
 * @openapi
 * /pdf-export/settings/training/logo:
 *   post:
 *     summary: Upload/replace the logo used on exported training plan PDFs
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema: { type: object, properties: { logo: { type: string, format: binary } } }
 *     responses:
 *       200:
 *         description: Updated settings
 */
router.post('/settings/training/logo', imageUploader.single('logo'), controller.uploadTrainingLogo);

/**
 * @openapi
 * /pdf-export/settings/training/logo:
 *   delete:
 *     summary: Remove the training plan logo (no replacement)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Updated settings
 */
router.delete('/settings/training/logo', controller.removeTrainingLogo);

/**
 * @openapi
 * /pdf-export/settings/nutrition/cover-image:
 *   post:
 *     summary: Upload the nutrition plan cover background image — must exactly match the page's pixel size (page_width/page_height at 96px/inch, ±5px tolerance)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema: { type: object, properties: { image: { type: string, format: binary } } }
 *     responses:
 *       200:
 *         description: Updated settings
 *       400:
 *         description: No file uploaded, unreadable image, or wrong dimensions
 */
router.post('/settings/nutrition/cover-image', coverImageUploader.single('image'), controller.uploadNutritionCoverImage);

/**
 * @openapi
 * /pdf-export/settings/nutrition/cover-image:
 *   delete:
 *     summary: Remove the nutrition plan cover background image (no replacement)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Updated settings
 */
router.delete('/settings/nutrition/cover-image', controller.removeNutritionCoverImage);

/**
 * @openapi
 * /pdf-export/settings/training/cover-image:
 *   post:
 *     summary: Upload the training plan cover background image — must exactly match the page's pixel size (page_width/page_height at 96px/inch, ±5px tolerance)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema: { type: object, properties: { image: { type: string, format: binary } } }
 *     responses:
 *       200:
 *         description: Updated settings
 *       400:
 *         description: No file uploaded, unreadable image, or wrong dimensions
 */
router.post('/settings/training/cover-image', coverImageUploader.single('image'), controller.uploadTrainingCoverImage);

/**
 * @openapi
 * /pdf-export/settings/training/cover-image:
 *   delete:
 *     summary: Remove the training plan cover background image (no replacement)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Updated settings
 */
router.delete('/settings/training/cover-image', controller.removeTrainingCoverImage);

/**
 * @openapi
 * /pdf-export/settings/nutrition/background/{slot}:
 *   post:
 *     summary: Upload a background image for a given nutrition PDF page slot (cover page's image has its own validated endpoint — see /settings/nutrition/cover-image)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: slot, required: true, schema: { type: string, enum: [page, backCover, summary, planSummary, mealSummary, cycleSummary] } }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema: { type: object, properties: { image: { type: string, format: binary } } }
 *     responses:
 *       200:
 *         description: Updated settings
 *       400:
 *         description: Unknown slot or no file uploaded
 */
router.post('/settings/nutrition/background/:slot', imageUploader.single('image'), controller.uploadNutritionBackground);

/**
 * @openapi
 * /pdf-export/settings/nutrition/background/{slot}:
 *   delete:
 *     summary: Remove a background image for a given nutrition PDF page slot (no replacement)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: slot, required: true, schema: { type: string, enum: [page, backCover, summary, planSummary, mealSummary, cycleSummary] } }
 *     responses:
 *       200:
 *         description: Updated settings
 *       400:
 *         description: Unknown slot
 */
router.delete('/settings/nutrition/background/:slot', controller.removeNutritionBackground);

/**
 * @openapi
 * /pdf-export/settings/training/background/{slot}:
 *   post:
 *     summary: Upload a background image for a given training PDF page slot (cover page's image has its own validated endpoint — see /settings/training/cover-image)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: slot, required: true, schema: { type: string, enum: [page, backCover, daySummary] } }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema: { type: object, properties: { image: { type: string, format: binary } } }
 *     responses:
 *       200:
 *         description: Updated settings
 *       400:
 *         description: Unknown slot or no file uploaded
 */
router.post('/settings/training/background/:slot', imageUploader.single('image'), controller.uploadTrainingBackground);

/**
 * @openapi
 * /pdf-export/settings/training/background/{slot}:
 *   delete:
 *     summary: Remove a background image for a given training PDF page slot (no replacement)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: slot, required: true, schema: { type: string, enum: [page, backCover, daySummary] } }
 *     responses:
 *       200:
 *         description: Updated settings
 *       400:
 *         description: Unknown slot
 */
router.delete('/settings/training/background/:slot', controller.removeTrainingBackground);

export default router;
