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
 *       - { in: query, name: profileId, schema: { type: string }, description: "Branding profile to render with; defaults to the workspace's default profile" }
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
 *       - { in: query, name: profileId, schema: { type: string }, description: "Branding profile to render with; defaults to the workspace's default profile" }
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
 *     summary: Render a sample plan with draft (unsaved) branding values, for the live preview panel
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: query, name: type, schema: { type: string, enum: [nutrition, training] }, description: "Defaults to nutrition" }
 *       - { in: query, name: profileId, schema: { type: string }, description: "Profile the draft values are merged over; defaults to the workspace's default profile" }
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, description: "Any subset of that type's settings fields, merged over the chosen profile" }
 *     responses:
 *       200:
 *         description: PDF file stream (inline, not an attachment)
 */
router.post('/settings/preview', controller.previewSettings);

/**
 * @openapi
 * /pdf-export/settings/nutrition:
 *   get:
 *     summary: List the workspace's nutrition PDF branding profiles (default first; a synthesized default if none saved yet)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of nutrition_pdf_settings objects
 *   post:
 *     summary: Create a new nutrition PDF branding profile (seeded from schema defaults)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, required: [name], properties: { name: { type: string, maxLength: 60 } } }
 *     responses:
 *       201:
 *         description: The created profile
 *       400:
 *         description: Invalid name, duplicate name, or profile limit reached
 */
router.get('/settings/nutrition', controller.listNutritionProfiles);
router.post('/settings/nutrition', controller.createNutritionProfile);

/**
 * @openapi
 * /pdf-export/settings/nutrition/{profileId}:
 *   get:
 *     summary: Get one nutrition PDF branding profile
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: profileId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: nutrition_pdf_settings object }
 *       404: { description: Profile not found }
 *   put:
 *     summary: Update a nutrition PDF branding profile (fields, rename, or set as default)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: profileId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Updated profile }
 *       400: { description: Validation failed or duplicate name }
 *       404: { description: Profile not found }
 *   delete:
 *     summary: Delete a nutrition PDF branding profile (not the last one; deleting the default promotes another)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: profileId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: The remaining profiles }
 *       400: { description: Cannot delete the workspace's only profile }
 *       404: { description: Profile not found }
 */
router.get('/settings/nutrition/:profileId', controller.getNutritionProfile);
router.put('/settings/nutrition/:profileId', controller.updateNutritionProfile);
router.delete('/settings/nutrition/:profileId', controller.deleteNutritionProfile);

/**
 * @openapi
 * /pdf-export/settings/nutrition/{profileId}/duplicate:
 *   post:
 *     summary: Copy a nutrition branding profile into a new "<name> copy" profile (images included; never the default)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: profileId, required: true, schema: { type: string } }
 *     responses:
 *       201: { description: The created copy }
 *       400: { description: Profile limit reached }
 *       404: { description: Source profile not found }
 */
router.post('/settings/nutrition/:profileId/duplicate', controller.duplicateNutritionProfile);

/**
 * @openapi
 * /pdf-export/settings/training:
 *   get:
 *     summary: List the workspace's training PDF branding profiles (default first; a synthesized default if none saved yet)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of training_pdf_settings objects
 *   post:
 *     summary: Create a new training PDF branding profile (seeded from schema defaults)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema: { type: object, required: [name], properties: { name: { type: string, maxLength: 60 } } }
 *     responses:
 *       201:
 *         description: The created profile
 *       400:
 *         description: Invalid name, duplicate name, or profile limit reached
 */
router.get('/settings/training', controller.listTrainingProfiles);
router.post('/settings/training', controller.createTrainingProfile);

/**
 * @openapi
 * /pdf-export/settings/training/{profileId}:
 *   get:
 *     summary: Get one training PDF branding profile
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: profileId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: training_pdf_settings object }
 *       404: { description: Profile not found }
 *   put:
 *     summary: Update a training PDF branding profile (fields, rename, or set as default)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: profileId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Updated profile }
 *       400: { description: Validation failed or duplicate name }
 *       404: { description: Profile not found }
 *   delete:
 *     summary: Delete a training PDF branding profile (not the last one; deleting the default promotes another)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: profileId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: The remaining profiles }
 *       400: { description: Cannot delete the workspace's only profile }
 *       404: { description: Profile not found }
 */
router.get('/settings/training/:profileId', controller.getTrainingProfile);
router.put('/settings/training/:profileId', controller.updateTrainingProfile);
router.delete('/settings/training/:profileId', controller.deleteTrainingProfile);

/**
 * @openapi
 * /pdf-export/settings/training/{profileId}/duplicate:
 *   post:
 *     summary: Copy a training branding profile into a new "<name> copy" profile (images included; never the default)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: profileId, required: true, schema: { type: string } }
 *     responses:
 *       201: { description: The created copy }
 *       400: { description: Profile limit reached }
 *       404: { description: Source profile not found }
 */
router.post('/settings/training/:profileId/duplicate', controller.duplicateTrainingProfile);

/**
 * @openapi
 * /pdf-export/settings/nutrition/{profileId}/logo:
 *   post:
 *     summary: Upload/replace the logo on a nutrition branding profile
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: profileId, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema: { type: object, properties: { logo: { type: string, format: binary } } }
 *     responses:
 *       200: { description: Updated profile }
 *       404: { description: Profile not found }
 *   delete:
 *     summary: Remove the logo from a nutrition branding profile (no replacement)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: profileId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Updated profile }
 *       404: { description: Profile not found }
 */
router.post('/settings/nutrition/:profileId/logo', imageUploader.single('logo'), controller.uploadNutritionLogo);
router.delete('/settings/nutrition/:profileId/logo', controller.removeNutritionLogo);

/**
 * @openapi
 * /pdf-export/settings/training/{profileId}/logo:
 *   post:
 *     summary: Upload/replace the logo on a training branding profile
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: profileId, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema: { type: object, properties: { logo: { type: string, format: binary } } }
 *     responses:
 *       200: { description: Updated profile }
 *       404: { description: Profile not found }
 *   delete:
 *     summary: Remove the logo from a training branding profile (no replacement)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: profileId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Updated profile }
 *       404: { description: Profile not found }
 */
router.post('/settings/training/:profileId/logo', imageUploader.single('logo'), controller.uploadTrainingLogo);
router.delete('/settings/training/:profileId/logo', controller.removeTrainingLogo);

/**
 * @openapi
 * /pdf-export/settings/nutrition/{profileId}/cover-image:
 *   post:
 *     summary: Upload a nutrition profile's cover background image — must match the page's pixel size (page_width/page_height at 96px/inch, ±5px)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: profileId, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema: { type: object, properties: { image: { type: string, format: binary } } }
 *     responses:
 *       200: { description: Updated profile }
 *       400: { description: No file uploaded, unreadable image, or wrong dimensions }
 *       404: { description: Profile not found }
 *   delete:
 *     summary: Remove a nutrition profile's cover background image (no replacement)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: profileId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Updated profile }
 *       404: { description: Profile not found }
 */
router.post('/settings/nutrition/:profileId/cover-image', coverImageUploader.single('image'), controller.uploadNutritionCoverImage);
router.delete('/settings/nutrition/:profileId/cover-image', controller.removeNutritionCoverImage);

/**
 * @openapi
 * /pdf-export/settings/training/{profileId}/cover-image:
 *   post:
 *     summary: Upload a training profile's cover background image — must match the page's pixel size (page_width/page_height at 96px/inch, ±5px)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: profileId, required: true, schema: { type: string } }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema: { type: object, properties: { image: { type: string, format: binary } } }
 *     responses:
 *       200: { description: Updated profile }
 *       400: { description: No file uploaded, unreadable image, or wrong dimensions }
 *       404: { description: Profile not found }
 *   delete:
 *     summary: Remove a training profile's cover background image (no replacement)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: profileId, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Updated profile }
 *       404: { description: Profile not found }
 */
router.post('/settings/training/:profileId/cover-image', coverImageUploader.single('image'), controller.uploadTrainingCoverImage);
router.delete('/settings/training/:profileId/cover-image', controller.removeTrainingCoverImage);

/**
 * @openapi
 * /pdf-export/settings/nutrition/{profileId}/background/{slot}:
 *   post:
 *     summary: Upload a background image for a nutrition profile page slot (cover has its own validated endpoint)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: profileId, required: true, schema: { type: string } }
 *       - { in: path, name: slot, required: true, schema: { type: string, enum: [page, backCover, summary, planSummary, mealSummary, cycleSummary] } }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema: { type: object, properties: { image: { type: string, format: binary } } }
 *     responses:
 *       200: { description: Updated profile }
 *       400: { description: Unknown slot or no file uploaded }
 *       404: { description: Profile not found }
 *   delete:
 *     summary: Remove a background image for a nutrition profile page slot (no replacement)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: profileId, required: true, schema: { type: string } }
 *       - { in: path, name: slot, required: true, schema: { type: string, enum: [page, backCover, summary, planSummary, mealSummary, cycleSummary] } }
 *     responses:
 *       200: { description: Updated profile }
 *       400: { description: Unknown slot }
 *       404: { description: Profile not found }
 */
router.post('/settings/nutrition/:profileId/background/:slot', imageUploader.single('image'), controller.uploadNutritionBackground);
router.delete('/settings/nutrition/:profileId/background/:slot', controller.removeNutritionBackground);

/**
 * @openapi
 * /pdf-export/settings/training/{profileId}/background/{slot}:
 *   post:
 *     summary: Upload a background image for a training profile page slot (cover has its own validated endpoint)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: profileId, required: true, schema: { type: string } }
 *       - { in: path, name: slot, required: true, schema: { type: string, enum: [page, backCover, daySummary] } }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema: { type: object, properties: { image: { type: string, format: binary } } }
 *     responses:
 *       200: { description: Updated profile }
 *       400: { description: Unknown slot or no file uploaded }
 *       404: { description: Profile not found }
 *   delete:
 *     summary: Remove a background image for a training profile page slot (no replacement)
 *     tags: [PDF Export]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: profileId, required: true, schema: { type: string } }
 *       - { in: path, name: slot, required: true, schema: { type: string, enum: [page, backCover, daySummary] } }
 *     responses:
 *       200: { description: Updated profile }
 *       400: { description: Unknown slot }
 *       404: { description: Profile not found }
 */
router.post('/settings/training/:profileId/background/:slot', imageUploader.single('image'), controller.uploadTrainingBackground);
router.delete('/settings/training/:profileId/background/:slot', controller.removeTrainingBackground);

export default router;
