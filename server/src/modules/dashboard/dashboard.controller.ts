import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { computeStatusesForClients } from '../../lib/clientSubscriptionStatus';

export async function getDashboard(req: Request, res: Response, next: NextFunction) {
    const wsId = req.user!.workspaceId;
    const userId = req.user!.userId;
    try {
        const [user, allClients, pendingForms, clientDates] = await Promise.all([
            prisma.users.findUnique({
                where: { id: userId },
                select: { fname: true, lname: true, email: true },
            }),
            prisma.clients.findMany({
                where: { workspace_id: wsId },
                select: { id: true, fname: true, lname: true, email: true, archived_at: true, created_at: true },
                orderBy: { created_at: 'desc' },
            }),
            prisma.form_requests.count({ where: { workspace_id: wsId, status: 'pending' } }),
            prisma.clients.findMany({
                where: { workspace_id: wsId, created_at: { not: null } },
                select: { created_at: true },
                orderBy: { created_at: 'asc' },
            }),
        ]);

        // Status is computed live, not read from clients.subscription_status — that
        // column is only a once-daily snapshot for change-detection (see
        // middleware/scheduler.ts), and reading it directly here previously made
        // "Active"/"Expired" counts drift out of sync with the clients page, which
        // has always computed live.
        const statuses = await computeStatusesForClients(wsId, allClients.map(c => ({ id: c.id, archived_at: c.archived_at })));

        const totalClients   = allClients.length;
        const activeClients  = allClients.filter(c => statuses[c.id] === 'Active').length;
        const expiredClients = allClients.filter(c => statuses[c.id] === 'Expired').length;
        const recentClients  = allClients.slice(0, 5).map(({ archived_at, ...c }) => ({ ...c, subscription_status: statuses[c.id] }));

        // Running total of clients signed up, one point per signup — mirrors the
        // {date, value} reading shape the AreaChart component already expects.
        let runningTotal = 0;
        const clientGrowth = clientDates.map(({ created_at }) => ({
            date: created_at,
            value: ++runningTotal,
        }));

        res.json({
            fname: user?.fname,
            lname: user?.lname,
            email: user?.email,
            stats: { totalClients, activeClients, expiredClients, pendingForms },
            recentClients,
            clientGrowth,
        });
    } catch (err) {
        next(err);
    }
}
