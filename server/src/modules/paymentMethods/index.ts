import { Router } from 'express';
import { createId } from '@paralleldrive/cuid2';
import authMiddleware from '../../middleware/auth';
import requirePermission from '../../middleware/requirePermission';
import { prisma } from '../../lib/prisma';

const router = Router();

const VALID_TYPES = ['cash', 'card', 'wallet', 'bank_transfer'];

router.use(authMiddleware);
router.use((req, res, next) => {
    const action = req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('finance', action)(req, res, next);
});

router.get('/', async (req, res, next) => {
    try {
        const methods = await prisma.payment_methods.findMany({
            where: { workspace_id: req.user!.workspaceId },
            orderBy: { created_at: 'asc' },
        });
        res.json(methods);
    } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
    const { name, type } = req.body as { name?: string; type?: string };
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!VALID_TYPES.includes(type!)) return res.status(400).json({ error: 'Invalid type' });

    try {
        const method = await prisma.payment_methods.create({
            data: { id: createId(), workspace_id: req.user!.workspaceId, name: name.trim(), type: type! },
        });
        res.status(201).json(method);
    } catch (err) { next(err); }
});

router.put('/', async (req, res, next) => {
    const { id, name, type, active } = req.body as { id?: string; name?: string; type?: string; active?: boolean };
    if (!id) return res.status(400).json({ error: 'id is required' });
    if (type !== undefined && !VALID_TYPES.includes(type)) return res.status(400).json({ error: 'Invalid type' });

    try {
        const existing = await prisma.payment_methods.findFirst({
            where: { id, workspace_id: req.user!.workspaceId },
        });
        if (!existing) return res.status(404).json({ error: 'Payment method not found' });

        const updated = await prisma.payment_methods.update({
            where: { id },
            data: {
                name:   name   !== undefined ? name.trim() : existing.name,
                type:   type   !== undefined ? type        : existing.type,
                active: active !== undefined ? active      : existing.active,
            },
        });
        res.json(updated);
    } catch (err) { next(err); }
});

router.delete('/', async (req, res, next) => {
    const id = req.query.id as string;
    if (!id) return res.status(400).json({ error: 'id is required' });

    try {
        const deleted = await prisma.payment_methods.deleteMany({
            where: { id, workspace_id: req.user!.workspaceId },
        });
        if (deleted.count === 0) return res.status(404).json({ error: 'Payment method not found' });
        res.json({ deleted: id });
    } catch (err) { next(err); }
});

export default router;
