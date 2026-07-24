/**
 * Remaps the 61 fitsavior-com submissions of a no-post-action assessment
 * form into two brand-new form_requests per client — one against the
 * coach's new training form (post_action='workout-plan'), one against the
 * new nutrition form (post_action='nutrition-plan') — so they land back in
 * the Plans Queue as actionable ('submitted'), the state they should have
 * been in from the start. See analyze-form-split-remap.ts for the
 * read-only report this depends on.
 *
 * PURELY ADDITIVE. The original form, its form_requests (still 'reviewed'),
 * and its form_responses are never modified or deleted — they stay exactly
 * as the coach left them, an untouched audit trail. Every row this script
 * writes is brand new, with a freshly generated id, so the entire migration
 * is undoable with two DELETEs keyed on the ids recorded in LEDGER_FILE.
 *
 * Requires a human-reviewed mapping file (see analyze-form-split-remap.ts's
 * draft output) of the shape:
 *   {
 *     "<origin_question_id>": { "label_en": "...", "type": "...",
 *                                "training": "<new_question_id>"|null,
 *                                "nutrition": "<new_question_id>"|null }
 *   }
 * training/nutrition null means "this question intentionally has no
 * counterpart on that form" (e.g. a pure-nutrition question has no training
 * counterpart) — that's valid and expected, NOT an error. What IS an error,
 * and aborts the whole run before any write: an origin_question_id that
 * shows up in a real answer but has no entry in the mapping file at all.
 * Never guessed, ever.
 *
 * Idempotent via LEDGER_FILE: an append-only, one-JSON-line-per-request-pair
 * log written incrementally as each original request is processed. Re-running
 * (dry or live) skips any original request_id already present in the ledger,
 * so an interrupted run can just be re-invoked with the same ledger file.
 * The ledger is also the rollback list.
 *
 * DRY_RUN=true by default (matches every other one-off script in this repo,
 * see backfill-stale-need-action-submissions.ts) -- always run dry first,
 * read the full report, and only re-run with DRY_RUN=false once every line
 * of it looks right.
 *
 * Usage (from server/):
 *   DRY_RUN=true DATABASE_URL="$DATABASE_URL" \
 *   WORKSPACE_SLUG="fitsavior-com" \
 *   ORIGINAL_FORM_ID="<id>" TRAINING_FORM_ID="<id>" NUTRITION_FORM_ID="<id>" \
 *   MAPPING_FILE="form-split-mapping.json" LEDGER_FILE="form-split-ledger.jsonl" \
 *     npx tsx src/scripts/remap-form-split-submissions.ts
 *
 *   # once the dry-run report is fully reviewed and correct:
 *   DATABASE_URL="$DATABASE_URL" WORKSPACE_SLUG="fitsavior-com" \
 *   ORIGINAL_FORM_ID="<id>" TRAINING_FORM_ID="<id>" NUTRITION_FORM_ID="<id>" \
 *   MAPPING_FILE="form-split-mapping.json" LEDGER_FILE="form-split-ledger.jsonl" \
 *     npx tsx src/scripts/remap-form-split-submissions.ts
 */

import { Pool, PoolClient } from 'pg';
import { createId } from '@paralleldrive/cuid2';
import { readFileSync, existsSync, appendFileSync } from 'fs';

const DATABASE_URL     = process.env.DATABASE_URL;
const WORKSPACE_SLUG   = process.env.WORKSPACE_SLUG;
const ORIGINAL_FORM_ID = process.env.ORIGINAL_FORM_ID;
const TRAINING_FORM_ID  = process.env.TRAINING_FORM_ID;
const NUTRITION_FORM_ID = process.env.NUTRITION_FORM_ID;
const MAPPING_FILE     = process.env.MAPPING_FILE;
const LEDGER_FILE      = process.env.LEDGER_FILE;
const DRY_RUN          = process.env.DRY_RUN !== 'false'; // default true — opt OUT, not in

for (const [name, val] of Object.entries({
    DATABASE_URL, WORKSPACE_SLUG, ORIGINAL_FORM_ID, TRAINING_FORM_ID, NUTRITION_FORM_ID, MAPPING_FILE, LEDGER_FILE,
})) {
    if (!val) { console.error(`${name} is required`); process.exit(1); }
}

const db = new Pool({ connectionString: DATABASE_URL });

function log(msg: string) { console.log(`[remap-form-split] ${msg}`); }

interface MappingEntry { label_en: string; type: string; training: string | null; nutrition: string | null }
type Mapping = Record<string, MappingEntry>;

interface LedgerEntry { originalRequestId: string; clientId: string; trainingRequestId: string; nutritionRequestId: string; migratedAt: string }

async function sealCurrentVersion(client: PoolClient, formId: string, workspaceId: string): Promise<string> {
    const { rows } = await client.query<{ id: string; current_version_id: string | null; status: string }>(
        `SELECT id, current_version_id, status FROM forms WHERE id = $1 AND workspace_id = $2 FOR UPDATE`,
        [formId, workspaceId]
    );
    if (rows.length === 0) throw new Error(`Form ${formId} not found in workspace ${workspaceId}`);
    if (!rows[0].current_version_id) throw new Error(`Form ${formId} has no version yet — add its questions in the builder first`);
    await client.query(
        `UPDATE form_versions SET sealed_at = NOW() WHERE id = $1 AND sealed_at IS NULL`,
        [rows[0].current_version_id]
    );
    return rows[0].current_version_id;
}

async function main() {
    log(`Starting… ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE — writing to production)'}`);

    const mapping: Mapping = JSON.parse(readFileSync(MAPPING_FILE as string, 'utf8'));

    const alreadyMigrated = new Set<string>();
    if (existsSync(LEDGER_FILE as string)) {
        const lines = readFileSync(LEDGER_FILE as string, 'utf8').split('\n').filter(Boolean);
        for (const line of lines) alreadyMigrated.add((JSON.parse(line) as LedgerEntry).originalRequestId);
        log(`ledger found: ${alreadyMigrated.size} request(s) already migrated in a prior run — will be skipped`);
    }

    try {
        const { rows: wsRows } = await db.query<{ id: string }>(`SELECT id FROM workspaces WHERE slug = $1`, [WORKSPACE_SLUG]);
        if (wsRows.length === 0) { log(`No workspace with slug '${WORKSPACE_SLUG}'. Aborting.`); process.exit(1); }
        const workspaceId = wsRows[0].id;

        // Both new forms must exist, in this workspace, and be distinct from
        // each other and from the original — guards against a copy-paste id
        // mistake in the env vars silently corrupting the wrong form's queue.
        const distinctIds = new Set([ORIGINAL_FORM_ID, TRAINING_FORM_ID, NUTRITION_FORM_ID]);
        if (distinctIds.size !== 3) { log('ORIGINAL_FORM_ID / TRAINING_FORM_ID / NUTRITION_FORM_ID must all be different. Aborting.'); process.exit(1); }

        const { rows: newForms } = await db.query<{ id: string; post_action: string }>(
            `SELECT id, post_action FROM forms WHERE id = ANY($1::text[]) AND workspace_id = $2`,
            [[TRAINING_FORM_ID, NUTRITION_FORM_ID], workspaceId]
        );
        if (newForms.length !== 2) { log('Training and/or nutrition form not found in this workspace. Aborting.'); process.exit(1); }
        const trainingForm  = newForms.find(f => f.id === TRAINING_FORM_ID)!;
        const nutritionForm = newForms.find(f => f.id === NUTRITION_FORM_ID)!;
        if (trainingForm.post_action !== 'workout-plan') log(`⚠ training form's post_action is '${trainingForm.post_action}', not 'workout-plan' — queue routing won't work as intended`);
        if (nutritionForm.post_action !== 'nutrition-plan') log(`⚠ nutrition form's post_action is '${nutritionForm.post_action}', not 'nutrition-plan' — queue routing won't work as intended`);

        // ---- Load target submissions ----------------------------------------------
        const { rows: requests } = await db.query<{
            id: string; client_id: string; status: string; requested_at: string | null;
            submitted_at: string | null; assigned_to: string | null; archived_at: string | null;
        }>(
            `SELECT id, client_id, status, requested_at, submitted_at, assigned_to, archived_at
             FROM form_requests WHERE workspace_id = $1 AND form_id = $2 ORDER BY requested_at ASC`,
            [workspaceId, ORIGINAL_FORM_ID]
        );
        log(`original submissions found: ${requests.length}`);
        const toProcess = requests.filter(r => !alreadyMigrated.has(r.id));
        log(`remaining to migrate this run: ${toProcess.length}`);
        if (toProcess.length === 0) { log('Nothing to do.'); return; }

        // ---- Pre-flight: every answered question must have a mapping entry --------
        const { rows: answeredOrigins } = await db.query<{ origin_question_id: string }>(
            `SELECT DISTINCT fvq.origin_question_id
             FROM form_responses rr
             JOIN form_version_questions fvq ON fvq.id = rr.question_id
             WHERE rr.request_id = ANY($1::text[])`,
            [toProcess.map(r => r.id)]
        );
        const unmapped = answeredOrigins.filter(o => !(o.origin_question_id in mapping));
        if (unmapped.length > 0) {
            log(`✕ ABORTING — ${unmapped.length} question(s) that appear in real answers have NO mapping entry:`);
            for (const u of unmapped) log(`  - ${u.origin_question_id}`);
            log('Add these to MAPPING_FILE (training/nutrition ids, or explicit null) and re-run. No rows were written.');
            process.exit(1);
        }
        const bothNull = Object.entries(mapping).filter(([, m]) => m.training == null && m.nutrition == null);
        if (bothNull.length > 0) {
            log(`⚠ ${bothNull.length} mapped question(s) have BOTH training and nutrition set to null (answers to these will be dropped everywhere):`);
            for (const [origin, m] of bothNull) log(`  - ${origin} "${m.label_en}"`);
        }

        // Validate every non-null mapping target actually exists as a question
        // on the corresponding new form's current version — catches a typo'd
        // id in the mapping file before it becomes an orphaned form_responses row.
        const { rows: trainingQIds } = await db.query<{ id: string }>(
            `SELECT fvq.id FROM form_version_questions fvq JOIN forms f ON f.current_version_id = fvq.form_version_id WHERE f.id = $1`,
            [TRAINING_FORM_ID]
        );
        const { rows: nutritionQIds } = await db.query<{ id: string }>(
            `SELECT fvq.id FROM form_version_questions fvq JOIN forms f ON f.current_version_id = fvq.form_version_id WHERE f.id = $1`,
            [NUTRITION_FORM_ID]
        );
        const trainingQSet  = new Set(trainingQIds.map(r => r.id));
        const nutritionQSet = new Set(nutritionQIds.map(r => r.id));
        const badMappings = Object.entries(mapping).filter(([, m]) =>
            (m.training && !trainingQSet.has(m.training)) || (m.nutrition && !nutritionQSet.has(m.nutrition))
        );
        if (badMappings.length > 0) {
            log(`✕ ABORTING — mapping references a question id that doesn't exist on the target form's current version:`);
            for (const [origin, m] of badMappings) log(`  - ${origin} "${m.label_en}" -> training=${m.training} nutrition=${m.nutrition}`);
            process.exit(1);
        }
        log('Pre-flight OK — every answered question has a valid mapping entry.');

        if (DRY_RUN) {
            log(`DRY RUN: would create ${toProcess.length * 2} new form_requests (${toProcess.length} training, ${toProcess.length} nutrition) and their form_responses.`);
            log('Re-run with DRY_RUN=false to write.');
            return;
        }

        // ---- Seal both new forms' current versions once, up front -----------------
        let trainingVersionId = '';
        let nutritionVersionId = '';
        {
            const sealClient = await db.connect();
            try {
                await sealClient.query('BEGIN');
                trainingVersionId  = await sealCurrentVersion(sealClient, TRAINING_FORM_ID as string, workspaceId);
                nutritionVersionId = await sealCurrentVersion(sealClient, NUTRITION_FORM_ID as string, workspaceId);
                await sealClient.query('COMMIT');
            } catch (err) {
                await sealClient.query('ROLLBACK');
                throw err;
            } finally {
                sealClient.release();
            }
        }

        // Question-id -> metric_id lookup on the NEW forms, so cloned answers
        // stay metric-linked exactly like a real submission's would.
        const { rows: newQuestionMeta } = await db.query<{ id: string; metric_id: string | null }>(
            `SELECT id, metric_id FROM form_version_questions WHERE form_version_id = ANY($1::text[])`,
            [[trainingVersionId, nutritionVersionId]]
        );
        const metricByQuestion = new Map(newQuestionMeta.map(q => [q.id, q.metric_id]));

        let migrated = 0;
        for (const request of toProcess) {
            const client = await db.connect();
            try {
                await client.query('BEGIN');

                const { rows: responses } = await client.query<{
                    question_id: string; answer: string | null; created_at: string | null; origin_question_id: string;
                }>(
                    `SELECT rr.question_id, rr.answer, rr.created_at, fvq.origin_question_id
                     FROM form_responses rr
                     JOIN form_version_questions fvq ON fvq.id = rr.question_id
                     WHERE rr.request_id = $1`,
                    [request.id]
                );

                const trainingRequestId  = createId();
                const nutritionRequestId = createId();

                await client.query(
                    `INSERT INTO form_requests
                        (id, form_id, form_version_id, client_id, workspace_id, status,
                         requested_at, submitted_at, post_action, assigned_to)
                     VALUES ($1,$2,$3,$4,$5,'submitted',$6,$7,'workout-plan',$8)`,
                    [trainingRequestId, TRAINING_FORM_ID, trainingVersionId, request.client_id, workspaceId,
                     request.requested_at, request.submitted_at, request.assigned_to]
                );
                await client.query(
                    `INSERT INTO form_requests
                        (id, form_id, form_version_id, client_id, workspace_id, status,
                         requested_at, submitted_at, post_action, assigned_to)
                     VALUES ($1,$2,$3,$4,$5,'submitted',$6,$7,'nutrition-plan',$8)`,
                    [nutritionRequestId, NUTRITION_FORM_ID, nutritionVersionId, request.client_id, workspaceId,
                     request.requested_at, request.submitted_at, request.assigned_to]
                );

                for (const r of responses) {
                    const m = mapping[r.origin_question_id];
                    if (m.training) {
                        await client.query(
                            `INSERT INTO form_responses (id, request_id, question_id, answer, metric_id, created_at)
                             VALUES ($1,$2,$3,$4,$5,$6)`,
                            [createId(), trainingRequestId, m.training, r.answer, metricByQuestion.get(m.training) ?? null, r.created_at]
                        );
                    }
                    if (m.nutrition) {
                        await client.query(
                            `INSERT INTO form_responses (id, request_id, question_id, answer, metric_id, created_at)
                             VALUES ($1,$2,$3,$4,$5,$6)`,
                            [createId(), nutritionRequestId, m.nutrition, r.answer, metricByQuestion.get(m.nutrition) ?? null, r.created_at]
                        );
                    }
                }

                await client.query('COMMIT');

                const entry: LedgerEntry = {
                    originalRequestId: request.id, clientId: request.client_id,
                    trainingRequestId, nutritionRequestId, migratedAt: new Date().toISOString(),
                };
                appendFileSync(LEDGER_FILE as string, JSON.stringify(entry) + '\n');
                migrated++;
            } catch (err) {
                await client.query('ROLLBACK');
                log(`✕ FAILED on original request ${request.id} (client ${request.client_id}): ${(err as Error).message}`);
                log(`Stopping here — ${migrated} request(s) migrated so far are safely committed and in the ledger; already-done rows won't be reprocessed on retry.`);
                process.exit(1);
            } finally {
                client.release();
            }
        }

        log(`Done — migrated ${migrated} submission(s) into ${migrated} new training + ${migrated} new nutrition form_requests.`);
        log(`Ledger: ${LEDGER_FILE}. To roll back, DELETE FROM form_requests WHERE id IN (each trainingRequestId/nutritionRequestId in the ledger) — form_responses cascade-delete with them.`);
    } catch (err) {
        console.error('[remap-form-split] FAILED:', err);
        process.exit(1);
    } finally {
        await db.end();
    }
}

main();
