/**
 * Clone an existing active training_plan + nutrition_plan from another
 * client in the screenshot-demo workspace onto the new demo client, so the
 * mobile Training/Nutrition tabs have real content to screenshot.
 *
 * Usage (from server/):
 *   npx dotenv -e .env -- npx tsx src/scripts/seed-screenshot-demo-plans.ts <clientEmail>
 */
import { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';

const prisma = new PrismaClient();
const SLUG = 'screenshot-demo';
const CLIENT_EMAIL = process.argv[2];

async function cloneTrainingPlan(sourceClientId: string, targetClientId: string, workspaceId: string) {
    const source = await prisma.training_plans.findFirst({
        where: { workspace_id: workspaceId, client_id: sourceClientId, status: 'active' },
        include: { training_days: { include: { training_exercises: { include: { training_sets: true, training_exercise_alternatives: true } } } } },
    });
    if (!source) return;

    const newPlanId = createId();
    await prisma.training_plans.create({
        data: {
            id: newPlanId, name: source.name, client_id: targetClientId, workspace_id: workspaceId,
            status: 'active', notes: source.notes, activated_at: new Date(),
        },
    });

    for (const day of source.training_days) {
        const newDayId = createId();
        await prisma.training_days.create({
            data: { id: newDayId, plan_id: newPlanId, name: day.name, day_order: day.day_order, notes: day.notes },
        });
        for (const ex of day.training_exercises) {
            const newExId = createId();
            await prisma.training_exercises.create({
                data: {
                    id: newExId, day_id: newDayId, name: ex.name, exercise_order: ex.exercise_order,
                    equipment: ex.equipment, notes: ex.notes, exercise_library_id: ex.exercise_library_id,
                },
            });
            for (const set of ex.training_sets) {
                await prisma.training_sets.create({
                    data: { id: createId(), exercise_id: newExId, set_order: set.set_order, reps: set.reps, rest_seconds: set.rest_seconds, tempo: set.tempo, rir: set.rir },
                });
            }
            for (const alt of ex.training_exercise_alternatives) {
                await prisma.training_exercise_alternatives.create({
                    data: { id: createId(), exercise_id: newExId, exercise_library_id: alt.exercise_library_id, alt_order: alt.alt_order },
                });
            }
        }
    }
    console.log(`Cloned training plan "${source.name}" (${source.training_days.length} days) to ${targetClientId}`);
}

async function cloneNutritionPlan(sourceClientId: string, targetClientId: string, workspaceId: string) {
    const source = await prisma.nutrition_plans.findFirst({
        where: { workspace_id: workspaceId, client_id: sourceClientId, status: 'active' },
        include: { nutrition_cycles: { include: { nutrition_meals: { include: { nutrition_meal_items: { include: { nutrition_meal_item_alternatives: true } } } } } } },
    });
    if (!source) return;

    const newPlanId = createId();
    await prisma.nutrition_plans.create({
        data: { id: newPlanId, name: source.name, client_id: targetClientId, workspace_id: workspaceId, status: 'active', activated_at: new Date() },
    });

    for (const cycle of source.nutrition_cycles) {
        const newCycleId = createId();
        await prisma.nutrition_cycles.create({
            data: {
                id: newCycleId, plan_id: newPlanId, name: cycle.name, cycle_order: cycle.cycle_order,
                goal_calories: cycle.goal_calories, goal_protein: cycle.goal_protein, goal_carbs: cycle.goal_carbs, goal_fats: cycle.goal_fats, note: cycle.note,
            },
        });
        for (const meal of cycle.nutrition_meals) {
            const newMealId = createId();
            await prisma.nutrition_meals.create({
                data: { id: newMealId, cycle_id: newCycleId, name: meal.name, meal_order: meal.meal_order, note: meal.note },
            });
            for (const item of meal.nutrition_meal_items) {
                const newItemId = createId();
                await prisma.nutrition_meal_items.create({
                    data: { id: newItemId, meal_id: newMealId, food_item_id: item.food_item_id, amount: item.amount, meal_item_order: item.meal_item_order },
                });
                for (const alt of item.nutrition_meal_item_alternatives) {
                    await prisma.nutrition_meal_item_alternatives.create({
                        data: { id: createId(), meal_item_id: newItemId, food_item_id: alt.food_item_id, amount: alt.amount, alt_order: alt.alt_order },
                    });
                }
            }
        }
    }
    console.log(`Cloned nutrition plan "${source.name}" (${source.nutrition_cycles.length} cycles) to ${targetClientId}`);
}

async function main() {
    if (!CLIENT_EMAIL) throw new Error('Usage: seed-screenshot-demo-plans.ts <clientEmail>');

    const workspace = await prisma.workspaces.findUnique({ where: { slug: SLUG }, select: { id: true } });
    if (!workspace) throw new Error(`Workspace "${SLUG}" not found`);

    const target = await prisma.clients.findFirst({ where: { workspace_id: workspace.id, email: CLIENT_EMAIL }, select: { id: true } });
    if (!target) throw new Error(`Client "${CLIENT_EMAIL}" not found`);

    const others = await prisma.clients.findMany({ where: { workspace_id: workspace.id, id: { not: target.id } }, select: { id: true } });
    if (others.length === 0) throw new Error('No other clients to clone plans from');
    const source = others[0].id;

    await cloneTrainingPlan(source, target.id, workspace.id);
    await cloneNutritionPlan(source, target.id, workspace.id);
}

main()
    .catch(err => { console.error(err); process.exit(1); })
    .finally(() => prisma.$disconnect());
