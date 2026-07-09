import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcrypt';
import { Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { applyPayment } from '../billing/index';
import { env } from '../../config/env';
import { prisma } from '../../lib/prisma';
import { normalizeEmail } from '../../utils/email';

type Row = Record<string, unknown>;

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

export async function getWorkspaces(req: Request, res: Response, next: NextFunction) {
    const { search = '', plan = '', archived = 'false', page = 1, limit = 20 } = req.query as Record<string, string>;
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

        const [rows, countRows] = await Promise.all([
            prisma.$queryRawUnsafe<Row[]>(`
                SELECT w.id, w.slug, w.name, w.archived_at, w.created_at,
                       u.fname AS owner_fname, u.lname AS owner_lname, u.email AS owner_email,
                       COALESCE(p.name, 'none') AS plan, COALESCE(p.display_name, 'No Plan') AS plan_display,
                       COUNT(DISTINCT wm.id)::int AS member_count, COUNT(DISTINCT c.id)::int AS client_count
                FROM workspaces w
                JOIN users u ON u.id = w.owner_id
                LEFT JOIN workspace_subscriptions ws ON ws.workspace_id = w.id
                LEFT JOIN plans p ON p.id = ws.plan_id
                LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.is_active = TRUE
                LEFT JOIN clients c ON c.workspace_id = w.id
                WHERE ${where}
                GROUP BY w.id, u.id, p.id
                ORDER BY w.created_at DESC
                LIMIT $${params.length + 1} OFFSET $${params.length + 2}
            `, ...params, parseInt(limit as string), offset),
            prisma.$queryRawUnsafe<Row[]>(`
                SELECT COUNT(DISTINCT w.id)
                FROM workspaces w
                LEFT JOIN workspace_subscriptions ws ON ws.workspace_id = w.id
                LEFT JOIN plans p ON p.id = ws.plan_id
                WHERE ${where}
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
        const [detailRows, members] = await Promise.all([
            prisma.$queryRaw<Row[]>`
                SELECT w.id, w.slug, w.name, w.archived_at, w.created_at, w.slug_customized,
                       u.id AS owner_id, u.fname AS owner_fname, u.lname AS owner_lname, u.email AS owner_email,
                       p.id AS plan_id, COALESCE(p.name, 'none') AS plan, COALESCE(p.display_name, 'No Plan') AS plan_display,
                       ws.status AS subscription_status, ws.starts_at, ws.expires_at,
                       COUNT(DISTINCT wm.id)::int AS member_count, COUNT(DISTINCT c.id)::int AS client_count
                FROM workspaces w
                JOIN users u ON u.id = w.owner_id
                LEFT JOIN workspace_subscriptions ws ON ws.workspace_id = w.id
                LEFT JOIN plans p ON p.id = ws.plan_id
                LEFT JOIN workspace_members wm ON wm.workspace_id = w.id AND wm.is_active = TRUE
                LEFT JOIN clients c ON c.workspace_id = w.id
                WHERE w.id = ${req.params.id}
                GROUP BY w.id, u.id, p.id, ws.id
            `,
            prisma.$queryRaw<Row[]>`
                SELECT wm.id, wm.role, wm.is_active, wm.joined_at,
                       u.id AS user_id, u.fname, u.lname, u.email
                FROM workspace_members wm
                JOIN users u ON u.id = wm.user_id
                WHERE wm.workspace_id = ${req.params.id}
                ORDER BY wm.joined_at
            `,
        ]);

        if (!detailRows.length) return res.status(404).json({ message: 'Workspace not found' });
        res.json({ ...detailRows[0], members });
    } catch (err) {
        next(err);
    }
}

export async function updateWorkspaceSubscription(req: Request, res: Response, next: NextFunction) {
    const { planId, notes } = req.body as { planId?: string; notes?: string };
    if (!planId) return res.status(400).json({ message: 'planId is required' });

    try {
        const plan = await prisma.plans.findFirst({ where: { id: planId }, select: { id: true } });
        if (!plan) return res.status(404).json({ message: 'Plan not found' });

        await prisma.workspace_subscriptions.updateMany({
            where: { workspace_id: req.params.id as string },
            data:  { plan_id: planId, notes: notes || null, status: 'active' },
        });

        res.json({ message: 'Subscription updated' });
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
        const links   = await prisma.$queryRaw<Row[]>`
            SELECT ppl.plan_id, bd.period_key, ppl.payment_link
            FROM plan_period_links ppl
            JOIN billing_discounts bd ON bd.id = ppl.billing_discount_id
            WHERE ppl.plan_id = ANY(${Prisma.raw(`ARRAY[${planIds.map(id => `'${id}'`).join(',')}]`)})
        `;

        const linkMap: Record<string, Record<string, string>> = {};
        (links as Row[]).forEach(({ plan_id, period_key, payment_link }) => {
            if (!linkMap[plan_id as string]) linkMap[plan_id as string] = {};
            linkMap[plan_id as string][period_key as string] = (payment_link as string) ?? '';
        });

        res.json(plans.map((p: Row) => ({ ...p, period_links: linkMap[p.id as string] ?? {} })));
    } catch (err) {
        next(err);
    }
}

export async function createPlan(req: Request, res: Response, next: NextFunction) {
    const {
        name, display_name, max_team_seats, max_workspaces, price_monthly, features, trial_days, payment_link,
        subtitle, is_popular, cta_text, cta_variant, features_header, features_subheader,
        has_team_counter, sort_order, currency, show_on_landing,
        price_per_seat, min_seat_count, max_seat_count, period_links, max_clients,
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
                    max_team_seats:      (max_team_seats as number | undefined) ?? null,
                    max_workspaces:      (max_workspaces as number | undefined) ?? null,
                    price_monthly:       (price_monthly as number | undefined) ?? null,
                    features:            features ? (features as Prisma.InputJsonValue) : ([] as Prisma.InputJsonValue),
                    trial_days:          (trial_days as number | undefined) ?? null,
                    payment_link:        (payment_link as string | undefined)?.trim() || null,
                    subtitle:            (subtitle as string | undefined)?.trim() || null,
                    is_popular:          (is_popular as boolean | undefined) ?? false,
                    cta_text:            (cta_text as string | undefined)?.trim() || 'Get Started',
                    cta_variant:         (cta_variant as string | undefined)?.trim() || 'outline',
                    features_header:     (features_header as string | undefined)?.trim() || "What's included:",
                    features_subheader:  (features_subheader as string | undefined)?.trim() || null,
                    has_team_counter:    (has_team_counter as boolean | undefined) ?? false,
                    sort_order:          (sort_order as number | undefined) ?? 0,
                    currency:            (currency as string | undefined)?.trim() || 'LE',
                    show_on_landing:     (show_on_landing as boolean | undefined) ?? true,
                    price_per_seat:      (price_per_seat as number | undefined) ?? null,
                    min_seat_count:      (min_seat_count as number | undefined) ?? 1,
                    max_seat_count:      (max_seat_count as number | undefined) ?? 20,
                    max_clients:         (max_clients as number | undefined) ?? null,
                },
            }) as unknown as Row;
            await upsertPeriodLinks(tx, createdPlan!.id as string, period_links);
        });
        res.status(201).json(createdPlan);
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            return res.status(409).json({ message: 'A plan with this name already exists' });
        }
        next(err);
    }
}

export async function updatePlan(req: Request, res: Response, next: NextFunction) {
    const {
        display_name, max_team_seats, max_workspaces, price_monthly, features, is_active, is_default, trial_days, payment_link,
        subtitle, is_popular, cta_text, cta_variant, features_header, features_subheader,
        has_team_counter, sort_order, currency, show_on_landing,
        price_per_seat, min_seat_count, max_seat_count, period_links, max_clients,
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
                    max_team_seats:     max_team_seats !== undefined ? ((max_team_seats as number | null) ?? null) : undefined,
                    max_workspaces:     max_workspaces !== undefined ? ((max_workspaces as number | null) ?? null) : undefined,
                    price_monthly:      price_monthly  !== undefined ? ((price_monthly  as number | null) ?? null) : undefined,
                    features:           features ? (features as Prisma.InputJsonValue) : undefined,
                    is_active:          is_active  !== undefined ? (is_active  as boolean) : undefined,
                    is_default:         is_default !== undefined ? (is_default as boolean) : undefined,
                    trial_days:         trial_days !== undefined ? ((trial_days as number | null) ?? null) : undefined,
                    payment_link:       payment_link      !== undefined ? ((payment_link as string | undefined)?.trim() || null) : undefined,
                    subtitle:           subtitle          !== undefined ? ((subtitle as string | undefined)?.trim() || null) : undefined,
                    is_popular:         is_popular        !== undefined ? (is_popular  as boolean)    : undefined,
                    cta_text:           cta_text          !== undefined ? ((cta_text as string | undefined)?.trim() || undefined) : undefined,
                    cta_variant:        cta_variant       !== undefined ? ((cta_variant as string | undefined)?.trim() || undefined) : undefined,
                    features_header:    features_header   !== undefined ? ((features_header as string | undefined)?.trim() || undefined) : undefined,
                    features_subheader: features_subheader !== undefined ? ((features_subheader as string | undefined)?.trim() || null) : undefined,
                    has_team_counter:   has_team_counter  !== undefined ? (has_team_counter as boolean) : undefined,
                    sort_order:         sort_order        !== undefined ? (sort_order  as number) : undefined,
                    currency:           currency          !== undefined ? ((currency as string | undefined)?.trim() || undefined) : undefined,
                    show_on_landing:    show_on_landing   !== undefined ? (show_on_landing as boolean) : undefined,
                    price_per_seat:     price_per_seat    !== undefined ? ((price_per_seat as number | null) ?? null) : undefined,
                    min_seat_count:     min_seat_count    !== undefined ? (min_seat_count as number) : undefined,
                    max_seat_count:     max_seat_count    !== undefined ? (max_seat_count as number) : undefined,
                    max_clients:        max_clients       !== undefined ? ((max_clients as number | null) ?? null) : undefined,
                },
            }) as unknown as Row;

            await upsertPeriodLinks(tx, req.params.id as string, period_links);
        });

        res.json(updatedPlan);
    } catch (err) {
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
            return res.status(404).json({ message: 'Plan not found' });
        }
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
                    wp.fawaterak_invoice_id, wp.created_at, wp.paid_at,
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
