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
});
