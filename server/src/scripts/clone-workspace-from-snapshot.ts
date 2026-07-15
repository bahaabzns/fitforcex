/**
 * Wipes one workspace's data in fitforce.app production and reloads it fresh
 * from the fitforce.io snapshot — a full clone, not an incremental diff.
 *
 * Built for a large, real, already-migrated workspace where post-migration
 * live testing has mixed real edits into real production data, and a clean
 * reset from the snapshot is simpler and faster than surgically isolating
 * individual test edits.
 *
 * Timezone-safe by construction: every timestamp is converted via
 * `AT TIME ZONE 'Africa/Cairo'` directly in the SQL SELECT against the old
 * snapshot, producing a proper timestamptz value before it ever reaches
 * Node — this avoids the bug found in migrate-incremental-catchup.ts, where
 * `new Date(naiveValue)` depended on Node's ambient timezone (UTC on this
 * VPS, vs Africa/Cairo wherever the original historical migration ran).
 *
 * Does NOT touch: the workspace row itself, its owner/members, or
 * exercise_library/food_items (those are per-workspace library clones,
 * already correct and unrelated to this reset).
 *
 * Usage (from server/):
 *   WORKSPACE_ID="cmikc4x4f04y0mi07ty9ypxww" \
 *   PG_OLD_URL="$PG_OLD_URL" DATABASE_URL="$DATABASE_URL" \
 *   npx tsx src/scripts/clone-workspace-from-snapshot.ts
 */

import { Pool } from 'pg';
import { createId } from '@paralleldrive/cuid2';

const OLD_URL = process.env.PG_OLD_URL;
const NEW_URL = process.env.DATABASE_URL;
const WORKSPACE_ID = process.env.WORKSPACE_ID;
if (!OLD_URL) { console.error('PG_OLD_URL is required'); process.exit(1); }
if (!NEW_URL) { console.error('DATABASE_URL is required'); process.exit(1); }
if (!WORKSPACE_ID) { console.error('WORKSPACE_ID is required'); process.exit(1); }

const old = new Pool({ connectionString: OLD_URL });
const newDb = new Pool({ connectionString: NEW_URL });

function log(msg: string) { console.log(`[clone] ${msg}`); }

async function wipeExisting() {
  log('Wiping existing workspace data (dependency order)…');
  await newDb.query(`DELETE FROM form_requests WHERE workspace_id = $1`, [WORKSPACE_ID]); // cascades form_responses
  await newDb.query(`DELETE FROM forms WHERE workspace_id = $1`, [WORKSPACE_ID]); // cascades form_versions, form_version_questions
  await newDb.query(`DELETE FROM nutrition_plans WHERE workspace_id = $1`, [WORKSPACE_ID]); // cascades cycles/meals/items
  await newDb.query(`DELETE FROM training_plans WHERE workspace_id = $1`, [WORKSPACE_ID]); // cascades days/exercises/sets
  await newDb.query(`DELETE FROM transactions WHERE workspace_id = $1`, [WORKSPACE_ID]);
  await newDb.query(`DELETE FROM workout_logs WHERE workspace_id = $1`, [WORKSPACE_ID]);
  await newDb.query(`DELETE FROM messages WHERE thread_id IN (SELECT id FROM threads WHERE workspace_id = $1)`, [WORKSPACE_ID]);
  await newDb.query(`DELETE FROM threads WHERE workspace_id = $1`, [WORKSPACE_ID]);
  await newDb.query(`DELETE FROM client_observations WHERE workspace_id = $1`, [WORKSPACE_ID]);
  await newDb.query(`DELETE FROM clients WHERE workspace_id = $1`, [WORKSPACE_ID]); // cascades measurements/photos/freezes
  log('Wipe complete.');
}

async function cloneClients() {
  const { rows } = await old.query<{
    id: string; fullName: string; email: string | null; phone: string | null;
    phoneCountryCode: string | null; status: string; code: number; password: string | null;
    createdAt: string;
  }>(`
    SELECT id, "fullName", email, phone, "phoneCountryCode", status, code, password, "createdAt" AT TIME ZONE 'Africa/Cairo' AS "createdAt"
    FROM public."Client" WHERE "workspaceId" = $1 AND "deletedAt" IS NULL
  `, [WORKSPACE_ID]);

  for (const c of rows) {
    const idx = c.fullName.trim().indexOf(' ');
    const fname = idx === -1 ? c.fullName.trim() : c.fullName.slice(0, idx).trim();
    const lname = idx === -1 ? '' : c.fullName.slice(idx + 1).trim();
    const phone = c.phoneCountryCode && c.phone ? `${c.phoneCountryCode}${c.phone}` : c.phone;
    await newDb.query(`
      INSERT INTO clients (id, client_code, fname, lname, email, phone, workspace_id, created_at, password, subscription_status)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      ON CONFLICT (id) DO NOTHING
    `, [c.id, c.code, fname.slice(0, 100), lname.slice(0, 100),
        (c.email ?? `client_${c.id}@migrated.local`).slice(0, 150),
        phone ? phone.replace(/\s+/g, '').slice(0, 20) : null,
        WORKSPACE_ID, c.createdAt, c.password, c.status]);
  }
  log(`clients: ${rows.length} cloned`);
}

async function cloneForms() {
  const { rows: templates } = await old.query<{
    id: string; title: string; titleArabic: string | null; type: string;
    questions: unknown; createdAt: string;
  }>(`
    SELECT id, title, "titleArabic", type, questions, "createdAt" AT TIME ZONE 'Africa/Cairo' AS "createdAt"
    FROM public."FormTemplate" WHERE "workspaceId" = $1 AND "deletedAt" IS NULL
  `, [WORKSPACE_ID]);

  const VALID_TYPES = new Set(['text', 'long_text', 'number', 'scale', 'select', 'multiselect', 'date']);
  function mapQuestionType(t?: string): string {
    if (!t) return 'text';
    const n = t.toLowerCase();
    if (n === 'textarea' || n === 'paragraph') return 'long_text';
    if (n === 'numeric' || n === 'integer' || n === 'float') return 'number';
    if (n === 'rating' || n === 'slider') return 'scale';
    if (n === 'dropdown' || n === 'radio' || n === 'choice') return 'select';
    if (n === 'checkbox' || n === 'multi') return 'multiselect';
    if (n === 'datetime') return 'date';
    return VALID_TYPES.has(n) ? n : 'text';
  }

  for (const t of templates) {
    await newDb.query(`
      INSERT INTO forms (id, workspace_id, title_en, title_ar, form_type, status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,'active',$6,$6) ON CONFLICT (id) DO NOTHING
    `, [t.id, WORKSPACE_ID, t.title.slice(0, 255), t.titleArabic?.slice(0, 255) ?? null, t.type, t.createdAt]);

    const versionId = `fv_${t.id}`;
    await newDb.query(`
      INSERT INTO form_versions (id, form_id, version_number, created_at)
      VALUES ($1,$2,1,$3) ON CONFLICT (id) DO NOTHING
    `, [versionId, t.id, t.createdAt]);
    await newDb.query(`UPDATE forms SET current_version_id = $1 WHERE id = $2`, [versionId, t.id]);

    const questions = Array.isArray(t.questions) ? t.questions as Array<{
      id?: string; label?: string; name?: string; text?: string; question?: string;
      type?: string; required?: boolean; options?: unknown; labelArabic?: string; nameArabic?: string;
    }> : [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qId = q.id ?? `${t.id}_q${i}`;
      const label = q.label ?? q.text ?? q.question ?? q.name ?? 'Question';
      await newDb.query(`
        INSERT INTO form_version_questions
          (id, form_version_id, label_en, label_ar, type, required, options, order_index, origin_question_id, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (id) DO NOTHING
      `, [qId, versionId, label.slice(0, 500), q.labelArabic ?? q.nameArabic ?? null,
          mapQuestionType(q.type), q.required ?? false, q.options ? JSON.stringify(q.options) : null, i, qId, t.createdAt]);
    }
  }
  log(`forms: ${templates.length} cloned`);
}

async function cloneFormRequests() {
  const { rows: forms } = await newDb.query<{ id: string; current_version_id: string }>(
    `SELECT id, current_version_id FROM forms WHERE workspace_id = $1`, [WORKSPACE_ID],
  );
  const versionByForm = new Map(forms.map(f => [f.id, f.current_version_id]));

  const { rows: clients } = await newDb.query<{ id: string }>(`SELECT id FROM clients WHERE workspace_id = $1`, [WORKSPACE_ID]);
  const validClients = new Set(clients.map(c => c.id));

  const { rows } = await old.query<{
    id: string; formId: string; clientId: string; answers: Record<string, unknown> | null;
    status: string; scheduleAt: string | null; createdAt: string; updatedAt: string;
  }>(`
    SELECT id, "formId", "clientId", answers, status,
           "scheduleAt" AT TIME ZONE 'Africa/Cairo' AS "scheduleAt",
           "createdAt" AT TIME ZONE 'Africa/Cairo' AS "createdAt",
           "updatedAt" AT TIME ZONE 'Africa/Cairo' AS "updatedAt"
    FROM public."FormSubmission"
    WHERE "workspaceId" = $1 AND "deletedAt" IS NULL AND "clientId" IS NOT NULL AND "formId" IS NOT NULL
  `, [WORKSPACE_ID]);

  let inserted = 0, responseCount = 0;
  for (const r of rows) {
    const versionId = versionByForm.get(r.formId);
    if (!versionId || !validClients.has(r.clientId)) continue;
    await newDb.query(`
      INSERT INTO form_requests (id, form_id, form_version_id, client_id, workspace_id, status, requested_at, submitted_at, scheduled_at, post_action)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'nothing') ON CONFLICT (id) DO NOTHING
    `, [r.id, r.formId, versionId, r.clientId, WORKSPACE_ID, r.status, r.createdAt,
        (r.status === 'submitted' || r.status === 'done') ? r.updatedAt : null, r.scheduleAt]);
    inserted++;

    if (r.answers && typeof r.answers === 'object') {
      const { rows: qIds } = await newDb.query<{ id: string }>(
        `SELECT id FROM form_version_questions WHERE form_version_id = $1`, [versionId],
      );
      const validQ = new Set(qIds.map(q => q.id));
      for (const [questionId, answer] of Object.entries(r.answers)) {
        if (!validQ.has(questionId)) continue;
        await newDb.query(`
          INSERT INTO form_responses (id, request_id, question_id, answer, created_at)
          VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING
        `, [createId(), r.id, questionId, answer == null ? '' : String(answer), r.createdAt]);
        responseCount++;
      }
    }
  }
  log(`form_requests: ${inserted} cloned, ${responseCount} responses`);
}

async function cloneNutritionPlans() {
  const { rows: clients } = await newDb.query<{ id: string }>(`SELECT id FROM clients WHERE workspace_id = $1`, [WORKSPACE_ID]);
  const validClients = new Set(clients.map(c => c.id));

  const { rows: plans } = await old.query<{
    id: string; clientId: string; title: string; status: string;
    createdAt: string; updatedAt: string; activatedAt: string | null;
  }>(`
    SELECT id, "clientId", title, status,
           "createdAt" AT TIME ZONE 'Africa/Cairo' AS "createdAt",
           "updatedAt" AT TIME ZONE 'Africa/Cairo' AS "updatedAt",
           "activatedAt" AT TIME ZONE 'Africa/Cairo' AS "activatedAt"
    FROM public."NutritionPlan" WHERE "workspaceId" = $1 AND "deletedAt" IS NULL
  `, [WORKSPACE_ID]);

  let planCount = 0, cycleCount = 0, mealCount = 0, itemCount = 0;
  for (const p of plans) {
    if (!validClients.has(p.clientId)) continue;
    await newDb.query(`
      INSERT INTO nutrition_plans (id, name, client_id, workspace_id, status, created_at, updated_at, activated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING
    `, [p.id, p.title, p.clientId, WORKSPACE_ID, p.status, p.createdAt, p.updatedAt, p.activatedAt]);
    planCount++;

    const { rows: days } = await old.query<{ id: string; dayIndex: number; label: string | null }>(
      `SELECT id, "dayIndex", label FROM public."NutritionPlanDay" WHERE "planId" = $1 AND "deletedAt" IS NULL`, [p.id],
    );
    for (const d of days) {
      await newDb.query(`
        INSERT INTO nutrition_cycles (id, plan_id, name, cycle_order) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING
      `, [d.id, p.id, d.label || `Day ${d.dayIndex + 1}`, d.dayIndex + 1]);
      cycleCount++;

      const { rows: items } = await old.query<{ id: string; meal: string | null; notes: string | null }>(
        `SELECT id, meal, notes FROM public."NutritionPlanDayItem" WHERE "dayId" = $1 AND "deletedAt" IS NULL ORDER BY "createdAt"`, [d.id],
      );
      for (let i = 0; i < items.length; i++) {
        const m = items[i];
        await newDb.query(`
          INSERT INTO nutrition_meals (id, cycle_id, name, meal_order, note) VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING
        `, [m.id, d.id, m.meal || 'Meal', i + 1, m.notes]);
        mealCount++;

        const { rows: foodItems } = await old.query<{ id: string; foodItemId: string; quantity: number }>(
          `SELECT id, "foodItemId", quantity FROM public."MealFoodItem" WHERE "mealId" = $1 AND "deletedAt" IS NULL ORDER BY "createdAt"`, [m.id],
        );
        for (let j = 0; j < foodItems.length; j++) {
          const fi = foodItems[j];
          const { rows: fExists } = await newDb.query(`SELECT 1 FROM food_items WHERE id = $1`, [fi.foodItemId]);
          if (fExists.length === 0) continue;
          await newDb.query(`
            INSERT INTO nutrition_meal_items (id, meal_id, food_item_id, amount, meal_item_order)
            VALUES ($1,$2,$3,$4,$5) ON CONFLICT (id) DO NOTHING
          `, [fi.id, m.id, fi.foodItemId, fi.quantity, j + 1]);
          itemCount++;
        }
      }
    }
  }
  log(`nutrition_plans: ${planCount} plans, ${cycleCount} cycles, ${mealCount} meals, ${itemCount} items`);
}

async function cloneTrainingPlans() {
  const { rows: clients } = await newDb.query<{ id: string }>(`SELECT id FROM clients WHERE workspace_id = $1`, [WORKSPACE_ID]);
  const validClients = new Set(clients.map(c => c.id));
  const { rows: exLib } = await newDb.query<{ id: string }>(`SELECT id FROM exercise_library WHERE workspace_id = $1`, [WORKSPACE_ID]);
  const validExLib = new Set(exLib.map(e => e.id));

  const { rows: plans } = await old.query<{
    id: string; clientId: string; title: string; status: string;
    createdAt: string; updatedAt: string; activatedAt: string | null;
  }>(`
    SELECT id, "clientId", title, status,
           "createdAt" AT TIME ZONE 'Africa/Cairo' AS "createdAt",
           "updatedAt" AT TIME ZONE 'Africa/Cairo' AS "updatedAt",
           "activatedAt" AT TIME ZONE 'Africa/Cairo' AS "activatedAt"
    FROM public."WorkoutPlan" WHERE "workspaceId" = $1 AND "deletedAt" IS NULL
  `, [WORKSPACE_ID]);

  let planCount = 0, dayCount = 0, exCount = 0, setCount = 0;
  for (const p of plans) {
    if (!validClients.has(p.clientId)) continue;
    await newDb.query(`
      INSERT INTO training_plans (id, name, client_id, workspace_id, status, created_at, updated_at, activated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING
    `, [p.id, p.title, p.clientId, WORKSPACE_ID, p.status === 'active' ? 'active' : 'inactive', p.createdAt, p.updatedAt, p.activatedAt]);
    planCount++;

    const { rows: days } = await old.query<{ id: string; dayIndex: number; label: string | null }>(
      `SELECT id, "dayIndex", label FROM public."WorkoutPlanDay" WHERE "planId" = $1 AND "deletedAt" IS NULL`, [p.id],
    );
    for (const d of days) {
      await newDb.query(`
        INSERT INTO training_days (id, plan_id, name, day_order) VALUES ($1,$2,$3,$4) ON CONFLICT (id) DO NOTHING
      `, [d.id, p.id, d.label || `Day ${d.dayIndex + 1}`, d.dayIndex + 1]);
      dayCount++;

      const { rows: exercises } = await old.query<{
        id: string; exerciseId: string | null; exerciseName: string; notes: string | null;
      }>(`
        SELECT di.id,
               CASE WHEN e.id IS NOT NULL AND e."deletedAt" IS NULL THEN di."exerciseId" ELSE NULL END AS "exerciseId",
               COALESCE(e.name, 'Exercise') AS "exerciseName", di.notes
        FROM public."WorkoutPlanDayItem" di
        LEFT JOIN public."Exercise" e ON e.id = di."exerciseId"
        WHERE di."dayId" = $1 AND di."deletedAt" IS NULL ORDER BY di."createdAt"
      `, [d.id]);
      for (let i = 0; i < exercises.length; i++) {
        const e = exercises[i];
        await newDb.query(`
          INSERT INTO training_exercises (id, day_id, name, exercise_order, exercise_library_id, notes)
          VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING
        `, [e.id, d.id, e.exerciseName, i + 1, e.exerciseId && validExLib.has(e.exerciseId) ? e.exerciseId : null, e.notes]);
        exCount++;

        const { rows: sets } = await old.query<{
          id: string; setIndex: number; repMin: number | null; repMax: number | null;
          rir: number | null; tempo: string | null; restSeconds: number | null;
        }>(`
          SELECT id, "setIndex", "repMin", "repMax", rir, tempo, "restSeconds"
          FROM public."WorkoutPlanSet" WHERE "dayItemId" = $1 AND "deletedAt" IS NULL
        `, [e.id]);
        for (const s of sets) {
          const reps = s.repMin !== null && s.repMax !== null && s.repMin !== s.repMax
            ? `${s.repMin}-${s.repMax}` : s.repMin !== null ? String(s.repMin) : null;
          await newDb.query(`
            INSERT INTO training_sets (id, exercise_id, set_order, reps, rir, tempo, rest_seconds)
            VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING
          `, [s.id, e.id, s.setIndex, reps, s.rir, s.tempo, s.restSeconds]);
          setCount++;
        }
      }
    }
  }
  log(`training_plans: ${planCount} plans, ${dayCount} days, ${exCount} exercises, ${setCount} sets`);
}

async function cloneWorkoutLogs() {
  const { rows: clients } = await newDb.query<{ id: string }>(`SELECT id FROM clients WHERE workspace_id = $1`, [WORKSPACE_ID]);
  const validClients = new Set(clients.map(c => c.id));
  const { rows: plans } = await newDb.query<{ id: string }>(`SELECT id FROM training_plans WHERE workspace_id = $1`, [WORKSPACE_ID]);
  const validPlans = new Set(plans.map(p => p.id));

  const { rows } = await old.query<{
    id: string; clientId: string; planId: string | null; dayIndex: number; date: string;
    startTime: string | null; endTime: string | null; notes: string | null;
    completed: boolean; exercises: unknown; createdAt: string;
  }>(`
    SELECT id, "clientId", "planId", "dayIndex", date, "startTime", "endTime", notes, completed, exercises,
           "createdAt" AT TIME ZONE 'Africa/Cairo' AS "createdAt"
    FROM public."WorkoutLog" WHERE "workspaceId" = $1 AND "deletedAt" IS NULL
  `, [WORKSPACE_ID]);

  let count = 0;
  for (const w of rows) {
    if (!validClients.has(w.clientId)) continue;
    await newDb.query(`
      INSERT INTO workout_logs (id, workspace_id, client_id, plan_id, day_index, date, start_time, end_time, notes, completed, exercises, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) ON CONFLICT (id) DO NOTHING
    `, [w.id, WORKSPACE_ID, w.clientId, w.planId && validPlans.has(w.planId) ? w.planId : null, w.dayIndex, w.date,
        w.startTime, w.endTime, w.notes, w.completed, JSON.stringify(w.exercises), w.createdAt]);
    count++;
  }
  log(`workout_logs: ${count} cloned`);
}

async function cloneTransactions() {
  const { rows: clients } = await newDb.query<{ id: string }>(`SELECT id FROM clients WHERE workspace_id = $1`, [WORKSPACE_ID]);
  const validClients = new Set(clients.map(c => c.id));

  const { rows: maxCodeRows } = await newDb.query<{ max: number | null }>(
    `SELECT max(transaction_code) FROM transactions WHERE workspace_id = $1`, [WORKSPACE_ID],
  );
  let nextCode = (maxCodeRows[0]?.max ?? 0) + 1;

  const { rows } = await old.query<{
    id: string; clientId: string | null; amountCents: number; currency: string;
    status: string; provider: string; createdAt: string;
  }>(`
    SELECT id, "clientId", "amountCents", currency, status, COALESCE(provider, 'manual') AS provider,
           "createdAt" AT TIME ZONE 'Africa/Cairo' AS "createdAt"
    FROM public."Payment" WHERE "workspaceId" = $1 AND "deletedAt" IS NULL AND "clientId" IS NOT NULL
    ORDER BY "createdAt"
  `, [WORKSPACE_ID]);

  let count = 0;
  for (const p of rows) {
    if (!p.clientId || !validClients.has(p.clientId)) continue;
    await newDb.query(`
      INSERT INTO transactions (id, transaction_code, workspace_id, client_id, client_name, payment_method, amount, currency, status, transaction_date, created_at)
      VALUES ($1,$2,$3,$4,'',$5,$6,$7,$8,$9,$9) ON CONFLICT (id) DO NOTHING
    `, [p.id, nextCode++, WORKSPACE_ID, p.clientId, p.provider, p.amountCents / 100, p.currency,
        p.status === 'succeeded' ? 'completed' : p.status, p.createdAt]);
    count++;
  }
  log(`transactions: ${count} cloned`);
}

async function cloneMessages() {
  const { rows: clients } = await newDb.query<{ id: string }>(`SELECT id FROM clients WHERE workspace_id = $1`, [WORKSPACE_ID]);
  const validClients = new Set(clients.map(c => c.id));

  const { rows: threads } = await old.query<{ id: string; clientId: string; status: string; createdAt: string }>(`
    SELECT id, "clientId", status, "createdAt" AT TIME ZONE 'Africa/Cairo' AS "createdAt"
    FROM public."Thread" WHERE "workspaceId" = $1 AND "deletedAt" IS NULL AND "clientId" IS NOT NULL
  `, [WORKSPACE_ID]);

  let threadCount = 0, msgCount = 0;
  for (const t of threads) {
    if (!validClients.has(t.clientId)) continue;
    await newDb.query(`
      INSERT INTO threads (id, workspace_id, client_id, status, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$5) ON CONFLICT (id) DO NOTHING
    `, [t.id, WORKSPACE_ID, t.clientId, t.status, t.createdAt]);
    threadCount++;

    const { rows: msgs } = await old.query<{
      id: string; senderType: string; senderUserId: string | null; senderClientId: string | null;
      body: string; readByTeamAt: string | null; readByClientAt: string | null; createdAt: string;
    }>(`
      SELECT id, "senderType", "senderUserId", "senderClientId", body,
             "readByTeamAt" AT TIME ZONE 'Africa/Cairo' AS "readByTeamAt",
             "readByClientAt" AT TIME ZONE 'Africa/Cairo' AS "readByClientAt",
             "createdAt" AT TIME ZONE 'Africa/Cairo' AS "createdAt"
      FROM public."Message" WHERE "threadId" = $1 AND "deletedAt" IS NULL
    `, [t.id]);
    for (const m of msgs) {
      await newDb.query(`
        INSERT INTO messages (id, thread_id, sender_type, sender_id, body, read_by_team_at, read_by_client_at, created_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT (id) DO NOTHING
      `, [m.id, t.id, m.senderType, m.senderUserId ?? m.senderClientId ?? 'unknown', m.body, m.readByTeamAt, m.readByClientAt, m.createdAt]);
      msgCount++;
    }
  }
  log(`threads: ${threadCount} cloned, messages: ${msgCount} cloned`);
}

async function cloneClientObservations() {
  const { rows: clients } = await newDb.query<{ id: string }>(`SELECT id FROM clients WHERE workspace_id = $1`, [WORKSPACE_ID]);
  const validClients = new Set(clients.map(c => c.id));

  const { rows } = await old.query<{ id: string; clientId: string; authorId: string; content: string; createdAt: string }>(`
    SELECT id, "clientId", "authorId", content, "createdAt" AT TIME ZONE 'Africa/Cairo' AS "createdAt"
    FROM public."ClientObservation" WHERE "workspaceId" = $1 AND "deletedAt" IS NULL
  `, [WORKSPACE_ID]);

  let count = 0;
  for (const o of rows) {
    if (!validClients.has(o.clientId)) continue;
    const { rows: authorExists } = await newDb.query(`SELECT 1 FROM users WHERE id = $1`, [o.authorId]);
    if (authorExists.length === 0) continue;
    await newDb.query(`
      INSERT INTO client_observations (id, workspace_id, client_id, author_id, title, content, created_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (id) DO NOTHING
    `, [o.id, WORKSPACE_ID, o.clientId, o.authorId, o.content.slice(0, 60), o.content, o.createdAt]);
    count++;
  }
  log(`client_observations: ${count} cloned`);
}

async function main() {
  console.time('clone');
  log(`Cloning workspace ${WORKSPACE_ID} from fitforce.io snapshot…`);
  try {
    await wipeExisting();
    await cloneClients();
    await cloneForms();
    await cloneFormRequests();
    await cloneNutritionPlans();
    await cloneTrainingPlans();
    await cloneWorkoutLogs();
    await cloneTransactions();
    await cloneMessages();
    await cloneClientObservations();
    log('Clone complete.');
  } catch (err) {
    console.error('[clone] FAILED:', err);
    process.exit(1);
  } finally {
    await old.end();
    await newDb.end();
    console.timeEnd('clone');
  }
}

main();
