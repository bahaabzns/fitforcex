import { QuestionType } from './questionTypes';

// Reads a public Google Form's question structure by parsing the
// `FB_PUBLIC_LOAD_DATA_` JSON blob Google embeds on the /viewform page. This
// is not an official API — there is no supported way to read a form's
// structure without either owning it (Forms API + OAuth) or being able to
// view its public fill-out page, and OAuth ownership doesn't fit our case
// (coaches import forms clients already used, which the coach doesn't own).
// See docs/google-forms-import-plan.md for the full rationale and the
// array-index mapping this was verified against.
const FB_PUBLIC_LOAD_DATA_PATTERN = /FB_PUBLIC_LOAD_DATA_\s*=\s*(\[[\s\S]*?\]);/;

// Non-question structural items (section headers, page breaks, and other
// items Google itself excludes when walking answerable questions) — dropped
// silently rather than reported in `skipped`, since a coach never expected
// these to become questions in the first place.
const DROPPED_TYPE_CODES = new Set([6, 8, 11]);

export interface ParsedQuestion {
    label_en: string;
    type: QuestionType;
    required: boolean;
    order_index: number;
    options: string[] | null;
    min_value: number | null;
    max_value: number | null;
}

export interface SkippedQuestion {
    label_en: string;
    reason: string;
}

export interface ParsedGoogleForm {
    title_en: string;
    description_en: string | null;
    questions: ParsedQuestion[];
    skipped: SkippedQuestion[];
}

function throwImportError(message: string): never {
    throw Object.assign(new Error(message), { status: 400 });
}

export function assertIsGoogleFormUrl(url: string): void {
    let parsed: URL;
    try {
        parsed = new URL(url);
    } catch {
        return throwImportError("That doesn't look like a valid URL");
    }
    if (parsed.hostname !== 'docs.google.com' || !parsed.pathname.includes('/forms/')) {
        throwImportError('Please paste a Google Forms link (docs.google.com/forms/...)');
    }
}

// Coaches may paste the edit link, a pre-filled link, or the response link —
// the public question structure is only reliably embedded on /viewform, so
// normalize whatever shape they paste to that before fetching.
export function normalizeToViewformUrl(url: string): string {
    const parsed = new URL(url);
    parsed.pathname = parsed.pathname.replace(/\/(edit|viewform|formResponse)\/?$/, '/viewform');
    if (!parsed.pathname.endsWith('/viewform')) {
        parsed.pathname = `${parsed.pathname.replace(/\/$/, '')}/viewform`;
    }
    parsed.search = '';
    parsed.hash = '';
    return parsed.toString();
}

export async function fetchAndParseGoogleForm(url: string): Promise<ParsedGoogleForm> {
    assertIsGoogleFormUrl(url);
    const viewformUrl = normalizeToViewformUrl(url);

    let response: Response;
    try {
        response = await fetch(viewformUrl, {
            signal:  AbortSignal.timeout(10000),
            headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FitForceFormImport/1.0)' },
        });
    } catch {
        return throwImportError("Couldn't reach that link — check it's correct and try again");
    }
    if (!response.ok) {
        // Google gates the page itself with a sign-in wall (401/403) whenever
        // the form owner has "Limit to 1 response" or "Collect email
        // addresses" turned on, OR the form contains a File Upload question
        // (Google requires sign-in for those unconditionally, to identify
        // who the uploaded file belongs to — confirmed against a real form
        // whose own Settings panel states this explicitly). None of these
        // are bypassable from an anonymous server-side fetch — "sign-in
        // required" means some Google account, not the form owner
        // specifically, so the coach's own signed-in browser CAN see the
        // page; that's what the paste-page-source fallback (parseGoogleFormHtml)
        // is for, and the message below points there instead of a dead end.
        if (response.status === 401 || response.status === 403) {
            throwImportError(
                "This form requires viewers to sign in to a Google account (usually caused by \"Limit to 1 response\", \"Collect email addresses\", or a File Upload question in the form) — use the \"paste page source\" option instead: open the link in your browser while signed into Google, view page source, and paste it in"
            );
        }
        throwImportError("Couldn't load this form — check that the link is public and try again");
    }

    const html = await response.text();
    return parseGoogleFormHtml(html);
}

// Fallback for forms Google sign-in-gates from an anonymous fetch (see the
// 401/403 branch above): the coach opens the link in their own browser while
// signed into Google — which the wall permits, since "requires sign-in"
// means any Google account, not specifically the form owner — views the
// page source, and pastes it here. Same parsing as the URL path from this
// point on, just skipping the fetch.
export function parseGoogleFormHtml(html: string): ParsedGoogleForm {
    const rawData = extractFbPublicLoadData(html);
    return mapToFitForceForm(rawData);
}

function extractFbPublicLoadData(html: string): unknown[] {
    const match = html.match(FB_PUBLIC_LOAD_DATA_PATTERN);
    if (!match) {
        return throwImportError(
            "Couldn't find this form's questions — if you pasted the page source, make sure you copied the complete page (View Page Source, then select all before copying)"
        );
    }
    try {
        return JSON.parse(match[1]) as unknown[];
    } catch {
        return throwImportError("Couldn't read this form's questions — the page format wasn't recognized");
    }
}

function mapQuestionType(code: number): QuestionType | null {
    switch (code) {
        case 0:  return 'text';        // short answer
        case 1:  return 'long_text';   // paragraph
        case 2:  return 'select';      // multiple choice
        case 3:  return 'select';      // dropdown
        case 4:  return 'multiselect'; // checkboxes
        case 5:  return 'scale';       // linear scale
        case 18: return 'scale';       // star rating — same choice-array shape as linear scale
        case 9:  return 'date';
        case 13: return 'attachment';  // file upload
        default: return null;          // grid (7), time (10), quiz/unknown items
    }
}

function skipReason(code: number): string {
    if (code === 7)  return "Grid/matrix questions aren't supported — add the rows as separate questions manually";
    if (code === 10) return "Time questions aren't supported";
    return "This question type isn't supported yet";
}

// Multiple choice, dropdown, checkboxes, linear scale, and star rating all
// share the same shape: entry[1] is an array of choices, each choice's
// answer value at choice[0].
function decodeChoiceOptions(entry: unknown): string[] {
    const choices = Array.isArray(entry) ? (entry[1] as unknown[] | undefined) : undefined;
    if (!Array.isArray(choices)) return [];
    return choices
        .map((choice) => String((Array.isArray(choice) ? choice[0] : '') ?? '').trim())
        .filter((value) => value.length > 0);
}

function scaleBounds(options: string[]): { min_value: number; max_value: number } {
    const numeric = options.map(Number).filter((n) => !Number.isNaN(n));
    if (numeric.length === 0) return { min_value: 1, max_value: options.length || 10 };
    return { min_value: Math.min(...numeric), max_value: Math.max(...numeric) };
}

function isRequired(entry: unknown): boolean {
    return Boolean(Array.isArray(entry) ? entry[2] : false);
}

function mapToFitForceForm(rawData: unknown[]): ParsedGoogleForm {
    const container = rawData?.[1] as unknown[] | undefined;
    const rawQuestions = (container?.[1] as unknown[] | undefined) ?? [];

    const rawTitle = container?.[8] ?? rawData?.[3];
    const title_en = (typeof rawTitle === 'string' && rawTitle.trim()) || 'Imported Form';

    const rawDescription = container?.[0];
    const description_en = typeof rawDescription === 'string' && rawDescription.trim() ? rawDescription.trim() : null;

    const questions: ParsedQuestion[] = [];
    const skipped: SkippedQuestion[] = [];
    let orderIndex = 0;

    for (const rawQuestion of rawQuestions) {
        const question = rawQuestion as unknown[];
        const typeCode = question?.[3] as number;
        if (DROPPED_TYPE_CODES.has(typeCode)) continue;

        const label = (typeof question?.[1] === 'string' && (question[1] as string).trim()) || 'Question';
        const fitForceType = mapQuestionType(typeCode);
        if (!fitForceType) {
            skipped.push({ label_en: label, reason: skipReason(typeCode) });
            continue;
        }

        const entry = (question?.[4] as unknown[] | undefined)?.[0];
        const isChoiceType = fitForceType === 'select' || fitForceType === 'multiselect';
        const isScaleType  = fitForceType === 'scale';
        const scale = isScaleType ? scaleBounds(decodeChoiceOptions(entry)) : null;

        questions.push({
            label_en:    label,
            type:        fitForceType,
            required:    isRequired(entry),
            order_index: orderIndex++,
            options:     isChoiceType ? decodeChoiceOptions(entry) : null,
            min_value:   scale?.min_value ?? null,
            max_value:   scale?.max_value ?? null,
        });
    }

    return { title_en, description_en, questions, skipped };
}
