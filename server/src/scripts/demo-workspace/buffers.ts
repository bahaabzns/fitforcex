// Row buffers for the demo seed. Clients are generated in batches; each batch is flushed in
// foreign-key order so memory stays flat no matter how many clients are seeded.

import { Prisma, PrismaClient } from '@prisma/client';
import { chunk } from './random';

const BATCH_ROWS = 1000;

export class Buffers {
    clients: Prisma.clientsCreateManyInput[] = [];
    measurements: Prisma.client_measurementsCreateManyInput[] = [];
    freezes: Prisma.subscription_freezesCreateManyInput[] = [];
    nutritionPlans: Prisma.nutrition_plansCreateManyInput[] = [];
    nutritionCycles: Prisma.nutrition_cyclesCreateManyInput[] = [];
    nutritionMeals: Prisma.nutrition_mealsCreateManyInput[] = [];
    nutritionItems: Prisma.nutrition_meal_itemsCreateManyInput[] = [];
    nutritionAlternatives: Prisma.nutrition_meal_item_alternativesCreateManyInput[] = [];
    swapHistory: Prisma.food_swap_historyCreateManyInput[] = [];
    trainingPlans: Prisma.training_plansCreateManyInput[] = [];
    trainingDays: Prisma.training_daysCreateManyInput[] = [];
    trainingExercises: Prisma.training_exercisesCreateManyInput[] = [];
    trainingSets: Prisma.training_setsCreateManyInput[] = [];
    trainingAlternatives: Prisma.training_exercise_alternativesCreateManyInput[] = [];
    workoutLogs: Prisma.workout_logsCreateManyInput[] = [];
    foodDiary: Prisma.food_diary_entriesCreateManyInput[] = [];
    formRequests: Prisma.form_requestsCreateManyInput[] = [];
    formResponses: Prisma.form_responsesCreateManyInput[] = [];
    responseEdits: Prisma.form_response_editsCreateManyInput[] = [];
    checkInSchedules: Prisma.check_in_schedulesCreateManyInput[] = [];
    observations: Prisma.client_observationsCreateManyInput[] = [];
    observationRelations: Prisma.observation_relationsCreateManyInput[] = [];
    threads: Prisma.threadsCreateManyInput[] = [];
    messages: Prisma.messagesCreateManyInput[] = [];

    /** Transactions are held back until the end so codes can be assigned in date order. */
    transactions: Prisma.transactionsCreateManyInput[] = [];

    readonly totals: Record<string, number> = {};

    constructor(private readonly prisma: PrismaClient) {}

    private async write<T>(label: string, rows: T[], insert: (data: T[]) => Promise<{ count: number }>) {
        for (const part of chunk(rows, BATCH_ROWS)) {
            const { count } = await insert(part);
            this.totals[label] = (this.totals[label] ?? 0) + count;
        }
        rows.length = 0;
    }

    async flush() {
        const p = this.prisma;
        await this.write('clients', this.clients, (data) => p.clients.createMany({ data }));
        await this.write('measurements', this.measurements, (data) => p.client_measurements.createMany({ data }));
        await this.write('freezes', this.freezes, (data) => p.subscription_freezes.createMany({ data }));
        await this.write('nutrition plans', this.nutritionPlans, (data) => p.nutrition_plans.createMany({ data }));
        await this.write('nutrition cycles', this.nutritionCycles, (data) => p.nutrition_cycles.createMany({ data }));
        await this.write('nutrition meals', this.nutritionMeals, (data) => p.nutrition_meals.createMany({ data }));
        await this.write('nutrition meal items', this.nutritionItems, (data) => p.nutrition_meal_items.createMany({ data }));
        await this.write('nutrition alternatives', this.nutritionAlternatives, (data) => p.nutrition_meal_item_alternatives.createMany({ data }));
        await this.write('food swaps', this.swapHistory, (data) => p.food_swap_history.createMany({ data }));
        await this.write('training plans', this.trainingPlans, (data) => p.training_plans.createMany({ data }));
        await this.write('training days', this.trainingDays, (data) => p.training_days.createMany({ data }));
        await this.write('training exercises', this.trainingExercises, (data) => p.training_exercises.createMany({ data }));
        await this.write('training sets', this.trainingSets, (data) => p.training_sets.createMany({ data }));
        await this.write('exercise alternatives', this.trainingAlternatives, (data) => p.training_exercise_alternatives.createMany({ data }));
        await this.write('workout logs', this.workoutLogs, (data) => p.workout_logs.createMany({ data }));
        await this.write('food diary entries', this.foodDiary, (data) => p.food_diary_entries.createMany({ data }));
        await this.write('form requests', this.formRequests, (data) => p.form_requests.createMany({ data }));
        await this.write('form responses', this.formResponses, (data) => p.form_responses.createMany({ data }));
        await this.write('response edits', this.responseEdits, (data) => p.form_response_edits.createMany({ data }));
        await this.write('check-in schedules', this.checkInSchedules, (data) => p.check_in_schedules.createMany({ data }));
        await this.write('observations', this.observations, (data) => p.client_observations.createMany({ data }));
        await this.write('observation links', this.observationRelations, (data) => p.observation_relations.createMany({ data }));
        await this.write('threads', this.threads, (data) => p.threads.createMany({ data }));
        await this.write('messages', this.messages, (data) => p.messages.createMany({ data }));
    }
}
