import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { computeSubscriptionStatus } from '../../utils/subscriptionStatus';
import { checkClientLimit } from '../../lib/seatLimits';
import { logSubscriptionAudit } from '../subscriptionPolicies/subscriptionPolicies.service';
import { recordEvent, teamRecipients } from '../../lib/events';
import { prisma } from '../../lib/prisma';
import {
    summarizeLog,
    buildExerciseProgress,
    distinctLoggedExercises,
    type LoggedExercise,
    type WorkoutLogRow,
} from '../../utils/workoutLogStats';

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
        // Archive lifecycle — null on active clients. `is_archived` is the single
        // source of truth the UI branches on (Archived chip, restore/danger zone).
        is_archived:         !!row.archived_at,
        archived_at:         row.archived_at ?? null,
        archived_by:         row.archived_by ?? null,
        restored_at:         row.restored_at ?? null,
        restored_by:         row.restored_by ?? null,
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
        // Active and archived clients live in one list; archived rows are
        // surfaced via the "Archived" status filter and dimmed in the UI.
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
                // Archived is a lifecycle state that sits above the computed
                // subscription status — surface it instead of Active/Frozen/etc.
                subscription_status: row.archived_at
                    ? 'Archived'
                    : computeSubscriptionStatus(
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
        // Notify the rest of the team (not the creator) that a client was added.
        await recordEvent({
            workspaceId: req.user!.workspaceId,
            type:        'client.created',
            title:       'A new client was added',
            recipients:  await teamRecipients(req.user!.workspaceId, req.user!.userId),
            actor:       { type: 'user', id: req.user!.userId },
            entity:      { type: 'client', id: client.id },
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

        const mapped = mapClient(client as unknown as ClientRow);
        res.json({
            ...mapped,
            subscription_status: mapped.is_archived ? 'Archived' : mapped.subscription_status,
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

/**
 * Default "delete" behaviour: archive the client (never destroys data). Removes
 * them from active lists, blocks portal login (see clientPortal login + access
 * policy), and freezes new check-ins/submissions while preserving every
 * historical record. Reversible via restoreClient.
 */
export async function archiveClient(req: Request, res: Response, next: NextFunction) {
    const clientId = req.params.id as string;
    const wsId     = req.user!.workspaceId;
    try {
        const client = await prisma.clients.findFirst({
            where:  { id: clientId, workspace_id: wsId },
            select: { id: true, archived_at: true },
        });
        if (!client) return res.status(404).json({ error: 'Client not found' });
        if (client.archived_at) return res.status(409).json({ error: 'Client is already archived' });

        const updated = await prisma.clients.update({
            where: { id: clientId },
            data:  { archived_at: new Date(), archived_by: req.user!.userId },
        });

        await logSubscriptionAudit({
            workspaceId: wsId,
            clientId,
            actorType:   'coach',
            actorUserId: req.user!.userId,
            eventType:   'client.archive',
            toStatus:    'Archived',
        });

        res.json(mapClient(updated as unknown as ClientRow));
    } catch (err) {
        next(err);
    }
}

/** Restores an archived client back to active operations. Clears the archive marker. */
export async function restoreClient(req: Request, res: Response, next: NextFunction) {
    const clientId = req.params.id as string;
    const wsId     = req.user!.workspaceId;
    try {
        const client = await prisma.clients.findFirst({
            where:  { id: clientId, workspace_id: wsId },
            select: { id: true, archived_at: true },
        });
        if (!client) return res.status(404).json({ error: 'Client not found' });
        if (!client.archived_at) return res.status(409).json({ error: 'Client is not archived' });

        const updated = await prisma.clients.update({
            where: { id: clientId },
            data:  { archived_at: null, archived_by: null, restored_at: new Date(), restored_by: req.user!.userId },
        });

        await logSubscriptionAudit({
            workspaceId: wsId,
            clientId,
            actorType:   'coach',
            actorUserId: req.user!.userId,
            eventType:   'client.restore',
            fromStatus:  'Archived',
            toStatus:    'Active',
        });

        res.json(mapClient(updated as unknown as ClientRow));
    } catch (err) {
        next(err);
    }
}

/** Scrub a client's personal info in place, preserving every related row for analytics. */
async function anonymizeClient(clientId: string): Promise<void> {
    await prisma.clients.update({
        where: { id: clientId },
        data: {
            fname:    'Deleted',
            lname:    'Client',
            // Keep the workspace+email unique constraint satisfied with a per-row token.
            email:    `deleted+${clientId}@anonymized.invalid`,
            phone:    null,
            phones:   [] as unknown as Prisma.InputJsonValue,
            password: null,
        },
    });
}

/**
 * Permanently remove a client. FK-safe: transactions (no cascade) are detached to
 * preserve revenue rows; training_plans and threads (no FK to clients) are deleted
 * explicitly; the rest cascade from the client row.
 */
async function hardDeleteClient(clientId: string, wsId: string): Promise<void> {
    await prisma.$transaction([
        prisma.transactions.updateMany({ where: { client_id: clientId, workspace_id: wsId }, data: { client_id: null } }),
        prisma.training_plans.deleteMany({ where: { client_id: clientId, workspace_id: wsId } }),
        prisma.threads.deleteMany({ where: { client_id: clientId, workspace_id: wsId } }),
        prisma.clients.delete({ where: { id: clientId } }),
    ]);
}

/**
 * Danger zone (owner-only, archived clients only). Honours the workspace
 * client_deletion_strategy: 'anonymize' (default) scrubs PII while keeping
 * analytics; 'hard' destroys the client and its personal data. The caller must
 * echo the client's exact name in `confirmName`.
 */
export async function permanentDeleteClient(req: Request, res: Response, next: NextFunction) {
    const clientId    = req.params.id as string;
    const wsId        = req.user!.workspaceId;
    const body        = req.body as { confirmName?: string; strategy?: string };
    const confirmName = body.confirmName?.trim();
    // Strategy is chosen per-deletion in the danger-zone modal; default to the
    // safer anonymize when unspecified.
    const strategy    = body.strategy === 'hard' ? 'hard' : 'anonymize';

    try {
        const client = await prisma.clients.findFirst({
            where:  { id: clientId, workspace_id: wsId },
            select: { id: true, fname: true, lname: true, archived_at: true },
        });
        if (!client) return res.status(404).json({ error: 'Client not found' });
        if (!client.archived_at) {
            return res.status(409).json({ error: 'Only archived clients can be permanently deleted' });
        }

        const expectedName = `${client.fname} ${client.lname}`.trim();
        if (!confirmName || confirmName !== expectedName) {
            return res.status(400).json({ error: 'name_mismatch' });
        }

        if (strategy === 'hard') {
            await hardDeleteClient(clientId, wsId);
        } else {
            await anonymizeClient(clientId);
            await prisma.clients.update({
                where: { id: clientId },
                data:  { deleted_at: new Date(), deleted_by: req.user!.userId },
            });
        }

        await logSubscriptionAudit({
            workspaceId: wsId,
            // For a hard delete the client row is gone; keep the id in metadata only.
            clientId:    strategy === 'hard' ? null : clientId,
            actorType:   'coach',
            actorUserId: req.user!.userId,
            eventType:   'client.delete',
            fromStatus:  'Archived',
            metadata:    { strategy, clientId, clientName: expectedName },
        });

        res.json({ deleted: clientId, strategy });
    } catch (err) {
        next(err);
    }
}

/** Activity timeline for one client: archive/restore/delete + system status changes. */
export async function getClientAudit(req: Request, res: Response, next: NextFunction) {
    const clientId = req.params.id as string;
    const wsId     = req.user!.workspaceId;
    try {
        const rows = await prisma.subscription_status_audit.findMany({
            where:   { workspace_id: wsId, client_id: clientId },
            orderBy: { created_at: 'desc' },
            take:    100,
        });
        res.json(rows.map(r => ({
            id:          r.id,
            actorType:   r.actor_type,
            actorUserId: r.actor_user_id,
            eventType:   r.event_type,
            fromStatus:  r.from_status,
            toStatus:    r.to_status,
            metadata:    r.metadata,
            createdAt:   r.created_at,
        })));
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

// ─── workout logs (coach read-only view) ────────────────────────────────────────

const WORKOUT_HISTORY_LIMIT  = 100;
const WORKOUT_PROGRESS_LIMIT = 200;

function parseLoggedExercises(value: unknown): LoggedExercise[] {
    return Array.isArray(value) ? (value as LoggedExercise[]) : [];
}

function toLogRow(row: { id: string; date: Date; start_time: string | null; end_time: string | null; exercises: unknown }): WorkoutLogRow {
    return {
        id:         row.id,
        date:       row.date,
        start_time: row.start_time,
        end_time:   row.end_time,
        exercises:  parseLoggedExercises(row.exercises),
    };
}

/** Confirm the client belongs to the caller's workspace; 404 otherwise. */
async function assertClientInWorkspace(clientId: string, workspaceId: string): Promise<boolean> {
    const client = await prisma.clients.findFirst({
        where:  { id: clientId, workspace_id: workspaceId },
        select: { id: true },
    });
    return !!client;
}

export async function getClientWorkoutLogs(req: Request, res: Response, next: NextFunction) {
    try {
        if (!(await assertClientInWorkspace(req.params.id as string, req.user!.workspaceId))) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const logs = await prisma.workout_logs.findMany({
            where:   { client_id: req.params.id as string, workspace_id: req.user!.workspaceId },
            orderBy: [{ date: 'desc' }, { created_at: 'desc' }],
            take:    WORKOUT_HISTORY_LIMIT,
            include: { training_days: { select: { name: true } } },
        });

        res.json(logs.map(log => ({
            id:       log.id,
            date:     log.date,
            day_id:   log.day_id,
            day_name: log.training_days?.name ?? null,
            notes:    log.notes,
            ...summarizeLog(toLogRow(log)),
        })));
    } catch (err) {
        next(err);
    }
}

export async function getClientExerciseProgress(req: Request, res: Response, next: NextFunction) {
    const exerciseLibraryId = req.query.exercise_library_id as string | undefined;
    const exerciseId        = req.query.exercise_id as string | undefined;
    if (!exerciseLibraryId && !exerciseId) {
        return res.status(400).json({ error: 'exercise_library_id or exercise_id is required' });
    }

    try {
        if (!(await assertClientInWorkspace(req.params.id as string, req.user!.workspaceId))) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const logs = await prisma.workout_logs.findMany({
            where:   { client_id: req.params.id as string, workspace_id: req.user!.workspaceId },
            orderBy: { date: 'asc' },
            take:    WORKOUT_PROGRESS_LIMIT,
            select:  { id: true, date: true, start_time: true, end_time: true, exercises: true },
        });

        res.json(buildExerciseProgress(
            logs.map(toLogRow),
            { exercise_library_id: exerciseLibraryId ?? null, exercise_id: exerciseId ?? null },
        ));
    } catch (err) {
        next(err);
    }
}

export async function getClientLoggedExercises(req: Request, res: Response, next: NextFunction) {
    try {
        if (!(await assertClientInWorkspace(req.params.id as string, req.user!.workspaceId))) {
            return res.status(404).json({ error: 'Client not found' });
        }

        const logs = await prisma.workout_logs.findMany({
            where:   { client_id: req.params.id as string, workspace_id: req.user!.workspaceId },
            orderBy: { date: 'desc' },
            take:    WORKOUT_PROGRESS_LIMIT,
            select:  { id: true, date: true, start_time: true, end_time: true, exercises: true },
        });
        res.json(distinctLoggedExercises(logs.map(toLogRow)));
    } catch (err) {
        next(err);
    }
}

export async function getClientWorkoutLog(req: Request, res: Response, next: NextFunction) {
    try {
        const log = await prisma.workout_logs.findFirst({
            where:   { id: req.params.logId as string, client_id: req.params.id as string, workspace_id: req.user!.workspaceId },
            include: { training_days: { select: { name: true } } },
        });
        if (!log) return res.status(404).json({ error: 'Workout log not found' });

        res.json({
            id:         log.id,
            date:       log.date,
            day_id:     log.day_id,
            day_name:   log.training_days?.name ?? null,
            start_time: log.start_time,
            end_time:   log.end_time,
            notes:      log.notes,
            exercises:  parseLoggedExercises(log.exercises),
            ...summarizeLog(toLogRow(log)),
        });
    } catch (err) {
        next(err);
    }
}
