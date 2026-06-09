import { Router } from 'express';
import authMiddleware from '../../middleware/auth';
import { prisma } from '../../lib/prisma';

const router = Router();

router.get('/', authMiddleware, async (req, res, next) => {
    const wsId = req.user!.workspaceId;
    const userId = req.user!.userId;
    try {
        const [user, totalClients, activeClients, expiredClients, pendingForms, recentClients] = await Promise.all([
            prisma.users.findUnique({
                where: { id: userId },
                select: { fname: true, lname: true, email: true },
            }),
            prisma.clients.count({ where: { workspace_id: wsId } }),
            prisma.clients.count({ where: { workspace_id: wsId, subscription_status: 'Active' } }),
            prisma.clients.count({ where: { workspace_id: wsId, subscription_status: 'Expired' } }),
            prisma.form_requests.count({ where: { workspace_id: wsId, status: 'pending' } }),
            prisma.clients.findMany({
                where: { workspace_id: wsId },
                select: { id: true, fname: true, lname: true, email: true, subscription_status: true, created_at: true },
                orderBy: { created_at: 'desc' },
                take: 5,
            }),
        ]);

        res.json({
            fname: user?.fname,
            lname: user?.lname,
            email: user?.email,
            stats: {
                totalClients,
                activeClients,
                expiredClients,
                pendingForms,
            },
            recentClients,
        });
    } catch (err) {
        next(err);
    }
});

export default router;
