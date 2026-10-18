import type { Buffers } from './buffers';
import type { DemoForm, FormKey, Library, MetricRef, QueueLabelRef, TeamMemberRef, VariationRef } from './setup';

export type Scenario = 'active' | 'expiringSoon' | 'newClient' | 'expired' | 'frozen' | 'preStart' | 'none' | 'archived';
export type Goal = 'fat_loss' | 'muscle_gain' | 'recomp' | 'general';
export type Level = 'Beginner' | 'Intermediate' | 'Advanced';

export interface Profile {
    id: string;
    index: number;
    code: number;
    fname: string;
    lname: string;
    email: string;
    phone: string;
    phones: Array<{ countryCode: string; number: string }>;
    isFemale: boolean;
    age: number;
    heightCm: number;
    startWeightKg: number;
    activityLevel: string;
    goal: Goal;
    level: Level;
    daysPerWeek: number;
    /** 0..1, how closely this client follows the plan: drives logs, diary, check-in replies. */
    adherence: number;
    scenario: Scenario;
    trainer: TeamMemberRef;
    nutritionist: TeamMemberRef;
    prefersArabic: boolean;
    createdAt: Date;
}

export interface Period {
    start: Date;
    end: Date;
    variation: VariationRef;
    freeze: { start: Date; days: number } | null;
}

export interface Subscription {
    periods: Period[];
    createdAt: Date;
    status: string;
    hasStarted: boolean;
}

export interface FoodItemSnapshot { mealItemId: string; food: Library['foods'][number]; mealName: string; amount: number }
export interface BuiltCycle {
    id: string; name: string; goalCalories: number; goalProtein: number; goalCarbs: number; goalFats: number;
    items: FoodItemSnapshot[];
}
export interface BuiltNutritionPlan { id: string; cycles: BuiltCycle[]; activatedAt: Date; cycleEndAt: Date }

export interface BuiltSet {
    repsLow: number; repsHigh: number; restSeconds: number; rir: number | null; durationSeconds: number | null;
    distanceKm: number | null; inclinePercent: number | null; speedKmh: number | null;
}
export interface BuiltExercise { id: string; lib: Library['exercises'][number]; sets: BuiltSet[] }
export interface BuiltDay { id: string; name: string; exercises: BuiltExercise[] }
export interface BuiltTrainingPlan { id: string; days: BuiltDay[]; activatedAt: Date; cycleEndAt: Date }

export interface CollectedForOutput {
    unreadThreads: Array<{ threadId: string; clientId: string; clientName: string; at: Date; assignee: string }>;
    submittedRequests: Array<{ requestId: string; clientId: string; clientName: string; at: Date; assignee: string | null; formTitle: string }>;
    newClients: Array<{ clientId: string; clientName: string; at: Date }>;
    scenarioCounts: Record<string, number>;
    sampleLogins: string[];
}

export interface BuildContext {
    workspaceId: string;
    ownerId: string;
    buffers: Buffers;
    library: Library;
    metrics: Record<string, MetricRef>;
    forms: Record<FormKey, DemoForm>;
    variations: VariationRef[];
    paymentMethods: string[];
    team: TeamMemberRef[];
    labels: QueueLabelRef[];
    passwordHash: string;
    codeBase: number;
    collected: CollectedForOutput;
}
