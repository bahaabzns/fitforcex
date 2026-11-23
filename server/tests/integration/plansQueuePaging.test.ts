import { createId } from '@paralleldrive/cuid2';
import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';

// Paged mode of GET /forms/queue (?page=…), plus /queue/summary and /queue/ids: the server does the searching,
// filtering, sorting and paging that the Plans Queue table used to do in the browser over every row.

const MINUTE = 60_000;
const minutesAgo = (minutes: number) => new Date(Date.now() - minutes * MINUTE);

type Item = { id: string; clientName: string; status: string; assignedTo: string | null; labelId: string | null; postAction: string; responseCount: number; responses: unknown[] };
type Page = { items: Item[]; total: number; page: number; pageSize: number; includedItem: Item | null };

describe('Plans Queue — server-side paging, search, filters and sort', () => {
    let workspaceId: string;
    let ownerCookie: string;
    let alice: { id: string };
    let bob: { id: string };
    let checkInFormId: string;
    let nutritionFormId: string;
    let saraId: string;
    let omarId: string;
    let linaId: string;
    let urgentLabelId: string;

    const makeClient = (fname: string, lname: string, currentPackage: string | null, clientCode: number, workspace = workspaceId) =>
        testPrisma.clients.create({
            data: { id: createId(), client_code: clientCode, fname, lname, email: `${fname.toLowerCase()}-${createId()}@test.com`, workspace_id: workspace, current_package: currentPackage },
        });

    const makeRequest = (data: { clientId: string; formId: string; status: string; requestedAt?: Date; assignedTo?: string | null; labelId?: string | null; postAction?: string; workspace?: string }) =>
        testPrisma.form_requests.create({
            data: {
                id: createId(), workspace_id: data.workspace ?? workspaceId, form_id: data.formId, client_id: data.clientId, status: data.status,
                requested_at: data.requestedAt ?? new Date(), submitted_at: data.status === 'submitted' || data.status === 'reviewed' ? new Date() : null,
                assigned_to: data.assignedTo ?? null, label_id: data.labelId ?? null, ...(data.postAction !== undefined ? { post_action: data.postAction } : {}),
            },
        });

    const getPage = (params: Record<string, unknown> = {}, cookie = ownerCookie) => {
        const query = { page: 1, ...params };
        const search = new URLSearchParams(Object.entries(query).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]));
        return request.get(`/api/forms/queue?${search.toString()}`).set('Cookie', cookie);
    };
    const withFilters = (filters: unknown, extra: Record<string, unknown> = {}) => getPage({ ...extra, filters: JSON.stringify(filters) });
    const clientNames = (body: Page) => body.items.map((item) => item.clientName);

    beforeEach(async () => {
        const owner = await createTestUser();
        const ws = await createTestWorkspace(owner.id);
        workspaceId = ws.id;
        ownerCookie = await makeAuthCookie(owner.id, workspaceId, 'owner');
        alice = await createTestUser({ fname: 'Alice', lname: 'Zed' });
        bob = await createTestUser({ fname: 'Bob', lname: 'Adams' });

        checkInFormId = (await testPrisma.forms.create({ data: { id: createId(), workspace_id: workspaceId, title_en: 'Weekly Check-in', post_action: 'nothing' } })).id;
        nutritionFormId = (await testPrisma.forms.create({ data: { id: createId(), workspace_id: workspaceId, title_en: 'Nutrition Intake', post_action: 'nutrition-plan' } })).id;
        urgentLabelId = (await testPrisma.plans_queue_labels.create({ data: { id: createId(), workspace_id: workspaceId, name: 'Urgent', color: 'pink' } })).id;

        saraId = (await makeClient('Sara', 'Hassan', 'Gold', 101)).id;
        omarId = (await makeClient('Omar', 'Nabil', 'Silver', 102)).id;
        linaId = (await makeClient('Lina', 'Fathy', null, 103)).id;
    });

    describe('paging', () => {
        beforeEach(async () => {
            // 30 need-action rows, newest first by creation order: row 0 is the newest.
            for (let index = 0; index < 30; index++) {
                await makeRequest({ clientId: saraId, formId: checkInFormId, status: 'submitted', requestedAt: minutesAgo(index + 1) });
            }
        });

        test('returns one page and the total number of matching rows', async () => {
            const res = await getPage({ pageSize: 10 });

            expect(res.status).toBe(200);
            expect(res.body).toMatchObject({ total: 30, page: 1, pageSize: 10 });
            expect(res.body.items).toHaveLength(10);
        });

        test('pages never overlap, never skip a row, and run newest first', async () => {
            const pages = await Promise.all([1, 2, 3, 4].map((page) => getPage({ pageSize: 10, page })));

            const ids = pages.flatMap((res) => res.body.items.map((item: Item) => item.id));
            expect(pages[3].body.items).toEqual([]);
            expect(ids).toHaveLength(30);
            expect(new Set(ids).size).toBe(30);
            const requestedAtOrder = await testPrisma.form_requests.findMany({ where: { id: { in: ids } }, select: { id: true, requested_at: true } });
            const byId = new Map(requestedAtOrder.map((row) => [row.id, row.requested_at!.getTime()]));
            const times = ids.map((id) => byId.get(id)!);
            expect(times).toEqual([...times].sort((a, b) => b - a));
        });

        test('rows carry an answer count, never the answers', async () => {
            const [first] = (await getPage({ pageSize: 10 })).body.items as Item[];
            await testPrisma.form_responses.create({ data: { id: createId(), request_id: first.id, question_id: null, answer: 'hello' } });

            const [refetched] = (await getPage({ pageSize: 10 })).body.items as Item[];

            expect(refetched.id).toBe(first.id);
            expect(refetched.responseCount).toBe(1);
            expect(refetched.responses).toEqual([]);
        });

        test('an unsupported page size falls back to the default size', async () => {
            const res = await getPage({ pageSize: 7 });

            expect(res.body.pageSize).toBe(25);
            expect(res.body.items).toHaveLength(25);
        });

        test('without ?page= the response is still the plain array older callers expect', async () => {
            const res = await request.get('/api/forms/queue').set('Cookie', ownerCookie);

            expect(Array.isArray(res.body)).toBe(true);
            expect(res.body).toHaveLength(30);
        });
    });

    describe('view and includeId', () => {
        test('the need-action view leaves out reviewed and awaiting rows; the all view keeps them', async () => {
            await makeRequest({ clientId: saraId, formId: checkInFormId, status: 'submitted' });
            await makeRequest({ clientId: omarId, formId: checkInFormId, status: 'reviewed' });
            await makeRequest({ clientId: linaId, formId: checkInFormId, status: 'pending' });

            const needAction = await getPage({ view: 'need-action' });
            const everything = await getPage();

            expect(needAction.body.total).toBe(1);
            expect(everything.body.total).toBe(3);
        });

        test('includedItem returns the row the coach just finished, outside the filters and the page', async () => {
            await makeRequest({ clientId: saraId, formId: checkInFormId, status: 'submitted' });
            const finished = await makeRequest({ clientId: omarId, formId: checkInFormId, status: 'reviewed' });

            const res = await getPage({ view: 'need-action', includeId: finished.id });

            expect(res.body.total).toBe(1);
            expect(res.body.includedItem).toMatchObject({ id: finished.id, status: 'action-done' });
        });

        test('includedItem is null for an id from another workspace', async () => {
            const stranger = await createTestUser();
            const strangerWs = await createTestWorkspace(stranger.id);
            const strangerClient = await makeClient('Eve', 'Other', null, 900, strangerWs.id);
            const strangerForm = await testPrisma.forms.create({ data: { id: createId(), workspace_id: strangerWs.id, title_en: 'Theirs' } });
            const foreign = await makeRequest({ clientId: strangerClient.id, formId: strangerForm.id, status: 'reviewed', workspace: strangerWs.id });

            const res = await getPage({ view: 'need-action', includeId: foreign.id });

            expect(res.body.includedItem).toBeNull();
        });
    });

    describe('search', () => {
        beforeEach(async () => {
            await makeRequest({ clientId: saraId, formId: checkInFormId, status: 'submitted' });
            await makeRequest({ clientId: omarId, formId: nutritionFormId, status: 'submitted' });
            await makeRequest({ clientId: linaId, formId: checkInFormId, status: 'submitted' });
        });

        test.each([
            ['client first name, any case', 'sARa', ['Sara Hassan']],
            ['the full client name', 'omar nabil', ['Omar Nabil']],
            ['client code', '103', ['Lina Fathy']],
            ['form title', 'nutrition', ['Omar Nabil']],
        ])('finds a row by %s', async (_name, search, expected) => {
            expect(clientNames((await getPage({ search })).body)).toEqual(expected);
        });

        test('finds a row by client email', async () => {
            const sara = await testPrisma.clients.findUnique({ where: { id: saraId } });

            expect(clientNames((await getPage({ search: sara!.email! })).body)).toEqual(['Sara Hassan']);
        });

        test('a search with no match returns an empty page and a zero total', async () => {
            const res = await getPage({ search: 'nobody-by-this-name' });

            expect(res.body).toMatchObject({ items: [], total: 0 });
        });

        test('percent and underscore in the search match literally, not as wildcards', async () => {
            expect((await getPage({ search: '%' })).body.total).toBe(0);
            expect((await getPage({ search: 'S_ra' })).body.total).toBe(0);
        });
    });

    describe('filters', () => {
        let aliceRow: string;
        let bobRow: string;

        beforeEach(async () => {
            aliceRow = (await makeRequest({ clientId: saraId, formId: checkInFormId, status: 'submitted', assignedTo: alice.id, labelId: urgentLabelId, requestedAt: minutesAgo(10) })).id;
            // A row's own post_action wins (the app stamps the form's value when it creates the request); only an
            // empty one falls back to the form, as on the row the table displays.
            bobRow = (await makeRequest({ clientId: omarId, formId: nutritionFormId, status: 'reviewed', assignedTo: bob.id, requestedAt: minutesAgo(20), postAction: 'nutrition-plan' })).id;
            await makeRequest({ clientId: linaId, formId: checkInFormId, status: 'pending', requestedAt: minutesAgo(30) });
            await makeRequest({ clientId: linaId, formId: nutritionFormId, status: 'scheduled', requestedAt: minutesAgo(40), postAction: '' });
        });

        test('filters by package, and a client with no package never matches a package filter', async () => {
            expect(clientNames((await withFilters({ clientPackage: ['Gold'] })).body)).toEqual(['Sara Hassan']);
            expect((await withFilters({ clientPackage: ['Gold', 'Silver'] })).body.total).toBe(2);
        });

        test('filters by client name and by client code with a contains match', async () => {
            expect(clientNames((await withFilters({ clientName: 'hass' })).body)).toEqual(['Sara Hassan']);
            expect(clientNames((await withFilters({ clientCode: '102' })).body)).toEqual(['Omar Nabil']);
        });

        test('filters by form', async () => {
            expect((await withFilters({ formId: [nutritionFormId] })).body.total).toBe(2);
        });

        test('filters by what the row leads to (its own value, or the form\'s when the row has none)', async () => {
            const nutrition = await withFilters({ postAction: ['nutrition-plan'] });
            const none = await withFilters({ actions: ['nothing'] });

            expect(nutrition.body.total).toBe(2);
            expect(none.body.total).toBe(2);
        });

        test('filters by status as the page reports it (awaiting covers pending and sent)', async () => {
            const awaiting = await withFilters({ status: ['awaiting'] });
            const scheduledOrDone = await withFilters({ status: ['scheduled', 'action-done'] });

            expect(awaiting.body.items.map((item: Item) => item.status)).toEqual(['awaiting']);
            expect(scheduledOrDone.body.total).toBe(2);
        });

        test('filters by assignee, and null means unassigned', async () => {
            expect((await withFilters({ assignedTo: [alice.id] })).body.items.map((item: Item) => item.id)).toEqual([aliceRow]);
            expect((await withFilters({ assignedTo: [null] })).body.total).toBe(2);
            expect((await withFilters({ assignedTo: [bob.id, null] })).body.total).toBe(3);
        });

        test('filters by label, and null means unlabeled', async () => {
            expect((await withFilters({ label: [urgentLabelId] })).body.items.map((item: Item) => item.id)).toEqual([aliceRow]);
            expect((await withFilters({ label: [null] })).body.total).toBe(3);
        });

        test('filters by requested date, inclusive of the whole last day', async () => {
            const today = new Date().toISOString().slice(0, 10);
            const longAgo = '2000-01-01';

            expect((await withFilters({ requestedAt: { from: today, to: today } })).body.total).toBe(4);
            expect((await withFilters({ requestedAt: { from: longAgo, to: longAgo } })).body.total).toBe(0);
            expect((await withFilters({ requestedAt: { to: today } })).body.total).toBe(4);
        });

        test('combines filters, the search and the view with AND', async () => {
            const res = await withFilters({ assignedTo: [alice.id, bob.id], formId: [checkInFormId] }, { search: 'sara', view: 'need-action' });

            expect(clientNames(res.body)).toEqual(['Sara Hassan']);
            expect((await withFilters({ assignedTo: [bob.id] }, { view: 'need-action' })).body.total).toBe(0);
        });

        test('the total counts every matching row, not just the page', async () => {
            const res = await withFilters({ formId: [nutritionFormId] }, { pageSize: 10 });

            expect(res.body.items).toHaveLength(2);
            expect(res.body.total).toBe(2);
            expect(bobRow).toBeTruthy();
        });
    });

    describe('sorting', () => {
        beforeEach(async () => {
            await makeRequest({ clientId: saraId, formId: checkInFormId, status: 'submitted', assignedTo: alice.id, requestedAt: minutesAgo(1) });
            await makeRequest({ clientId: omarId, formId: nutritionFormId, status: 'submitted', assignedTo: bob.id, requestedAt: minutesAgo(2) });
            await makeRequest({ clientId: linaId, formId: checkInFormId, status: 'submitted', requestedAt: minutesAgo(3) });
        });

        test('sorts by client name ascending and descending', async () => {
            expect(clientNames((await getPage({ sort: 'clientName', dir: 'asc' })).body)).toEqual(['Lina Fathy', 'Omar Nabil', 'Sara Hassan']);
            expect(clientNames((await getPage({ sort: 'clientName', dir: 'desc' })).body)).toEqual(['Sara Hassan', 'Omar Nabil', 'Lina Fathy']);
        });

        test('sorts by client code', async () => {
            expect(clientNames((await getPage({ sort: 'clientCode', dir: 'desc' })).body)).toEqual(['Lina Fathy', 'Omar Nabil', 'Sara Hassan']);
        });

        test('sorts by the assignee\'s name, with unassigned rows last in both directions', async () => {
            expect(clientNames((await getPage({ sort: 'assignedTo', dir: 'asc' })).body)).toEqual(['Sara Hassan', 'Omar Nabil', 'Lina Fathy']);
            expect(clientNames((await getPage({ sort: 'assignedTo', dir: 'desc' })).body)).toEqual(['Omar Nabil', 'Sara Hassan', 'Lina Fathy']);
        });

        test('sorts by package with clients that have none last', async () => {
            expect(clientNames((await getPage({ sort: 'clientPackage', dir: 'asc' })).body)).toEqual(['Sara Hassan', 'Omar Nabil', 'Lina Fathy']);
        });

        test('sorts by form title ("Nutrition Intake" before "Weekly Check-in")', async () => {
            expect(clientNames((await getPage({ sort: 'formTitle', dir: 'asc' })).body)[0]).toBe('Omar Nabil');
            expect(clientNames((await getPage({ sort: 'formTitle', dir: 'desc' })).body).at(-1)).toBe('Omar Nabil');
        });

        test('an unknown sort key is ignored and the default order (newest first) applies', async () => {
            expect(clientNames((await getPage({ sort: 'password;DROP TABLE' })).body)).toEqual(['Sara Hassan', 'Omar Nabil', 'Lina Fathy']);
        });

        test('rows that tie on the sort key keep a stable order across pages', async () => {
            for (let index = 0; index < 12; index++) await makeRequest({ clientId: saraId, formId: checkInFormId, status: 'submitted', requestedAt: minutesAgo(100 + index) });

            const pages = await Promise.all([1, 2].map((page) => getPage({ sort: 'clientName', dir: 'asc', pageSize: 10, page })));
            const ids = pages.flatMap((res) => res.body.items.map((item: Item) => item.id));

            expect(new Set(ids).size).toBe(ids.length);
        });
    });

    describe('validation', () => {
        test.each([
            ['an unknown filter column', { password: ['x'] }],
            ['a list where text belongs', { clientName: ['x'] }],
            ['an impossible date', { requestedAt: { from: '2026-13-45' } }],
            ['an unknown status', { status: ['finished'] }],
        ])('returns 400 for %s', async (_name, filters) => {
            const res = await withFilters(filters);

            expect(res.status).toBe(400);
            expect(res.body).toHaveProperty('error');
        });

        test('returns 400 for filters that are not JSON', async () => {
            const res = await getPage({ filters: '{broken' });

            expect(res.status).toBe(400);
        });

        test('returns 401 without a login', async () => {
            const res = await request.get('/api/forms/queue?page=1');

            expect(res.status).toBe(401);
        });
    });

    describe('workspace isolation', () => {
        let strangerCookie: string;
        let strangerRow: string;

        beforeEach(async () => {
            const stranger = await createTestUser();
            const strangerWs = await createTestWorkspace(stranger.id);
            strangerCookie = await makeAuthCookie(stranger.id, strangerWs.id, 'owner');
            const strangerClient = await makeClient('Eve', 'Other', 'Gold', 900, strangerWs.id);
            const strangerForm = await testPrisma.forms.create({ data: { id: createId(), workspace_id: strangerWs.id, title_en: 'Theirs' } });
            strangerRow = (await makeRequest({ clientId: strangerClient.id, formId: strangerForm.id, status: 'submitted', workspace: strangerWs.id })).id;
            await makeRequest({ clientId: saraId, formId: checkInFormId, status: 'submitted' });
        });

        test('a page, its total, a search and a filter only ever see the caller\'s own rows', async () => {
            const mine = await getPage({ search: 'e' });
            const theirs = await getPage({}, strangerCookie);
            const crossFilter = await withFilters({ clientPackage: ['Gold'] }, {});

            expect(mine.body.items.map((item: Item) => item.id)).not.toContain(strangerRow);
            expect(mine.body.total).toBe(1);
            expect(theirs.body.items.map((item: Item) => item.id)).toEqual([strangerRow]);
            expect(crossFilter.body.total).toBe(1);
        });
    });

    describe('housekeeping on page turns', () => {
        test('a due scheduled request is activated when the first page loads, not on every later page', async () => {
            const due = await testPrisma.form_requests.create({
                data: { id: createId(), workspace_id: workspaceId, form_id: checkInFormId, client_id: saraId, status: 'scheduled', scheduled_at: minutesAgo(5), requested_at: null },
            });

            await getPage({ page: 2 });
            expect((await testPrisma.form_requests.findUnique({ where: { id: due.id } }))!.status).toBe('scheduled');

            await getPage({ page: 1 });
            expect((await testPrisma.form_requests.findUnique({ where: { id: due.id } }))!.status).toBe('pending');
        });
    });
});

describe('Plans Queue — /queue/summary', () => {
    let workspaceId: string;
    let ownerCookie: string;
    let alice: { id: string };
    let bob: { id: string };
    let formId: string;
    let clientId: string;

    const addRequest = (status: string, assignedTo: string | null, workspace = workspaceId, form = formId, client = clientId) =>
        testPrisma.form_requests.create({ data: { id: createId(), workspace_id: workspace, form_id: form, client_id: client, status, assigned_to: assignedTo } });
    const getSummary = (query = '', cookie = ownerCookie) => request.get(`/api/forms/queue/summary${query}`).set('Cookie', cookie);

    beforeEach(async () => {
        const owner = await createTestUser();
        const ws = await createTestWorkspace(owner.id);
        workspaceId = ws.id;
        ownerCookie = await makeAuthCookie(owner.id, workspaceId, 'owner');
        alice = await createTestUser({ fname: 'Alice' });
        bob = await createTestUser({ fname: 'Bob' });
        formId = (await testPrisma.forms.create({ data: { id: createId(), workspace_id: workspaceId, title_en: 'Check-in' } })).id;
        clientId = (await testPrisma.clients.create({
            data: { id: createId(), client_code: 500, fname: 'Sara', lname: 'Hassan', email: `s-${createId()}@test.com`, workspace_id: workspaceId, current_package: 'Gold' },
        })).id;
    });

    test('counts only need-action rows per assignee, plus the unassigned ones', async () => {
        await addRequest('submitted', alice.id);
        await addRequest('submitted', alice.id);
        await addRequest('submitted', bob.id);
        await addRequest('submitted', null);
        await addRequest('reviewed', bob.id);
        await addRequest('pending', alice.id);

        const res = await getSummary();

        expect(res.status).toBe(200);
        expect(res.body.needActionByAssignee).toEqual({ [alice.id]: 2, [bob.id]: 1 });
        expect(res.body.unassignedNeedAction).toBe(1);
    });

    test('archived rows are not counted', async () => {
        const row = await addRequest('submitted', alice.id);
        await testPrisma.form_requests.update({ where: { id: row.id }, data: { archived_at: new Date() } });

        const res = await getSummary();

        expect(res.body.needActionByAssignee).toEqual({});
    });

    test('lists the packages and forms that have rows in the requested view', async () => {
        const silverClient = await testPrisma.clients.create({
            data: { id: createId(), client_code: 501, fname: 'Omar', lname: 'Nabil', email: `o-${createId()}@test.com`, workspace_id: workspaceId, current_package: 'Silver' },
        });
        const otherForm = await testPrisma.forms.create({ data: { id: createId(), workspace_id: workspaceId, title_en: 'Other' } });
        await addRequest('submitted', null);
        await addRequest('reviewed', null, workspaceId, otherForm.id, silverClient.id);

        const needAction = await getSummary('?view=need-action');
        const everything = await getSummary();

        expect(needAction.body.packages).toEqual(['Gold']);
        expect(needAction.body.formIds).toEqual([formId]);
        expect(everything.body.packages).toEqual(['Gold', 'Silver']);
        expect([...everything.body.formIds].sort()).toEqual([formId, otherForm.id].sort());
    });

    test('never includes another workspace\'s assignees, packages or forms', async () => {
        const stranger = await createTestUser();
        const strangerWs = await createTestWorkspace(stranger.id);
        const strangerForm = await testPrisma.forms.create({ data: { id: createId(), workspace_id: strangerWs.id, title_en: 'Theirs' } });
        const strangerClient = await testPrisma.clients.create({
            data: { id: createId(), client_code: 777, fname: 'Eve', lname: 'Other', email: `e-${createId()}@test.com`, workspace_id: strangerWs.id, current_package: 'Platinum' },
        });
        await addRequest('submitted', stranger.id, strangerWs.id, strangerForm.id, strangerClient.id);

        const res = await getSummary();

        expect(res.body).toEqual({ needActionByAssignee: {}, unassignedNeedAction: 0, packages: [], formIds: [] });
    });

    test('returns 401 without a login', async () => {
        expect((await request.get('/api/forms/queue/summary')).status).toBe(401);
    });
});

describe('Plans Queue — /queue/ids (select all matching)', () => {
    let workspaceId: string;
    let ownerCookie: string;
    let formId: string;
    let clientId: string;

    const getIds = (params: Record<string, string> = {}, cookie = ownerCookie) =>
        request.get(`/api/forms/queue/ids?${new URLSearchParams(params).toString()}`).set('Cookie', cookie);

    beforeEach(async () => {
        const owner = await createTestUser();
        const ws = await createTestWorkspace(owner.id);
        workspaceId = ws.id;
        ownerCookie = await makeAuthCookie(owner.id, workspaceId, 'owner');
        formId = (await testPrisma.forms.create({ data: { id: createId(), workspace_id: workspaceId, title_en: 'Check-in', post_action: 'nutrition-plan' } })).id;
        clientId = (await testPrisma.clients.create({
            data: { id: createId(), client_code: 600, fname: 'Sara', lname: 'Hassan', email: `s-${createId()}@test.com`, workspace_id: workspaceId },
        })).id;
    });

    test('returns id, status and post action for every row matching the view and filters, across pages', async () => {
        for (let index = 0; index < 30; index++) {
            await testPrisma.form_requests.create({
                data: { id: createId(), workspace_id: workspaceId, form_id: formId, client_id: clientId, status: 'submitted', post_action: 'nutrition-plan' },
            });
        }
        await testPrisma.form_requests.create({ data: { id: createId(), workspace_id: workspaceId, form_id: formId, client_id: clientId, status: 'reviewed' } });

        const res = await getIds({ view: 'need-action' });

        expect(res.status).toBe(200);
        expect(res.body.capped).toBe(false);
        expect(res.body.items).toHaveLength(30);
        expect(res.body.items[0]).toEqual({ id: expect.any(String), status: 'need-action', postAction: 'nutrition-plan' });
    });

    test('applies the same search and filters as the list', async () => {
        await testPrisma.form_requests.create({ data: { id: createId(), workspace_id: workspaceId, form_id: formId, client_id: clientId, status: 'submitted' } });

        expect((await getIds({ search: 'sara' })).body.items).toHaveLength(1);
        expect((await getIds({ search: 'nobody' })).body.items).toHaveLength(0);
        expect((await getIds({ filters: JSON.stringify({ status: ['action-done'] }) })).body.items).toHaveLength(0);
    });

    test('stops at the cap and says so', async () => {
        await testPrisma.$executeRaw`
            INSERT INTO form_requests (id, workspace_id, form_id, client_id, status, requested_at)
            SELECT 'cap_' || g, ${workspaceId}, ${formId}, ${clientId}, 'submitted', now() - g * interval '1 second'
            FROM generate_series(1, 5001) g`;

        const res = await getIds();

        expect(res.body.capped).toBe(true);
        expect(res.body.items).toHaveLength(5000);
    });

    test('returns 400 for an invalid filters value and 401 without a login', async () => {
        expect((await getIds({ filters: '{nope' })).status).toBe(400);
        expect((await request.get('/api/forms/queue/ids')).status).toBe(401);
    });

    test('never returns another workspace\'s rows', async () => {
        const stranger = await createTestUser();
        const strangerWs = await createTestWorkspace(stranger.id);
        const strangerForm = await testPrisma.forms.create({ data: { id: createId(), workspace_id: strangerWs.id, title_en: 'Theirs' } });
        const strangerClient = await testPrisma.clients.create({
            data: { id: createId(), client_code: 888, fname: 'Eve', lname: 'Other', email: `e-${createId()}@test.com`, workspace_id: strangerWs.id },
        });
        await testPrisma.form_requests.create({ data: { id: createId(), workspace_id: strangerWs.id, form_id: strangerForm.id, client_id: strangerClient.id, status: 'submitted' } });

        expect((await getIds()).body.items).toEqual([]);
    });
});
