import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';

export async function getPlans(_req: Request, res: Response, next: NextFunction) {
    try {
        const plans = await prisma.plans.findMany({
            where: { is_active: true, show_on_landing: true },
            select: {
                id: true, name: true, display_name: true, subtitle: true,
                price_monthly: true, price_per_seat: true,
                min_seat_count: true, max_seat_count: true,
                currency: true, is_popular: true,
                cta_text: true, cta_variant: true, payment_link: true,
                features_header: true, features_subheader: true,
                has_team_counter: true, features: true,
            },
            orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
        });

        if (plans.length === 0) return res.json([]);

        const planIds = plans.map(p => p.id);
        const links = await prisma.plan_period_links.findMany({
            where: { plan_id: { in: planIds }, payment_link: { not: null } },
            select: {
                plan_id: true,
                payment_link: true,
                billing_discounts: { select: { period_key: true } },
            },
        });

        const linkMap: Record<string, Record<string, string>> = {};
        for (const link of links) {
            const { plan_id, payment_link, billing_discounts: bd } = link;
            if (!linkMap[plan_id]) linkMap[plan_id] = {};
            linkMap[plan_id][bd.period_key] = payment_link!;
        }

        res.json(plans.map(p => ({ ...p, period_links: linkMap[p.id] ?? {} })));
    } catch (err) {
        next(err);
    }
}

export async function getBillingDiscounts(_req: Request, res: Response, next: NextFunction) {
    try {
        const discounts = await prisma.billing_discounts.findMany({
            where: { is_active: true },
            select: {
                id: true, period_key: true, label: true,
                save_label: true, discount_percent: true, months: true,
            },
            orderBy: { sort_order: 'asc' },
        });
        res.json(discounts);
    } catch (err) {
        next(err);
    }
}
