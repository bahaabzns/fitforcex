/**
 * Read-only fact-finder for the fitsavior-com assessment-split remap.
 *
 * A coach built one assessment form with post_action='nothing' (no queue
 * action wired up). 61 clients submitted it; with no post_action to route
 * them, the coach cleared the whole batch with the generic "mark as
 * reviewed" action -- so none of them ever produced a training or nutrition
 * plan. Fix: the coach is splitting the form into two new forms (training,
 * nutrition) with post_action='workout-plan' / 'nutrition-plan', same
 * questions, built through the normal Forms builder. This script gathers
 * everything needed to write a SAFE, human-reviewed question mapping before
 * any submission gets remapped -- see remap-form-split-submissions.ts.
 *
 * Matches by origin_question_id (form_version_questions' stable lineage
 * column, see forks in forms.service.ts), not by the version-specific
 * question id -- if the coach edited the original form between some of the
 * 61 submissions, different submissions can point at different
 * form_version_id rows, but a question's origin_question_id stays constant
 * across every fork of that question. That's the only column stable enough
 * to build one mapping that covers all 61 submissions correctly.
 *
 * No writes. Safe to run anytime, as many times as needed.
 *
 * Usage (from server/):
 *   DATABASE_URL="$DATABASE_URL" \
 *   WORKSPACE_SLUG="fitsavior-com" \
 *   ORIGINAL_FORM_ID="<id>" \
 *   TRAINING_FORM_ID="<id>" \
 *   NUTRITION_FORM_ID="<id>" \
 *     npx tsx src/scripts/analyze-form-split-remap.ts
 *
 * TRAINING_FORM_ID / NUTRITION_FORM_ID are optional -- omit them to just
 * see the original form's submission/question inventory before the two new
 * forms exist yet.
 */

import { Pool } from 'pg';
import { writeFileSync } from 'fs';

const DATABASE_URL     = process.env.DATABASE_URL;
const WORKSPACE_SLUG   = process.env.WORKSPACE_SLUG;
const ORIGINAL_FORM_ID = process.env.ORIGINAL_FORM_ID;
const TRAINING_FORM_ID  = process.env.TRAINING_FORM_ID || null;
const NUTRITION_FORM_ID = process.env.NUTRITION_FORM_ID || null;

if (!DATABASE_URL)     { console.error('DATABASE_URL is required'); process.exit(1); }
if (!WORKSPACE_SLUG)   { console.error('WORKSPACE_SLUG is required'); process.exit(1); }
if (!ORIGINAL_FORM_ID) { console.error('ORIGINAL_FORM_ID is required'); process.exit(1); }

const db = new Pool({ connectionString: DATABASE_URL });

function log(msg: string) { console.log(`[analyze-form-split-remap] ${msg}`); }

interface QuestionRow {
    origin_question_id: string;
    label_en: string;
    type: string;
    metric_id: string | null;
    response_count: number;
    request_count: number;
    sample_answer: string | null;
}

async function main() {
    try {
        const { rows: wsRows } = await db.query<{ id: string; name: string }>(
            `SELECT id, name FROM workspaces WHERE slug = $1`,
            [WORKSPACE_SLUG]
        );
        if (wsRows.length === 0) {
            log(`No workspace found with slug '${WORKSPACE_SLUG}'. Aborting.`);
            process.exit(1);
        }
        const workspaceId = wsRows[0].id;
        log(`workspace: ${wsRows[0].name} (${workspaceId})`);

        const { rows: formRows } = await db.query<{
            id: string; title_en: string; status: string; post_action: string;
            form_type: string; current_version_id: string | null;
        }>(
            `SELECT id, title_en, status, post_action, form_type, current_version_id
             FROM forms WHERE id = $1 AND workspace_id = $2`,
            [ORIGINAL_FORM_ID, workspaceId]
        );
        if (formRows.length === 0) {
            log(`Form ${ORIGINAL_FORM_ID} not found in workspace ${WORKSPACE_SLUG}. Aborting.`);
            process.exit(1);
        }
        const form = formRows[0];
        log(`original form: "${form.title_en}" status=${form.status} post_action=${form.post_action} form_type=${form.form_type}`);
        if (form.post_action !== 'nothing') {
            log(`⚠ NOTE: this form's post_action is NOT 'nothing' (it's '${form.post_action}'). Confirm this is really the form the coach means before proceeding.`);
        }

        // ---- Submission inventory ------------------------------------------------
        const { rows: requests } = await db.query<{
            id: string; client_id: string; status: string; post_action: string;
            form_version_id: string | null; requested_at: string | null;
            submitted_at: string | null; archived_at: string | null; assigned_to: string | null;
        }>(
            `SELECT id, client_id, status, post_action, form_version_id,
                    requested_at, submitted_at, archived_at, assigned_to
             FROM form_requests
             WHERE workspace_id = $1 AND form_id = $2
             ORDER BY requested_at ASC`,
            [workspaceId, ORIGINAL_FORM_ID]
        );
        log(`form_requests against this form: ${requests.length}`);

        const byStatus = new Map<string, number>();
        for (const r of requests) byStatus.set(r.status, (byStatus.get(r.status) ?? 0) + 1);
        for (const [status, count] of byStatus) log(`  status='${status}': ${count}`);

        const distinctVersions = new Set(requests.map(r => r.form_version_id).filter(Boolean));
        log(`distinct form_version_id referenced across these submissions: ${distinctVersions.size}`);

        const archivedCount = requests.filter(r => r.archived_at != null).length;
        if (archivedCount > 0) log(`⚠ ${archivedCount} of these are archived (hidden from the active queue) — will still be remapped unless you say otherwise`);

        const distinctClients = new Set(requests.map(r => r.client_id));
        if (distinctClients.size !== requests.length) {
            log(`⚠ ${requests.length - distinctClients.size} client(s) have MORE THAN ONE submission of this form — check for duplicates before remapping`);
        }

        // ---- Distinct logical questions across all submissions (by lineage) ------
        const { rows: questions } = await db.query<QuestionRow>(
            `SELECT fvq.origin_question_id,
                    MAX(fvq.label_en)  AS label_en,
                    MAX(fvq.type)      AS type,
                    MAX(fvq.metric_id) AS metric_id,
                    COUNT(*)::int      AS response_count,
                    COUNT(DISTINCT rr.request_id)::int AS request_count,
                    MAX(rr.answer)     AS sample_answer
             FROM form_responses rr
             JOIN form_version_questions fvq ON fvq.id = rr.question_id
             WHERE rr.request_id IN (SELECT id FROM form_requests WHERE workspace_id = $1 AND form_id = $2)
             GROUP BY fvq.origin_question_id
             ORDER BY MAX(fvq.order_index) ASC`,
            [workspaceId, ORIGINAL_FORM_ID]
        );

        log(`distinct logical questions (by origin_question_id) answered across these submissions: ${questions.length}`);
        for (const q of questions) {
            log(`  - [${q.origin_question_id}] "${q.label_en}" (${q.type})${q.metric_id ? ' [metric-linked]' : ''} — ${q.response_count} answers across ${q.request_count} submissions`);
        }

        const requestIdsWithNoAnswers = requests.length - new Set(
            (await db.query<{ request_id: string }>(
                `SELECT DISTINCT request_id FROM form_responses WHERE request_id = ANY($1::text[])`,
                [requests.map(r => r.id)]
            )).rows.map(r => r.request_id)
        ).size;
        if (requestIdsWithNoAnswers > 0) {
            log(`⚠ ${requestIdsWithNoAnswers} submission(s) have ZERO form_responses rows — investigate individually before remapping those`);
        }

        // ---- New forms' current questions, if provided ---------------------------
        const mappingSkeleton: Record<string, { label_en: string; type: string; training: string | null; nutrition: string | null }> = {};
        for (const q of questions) {
            mappingSkeleton[q.origin_question_id] = { label_en: q.label_en, type: q.type, training: null, nutrition: null };
        }

        async function dumpNewForm(label: string, formId: string | null) {
            if (!formId) { log(`${label}: not provided — skipping`); return; }
            const { rows: f } = await db.query<{ id: string; title_en: string; post_action: string; current_version_id: string | null }>(
                `SELECT id, title_en, post_action, current_version_id FROM forms WHERE id = $1 AND workspace_id = $2`,
                [formId, workspaceId]
            );
            if (f.length === 0) { log(`⚠ ${label}: form ${formId} not found in this workspace`); return; }
            log(`${label}: "${f[0].title_en}" post_action=${f[0].post_action}`);
            if (!f[0].current_version_id) { log(`  (no version yet — add questions in the builder first)`); return; }
            const { rows: qs } = await db.query<{ id: string; label_en: string; type: string; order_index: number }>(
                `SELECT id, label_en, type, order_index FROM form_version_questions WHERE form_version_id = $1 ORDER BY order_index ASC`,
                [f[0].current_version_id]
            );
            for (const q of qs) {
                log(`  - [${q.id}] "${q.label_en}" (${q.type})`);
                const exactMatch = questions.find(orig => orig.label_en.trim().toLowerCase() === q.label_en.trim().toLowerCase() && orig.type === q.type);
                if (exactMatch) {
                    const target = label.toLowerCase().includes('training') ? 'training' : 'nutrition';
                    if (mappingSkeleton[exactMatch.origin_question_id][target] == null) {
                        mappingSkeleton[exactMatch.origin_question_id][target] = q.id;
                    }
                }
            }
        }
        await dumpNewForm('training form', TRAINING_FORM_ID);
        await dumpNewForm('nutrition form', NUTRITION_FORM_ID);

        const skeletonPath = 'form-split-mapping.draft.json';
        writeFileSync(skeletonPath, JSON.stringify(mappingSkeleton, null, 2));
        log(`Draft mapping written to ${skeletonPath} — SUGGESTED matches only (exact label+type match), NOT verified. A human must review every row, fill any nulls, and fix any wrong guesses before this feeds remap-form-split-submissions.ts.`);
    } catch (err) {
        console.error('[analyze-form-split-remap] FAILED:', err);
        process.exit(1);
    } finally {
        await db.end();
    }
}

main();
