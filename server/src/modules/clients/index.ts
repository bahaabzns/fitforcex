import { Router, Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcrypt';
import authMiddleware from '../../middleware/auth';
import requirePermission from '../../middleware/requirePermission';
import { computeSubscriptionStatus } from '../../utils/subscriptionStatus';
import { checkClientLimit } from '../../lib/seatLimits';
import pool from '../../db';

const router = Router();

router.use(authMiddleware);
router.use((req: Request, res: Response, next: NextFunction) => {
    const action = req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('clients', action)(req, res, next);
});

type ClientRow = Record<string, unknown>;
type FreezeRow = Record<string, unknown>;

function mapClient(row: ClientRow) {
    const phones = Array.isArray(row.phones) && (row.phones as unknown[]).length > 0
        ? row.phones
        : (row.phone ? [{ countryCode: '', number: row.phone }] : []);
    return {
        id:                  row.id,
        code:                row.client_code,
        fname:               row.fname,
        lname:               row.lname,
        name:                `${row.fname} ${row.lname}`,
        email:               row.email,
        phone:               row.phone,
        phones,
        current_package:     row.current_package,
        subscription_status: row.subscription_status || 'Pre-start',
        has_password:        !!row.password,
        created_at:          row.created_at,
    };
}

function mapFreeze(row: FreezeRow) {
    return {
        id:                  row.id,
        clientId:            row.client_id,
        freezeStartDate:     row.freeze_start_date,
        freezeDurationDays:  row.freeze_duration_days,
        notes:               row.notes,
        createdAt:           row.created_at,
    };
}

// GET /api/clients
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    const page   = Math.max(1, parseInt(req.query.page as string)  || 1);
    const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const search = (req.query.search as string | undefined)?.trim() || '';

    try {
        const searchCondition = search ? `AND (c.fname ILIKE $3 OR c.lname ILIKE $3 OR c.email ILIKE $3)` : '';
        const searchParam     = search ? [`%${search}%`] : [];

        const [clientsResult, countResult] = await Promise.all([
            pool.query(
                `SELECT * FROM clients c
                    WHERE workspace_id = $1
                    ${searchCondition}
                    ORDER BY created_at DESC
                    LIMIT $2 OFFSET ${offset}`,
                [req.user!.workspaceId, limit, ...searchParam]
            ),
            pool.query(
                `SELECT COUNT(*) FROM clients WHERE workspace_id = $1 ${searchCondition}`,
                [req.user!.workspaceId, ...searchParam]
            ),
        ]);

        const clientIds = clientsResult.rows.map((r: ClientRow) => r.id);

        if (clientIds.length === 0) {
            return res.json({ data: [], total: 0, page, limit, totalPages: 0 });
        }

        const placeholders      = clientIds.map((_: unknown, i: number) => `$${i + 2}`).join(', ');
        const freezePlaceholders = clientIds.map((_: unknown, i: number) => `$${i + 1}`).join(', ');

        const [txResult, freezeResult, planActivationResult] = await Promise.all([
            pool.query(
                `SELECT client_id, status, duration, subscription_start_date, start_mode, created_at
                    FROM transactions
                    WHERE workspace_id = $1 AND client_id IN (${placeholders})`,
                [req.user!.workspaceId, ...clientIds]
            ),
            pool.query(
                `SELECT sf.* FROM subscription_freezes sf
                 WHERE sf.client_id IN (${freezePlaceholders})`,
                clientIds
            ),
            pool.query(
                `SELECT client_id, MIN(activated_at) AS first_activation
                    FROM (
                        SELECT client_id, activated_at FROM training_plans
                        WHERE workspace_id = $1 AND client_id IN (${placeholders}) AND activated_at IS NOT NULL
                        UNION ALL
                        SELECT client_id, activated_at FROM nutrition_plans
                        WHERE workspace_id = $1 AND client_id IN (${placeholders}) AND activated_at IS NOT NULL
                    ) combined
                    GROUP BY client_id`,
                [req.user!.workspaceId, ...clientIds]
            ),
        ]);

        type TxLike = { status: string; created_at: string | Date; duration?: number | string | null; start_mode?: string | null; subscription_start_date?: string | Date | null };
        const txByClient: Record<string, TxLike[]> = {};
        for (const tx of txResult.rows) {
            const key = (tx as ClientRow).client_id as string;
            if (!txByClient[key]) txByClient[key] = [];
            txByClient[key].push(tx as TxLike);
        }

        type Freezelike = { freeze_start_date: string | Date; freeze_duration_days: number | string; client_id?: string };
        const freezesByClient: Record<string, Freezelike[]> = {};
        for (const f of freezeResult.rows) {
            const key = (f as ClientRow).client_id as string;
            if (!freezesByClient[key]) freezesByClient[key] = [];
            freezesByClient[key].push(f as Freezelike);
        }

        const planActivationByClient: Record<string, unknown> = {};
        for (const row of planActivationResult.rows) {
            planActivationByClient[row.client_id as string] = row.first_activation;
        }

        const total = parseInt((countResult.rows[0] as Record<string, string>).count);

        res.json({
            data: clientsResult.rows.map((row: ClientRow) => ({
                ...mapClient(row),
                subscription_status: computeSubscriptionStatus(
                    txByClient[row.id as string] || [],
                    freezesByClient[row.id as string] || [],
                    (planActivationByClient[row.id as string] as Date | string | null) ?? null
                ),
            })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        });
    } catch (err) {
        next(err);
    }
});

// POST /api/clients
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
    const { fname, lname, name, email, phone, phones, password, currentPackage } = req.body as Record<string, unknown>;

    let firstName = fname as string | undefined;
    let lastName  = lname as string | undefined;
    if (name && !fname) {
        const parts = (name as string).trim().split(/\s+/);
        firstName = parts[0] || '';
        lastName  = parts.slice(1).join(' ') || '';
    }

    try {
        await checkClientLimit(req.user!.workspaceId);
        let nextCode: number | null = null;
        let retries = 0;
        const maxRetries = 10;

        while (nextCode === null && retries < maxRetries) {
            const randomCode  = Math.floor(Math.random() * 9999) + 1;
            const checkResult = await pool.query(
                'SELECT id FROM clients WHERE workspace_id = $1 AND client_code = $2 LIMIT 1',
                [req.user!.workspaceId, randomCode]
            );
            if (!checkResult.rows.length) nextCode = randomCode;
            retries++;
        }

        if (nextCode === null) {
            return res.status(500).json({ error: 'Failed to generate unique client code' });
        }

        const hashedPassword = password ? await bcrypt.hash(password as string, 10) : null;

        const phonesArray = Array.isArray(phones) && phones.length > 0
            ? phones
            : (phone ? [{ countryCode: '', number: phone }] : []);
        const firstPhone = phonesArray[0] as { countryCode?: string; number?: string } | undefined;
        const phoneText  = firstPhone
            ? `${firstPhone.countryCode || ''} ${firstPhone.number || ''}`.trim()
            : null;

        const result = await pool.query(
            `INSERT INTO clients
                (id, client_code, fname, lname, email, phone, phones, current_package,
                 subscription_status, workspace_id, password)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
            [
                createId(), nextCode, firstName, lastName, email,
                phoneText, JSON.stringify(phonesArray),
                currentPackage || null, 'Pre-start',
                req.user!.workspaceId, hashedPassword,
            ]
        );
        res.status(201).json({ ...mapClient(result.rows[0]) });
    } catch (err) {
        next(err);
    }
});

// GET /api/clients/limit-check
router.get('/limit-check', async (req: Request, res: Response, next: NextFunction) => {
    try {
        await checkClientLimit(req.user!.workspaceId);
        res.json({ allowed: true });
    } catch (err) {
        const httpErr = err as { status?: number; message?: string };
        if (httpErr.status === 403) {
            const limit = parseInt((httpErr.message || '').split(':')[1]);
            return res.json({ allowed: false, limit });
        }
        next(err);
    }
});

// GET /api/clients/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const [clientResult, planActivationResult] = await Promise.all([
            pool.query(
                'SELECT * FROM clients WHERE id = $1 AND workspace_id = $2',
                [req.params.id, req.user!.workspaceId]
            ),
            pool.query(
                `SELECT MIN(activated_at) AS first_activation FROM (
                     SELECT activated_at FROM training_plans
                     WHERE client_id = $1 AND activated_at IS NOT NULL
                     UNION ALL
                     SELECT activated_at FROM nutrition_plans
                     WHERE client_id = $1 AND activated_at IS NOT NULL
                 ) x`,
                [req.params.id]
            ),
        ]);

        if (!clientResult.rows.length) return res.status(404).json({ error: 'Client not found' });

        res.json({
            ...mapClient(clientResult.rows[0]),
            firstPlanActivatedAt: (planActivationResult.rows[0] as Record<string, unknown>)?.first_activation ?? null,
        });
    } catch (err) {
        next(err);
    }
});

// PUT /api/clients/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
    const { fname, lname, email, phone, phones, currentPackage } = req.body as Record<string, unknown>;
    try {
        const phonesArray = Array.isArray(phones) ? (phones as Record<string, string>[]) : undefined;
        const firstPhone  = phonesArray?.[0];
        const phoneText   = firstPhone
            ? `${firstPhone.countryCode || ''} ${firstPhone.number || ''}`.trim()
            : phone as string | undefined;

        const result = await pool.query(
            `UPDATE clients
             SET fname = $1, lname = $2, email = $3, phone = $4,
                 phones = COALESCE($5, phones),
                 current_package = COALESCE($6, current_package)
             WHERE id = $7 AND workspace_id = $8 RETURNING *`,
            [
                fname, lname, email, phoneText,
                phonesArray ? JSON.stringify(phonesArray) : null,
                currentPackage || null,
                req.params.id, req.user!.workspaceId,
            ]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Client not found' });
        res.json(mapClient(result.rows[0]));
    } catch (err) {
        next(err);
    }
});

// DELETE /api/clients/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await pool.query(
            'DELETE FROM clients WHERE id = $1 AND workspace_id = $2 RETURNING *',
            [req.params.id, req.user!.workspaceId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Client not found' });
        res.json(result.rows[0]);
    } catch (err) {
        next(err);
    }
});

// GET /api/clients/:id/freezes
router.get('/:id/freezes', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await pool.query(
            `SELECT sf.* FROM subscription_freezes sf
             JOIN clients c ON c.id = sf.client_id
             WHERE sf.client_id = $1 AND c.workspace_id = $2
             ORDER BY sf.freeze_start_date ASC`,
            [req.params.id, req.user!.workspaceId]
        );
        res.json(result.rows.map(mapFreeze));
    } catch (err) {
        next(err);
    }
});

// POST /api/clients/:id/freezes
router.post('/:id/freezes', async (req: Request, res: Response, next: NextFunction) => {
    const { freezeStartDate, freezeDurationDays, notes } = req.body as Record<string, unknown>;
    if (!freezeStartDate) return res.status(400).json({ error: 'freezeStartDate is required' });
    const days = Number(freezeDurationDays);
    if (!days || days <= 0) return res.status(400).json({ error: 'freezeDurationDays must be a positive number' });

    try {
        const client = await pool.query(
            'SELECT id FROM clients WHERE id = $1 AND workspace_id = $2',
            [req.params.id, req.user!.workspaceId]
        );
        if (!client.rows.length) return res.status(404).json({ error: 'Client not found' });

        const result = await pool.query(
            `INSERT INTO subscription_freezes (id, client_id, freeze_start_date, freeze_duration_days, notes)
             VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [createId(), req.params.id, new Date(freezeStartDate as string), days, (notes as string | undefined)?.trim() || null]
        );
        res.status(201).json(mapFreeze(result.rows[0]));
    } catch (err) {
        next(err);
    }
});

// DELETE /api/clients/:id/freezes/:freezeId
router.delete('/:id/freezes/:freezeId', async (req: Request, res: Response, next: NextFunction) => {
    try {
        const result = await pool.query(
            `DELETE FROM subscription_freezes
             WHERE id = $1 AND client_id = $2
               AND (SELECT workspace_id FROM clients WHERE id = $2) = $3
             RETURNING id`,
            [req.params.freezeId, req.params.id, req.user!.workspaceId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Freeze not found' });
        res.json({ deleted: (result.rows[0] as Record<string, unknown>).id });
    } catch (err) {
        next(err);
    }
});

// POST /api/clients/:id/set-password
router.post('/:id/set-password', async (req: Request, res: Response, next: NextFunction) => {
    const { password } = req.body as { password?: string };
    if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    try {
        const hashed = await bcrypt.hash(password, 10);
        const result = await pool.query(
            'UPDATE clients SET password = $1 WHERE id = $2 AND workspace_id = $3 RETURNING id',
            [hashed, req.params.id, req.user!.workspaceId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Client not found' });
        res.json({ message: 'Password set successfully' });
    } catch (err) {
        next(err);
    }
});

export default router;
