import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import * as dashboardController from './dashboard.controller';

const router = Router();

router.get('/', authMiddleware, dashboardController.getDashboard);

export default router;
