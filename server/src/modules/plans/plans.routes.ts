import { Router } from 'express';
import * as plansController from './plans.controller';

const router = Router();

router.get('/', plansController.getPlans);
router.get('/billing-discounts', plansController.getBillingDiscounts);

export default router;
