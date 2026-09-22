# Google Forms Import — Implementation Plan

**Location:** `/[workspaceSlug]/forms` (e.g. `https://my.fitforce.app/belghamdi/forms`)
**Status:** Planned, not started
**Owner decisions locked in below** — see "Decisions" for the reasoning; don't re-litigate these mid-implementation without checking back in.

---

## 1. Problem & Goal

Most coaches' clients were already filling out Google Forms before joining FitForce. Recreating those forms by hand in the FitForce builder is pure friction and a real adoption blocker at onboarding. Goal: a coach pastes a Google Form link and lands in the **existing** FitForce form builder with the questions already populated, ready to review and save — reusing every UI and API surface that already exists rather than building a parallel "import wizard."

### Non-goals (explicitly out of scope)
- Importing previously-submitted **responses/answers** from the old Google Form. Only the question *structure* is imported; clients re-fill the form fresh in FitForce.
- Any Google account connection / OAuth. Nothing is written to or authenticated against Google — this is a one-way, anonymous read of a public page.
- Perfect fidelity for every Google Forms feature (grids, images, branching logic, quizzes). Unsupported constructs are surfaced to the coach as "couldn't import — add manually," not guessed at.

---

## 2. Decisions (already made with the user — don't relitigate)

| Question | Decision | Why |
|---|---|---|
| How do we read the Google Form? | Fetch the public `viewform` page and parse the embedded `FB_PUBLIC_LOAD_DATA_` JSON blob. No OAuth. | The official Forms API only reads forms the *authenticated Google account* owns or edits. That fails the actual use case: the coach is importing a **client's** pre-existing form, which the coach doesn't own. OAuth would also add per-coach account-connection friction, a Google Cloud project + consent-screen + verification process, and token storage/refresh — none of which this codebase has today (no existing Google integration of any kind). Trade-off accepted: this relies on an undocumented Google page structure that could change without notice, and only works on forms set to "anyone with the link" (the default). |
| What do we import? | Question structure only (labels, types, options, required flag). Not responses. | Confirmed with user — clients fill the form fresh in FitForce going forward. Importing historical responses is materially bigger scope (would need Sheets/Forms API + OAuth) and can be revisited later if actually needed (see §9). |
| What does the import flow look like? | Parse → auto-create a new form → drop the parsed questions straight into the **existing** local/unsaved draft state the builder already uses for a brand-new form → coach reviews/edits in the **existing** `QuestionsPanel` / `QuestionEditorPanel` → coach hits the **existing** "Save Draft" button to persist. | No bespoke preview screen to build/maintain. The question editor the coach already knows *is* the review step. Any type FitForce can't represent is listed once (toast/banner) so nothing silently vanishes. |

---

## 3. Current State (what already exists and will be reused)

### Backend — `server/src/modules/forms/`
- `forms.routes.ts` — router-level auth: `authMiddleware` then a blanket `requirePermission('forms', action)` where `action` is `read` for GET, `delete` for DELETE, **`write` for everything else** (`forms.routes.ts:9-13`). This means a new `POST` route in this router is automatically permission-gated with zero extra code — just add the route.
- `forms.controller.ts`:
  - `createForm` (`:83-117`) — creates a `forms` row + its first `form_versions` row in a transaction, scoped by `req.user!.workspaceId`. Accepts `title_en, title_ar, description_en, description_ar, postAction, formType`.
  - `saveDraft` (`:468-620`) — the bulk "persist the whole local draft" endpoint (`POST /forms/:id/save-draft`, body `{ form, questions[], deletedIds[] }`). This is what the coach's own "Save Draft" click already calls — **we don't need a new persistence endpoint**, only a new *read/parse* endpoint that returns data shaped to feed straight into the client's existing draft state.
  - Error pattern actually used in this module (not the idealized `ApiError`/`asyncHandler` from the top-level CLAUDE.md — this module predates that convention): plain `try { ... } catch (err) { next(err); }`, with `res.status(4xx).json({ error: '...' })` for expected/validation failures thrown inline. The global handler (`server/src/app.ts:188-195`) reads `err.status` (or `.statusCode`), defaults to 500, and responds `{ error: err.message }`. **Match this existing pattern**, not the aspirational one — see `server/src/lib/fawaterak.ts:47-50` for the established way to throw a typed external-API error: `Object.assign(new Error('...'), { status: 502 })`.
  - `questionTypes.ts` — `QUESTION_TYPE_DEFS` is the single source of truth: `text, long_text, number, date, scale, select, multiselect, metric, attachment`. `isValidQuestionType()` and `normalizeQuestionOptions()` already exist and should be reused, not re-implemented, when shaping the parsed output.
- `server/src/lib/fawaterak.ts` — the only existing third-party HTTP integration in the codebase. **Pattern to copy**: plain exported async function, native `fetch` with `AbortSignal.timeout(...)`, config pulled from `env` (`server/src/config/env.ts`), typed error thrown on failure. No class, no singleton — just a module of functions.
- `server/src/modules/admin/defaultLibraries.controller.ts:163-187` (`importRecords`) — the codebase's one existing "import" endpoint. Pattern: accept records, validate each, return `{ imported, skipped, errors }`. Useful precedent for the `skipped` shape in our response, even though our endpoint doesn't write to the DB.

### Frontend — `client/`
- `client/app/(coach)/[workspaceSlug]/forms/page.js` — the actual route. Renders `FormsPanel` (list, left) + `QuestionsPanel` (middle) + `QuestionEditorPanel` (right), all driven by one hook. **There is no separate create/edit page or modal today** — selecting/creating a form just updates local state in the hook.
- `client/hooks/useFormBuilder.js` — the parent state hook (also reused as-is by the admin "Master Form Templates" page via a `basePath` prop, so keep any new method generic over `basePath`):
  - `handleCreateForm` (`:117-135`) — `POST {basePath}` with `{ title_en: 'Untitled Form' }`, then selects the new form and resets question-draft state.
  - `handleDuplicateForm` (`:200-233`) — closest existing precedent for "create a form, then populate it with a batch of questions from elsewhere." Note it currently POSTs each question **one at a time** to `/questions` — for our case we don't need any server round-trip per question at all, since imported questions should land as **unsaved local draft state** (see `handleCreateQuestion` below), not persisted immediately.
  - `handleCreateQuestion` (`:249-271`) — the exact local-draft question shape to match: `{ id: makeTempId(), form_version_id, label_en, label_ar, type, required, order_index, options, options_ar, placeholder_en, placeholder_ar, min_value, max_value, metric_id }`. `makeTempId()` (`:4-6`) generates the client-side temp id (`tmp-q-<timestamp>-<rand>`).
  - `handleSaveDraft` (`:355+`) — `POST {basePath}/{id}/save-draft` with the current local `questions` state. This is the existing persistence path our imported (but not-yet-saved) questions will go through — **unchanged**.
  - `markFormDirty` — must be called after populating imported questions so the "unsaved changes" indicator and the Save Draft button behave exactly as they do for manually-added questions.
- `client/app/components/forms/questionTypes.js` — client mirror of the server enum, same 9 values. Import-side type mapping must land on one of these exact strings.
- `client/app/components/forms/FormsPanel.js` — the toolbar with the existing **"New Form"** button (`:76-91`, inside `Disclosure.Heading`, label from `tNutrition('newForm')` — yes, that translation key really does live in the `nutrition` i18n namespace; new strings for this feature should go in the `forms` namespace instead, which is already used elsewhere in this same file via `tForms(...)`, e.g. `:50`). This is where the new "Import from Google Forms" entry point goes.
- `client/lib/axios.js` — the shared `api` axios instance (`baseURL` from `NEXT_PUBLIC_API_URL`, `withCredentials: true`). Use this for the new preview call, no new HTTP client needed.
- `client/messages/en.json` / `client/messages/ar.json` — i18n message files. New UI copy needs entries in **both**, under the `forms` namespace, per the project's localization convention (see recent commits `feat: localize landing page copy and add language switcher to nav`).

---

## 4. Data Flow

```
Coach pastes Google Form URL into "Import from Google Forms" dialog
        │
        ▼
Client: POST {basePath}/import/google-forms-preview  { url }
        │
        ▼
Server: googleFormsImport.fetchAndParseGoogleForm(url)
  1. Validate URL host is docs.google.com and path contains /forms/
  2. fetch() the public viewform page (~10s timeout)
  3. Extract FB_PUBLIC_LOAD_DATA_ JSON blob from the HTML via regex
  4. Walk the parsed structure, map each entry to a FitForce question type
  5. Anything unmappable → pushed to `skipped[]` with a reason, not guessed
        │
        ▼
Server responds 200: { title_en, description_en, questions: [...], skipped: [...] }
(no DB writes — this is a pure read/parse, nothing persisted yet)
        │
        ▼
Client hook: handleImportGoogleForm(url)
  1. Calls the endpoint above
  2. POST {basePath}  (existing handleCreateForm path) using parsed title/description
  3. Selects the new form; sets local `questions` state to the parsed array,
     normalized into the exact shape handleCreateQuestion already produces,
     each with a fresh makeTempId()
  4. markFormDirty(newForm.id)
  5. If skipped.length > 0, shows a toast/banner listing what couldn't be imported
        │
        ▼
Coach lands in the existing QuestionsPanel / QuestionEditorPanel with questions
pre-populated as an unsaved draft — reviews, fixes any mis-mapped type, deletes
anything unwanted, manually adds anything that was skipped.
        │
        ▼
Coach clicks the EXISTING "Save Draft" button → existing handleSaveDraft →
existing POST {basePath}/{id}/save-draft → persisted exactly like any
manually-built form. No new persistence code path.
```

---

## 5. Backend Implementation

### 5.1 New file: `server/src/modules/forms/googleFormsImport.ts`

```ts
import { QuestionType } from './questionTypes';

interface ParsedQuestion {
    label_en: string;
    type: QuestionType;
    required: boolean;
    order_index: number;
    options: string[] | null;   // populated for select/multiselect
    min_value: number | null;   // populated for scale
    max_value: number | null;
}

interface SkippedQuestion {
    label_en: string;
    reason: string;             // e.g. "Grid/matrix questions aren't supported"
}

interface ParsedGoogleForm {
    title_en: string;
    description_en: string | null;
    questions: ParsedQuestion[];
    skipped: SkippedQuestion[];
}

export async function fetchAndParseGoogleForm(url: string): Promise<ParsedGoogleForm> {
    assertIsGoogleFormUrl(url);          // throws { status: 400 } on failure

    const response = await fetch(normalizeToViewformUrl(url), {
        signal: AbortSignal.timeout(10000),
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; FitForceFormImport/1.0)' },
    });
    if (!response.ok) {
        throw Object.assign(
            new Error("Couldn't load this form — check that the link is public and try again"),
            { status: 400 }
        );
    }

    const html = await response.text();
    const rawData = extractFbPublicLoadData(html);   // throws { status: 400 } if not found
    return mapToFitForceForm(rawData);
}
```

Break the implementation into small, independently-testable functions rather than one large one (per CLAUDE.md's ≤30-line-function / one-job guidance):

- `assertIsGoogleFormUrl(url: string): void` — reject anything not matching `docs.google.com/forms/` (400).
- `normalizeToViewformUrl(url: string): string` — Google Form links come in a few shapes (`/viewform`, `/edit`, with or without `?usp=sharing`); normalize to the public fill-out URL before fetching.
- `extractFbPublicLoadData(html: string): unknown` — regex-extract the `var FB_PUBLIC_LOAD_DATA_ = [...];` assignment and `JSON.parse` it. Throw a clear 400 (`"Couldn't read this form's questions — it may be private or the link is wrong"`) if the marker isn't found (e.g. permission-walled or sign-in-required form).
- `mapToFitForceForm(rawData: unknown): ParsedGoogleForm` — walks the (loosely-typed, defensively-accessed) array structure and produces the normalized shape. Delegates per-question mapping to:
- `mapQuestionType(googleTypeCode: number): QuestionType | null` — the lookup table below; returns `null` for anything unsupported so the caller routes it to `skipped[]` instead of guessing.

#### Google → FitForce type mapping

Google's internal numeric type codes (from the community-reverse-engineered `FB_PUBLIC_LOAD_DATA_` structure — **these exact codes must be empirically verified against 3-5 real public Google Forms during implementation, covering every row below, before this table is trusted**):

| Google code | Google question type | FitForce type | Notes |
|---|---|---|---|
| 0 | Short answer | `text` | |
| 1 | Paragraph | `long_text` | |
| 2 | Multiple choice | `select` | options copied 1:1 |
| 3 | Dropdown | `select` | options copied 1:1 |
| 4 | Checkboxes | `multiselect` | options copied 1:1 |
| 5 | Linear scale | `scale` | `min_value`/`max_value` from the scale's actual bounds, not FitForce's default 1–10 |
| 9 | Date | `date` | |
| — | File upload | `attachment` | `options: { allowedCategory: 'any' }` via `normalizeQuestionOptions('attachment', ...)` — reuse the existing helper from `questionTypes.ts:41-50`, don't reimplement |
| 6 | Section header / title-and-description | *(dropped, not a question)* | purely structural in Google Forms |
| 8 | Page break | *(dropped, not a question)* | purely structural |
| 7 | Grid (multiple choice / checkbox grid) | *(skipped)* | reason: "Grid/matrix questions aren't supported — add the rows as separate questions manually" |
| 10 | Time | *(skipped)* | reason: "Time questions aren't supported" |
| anything else / quiz metadata / image choices | *(skipped)* | reason: "This question type isn't supported yet" |

`number` and `metric` (FitForce types) have no Google Forms equivalent worth auto-mapping to — Google's numeric "short answer with number validation" is still just `text` here; the coach can retype it manually if they want number validation or metric tracking (out of scope for a first pass, keeps the mapping table honest rather than over-guessing).

`required` maps directly from Google's per-question required flag. `label_en` is the question's title text, HTML-entity-decoded and trimmed. Options text is decoded/trimmed the same way. Empty-string labels fall back to `"Question"` (matches the fallback `saveDraft` already applies server-side at `forms.controller.ts:556`, so this is consistent either way).

### 5.2 Route: `server/src/modules/forms/forms.routes.ts`

Add, near the top-level form routes (after line 70's `router.delete('/:id', ...)`, before the questions routes):

```ts
router.post('/import/google-forms-preview', formsController.importGoogleFormPreview);
```

Add the matching `@openapi` JSDoc block (per project convention, every route documented — see the existing blocks in this file for the exact style). Already covered by the router-level `requirePermission('forms', 'write')` — no extra guard code needed since POST defaults to `write`.

### 5.3 Controller: `server/src/modules/forms/forms.controller.ts`

```ts
export async function importGoogleFormPreview(req: Request, res: Response, next: NextFunction) {
    const { url } = req.body as { url?: unknown };
    if (typeof url !== 'string' || !url.trim()) {
        return res.status(400).json({ error: 'A Google Form link is required' });
    }
    try {
        const parsed = await fetchAndParseGoogleForm(url.trim());
        res.json(parsed);
    } catch (err) {
        next(err);
    }
}
```

Add the import at the top of the file: `import { fetchAndParseGoogleForm } from './googleFormsImport';`. Note this handler never touches `prisma` or `req.user!.workspaceId` — nothing is created, so there's no tenant-scoping concern here (the tenant scoping happens later, for free, when the client calls the *existing* `createForm`/`save-draft` endpoints).

### 5.4 Config

None needed. This is an unauthenticated outbound fetch to a public page — no API key, no new `env.ts` entry. (If Google ever rate-limits or blocks the server's outbound IP, that's an operational concern to monitor, not a config one — see Risks.)

### 5.5 Paste-page-source fallback (added 2026-07-21, post-launch-testing)

Live testing surfaced a real, common wall the "Public-view only" risk (§8) only anticipated in the abstract: Google **unconditionally** sign-in-gates the `/viewform` page (HTTP 401/403, serving its own login page instead of the form) whenever the form has "Limit to 1 response," "Collect email addresses," **or any File Upload question** — the last one isn't a toggle the form owner can turn off. An anonymous server-side fetch can never get past this for any of the three, on any form, regardless of "anyone with the link" sharing.

The fix doesn't need OAuth: "requires sign-in" means *some* Google account, not the form owner specifically, so a coach signed into Google in their own browser can view the page just fine — the same `FB_PUBLIC_LOAD_DATA_` blob is right there in "View Page Source." So `googleFormsImport.ts` now exposes two entry points instead of one:

- `fetchAndParseGoogleForm(url)` — unchanged happy path, now delegates its tail (extract + map) to:
- `parseGoogleFormHtml(html)` — new, exported directly. Takes already-fetched HTML and does the same `extractFbPublicLoadData` → `mapToFitForceForm` pipeline, no network call. This is what both the URL path and the paste-source fallback share, so the mapping logic has exactly one implementation regardless of how the HTML arrived.

`importGoogleFormPreview` (the controller) now accepts `{ url }` **or** `{ html }`, preferring `html` when both are present, and 400s only when neither is given. The 401/403 error message from the URL path now explicitly points the coach at the paste-source option instead of a dead end.

On the client, `ImportGoogleFormDialog` gained a mode toggle ("Trouble importing? Paste the page source instead") that swaps the URL `Input` for a `TextArea`, with inline instructions (open the link signed into Google → View Page Source → select all → paste). `useFormBuilder`'s `handleImportGoogleForm` signature changed from a bare `url` string to an `{ url, html }` object to carry either mode through to the same endpoint — everything downstream of "the endpoint returned a parsed form" is unchanged.

**Follow-up fix, same day:** the first real paste hit Express's global 100kb JSON body limit (`app.ts`'s `express.json()`, no `limit` set — the default) — a real Google Forms page source, especially the signed-in view with extra account-switcher chrome, routinely runs well past that. Rather than raise the limit for every endpoint, `app.ts` now registers a scoped `express.json({ limit: '5mb' })` for exactly `/api/forms/import/google-forms-preview`, ahead of the global parser — the same "mount a route before the global body parser" pattern already used for the payments webhook's raw-body needs. body-parser no-ops on a second parse once `req._body` is already set, so this is a safe, established idiom, not a new one. Covered by a regression test sending a >100kb body and asserting it isn't rejected.

---

## 6. Frontend Implementation

### 6.1 New file: `client/app/components/forms/ImportGoogleFormDialog.js`

A small, focused modal (follow whatever modal/dialog primitive the codebase already uses elsewhere in this HeroUI-based component set — check an existing simple dialog, e.g. the archive/delete confirm flows in this same folder, for the exact primitive name before introducing a new one). Contents:
- URL text input, labeled clearly (e.g. "Google Form link"), with basic client-side sanity check (non-empty, looks like a URL) before enabling the submit button — full validation happens server-side regardless.
- "Import" button — disabled while pending, shows a loading state.
- Inline error area — surfaces the server's `{ error: message }` on failure (e.g. private form, malformed link, unsupported page) so the coach isn't left guessing.
- On success: closes itself. The parent (`FormsPanel`/`page.js`) is now showing the newly-created, newly-selected form with populated questions — no need for the dialog to render anything about the result itself; the banner from §6.2 step 5 handles that.

### 6.2 `client/hooks/useFormBuilder.js` — new `handleImportGoogleForm`

Add alongside `handleCreateForm`/`handleDuplicateForm`:

```js
const handleImportGoogleForm = async (url) => {
    if (selectedForm && dirtyFormIds.has(String(selectedForm.id))) {
        const proceed = window.confirm('You have unsaved changes on this form. Discard them and import a new form?');
        if (!proceed) return { ok: false };
        clearFormDirty(selectedForm.id);
    }
    try {
        const preview = await api.post(`${basePath}/import/google-forms-preview`, { url });
        const { title_en, description_en, questions: parsedQuestions, skipped } = preview.data;

        const res = await api.post(basePath, {
            title_en: title_en || 'Imported Form',
            description_en: description_en || null,
        });
        const newForm = { ...res.data, question_count: parsedQuestions.length };
        setForms(prev => [newForm, ...prev]);
        setSelectedForm(newForm);
        resetQuestionDraftState();

        const draftQuestions = parsedQuestions.map((q, idx) => ({
            id: makeTempId(),
            form_version_id: newForm.current_version_id,
            label_en: q.label_en,
            label_ar: null,
            type: q.type,
            required: q.required,
            order_index: idx,
            options: q.options ?? null,
            options_ar: null,
            placeholder_en: null,
            placeholder_ar: null,
            min_value: q.min_value ?? null,
            max_value: q.max_value ?? null,
            metric_id: null,
        }));
        setQuestions(draftQuestions);
        setSelectedQuestion(null);
        setPendingFocusFormId(newForm.id);
        markFormDirty(newForm.id);

        return { ok: true, skipped };
    } catch (err) {
        console.error('Error importing Google Form:', err);
        return { ok: false, error: err?.response?.data?.error || 'Import failed' };
    }
};
```

Export it from the hook alongside the other handlers (`:440-450` area). The dialog component calls this, checks `.ok`, and if `skipped?.length`, triggers a toast/banner (reuse whatever toast utility the codebase already has — grep for existing `toast(` calls in the forms or nutrition builder before adding a new one).

### 6.3 `client/app/components/forms/FormsPanel.js`

Next to the existing "New Form" `Button` (`:88-90`), add a secondary "Import from Google Forms" trigger that opens `ImportGoogleFormDialog`. Keep it visually secondary (e.g. `variant="ghost"` or a small icon+text button) so "New Form" stays the primary action — importing is the exception path, not the default one. Wire `onOpenImportDialog` down from `page.js` the same way `handleCreateForm` etc. are already threaded through as props.

### 6.4 i18n

Add to both `client/messages/en.json` and `client/messages/ar.json` under the `forms` namespace (matching the existing `archiveInsteadOfDeleteConfirm` key's location): something like `importFromGoogleForms`, `importDialogTitle`, `importUrlLabel`, `importButton`, `importSkippedBanner` (with a `{count}` placeholder), `importError`. Mirror whatever pluralization pattern the existing `daysAgo`/`hoursAgo` keys in this namespace already use for `importSkippedBanner`.

---

## 7. Testing

### 7.1 Backend — `googleFormsImport.ts` unit tests (new)
Use saved HTML fixtures (fetch a few real public Google Forms once during development, save their HTML under a `__fixtures__` folder — don't hit the network in CI):
- Happy path: one fixture containing at least one question of each supported type → assert exact mapped output.
- A fixture containing a grid/matrix question → assert it lands in `skipped` with a reason, and does **not** appear in `questions`.
- A non-Google URL → `assertIsGoogleFormUrl` throws with `status: 400`.
- A Google Forms URL that 404s or requires sign-in (mock the fetch response) → `fetchAndParseGoogleForm` throws with `status: 400` and the friendly message.
- Malformed/missing `FB_PUBLIC_LOAD_DATA_` in the HTML → same 400 behavior, not a crash.

Also (added with §5.5): `parseGoogleFormHtml` unit-tested directly against fixture HTML with no fetch/mock involved (happy path, and missing-marker → 400), since it's the shared tail both entry points call.

### 7.2 Backend — endpoint test for `POST /forms/import/google-forms-preview`
- No session → 401 (via the existing `authMiddleware`, no new code needed but worth a regression test).
- Missing both `url` and `html` in body → 400, neither parser called.
- Happy path via `url` (mock `fetchAndParseGoogleForm`) → 200 with the expected shape.
- Happy path via `html` (mock `parseGoogleFormHtml`) → 200, and `fetchAndParseGoogleForm` never called.
- A parser failure (either path) propagates its status/message untouched.

### 7.3 Manual E2E
1. Open `/belghamdi/forms`, click "Import from Google Forms."
2. Paste a real public Google Form link covering several question types (short answer, paragraph, multiple choice, checkboxes, linear scale, date).
3. Confirm the new form appears selected with the questions pre-populated in `QuestionsPanel`/`QuestionEditorPanel`, matching the source form's labels/types/options.
4. Fix a mis-mapped type via the normal editor to confirm nothing about the imported questions is "special" — they behave exactly like manually-added ones.
5. Click Save Draft, reload the page, confirm the form persisted correctly.
6. Open the client-facing fill-out view (`client/app/(client)/portal/forms/[requestId]/page.js` path) for a request against this form and confirm it renders and can be submitted.
7. Try an invalid link and a form with "Limit to 1 response"/"Collect email addresses"/a File Upload question — confirm the dialog shows the sign-in-wall-specific error, pointing at the paste-source option.
8. Use the "Paste the page source instead" toggle: open a sign-in-gated form in a browser signed into Google, View Page Source, paste it in, and confirm it imports correctly (this is what closed the loop on real testing — see §5.5).

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Google changes the `FB_PUBLIC_LOAD_DATA_` page structure, silently breaking imports | Parsing logic is isolated to one small file (`googleFormsImport.ts`) so a break is a contained, fast fix. Fail loudly (clear 400 + message) rather than silently importing garbage — a broken parser should never look like a successful import with wrong data. |
| Coach pastes a link to a form that's not publicly viewable | Detected as a fetch failure or missing data marker → clear error message, no partial/garbage import. **Confirmed in practice** (2026-07-21 live testing): Google sign-in-gates the page (401/403) whenever the form has "Limit to 1 response", "Collect email addresses", **or a File Upload question** — the last one applies unconditionally regardless of sharing settings, since Google requires a signed-in uploader to own the uploaded file. **Resolved** the same day with the paste-page-source fallback (§5.5) — the error message now points there instead of being a dead end. |
| Type-mapping table's numeric codes are wrong or incomplete | Explicit verification step against real forms during implementation (§5.1); unit tests pin the mapping so future drift is caught immediately, not discovered by a coach in production. |
| Outbound fetch from the server could be seen as scraping / hit informal rate limits at scale | Feature is single-import, coach-initiated, low-volume by nature — not a batch scraper. No caching or retry-storm risk since each import is one manual click. Worth revisiting if usage patterns ever suggest otherwise. |
| Imported "select"/"multiselect" options could be large (Google allows many choices) | No special handling needed — same `options` JSON column already used for manually-built forms handles arbitrary-length arrays today. |

---

## 9. Explicitly Deferred / Future Work

- **Importing past responses** from the old Google Form (would need the official Forms/Sheets API + OAuth, and only works for forms the coach's connected Google account owns — a real, separately-scoped feature).
- **Grid/matrix question support** in FitForce's own question types — if this comes up often enough in `skipped` telemetry, worth a dedicated FitForce question type rather than an import-time workaround.
- **Other survey tools** (Typeform, JotForm, etc.) — the user's original ask mentioned "or anything else"; this plan deliberately scopes to Google Forms only since it's the stated primary source. The parser module is isolated enough that a second importer (e.g. `typeformImport.ts`) could be added later behind the same `POST /forms/import/...-preview` → drop-into-draft-state pattern without touching the client hook's shape.
