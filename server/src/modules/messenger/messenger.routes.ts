import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import subscriptionAccessGate from '../../middleware/subscriptionAccessGate';
import { attachmentUploader } from '../../lib/messageAttachments';
import * as messengerController from './messenger.controller';

const router = Router();

router.use(authMiddleware, subscriptionAccessGate);

/**
 * @openapi
 * /messenger/threads:
 *   get:
 *     summary: List all message threads for the workspace
 *     tags: [Messenger]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of threads with latest message
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Thread'
 *       401:
 *         description: Not authenticated
 *   post:
 *     summary: Create a new message thread for a client
 *     tags: [Messenger]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [clientId]
 *             properties:
 *               clientId: { type: string }
 *     responses:
 *       201:
 *         description: Thread created (or existing thread returned if already exists)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Thread'
 */
router.get('/threads', messengerController.getThreads);
router.post('/threads', messengerController.createThread);

/**
 * @openapi
 * /messenger/threads/broadcast:
 *   post:
 *     summary: Send the same message to multiple threads at once
 *     tags: [Messenger]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [threadIds, body]
 *             properties:
 *               threadIds: { type: array, items: { type: string } }
 *               body: { type: string, maxLength: 5000 }
 *     responses:
 *       201:
 *         description: Message sent to each matching thread
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 sent:    { type: integer }
 *                 skipped: { type: integer }
 *       400:
 *         description: Validation error
 *       404:
 *         description: No matching conversations found
 */
router.post('/threads/broadcast', messengerController.broadcastMessage);

/**
 * @openapi
 * /messenger/threads/{threadId}/messages:
 *   get:
 *     summary: Get all messages in a thread (marks client messages as read)
 *     tags: [Messenger]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: threadId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Array of messages
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Message'
 *       404:
 *         description: Thread not found
 *   post:
 *     summary: Send a message to a thread
 *     tags: [Messenger]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: threadId, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [body]
 *             properties:
 *               body: { type: string, maxLength: 5000 }
 *     responses:
 *       201:
 *         description: Message created; real-time event emitted to workspace room
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Thread not found
 *
 * /messenger/threads/{threadId}/status:
 *   patch:
 *     summary: Update the status of a thread (open/closed)
 *     tags: [Messenger]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: threadId, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status: { type: string, enum: [open, closed] }
 *     responses:
 *       200:
 *         description: Thread status updated
 *       404:
 *         description: Thread not found
 */
router.get('/threads/:threadId/messages',  messengerController.getMessages);
router.post('/threads/:threadId/messages', messengerController.sendMessage);
router.patch('/threads/:threadId/status',  messengerController.updateThreadStatus);

/**
 * @openapi
 * /messenger/threads/{threadId}/attachments:
 *   post:
 *     summary: Upload and send an image, voice note, or file attachment
 *     tags: [Messenger]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: threadId, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:            { type: string, format: binary }
 *               body:            { type: string, maxLength: 5000 }
 *               durationSeconds: { type: number }
 *     responses:
 *       201:
 *         description: Attachment message created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *       400:
 *         description: No file uploaded
 *       404:
 *         description: Thread not found
 *
 * /messenger/threads/{threadId}/messages/{messageId}:
 *   patch:
 *     summary: Edit a previously sent text message
 *     tags: [Messenger]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: threadId, required: true, schema: { type: string } }
 *       - { in: path, name: messageId, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [body]
 *             properties:
 *               body: { type: string, maxLength: 5000 }
 *     responses:
 *       200:
 *         description: Message updated
 *       400:
 *         description: Validation error, or the message isn't a text message
 *       403:
 *         description: Not the message's sender
 *       404:
 *         description: Message not found
 *   delete:
 *     summary: Soft-delete a previously sent message
 *     tags: [Messenger]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: threadId, required: true, schema: { type: string } }
 *       - { in: path, name: messageId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Message deleted (tombstoned)
 *       403:
 *         description: Not the message's sender
 *       404:
 *         description: Message not found
 */
router.post('/threads/:threadId/attachments', attachmentUploader.single('file'), messengerController.sendAttachment);
router.patch('/threads/:threadId/messages/:messageId', messengerController.editMessage);
router.delete('/threads/:threadId/messages/:messageId', messengerController.deleteMessage);

export default router;
