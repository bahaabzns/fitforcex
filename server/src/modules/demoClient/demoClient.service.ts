import bcrypt from 'bcrypt';
import { createId } from '@paralleldrive/cuid2';
import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import logger from '../../logger';
import {
    DEMO_CLIENT, DEMO_DIET, DEMO_FORMS, DEMO_MESSAGES, DEMO_OBSERVATIONS, DEMO_PACKAGE, DEMO_PAYMENT_METHODS,
    DEMO_EXERCISES, DEMO_FOODS, DEMO_PROGRESS, DEMO_TRANSACTIONS, DEMO_TRAINING,
} from './demoClient.content';

type Tx = Prisma.TransactionClient;

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_MINUTE = 60 * 1000;
const SEED_TX_TIMEOUT_MS = 30_000;
const SEED_TX_MAX_WAIT_MS = 5_000;
const PLAN_ACTIVATED_DAYS_AGO = 3;
const MIN_FOODS_PER_MEAL = 1;
const FALLBACK_FOODS_PER_MEAL = 2;
const BCRYPT_ROUNDS = 10;

export const DEMO_EVENT = {
    CREATED: 'demo_created',
    WELCOME_SEEN: 'welcome_seen',
    OPENED: 'opened',
    EDITED: 'edited',
    VIEWED_APP: 'viewed_app',
    DELETED: 'deleted',
    // Not demo-specific: the same first-time-only table also remembers these two getting-started milestones.
    QUEUE_OPENED: 'queue_opened',
    REAL_CLIENT_PORTAL_LOGIN: 'real_client_portal_login',
    FORM_ADDED: 'form_added',
    FORM_QUESTIONS_SAVED: 'form_questions_saved',
} as const;
export type DemoEventType = typeof DEMO_EVENT[keyof typeof DEMO_EVENT];

const METRIC_DEFAULTS: Record<string, { unit: string; icon: string }> = {
    Weight: { unit: 'kg', icon: '⚖️' },
    Waist: { unit: 'cm', icon: '📏' },
    'Body Fat': { unit: '%', icon: '📊' },
};

const daysAgo = (days: number) => new Date(Date.now() - days * MS_PER_DAY);

/** First time each funnel step happens is kept; repeats are ignored. Never throws: tracking must not break a request. */
export async function recordDemoEvent(workspaceId: string, eventType: DemoEventType): Promise<void> {
    try {
        await prisma.demo_client_events.createMany({
            data: [{ id: createId(), workspace_id: workspaceId, event_type: eventType }],
            skipDuplicates: true,
        });
    } catch (err) {
        logger.warn({ err, workspaceId, eventType }, '[demoClient] could not record event');
    }
}

/** Marks a step only after another one has already happened (e.g. questions saved, but only once the coach added a form). */
export async function recordDemoEventIfSeen(workspaceId: string, eventType: DemoEventType, requiredEvent: DemoEventType): Promise<void> {
    const required = await prisma.demo_client_events.findFirst({ where: { workspace_id: workspaceId, event_type: requiredEvent }, select: { id: true } });
    if (required) await recordDemoEvent(workspaceId, eventType);
}

/** Marks a funnel step only when `clientId` is the workspace's demo client. */
export async function recordDemoEventIfDemoClient(workspaceId: string, clientId: string, eventType: DemoEventType): Promise<void> {
    const demo = await prisma.clients.findFirst({ where: { id: clientId, workspace_id: workspaceId, is_demo: true }, select: { id: true } });
    if (demo) await recordDemoEvent(workspaceId, eventType);
}

// ── Library lookups ────────────────────────────────────────────────────────
interface FoodRow { id: string; name_en: string }

function indexByName<T extends { name_en: string }>(rows: T[]): Map<string, T> {
    return new Map(rows.map((row) => [row.name_en.trim().toLowerCase(), row]));
}

/** Missing foods are skipped; a meal left empty falls back to the first foods in the library so the diet is never blank. */
function resolveMealFoods(items: Array<[string, number]>, foodsByName: Map<string, FoodRow>, allFoods: FoodRow[]) {
    const matched = items.flatMap(([name, amount]) => {
        const food = foodsByName.get(name.trim().toLowerCase());
        return food ? [{ food, amount }] : [];
    });
    if (matched.length >= MIN_FOODS_PER_MEAL) return matched;
    return allFoods.slice(0, FALLBACK_FOODS_PER_MEAL).map((food) => ({ food, amount: 100 }));
}

async function ensureMetrics(tx: Tx, workspaceId: string): Promise<Record<string, string>> {
    const names = Object.keys(METRIC_DEFAULTS);
    const existing = await tx.metrics.findMany({ where: { workspace_id: workspaceId, name: { in: names }, deleted_at: null }, select: { id: true, name: true } });
    const idByName: Record<string, string> = Object.fromEntries(existing.map((m) => [m.name, m.id]));
    for (const name of names.filter((n) => !idByName[n])) {
        const id = createId();
        await tx.metrics.create({ data: { id, workspace_id: workspaceId, name, type: 'number', unit: METRIC_DEFAULTS[name].unit, icon: METRIC_DEFAULTS[name].icon } });
        idByName[name] = id;
    }
    return idByName;
}

// ── Seeders (each takes the transaction and the ids it needs) ──────────────
interface SeedContext { tx: Tx; workspaceId: string; ownerId: string; clientId: string; clientName: string }

async function seedCommercial(ctx: SeedContext) {
    const { tx, workspaceId, clientId, clientName } = ctx;
    const packageId = createId();
    await tx.packages.create({ data: { id: packageId, workspace_id: workspaceId, name: DEMO_PACKAGE.name, is_demo: true } });

    const variations = DEMO_PACKAGE.variations.map((variation) => ({ ...variation, id: createId() }));
    await tx.package_variations.createMany({
        data: variations.map((variation) => ({
            id: variation.id, package_id: packageId, name: variation.name, description: variation.description, duration: variation.duration,
            price: variation.price, currency: DEMO_PACKAGE.currency, nutrition_cycle_days: DEMO_PACKAGE.cycleDays,
            training_cycle_days: DEMO_PACKAGE.cycleDays, review_offset_days: 3,
        })),
    });

    await tx.payment_methods.createMany({
        data: DEMO_PAYMENT_METHODS.map((method) => ({ id: createId(), workspace_id: workspaceId, name: method.name, type: method.type, is_demo: true })),
    });

    const subscribed = variations[DEMO_PACKAGE.subscribedVariationIndex];
    const lastCode = await tx.transactions.aggregate({ where: { workspace_id: workspaceId }, _max: { transaction_code: true } });
    let nextCode = (lastCode._max.transaction_code ?? 0) + 1;
    await tx.transactions.createMany({
        data: DEMO_TRANSACTIONS.map((entry) => ({
            id: createId(), transaction_code: nextCode++, workspace_id: workspaceId, client_id: clientId, client_name: clientName,
            package_variation: `${DEMO_PACKAGE.name} — ${subscribed.name}`, package_variation_id: subscribed.id,
            payment_method: DEMO_PAYMENT_METHODS[entry.paymentMethodIndex].name, amount: subscribed.price, currency: DEMO_PACKAGE.currency,
            type: 'subscription', status: 'completed', duration: subscribed.duration, notes: entry.note,
            transaction_date: daysAgo(entry.daysAgo), created_at: daysAgo(entry.daysAgo), subscription_start_date: daysAgo(entry.daysAgo),
            start_mode: 'custom', is_demo: true,
        })),
    });
    return { packageName: DEMO_PACKAGE.name, variationId: subscribed.id };
}

/** Adds any food/exercise the demo plans use that the coach's library doesn't have yet (matched by English name). */
async function ensureLibraryItems(tx: Tx, workspaceId: string) {
    const [foods, exercises] = await Promise.all([
        tx.food_items.findMany({ where: { workspace_id: workspaceId }, select: { name_en: true } }),
        tx.exercise_library.findMany({ where: { workspace_id: workspaceId }, select: { name_en: true } }),
    ]);
    const haveFoods = new Set(foods.map((food) => food.name_en.trim().toLowerCase()));
    const haveExercises = new Set(exercises.map((exercise) => exercise.name_en.trim().toLowerCase()));

    await tx.food_items.createMany({
        data: DEMO_FOODS.filter(([name]) => !haveFoods.has(name.toLowerCase())).map(([nameEn, nameAr, category, kcal, protein, carbs, fats]) => ({
            id: createId(), workspace_id: workspaceId, name_en: nameEn, name_ar: nameAr, food_category: category, serving_size: 100, serving_unit: 'g',
            calories_per_serving: kcal, protein_per_serving: protein, carbs_per_serving: carbs, fats_per_serving: fats,
        })),
    });
    await tx.exercise_library.createMany({
        data: DEMO_EXERCISES.filter(([name]) => !haveExercises.has(name.toLowerCase())).map(([nameEn, nameAr, muscleGroup, equipment]) => ({
            id: createId(), workspace_id: workspaceId, name_en: nameEn, name_ar: nameAr, muscle_group: muscleGroup, equipment,
        })),
    });
}

async function seedDiet(ctx: SeedContext) {
    const { tx, workspaceId, ownerId, clientId } = ctx;
    const allFoods = await tx.food_items.findMany({ where: { workspace_id: workspaceId }, select: { id: true, name_en: true }, take: 5000 });
    const foodsByName = indexByName(allFoods);

    const planId = createId();
    const activatedAt = daysAgo(PLAN_ACTIVATED_DAYS_AGO);
    await tx.nutrition_plans.create({
        data: {
            id: planId, name: DEMO_DIET.planName, client_id: clientId, workspace_id: workspaceId, status: 'active', created_by: ownerId,
            activated_at: activatedAt, cycle_days: DEMO_DIET.cycleDays, cycle_end_at: new Date(activatedAt.getTime() + DEMO_DIET.cycleDays * MS_PER_DAY),
            review_offset_days: DEMO_DIET.reviewOffsetDays,
        },
    });

    for (const [dayIndex, day] of DEMO_DIET.days.entries()) {
        const cycleId = createId();
        await tx.nutrition_cycles.create({
            data: {
                id: cycleId, plan_id: planId, name: day.name, cycle_order: dayIndex + 1, goal_calories: day.goalCalories,
                goal_protein: day.goalProtein, goal_carbs: day.goalCarbs, goal_fats: day.goalFats, note: DEMO_DIET.disclaimer,
            },
        });
        for (const [mealIndex, meal] of day.meals.entries()) {
            const mealId = createId();
            await tx.nutrition_meals.create({ data: { id: mealId, cycle_id: cycleId, name: meal.name, meal_order: mealIndex + 1 } });
            const foods = resolveMealFoods(meal.items as Array<[string, number]>, foodsByName, allFoods);
            await tx.nutrition_meal_items.createMany({
                data: foods.map(({ food, amount }, itemIndex) => ({
                    id: createId(), meal_id: mealId, food_item_id: food.id, amount, meal_item_order: itemIndex + 1,
                })),
            });
        }
    }
}

async function seedTraining(ctx: SeedContext) {
    const { tx, workspaceId, ownerId, clientId } = ctx;
    const exercises = await tx.exercise_library.findMany({ where: { workspace_id: workspaceId }, select: { id: true, name_en: true, equipment: true }, take: 5000 });
    const exercisesByName = indexByName(exercises);

    const planId = createId();
    const activatedAt = daysAgo(PLAN_ACTIVATED_DAYS_AGO);
    await tx.training_plans.create({
        data: {
            id: planId, name: DEMO_TRAINING.planName, client_id: clientId, workspace_id: workspaceId, status: 'active', notes: DEMO_TRAINING.notes,
            created_by: ownerId, activated_at: activatedAt, cycle_days: DEMO_TRAINING.cycleDays,
            cycle_end_at: new Date(activatedAt.getTime() + DEMO_TRAINING.cycleDays * MS_PER_DAY), review_offset_days: DEMO_TRAINING.reviewOffsetDays,
        },
    });

    for (const [dayIndex, day] of DEMO_TRAINING.days.entries()) {
        const dayId = createId();
        await tx.training_days.create({ data: { id: dayId, plan_id: planId, name: day.name, day_order: dayIndex + 1 } });
        const resolved = day.exercises.flatMap(([name, sets, reps]) => {
            const library = exercisesByName.get(name.trim().toLowerCase());
            return library ? [{ library, name, sets, reps }] : [];
        });
        for (const [exerciseIndex, exercise] of resolved.entries()) {
            const exerciseId = createId();
            await tx.training_exercises.create({
                data: { id: exerciseId, day_id: dayId, name: exercise.library.name_en, exercise_order: exerciseIndex + 1, equipment: exercise.library.equipment, exercise_library_id: exercise.library.id },
            });
            await tx.training_sets.createMany({
                data: Array.from({ length: exercise.sets }, (_, setIndex) => ({
                    id: createId(), exercise_id: exerciseId, set_order: setIndex + 1, reps: exercise.reps, rest_seconds: DEMO_TRAINING.restSeconds, rir: 2,
                })),
            });
        }
    }
}

interface FormQuestionSpec { label_en: string; label_ar: string; type: string; metric?: string; min?: number; max?: number; options?: string[] }

/** Creates a sealed one-version form and returns the ids needed to attach submissions. */
async function createDemoForm(
    tx: Tx, workspaceId: string, spec: { titleEn: string; titleAr: string; formType: string; postAction?: string }, questions: FormQuestionSpec[], metricIds: Record<string, string>,
) {
    const formId = createId();
    const versionId = createId();
    await tx.forms.create({
        data: { id: formId, workspace_id: workspaceId, title_en: spec.titleEn, title_ar: spec.titleAr, status: 'active', form_type: spec.formType, post_action: spec.postAction ?? 'nothing', is_demo: true },
    });
    await tx.form_versions.create({ data: { id: versionId, form_id: formId, version_number: 1, sealed_at: new Date() } });
    const questionRows = questions.map((question, index) => {
        const id = createId();
        return {
            id, form_version_id: versionId, label_en: question.label_en, label_ar: question.label_ar, type: question.type, order_index: index,
            min_value: question.min ?? null, max_value: question.max ?? null, metric_id: question.metric ? metricIds[question.metric] : null,
            options: question.options ?? Prisma.DbNull, origin_question_id: id,
        };
    });
    await tx.form_version_questions.createMany({ data: questionRows });
    await tx.forms.update({ where: { id: formId }, data: { current_version_id: versionId } });
    return { formId, versionId, questionIds: questionRows.map((row) => row.id) };
}

async function addSubmission(
    tx: Tx, ctx: SeedContext, form: { formId: string; versionId: string; questionIds: string[] },
    answers: Array<{ answer: string; metricId: string | null }>, submittedAt: Date, options: { waitingForCoach?: boolean; archived?: boolean } = {},
) {
    const { waitingForCoach = false, archived = false } = options;
    const requestId = createId();
    // The newest check-in waits in the Plans Queue so a new coach sees what a submission looks like there; earlier
    // ones are reviewed. They must NOT be archived: the client's progress charts only read non-archived submissions.
    // Archived rows are stamped archived_at = submitted_at, which is how repairDemoQueue recognises a row an older
    // version of the demo archived (and never touches one the coach archived themselves).
    await tx.form_requests.create({
        data: {
            id: requestId, form_id: form.formId, form_version_id: form.versionId, client_id: ctx.clientId, workspace_id: ctx.workspaceId,
            status: waitingForCoach ? 'submitted' : 'reviewed', post_action: waitingForCoach ? 'nutrition-plan' : 'nothing', requested_at: submittedAt, submitted_at: submittedAt, assigned_to: ctx.ownerId,
            ...(waitingForCoach ? {} : { action_taken_at: submittedAt, action_taken_by: ctx.ownerId }),
            ...(archived ? { archived_at: submittedAt, archived_by: ctx.ownerId } : {}),
        },
    });
    await tx.form_responses.createMany({
        data: answers.map((entry, index) => ({
            id: createId(), request_id: requestId, question_id: form.questionIds[index], answer: entry.answer, created_at: submittedAt, metric_id: entry.metricId,
        })),
    });
}

async function seedFormsAndProgress(ctx: SeedContext) {
    const { tx, workspaceId } = ctx;
    const metricIds = await ensureMetrics(tx, workspaceId);
    const assessmentContent = DEMO_FORMS.assessment;

    const assessment = await createDemoForm(tx, workspaceId, { ...assessmentContent, formType: 'assessment' }, [
        { label_en: 'What is your primary goal?', label_ar: 'ما هو هدفك الأساسي؟', type: 'long_text' },
        { label_en: 'Training experience', label_ar: 'خبرة التمرين', type: 'select', options: ['Beginner', 'Intermediate', 'Advanced'] },
        { label_en: 'Days per week available to train', label_ar: 'عدد أيام التمرين المتاحة أسبوعياً', type: 'number' },
        { label_en: 'Any injuries or limitations?', label_ar: 'هل لديك أي إصابات أو قيود؟', type: 'long_text' },
    ], metricIds);
    const { goal, experience, daysPerWeek, injuries } = assessmentContent.answers;
    const firstCheckInAt = daysAgo(DEMO_PROGRESS.checkIns[0].weeksAgo * 7);
    await addSubmission(tx, ctx, assessment, [goal, experience, daysPerWeek, injuries].map((answer) => ({ answer, metricId: null })), new Date(firstCheckInAt.getTime() - 2 * MS_PER_DAY), { archived: true });

    const checkIn = await createDemoForm(tx, workspaceId, { ...DEMO_FORMS.checkIn, formType: 'check-in', postAction: 'nutrition-plan' }, [
        { label_en: 'Weight', label_ar: 'الوزن', type: 'metric', metric: 'Weight' },
        { label_en: 'Waist', label_ar: 'الوسط', type: 'metric', metric: 'Waist' },
        { label_en: 'Body Fat', label_ar: 'نسبة الدهون', type: 'metric', metric: 'Body Fat' },
        { label_en: 'Energy level', label_ar: 'مستوى الطاقة', type: 'scale', min: 1, max: 10 },
        { label_en: 'Notes for your coach', label_ar: 'ملاحظات لمدربك', type: 'long_text' },
    ], metricIds);
    for (const [index, entry] of DEMO_PROGRESS.checkIns.entries()) {
        await addSubmission(tx, ctx, checkIn, [
            { answer: String(entry.weightKg), metricId: metricIds.Weight },
            { answer: String(entry.waistCm), metricId: metricIds.Waist },
            { answer: String(entry.bodyFatPercent), metricId: metricIds['Body Fat'] },
            { answer: String(entry.energy), metricId: null },
            { answer: entry.note, metricId: null },
        ], daysAgo(entry.weeksAgo * 7), { waitingForCoach: index === DEMO_PROGRESS.checkIns.length - 1 });
    }
}

async function seedMessages(ctx: SeedContext) {
    const { tx, workspaceId, ownerId, clientId } = ctx;
    const threadId = createId();
    const now = Date.now();
    await tx.threads.create({ data: { id: threadId, workspace_id: workspaceId, client_id: clientId } });
    await tx.messages.createMany({
        data: DEMO_MESSAGES.map((message) => {
            const sentAt = new Date(now - message.minutesAgo * MS_PER_MINUTE);
            return {
                id: createId(), thread_id: threadId, sender_type: message.from, sender_id: message.from === 'team' ? ownerId : clientId,
                body: message.body, type: 'text', created_at: sentAt, read_by_team_at: sentAt, read_by_client_at: sentAt,
            };
        }),
    });
}

async function seedObservations(ctx: SeedContext) {
    const { tx, workspaceId, ownerId, clientId } = ctx;
    await tx.client_observations.createMany({
        data: DEMO_OBSERVATIONS.map((observation) => ({
            id: createId(), client_id: clientId, workspace_id: workspaceId, author_id: ownerId, title: observation.title, category: observation.category,
            severity: observation.severity, content: observation.content, created_at: daysAgo(observation.daysAgo),
        })),
    });
}

// ── Public API ─────────────────────────────────────────────────────────────
export interface DemoStatus {
    hasDemoClient: boolean;
    demoClientId: string | null;
    showWelcome: boolean;
    portalSlug: string | null;
    login: { email: string; password: string } | null;
    // The 3-step checklist on the demo client's page.
    steps: { edited: boolean; viewedApp: boolean; addedRealClient: boolean } | null;
}

async function hasRealClient(workspaceId: string): Promise<boolean> {
    const count = await prisma.clients.count({ where: { workspace_id: workspaceId, is_demo: false, deleted_at: null } });
    return count > 0;
}

/**
 * Creates the demo client once per workspace. Safe to call on every dashboard load: it returns early when the
 * demo already exists, was deleted (never comes back), the coach already has a real client, or the libraries
 * the demo draws from are still being copied into the new workspace.
 */
export async function ensureDemoClient(workspaceId: string): Promise<void> {
    const workspace = await prisma.workspaces.findUnique({
        where: { id: workspaceId },
        select: { owner_id: true, archived_at: true, clone_status: true, demo_client_created_at: true, demo_client_deleted_at: true },
    });
    if (!workspace || workspace.archived_at || workspace.demo_client_deleted_at) return;
    if (workspace.demo_client_created_at) {
        await repairDemoPlans(workspaceId, workspace.owner_id);
        return;
    }
    if (workspace.clone_status !== 'ready') return;
    if (await hasRealClient(workspaceId)) return;

    const passwordHash = await bcrypt.hash(DEMO_CLIENT.password, BCRYPT_ROUNDS);
    const clientName = `${DEMO_CLIENT.fname} ${DEMO_CLIENT.lname}`;
    const latest = DEMO_PROGRESS.checkIns[DEMO_PROGRESS.checkIns.length - 1];

    await prisma.$transaction(async (tx) => {
        // The conditional update is the lock: of two simultaneous dashboard loads only one gets count 1.
        const claimed = await tx.workspaces.updateMany({
            where: { id: workspaceId, demo_client_created_at: null, demo_client_deleted_at: null },
            data: { demo_client_created_at: new Date() },
        });
        if (claimed.count === 0) return;

        const clientId = createId();
        const lastCode = await tx.clients.aggregate({ where: { workspace_id: workspaceId }, _max: { client_code: true } });
        await tx.clients.create({
            data: {
                id: clientId, client_code: (lastCode._max.client_code ?? 0) + 1, fname: DEMO_CLIENT.fname, lname: DEMO_CLIENT.lname,
                email: DEMO_CLIENT.email, phones: [], password: passwordHash, workspace_id: workspaceId, subscription_status: 'Active', is_demo: true,
            },
        });
        await tx.client_measurements.create({
            data: {
                id: createId(), client_id: clientId, gender: DEMO_CLIENT.gender, activity_level: DEMO_CLIENT.activityLevel,
                date_of_birth: new Date(Date.now() - DEMO_CLIENT.ageYears * 365.25 * MS_PER_DAY), weight: latest.weightKg, height: DEMO_CLIENT.heightCm,
                neck: DEMO_CLIENT.neckCm, waist: latest.waistCm, hip: DEMO_PROGRESS.hipCm,
            },
        });

        const ctx: SeedContext = { tx, workspaceId, ownerId: workspace.owner_id, clientId, clientName };
        const commercial = await seedCommercial(ctx);
        await tx.clients.update({ where: { id: clientId }, data: { current_package: commercial.packageName, current_package_variation_id: commercial.variationId } });
        await ensureLibraryItems(tx, workspaceId);
        await seedDiet(ctx);
        await seedTraining(ctx);
        await seedFormsAndProgress(ctx);
        await seedMessages(ctx);
        await seedObservations(ctx);
        await tx.demo_client_events.createMany({ data: [{ id: createId(), workspace_id: workspaceId, event_type: DEMO_EVENT.CREATED }], skipDuplicates: true });
    }, { timeout: SEED_TX_TIMEOUT_MS, maxWait: SEED_TX_MAX_WAIT_MS });
}

/**
 * A demo created while the coach's libraries were empty has a diet with no foods and a training plan with no
 * exercises. Rebuild just those two plans (once the libraries can supply them) so the demo is never left hollow.
 */
async function repairDemoPlans(workspaceId: string, ownerId: string): Promise<void> {
    const demoClient = await prisma.clients.findFirst({ where: { workspace_id: workspaceId, is_demo: true }, select: { id: true, fname: true, lname: true } });
    if (!demoClient) return;
    await repairDemoQueue(workspaceId, ownerId, demoClient);
    const [mealItems, trainingExercises] = await Promise.all([
        prisma.nutrition_meal_items.count({ where: { nutrition_meals: { nutrition_cycles: { nutrition_plans: { client_id: demoClient.id } } } } }),
        prisma.training_exercises.count({ where: { training_days: { training_plans: { client_id: demoClient.id } } } }),
    ]);
    if (mealItems > 0 && trainingExercises > 0) return;

    await prisma.$transaction(async (tx) => {
        const ctx: SeedContext = { tx, workspaceId, ownerId, clientId: demoClient.id, clientName: `${demoClient.fname} ${demoClient.lname}` };
        await ensureLibraryItems(tx, workspaceId);
        if (mealItems === 0) {
            await tx.nutrition_plans.deleteMany({ where: { workspace_id: workspaceId, client_id: demoClient.id } });
            await seedDiet(ctx);
        }
        if (trainingExercises === 0) {
            await tx.training_plans.deleteMany({ where: { workspace_id: workspaceId, client_id: demoClient.id } });
            await seedTraining(ctx);
        }
    }, { timeout: SEED_TX_TIMEOUT_MS, maxWait: SEED_TX_MAX_WAIT_MS });
}

/**
 * Older demos archived their past check-ins, which hid them from the client's progress charts, and had fewer
 * readings. Rebuild the readings when there are too few; otherwise un-archive check-ins an older version archived
 * (recognised by archived_at == submitted_at, so one the coach archived is left alone) and re-open the newest.
 */
async function repairDemoQueue(workspaceId: string, ownerId: string, demoClient: { id: string; fname: string; lname: string }): Promise<void> {
    const checkIns = await prisma.form_requests.findMany({
        where: { workspace_id: workspaceId, client_id: demoClient.id, forms: { form_type: 'check-in', is_demo: true } },
        orderBy: { submitted_at: 'desc' }, select: { id: true, status: true, submitted_at: true, archived_at: true },
    });

    if (checkIns.length < DEMO_PROGRESS.checkIns.length) {
        await prisma.$transaction(async (tx) => {
            await tx.form_requests.deleteMany({ where: { workspace_id: workspaceId, client_id: demoClient.id } });
            await tx.forms.deleteMany({ where: { workspace_id: workspaceId, is_demo: true, form_requests: { none: {} } } });
            await seedFormsAndProgress({ tx, workspaceId, ownerId, clientId: demoClient.id, clientName: `${demoClient.fname} ${demoClient.lname}` });
        }, { timeout: SEED_TX_TIMEOUT_MS, maxWait: SEED_TX_MAX_WAIT_MS });
        return;
    }

    const seededArchive = checkIns.filter((row) => row.archived_at && row.submitted_at && row.archived_at.getTime() === row.submitted_at.getTime());
    if (seededArchive.length === 0) return;
    const hasWaiting = checkIns.some((row) => row.status === 'submitted' && !row.archived_at);
    await prisma.$transaction([
        prisma.form_requests.updateMany({ where: { id: { in: seededArchive.map((row) => row.id) } }, data: { archived_at: null, archived_by: null } }),
        ...(hasWaiting ? [] : [
            prisma.form_requests.update({
                where: { id: seededArchive[0].id },
                data: { status: 'submitted', action_taken_at: null, action_taken_by: null, assigned_to: ownerId, post_action: 'nutrition-plan' },
            }),
        ]),
    ]);
}

/**
 * Building the demo client's plan completes its waiting check-in (that is how the Plans Queue works), so a coach who
 * edits the demo diet before ever opening the queue would find it empty. The first time the queue is opened, put the
 * newest demo check-in back to "needs action" if nothing is waiting. After that first visit it is left alone.
 */
export async function ensureWaitingDemoCheckIn(workspaceId: string): Promise<void> {
    const alreadyVisited = await prisma.demo_client_events.findFirst({ where: { workspace_id: workspaceId, event_type: DEMO_EVENT.QUEUE_OPENED }, select: { id: true } });
    if (alreadyVisited) return;
    const [demoClient, workspace] = await Promise.all([
        prisma.clients.findFirst({ where: { workspace_id: workspaceId, is_demo: true }, select: { id: true } }),
        prisma.workspaces.findUnique({ where: { id: workspaceId }, select: { owner_id: true } }),
    ]);
    if (!demoClient || !workspace) return;

    const waiting = await prisma.form_requests.count({ where: { workspace_id: workspaceId, client_id: demoClient.id, status: 'submitted', archived_at: null } });
    if (waiting > 0) return;
    const newest = await prisma.form_requests.findFirst({
        where: { workspace_id: workspaceId, client_id: demoClient.id, forms: { form_type: 'check-in', is_demo: true } },
        orderBy: { submitted_at: 'desc' }, select: { id: true },
    });
    if (!newest) return;
    await prisma.form_requests.update({
        where: { id: newest.id },
        data: { status: 'submitted', archived_at: null, archived_by: null, action_taken_at: null, action_taken_by: null, assigned_to: workspace.owner_id, post_action: 'nutrition-plan' },
    });
}

export async function getDemoStatus(workspaceId: string): Promise<DemoStatus> {
    const [demoClient, workspace] = await Promise.all([
        prisma.clients.findFirst({ where: { workspace_id: workspaceId, is_demo: true }, select: { id: true } }),
        prisma.workspaces.findUnique({ where: { id: workspaceId }, select: { slug: true, demo_welcome_seen_at: true } }),
    ]);
    const base = {
        hasDemoClient: !!demoClient,
        demoClientId: demoClient?.id ?? null,
        showWelcome: !!demoClient && !workspace?.demo_welcome_seen_at,
        portalSlug: workspace?.slug ?? null,
        login: demoClient ? { email: DEMO_CLIENT.email, password: DEMO_CLIENT.password } : null,
    };
    if (!demoClient) return { ...base, steps: null };

    const [events, addedRealClient] = await Promise.all([
        prisma.demo_client_events.findMany({ where: { workspace_id: workspaceId }, select: { event_type: true } }),
        hasRealClient(workspaceId),
    ]);
    const happened = new Set(events.map((event) => event.event_type));
    return { ...base, steps: { edited: happened.has(DEMO_EVENT.EDITED), viewedApp: happened.has(DEMO_EVENT.VIEWED_APP), addedRealClient } };
}

export async function markWelcomeSeen(workspaceId: string): Promise<void> {
    await prisma.workspaces.updateMany({ where: { id: workspaceId, demo_welcome_seen_at: null }, data: { demo_welcome_seen_at: new Date() } });
    await recordDemoEvent(workspaceId, DEMO_EVENT.WELCOME_SEEN);
}

/** Deletes the demo client and everything seeded for it. Returns false when there was no demo client. */
export async function deleteDemoClient(workspaceId: string): Promise<boolean> {
    const demoClient = await prisma.clients.findFirst({ where: { workspace_id: workspaceId, is_demo: true }, select: { id: true } });
    if (!demoClient) return false;
    const clientId = demoClient.id;

    await prisma.$transaction(async (tx) => {
        const thread = await tx.threads.findFirst({ where: { workspace_id: workspaceId, client_id: clientId }, select: { id: true } });
        if (thread) {
            await tx.messages.deleteMany({ where: { thread_id: thread.id } });
            await tx.threads.delete({ where: { id: thread.id } });
        }
        await tx.transactions.deleteMany({ where: { workspace_id: workspaceId, OR: [{ client_id: clientId }, { is_demo: true }] } });
        await tx.training_plans.deleteMany({ where: { workspace_id: workspaceId, client_id: clientId } });
        await tx.food_swap_history.deleteMany({ where: { client_id: clientId } });
        await tx.notifications.deleteMany({ where: { workspace_id: workspaceId, entity_type: 'client', entity_id: clientId } });
        // Everything else hangs off the client with ON DELETE CASCADE (nutrition, form requests + answers, observations, measurements, ...).
        await tx.clients.delete({ where: { id: clientId } });

        await removeDemoWorkspaceItems(tx, workspaceId);
        await tx.workspaces.update({ where: { id: workspaceId }, data: { demo_client_deleted_at: new Date() } });
        await tx.demo_client_events.createMany({ data: [{ id: createId(), workspace_id: workspaceId, event_type: DEMO_EVENT.DELETED }], skipDuplicates: true });
    }, { timeout: SEED_TX_TIMEOUT_MS, maxWait: SEED_TX_MAX_WAIT_MS });
    return true;
}

/**
 * Demo packages / payment methods / forms are workspace-level, so a coach may have started using them for a
 * real client. Those are kept (and un-labelled as demo) rather than breaking the real client's data.
 */
async function removeDemoWorkspaceItems(tx: Tx, workspaceId: string) {
    const demoPackages = await tx.packages.findMany({ where: { workspace_id: workspaceId, is_demo: true }, select: { id: true, package_variations: { select: { id: true } } } });
    for (const demoPackage of demoPackages) {
        const variationIds = demoPackage.package_variations.map((v) => v.id);
        const inUse = await tx.clients.count({ where: { current_package_variation_id: { in: variationIds } } })
            + await tx.transactions.count({ where: { package_variation_id: { in: variationIds } } });
        if (inUse > 0) await tx.packages.update({ where: { id: demoPackage.id }, data: { is_demo: false } });
        else await tx.packages.delete({ where: { id: demoPackage.id } });
    }

    const demoForms = await tx.forms.findMany({ where: { workspace_id: workspaceId, is_demo: true }, select: { id: true } });
    for (const demoForm of demoForms) {
        const inUse = await tx.form_requests.count({ where: { form_id: demoForm.id } });
        if (inUse > 0) await tx.forms.update({ where: { id: demoForm.id }, data: { is_demo: false } });
        else await tx.forms.delete({ where: { id: demoForm.id } });
    }

    await tx.payment_methods.deleteMany({ where: { workspace_id: workspaceId, is_demo: true } });
}
