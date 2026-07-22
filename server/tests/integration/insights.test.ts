import jwt from 'jsonwebtoken';
import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie, makeClientCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import * as insightsService from '../../src/modules/insights/insights.service';

function makeAdminCookie(id = 'test-admin-id'): string {
    const token = jwt.sign({ isAdmin: true, id }, process.env.ADMIN_JWT_SECRET!, { expiresIn: '1h' });
    return `admin_token=${token}`;
}

async function makeUserWithPermissions(permissions: Record<string, unknown>, role = 'trainer') {
    const user = await createTestUser();
    const workspace = await createTestWorkspace(user.id);
    const token = jwt.sign(
        { userId: user.id, workspaceId: workspace.id, role, permissions },
        process.env.JWT_SECRET!,
        { expiresIn: '1h' },
    );
    const cookie = `token=${token}`;
    // authMiddleware also validates a matching session row (see auth.ts).
    const crypto = await import('crypto');
    await testPrisma.user_sessions.create({
        data: {
            id: createId(),
            user_id: user.id,
            token_hash: crypto.createHash('sha256').update(token).digest('hex'),
            expires_at: new Date(Date.now() + 60 * 60 * 1000),
        },
    });
    return { user, workspace, cookie };
}

describe('Insights System', () => {
    describe('POST /api/insights — organic submission', () => {
        test('happy path creates an insight scoped to the caller\'s workspace', async () => {
            const user = await createTestUser();
            const workspace = await createTestWorkspace(user.id);
            const cookie = await makeAuthCookie(user.id, workspace.id, 'owner');

            const res = await request.post('/api/insights').set('Cookie', cookie).send({
                sourceType: 'bug',
                textValue: 'The nutrition builder crashes on save',
                module: 'nutrition_builder',
            });

            expect(res.status).toBe(201);
            expect(res.body.workspace_id).toBe(workspace.id);
            expect(res.body.submitted_by_type).toBe('user');
            expect(res.body.submitted_by_id).toBe(user.id);
            expect(res.body.status).toBe('new');
        });

        test('returns 401 when unauthenticated', async () => {
            const res = await request.post('/api/insights').send({ sourceType: 'bug', textValue: 'x' });
            expect(res.status).toBe(401);
        });

        test('returns 403 when the caller lacks insights.write', async () => {
            const { cookie } = await makeUserWithPermissions({ insights: { read: true, write: false, delete: false } });
            const res = await request.post('/api/insights').set('Cookie', cookie).send({ sourceType: 'bug', textValue: 'x' });
            expect(res.status).toBe(403);
        });

        test('returns 400 for an invalid sourceType', async () => {
            const user = await createTestUser();
            const workspace = await createTestWorkspace(user.id);
            const cookie = await makeAuthCookie(user.id, workspace.id, 'owner');

            const res = await request.post('/api/insights').set('Cookie', cookie).send({ sourceType: 'not-a-real-type', textValue: 'x' });
            expect(res.status).toBe(400);
        });

        test('returns 400 for a rating submission missing ratingValue', async () => {
            const user = await createTestUser();
            const workspace = await createTestWorkspace(user.id);
            const cookie = await makeAuthCookie(user.id, workspace.id, 'owner');

            const res = await request.post('/api/insights').set('Cookie', cookie).send({ sourceType: 'rating' });
            expect(res.status).toBe(400);
        });
    });

    describe('Client-portal organic submission', () => {
        test('a client can submit feedback scoped to their own workspace', async () => {
            const user = await createTestUser();
            const workspace = await createTestWorkspace(user.id);
            const client = await testPrisma.clients.create({
                data: {
                    id: createId(), client_code: Math.floor(Math.random() * 90000) + 10000,
                    fname: 'C', lname: 'Lient', email: `client-${createId()}@test.com`, workspace_id: workspace.id,
                },
            });
            const cookie = makeClientCookie(client.id, workspace.id);

            const res = await request.post('/api/client-portal/insights').set('Cookie', cookie).send({
                sourceType: 'feature_request', textValue: 'Please add dark mode to the mobile app',
            });

            expect(res.status).toBe(201);
            expect(res.body.submitted_by_type).toBe('client');
            expect(res.body.submitted_by_id).toBe(client.id);
        });
    });

    describe('GET /api/insights/prompts/active', () => {
        test('returns null when no prompt is active', async () => {
            const user = await createTestUser();
            const workspace = await createTestWorkspace(user.id);
            const cookie = await makeAuthCookie(user.id, workspace.id, 'owner');

            const res = await request.get('/api/insights/prompts/active').set('Cookie', cookie);
            expect(res.status).toBe(200);
            expect(res.body).toBeNull();
        });

        test('returns an active prompt targeted at "everyone", then excludes it once answered', async () => {
            const user = await createTestUser();
            const workspace = await createTestWorkspace(user.id);
            const cookie = await makeAuthCookie(user.id, workspace.id, 'owner');

            const prompt = await insightsService.activatePrompt(
                { workspaceId: null, questionEn: 'How do you like the new builder?', responseType: 'rating', targetAudience: 'everyone' },
                'admin-1',
            );

            const before = await request.get('/api/insights/prompts/active').set('Cookie', cookie);
            expect(before.body?.id).toBe(prompt.id);

            const respond = await request.post(`/api/insights/prompts/${prompt.id}/respond`).set('Cookie', cookie).send({ ratingValue: 8 });
            expect(respond.status).toBe(201);

            const after = await request.get('/api/insights/prompts/active').set('Cookie', cookie);
            expect(after.body).toBeNull();
        });

        test('a prompt scoped to a different workspace is never returned', async () => {
            const otherUser = await createTestUser();
            const otherWorkspace = await createTestWorkspace(otherUser.id);
            await insightsService.activatePrompt(
                { workspaceId: otherWorkspace.id, questionEn: 'Workspace-specific question', responseType: 'text', targetAudience: 'everyone' },
                'admin-1',
            );

            const user = await createTestUser();
            const workspace = await createTestWorkspace(user.id);
            const cookie = await makeAuthCookie(user.id, workspace.id, 'owner');

            const res = await request.get('/api/insights/prompts/active').set('Cookie', cookie);
            expect(res.body).toBeNull();
        });
    });

    describe('Admin: activating a prompt enforces "one active question at a time"', () => {
        test('activating a new "everyone" prompt ends a prior active prompt with an overlapping audience', async () => {
            const first = await insightsService.activatePrompt(
                { workspaceId: null, questionEn: 'First question', responseType: 'text', targetAudience: 'user' },
                'admin-1',
            );

            const res = await request.post('/api/admin/prompts').set('Cookie', makeAdminCookie()).send({
                questionEn: 'Second question', responseType: 'text', targetAudience: 'everyone',
            });
            expect(res.status).toBe(201);

            const firstAfter = await testPrisma.insight_prompts.findUnique({ where: { id: first.id } });
            expect(firstAfter?.status).toBe('ended');
        });

        test('activating a prompt for a non-overlapping audience leaves the other active', async () => {
            const clientPrompt = await insightsService.activatePrompt(
                { workspaceId: null, questionEn: 'For clients', responseType: 'text', targetAudience: 'client' },
                'admin-1',
            );

            await request.post('/api/admin/prompts').set('Cookie', makeAdminCookie()).send({
                questionEn: 'For coaches', responseType: 'text', targetAudience: 'user',
            });

            const clientPromptAfter = await testPrisma.insight_prompts.findUnique({ where: { id: clientPrompt.id } });
            expect(clientPromptAfter?.status).toBe('active');
        });
    });

    describe('Admin triage', () => {
        test('triaging with newRoadmapItemTitle creates a roadmap item on the spot and logs an insight_event', async () => {
            const user = await createTestUser();
            const workspace = await createTestWorkspace(user.id);
            const insight = await testPrisma.insights.create({
                data: {
                    id: createId(), workspace_id: workspace.id, source_type: 'feature_request',
                    submitted_by_type: 'user', submitted_by_id: user.id, text_value: 'Duplicate workout templates', status: 'new',
                },
            });

            const res = await request.patch(`/api/admin/insights/${insight.id}`).set('Cookie', makeAdminCookie()).send({
                status: 'triaged', newRoadmapItemTitle: 'Workout template duplication',
            });

            expect(res.status).toBe(200);
            expect(res.body.status).toBe('triaged');
            expect(res.body.roadmap_item_id).toBeTruthy();

            const roadmapItem = await testPrisma.roadmap_items.findUnique({ where: { id: res.body.roadmap_item_id } });
            expect(roadmapItem?.title).toBe('Workout template duplication');

            const events = await testPrisma.insight_events.findMany({ where: { entity_type: 'insight', entity_id: insight.id } });
            expect(events).toHaveLength(1);
            expect(events[0].from_status).toBe('new');
            expect(events[0].to_status).toBe('triaged');
        });
    });

    describe('Admin: shipping a roadmap item closes the loop', () => {
        test('notifies each distinct submitter exactly once, resolves linked insights, and logs the transition', async () => {
            const userA = await createTestUser();
            const workspaceA = await createTestWorkspace(userA.id);
            const userB = await createTestUser();
            const workspaceB = await createTestWorkspace(userB.id);

            const roadmapItem = await testPrisma.roadmap_items.create({
                data: { id: createId(), title: 'Duplicate workout templates', status: 'planned' },
            });

            // userA submits two insights linked to the same roadmap item — should
            // still produce exactly one notification, not two.
            await testPrisma.insights.createMany({
                data: [
                    { id: createId(), workspace_id: workspaceA.id, source_type: 'feature_request', submitted_by_type: 'user', submitted_by_id: userA.id, text_value: 'ask 1', status: 'triaged', roadmap_item_id: roadmapItem.id },
                    { id: createId(), workspace_id: workspaceA.id, source_type: 'feature_request', submitted_by_type: 'user', submitted_by_id: userA.id, text_value: 'ask 2', status: 'triaged', roadmap_item_id: roadmapItem.id },
                    { id: createId(), workspace_id: workspaceB.id, source_type: 'feature_request', submitted_by_type: 'user', submitted_by_id: userB.id, text_value: 'ask 3', status: 'triaged', roadmap_item_id: roadmapItem.id },
                ],
            });

            const res = await request.patch(`/api/admin/roadmap/${roadmapItem.id}`).set('Cookie', makeAdminCookie()).send({
                status: 'shipped', releaseTag: 'v1.42',
            });
            expect(res.status).toBe(200);
            expect(res.body.release_tag).toBe('v1.42');

            const notificationsA = await testPrisma.notifications.findMany({ where: { workspace_id: workspaceA.id, recipient_id: userA.id } });
            expect(notificationsA).toHaveLength(1);
            expect(notificationsA[0].type).toBe('insight.roadmap_shipped');

            const notificationsB = await testPrisma.notifications.findMany({ where: { workspace_id: workspaceB.id, recipient_id: userB.id } });
            expect(notificationsB).toHaveLength(1);

            const resolvedInsights = await testPrisma.insights.findMany({ where: { roadmap_item_id: roadmapItem.id } });
            expect(resolvedInsights.every(i => i.status === 'resolved')).toBe(true);

            const events = await testPrisma.insight_events.findMany({ where: { entity_type: 'roadmap_item', entity_id: roadmapItem.id } });
            expect(events).toHaveLength(1);
            expect(events[0].to_status).toBe('shipped');
        });

        test('declining sends the "declined" copy, not silence', async () => {
            const user = await createTestUser();
            const workspace = await createTestWorkspace(user.id);
            const roadmapItem = await testPrisma.roadmap_items.create({
                data: { id: createId(), title: 'A request we will not build', status: 'proposed' },
            });
            await testPrisma.insights.create({
                data: { id: createId(), workspace_id: workspace.id, source_type: 'feature_request', submitted_by_type: 'user', submitted_by_id: user.id, text_value: 'ask', status: 'triaged', roadmap_item_id: roadmapItem.id },
            });

            await request.patch(`/api/admin/roadmap/${roadmapItem.id}`).set('Cookie', makeAdminCookie()).send({
                status: 'declined', note: 'Out of scope for now',
            });

            const notifications = await testPrisma.notifications.findMany({ where: { workspace_id: workspace.id, recipient_id: user.id } });
            expect(notifications).toHaveLength(1);
            expect(notifications[0].type).toBe('insight.roadmap_declined');
            expect(notifications[0].body).toContain('Out of scope for now');
        });
    });

    describe('Tenant isolation', () => {
        test('an insight submitted in workspace A is invisible when the admin filters by workspace B', async () => {
            const userA = await createTestUser();
            const workspaceA = await createTestWorkspace(userA.id);
            await testPrisma.insights.create({
                data: { id: createId(), workspace_id: workspaceA.id, source_type: 'bug', submitted_by_type: 'user', submitted_by_id: userA.id, text_value: 'A bug', status: 'new' },
            });

            const userB = await createTestUser();
            const workspaceB = await createTestWorkspace(userB.id);

            const res = await request.get('/api/admin/insights').set('Cookie', makeAdminCookie()).query({ workspaceId: workspaceB.id });
            expect(res.body).toHaveLength(0);
        });
    });

    describe('Admin routes require admin auth', () => {
        test('returns 401 without an admin token', async () => {
            const res = await request.get('/api/admin/insights');
            expect(res.status).toBe(401);
        });
    });
});
