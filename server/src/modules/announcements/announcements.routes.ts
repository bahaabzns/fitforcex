import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import authMiddleware from '../../middleware/auth';
import { adminAuthMiddleware } from '../../middleware/adminAuth';
import { makeMemoryUploader } from '../../lib/storage';
import { ANNOUNCEMENT_LIMITS } from './announcements.service';
import * as controller from './announcements.controller';

// ── Coach: what the dashboard card reads and writes ─────────────────────────────────────
export const coachRouter = Router();

/**
 * @openapi
 * /announcements/active:
 *   get:
 *     summary: The single "what's new" announcement to show this coach (or null)
 *     tags: [Announcements]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: "{ announcement: {...} | null }"
 */
coachRouter.get('/active', authMiddleware, controller.getActive);

/**
 * @openapi
 * /announcements/{id}/dismiss:
 *   post:
 *     summary: Dismiss an announcement for the signed-in coach (action "clicked" records a CTA click)
 *     tags: [Announcements]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Dismissed }
 *       404: { description: Announcement not found }
 */
coachRouter.post('/:id/dismiss', authMiddleware, controller.dismiss);

// ── Admin: manage announcements ─────────────────────────────────────────────────────────
export const adminRouter = Router();
const imageUploader = makeMemoryUploader({ maxSize: ANNOUNCEMENT_LIMITS.imageMaxBytes });

/** Turns multer's size-limit error into a clean 413 instead of a generic 500. */
function singleImage(req: Request, res: Response, next: NextFunction): void {
    imageUploader.single('file')(req, res, (err?: unknown) => {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
            res.status(413).json({ message: 'Image is too large — maximum 2 MB' });
            return;
        }
        next(err);
    });
}

adminRouter.use(adminAuthMiddleware);

/**
 * @openapi
 * /admin/announcements:
 *   get:
 *     summary: List all announcements with dismissal/click counts (admin)
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200: { description: Array of announcements }
 *   post:
 *     summary: Create an announcement (admin)
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       201: { description: Created }
 */
adminRouter.get('/', controller.adminList);
adminRouter.post('/', controller.adminCreate);

/**
 * @openapi
 * /admin/announcements/{id}:
 *   put:
 *     summary: Update an announcement (admin)
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Updated }
 *   delete:
 *     summary: Delete an announcement and its dismissals (admin)
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Deleted }
 */
adminRouter.put('/:id', controller.adminUpdate);
adminRouter.delete('/:id', controller.adminDelete);

/**
 * @openapi
 * /admin/announcements/{id}/image:
 *   post:
 *     summary: Upload or replace the announcement image (PNG/JPG/WebP, max 2 MB)
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Uploaded }
 *   delete:
 *     summary: Remove the announcement image
 *     tags: [Admin]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200: { description: Removed }
 */
adminRouter.post('/:id/image', singleImage, controller.adminUploadImage);
adminRouter.delete('/:id/image', controller.adminRemoveImage);
