import { Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma';
import { normalizePostAction } from '../../utils/postAction';
import { QUEUE_SELECT_ALL_LIMIT, QueueQuery, QueueView, conditionsNeedClientOrFormJoin, needActionSql, queueConditions, queueOrderBy } from './queueQuery';

// Reads behind the Plans Queue page: the row SELECT every queue read shares, the mapping from a DB row to the
// shape the web app renders, and the three paged reads (one page of rows, the sidebar summary, the ids for
// "select all matching"). Everything here is scoped to one workspace by the caller-supplied workspaceId.

type RequestRow = Record<string, unknown>;
type ResponseRow = { question_id: string | null; answer: string | null };

// Coach Portal answer viewer (Phase 3) — the viewer used to guess whether an
// answer was an image by regex-sniffing the URL string, which mis-renders
// any non-image attachment whose URL happens to look like one and silently
// falls back to plain text for anything that doesn't. Rendering must be
// decided by the question's type, never the answer's content, so every
// response returned to the coach carries its question's `type` and (for
// metric-typed questions) the linked metric's `type` ("number" | "image").
export async function enrichResponsesWithQuestionInfo<T extends ResponseRow>(responses: T[]) {
    const questions = await prisma.form_version_questions.findMany({
        where:  { id: { in: responses.map((r) => r.question_id).filter((id): id is string => id !== null) } },
        select: { id: true, label_en: true, label_ar: true, type: true, order_index: true, metric_id: true },
    });
    const metricIds = questions.map((q) => q.metric_id).filter((id): id is string => id !== null);
    const metrics = metricIds.length > 0
        ? await prisma.metrics.findMany({ where: { id: { in: metricIds } }, select: { id: true, type: true } })
        : [];
    const metricTypeMap = new Map(metrics.map((m) => [m.id, m.type]));
    // Excludes the question's own `id` from the merged value — callers that
    // also select a response `id` (to look up edit history by response,
    // not by question) would otherwise have it silently clobbered by the
    // question's id below.
    const questionMap = new Map(questions.map((q) => {
        const { id: _questionId, ...questionInfo } = q;
        return [q.id, { ...questionInfo, metric_type: q.metric_id ? (metricTypeMap.get(q.metric_id) ?? null) : null }];
    }));

    return responses
        .map((r) => ({ ...r, ...questionMap.get(r.question_id ?? '') }))
        .sort((a, b) => ((a as { order_index?: number }).order_index ?? 0) - ((b as { order_index?: number }).order_index ?? 0));
}

/**
 * SELECT … FROM … JOINs for a queue row; the caller adds WHERE / ORDER BY. `withResponseCount` adds a per-row
 * answer count so the list can skip the answers themselves (they are fetched when a preview opens).
 * `pageIds`, when given, is a subquery of request ids: only those rows are selected, with `page.pos` holding
 * their order, so every display table is joined for one page of rows instead of for every matching row.
 */
export function queueRowSelect(withResponseCount: boolean, pageIds?: Prisma.Sql): Prisma.Sql {
    const responseCountColumn = withResponseCount
        ? Prisma.sql`(SELECT COUNT(*)::int FROM form_responses fresp WHERE fresp.request_id = fr.id) AS response_count,`
        : Prisma.empty;
    // ARRAY(subquery) keeps the subquery's ORDER BY, and WITH ORDINALITY numbers it, so the page order survives the joins.
    const fromRequests = pageIds
        ? Prisma.sql`unnest(ARRAY(${pageIds})) WITH ORDINALITY AS page(id, pos) JOIN form_requests fr ON fr.id = page.id`
        : Prisma.sql`form_requests fr`;
    return Prisma.sql`
        SELECT fr.id, fr.status, fr.requested_at, fr.submitted_at, fr.form_id,
               fr.scheduled_at, fr.post_action, fr.action_taken_at, fr.assigned_to,
               fr.archived_at, fr.label_id,
               f.title_en AS form_title_en, f.title_ar AS form_title_ar,
               f.form_type, f.post_action AS form_post_action,
               c.id AS client_id, c.client_code, c.fname, c.lname, c.email, c.is_demo AS client_is_demo,
               au.fname AS assignee_fname, au.lname AS assignee_lname,
               c.current_package AS client_package,
               pql.name AS label_name, pql.color AS label_color,
               caa.id AS auto_assign_rule_id, aau.fname AS auto_assign_fname, aau.lname AS auto_assign_lname,
               ${responseCountColumn}
               NULL::text AS subscription_status
        FROM ${fromRequests}
        JOIN forms f ON f.id = fr.form_id
        JOIN clients c ON c.id = fr.client_id
        LEFT JOIN users au ON au.id = fr.assigned_to
        LEFT JOIN plans_queue_labels pql ON pql.id = fr.label_id
        -- At most one current rule per client + plan type (partial unique index), so this never duplicates a row.
        LEFT JOIN client_auto_assign caa ON caa.workspace_id = fr.workspace_id AND caa.client_id = fr.client_id
               AND caa.plan_type = COALESCE(NULLIF(fr.post_action, ''), f.post_action) AND caa.disabled_at IS NULL
        LEFT JOIN users aau ON aau.id = caa.agent_user_id`;
}

// The row's current auto-assign rule, if any (see the LEFT JOIN in queueRowSelect).
function autoAssignFields(row: Record<string, unknown>) {
    const agentName = `${row.auto_assign_fname ?? ''} ${row.auto_assign_lname ?? ''}`.trim();
    return {
        autoAssignRuleId:    (row.auto_assign_rule_id as string | null) ?? null,
        autoAssignAgentName: row.auto_assign_rule_id ? (agentName || null) : null,
    };
}

const isAwaitingStatus = (status: unknown): boolean => status === 'pending' || status === 'scheduled' || status === 'sent';

/** The status the web app shows for a raw form_requests.status. */
function toQueueStatus(rawStatus: unknown): 'awaiting' | 'scheduled' | 'need-action' | 'action-done' {
    if (rawStatus === 'scheduled') return 'scheduled';
    if (isAwaitingStatus(rawStatus)) return 'awaiting';
    return rawStatus === 'reviewed' ? 'action-done' : 'need-action';
}

/**
 * Maps DB rows to queue items. With `lazyAnswers` the rows carry only `responseCount` (read from the row's
 * `response_count` column, see queueRowSelect); otherwise every row's answers are attached.
 */
export async function buildQueueItems(rows: RequestRow[], lazyAnswers: boolean) {
    // Batched, not per-row: firing one findMany() per queue row (the old
    // approach) meant a workspace with N submitted/reviewed requests opened
    // N+ concurrent Prisma queries on every page load — fine at small scale,
    // but it exhausted the connection pool once historical data pushed the
    // queue past a few dozen rows (a production incident, not hypothetical).
    const answerableIds = rows.filter((row) => !isAwaitingStatus(row.status)).map((row) => row.id as string);

    const allResponses = answerableIds.length > 0 && !lazyAnswers
        ? await prisma.form_responses.findMany({
            where:  { request_id: { in: answerableIds } },
            select: { request_id: true, question_id: true, answer: true },
        })
        : [];
    // Forms Versioning Phase 3 — join against form_version_questions, the
    // immutable snapshot each response actually belongs to, so a historical
    // answer always renders under the label/type it was originally asked with,
    // regardless of later form edits.
    const enrichedResponses = await enrichResponsesWithQuestionInfo(allResponses);

    const responsesByRequestId = new Map<string, typeof enrichedResponses>();
    for (const r of enrichedResponses) {
        const list = responsesByRequestId.get(r.request_id as string) ?? [];
        list.push(r);
        responsesByRequestId.set(r.request_id as string, list);
    }

    return rows.map((row) => {
        const awaiting = isAwaitingStatus(row.status);
        // `responses` already carries every answer (with its question id); nothing reads a separate
        // `answers` map, so it is not sent (it duplicated every answer in the payload).
        const requestResponses = awaiting ? [] : (responsesByRequestId.get(row.id as string) ?? []);

        return {
            id: row.id, clientId: row.client_id, clientCode: row.client_code,
            clientName: `${row.fname} ${row.lname}`.trim(), clientEmail: row.email, isDemo: row.client_is_demo === true,
            clientPackage: row.client_package, subscriptionStatus: row.subscription_status,
            formId: row.form_id, formTitle_en: row.form_title_en, formTitle_ar: row.form_title_ar,
            formType: row.form_type || 'check-in',
            postAction: normalizePostAction(row.post_action || row.form_post_action),
            requestedAt: row.requested_at, scheduledAt: row.scheduled_at,
            // 'sent' means the scheduler dispatched it to the client but nothing has come back yet — the
            // same "awaiting" bucket as pending, not a distinct status the frontend needs to know about.
            submittedAt: awaiting ? null : row.submitted_at,
            actionTakenAt: awaiting ? null : row.action_taken_at,
            status: toQueueStatus(row.status),
            assignedTo: row.assigned_to ?? null,
            assignedToName: row.assigned_to ? `${row.assignee_fname ?? ''} ${row.assignee_lname ?? ''}`.trim() : null,
            labelId: row.label_id ?? null,
            labelName: row.label_name ?? null,
            labelColor: row.label_color ?? null,
            ...autoAssignFields(row),
            responses: requestResponses,
            responseCount: awaiting ? 0 : (lazyAnswers ? Number(row.response_count ?? 0) : requestResponses.length),
            isArchived: !!row.archived_at, archivedAt: row.archived_at ?? null,
        };
    });
}

const archivedSql = (archived: boolean): Prisma.Sql =>
    archived ? Prisma.sql`fr.archived_at IS NOT NULL` : Prisma.sql`fr.archived_at IS NULL`;

function whereSql(workspaceId: string, archived: boolean, conditions: Prisma.Sql[]): Prisma.Sql {
    const all = [Prisma.sql`fr.workspace_id = ${workspaceId}`, archivedSql(archived), ...conditions];
    return Prisma.sql`WHERE ${Prisma.join(all.map((condition) => Prisma.sql`(${condition})`), ' AND ')}`;
}

// Enough joins for every filter and the search (client + form); the count and ids never need the
// assignee, label or auto-assign joins, which only matter for what a row displays.
const FILTERABLE_FROM = Prisma.sql`FROM form_requests fr JOIN forms f ON f.id = fr.form_id JOIN clients c ON c.id = fr.client_id`;

/**
 * FROM + WHERE for counting (or listing ids of) the rows a query matches. The listing joins forms and clients
 * (inner), so a row with no form or no client is never listed; the foreign keys guarantee any non-null id has
 * its row, so when no condition reads those tables the joins can be dropped and the same rows are counted
 * straight from form_requests.
 */
function matchingRowsFromWhere(workspaceId: string, archived: boolean, query: QueueQuery) {
    const conditions = queueConditions(query);
    if (conditionsNeedClientOrFormJoin(query)) return { from: FILTERABLE_FROM, where: whereSql(workspaceId, archived, conditions) };
    return {
        from: Prisma.sql`FROM form_requests fr`,
        where: whereSql(workspaceId, archived, [Prisma.sql`fr.form_id IS NOT NULL AND fr.client_id IS NOT NULL`, ...conditions]),
    };
}

const SORTS_NEEDING_CLIENT_OR_FORM: readonly (QueueQuery['sortKey'])[] = ['clientCode', 'clientName', 'clientPackage', 'formTitle'];

/**
 * The ids of one page, in order: the cheapest query that can decide which rows are on it. It joins only what the
 * search, filters and sort actually read (see matchingRowsFromWhere for why forms/clients can be skipped), so
 * the default list is an index walk over form_requests alone.
 */
function pageIdsSql(workspaceId: string, archived: boolean, query: QueueQuery): Prisma.Sql {
    const needsClientOrForm = conditionsNeedClientOrFormJoin(query) || SORTS_NEEDING_CLIENT_OR_FORM.includes(query.sortKey);
    const joins = Prisma.join([
        needsClientOrForm ? Prisma.sql`JOIN forms f ON f.id = fr.form_id JOIN clients c ON c.id = fr.client_id` : Prisma.empty,
        query.sortKey === 'assignedTo' ? Prisma.sql`LEFT JOIN users au ON au.id = fr.assigned_to` : Prisma.empty,
        query.sortKey === 'label' ? Prisma.sql`LEFT JOIN plans_queue_labels pql ON pql.id = fr.label_id` : Prisma.empty,
    ], ' ');
    const conditions = queueConditions(query);
    const where = whereSql(
        workspaceId, archived,
        needsClientOrForm ? conditions : [Prisma.sql`fr.form_id IS NOT NULL AND fr.client_id IS NOT NULL`, ...conditions],
    );
    const offset = (query.page - 1) * query.pageSize;
    return Prisma.sql`SELECT fr.id FROM form_requests fr ${joins} ${where} ${queueOrderBy(query)} LIMIT ${query.pageSize} OFFSET ${offset}`;
}

export interface QueuePage {
    items: Awaited<ReturnType<typeof buildQueueItems>>;
    total: number;
    page: number;
    pageSize: number;
    /** The row named by includeId, if it exists in this workspace — returned whatever the filters say. */
    includedItem: Awaited<ReturnType<typeof buildQueueItems>>[number] | null;
}

/** One page of the queue, already filtered and sorted, plus how many rows match in total. */
export async function listQueuePage(args: { workspaceId: string; archived: boolean; query: QueueQuery; includeId: string | null }): Promise<QueuePage> {
    const { workspaceId, archived, query, includeId } = args;
    const counting = matchingRowsFromWhere(workspaceId, archived, query);

    const [rows, totals, includedRows] = await Promise.all([
        prisma.$queryRaw<RequestRow[]>`${queueRowSelect(true, pageIdsSql(workspaceId, archived, query))} ORDER BY page.pos`,
        prisma.$queryRaw<{ total: number }[]>`SELECT COUNT(*)::int AS total ${counting.from} ${counting.where}`,
        includeId
            ? prisma.$queryRaw<RequestRow[]>`${queueRowSelect(true)} ${whereSql(workspaceId, archived, [Prisma.sql`fr.id = ${includeId}`])}`
            : Promise.resolve([] as RequestRow[]),
    ]);

    const items = await buildQueueItems(rows, true);
    const [includedItem = null] = await buildQueueItems(includedRows, true);
    return { items, total: totals[0]?.total ?? 0, page: query.page, pageSize: query.pageSize, includedItem };
}

export interface QueueSummary {
    /** Need-action rows per assignee id — the "how loaded is this person" numbers in the assignee picker. */
    needActionByAssignee: Record<string, number>;
    unassignedNeedAction: number;
    /** Distinct values the Package and Form filters can offer, for the rows in `view`. */
    packages: string[];
    formIds: string[];
}

/** What the browser can no longer work out from "every row", now that it only holds one page. */
export async function getQueueSummary(args: { workspaceId: string; view: QueueView }): Promise<QueueSummary> {
    const { workspaceId, view } = args;
    const scope = whereSql(workspaceId, false, view === 'need-action' ? [needActionSql] : []);
    const needActionScope = whereSql(workspaceId, false, [needActionSql]);

    const [workload, packages, forms] = await Promise.all([
        prisma.$queryRaw<{ userId: string | null; total: number }[]>`
            SELECT fr.assigned_to AS "userId", COUNT(*)::int AS total FROM form_requests fr ${needActionScope} GROUP BY fr.assigned_to`,
        prisma.$queryRaw<{ name: string }[]>`
            SELECT DISTINCT c.current_package AS name FROM form_requests fr JOIN clients c ON c.id = fr.client_id
            ${scope} AND c.current_package IS NOT NULL ORDER BY 1`,
        prisma.$queryRaw<{ formId: string }[]>`
            SELECT DISTINCT fr.form_id AS "formId" FROM form_requests fr ${scope} AND fr.form_id IS NOT NULL`,
    ]);

    const needActionByAssignee: Record<string, number> = {};
    let unassignedNeedAction = 0;
    for (const entry of workload) {
        if (entry.userId) needActionByAssignee[entry.userId] = entry.total;
        else unassignedNeedAction += entry.total;
    }
    return { needActionByAssignee, unassignedNeedAction, packages: packages.map((row) => row.name), formIds: forms.map((row) => row.formId) };
}

export interface QueueIdsResult {
    items: Array<{ id: string; status: ReturnType<typeof toQueueStatus>; postAction: string }>;
    /** True when more rows match than QUEUE_SELECT_ALL_LIMIT, so `items` is only the newest part of them. */
    capped: boolean;
}

/**
 * Light rows (id, status, post action) for every row matching the filters, so "select all matching" can span
 * pages and the bulk bar can still tell which actions apply. Stops at QUEUE_SELECT_ALL_LIMIT.
 */
export async function listQueueIds(args: { workspaceId: string; archived: boolean; query: QueueQuery }): Promise<QueueIdsResult> {
    const { workspaceId, archived, query } = args;
    const where = whereSql(workspaceId, archived, queueConditions(query));
    // The post action falls back to the form's, so this one needs the form joined whatever the filters are.
    const rows = await prisma.$queryRaw<RequestRow[]>`
        SELECT fr.id, fr.status, fr.post_action, f.post_action AS form_post_action
        ${FILTERABLE_FROM} ${where}
        ORDER BY fr.requested_at DESC NULLS LAST, fr.id DESC
        LIMIT ${QUEUE_SELECT_ALL_LIMIT + 1}`;

    const capped = rows.length > QUEUE_SELECT_ALL_LIMIT;
    const items = rows.slice(0, QUEUE_SELECT_ALL_LIMIT).map((row) => ({
        id: row.id as string,
        status: toQueueStatus(row.status),
        postAction: normalizePostAction(row.post_action || row.form_post_action),
    }));
    return { items, capped };
}
