import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { createId } from '@paralleldrive/cuid2';

// Regression test for a bug where a blank/unset numeric set field (null,
// undefined, or "") was saved as 0 instead of null — because
// Number.isFinite(Number(x)) treats Number(null) and Number("") (both 0) as
// finite. This silently corrupted "not defined by the coach" into a real,
// meaningful 0 (e.g. 0% incline), which then made every downstream
// column-hiding check ("does this exercise have a value for this field?")
// wrongly think the coach had set a target. See training.controller.ts's
// toNullableNumber().
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

function planPayload(clientId: string, overrides: Record<string, unknown> = {}) {
    return {
        clientId,
        plan: {
            id: 'tmp-plan',
            name: 'Test Plan',
            days: [
                {
                    id: 'tmp-day',
                    name: 'Day 1',
                    day_order: 1,
                    exercises: [
                        {
                            id: 'tmp-ex',
                            name: 'Treadmill',
                            exercise_order: 1,
                            sets: [
                                {
                                    set_order: 1,
                                    duration_seconds: null,
                                    distance_km: null,
                                    incline_percent: null,
                                    speed_kmh: null,
                                    rest_seconds: null,
                                    reps: null,
                                    tempo: null,
                                    rir: null,
                                    rpe: null,
                                },
                            ],
                        },
                    ],
                },
            ],
            ...overrides,
        },
    };
}

describe('Training plan save — numeric set fields stay null when blank', () => {
    let workspaceId: string;
    let cookie: string;
    let clientId: string;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws   = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        cookie = await makeAuthCookie(user.id, workspaceId);
        const client = await createClient(workspaceId);
        clientId = client.id;
    });

    test('save-plan-draft: a set with null numeric fields persists as NULL, not 0', async () => {
        const res = await request
            .post('/api/training/plans/save-plan-draft')
            .set('Cookie', cookie)
            .send(planPayload(clientId));
        expect(res.status).toBe(200);

        const sets = await testPrisma.training_sets.findMany({
            where: { training_exercises: { training_days: { training_plans: { client_id: clientId } } } },
        });
        expect(sets).toHaveLength(1);
        expect(sets[0].duration_seconds).toBeNull();
        expect(sets[0].distance_km).toBeNull();
        expect(sets[0].incline_percent).toBeNull();
        expect(sets[0].speed_kmh).toBeNull();
        expect(sets[0].rest_seconds).toBeNull();
        expect(sets[0].rir).toBeNull();
        expect(sets[0].rpe).toBeNull();
    });

    test('save-plan-draft: a set with a real 0 value persists as 0, not null (0 is meaningful, e.g. flat incline)', async () => {
        const payload = planPayload(clientId);
        payload.plan.days[0].exercises[0].sets[0] = {
            set_order: 1, duration_seconds: 600, distance_km: 5, incline_percent: 0, speed_kmh: 10, rest_seconds: 0, reps: null, tempo: null, rir: 0, rpe: 0,
        };
        const res = await request.post('/api/training/plans/save-plan-draft').set('Cookie', cookie).send(payload);
        expect(res.status).toBe(200);

        const sets = await testPrisma.training_sets.findMany({
            where: { training_exercises: { training_days: { training_plans: { client_id: clientId } } } },
        });
        expect(sets[0].incline_percent?.toNumber()).toBe(0);
        expect(sets[0].rest_seconds).toBe(0);
        expect(sets[0].rir).toBe(0);
        expect(sets[0].rpe?.toNumber()).toBe(0);
    });

    test('save-draft (bulk): a set with null numeric fields persists as NULL, not 0', async () => {
        const single = planPayload(clientId);
        const res = await request
            .post('/api/training/plans/save-draft')
            .set('Cookie', cookie)
            .send({ clientId, plans: [single.plan], activePlanId: null });
        expect(res.status).toBe(200);

        const sets = await testPrisma.training_sets.findMany({
            where: { training_exercises: { training_days: { training_plans: { client_id: clientId } } } },
        });
        expect(sets).toHaveLength(1);
        expect(sets[0].duration_seconds).toBeNull();
        expect(sets[0].distance_km).toBeNull();
        expect(sets[0].incline_percent).toBeNull();
        expect(sets[0].speed_kmh).toBeNull();
    });
});
