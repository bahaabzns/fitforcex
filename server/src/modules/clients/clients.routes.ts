import { Router, Request, Response, NextFunction } from 'express';
import authMiddleware from '../../middleware/auth';
import requirePermission from '../../middleware/requirePermission';
import * as clientsController from './clients.controller';

const router = Router();

router.use(authMiddleware);
router.use((req: Request, res: Response, next: NextFunction) => {
    const action = req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('clients', action)(req, res, next);
});

/**
 * @openapi
 * /clients/limit-check:
 *   get:
 *     summary: Check if the workspace can add more clients under its current plan
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Limit status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 canAdd:  { type: boolean }
 *                 current: { type: integer }
 *                 limit:   { type: integer }
 */
router.get('/limit-check', clientsController.checkClientLimitHandler);

/**
 * @openapi
 * /clients:
 *   get:
 *     summary: List all active clients in the workspace
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Array of clients
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Client'
 *   post:
 *     summary: Create a new client
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [fname, lname]
 *             properties:
 *               fname: { type: string }
 *               lname: { type: string }
 *               email: { type: string, format: email }
 *               phone: { type: string }
 *     responses:
 *       201:
 *         description: Client created
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Client'
 *       400:
 *         description: Validation error
 */
router.get('/', clientsController.getClients);
router.post('/', clientsController.createClient);

/**
 * @openapi
 * /clients/{id}:
 *   get:
 *     summary: Get a single client by ID
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Client record
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Client'
 *       404:
 *         description: Client not found
 *   put:
 *     summary: Update a client
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Client'
 *     responses:
 *       200:
 *         description: Client updated
 *       404:
 *         description: Client not found
 *   delete:
 *     summary: Soft-delete a client
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Client deleted
 *       404:
 *         description: Client not found
 */
router.get('/:id', clientsController.getClient);
router.put('/:id', clientsController.updateClient);
router.delete('/:id', clientsController.deleteClient);

/**
 * @openapi
 * /clients/{id}/freezes:
 *   get:
 *     summary: List freeze periods for a client
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Array of freeze records
 *   post:
 *     summary: Add a freeze period to a client
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [startDate, endDate]
 *             properties:
 *               startDate: { type: string, format: date }
 *               endDate:   { type: string, format: date }
 *     responses:
 *       201:
 *         description: Freeze created
 *
 * /clients/{id}/freezes/{freezeId}:
 *   delete:
 *     summary: Remove a freeze period
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: freezeId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Freeze removed
 */
router.get('/:id/freezes', clientsController.getFreezes);
router.post('/:id/freezes', clientsController.createFreeze);
router.delete('/:id/freezes/:freezeId', clientsController.deleteFreeze);

/**
 * @openapi
 * /clients/{id}/set-password:
 *   post:
 *     summary: Set or reset the portal login password for a client
 *     tags: [Clients]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [password]
 *             properties:
 *               password: { type: string, minLength: 6 }
 *     responses:
 *       200:
 *         description: Password set
 */
router.post('/:id/set-password', clientsController.setPassword);

export default router;
