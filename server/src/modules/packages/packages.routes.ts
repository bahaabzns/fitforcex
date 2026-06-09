import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import requirePermission from '../../middleware/requirePermission';
import * as packagesController from './packages.controller';

const router = Router();

router.use(authMiddleware);
router.use((req, res, next) => {
    const action = req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('finance', action)(req, res, next);
});

router.get('/', packagesController.getPackages);
router.post('/', packagesController.createPackage);
router.put('/', packagesController.updatePackage);
router.delete('/', packagesController.deletePackage);

export default router;
