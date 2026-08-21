/**
 * Incremental catch-up migration: fitforce.io → fitforce.app
 *
 * Migrates rows that exist on fitforce.io (a restored snapshot) but are missing from
 * fitforce.app production, across already-migrated workspaces. Complements the original
 * bulk `migrate.ts`/`migrate-phase2.ts`/`migrate-phase3.ts`/`migrate-queue.ts` pipeline —
 * this script only inserts what's genuinely missing (computed fresh from both databases'
 * current state on every run), so it's safe to re-run at any time.
 *
 * Corrects two real issues found in the original pipeline:
 *   - Forms go through forms -> form_versions -> form_version_questions (the current
 *     Forms Versioning schema), never the retired `form_questions` table.
 *   - `forms`/`form_versions` have a circular FK (forms.current_version_id -> form_versions.id,
 *     form_versions.form_id -> forms.id) — forms are inserted first with a null version,
 *     then the version, then forms.current_version_id is updated. Getting this order wrong
 *     produces "insert or update on table forms violates foreign key constraint" — hit and
 *     fixed once already during today's 4-workspace migration.
 *
 * Deliberately NOT touched by this script (out of scope / already handled elsewhere):
 *   - `plans` — never insert from old WorkspacePackage; see the migration doc §6.4/§0.3.
 *   - Any workspace-level conflict (workspace existing on both systems under different ids) —
 *     that was fully enumerated and resolved separately (4 workspaces, already migrated).
 *     This script only adds children under workspaces that already match by id in both systems.
 *   - Notifications, audit logs, admin accounts, PDF templates, food replacement workflow,
 *     promo codes, recipes, tutorial videos, client attachments — no destination table, or
 *     deliberately excluded; unrelated to this pass.
 *
 * Usage (from server/), designed to run ON THE SAME HOST as both databases (this avoids
 * needing a live network path to fitforce.io — PG_OLD_URL points at a locally restored
 * snapshot database):
 *
 *   DRY_RUN=true \
 *   PG_OLD_URL="postgresql:///fitforce_io_snapshot" \
 *   DATABASE_URL="<same as server/.env>" \
 *   npx tsx src/scripts/migrate-incremental-catchup.ts
 *
 *   # then, once the dry-run report looks right, the real run:
 *   PG_OLD_URL="postgresql:///fitforce_io_snapshot" \
 *   DATABASE_URL="<same as server/.env>" \
 *   npx tsx src/scripts/migrate-incremental-catchup.ts
 *
 * If PG_OLD_URL uses peer auth (no host, no password — the `postgresql:///dbname` form),
 * run this script as the `postgres` OS user so peer auth resolves:
 *   sudo -u postgres env DATABASE_URL="$DATABASE_URL" PG_OLD_URL="postgresql:///fitforce_io_snapshot" \
 *     npx tsx src/scripts/migrate-incremental-catchup.ts
 */

import { Pool } from 'pg';
import { PrismaClient } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import bcrypt from 'bcrypt';
import { DEFAULT_PERMISSIONS } from '../lib/defaultPermissions';

const BCRYPT_FORMAT = /^\$2[aby]\$\d{2}\$/;

// fitforce.io stored Client.password as plaintext (unlike User.passwordHash) — hash it
// on the way in so it's usable by bcrypt.compare() on the new platform.
async function hashClientPassword(password: string | null): Promise<string | undefined> {
  if (!password) return undefined;
  if (BCRYPT_FORMAT.test(password)) return password;
  return bcrypt.hash(password, 10);
}

const OLD_URL = process.env.PG_OLD_URL;
if (!OLD_URL) { console.error('PG_OLD_URL is required'); process.exit(1); }

const DRY_RUN = process.env.DRY_RUN === 'true';

const old = new Pool({ connectionString: OLD_URL });
const prisma = new PrismaClient();

const BATCH = 500;

// ─── helpers (same as migrate.ts, for consistency with the original pipeline) ────────────

function splitName(full: string, last?: string | null): { fname: string; lname: string } {
  if (last) return { fname: full.trim(), lname: last.trim() };
  const idx = full.trim().indexOf(' ');
  if (idx === -1) return { fname: full.trim(), lname: '' };
  return { fname: full.slice(0, idx).trim(), lname: full.slice(idx + 1).trim() };
}

const VALID_QUESTION_TYPES = new Set(['text', 'long_text', 'number', 'scale', 'select', 'multiselect', 'date']);
function mapQuestionType(t?: string): string {
  if (!t) return 'text';
  const n = t.toLowerCase();
  if (n === 'textarea' || n === 'long_text' || n === 'paragraph') return 'long_text';
  if (n === 'number' || n === 'numeric' || n === 'integer' || n === 'float') return 'number';
  if (n === 'scale' || n === 'rating' || n === 'slider') return 'scale';
  if (n === 'select' || n === 'dropdown' || n === 'radio' || n === 'choice') return 'select';
  if (n === 'multiselect' || n === 'checkbox' || n === 'multi') return 'multiselect';
  if (n === 'date' || n === 'datetime') return 'date';
  if (VALID_QUESTION_TYPES.has(n)) return n;
  return 'text';
}

function mapRole(oldName: string): string {
  const n = oldName.toLowerCase();
  if (n.includes('trainer') || n.includes('coach')) return 'trainer';
  if (n.includes('nutritionist') || n.includes('nutrition')) return 'nutritionist';
  if (n.includes('receptionist') || n.includes('reception')) return 'receptionist';
  if (n.includes('viewer') || n.includes('view')) return 'viewer';
  return 'manager';
}

async function inBatches<T>(rows: T[], fn: (batch: T[]) => Promise<void>) {
  for (let i = 0; i < rows.length; i += BATCH) {
    if (!DRY_RUN) await fn(rows.slice(i, i + BATCH));
  }
}

function log(msg: string) { console.log(`[catchup] ${msg}`); }

async function existingIds(table: string): Promise<Set<string>> {
  const rows = await (prisma as any)[table].findMany({ select: { id: true } });
  return new Set(rows.map((r: { id: string }) => r.id));
}

// ─── 1. users ─────────────────────────────────────────────────────────────────

async function migrateMissingUsers() {
  const existing = await existingIds('users');
  const { rows } = await old.query<{
    id: string; email: string; passwordHash: string; fullName: string;
    lastName: string | null; phoneNumber: string | null; emailVerified: boolean;
    emailVerificationCode: string | null; verificationCodeExpiresAt: string | null;
    createdAt: string; deletedAt: string | null;
  }>(`
    SELECT id, email, "passwordHash", "fullName", "lastName", "phoneNumber",
           "emailVerified", "emailVerificationCode",
           "emailVerificationCodeExpiresAt" AS "verificationCodeExpiresAt",
           "createdAt", "deletedAt"
    FROM public."User"
    WHERE "deletedAt" IS NULL
  `);

  const missing = rows.filter(u => !existing.has(u.id));
  log(`users: ${rows.length} total, ${missing.length} missing`);
  if (DRY_RUN || missing.length === 0) return;

  await inBatches(missing, async (batch) => {
    await prisma.users.createMany({
      data: batch.map(u => {
        const { fname, lname } = splitName(u.fullName, u.lastName);
        return {
          id: u.id,
          email: u.email.toLowerCase().trim().slice(0, 150),
          password: u.passwordHash,
          fname: fname.slice(0, 100),
          lname: lname.slice(0, 100),
          phone: u.phoneNumber ?? undefined,
          email_verified: u.emailVerified,
          email_verification_code: u.emailVerificationCode ?? undefined,
          verification_code_expires_at: u.verificationCodeExpiresAt ? new Date(u.verificationCodeExpiresAt) : undefined,
          created_at: new Date(u.createdAt),
        };
      }),
      skipDuplicates: true,
    });
  });
  log(`users: inserted ${missing.length}`);
}

// ─── 2. workspace_members ───────────────────────────────────────────────────────

async function migrateMissingWorkspaceMembers() {
  const existing = await existingIds('workspace_members');
  const validWorkspaces = await existingIds('workspaces');
  const validUsers = await existingIds('users');

  const { rows } = await old.query<{
    id: string; workspaceId: string; userId: string; roleName: string; createdAt: string;
  }>(`
    SELECT wm.id, wm."workspaceId", wm."userId",
           COALESCE(r.name, 'member') AS "roleName", wm."createdAt"
    FROM public."WorkspaceMember" wm
    LEFT JOIN public."Role" r ON r.id = wm."roleId"
    WHERE wm."deletedAt" IS NULL
  `);

  const missing = rows.filter(m => !existing.has(m.id));
  const valid = missing.filter(m => validWorkspaces.has(m.workspaceId) && validUsers.has(m.userId));
  const skipped = missing.length - valid.length;
  log(`workspace_members: ${rows.length} total, ${missing.length} missing, ${valid.length} valid, ${skipped} skipped (orphaned workspace/user)`);
  if (DRY_RUN || valid.length === 0) return;

  await inBatches(valid, async (batch) => {
    await prisma.workspace_members.createMany({
      data: batch.map(m => {
        const role = mapRole(m.roleName);
        return {
          id: m.id,
          workspace_id: m.workspaceId,
          user_id: m.userId,
          role,
          permissions: DEFAULT_PERMISSIONS[role] ?? {},
          joined_at: new Date(m.createdAt),
        };
      }),
      skipDuplicates: true,
    });
  });
  log(`workspace_members: inserted ${valid.length}`);
}

// ─── 3. clients ─────────────────────────────────────────────────────────────────

async function migrateMissingClients() {
  const existing = await existingIds('clients');
  const validWorkspaces = await existingIds('workspaces');

  const { rows } = await old.query<{
    id: string; workspaceId: string; fullName: string; email: string | null;
    phone: string | null; phoneCountryCode: string | null; status: string;
    code: number; password: string | null; createdAt: string;
  }>(`
    SELECT id, "workspaceId", "fullName", email, phone, "phoneCountryCode",
           status, code, password, "createdAt"
    FROM public."Client"
    WHERE "deletedAt" IS NULL
  `);

  const missing = rows.filter(c => !existing.has(c.id));
  const valid = missing.filter(c => validWorkspaces.has(c.workspaceId));
  const skipped = missing.length - valid.length;
  log(`clients: ${rows.length} total, ${missing.length} missing, ${valid.length} valid, ${skipped} skipped (orphaned workspace)`);
  if (DRY_RUN || valid.length === 0) return;

  // createMany + skipDuplicates also naturally absorbs a client whose (workspace_id, email)
  // or (workspace_id, client_code) collides with a client already in that workspace from the
  // original migration — logged as a smaller-than-expected insert count, not a crash.
  let inserted = 0;
  await inBatches(valid, async (batch) => {
    const data = await Promise.all(batch.map(async c => {
      const { fname, lname } = splitName(c.fullName);
      const phone = c.phoneCountryCode && c.phone ? `${c.phoneCountryCode}${c.phone}` : c.phone ?? undefined;
      return {
        id: c.id,
        workspace_id: c.workspaceId,
        fname: fname.slice(0, 100),
        lname: lname.slice(0, 100),
        email: (c.email ?? `client_${c.id}@migrated.local`).slice(0, 150),
        phone: phone ? phone.replace(/\s+/g, '').slice(0, 20) : undefined,
        subscription_status: c.status,
        client_code: c.code,
        password: await hashClientPassword(c.password),
        created_at: new Date(c.createdAt),
      };
    }));
    const result = await prisma.clients.createMany({
      data,
      skipDuplicates: true,
    });
    inserted += result.count;
  });
  log(`clients: attempted ${valid.length}, actually inserted ${DRY_RUN ? 0 : inserted} (difference = workspace-scoped email/code collisions, skipped cleanly)`);
}

// ─── 4. client_observations ─────────────────────────────────────────────────────

async function migrateMissingClientObservations() {
  const existing = await existingIds('client_observations');
  const validClients = await existingIds('clients');
  const validUsers = await existingIds('users');

  const { rows } = await old.query<{
    id: string; workspaceId: string; clientId: string; authorId: string;
    content: string; createdAt: string;
  }>(`
    SELECT id, "workspaceId", "clientId", "authorId", content, "createdAt"
    FROM public."ClientObservation"
    WHERE "deletedAt" IS NULL
  `);

  const missing = rows.filter(o => !existing.has(o.id));
  const valid = missing.filter(o => validClients.has(o.clientId) && validUsers.has(o.authorId));
  log(`client_observations: ${rows.length} total, ${missing.length} missing, ${valid.length} valid`);
  if (DRY_RUN || valid.length === 0) return;

  await inBatches(valid, async (batch) => {
    await prisma.client_observations.createMany({
      data: batch.map(o => ({
        id: o.id,
        workspace_id: o.workspaceId,
        client_id: o.clientId,
        author_id: o.authorId,
        title: o.content.slice(0, 60),
        content: o.content,
        created_at: new Date(o.createdAt),
      })),
      skipDuplicates: true,
    });
  });
  log(`client_observations: inserted ${valid.length}`);
}

// ─── 5. forms + form_versions + form_version_questions ─────────────────────────

async function migrateMissingForms() {
  const existing = await existingIds('forms');
  const validWorkspaces = await existingIds('workspaces');

  const { rows: templates } = await old.query<{
    id: string; workspaceId: string; title: string; titleArabic: string | null;
    type: string; questions: unknown; createdAt: string;
  }>(`
    SELECT id, "workspaceId", title, "titleArabic", type, questions, "createdAt"
    FROM public."FormTemplate"
    WHERE "deletedAt" IS NULL
  `);

  const missing = templates.filter(t => !existing.has(t.id));
  const valid = missing.filter(t => validWorkspaces.has(t.workspaceId));
  log(`forms: ${templates.length} total, ${missing.length} missing, ${valid.length} valid`);
  if (DRY_RUN || valid.length === 0) return;

  // Step 1: forms WITHOUT current_version_id — forms/form_versions have a circular FK,
  // this ordering is the fix for the bug hit during today's 4-workspace migration.
  await inBatches(valid, async (batch) => {
    await prisma.forms.createMany({
      data: batch.map(t => ({
        id: t.id,
        workspace_id: t.workspaceId,
        title_en: t.title.slice(0, 255),
        title_ar: t.titleArabic ? t.titleArabic.slice(0, 255) : undefined,
        form_type: t.type,
        status: 'active',
        created_at: new Date(t.createdAt),
        updated_at: new Date(t.createdAt),
      })),
      skipDuplicates: true,
    });
  });

  // Step 2: one form_versions row per form, unsealed (never submitted against yet — any
  // historical submissions get sealed retroactively via requested_at in migrateMissingFormRequests
  // if needed; kept simple/unsealed here since sealing is a best-effort provenance detail).
  const versionIdByForm = new Map<string, string>();
  for (const t of valid) versionIdByForm.set(t.id, `fv_${t.id}`);

  await inBatches(valid, async (batch) => {
    await prisma.form_versions.createMany({
      data: batch.map(t => ({
        id: versionIdByForm.get(t.id)!,
        form_id: t.id,
        version_number: 1,
        sealed_at: undefined,
        created_at: new Date(t.createdAt),
      })),
      skipDuplicates: true,
    });
  });

  // Step 3: point forms.current_version_id back at the version just created.
  for (const t of valid) {
    await prisma.forms.update({
      where: { id: t.id },
      data: { current_version_id: versionIdByForm.get(t.id)! },
    });
  }

  // Step 4: expand each form's questions JSON into form_version_questions.
  const allQuestions: Array<{
    id: string; form_version_id: string; label_en: string; label_ar: string | null;
    type: string; required: boolean; options: unknown; order_index: number;
    origin_question_id: string; created_at: Date;
  }> = [];

  for (const t of valid) {
    const versionId = versionIdByForm.get(t.id)!;
    const questions = Array.isArray(t.questions) ? t.questions as Array<{
      id?: string; label?: string; name?: string; text?: string; question?: string;
      type?: string; required?: boolean; options?: unknown; labelArabic?: string; nameArabic?: string;
    }> : [];
    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      const qId = q.id ?? `${t.id}_q${i}`;
      const label = q.label ?? q.text ?? q.question ?? q.name ?? 'Question';
      allQuestions.push({
        id: qId,
        form_version_id: versionId,
        label_en: label.slice(0, 500),
        label_ar: q.labelArabic ?? q.nameArabic ?? null,
        type: mapQuestionType(q.type),
        required: q.required ?? false,
        options: q.options ?? undefined,
        order_index: i,
        origin_question_id: qId,
        created_at: new Date(t.createdAt),
      });
    }
  }

  await inBatches(allQuestions, async (batch) => {
    await prisma.form_version_questions.createMany({ data: batch, skipDuplicates: true });
  });

  log(`forms: inserted ${valid.length} forms, ${valid.length} versions, ${allQuestions.length} questions`);
}

// ─── 6. form_requests + form_responses ─────────────────────────────────────────

async function migrateMissingFormRequests() {
  const existing = await existingIds('form_requests');
  const validForms = await prisma.forms.findMany({ select: { id: true, current_version_id: true } });
  const formVersionById = new Map(validForms.filter(f => f.current_version_id).map(f => [f.id, f.current_version_id!]));
  const validClients = await existingIds('clients');

  const { rows } = await old.query<{
    id: string; workspaceId: string; formId: string; clientId: string;
    answers: Record<string, unknown> | null; status: string;
    scheduleAt: string | null; createdAt: string; updatedAt: string;
  }>(`
    SELECT id, "workspaceId", "formId", "clientId", answers, status,
           "scheduleAt", "createdAt", "updatedAt"
    FROM public."FormSubmission"
    WHERE "deletedAt" IS NULL AND "clientId" IS NOT NULL AND "formId" IS NOT NULL
  `);

  const missing = rows.filter(r => !existing.has(r.id));
  const valid = missing.filter(r => formVersionById.has(r.formId) && validClients.has(r.clientId));
  const skipped = missing.length - valid.length;
  log(`form_requests: ${rows.length} total, ${missing.length} missing, ${valid.length} valid, ${skipped} skipped (form/client not present)`);
  if (DRY_RUN || valid.length === 0) return;

  await inBatches(valid, async (batch) => {
    await prisma.form_requests.createMany({
      data: batch.map(r => ({
        id: r.id,
        form_id: r.formId,
        form_version_id: formVersionById.get(r.formId)!,
        client_id: r.clientId,
        workspace_id: r.workspaceId,
        status: r.status,
        requested_at: new Date(r.createdAt),
        submitted_at: (r.status === 'submitted' || r.status === 'done') ? new Date(r.updatedAt) : undefined,
        scheduled_at: r.scheduleAt ? new Date(r.scheduleAt) : undefined,
        post_action: 'nothing',
      })),
      skipDuplicates: true,
    });
  });

  // Expand answers -> form_responses, matched by QUESTION ID (the jsonb key itself), not
  // position — `answers` is jsonb, and Postgres does not guarantee jsonb key order is
  // preserved (only `json` guarantees that). form_version_questions.id equals the original
  // question's own id string for every form (migration 036's id-preserving backfill for
  // existing forms; migrateMissingForms() above sets the same convention for new ones), so
  // matching by key is both correct and simpler — same approach migrate-queue.ts already uses.
  const questionIdsByVersion = new Map<string, Set<string>>();
  for (const versionId of new Set(formVersionById.values())) {
    const qs = await prisma.form_version_questions.findMany({
      where: { form_version_id: versionId },
      select: { id: true },
    });
    questionIdsByVersion.set(versionId, new Set(qs.map(q => q.id)));
  }

  const allResponses: Array<{ id: string; request_id: string; question_id: string; answer: string; created_at: Date }> = [];
  for (const r of valid) {
    if (!r.answers || typeof r.answers !== 'object') continue;
    const versionId = formVersionById.get(r.formId)!;
    const validQuestionIds = questionIdsByVersion.get(versionId);
    for (const [questionId, answer] of Object.entries(r.answers)) {
      if (!validQuestionIds || !validQuestionIds.has(questionId)) continue; // stale/unknown question id — skip rather than guess
      allResponses.push({
        id: createId(),
        request_id: r.id,
        question_id: questionId,
        answer: answer == null ? '' : String(answer),
        created_at: new Date(r.createdAt),
      });
    }
  }

  await inBatches(allResponses, async (batch) => {
    await prisma.form_responses.createMany({ data: batch, skipDuplicates: true });
  });

  log(`form_requests: inserted ${valid.length} requests, ${allResponses.length} responses`);
}

// ─── 7. threads + messages ───────────────────────────────────────────────────────

async function migrateMissingMessages() {
  const existingThreads = await existingIds('threads');
  const validWorkspaces = await existingIds('workspaces');
  const validClients = await existingIds('clients');

  const { rows: threadRows } = await old.query<{
    id: string; workspaceId: string; clientId: string; status: string; createdAt: string;
  }>(`
    SELECT id, "workspaceId", "clientId", status, "createdAt"
    FROM public."Thread"
    WHERE "deletedAt" IS NULL AND "clientId" IS NOT NULL
  `);

  const missingThreads = threadRows.filter(t => !existingThreads.has(t.id));
  const validThreads = missingThreads.filter(t => validWorkspaces.has(t.workspaceId) && validClients.has(t.clientId));
  log(`threads: ${threadRows.length} total, ${missingThreads.length} missing, ${validThreads.length} valid`);
  if (!DRY_RUN && validThreads.length > 0) {
    await inBatches(validThreads, async (batch) => {
      await prisma.threads.createMany({
        data: batch.map(t => ({
          id: t.id, workspace_id: t.workspaceId, client_id: t.clientId,
          status: t.status, created_at: new Date(t.createdAt), updated_at: new Date(t.createdAt),
        })),
        skipDuplicates: true,
      });
    });
  }

  const existingMessages = await existingIds('messages');
  const validThreadIds = new Set([...existingThreads, ...validThreads.map(t => t.id)]);

  const { rows: msgRows } = await old.query<{
    id: string; threadId: string; senderType: string;
    senderUserId: string | null; senderClientId: string | null; body: string;
    readByTeamAt: string | null; readByClientAt: string | null; createdAt: string;
  }>(`
    SELECT id, "threadId", "senderType", "senderUserId", "senderClientId",
           body, "readByTeamAt", "readByClientAt", "createdAt"
    FROM public."Message"
    WHERE "deletedAt" IS NULL
  `);

  const missingMsgs = msgRows.filter(m => !existingMessages.has(m.id));
  const validMsgs = missingMsgs.filter(m => validThreadIds.has(m.threadId));
  log(`messages: ${msgRows.length} total, ${missingMsgs.length} missing, ${validMsgs.length} valid`);
  if (DRY_RUN || validMsgs.length === 0) return;

  await inBatches(validMsgs, async (batch) => {
    await prisma.messages.createMany({
      data: batch.map(m => ({
        id: m.id,
        thread_id: m.threadId,
        sender_type: m.senderType,
        sender_id: m.senderUserId ?? m.senderClientId ?? 'unknown',
        body: m.body,
        read_by_team_at: m.readByTeamAt ? new Date(m.readByTeamAt) : undefined,
        read_by_client_at: m.readByClientAt ? new Date(m.readByClientAt) : undefined,
        created_at: new Date(m.createdAt),
      })),
      skipDuplicates: true,
    });
  });
  log(`messages: inserted ${validMsgs.length}`);
}

// ─── 8. nutrition_plans + cycles + meals + meal items ───────────────────────────

async function migrateMissingNutritionPlans() {
  const existingPlans = await existingIds('nutrition_plans');
  const validWorkspaces = await existingIds('workspaces');
  const validClients = await existingIds('clients');

  const { rows: plans } = await old.query<{
    id: string; workspaceId: string; clientId: string; title: string; status: string;
    createdAt: string; updatedAt: string; activatedAt: string | null;
  }>(`
    SELECT id, "workspaceId", "clientId", title, status, "createdAt", "updatedAt", "activatedAt"
    FROM public."NutritionPlan"
    WHERE "deletedAt" IS NULL
  `);
  const missingPlans = plans.filter(p => !existingPlans.has(p.id));
  const validPlans = missingPlans.filter(p => validWorkspaces.has(p.workspaceId) && validClients.has(p.clientId));
  log(`nutrition_plans: ${plans.length} total, ${missingPlans.length} missing, ${validPlans.length} valid`);
  if (!DRY_RUN && validPlans.length > 0) {
    await inBatches(validPlans, async (batch) => {
      await prisma.nutrition_plans.createMany({
        data: batch.map(p => ({
          id: p.id, name: p.title, workspace_id: p.workspaceId, client_id: p.clientId,
          status: p.status, created_at: new Date(p.createdAt), updated_at: new Date(p.updatedAt),
          activated_at: p.activatedAt ? new Date(p.activatedAt) : undefined,
        })),
        skipDuplicates: true,
      });
    });
  }

  const existingCycles = await existingIds('nutrition_cycles');
  const validPlanIds = new Set([...existingPlans, ...validPlans.map(p => p.id)]);

  const { rows: days } = await old.query<{ id: string; planId: string; dayIndex: number; label: string | null }>(`
    SELECT id, "planId", "dayIndex", label FROM public."NutritionPlanDay" WHERE "deletedAt" IS NULL
  `);
  const missingDays = days.filter(d => !existingCycles.has(d.id));
  const validDays = missingDays.filter(d => validPlanIds.has(d.planId));
  log(`nutrition_cycles: ${days.length} total, ${missingDays.length} missing, ${validDays.length} valid`);
  if (!DRY_RUN && validDays.length > 0) {
    await inBatches(validDays, async (batch) => {
      await prisma.nutrition_cycles.createMany({
        data: batch.map(d => ({ id: d.id, plan_id: d.planId, name: d.label || `Day ${d.dayIndex + 1}`, cycle_order: d.dayIndex + 1 })),
        skipDuplicates: true,
      });
    });
  }

  const existingMeals = await existingIds('nutrition_meals');
  const validDayIds = new Set([...existingCycles, ...validDays.map(d => d.id)]);

  const { rows: dayItems } = await old.query<{
    id: string; dayId: string; meal: string | null; notes: string | null; mealOrder: number;
  }>(`
    SELECT id, "dayId", meal, notes,
           ROW_NUMBER() OVER (PARTITION BY "dayId" ORDER BY "createdAt") AS "mealOrder"
    FROM public."NutritionPlanDayItem" WHERE "deletedAt" IS NULL
  `);
  const missingItems = dayItems.filter(i => !existingMeals.has(i.id));
  const validItems = missingItems.filter(i => validDayIds.has(i.dayId));
  log(`nutrition_meals: ${dayItems.length} total, ${missingItems.length} missing, ${validItems.length} valid`);
  if (!DRY_RUN && validItems.length > 0) {
    await inBatches(validItems, async (batch) => {
      await prisma.nutrition_meals.createMany({
        data: batch.map(m => ({ id: m.id, cycle_id: m.dayId, name: m.meal || 'Meal', meal_order: Number(m.mealOrder), note: m.notes ?? undefined })),
        skipDuplicates: true,
      });
    });
  }

  const existingMealItems = await existingIds('nutrition_meal_items');
  const validMealIds = new Set([...existingMeals, ...validItems.map(i => i.id)]);
  const validFoodItems = await existingIds('food_items');

  const { rows: mealItems } = await old.query<{
    id: string; mealId: string; foodItemId: string; quantity: number; itemOrder: number;
  }>(`
    SELECT id, "mealId", "foodItemId", quantity,
           ROW_NUMBER() OVER (PARTITION BY "mealId" ORDER BY "createdAt") AS "itemOrder"
    FROM public."MealFoodItem" WHERE "deletedAt" IS NULL
  `);
  const missingMealItems = mealItems.filter(i => !existingMealItems.has(i.id));
  const validMealItemRows = missingMealItems.filter(i => validMealIds.has(i.mealId) && validFoodItems.has(i.foodItemId));
  log(`nutrition_meal_items: ${mealItems.length} total, ${missingMealItems.length} missing, ${validMealItemRows.length} valid`);
  if (DRY_RUN || validMealItemRows.length === 0) return;

  await inBatches(validMealItemRows, async (batch) => {
    await prisma.nutrition_meal_items.createMany({
      data: batch.map(i => ({ id: i.id, meal_id: i.mealId, food_item_id: i.foodItemId, amount: i.quantity, meal_item_order: Number(i.itemOrder) })),
      skipDuplicates: true,
    });
  });
  log(`nutrition_plans chain: inserted ${validPlans.length} plans, ${validDays.length} cycles, ${validItems.length} meals, ${validMealItemRows.length} meal items`);
}

// ─── 9. training_plans + days + exercises + sets ────────────────────────────────

async function migrateMissingTrainingPlans() {
  const existingPlans = await existingIds('training_plans');
  const validWorkspaces = await existingIds('workspaces');
  const validClients = await existingIds('clients');

  // .io's duration/cardio data lives entirely on WorkoutPlanDayItem
  // (isCardio, durationSeconds, sets), per-usage rather than per-exercise-
  // definition -- Exercise.isCardio is frequently false even for genuinely
  // cardio exercises. See backfill-cardio-tracking-type.ts for the
  // historical fix this complements; this set drives the same "does any
  // usage mark this exercise as cardio" signal for new exercise_library
  // inserts below.
  const { rows: cardioExerciseRows } = await old.query<{ exercise_id: string }>(`
    SELECT DISTINCT e.id AS exercise_id
    FROM public."WorkoutPlanDayItem" di
    JOIN public."Exercise" e ON e.id = di."exerciseId"
    WHERE di."deletedAt" IS NULL AND di."isCardio" = true AND e."deletedAt" IS NULL
  `);
  const cardioExerciseIds = new Set(cardioExerciseRows.map(r => r.exercise_id));

  const { rows: plans } = await old.query<{
    id: string; workspaceId: string; clientId: string; title: string; status: string;
    createdAt: string; updatedAt: string; activatedAt: string | null;
  }>(`
    SELECT id, "workspaceId", "clientId", title, status, "createdAt", "updatedAt", "activatedAt"
    FROM public."WorkoutPlan" WHERE "deletedAt" IS NULL
  `);
  const missingPlans = plans.filter(p => !existingPlans.has(p.id));
  const validPlans = missingPlans.filter(p => validWorkspaces.has(p.workspaceId) && validClients.has(p.clientId));
  log(`training_plans: ${plans.length} total, ${missingPlans.length} missing, ${validPlans.length} valid`);
  if (!DRY_RUN && validPlans.length > 0) {
    await inBatches(validPlans, async (batch) => {
      await prisma.training_plans.createMany({
        data: batch.map(p => ({
          id: p.id, name: p.title, workspace_id: p.workspaceId, client_id: p.clientId,
          status: p.status === 'active' ? 'active' : 'inactive',
          created_at: new Date(p.createdAt), updated_at: new Date(p.updatedAt),
          activated_at: p.activatedAt ? new Date(p.activatedAt) : undefined,
        })),
        skipDuplicates: true,
      });
    });
  }

  const existingDays = await existingIds('training_days');
  const validPlanIds = new Set([...existingPlans, ...validPlans.map(p => p.id)]);

  const { rows: days } = await old.query<{ id: string; planId: string; dayIndex: number; label: string | null }>(`
    SELECT id, "planId", "dayIndex", label FROM public."WorkoutPlanDay" WHERE "deletedAt" IS NULL
  `);
  const missingDays = days.filter(d => !existingDays.has(d.id));
  const validDays = missingDays.filter(d => validPlanIds.has(d.planId));
  log(`training_days: ${days.length} total, ${missingDays.length} missing, ${validDays.length} valid`);
  if (!DRY_RUN && validDays.length > 0) {
    await inBatches(validDays, async (batch) => {
      await prisma.training_days.createMany({
        data: batch.map(d => ({ id: d.id, plan_id: d.planId, name: d.label || `Day ${d.dayIndex + 1}`, day_order: d.dayIndex + 1 })),
        skipDuplicates: true,
      });
    });
  }

  // Reconcile: .io regenerates WorkoutPlanDay ids whenever a coach re-saves a
  // plan there (delete-and-recreate), so an already-caught-up plan can show
  // up here again under entirely new day ids. Without this, the previous,
  // now-superseded copy of the day tree just sits alongside the new one,
  // doubling the visible day count -- see backfill-duplicate-training-days.ts
  // for the one-time historical cleanup this preventive fix complements.
  // Only plans that already existed before this run are checked (a plan
  // inserted moments ago in this same run can't have a stale prior copy).
  // training_exercises/training_sets/training_exercise_alternatives cascade;
  // workout_logs.day_id is ON DELETE SET NULL (the log itself is preserved).
  const liveDayIdsByPlan = new Map<string, Set<string>>();
  for (const d of days) {
    if (!liveDayIdsByPlan.has(d.planId)) liveDayIdsByPlan.set(d.planId, new Set());
    liveDayIdsByPlan.get(d.planId)!.add(d.id);
  }
  const plansToReconcile = plans.filter(p => existingPlans.has(p.id));
  if (plansToReconcile.length > 0) {
    const prodDays = await prisma.training_days.findMany({
      where: { plan_id: { in: plansToReconcile.map(p => p.id) } },
      select: { id: true, plan_id: true },
    });
    const staleDayIds = prodDays
      .filter(d => !liveDayIdsByPlan.get(d.plan_id)?.has(d.id))
      .map(d => d.id);
    log(`training_days: ${staleDayIds.length} stale row(s) superseded by a later .io re-save${DRY_RUN ? ' (dry run)' : ''}`);
    if (!DRY_RUN && staleDayIds.length > 0) {
      await prisma.training_days.deleteMany({ where: { id: { in: staleDayIds } } });
    }
  }

  // exercise_library is otherwise never touched by this script -- only read
  // to link training_exercises.exercise_library_id. The table was populated
  // once per workspace by migrate.ts's original bulk clone of the WHOLE
  // library (preserving old Exercise.id as its own id); any exercise a coach
  // adds in .io afterward was never inserted under any id, so it could never
  // link -- whether or not it's used in a plan yet. See
  // backfill-missing-exercise-library.ts for the one-time historical fix
  // this complements. Matches migrate.ts's scope: the whole library per
  // workspace, not just plan-referenced exercises.
  const existingLibrary = await existingIds('exercise_library');
  const { rows: libraryExercises } = await old.query<{
    id: string; workspaceId: string; name: string; nameArabic: string | null;
    muscleGroup: string; equipmentNeeded: string | null; videoUrl: string | null;
    gifImage: string | null; createdAt: string;
  }>(`
    SELECT id, "workspaceId", name, "nameArabic", "muscleGroup", "equipmentNeeded", "videoUrl", "gifImage", "createdAt"
    FROM public."Exercise" WHERE "deletedAt" IS NULL
  `);
  const missingLibrary = libraryExercises.filter(e => !existingLibrary.has(e.id) && validWorkspaces.has(e.workspaceId));
  log(`exercise_library: ${libraryExercises.length} total, ${missingLibrary.length} missing`);
  if (!DRY_RUN && missingLibrary.length > 0) {
    await inBatches(missingLibrary, async (batch) => {
      await prisma.exercise_library.createMany({
        data: batch.map(e => ({
          id: e.id, workspace_id: e.workspaceId, name_en: e.name, name_ar: e.nameArabic ?? undefined,
          muscle_group: e.muscleGroup, equipment: e.equipmentNeeded ?? undefined,
          youtube_url: e.videoUrl ?? undefined, thumbnail_path: e.gifImage ?? undefined,
          tracking_type: cardioExerciseIds.has(e.id) ? 'time_based' : undefined,
          tracked_metrics: cardioExerciseIds.has(e.id) ? ['duration_seconds'] : undefined,
          created_at: new Date(e.createdAt), updated_at: new Date(e.createdAt),
        })),
        skipDuplicates: true,
      });
    });
  }

  const existingExercises = await existingIds('training_exercises');
  const validDayIds = new Set([...existingDays, ...validDays.map(d => d.id)]);
  const validExerciseLibrary = new Set([...existingLibrary, ...missingLibrary.map(e => e.id)]);

  const { rows: exercises } = await old.query<{
    id: string; dayId: string; exerciseId: string | null; exerciseName: string;
    notes: string | null; exerciseOrder: number;
  }>(`
    SELECT di.id, di."dayId",
           CASE WHEN e.id IS NOT NULL AND e."deletedAt" IS NULL THEN di."exerciseId" ELSE NULL END AS "exerciseId",
           COALESCE(e.name, 'Exercise') AS "exerciseName", di.notes,
           ROW_NUMBER() OVER (PARTITION BY di."dayId" ORDER BY di."createdAt") AS "exerciseOrder"
    FROM public."WorkoutPlanDayItem" di
    LEFT JOIN public."Exercise" e ON e.id = di."exerciseId"
    WHERE di."deletedAt" IS NULL
  `);
  const missingExercises = exercises.filter(e => !existingExercises.has(e.id));
  const validExercisesRows = missingExercises.filter(e => validDayIds.has(e.dayId));
  log(`training_exercises: ${exercises.length} total, ${missingExercises.length} missing, ${validExercisesRows.length} valid`);
  if (!DRY_RUN && validExercisesRows.length > 0) {
    await inBatches(validExercisesRows, async (batch) => {
      await prisma.training_exercises.createMany({
        data: batch.map(e => ({
          id: e.id, day_id: e.dayId, name: e.exerciseName, exercise_order: Number(e.exerciseOrder),
          exercise_library_id: e.exerciseId && validExerciseLibrary.has(e.exerciseId) ? e.exerciseId : undefined,
          notes: e.notes ?? undefined,
        })),
        skipDuplicates: true,
      });
    });
  }

  const existingSets = await existingIds('training_sets');
  const validExerciseIds = new Set([...existingExercises, ...validExercisesRows.map(e => e.id)]);

  const { rows: sets } = await old.query<{
    id: string; dayItemId: string; setIndex: number; repMin: number | null; repMax: number | null;
    rir: number | null; tempo: string | null; restSeconds: number | null;
  }>(`
    SELECT id, "dayItemId", "setIndex", "repMin", "repMax", rir, tempo, "restSeconds"
    FROM public."WorkoutPlanSet" WHERE "deletedAt" IS NULL
  `);
  const missingSets = sets.filter(s => !existingSets.has(s.id));
  const validSets = missingSets.filter(s => validExerciseIds.has(s.dayItemId));
  log(`training_sets: ${sets.length} total, ${missingSets.length} missing, ${validSets.length} valid`);
  if (!DRY_RUN && validSets.length > 0) {
    await inBatches(validSets, async (batch) => {
      await prisma.training_sets.createMany({
        data: batch.map(s => {
          const reps = s.repMin !== null && s.repMax !== null && s.repMin !== s.repMax
            ? `${s.repMin}-${s.repMax}` : s.repMin !== null ? String(s.repMin) : null;
          return {
            id: s.id, exercise_id: s.dayItemId, set_order: s.setIndex,
            reps: reps ?? undefined, rir: s.rir ?? undefined, tempo: s.tempo ?? undefined,
            rest_seconds: s.restSeconds ?? undefined,
          };
        }),
        skipDuplicates: true,
      });
    });
  }

  // Cardio/duration items never have a granular WorkoutPlanSet row in .io at
  // all -- their prescription lives entirely on the WorkoutPlanDayItem
  // itself (isCardio, durationSeconds, sets count). Synthesize `sets` rows
  // of training_sets (duration_seconds only) for any such item that's newly
  // valid this run and still has zero sets. See
  // backfill-cardio-tracking-type.ts for the historical equivalent.
  const { rows: cardioItems } = await old.query<{ id: string; sets: number; durationSeconds: number | null }>(`
    SELECT id, sets, "durationSeconds" FROM public."WorkoutPlanDayItem"
    WHERE "deletedAt" IS NULL AND "isCardio" = true AND "durationSeconds" IS NOT NULL AND sets > 0
  `);
  const cardioItemsValid = cardioItems.filter(c => validExerciseIds.has(c.id));
  const hasSets = await prisma.training_sets.findMany({
    where: { exercise_id: { in: cardioItemsValid.map(c => c.id) } },
    select: { exercise_id: true },
    distinct: ['exercise_id'],
  });
  const hasSetsIds = new Set(hasSets.map(r => r.exercise_id));
  const cardioToBackfill = cardioItemsValid.filter(c => !hasSetsIds.has(c.id));
  const cardioSetsToInsert = cardioToBackfill.flatMap(c =>
    Array.from({ length: c.sets }, (_, i) => ({
      id: createId(), exercise_id: c.id, set_order: i + 1, duration_seconds: c.durationSeconds,
    }))
  );
  log(`training_sets (cardio): ${cardioToBackfill.length} item(s) needing synthesized sets, ${cardioSetsToInsert.length} set row(s)`);
  if (!DRY_RUN && cardioSetsToInsert.length > 0) {
    await inBatches(cardioSetsToInsert, async (batch) => {
      await prisma.training_sets.createMany({ data: batch, skipDuplicates: true });
    });
  }

  log(`training_plans chain: inserted ${validPlans.length} plans, ${validDays.length} days, ${validExercisesRows.length} exercises, ${validSets.length} sets, ${cardioSetsToInsert.length} cardio sets`);
}

// ─── 10. workout_logs ───────────────────────────────────────────────────────────

async function migrateMissingWorkoutLogs() {
  const existing = await existingIds('workout_logs');
  const validClients = await existingIds('clients');
  const validWorkspaces = await existingIds('workspaces');
  const validPlans = await existingIds('training_plans');

  const { rows } = await old.query<{
    id: string; workspaceId: string; clientId: string; planId: string | null;
    dayIndex: number; date: string; startTime: string | null; endTime: string | null;
    notes: string | null; completed: boolean; exercises: unknown; createdAt: string;
  }>(`
    SELECT wl.id, wl."workspaceId", wl."clientId",
           CASE WHEN p.id IS NOT NULL AND p."deletedAt" IS NULL THEN wl."planId" ELSE NULL END AS "planId",
           wl."dayIndex", wl.date, wl."startTime", wl."endTime", wl.notes, wl.completed, wl.exercises, wl."createdAt"
    FROM public."WorkoutLog" wl
    LEFT JOIN public."WorkoutPlan" p ON p.id = wl."planId"
    WHERE wl."deletedAt" IS NULL
  `);

  const missing = rows.filter(w => !existing.has(w.id));
  const valid = missing.filter(w => validClients.has(w.clientId) && validWorkspaces.has(w.workspaceId));
  log(`workout_logs: ${rows.length} total, ${missing.length} missing, ${valid.length} valid`);
  if (DRY_RUN || valid.length === 0) return;

  await inBatches(valid, async (batch) => {
    await prisma.workout_logs.createMany({
      data: batch.map(w => ({
        id: w.id, workspace_id: w.workspaceId, client_id: w.clientId,
        plan_id: w.planId && validPlans.has(w.planId) ? w.planId : undefined,
        day_index: w.dayIndex, date: new Date(w.date),
        start_time: w.startTime ?? undefined, end_time: w.endTime ?? undefined,
        notes: w.notes ?? undefined, completed: w.completed, exercises: w.exercises as object,
        created_at: new Date(w.createdAt),
      })),
      skipDuplicates: true,
    });
  });
  log(`workout_logs: inserted ${valid.length}`);
}

// ─── 11. transactions (from Payment) ─────────────────────────────────────────────

async function migrateMissingTransactions() {
  const existing = await existingIds('transactions');
  const validWorkspaces = await existingIds('workspaces');
  const validClients = await existingIds('clients');

  const { rows } = await old.query<{
    id: string; workspaceId: string; clientId: string | null; amountCents: number;
    currency: string; status: string; provider: string; createdAt: string;
  }>(`
    SELECT id, "workspaceId", "clientId", "amountCents", currency, status,
           COALESCE(provider, 'manual') AS provider, "createdAt"
    FROM public."Payment"
    WHERE "deletedAt" IS NULL AND "clientId" IS NOT NULL
  `);

  const missing = rows.filter(p => !existing.has(p.id));
  const valid = missing.filter(p => validWorkspaces.has(p.workspaceId) && p.clientId && validClients.has(p.clientId));
  log(`transactions: ${rows.length} total, ${missing.length} missing, ${valid.length} valid`);
  if (DRY_RUN || valid.length === 0) return;

  // transaction_code is required and unique per (workspace_id, transaction_code) in the new
  // schema; old Payment has no equivalent field at all (the column was added later, via
  // migration 021_transaction_code.js, with existing rows backfilled at the time) — new
  // inserts must generate their own, same as the app's own transaction-creation code does.
  // Assign sequentially per workspace, ordered by original date so codes stay chronological.
  const maxCodeByWorkspace = new Map<string, number>();
  const existingMax = await prisma.transactions.groupBy({
    by: ['workspace_id'],
    _max: { transaction_code: true },
  });
  for (const row of existingMax) {
    maxCodeByWorkspace.set(row.workspace_id, row._max.transaction_code ?? 0);
  }

  const sorted = [...valid].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  const withCodes = sorted.map(p => {
    const next = (maxCodeByWorkspace.get(p.workspaceId) ?? 0) + 1;
    maxCodeByWorkspace.set(p.workspaceId, next);
    return { ...p, transactionCode: next };
  });

  await inBatches(withCodes, async (batch) => {
    await prisma.transactions.createMany({
      data: batch.map(p => ({
        id: p.id, transaction_code: p.transactionCode, workspace_id: p.workspaceId,
        client_id: p.clientId ?? undefined,
        client_name: '', payment_method: p.provider, amount: p.amountCents / 100,
        currency: p.currency, status: p.status === 'succeeded' ? 'completed' : p.status,
        transaction_date: new Date(p.createdAt), created_at: new Date(p.createdAt),
      })),
      skipDuplicates: true,
    });
  });
  log(`transactions: inserted ${withCodes.length}`);
}

// ─── main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.time('catchup');
  log(`Starting incremental catch-up… ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE — writing to production)'}`);

  try {
    await migrateMissingUsers();
    await migrateMissingWorkspaceMembers();
    await migrateMissingClients();
    await migrateMissingClientObservations();
    await migrateMissingForms();
    await migrateMissingFormRequests();
    await migrateMissingMessages();
    await migrateMissingNutritionPlans();
    await migrateMissingTrainingPlans();
    await migrateMissingWorkoutLogs();
    await migrateMissingTransactions();

    log(DRY_RUN ? 'Dry run complete — no data was written.' : 'Catch-up complete.');
  } catch (err) {
    console.error('[catchup] FAILED:', err);
    process.exit(1);
  } finally {
    await old.end();
    await prisma.$disconnect();
    console.timeEnd('catchup');
  }
}

main();
