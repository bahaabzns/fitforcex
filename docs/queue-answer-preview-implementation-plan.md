# Plans Queue — Quick Answer Preview

## Goal
Let a coach click an icon next to the client's name in the Plans Queue table and see the client's submitted form answers in a small popover, right there in the row — without opening the nutrition/training builder and without leaving the Plans Queue page.

## Current behavior
- The queue table (`PlansQueueTable.js`, shared by both the Main "need action" view and the Submission History view) already receives each row's submitted answers from the API: `row.responses` — an array of `{ label_en, label_ar, type, metric_type, answer, order_index, ... }` — and `row.answers` (a `question_id → answer` map). This comes pre-loaded with every `GET /api/forms/queue` call (`server/src/modules/forms/forms.controller.ts:1005-1022`), so **no new backend endpoint or request is needed** — the data is already sitting in the row object on the client.
- Today the only way to see those answers is to click into the nutrition/training builder (`Salad`/`Dumbbell` icon actions) or open the client's dedicated Forms page — both navigate away from the queue.
- This exact "preview answers inline" feature existed once before: a per-row `Eye`/`EyeOff` toggle expanded the row to show a "Submission Answers" panel (`renderAnswers`). It was removed on 2026-07-17 (commit `3ff845a`) as an incidental side effect of migrating the table to the shared `DataTable` component for the archiving feature — not a deliberate product decision to drop it. Rows with `status: "awaiting"` or `"scheduled"` never had this (no answers exist yet).
- A very similar, fuller answer renderer already exists on the client's Forms detail page (`clients/[id]/forms/page.js` — `AnswerBody`, `isImageAnswer`, `attachmentKind`, `attachmentFileName`): it renders text, images, PDFs, and generic file attachments based on `response.type`/`metric_type`, exactly the shape the queue's `responses` already carries.

## Required behavior
- In the `clientName` column of `PlansQueueTable`, show a small preview-icon button next to the client's name whenever the row has submitted answers (`row.responses.length > 0` — i.e. `need-action` or `action-done` rows; not `awaiting`/`scheduled`, which have none yet).
- Clicking the icon toggles a popover anchored to that row, listing every question's label + answer in small text — reusing the existing full answer rendering (text / images / PDFs / attachments) rather than a stripped-down text-only version.
- Clicking the icon again, or clicking outside, closes it. Opening a different row's popover closes any other open one (one open at a time).
- Nothing about the row's own click/keyboard behavior, navigation, or the existing action buttons changes. The click on the preview icon must not trigger anything else in the row (`stopPropagation`, matching the existing `IconAction` pattern in this file).
- Applies to both views this component renders (Main queue and Submission History) — it's the same component, so this falls out for free.

## Implementation steps
1. **Extract the shared answer renderer.** Move `AnswerBody` (+ its helpers `isImageAnswer`, `attachmentKind`, `attachmentFileName`) out of `clients/[id]/forms/page.js` into a new shared component, `client/app/components/forms/AnswerBody.js`, exporting the pieces needed. Update `clients/[id]/forms/page.js` to import from there instead of defining them locally. Behavior on that page stays identical — this is a pure extraction so the queue can reuse the same rendering instead of duplicating it.
2. **Add the preview trigger + popover in `PlansQueueTable.js`.**
   - In the `clientName` column's `render`, add a small icon button (e.g. `Eye`, matching the icon used by the old feature) next to the name, shown only when `row.responses?.length > 0`.
   - Use the existing `@heroui/react/popover` component (already used elsewhere in the app) for click-to-toggle behavior, anchored to the icon.
   - Popover content: the form title, then each `row.responses` entry rendered as `label (localized via getLocalizedField/locale) : <AnswerBody response={r} />`, in small text (`text-xs`/`text-sm` to match the row/table's existing scale), scrollable if long.
   - `onClick` on the trigger button calls `e.stopPropagation()` before toggling, consistent with every other in-row action in this file.
3. **i18n:** Add a label for the preview trigger's tooltip/aria-label (e.g. `previewAnswers`) to `client/messages/en.json` and `ar.json` under `plansQueue`. Reuse the existing `submissionAnswers` key (already present but currently unused — leftover from the old feature) as the popover's heading, instead of adding a duplicate key.
4. **Manual verification** in both Main and Submission History views: icon appears only on rows with answers, popover opens/closes correctly, text/image/attachment answers render, doesn't interfere with row selection, the existing action buttons, or Select dropdowns in the same row.

## Files / areas likely to change
- `client/app/components/forms/AnswerBody.js` — **new**, extracted shared component.
- `client/app/(coach)/[workspaceSlug]/clients/[id]/forms/page.js` — remove the now-duplicated local definitions, import from the new shared file. No behavior change.
- `client/app/components/plansQueue/PlansQueueTable.js` — add the preview icon + popover to the `clientName` column.
- `client/messages/en.json`, `client/messages/ar.json` — one new translation key (`previewAnswers`); reuse existing `submissionAnswers`.

## Testing
- Manual: Main queue — row with a submitted nutrition/training/check-in form shows the icon; click opens the popover with correct labels/answers in the right language; click again (or outside) closes it; `awaiting`/`scheduled` rows show no icon.
- Manual: Submission History — same checks, including `action-done` rows.
- Manual: an answer that's an image, a PDF, and a plain file attachment each render correctly inside the popover (reusing the Forms page's existing rendering, so this should just work).
- Manual: confirm the client Forms detail page still renders answers identically after the extraction (regression check on step 1).
- No automated test suite currently covers this component; per project standards this is logged as a gap, not something newly introduced by this change.

## Decisions locked (with you)
1. **Row scope:** the icon appears on **any row with submitted answers**, not just nutrition/training-plan rows.
2. **View scope:** appears in **both** the Main queue and Submission History (they share this one component).
3. **Interaction & content:** **click-to-toggle popover**; answers render fully (images as thumbnails, attachments as file links, metrics as their proper type) — same fidelity as the client's Forms detail page, not a plain-text-only summary.
