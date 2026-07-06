/**
 * Full client seed — inserts N clients into a workspace, each with:
 *   • client_measurements  (body stats)
 *   • client_observations  (1–3 coach notes)
 *   • transactions         (varied subscription scenarios)
 *   • subscription_freezes (for frozen clients)
 *   • nutrition_plans      (1 plan → 1–2 cycles → 3–4 meals → 2–3 items each)
 *   • training_plans       (1 plan → 3–4 days → 3–4 exercises → 3–4 sets each)
 *   • workout_logs         (3–5 past sessions)
 *
 * Food items and exercises are auto-seeded as stubs if the workspace has none.
 *
 * Subscription scenario split (repeating cycle of 10):
 *   i%10 0–3 → Active (4)   4–5 → Expired (2)   6 → Frozen (1)
 *        7   → Pre-start (1) 8   → Renewal (1)   9 → No subscription (1)
 *
 * Usage (from server/):
 *   npx dotenv -e .env -- npx tsx src/scripts/seed-full-clients.ts [slug] [count]
 *   npx dotenv -e .env -- npx tsx src/scripts/seed-full-clients.ts test1 20
 */

import { PrismaClient, Prisma } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SLUG  = process.argv[2] || 'test1';
const COUNT = Number(process.argv[3] || 20);
const DAY   = 86_400_000;

// ── Name pools ────────────────────────────────────────────────────────────────

const FIRST_NAMES = [
    'Ahmed', 'Mohamed', 'Mahmoud', 'Omar', 'Ali', 'Hassan', 'Khaled', 'Youssef', 'Mostafa', 'Tarek',
    'Karim', 'Amr', 'Sherif', 'Hossam', 'Tamer', 'Walid', 'Sami', 'Nader', 'Fady', 'Bahaa',
    'Sara', 'Mona', 'Nour', 'Hana', 'Laila', 'Salma', 'Mariam', 'Yasmin', 'Dina', 'Rana',
];
const LAST_NAMES = [
    'Hassan', 'Ibrahim', 'Mahmoud', 'Said', 'Fathy', 'Mansour', 'Gamal', 'Saad', 'Adel', 'Naguib',
    'Sabry', 'Lotfy', 'Zaki', 'Shawky', 'Ramadan', 'Fawzy', 'Hamdy', 'Abdel Aziz', 'El Sayed', 'Kamal',
];
const COUNTRY_CODES = ['+20', '+966', '+971', '+965', '+974'];
const GENDERS       = ['male', 'female'];
const ACTIVITY_LEVELS = ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extra_active'];
const CURRENCIES      = ['EGP', 'USD', 'SAR', 'AED'];
const FALLBACK_METHODS = ['Cash', 'Visa', 'InstaPay', 'Vodafone Cash'];

const OBSERVATION_TEXTS = [
    'Highly motivated and consistent with check-ins.',
    'Needs extra attention on form during compound movements.',
    'Prefers morning sessions. Responds well to progressive overload.',
    'Recovering from a minor knee issue — avoid heavy leg pressing for now.',
    'Strong upper body; lagging lower body. Adjust split accordingly.',
    'Skips breakfast regularly. Advised on meal timing importance.',
    'Makes great progress when stress levels are low.',
    'Hydration is a recurring issue. Reminded to track water intake.',
    'Very detail-oriented — appreciates written instructions.',
    'Struggles with sleep quality. Recommended magnesium supplementation.',
    'Excellent compliance with nutrition plan this month.',
    'Requested an increase in training frequency from 3 to 4 days per week.',
];

const MEAL_NAMES = ['Breakfast', 'Lunch', 'Dinner', 'Pre-Workout', 'Post-Workout', 'Morning Snack', 'Evening Snack'];
const DAY_NAMES  = [
    'Day 1 – Chest & Triceps',
    'Day 2 – Back & Biceps',
    'Day 3 – Legs',
    'Day 4 – Shoulders & Arms',
    'Day 5 – Full Body',
];

// ── Fallback library (seeded only when workspace has none) ────────────────────

const STUB_FOOD_ITEMS = [
    { name_en: 'Chicken Breast', kcal: 165, protein: 31,  carbs: 0,   fats: 3.6 },
    { name_en: 'White Rice',     kcal: 130, protein: 2.7, carbs: 28,  fats: 0.3 },
    { name_en: 'Broccoli',       kcal: 34,  protein: 2.8, carbs: 7,   fats: 0.4 },
    { name_en: 'Eggs',           kcal: 155, protein: 13,  carbs: 1.1, fats: 11  },
    { name_en: 'Oats',           kcal: 389, protein: 17,  carbs: 66,  fats: 7   },
    { name_en: 'Salmon',         kcal: 208, protein: 20,  carbs: 0,   fats: 13  },
];

const STUB_EXERCISES = [
    { name_en: 'Barbell Bench Press', muscle_group: 'Chest', equipment: 'Barbell' },
    { name_en: 'Barbell Deadlift',    muscle_group: 'Back',  equipment: 'Barbell' },
    { name_en: 'Barbell Back Squat',  muscle_group: 'Legs',  equipment: 'Barbell' },
    { name_en: 'Dumbbell Bench Press',muscle_group: 'Chest', equipment: 'Dumbbell' },
    { name_en: 'Bent-Over Row',       muscle_group: 'Back',  equipment: 'Barbell' },
    { name_en: 'Dumbbell Lunge',      muscle_group: 'Legs',  equipment: 'Dumbbell' },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function randInt(min: number, max: number): number {
    return Math.floor(min + Math.random() * (max - min + 1));
}

function dayOffset(n: number): Date {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + n);
    return d;
}

// ── Per-client builders ───────────────────────────────────────────────────────

function buildMeasurements(clientId: string): Prisma.client_measurementsCreateManyInput {
    const gender     = pick(GENDERS);
    const baseWeight = gender === 'male' ? randInt(65, 110) : randInt(50, 85);
    const baseHeight = gender === 'male' ? randInt(165, 190) : randInt(155, 175);

    return {
        id:             createId(),
        client_id:      clientId,
        gender,
        activity_level: pick(ACTIVITY_LEVELS),
        date_of_birth:  new Date(Date.now() - randInt(20, 45) * 365 * DAY),
        weight:         baseWeight,
        height:         baseHeight,
        neck:           gender === 'male' ? randInt(35, 45) : randInt(30, 38),
        waist:          gender === 'male' ? randInt(80, 105) : randInt(65, 90),
        hip:            gender === 'male' ? randInt(88, 110) : randInt(85, 115),
        updated_at:     new Date(),
    };
}

function buildObservations(
    clientId: string,
    workspaceId: string,
    count: number,
): Prisma.client_observationsCreateManyInput[] {
    return Array.from({ length: count }, () => {
        const text = pick(OBSERVATION_TEXTS);
        return {
            id:           createId(),
            client_id:    clientId,
            workspace_id: workspaceId,
            title:        text.slice(0, 60),
            content:      text,
            created_at:   new Date(Date.now() - randInt(0, 90) * DAY),
        };
    });
}

interface FoodItem { id: string }
interface Exercise { id: string; name: string }

function buildNutritionPlan(clientId: string, workspaceId: string, foods: FoodItem[]): {
    plan:   Prisma.nutrition_plansCreateManyInput;
    cycles: Prisma.nutrition_cyclesCreateManyInput[];
    meals:  Prisma.nutrition_mealsCreateManyInput[];
    items:  Prisma.nutrition_meal_itemsCreateManyInput[];
} {
    const planId = createId();
    const cycles: Prisma.nutrition_cyclesCreateManyInput[] = [];
    const meals:  Prisma.nutrition_mealsCreateManyInput[]  = [];
    const items:  Prisma.nutrition_meal_itemsCreateManyInput[] = [];

    const cycleCount = randInt(1, 2);
    for (let c = 0; c < cycleCount; c++) {
        const cycleId = createId();
        cycles.push({
            id:            cycleId,
            plan_id:       planId,
            name:          `Cycle ${c + 1}`,
            cycle_order:   c + 1,
            goal_calories: randInt(1800, 3000),
            goal_protein:  randInt(140, 220),
            goal_carbs:    randInt(180, 320),
            goal_fats:     randInt(50, 90),
        });

        const mealCount = randInt(3, 4);
        const mealNamesSample = [...MEAL_NAMES].sort(() => Math.random() - 0.5).slice(0, mealCount);
        for (let m = 0; m < mealCount; m++) {
            const mealId = createId();
            meals.push({ id: mealId, cycle_id: cycleId, name: mealNamesSample[m], meal_order: m + 1 });

            const itemCount = randInt(2, 3);
            for (let fi = 0; fi < itemCount; fi++) {
                items.push({
                    id:              createId(),
                    meal_id:         mealId,
                    food_item_id:    pick(foods).id,
                    amount:          randInt(80, 250),
                    meal_item_order: fi + 1,
                });
            }
        }
    }

    return {
        plan: {
            id:           planId,
            name:         'Nutrition Plan',
            client_id:    clientId,
            workspace_id: workspaceId,
            status:       'active',
            activated_at: new Date(Date.now() - randInt(5, 30) * DAY),
            created_at:   new Date(Date.now() - randInt(30, 90) * DAY),
        },
        cycles,
        meals,
        items,
    };
}

function buildTrainingPlan(clientId: string, workspaceId: string, exercises: Exercise[]): {
    plan:      Prisma.training_plansCreateManyInput;
    days:      Prisma.training_daysCreateManyInput[];
    exercises: Prisma.training_exercisesCreateManyInput[];
    sets:      Prisma.training_setsCreateManyInput[];
} {
    const planId = createId();
    const days:      Prisma.training_daysCreateManyInput[]      = [];
    const exRows:    Prisma.training_exercisesCreateManyInput[] = [];
    const sets:      Prisma.training_setsCreateManyInput[]      = [];

    const dayCount = randInt(3, 4);
    const dayNamesSample = DAY_NAMES.slice(0, dayCount);
    for (let d = 0; d < dayCount; d++) {
        const dayId = createId();
        days.push({ id: dayId, plan_id: planId, name: dayNamesSample[d], day_order: d + 1 });

        const exCount = randInt(3, 4);
        for (let e = 0; e < exCount; e++) {
            const lib  = pick(exercises);
            const exId = createId();
            exRows.push({
                id:                  exId,
                day_id:              dayId,
                name:                lib.name,
                exercise_order:      e + 1,
                exercise_library_id: lib.id,
            });

            const setCount = randInt(3, 4);
            for (let s = 0; s < setCount; s++) {
                sets.push({
                    id:           createId(),
                    exercise_id:  exId,
                    set_order:    s + 1,
                    reps:         String(randInt(6, 15)),
                    rest_seconds: randInt(60, 120),
                });
            }
        }
    }

    return {
        plan: {
            id:           planId,
            name:         'Training Plan',
            client_id:    clientId,
            workspace_id: workspaceId,
            status:       'active',
            activated_at: new Date(Date.now() - randInt(5, 30) * DAY),
            created_at:   new Date(Date.now() - randInt(30, 90) * DAY),
        },
        days,
        exercises: exRows,
        sets,
    };
}

function buildWorkoutLogs(clientId: string, workspaceId: string, count: number): Prisma.workout_logsCreateManyInput[] {
    return Array.from({ length: count }, (_, idx) => ({
        id:           createId(),
        client_id:    clientId,
        workspace_id: workspaceId,
        date:         dayOffset(-((idx + 1) * randInt(2, 6))),
        start_time:   `${String(randInt(6, 19)).padStart(2, '0')}:00`,
        end_time:     `${String(randInt(7, 21)).padStart(2, '0')}:00`,
        exercises:    [] as unknown as Prisma.InputJsonValue,
        completed:    true,
        created_at:   new Date(),
    }));
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
    if (!COUNT || COUNT < 1) throw new Error(`Invalid count: ${process.argv[3]}`);

    const workspace = await prisma.workspaces.findUnique({
        where: { slug: SLUG },
        select: { id: true, name: true },
    });
    if (!workspace) throw new Error(`Workspace "${SLUG}" not found`);
    const wsId = workspace.id;
    console.log(`\nTarget workspace: "${workspace.name}" (${SLUG})\n`);

    // ── Ensure food items ──────────────────────────────────────────────────────
    let rawFoods = await prisma.food_items.findMany({ where: { workspace_id: wsId }, select: { id: true } });
    if (rawFoods.length === 0) {
        console.log('No food items found — seeding minimal stubs...');
        await prisma.food_items.createMany({
            data: STUB_FOOD_ITEMS.map(f => ({
                id: createId(), workspace_id: wsId, name_en: f.name_en,
                calories_per_serving: f.kcal, protein_per_serving: f.protein,
                carbs_per_serving: f.carbs, fats_per_serving: f.fats,
                serving_size: 100, serving_unit: 'g',
            })),
        });
        rawFoods = await prisma.food_items.findMany({ where: { workspace_id: wsId }, select: { id: true } });
        console.log(`  Seeded ${rawFoods.length} food items.\n`);
    }
    const foods: FoodItem[] = rawFoods;

    // ── Ensure exercises ───────────────────────────────────────────────────────
    let rawExercises = await prisma.exercise_library.findMany({
        where: { workspace_id: wsId },
        select: { id: true, name_en: true },
    });
    if (rawExercises.length === 0) {
        console.log('No exercises found — seeding minimal stubs...');
        await prisma.exercise_library.createMany({
            data: STUB_EXERCISES.map(e => ({
                id: createId(), workspace_id: wsId, name_en: e.name_en,
                muscle_group: e.muscle_group, equipment: e.equipment,
            })),
        });
        rawExercises = await prisma.exercise_library.findMany({
            where: { workspace_id: wsId }, select: { id: true, name_en: true },
        });
        console.log(`  Seeded ${rawExercises.length} exercises.\n`);
    }
    const exercises: Exercise[] = rawExercises.map(e => ({ id: e.id, name: e.name_en }));

    // ── Load existing codes/emails (collision avoidance) ──────────────────────
    const existing = await prisma.clients.findMany({
        where: { workspace_id: wsId },
        select: { client_code: true, email: true },
    });
    const usedCodes  = new Set(existing.map(c => c.client_code));
    const usedEmails = new Set(existing.map(c => c.email.toLowerCase()));

    // ── Transaction helpers ────────────────────────────────────────────────────
    const maxAgg = await prisma.transactions.aggregate({
        where: { workspace_id: wsId },
        _max: { transaction_code: true },
    });
    let nextTxCode = (maxAgg._max.transaction_code ?? 0) + 1;

    const methodRows = await prisma.payment_methods.findMany({
        where: { workspace_id: wsId, active: true }, select: { name: true },
    });
    const methods = methodRows.length > 0 ? methodRows.map(m => m.name) : FALLBACK_METHODS;

    const variations = await prisma.package_variations.findMany({
        where: { active: true, packages: { workspace_id: wsId } },
        select: { name: true, packages: { select: { name: true } } },
    });
    const variationLabels = variations.map(v => `${v.packages.name} — ${v.name}`);

    let txVariety = 0;
    function makeTx(
        clientId: string,
        clientName: string,
        opts: { start: Date | null; duration: number | null; status: string; type?: string; createdAt: Date },
    ): Prisma.transactionsCreateManyInput {
        const label    = variationLabels.length > 0 ? variationLabels[txVariety % variationLabels.length] : null;
        const currency = CURRENCIES[txVariety % CURRENCIES.length];
        const amount   = 500 + (txVariety % 10) * 250;
        txVariety++;
        return {
            id:                      createId(),
            transaction_code:        nextTxCode++,
            workspace_id:            wsId,
            client_id:               clientId,
            client_name:             clientName,
            package_variation:       label,
            payment_method:          methods[txVariety % methods.length],
            amount,
            currency,
            duration:                opts.duration,
            type:                    opts.type || 'subscription',
            status:                  opts.status,
            transaction_date:        opts.start ?? opts.createdAt,
            created_at:              opts.createdAt,
            subscription_start_date: opts.start,
            start_mode:              opts.start ? 'custom' : 'on_first_plan',
        };
    }

    // Scenario repeats on a 10-cycle: 4× active, 2× expired, 1× frozen, 1× pre-start, 1× renewal, 1× none
    type Scenario = 'active' | 'expired' | 'frozen' | 'preStart' | 'renewal' | 'none';
    function pickScenario(i: number): Scenario {
        const r = i % 10;
        if (r < 4) return 'active';
        if (r < 6) return 'expired';
        if (r === 6) return 'frozen';
        if (r === 7) return 'preStart';
        if (r === 8) return 'renewal';
        return 'none';
    }

    const password = await bcrypt.hash('Password123!', 10);

    // ── Accumulation buffers ───────────────────────────────────────────────────
    const clientRows:        Prisma.clientsCreateManyInput[]                = [];
    const measurementRows:   Prisma.client_measurementsCreateManyInput[]    = [];
    const observationRows:   Prisma.client_observationsCreateManyInput[]    = [];
    const txRows:            Prisma.transactionsCreateManyInput[]           = [];
    const freezeRows:        Prisma.subscription_freezesCreateManyInput[]   = [];
    const nutritionPlans:    Prisma.nutrition_plansCreateManyInput[]        = [];
    const nutritionCycles:   Prisma.nutrition_cyclesCreateManyInput[]       = [];
    const nutritionMeals:    Prisma.nutrition_mealsCreateManyInput[]        = [];
    const nutritionItems:    Prisma.nutrition_meal_itemsCreateManyInput[]   = [];
    const trainingPlansRows: Prisma.training_plansCreateManyInput[]         = [];
    const trainingDays:      Prisma.training_daysCreateManyInput[]          = [];
    const trainingExercises: Prisma.training_exercisesCreateManyInput[]     = [];
    const trainingSets:      Prisma.training_setsCreateManyInput[]          = [];
    const workoutLogs:       Prisma.workout_logsCreateManyInput[]           = [];
    const packageUpdates:    Map<string, string>                            = new Map();

    // ── Build rows for all clients ─────────────────────────────────────────────
    for (let i = 0; i < COUNT; i++) {
        const fname = pick(FIRST_NAMES);
        const lname = pick(LAST_NAMES);

        let code = randInt(1, 9999);
        while (usedCodes.has(code)) code = randInt(1, 9999);
        usedCodes.add(code);

        let suffix = 0;
        let email  = `${fname}.${lname}.${code}@example.com`.toLowerCase().replace(/\s+/g, '');
        while (usedEmails.has(email)) {
            suffix++;
            email = `${fname}.${lname}.${code}-${suffix}@example.com`.toLowerCase().replace(/\s+/g, '');
        }
        usedEmails.add(email);

        const countryCode = pick(COUNTRY_CODES);
        const number      = String(Math.floor(1_000_000_000 + Math.random() * 8_999_999_999)).slice(0, 10);

        const clientId  = createId();
        const createdAt = new Date(Date.now() - randInt(30, 365) * DAY);

        clientRows.push({
            id:                  clientId,
            client_code:         code,
            fname,
            lname,
            email,
            phone:               `${countryCode} ${number}`,
            phones:              [{ countryCode, number }] as unknown as Prisma.InputJsonValue,
            subscription_status: 'No Subscriptions',
            workspace_id:        wsId,
            password,
            created_at:          createdAt,
        });

        measurementRows.push(buildMeasurements(clientId));
        observationRows.push(...buildObservations(clientId, wsId, randInt(1, 3)));

        // Transactions + freezes
        const scenario   = pickScenario(i);
        const clientName = `${fname} ${lname}`.trim();

        if (scenario === 'active') {
            const start = dayOffset(-10);
            const tx = makeTx(clientId, clientName, { start, duration: 30, status: 'completed', createdAt: start });
            txRows.push(tx);
            if (tx.package_variation) packageUpdates.set(clientId, tx.package_variation as string);
        } else if (scenario === 'expired') {
            const start = dayOffset(-120);
            const tx = makeTx(clientId, clientName, { start, duration: 30, status: 'completed', createdAt: start });
            txRows.push(tx);
            if (tx.package_variation) packageUpdates.set(clientId, tx.package_variation as string);
        } else if (scenario === 'frozen') {
            const start = dayOffset(-10);
            const tx = makeTx(clientId, clientName, { start, duration: 60, status: 'completed', createdAt: start });
            txRows.push(tx);
            if (tx.package_variation) packageUpdates.set(clientId, tx.package_variation as string);
            freezeRows.push({
                id:                   createId(),
                client_id:            clientId,
                freeze_start_date:    dayOffset(-3),
                freeze_duration_days: 14,
                notes:                'Seeded freeze (currently active)',
            });
        } else if (scenario === 'preStart') {
            const start = dayOffset(10);
            const tx = makeTx(clientId, clientName, { start, duration: 30, status: 'completed', createdAt: dayOffset(-1) });
            txRows.push(tx);
            if (tx.package_variation) packageUpdates.set(clientId, tx.package_variation as string);
        } else if (scenario === 'renewal') {
            const firstStart = dayOffset(-90);
            txRows.push(makeTx(clientId, clientName, { start: firstStart, duration: 30, status: 'completed', createdAt: firstStart }));
            const secondStart = dayOffset(-5);
            const tx2 = makeTx(clientId, clientName, { start: secondStart, duration: 30, status: 'completed', createdAt: secondStart });
            txRows.push(tx2);
            if (tx2.package_variation) packageUpdates.set(clientId, tx2.package_variation as string);
        }
        // 'none' — no transactions

        // Nutrition plan
        const np = buildNutritionPlan(clientId, wsId, foods);
        nutritionPlans.push(np.plan);
        nutritionCycles.push(...np.cycles);
        nutritionMeals.push(...np.meals);
        nutritionItems.push(...np.items);

        // Training plan
        const tp = buildTrainingPlan(clientId, wsId, exercises);
        trainingPlansRows.push(tp.plan);
        trainingDays.push(...tp.days);
        trainingExercises.push(...tp.exercises);
        trainingSets.push(...tp.sets);

        // Workout logs
        workoutLogs.push(...buildWorkoutLogs(clientId, wsId, randInt(3, 5)));
    }

    // ── Write everything in dependency order ───────────────────────────────────
    console.log(`Inserting data for ${COUNT} clients...`);

    const r1 = await prisma.clients.createMany({ data: clientRows, skipDuplicates: true });
    console.log(`  clients:             +${r1.count}`);

    const r2 = await prisma.client_measurements.createMany({ data: measurementRows, skipDuplicates: true });
    console.log(`  measurements:        +${r2.count}`);

    const r3 = await prisma.client_observations.createMany({ data: observationRows });
    console.log(`  observations:        +${r3.count}`);

    if (txRows.length > 0) {
        const r4 = await prisma.transactions.createMany({ data: txRows });
        console.log(`  transactions:        +${r4.count}`);
    }

    if (freezeRows.length > 0) {
        const r5 = await prisma.subscription_freezes.createMany({ data: freezeRows });
        console.log(`  subscription freezes:+${r5.count}`);
    }

    // Nutrition (parent → child order)
    const r6 = await prisma.nutrition_plans.createMany({ data: nutritionPlans });
    console.log(`  nutrition plans:     +${r6.count}`);
    const r7 = await prisma.nutrition_cycles.createMany({ data: nutritionCycles });
    console.log(`  nutrition cycles:    +${r7.count}`);
    const r8 = await prisma.nutrition_meals.createMany({ data: nutritionMeals });
    console.log(`  nutrition meals:     +${r8.count}`);
    const r9 = await prisma.nutrition_meal_items.createMany({ data: nutritionItems });
    console.log(`  nutrition meal items:+${r9.count}`);

    // Training (parent → child order)
    const r10 = await prisma.training_plans.createMany({ data: trainingPlansRows });
    console.log(`  training plans:      +${r10.count}`);
    const r11 = await prisma.training_days.createMany({ data: trainingDays });
    console.log(`  training days:       +${r11.count}`);
    const r12 = await prisma.training_exercises.createMany({ data: trainingExercises });
    console.log(`  training exercises:  +${r12.count}`);
    const r13 = await prisma.training_sets.createMany({ data: trainingSets });
    console.log(`  training sets:       +${r13.count}`);

    const r14 = await prisma.workout_logs.createMany({ data: workoutLogs });
    console.log(`  workout logs:        +${r14.count}`);

    // Stamp current_package on subscribed clients
    for (const [clientId, pkg] of packageUpdates) {
        await prisma.clients.update({ where: { id: clientId }, data: { current_package: pkg } });
    }

    console.log(`\nDone. ${r1.count} clients fully seeded into "${workspace.name}" (${SLUG}).`);

    const scenarioCounts = { active: 0, expired: 0, frozen: 0, preStart: 0, renewal: 0, none: 0 };
    for (let i = 0; i < COUNT; i++) {
        const s = pickScenario(i);
        scenarioCounts[s]++;
    }
    console.log(
        `\nSubscription scenarios:\n` +
        `  Active:       ${scenarioCounts.active}\n` +
        `  Expired:      ${scenarioCounts.expired}\n` +
        `  Frozen:       ${scenarioCounts.frozen}\n` +
        `  Pre-start:    ${scenarioCounts.preStart}\n` +
        `  Renewal:      ${scenarioCounts.renewal}\n` +
        `  No sub:       ${scenarioCounts.none}`,
    );
}

main()
    .catch(err => { console.error(err); process.exit(1); })
    .finally(() => prisma.$disconnect());
