import { request, createTestUser, createTestWorkspace, makeClientCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { createId } from '@paralleldrive/cuid2';

/**
 * Regression coverage for a "previous" cross-talk bug: when the same exercise
 * (matched by name/exercise_library_id) is assigned on more than one training
 * day, the "previous" lookup used to search completed logs across ALL days
 * for the client, so the day with the more recently-logged session would leak
 * its weight/reps into every other day's "previous" hint. Each day's slot
 * must track its own history independently — see getWorkoutLogPrevious.
 */
describe('Client portal — GET /client-portal/workout-logs/previous', () => {
    test('an exercise duplicated across two training days keeps separate "previous" records', async () => {
        const user      = await createTestUser();
        const workspace = await createTestWorkspace(user.id);

        const client = await testPrisma.clients.create({
            data: {
                id:           createId(),
                client_code:  Math.floor(Math.random() * 90000) + 10000,
                fname:        'Test',
                lname:        'Client',
                email:        `client-${createId()}@test.com`,
                workspace_id: workspace.id,
            },
        });
        const cookie = makeClientCookie(client.id, workspace.id);

        const plan = await testPrisma.training_plans.create({
            data: { id: createId(), name: 'Test Plan', client_id: client.id, workspace_id: workspace.id },
        });

        const dayA = await testPrisma.training_days.create({
            data: { id: createId(), plan_id: plan.id, name: 'Day A', day_order: 1 },
        });
        const dayB = await testPrisma.training_days.create({
            data: { id: createId(), plan_id: plan.id, name: 'Day B', day_order: 2 },
        });

        const exerciseA = await testPrisma.training_exercises.create({
            data: { id: createId(), day_id: dayA.id, name: 'Bench Press', exercise_order: 1 },
        });
        const exerciseB = await testPrisma.training_exercises.create({
            data: { id: createId(), day_id: dayB.id, name: 'Bench Press', exercise_order: 1 },
        });

        const makeLoggedSet = (weight: number, reps: number) => ({
            set_order: 1, weight, reps, rir: null, rpe: null, rest_seconds: null,
            duration_seconds: null, distance_km: null, incline_percent: null,
            speed_kmh: null, completed: true,
        });

        // Day B's session is logged more recently than Day A's — the bug
        // surfaces because Day B's newer log would win Day A's "previous" too.
        await testPrisma.workout_logs.create({
            data: {
                id: createId(), client_id: client.id, workspace_id: workspace.id,
                plan_id: plan.id, day_id: dayA.id,
                date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
                completed: true,
                exercises: [{ exercise_id: exerciseA.id, exercise_library_id: null, name: 'Bench Press', note: null, sets: [makeLoggedSet(100, 5)] }],
            },
        });
        await testPrisma.workout_logs.create({
            data: {
                id: createId(), client_id: client.id, workspace_id: workspace.id,
                plan_id: plan.id, day_id: dayB.id,
                date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
                completed: true,
                exercises: [{ exercise_id: exerciseB.id, exercise_library_id: null, name: 'Bench Press', note: null, sets: [makeLoggedSet(60, 8)] }],
            },
        });

        const resA = await request.get(`/api/client-portal/workout-logs/previous?day_id=${dayA.id}`).set('Cookie', cookie);
        const resB = await request.get(`/api/client-portal/workout-logs/previous?day_id=${dayB.id}`).set('Cookie', cookie);

        expect(resA.status).toBe(200);
        expect(resA.body[exerciseA.id][0].weight).toBe(100);
        expect(resA.body[exerciseA.id][0].reps).toBe(5);

        expect(resB.status).toBe(200);
        expect(resB.body[exerciseB.id][0].weight).toBe(60);
        expect(resB.body[exerciseB.id][0].reps).toBe(8);
    });
});
