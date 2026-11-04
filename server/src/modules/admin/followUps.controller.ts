import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { z } from 'zod';
import { prisma } from '../../lib/prisma';
import { toWhatsAppContact } from '../../utils/phone';
import { COACH_STATUS_SQL, CoachStatus, FREE_PLAN_NAME } from './coachStatus';

const REPORT_TIME_ZONE = 'Africa/Cairo';
const MAX_NOTE_LENGTH = 2000;
const MANUAL_PAYMENT_METHOD = 'manual';
const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

interface FollowUpCoachRow {
    workspace_id:   string;
    workspace_name: string;
    workspace_slug: string;
    archived_at:    Date | null;
    signed_up_at:   Date;
    owner_fname:    string;
    owner_lname:    string;
    owner_email:    string;
    owner_phone:    string | null;
    status:         CoachStatus;
    days_since_signup: number;
    clients_count:  number;
    first_source:   string | null;
    follow_up_count: number;
    last_follow_up_at: Date | null;
    next_follow_up_on: string | null;
    is_due:         boolean;
    pending_amount:        string | null;
    pending_currency:      string | null;
    pending_reference_code: string | null;
    pending_waiting_days:  number | null;
}

const isRealDate = (value: string) => !Number.isNaN(new Date(value).getTime());

const dateOnlySchema = z.string().regex(DATE_ONLY_PATTERN, 'Use a YYYY-MM-DD date').refine(isRealDate, 'Not a real date');
const followedUpAtSchema = z.union([z.string().datetime({ offset: true }), dateOnlySchema]);
const noteSchema = z.string().trim().max(MAX_NOTE_LENGTH, `Keep notes under ${MAX_NOTE_LENGTH} characters`);

const createSchema = z.object({
    sentNote:       noteSchema.min(1, 'Write what you sent or talked about'),
    replyNote:      noteSchema.nullish().transform(value => value || null),
    followedUpAt:   followedUpAtSchema.optional(),
    nextFollowUpOn: dateOnlySchema.nullish(),
}).strict();

const updateSchema = z.object({
    sentNote:       noteSchema.min(1, 'Write what you sent or talked about').optional(),
    replyNote:      noteSchema.nullable().transform(value => value || null).optional(),
    followedUpAt:   followedUpAtSchema.optional(),
    nextFollowUpOn: dateOnlySchema.nullable().optional(),
}).strict();

const dateOnlyOf = (date: Date) => date.toISOString().slice(0, 10);

function serializeEntry(entry: {
    id: string; followed_up_at: Date; sent_note: string; reply_note: string | null;
    next_follow_up_on: Date | null; created_at: Date;
}) {
    return {
        id:             entry.id,
        followedUpAt:   entry.followed_up_at,
        sentNote:       entry.sent_note,
        replyNote:      entry.reply_note,
        nextFollowUpOn: entry.next_follow_up_on ? dateOnlyOf(entry.next_follow_up_on) : null,
        createdAt:      entry.created_at,
    };
}

// A reminder dated before the message it follows would show as overdue the moment it is saved.
function nextDateIsBefore(nextFollowUpOn: string | null | undefined, followedUpAt: Date): boolean {
    return !!nextFollowUpOn && nextFollowUpOn < dateOnlyOf(followedUpAt);
}

async function fetchFreeClientLimit(): Promise<number | null> {
    const freePlan = await prisma.plans.findFirst({
        where:  { name: FREE_PLAN_NAME, is_active: true },
        select: { plan_variations: { where: { is_default: true }, select: { max_clients: true } } },
    });
    return freePlan?.plan_variations[0]?.max_clients ?? null;
}

async function fetchCoachRows(includeArchived: boolean): Promise<FollowUpCoachRow[]> {
    return prisma.$queryRaw<FollowUpCoachRow[]>`
        SELECT
            w.id AS workspace_id, w.name AS workspace_name, w.slug AS workspace_slug,
            w.archived_at, w.created_at AS signed_up_at,
            u.fname AS owner_fname, u.lname AS owner_lname, u.email AS owner_email, u.phone AS owner_phone,
            ${COACH_STATUS_SQL} AS status,
            GREATEST(0, floor(extract(epoch FROM (now() - w.created_at)) / 86400))::int AS days_since_signup,
            (SELECT COUNT(*)::int FROM clients c
              WHERE c.workspace_id = w.id AND c.deleted_at IS NULL AND c.archived_at IS NULL) AS clients_count,
            v.first_source,
            (SELECT COUNT(*)::int FROM admin_follow_ups f
              WHERE f.workspace_id = w.id AND f.deleted_at IS NULL) AS follow_up_count,
            latest.followed_up_at AS last_follow_up_at,
            to_char(latest.next_follow_up_on, 'YYYY-MM-DD') AS next_follow_up_on,
            COALESCE(latest.next_follow_up_on <= (now() AT TIME ZONE ${REPORT_TIME_ZONE})::date, FALSE) AS is_due,
            pending.amount::text AS pending_amount, pending.currency AS pending_currency,
            pending.reference_code AS pending_reference_code,
            GREATEST(0, floor(extract(epoch FROM (now() - pending.created_at)) / 86400))::int AS pending_waiting_days
        FROM workspaces w
        JOIN users u ON u.id = w.owner_id
        LEFT JOIN workspace_subscriptions ws ON ws.workspace_id = w.id
        LEFT JOIN plans sp ON sp.id = ws.plan_id
        LEFT JOIN visitors v ON v.id = w.visitor_id
        LEFT JOIN LATERAL (
            -- the newest entry decides the reminder: no next date on it means nothing is pending
            SELECT f.followed_up_at, f.next_follow_up_on
            FROM admin_follow_ups f
            WHERE f.workspace_id = w.id AND f.deleted_at IS NULL
            ORDER BY f.followed_up_at DESC, f.created_at DESC
            LIMIT 1
        ) latest ON TRUE
        LEFT JOIN LATERAL (
            -- a manual bank/wallet transfer the coach started that is waiting for the admin to confirm it
            -- (card / wallet / Fawry are confirmed by the gateway, so a pending one of those is an abandoned checkout)
            SELECT pm.amount, pm.currency, pm.reference_code, pm.created_at
            FROM workspace_payments pm
            WHERE pm.workspace_id = w.id AND pm.gateway_status = 'pending' AND pm.payment_method = ${MANUAL_PAYMENT_METHOD}
              AND pm.addon_id IS NULL
            ORDER BY pm.created_at DESC
            LIMIT 1
        ) pending ON TRUE
        WHERE ${includeArchived} OR w.archived_at IS NULL
        ORDER BY w.created_at DESC
    `;
}

export async function listFollowUpCoaches(req: Request, res: Response, next: NextFunction) {
    try {
        const includeArchived = req.query.includeArchived === 'true';
        const [rows, freeClientLimit] = await Promise.all([fetchCoachRows(includeArchived), fetchFreeClientLimit()]);

        const coaches = rows.map(row => {
            const contact = toWhatsAppContact(row.owner_phone);
            return {
                workspaceId:   row.workspace_id,
                workspaceName: row.workspace_name,
                workspaceSlug: row.workspace_slug,
                isArchived:    row.archived_at !== null,
                ownerName:     `${row.owner_fname} ${row.owner_lname}`.trim(),
                ownerEmail:    row.owner_email,
                phone:         row.owner_phone,
                whatsappNumber: contact.whatsappNumber,
                isPhoneSuspicious: contact.isSuspicious,
                signedUpAt:    row.signed_up_at,
                daysSinceSignup: row.days_since_signup,
                status:        row.status,
                clientsCount:  row.clients_count,
                firstSource:   row.first_source,
                followUpCount: row.follow_up_count,
                lastFollowUpAt: row.last_follow_up_at,
                nextFollowUpOn: row.next_follow_up_on,
                isDue:         row.is_due,
                pendingTransfer: row.pending_amount === null ? null : {
                    amount:        Number(row.pending_amount),
                    currency:      row.pending_currency,
                    referenceCode: row.pending_reference_code,
                    waitingDays:   row.pending_waiting_days,
                },
            };
        });

        res.json({ coaches, freeClientLimit });
    } catch (err) {
        next(err);
    }
}

async function findWorkspaceSummary(workspaceId: string) {
    return prisma.workspaces.findUnique({ where: { id: workspaceId }, select: { id: true, name: true, slug: true } });
}

export async function getFollowUpHistory(req: Request, res: Response, next: NextFunction) {
    try {
        const workspaceId = req.params.workspaceId as string;
        const workspace = await findWorkspaceSummary(workspaceId);
        if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

        const entries = await prisma.admin_follow_ups.findMany({
            where:   { workspace_id: workspaceId, deleted_at: null },
            orderBy: [{ followed_up_at: 'desc' }, { created_at: 'desc' }],
        });
        res.json({ workspace, entries: entries.map(serializeEntry) });
    } catch (err) {
        next(err);
    }
}

export async function createFollowUp(req: Request, res: Response, next: NextFunction) {
    try {
        const parsed = createSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid follow-up' });

        const workspaceId = req.params.workspaceId as string;
        const workspace = await findWorkspaceSummary(workspaceId);
        if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

        const followedUpAt = parsed.data.followedUpAt ? new Date(parsed.data.followedUpAt) : new Date();
        if (nextDateIsBefore(parsed.data.nextFollowUpOn, followedUpAt)) {
            return res.status(400).json({ message: 'The next follow-up cannot be before the date of this one' });
        }

        const entry = await prisma.admin_follow_ups.create({
            data: {
                id:                  createId(),
                workspace_id:        workspaceId,
                followed_up_at:      followedUpAt,
                sent_note:           parsed.data.sentNote,
                reply_note:          parsed.data.replyNote,
                next_follow_up_on:   parsed.data.nextFollowUpOn ? new Date(parsed.data.nextFollowUpOn) : null,
                created_by_admin_id: typeof req.admin?.adminId === 'string' ? req.admin.adminId : null,
            },
        });
        res.status(201).json(serializeEntry(entry));
    } catch (err) {
        next(err);
    }
}

export async function updateFollowUp(req: Request, res: Response, next: NextFunction) {
    try {
        const parsed = updateSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid follow-up' });

        const entryId = req.params.entryId as string;
        const existing = await prisma.admin_follow_ups.findFirst({ where: { id: entryId, deleted_at: null } });
        if (!existing) return res.status(404).json({ message: 'Follow-up not found' });

        const followedUpAt = parsed.data.followedUpAt ? new Date(parsed.data.followedUpAt) : existing.followed_up_at;
        const nextFollowUpOn = parsed.data.nextFollowUpOn !== undefined
            ? parsed.data.nextFollowUpOn
            : (existing.next_follow_up_on ? dateOnlyOf(existing.next_follow_up_on) : null);
        if (nextDateIsBefore(nextFollowUpOn, followedUpAt)) {
            return res.status(400).json({ message: 'The next follow-up cannot be before the date of this one' });
        }

        const entry = await prisma.admin_follow_ups.update({
            where: { id: entryId },
            data:  {
                followed_up_at:    followedUpAt,
                sent_note:         parsed.data.sentNote ?? existing.sent_note,
                reply_note:        parsed.data.replyNote !== undefined ? parsed.data.replyNote : existing.reply_note,
                next_follow_up_on: nextFollowUpOn ? new Date(nextFollowUpOn) : null,
                updated_at:        new Date(),
            },
        });
        res.json(serializeEntry(entry));
    } catch (err) {
        next(err);
    }
}

// Soft delete — the row stays for audit, but it leaves history and stops driving reminders.
export async function deleteFollowUp(req: Request, res: Response, next: NextFunction) {
    try {
        const entryId = req.params.entryId as string;
        const result = await prisma.admin_follow_ups.updateMany({
            where: { id: entryId, deleted_at: null },
            data:  { deleted_at: new Date() },
        });
        if (result.count === 0) return res.status(404).json({ message: 'Follow-up not found' });
        res.status(204).end();
    } catch (err) {
        next(err);
    }
}
