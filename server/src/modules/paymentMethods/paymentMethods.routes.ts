import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import requirePermission from '../../middleware/requirePermission';
import * as paymentMethodsController from './paymentMethods.controller';

const router = Router();

router.use(authMiddleware);
router.use((req, res, next) => {
    const action = req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('finance', action)(req, res, next);
});

router.get('/', paymentMethodsController.getPaymentMethods);
router.post('/', paymentMethodsController.createPaymentMethod);
router.put('/', paymentMethodsController.updatePaymentMethod);
router.delete('/', paymentMethodsController.deletePaymentMethod);

export default router;
