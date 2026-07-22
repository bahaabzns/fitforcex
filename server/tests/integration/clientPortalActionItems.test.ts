import { request, createTestUser, createTestWorkspace, makeAuthCookie, makeClientCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { createId } from '@paralleldrive/cuid2';
import { recordEvent } from '../../src/lib/events';

const READ_ONLY = {
    keep_portal_access:         true,
    view_training_plans:        true,
    view_nutrition_plans:       true,
    view_progress_history:      true,
    view_assessments:           true,
    view_checkins:              true,
    allow_messaging:            false,
    allow_submit_checkins:      false,
    allow_booking_appointments: false,
    allow_download_files:       false,
    allow_food_swap:            false,
};

function daysAgo(n: number): Date {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d;
}

/**
 * GET /client-portal/action-items aggregates pending forms, unread
 * plan.assigned/plan.duration_restarted notifications, and a subscription in
 * its grace period into one "needs your attention" list for the client
 * portal home page. Each source already has its own dedicated endpoint —
 * this suite only covers the aggregation/filtering this endpoint adds.
 */
describe('Client portal action items — GET /client-portal/action-items', () => {
    let workspaceId: string;
    let ownerCookie: string;
    let clientId: string;
    let cookie: string;

    beforeEach(async () => {
        const user      = await createTestUser();
        const workspace = await createTestWorkspace(user.id);
        workspaceId     = workspace.id;
        ownerCookie     = await makeAuthCookie(user.id, workspaceId, 'owner');

        const client = await testPrisma.clients.create({
            data: {
                id:           createId(),
                client_code:  Math.floor(Math.random() * 90000) + 10000,
                fname:        'Test',
                lname:        'Client',
                email:        `client-${createId()}@test.com`,
                workspace_id: workspaceId,
            },
        });
        clientId = client.id;
        cookie   = makeClientCookie(clientId, workspaceId);
    });

    test('a client with nothing pending gets an empty list', async () => {
        const res = await request.get('/api/client-portal/action-items').set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('includes a pending form request with its title', async () => {
        const form = await testPrisma.forms.create({
            data: { id: createId(), workspace_id: workspaceId, title_en: 'Weekly Check-in', title_ar: 'تسجيل أسبوعي' },
        });
        const formRequest = await testPrisma.form_requests.create({
            data: { id: createId(), workspace_id: workspaceId, form_id: form.id, client_id: clientId, status: 'pending' },
        });

        const res = await request.get('/api/client-portal/action-items').set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0]).toMatchObject({
            id:       formRequest.id,
            kind:     'pending_form',
            title_en: 'Weekly Check-in',
            title_ar: 'تسجيل أسبوعي',
            href:     `/portal/forms/${formRequest.id}`,
        });
    });

    test('excludes a submitted form request', async () => {
        const form = await testPrisma.forms.create({
            data: { id: createId(), workspace_id: workspaceId, title_en: 'Weekly Check-in' },
        });
        await testPrisma.form_requests.create({
            data: {
                id: createId(), workspace_id: workspaceId, form_id: form.id, client_id: clientId,
                status: 'submitted', submitted_at: new Date(),
            },
        });

        const res = await request.get('/api/client-portal/action-items').set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('includes an unread plan.assigned notification, pointing at the nutrition page', async () => {
        await recordEvent({
            workspaceId,
            type:       'plan.assigned',
            title:      'A new nutrition plan was assigned to you',
            recipients: [{ type: 'client', id: clientId }],
            entity:     { type: 'nutrition_plan', id: createId() },
        });

        const res = await request.get('/api/client-portal/action-items').set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0]).toMatchObject({
            kind:     'plan_update',
            title_en: 'A new nutrition plan was assigned to you',
            href:     '/portal/nutrition',
        });
    });

    test('collapses repeated unread nutrition-plan notifications to just the latest', async () => {
        await recordEvent({
            workspaceId,
            type:       'plan.assigned',
            title:      'A new nutrition plan was assigned to you',
            recipients: [{ type: 'client', id: clientId }],
            entity:     { type: 'nutrition_plan', id: createId() },
        });
        await recordEvent({
            workspaceId,
            type:       'plan.duration_restarted',
            title:      'Your nutrition plan has been restarted',
            recipients: [{ type: 'client', id: clientId }],
            entity:     { type: 'nutrition_plan', id: createId() },
        });

        const res = await request.get('/api/client-portal/action-items').set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0]).toMatchObject({ kind: 'plan_update', title_en: 'Your nutrition plan has been restarted' });
    });

    test('keeps one nutrition-plan item and one training-plan item at the same time', async () => {
        await recordEvent({
            workspaceId,
            type:       'plan.assigned',
            title:      'A new nutrition plan was assigned to you',
            recipients: [{ type: 'client', id: clientId }],
            entity:     { type: 'nutrition_plan', id: createId() },
        });
        await recordEvent({
            workspaceId,
            type:       'plan.assigned',
            title:      'A new training plan was assigned to you',
            recipients: [{ type: 'client', id: clientId }],
            entity:     { type: 'training_plan', id: createId() },
        });

        const res = await request.get('/api/client-portal/action-items').set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(2);
        expect(res.body.map((i: { href: string }) => i.href).sort()).toEqual(['/portal/nutrition', '/portal/training']);
    });

    test('excludes a plan.assigned notification the client already read', async () => {
        await recordEvent({
            workspaceId,
            type:       'plan.assigned',
            title:      'A new nutrition plan was assigned to you',
            recipients: [{ type: 'client', id: clientId }],
        });
        await testPrisma.notifications.updateMany({
            where: { recipient_type: 'client', recipient_id: clientId },
            data:  { read_at: new Date() },
        });

        const res = await request.get('/api/client-portal/action-items').set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('excludes unrelated notification types, e.g. a chat message', async () => {
        await recordEvent({
            workspaceId,
            type:       'message.received',
            title:      'New message from your coach',
            recipients: [{ type: 'client', id: clientId }],
        });

        const res = await request.get('/api/client-portal/action-items').set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });

    test('includes a subscription-renewal item for a client within their grace window', async () => {
        await request.put('/api/subscription-policies').set('Cookie', ownerCookie).send({
            expired: { ...READ_ONLY, grace_period_days: 7 },
            frozen:  { ...READ_ONLY },
        });
        await testPrisma.workspaces.update({ where: { id: workspaceId }, data: { renewal_link: 'https://pay.example.com/renew' } });

        // Period ran out 5 days ago — inside a 7-day grace window.
        await testPrisma.transactions.create({
            data: {
                id:                      createId(),
                transaction_code:        Math.floor(Math.random() * 90000) + 10000,
                workspace_id:            workspaceId,
                client_id:               clientId,
                client_name:             'Test Client',
                payment_method:          'cash',
                amount:                  100,
                status:                  'completed',
                duration:                30,
                start_mode:              'custom',
                subscription_start_date: daysAgo(35),
            },
        });

        const res = await request.get('/api/client-portal/action-items').set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.body).toHaveLength(1);
        expect(res.body[0]).toMatchObject({
            id:   'subscription',
            kind: 'subscription',
            href: 'https://pay.example.com/renew',
        });
    });

    test('excludes the subscription item once fully past the grace window (handled by the portal shell instead)', async () => {
        await request.put('/api/subscription-policies').set('Cookie', ownerCookie).send({
            expired: { ...READ_ONLY, grace_period_days: 0 },
            frozen:  { ...READ_ONLY },
        });
        await testPrisma.transactions.create({
            data: {
                id:                      createId(),
                transaction_code:        Math.floor(Math.random() * 90000) + 10000,
                workspace_id:            workspaceId,
                client_id:               clientId,
                client_name:             'Test Client',
                payment_method:          'cash',
                amount:                  100,
                status:                  'completed',
                duration:                30,
                start_mode:              'custom',
                subscription_start_date: daysAgo(60),
            },
        });

        const res = await request.get('/api/client-portal/action-items').set('Cookie', cookie);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([]);
    });
});
