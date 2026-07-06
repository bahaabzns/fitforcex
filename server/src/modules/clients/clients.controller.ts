import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import { computeSubscriptionStatus } from '../../utils/subscriptionStatus';
import { checkClientLimit } from '../../lib/seatLimits';
import { logSubscriptionAudit } from '../subscriptionPolicies/subscriptionPolicies.service';
import { recordEvent, teamRecipients } from '../../lib/events';
import { prisma } from '../../lib/prisma';
import { toPublicUrl, deleteFile } from '../../lib/storage';
import {
    summarizeLog,
    buildExerciseProgress,
    distinctLoggedExercises,
    computePersonalRecords,
    computeCoachInsights,
    extractRecentSessions,
    type LoggedExercise,
    type WorkoutLogRow,
    type ExerciseKey,
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
        const aggregate = await prisma.clients.aggregate({
            where:   { workspace_id: req.user!.workspaceId },
            _max:    { client_code: true },
        });
        const nextCode = (aggregate._max.client_code ?? 0) + 1;

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

// Package Lifecycle Phase 3b — resolved defaults the Configure Activation
// modal pre-fills from: the client's current package variation's cycle
// lengths, plan-update mode, and check-in-kind default forms. Read only at
// the moment the modal opens; never a live/enforced constraint (§12.8).
export async function getClientPackageDefaults(req: Request, res: Response, next: NextFunction) {
    try {
        const client = await prisma.clients.findFirst({
            where:  { id: req.params.id as string, workspace_id: req.user!.workspaceId },
            select: { current_package_variation_id: true },
        });
        if (!client) return res.status(404).json({ error: 'Client not found' });

        if (!client.current_package_variation_id) {
            return res.json({ nutritionCycleDays: null, trainingCycleDays: null, planUpdateMode: 'extend', checkInForms: [] });
        }

        const variation = await prisma.package_variations.findUnique({
            where:   { id: client.current_package_variation_id },
            include: { package_default_forms: { where: { kind: 'checkin' }, include: { forms: { select: { title_en: true, title_ar: true } } } } },
        });
        if (!variation) {
            return res.json({ nutritionCycleDays: null, trainingCycleDays: null, planUpdateMode: 'extend', checkInForms: [] });
        }

        res.json({
            nutritionCycleDays: variation.nutrition_cycle_days ?? null,
            trainingCycleDays:  variation.training_cycle_days ?? null,
            planUpdateMode:     variation.plan_update_mode || 'extend',
            checkInForms: variation.package_default_forms.map(f => ({
                formId:       f.form_id,
                intervalDays: f.interval_days,
                titleEn:      f.forms.title_en,
                titleAr:      f.forms.title_ar,
            })),
        });
    } catch (err) { next(err); }
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

export async function getClientExerciseInsights(req: Request, res: Response, next: NextFunction) {
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
            orderBy: { date: 'desc' },
            take:    WORKOUT_PROGRESS_LIMIT,
            select:  { id: true, date: true, start_time: true, end_time: true, exercises: true },
        });

        const logRows       = logs.map(toLogRow);
        const key: ExerciseKey = { exercise_library_id: exerciseLibraryId ?? null, exercise_id: exerciseId ?? null };
        const progressPoints = buildExerciseProgress(logRows, key);

        res.json({
            progressPoints,
            recentSessions:  extractRecentSessions(logRows, key, 10),
            personalRecords: computePersonalRecords(logRows, key, progressPoints),
            insights:        computeCoachInsights(progressPoints),
            timeline: {
                first_session_date: progressPoints.length > 0 ? progressPoints[0].date : null,
                total_sessions:     progressPoints.length,
            },
        });
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

// Shared by getClientTransformation (coach) and re-exported for the portal controller.
// Uses flat queries + in-memory joins to stay compatible with this Prisma client version.
export async function buildTransformationPayload(clientId: string, workspaceId: string) {
    // 1. Submitted form requests for this client
    const requests = await prisma.form_requests.findMany({
        where:  { client_id: clientId, workspace_id: workspaceId, status: 'submitted' },
        select: { id: true, submitted_at: true, form_id: true },
    });
    if (requests.length === 0) return { metrics: [], timeline: [] };

    const requestIds = requests.map(r => r.id);
    const requestMap = new Map(requests.map(r => [r.id, r]));

    // 2. Metric-linked responses for those requests
    const responses = await prisma.form_responses.findMany({
        where:  { request_id: { in: requestIds }, metric_id: { not: null } },
        select: { id: true, request_id: true, question_id: true, answer: true, metric_id: true },
    });
    if (responses.length === 0) return { metrics: [], timeline: [] };

    // 3. Form titles
    const formIds = [...new Set(requests.map(r => r.form_id).filter((id): id is string => !!id))];
    const forms   = await (prisma as any).forms.findMany({
        where:  { id: { in: formIds } },
        select: { id: true, title_en: true, title_ar: true },
    }) as { id: string; title_en: string | null; title_ar: string | null }[];
    const formMap = new Map(forms.map(f => [f.id, f]));

    // 4. Question labels
    const questionIds = [...new Set(responses.map(r => r.question_id).filter((id): id is string => !!id))];
    const questions   = await prisma.form_questions.findMany({
        where:  { id: { in: questionIds } },
        select: { id: true, label_en: true, label_ar: true },
    });
    const questionMap = new Map(questions.map(q => [q.id, q]));

    // 5. Metric metadata
    const metricIds  = [...new Set(responses.map(r => r.metric_id).filter((id): id is string => !!id))];
    const metricsData = await prisma.metrics.findMany({
        where:  { id: { in: metricIds } },
        select: { id: true, name: true, unit: true, type: true, icon: true },
    });
    const metricMap = new Map(metricsData.map(m => [m.id, m]));

    // Sort ascending by submission date for history arrays
    const sorted = [...responses].sort((a, b) => {
        const da = requestMap.get(a.request_id ?? '')?.submitted_at?.getTime() ?? 0;
        const db = requestMap.get(b.request_id ?? '')?.submitted_at?.getTime() ?? 0;
        return da - db;
    });

    // Per-metric history
    const historyByMetricId = new Map<string, { date: string; value: string; responseId: string }[]>();
    for (const r of sorted) {
        if (!r.metric_id || !r.answer) continue;
        const submittedAt = requestMap.get(r.request_id ?? '')?.submitted_at;
        if (!submittedAt) continue;
        const arr = historyByMetricId.get(r.metric_id) ?? [];
        arr.push({ date: submittedAt.toISOString(), value: r.answer, responseId: r.id });
        historyByMetricId.set(r.metric_id, arr);
    }

    // Timeline — newest first
    const timelineMap = new Map<string, {
        submissionId: string; submittedAt: string;
        formTitle: string; formTitleAr: string | null;
        answers: { responseId: string; label: string; labelAr: string | null; answer: string; metricId: string | null; metricName: string | null; metricType: string | null }[];
    }>();
    for (const r of [...sorted].reverse()) {
        if (!r.request_id) continue;
        const fr = requestMap.get(r.request_id);
        if (!fr?.submitted_at) continue;
        if (!timelineMap.has(r.request_id)) {
            const form = fr.form_id ? formMap.get(fr.form_id) : null;
            timelineMap.set(r.request_id, {
                submissionId: r.request_id,
                submittedAt:  fr.submitted_at.toISOString(),
                formTitle:    form?.title_en ?? 'Form',
                formTitleAr:  form?.title_ar ?? null,
                answers:      [],
            });
        }
        const question = r.question_id ? questionMap.get(r.question_id) : null;
        const metric   = r.metric_id   ? metricMap.get(r.metric_id)     : null;
        timelineMap.get(r.request_id)!.answers.push({
            responseId: r.id,
            label:      question?.label_en ?? '',
            labelAr:    question?.label_ar ?? null,
            answer:     r.answer ?? '',
            metricId:   r.metric_id,
            metricName: metric?.name ?? null,
            metricType: metric?.type ?? null,
        });
    }

    return {
        metrics:  metricsData.map(m => ({ ...m, history: historyByMetricId.get(m.id) ?? [] }))
                             .filter(m => m.history.length > 0),
        timeline: Array.from(timelineMap.values()),
    };
}

export async function getClientTransformation(req: Request, res: Response, next: NextFunction) {
    try {
        const clientId    = req.params.id as string;
        const workspaceId = req.user!.workspaceId;

        const client = await prisma.clients.findFirst({
            where:  { id: clientId, workspace_id: workspaceId },
            select: { id: true },
        });
        if (!client) { res.status(404).json({ error: 'Client not found' }); return; }

        const result = await buildTransformationPayload(clientId, workspaceId);
        res.json(result);
    } catch (err) {
        next(err);
    }
}

// ── Observations ─────────────────────────────────────────────────────────────
// Durable coaching insights about a client — see docs on the Observations module
// for the product rationale. Title is the one-line insight; everything else is
// optional and defaulted so a coach can save one in a few seconds.

const OBSERVATION_CATEGORIES = ['General', 'Technique', 'Adherence', 'Nutrition', 'Injury/Pain', 'Mindset'];
const OBSERVATION_SEVERITIES = ['Low', 'Medium', 'High'];

const OBSERVATION_RELATION_INCLUDE = {
    exercise_library: { select: { id: true, name_en: true } },
    food_items:       { select: { id: true, name_en: true } },
    form_requests:    { select: { id: true, forms: { select: { form_type: true, title_en: true } } } },
} as const;

const OBSERVATION_INCLUDE = {
    users:                 { select: { id: true, fname: true, lname: true } },
    observation_relations: { include: OBSERVATION_RELATION_INCLUDE },
} as const;

type ObservationRow = Prisma.client_observationsGetPayload<{ include: typeof OBSERVATION_INCLUDE }>;
type ObservationRelationRow = Prisma.observation_relationsGetPayload<{ include: typeof OBSERVATION_RELATION_INCLUDE }>;

function mapRelatedItem(rel: ObservationRelationRow): { type: string; id: string; label: string } | null {
    if (rel.exercise_library) {
        return { type: 'exercise', id: rel.exercise_library.id, label: rel.exercise_library.name_en };
    }
    if (rel.food_items) {
        return { type: 'foodItem', id: rel.food_items.id, label: rel.food_items.name_en };
    }
    if (rel.form_requests) {
        const isAssessment = rel.form_requests.forms?.form_type === 'assessment';
        return {
            type:  isAssessment ? 'assessment' : 'checkIn',
            id:    rel.form_requests.id,
            label: rel.form_requests.forms?.title_en || (isAssessment ? 'Assessment' : 'Check-in'),
        };
    }
    return null;
}

function mapObservation(row: ObservationRow) {
    const relatedItems = row.observation_relations
        .map(mapRelatedItem)
        .filter((item): item is { type: string; id: string; label: string } => item !== null);

    return {
        id:            row.id,
        clientId:      row.client_id,
        title:         row.title,
        content:       row.content,
        category:      row.category,
        severity:      row.severity,
        attachmentUrl: toPublicUrl(row.attachment_url),
        author:        row.users ? { id: row.users.id, name: `${row.users.fname} ${row.users.lname}` } : null,
        relatedItems,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}

type RelatedItemInput = { type?: string; id?: string };
type RelatedRelationRow = { exercise_library_id: string | null; food_item_id: string | null; form_request_id: string | null };

/** Validates an array of {type, id} related-item links and resolves each to the FK column it sets. */
async function resolveRelatedItemsInput(
    workspaceId: string,
    clientId: string,
    items: RelatedItemInput[],
): Promise<{ error?: string; data?: RelatedRelationRow[] }> {
    if (items.length === 0) return { data: [] };

    // Dedupe exact (type, id) repeats — the picker already prevents this client-side,
    // but the API must not trust that.
    const seen = new Set<string>();
    const deduped = items.filter((item) => {
        const key = `${item.type}:${item.id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });

    const rows: RelatedRelationRow[] = [];

    for (const item of deduped) {
        if (!item.type || !item.id) return { error: 'Each related item needs a type and id' };

        if (item.type === 'exercise') {
            const exists = await prisma.exercise_library.findFirst({
                where:  { id: item.id, workspace_id: workspaceId },
                select: { id: true },
            });
            if (!exists) return { error: 'Related exercise not found in this workspace' };
            rows.push({ exercise_library_id: item.id, food_item_id: null, form_request_id: null });
        } else if (item.type === 'foodItem') {
            const exists = await prisma.food_items.findFirst({
                where:  { id: item.id, workspace_id: workspaceId },
                select: { id: true },
            });
            if (!exists) return { error: 'Related food item not found in this workspace' };
            rows.push({ exercise_library_id: null, food_item_id: item.id, form_request_id: null });
        } else if (item.type === 'checkIn' || item.type === 'assessment') {
            // Scoped to this specific client, not just the workspace — a check-in
            // belongs to exactly one client and an observation must not be linkable
            // across clients.
            const exists = await prisma.form_requests.findFirst({
                where:  { id: item.id, workspace_id: workspaceId, client_id: clientId },
                select: { id: true },
            });
            if (!exists) return { error: 'Related check-in/assessment not found for this client' };
            rows.push({ exercise_library_id: null, food_item_id: null, form_request_id: item.id });
        } else {
            return { error: 'relatedItems[].type must be one of exercise, foodItem, checkIn, assessment' };
        }
    }

    return { data: rows };
}

/** Parses the `relatedItems` multipart field (a JSON-stringified array) sent by the client. */
function parseRelatedItemsField(raw: string | undefined): { error?: string; items?: RelatedItemInput[] } {
    if (!raw) return { items: [] };
    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error('not an array');
        return { items: parsed };
    } catch {
        return { error: 'relatedItems must be a JSON array' };
    }
}

/**
 * @openapi
 * /clients/{id}/observations:
 *   get:
 *     summary: List a client's observations (durable coaching insights), newest first
 *     tags: [Clients, Observations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: query, name: category, schema: { type: string } }
 *       - { in: query, name: severity, schema: { type: string, enum: [Low, Medium, High] } }
 *       - { in: query, name: relatedType, schema: { type: string, enum: [exercise, foodItem, checkIn, assessment] } }
 *       - { in: query, name: relatedId, schema: { type: string }, description: Exact match, requires relatedType }
 *       - { in: query, name: limit, schema: { type: integer } }
 *     responses:
 *       200:
 *         description: Array of observations
 *       404:
 *         description: Client not found
 *   post:
 *     summary: Create an observation for a client
 *     tags: [Clients, Observations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [title]
 *             properties:
 *               title:        { type: string }
 *               content:      { type: string }
 *               category:     { type: string }
 *               severity:     { type: string, enum: [Low, Medium, High] }
 *               relatedItems: { type: string, description: "JSON-stringified array of {type, id}, type in exercise|foodItem|checkIn|assessment" }
 *               file:         { type: string, format: binary }
 *     responses:
 *       201:
 *         description: Observation created
 *       400:
 *         description: Validation error
 *       404:
 *         description: Client not found
 *
 * /clients/{id}/observations/{obsId}:
 *   patch:
 *     summary: Edit an observation (author or workspace owner only)
 *     tags: [Clients, Observations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: obsId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Observation updated
 *       403:
 *         description: Not the author or workspace owner
 *       404:
 *         description: Observation not found
 *   delete:
 *     summary: Soft-delete an observation (author or workspace owner only)
 *     tags: [Clients, Observations]
 *     security:
 *       - cookieAuth: []
 *     parameters:
 *       - { in: path, name: id, required: true, schema: { type: string } }
 *       - { in: path, name: obsId, required: true, schema: { type: string } }
 *     responses:
 *       200:
 *         description: Observation soft-deleted
 *       403:
 *         description: Not the author or workspace owner
 *       404:
 *         description: Observation not found
 */
export async function getObservations(req: Request, res: Response, next: NextFunction) {
    const clientId    = req.params.id as string;
    const workspaceId = req.user!.workspaceId;
    try {
        const client = await prisma.clients.findFirst({
            where:  { id: clientId, workspace_id: workspaceId },
            select: { id: true },
        });
        if (!client) return res.status(404).json({ error: 'Client not found' });

        const { category, severity, relatedType, relatedId, limit } = req.query as Record<string, string | undefined>;

        const where: Prisma.client_observationsWhereInput = { client_id: clientId, deleted_at: null };
        if (category) where.category = category;
        if (severity) where.severity = severity;
        if (relatedType) {
            const fkField = relatedType === 'exercise' ? 'exercise_library_id'
                : relatedType === 'foodItem' ? 'food_item_id'
                : (relatedType === 'checkIn' || relatedType === 'assessment') ? 'form_request_id'
                : null;
            if (!fkField) return res.status(400).json({ error: 'relatedType must be one of exercise, foodItem, checkIn, assessment' });
            where.observation_relations = {
                some: relatedId ? { [fkField]: relatedId } : { [fkField]: { not: null } },
            };
        }

        const take = Math.min(Number(limit) || 50, 100);

        const rows = await prisma.client_observations.findMany({
            where,
            include: OBSERVATION_INCLUDE,
            orderBy: { created_at: 'desc' },
            take,
        });

        res.json(rows.map(mapObservation));
    } catch (err) {
        next(err);
    }
}

export async function createObservation(req: Request, res: Response, next: NextFunction) {
    const clientId    = req.params.id as string;
    const workspaceId = req.user!.workspaceId;
    const file        = req.file as (Express.Multer.File & { key?: string }) | undefined;

    const { title, content, category, severity, relatedItems: relatedItemsRaw } = req.body as Record<string, string | undefined>;

    const trimmedTitle = title?.trim();
    if (!trimmedTitle) return res.status(400).json({ error: 'title is required' });
    if (trimmedTitle.length > 120) return res.status(400).json({ error: 'title must be 120 characters or fewer' });

    const resolvedCategory = category?.trim() || 'General';
    if (!OBSERVATION_CATEGORIES.includes(resolvedCategory)) {
        return res.status(400).json({ error: `category must be one of ${OBSERVATION_CATEGORIES.join(', ')}` });
    }
    if (severity && !OBSERVATION_SEVERITIES.includes(severity)) {
        return res.status(400).json({ error: `severity must be one of ${OBSERVATION_SEVERITIES.join(', ')}` });
    }

    const parsedRelatedItems = parseRelatedItemsField(relatedItemsRaw);
    if (parsedRelatedItems.error) return res.status(400).json({ error: parsedRelatedItems.error });

    try {
        const client = await prisma.clients.findFirst({
            where:  { id: clientId, workspace_id: workspaceId },
            select: { id: true },
        });
        if (!client) return res.status(404).json({ error: 'Client not found' });

        const related = await resolveRelatedItemsInput(workspaceId, clientId, parsedRelatedItems.items!);
        if (related.error) return res.status(400).json({ error: related.error });

        const created = await prisma.client_observations.create({
            data: {
                id:             createId(),
                client_id:      clientId,
                workspace_id:   workspaceId,
                author_id:      req.user!.userId,
                title:          trimmedTitle,
                content:        content?.trim() || null,
                category:       resolvedCategory,
                severity:       severity || null,
                attachment_url: file ? (file.key ?? file.path) : null,
                observation_relations: {
                    create: (related.data ?? []).map((r) => ({ id: createId(), ...r })),
                },
            },
            include: OBSERVATION_INCLUDE,
        });

        res.status(201).json(mapObservation(created));
    } catch (err) {
        next(err);
    }
}

export async function updateObservation(req: Request, res: Response, next: NextFunction) {
    const clientId    = req.params.id as string;
    const obsId       = req.params.obsId as string;
    const workspaceId = req.user!.workspaceId;
    const file        = req.file as (Express.Multer.File & { key?: string }) | undefined;

    try {
        const existing = await prisma.client_observations.findFirst({
            where: { id: obsId, client_id: clientId, workspace_id: workspaceId, deleted_at: null },
        });
        if (!existing) return res.status(404).json({ error: 'Observation not found' });
        if (existing.author_id !== req.user!.userId && !req.user!.isOwner) {
            return res.status(403).json({ error: 'Only the author or the workspace owner can edit this observation' });
        }

        const { title, content, category, severity, relatedItems: relatedItemsRaw } = req.body as Record<string, string | undefined>;
        // Unchecked variant: lets us set scalar FK-shaped fields directly where needed,
        // matching the create-side convention.
        const data: Prisma.client_observationsUncheckedUpdateInput = {};

        if (title !== undefined) {
            const trimmedTitle = title.trim();
            if (!trimmedTitle) return res.status(400).json({ error: 'title cannot be empty' });
            if (trimmedTitle.length > 120) return res.status(400).json({ error: 'title must be 120 characters or fewer' });
            data.title = trimmedTitle;
        }
        if (content !== undefined) data.content = content.trim() || null;
        if (category !== undefined) {
            if (!OBSERVATION_CATEGORIES.includes(category)) {
                return res.status(400).json({ error: `category must be one of ${OBSERVATION_CATEGORIES.join(', ')}` });
            }
            data.category = category;
        }
        if (severity !== undefined) {
            if (severity && !OBSERVATION_SEVERITIES.includes(severity)) {
                return res.status(400).json({ error: `severity must be one of ${OBSERVATION_SEVERITIES.join(', ')}` });
            }
            data.severity = severity || null;
        }

        // undefined = "don't touch the links"; present (even an empty array) = replace-all.
        let newRelationRows: RelatedRelationRow[] | null = null;
        if (relatedItemsRaw !== undefined) {
            const parsedRelatedItems = parseRelatedItemsField(relatedItemsRaw);
            if (parsedRelatedItems.error) return res.status(400).json({ error: parsedRelatedItems.error });
            const related = await resolveRelatedItemsInput(workspaceId, clientId, parsedRelatedItems.items!);
            if (related.error) return res.status(400).json({ error: related.error });
            newRelationRows = related.data ?? [];
        }

        let oldAttachment: string | null = null;
        if (file) {
            oldAttachment = existing.attachment_url;
            data.attachment_url = file.key ?? file.path;
        }

        const ops: Prisma.PrismaPromise<unknown>[] = [];
        if (newRelationRows !== null) {
            ops.push(prisma.observation_relations.deleteMany({ where: { observation_id: obsId } }));
            if (newRelationRows.length > 0) {
                ops.push(prisma.observation_relations.createMany({
                    data: newRelationRows.map((r) => ({ id: createId(), observation_id: obsId, ...r })),
                }));
            }
        }
        ops.push(prisma.client_observations.update({ where: { id: obsId }, data, include: OBSERVATION_INCLUDE }));

        const results = await prisma.$transaction(ops);
        const updated = results[results.length - 1] as ObservationRow;

        if (oldAttachment) deleteFile(oldAttachment).catch(() => {});

        res.json(mapObservation(updated));
    } catch (err) {
        next(err);
    }
}

export async function deleteObservation(req: Request, res: Response, next: NextFunction) {
    const clientId    = req.params.id as string;
    const obsId       = req.params.obsId as string;
    const workspaceId = req.user!.workspaceId;

    try {
        const existing = await prisma.client_observations.findFirst({
            where: { id: obsId, client_id: clientId, workspace_id: workspaceId, deleted_at: null },
        });
        if (!existing) return res.status(404).json({ error: 'Observation not found' });
        if (existing.author_id !== req.user!.userId && !req.user!.isOwner) {
            return res.status(403).json({ error: 'Only the author or the workspace owner can delete this observation' });
        }

        await prisma.client_observations.update({
            where: { id: obsId },
            data:  { deleted_at: new Date() },
        });

        if (existing.attachment_url) deleteFile(existing.attachment_url).catch(() => {});

        res.json({ deleted: obsId });
    } catch (err) {
        next(err);
    }
}
