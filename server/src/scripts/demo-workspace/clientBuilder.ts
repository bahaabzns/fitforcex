// Builds one complete demo client: identity, subscription, plans, logged activity, forms,
// notes and chat. Everything is pushed into the shared row buffers.

import { createId } from '@paralleldrive/cuid2';
import { buildFoodDiary, buildWorkoutLogs } from './activity';
import { buildFormActivity } from './forms';
import { buildNutritionPlan, buildTrainingPlan, type PlanTiming } from './plans';
import { createProfile, createTrajectory, type Trajectory } from './profile';
import { addDays, bell, chance, clampToNow, DAY, dateOnly, NOW, randInt } from './random';
import { buildObservations, buildThread } from './social';
import { buildSubscription, latestPeriod } from './subscription';
import type { BuildContext, BuiltNutritionPlan, BuiltTrainingPlan, Profile, Subscription } from './types';

const CURRENT_SCENARIOS = new Set(['active', 'expiringSoon', 'newClient']);
const ENROLLED_SCENARIOS = new Set(['active', 'expiringSoon', 'newClient', 'frozen']);

interface BuiltPlans { nutrition: BuiltNutritionPlan | null; training: BuiltTrainingPlan | null }

function planTimings(subscription: Subscription, cycleDays: number, reviewOffsetDays: number, createdBy: string): PlanTiming[] {
    const first = subscription.periods[0].start.getTime();
    const horizon = Math.min(NOW.getTime(), latestPeriod(subscription).end.getTime());
    const completedCycles = Math.max(0, Math.floor((horizon - first) / (cycleDays * DAY)));
    const activatedAt = clampToNow(new Date(first + completedCycles * cycleDays * DAY + randInt(1, 3) * DAY));
    const current: PlanTiming = { activatedAt, cycleDays, reviewOffsetDays, status: 'active', createdBy };
    if (completedCycles === 0 || !chance(0.4)) return [current];
    const previous: PlanTiming = { ...current, activatedAt: addDays(activatedAt, -cycleDays), status: 'inactive' };
    return [previous, current];
}

function buildPlans(ctx: BuildContext, profile: Profile, subscription: Subscription): BuiltPlans {
    const enrolled = subscription.hasStarted && (profile.scenario !== 'newClient' || chance(0.35));
    if (!enrolled) return { nutrition: null, training: null };

    const variation = latestPeriod(subscription).variation;
    const allowSwaps = ENROLLED_SCENARIOS.has(profile.scenario) && chance(0.5);
    let nutrition: BuiltNutritionPlan | null = null;
    let training: BuiltTrainingPlan | null = null;

    for (const timing of planTimings(subscription, variation.nutritionCycleDays, variation.reviewOffsetDays, profile.nutritionist.userId)) {
        nutrition = buildNutritionPlan(ctx, profile, timing, { compact: timing.status === 'inactive', allowSwaps: allowSwaps && timing.status === 'active' });
    }
    for (const timing of planTimings(subscription, variation.trainingCycleDays, variation.reviewOffsetDays, profile.trainer.userId)) {
        training = buildTrainingPlan(ctx, profile, { ...timing, createdBy: profile.trainer.userId });
    }
    return { nutrition, training };
}

function writeCheckInSchedules(ctx: BuildContext, profile: Profile, plans: BuiltPlans): void {
    if (!ENROLLED_SCENARIOS.has(profile.scenario)) return;
    const entries = [
        { form: ctx.forms.nutritionCheckin, type: 'nutrition', planId: plans.nutrition?.id },
        { form: ctx.forms.trainingCheckin, type: 'training', planId: plans.training?.id },
    ];
    for (const { form, type, planId } of entries) {
        if (!planId) continue;
        ctx.buffers.checkInSchedules.push({
            id: createId(), workspace_id: ctx.workspaceId, client_id: profile.id, form_id: form.id,
            next_due_at: new Date(NOW.getTime() + randInt(1, 13) * DAY), source_plan_type: type, source_plan_id: planId,
            paused_at: profile.scenario === 'frozen' ? new Date(NOW.getTime() - 2 * DAY) : null,
        });
    }
}

function writeClientRow(ctx: BuildContext, profile: Profile, subscription: Subscription, trajectory: Trajectory, latestWeight: number | null): void {
    const latest = subscription.periods.length > 0 ? latestPeriod(subscription).variation : null;
    const archived = profile.scenario === 'archived';
    ctx.buffers.clients.push({
        id: profile.id, client_code: profile.code, fname: profile.fname, lname: profile.lname, email: profile.email, phone: profile.phone,
        phones: profile.phones, workspace_id: ctx.workspaceId, created_at: subscription.createdAt, password: ctx.passwordHash,
        current_package: latest?.label ?? null, current_package_variation_id: latest?.id ?? null, subscription_status: subscription.status,
        archived_at: archived ? new Date(NOW.getTime() - randInt(5, 90) * DAY) : null, archived_by: archived ? ctx.ownerId : null,
    });
    const start = trajectory.readingAt(0);
    ctx.buffers.measurements.push({
        id: createId(), client_id: profile.id, gender: profile.isFemale ? 'female' : 'male', activity_level: profile.activityLevel,
        date_of_birth: dateOnly(Math.round(profile.age * 365.25 + randInt(0, 300))), weight: latestWeight ?? profile.startWeightKg,
        height: profile.heightCm, neck: Math.round(profile.isFemale ? bell(30, 36) : bell(36, 43)), waist: start.Waist, hip: start.Hip,
        updated_at: subscription.createdAt,
    });
}

function trackForOutput(ctx: BuildContext, profile: Profile, subscription: Subscription): void {
    const { collected } = ctx;
    collected.scenarioCounts[profile.scenario] = (collected.scenarioCounts[profile.scenario] ?? 0) + 1;
    if (profile.scenario === 'newClient') {
        collected.newClients.push({ clientId: profile.id, clientName: `${profile.fname} ${profile.lname}`, at: subscription.createdAt });
    }
    if (profile.scenario === 'active' && collected.sampleLogins.length < 3 && !/[؀-ۿ]/.test(profile.email + profile.fname)) {
        collected.sampleLogins.push(profile.email);
    }
}

export function buildClient(ctx: BuildContext, index: number): void {
    const profile = createProfile(ctx, index, createId());
    const subscription = buildSubscription(ctx, profile);
    profile.createdAt = subscription.createdAt;
    const trajectory = createTrajectory(profile);
    const plans = buildPlans(ctx, profile, subscription);

    if (subscription.hasStarted && plans.training) {
        const lastDay = new Date(Math.min(dateOnly(1).getTime(), latestPeriod(subscription).end.getTime()));
        buildWorkoutLogs(ctx, profile, plans.training, subscription.periods[0].start, lastDay);
    }
    if (plans.nutrition && CURRENT_SCENARIOS.has(profile.scenario)) buildFoodDiary(ctx, profile, plans.nutrition);
    writeCheckInSchedules(ctx, profile, plans);

    const forms = buildFormActivity(ctx, profile, subscription, plans.nutrition !== null, trajectory);
    writeClientRow(ctx, profile, subscription, trajectory, forms.latestWeight);

    if (subscription.periods.length > 0) {
        buildObservations(ctx, profile, subscription, {
            exerciseIds: plans.training?.days.flatMap((day) => day.exercises.map((exercise) => exercise.lib.id)) ?? [],
            foodIds: plans.nutrition?.cycles[0]?.items.map((item) => item.food.id) ?? [],
            requestIds: forms.reviewedRequestIds,
        });
    }
    buildThread(ctx, profile, subscription.createdAt);
    trackForOutput(ctx, profile, subscription);
}
