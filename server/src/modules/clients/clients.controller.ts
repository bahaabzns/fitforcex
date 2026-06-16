import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { computeSubscriptionStatus } from '../../utils/subscriptionStatus';
import { checkClientLimit } from '../../lib/seatLimits';
import { prisma } from '../../lib/prisma';

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

type PlanActRow = { client_id: string; first_activation: Date | null };

export async function getClients(req: Request, res: Response, next: NextFunction) {
    const page   = Math.max(1, parseInt(req.query.page as string)  || 1);
    const limit  = Math.min(10000, Math.max(1, parseInt(req.query.limit as string) || 20));
    const offset = (page - 1) * limit;
    const search = (req.query.search as string | undefined)?.trim() || '';
    const wsId   = req.user!.workspaceId;

    try {
        const whereClause: Prisma.clientsWhereInput = { workspace_id: wsId };
        if (search) {
            whereClause.OR = [
                { fname: { contains: search, mode: 'insensitive' } },
                { lname: { contains: search, mode: 'insensitive' } },
                { email: { contains: search, mode: 'insensitive' } },
            ];
        }

        const [clientRows, total] = await Promise.all([
            prisma.clients.findMany({
                where:   whereClause,
                orderBy: { created_at: 'desc' },
                take:    limit,
                skip:    offset,
            }),
            prisma.clients.count({ where: whereClause }),
        ]);

        const clientIds = clientRows.map(r => r.id);
        if (clientIds.length === 0) {
            return res.json({ data: [], total: 0, page, limit, totalPages: 0 });
        }

        const [txRows, freezeRows, planActRows] = await Promise.all([
            prisma.transactions.findMany({
                where:  { workspace_id: wsId, client_id: { in: clientIds } },
                select: { client_id: true, status: true, duration: true, subscription_start_date: true, start_mode: true, created_at: true },
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

        type TxLike = { status: string; created_at: string | Date; duration?: number | string | null; start_mode?: string | null; subscription_start_date?: string | Date | null };
        const txByClient: Record<string, TxLike[]> = {};
        for (const tx of txRows) {
            if (!tx.client_id) continue;
            if (!txByClient[tx.client_id]) txByClient[tx.client_id] = [];
            txByClient[tx.client_id].push(tx as TxLike);
        }

        type FreezeLike = { freeze_start_date: string | Date; freeze_duration_days: number | string; client_id?: string };
        const freezesByClient: Record<string, FreezeLike[]> = {};
        for (const f of freezeRows as FreezeLike[]) {
            const key = (f as FreezeRow).client_id as string;
            if (!freezesByClient[key]) freezesByClient[key] = [];
            freezesByClient[key].push(f);
        }

        const planActivationByClient: Record<string, string | null> = {};
        for (const row of planActRows) {
            planActivationByClient[row.client_id] = row.first_activation ? new Date(row.first_activation).toISOString() : null;
        }

        res.json({
            data: clientRows.map(row => ({
                ...mapClient(row as unknown as ClientRow),
                subscription_status: computeSubscriptionStatus(
                    txByClient[row.id] || [],
                    freezesByClient[row.id] || [],
                    planActivationByClient[row.id] ?? null
                ),
            })),
            total, page, limit, totalPages: Math.ceil(total / limit),
        });
    } catch (err) {
        next(err);
    }
}

export async function createClient(req: Request, res: Response, next: NextFunction) {
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

        while (nextCode === null && retries < 10) {
            const randomCode = Math.floor(Math.random() * 9999) + 1;
            const existing   = await prisma.clients.findFirst({
                where: { workspace_id: req.user!.workspaceId, client_code: randomCode },
                select: { id: true },
            });
            if (!existing) nextCode = randomCode;
            retries++;
        }

        if (nextCode === null) {
            return res.status(500).json({ error: 'Failed to generate unique client code' });
        }

        const hashedPassword = password ? await bcrypt.hash(password as string, 10) : null;

        const phonesArray = Array.isArray(phones) && (phones as unknown[]).length > 0
            ? phones as Record<string, string>[]
            : (phone ? [{ countryCode: '', number: phone }] : []);
        const firstPhone = phonesArray[0] as { countryCode?: string; number?: string } | undefined;
        const phoneText  = firstPhone
            ? `${firstPhone.countryCode || ''} ${firstPhone.number || ''}`.trim()
            : null;

        // Reject duplicates within the workspace before inserting (email also has a DB unique
        // constraint as a backstop; primary phone is enforced here only).
        const emailValue = (email as string | undefined)?.trim();
        if (emailValue) {
            const dupeEmail = await prisma.clients.findFirst({
                where: { workspace_id: req.user!.workspaceId, email: { equals: emailValue, mode: 'insensitive' } },
                select: { id: true },
            });
            if (dupeEmail) return res.status(409).json({ error: 'duplicate_email' });
        }
        if (phoneText) {
            const dupePhone = await prisma.clients.findFirst({
                where: { workspace_id: req.user!.workspaceId, phone: phoneText },
                select: { id: true },
            });
            if (dupePhone) return res.status(409).json({ error: 'duplicate_phone' });
        }

        const client = await prisma.clients.create({
            data: {
                id:                  createId(),
                client_code:         nextCode,
                fname:               firstName || '',
                lname:               lastName || '',
                email:               (email as string | undefined) || '',
                phone:               phoneText,
                phones:              phonesArray as unknown as Prisma.InputJsonValue,
                current_package:     (currentPackage as string | undefined) || null,
                subscription_status: 'Pre-start',
                workspace_id:        req.user!.workspaceId,
                password:            hashedPassword,
            },
        });
        res.status(201).json(mapClient(client as unknown as ClientRow));
    } catch (err) {
        next(err);
    }
}

export async function checkClientLimitHandler(req: Request, res: Response, next: NextFunction) {
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
}

export async function getClient(req: Request, res: Response, next: NextFunction) {
    try {
        const [client, planActRows] = await Promise.all([
            prisma.clients.findFirst({
                where: { id: req.params.id as string, workspace_id: req.user!.workspaceId },
            }),
            prisma.$queryRaw<PlanActRow[]>`
                SELECT MIN(activated_at) AS first_activation FROM (
                    SELECT activated_at FROM training_plans WHERE client_id = ${req.params.id} AND activated_at IS NOT NULL
                    UNION ALL
                    SELECT activated_at FROM nutrition_plans WHERE client_id = ${req.params.id} AND activated_at IS NOT NULL
                ) x
            `,
        ]);

        if (!client) return res.status(404).json({ error: 'Client not found' });

        res.json({
            ...mapClient(client as unknown as ClientRow),
            firstPlanActivatedAt: planActRows[0]?.first_activation ?? null,
        });
    } catch (err) {
        next(err);
    }
}

export async function updateClient(req: Request, res: Response, next: NextFunction) {
    const { fname, lname, email, phone, phones, currentPackage } = req.body as Record<string, unknown>;
    try {
        const phonesArray = Array.isArray(phones) ? (phones as Record<string, string>[]) : undefined;
        const firstPhone  = phonesArray?.[0];
        const phoneText   = firstPhone
            ? `${firstPhone.countryCode || ''} ${firstPhone.number || ''}`.trim()
            : phone as string | undefined;

        const updated = await prisma.clients.updateMany({
            where: { id: req.params.id as string, workspace_id: req.user!.workspaceId },
            data: {
                fname:           (fname as string | undefined) ?? undefined,
                lname:           (lname as string | undefined) ?? undefined,
                email:           (email as string | undefined) ?? undefined,
                phone:           phoneText ?? undefined,
                phones:          phonesArray ? phonesArray as unknown as Prisma.InputJsonValue : undefined,
                current_package: (currentPackage as string | undefined) || undefined,
            },
        });
        if (updated.count === 0) return res.status(404).json({ error: 'Client not found' });

        const client = await prisma.clients.findFirst({
            where: { id: req.params.id as string, workspace_id: req.user!.workspaceId },
        });
        res.json(mapClient(client as unknown as ClientRow));
    } catch (err) {
        next(err);
    }
}

export async function deleteClient(req: Request, res: Response, next: NextFunction) {
    try {
        const deleted = await prisma.clients.deleteMany({
            where: { id: req.params.id as string, workspace_id: req.user!.workspaceId },
        });
        if (deleted.count === 0) return res.status(404).json({ error: 'Client not found' });
        res.json({ deleted: req.params.id });
    } catch (err) {
        next(err);
    }
}

export async function getFreezes(req: Request, res: Response, next: NextFunction) {
    try {
        const clientCheck = await prisma.clients.findFirst({
            where: { id: req.params.id as string, workspace_id: req.user!.workspaceId },
            select: { id: true },
        });
        if (!clientCheck) return res.status(404).json({ error: 'Client not found' });

        const freezes = await prisma.subscription_freezes.findMany({
            where:   { client_id: req.params.id as string },
            orderBy: { freeze_start_date: 'asc' },
        });
        res.json(freezes.map(f => mapFreeze(f as unknown as FreezeRow)));
    } catch (err) {
        next(err);
    }
}

export async function createFreeze(req: Request, res: Response, next: NextFunction) {
    const { freezeStartDate, freezeDurationDays, notes } = req.body as Record<string, unknown>;
    if (!freezeStartDate) return res.status(400).json({ error: 'freezeStartDate is required' });
    const days = Number(freezeDurationDays);
    if (!days || days <= 0) return res.status(400).json({ error: 'freezeDurationDays must be a positive number' });

    try {
        const clientCheck = await prisma.clients.findFirst({
            where: { id: req.params.id as string, workspace_id: req.user!.workspaceId },
            select: { id: true },
        });
        if (!clientCheck) return res.status(404).json({ error: 'Client not found' });

        const freeze = await prisma.subscription_freezes.create({
            data: {
                id:                   createId(),
                client_id:            req.params.id as string,
                freeze_start_date:    new Date(freezeStartDate as string),
                freeze_duration_days: days,
                notes:                (notes as string | undefined)?.trim() || null,
            },
        });
        res.status(201).json(mapFreeze(freeze as unknown as FreezeRow));
    } catch (err) {
        next(err);
    }
}

export async function deleteFreeze(req: Request, res: Response, next: NextFunction) {
    try {
        const clientCheck = await prisma.clients.findFirst({
            where: { id: req.params.id as string, workspace_id: req.user!.workspaceId },
            select: { id: true },
        });
        if (!clientCheck) return res.status(404).json({ error: 'Client not found' });

        const deleted = await prisma.subscription_freezes.deleteMany({
            where: { id: req.params.freezeId as string, client_id: req.params.id as string },
        });
        if (deleted.count === 0) return res.status(404).json({ error: 'Freeze not found' });
        res.json({ deleted: req.params.freezeId });
    } catch (err) {
        next(err);
    }
}

export async function setPassword(req: Request, res: Response, next: NextFunction) {
    const { password } = req.body as { password?: string };
    if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }
    try {
        const hashed  = await bcrypt.hash(password, 10);
        const updated = await prisma.clients.updateMany({
            where: { id: req.params.id as string, workspace_id: req.user!.workspaceId },
            data:  { password: hashed },
        });
        if (updated.count === 0) return res.status(404).json({ error: 'Client not found' });
        res.json({ message: 'Password set successfully' });
    } catch (err) {
        next(err);
    }
}
