import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import * as billingController from './billing.controller';

const router = Router();

// No authMiddleware — Fawaterak redirects the iframe here after payment.
router.get('/callback', billingController.handleCallback);

router.use(authMiddleware);

router.use((req, res, next) => {
    if (!req.user!.isOwner) {
        return res.status(403).json({ error: 'Only the workspace owner can manage billing' });
    }
    next();
});

router.get('/subscription',                billingController.getSubscription);
router.get('/plans',                       billingController.getPlans);
router.post('/create-invoice',             billingController.createInvoice);
router.get('/payment-status/:paymentId',   billingController.getPaymentStatus);

export default router;
