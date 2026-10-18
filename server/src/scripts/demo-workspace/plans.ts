// Nutrition and training plan builders. Plans are sized to the client's body and goal, built
// from the workspace's own food and exercise libraries, and written through the row buffers.

import { createId } from '@paralleldrive/cuid2';
import { Prisma } from '@prisma/client';
import type { ExerciseRef, FoodKind, FoodRef, Library } from './setup';
import { addDays, chance, daysAgo, pick, pickMany, rand, randInt, round } from './random';
import { dailyCalorieTarget } from './profile';
import type {
    BuildContext, BuiltCycle, BuiltDay, BuiltExercise, BuiltNutritionPlan, BuiltSet, BuiltTrainingPlan, FoodItemSnapshot, Profile,
} from './types';

export interface PlanTiming { activatedAt: Date; cycleDays: number; reviewOffsetDays: number; status: 'active' | 'inactive'; createdBy: string }

// ── Nutrition ──────────────────────────────────────────────────────────────
const MEAL_SETS: ReadonlyArray<ReadonlyArray<readonly [string, number]>> = [
    [['Breakfast', 0.25], ['Lunch', 0.33], ['Snack', 0.12], ['Dinner', 0.3]],
    [['Breakfast', 0.22], ['Lunch', 0.3], ['Pre-workout', 0.1], ['Post-workout', 0.14], ['Dinner', 0.24]],
];
const MEAL_NOTES = ['Eat within an hour of waking', 'Can be prepped the night before', 'Keep sauces to one tablespoon', 'Drink 500 ml of water with this meal'];
const NON_METRIC_UNITS = new Set(['g', 'gram', 'grams', 'ml', 'gm']);

function foodsOfKind(foods: FoodRef[], kind: FoodKind): FoodRef[] {
    const matches = foods.filter((food) => food.kind === kind);
    return matches.length > 0 ? matches : foods;
}

/** Amount (in the food's own serving unit) that supplies roughly `kcal` calories. */
function amountForCalories(food: FoodRef, kcal: number): number {
    const servings = kcal / food.kcal;
    const isWeight = !food.servingUnit || NON_METRIC_UNITS.has(food.servingUnit.toLowerCase());
    if (isWeight) return Math.min(400, Math.max(20, Math.round((servings * food.servingSize) / 5) * 5));
    return food.servingSize * Math.min(4, Math.max(1, Math.round(servings)));
}

interface MealBlueprint { name: string; items: Array<{ food: FoodRef; amount: number }> }

function buildMeal(library: Library, name: string, mealKcal: number): MealBlueprint {
    const protein = pick(foodsOfKind(library.foods, 'protein'));
    const carb = pick(foodsOfKind(library.foods, 'carb'));
    const items = [
        { food: protein, amount: amountForCalories(protein, mealKcal * 0.38) },
        { food: carb, amount: amountForCalories(carb, mealKcal * 0.4) },
    ];
    if (chance(0.8)) {
        const side = pick(foodsOfKind(library.foods, chance(0.6) ? 'veg' : 'fat'));
        items.push({ food: side, amount: amountForCalories(side, mealKcal * 0.22) });
    }
    return { name, items };
}

interface CycleTargets { name: string; kcal: number; protein: number; carbs: number; fats: number }

function cycleTargets(profile: Profile): CycleTargets[] {
    const training = dailyCalorieTarget(profile);
    const rest = Math.round((training * 0.92) / 50) * 50;
    const make = (name: string, kcal: number): CycleTargets => {
        const protein = Math.round(profile.startWeightKg * (profile.goal === 'fat_loss' ? 2.2 : 1.9));
        const fats = Math.round(profile.startWeightKg * 0.9);
        const carbs = Math.max(80, Math.round((kcal - protein * 4 - fats * 9) / 4));
        return { name, kcal, protein, carbs, fats };
    };
    return [make('Training days', training), make('Rest days', rest)];
}

export interface NutritionOptions { compact: boolean; allowSwaps: boolean }

export function buildNutritionPlan(ctx: BuildContext, profile: Profile, timing: PlanTiming, options: NutritionOptions): BuiltNutritionPlan {
    const { buffers } = ctx;
    const planId = createId();
    const cycleEndAt = addDays(timing.activatedAt, timing.cycleDays);
    const reviewDue = addDays(cycleEndAt, -timing.reviewOffsetDays);

    buffers.nutritionPlans.push({
        id: planId, name: 'Nutrition Plan', client_id: profile.id, workspace_id: ctx.workspaceId, status: timing.status,
        created_at: addDays(timing.activatedAt, -1), updated_at: timing.activatedAt, activated_at: timing.activatedAt, created_by: timing.createdBy,
        cycle_days: timing.cycleDays, cycle_end_at: cycleEndAt, review_offset_days: timing.reviewOffsetDays,
        review_notified_at: reviewDue.getTime() < Date.now() ? reviewDue : null, last_edited_by: timing.createdBy,
    });

    const cycles: BuiltCycle[] = [];
    const targets = options.compact ? cycleTargets(profile).slice(0, 1) : cycleTargets(profile);
    targets.forEach((target, cycleIndex) => {
        const cycleId = createId();
        buffers.nutritionCycles.push({
            id: cycleId, plan_id: planId, name: target.name, cycle_order: cycleIndex + 1, goal_calories: target.kcal,
            goal_protein: target.protein, goal_carbs: target.carbs, goal_fats: target.fats,
            note: cycleIndex === 0 ? 'Eat to the plan on training days, weigh food raw where possible' : null,
        });
        const items = writeMeals(ctx, profile, cycleId, target.kcal, options);
        cycles.push({ id: cycleId, name: target.name, goalCalories: target.kcal, goalProtein: target.protein, goalCarbs: target.carbs, goalFats: target.fats, items });
    });
    return { id: planId, cycles, activatedAt: timing.activatedAt, cycleEndAt };
}

function writeMeals(ctx: BuildContext, profile: Profile, cycleId: string, dayKcal: number, options: NutritionOptions): FoodItemSnapshot[] {
    const { buffers, library } = ctx;
    const mealSet = options.compact ? MEAL_SETS[0] : pick(MEAL_SETS);
    const snapshots: FoodItemSnapshot[] = [];

    mealSet.forEach(([name, share], mealIndex) => {
        const mealId = createId();
        buffers.nutritionMeals.push({ id: mealId, cycle_id: cycleId, name, meal_order: mealIndex + 1, note: chance(0.15) ? pick(MEAL_NOTES) : null });
        buildMeal(library, name, dayKcal * share).items.forEach(({ food, amount }, itemIndex) => {
            const itemId = createId();
            const swap = options.allowSwaps && chance(0.05) ? pickSwap(library.foods, food, amount) : null;
            const served = swap?.food ?? food;
            const servedAmount = swap?.amount ?? amount;
            buffers.nutritionItems.push({
                id: itemId, meal_id: mealId, food_item_id: served.id, amount: servedAmount, meal_item_order: itemIndex + 1,
                ...(swap ? { original_food_item_id: food.id, original_amount: amount, is_swapped: true, swapped_at: daysAgo(randInt(0, 10)), swapped_by_client_id: profile.id } : {}),
            });
            if (swap) {
                buffers.swapHistory.push({
                    id: createId(), meal_item_id: itemId, client_id: profile.id, from_food_item_id: food.id, to_food_item_id: swap.food.id,
                    from_amount: amount, to_amount: swap.amount, action: 'swap', created_at: daysAgo(randInt(0, 10)),
                });
            }
            snapshots.push({ mealItemId: itemId, food: served, mealName: name, amount: servedAmount });
            if (!options.compact && !swap && chance(0.35)) writeAlternatives(ctx, itemId, food, amount);
        });
    });
    return snapshots;
}

function pickSwap(foods: FoodRef[], food: FoodRef, amount: number): { food: FoodRef; amount: number } | null {
    const candidates = foodsOfKind(foods, food.kind).filter((candidate) => candidate.id !== food.id);
    if (candidates.length === 0) return null;
    const replacement = pick(candidates);
    return { food: replacement, amount: amountForCalories(replacement, (amount / food.servingSize) * food.kcal) };
}

function writeAlternatives(ctx: BuildContext, mealItemId: string, food: FoodRef, amount: number) {
    const pool = foodsOfKind(ctx.library.foods, food.kind).filter((candidate) => candidate.id !== food.id);
    pickMany(pool, randInt(1, 2)).forEach((alternative, index) => {
        const kcal = (amount / food.servingSize) * food.kcal;
        ctx.buffers.nutritionAlternatives.push({
            id: createId(), meal_item_id: mealItemId, food_item_id: alternative.id, amount: amountForCalories(alternative, kcal), alt_order: index + 1,
        });
    });
}

// ── Training ───────────────────────────────────────────────────────────────
type DayTemplate = { name: string; groups: string[] };
const T = {
    fullBody: { name: 'Full Body', groups: ['Chest', 'Back', 'Quadriceps', 'Shoulders', 'Hamstrings', 'Abs'] },
    upper: { name: 'Upper Body', groups: ['Chest', 'Back', 'Shoulders', 'Biceps', 'Triceps', 'Back'] },
    lower: { name: 'Lower Body', groups: ['Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Abs'] },
    glutes: { name: 'Glutes & Hamstrings', groups: ['Glutes', 'Glutes', 'Hamstrings', 'Quadriceps', 'Glutes', 'Abs'] },
    push: { name: 'Push', groups: ['Chest', 'Chest', 'Shoulders', 'Shoulders', 'Triceps', 'Triceps'] },
    pull: { name: 'Pull', groups: ['Back', 'Back', 'Back', 'Biceps', 'Biceps', 'Shoulders'] },
    legs: { name: 'Legs', groups: ['Quadriceps', 'Quadriceps', 'Hamstrings', 'Glutes', 'Calves', 'Abs'] },
} satisfies Record<string, DayTemplate>;

function splitFor(profile: Profile): DayTemplate[] {
    const lowerDay = profile.isFemale ? T.glutes : T.lower;
    switch (profile.daysPerWeek) {
        case 3: return [T.fullBody, T.fullBody, T.fullBody];
        case 4: return [T.upper, lowerDay, T.upper, T.legs];
        case 5: return [T.push, T.pull, T.legs, T.upper, lowerDay];
        default: return [T.push, T.pull, T.legs, T.push, T.pull, lowerDay];
    }
}

const GROUP_ALIASES: Record<string, string[]> = {
    quadriceps: ['quadriceps', 'quads', 'legs'], hamstrings: ['hamstrings', 'legs'], glutes: ['glutes', 'legs'],
    calves: ['calves', 'legs'], biceps: ['biceps', 'arms'], triceps: ['triceps', 'arms'], abs: ['abs', 'core'],
};
const EXERCISE_NOTES = ['Control the lowering phase', 'Pause for one second at the bottom', 'Stop one rep before failure', 'Keep your core braced'];
const DAY_NOTES = ['Warm up for 10 minutes before the first exercise', 'Stretch for 5 minutes at the end'];

function exercisePool(exercises: ExerciseRef[], group: string): ExerciseRef[] {
    const wanted = GROUP_ALIASES[group.toLowerCase()] ?? [group.toLowerCase()];
    const strength = exercises.filter((exercise) => exercise.trackingType !== 'time_based');
    const matches = strength.filter((exercise) => wanted.includes(exercise.muscleGroup.toLowerCase()));
    return matches.length > 0 ? matches : strength;
}

function setsFor(exercise: ExerciseRef, position: number, profile: Profile): BuiltSet[] {
    if (exercise.trackingType === 'time_based') {
        return [{
            repsLow: 0, repsHigh: 0, restSeconds: 0, rir: null, durationSeconds: randInt(15, 30) * 60,
            distanceKm: exercise.trackedMetrics.includes('distance_km') ? round(randInt(15, 40) / 10, 1) : null,
            inclinePercent: exercise.trackedMetrics.includes('incline_percent') ? randInt(1, 6) : null,
            speedKmh: exercise.trackedMetrics.includes('speed_kmh') ? round(randInt(55, 95) / 10, 1) : null,
        }];
    }
    const compound = position === 0;
    const [repsLow, repsHigh] = compound ? (profile.goal === 'muscle_gain' ? [6, 8] : [8, 10]) : position >= 4 ? [12, 15] : [10, 12];
    const setCount = compound ? 4 : randInt(3, 4);
    return Array.from({ length: setCount }, () => ({
        repsLow, repsHigh, restSeconds: compound ? 120 : 75, rir: pick([1, 2, 2, 3]), durationSeconds: null, distanceKm: null, inclinePercent: null, speedKmh: null,
    }));
}

function writeExercise(ctx: BuildContext, dayId: string, lib: ExerciseRef, position: number, profile: Profile, pool: ExerciseRef[]): BuiltExercise {
    const { buffers } = ctx;
    const id = createId();
    buffers.trainingExercises.push({
        id, day_id: dayId, name: lib.nameEn, exercise_order: position + 1, equipment: lib.equipment, exercise_library_id: lib.id,
        notes: chance(0.2) ? pick(EXERCISE_NOTES) : null,
    });
    const sets = setsFor(lib, position, profile);
    sets.forEach((set, setIndex) => {
        const timed = set.durationSeconds !== null;
        const row: Prisma.training_setsCreateManyInput = {
            id: createId(), exercise_id: id, set_order: setIndex + 1, rest_seconds: timed ? null : set.restSeconds,
            reps: timed ? null : set.repsLow === set.repsHigh ? String(set.repsLow) : `${set.repsLow}-${set.repsHigh}`,
            rir: set.rir, tempo: !timed && chance(0.15) ? '3-0-1-0' : null, duration_seconds: set.durationSeconds,
            distance_km: set.distanceKm, incline_percent: set.inclinePercent, speed_kmh: set.speedKmh,
        };
        buffers.trainingSets.push(row);
    });
    if (!sets[0].durationSeconds && chance(0.25)) {
        pickMany(pool.filter((candidate) => candidate.id !== lib.id), randInt(1, 2)).forEach((alternative, altIndex) => {
            buffers.trainingAlternatives.push({ id: createId(), exercise_id: id, exercise_library_id: alternative.id, alt_order: altIndex + 1 });
        });
    }
    return { id, lib, sets };
}

function cardioFinisher(exercises: ExerciseRef[]): ExerciseRef | null {
    const cardio = exercises.filter((exercise) => exercise.trackingType === 'time_based');
    return cardio.length > 0 ? pick(cardio) : null;
}

export function buildTrainingPlan(ctx: BuildContext, profile: Profile, timing: PlanTiming): BuiltTrainingPlan {
    const { buffers, library } = ctx;
    const planId = createId();
    const cycleEndAt = addDays(timing.activatedAt, timing.cycleDays);
    const reviewDue = addDays(cycleEndAt, -timing.reviewOffsetDays);

    buffers.trainingPlans.push({
        id: planId, name: 'Training Plan', client_id: profile.id, workspace_id: ctx.workspaceId, status: timing.status,
        notes: chance(0.3) ? `Phase focus: ${profile.goal.replace('_', ' ')}. Log every set so we can progress the loads.` : null,
        created_at: addDays(timing.activatedAt, -1), updated_at: timing.activatedAt, activated_at: timing.activatedAt, created_by: timing.createdBy,
        cycle_days: timing.cycleDays, cycle_end_at: cycleEndAt, review_offset_days: timing.reviewOffsetDays,
        review_notified_at: reviewDue.getTime() < Date.now() ? reviewDue : null,
    });

    const days: BuiltDay[] = splitFor(profile).map((template, dayIndex) => {
        const dayId = createId();
        buffers.trainingDays.push({
            id: dayId, plan_id: planId, name: `Day ${dayIndex + 1} · ${template.name}`, day_order: dayIndex + 1,
            notes: chance(0.25) ? pick(DAY_NOTES) : null,
        });
        const chosen = new Set<string>();
        const exercises: BuiltExercise[] = [];
        template.groups.forEach((group) => {
            const pool = exercisePool(library.exercises, group);
            const lib = pickMany(pool.filter((candidate) => !chosen.has(candidate.id)), 1)[0] ?? pick(pool);
            chosen.add(lib.id);
            exercises.push(writeExercise(ctx, dayId, lib, exercises.length, profile, pool));
        });
        const finisher = rand() < 0.45 ? cardioFinisher(library.exercises) : null;
        if (finisher) exercises.push(writeExercise(ctx, dayId, finisher, exercises.length, profile, []));
        return { id: dayId, name: template.name, exercises };
    });
    return { id: planId, days, activatedAt: timing.activatedAt, cycleEndAt };
}
