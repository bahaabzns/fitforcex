import { request, createTestUser, createTestWorkspace, makeAuthCookie, makeClientCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { createId } from '@paralleldrive/cuid2';

async function createClient(workspaceId: string) {
    return testPrisma.clients.create({
        data: {
            id:           createId(),
            client_code:  Math.floor(Math.random() * 90000) + 10000,
            fname:        'Test',
            lname:        'Client',
            email:        `client-${createId()}@test.com`,
            workspace_id: workspaceId,
        },
    });
}

function logPayload(overrides: Record<string, unknown> = {}) {
    return {
        plan_id:    null,
        day_id:     null,
        day_index:  0,
        notes:      null,
        started_at: '2026-06-01T10:00:00.000Z',
        ended_at:   '2026-06-01T10:30:00.000Z',
        exercises: [
            {
                exercise_id:         'ex1',
                exercise_library_id: 'lib1',
                name:                'Bench Press',
                note:                null,
                sets: [{ set_order: 1, weight: 60, reps: 10, rir: 2, rest_seconds: 90, completed: true }],
            },
        ],
        ...overrides,
    };
}

async function seedLog(clientId: string, workspaceId: string) {
    return testPrisma.workout_logs.create({
        data: {
            id:           createId(),
            client_id:    clientId,
            workspace_id: workspaceId,
            date:         new Date('2026-06-01'),
            start_time:   '2026-06-01T10:00:00.000Z',
            end_time:     '2026-06-01T10:30:00.000Z',
            exercises:    logPayload().exercises as object,
            completed:    true,
        },
    });
}

// workout_logs.day_id is a real FK to training_days — the draft-lookup tests
// need an actual row to reference, not an arbitrary string.
async function createTrainingDay(clientId: string, workspaceId: string, name = 'Day 1') {
    const plan = await testPrisma.training_plans.create({
        data: { id: createId(), name: 'Test Plan', client_id: clientId, workspace_id: workspaceId },
    });
    return testPrisma.training_days.create({
        data: { id: createId(), plan_id: plan.id, name, day_order: 1 },
    });
}

async function seedDraft(clientId: string, workspaceId: string, overrides: Record<string, unknown> = {}) {
    return testPrisma.workout_logs.create({
        data: {
            id:           createId(),
            client_id:    clientId,
            workspace_id: workspaceId,
            date:         new Date(),
            start_time:   new Date().toISOString(),
            end_time:     new Date().toISOString(),
            exercises:    logPayload().exercises as object,
            completed:    false,
            ...overrides,
        },
    });
}

describe('Workout logs — client portal', () => {
    let workspaceId: string;
    let clientA: { id: string };
    let cookieA: string;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws   = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        clientA = await createClient(workspaceId);
        cookieA = makeClientCookie(clientA.id, workspaceId);
    });

    test('rejects an unauthenticated create with 401', async () => {
        const res = await request.post('/api/client-portal/workout-logs').send(logPayload());
        expect(res.status).toBe(401);
    });

    test('rejects an invalid body with 400', async () => {
        const res = await request
            .post('/api/client-portal/workout-logs')
            .set('Cookie', cookieA)
            .send({ started_at: 'x' }); // missing ended_at + exercises
        expect(res.status).toBe(400);
    });

    test('saves a session scoped to the calling client', async () => {
        const res = await request
            .post('/api/client-portal/workout-logs')
            .set('Cookie', cookieA)
            .send(logPayload());
        expect(res.status).toBe(201);
        expect(res.body.id).toBeDefined();
        expect(res.body.total_volume).toBe(600);
        expect(res.body.total_sets).toBe(1);

        const rows = await testPrisma.workout_logs.findMany({ where: { client_id: clientA.id } });
        expect(rows).toHaveLength(1);
        expect(rows[0].workspace_id).toBe(workspaceId);
    });

    test('lists only the calling client\'s sessions', async () => {
        const otherClient = await createClient(workspaceId);
        await seedLog(clientA.id, workspaceId);
        await seedLog(otherClient.id, workspaceId);

        const res = await request.get('/api/client-portal/workout-logs').set('Cookie', cookieA);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
    });

    test('cannot read another client\'s session (ownership isolation)', async () => {
        const otherClient = await createClient(workspaceId);
        const othersLog   = await seedLog(otherClient.id, workspaceId);

        const res = await request.get(`/api/client-portal/workout-logs/${othersLog.id}`).set('Cookie', cookieA);
        expect(res.status).toBe(404);
    });

    test('saves a time-based session (no weight/reps) — total_sets counts it, volume stays 0', async () => {
        const res = await request
            .post('/api/client-portal/workout-logs')
            .set('Cookie', cookieA)
            .send(logPayload({
                exercises: [
                    {
                        exercise_id:         'ex2',
                        exercise_library_id: 'lib3',
                        name:                'Plank',
                        note:                null,
                        tracking_type:       'time_based',
                        tracked_metrics:     ['duration_seconds'],
                        sets: [{ set_order: 1, weight: null, reps: null, rir: null, rest_seconds: 30, duration_seconds: 45, completed: true }],
                    },
                ],
            }));
        expect(res.status).toBe(201);
        expect(res.body.total_sets).toBe(1);
        expect(res.body.total_volume).toBe(0);

        const rows = await testPrisma.workout_logs.findMany({ where: { client_id: clientA.id } });
        const savedExercise = (rows[0].exercises as Array<Record<string, unknown>>)[0];
        expect(savedExercise.tracking_type).toBe('time_based');
        expect(savedExercise.tracked_metrics).toEqual(['duration_seconds']);
        expect((savedExercise.sets as Array<Record<string, unknown>>)[0].duration_seconds).toBe(45);
    });

    test('saves a time-based cardio session with distance/incline/speed fields', async () => {
        const res = await request
            .post('/api/client-portal/workout-logs')
            .set('Cookie', cookieA)
            .send(logPayload({
                exercises: [
                    {
                        exercise_id:         'ex3',
                        exercise_library_id: 'lib4',
                        name:                'Treadmill Run',
                        note:                null,
                        tracking_type:       'time_based',
                        tracked_metrics:     ['duration_seconds', 'distance_km', 'incline_percent', 'speed_kmh'],
                        sets: [{
                            set_order: 1, weight: null, reps: null, rir: null, rest_seconds: null,
                            duration_seconds: 1200, distance_km: 3.2, incline_percent: 1.5, speed_kmh: 9.5, completed: true,
                        }],
                    },
                ],
            }));
        expect(res.status).toBe(201);

        const rows = await testPrisma.workout_logs.findMany({ where: { client_id: clientA.id } });
        const savedSet = ((rows[0].exercises as Array<Record<string, unknown>>)[0].sets as Array<Record<string, unknown>>)[0];
        expect(savedSet.distance_km).toBe(3.2);
        expect(savedSet.incline_percent).toBe(1.5);
        expect(savedSet.speed_kmh).toBe(9.5);
    });

    test('saves an rpe value on a Sets & Reps set', async () => {
        const res = await request
            .post('/api/client-portal/workout-logs')
            .set('Cookie', cookieA)
            .send(logPayload({
                exercises: [
                    {
                        exercise_id:         'ex4',
                        exercise_library_id: 'lib5',
                        name:                'Overhead Press',
                        note:                null,
                        tracking_type:       'sets_reps',
                        tracked_metrics:     ['rpe'],
                        sets: [{ set_order: 1, weight: 40, reps: 8, rir: null, rpe: 8.5, rest_seconds: 90, completed: true }],
                    },
                ],
            }));
        expect(res.status).toBe(201);

        const rows = await testPrisma.workout_logs.findMany({ where: { client_id: clientA.id } });
        const savedSet = ((rows[0].exercises as Array<Record<string, unknown>>)[0].sets as Array<Record<string, unknown>>)[0];
        expect(savedSet.rpe).toBe(8.5);
    });

    test('rejects a non-numeric duration_seconds with 400', async () => {
        const res = await request
            .post('/api/client-portal/workout-logs')
            .set('Cookie', cookieA)
            .send(logPayload({
                exercises: [
                    {
                        exercise_id: 'ex2', exercise_library_id: 'lib3', name: 'Plank', note: null,
                        sets: [{ set_order: 1, weight: null, reps: null, rir: null, rest_seconds: null, duration_seconds: 'forty-five', completed: true }],
                    },
                ],
            }));
        expect(res.status).toBe(400);
    });

    test('returns progress + logged exercises for a logged exercise', async () => {
        await seedLog(clientA.id, workspaceId);

        const progress = await request
            .get('/api/client-portal/workout-logs/exercise-progress')
            .query({ exercise_library_id: 'lib1' })
            .set('Cookie', cookieA);
        expect(progress.status).toBe(200);
        expect(progress.body).toHaveLength(1);
        expect(progress.body[0].top_weight).toBe(60);

        const exercises = await request.get('/api/client-portal/workout-logs/exercises').set('Cookie', cookieA);
        expect(exercises.status).toBe(200);
        expect(exercises.body[0].exercise_library_id).toBe('lib1');
    });
});

describe('Workout logs — coach view', () => {
    let workspaceId: string;
    let coachCookie: string;
    let clientA: { id: string };

    let otherWorkspaceId: string;
    let clientB: { id: string };

    beforeEach(async () => {
        const user = await createTestUser();
        const ws   = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        coachCookie = await makeAuthCookie(user.id, workspaceId);
        clientA = await createClient(workspaceId);

        const otherUser = await createTestUser();
        const otherWs   = await createTestWorkspace(otherUser.id);
        otherWorkspaceId = otherWs.id;
        clientB = await createClient(otherWorkspaceId);
    });

    test('rejects an unauthenticated request with 401', async () => {
        const res = await request.get(`/api/clients/${clientA.id}/workout-logs`);
        expect(res.status).toBe(401);
    });

    test('cannot read logs of a client in another workspace (tenant isolation)', async () => {
        await seedLog(clientB.id, otherWorkspaceId);
        const res = await request.get(`/api/clients/${clientB.id}/workout-logs`).set('Cookie', coachCookie);
        expect(res.status).toBe(404);
    });

    test('lists a workspace client\'s sessions', async () => {
        await seedLog(clientA.id, workspaceId);
        const res = await request.get(`/api/clients/${clientA.id}/workout-logs`).set('Cookie', coachCookie);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].total_volume).toBe(600);
    });

    test('a draft (not yet finished) session does not appear in the coach\'s history', async () => {
        await seedDraft(clientA.id, workspaceId);
        const res = await request.get(`/api/clients/${clientA.id}/workout-logs`).set('Cookie', coachCookie);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(0);
    });
});

describe('Workout logs — Instant Save (draft upsert)', () => {
    let workspaceId: string;
    let clientA: { id: string };
    let cookieA: string;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws   = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        clientA = await createClient(workspaceId);
        cookieA = makeClientCookie(clientA.id, workspaceId);
    });

    test('an unauthenticated draft save is rejected with 401', async () => {
        const res = await request.put(`/api/client-portal/workout-logs/${createId()}`).send(logPayload({ completed: false }));
        expect(res.status).toBe(401);
    });

    test('creates a draft row on first autosave, scoped to the calling client', async () => {
        const id = createId();
        const res = await request.put(`/api/client-portal/workout-logs/${id}`).set('Cookie', cookieA)
            .send(logPayload({ completed: false }));
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ id, completed: false });

        const row = await testPrisma.workout_logs.findUnique({ where: { id } });
        expect(row).not.toBeNull();
        expect(row!.completed).toBe(false);
        expect(row!.client_id).toBe(clientA.id);
        expect(row!.workspace_id).toBe(workspaceId);
    });

    test('a second autosave updates the same row in place, not a new one', async () => {
        const id = createId();
        await request.put(`/api/client-portal/workout-logs/${id}`).set('Cookie', cookieA).send(logPayload({ completed: false }));

        const updatedExercises = logPayload({ completed: false }).exercises;
        updatedExercises[0].sets[0].weight = 65;
        await request.put(`/api/client-portal/workout-logs/${id}`).set('Cookie', cookieA)
            .send(logPayload({ completed: false, exercises: updatedExercises }));

        const rows = await testPrisma.workout_logs.findMany({ where: { client_id: clientA.id } });
        expect(rows).toHaveLength(1);
        const sets = (rows[0].exercises as Array<Record<string, unknown>>)[0].sets as Array<Record<string, unknown>>;
        expect(sets[0].weight).toBe(65);
    });

    test('Finish (completed:true) upserts the same row the draft was saved to, not a second one', async () => {
        const id = createId();
        await request.put(`/api/client-portal/workout-logs/${id}`).set('Cookie', cookieA).send(logPayload({ completed: false }));

        const finishRes = await request.put(`/api/client-portal/workout-logs/${id}`).set('Cookie', cookieA)
            .send(logPayload({ completed: true }));
        expect(finishRes.status).toBe(200);
        expect(finishRes.body.total_volume).toBe(600); // full summary, like the old POST response

        const rows = await testPrisma.workout_logs.findMany({ where: { client_id: clientA.id } });
        expect(rows).toHaveLength(1);
        expect(rows[0].completed).toBe(true);
    });

    test('a completed row is immutable — a stray late draft PUT after Finish is a no-op', async () => {
        const id = createId();
        await request.put(`/api/client-portal/workout-logs/${id}`).set('Cookie', cookieA).send(logPayload({ completed: true }));

        const staleExercises = logPayload().exercises;
        staleExercises[0].sets[0].weight = 999;
        const res = await request.put(`/api/client-portal/workout-logs/${id}`).set('Cookie', cookieA)
            .send(logPayload({ completed: false, exercises: staleExercises }));
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ id, completed: true });

        const row = await testPrisma.workout_logs.findUnique({ where: { id } });
        expect(row!.completed).toBe(true);
        const sets = (row!.exercises as Array<Record<string, unknown>>)[0].sets as Array<Record<string, unknown>>;
        expect(sets[0].weight).toBe(60); // untouched by the stale write
    });

    test('cannot upsert another client\'s workout log id (ownership isolation)', async () => {
        const otherClient = await createClient(workspaceId);
        const othersDraft  = await seedDraft(otherClient.id, workspaceId);

        const res = await request.put(`/api/client-portal/workout-logs/${othersDraft.id}`).set('Cookie', cookieA)
            .send(logPayload({ completed: false }));
        expect(res.status).toBe(403);

        const row = await testPrisma.workout_logs.findUnique({ where: { id: othersDraft.id } });
        expect(row!.client_id).toBe(otherClient.id); // untouched
    });

    test('rejects an invalid draft body with 400', async () => {
        const res = await request.put(`/api/client-portal/workout-logs/${createId()}`).set('Cookie', cookieA)
            .send({ started_at: 'x' });
        expect(res.status).toBe(400);
    });

    test('a draft does not appear in the client\'s own history, previous-values, or logged-exercises lists', async () => {
        await seedDraft(clientA.id, workspaceId);

        const history = await request.get('/api/client-portal/workout-logs').set('Cookie', cookieA);
        expect(history.body).toHaveLength(0);

        const exercises = await request.get('/api/client-portal/workout-logs/exercises').set('Cookie', cookieA);
        expect(exercises.body).toHaveLength(0);
    });

    test('a draft is not fetchable via GET /workout-logs/:id (only completed sessions are)', async () => {
        const draft = await seedDraft(clientA.id, workspaceId);
        const res = await request.get(`/api/client-portal/workout-logs/${draft.id}`).set('Cookie', cookieA);
        expect(res.status).toBe(404);
    });

    test('a draft can still be deleted directly (abandoned-workout cleanup)', async () => {
        const draft = await seedDraft(clientA.id, workspaceId);
        const res = await request.delete(`/api/client-portal/workout-logs/${draft.id}`).set('Cookie', cookieA);
        expect(res.status).toBe(200);
        expect(await testPrisma.workout_logs.findUnique({ where: { id: draft.id } })).toBeNull();
    });
});

describe('Workout logs — Instant Save (cross-device draft lookup)', () => {
    let workspaceId: string;
    let clientA: { id: string };
    let cookieA: string;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws   = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        clientA = await createClient(workspaceId);
        cookieA = makeClientCookie(clientA.id, workspaceId);
    });

    test('requires day_id', async () => {
        const res = await request.get('/api/client-portal/workout-logs/draft').set('Cookie', cookieA);
        expect(res.status).toBe(400);
    });

    test('returns null when there is no draft for the day', async () => {
        const res = await request.get('/api/client-portal/workout-logs/draft').set('Cookie', cookieA).query({ day_id: 'day1' });
        expect(res.status).toBe(200);
        expect(res.body).toBeNull();
    });

    test('returns the recent draft for the given day, not a completed session or another day\'s draft', async () => {
        const day1 = await createTrainingDay(clientA.id, workspaceId, 'Day 1');
        const day2 = await createTrainingDay(clientA.id, workspaceId, 'Day 2');
        await seedLog(clientA.id, workspaceId); // completed — must not be returned
        await seedDraft(clientA.id, workspaceId, { day_id: day2.id }); // wrong day
        const draft = await seedDraft(clientA.id, workspaceId, { day_id: day1.id });

        const res = await request.get('/api/client-portal/workout-logs/draft').set('Cookie', cookieA).query({ day_id: day1.id });
        expect(res.status).toBe(200);
        expect(res.body.id).toBe(draft.id);
        expect(res.body.day_id).toBe(day1.id);
    });

    test('a long-abandoned draft (>24h old) does not resurface', async () => {
        const day1 = await createTrainingDay(clientA.id, workspaceId);
        await seedDraft(clientA.id, workspaceId, { day_id: day1.id, date: new Date(Date.now() - 48 * 60 * 60 * 1000) });

        const res = await request.get('/api/client-portal/workout-logs/draft').set('Cookie', cookieA).query({ day_id: day1.id });
        expect(res.status).toBe(200);
        expect(res.body).toBeNull();
    });

    test('does not leak another client\'s draft', async () => {
        const otherClient = await createClient(workspaceId);
        const day1 = await createTrainingDay(otherClient.id, workspaceId);
        await seedDraft(otherClient.id, workspaceId, { day_id: day1.id });

        const res = await request.get('/api/client-portal/workout-logs/draft').set('Cookie', cookieA).query({ day_id: day1.id });
        expect(res.status).toBe(200);
        expect(res.body).toBeNull();
    });
});
