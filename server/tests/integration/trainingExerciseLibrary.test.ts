import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';

describe('Training — exercise library tracking type', () => {
    let workspaceId: string;
    let cookie: string;

    let otherWorkspaceId: string;
    let otherCookie: string;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws   = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        cookie = await makeAuthCookie(user.id, workspaceId);

        const otherUser = await createTestUser();
        const otherWs   = await createTestWorkspace(otherUser.id);
        otherWorkspaceId = otherWs.id;
        otherCookie = await makeAuthCookie(otherUser.id, otherWorkspaceId);
    });

    test('rejects an unauthenticated create with 401', async () => {
        const res = await request.post('/api/training/exercise-library').send({ name_en: 'Plank' });
        expect(res.status).toBe(401);
    });

    test.each(['sets_reps', 'time_based'])(
        'creates an exercise with tracking_type=%s',
        async (trackingType) => {
            const res = await request
                .post('/api/training/exercise-library')
                .set('Cookie', cookie)
                .field('name_en', 'Test Exercise')
                .field('tracking_type', trackingType);
            expect(res.status).toBe(201);
            expect(res.body.tracking_type).toBe(trackingType);
            expect(res.body.tracked_metrics).toEqual([]);
        }
    );

    test('defaults to sets_reps with no tracked metrics when omitted', async () => {
        const res = await request
            .post('/api/training/exercise-library')
            .set('Cookie', cookie)
            .field('name_en', 'No Type Exercise');
        expect(res.status).toBe(201);
        expect(res.body.tracking_type).toBe('sets_reps');
        expect(res.body.tracked_metrics).toEqual([]);
    });

    test('creates a Sets & Reps exercise with a subset of tempo/rir/rpe selected', async () => {
        const res = await request
            .post('/api/training/exercise-library')
            .set('Cookie', cookie)
            .field('name_en', 'Bench Press')
            .field('tracking_type', 'sets_reps')
            .field('tracked_metrics', 'tempo')
            .field('tracked_metrics', 'rpe');
        expect(res.status).toBe(201);
        expect(res.body.tracked_metrics.sort()).toEqual(['rpe', 'tempo']);
    });

    test('creates a Time-Based exercise with a subset of duration/distance/incline/speed selected', async () => {
        const res = await request
            .post('/api/training/exercise-library')
            .set('Cookie', cookie)
            .field('name_en', 'Treadmill')
            .field('tracking_type', 'time_based')
            .field('tracked_metrics', 'duration_seconds')
            .field('tracked_metrics', 'speed_kmh');
        expect(res.status).toBe(201);
        expect(res.body.tracked_metrics.sort()).toEqual(['duration_seconds', 'speed_kmh']);
    });

    test('rejects an invalid tracking_type with 400', async () => {
        const res = await request
            .post('/api/training/exercise-library')
            .set('Cookie', cookie)
            .field('name_en', 'Bad Type Exercise')
            .field('tracking_type', 'not_a_real_type');
        expect(res.status).toBe(400);

        const rows = await testPrisma.exercise_library.findMany({ where: { workspace_id: workspaceId, name_en: 'Bad Type Exercise' } });
        expect(rows).toHaveLength(0);
    });

    test('rejects a metric that does not belong to the exercise\'s category (e.g. "incline" on Sets & Reps)', async () => {
        const res = await request
            .post('/api/training/exercise-library')
            .set('Cookie', cookie)
            .field('name_en', 'Bad Metric Exercise')
            .field('tracking_type', 'sets_reps')
            .field('tracked_metrics', 'incline_percent');
        expect(res.status).toBe(400);

        const rows = await testPrisma.exercise_library.findMany({ where: { workspace_id: workspaceId, name_en: 'Bad Metric Exercise' } });
        expect(rows).toHaveLength(0);
    });

    test('updates tracking_type and tracked_metrics on an existing exercise', async () => {
        const created = await request
            .post('/api/training/exercise-library')
            .set('Cookie', cookie)
            .field('name_en', 'Treadmill Run')
            .field('tracking_type', 'sets_reps');
        expect(created.status).toBe(201);

        const updated = await request
            .put(`/api/training/exercise-library/${created.body.id}`)
            .set('Cookie', cookie)
            .field('name_en', 'Treadmill Run')
            .field('tracking_type', 'time_based')
            .field('tracked_metrics', 'duration_seconds')
            .field('tracked_metrics', 'incline_percent');
        expect(updated.status).toBe(200);
        expect(updated.body.tracking_type).toBe('time_based');
        expect(updated.body.tracked_metrics.sort()).toEqual(['duration_seconds', 'incline_percent']);
    });

    test('rejects an invalid tracking_type on update with 400', async () => {
        const created = await request
            .post('/api/training/exercise-library')
            .set('Cookie', cookie)
            .field('name_en', 'Squat')
            .field('tracking_type', 'sets_reps');
        expect(created.status).toBe(201);

        const updated = await request
            .put(`/api/training/exercise-library/${created.body.id}`)
            .set('Cookie', cookie)
            .field('name_en', 'Squat')
            .field('tracking_type', 'bogus');
        expect(updated.status).toBe(400);

        const row = await testPrisma.exercise_library.findUnique({ where: { id: created.body.id } });
        expect(row?.tracking_type).toBe('sets_reps'); // unchanged
    });

    test('tenant isolation: cannot read another workspace\'s exercises', async () => {
        await request
            .post('/api/training/exercise-library')
            .set('Cookie', otherCookie)
            .field('name_en', 'Other Workspace Exercise')
            .field('tracking_type', 'time_based');

        const res = await request.get('/api/training/exercise-library').set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.body.find((e: { name_en: string }) => e.name_en === 'Other Workspace Exercise')).toBeUndefined();
    });
});
