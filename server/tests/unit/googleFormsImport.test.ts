import {
    assertIsGoogleFormUrl,
    normalizeToViewformUrl,
    fetchAndParseGoogleForm,
    parseGoogleFormHtml,
} from '../../src/modules/forms/googleFormsImport';

// Fixture shape mirrors the real (reverse-engineered) FB_PUBLIC_LOAD_DATA_
// array: rawData[1] is the "container", container[8] is the form title,
// container[0] is the description, container[1] is the questions array.
// Each question is [id, title, description, typeCode, [[entryId, choices,
// required]]]. See googleFormsImport.ts's header comment / the plan doc for
// where this structure comes from.
function buildQuestion(id: number, title: string, typeCode: number, opts: { choices?: string[]; required?: boolean } = {}) {
    const { choices, required = false } = opts;
    const entry = [id * 10, choices ? choices.map((c) => [c]) : null, required ? 1 : 0];
    return [id, title, null, typeCode, [entry]];
}

function buildFormHtml(overrides: { title?: string; description?: string; questions?: unknown[] } = {}) {
    const { title = 'Client Intake', description = 'Please fill this out', questions = [] } = overrides;
    const container = [description, questions, null, null, null, null, null, null, title];
    const rawData = [null, container];
    return `<html><head><title>${title}</title></head><body><script>var FB_PUBLIC_LOAD_DATA_ = ${JSON.stringify(rawData)};</script></body></html>`;
}

function mockFetchOnce(html: string, ok = true, status = ok ? 200 : 400) {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
        ok,
        status,
        text: async () => html,
    });
}

describe('assertIsGoogleFormUrl', () => {
    test('accepts a valid Google Forms viewform link', () => {
        expect(() => assertIsGoogleFormUrl('https://docs.google.com/forms/d/e/abc123/viewform')).not.toThrow();
    });

    test('rejects a non-Google URL', () => {
        expect(() => assertIsGoogleFormUrl('https://example.com/forms/abc')).toThrow(
            expect.objectContaining({ status: 400 })
        );
    });

    test('rejects a Google URL that is not a form', () => {
        expect(() => assertIsGoogleFormUrl('https://docs.google.com/spreadsheets/d/abc')).toThrow(
            expect.objectContaining({ status: 400 })
        );
    });

    test('rejects a malformed URL', () => {
        expect(() => assertIsGoogleFormUrl('not a url')).toThrow(expect.objectContaining({ status: 400 }));
    });
});

describe('normalizeToViewformUrl', () => {
    test('converts an /edit link to /viewform', () => {
        expect(normalizeToViewformUrl('https://docs.google.com/forms/d/abc123/edit')).toBe(
            'https://docs.google.com/forms/d/abc123/viewform'
        );
    });

    test('strips query params and hash', () => {
        expect(normalizeToViewformUrl('https://docs.google.com/forms/d/e/abc/viewform?usp=sharing#top')).toBe(
            'https://docs.google.com/forms/d/e/abc/viewform'
        );
    });

    test('appends /viewform when missing entirely', () => {
        expect(normalizeToViewformUrl('https://docs.google.com/forms/d/e/abc')).toBe(
            'https://docs.google.com/forms/d/e/abc/viewform'
        );
    });
});

describe('fetchAndParseGoogleForm', () => {
    beforeEach(() => {
        global.fetch = jest.fn();
    });

    test('maps every supported question type and carries required + options + scale bounds', async () => {
        const questions = [
            buildQuestion(1, 'Full name', 0, { required: true }),
            buildQuestion(2, 'Tell us about your goals', 1),
            buildQuestion(3, 'Preferred training time', 2, { choices: ['Morning', 'Afternoon', 'Evening'], required: true }),
            buildQuestion(4, 'Experience level', 3, { choices: ['Beginner', 'Intermediate', 'Advanced'] }),
            buildQuestion(5, 'Dietary restrictions', 4, { choices: ['Vegetarian', 'Vegan', 'None'] }),
            buildQuestion(6, 'Motivation level', 5, { choices: ['1', '2', '3', '4', '5'], required: true }),
            buildQuestion(7, 'Start date', 9, { required: true }),
            buildQuestion(8, 'Upload your ID', 13),
        ];
        mockFetchOnce(buildFormHtml({ questions }));

        const result = await fetchAndParseGoogleForm('https://docs.google.com/forms/d/e/abc123/viewform');

        expect(result.title_en).toBe('Client Intake');
        expect(result.description_en).toBe('Please fill this out');
        expect(result.skipped).toEqual([]);
        expect(result.questions).toEqual([
            { label_en: 'Full name', type: 'text', required: true, order_index: 0, options: null, min_value: null, max_value: null },
            { label_en: 'Tell us about your goals', type: 'long_text', required: false, order_index: 1, options: null, min_value: null, max_value: null },
            { label_en: 'Preferred training time', type: 'select', required: true, order_index: 2, options: ['Morning', 'Afternoon', 'Evening'], min_value: null, max_value: null },
            { label_en: 'Experience level', type: 'select', required: false, order_index: 3, options: ['Beginner', 'Intermediate', 'Advanced'], min_value: null, max_value: null },
            { label_en: 'Dietary restrictions', type: 'multiselect', required: false, order_index: 4, options: ['Vegetarian', 'Vegan', 'None'], min_value: null, max_value: null },
            { label_en: 'Motivation level', type: 'scale', required: true, order_index: 5, options: null, min_value: 1, max_value: 5 },
            { label_en: 'Start date', type: 'date', required: true, order_index: 6, options: null, min_value: null, max_value: null },
            { label_en: 'Upload your ID', type: 'attachment', required: false, order_index: 7, options: null, min_value: null, max_value: null },
        ]);
    });

    test('routes unsupported types (grid, time) to skipped with a reason instead of guessing', async () => {
        const questions = [
            buildQuestion(1, 'Full name', 0),
            buildQuestion(2, 'Weekly schedule', 7),
            buildQuestion(3, 'Preferred call time', 10),
        ];
        mockFetchOnce(buildFormHtml({ questions }));

        const result = await fetchAndParseGoogleForm('https://docs.google.com/forms/d/e/abc123/viewform');

        expect(result.questions).toHaveLength(1);
        expect(result.questions[0].label_en).toBe('Full name');
        expect(result.skipped).toEqual([
            { label_en: 'Weekly schedule', reason: expect.stringContaining('Grid') },
            { label_en: 'Preferred call time', reason: expect.stringContaining('Time') },
        ]);
    });

    test('drops section headers and page breaks silently, not as skipped', async () => {
        const questions = [
            buildQuestion(1, 'Section header', 6),
            buildQuestion(2, 'Full name', 0),
            buildQuestion(3, 'Page break', 8),
        ];
        mockFetchOnce(buildFormHtml({ questions }));

        const result = await fetchAndParseGoogleForm('https://docs.google.com/forms/d/e/abc123/viewform');

        expect(result.questions).toHaveLength(1);
        expect(result.skipped).toEqual([]);
    });

    test('rejects a non-Google URL before ever fetching', async () => {
        await expect(fetchAndParseGoogleForm('https://example.com/forms/abc')).rejects.toEqual(
            expect.objectContaining({ status: 400 })
        );
        expect(global.fetch).not.toHaveBeenCalled();
    });

    test('throws a friendly 400 when the page fetch fails (private/removed form)', async () => {
        mockFetchOnce('<html></html>', false, 404);
        await expect(
            fetchAndParseGoogleForm('https://docs.google.com/forms/d/e/abc123/viewform')
        ).rejects.toEqual(expect.objectContaining({ status: 400, message: expect.stringContaining('public') }));
    });

    // Confirmed against two real Google Forms: one with "Limit to 1
    // response"/"Collect email addresses" enabled, another with neither but
    // containing a File Upload question (which requires sign-in
    // unconditionally). Both return 401 with a sign-in gate page instead of
    // the form, even though the share setting is "anyone with the link."
    test('throws a specific 400 explaining the sign-in wall when Google returns 401', async () => {
        mockFetchOnce('<html class="show-login-page"></html>', false, 401);
        await expect(
            fetchAndParseGoogleForm('https://docs.google.com/forms/d/e/abc123/viewform')
        ).rejects.toEqual(expect.objectContaining({ status: 400, message: expect.stringContaining('sign in') }));
    });

    test('throws a friendly 400 when the network request itself fails', async () => {
        (global.fetch as jest.Mock).mockRejectedValueOnce(new Error('network down'));
        await expect(
            fetchAndParseGoogleForm('https://docs.google.com/forms/d/e/abc123/viewform')
        ).rejects.toEqual(expect.objectContaining({ status: 400 }));
    });

    test('throws a friendly 400 when FB_PUBLIC_LOAD_DATA_ is missing (sign-in wall)', async () => {
        mockFetchOnce('<html><body>Sign in to continue</body></html>');
        await expect(
            fetchAndParseGoogleForm('https://docs.google.com/forms/d/e/abc123/viewform')
        ).rejects.toEqual(expect.objectContaining({ status: 400 }));
    });
});

// Fallback path for forms Google sign-in-gates from our anonymous server
// fetch (any form with a File Upload question, or "Limit to 1
// response"/"Collect email addresses" enabled) — the coach pastes the page
// source from their own signed-in browser instead of a link, so there's no
// network call at all here; same mapping logic as the URL path from the
// point the HTML is in hand.
describe('parseGoogleFormHtml', () => {
    test('parses a pasted page source with no network call involved', () => {
        const html = buildFormHtml({
            questions: [
                buildQuestion(1, 'Upload your ID', 13, { required: true }),
                buildQuestion(2, 'Full name', 0),
            ],
        });

        const result = parseGoogleFormHtml(html);

        expect(result.title_en).toBe('Client Intake');
        expect(result.questions).toEqual([
            { label_en: 'Upload your ID', type: 'attachment', required: true, order_index: 0, options: null, min_value: null, max_value: null },
            { label_en: 'Full name', type: 'text', required: false, order_index: 1, options: null, min_value: null, max_value: null },
        ]);
    });

    test('throws a friendly 400 when the pasted text has no FB_PUBLIC_LOAD_DATA_ (wrong page copied)', () => {
        expect(() => parseGoogleFormHtml('<html><body>some other page</body></html>')).toThrow(
            expect.objectContaining({ status: 400 })
        );
    });
});
