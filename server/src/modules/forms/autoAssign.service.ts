import { Prisma } from '@prisma/client';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../../lib/prisma';
import { CAPACITY_ROLES } from '../operations/operations.constants';
import { canReceivePlans } from '../operations/operations.assign';

// "Auto-assign this client to the same agent next time". One rule = client + plan type -> agent,
// so a client's nutrition and workout forms can go to different people. See migration 112.

export const AUTO_ASSIGN_PLAN_TYPES = ['nutrition-plan', 'workout-plan'] as const;
export type AutoAssignPlanType = (typeof AUTO_ASSIGN_PLAN_TYPES)[number];

const DISABLED_MOVED = 'moved';
const DISABLED_MANUAL = 'turned_off';
const SKIP_AGENT_UNAVAILABLE = 'agent_unavailable';

// Rules/ids are processed in slices so one bulk assignment of thousands of clients stays well under
// Postgres's bound-parameter ceiling and never builds one giant statement.
const RULE_BATCH_SIZE = 1000;

export const RULES_DEFAULT_PAGE_SIZE = 25;
export const RULES_MAX_PAGE_SIZE = 100;

type RuleTarget = { clientId: string; planType: AutoAssignPlanType };
export type AppliedRule = { id: string; clientId: string; planType: AutoAssignPlanType };

// The queue's own action resolution (request's post_action, falling back to the form's) —
// kept identical to getQueue and the dashboard so a rule matches the plan type the queue shows.
const ACTION_SQL = Prisma.sql`COALESCE(NULLIF(fr.post_action, ''), f.post_action, 'nothing')`;

const isAutoAssignPlanType = (value: string): value is AutoAssignPlanType =>
    (AUTO_ASSIGN_PLAN_TYPES as readonly string[]).includes(value);

function inBatches<T>(items: T[]): T[][] {
    const batches: T[][] = [];
    for (let start = 0; start < items.length; start += RULE_BATCH_SIZE) batches.push(items.slice(start, start + RULE_BATCH_SIZE));
    return batches;
}

// Which (client, plan type) pairs the given queue rows stand for. Rows that don't produce a
// plan ('nothing') are dropped: they never reach an agent, so there is nothing to auto-assign.
async function loadRuleTargets(workspaceId: string, requestIds: string[]): Promise<RuleTarget[]> {
    const unique = new Map<string, RuleTarget>();
    for (const batch of inBatches(requestIds)) {
        const rows = await prisma.$queryRaw<{ clientId: string | null; planType: string }[]>`
            SELECT DISTINCT fr.client_id AS "clientId", ${ACTION_SQL} AS "planType"
            FROM form_requests fr
            JOIN forms f ON f.id = fr.form_id
            WHERE fr.workspace_id = ${workspaceId}
              AND fr.id IN (${Prisma.join(batch)})
              AND fr.client_id IS NOT NULL
        `;
        for (const row of rows) {
            if (row.clientId && isAutoAssignPlanType(row.planType)) {
                unique.set(`${row.clientId}:${row.planType}`, { clientId: row.clientId, planType: row.planType });
            }
        }
    }
    return [...unique.values()];
}

// Points many clients' plan types at one agent in a few queries (not a few per client): rules already
// on that agent are left alone, rules on someone else are retired (reason 'moved'), and the rest are
// created. Returns every target's current rule so the caller can show it without another round trip.
async function applyRules(
    workspaceId: string, targets: RuleTarget[], agentUserId: string, actorUserId: string,
): Promise<{ rules: AppliedRule[]; created: number }> {
    const rules: AppliedRule[] = [];
    let created = 0;
    for (const batch of inBatches(targets)) {
        const existing = await prisma.client_auto_assign.findMany({
            where: { workspace_id: workspaceId, disabled_at: null, client_id: { in: batch.map((target) => target.clientId) } },
        });
        const existingByKey = new Map(existing.map((rule) => [`${rule.client_id}:${rule.plan_type}`, rule]));

        const toRetire: string[] = [];
        const toCreate: RuleTarget[] = [];
        for (const target of batch) {
            const current = existingByKey.get(`${target.clientId}:${target.planType}`);
            if (current?.agent_user_id === agentUserId) continue;
            if (current) toRetire.push(current.id);
            toCreate.push(target);
        }

        if (toCreate.length > 0) {
            await prisma.$transaction([
                prisma.client_auto_assign.updateMany({
                    where: { id: { in: toRetire }, disabled_at: null },
                    data:  { disabled_at: new Date(), disabled_by: actorUserId, disabled_reason: DISABLED_MOVED },
                }),
                // skipDuplicates: two managers acting at the same moment — the partial unique index lets one win.
                prisma.client_auto_assign.createMany({
                    data: toCreate.map((target) => ({
                        id: createId(), workspace_id: workspaceId, client_id: target.clientId,
                        plan_type: target.planType, agent_user_id: agentUserId, enabled_by: actorUserId,
                    })),
                    skipDuplicates: true,
                }),
            ]);
            created += toCreate.length;
        }

        // Re-read so the ids returned are the ones actually stored.
        const current = await prisma.client_auto_assign.findMany({
            where: {
                workspace_id: workspaceId, disabled_at: null, agent_user_id: agentUserId,
                client_id: { in: batch.map((target) => target.clientId) },
            },
            select: { id: true, client_id: true, plan_type: true },
        });
        const wanted = new Set(batch.map((target) => `${target.clientId}:${target.planType}`));
        for (const rule of current) {
            if (wanted.has(`${rule.client_id}:${rule.plan_type}`) && isAutoAssignPlanType(rule.plan_type)) {
                rules.push({ id: rule.id, clientId: rule.client_id, planType: rule.plan_type });
            }
        }
    }
    return { rules, created };
}

export type SetRulesResult = { rulesSet: number; skipped: 'agent_not_eligible' | 'error' | null; rules: AppliedRule[] };

// Called by assignQueue when the manager's "auto-assign when I assign" switch is on, for the rows
// they just assigned. Works for one row or thousands.
export async function setRulesForRequests(args: {
    workspaceId: string; requestIds: string[]; agentUserId: string; actorUserId: string;
}): Promise<SetRulesResult> {
    const { workspaceId, requestIds, agentUserId, actorUserId } = args;
    // A rule pointing at a receptionist/viewer would send every future form to someone who can't act on it.
    if (!(await canReceivePlans(workspaceId, agentUserId))) return { rulesSet: 0, skipped: 'agent_not_eligible', rules: [] };

    const targets = await loadRuleTargets(workspaceId, requestIds);
    const { rules, created } = await applyRules(workspaceId, targets, agentUserId, actorUserId);
    return { rulesSet: created, skipped: null, rules };
}

export type EnableRuleOutcome =
    | 'enabled' | 'already_on' | 'request_not_found' | 'not_assigned' | 'not_a_plan_form' | 'agent_not_eligible';

// The per-row ↻ button: from now on this client's forms of the same plan type go to whoever the row is
// currently assigned to. Moves an existing rule if it pointed at someone else.
export async function enableRuleForRequest(args: {
    workspaceId: string; requestId: string; actorUserId: string;
}): Promise<{ outcome: EnableRuleOutcome; rule: AppliedRule | null }> {
    const { workspaceId, requestId, actorUserId } = args;
    const request = await prisma.form_requests.findFirst({
        where: { id: requestId, workspace_id: workspaceId }, select: { assigned_to: true },
    });
    if (!request) return { outcome: 'request_not_found', rule: null };
    if (!request.assigned_to) return { outcome: 'not_assigned', rule: null };

    const [target] = await loadRuleTargets(workspaceId, [requestId]);
    if (!target) return { outcome: 'not_a_plan_form', rule: null };
    if (!(await canReceivePlans(workspaceId, request.assigned_to))) return { outcome: 'agent_not_eligible', rule: null };

    const { rules, created } = await applyRules(workspaceId, [target], request.assigned_to, actorUserId);
    return { outcome: created > 0 ? 'enabled' : 'already_on', rule: rules[0] ?? null };
}

export async function disableRule(args: { workspaceId: string; ruleId: string; actorUserId: string }): Promise<boolean> {
    const { count } = await prisma.client_auto_assign.updateMany({
        where: { id: args.ruleId, workspace_id: args.workspaceId, disabled_at: null },
        data:  { disabled_at: new Date(), disabled_by: args.actorUserId, disabled_reason: DISABLED_MANUAL },
    });
    return count > 0;
}

export interface RuleFilters {
    search?: string;
    planType?: AutoAssignPlanType;
    agentUserId?: string;
    // 'unavailable' = the agent can no longer receive plans (deactivated, or a role that doesn't produce them).
    status?: 'unavailable';
}

// Same meaning as filterPlanReceivers (owner, or an active member in a plan-producing role), written in SQL so
// "agent unavailable" can be a filter on a paged list. Keep the two in step — a test compares them.
const AGENT_AVAILABLE_SQL = Prisma.sql`(
    w.owner_id = r.agent_user_id
    OR EXISTS (
        SELECT 1 FROM workspace_members m
        WHERE m.workspace_id = r.workspace_id AND m.user_id = r.agent_user_id
          AND m.is_active = TRUE AND m.role IN (${Prisma.join([...CAPACITY_ROLES])})
    )
)`;

// Columns the rules list can be sorted by. A whitelist of SQL fragments, never user text, so the ORDER BY
// can't be injected into. The aliases are those of the page query in listActiveRules.
export const RULE_SORT_KEYS = ['client', 'nutritionAgent', 'workoutAgent', 'setBy', 'enabledAt'] as const;
export type RuleSortKey = typeof RULE_SORT_KEYS[number];
export type RuleSortDirection = 'asc' | 'desc';
export interface RuleSort { key: RuleSortKey; direction: RuleSortDirection }
export const RULES_DEFAULT_SORT: RuleSort = { key: 'enabledAt', direction: 'desc' };

const RULE_SORT_SQL: Record<RuleSortKey, Prisma.Sql> = {
    client:         Prisma.sql`LOWER(c.fname || ' ' || c.lname)`,
    nutritionAgent: Prisma.sql`LOWER(COALESCE(na.fname || ' ' || na.lname, ''))`,
    workoutAgent:   Prisma.sql`LOWER(COALESCE(wa.fname || ' ' || wa.lname, ''))`,
    setBy:          Prisma.sql`LOWER(COALESCE(lu.fname || ' ' || lu.lname, ''))`,
    enabledAt:      Prisma.sql`lr.enabled_at`,
};

function ruleOrderBySql(sort: RuleSort): Prisma.Sql {
    const direction = sort.direction === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;
    // c.id keeps paging stable when many clients tie on the sorted value.
    return Prisma.sql`ORDER BY ${RULE_SORT_SQL[sort.key]} ${direction}, c.id`;
}

// A client's name, email or code contains the typed text; %, _ and \ are escaped so they match literally.
const likePattern = (text: string) => `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

// Archived/deleted clients are hidden (they can't submit); their rules stay dormant and reappear if restored.
function ruleFilterSql(workspaceId: string, filters: RuleFilters): Prisma.Sql {
    const clauses: Prisma.Sql[] = [];
    const search = filters.search?.trim();
    if (search) {
        const pattern = likePattern(search);
        clauses.push(Prisma.sql`AND ((c.fname || ' ' || c.lname) ILIKE ${pattern} OR c.email ILIKE ${pattern} OR c.client_code::text ILIKE ${pattern})`);
    }
    if (filters.planType) clauses.push(Prisma.sql`AND r.plan_type = ${filters.planType}`);
    if (filters.agentUserId) clauses.push(Prisma.sql`AND r.agent_user_id = ${filters.agentUserId}`);
    if (filters.status === 'unavailable') clauses.push(Prisma.sql`AND NOT ${AGENT_AVAILABLE_SQL}`);
    const extra = clauses.reduce((all, clause) => Prisma.sql`${all} ${clause}`, Prisma.empty);
    return Prisma.sql`
        FROM client_auto_assign r
        JOIN workspaces w ON w.id = r.workspace_id
        JOIN clients c ON c.id = r.client_id AND c.archived_at IS NULL AND c.deleted_at IS NULL
        LEFT JOIN users au ON au.id = r.agent_user_id
        LEFT JOIN users eu ON eu.id = r.enabled_by
        WHERE r.workspace_id = ${workspaceId} AND r.disabled_at IS NULL ${extra}`;
}

const fullName = (fname: string | null, lname: string | null) => `${fname ?? ''} ${lname ?? ''}`.trim();

export interface RuleCell { id: string; agentUserId: string; agentName: string | null; agentAvailable: boolean }

interface ClientRuleRow {
    id: string; clientId: string; planType: string; agentUserId: string;
    agentFname: string | null; agentLname: string | null; agentAvailable: boolean;
    enabledByFname: string | null; enabledByLname: string | null; enabledAt: Date;
}

// Every current rule of the given clients (all plan types), with the agent's name and availability.
async function loadClientRules(workspaceId: string, clientIds: string[]): Promise<ClientRuleRow[]> {
    if (clientIds.length === 0) return [];
    return prisma.$queryRaw<ClientRuleRow[]>`
        SELECT r.id, r.client_id AS "clientId", r.plan_type AS "planType", r.agent_user_id AS "agentUserId",
               au.fname AS "agentFname", au.lname AS "agentLname", ${AGENT_AVAILABLE_SQL} AS "agentAvailable",
               eu.fname AS "enabledByFname", eu.lname AS "enabledByLname", r.enabled_at AS "enabledAt"
        FROM client_auto_assign r
        JOIN workspaces w ON w.id = r.workspace_id
        LEFT JOIN users au ON au.id = r.agent_user_id
        LEFT JOIN users eu ON eu.id = r.enabled_by
        WHERE r.workspace_id = ${workspaceId} AND r.disabled_at IS NULL AND r.client_id IN (${Prisma.join(clientIds)})
    `;
}

const toRuleCell = (row: ClientRuleRow): RuleCell => ({
    id: row.id,
    agentUserId: row.agentUserId,
    agentName: fullName(row.agentFname, row.agentLname) || null,
    agentAvailable: row.agentAvailable,
});

// One page of clients that have a current rule, newest first by default: one row per client with its
// nutrition and workout rule side by side. A client is listed when at least one of its rules matches the
// filters; both of its rules are shown. Paged and filtered in the database so the panel stays fast with
// thousands of rules. `totalRules` counts the rules the filters match (what "turn off all matching" would touch).
export async function listActiveRules(args: { workspaceId: string; filters: RuleFilters; sort?: RuleSort; page: number; pageSize: number }) {
    const { workspaceId, filters, page, pageSize, sort = RULES_DEFAULT_SORT } = args;
    const fromWhere = ruleFilterSql(workspaceId, filters);
    const [pageRows, clientTotals, ruleTotals] = await Promise.all([
        prisma.$queryRaw<{ clientId: string }[]>`
            WITH matched AS (SELECT DISTINCT r.client_id AS client_id ${fromWhere})
            SELECT c.id AS "clientId"
            FROM matched m
            JOIN clients c ON c.id = m.client_id
            LEFT JOIN client_auto_assign nr ON nr.workspace_id = ${workspaceId} AND nr.client_id = c.id
                 AND nr.plan_type = 'nutrition-plan' AND nr.disabled_at IS NULL
            LEFT JOIN users na ON na.id = nr.agent_user_id
            LEFT JOIN client_auto_assign wr ON wr.workspace_id = ${workspaceId} AND wr.client_id = c.id
                 AND wr.plan_type = 'workout-plan' AND wr.disabled_at IS NULL
            LEFT JOIN users wa ON wa.id = wr.agent_user_id
            LEFT JOIN LATERAL (
                SELECT lx.enabled_at, lx.enabled_by FROM client_auto_assign lx
                WHERE lx.workspace_id = ${workspaceId} AND lx.client_id = c.id AND lx.disabled_at IS NULL
                ORDER BY lx.enabled_at DESC, lx.id LIMIT 1
            ) lr ON TRUE
            LEFT JOIN users lu ON lu.id = lr.enabled_by
            ${ruleOrderBySql(sort)}
            LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
        `,
        prisma.$queryRaw<{ total: number }[]>`SELECT COUNT(DISTINCT r.client_id)::int AS "total" ${fromWhere}`,
        prisma.$queryRaw<{ total: number }[]>`SELECT COUNT(*)::int AS "total" ${fromWhere}`,
    ]);

    const clientIds = pageRows.map((row) => row.clientId);
    const [rules, clients] = await Promise.all([
        loadClientRules(workspaceId, clientIds),
        clientIds.length === 0 ? [] : prisma.$queryRaw<{ id: string; clientCode: number; fname: string | null; lname: string | null }[]>`
            SELECT id, client_code AS "clientCode", fname, lname FROM clients WHERE id IN (${Prisma.join(clientIds)})`,
    ]);
    const clientById = new Map(clients.map((client) => [client.id, client]));

    const items = clientIds.map((clientId) => {
        const client = clientById.get(clientId);
        const own = rules.filter((rule) => rule.clientId === clientId);
        const latest = own.reduce<ClientRuleRow | null>((best, rule) => (!best || rule.enabledAt > best.enabledAt ? rule : best), null);
        const cellFor = (planType: AutoAssignPlanType) => {
            const rule = own.find((candidate) => candidate.planType === planType);
            return rule ? toRuleCell(rule) : null;
        };
        return {
            clientId,
            clientCode: client?.clientCode ?? null,
            clientName: fullName(client?.fname ?? null, client?.lname ?? null),
            nutrition: cellFor('nutrition-plan'),
            workout: cellFor('workout-plan'),
            enabledByName: latest ? fullName(latest.enabledByFname, latest.enabledByLname) || null : null,
            enabledAt: latest?.enabledAt ?? null,
        };
    });
    return { items, total: clientTotals[0]?.total ?? 0, totalRules: ruleTotals[0]?.total ?? 0, page, pageSize };
}

// Roles that can produce each kind of plan. The workspace owner and managers can do both; a trainer only
// workout plans and a nutritionist only nutrition plans. Receptionists and viewers never produce plans.
const PLAN_AGENT_ROLES: Record<AutoAssignPlanType, readonly string[]> = {
    'nutrition-plan': ['manager', 'nutritionist'],
    'workout-plan':   ['manager', 'trainer'],
};

async function canReceivePlanType(workspaceId: string, userId: string, planType: AutoAssignPlanType): Promise<boolean> {
    const [workspace, member] = await Promise.all([
        prisma.workspaces.findFirst({ where: { id: workspaceId }, select: { owner_id: true } }),
        prisma.workspace_members.findFirst({
            where: { workspace_id: workspaceId, user_id: userId, is_active: true, role: { in: [...PLAN_AGENT_ROLES[planType]] } },
            select: { user_id: true },
        }),
    ]);
    return workspace?.owner_id === userId || !!member;
}

// The people each plan type's agent dropdown may offer.
export async function listRuleAgents(workspaceId: string): Promise<Record<'nutrition' | 'workout', { id: string; name: string }[]>> {
    const people = await prisma.$queryRaw<{ id: string; fname: string | null; lname: string | null; role: string }[]>`
        SELECT u.id, u.fname, u.lname, 'owner' AS role
        FROM workspaces w JOIN users u ON u.id = w.owner_id WHERE w.id = ${workspaceId}
        UNION
        SELECT u.id, u.fname, u.lname, m.role
        FROM workspace_members m JOIN users u ON u.id = m.user_id
        WHERE m.workspace_id = ${workspaceId} AND m.is_active = TRUE AND m.role IN (${Prisma.join([...CAPACITY_ROLES])})
    `;
    const pick = (planType: AutoAssignPlanType) => people
        .filter((person) => person.role === 'owner' || PLAN_AGENT_ROLES[planType].includes(person.role))
        .map((person) => ({ id: person.id, name: fullName(person.fname, person.lname) }))
        .sort((a, b) => a.name.localeCompare(b.name));
    return { nutrition: pick('nutrition-plan'), workout: pick('workout-plan') };
}

export type SetClientAgentOutcome = 'set' | 'turned_off' | 'unchanged' | 'client_not_found' | 'agent_not_eligible';

// The table's agent dropdown: point one client's rule for one plan type at an agent, or (agentUserId null)
// turn it off. Moving to another agent retires the old rule with reason 'moved': the rule table is its own history.
export async function setClientRuleAgent(args: {
    workspaceId: string; clientId: string; planType: AutoAssignPlanType; agentUserId: string | null; actorUserId: string;
}): Promise<{ outcome: SetClientAgentOutcome; rule: RuleCell | null }> {
    const { workspaceId, clientId, planType, agentUserId, actorUserId } = args;
    const client = await prisma.clients.findFirst({
        where: { id: clientId, workspace_id: workspaceId, archived_at: null, deleted_at: null }, select: { id: true },
    });
    if (!client) return { outcome: 'client_not_found', rule: null };

    if (agentUserId === null) {
        const { count } = await prisma.client_auto_assign.updateMany({
            where: { workspace_id: workspaceId, client_id: clientId, plan_type: planType, disabled_at: null },
            data:  { disabled_at: new Date(), disabled_by: actorUserId, disabled_reason: DISABLED_MANUAL },
        });
        return { outcome: count > 0 ? 'turned_off' : 'unchanged', rule: null };
    }

    if (!(await canReceivePlanType(workspaceId, agentUserId, planType))) return { outcome: 'agent_not_eligible', rule: null };
    const { created } = await applyRules(workspaceId, [{ clientId, planType }], agentUserId, actorUserId);
    const [rule] = (await loadClientRules(workspaceId, [clientId])).filter((row) => row.planType === planType);
    return { outcome: created > 0 ? 'set' : 'unchanged', rule: rule ? toRuleCell(rule) : null };
}

// The table's "Turn off": both of the client's rules at once. Returns how many were switched off.
export async function disableClientRules(args: { workspaceId: string; clientId: string; actorUserId: string }): Promise<number> {
    const { count } = await prisma.client_auto_assign.updateMany({
        where: { workspace_id: args.workspaceId, client_id: args.clientId, disabled_at: null },
        data:  { disabled_at: new Date(), disabled_by: args.actorUserId, disabled_reason: DISABLED_MANUAL },
    });
    return count;
}

// Turns off every current rule matching the filters (e.g. an agent who left: filter by that agent, turn all off).
// With no filters it turns off every rule, so the caller must make that an explicit, confirmed choice.
export async function disableMatchingRules(args: {
    workspaceId: string; filters: RuleFilters; actorUserId: string;
}): Promise<number> {
    const { workspaceId, filters, actorUserId } = args;
    return prisma.$executeRaw`
        UPDATE client_auto_assign
        SET disabled_at = NOW(), disabled_by = ${actorUserId}, disabled_reason = ${DISABLED_MANUAL}
        WHERE id IN (SELECT r.id ${ruleFilterSql(workspaceId, filters)})
    `;
}

// Logged at most once a day per rule, so a busy client doesn't turn the panel into noise.
async function recordSkip(ruleId: string): Promise<void> {
    await prisma.$executeRaw`
        UPDATE client_auto_assign
        SET last_skipped_at = NOW(), last_skip_reason = ${SKIP_AGENT_UNAVAILABLE}
        WHERE id = ${ruleId} AND (last_skipped_at IS NULL OR last_skipped_at < NOW() - INTERVAL '1 day')
    `;
}

async function assignFromRule(workspaceId: string, requestId: string): Promise<string | null> {
    const [target] = await loadRuleTargets(workspaceId, [requestId]);
    if (!target) return null;

    const rule = await prisma.client_auto_assign.findFirst({
        where: { workspace_id: workspaceId, client_id: target.clientId, plan_type: target.planType, disabled_at: null },
    });
    if (!rule) return null;

    if (!(await canReceivePlans(workspaceId, rule.agent_user_id))) {
        await recordSkip(rule.id);
        return null;
    }
    // `assigned_to IS NULL` keeps a manual assignment (made while the form was still pending) winning over the rule.
    const updated = await prisma.$executeRaw`
        UPDATE form_requests SET assigned_to = ${rule.agent_user_id}
        WHERE id = ${requestId} AND workspace_id = ${workspaceId} AND assigned_to IS NULL
    `;
    return updated > 0 ? rule.agent_user_id : null;
}

// How long a client's submission may wait for auto-assign before carrying on without it. Generous for the
// handful of indexed queries involved, short enough that a stalled database or exhausted connection pool
// can't hold the client's response hostage.
export const AUTO_ASSIGN_TIMEOUT_MS = 1500;

class AutoAssignTimeoutError extends Error {}

function withTimeout<T>(work: Promise<T>, timeoutMs: number): Promise<T> {
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new AutoAssignTimeoutError(`auto-assign took longer than ${timeoutMs}ms`)), timeoutMs);
    });
    return Promise.race([work, timeout]).finally(() => clearTimeout(timer));
}

// Runs right after a client's submission is saved. Best-effort by design: any failure, or taking longer
// than AUTO_ASSIGN_TIMEOUT_MS, is logged and the submission carries on exactly as it did before this
// feature (unassigned, whole team notified). If the work finishes after the timeout, the request still gets
// assigned (the UPDATE is guarded by `assigned_to IS NULL`) — the team notification just went out first.
export async function autoAssignSubmittedRequest(workspaceId: string, requestId: string): Promise<string | null> {
    try {
        return await withTimeout(assignFromRule(workspaceId, requestId), AUTO_ASSIGN_TIMEOUT_MS);
    } catch (err) {
        console.error('[autoAssign] could not auto-assign submitted request:', err);
        return null;
    }
}
