import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';
import { testPrisma } from '../helpers/testDb';
import { createId } from '@paralleldrive/cuid2';

// image-size reads dimensions straight from the PNG signature + IHDR chunk
// (bytes 0-23) without decoding pixel data or validating the CRC — so a
// minimal 24-byte buffer with a fabricated width/height is enough to exercise
// upload*CoverImage's validation without a real image file or library.
function makeFakePng(width: number, height: number): Buffer {
    const buf = Buffer.alloc(24);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(buf, 0); // PNG signature
    buf.writeUInt32BE(13, 8);           // IHDR chunk length
    buf.write('IHDR', 12, 'ascii');
    buf.writeUInt32BE(width, 16);
    buf.writeUInt32BE(height, 20);
    return buf;
}

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

// Minimal nutrition_plan -> cycle -> meal -> item tree, just enough for
// fetchFullNutritionPlan + the template to render without hitting nulls.
async function createNutritionPlan(workspaceId: string, clientId: string) {
    const plan = await testPrisma.nutrition_plans.create({
        data: { id: createId(), name: 'Test Nutrition Plan', workspace_id: workspaceId, client_id: clientId },
    });
    const cycle = await testPrisma.nutrition_cycles.create({
        data: { id: createId(), plan_id: plan.id, name: 'Cycle 1', cycle_order: 1, goal_calories: 2000 },
    });
    const meal = await testPrisma.nutrition_meals.create({
        data: { id: createId(), cycle_id: cycle.id, name: 'Breakfast', meal_order: 1 },
    });
    const food = await testPrisma.food_items.create({
        data: {
            id: createId(), name_en: 'Oats', workspace_id: workspaceId,
            calories_per_serving: 150, protein_per_serving: 5, carbs_per_serving: 27, fats_per_serving: 3,
            serving_size: 100, serving_unit: 'g',
        },
    });
    await testPrisma.nutrition_meal_items.create({
        data: { id: createId(), meal_id: meal.id, food_item_id: food.id, amount: 100, meal_item_order: 1 },
    });
    return plan;
}

// A workspace with no saved profiles gets a synthesized default (id ''); the
// settings page materializes it on first change. These tests want a real row,
// so create one and hand back its id.
async function ensureDefaultProfileId(type: 'nutrition' | 'training', cookie: string): Promise<string> {
    const list = await request.get(`/api/pdf-export/settings/${type}`).set('Cookie', cookie);
    const existing = (list.body as Array<{ id: string }>).find((p) => p.id);
    if (existing) return existing.id;
    const created = await request.post(`/api/pdf-export/settings/${type}`).set('Cookie', cookie).send({ name: 'Default' });
    return created.body.id;
}

// nutrition_pdf_settings and training_pdf_settings are fully independent tables
// with the same field shape for shared concerns (see DECISIONS.md, 2026-07-28)
// — these run identically against both via describe.each.
describe.each(['nutrition', 'training'] as const)('PDF export — %s branding profiles API', (type) => {
    let workspaceId: string;
    let ownerCookie: string;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws   = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        ownerCookie = await makeAuthCookie(user.id, workspaceId, 'owner');
    });

    test('returns 401 when unauthenticated', async () => {
        const res = await request.get(`/api/pdf-export/settings/${type}`);
        expect(res.status).toBe(401);
    });

    test('returns 403 when a member lacks pdfExport permission', async () => {
        const member = await createTestUser();
        const cookie = await makeAuthCookie(member.id, workspaceId, 'member');
        const res = await request.get(`/api/pdf-export/settings/${type}`).set('Cookie', cookie);
        expect(res.status).toBe(403);
    });

    test('GET returns a one-element list holding the synthesized default before anything is saved', async () => {
        const res = await request.get(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie);
        expect(res.status).toBe(200);
        expect(Array.isArray(res.body)).toBe(true);
        expect(res.body).toHaveLength(1);
        expect(res.body[0].id).toBe('');
        expect(res.body[0].name).toBe('Default');
        expect(res.body[0].is_default).toBe(true);
        expect(res.body[0].coach_name).toBe('FitForce');
        expect(res.body[0].cover_title).toBe(type === 'training' ? 'Training Plan' : 'Nutrition Plan');
    });

    test('POST creates a profile; the first one saved becomes the default', async () => {
        const res = await request.post(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie).send({ name: 'Premium' });
        expect(res.status).toBe(201);
        expect(res.body.name).toBe('Premium');
        expect(res.body.is_default).toBe(true);
        expect(res.body.id).toBeTruthy();

        const list = await request.get(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie);
        expect(list.body).toHaveLength(1);
        expect(list.body[0].id).toBe(res.body.id);
    });

    test('POST a second profile is not the default', async () => {
        await request.post(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie).send({ name: 'First' });
        const second = await request.post(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie).send({ name: 'Second' });
        expect(second.status).toBe(201);
        expect(second.body.is_default).toBe(false);
    });

    test('POST rejects a duplicate name with 400', async () => {
        await request.post(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie).send({ name: 'Dup' });
        const again = await request.post(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie).send({ name: 'Dup' });
        expect(again.status).toBe(400);
    });

    test('POST rejects an empty name with 400', async () => {
        const res = await request.post(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie).send({ name: '   ' });
        expect(res.status).toBe(400);
    });

    test('PUT can independently toggle each cover text element on one profile', async () => {
        const id = await ensureDefaultProfileId(type, ownerCookie);
        const put = await request.put(`/api/pdf-export/settings/${type}/${id}`).set('Cookie', ownerCookie)
            .send({ show_cover_header: false, show_cover_title: false, show_cover_subtitle: false, show_cover_client_name: false });
        expect(put.status).toBe(200);
        expect(put.body.show_cover_header).toBe(false);
        expect(put.body.show_cover_title).toBe(false);
        expect(put.body.show_cover_subtitle).toBe(false);
        expect(put.body.show_cover_client_name).toBe(false);
    });

    test('PUT saves fields and GET reflects them', async () => {
        const id = await ensureDefaultProfileId(type, ownerCookie);
        const put = await request.put(`/api/pdf-export/settings/${type}/${id}`).set('Cookie', ownerCookie)
            .send({ coach_name: 'Acme Coaching', primary_color: '#FF0000' });
        expect(put.status).toBe(200);
        expect(put.body.coach_name).toBe('Acme Coaching');

        const get = await request.get(`/api/pdf-export/settings/${type}/${id}`).set('Cookie', ownerCookie);
        expect(get.body.coach_name).toBe('Acme Coaching');
        expect(get.body.primary_color).toBe('#FF0000');
    });

    test('PUT rejects an invalid hex color with 400', async () => {
        const id = await ensureDefaultProfileId(type, ownerCookie);
        const res = await request.put(`/api/pdf-export/settings/${type}/${id}`).set('Cookie', ownerCookie)
            .send({ primary_color: 'not-a-color' });
        expect(res.status).toBe(400);
    });

    test('PUT accepts an empty display name and footer text (both optional)', async () => {
        const id = await ensureDefaultProfileId(type, ownerCookie);
        const res = await request.put(`/api/pdf-export/settings/${type}/${id}`).set('Cookie', ownerCookie)
            .send({ coach_name: '', footer_text: '' });
        expect(res.status).toBe(200);
        expect(res.body.coach_name).toBe('');
        expect(res.body.footer_text).toBe('');
    });

    test('PUT to an id from another workspace is a 404, not a cross-tenant write', async () => {
        const id = await ensureDefaultProfileId(type, ownerCookie);

        const otherUser = await createTestUser();
        const otherWs   = await createTestWorkspace(otherUser.id);
        const otherCookie = await makeAuthCookie(otherUser.id, otherWs.id, 'owner');

        const res = await request.put(`/api/pdf-export/settings/${type}/${id}`).set('Cookie', otherCookie)
            .send({ coach_name: 'Hijacked' });
        expect(res.status).toBe(404);

        const still = await request.get(`/api/pdf-export/settings/${type}/${id}`).set('Cookie', ownerCookie);
        expect(still.body.coach_name).not.toBe('Hijacked');
    });

    test('setting is_default moves the flag to exactly one profile', async () => {
        const a = await request.post(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie).send({ name: 'A' });
        const b = await request.post(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie).send({ name: 'B' });
        expect(a.body.is_default).toBe(true);

        const promote = await request.put(`/api/pdf-export/settings/${type}/${b.body.id}`).set('Cookie', ownerCookie)
            .send({ is_default: true });
        expect(promote.status).toBe(200);
        expect(promote.body.is_default).toBe(true);

        const list = await request.get(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie);
        expect(list.body.filter((p: { is_default: boolean }) => p.is_default)).toHaveLength(1);
        expect(list.body.find((p: { id: string }) => p.id === a.body.id).is_default).toBe(false);
    });

    test('DELETE removes a non-default profile', async () => {
        await request.post(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie).send({ name: 'Keep' });
        const drop = await request.post(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie).send({ name: 'Drop' });

        const del = await request.delete(`/api/pdf-export/settings/${type}/${drop.body.id}`).set('Cookie', ownerCookie);
        expect(del.status).toBe(200);
        expect(del.body).toHaveLength(1);
        expect(del.body[0].name).toBe('Keep');
    });

    test('DELETE of the only profile is rejected with 400', async () => {
        const only = await request.post(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie).send({ name: 'Solo' });
        const del = await request.delete(`/api/pdf-export/settings/${type}/${only.body.id}`).set('Cookie', ownerCookie);
        expect(del.status).toBe(400);
    });

    test('DELETE of the default profile promotes another to default', async () => {
        const a = await request.post(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie).send({ name: 'A' });
        await request.post(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie).send({ name: 'B' });
        expect(a.body.is_default).toBe(true);

        const del = await request.delete(`/api/pdf-export/settings/${type}/${a.body.id}`).set('Cookie', ownerCookie);
        expect(del.status).toBe(200);
        expect(del.body).toHaveLength(1);
        expect(del.body[0].is_default).toBe(true);
    });

    test('tenant isolation: each workspace has its own profiles', async () => {
        const id = await ensureDefaultProfileId(type, ownerCookie);
        await request.put(`/api/pdf-export/settings/${type}/${id}`).set('Cookie', ownerCookie).send({ coach_name: 'Workspace A' });

        const otherUser = await createTestUser();
        const otherWs   = await createTestWorkspace(otherUser.id);
        const otherCookie = await makeAuthCookie(otherUser.id, otherWs.id, 'owner');

        const otherGet = await request.get(`/api/pdf-export/settings/${type}`).set('Cookie', otherCookie);
        expect(otherGet.body).toHaveLength(1);
        expect(otherGet.body[0].coach_name).toBe('FitForce'); // default, unaffected by workspace A
    });

    test('POST /duplicate copies every branding field into a non-default "<name> copy"', async () => {
        const src = await request.post(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie).send({ name: 'Premium' });
        await request.put(`/api/pdf-export/settings/${type}/${src.body.id}`).set('Cookie', ownerCookie)
            .send({ coach_name: 'Acme', primary_color: '#ABCDEF', show_cover_page: false });

        const dup = await request.post(`/api/pdf-export/settings/${type}/${src.body.id}/duplicate`).set('Cookie', ownerCookie);
        expect(dup.status).toBe(201);
        expect(dup.body.id).not.toBe(src.body.id);
        expect(dup.body.name).toBe('Premium copy');
        expect(dup.body.is_default).toBe(false);
        expect(dup.body.coach_name).toBe('Acme');
        expect(dup.body.primary_color).toBe('#ABCDEF');
        expect(dup.body.show_cover_page).toBe(false);
    });

    test('POST /duplicate carries over image urls', async () => {
        const src = await ensureDefaultProfileId(type, ownerCookie);
        const upload = await request.post(`/api/pdf-export/settings/${type}/${src}/logo`).set('Cookie', ownerCookie)
            .attach('logo', makeFakePng(10, 10), 'logo.png');
        expect(upload.body.logo_url).toBeTruthy();

        const dup = await request.post(`/api/pdf-export/settings/${type}/${src}/duplicate`).set('Cookie', ownerCookie);
        expect(dup.body.logo_url).toBe(upload.body.logo_url);
    });

    test('POST /duplicate disambiguates the name when "<name> copy" is taken', async () => {
        const src = await request.post(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie).send({ name: 'Base' });
        const first  = await request.post(`/api/pdf-export/settings/${type}/${src.body.id}/duplicate`).set('Cookie', ownerCookie);
        const second = await request.post(`/api/pdf-export/settings/${type}/${src.body.id}/duplicate`).set('Cookie', ownerCookie);
        expect(first.body.name).toBe('Base copy');
        expect(second.body.name).toBe('Base copy 2');
    });

    test('POST /duplicate is a 404 for a profile id from another workspace', async () => {
        const src = await ensureDefaultProfileId(type, ownerCookie);

        const otherUser = await createTestUser();
        const otherWs   = await createTestWorkspace(otherUser.id);
        const otherCookie = await makeAuthCookie(otherUser.id, otherWs.id, 'owner');

        const res = await request.post(`/api/pdf-export/settings/${type}/${src}/duplicate`).set('Cookie', otherCookie);
        expect(res.status).toBe(404);
    });
});

test('nutrition and training profiles are fully independent (no shared assets)', async () => {
    const user = await createTestUser();
    const ws   = await createTestWorkspace(user.id);
    const cookie = await makeAuthCookie(user.id, ws.id, 'owner');

    const nutritionId = await ensureDefaultProfileId('nutrition', cookie);
    const trainingId  = await ensureDefaultProfileId('training', cookie);

    await request.put(`/api/pdf-export/settings/nutrition/${nutritionId}`).set('Cookie', cookie)
        .send({ coach_name: 'Nutrition Brand', primary_color: '#111111' });
    await request.put(`/api/pdf-export/settings/training/${trainingId}`).set('Cookie', cookie)
        .send({ coach_name: 'Training Brand', primary_color: '#222222' });

    const nutrition = await request.get(`/api/pdf-export/settings/nutrition/${nutritionId}`).set('Cookie', cookie);
    const training  = await request.get(`/api/pdf-export/settings/training/${trainingId}`).set('Cookie', cookie);

    expect(nutrition.body.coach_name).toBe('Nutrition Brand');
    expect(nutrition.body.primary_color).toBe('#111111');
    expect(training.body.coach_name).toBe('Training Brand');
    expect(training.body.primary_color).toBe('#222222');
});

describe('PDF export — settings preview', () => {
    let workspaceId: string;
    let ownerCookie: string;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws   = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        ownerCookie = await makeAuthCookie(user.id, workspaceId, 'owner');
    });

    test('returns 401 when unauthenticated', async () => {
        const res = await request.post('/api/pdf-export/settings/preview').send({});
        expect(res.status).toBe(401);
    });

    test('returns 403 when a member lacks pdfExport permission', async () => {
        const member = await createTestUser();
        const cookie = await makeAuthCookie(member.id, workspaceId, 'member');
        const res = await request.post('/api/pdf-export/settings/preview').set('Cookie', cookie).send({});
        expect(res.status).toBe(403);
    });

    // No render-through test here — see the "PDF export — render endpoints"
    // note below: puppeteer's pure-ESM package can't be exercised inside this
    // repo's Jest/ts-jest setup. Preview rendering is covered manually via
    // server/src/scripts/smoke-test-pdf-preview.ts.
});

describe('PDF export — render endpoints', () => {
    let workspaceId: string;
    let ownerCookie: string;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws   = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        ownerCookie = await makeAuthCookie(user.id, workspaceId, 'owner');
    });

    test('returns 401 when unauthenticated', async () => {
        const res = await request.get('/api/pdf-export/nutrition/some-id');
        expect(res.status).toBe(401);
    });

    test('returns 404 for a plan that does not exist', async () => {
        const res = await request.get('/api/pdf-export/nutrition/does-not-exist').set('Cookie', ownerCookie);
        expect(res.status).toBe(404);
    });

    test('returns 404 for a missing plan even when a profileId is named', async () => {
        const res = await request.get('/api/pdf-export/nutrition/does-not-exist?profileId=whatever').set('Cookie', ownerCookie);
        expect(res.status).toBe(404);
    });

    test('tenant isolation: cannot export another workspace\'s plan', async () => {
        const otherUser = await createTestUser();
        const otherWs   = await createTestWorkspace(otherUser.id);
        const otherClient = await createClient(otherWs.id);
        const otherPlan = await createNutritionPlan(otherWs.id, otherClient.id);

        const res = await request.get(`/api/pdf-export/nutrition/${otherPlan.id}`).set('Cookie', ownerCookie);
        expect(res.status).toBe(404);
    });

    // No "renders a real PDF" test here: puppeteer ships pure ESM ("type":
    // "module", no CJS build). Jest's module runtime routes *every* module
    // load — including a lazy `await import(...)` — through the same ts-jest
    // CJS transform, which can't parse puppeteer's `export * from ...`
    // syntax. That's a real incompatibility between this repo's Jest/ts-jest
    // setup and puppeteer's package format, not a bug in pdfRenderer.ts —
    // confirmed by isolating a standalone `renderHtmlToPdf()` call in a
    // throwaway Jest test, which hit the identical parse error even with no
    // HTTP layer involved. The 404/tenant-isolation tests above already cover
    // everything before the render call; actual end-to-end rendering (real
    // nutrition + training plan data through fetchFullPlan -> template ->
    // Puppeteer -> valid multi-page PDF, per profile) was verified manually via
    // src/scripts/smoke-test-pdf-export.ts against the dev DB.
});

describe.each(['nutrition', 'training'] as const)('PDF export — %s cover image upload', (type) => {
    let workspaceId: string;
    let ownerCookie: string;
    let profileId: string;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws   = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        ownerCookie = await makeAuthCookie(user.id, workspaceId, 'owner');
        profileId = await ensureDefaultProfileId(type, ownerCookie);
    });

    // Default page size is 595.28 x 841.89pt -> round(pt/72*96) = 794 x 1123px.
    const EXPECTED_WIDTH = 794;
    const EXPECTED_HEIGHT = 1123;

    test('returns 401 when unauthenticated', async () => {
        const res = await request.post(`/api/pdf-export/settings/${type}/${profileId}/cover-image`)
            .attach('image', makeFakePng(EXPECTED_WIDTH, EXPECTED_HEIGHT), 'cover.png');
        expect(res.status).toBe(401);
    });

    test('returns 403 when a member lacks pdfExport permission', async () => {
        const member = await createTestUser();
        const cookie = await makeAuthCookie(member.id, workspaceId, 'member');
        const res = await request.post(`/api/pdf-export/settings/${type}/${profileId}/cover-image`).set('Cookie', cookie)
            .attach('image', makeFakePng(EXPECTED_WIDTH, EXPECTED_HEIGHT), 'cover.png');
        expect(res.status).toBe(403);
    });

    test('returns 404 for a profile id that is not in this workspace', async () => {
        const res = await request.post(`/api/pdf-export/settings/${type}/${createId()}/cover-image`).set('Cookie', ownerCookie)
            .attach('image', makeFakePng(EXPECTED_WIDTH, EXPECTED_HEIGHT), 'cover.png');
        expect(res.status).toBe(404);
    });

    test('returns 400 when the image does not match the page size', async () => {
        const res = await request.post(`/api/pdf-export/settings/${type}/${profileId}/cover-image`).set('Cookie', ownerCookie)
            .attach('image', makeFakePng(100, 100), 'cover.png');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(`${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}`);
        expect(res.body.error).toMatch('100x100');
    });

    test('accepts an image matching the page size and saves cover_image_url', async () => {
        const res = await request.post(`/api/pdf-export/settings/${type}/${profileId}/cover-image`).set('Cookie', ownerCookie)
            .attach('image', makeFakePng(EXPECTED_WIDTH, EXPECTED_HEIGHT), 'cover.png');
        expect(res.status).toBe(200);
        expect(res.body.cover_image_url).toBeTruthy();

        const get = await request.get(`/api/pdf-export/settings/${type}/${profileId}`).set('Cookie', ownerCookie);
        expect(get.body.cover_image_url).toBe(res.body.cover_image_url);
    });

    test('accepts an image within the small rounding tolerance', async () => {
        const res = await request.post(`/api/pdf-export/settings/${type}/${profileId}/cover-image`).set('Cookie', ownerCookie)
            .attach('image', makeFakePng(EXPECTED_WIDTH + 3, EXPECTED_HEIGHT - 2), 'cover.png');
        expect(res.status).toBe(200);
    });

    test('the generic background-slot route no longer accepts the cover slot', async () => {
        const res = await request.post(`/api/pdf-export/settings/${type}/${profileId}/background/cover`).set('Cookie', ownerCookie)
            .attach('image', makeFakePng(EXPECTED_WIDTH, EXPECTED_HEIGHT), 'cover.png');
        expect(res.status).toBe(400);
    });
});

describe.each(['nutrition', 'training'] as const)('PDF export — %s remove uploaded images', (type) => {
    let workspaceId: string;
    let ownerCookie: string;
    let profileId: string;
    const EXPECTED_WIDTH = 794;
    const EXPECTED_HEIGHT = 1123;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws   = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        ownerCookie = await makeAuthCookie(user.id, workspaceId, 'owner');
        profileId = await ensureDefaultProfileId(type, ownerCookie);
    });

    test('DELETE logo returns 401 when unauthenticated', async () => {
        const res = await request.delete(`/api/pdf-export/settings/${type}/${profileId}/logo`);
        expect(res.status).toBe(401);
    });

    test('DELETE logo returns 403 when a member lacks pdfExport permission', async () => {
        const member = await createTestUser();
        const cookie = await makeAuthCookie(member.id, workspaceId, 'member');
        const res = await request.delete(`/api/pdf-export/settings/${type}/${profileId}/logo`).set('Cookie', cookie);
        expect(res.status).toBe(403);
    });

    test('DELETE clears an uploaded logo', async () => {
        await request.post(`/api/pdf-export/settings/${type}/${profileId}/logo`).set('Cookie', ownerCookie)
            .attach('logo', makeFakePng(10, 10), 'logo.png');

        const del = await request.delete(`/api/pdf-export/settings/${type}/${profileId}/logo`).set('Cookie', ownerCookie);
        expect(del.status).toBe(200);
        expect(del.body.logo_url).toBeNull();
    });

    test('DELETE clears an uploaded cover image', async () => {
        await request.post(`/api/pdf-export/settings/${type}/${profileId}/cover-image`).set('Cookie', ownerCookie)
            .attach('image', makeFakePng(EXPECTED_WIDTH, EXPECTED_HEIGHT), 'cover.png');

        const del = await request.delete(`/api/pdf-export/settings/${type}/${profileId}/cover-image`).set('Cookie', ownerCookie);
        expect(del.status).toBe(200);
        expect(del.body.cover_image_url).toBeNull();
    });

    test('DELETE clears a background slot image', async () => {
        await request.post(`/api/pdf-export/settings/${type}/${profileId}/background/backCover`).set('Cookie', ownerCookie)
            .attach('image', makeFakePng(10, 10), 'bg.png');

        const del = await request.delete(`/api/pdf-export/settings/${type}/${profileId}/background/backCover`).set('Cookie', ownerCookie);
        expect(del.status).toBe(200);
        expect(del.body.back_cover_bg_image_url).toBeNull();
    });

    test('DELETE background rejects an unknown slot with 400', async () => {
        const res = await request.delete(`/api/pdf-export/settings/${type}/${profileId}/background/bogus`).set('Cookie', ownerCookie);
        expect(res.status).toBe(400);
    });

    test('removing a logo that was never set is a harmless no-op', async () => {
        const res = await request.delete(`/api/pdf-export/settings/${type}/${profileId}/logo`).set('Cookie', ownerCookie);
        expect(res.status).toBe(200);
        expect(res.body.logo_url).toBeNull();
    });
});
