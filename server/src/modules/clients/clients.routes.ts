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

router.get('/limit-check',          clientsController.checkClientLimitHandler);
router.get('/',                     clientsController.getClients);
router.post('/',                    clientsController.createClient);
router.get('/:id',                  clientsController.getClient);
router.put('/:id',                  clientsController.updateClient);
router.delete('/:id',               clientsController.deleteClient);
router.get('/:id/freezes',          clientsController.getFreezes);
router.post('/:id/freezes',         clientsController.createFreeze);
router.delete('/:id/freezes/:freezeId', clientsController.deleteFreeze);
router.post('/:id/set-password',    clientsController.setPassword);

export default router;
