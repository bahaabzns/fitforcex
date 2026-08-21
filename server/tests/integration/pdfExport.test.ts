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

// nutrition_pdf_settings and training_pdf_settings are fully independent
// tables with the same field shape for shared concerns (see DECISIONS.md,
// 2026-07-28) — these tests run identically against both via describe.each,
// rather than duplicating every case by hand.
describe.each(['nutrition', 'training'] as const)('PDF export — %s settings API', (type) => {
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

    test('GET returns schema defaults before anything is saved', async () => {
        const res = await request.get(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie);
        expect(res.status).toBe(200);
        expect(res.body.coach_name).toBe('FitForce');
        expect(res.body.primary_color).toBe('#007AFF');
        expect(res.body.cover_title).toBe(type === 'training' ? 'Training Plan' : 'Nutrition Plan');
        expect(res.body.show_cover_header).toBe(true);
        expect(res.body.show_cover_title).toBe(true);
        expect(res.body.show_cover_subtitle).toBe(true);
        expect(res.body.show_cover_client_name).toBe(true);
    });

    test('PUT can independently toggle each cover text element', async () => {
        const put = await request.put(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie)
            .send({ show_cover_header: false, show_cover_title: false, show_cover_subtitle: false, show_cover_client_name: false });
        expect(put.status).toBe(200);
        expect(put.body.show_cover_header).toBe(false);
        expect(put.body.show_cover_title).toBe(false);
        expect(put.body.show_cover_subtitle).toBe(false);
        expect(put.body.show_cover_client_name).toBe(false);
    });

    test('PUT saves settings and GET reflects them', async () => {
        const put = await request.put(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie)
            .send({ coach_name: 'Acme Coaching', primary_color: '#FF0000' });
        expect(put.status).toBe(200);
        expect(put.body.coach_name).toBe('Acme Coaching');
        expect(put.body.primary_color).toBe('#FF0000');

        const get = await request.get(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie);
        expect(get.body.coach_name).toBe('Acme Coaching');
    });

    test('PUT rejects an invalid hex color with 400', async () => {
        const res = await request.put(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie)
            .send({ primary_color: 'not-a-color' });
        expect(res.status).toBe(400);
    });

    test('PUT accepts an empty display name and footer text (both optional)', async () => {
        const res = await request.put(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie)
            .send({ coach_name: '', footer_text: '' });
        expect(res.status).toBe(200);
        expect(res.body.coach_name).toBe('');
        expect(res.body.footer_text).toBe('');
    });

    test('tenant isolation: each workspace has its own settings', async () => {
        await request.put(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie).send({ coach_name: 'Workspace A' });

        const otherUser = await createTestUser();
        const otherWs   = await createTestWorkspace(otherUser.id);
        const otherCookie = await makeAuthCookie(otherUser.id, otherWs.id, 'owner');

        const otherGet = await request.get(`/api/pdf-export/settings/${type}`).set('Cookie', otherCookie);
        expect(otherGet.body.coach_name).toBe('FitForce'); // default, unaffected by workspace A's save
    });
});

test('nutrition and training settings are fully independent (no shared assets)', async () => {
    const user = await createTestUser();
    const ws   = await createTestWorkspace(user.id);
    const cookie = await makeAuthCookie(user.id, ws.id, 'owner');

    await request.put('/api/pdf-export/settings/nutrition').set('Cookie', cookie)
        .send({ coach_name: 'Nutrition Brand', primary_color: '#111111' });
    await request.put('/api/pdf-export/settings/training').set('Cookie', cookie)
        .send({ coach_name: 'Training Brand', primary_color: '#222222' });

    const nutrition = await request.get('/api/pdf-export/settings/nutrition').set('Cookie', cookie);
    const training  = await request.get('/api/pdf-export/settings/training').set('Cookie', cookie);

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
    // Puppeteer -> valid multi-page PDF) was verified manually via
    // src/scripts/smoke-test-pdf-export.ts against the dev DB.
});

describe.each(['nutrition', 'training'] as const)('PDF export — %s cover image upload', (type) => {
    let workspaceId: string;
    let ownerCookie: string;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws   = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        ownerCookie = await makeAuthCookie(user.id, workspaceId, 'owner');
    });

    // Default page size is 595.28 x 841.89pt -> round(pt/72*96) = 794 x 1123px.
    const EXPECTED_WIDTH = 794;
    const EXPECTED_HEIGHT = 1123;

    test('returns 401 when unauthenticated', async () => {
        const res = await request.post(`/api/pdf-export/settings/${type}/cover-image`)
            .attach('image', makeFakePng(EXPECTED_WIDTH, EXPECTED_HEIGHT), 'cover.png');
        expect(res.status).toBe(401);
    });

    test('returns 403 when a member lacks pdfExport permission', async () => {
        const member = await createTestUser();
        const cookie = await makeAuthCookie(member.id, workspaceId, 'member');
        const res = await request.post(`/api/pdf-export/settings/${type}/cover-image`).set('Cookie', cookie)
            .attach('image', makeFakePng(EXPECTED_WIDTH, EXPECTED_HEIGHT), 'cover.png');
        expect(res.status).toBe(403);
    });

    test('returns 400 when the image does not match the page size', async () => {
        const res = await request.post(`/api/pdf-export/settings/${type}/cover-image`).set('Cookie', ownerCookie)
            .attach('image', makeFakePng(100, 100), 'cover.png');
        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(`${EXPECTED_WIDTH}x${EXPECTED_HEIGHT}`);
        expect(res.body.error).toMatch('100x100');
    });

    test('accepts an image matching the page size and saves cover_image_url', async () => {
        const res = await request.post(`/api/pdf-export/settings/${type}/cover-image`).set('Cookie', ownerCookie)
            .attach('image', makeFakePng(EXPECTED_WIDTH, EXPECTED_HEIGHT), 'cover.png');
        expect(res.status).toBe(200);
        expect(res.body.cover_image_url).toBeTruthy();

        const get = await request.get(`/api/pdf-export/settings/${type}`).set('Cookie', ownerCookie);
        expect(get.body.cover_image_url).toBe(res.body.cover_image_url);
    });

    test('accepts an image within the small rounding tolerance', async () => {
        const res = await request.post(`/api/pdf-export/settings/${type}/cover-image`).set('Cookie', ownerCookie)
            .attach('image', makeFakePng(EXPECTED_WIDTH + 3, EXPECTED_HEIGHT - 2), 'cover.png');
        expect(res.status).toBe(200);
    });

    test('the generic background-slot route no longer accepts the cover slot', async () => {
        const res = await request.post(`/api/pdf-export/settings/${type}/background/cover`).set('Cookie', ownerCookie)
            .attach('image', makeFakePng(EXPECTED_WIDTH, EXPECTED_HEIGHT), 'cover.png');
        expect(res.status).toBe(400);
    });
});

describe.each(['nutrition', 'training'] as const)('PDF export — %s remove uploaded images', (type) => {
    let workspaceId: string;
    let ownerCookie: string;
    const EXPECTED_WIDTH = 794;
    const EXPECTED_HEIGHT = 1123;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws   = await createTestWorkspace(user.id);
        workspaceId = ws.id;
        ownerCookie = await makeAuthCookie(user.id, workspaceId, 'owner');
    });

    test('DELETE logo returns 401 when unauthenticated', async () => {
        const res = await request.delete(`/api/pdf-export/settings/${type}/logo`);
        expect(res.status).toBe(401);
    });

    test('DELETE logo returns 403 when a member lacks pdfExport permission', async () => {
        const member = await createTestUser();
        const cookie = await makeAuthCookie(member.id, workspaceId, 'member');
        const res = await request.delete(`/api/pdf-export/settings/${type}/logo`).set('Cookie', cookie);
        expect(res.status).toBe(403);
    });

    test('DELETE clears an uploaded logo', async () => {
        await request.post(`/api/pdf-export/settings/${type}/logo`).set('Cookie', ownerCookie)
            .attach('logo', makeFakePng(10, 10), 'logo.png');

        const del = await request.delete(`/api/pdf-export/settings/${type}/logo`).set('Cookie', ownerCookie);
        expect(del.status).toBe(200);
        expect(del.body.logo_url).toBeNull();
    });

    test('DELETE clears an uploaded cover image', async () => {
        await request.post(`/api/pdf-export/settings/${type}/cover-image`).set('Cookie', ownerCookie)
            .attach('image', makeFakePng(EXPECTED_WIDTH, EXPECTED_HEIGHT), 'cover.png');

        const del = await request.delete(`/api/pdf-export/settings/${type}/cover-image`).set('Cookie', ownerCookie);
        expect(del.status).toBe(200);
        expect(del.body.cover_image_url).toBeNull();
    });

    test('DELETE clears a background slot image', async () => {
        await request.post(`/api/pdf-export/settings/${type}/background/backCover`).set('Cookie', ownerCookie)
            .attach('image', makeFakePng(10, 10), 'bg.png');

        const del = await request.delete(`/api/pdf-export/settings/${type}/background/backCover`).set('Cookie', ownerCookie);
        expect(del.status).toBe(200);
        expect(del.body.back_cover_bg_image_url).toBeNull();
    });

    test('DELETE background rejects an unknown slot with 400', async () => {
        const res = await request.delete(`/api/pdf-export/settings/${type}/background/bogus`).set('Cookie', ownerCookie);
        expect(res.status).toBe(400);
    });

    test('removing a logo that was never set is a harmless no-op', async () => {
        const res = await request.delete(`/api/pdf-export/settings/${type}/logo`).set('Cookie', ownerCookie);
        expect(res.status).toBe(200);
        expect(res.body.logo_url).toBeNull();
    });
});
