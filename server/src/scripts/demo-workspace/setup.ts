// Workspace-level prerequisites for the demo seed: libraries, forms, metrics, packages,
// payment methods, team and settings. Everything here is "find or create" — it reuses what
// the workspace already has (cloned from the default libraries at signup) and only fills gaps.

import bcrypt from 'bcrypt';
import { Prisma, PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import { DEFAULT_PERMISSIONS } from '../../lib/defaultPermissions';
import { FALLBACK_EXERCISES, FALLBACK_FOODS } from './pools';
import { daysAgo, pick, randInt } from './random';

export const TEAM_EMAIL_DOMAIN = 'demo-team.example.test';
export const CLIENT_EMAIL_DOMAIN = 'demo-clients.example.test';
export const DEMO_PASSWORD = 'Demo@12345';

// ── Libraries ──────────────────────────────────────────────────────────────
export type FoodKind = 'protein' | 'carb' | 'fat' | 'veg' | 'mixed';
export interface FoodRef {
    id: string; nameEn: string; nameAr: string | null; servingSize: number; servingUnit: string | null;
    kcal: number; protein: number; carbs: number; fats: number; kind: FoodKind;
}
export interface ExerciseRef {
    id: string; nameEn: string; nameAr: string | null; muscleGroup: string; equipment: string | null;
    trackingType: string; trackedMetrics: string[];
}
export interface Library { foods: FoodRef[]; exercises: ExerciseRef[] }

function classifyFood(kcal: number, protein: number, carbs: number, fats: number): FoodKind {
    if (kcal <= 70 && protein < 5) return 'veg';
    if ((protein * 4) / kcal >= 0.35) return 'protein';
    if ((fats * 9) / kcal >= 0.55) return 'fat';
    if ((carbs * 4) / kcal >= 0.6) return 'carb';
    return 'mixed';
}

export async function loadLibrary(prisma: PrismaClient, workspaceId: string): Promise<Library> {
    if (await prisma.food_items.count({ where: { workspace_id: workspaceId } }) === 0) {
        console.log('  workspace has no food items, creating a starter set');
        await prisma.food_items.createMany({
            data: FALLBACK_FOODS.map(([nameEn, nameAr, category, kcal, protein, carbs, fats]) => ({
                id: createId(), workspace_id: workspaceId, name_en: nameEn, name_ar: nameAr, food_category: category,
                serving_size: 100, serving_unit: 'g', calories_per_serving: kcal, protein_per_serving: protein,
                carbs_per_serving: carbs, fats_per_serving: fats,
            })),
        });
    }
    if (await prisma.exercise_library.count({ where: { workspace_id: workspaceId } }) === 0) {
        console.log('  workspace has no exercises, creating a starter set');
        await prisma.exercise_library.createMany({
            data: FALLBACK_EXERCISES.map(([nameEn, muscleGroup, equipment, trackingType]) => ({
                id: createId(), workspace_id: workspaceId, name_en: nameEn, muscle_group: muscleGroup, equipment,
                tracking_type: trackingType, tracked_metrics: trackingType === 'time_based' ? ['duration_seconds'] : [],
            })),
        });
    }

    const [foodRows, exerciseRows] = await Promise.all([
        prisma.food_items.findMany({ where: { workspace_id: workspaceId } }),
        prisma.exercise_library.findMany({ where: { workspace_id: workspaceId } }),
    ]);

    const foods: FoodRef[] = foodRows
        .map((row) => {
            const kcal = Number(row.calories_per_serving);
            const protein = Number(row.protein_per_serving);
            const carbs = Number(row.carbs_per_serving);
            const fats = Number(row.fats_per_serving);
            return {
                id: row.id, nameEn: row.name_en, nameAr: row.name_ar, servingSize: Number(row.serving_size ?? 100) || 100,
                servingUnit: row.serving_unit, kcal, protein, carbs, fats, kind: kcal > 0 ? classifyFood(kcal, protein, carbs, fats) : 'mixed' as FoodKind,
            };
        })
        .filter((food) => food.kcal > 0);

    const exercises: ExerciseRef[] = exerciseRows.map((row) => ({
        id: row.id, nameEn: row.name_en, nameAr: row.name_ar, muscleGroup: row.muscle_group ?? 'Other', equipment: row.equipment,
        trackingType: row.tracking_type, trackedMetrics: row.tracked_metrics,
    }));
    return { foods, exercises };
}

// ── Metrics ────────────────────────────────────────────────────────────────
export interface MetricRef { id: string; name: string; unit: string | null }
const PROGRESS_METRICS: Array<[string, string]> = [
    ['Weight', 'kg'], ['Waist', 'cm'], ['Hip', 'cm'], ['Chest', 'cm'], ['Body Fat', '%'], ['Left Arm', 'cm'], ['Right Arm', 'cm'],
];

export async function ensureMetrics(prisma: PrismaClient, workspaceId: string): Promise<Record<string, MetricRef>> {
    const result: Record<string, MetricRef> = {};
    for (const [name, unit] of PROGRESS_METRICS) {
        const existing = await prisma.metrics.findFirst({ where: { workspace_id: workspaceId, name } });
        const row = existing ?? await prisma.metrics.create({ data: { id: createId(), workspace_id: workspaceId, name, type: 'number', unit } });
        if (existing?.deleted_at) await prisma.metrics.update({ where: { id: existing.id }, data: { deleted_at: null } });
        result[name] = { id: row.id, name, unit: row.unit };
    }
    return result;
}

// ── Forms ──────────────────────────────────────────────────────────────────
export type FormKey = 'trainingAssessment' | 'nutritionAssessment' | 'trainingCheckin' | 'nutritionCheckin' | 'progress';
export interface FormQuestionRef {
    id: string; type: string; labelEn: string; min: number | null; max: number | null; options: string[]; metricId: string | null;
}
export interface DemoForm {
    key: FormKey; id: string; versionId: string; title: string; formType: string; postAction: string; questions: FormQuestionRef[];
}

interface QuestionSpec {
    label: string; labelAr: string; type: string; options?: string[]; min?: number; max?: number; metric?: string; required?: boolean;
}
interface FormSpec { key: FormKey; title: string; titleAr: string; formType: string; postAction: string; questions: QuestionSpec[] }

const FORM_SPECS: FormSpec[] = [
    {
        key: 'trainingAssessment', title: 'Training Assessment', titleAr: 'تقييم التمرين', formType: 'assessment', postAction: 'workout-plan',
        questions: [
            { label: 'Training experience', labelAr: 'الخبرة التدريبية', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced'], required: true },
            { label: 'Days per week available to train', labelAr: 'أيام التدريب المتاحة أسبوعياً', type: 'number', required: true },
            { label: 'Available equipment', labelAr: 'المعدات المتاحة', type: 'multiselect', options: ['Full gym', 'Dumbbells', 'Barbell', 'Machines', 'Resistance bands', 'Bodyweight only'] },
            { label: 'Primary goal', labelAr: 'الهدف الأساسي', type: 'select', options: ['Build muscle', 'Lose fat', 'Improve endurance', 'General fitness'], required: true },
            { label: 'Preferred training time', labelAr: 'وقت التمرين المفضل', type: 'select', options: ['Morning', 'Afternoon', 'Evening'] },
            { label: 'Injuries or physical limitations', labelAr: 'إصابات أو قيود جسدية', type: 'text' },
        ],
    },
    {
        key: 'nutritionAssessment', title: 'Nutrition Assessment', titleAr: 'تقييم التغذية', formType: 'assessment', postAction: 'nutrition-plan',
        questions: [
            { label: 'Current weight (kg)', labelAr: 'الوزن الحالي (كجم)', type: 'number', required: true },
            { label: 'Target weight (kg)', labelAr: 'الوزن المستهدف (كجم)', type: 'number' },
            { label: 'Dietary preference', labelAr: 'النظام الغذائي المفضل', type: 'select', options: ['Balanced', 'Low-carb', 'High-protein', 'Vegetarian'] },
            { label: 'Food allergies', labelAr: 'حساسية الطعام', type: 'multiselect', options: ['None', 'Nuts', 'Dairy', 'Gluten', 'Seafood', 'Eggs'] },
            { label: 'Meals per day', labelAr: 'عدد الوجبات يومياً', type: 'number' },
            { label: 'Foods you dislike', labelAr: 'أطعمة لا تفضلها', type: 'text' },
        ],
    },
    {
        key: 'trainingCheckin', title: 'Weekly Training Check-in', titleAr: 'متابعة التمرين الأسبوعية', formType: 'check-in', postAction: 'workout-plan',
        questions: [
            { label: 'Sessions completed this week', labelAr: 'عدد الحصص المنفذة هذا الأسبوع', type: 'number', required: true },
            { label: 'Energy level (1-10)', labelAr: 'مستوى الطاقة', type: 'scale', min: 1, max: 10 },
            { label: 'Muscle soreness (1-10)', labelAr: 'الإجهاد العضلي', type: 'scale', min: 1, max: 10 },
            { label: 'Average sleep (hours)', labelAr: 'متوسط النوم (ساعات)', type: 'number' },
            { label: 'Anything your coach should know?', labelAr: 'هل من شيء يجب أن يعرفه مدربك؟', type: 'text' },
        ],
    },
    {
        key: 'nutritionCheckin', title: 'Weekly Nutrition Check-in', titleAr: 'متابعة التغذية الأسبوعية', formType: 'check-in', postAction: 'nutrition-plan',
        questions: [
            { label: 'How well did you follow the plan?', labelAr: 'مدى الالتزام بالخطة', type: 'select', options: ['Perfectly', 'Mostly', 'Partially', 'Poorly'], required: true },
            { label: 'Hunger level (1-10)', labelAr: 'مستوى الجوع', type: 'scale', min: 1, max: 10 },
            { label: 'Water intake (litres per day)', labelAr: 'شرب المياه (لتر يومياً)', type: 'number' },
            { label: 'Off-plan meals this week', labelAr: 'وجبات خارج الخطة', type: 'number' },
            { label: 'Notes', labelAr: 'ملاحظات', type: 'text' },
        ],
    },
    {
        key: 'progress', title: 'Progress Measurements', titleAr: 'قياسات التقدم', formType: 'check-in', postAction: 'nothing',
        questions: PROGRESS_METRICS.map(([name]) => ({
            label: name, labelAr: name, type: 'metric', metric: name,
        })),
    },
];

async function loadForm(prisma: PrismaClient, formId: string, spec: FormSpec): Promise<DemoForm> {
    const form = await prisma.forms.findUniqueOrThrow({ where: { id: formId } });
    if (!form.current_version_id) throw new Error(`Form "${spec.title}" exists but has no current version, fix or rename it and re-run`);
    await prisma.form_versions.updateMany({ where: { id: form.current_version_id, sealed_at: null }, data: { sealed_at: new Date() } });
    const questions = await prisma.form_version_questions.findMany({
        where: { form_version_id: form.current_version_id }, orderBy: { order_index: 'asc' },
    });
    return {
        key: spec.key, id: form.id, versionId: form.current_version_id, title: form.title_en, formType: form.form_type, postAction: form.post_action,
        questions: questions.map((q) => ({
            id: q.id, type: q.type, labelEn: q.label_en, min: q.min_value, max: q.max_value, metricId: q.metric_id,
            options: Array.isArray(q.options) ? (q.options as string[]) : [],
        })),
    };
}

export async function ensureForms(
    prisma: PrismaClient, workspaceId: string, metrics: Record<string, MetricRef>,
): Promise<Record<FormKey, DemoForm>> {
    const result = {} as Record<FormKey, DemoForm>;
    for (const spec of FORM_SPECS) {
        const existing = await prisma.forms.findFirst({ where: { workspace_id: workspaceId, title_en: spec.title } });
        if (existing) { result[spec.key] = await loadForm(prisma, existing.id, spec); continue; }

        const formId = createId();
        const versionId = createId();
        await prisma.forms.create({
            data: {
                id: formId, workspace_id: workspaceId, title_en: spec.title, title_ar: spec.titleAr, status: 'active',
                form_type: spec.formType, post_action: spec.postAction,
            },
        });
        await prisma.form_versions.create({ data: { id: versionId, form_id: formId, version_number: 1, sealed_at: new Date() } });
        await prisma.form_version_questions.createMany({
            data: spec.questions.map((q, index) => {
                const id = createId();
                return {
                    id, form_version_id: versionId, label_en: q.label, label_ar: q.labelAr, type: q.type, required: q.required ?? false,
                    order_index: index, min_value: q.min ?? null, max_value: q.max ?? null,
                    options: q.options ? (q.options as unknown as Prisma.InputJsonValue) : Prisma.DbNull,
                    metric_id: q.metric ? metrics[q.metric].id : null, origin_question_id: id,
                };
            }),
        });
        await prisma.forms.update({ where: { id: formId }, data: { current_version_id: versionId } });
        result[spec.key] = await loadForm(prisma, formId, spec);
    }
    return result;
}

// ── Packages and payment methods ───────────────────────────────────────────
export interface VariationRef {
    id: string; label: string; price: number; currency: string; duration: number;
    nutritionCycleDays: number; trainingCycleDays: number; reviewOffsetDays: number;
}

const PACKAGE_SPECS: Array<{ name: string; variations: Array<[string, number, number]>; cycle: number }> = [
    { name: 'Online Coaching', cycle: 28, variations: [['1 Month', 30, 1500], ['3 Months', 90, 3900], ['6 Months', 180, 6900]] },
    { name: 'Premium 1:1', cycle: 14, variations: [['1 Month', 30, 3000], ['3 Months', 90, 7800]] },
    { name: 'Transformation Program', cycle: 28, variations: [['12 Weeks', 84, 5400], ['24 Weeks', 168, 9600]] },
];

export async function ensurePackages(
    prisma: PrismaClient, workspaceId: string, forms: Record<FormKey, DemoForm>,
): Promise<VariationRef[]> {
    if (await prisma.packages.count({ where: { workspace_id: workspaceId } }) === 0) {
        for (const spec of PACKAGE_SPECS) {
            const packageId = createId();
            await prisma.packages.create({ data: { id: packageId, workspace_id: workspaceId, name: spec.name } });
            for (const [name, duration, price] of spec.variations) {
                const variationId = createId();
                await prisma.package_variations.create({
                    data: {
                        id: variationId, package_id: packageId, name, duration, price, currency: 'EGP',
                        nutrition_cycle_days: spec.cycle, training_cycle_days: spec.cycle, review_offset_days: 3, plan_update_mode: 'extend',
                        description: `${spec.name}, ${name.toLowerCase()} of coaching with plan updates and chat support`,
                    },
                });
                await prisma.package_default_forms.createMany({
                    data: [
                        { kind: 'assessment', formId: forms.trainingAssessment.id },
                        { kind: 'checkin-nutrition', formId: forms.nutritionCheckin.id },
                        { kind: 'checkin-training', formId: forms.trainingCheckin.id },
                    ].map((entry, index) => ({
                        id: createId(), package_variation_id: variationId, form_id: entry.formId, kind: entry.kind, sort_order: index + 1,
                    })),
                });
            }
        }
    }
    const variations = await prisma.package_variations.findMany({
        where: { active: true, price: { gt: 0 }, duration: { gt: 0 }, packages: { workspace_id: workspaceId, active: true } },
        include: { packages: { select: { name: true } } },
    });
    if (variations.length === 0) throw new Error('No active package variations with a price and duration in this workspace');
    return variations.map((v) => ({
        id: v.id, label: `${v.packages.name} — ${v.name}`, price: Number(v.price), currency: v.currency, duration: v.duration,
        nutritionCycleDays: v.nutrition_cycle_days ?? 28, trainingCycleDays: v.training_cycle_days ?? 28, reviewOffsetDays: v.review_offset_days ?? 3,
    }));
}

export async function ensurePaymentMethods(prisma: PrismaClient, workspaceId: string): Promise<string[]> {
    if (await prisma.payment_methods.count({ where: { workspace_id: workspaceId } }) === 0) {
        await prisma.payment_methods.createMany({
            data: [['Cash', 'cash'], ['Visa / Mastercard', 'card'], ['InstaPay', 'wallet'], ['Vodafone Cash', 'wallet'], ['Bank Transfer', 'bank_transfer']]
                .map(([name, type]) => ({ id: createId(), workspace_id: workspaceId, name, type })),
        });
    }
    const methods = await prisma.payment_methods.findMany({ where: { workspace_id: workspaceId, active: true }, select: { name: true } });
    if (methods.length === 0) throw new Error('Workspace has payment methods but none are active');
    return methods.map((m) => m.name);
}

// ── Team ───────────────────────────────────────────────────────────────────
export interface TeamMemberRef { userId: string; role: string; fname: string; lname: string }
interface TeamSpec { fname: string; lname: string; role: string; capacity: number | null; daysOff: number[] }

const TEAM_SPECS: TeamSpec[] = [
    { fname: 'Sara', lname: 'Mostafa', role: 'manager', capacity: 8, daysOff: [5] },
    { fname: 'Omar', lname: 'Khaled', role: 'trainer', capacity: 14, daysOff: [5] },
    { fname: 'Hana', lname: 'Adel', role: 'trainer', capacity: 12, daysOff: [] },
    { fname: 'Karim', lname: 'Nabil', role: 'trainer', capacity: 12, daysOff: [5, 6] },
    { fname: 'Nadia', lname: 'Farouk', role: 'nutritionist', capacity: 10, daysOff: [5] },
    { fname: 'Mona', lname: 'Saad', role: 'nutritionist', capacity: 10, daysOff: [] },
    { fname: 'Rana', lname: 'Hassan', role: 'receptionist', capacity: null, daysOff: [] },
    { fname: 'Victor', lname: 'Samir', role: 'viewer', capacity: null, daysOff: [] },
];

const demoTeamEmail = (spec: { fname: string; lname: string }) => `${spec.fname}.${spec.lname}@${TEAM_EMAIL_DOMAIN}`.toLowerCase();

export async function createTeam(prisma: PrismaClient, workspaceId: string, ownerId: string): Promise<TeamMemberRef[]> {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const members: TeamMemberRef[] = [];
    for (const spec of TEAM_SPECS) {
        const userId = createId();
        await prisma.users.create({
            data: {
                id: userId, fname: spec.fname, lname: spec.lname, email: demoTeamEmail(spec), password: passwordHash,
                email_verified: true, default_workspace_id: workspaceId, created_at: daysAgo(randInt(120, 300)),
            },
        });
        await prisma.workspace_members.create({
            data: {
                id: createId(), workspace_id: workspaceId, user_id: userId, role: spec.role,
                permissions: DEFAULT_PERMISSIONS[spec.role] as unknown as Prisma.InputJsonValue,
                daily_plan_capacity: spec.capacity, days_off: spec.daysOff, joined_at: daysAgo(randInt(90, 280)),
            },
        });
        if (spec.capacity !== null) {
            await prisma.capacity_history.create({
                data: {
                    id: createId(), workspace_id: workspaceId, user_id: userId, previous_capacity: null, new_capacity: spec.capacity,
                    previous_days_off: [], new_days_off: spec.daysOff, changed_by: ownerId, changed_at: daysAgo(randInt(20, 60)),
                },
            });
        }
        await prisma.workspace_audit_log.create({
            data: {
                id: createId(), workspace_id: workspaceId, actor_user_id: ownerId, action: 'member_added', target_type: 'user', target_id: userId,
                metadata: { demo: true, role: spec.role, name: `${spec.fname} ${spec.lname}` }, created_at: daysAgo(randInt(90, 280)),
            },
        });
        members.push({ userId, role: spec.role, fname: spec.fname, lname: spec.lname });
    }
    await createInvitations(prisma, workspaceId, ownerId);
    return members;
}

async function createInvitations(prisma: PrismaClient, workspaceId: string, ownerId: string) {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    const invitees: Array<{ fname: string; lname: string; role: string; status: 'pending' | 'declined' }> = [
        { fname: 'Laila', lname: 'Gamal', role: 'trainer', status: 'pending' },
        { fname: 'Tarek', lname: 'Zaki', role: 'nutritionist', status: 'pending' },
        { fname: 'Dina', lname: 'Fawzy', role: 'trainer', status: 'declined' },
    ];
    for (const invitee of invitees) {
        const userId = createId();
        await prisma.users.create({
            data: { id: userId, fname: invitee.fname, lname: invitee.lname, email: demoTeamEmail(invitee), password: passwordHash, email_verified: true },
        });
        const sentAt = daysAgo(randInt(1, 9));
        await prisma.workspace_invitations.create({
            data: {
                id: createId(), workspace_id: workspaceId, invited_by_user_id: ownerId, invited_user_id: userId, role: invitee.role,
                status: invitee.status, message: 'We would love to have you on the team!', created_at: sentAt,
                responded_at: invitee.status === 'declined' ? daysAgo(1) : null,
            },
        });
        await prisma.workspace_audit_log.create({
            data: {
                id: createId(), workspace_id: workspaceId, actor_user_id: ownerId, action: 'invite_sent', target_type: 'user', target_id: userId,
                metadata: { demo: true, role: invitee.role }, created_at: sentAt,
            },
        });
    }
}

// ── Settings: branding, PDFs, subscription access ──────────────────────────
export async function ensureSettings(prisma: PrismaClient, workspaceId: string, workspaceName: string, ownerId: string) {
    const brandColor = '#0F766E';
    if (!await prisma.workspace_branding.findUnique({ where: { workspace_id: workspaceId } })) {
        await prisma.workspace_branding.create({
            data: {
                workspace_id: workspaceId, primary_color: brandColor, accent_color: '#F59E0B',
                welcome_message: 'Welcome back! Small steps every day add up.', updated_by: ownerId,
            },
        });
    }
    if (await prisma.nutrition_pdf_settings.count({ where: { workspace_id: workspaceId } }) === 0) {
        await prisma.nutrition_pdf_settings.create({
            data: { id: createId(), workspace_id: workspaceId, name: 'Default', is_default: true, coach_name: workspaceName, footer_text: `${workspaceName} · Nutrition Plan`, primary_color: brandColor },
        });
    }
    if (await prisma.training_pdf_settings.count({ where: { workspace_id: workspaceId } }) === 0) {
        await prisma.training_pdf_settings.create({
            data: { id: createId(), workspace_id: workspaceId, name: 'Default', is_default: true, coach_name: workspaceName, footer_text: `${workspaceName} · Training Plan`, primary_color: brandColor },
        });
    }
    if (await prisma.subscription_access_policies.count({ where: { workspace_id: workspaceId, package_id: null } }) === 0) {
        await prisma.subscription_access_policies.createMany({
            data: [
                { id: createId(), workspace_id: workspaceId, scope: 'expired', grace_period_days: 7, allow_messaging: true, allow_food_swap: false },
                { id: createId(), workspace_id: workspaceId, scope: 'frozen', grace_period_days: 0, allow_messaging: true, allow_food_swap: true },
            ],
        });
    }
}

export interface QueueLabelRef { id: string; name: string }
export async function ensureQueueLabels(prisma: PrismaClient, workspaceId: string): Promise<QueueLabelRef[]> {
    const defaults: Array<[string, string]> = [['Urgent', '#DC2626'], ['VIP', '#7C3AED'], ['Follow-up', '#F59E0B'], ['New client', '#0891B2']];
    for (const [name, color] of defaults) {
        const existing = await prisma.plans_queue_labels.findUnique({ where: { workspace_id_name: { workspace_id: workspaceId, name } } });
        if (!existing) await prisma.plans_queue_labels.create({ data: { id: createId(), workspace_id: workspaceId, name, color } });
    }
    return prisma.plans_queue_labels.findMany({ where: { workspace_id: workspaceId }, select: { id: true, name: true } });
}

export const pickTeamFor = (team: TeamMemberRef[], roles: string[]): TeamMemberRef => {
    const eligible = team.filter((member) => roles.includes(member.role));
    return pick(eligible.length > 0 ? eligible : team);
};
