// Client identity, body stats and the weight/measurement trajectory used by progress check-ins.

import { COUNTRY_CODES, FEMALE_FIRST, LAST_NAMES, MALE_FIRST } from './pools';
import { CLIENT_EMAIL_DOMAIN, pickTeamFor } from './setup';
import { bell, chance, pick, pickWeighted, rand, randFloat, randInt, round } from './random';
import type { BuildContext, Goal, Level, Profile, Scenario } from './types';

const ARABIC_SCRIPT = /[؀-ۿ]/;
const ACTIVITY_LEVELS = ['sedentary', 'lightly_active', 'moderately_active', 'very_active'] as const;
const ACTIVITY_FACTOR: Record<string, number> = { sedentary: 1.25, lightly_active: 1.375, moderately_active: 1.55, very_active: 1.725 };

const SCENARIO_WEIGHTS: ReadonlyArray<readonly [Scenario, number]> = [
    ['active', 50], ['expiringSoon', 8], ['newClient', 5], ['expired', 15], ['frozen', 5], ['preStart', 4], ['none', 6], ['archived', 7],
];

function pickName(pool: readonly string[], arabic: boolean): string {
    const matches = pool.filter((name) => ARABIC_SCRIPT.test(name) === arabic);
    return pick(matches);
}

function buildEmail(fname: string, lname: string, code: number): string {
    const ascii = !ARABIC_SCRIPT.test(fname) && !ARABIC_SCRIPT.test(lname);
    const local = ascii ? `${fname}.${lname}.${code}` : `client.${code}`;
    return `${local}@${CLIENT_EMAIL_DOMAIN}`.toLowerCase().replace(/\s+/g, '');
}

function pickGoal(isFemale: boolean, bmi: number): Goal {
    if (bmi >= 27) return pickWeighted<Goal>([['fat_loss', 70], ['recomp', 20], ['general', 10]]);
    return pickWeighted<Goal>(isFemale
        ? [['fat_loss', 35], ['recomp', 30], ['muscle_gain', 20], ['general', 15]]
        : [['muscle_gain', 45], ['fat_loss', 25], ['recomp', 20], ['general', 10]]);
}

export function createProfile(ctx: BuildContext, index: number, id: string): Profile {
    const isFemale = chance(0.55);
    const arabic = chance(0.25);
    const fname = pickName(isFemale ? FEMALE_FIRST : MALE_FIRST, arabic);
    const lname = pickName(LAST_NAMES, arabic);
    const code = ctx.codeBase + index;
    const countryCode = pick(COUNTRY_CODES);
    const number = countryCode === '+20' ? `${pick(['10', '11', '12', '15'])}${randInt(10_000_000, 99_999_999)}` : String(randInt(500_000_000, 599_999_999));

    const heightCm = Math.round(isFemale ? bell(152, 176) : bell(165, 192));
    const bmi = bell(20, 34);
    const startWeightKg = round((bmi * (heightCm / 100) ** 2), 1);
    const goal = pickGoal(isFemale, bmi);
    const level = pickWeighted<Level>([['Beginner', 40], ['Intermediate', 42], ['Advanced', 18]]);

    return {
        id, index, code, fname, lname, email: buildEmail(fname, lname, code),
        phone: `${countryCode} ${number}`, phones: [{ countryCode, number }],
        isFemale, age: randInt(19, 52), heightCm, startWeightKg, goal, level, activityLevel: pick(ACTIVITY_LEVELS),
        daysPerWeek: pickWeighted([[3, 30], [4, 38], [5, 24], [6, 8]] as const),
        adherence: pickWeighted([[randFloat(0.8, 0.98, 2), 40], [randFloat(0.55, 0.8, 2), 40], [randFloat(0.25, 0.55, 2), 20]] as const),
        scenario: pickWeighted(SCENARIO_WEIGHTS),
        trainer: pickTeamFor(ctx.team, ['trainer', 'manager']),
        nutritionist: pickTeamFor(ctx.team, ['nutritionist']),
        prefersArabic: arabic, createdAt: new Date(),
    };
}

// ── Energy targets ─────────────────────────────────────────────────────────
export function dailyCalorieTarget(profile: Profile): number {
    const base = 10 * profile.startWeightKg + 6.25 * profile.heightCm - 5 * profile.age + (profile.isFemale ? -161 : 5);
    const maintenance = base * ACTIVITY_FACTOR[profile.activityLevel];
    const adjust: Record<Goal, number> = { fat_loss: 0.82, muscle_gain: 1.1, recomp: 0.95, general: 1 };
    return Math.round((maintenance * adjust[profile.goal]) / 50) * 50;
}

// ── Progress trajectory ────────────────────────────────────────────────────
const GOAL_WEIGHT_CHANGE: Record<Goal, [number, number]> = {
    fat_loss: [-0.14, -0.05], muscle_gain: [0.02, 0.07], recomp: [-0.03, 0.01], general: [-0.02, 0.02],
};

export interface Trajectory { readingAt: (weeksIn: number) => Record<string, number> }

/** Smooth progress toward the client's goal, scaled by how well they follow the plan, plus measurement noise. */
export function createTrajectory(profile: Profile): Trajectory {
    const [low, high] = GOAL_WEIGHT_CHANGE[profile.goal];
    const targetChange = (low + (high - low) * rand()) * (0.4 + profile.adherence * 0.8);
    const startWaist = profile.isFemale ? bell(68, 96) : bell(80, 108);
    const startHip = profile.isFemale ? bell(92, 118) : bell(92, 112);
    const startChest = profile.isFemale ? bell(84, 104) : bell(96, 116);
    const startArm = profile.isFemale ? bell(26, 34) : bell(32, 42);
    const startBodyFat = profile.isFemale ? bell(24, 40) : bell(15, 32);

    return {
        readingAt(weeksIn) {
            const progress = 1 - Math.exp(-weeksIn / 10);
            const change = targetChange * progress;
            const noise = () => (rand() - 0.5);
            const weight = profile.startWeightKg * (1 + change) + noise() * 0.8;
            const fatLoss = Math.max(0, -change);
            const muscleGain = Math.max(0, change);
            return {
                Weight: round(weight, 1),
                Waist: round(startWaist * (1 - fatLoss * 0.55) + noise() * 0.6, 1),
                Hip: round(startHip * (1 - fatLoss * 0.3) + noise() * 0.5, 1),
                Chest: round(startChest * (1 + muscleGain * 0.25 - fatLoss * 0.1) + noise() * 0.5, 1),
                'Body Fat': round(startBodyFat * (1 - fatLoss * 0.9 + muscleGain * 0.1) + noise() * 0.4, 1),
                'Left Arm': round(startArm * (1 + muscleGain * 0.4 - fatLoss * 0.08) + noise() * 0.2, 1),
                'Right Arm': round(startArm * (1 + muscleGain * 0.4 - fatLoss * 0.08) + 0.3 + noise() * 0.2, 1),
            };
        },
    };
}
