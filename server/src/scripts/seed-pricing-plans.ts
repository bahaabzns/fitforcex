/**
 * Seeds the Free / OneForce / TeamForce / Enterprise pricing model (founder decisions) into
 * the local database — plans, variations, add-ons, add-on rules, and trial settings.
 *
 * Idempotent / safe to re-run: plans and add-ons are upserted by their unique slug/key;
 * variations are upserted by (plan, max_clients); add-on rules are upserted by
 * (plan, add-on). Nothing is ever force-deleted if it's already in use by a live
 * subscription/payment — those cases are skipped with a warning instead.
 *
 * Usage (from server/):
 *   npx dotenv -e .env -- npx tsx src/scripts/seed-pricing-plans.ts
 */

import { createId } from '@paralleldrive/cuid2';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

const FEATURES_STARTER = [
    'Unlimited workout plans', 'Unlimited nutrition plans', 'Client Portal', 'Mobile App',
    'Exercise database', 'Food database', 'Check-ins', 'Forms', 'Progress tracking',
    'Progress photos', 'Reports & insights', 'In-app chat', 'Branded client experience',
    'AI features', 'All future FitForce features',
];

const FEATURES_TEAM = [
    'Unlimited workout plans', 'Unlimited nutrition plans', 'Client Portal', 'Mobile App',
    'Exercise database', 'Food database', 'Check-ins', 'Forms', 'Progress tracking',
    'Progress photos', 'Reports & insights', 'In-app chat', 'Branded client experience',
    'AI features', 'Team management', 'Role-based permissions', 'Client distribution',
    'Queue management', 'Activity logs', 'Priority support', 'All future FitForce features',
];

const FEATURES_ENTERPRISE = [
    ...FEATURES_TEAM.slice(0, -1),
    'Dedicated account manager', 'Custom integrations', 'Custom automation',
    'White-label mobile app', 'Custom feature development', 'All future FitForce features',
];

type PlanSeed = {
    name: string; display_name: string; subtitle: string;
    max_team_seats: number | null; is_default: boolean; is_popular: boolean;
    show_on_landing: boolean; cta_text: string; sort_order: number;
    features: string[];
    variations: { max_clients: number | null; price_monthly: number | null; is_default: boolean }[];
};

const PLANS: PlanSeed[] = [
    {
        name: 'free', display_name: 'Free', subtitle: 'Try FitForce with up to 3 clients',
        max_team_seats: 1, is_default: true, is_popular: false, show_on_landing: true,
        cta_text: 'Get Started', sort_order: 0, features: FEATURES_STARTER,
        variations: [{ max_clients: 3, price_monthly: 0, is_default: true }],
    },
    {
        name: 'oneforce', display_name: 'OneForce', subtitle: 'Perfect for solo coaches',
        max_team_seats: 1, is_default: false, is_popular: true, show_on_landing: true,
        cta_text: 'Start Free Trial', sort_order: 1, features: FEATURES_STARTER,
        variations: [{ max_clients: 100, price_monthly: 900, is_default: true }],
    },
    {
        name: 'teamforce', display_name: 'TeamForce', subtitle: 'Built for growing coaching businesses',
        max_team_seats: 3, is_default: false, is_popular: false, show_on_landing: true,
        cta_text: 'Upgrade', sort_order: 2, features: FEATURES_TEAM,
        variations: [
            { max_clients: 150, price_monthly: 2000, is_default: true },
            { max_clients: 250, price_monthly: 3000, is_default: false },
            { max_clients: 500, price_monthly: 5000, is_default: false },
            { max_clients: 1000, price_monthly: 7000, is_default: false },
        ],
    },
    {
        name: 'enterprise', display_name: 'Enterprise', subtitle: 'Custom solution for large coaching organizations',
        max_team_seats: null, is_default: false, is_popular: false, show_on_landing: true,
        cta_text: 'Contact Sales', sort_order: 3, features: FEATURES_ENTERPRISE,
        variations: [{ max_clients: null, price_monthly: null, is_default: true }],
    },
];

type AddonSeed = { key: string; label: string; dimension: string; units: number; price_monthly: number };

const ADDONS: AddonSeed[] = [
    { key: 'clients_plus_10', label: '+10 Clients', dimension: 'clients', units: 10, price_monthly: 90 },
    { key: 'clients_plus_50', label: '+50 Clients', dimension: 'clients', units: 50, price_monthly: 400 },
    { key: 'team_member_plus_1', label: '+1 Team Member', dimension: 'team_seats', units: 1, price_monthly: 200 },
];

// OneForce's client add-on cap is explicitly "admin-configurable" rather than a fixed number
// — seeded at 3 (matching the founder decisions' own worked example) and adjustable anytime
// from Admin → Plans → edit OneForce → Add-ons.
const ADDON_RULES: { plan: string; addon: string; max_units: number | null }[] = [
    { plan: 'oneforce',   addon: 'clients_plus_10',    max_units: 3 },
    { plan: 'teamforce',  addon: 'clients_plus_10',    max_units: null },
    { plan: 'teamforce',  addon: 'clients_plus_50',    max_units: null },
    { plan: 'teamforce',  addon: 'team_member_plus_1', max_units: null },
];

const TRIAL_SETTINGS = { trial_enabled: true, trial_duration_days: 14 };

async function seedPlans() {
    const planIdByName: Record<string, string> = {};

    for (const [index, def] of PLANS.entries()) {
        const existing = await prisma.plans.findUnique({ where: { name: def.name } });

        const data = {
            display_name:    def.display_name,
            subtitle:        def.subtitle,
            max_team_seats:  def.max_team_seats,
            is_default:      def.is_default,
            is_popular:      def.is_popular,
            show_on_landing: def.show_on_landing,
            cta_text:        def.cta_text,
            sort_order:      def.sort_order,
            features:        def.features as Prisma.InputJsonValue,
            is_active:       true,
        };

        if (def.is_default) {
            // Only one plan may be is_default — clear any other before setting this one.
            await prisma.plans.updateMany({ where: { is_default: true, name: { not: def.name } }, data: { is_default: false } });
        }

        const plan = existing
            ? await prisma.plans.update({ where: { id: existing.id }, data })
            : await prisma.plans.create({ data: { id: createId(), name: def.name, ...data } });

        planIdByName[def.name] = plan.id;
        console.info(`[Seed] plan "${def.name}" ${existing ? 'updated' : 'created'} (sort_order ${index})`);

        await seedVariationsForPlan(plan.id, def.name, def.variations);
    }

    return planIdByName;
}

async function seedVariationsForPlan(
    planId: string, planName: string,
    variations: PlanSeed['variations'],
) {
    const existing = await prisma.plan_variations.findMany({ where: { plan_id: planId } });
    const keptIds = new Set<string>();

    for (const [index, v] of variations.entries()) {
        const match = existing.find(e => e.max_clients === v.max_clients);
        if (match) {
            await prisma.plan_variations.update({
                where: { id: match.id },
                data:  { price_monthly: v.price_monthly, is_default: v.is_default, is_active: true, sort_order: index },
            });
            keptIds.add(match.id);
        } else {
            const created = await prisma.plan_variations.create({
                data: {
                    id: createId(), plan_id: planId,
                    max_clients: v.max_clients, price_monthly: v.price_monthly,
                    currency: 'LE', is_default: v.is_default, is_active: true, sort_order: index,
                },
            });
            keptIds.add(created.id);
        }
    }

    const toRemove = existing.filter(e => !keptIds.has(e.id));
    for (const variation of toRemove) {
        const [subsInUse, paymentsInUse] = await Promise.all([
            prisma.workspace_subscriptions.count({ where: { variation_id: variation.id } }),
            prisma.workspace_payments.count({ where: { variation_id: variation.id } }),
        ]);
        if (subsInUse > 0 || paymentsInUse > 0) {
            console.warn(`[Seed] skipping removal of an old "${planName}" variation (id ${variation.id}) — still referenced by a subscription/payment`);
            continue;
        }
        await prisma.plan_variations.delete({ where: { id: variation.id } });
    }

    console.info(`[Seed]   ${variations.length} variation(s) for "${planName}"`);
}

async function seedAddons() {
    const addonIdByKey: Record<string, string> = {};

    for (const def of ADDONS) {
        const addon = await prisma.addons.upsert({
            where:  { key: def.key },
            update: { label: def.label, dimension: def.dimension, units: def.units, price_monthly: def.price_monthly, currency: 'LE', is_active: true },
            create: { id: createId(), key: def.key, label: def.label, dimension: def.dimension, units: def.units, price_monthly: def.price_monthly, currency: 'LE', is_active: true },
        });
        addonIdByKey[def.key] = addon.id;
        console.info(`[Seed] add-on "${def.key}" upserted`);
    }

    return addonIdByKey;
}

async function seedAddonRules(planIdByName: Record<string, string>, addonIdByKey: Record<string, string>) {
    for (const rule of ADDON_RULES) {
        const planId = planIdByName[rule.plan];
        const addonId = addonIdByKey[rule.addon];
        if (!planId || !addonId) {
            console.warn(`[Seed] skipping add-on rule "${rule.plan}" × "${rule.addon}" — plan or add-on missing`);
            continue;
        }
        await prisma.plan_addon_rules.upsert({
            where:  { plan_id_addon_id: { plan_id: planId, addon_id: addonId } },
            update: { max_units: rule.max_units },
            create: { id: createId(), plan_id: planId, addon_id: addonId, max_units: rule.max_units },
        });
        console.info(`[Seed] add-on rule "${rule.plan}" may buy "${rule.addon}" (max ${rule.max_units ?? 'unlimited'})`);
    }
}

async function seedTrialSettings() {
    await prisma.trial_settings.upsert({
        where:  { id: 'singleton' },
        update: TRIAL_SETTINGS,
        create: { id: 'singleton', ...TRIAL_SETTINGS },
    });
    console.info(`[Seed] trial settings: enabled=${TRIAL_SETTINGS.trial_enabled}, duration=${TRIAL_SETTINGS.trial_duration_days}d`);
}

async function main() {
    const planIdByName = await seedPlans();
    const addonIdByKey = await seedAddons();
    await seedAddonRules(planIdByName, addonIdByKey);
    await seedTrialSettings();
    console.info('[Seed] done.');
}

main()
    .catch((err) => { console.error('[Seed] Fatal error:', err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
