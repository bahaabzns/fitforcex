import { Request, Response, NextFunction } from 'express';
import { prisma } from '../../lib/prisma';
import { formatPlanVariationLabel } from '../../lib/planVariationLabel';

export async function getPlans(_req: Request, res: Response, next: NextFunction) {
    try {
        const plans = await prisma.plans.findMany({
            where: { is_active: true, show_on_landing: true },
            select: {
                id: true, name: true, display_name: true, display_name_ar: true,
                subtitle: true, subtitle_ar: true,
                is_popular: true, max_team_seats: true,
                cta_text: true, cta_text_ar: true, cta_variant: true,
                features_header: true, features_header_ar: true,
                features_subheader: true, features_subheader_ar: true,
                features: true, features_ar: true, trial_days: true,
            },
            orderBy: [{ sort_order: 'asc' }, { id: 'asc' }],
        });

        if (plans.length === 0) return res.json([]);

        const planIds = plans.map(p => p.id);
        const [links, variations] = await Promise.all([
            prisma.plan_period_links.findMany({
                where: { plan_id: { in: planIds }, payment_link: { not: null } },
                select: {
                    plan_id: true,
                    payment_link: true,
                    billing_discounts: { select: { period_key: true } },
                },
            }),
            prisma.plan_variations.findMany({
                where:  { plan_id: { in: planIds }, is_active: true },
                select: {
                    id: true, plan_id: true,
                    max_clients: true, max_team_seats: true,
                    price_monthly: true, currency: true,
                    is_default: true,
                },
                orderBy: { sort_order: 'asc' },
            }),
        ]);

        const linkMap: Record<string, Record<string, string>> = {};
        for (const link of links) {
            const { plan_id, payment_link, billing_discounts: bd } = link;
            if (!linkMap[plan_id]) linkMap[plan_id] = {};
            linkMap[plan_id][bd.period_key] = payment_link!;
        }

        const variationMap: Record<string, typeof variations> = {};
        for (const v of variations) {
            (variationMap[v.plan_id] ??= []).push(v);
        }

        res.json(plans.map(p => ({
            ...p,
            period_links: linkMap[p.id] ?? {},
            variations: (variationMap[p.id] ?? []).map(v => ({
                ...v,
                label_en: formatPlanVariationLabel(v, 'en'),
                label_ar: formatPlanVariationLabel(v, 'ar'),
            })),
        })));
    } catch (err) {
        next(err);
    }
}

export async function getBillingDiscounts(_req: Request, res: Response, next: NextFunction) {
    try {
        const discounts = await prisma.billing_discounts.findMany({
            where: { is_active: true },
            select: {
                id: true, period_key: true, label: true, label_ar: true,
                save_label: true, save_label_ar: true, discount_percent: true, months: true,
            },
            orderBy: { sort_order: 'asc' },
        });
        res.json(discounts);
    } catch (err) {
        next(err);
    }
}
