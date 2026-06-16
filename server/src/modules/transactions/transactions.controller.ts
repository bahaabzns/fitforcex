import { Request, Response, NextFunction } from 'express';
import path from 'path';
import { Prisma } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import { makeUploader, createSignedUrl } from '../../lib/storage';
import { uploadLimiter } from '../../middleware/rateLimit';
import { computeSubscriptionStatus } from '../../utils/subscriptionStatus';
import { prisma } from '../../lib/prisma';

const VALID_STATUSES = ['completed', 'refunded'];
const VALID_TYPES    = ['subscription', 'session', 'one-time', 'other'];

export const upload = makeUploader('transactions', ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf'], { maxSize: 5 * 1024 * 1024 });

type TxDbRow = Record<string, unknown>;

function mapRow(row: TxDbRow) {
    return {
        id:                    row.id,
        code:                  row.transaction_code,
        clientId:              row.client_id,
        clientName:            row.client_name,
        packageVariation:      row.package_variation,
        paymentMethod:         row.payment_method,
        amount:                Number(row.amount),
        currency:              row.currency,
        duration:              row.duration,
        type:                  row.type,
        status:                row.status,
        notes:                 row.notes,
        proofImage:            row.proof_image,
        date:                  row.transaction_date,
        createdAt:             row.created_at,
        subscriptionStartDate: row.subscription_start_date ?? null,
        startMode:             row.start_mode || 'on_first_plan',
    };
}

function computePerTxStatuses(
    txByClient: Record<string, TxDbRow[]>,
    freezesByClient: Record<string, TxDbRow[]>,
    planActivationByClient: Record<string, string | null>
): Record<string, string> {
    const result: Record<string, string> = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const [clientId, allTxs] of Object.entries(txByClient)) {
        const freezes         = freezesByClient[clientId] || [];
        const firstActivation = planActivationByClient[clientId] ?? null;

        for (const tx of allTxs) {
            if (tx.status === 'refunded') { result[tx.id as string] = 'Refunded'; }
        }

        const completed = allTxs
            .filter(tx => tx.status === 'completed' && tx.duration && Number(tx.duration) > 0)
            .sort((a, b) => new Date(a.created_at as string).getTime() - new Date(b.created_at as string).getTime());

        let prevEnd: Date | null = null;
        for (const tx of completed) {
            let start: Date;
            const mode = (tx.start_mode as string) || 'on_first_plan';

            if (mode === 'custom' && tx.subscription_start_date) {
                start = new Date(tx.subscription_start_date as string);
            } else if (prevEnd !== null) {
                start = new Date(prevEnd);
            } else if (firstActivation) {
                start = new Date(firstActivation);
            } else {
                result[tx.id as string] = 'Pre-start';
                continue;
            }
            start.setHours(0, 0, 0, 0);

            let endMs = start.getTime() + Number(tx.duration) * 86400000;
            for (const freeze of freezes) {
                const fs = new Date(freeze.freeze_start_date as string);
                fs.setHours(0, 0, 0, 0);
                if (fs >= start && fs.getTime() < endMs) {
                    endMs += Number(freeze.freeze_duration_days) * 86400000;
                }
            }
            prevEnd = new Date(endMs);

            if (today < start) {
                result[tx.id as string] = 'Pre-start';
            } else if (today >= prevEnd) {
                result[tx.id as string] = 'Expired';
            } else {
                let frozen = false;
                for (const freeze of freezes) {
                    const fs = new Date(freeze.freeze_start_date as string);
                    fs.setHours(0, 0, 0, 0);
                    const fe = new Date(fs.getTime() + Number(freeze.freeze_duration_days) * 86400000);
                    if (today >= fs && today < fe) { frozen = true; break; }
                }
                result[tx.id as string] = frozen ? 'Frozen' : 'Active';
            }
        }
    }
    return result;
}

type ActivationRow = { client_id: string; first_activation: Date | null };

async function getFirstPlanActivation(clientId: string): Promise<string | null> {
    const rows = await prisma.$queryRaw<ActivationRow[]>`
        SELECT MIN(activated_at) AS first_activation FROM (
            SELECT activated_at FROM training_plans  WHERE client_id = ${clientId} AND activated_at IS NOT NULL
            UNION ALL
            SELECT activated_at FROM nutrition_plans WHERE client_id = ${clientId} AND activated_at IS NOT NULL
        ) x
    `;
    return rows[0]?.first_activation ? rows[0].first_activation.toISOString() : null;
}

// Next per-workspace sequential transaction code (the human-friendly #0001 shown in the UI).
async function nextTransactionCode(workspaceId: string): Promise<number> {
    const max = await prisma.transactions.aggregate({
        where: { workspace_id: workspaceId },
        _max: { transaction_code: true },
    });
    return (max._max.transaction_code ?? 0) + 1;
}

async function syncClientPackage(clientId: string | null, workspaceId: string): Promise<void> {
    if (!clientId) return;
    const latest = await prisma.transactions.findFirst({
        where: { client_id: clientId, workspace_id: workspaceId },
        select: { package_variation: true },
        orderBy: [{ transaction_date: 'desc' }, { created_at: 'desc' }],
    });
    if (latest) {
        await prisma.clients.updateMany({
            where: { id: clientId, workspace_id: workspaceId },
            data:  { current_package: latest.package_variation },
        });
    }
}

export async function getProof(req: Request, res: Response, next: NextFunction) {
    const filename = path.basename(req.params.filename as string);
    const dbPath   = `/api/transactions/proof/${filename}`;
    const s3Key    = `transactions/${filename}`;
    try {
        const tx = await prisma.transactions.findFirst({
            where: { proof_image: dbPath, workspace_id: req.user!.workspaceId },
            select: { id: true },
        });
        if (!tx) return res.status(403).json({ error: 'Forbidden' });
        const url = await createSignedUrl(s3Key);
        res.redirect(url);
    } catch (err) { next(err); }
}

export function uploadProof(req: Request, res: Response) {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const s3File = req.file as Express.MulterS3.File;
    const filename = path.basename(s3File.key);
    res.json({ path: `/api/transactions/proof/${filename}` });
}

export async function getByClient(req: Request, res: Response, next: NextFunction) {
    const clientId = req.params.clientId as string;
    try {
        const rows = await prisma.$queryRaw<TxDbRow[]>`
            SELECT * FROM transactions
            WHERE workspace_id = ${req.user!.workspaceId}
              AND (client_id = ${clientId} OR (client_id IS NULL AND client_name ILIKE (
                  SELECT CONCAT(fname, ' ', lname) FROM clients WHERE id = ${clientId} AND workspace_id = ${req.user!.workspaceId} LIMIT 1
              )))
            ORDER BY transaction_date DESC
        `;
        res.json(rows.map(mapRow));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
}

export async function getTransactions(req: Request, res: Response, next: NextFunction) {
    const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit  = Math.min(10000, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const wsId   = req.user!.workspaceId;

    try {
        const [txRows, total] = await Promise.all([
            prisma.transactions.findMany({
                where: { workspace_id: wsId },
                orderBy: { created_at: 'desc' },
                take: limit,
                skip: offset,
            }),
            prisma.transactions.count({ where: { workspace_id: wsId } }),
        ]);

        const clientIds = [...new Set(txRows.map(r => r.client_id).filter(Boolean))] as string[];
        let txStatuses: Record<string, string> = {};

        if (clientIds.length > 0) {
            type FreezeRow = { client_id: string; freeze_start_date: Date; freeze_duration_days: number };
            type PlanActRow = { client_id: string; first_activation: Date | null };

            const [allClientTxs, freezeRows, planActRows] = await Promise.all([
                prisma.transactions.findMany({
                    where: { workspace_id: wsId, client_id: { in: clientIds } },
                    select: { id: true, client_id: true, status: true, duration: true, subscription_start_date: true, start_mode: true, created_at: true },
                }),
                prisma.subscription_freezes.findMany({
                    where: { client_id: { in: clientIds } },
                }),
                prisma.$queryRaw<PlanActRow[]>`
                    SELECT client_id, MIN(activated_at) AS first_activation FROM (
                        SELECT client_id, activated_at FROM training_plans
                        WHERE workspace_id = ${wsId} AND client_id = ANY(${Prisma.raw(`ARRAY[${clientIds.map(id => `'${id}'`).join(',')}]`)}) AND activated_at IS NOT NULL
                        UNION ALL
                        SELECT client_id, activated_at FROM nutrition_plans
                        WHERE workspace_id = ${wsId} AND client_id = ANY(${Prisma.raw(`ARRAY[${clientIds.map(id => `'${id}'`).join(',')}]`)}) AND activated_at IS NOT NULL
                    ) combined GROUP BY client_id
                `,
            ]);

            const freezesByClient: Record<string, TxDbRow[]> = {};
            for (const f of freezeRows as FreezeRow[]) {
                if (!freezesByClient[f.client_id]) freezesByClient[f.client_id] = [];
                freezesByClient[f.client_id].push(f as unknown as TxDbRow);
            }
            const planActivationByClient: Record<string, string | null> = {};
            for (const row of planActRows) {
                planActivationByClient[row.client_id] = row.first_activation ? new Date(row.first_activation).toISOString() : null;
            }
            const txByClient: Record<string, TxDbRow[]> = {};
            for (const tx of allClientTxs) {
                if (!tx.client_id) continue;
                if (!txByClient[tx.client_id]) txByClient[tx.client_id] = [];
                txByClient[tx.client_id].push(tx as unknown as TxDbRow);
            }

            txStatuses = computePerTxStatuses(txByClient, freezesByClient, planActivationByClient);
        }

        res.json({
            data: txRows.map(row => ({ ...mapRow(row as unknown as TxDbRow), subscriptionStatus: txStatuses[row.id] ?? null })),
            total, page, limit, totalPages: Math.ceil(total / limit),
        });
    } catch (err) { next(err); }
}

export async function createTransaction(req: Request, res: Response, next: NextFunction) {
    const { clientName, clientId, packageVariation, paymentMethod, amount, currency,
            duration, type, status, notes, date, proofImage, subscriptionStartDate } = req.body as Record<string, string | undefined>;

    if (!clientName?.trim())    return res.status(400).json({ error: 'Client name is required' });
    if (!paymentMethod?.trim()) return res.status(400).json({ error: 'Payment method is required' });
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Amount must be a positive number' });
    if (!currency?.trim())  return res.status(400).json({ error: 'Currency is required' });
    if (type   && !VALID_TYPES.includes(type))     return res.status(400).json({ error: 'Invalid type' });
    if (status && !VALID_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status' });

    try {
        let startMode = 'on_first_plan';
        let finalSubStartDate: Date | null = null;

        if (subscriptionStartDate) {
            startMode = 'custom';
            finalSubStartDate = new Date(subscriptionStartDate);
        } else if (clientId) {
            const [existingTxs, freezeRows, planActivation] = await Promise.all([
                prisma.transactions.findMany({
                    where: { client_id: clientId, workspace_id: req.user!.workspaceId },
                }),
                prisma.subscription_freezes.findMany({ where: { client_id: clientId } }),
                getFirstPlanActivation(clientId),
            ]);

            const currentStatus = computeSubscriptionStatus(
                existingTxs as unknown as Parameters<typeof computeSubscriptionStatus>[0],
                freezeRows as unknown as Parameters<typeof computeSubscriptionStatus>[1],
                planActivation
            );
            if (currentStatus === 'Active') startMode = 'queued';
        }

        const newData = {
            workspace_id:            req.user!.workspaceId,
            client_id:               clientId || null,
            client_name:             clientName.trim(),
            package_variation:       packageVariation?.trim() || null,
            payment_method:          paymentMethod.trim(),
            amount:                  amt,
            currency:                currency.trim(),
            duration:                duration ? Number(duration) : null,
            type:                    type || 'subscription',
            status:                  status || 'completed',
            notes:                   notes?.trim() || null,
            proof_image:             proofImage || null,
            transaction_date:        date ? new Date(date) : new Date(),
            subscription_start_date: finalSubStartDate,
            start_mode:              startMode,
        };

        // Retry on the (workspace_id, transaction_code) unique constraint in case a
        // concurrent create grabbed the same sequential code first.
        let tx: Awaited<ReturnType<typeof prisma.transactions.create>> | null = null;
        for (let attempt = 0; attempt < 5; attempt++) {
            try {
                tx = await prisma.transactions.create({
                    data: { id: createId(), transaction_code: await nextTransactionCode(req.user!.workspaceId), ...newData },
                });
                break;
            } catch (e) {
                if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002' && attempt < 4) continue;
                throw e;
            }
        }
        if (!tx) return res.status(500).json({ error: 'Failed to generate unique transaction code' });

        await syncClientPackage(tx.client_id, req.user!.workspaceId);
        res.status(201).json(mapRow(tx as unknown as TxDbRow));
    } catch (err) { next(err); }
}

export async function updateTransaction(req: Request, res: Response, next: NextFunction) {
    const id = req.params.id as string;
    const { clientName, clientId, packageVariation, paymentMethod, amount, currency,
            duration, type, status, notes, date, proofImage, subscriptionStartDate } = req.body as Record<string, string | undefined>;

    if (type   !== undefined && !VALID_TYPES.includes(type!))     return res.status(400).json({ error: 'Invalid type' });
    if (status !== undefined && !VALID_STATUSES.includes(status!)) return res.status(400).json({ error: 'Invalid status' });

    try {
        const cur = await prisma.transactions.findFirst({
            where: { id, workspace_id: req.user!.workspaceId },
        });
        if (!cur) return res.status(404).json({ error: 'Transaction not found' });

        const amt = amount !== undefined ? Number(amount) : Number(cur.amount);
        if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Amount must be a positive number' });

        let newStartMode    = cur.start_mode || 'on_first_plan';
        let newSubStartDate: Date | null | undefined = subscriptionStartDate !== undefined
            ? (subscriptionStartDate ? new Date(subscriptionStartDate) : null)
            : cur.subscription_start_date;

        if (subscriptionStartDate !== undefined) {
            newStartMode = subscriptionStartDate ? 'custom' : cur.start_mode === 'queued' ? 'queued' : 'on_first_plan';
        }

        const updated = await prisma.transactions.update({
            where: { id },
            data: {
                client_id:               clientId         !== undefined ? (clientId || null)                 : cur.client_id,
                client_name:             clientName       !== undefined ? clientName.trim()                  : cur.client_name,
                package_variation:       packageVariation !== undefined ? (packageVariation?.trim() || null) : cur.package_variation,
                payment_method:          paymentMethod    !== undefined ? paymentMethod.trim()               : cur.payment_method,
                amount:                  amt,
                currency:                currency   !== undefined ? currency.trim()                          : cur.currency,
                duration:                duration   !== undefined ? (duration ? Number(duration) : null)     : cur.duration,
                type:                    type       !== undefined ? type                                     : cur.type,
                status:                  status     !== undefined ? status                                   : cur.status,
                notes:                   notes      !== undefined ? (notes?.trim() || null)                  : cur.notes,
                proof_image:             proofImage !== undefined ? (proofImage || null)                     : cur.proof_image,
                transaction_date:        date       !== undefined ? new Date(date!)                          : cur.transaction_date,
                subscription_start_date: newSubStartDate,
                start_mode:              newStartMode,
            },
        });

        await syncClientPackage(updated.client_id, req.user!.workspaceId);
        res.json(mapRow(updated as unknown as TxDbRow));
    } catch (err) { next(err); }
}

export async function deleteTransaction(req: Request, res: Response, next: NextFunction) {
    const id = req.params.id as string;
    try {
        const deleted = await prisma.transactions.deleteMany({
            where: { id, workspace_id: req.user!.workspaceId },
        });
        if (deleted.count === 0) return res.status(404).json({ error: 'Transaction not found' });
        res.json({ deleted: id });
    } catch (err) { next(err); }
}

export { uploadLimiter };
