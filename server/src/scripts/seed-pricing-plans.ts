/**
 * Seeds the Free / New Coach (oneforce) / Ambitious Coach / Pro Coach (teamforce) / Enterprise
 * pricing model into the local database — plans, variations, add-ons, add-on rules, and trial settings.
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

type VariationSeed = {
    max_clients: number | null; max_team_seats: number | null;
    price_monthly: number | null; is_default: boolean;
};

const FEATURES_STARTER_AR = [
    'خطط تمرين غير محدودة', 'خطط تغذية غير محدودة', 'بوابة العميل', 'تطبيق الجوال',
    'قاعدة بيانات التمارين', 'قاعدة بيانات الأطعمة', 'المتابعات الدورية', 'النماذج', 'تتبع التقدم',
    'صور التقدم', 'التقارير والتحليلات', 'المحادثة داخل التطبيق', 'تجربة عميل بعلامتك التجارية',
    'ميزات الذكاء الاصطناعي', 'كل ميزات FitForce المستقبلية',
];

type PlanSeed = {
    name: string; display_name: string; subtitle: string;
    // Arabic landing copy; omitted fields keep whatever an admin already set.
    ar?: { display_name: string; subtitle: string; cta_text: string; features?: string[] };
    max_team_seats: number | null; is_default: boolean; is_popular: boolean;
    show_on_landing: boolean; cta_text: string; sort_order: number;
    features: string[];
    variations: VariationSeed[];
};

const PLANS: PlanSeed[] = [
    {
        name: 'free', display_name: 'Free', subtitle: 'Try FitForce with up to 3 clients',
        max_team_seats: 1, is_default: true, is_popular: false, show_on_landing: false,
        cta_text: 'Get Started', sort_order: 0, features: FEATURES_STARTER,
        variations: [{ max_clients: 3, max_team_seats: 1, price_monthly: 0, is_default: true }],
    },
    {
        name: 'oneforce', display_name: 'New Coach', subtitle: 'For coaches just starting to grow',
        ar: { display_name: 'مدرب جديد', subtitle: 'للمدرب اللي لسه بيبدأ يكبّر شغله', cta_text: 'اشترك الآن' },
        max_team_seats: 1, is_default: false, is_popular: false, show_on_landing: true,
        cta_text: 'Subscribe Now', sort_order: 1, features: FEATURES_STARTER,
        variations: [{ max_clients: 30, max_team_seats: 1, price_monthly: 499, is_default: true }],
    },
    {
        name: 'ambitious', display_name: 'Ambitious Coach', subtitle: 'For coaches with a growing roster',
        ar: { display_name: 'مدرب طموح', subtitle: 'للمدرب اللي عدد عملائه بيزيد', cta_text: 'اشترك الآن', features: FEATURES_STARTER_AR },
        max_team_seats: 1, is_default: false, is_popular: true, show_on_landing: true,
        cta_text: 'Subscribe Now', sort_order: 2, features: FEATURES_STARTER,
        variations: [{ max_clients: 100, max_team_seats: 1, price_monthly: 999, is_default: true }],
    },
    {
        // Team seats scale with client tier (founder decision revision) — each variation
        // carries its own seat count instead of a flat per-plan number.
        name: 'teamforce', display_name: 'Pro Coach', subtitle: 'Built for growing coaching businesses',
        ar: { display_name: 'مدرب محترف', subtitle: 'لشغل تدريب كبير وفريق معاه', cta_text: 'ابدأ الآن' },
        max_team_seats: 3, is_default: false, is_popular: false, show_on_landing: true,
        cta_text: 'Upgrade', sort_order: 3, features: FEATURES_TEAM,
        variations: [
            { max_clients: 150,   max_team_seats: 3,    price_monthly: 1999,  is_default: true },
            { max_clients: 250,   max_team_seats: 3,    price_monthly: 2999,  is_default: false },
            { max_clients: 500,   max_team_seats: 3,    price_monthly: 4999,  is_default: false },
            { max_clients: 1000,  max_team_seats: 3,    price_monthly: 6999,  is_default: false },
            { max_clients: 2000,  max_team_seats: 10,   price_monthly: 9999,  is_default: false },
            { max_clients: 5000,  max_team_seats: 20,   price_monthly: 14999, is_default: false },
            { max_clients: 10000, max_team_seats: 30,   price_monthly: 17999, is_default: false },
            { max_clients: null,  max_team_seats: null, price_monthly: 19999, is_default: false },
        ],
    },
    {
        name: 'enterprise', display_name: 'Enterprise', subtitle: 'Custom solution for large coaching organizations',
        max_team_seats: null, is_default: false, is_popular: false, show_on_landing: false,
        cta_text: 'Contact Sales', sort_order: 4, features: FEATURES_ENTERPRISE,
        variations: [{ max_clients: null, max_team_seats: null, price_monthly: null, is_default: true }],
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
    { plan: 'ambitious',  addon: 'clients_plus_10',    max_units: 3 },
    { plan: 'teamforce',  addon: 'clients_plus_10',    max_units: null },
    { plan: 'teamforce',  addon: 'clients_plus_50',    max_units: null },
    { plan: 'teamforce',  addon: 'team_member_plus_1', max_units: null },
];

// No free trials — every paid plan's CTA leads straight to checkout. Trial stays admin-
// toggleable (the settings row/UI still exist) in case that changes later.
const TRIAL_SETTINGS = { trial_enabled: false, trial_duration_days: 14 };

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
            ...(def.ar ? {
                display_name_ar: def.ar.display_name,
                subtitle_ar:     def.ar.subtitle,
                cta_text_ar:     def.ar.cta_text,
                ...(def.ar.features ? { features_ar: def.ar.features as Prisma.InputJsonValue } : {}),
            } : {}),
        };

        if (def.is_default) {
            // Only one plan may be is_default — clear any other before setting this one.
            await prisma.plans.updateMany({ where: { is_default: true, name: { not: def.name } }, data: { is_default: false } });
        }

        const plan = existing
            ? await prisma.plans.update({ where: { id: existing.id }, data })
            : await prisma.plans.create({ data: { id: createId(), name: def.name, capabilities: { custom_branding: true }, ...data } });

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
    const existing = await prisma.plan_variations.findMany({ where: { plan_id: planId }, orderBy: { sort_order: 'asc' } });
    const keptIds = new Set<string>();

    // (plan_id, sort_order) is unique, so park every existing row above the current
    // maximum first; the upserts below then claim their final slots without colliding.
    const parkingBase = existing.reduce((max, row) => Math.max(max, row.sort_order), 0) + 1;
    for (const [index, row] of existing.entries()) {
        await prisma.plan_variations.update({ where: { id: row.id }, data: { sort_order: parkingBase + index } });
    }

    for (const [index, v] of variations.entries()) {
        const match = existing.find(e => e.max_clients === v.max_clients && !keptIds.has(e.id));
        if (match) {
            await prisma.plan_variations.update({
                where: { id: match.id },
                data:  { max_team_seats: v.max_team_seats, price_monthly: v.price_monthly, currency: 'EGP', is_default: v.is_default, is_active: true, sort_order: index },
            });
            keptIds.add(match.id);
        } else {
            const created = await prisma.plan_variations.create({
                data: {
                    id: createId(), plan_id: planId,
                    max_clients: v.max_clients, max_team_seats: v.max_team_seats, price_monthly: v.price_monthly,
                    currency: 'EGP', is_default: v.is_default, is_active: true, sort_order: index,
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
            // Keep the row for existing subscribers, but stop offering it to new buyers.
            await prisma.plan_variations.update({ where: { id: variation.id }, data: { is_active: false } });
            console.warn(`[Seed] kept an old "${planName}" variation (id ${variation.id}) as inactive — still referenced by a subscription/payment`);
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

// Billing periods shown on the landing page and checkout: the longer the commitment, the bigger the discount.
const BILLING_PERIODS = [
    { period_key: 'monthly',    label: 'Monthly',   label_ar: 'شهري',        save_label: null,        save_label_ar: null,         discount_percent: 0,  months: 1,  sort_order: 0 },
    { period_key: 'quarterly',  label: '3 months',  label_ar: '3 شهور',      save_label: 'Save 5%',   save_label_ar: 'وفّر 5%',    discount_percent: 5,  months: 3,  sort_order: 1 },
    { period_key: 'semiannual', label: '6 months',  label_ar: '6 شهور',      save_label: 'Save 10%',  save_label_ar: 'وفّر 10%',   discount_percent: 10, months: 6,  sort_order: 2 },
    { period_key: 'annual',     label: 'Annual',    label_ar: 'سنوي',        save_label: 'Save 20%',  save_label_ar: 'وفّر 20%',   discount_percent: 20, months: 12, sort_order: 3 },
];

async function seedBillingPeriods() {
    for (const period of BILLING_PERIODS) {
        await prisma.billing_discounts.upsert({
            where:  { period_key: period.period_key },
            update: { ...period, is_active: true },
            create: { id: createId(), ...period, is_active: true },
        });
        console.info(`[Seed] billing period "${period.period_key}": ${period.months} month(s), ${period.discount_percent}% off`);
    }
}

async function main() {
    await seedBillingPeriods();
    const planIdByName = await seedPlans();
    const addonIdByKey = await seedAddons();
    await seedAddonRules(planIdByName, addonIdByKey);
    await seedTrialSettings();
    console.info('[Seed] done.');
}

main()
    .catch((err) => { console.error('[Seed] Fatal error:', err); process.exitCode = 1; })
    .finally(() => prisma.$disconnect());
