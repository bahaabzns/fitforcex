import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { applyPayment } from '../billing/index';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { normalizeEmail } from '../../utils/email';
import { formatPlanVariationLabel } from '../../lib/planVariationLabel';
import { checkVariationSwitchAllowed } from '../../lib/planVariationSwitch';
import { READONLY_GRACE_DAYS } from '../../middleware/subscriptionAccessGate';

type Row = Record<string, unknown>;

/** Id-preserving nested upsert for a plan's variations, mirroring the pattern already
 *  proven in packages.controller.ts:updatePackage — existing variations keep their id
 *  (workspace_subscriptions/workspace_payments hold FKs to it), only genuinely new rows
 *  get a fresh one. Removing a variation that a workspace is subscribed to or has paid
 *  for is blocked rather than silently orphaning that workspace's entitlement. */
async function upsertPlanVariations(tx: Prisma.TransactionClient, planId: string, variations: unknown): Promise<void> {
    if (!Array.isArray(variations)) return;
    if (variations.length === 0) throw { status: 400, message: 'A plan must have at least one variation.' };

    const existing = await tx.plan_variations.findMany({ where: { plan_id: planId }, select: { id: true } });
    const existingIds = new Set(existing.map(v => v.id));
    const keptIds = new Set<string>();

    const rows = variations.map((raw, index) => {
        const v = raw as Record<string, unknown>;
        const rawId = typeof v.id === 'string' ? v.id : null;
        const isExisting = !!(rawId && existingIds.has(rawId));
        const id = isExisting ? (rawId as string) : createId();
        if (isExisting) keptIds.add(id);

        const data: Prisma.plan_variationsUncheckedCreateInput = {
            id, plan_id: planId,
            max_clients:    (v.max_clients as number | null | undefined) ?? null,
            max_team_seats: (v.max_team_seats as number | null | undefined) ?? null,
            price_monthly:  (v.price_monthly as number | null | undefined) ?? null,
            currency:      (v.currency as string | undefined)?.trim() || 'LE',
            payment_link:  (v.payment_link as string | undefined)?.trim() || null,
            is_default:    (v.is_default as boolean | undefined) ?? false,
            is_active:     (v.is_active as boolean | undefined) ?? true,
            sort_order:    index,
        };
        return { id, isNew: !isExisting, data };
    });

    const idsToDelete = existing.map(v => v.id).filter(eid => !keptIds.has(eid));
    if (idsToDelete.length > 0) {
        const [subsInUse, paymentsInUse] = await Promise.all([
            tx.workspace_subscriptions.count({ where: { variation_id: { in: idsToDelete } } }),
            tx.workspace_payments.count({ where: { variation_id: { in: idsToDelete } } }),
        ]);
        if (subsInUse > 0 || paymentsInUse > 0) {
            throw { status: 409, message: 'Cannot remove a variation that a workspace is currently subscribed to or has paid for.' };
        }
        await tx.plan_variations.deleteMany({ where: { id: { in: idsToDelete } } });
    }

    // Two-pass write on kept rows: bump sort_order out of range first, then set final
    // values — avoids the (plan_id, sort_order) unique constraint colliding mid-reorder.
    const kept = rows.filter(r => !r.isNew);
    for (const row of kept) {
        await tx.plan_variations.update({ where: { id: row.id }, data: { sort_order: row.data.sort_order as number + 100000 } });
    }
    for (const row of kept) {
        await tx.plan_variations.update({ where: { id: row.id }, data: row.data });
    }

    const toCreate = rows.filter(r => r.isNew).map(r => r.data);
    if (toCreate.length > 0) {
        await tx.plan_variations.createMany({ data: toCreate });
    }
}

/** Which add-ons a plan may buy, and each one's optional unit cap (e.g. OneForce's admin-
 *  configured "max 3 client add-ons"). Unlike variations, nothing references a
 *  plan_addon_rules row by id (workspace_addons points at addons directly), so a plain
 *  delete-and-recreate on every save is safe — no id-preservation needed. */
async function upsertPlanAddonRules(tx: Prisma.TransactionClient, planId: string, addonRules: unknown): Promise<void> {
    if (!Array.isArray(addonRules)) return;

    await tx.plan_addon_rules.deleteMany({ where: { plan_id: planId } });
    const rows = addonRules
        .map(raw => raw as Record<string, unknown>)
        .filter(r => typeof r.addon_id === 'string' && r.addon_id)
        .map(r => ({
            id:        createId(),
            plan_id:   planId,
            addon_id:  r.addon_id as string,
            max_units: (r.max_units as number | null | undefined) ?? null,
        }));
    if (rows.length > 0) {
        await tx.plan_addon_rules.createMany({ data: rows });
    }
}

async function upsertPeriodLinks(tx: Prisma.TransactionClient, planId: string, periodLinks: unknown): Promise<void> {
    if (!periodLinks || typeof periodLinks !== 'object') return;
    for (const [periodKey, link] of Object.entries(periodLinks as Record<string, unknown>)) {
        const url = typeof link === 'string' ? link.trim() || null : null;
        const discount = await tx.billing_discounts.findFirst({
            where:  { period_key: periodKey },
            select: { id: true },
        });
        if (!discount) continue;
        await tx.plan_period_links.upsert({
            where:  { plan_id_billing_discount_id: { plan_id: planId, billing_discount_id: discount.id } },
            create: { id: createId(), plan_id: planId, billing_discount_id: discount.id, payment_link: url },
            update: { payment_link: url },
        });
    }
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function adminLogin(req: Request, res: Response, next: NextFunction) {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

    try {
        const admin = await prisma.admins.findFirst({
            where: { email: { equals: normalizeEmail(email), mode: 'insensitive' } },
        });
        if (!admin) return res.status(401).json({ message: 'Invalid email or password' });

        const match = await bcrypt.compare(password, admin.password!);
        if (!match) return res.status(401).json({ message: 'Invalid email or password' });

        const token = jwt.sign(
            { adminId: admin.id, isAdmin: true },
            env.ADMIN_JWT_SECRET,
            { expiresIn: '8h' }
        );

        res.cookie('admin_token', token, {
            httpOnly: true,
            secure:   env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge:   8 * 60 * 60 * 1000,
        })
           .status(200)
           .json({ message: 'Admin login successful', admin: { id: admin.id, email: admin.email, fname: admin.fname, lname: admin.lname } });
    } catch (err) {
        next(err);
    }
}

export async function adminMe(req: Request, res: Response, next: NextFunction) {
    try {
        const admin = await prisma.admins.findFirst({
            where:  { id: (req.admin as Row).adminId as string },
            select: { id: true, email: true, fname: true, lname: true, created_at: true },
        });
        if (!admin) return res.status(404).json({ message: 'Admin not found' });
        res.status(200).json(admin);
    } catch (err) {
        next(err);
    }
}

export function adminLogout(_req: Request, res: Response) {
    res.clearCookie('admin_token').status(200).json({ message: 'Logged out' });
}

// ── Stats ─────────────────────────────────────────────────────────────────────

export async function getStats(_req: Request, res: Response, next: NextFunction) {
    try {
        const [totalUsers, wsResult, planBreakdown, recent] = await Promise.all([
            prisma.users.count(),
            prisma.$queryRaw<Row[]>`
                SELECT COUNT(*)::int AS total_workspaces, COUNT(*) FILTER (WHERE archived_at IS NOT NULL)::int AS archived FROM workspaces
            `,
            prisma.$queryRaw<Row[]>`
                SELECT p.name AS plan, p.display_name, COUNT(ws.id)::int AS count
                FROM plans p
                LEFT JOIN workspace_subscriptions ws ON ws.plan_id = p.id
                GROUP BY p.id, p.name, p.display_name ORDER BY p.id
            `,
            prisma.$queryRaw<Row[]>`
                SELECT u.id, u.fname, u.lname, u.email, u.created_at,
                       w.name AS workspace_name, w.slug AS workspace_slug
                FROM users u
                LEFT JOIN workspaces w ON w.owner_id = u.id AND w.archived_at IS NULL
                ORDER BY u.created_at DESC LIMIT 10
            `,
        ]);

        res.json({
            totalUsers,
            totalWorkspaces:    parseInt((wsResult[0] as Row).total_workspaces as string),
            archivedWorkspaces: parseInt((wsResult[0] as Row).archived as string),
            planBreakdown,
            recentRegistrations: recent,
        });
    } catch (err) {
        next(err);
    }
}

// ── Users ─────────────────────────────────────────────────────────────────────

export async function getUsers(req: Request, res: Response, next: NextFunction) {
    const { search = '', page = 1, limit = 20 } = req.query as Record<string, string>;
    const offset      = (parseInt(page as string) - 1) * parseInt(limit as string);
    const searchParam = `%${search}%`;

    try {
        const [rows, countRows] = await Promise.all([
            prisma.$queryRawUnsafe<Row[]>(`
                SELECT u.id, u.fname, u.lname, u.email, u.created_at, u.is_admin,
                       COUNT(DISTINCT w.id) FILTER (WHERE w.archived_at IS NULL)::int AS workspace_count,
                       COUNT(DISTINCT wm.workspace_id)::int AS member_count
                FROM users u
                LEFT JOIN workspaces w ON w.owner_id = u.id
                LEFT JOIN workspace_members wm ON wm.user_id = u.id
                WHERE u.fname ILIKE $1 OR u.lname ILIKE $1 OR u.email ILIKE $1
                GROUP BY u.id ORDER BY u.created_at DESC LIMIT $2 OFFSET $3
            `, searchParam, parseInt(limit as string), offset),
            prisma.$queryRawUnsafe<Row[]>(
                `SELECT COUNT(*) FROM users WHERE fname ILIKE $1 OR lname ILIKE $1 OR email ILIKE $1`,
                searchParam
            ),
        ]);

        res.json({
            users: rows, total: parseInt((countRows[0] as Row).count as string),
            page: parseInt(page as string), limit: parseInt(limit as string),
        });
    } catch (err) {
        next(err);
    }
}

export async function getUserById(req: Request, res: Response, next: NextFunction) {
    try {
        const user = await prisma.users.findFirst({
            where:  { id: req.params.id as string },
            select: { id: true, fname: true, lname: true, email: true, created_at: true, is_admin: true, default_workspace_id: true },
        });
        if (!user) return res.status(404).json({ message: 'User not found' });

        const workspaces = await prisma.$queryRaw<Row[]>`
            SELECT w.id, w.slug, w.name, w.archived_at, w.created_at, 'owner' AS role, p.display_name AS plan
            FROM workspaces w
            JOIN workspace_subscriptions ws ON ws.workspace_id = w.id
            JOIN plans p ON p.id = ws.plan_id
            WHERE w.owner_id = ${req.params.id}
            UNION ALL
            SELECT w.id, w.slug, w.name, w.archived_at, w.created_at, wm.role, p.display_name AS plan
            FROM workspace_members wm
            JOIN workspaces w ON w.id = wm.workspace_id
            JOIN workspace_subscriptions ws ON ws.workspace_id = w.id
            JOIN plans p ON p.id = ws.plan_id
            WHERE wm.user_id = ${req.params.id}
            ORDER BY created_at DESC
        `;

        res.json({ ...user, workspaces });
    } catch (err) {
        next(err);
    }
}

// ── Workspaces ────────────────────────────────────────────────────────────────

// Same classification subscriptionAccessGate.ts enforces with, expressed as SQL — "flat" reads
// ws.* directly (workspace_subscriptions is one-to-one per workspace, safe outside a GROUP BY),
// "agg" wraps in MAX() so it's usable inside a query that also aggregates member/client counts.
const ACCESS_STATUS_CASE_FLAT = `
    CASE
        WHEN ws.id IS NULL THEN 'no_subscription'
        WHEN ws.expires_at IS NULL THEN 'active'
        WHEN ws.expires_at + INTERVAL '${READONLY_GRACE_DAYS} days' > NOW() THEN 'active'
        ELSE 'read_only'
    END
`;
const ACCESS_STATUS_CASE_AGG = `
    CASE
        WHEN MAX(ws.id) IS NULL THEN 'no_subscription'
        WHEN MAX(ws.expires_at) IS NULL THEN 'active'
        WHEN MAX(ws.expires_at) + INTERVAL '${READONLY_GRACE_DAYS} days' > NOW() THEN 'active'
        ELSE 'read_only'
    END
`;

export async function getWorkspaces(req: Request, res: Response, next: NextFunction) {
    const { search = '', plan = '', status = '', archived = 'false', page = 1, limit = 20 } = req.query as Record<string, string>;
    const offset       = (parseInt(page as string) - 1) * parseInt(limit as string);
    const showArchived = archived === 'true';

    try {
        const conditions: string[] = ['(w.slug ILIKE $1 OR w.name ILIKE $1)'];
        const params: unknown[]   = [`%${search}%`];

        if (!showArchived) conditions.push('w.archived_at IS NULL');
        if (plan) {
            params.push(plan);
            conditions.push(`p.name = $${params.length}`);
        }
        const where = conditions.join(' AND ');

        let statusParamIndex = -1;
        if (status) {
            params.push(status);
            statusParamIndex = params.length;
        }

        const [rows, countRows] = await Promise.all([
            prisma.$queryRawUnsafe<Row[]>(`
                SELECT w.id, w.slug, w.name, w.archived_at, w.created_at,
                       u.fname AS owner_fname, u.lname AS owner_lname, u.email AS owner_email,
                       COALESCE(p.name, 'none') AS plan, COALESCE(p.display_name, 'No Plan') AS plan_display,
                       COUNT(DISTINCT wm.id)::int AS member_count, COUNT(DISTINCT c.id)::int AS client_count,
                       MAX(ws.expires_at) AS expires_at,
                       ${ACCESS_STATUS_CASE_AGG} AS access_status
                FROM workspaces w
                JOIN users u ON u.id = w.owner_id
                LEFT JOIN workspace_subscriptions ws ON ws.workspace_id = w.id
                LEFT JOIN plans p ON p.id = ws.plan_id
                LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.is_active = TRUE
                LEFT JOIN clients c ON c.workspace_id = w.id
                WHERE ${where}
                GROUP BY w.id, u.id, p.id
                ${statusParamIndex > 0 ? `HAVING ${ACCESS_STATUS_CASE_AGG} = $${statusParamIndex}` : ''}
                ORDER BY w.created_at DESC
                LIMIT $${params.length + 1} OFFSET $${params.length + 2}
            `, ...params, parseInt(limit as string), offset),
            prisma.$queryRawUnsafe<Row[]>(`
                SELECT COUNT(DISTINCT w.id)
                FROM workspaces w
                LEFT JOIN workspace_subscriptions ws ON ws.workspace_id = w.id
                LEFT JOIN plans p ON p.id = ws.plan_id
                WHERE ${where}
                ${statusParamIndex > 0 ? `AND ${ACCESS_STATUS_CASE_FLAT} = $${statusParamIndex}` : ''}
            `, ...params),
        ]);

        res.json({
            workspaces: rows, total: parseInt((countRows[0] as Row).count as string),
            page: parseInt(page as string), limit: parseInt(limit as string),
        });
    } catch (err) {
        next(err);
    }
}

export async function getWorkspaceById(req: Request, res: Response, next: NextFunction) {
    try {
        const [detailRows, members, addons] = await Promise.all([
            prisma.$queryRaw<Row[]>`
                SELECT w.id, w.slug, w.name, w.archived_at, w.created_at, w.slug_customized,
                       u.id AS owner_id, u.fname AS owner_fname, u.lname AS owner_lname, u.email AS owner_email,
                       p.id AS plan_id, COALESCE(p.name, 'none') AS plan, COALESCE(p.display_name, 'No Plan') AS plan_display,
                       pv.id AS variation_id,
                       ws.status AS subscription_status, ws.starts_at, ws.expires_at,
                       COUNT(DISTINCT wm.id)::int AS member_count, COUNT(DISTINCT c.id)::int AS client_count
                FROM workspaces w
                JOIN users u ON u.id = w.owner_id
                LEFT JOIN workspace_subscriptions ws ON ws.workspace_id = w.id
                LEFT JOIN plans p ON p.id = ws.plan_id
                LEFT JOIN plan_variations pv ON pv.id = ws.variation_id
                LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.is_active = TRUE
                LEFT JOIN clients c ON c.workspace_id = w.id
                WHERE w.id = ${req.params.id}
                GROUP BY w.id, u.id, p.id, pv.id, ws.id
            `,
            prisma.$queryRaw<Row[]>`
                SELECT wm.id, wm.role, wm.is_active, wm.joined_at,
                       u.id AS user_id, u.fname, u.lname, u.email
                FROM workspace_members wm
                JOIN users u ON u.id = wm.user_id
                WHERE wm.workspace_id = ${req.params.id}
                ORDER BY wm.joined_at
            `,
            prisma.workspace_addons.findMany({
                where:   { workspace_id: req.params.id as string, status: 'active' },
                select:  { id: true, dimension: true, units: true, quantity: true, unit_price_locked: true, currency: true, purchased_at: true, addons: { select: { label: true } } },
                orderBy: { purchased_at: 'desc' },
            }),
        ]);

        if (!detailRows.length) return res.status(404).json({ message: 'Workspace not found' });
        res.json({
            ...detailRows[0],
            members,
            addons: addons.map(a => ({
                id: a.id, label: a.addons?.label ?? `+${a.units} ${a.dimension}`,
                dimension: a.dimension, units: a.units, quantity: a.quantity,
                priceMonthly: a.unit_price_locked, currency: a.currency, purchasedAt: a.purchased_at,
            })),
        });
    } catch (err) {
        next(err);
    }
}

export async function updateWorkspaceSubscription(req: Request, res: Response, next: NextFunction) {
    const { planId, variationId, notes, force } = req.body as {
        planId?: string; variationId?: string; notes?: string; force?: boolean;
    };
    if (!planId || !variationId) return res.status(400).json({ message: 'planId and variationId are required' });

    try {
        const [plan, variation, workspace] = await Promise.all([
            prisma.plans.findFirst({ where: { id: planId }, select: { id: true, max_team_seats: true } }),
            prisma.plan_variations.findFirst({ where: { id: variationId, plan_id: planId } }),
            prisma.workspaces.findFirst({ where: { id: req.params.id as string }, select: { id: true, owner_id: true } }),
        ]);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });
        if (!variation) return res.status(404).json({ message: 'Plan variation not found' });
        if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

        // Same downgrade guard self-serve checkout uses (§8) — an admin override skips it
        // only when explicitly forced, so a workspace never lands over its new limits by
        // accident.
        if (!force) {
            await checkVariationSwitchAllowed(workspace.id, {
                max_clients:    variation.max_clients,
                max_team_seats: variation.max_team_seats ?? plan.max_team_seats,
            });
        }

        // Deliberately does not touch status/expires_at — payments are the only source of
        // truth for whether a workspace is in good standing (subscriptionAccessGate.ts).
        // This action only reassigns WHICH plan/variation a workspace is on; recording that
        // they've actually paid is a separate, explicit action (manual payment entry).
        await prisma.workspace_subscriptions.updateMany({
            where: { workspace_id: workspace.id },
            data: {
                plan_id:              planId,
                variation_id:         variationId,
                locked_price_monthly: variation.price_monthly,
                locked_currency:      variation.currency,
                notes:                notes || null,
            },
        });

        res.json({ message: 'Subscription updated' });
    } catch (err) {
        const httpErr = err as { status?: number; message?: string };
        if (httpErr.status) return res.status(httpErr.status).json({ message: httpErr.message });
        next(err);
    }
}

/** Records a payment that happened outside Fawaterak (bank transfer, cash, a manually-agreed
 *  deal) and immediately applies it — the workspace_payments row + applyPayment call are the
 *  exact same path a real Fawaterak webhook takes, so this is genuinely "payments are the
 *  only source of truth" and not a side-channel that bypasses it. Amount/currency/duration
 *  default from the chosen variation/plan but are editable for a one-off arrangement. */
export async function createManualPayment(req: Request, res: Response, next: NextFunction) {
    const { planId, variationId, amount, currency, durationDays, notes, startDate } = req.body as {
        planId?: string; variationId?: string; amount?: number; currency?: string;
        durationDays?: number; notes?: string; startDate?: string;
    };
    if (!planId || !variationId) return res.status(400).json({ message: 'planId and variationId are required' });

    let parsedStartDate: Date | undefined;
    if (startDate) {
        parsedStartDate = new Date(startDate);
        if (isNaN(parsedStartDate.getTime())) return res.status(400).json({ message: 'startDate is not a valid date' });
    }

    try {
        const [plan, variation, workspace] = await Promise.all([
            prisma.plans.findFirst({ where: { id: planId } }),
            prisma.plan_variations.findFirst({ where: { id: variationId, plan_id: planId } }),
            prisma.workspaces.findFirst({ where: { id: req.params.id as string }, select: { id: true } }),
        ]);
        if (!plan) return res.status(404).json({ message: 'Plan not found' });
        if (!variation) return res.status(404).json({ message: 'Plan variation not found' });
        if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

        const paymentId = createId();
        await prisma.workspace_payments.create({
            data: {
                id:               paymentId,
                workspace_id:     workspace.id,
                plan_id:          plan.id,
                variation_id:     variation.id,
                amount:           amount != null ? amount : (variation.price_monthly ?? 0),
                currency:         currency?.trim() || variation.currency,
                duration_days:    durationDays != null ? durationDays : plan.duration_days,
                fawaterak_status: 'pending',
                notes:            `Manual payment recorded by admin${notes?.trim() ? ': ' + notes.trim() : ''}`,
            },
        });

        await applyPayment(paymentId, workspace.id, parsedStartDate);
        res.status(201).json({ message: 'Manual payment recorded and subscription activated', paymentId });
    } catch (err) {
        next(err);
    }
}

/** Add-on counterpart to createManualPayment — mirrors the self-serve createAddonInvoice/
 *  applyAddonPurchase path exactly (same billing-cycle-extension math, same workspace_addons
 *  row shape), just admin-triggered instead of Fawaterak-confirmed. Deliberately does not
 *  check plan_addon_rules' cap — an admin explicitly granting an add-on is a trusted, one-off
 *  decision, not a self-serve purchase that needs the configured limit enforced. */
export async function createManualAddonPayment(req: Request, res: Response, next: NextFunction) {
    const { addonId, quantity, amount, currency, durationDays, notes } = req.body as {
        addonId?: string; quantity?: number; amount?: number; currency?: string;
        durationDays?: number; notes?: string;
    };
    if (!addonId) return res.status(400).json({ message: 'addonId is required' });
    const units = quantity != null && quantity > 0 ? quantity : 1;

    try {
        const [addon, workspace] = await Promise.all([
            prisma.addons.findFirst({ where: { id: addonId } }),
            prisma.workspaces.findFirst({ where: { id: req.params.id as string }, select: { id: true } }),
        ]);
        if (!addon) return res.status(404).json({ message: 'Add-on not found' });
        if (!workspace) return res.status(404).json({ message: 'Workspace not found' });

        const sub = await prisma.workspace_subscriptions.findUnique({
            where:  { workspace_id: workspace.id },
            select: { plan_id: true, plans: { select: { duration_days: true } } },
        });
        if (!sub) return res.status(409).json({ message: 'Workspace has no subscription to attach this add-on to' });

        const paymentId = createId();
        await prisma.workspace_payments.create({
            data: {
                id:               paymentId,
                workspace_id:     workspace.id,
                plan_id:          sub.plan_id,
                addon_id:         addon.id,
                amount:           amount != null ? amount : Number(addon.price_monthly) * units,
                currency:         currency?.trim() || addon.currency,
                duration_days:    durationDays != null ? durationDays : sub.plans.duration_days,
                fawaterak_status: 'pending',
                notes:            `Manual add-on payment recorded by admin${notes?.trim() ? ': ' + notes.trim() : ''}`,
            },
        });

        await applyPayment(paymentId, workspace.id, undefined, units);
        res.status(201).json({ message: `Add-on recorded and applied (${units}x ${addon.label})`, paymentId });
    } catch (err) {
        next(err);
    }
}

/** Manual lever for decision 5: an admin editing a variation's public price never
 *  retroactively reprices existing subscribers (see workspace_subscriptions.locked_price_monthly).
 *  This explicitly opts one workspace into the variation's *current* public price. */
export async function resyncSubscriptionPrice(req: Request, res: Response, next: NextFunction) {
    try {
        const sub = await prisma.workspace_subscriptions.findUnique({
            where:   { workspace_id: req.params.id as string },
            include: { plan_variations: true },
        });
        if (!sub) return res.status(404).json({ message: 'Subscription not found' });
        if (!sub.plan_variations) return res.status(409).json({ message: 'Subscription has no variation to resync from' });

        const updated = await prisma.workspace_subscriptions.update({
            where: { workspace_id: req.params.id as string },
            data: {
                locked_price_monthly: sub.plan_variations.price_monthly,
                locked_currency:      sub.plan_variations.currency,
            },
        });

        res.json({
            message:            'Price resynced to the variation\'s current public price',
            lockedPriceMonthly: updated.locked_price_monthly,
            lockedCurrency:     updated.locked_currency,
        });
    } catch (err) {
        next(err);
    }
}

export async function restoreWorkspace(req: Request, res: Response, next: NextFunction) {
    try {
        const updated = await prisma.workspaces.updateMany({
            where: { id: req.params.id as string, archived_at: { not: null } },
            data:  { archived_at: null },
        });
        if (updated.count === 0) return res.status(400).json({ message: 'Workspace is not archived or does not exist' });
        res.json({ message: 'Workspace restored' });
    } catch (err) {
        next(err);
    }
}

export async function archiveWorkspace(req: Request, res: Response, next: NextFunction) {
    try {
        const updated = await prisma.workspaces.updateMany({
            where: { id: req.params.id as string, archived_at: null },
            data:  { archived_at: new Date() },
        });
        if (updated.count === 0) return res.status(400).json({ message: 'Workspace is already archived or does not exist' });
        res.json({ message: 'Workspace archived' });
    } catch (err) {
        next(err);
    }
}

// ── Plans ─────────────────────────────────────────────────────────────────────

export async function getPlans(_req: Request, res: Response, next: NextFunction) {
    try {
        const plans = await prisma.$queryRaw<Row[]>`
            SELECT p.*, COUNT(ws.id)::int AS workspace_count
            FROM plans p
            LEFT JOIN workspace_subscriptions ws ON ws.plan_id = p.id
            GROUP BY p.id ORDER BY p.id
        `;

        if (plans.length === 0) return res.json([]);

        const planIds = plans.map((p: Row) => p.id as string);
        const [links, variations, addonRules] = await Promise.all([
            prisma.$queryRaw<Row[]>`
                SELECT ppl.plan_id, bd.period_key, ppl.payment_link
                FROM plan_period_links ppl
                JOIN billing_discounts bd ON bd.id = ppl.billing_discount_id
                WHERE ppl.plan_id = ANY(${Prisma.raw(`ARRAY[${planIds.map(id => `'${id}'`).join(',')}]`)})
            `,
            prisma.plan_variations.findMany({
                where:   { plan_id: { in: planIds } },
                orderBy: { sort_order: 'asc' },
            }),
            prisma.plan_addon_rules.findMany({
                where:   { plan_id: { in: planIds } },
                include: { addons: true },
            }),
        ]);

        const linkMap: Record<string, Record<string, string>> = {};
        (links as Row[]).forEach(({ plan_id, period_key, payment_link }) => {
            if (!linkMap[plan_id as string]) linkMap[plan_id as string] = {};
            linkMap[plan_id as string][period_key as string] = (payment_link as string) ?? '';
        });

        const variationMap: Record<string, Row[]> = {};
        for (const v of variations) {
            (variationMap[v.plan_id] ??= []).push({ ...v, label: formatPlanVariationLabel(v) });
        }

        const addonRuleMap: Record<string, Row[]> = {};
        for (const r of addonRules) {
            (addonRuleMap[r.plan_id] ??= []).push({ addon_id: r.addon_id, max_units: r.max_units, addon: r.addons });
        }

        res.json(plans.map((p: Row) => ({
            ...p,
            period_links: linkMap[p.id as string] ?? {},
            variations:   variationMap[p.id as string] ?? [],
            addon_rules:  addonRuleMap[p.id as string] ?? [],
        })));
    } catch (err) {
        next(err);
    }
}

export async function createPlan(req: Request, res: Response, next: NextFunction) {
    const {
        name, display_name, features, trial_days, max_team_seats,
        subtitle, is_popular, cta_text, cta_variant, features_header, features_subheader,
        sort_order, show_on_landing, period_links, variations, addon_rules,
    } = req.body as Record<string, unknown>;
    if (!name || !display_name) return res.status(400).json({ message: 'name and display_name are required' });

    try {
        let createdPlan: Row | null = null;
        await prisma.$transaction(async (tx) => {
            createdPlan = await tx.plans.create({
                data: {
                    id:                  createId(),
                    name:                (name as string).trim(),
                    display_name:        (display_name as string).trim(),
                    features:            features ? (features as Prisma.InputJsonValue) : ([] as Prisma.InputJsonValue),
                    trial_days:          (trial_days as number | undefined) ?? null,
                    max_team_seats:      (max_team_seats as number | null | undefined) ?? null,
                    subtitle:            (subtitle as string | undefined)?.trim() || null,
                    is_popular:          (is_popular as boolean | undefined) ?? false,
                    cta_text:            (cta_text as string | undefined)?.trim() || 'Get Started',
                    cta_variant:         (cta_variant as string | undefined)?.trim() || 'outline',
                    features_header:     (features_header as string | undefined)?.trim() || "What's included:",
                    features_subheader:  (features_subheader as string | undefined)?.trim() || null,
                    sort_order:          (sort_order as number | undefined) ?? 0,
                    show_on_landing:     (show_on_landing as boolean | undefined) ?? true,
                },
            }) as unknown as Row;
            await upsertPlanVariations(tx, createdPlan!.id as string, variations);
            await upsertPeriodLinks(tx, createdPlan!.id as string, period_links);
            await upsertPlanAddonRules(tx, createdPlan!.id as string, addon_rules);
        });
        res.status(201).json(createdPlan);
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            return res.status(409).json({ message: 'A plan with this name already exists' });
        }
        const httpErr = err as { status?: number; message?: string };
        if (httpErr.status) return res.status(httpErr.status).json({ message: httpErr.message });
        next(err);
    }
}

export async function updatePlan(req: Request, res: Response, next: NextFunction) {
    const {
        display_name, features, is_active, is_default, trial_days, max_team_seats,
        subtitle, is_popular, cta_text, cta_variant, features_header, features_subheader,
        sort_order, show_on_landing, period_links, variations, addon_rules,
    } = req.body as Record<string, unknown>;

    try {
        let updatedPlan: Row | null = null;
        await prisma.$transaction(async (tx) => {
            if (is_default === true) {
                await tx.plans.updateMany({
                    where: { is_default: true, id: { not: req.params.id as string } },
                    data:  { is_default: false },
                });
            }

            updatedPlan = await tx.plans.update({
                where: { id: req.params.id as string },
                data: {
                    display_name:       (display_name as string | undefined)?.trim() ?? undefined,
                    features:           features ? (features as Prisma.InputJsonValue) : undefined,
                    is_active:          is_active  !== undefined ? (is_active  as boolean) : undefined,
                    is_default:         is_default !== undefined ? (is_default as boolean) : undefined,
                    trial_days:         trial_days !== undefined ? ((trial_days as number | null) ?? null) : undefined,
                    max_team_seats:     max_team_seats !== undefined ? ((max_team_seats as number | null) ?? null) : undefined,
                    subtitle:           subtitle          !== undefined ? ((subtitle as string | undefined)?.trim() || null) : undefined,
                    is_popular:         is_popular        !== undefined ? (is_popular  as boolean)    : undefined,
                    cta_text:           cta_text          !== undefined ? ((cta_text as string | undefined)?.trim() || undefined) : undefined,
                    cta_variant:        cta_variant       !== undefined ? ((cta_variant as string | undefined)?.trim() || undefined) : undefined,
                    features_header:    features_header   !== undefined ? ((features_header as string | undefined)?.trim() || undefined) : undefined,
                    features_subheader: features_subheader !== undefined ? ((features_subheader as string | undefined)?.trim() || null) : undefined,
                    sort_order:         sort_order        !== undefined ? (sort_order  as number) : undefined,
                    show_on_landing:    show_on_landing   !== undefined ? (show_on_landing as boolean) : undefined,
                },
            }) as unknown as Row;

            if (variations !== undefined) await upsertPlanVariations(tx, req.params.id as string, variations);
            await upsertPeriodLinks(tx, req.params.id as string, period_links);
            if (addon_rules !== undefined) await upsertPlanAddonRules(tx, req.params.id as string, addon_rules);
        });

        res.json(updatedPlan);
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
            return res.status(404).json({ message: 'Plan not found' });
        }
        const httpErr = err as { status?: number; message?: string };
        if (httpErr.status) return res.status(httpErr.status).json({ message: httpErr.message });
        next(err);
    }
}

export async function deletePlan(req: Request, res: Response, next: NextFunction) {
    try {
        const rows = await prisma.$queryRaw<Row[]>`
            SELECT p.id, p.is_default, COUNT(ws.id) AS workspace_count
            FROM plans p
            LEFT JOIN workspace_subscriptions ws ON ws.plan_id = p.id
            WHERE p.id = ${req.params.id}
            GROUP BY p.id
        `;

        if (!rows.length) return res.status(404).json({ message: 'Plan not found' });
        const plan = rows[0];
        if (plan.is_default) return res.status(409).json({ message: 'Cannot delete the default plan. Set another plan as default first.' });
        if (parseInt(plan.workspace_count as string) > 0) {
            return res.status(409).json({ message: `Cannot delete: ${plan.workspace_count} workspace(s) are on this plan. Reassign them first.` });
        }

        await prisma.plans.delete({ where: { id: req.params.id as string } });
        res.status(204).end();
    } catch (err) {
        next(err);
    }
}

// ── Add-ons ───────────────────────────────────────────────────────────────────

export async function getAddons(_req: Request, res: Response, next: NextFunction) {
    try {
        const addons = await prisma.addons.findMany({ orderBy: { sort_order: 'asc' } });
        res.json(addons);
    } catch (err) {
        next(err);
    }
}

export async function createAddon(req: Request, res: Response, next: NextFunction) {
    const { key, label, dimension, units, price_monthly, currency, payment_link, sort_order } = req.body as Record<string, unknown>;
    if (!key || !label || !dimension || !units) {
        return res.status(400).json({ message: 'key, label, dimension and units are required' });
    }

    try {
        const addon = await prisma.addons.create({
            data: {
                id:            createId(),
                key:           (key as string).trim(),
                label:         (label as string).trim(),
                dimension:     (dimension as string).trim(),
                units:         units as number,
                price_monthly: (price_monthly as number | undefined) ?? 0,
                currency:      (currency as string | undefined)?.trim() || 'LE',
                payment_link:  (payment_link as string | undefined)?.trim() || null,
                sort_order:    (sort_order as number | undefined) ?? 0,
            },
        });
        res.status(201).json(addon);
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            return res.status(409).json({ message: 'An add-on with this key already exists' });
        }
        next(err);
    }
}

export async function updateAddon(req: Request, res: Response, next: NextFunction) {
    const { label, dimension, units, price_monthly, currency, payment_link, is_active, sort_order } = req.body as Record<string, unknown>;
    try {
        const updated = await prisma.addons.update({
            where: { id: req.params.id as string },
            data: {
                label:         (label as string | undefined)?.trim() || undefined,
                dimension:     (dimension as string | undefined)?.trim() || undefined,
                units:         units !== undefined ? (units as number) : undefined,
                price_monthly: price_monthly !== undefined ? (price_monthly as number) : undefined,
                currency:      (currency as string | undefined)?.trim() || undefined,
                payment_link:  payment_link !== undefined ? ((payment_link as string | undefined)?.trim() || null) : undefined,
                is_active:     is_active !== undefined ? (is_active as boolean) : undefined,
                sort_order:    sort_order !== undefined ? (sort_order as number) : undefined,
            },
        });
        res.json(updated);
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
            return res.status(404).json({ message: 'Add-on not found' });
        }
        next(err);
    }
}

export async function deleteAddon(req: Request, res: Response, next: NextFunction) {
    try {
        const purchased = await prisma.workspace_addons.count({ where: { addon_id: req.params.id as string, status: 'active' } });
        if (purchased > 0) {
            return res.status(409).json({ message: `Cannot delete: ${purchased} workspace(s) have this add-on active. Deactivate it instead.` });
        }

        await prisma.addons.delete({ where: { id: req.params.id as string } });
        res.status(204).end();
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
            return res.status(404).json({ message: 'Add-on not found' });
        }
        next(err);
    }
}

// ── Billing Discounts ─────────────────────────────────────────────────────────

export async function getBillingDiscounts(_req: Request, res: Response, next: NextFunction) {
    try {
        const discounts = await prisma.billing_discounts.findMany({ orderBy: { sort_order: 'asc' } });
        res.json(discounts);
    } catch (err) {
        next(err);
    }
}

export async function updateBillingDiscount(req: Request, res: Response, next: NextFunction) {
    const { label, save_label, discount_percent, months, sort_order, is_active } = req.body as Record<string, unknown>;
    try {
        const updated = await prisma.billing_discounts.update({
            where: { id: req.params.id as string },
            data: {
                label:            (label as string | undefined)?.trim() || undefined,
                save_label:       save_label       !== undefined ? ((save_label as string | undefined)?.trim() || null) : undefined,
                discount_percent: discount_percent !== undefined ? (discount_percent as number) : undefined,
                months:           months           !== undefined ? (months as number) : undefined,
                sort_order:       sort_order       !== undefined ? (sort_order as number) : undefined,
                is_active:        is_active        !== undefined ? (is_active as boolean) : undefined,
            },
        });
        res.json(updated);
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
            return res.status(404).json({ message: 'Billing period not found' });
        }
        next(err);
    }
}

// ── Payments ──────────────────────────────────────────────────────────────────

export async function getPaymentStats(_req: Request, res: Response, next: NextFunction) {
    try {
        const rows = await prisma.$queryRaw<Row[]>`
            SELECT
                COUNT(*) FILTER (WHERE fawaterak_status = 'paid')::int    AS total_paid,
                COUNT(*) FILTER (WHERE fawaterak_status = 'pending')::int AS total_pending,
                COUNT(*) FILTER (WHERE fawaterak_status = 'failed')::int  AS total_failed,
                COALESCE(SUM(amount) FILTER (WHERE fawaterak_status = 'paid'), 0) AS total_revenue
            FROM workspace_payments
        `;
        res.json(rows[0]);
    } catch (err) {
        next(err);
    }
}

export async function getPayments(req: Request, res: Response, next: NextFunction) {
    const { page = '1', limit = '25', status = '', search = '' } = req.query as Record<string, string>;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    try {
        const conditions: string[] = ['1=1'];
        const params: unknown[]   = [];

        if (status) {
            params.push(status);
            conditions.push(`wp.fawaterak_status = $${params.length}`);
        }
        if (search) {
            params.push(`%${search}%`);
            conditions.push(`(w.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`);
        }
        const where = conditions.join(' AND ');

        const [rows, countRows] = await Promise.all([
            prisma.$queryRawUnsafe<Row[]>(`
                SELECT
                    wp.id, wp.amount, wp.currency, wp.duration_days, wp.fawaterak_status,
                    wp.fawaterak_invoice_id, wp.created_at, wp.paid_at, wp.notes,
                    wp.plan_id, wp.variation_id, wp.addon_id,
                    w.id AS workspace_id, w.name AS workspace_name, w.slug AS workspace_slug,
                    p.display_name AS plan_display,
                    u.fname AS owner_fname, u.lname AS owner_lname, u.email AS owner_email
                FROM workspace_payments wp
                JOIN workspaces w ON w.id = wp.workspace_id
                JOIN plans p      ON p.id = wp.plan_id
                JOIN users u      ON u.id = w.owner_id
                WHERE ${where}
                ORDER BY wp.created_at DESC
                LIMIT $${params.length + 1} OFFSET $${params.length + 2}
            `, ...params, parseInt(limit), offset),
            prisma.$queryRawUnsafe<Row[]>(`
                SELECT COUNT(*)
                FROM workspace_payments wp
                JOIN workspaces w ON w.id = wp.workspace_id
                JOIN users u      ON u.id = w.owner_id
                WHERE ${where}
            `, ...params),
        ]);

        res.json({
            payments:   rows,
            total:      parseInt((countRows[0] as Row).count as string),
            page:       parseInt(page),
            limit:      parseInt(limit),
            totalPages: Math.ceil(parseInt((countRows[0] as Row).count as string) / parseInt(limit)),
        });
    } catch (err) {
        next(err);
    }
}

export async function markPaymentPaid(req: Request, res: Response, next: NextFunction) {
    try {
        const payment = await prisma.workspace_payments.findFirst({
            where:  { id: req.params.id as string },
            select: { id: true, workspace_id: true, fawaterak_status: true },
        });
        if (!payment) return res.status(404).json({ message: 'Payment not found' });
        if (payment.fawaterak_status === 'paid') return res.status(409).json({ message: 'Already paid' });

        await applyPayment(payment.id, payment.workspace_id);
        res.json({ message: 'Payment marked as paid and subscription activated' });
    } catch (err) {
        next(err);
    }
}

const ALLOWED_STATUSES = ['paid', 'pending', 'failed', 'refunded'];

export async function updatePaymentStatus(req: Request, res: Response, next: NextFunction) {
    const { status } = req.body as { status?: string };
    if (!ALLOWED_STATUSES.includes(status!)) {
        return res.status(400).json({ message: `status must be one of: ${ALLOWED_STATUSES.join(', ')}` });
    }

    try {
        const payment = await prisma.workspace_payments.findFirst({
            where:  { id: req.params.id as string },
            select: { id: true, workspace_id: true, fawaterak_status: true },
        });
        if (!payment) return res.status(404).json({ message: 'Payment not found' });

        if (payment.fawaterak_status === status) return res.json({ message: 'Status unchanged' });

        if (status === 'paid') {
            await applyPayment(payment.id, payment.workspace_id);
        } else {
            await prisma.workspace_payments.update({
                where: { id: payment.id },
                data:  { fawaterak_status: status!, paid_at: null },
            });
        }

        res.json({ message: `Payment status updated to ${status}` });
    } catch (err) {
        next(err);
    }
}

/** Corrects a payment record after the fact (wrong amount typed in, wrong plan picked, a typo
 *  in the notes) — always safe on its own, since it only edits the workspace_payments row
 *  itself, never the workspace's live subscription. `resyncSubscription` is a separate,
 *  explicit opt-in (mirrors the "force" pattern already used for the subscription-override
 *  action): only when checked does this ALSO push the corrected plan/variation/price/expiry
 *  onto workspace_subscriptions, computed from `startDate` (if given, letting the admin
 *  backdate/schedule it — same idea as createManualPayment's startDate) or else the
 *  subscription's own existing starts_at (or now, if it never had one) + the corrected
 *  duration — i.e. "pretend this payment, with its corrected values, is what's currently in
 *  effect." Not offered for add-on payments (payment.addon_id set) — those would need the
 *  billing-cycle-extension math re-run, out of scope here. */
export async function updatePayment(req: Request, res: Response, next: NextFunction) {
    const { amount, currency, durationDays, notes, planId, variationId, resyncSubscription, startDate } = req.body as {
        amount?: number; currency?: string; durationDays?: number; notes?: string;
        planId?: string; variationId?: string | null; resyncSubscription?: boolean; startDate?: string;
    };

    let parsedStartDate: Date | undefined;
    if (startDate) {
        parsedStartDate = new Date(startDate);
        if (isNaN(parsedStartDate.getTime())) return res.status(400).json({ message: 'startDate is not a valid date' });
    }

    try {
        const payment = await prisma.workspace_payments.findFirst({ where: { id: req.params.id as string } });
        if (!payment) return res.status(404).json({ message: 'Payment not found' });

        const data: Prisma.workspace_paymentsUncheckedUpdateInput = {};
        if (amount != null) data.amount = amount;
        if (currency) data.currency = currency.trim();
        if (durationDays != null) data.duration_days = durationDays;
        if (notes !== undefined) data.notes = notes;

        let targetPlanId = payment.plan_id;
        let targetVariationId = payment.variation_id;

        if (planId && !payment.addon_id) {
            const plan = await prisma.plans.findFirst({ where: { id: planId } });
            if (!plan) return res.status(404).json({ message: 'Plan not found' });
            data.plan_id = planId;
            targetPlanId = planId;
        }
        if (variationId !== undefined && !payment.addon_id) {
            if (variationId) {
                const variation = await prisma.plan_variations.findFirst({ where: { id: variationId, plan_id: targetPlanId } });
                if (!variation) return res.status(404).json({ message: 'Plan variation not found' });
                data.variation_id = variationId;
                targetVariationId = variationId;
            } else {
                data.variation_id = null;
                targetVariationId = null;
            }
        }

        const updated = await prisma.workspace_payments.update({ where: { id: payment.id }, data });

        let resynced = false;
        if (resyncSubscription && !updated.addon_id && updated.fawaterak_status === 'paid') {
            const sub = await prisma.workspace_subscriptions.findUnique({ where: { workspace_id: updated.workspace_id } });
            if (sub) {
                const base = parsedStartDate ?? sub.starts_at ?? new Date();
                const newExpiresAt = new Date(base.getTime() + updated.duration_days * 86400000);
                await prisma.workspace_subscriptions.update({
                    where: { workspace_id: updated.workspace_id },
                    data: {
                        plan_id:              targetPlanId,
                        variation_id:         targetVariationId,
                        locked_price_monthly: updated.amount,
                        locked_currency:      updated.currency,
                        starts_at:            base,
                        expires_at:           newExpiresAt,
                    },
                });
                resynced = true;
            }
        }

        res.json({ message: resynced ? 'Payment updated and subscription resynced' : 'Payment updated', resynced });
    } catch (err) {
        next(err);
    }
}

// ── Trial settings ────────────────────────────────────────────────────────────
// Global, admin-controlled — not a per-plan `trial_days` value (decision 10). When enabled,
// new workspaces start on OneForce's trial variation instead of Free (see auth.controller.ts);
// an expiry sweep moves them to Free afterward unless they've upgraded (see trialSweep.ts).

export async function getTrialSettings(_req: Request, res: Response, next: NextFunction) {
    try {
        const settings = await prisma.trial_settings.upsert({
            where:  { id: 'singleton' },
            update: {},
            create: { id: 'singleton' },
        });
        res.json(settings);
    } catch (err) {
        next(err);
    }
}

export async function updateTrialSettings(req: Request, res: Response, next: NextFunction) {
    const { trial_enabled, trial_duration_days } = req.body as { trial_enabled?: boolean; trial_duration_days?: number };
    try {
        const settings = await prisma.trial_settings.upsert({
            where:  { id: 'singleton' },
            update: {
                trial_enabled:       trial_enabled !== undefined ? trial_enabled : undefined,
                trial_duration_days: trial_duration_days !== undefined ? trial_duration_days : undefined,
                updated_at:          new Date(),
            },
            create: {
                id: 'singleton',
                trial_enabled:       trial_enabled ?? false,
                trial_duration_days: trial_duration_days ?? 14,
            },
        });
        res.json(settings);
    } catch (err) {
        next(err);
    }
}
