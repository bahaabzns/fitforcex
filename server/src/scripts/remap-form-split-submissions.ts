/**
 * Fixes the fitsavior-com "Assessment Form" (post_action='nothing', so
 * nothing ever routed to a plan). Every form_requests row against it —
 * submitted or still-pending — gets replaced with two brand-new rows per
 * client: one against the coach's new training form (post_action=
 * 'workout-plan'), one against the new nutrition form (post_action=
 * 'nutrition-plan'). See analyze-form-split-remap.ts for the read-only
 * report this depends on.
 *
 * Two structurally different cases, handled differently on purpose:
 *
 *  - status='submitted' (or 'reviewed'/archived — anything with real
 *    answers): PURELY ADDITIVE. The original row and its form_responses are
 *    never modified or deleted — untouched audit trail. Two new
 *    form_requests are inserted with status='submitted', and every answer is
 *    cloned across via the question mapping. Only the LATEST submission per
 *    client is processed — see DEDUPE note below.
 *
 *  - status='pending' (delivered to the client, never answered — zero
 *    form_responses rows, confirmed no other table references it): the old
 *    row is DELETED and replaced with two new status='pending' rows, one per
 *    new form. Safe because there is no answer data to lose — the client
 *    just sees two forms to fill instead of one, instead of three.
 *
 * DEDUPE: fitsavior-com has 9 clients who submitted this form twice — the
 * first was archived within minutes-to-a-day, then the client immediately
 * resubmitted a full copy. The older, archived submission is treated as
 * superseded and is NOT remapped or touched in any way (it's simply excluded
 * from processing — still sits in the DB exactly as the coach left it). Only
 * the newer submission (by submitted_at) is processed. Confirmed by
 * inspecting form_responses.answer_count on both rows (56/56 — a full
 * resubmission, not a partial retry) before deciding this.
 *
 * Requires a human-reviewed mapping file (see analyze-form-split-remap.ts's
 * draft output) of the shape:
 *   {
 *     "<origin_question_id>": { "label_en": "...", "type": "...",
 *                                "training": "<new_question_id>"|null,
 *                                "nutrition": "<new_question_id>"|null }
 *   }
 * training/nutrition null means "this question intentionally has no
 * counterpart on that form" — valid and expected, NOT an error. What IS an
 * error, and aborts the whole run before any write: an origin_question_id
 * that shows up in a real answer but has no entry in the mapping file at
 * all. Never guessed, ever.
 *
 * Idempotent via LEDGER_FILE: an append-only, one-JSON-line-per-original-row
 * log written incrementally as each row is processed (both the additive and
 * the delete-and-replace path append to it). Re-running (dry or live) skips
 * any original request_id already present in the ledger, so an interrupted
 * run can just be re-invoked with the same ledger file. The ledger is also
 * the rollback list.
 *
 * DRY_RUN=true by default (matches every other one-off script in this repo,
 * see backfill-stale-need-action-submissions.ts) -- always run dry first,
 * read the full report, and only re-run with DRY_RUN=false once every line
 * of it looks right.
 *
 * INCLUDE_PENDING=true opts into the delete-and-replace path for pending
 * rows. Defaults to false so the two cases can be reviewed and run as
 * separate, deliberate steps rather than one opaque batch.
 *
 * Usage (from server/):
 *   DRY_RUN=true DATABASE_URL="$DATABASE_URL" \
 *   WORKSPACE_SLUG="fitsavior-com" \
 *   ORIGINAL_FORM_ID="<id>" TRAINING_FORM_ID="<id>" NUTRITION_FORM_ID="<id>" \
 *   MAPPING_FILE="form-split-mapping.json" LEDGER_FILE="form-split-ledger.jsonl" \
 *   INCLUDE_PENDING=true \
 *     npx ts-node -r tsconfig-paths/register src/scripts/remap-form-split-submissions.ts
 *
 *   # once the dry-run report is fully reviewed and correct, same command with DRY_RUN=false
 */

import { Pool, PoolClient } from 'pg';
import { createId } from '@paralleldrive/cuid2';
import { readFileSync, existsSync, appendFileSync } from 'fs';

const DATABASE_URL      = process.env.DATABASE_URL;
const WORKSPACE_SLUG    = process.env.WORKSPACE_SLUG;
const ORIGINAL_FORM_ID  = process.env.ORIGINAL_FORM_ID;
const TRAINING_FORM_ID  = process.env.TRAINING_FORM_ID;
const NUTRITION_FORM_ID = process.env.NUTRITION_FORM_ID;
const MAPPING_FILE      = process.env.MAPPING_FILE;
const LEDGER_FILE       = process.env.LEDGER_FILE;
const DRY_RUN           = process.env.DRY_RUN !== 'false';       // default true — opt OUT, not in
const INCLUDE_PENDING   = process.env.INCLUDE_PENDING === 'true'; // default false — opt IN

for (const [name, val] of Object.entries({
    DATABASE_URL, WORKSPACE_SLUG, ORIGINAL_FORM_ID, TRAINING_FORM_ID, NUTRITION_FORM_ID, MAPPING_FILE, LEDGER_FILE,
})) {
    if (!val) { console.error(`${name} is required`); process.exit(1); }
}

const db = new Pool({ connectionString: DATABASE_URL });

function log(msg: string) { console.log(`[remap-form-split] ${msg}`); }

interface MappingEntry { label_en: string; type: string; training: string | null; nutrition: string | null }
type Mapping = Record<string, MappingEntry>;

interface LedgerEntry {
    kind: 'submitted' | 'pending';
    originalRequestId: string; clientId: string;
    trainingRequestId: string; nutritionRequestId: string; migratedAt: string;
}

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
    log(`Starting… ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE — writing to production)'} — pending rows ${INCLUDE_PENDING ? 'INCLUDED' : 'excluded (set INCLUDE_PENDING=true to include)'}`);

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

        // ---- Load all rows against the original form -------------------------------
        const { rows: allRequests } = await db.query<{
            id: string; client_id: string; status: string; requested_at: string | null;
            submitted_at: string | null; assigned_to: string | null; archived_at: string | null;
        }>(
            `SELECT id, client_id, status, requested_at, submitted_at, assigned_to, archived_at
             FROM form_requests WHERE workspace_id = $1 AND form_id = $2 ORDER BY requested_at ASC`,
            [workspaceId, ORIGINAL_FORM_ID]
        );
        log(`total form_requests against original form: ${allRequests.length}`);

        // ---- Submitted-row set: dedupe to latest submission per client -------------
        const submittedRows = allRequests.filter(r => r.status === 'submitted' || r.status === 'reviewed');
        const latestByClient = new Map<string, typeof submittedRows[number]>();
        for (const r of submittedRows) {
            const current = latestByClient.get(r.client_id);
            const rTime = r.submitted_at ?? r.requested_at ?? '';
            const curTime = current ? (current.submitted_at ?? current.requested_at ?? '') : '';
            if (!current || rTime > curTime) latestByClient.set(r.client_id, r);
        }
        const dedupedSubmitted = [...latestByClient.values()];
        const skippedAsStale = submittedRows.filter(r => !dedupedSubmitted.includes(r));
        if (skippedAsStale.length > 0) {
            log(`skipping ${skippedAsStale.length} superseded duplicate submission(s) (older of a resubmit pair) — never touched:`);
            for (const s of skippedAsStale) log(`  - ${s.id} (client ${s.client_id}, submitted ${s.submitted_at})`);
        }
        const submittedToProcess = dedupedSubmitted.filter(r => !alreadyMigrated.has(r.id));
        log(`submitted rows to process this run: ${submittedToProcess.length} (of ${dedupedSubmitted.length} deduped, ${submittedRows.length} raw)`);

        // ---- Pending-row set ---------------------------------------------------------
        const pendingRows = allRequests.filter(r => r.status === 'pending');
        const pendingToProcess = INCLUDE_PENDING ? pendingRows.filter(r => !alreadyMigrated.has(r.id)) : [];
        log(`pending rows: ${pendingRows.length} total${INCLUDE_PENDING ? `, ${pendingToProcess.length} to process this run` : ' (excluded this run)'}`);

        if (submittedToProcess.length === 0 && pendingToProcess.length === 0) { log('Nothing to do.'); return; }

        // ---- Pre-flight: every answered question must have a mapping entry ---------
        const { rows: answeredOrigins } = submittedToProcess.length > 0
            ? await db.query<{ origin_question_id: string }>(
                `SELECT DISTINCT fvq.origin_question_id
                 FROM form_responses rr
                 JOIN form_version_questions fvq ON fvq.id = rr.question_id
                 WHERE rr.request_id = ANY($1::text[])`,
                [submittedToProcess.map(r => r.id)]
            )
            : { rows: [] as { origin_question_id: string }[] };
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
            log(`DRY RUN: would create ${submittedToProcess.length * 2} new 'submitted' form_requests (${submittedToProcess.length} training, ${submittedToProcess.length} nutrition) with cloned answers.`);
            if (INCLUDE_PENDING) log(`DRY RUN: would DELETE ${pendingToProcess.length} pending original row(s) and create ${pendingToProcess.length * 2} new 'pending' form_requests (${pendingToProcess.length} training, ${pendingToProcess.length} nutrition) with no answers.`);
            log('Re-run with DRY_RUN=false to write.');
            return;
        }

        // ---- Seal both new forms' current versions once, up front -------------------
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

        function writeLedger(entry: LedgerEntry) {
            appendFileSync(LEDGER_FILE as string, JSON.stringify(entry) + '\n');
        }

        // ---- Submitted rows: additive clone ------------------------------------------
        let migratedSubmitted = 0;
        for (const request of submittedToProcess) {
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
                writeLedger({ kind: 'submitted', originalRequestId: request.id, clientId: request.client_id, trainingRequestId, nutritionRequestId, migratedAt: new Date().toISOString() });
                migratedSubmitted++;
            } catch (err) {
                await client.query('ROLLBACK');
                log(`✕ FAILED on submitted request ${request.id} (client ${request.client_id}): ${(err as Error).message}`);
                log(`Stopping here — ${migratedSubmitted} submitted request(s) migrated so far are safely committed and in the ledger.`);
                process.exit(1);
            } finally {
                client.release();
            }
        }
        log(`Submitted rows done — migrated ${migratedSubmitted}.`);

        // ---- Pending rows: delete original, insert two fresh pending rows -----------
        let migratedPending = 0;
        for (const request of pendingToProcess) {
            const client = await db.connect();
            try {
                await client.query('BEGIN');

                const trainingRequestId  = createId();
                const nutritionRequestId = createId();

                await client.query(
                    `INSERT INTO form_requests
                        (id, form_id, form_version_id, client_id, workspace_id, status,
                         requested_at, post_action, assigned_to)
                     VALUES ($1,$2,$3,$4,$5,'pending',$6,'workout-plan',$7)`,
                    [trainingRequestId, TRAINING_FORM_ID, trainingVersionId, request.client_id, workspaceId,
                     request.requested_at, request.assigned_to]
                );
                await client.query(
                    `INSERT INTO form_requests
                        (id, form_id, form_version_id, client_id, workspace_id, status,
                         requested_at, post_action, assigned_to)
                     VALUES ($1,$2,$3,$4,$5,'pending',$6,'nutrition-plan',$7)`,
                    [nutritionRequestId, NUTRITION_FORM_ID, nutritionVersionId, request.client_id, workspaceId,
                     request.requested_at, request.assigned_to]
                );

                // Safe: confirmed via analyze step that zero check_in_schedules /
                // client_observations / observation_relations reference any row
                // against this form, and a pending row has zero form_responses by
                // definition — there is nothing here to lose.
                const del = await client.query(`DELETE FROM form_requests WHERE id = $1 AND status = 'pending'`, [request.id]);
                if (del.rowCount !== 1) throw new Error(`expected to delete exactly 1 pending row for ${request.id}, deleted ${del.rowCount}`);

                await client.query('COMMIT');
                writeLedger({ kind: 'pending', originalRequestId: request.id, clientId: request.client_id, trainingRequestId, nutritionRequestId, migratedAt: new Date().toISOString() });
                migratedPending++;
            } catch (err) {
                await client.query('ROLLBACK');
                log(`✕ FAILED on pending request ${request.id} (client ${request.client_id}): ${(err as Error).message}`);
                log(`Stopping here — ${migratedPending} pending request(s) replaced so far are safely committed and in the ledger.`);
                process.exit(1);
            } finally {
                client.release();
            }
        }
        if (INCLUDE_PENDING) log(`Pending rows done — replaced ${migratedPending}.`);

        log(`Done — ${migratedSubmitted} submitted + ${migratedPending} pending row(s) processed this run.`);
        log(`Ledger: ${LEDGER_FILE}. Rollback: for 'submitted' entries, DELETE FROM form_requests WHERE id IN (trainingRequestId, nutritionRequestId) — form_responses cascade with them, original untouched. For 'pending' entries, the original row was deleted — re-create it manually from the ledger's originalRequestId/clientId if you ever need to undo, then delete the two new rows the same way.`);
    } catch (err) {
        console.error('[remap-form-split] FAILED:', err);
        process.exit(1);
    } finally {
        await db.end();
    }
}

main();
