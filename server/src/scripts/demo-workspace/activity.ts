// What the client actually did: logged workouts (with progressive overload) and food diary days.

import { createId } from '@paralleldrive/cuid2';
import { Prisma } from '@prisma/client';
import { computeTotals, type FoodDiaryItem } from '../../utils/foodDiaryStats';
import { chance, dateOnly, DAY, MINUTE, NOW, pick, rand, randInt, round, withDaytime } from './random';
import type { BuildContext, BuiltDay, BuiltExercise, BuiltNutritionPlan, BuiltTrainingPlan, Profile } from './types';

const MAX_LOGS_PER_CLIENT = 40;
const LOG_WINDOW_DAYS = 84;
const LOG_NOTES = ['Felt strong today', 'Short on time, cut one exercise', 'Slept badly, kept the weights lighter', 'New PR on the first lift', 'Gym was crowded'];
const TRAINING_WEEKDAYS: Record<number, number[]> = { 3: [1, 3, 5], 4: [1, 2, 4, 6], 5: [1, 2, 3, 5, 6], 6: [1, 2, 3, 4, 6, 0] };

const LEVEL_FACTOR = { Beginner: 0.6, Intermediate: 1, Advanced: 1.4 } as const;
const GROUP_LOAD: Record<string, number> = {
    quadriceps: 0.85, legs: 0.85, hamstrings: 0.65, glutes: 0.8, back: 0.55, chest: 0.6, shoulders: 0.32, biceps: 0.2, triceps: 0.25, calves: 0.6,
};

function baseWeight(exercise: BuiltExercise, profile: Profile): number | null {
    if (exercise.lib.equipment?.toLowerCase() === 'bodyweight' || exercise.lib.muscleGroup.toLowerCase() === 'abs') return null;
    const factor = GROUP_LOAD[exercise.lib.muscleGroup.toLowerCase()] ?? 0.3;
    const raw = profile.startWeightKg * factor * LEVEL_FACTOR[profile.level] * (profile.isFemale ? 0.6 : 1);
    return Math.max(2.5, Math.round(raw / 2.5) * 2.5);
}

function loggedExercise(exercise: BuiltExercise, profile: Profile, weeksIn: number) {
    const timed = exercise.lib.trackingType === 'time_based';
    const base = baseWeight(exercise, profile);
    const load = base === null ? null : Math.round((base * (1 + 0.015 * weeksIn)) / 2.5) * 2.5;
    const sets = exercise.sets.map((set, index) => ({
        set_order: index + 1,
        weight: timed ? null : load,
        reps: timed ? null : randInt(set.repsLow, set.repsHigh),
        rir: timed ? null : set.rir,
        rpe: null,
        rest_seconds: timed ? null : set.restSeconds,
        duration_seconds: set.durationSeconds,
        distance_km: set.distanceKm,
        incline_percent: set.inclinePercent,
        speed_kmh: set.speedKmh,
        completed: chance(0.97),
    }));
    return {
        exercise_id: exercise.id, exercise_library_id: exercise.lib.id, name: exercise.lib.nameEn, library_name_en: exercise.lib.nameEn,
        library_name_ar: exercise.lib.nameAr, note: null, tracking_type: exercise.lib.trackingType, tracked_metrics: exercise.lib.trackedMetrics, sets,
    };
}

function clock(date: Date): string {
    return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

/** `since` is when the client started training with the coach: history reaches back past the current plan cycle. */
export function buildWorkoutLogs(ctx: BuildContext, profile: Profile, plan: BuiltTrainingPlan, since: Date, lastDay: Date): void {
    const firstDay = new Date(Math.max(since.getTime(), NOW.getTime() - LOG_WINDOW_DAYS * DAY));
    const weekdays = TRAINING_WEEKDAYS[profile.daysPerWeek] ?? TRAINING_WEEKDAYS[4];
    const startHour = pick([6, 7, 8, 13, 17, 18, 19, 20]);
    const days: BuiltDay[] = plan.days;
    let sessionCount = 0;

    const dates: Date[] = [];
    for (let t = Date.UTC(firstDay.getUTCFullYear(), firstDay.getUTCMonth(), firstDay.getUTCDate()); t <= lastDay.getTime(); t += DAY) {
        dates.push(new Date(t));
    }
    // Most recent sessions win when a long-tenured, highly adherent client would exceed the cap.
    const sessions = dates.filter((date) => weekdays.includes(date.getUTCDay()) && chance(profile.adherence * 0.95)).slice(-MAX_LOGS_PER_CLIENT);

    for (const date of sessions) {
        const day = days[sessionCount % days.length];
        const weeksIn = Math.max(0, Math.floor((date.getTime() - since.getTime()) / (7 * DAY)));
        const start = new Date(date.getTime() + startHour * 3_600_000 + randInt(0, 40) * MINUTE);
        const end = new Date(start.getTime() + randInt(42, 85) * MINUTE);
        const kept = chance(0.12) ? day.exercises.slice(0, -1) : day.exercises;
        ctx.buffers.workoutLogs.push({
            id: createId(), client_id: profile.id, workspace_id: ctx.workspaceId, plan_id: plan.id, day_id: day.id,
            day_index: sessionCount % days.length, date, start_time: clock(start), end_time: clock(end),
            exercises: kept.map((exercise) => loggedExercise(exercise, profile, weeksIn)) as unknown as Prisma.InputJsonValue,
            notes: chance(0.12) ? pick(LOG_NOTES) : null, completed: true, created_at: end,
        });
        sessionCount++;
    }
}

export function buildFoodDiary(ctx: BuildContext, profile: Profile, plan: BuiltNutritionPlan): void {
    const dayCount = randInt(6, 24);
    const presence = 0.45 + profile.adherence * 0.5;
    const [training, rest] = [plan.cycles[0], plan.cycles[1] ?? plan.cycles[0]];

    for (let daysBack = 1; daysBack <= dayCount; daysBack++) {
        if (!chance(presence)) continue;
        const date = dateOnly(daysBack);
        if (date.getTime() < plan.activatedAt.getTime() - DAY) continue;
        const cycle = [1, 2, 4, 6].includes(date.getUTCDay()) ? training : rest;

        const items: FoodDiaryItem[] = cycle.items.map(({ mealItemId, food, mealName, amount }) => {
            const skipped = chance((1 - profile.adherence) * 0.3);
            const ratio = skipped ? 0 : profile.adherence > 0.75 ? 0.92 + rand() * 0.14 : 0.55 + profile.adherence * 0.4 + rand() * 0.1;
            return {
                meal_item_id: mealItemId, food_item_id: food.id, meal_name: mealName, name_en: food.nameEn, name_ar: food.nameAr,
                prescribed_amount: amount, amount_eaten: round(amount * ratio, 0), serving_unit: food.servingUnit, serving_size: food.servingSize,
                calories_per_serving: food.kcal, protein_per_serving: food.protein, carbs_per_serving: food.carbs, fats_per_serving: food.fats,
            };
        });
        const totals = computeTotals(items);
        ctx.buffers.foodDiary.push({
            id: createId(), client_id: profile.id, workspace_id: ctx.workspaceId, plan_id: plan.id, cycle_id: cycle.id, date,
            items: items as unknown as Prisma.InputJsonValue, total_calories: round(totals.calories, 0), total_protein: round(totals.protein, 1),
            total_carbs: round(totals.carbs, 1), total_fats: round(totals.fats, 1), goal_calories: cycle.goalCalories, goal_protein: cycle.goalProtein,
            goal_carbs: cycle.goalCarbs, goal_fats: cycle.goalFats, created_at: withDaytime(date, 7, 12), updated_at: withDaytime(date, 19, 23),
        });
    }
}
