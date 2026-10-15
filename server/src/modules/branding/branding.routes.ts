import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import authMiddleware from '../../middleware/auth';
import subscriptionAccessGate from '../../middleware/subscriptionAccessGate';
import requirePermission from '../../middleware/requirePermission';
import requireCapability from '../../middleware/requireCapability';
import { makeMemoryUploader } from '../../lib/storage';
import { BRANDING_LIMITS } from './branding.service';
import * as controller from './branding.controller';

const router = Router();

// Memory storage: the service decodes/re-encodes the bytes before anything is persisted.
const logoUploader   = makeMemoryUploader({ maxSize: BRANDING_LIMITS.logoMaxBytes });
const bannerUploader = makeMemoryUploader({ maxSize: BRANDING_LIMITS.bannerMaxBytes });

/** Turns multer's size-limit error into a clean 413 instead of a generic 500. */
function singleFile(uploader: multer.Multer, field: string, maxBytes: number) {
    const handler = uploader.single(field);
    return (req: Request, res: Response, next: NextFunction): void => {
        handler(req, res, (err?: unknown) => {
            if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
                res.status(413).json({ error: `Image is too large — maximum ${Math.round(maxBytes / (1024 * 1024))} MB` });
                return;
            }
            next(err);
        });
    };
}

// Branding is workspace-level business config: owners, or members who can manage the team.
router.use(authMiddleware, subscriptionAccessGate, requirePermission('team', 'write'));

/**
 * @openapi
 * /branding:
 *   get:
 *     summary: Saved Client Portal branding, banners, limits and plan eligibility
 *     tags: [Branding]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Branding view (always returned, even when the plan is not eligible)
 */
router.get('/', controller.getBranding);

/**
 * @openapi
 * /branding:
 *   put:
 *     summary: Update brand colors (null clears a color)
 *     tags: [Branding]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               primary_color: { type: string, nullable: true, example: "#159bff" }
 *               accent_color:  { type: string, nullable: true }
 *     responses:
 *       200: { description: Updated branding view }
 *       400: { description: Invalid color }
 *       403: { description: Plan does not include custom branding (code CAPABILITY_LOCKED) }
 */
router.put('/', requireCapability('custom_branding'), controller.putBranding);

/**
 * @openapi
 * /branding/logo:
 *   post:
 *     summary: Upload (replace) the portal logo
 *     tags: [Branding]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: query, name: variant, schema: { type: string, enum: [light, dark], default: light } }
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file: { type: string, format: binary }
 *     responses:
 *       200: { description: Updated branding view }
 *       400: { description: Invalid image }
 *       413: { description: Image too large }
 */
router.post('/logo', requireCapability('custom_branding'), singleFile(logoUploader, 'file', BRANDING_LIMITS.logoMaxBytes), controller.uploadLogo);

/**
 * @openapi
 * /branding/logo:
 *   delete:
 *     summary: Remove the portal logo (falls back to the FitForce logo)
 *     tags: [Branding]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: query, name: variant, schema: { type: string, enum: [light, dark], default: light } }
 *     responses:
 *       200: { description: Updated branding view }
 */
router.delete('/logo', requireCapability('custom_branding'), controller.removeLogo);

/**
 * @openapi
 * /branding/banners/order:
 *   put:
 *     summary: Reorder banners (ids must list every live banner exactly once)
 *     tags: [Branding]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               ids: { type: array, items: { type: string } }
 *     responses:
 *       200: { description: Updated branding view }
 */
// Declared before the /:id routes so "order" is never parsed as a banner id.
router.put('/banners/order', requireCapability('custom_branding'), controller.putBannerOrder);

/**
 * @openapi
 * /branding/banners:
 *   post:
 *     summary: Add a banner (max 5)
 *     tags: [Branding]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:     { type: string, format: binary }
 *               title:    { type: string }
 *               link_url: { type: string, description: "https:// URL or /portal/... path" }
 *     responses:
 *       201: { description: Updated branding view }
 *       409: { description: Banner limit reached }
 */
router.post('/banners', requireCapability('custom_branding'), singleFile(bannerUploader, 'file', BRANDING_LIMITS.bannerMaxBytes), controller.addBanner);

/**
 * @openapi
 * /branding/banners/{id}:
 *   patch:
 *     summary: Edit a banner's title, link or active flag
 *     tags: [Branding]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Updated branding view }
 *       404: { description: Banner not found }
 */
router.patch('/banners/:id', requireCapability('custom_branding'), controller.patchBanner);

/**
 * @openapi
 * /branding/banners/{id}:
 *   delete:
 *     summary: Delete a banner
 *     tags: [Branding]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Updated branding view }
 *       404: { description: Banner not found }
 */
router.delete('/banners/:id', requireCapability('custom_branding'), controller.removeBanner);

export default router;
