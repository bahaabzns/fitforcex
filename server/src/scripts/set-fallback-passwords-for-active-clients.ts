/**
 * One-time remediation for the "Account not activated" client-portal login gap
 * (see find-clients-missing-portal-password.ts): sets a password for every
 * client, platform-wide, who has an Active or Frozen subscription but
 * clients.password IS NULL. Uses the exact same candidate query and
 * computeSubscriptionDetails-equivalent status logic as that diagnostic script,
 * recomputed fresh here (not a hardcoded id list) so it stays correct even if run
 * some time after the diagnostic was last read.
 *
 * Password source is per-workspace, per product decision:
 *   - workspace 'belghamdi': a single shared fallback password the coach wants
 *     to communicate to every affected client at once. Passed in via the
 *     FALLBACK_PASSWORD env var — intentionally NOT hardcoded here, since this
 *     file is committed to a public repo and a literal password in source would
 *     be permanently exposed in git history.
 *   - every other workspace: a unique auto-generated password per client (same
 *     charset/length as the "Generate" button on the client edit page —
 *     client/app/(coach)/[workspaceSlug]/clients/[id]/page.js), since those
 *     coaches distribute credentials individually.
 *
 * DRY_RUN=true previews the affected list (and the passwords that would be set)
 * without writing. Omit DRY_RUN (or set it to anything else) to actually hash
 * and set the passwords.
 *
 * Usage (from server/, picks up DATABASE_URL from the local .env automatically):
 *   FALLBACK_PASSWORD='...' DRY_RUN=true npx tsx src/scripts/set-fallback-passwords-for-active-clients.ts
 *   FALLBACK_PASSWORD='...' npx tsx src/scripts/set-fallback-passwords-for-active-clients.ts
 */

import 'dotenv/config';
import { Pool } from 'pg';
import bcrypt from 'bcrypt';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) { console.error('DATABASE_URL is required'); process.exit(1); }

const FALLBACK_PASSWORD = process.env.FALLBACK_PASSWORD;
if (!FALLBACK_PASSWORD) { console.error('FALLBACK_PASSWORD is required (the shared password to set for the belghamdi workspace)'); process.exit(1); }

const DRY_RUN           = process.env.DRY_RUN === 'true';
const FALLBACK_WORKSPACE_SLUG = 'belghamdi';

// Same charset/length as generatePassword() in the client edit page, so
// auto-generated credentials look consistent with what a coach would get
// clicking "Generate" in the UI.
const GENERATED_PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%';
function generatePassword(length = 10): string {
    return Array.from({ length }, () => GENERATED_PASSWORD_CHARS[Math.floor(Math.random() * GENERATED_PASSWORD_CHARS.length)]).join('');
}

const pool = new Pool({ connectionString: DATABASE_URL });

type SubscriptionStatus = 'No Subscriptions' | 'Pre-start' | 'Active' | 'Expired' | 'Frozen';

type TxRow = {
    client_id:                string;
    status:                   string;
    duration:                 number | string | null;
    start_mode:                string | null;
    subscription_start_date:  string | Date | null;
    created_at:               string | Date;
};

type FreezeRow = {
    client_id:            string;
    freeze_start_date:    string | Date;
    freeze_duration_days: number | string;
};

// Mirrors computeSubscriptionDetails in ../utils/subscriptionStatus.ts — see the
// same note in find-clients-missing-portal-password.ts for why this is duplicated
// rather than imported.
function computeStatus(
    allTransactions:         TxRow[],
    freezes:                 FreezeRow[],
    firstPlanActivationDate: Date | string | null
): SubscriptionStatus {
    if (allTransactions.length === 0) return 'No Subscriptions';

    const completed = allTransactions
        .filter(t => t.status === 'completed' && t.duration && Number(t.duration) > 0)
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

    if (completed.length === 0) return 'Pre-start';

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let prevEnd: Date | null = null;
    const periods: Array<{ start: Date; end: Date }> = [];

    for (const tx of completed) {
        let start: Date;
        const mode = tx.start_mode || 'on_first_plan';

        if (mode === 'custom' && tx.subscription_start_date) {
            start = new Date(tx.subscription_start_date);
        } else if (prevEnd !== null) {
            start = new Date(prevEnd);
        } else if (firstPlanActivationDate) {
            start = new Date(firstPlanActivationDate);
        } else {
            return 'Pre-start';
        }

        start.setHours(0, 0, 0, 0);
        let endMs = start.getTime() + Number(tx.duration) * 86400000;

        for (const freeze of freezes) {
            const fs = new Date(freeze.freeze_start_date);
            fs.setHours(0, 0, 0, 0);
            if (fs >= start && fs.getTime() < endMs) {
                endMs += Number(freeze.freeze_duration_days) * 86400000;
            }
        }

        periods.push({ start, end: new Date(endMs) });
        prevEnd = new Date(endMs);
    }

    if (periods.length === 0) return 'Pre-start';

    for (const { start, end } of periods) {
        if (today < start) return 'Pre-start';
        if (today >= start && today < end) {
            for (const freeze of freezes) {
                const fs = new Date(freeze.freeze_start_date);
                fs.setHours(0, 0, 0, 0);
                const fe = new Date(fs.getTime() + Number(freeze.freeze_duration_days) * 86400000);
                if (today >= fs && today < fe) return 'Frozen';
            }
            return 'Active';
        }
    }

    return 'Expired';
}

async function main() {
    console.log(`Starting… ${DRY_RUN ? '(DRY RUN — no writes)' : '(LIVE — writing to production)'}`);

    const { rows: candidates } = await pool.query<{
        id: string; client_code: number; fname: string; lname: string; email: string;
        workspace_slug: string; workspace_name: string;
    }>(`
        SELECT c.id, c.client_code, c.fname, c.lname, c.email,
               w.slug AS workspace_slug, w.name AS workspace_name
        FROM clients c
        JOIN workspaces w ON w.id = c.workspace_id
        WHERE c.password IS NULL AND c.archived_at IS NULL AND w.archived_at IS NULL
    `);

    if (candidates.length === 0) {
        console.log('No clients without a portal password found.');
        await pool.end();
        return;
    }

    const clientIds = candidates.map(c => c.id);

    const [txRes, freezeRes, planRes] = await Promise.all([
        pool.query<TxRow>(
            `SELECT client_id, status, duration, start_mode, subscription_start_date, created_at
             FROM transactions WHERE client_id = ANY($1)`,
            [clientIds]
        ),
        pool.query<FreezeRow>(
            `SELECT client_id, freeze_start_date, freeze_duration_days
             FROM subscription_freezes WHERE client_id = ANY($1)`,
            [clientIds]
        ),
        pool.query<{ client_id: string; first_activation: Date | null }>(
            `SELECT client_id, MIN(activated_at) AS first_activation FROM (
                 SELECT client_id, activated_at FROM training_plans
                 WHERE client_id = ANY($1) AND activated_at IS NOT NULL
                 UNION ALL
                 SELECT client_id, activated_at FROM nutrition_plans
                 WHERE client_id = ANY($1) AND activated_at IS NOT NULL
             ) x GROUP BY client_id`,
            [clientIds]
        ),
    ]);

    const txByClient: Record<string, TxRow[]> = {};
    for (const tx of txRes.rows) (txByClient[tx.client_id] ??= []).push(tx);

    const freezesByClient: Record<string, FreezeRow[]> = {};
    for (const f of freezeRes.rows) (freezesByClient[f.client_id] ??= []).push(f);

    const planActivationByClient: Record<string, string | null> = {};
    for (const row of planRes.rows) {
        planActivationByClient[row.client_id] = row.first_activation
            ? new Date(row.first_activation).toISOString()
            : null;
    }

    const affected = candidates
        .map(c => ({
            ...c,
            status: computeStatus(
                txByClient[c.id] || [],
                freezesByClient[c.id] || [],
                planActivationByClient[c.id] ?? null
            ),
        }))
        .filter(c => c.status === 'Active' || c.status === 'Frozen')
        .sort((a, b) => a.workspace_slug.localeCompare(b.workspace_slug) || a.client_code - b.client_code);

    const withPasswords = affected.map(c => ({
        ...c,
        plainPassword: c.workspace_slug === FALLBACK_WORKSPACE_SLUG ? FALLBACK_PASSWORD : generatePassword(),
    }));

    console.log(`${withPasswords.length} client(s) will get a password set:\n`);
    for (const c of withPasswords) {
        console.log(`[${c.workspace_slug}] #${c.client_code} ${c.fname} ${c.lname} <${c.email || 'no email'}> — ${c.status} — password: ${c.plainPassword}`);
    }

    if (DRY_RUN) {
        console.log('\nDRY RUN — no passwords were changed. Re-run without DRY_RUN=true to apply.');
        await pool.end();
        return;
    }

    let updated = 0;
    for (const c of withPasswords) {
        const hash = await bcrypt.hash(c.plainPassword, 10);
        await pool.query(`UPDATE clients SET password = $1 WHERE id = $2`, [hash, c.id]);
        updated++;
    }

    console.log(`\nDone. Set a password for ${updated} client(s) — the '${FALLBACK_WORKSPACE_SLUG}' workspace shares '${FALLBACK_PASSWORD}', every other workspace got a unique generated password (see the list above — it will not be recoverable after this run since only the bcrypt hash is stored).`);

    await pool.end();
}

main().catch(err => { console.error(err); process.exit(1); });
