import { request, createTestUser, createTestWorkspace, makeAuthCookie } from '../helpers/testServer';

// The parser itself (network fetch + FB_PUBLIC_LOAD_DATA_ parsing) is fully
// covered by tests/unit/googleFormsImport.test.ts against fixture HTML — no
// real network calls belong in an integration suite. This file only proves
// the route is wired correctly: auth, validation, and that the parser's
// result/errors pass through untouched.
jest.mock('../../src/modules/forms/googleFormsImport', () => ({
    fetchAndParseGoogleForm: jest.fn(),
    parseGoogleFormHtml: jest.fn(),
}));
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { fetchAndParseGoogleForm, parseGoogleFormHtml } = require('../../src/modules/forms/googleFormsImport');

describe('POST /api/forms/import/google-forms-preview', () => {
    let ownerCookie: string;

    beforeEach(async () => {
        const user = await createTestUser();
        const ws = await createTestWorkspace(user.id);
        ownerCookie = await makeAuthCookie(user.id, ws.id, 'owner');
        (fetchAndParseGoogleForm as jest.Mock).mockReset();
        (parseGoogleFormHtml as jest.Mock).mockReset();
    });

    test('returns the parser\'s result on a valid link', async () => {
        const parsed = {
            title_en: 'Client Intake',
            description_en: null,
            questions: [
                { label_en: 'Full name', type: 'text', required: true, order_index: 0, options: null, min_value: null, max_value: null },
            ],
            skipped: [],
        };
        (fetchAndParseGoogleForm as jest.Mock).mockResolvedValueOnce(parsed);

        const res = await request.post('/api/forms/import/google-forms-preview').set('Cookie', ownerCookie)
            .send({ url: 'https://docs.google.com/forms/d/e/abc/viewform' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual(parsed);
        expect(fetchAndParseGoogleForm).toHaveBeenCalledWith('https://docs.google.com/forms/d/e/abc/viewform');
    });

    test('blank url returns 400 without calling the parser', async () => {
        const res = await request.post('/api/forms/import/google-forms-preview').set('Cookie', ownerCookie)
            .send({ url: '   ' });
        expect(res.status).toBe(400);
        expect(fetchAndParseGoogleForm).not.toHaveBeenCalled();
    });

    test('propagates a parser failure with its own status and message', async () => {
        (fetchAndParseGoogleForm as jest.Mock).mockRejectedValueOnce(
            Object.assign(new Error("Couldn't load this form — check that the link is public and try again"), { status: 400 })
        );

        const res = await request.post('/api/forms/import/google-forms-preview').set('Cookie', ownerCookie)
            .send({ url: 'https://docs.google.com/forms/d/e/private/viewform' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/public/);
    });

    test('no auth cookie is rejected with 401', async () => {
        const res = await request.post('/api/forms/import/google-forms-preview')
            .send({ url: 'https://docs.google.com/forms/d/e/abc/viewform' });
        expect(res.status).toBe(401);
        expect(fetchAndParseGoogleForm).not.toHaveBeenCalled();
    });

    // Paste-page-source fallback (for forms Google sign-in-gates from an
    // anonymous fetch, e.g. any form with a File Upload question) — html
    // takes priority over url when both happen to be present, and never
    // touches fetchAndParseGoogleForm since there's nothing to fetch.
    test('returns the parser\'s result when html is provided instead of a url', async () => {
        const parsed = {
            title_en: 'Assessment',
            description_en: null,
            questions: [
                { label_en: 'Upload your ID', type: 'attachment', required: true, order_index: 0, options: null, min_value: null, max_value: null },
            ],
            skipped: [],
        };
        (parseGoogleFormHtml as jest.Mock).mockReturnValueOnce(parsed);

        const res = await request.post('/api/forms/import/google-forms-preview').set('Cookie', ownerCookie)
            .send({ html: '<html>pasted page source</html>' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual(parsed);
        expect(parseGoogleFormHtml).toHaveBeenCalledWith('<html>pasted page source</html>');
        expect(fetchAndParseGoogleForm).not.toHaveBeenCalled();
    });

    test('propagates a parseGoogleFormHtml failure with its own status and message', async () => {
        (parseGoogleFormHtml as jest.Mock).mockImplementationOnce(() => {
            throw Object.assign(new Error("Couldn't find this form's questions — make sure you copied the complete page"), { status: 400 });
        });

        const res = await request.post('/api/forms/import/google-forms-preview').set('Cookie', ownerCookie)
            .send({ html: '<html>incomplete</html>' });

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/complete page/);
    });

    test('missing both url and html returns 400 without calling either parser', async () => {
        const res = await request.post('/api/forms/import/google-forms-preview').set('Cookie', ownerCookie)
            .send({});
        expect(res.status).toBe(400);
        expect(fetchAndParseGoogleForm).not.toHaveBeenCalled();
        expect(parseGoogleFormHtml).not.toHaveBeenCalled();
    });

    // A real pasted Google Forms page source routinely exceeds the app-wide
    // 100kb JSON body limit (app.ts's default express.json()) — this route
    // gets a scoped 5mb override registered ahead of that global parser.
    // Regression test for exactly that: a >100kb body must NOT 413.
    test('accepts a pasted html body well over the global 100kb JSON limit', async () => {
        const oversizedHtml = `<html>${'x'.repeat(300_000)}</html>`;
        const parsed = { title_en: 'Big Form', description_en: null, questions: [], skipped: [] };
        (parseGoogleFormHtml as jest.Mock).mockReturnValueOnce(parsed);

        const res = await request.post('/api/forms/import/google-forms-preview').set('Cookie', ownerCookie)
            .send({ html: oversizedHtml });

        expect(res.status).toBe(200);
        expect(parseGoogleFormHtml).toHaveBeenCalledWith(oversizedHtml);
    });
});
