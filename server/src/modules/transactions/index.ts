import { Router } from 'express';
import path from 'path';
import { createId } from '@paralleldrive/cuid2';
import authMiddleware from '../../middleware/auth';
import requirePermission from '../../middleware/requirePermission';
import { makeUploader, createSignedUrl } from '../../lib/storage';
import { uploadLimiter } from '../../middleware/rateLimit';
import { computeSubscriptionStatus } from '../../utils/subscriptionStatus';
import pool from '../../db';

const router = Router();

const VALID_STATUSES = ['completed', 'refunded'];
const VALID_TYPES    = ['subscription', 'session', 'one-time', 'other'];

const upload = makeUploader('transactions', ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.pdf'], { maxSize: 5 * 1024 * 1024 });

type TxDbRow = Record<string, unknown>;

function mapRow(row: TxDbRow) {
    return {
        id:                    row.id,
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

async function getFirstPlanActivation(clientId: string): Promise<string | null> {
    const result = await pool.query(
        `SELECT MIN(activated_at) AS first_activation FROM (
            SELECT activated_at FROM training_plans  WHERE client_id = $1 AND activated_at IS NOT NULL
            UNION ALL
            SELECT activated_at FROM nutrition_plans WHERE client_id = $1 AND activated_at IS NOT NULL
        ) x`,
        [clientId]
    );
    return (result.rows[0] as Record<string, string | null>)?.first_activation ?? null;
}

async function syncClientPackage(clientId: string | null, workspaceId: string): Promise<void> {
    if (!clientId) return;
    const latest = await pool.query(
        `SELECT package_variation FROM transactions
         WHERE client_id = $1 AND workspace_id = $2
         ORDER BY transaction_date DESC, created_at DESC LIMIT 1`,
        [clientId, workspaceId]
    );
    if (latest.rows.length) {
        await pool.query(
            'UPDATE clients SET current_package = $1 WHERE id = $2 AND workspace_id = $3',
            [(latest.rows[0] as TxDbRow).package_variation, clientId, workspaceId]
        );
    }
}

router.use(authMiddleware);
router.use((req, res, next) => {
    const action = req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('finance', action)(req, res, next);
});

router.get('/proof/:filename', async (req, res, next) => {
    const filename = path.basename(req.params.filename);
    const dbPath   = `/api/transactions/proof/${filename}`;
    const s3Key    = `transactions/${filename}`;
    try {
        const result = await pool.query(
            'SELECT id FROM transactions WHERE proof_image = $1 AND workspace_id = $2',
            [dbPath, req.user!.workspaceId]
        );
        if (!result.rows.length) return res.status(403).json({ error: 'Forbidden' });
        const url = await createSignedUrl(s3Key);
        res.redirect(url);
    } catch (err) { next(err); }
});

router.post('/upload-proof', uploadLimiter, upload.single('proof'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const s3File = req.file as Express.MulterS3.File;
    const filename = path.basename(s3File.key);
    res.json({ path: `/api/transactions/proof/${filename}` });
});

router.get('/by-client/:clientId', async (req, res, next) => {
    try {
        const result = await pool.query(
            `SELECT * FROM transactions
             WHERE workspace_id = $1 AND (client_id = $2 OR (client_id IS NULL AND client_name ILIKE (
                 SELECT CONCAT(fname, ' ', lname) FROM clients WHERE id = $2 AND workspace_id = $1 LIMIT 1
             )))
             ORDER BY transaction_date DESC`,
            [req.user!.workspaceId, req.params.clientId]
        );
        res.json(result.rows.map(mapRow));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/', async (req, res, next) => {
    const page   = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;

    try {
        const [txResult, countResult] = await Promise.all([
            pool.query(`SELECT * FROM transactions WHERE workspace_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`,
                [req.user!.workspaceId, limit, offset]),
            pool.query('SELECT COUNT(*) FROM transactions WHERE workspace_id = $1', [req.user!.workspaceId]),
        ]);

        const clientIds = [...new Set((txResult.rows as TxDbRow[]).map(r => r.client_id).filter(Boolean))] as string[];
        let txStatuses: Record<string, string> = {};

        if (clientIds.length > 0) {
            const placeholders       = clientIds.map((_, i) => `$${i + 2}`).join(', ');
            const freezePlaceholders = clientIds.map((_, i) => `$${i + 1}`).join(', ');

            const [allClientTxResult, freezeResult, planActivationResult] = await Promise.all([
                pool.query(
                    `SELECT client_id, status, duration, subscription_start_date, start_mode, created_at
                     FROM transactions WHERE workspace_id = $1 AND client_id IN (${placeholders})`,
                    [req.user!.workspaceId, ...clientIds]
                ),
                pool.query(`SELECT sf.* FROM subscription_freezes sf WHERE sf.client_id IN (${freezePlaceholders})`, clientIds),
                pool.query(
                    `SELECT client_id, MIN(activated_at) AS first_activation FROM (
                         SELECT client_id, activated_at FROM training_plans
                         WHERE workspace_id = $1 AND client_id IN (${placeholders}) AND activated_at IS NOT NULL
                         UNION ALL
                         SELECT client_id, activated_at FROM nutrition_plans
                         WHERE workspace_id = $1 AND client_id IN (${placeholders}) AND activated_at IS NOT NULL
                     ) combined GROUP BY client_id`,
                    [req.user!.workspaceId, ...clientIds]
                ),
            ]);

            const freezesByClient: Record<string, TxDbRow[]> = {};
            for (const f of freezeResult.rows as TxDbRow[]) {
                const cid = f.client_id as string;
                if (!freezesByClient[cid]) freezesByClient[cid] = [];
                freezesByClient[cid].push(f);
            }
            const planActivationByClient: Record<string, string | null> = {};
            for (const row of planActivationResult.rows as TxDbRow[]) {
                planActivationByClient[row.client_id as string] = row.first_activation as string | null;
            }
            const txByClient: Record<string, TxDbRow[]> = {};
            for (const tx of allClientTxResult.rows as TxDbRow[]) {
                if (tx.client_id == null) continue;
                const cid = tx.client_id as string;
                if (!txByClient[cid]) txByClient[cid] = [];
                txByClient[cid].push(tx);
            }

            txStatuses = computePerTxStatuses(txByClient, freezesByClient, planActivationByClient);
        }

        const total = parseInt((countResult.rows[0] as Record<string, string>).count);
        res.json({
            data: (txResult.rows as TxDbRow[]).map(row => ({ ...mapRow(row), subscriptionStatus: txStatuses[row.id as string] ?? null })),
            total, page, limit, totalPages: Math.ceil(total / limit),
        });
    } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
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
            const [existingTxResult, existingFreezesResult, planActivation] = await Promise.all([
                pool.query(
                    `SELECT client_id, status, duration, subscription_start_date, start_mode, created_at
                     FROM transactions WHERE client_id = $1 AND workspace_id = $2`,
                    [clientId, req.user!.workspaceId]
                ),
                pool.query('SELECT * FROM subscription_freezes WHERE client_id = $1', [clientId]),
                getFirstPlanActivation(clientId),
            ]);

            const currentStatus = computeSubscriptionStatus(
                existingTxResult.rows, existingFreezesResult.rows, planActivation
            );
            if (currentStatus === 'Active') startMode = 'queued';
        }

        const result = await pool.query(
            `INSERT INTO transactions
                (workspace_id, client_id, client_name, package_variation, payment_method, amount, currency,
                 duration, type, status, notes, proof_image, transaction_date, subscription_start_date, start_mode, id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) RETURNING *`,
            [
                req.user!.workspaceId, clientId || null, clientName.trim(),
                packageVariation?.trim() || null, paymentMethod.trim(), amt, currency.trim(),
                duration ? Number(duration) : null, type || 'subscription', status || 'completed',
                notes?.trim() || null, proofImage || null, date ? new Date(date) : new Date(),
                finalSubStartDate, startMode, createId(),
            ]
        );
        await syncClientPackage((result.rows[0] as TxDbRow).client_id as string | null, req.user!.workspaceId);
        res.status(201).json(mapRow(result.rows[0] as TxDbRow));
    } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
    const id = req.params.id;
    const { clientName, clientId, packageVariation, paymentMethod, amount, currency,
            duration, type, status, notes, date, proofImage, subscriptionStartDate } = req.body as Record<string, string | undefined>;

    if (!id) return res.status(400).json({ error: 'id is required' });
    if (type   !== undefined && !VALID_TYPES.includes(type!))     return res.status(400).json({ error: 'Invalid type' });
    if (status !== undefined && !VALID_STATUSES.includes(status!)) return res.status(400).json({ error: 'Invalid status' });

    try {
        const existing = await pool.query('SELECT * FROM transactions WHERE id = $1 AND workspace_id = $2', [id, req.user!.workspaceId]);
        if (!existing.rows.length) return res.status(404).json({ error: 'Transaction not found' });

        const cur = existing.rows[0] as TxDbRow;
        const amt = amount !== undefined ? Number(amount) : Number(cur.amount);
        if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Amount must be a positive number' });

        let newStartMode    = (cur.start_mode as string) || 'on_first_plan';
        let newSubStartDate = subscriptionStartDate !== undefined
            ? (subscriptionStartDate ? new Date(subscriptionStartDate) : null)
            : cur.subscription_start_date;

        if (subscriptionStartDate !== undefined) {
            newStartMode = subscriptionStartDate ? 'custom' : cur.start_mode === 'queued' ? 'queued' : 'on_first_plan';
        }

        const result = await pool.query(
            `UPDATE transactions
                SET client_id = $1, client_name = $2, package_variation = $3, payment_method = $4,
                    amount = $5, currency = $6, duration = $7, type = $8, status = $9,
                    notes = $10, proof_image = $11, transaction_date = $12,
                    subscription_start_date = $13, start_mode = $14
                WHERE id = $15 AND workspace_id = $16 RETURNING *`,
            [
                clientId         !== undefined ? (clientId || null)                           : cur.client_id,
                clientName       !== undefined ? clientName.trim()                            : cur.client_name,
                packageVariation !== undefined ? (packageVariation?.trim() || null)           : cur.package_variation,
                paymentMethod    !== undefined ? paymentMethod.trim()                         : cur.payment_method,
                amt,
                currency   !== undefined ? currency.trim()                              : cur.currency,
                duration   !== undefined ? (duration ? Number(duration) : null)         : cur.duration,
                type       !== undefined ? type                                          : cur.type,
                status     !== undefined ? status                                        : cur.status,
                notes      !== undefined ? (notes?.trim() || null)                      : cur.notes,
                proofImage !== undefined ? (proofImage || null)                         : cur.proof_image,
                date       !== undefined ? new Date(date!)                              : cur.transaction_date,
                newSubStartDate, newStartMode, id, req.user!.workspaceId,
            ]
        );
        await syncClientPackage((result.rows[0] as TxDbRow).client_id as string | null, req.user!.workspaceId);
        res.json(mapRow(result.rows[0] as TxDbRow));
    } catch (err) { next(err); }
});

router.delete('/:id', async (req, res, next) => {
    const id = req.params.id;
    if (!id) return res.status(400).json({ error: 'id is required' });
    try {
        const result = await pool.query('DELETE FROM transactions WHERE id = $1 AND workspace_id = $2 RETURNING id', [id, req.user!.workspaceId]);
        if (!result.rows.length) return res.status(404).json({ error: 'Transaction not found' });
        res.json({ deleted: (result.rows[0] as TxDbRow).id });
    } catch (err) { next(err); }
});

export default router;
