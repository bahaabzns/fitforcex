import jwt from 'jsonwebtoken';
import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';

const DAY_MS = 24 * 60 * 60 * 1000;
const REPORT_TIME_ZONE = 'Africa/Cairo';

function adminCookie(): string {
    const token = jwt.sign({ isAdmin: true, id: 'test-admin' }, process.env.ADMIN_JWT_SECRET!, { expiresIn: '1h' });
    return `admin_token=${token}`;
}

// The page treats "today" as a Cairo calendar day, so the tests must too.
function cairoDate(offsetDays = 0): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: REPORT_TIME_ZONE }).format(new Date(Date.now() + offsetDays * DAY_MS));
}

function listCoaches(query = '') {
    return request.get(`/api/admin/follow-ups${query}`).set('Cookie', adminCookie());
}

function addFollowUp(workspaceId: string, body: Record<string, unknown>) {
    return request.post(`/api/admin/follow-ups/${workspaceId}`).set('Cookie', adminCookie()).send(body);
}

describe('Admin WhatsApp follow-ups', () => {
    let paidPlanId: string;

    beforeEach(async () => {
        await testPrisma.workspace_payments.deleteMany({ where: { plans: { display_name: 'Follow-up Plan' } } });
        await testPrisma.workspace_subscriptions.deleteMany({ where: { plans: { display_name: 'Follow-up Plan' } } });
        await testPrisma.plans.deleteMany({ where: { display_name: 'Follow-up Plan' } });
        paidPlanId = (await testPrisma.plans.create({
            data: { id: createId(), name: `plan-${createId()}`, display_name: 'Follow-up Plan', is_active: true },
        })).id;
    });

    afterEach(async () => {
        await testPrisma.workspace_payments.deleteMany({ where: { plan_id: paidPlanId } });
        await testPrisma.workspace_subscriptions.deleteMany({ where: { plan_id: paidPlanId } });
        await testPrisma.plans.deleteMany({ where: { id: paidPlanId } });
    });

    async function createCoach(options: { phone?: string | null; planExpiresAt?: Date | null; onPaidPlan?: boolean; signedUpDaysAgo?: number } = {}) {
        const owner = await createTestUser({ phone: options.phone === undefined ? '+201001234567' : options.phone });
        const workspace = await createTestWorkspace(owner.id);
        if (options.signedUpDaysAgo !== undefined) {
            await testPrisma.workspaces.update({
                where: { id: workspace.id }, data: { created_at: new Date(Date.now() - options.signedUpDaysAgo * DAY_MS) },
            });
        }
        if (options.onPaidPlan) {
            await testPrisma.workspace_subscriptions.create({
                data: {
                    id: createId(), workspace_id: workspace.id, plan_id: paidPlanId, status: 'active',
                    expires_at: options.planExpiresAt === undefined ? null : options.planExpiresAt,
                },
            });
        }
        return workspace;
    }

    async function createClients(workspaceId: string, count: number, overrides: Record<string, unknown> = {}) {
        for (let index = 0; index < count; index++) {
            await testPrisma.clients.create({
                data: {
                    id: createId(), client_code: 10000 + Math.floor(Math.random() * 80000), fname: 'C', lname: `${index}`,
                    email: `c-${createId()}@test.com`, workspace_id: workspaceId, ...overrides,
                },
            });
        }
    }

    function rowFor(body: { coaches: Array<{ workspaceId: string }> }, workspaceId: string) {
        return body.coaches.find(coach => coach.workspaceId === workspaceId);
    }

    describe('listing coaches', () => {
        test('requires an admin (401 without one)', async () => {
            const res = await request.get('/api/admin/follow-ups');
            expect(res.status).toBe(401);
        });

        test('reports free, subscribed and expired by plan state, and days since signup', async () => {
            const free       = await createCoach({ signedUpDaysAgo: 5 });
            const subscribed = await createCoach({ onPaidPlan: true, planExpiresAt: new Date(Date.now() + 10 * DAY_MS) });
            const expired    = await createCoach({ onPaidPlan: true, planExpiresAt: new Date(Date.now() - 2 * DAY_MS) });

            const res = await listCoaches();

            expect(res.status).toBe(200);
            expect(rowFor(res.body, free.id)).toMatchObject({ status: 'free', daysSinceSignup: 5 });
            expect(rowFor(res.body, subscribed.id)).toMatchObject({ status: 'subscribed' });
            expect(rowFor(res.body, expired.id)).toMatchObject({ status: 'expired' });
        });

        test('treats a past customer who dropped back to Free as expired', async () => {
            const workspace = await createCoach();
            await testPrisma.workspace_payments.create({
                data: {
                    id: createId(), workspace_id: workspace.id, plan_id: paidPlanId, amount: 100,
                    duration_days: 30, gateway_status: 'paid', paid_at: new Date(Date.now() - 40 * DAY_MS),
                },
            });

            const res = await listCoaches();

            expect(rowFor(res.body, workspace.id)).toMatchObject({ status: 'expired' });
        });

        test('prepares the WhatsApp number and flags a mistyped one', async () => {
            const international = await createCoach({ phone: '+20 100 123 4567' });
            const local         = await createCoach({ phone: '01001234567' });
            const mistyped      = await createCoach({ phone: '+2012321234323456543' });
            const missing       = await createCoach({ phone: null });

            const res = await listCoaches();

            expect(rowFor(res.body, international.id)).toMatchObject({ whatsappNumber: '201001234567', isPhoneSuspicious: false });
            expect(rowFor(res.body, local.id)).toMatchObject({ whatsappNumber: '201001234567' });
            expect(rowFor(res.body, mistyped.id)).toMatchObject({ isPhoneSuspicious: true });
            expect(rowFor(res.body, missing.id)).toMatchObject({ whatsappNumber: null, isPhoneSuspicious: false });
        });

        test('counts only active clients', async () => {
            const workspace = await createCoach();
            await createClients(workspace.id, 2);
            await createClients(workspace.id, 1, { archived_at: new Date() });
            await createClients(workspace.id, 1, { deleted_at: new Date() });

            const res = await listCoaches();

            expect(rowFor(res.body, workspace.id)).toMatchObject({ clientsCount: 2 });
        });

        test('hides archived workspaces unless asked', async () => {
            const archived = await createCoach();
            await testPrisma.workspaces.update({ where: { id: archived.id }, data: { archived_at: new Date() } });

            const hidden = await listCoaches();
            const shown  = await listCoaches('?includeArchived=true');

            expect(rowFor(hidden.body, archived.id)).toBeUndefined();
            expect(rowFor(shown.body, archived.id)).toMatchObject({ isArchived: true });
        });
    });

    describe('recording follow-ups', () => {
        test('saves an entry, defaults the date to now, and shows it in the list', async () => {
            const workspace = await createCoach();

            const res = await addFollowUp(workspace.id, { sentNote: 'Sent welcome message', replyNote: 'Will try this week', nextFollowUpOn: cairoDate(3) });

            expect(res.status).toBe(201);
            expect(res.body).toMatchObject({ sentNote: 'Sent welcome message', replyNote: 'Will try this week', nextFollowUpOn: cairoDate(3) });
            expect(Math.abs(new Date(res.body.followedUpAt).getTime() - Date.now())).toBeLessThan(60_000);

            const list = await listCoaches();
            expect(rowFor(list.body, workspace.id)).toMatchObject({ followUpCount: 1, nextFollowUpOn: cairoDate(3), isDue: false });
        });

        test('marks the coach due when the next follow-up is today or overdue, not when it is in the future', async () => {
            const dueToday = await createCoach();
            const overdue  = await createCoach();
            const later    = await createCoach();
            await addFollowUp(dueToday.id, { sentNote: 'a', nextFollowUpOn: cairoDate(0) });
            await addFollowUp(overdue.id, { sentNote: 'b', followedUpAt: cairoDate(-10), nextFollowUpOn: cairoDate(-2) });
            await addFollowUp(later.id, { sentNote: 'c', nextFollowUpOn: cairoDate(2) });

            const list = await listCoaches();

            expect(rowFor(list.body, dueToday.id)).toMatchObject({ isDue: true });
            expect(rowFor(list.body, overdue.id)).toMatchObject({ isDue: true });
            expect(rowFor(list.body, later.id)).toMatchObject({ isDue: false });
        });

        test('lists history newest first, and the newest entry decides the reminder', async () => {
            const workspace = await createCoach();
            await addFollowUp(workspace.id, { sentNote: 'first', followedUpAt: cairoDate(-5), nextFollowUpOn: cairoDate(-1) });
            await addFollowUp(workspace.id, { sentNote: 'second', replyNote: 'Subscribed soon' });

            const history = await request.get(`/api/admin/follow-ups/${workspace.id}`).set('Cookie', adminCookie());

            expect(history.status).toBe(200);
            expect(history.body.entries.map((entry: { sentNote: string }) => entry.sentNote)).toEqual(['second', 'first']);

            // the older entry's overdue date no longer counts — the latest message set no new date
            const list = await listCoaches();
            expect(rowFor(list.body, workspace.id)).toMatchObject({ isDue: false, nextFollowUpOn: null, followUpCount: 2 });
        });

        test('rejects an entry with no message (400)', async () => {
            const workspace = await createCoach();
            const res = await addFollowUp(workspace.id, { sentNote: '   ' });
            expect(res.status).toBe(400);
        });

        test('rejects a next follow-up dated before the follow-up itself (400)', async () => {
            const workspace = await createCoach();
            const res = await addFollowUp(workspace.id, { sentNote: 'x', followedUpAt: cairoDate(0), nextFollowUpOn: cairoDate(-3) });
            expect(res.status).toBe(400);
        });

        test('returns 404 for an unknown workspace', async () => {
            const res = await addFollowUp('does-not-exist', { sentNote: 'x' });
            expect(res.status).toBe(404);
        });
    });

    describe('editing and deleting', () => {
        test('edits the notes and next date of an entry', async () => {
            const workspace = await createCoach();
            const created = await addFollowUp(workspace.id, { sentNote: 'draft' });

            const res = await request.patch(`/api/admin/follow-ups/entries/${created.body.id}`).set('Cookie', adminCookie())
                .send({ sentNote: 'final wording', replyNote: 'Interested', nextFollowUpOn: cairoDate(4) });

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ sentNote: 'final wording', replyNote: 'Interested', nextFollowUpOn: cairoDate(4) });
        });

        test('deleting removes the entry from history and the count, and a second delete is 404', async () => {
            const workspace = await createCoach();
            const created = await addFollowUp(workspace.id, { sentNote: 'oops' });

            const first = await request.delete(`/api/admin/follow-ups/entries/${created.body.id}`).set('Cookie', adminCookie());
            const second = await request.delete(`/api/admin/follow-ups/entries/${created.body.id}`).set('Cookie', adminCookie());
            const history = await request.get(`/api/admin/follow-ups/${workspace.id}`).set('Cookie', adminCookie());
            const list = await listCoaches();

            expect(first.status).toBe(204);
            expect(second.status).toBe(404);
            expect(history.body.entries).toHaveLength(0);
            expect(rowFor(list.body, workspace.id)).toMatchObject({ followUpCount: 0 });
        });
    });

    describe('transfers awaiting confirmation', () => {
        let variationId: string;

        beforeEach(async () => {
            variationId = (await testPrisma.plan_variations.create({
                data: { id: createId(), plan_id: paidPlanId, price_monthly: 300, currency: 'EGP', is_default: true },
            })).id;
        });

        function createPayment(workspaceId: string, overrides: Record<string, unknown> = {}) {
            return testPrisma.workspace_payments.create({
                data: {
                    id: createId(), workspace_id: workspaceId, plan_id: paidPlanId, variation_id: variationId, amount: 300,
                    currency: 'EGP', duration_days: 30, gateway_status: 'pending', payment_method: 'manual',
                    reference_code: `REF-${createId().slice(0, 8)}`, ...overrides,
                },
            });
        }

        test("shows a coach's pending manual transfer with its amount, reference and days waiting", async () => {
            const workspace = await createCoach();
            const payment = await createPayment(workspace.id, { created_at: new Date(Date.now() - 3 * DAY_MS - 60_000) });

            const res = await listCoaches();

            expect(rowFor(res.body, workspace.id)).toMatchObject({
                pendingTransfer: { amount: 300, currency: 'EGP', referenceCode: payment.reference_code, waitingDays: 3 },
            });
        });

        test('ignores pending gateway payments (abandoned checkouts) and payments already paid', async () => {
            const card = await createCoach();
            await createPayment(card.id, { payment_method: 'card' });
            const paid = await createCoach();
            await createPayment(paid.id, { gateway_status: 'paid', paid_at: new Date() });

            const res = await listCoaches();

            expect(rowFor(res.body, card.id)).toMatchObject({ pendingTransfer: null });
            expect(rowFor(res.body, paid.id)).toMatchObject({ pendingTransfer: null });
        });

        test('drops off the list once the transfer is confirmed', async () => {
            const workspace = await createCoach({ onPaidPlan: true, planExpiresAt: null });
            const payment = await createPayment(workspace.id);

            const confirmed = await request.post(`/api/admin/payments/${payment.id}/mark-paid`).set('Cookie', adminCookie());
            const res = await listCoaches();

            expect(confirmed.status).toBe(200);
            expect(rowFor(res.body, workspace.id)).toMatchObject({ pendingTransfer: null });
        });

        test('does not treat a 0 EGP free grant as a past customer', async () => {
            const workspace = await createCoach();
            await createPayment(workspace.id, { amount: 0, gateway_status: 'paid', paid_at: new Date(Date.now() - 40 * DAY_MS) });

            const res = await listCoaches();

            expect(rowFor(res.body, workspace.id)).toMatchObject({ status: 'free' });
        });
    });
});
