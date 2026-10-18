// Form activity per client: onboarding assessments, fortnightly check-ins and measurement
// readings. The most recent check-in of each client is deliberately left in a mix of states
// (needs action, awaiting the client, scheduled) so the Plans Queue and Operations pages are busy.

import { createId } from '@paralleldrive/cuid2';
import { chance, clampToNow, DAY, daysAgo, HOUR, NOW, pick, pickMany, rand, randInt, round, withDaytime } from './random';
import { EXPERIENCE_LEVELS, TEXT_ANSWERS } from './pools';
import type { DemoForm, FormQuestionRef } from './setup';
import { latestPeriod } from './subscription';
import type { Trajectory } from './profile';
import type { BuildContext, Profile, Subscription } from './types';

const CHECKIN_INTERVAL_DAYS = 14;
const MAX_CHECKINS_PER_FORM = 4;
const MAX_PROGRESS_READINGS = 8;
const ARCHIVE_AFTER_DAYS = 7;
const GOAL_LABEL = { fat_loss: 'Lose fat', muscle_gain: 'Build muscle', recomp: 'Build muscle', general: 'General fitness' } as const;
const ARABIC_TEXT = TEXT_ANSWERS.filter((text) => /[؀-ۿ]/.test(text));
const ENGLISH_TEXT = TEXT_ANSWERS.filter((text) => !/[؀-ۿ]/.test(text));

type RequestStatus = 'pending' | 'scheduled' | 'submitted' | 'reviewed';
interface RequestSpec {
    form: DemoForm; status: RequestStatus; requestedAt: Date; submittedAt: Date | null; scheduledAt?: Date;
    assignee: string; reviewedBy?: string; reviewedAt?: Date; archivedAt?: Date | null; labelId?: string | null;
    reading?: Record<string, number>;
}

export interface FormActivity { reviewedRequestIds: string[]; latestWeight: number | null; hasOpenWork: boolean }

// ── Answers ────────────────────────────────────────────────────────────────
function answerNumber(question: FormQuestionRef, profile: Profile, reading: Record<string, number> | undefined): string {
    const label = question.labelEn.toLowerCase();
    if (label.includes('target weight')) return String(Math.round(profile.startWeightKg * (profile.goal === 'muscle_gain' ? 1.05 : 0.92)));
    if (label.includes('weight')) return String(reading?.Weight ?? profile.startWeightKg);
    if (label.includes('days per week')) return String(profile.daysPerWeek);
    if (label.includes('session')) return String(Math.max(1, Math.round(profile.daysPerWeek * (0.5 + profile.adherence * 0.5))));
    if (label.includes('sleep')) return String(randInt(5, 8));
    if (label.includes('water')) return String(round(1.5 + profile.adherence * 2, 1));
    if (label.includes('meals per day')) return String(randInt(3, 5));
    if (label.includes('off-plan')) return String(Math.round((1 - profile.adherence) * 5));
    return String(randInt(1, 10));
}

function answerSelect(question: FormQuestionRef, profile: Profile): string | null {
    const label = question.labelEn.toLowerCase();
    if (question.options.length === 0) return null;
    if (label.includes('experience')) return EXPERIENCE_LEVELS.includes(profile.level) ? profile.level : pick(question.options);
    if (label.includes('goal')) {
        const wanted = GOAL_LABEL[profile.goal];
        return question.options.includes(wanted) ? wanted : pick(question.options);
    }
    if (label.includes('follow the plan')) {
        const index = profile.adherence > 0.8 ? 0 : profile.adherence > 0.55 ? 1 : profile.adherence > 0.35 ? 2 : 3;
        return question.options[Math.min(index, question.options.length - 1)];
    }
    return pick(question.options);
}

function answerFor(ctx: BuildContext, question: FormQuestionRef, profile: Profile, reading?: Record<string, number>): string | null {
    switch (question.type) {
        case 'metric': {
            const name = Object.values(ctx.metrics).find((metric) => metric.id === question.metricId)?.name;
            return name && reading?.[name] !== undefined ? String(reading[name]) : null;
        }
        case 'number': return answerNumber(question, profile, reading);
        case 'scale': {
            const high = question.max ?? 10;
            const score = Math.round((question.labelEn.toLowerCase().includes('soreness') || question.labelEn.toLowerCase().includes('hunger') ? 0.6 - profile.adherence * 0.2 : 0.4 + profile.adherence * 0.5) * high + (rand() - 0.5) * 2);
            return String(Math.min(high, Math.max(question.min ?? 1, score)));
        }
        case 'select': return answerSelect(question, profile);
        case 'multiselect': return question.options.length > 0 ? pickMany(question.options, randInt(1, Math.min(3, question.options.length))).join(', ') : null;
        default: return chance(0.85) ? pick(profile.prefersArabic && chance(0.6) ? ARABIC_TEXT : ENGLISH_TEXT) : null;
    }
}

// ── Request writer ─────────────────────────────────────────────────────────
function addRequest(ctx: BuildContext, profile: Profile, spec: RequestSpec): string {
    const { buffers } = ctx;
    const id = createId();
    buffers.formRequests.push({
        id, workspace_id: ctx.workspaceId, form_id: spec.form.id, form_version_id: spec.form.versionId, client_id: profile.id, status: spec.status,
        requested_at: spec.requestedAt, submitted_at: spec.submittedAt, scheduled_at: spec.scheduledAt ?? null, post_action: spec.form.postAction,
        assigned_to: spec.assignee, action_taken_at: spec.reviewedAt ?? null, action_taken_by: spec.reviewedBy ?? null,
        archived_at: spec.archivedAt ?? null, archived_by: spec.archivedAt ? ctx.ownerId : null, label_id: spec.labelId ?? null,
    });
    if (!spec.submittedAt) return id;

    spec.form.questions.forEach((question) => {
        const answer = answerFor(ctx, question, profile, spec.reading);
        if (answer === null) return;
        const responseId = createId();
        buffers.formResponses.push({
            id: responseId, request_id: id, question_id: question.id, answer, created_at: spec.submittedAt, metric_id: question.metricId,
        });
        if (question.type === 'number' && !question.metricId && chance(0.02)) {
            buffers.responseEdits.push({
                id: createId(), response_id: responseId, previous_answer: String(Number(answer) + randInt(1, 3)), new_answer: answer,
                edited_at: new Date(spec.submittedAt!.getTime() + HOUR), edited_by_client_id: profile.id,
            });
        }
    });
    return id;
}

/** Latest-check-in state: most are done, a few are waiting on the coach or the client. */
function rollOpenState(replied: boolean): 'submitted' | 'pending' | 'reviewed' | 'skipped' {
    if (!replied) return chance(0.4) ? 'pending' : 'skipped';
    const roll = rand();
    return roll < 0.1 ? 'submitted' : roll < 0.15 ? 'pending' : 'reviewed';
}

function reviewFields(ctx: BuildContext, profile: Profile, form: DemoForm, submittedAt: Date) {
    const assignee = form.postAction === 'nutrition-plan' ? profile.nutritionist.userId : profile.trainer.userId;
    const reviewedAt = clampToNow(new Date(submittedAt.getTime() + randInt(4, 60) * HOUR));
    // The queue endpoint returns every non-archived request in one response, so a tidy coach (and a fast
    // demo) means finished items older than a week are archived; they stay in the archive view and on the client.
    const archivedAt = NOW.getTime() - reviewedAt.getTime() > ARCHIVE_AFTER_DAYS * DAY && chance(0.97)
        ? new Date(Math.min(NOW.getTime() - HOUR, reviewedAt.getTime() + randInt(1, 5) * DAY))
        : null;
    return { assignee, reviewedBy: chance(0.1) ? ctx.ownerId : assignee, reviewedAt, archivedAt };
}

function trackOpen(ctx: BuildContext, profile: Profile, requestId: string, form: DemoForm, at: Date, assignee: string) {
    ctx.collected.submittedRequests.push({ requestId, clientId: profile.id, clientName: `${profile.fname} ${profile.lname}`, at, assignee, formTitle: form.title });
}

// ── Timeline ───────────────────────────────────────────────────────────────
function writeAssessments(ctx: BuildContext, profile: Profile, subscription: Subscription, plansReady: boolean, ids: string[]): boolean {
    const firstStart = subscription.periods[0].start;
    const requestedAt = clampToNow(withDaytime(new Date(Math.max(subscription.createdAt.getTime(), firstStart.getTime() - 4 * DAY)), 9, 20));
    let hasOpenWork = false;

    for (const form of [ctx.forms.trainingAssessment, ctx.forms.nutritionAssessment]) {
        const submittedAt = new Date(requestedAt.getTime() + randInt(2, 40) * HOUR);
        const assignee = form.postAction === 'nutrition-plan' ? profile.nutritionist.userId : profile.trainer.userId;
        const open = profile.scenario === 'preStart' || (profile.scenario === 'newClient' && !plansReady);
        if (profile.scenario === 'preStart' && chance(0.5)) {
            addRequest(ctx, profile, { form, status: 'pending', requestedAt, submittedAt: null, assignee });
        } else if (open || submittedAt.getTime() > NOW.getTime()) {
            const at = clampToNow(submittedAt);
            const id = addRequest(ctx, profile, { form, status: 'submitted', requestedAt, submittedAt: at, assignee, labelId: chance(0.25) ? pick(ctx.labels).id : null });
            trackOpen(ctx, profile, id, form, at, assignee);
            hasOpenWork = true;
        } else {
            ids.push(addRequest(ctx, profile, { form, status: 'reviewed', requestedAt, submittedAt, ...reviewFields(ctx, profile, form, submittedAt) }));
        }
    }
    return hasOpenWork;
}

function checkpointDates(subscription: Subscription): Date[] {
    const horizon = Math.min(NOW.getTime(), latestPeriod(subscription).end.getTime());
    const dates: Date[] = [];
    for (let t = subscription.periods[0].start.getTime() + CHECKIN_INTERVAL_DAYS * DAY; t <= horizon; t += CHECKIN_INTERVAL_DAYS * DAY) dates.push(new Date(t));
    return dates.slice(-MAX_CHECKINS_PER_FORM);
}

function writeCheckins(ctx: BuildContext, profile: Profile, subscription: Subscription, ids: string[]): boolean {
    let hasOpenWork = false;
    const dates = checkpointDates(subscription);

    for (const form of [ctx.forms.trainingCheckin, ctx.forms.nutritionCheckin]) {
        dates.forEach((date, index) => {
            const isLatest = index === dates.length - 1;
            const replied = chance((isLatest ? 0.75 : 0.55) + profile.adherence * (isLatest ? 0.25 : 0.45));
            if (!replied && !isLatest) return;
            const requestedAt = withDaytime(date, 8, 20);
            const submittedAt = new Date(requestedAt.getTime() + randInt(1, 70) * HOUR);
            const status = isLatest ? rollOpenState(replied && submittedAt.getTime() < NOW.getTime()) : 'reviewed';
            if (status === 'skipped') return;
            const assignee = form.postAction === 'nutrition-plan' ? profile.nutritionist.userId : profile.trainer.userId;

            if (status === 'pending') {
                addRequest(ctx, profile, { form, status, requestedAt: clampToNow(requestedAt), submittedAt: null, assignee });
            } else if (status === 'submitted') {
                const id = addRequest(ctx, profile, { form, status, requestedAt, submittedAt, assignee, labelId: chance(0.18) ? pick(ctx.labels).id : null });
                trackOpen(ctx, profile, id, form, submittedAt, assignee);
                hasOpenWork = true;
            } else {
                ids.push(addRequest(ctx, profile, { form, status, requestedAt, submittedAt, ...reviewFields(ctx, profile, form, submittedAt) }));
            }
        });
    }
    return hasOpenWork;
}

function writeProgressReadings(ctx: BuildContext, profile: Profile, subscription: Subscription, trajectory: Trajectory): number | null {
    const form = ctx.forms.progress;
    const start = subscription.periods[0].start.getTime();
    const horizon = Math.min(NOW.getTime(), latestPeriod(subscription).end.getTime());
    const offsets: number[] = [];
    for (let t = start; t <= horizon; t += CHECKIN_INTERVAL_DAYS * DAY) offsets.push(t);
    let latestWeight: number | null = null;

    offsets.slice(-MAX_PROGRESS_READINGS).forEach((time) => {
        if (!chance(0.7 + profile.adherence * 0.3)) return;
        const weeksIn = (time - start) / (7 * DAY);
        const reading = trajectory.readingAt(weeksIn);
        const submittedAt = clampToNow(withDaytime(new Date(time), 7, 11));
        const requestedAt = new Date(submittedAt.getTime() - randInt(2, 30) * HOUR);
        const fields = reviewFields(ctx, profile, form, submittedAt);
        addRequest(ctx, profile, { form, status: 'reviewed', requestedAt, submittedAt, reading, ...fields });
        latestWeight = reading.Weight;
    });
    return latestWeight;
}

function writeScheduled(ctx: BuildContext, profile: Profile) {
    const form = chance(0.5) ? ctx.forms.trainingCheckin : ctx.forms.nutritionCheckin;
    const assignee = form.postAction === 'nutrition-plan' ? profile.nutritionist.userId : profile.trainer.userId;
    addRequest(ctx, profile, {
        form, status: 'scheduled', requestedAt: daysAgo(randInt(0, 2)), submittedAt: null, scheduledAt: new Date(NOW.getTime() + randInt(1, 14) * DAY), assignee,
    });
}

export function buildFormActivity(
    ctx: BuildContext, profile: Profile, subscription: Subscription, plansReady: boolean, trajectory: Trajectory,
): FormActivity {
    const reviewedRequestIds: string[] = [];
    if (subscription.periods.length === 0) {
        if (chance(0.2)) {
            const form = ctx.forms.trainingAssessment;
            addRequest(ctx, profile, { form, status: 'pending', requestedAt: daysAgo(randInt(0, 6)), submittedAt: null, assignee: profile.trainer.userId });
        }
        return { reviewedRequestIds, latestWeight: null, hasOpenWork: false };
    }

    let hasOpenWork = writeAssessments(ctx, profile, subscription, plansReady, reviewedRequestIds);
    if (subscription.hasStarted) {
        hasOpenWork = writeCheckins(ctx, profile, subscription, reviewedRequestIds) || hasOpenWork;
        if (['active', 'expiringSoon'].includes(profile.scenario) && chance(0.14)) writeScheduled(ctx, profile);
    }
    const latestWeight = subscription.hasStarted ? writeProgressReadings(ctx, profile, subscription, trajectory) : null;
    return { reviewedRequestIds, latestWeight, hasOpenWork };
}
