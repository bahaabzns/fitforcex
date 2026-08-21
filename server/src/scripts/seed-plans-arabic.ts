/** Seeds Arabic translations for the pricing section (plans, their features, billing periods,
 *  and add-ons) into this workspace's local dev DB. Keyed by each row's stable internal
 *  identifier (plans.name, addons.key, billing_discounts.period_key) — not by the current
 *  English display text — so it's safe to re-run after an admin edits the English copy.
 *
 *  Idempotent and non-destructive: only fills an `_ar` field when it's currently null, so it
 *  never clobbers a translation an admin already typed into the admin panel.
 *
 *  Run: npx ts-node -r tsconfig-paths/register src/scripts/seed-plans-arabic.ts
 */
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';

// English feature string -> Arabic. Applied positionally (same order the plan's `features`
// array already has) so a feature this dictionary doesn't recognize is simply left
// untranslated in features_ar rather than failing the whole run.
const FEATURE_AR: Record<string, string> = {
    'Unlimited workout plans':        'خطط تمرين غير محدودة',
    'Unlimited nutrition plans':      'خطط تغذية غير محدودة',
    'Client Portal':                  'بوابة العميل',
    'Mobile App':                     'تطبيق الجوال',
    'Exercise database':              'قاعدة بيانات التمارين',
    'Food database':                  'قاعدة بيانات الأطعمة',
    'Check-ins':                      'المتابعات الدورية',
    'Forms':                          'النماذج',
    'Progress tracking':              'تتبع التقدم',
    'Progress photos':                'صور التقدم',
    'Reports & insights':             'التقارير والتحليلات',
    'In-app chat':                    'المحادثة داخل التطبيق',
    'Branded client experience':      'تجربة عميل بعلامتك التجارية',
    'AI features':                    'ميزات الذكاء الاصطناعي',
    'All future FitForce features':   'كل ميزات FitForce المستقبلية',
    'Team management':                'إدارة الفريق',
    'Role-based permissions':         'صلاحيات حسب الدور',
    'Client distribution':            'توزيع العملاء',
    'Queue management':               'إدارة قائمة الانتظار',
    'Activity logs':                  'سجلات النشاط',
    'Priority support':               'دعم ذو أولوية',
    'Dedicated account manager':      'مدير حساب مخصص',
    'Custom integrations':            'تكاملات مخصصة',
    'Custom automation':              'أتمتة مخصصة',
    'White-label mobile app':         'تطبيق جوال بعلامة تجارية خاصة',
    'Custom feature development':     'تطوير ميزات مخصصة',
};

const PLAN_AR: Record<string, { display_name_ar: string; subtitle_ar: string; cta_text_ar: string }> = {
    free: {
        display_name_ar: 'مجانية',
        subtitle_ar:     'جرّب FitForce حتى 3 متدربين',
        cta_text_ar:     'ابدأ الآن',
    },
    oneforce: {
        display_name_ar: 'ون فورس',
        subtitle_ar:     'مثالية للمدربين الأفراد',
        cta_text_ar:     'ابدأ تجربتك المجانية',
    },
    teamforce: {
        display_name_ar: 'تيم فورس',
        subtitle_ar:     'مصممة لأعمال التدريب المتنامية',
        cta_text_ar:     'ترقية',
    },
    enterprise: {
        display_name_ar: 'إنتربرايز',
        subtitle_ar:     'حل مخصص لمؤسسات التدريب الكبرى',
        cta_text_ar:     'تواصل مع المبيعات',
    },
};

const FEATURES_HEADER_AR = 'ما تحصل عليه:';

const ADDON_AR: Record<string, string> = {
    clients_plus_10:    '+10 عملاء',
    clients_plus_50:    '+50 عميل',
    team_member_plus_1: '+1 عضو فريق',
};

const DISCOUNT_AR: Record<string, { label_ar: string; save_label_ar: string | null }> = {
    monthly:   { label_ar: 'شهري',   save_label_ar: null },
    quarterly: { label_ar: 'ربع سنوي', save_label_ar: 'وفّر 10%' },
    yearly:    { label_ar: 'سنوي',    save_label_ar: 'وفّر 20%' },
    annual:    { label_ar: 'سنوي',    save_label_ar: 'وفّر 20%' },
};

async function seedPlans() {
    const plans = await prisma.plans.findMany();
    for (const plan of plans) {
        const ar = PLAN_AR[plan.name];
        if (!ar) {
            console.warn(`[seed-plans-arabic] No Arabic copy defined for plan "${plan.name}" — skipped`);
            continue;
        }

        const features = Array.isArray(plan.features) ? (plan.features as unknown[]) : [];
        const featuresAr = features.map((f) => (typeof f === 'string' ? (FEATURE_AR[f] ?? f) : f));

        await prisma.plans.update({
            where: { id: plan.id },
            data: {
                display_name_ar:    plan.display_name_ar    ?? ar.display_name_ar,
                subtitle_ar:        plan.subtitle_ar         ?? ar.subtitle_ar,
                cta_text_ar:        plan.cta_text_ar         ?? ar.cta_text_ar,
                features_header_ar: plan.features_header_ar  ?? FEATURES_HEADER_AR,
                features_ar:        plan.features_ar         ?? (featuresAr as Prisma.InputJsonValue),
            },
        });
        console.log(`[seed-plans-arabic] plans.${plan.name} ✓`);
    }
}

async function seedAddons() {
    const addons = await prisma.addons.findMany();
    for (const addon of addons) {
        const labelAr = ADDON_AR[addon.key];
        if (!labelAr) {
            console.warn(`[seed-plans-arabic] No Arabic copy defined for addon "${addon.key}" — skipped`);
            continue;
        }
        await prisma.addons.update({
            where: { id: addon.id },
            data:  { label_ar: addon.label_ar ?? labelAr },
        });
        console.log(`[seed-plans-arabic] addons.${addon.key} ✓`);
    }
}

async function seedBillingDiscounts() {
    const discounts = await prisma.billing_discounts.findMany();
    for (const discount of discounts) {
        const ar = DISCOUNT_AR[discount.period_key];
        if (!ar) {
            console.warn(`[seed-plans-arabic] No Arabic copy defined for billing period "${discount.period_key}" — skipped`);
            continue;
        }
        await prisma.billing_discounts.update({
            where: { id: discount.id },
            data: {
                label_ar:      discount.label_ar      ?? ar.label_ar,
                save_label_ar: discount.save_label_ar  ?? ar.save_label_ar,
            },
        });
        console.log(`[seed-plans-arabic] billing_discounts.${discount.period_key} ✓`);
    }
}

async function main() {
    await seedPlans();
    await seedAddons();
    await seedBillingDiscounts();
    await prisma.$disconnect();
    console.log('[seed-plans-arabic] Done.');
}

main().catch((err) => {
    console.error('[seed-plans-arabic] Failed:', err);
    process.exit(1);
});
