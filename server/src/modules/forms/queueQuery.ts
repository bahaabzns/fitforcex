import { Prisma } from '@prisma/client';

// Query language of the Plans Queue list (GET /forms/queue?page=…, /queue/summary, /queue/ids): which rows,
// in what order, which page. Parsing (untrusted query string -> a typed QueueQuery) and SQL building are
// separate on purpose: the parser is pure and unit-tested, and the SQL is only ever assembled from its
// validated output plus whitelisted column expressions — user text only ever reaches SQL as a bound value.

export const QUEUE_PAGE_SIZES = [10, 25, 50, 100] as const;
export const QUEUE_DEFAULT_PAGE_SIZE = 25;
// "Select all matching" hands the browser every matching id; past this many it stops and says so.
export const QUEUE_SELECT_ALL_LIMIT = 5000;

const MAX_SEARCH_LENGTH = 100;
const MAX_FILTERS_JSON_LENGTH = 20_000;
const MAX_MULTI_VALUES = 200;
const MAX_VALUE_LENGTH = 200;
const MAX_PAGE = 100_000;

// Statuses that are NOT "need action": awaiting/scheduled (nothing submitted yet) and reviewed (done). Anything
// else — in practice 'submitted' — is need-action, exactly as getQueue's row mapping decides. Kept as literals
// in the SQL (not bind params) so the planner can match the partial index in migration 114.
export const QUEUE_NON_ACTION_STATUSES = ['pending', 'scheduled', 'sent', 'reviewed'] as const;
const NON_ACTION_SQL_LIST = QUEUE_NON_ACTION_STATUSES.map((status) => `'${status}'`).join(', ');
const NEED_ACTION_SQL = `(fr.status IS NULL OR fr.status NOT IN (${NON_ACTION_SQL_LIST}))`;

export const QUEUE_VIEWS = ['need-action', 'all'] as const;
export type QueueView = typeof QUEUE_VIEWS[number];

// The statuses the History view's Status column can filter by (what the row mapping reports, not raw DB values).
export const QUEUE_STATUS_FILTERS = ['need-action', 'awaiting', 'scheduled', 'action-done'] as const;
export type QueueStatusFilter = typeof QUEUE_STATUS_FILTERS[number];

const STATUS_FILTER_SQL: Record<QueueStatusFilter, string> = {
    'need-action': NEED_ACTION_SQL,
    awaiting:      `fr.status IN ('pending', 'sent')`,
    scheduled:     `fr.status = 'scheduled'`,
    'action-done': `fr.status = 'reviewed'`,
};

export const QUEUE_SORT_KEYS = [
    'clientCode', 'clientName', 'clientPackage', 'formTitle', 'requestedAt', 'submittedAt', 'actionTakenAt', 'assignedTo', 'label',
] as const;
export type QueueSortKey = typeof QUEUE_SORT_KEYS[number];

// Whitelisted expressions, never built from input. Names sort case-insensitively and the display name
// is what is compared (not the assignee's id), matching what the coach sees in the column.
const SORT_EXPRESSIONS: Record<QueueSortKey, string> = {
    clientCode:    'c.client_code',
    clientName:    `lower(btrim(concat_ws(' ', c.fname, c.lname)))`,
    clientPackage: 'lower(c.current_package)',
    formTitle:     'lower(f.title_en)',
    requestedAt:   'fr.requested_at',
    submittedAt:   'fr.submitted_at',
    actionTakenAt: 'fr.action_taken_at',
    assignedTo:    `lower(NULLIF(btrim(concat_ws(' ', au.fname, au.lname)), ''))`,
    label:         'lower(pql.name)',
};

export type DateRange = { from: string | null; to: string | null };

export interface QueueFilters {
    clientCode?: string;
    clientName?: string;
    clientPackage?: string[];
    formId?: string[];
    formType?: string[];
    postAction?: string[];
    status?: QueueStatusFilter[];
    assignedTo?: Array<string | null>;   // null = unassigned
    label?: Array<string | null>;        // null = unlabeled
    requestedAt?: DateRange;
    submittedAt?: DateRange;
    actionTakenAt?: DateRange;
}

export interface QueueQuery {
    view: QueueView;
    search: string | null;
    filters: QueueFilters;
    sortKey: QueueSortKey | null;
    sortDirection: 'asc' | 'desc';
    page: number;
    pageSize: number;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

const isRecord = (input: unknown): input is Record<string, unknown> =>
    typeof input === 'object' && input !== null && !Array.isArray(input);

function parseText(input: unknown, name: string): Parsed<string | undefined> {
    if (typeof input !== 'string') return fail(`${name} must be text`);
    const trimmed = input.trim();
    if (trimmed.length > MAX_SEARCH_LENGTH) return fail(`${name} is too long`);
    return { ok: true, value: trimmed || undefined };
}

function parseStringList(input: unknown, name: string, allowNull: boolean): Parsed<Array<string | null> | undefined> {
    if (!Array.isArray(input)) return fail(`${name} must be a list`);
    if (input.length > MAX_MULTI_VALUES) return fail(`${name} has too many values`);
    const values: Array<string | null> = [];
    for (const value of input) {
        if (value === null && allowNull) values.push(null);
        else if (typeof value === 'string' && value.length > 0 && value.length <= MAX_VALUE_LENGTH) values.push(value);
        else return fail(`${name} has an invalid value`);
    }
    return { ok: true, value: values.length > 0 ? values : undefined };
}

function isRealDate(input: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return false;
    const parsed = new Date(`${input}T00:00:00Z`);
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === input;
}

function parseDateRange(input: unknown, name: string): Parsed<DateRange | undefined> {
    if (!isRecord(input)) return fail(`${name} must be a date range`);
    const range: DateRange = { from: null, to: null };
    for (const edge of ['from', 'to'] as const) {
        const value = input[edge];
        if (value === undefined || value === null || value === '') continue;
        if (typeof value !== 'string' || !isRealDate(value)) return fail(`${name} has an invalid date`);
        range[edge] = value;
    }
    return { ok: true, value: range.from || range.to ? range : undefined };
}

// `postAction` and `actions` are the same filter: the table has a hidden filter-only column and the visible
// Action column, and both carry post-action values.
const FILTER_PARSERS: Record<string, (input: unknown, key: string, filters: QueueFilters) => string | null> = {
    clientCode: (input, key, filters) => assign(parseText(input, key), (v) => { filters.clientCode = v; }),
    clientName: (input, key, filters) => assign(parseText(input, key), (v) => { filters.clientName = v; }),
    clientPackage: (input, key, filters) => assign(parseStringList(input, key, false), (v) => { filters.clientPackage = v as string[] | undefined; }),
    formId: (input, key, filters) => assign(parseStringList(input, key, false), (v) => { filters.formId = v as string[] | undefined; }),
    formType: (input, key, filters) => assign(parseStringList(input, key, false), (v) => { filters.formType = v as string[] | undefined; }),
    postAction: (input, key, filters) => assign(parseStringList(input, key, false), (v) => {
        filters.postAction = [...(filters.postAction ?? []), ...((v as string[] | undefined) ?? [])];
    }),
    status: (input, key, filters) => {
        const parsed = parseStringList(input, key, false);
        if (!parsed.ok) return parsed.error;
        const values = (parsed.value ?? []) as string[];
        if (values.some((value) => !(QUEUE_STATUS_FILTERS as readonly string[]).includes(value))) return `${key} has an invalid value`;
        filters.status = values.length > 0 ? (values as QueueStatusFilter[]) : undefined;
        return null;
    },
    assignedTo: (input, key, filters) => assign(parseStringList(input, key, true), (v) => { filters.assignedTo = v; }),
    label: (input, key, filters) => assign(parseStringList(input, key, true), (v) => { filters.label = v; }),
    requestedAt: (input, key, filters) => assign(parseDateRange(input, key), (v) => { filters.requestedAt = v; }),
    submittedAt: (input, key, filters) => assign(parseDateRange(input, key), (v) => { filters.submittedAt = v; }),
    actionTakenAt: (input, key, filters) => assign(parseDateRange(input, key), (v) => { filters.actionTakenAt = v; }),
};
FILTER_PARSERS.actions = FILTER_PARSERS.postAction;

function assign<T>(parsed: Parsed<T>, apply: (value: T) => void): string | null {
    if (!parsed.ok) return parsed.error;
    apply(parsed.value);
    return null;
}

/** `?filters=` is a JSON object keyed by column; an unknown key or a malformed value is rejected, never ignored. */
export function parseQueueFilters(raw: unknown): Parsed<QueueFilters> {
    if (raw === undefined || raw === '') return { ok: true, value: {} };
    if (typeof raw !== 'string' || raw.length > MAX_FILTERS_JSON_LENGTH) return fail('filters is not valid');
    let decoded: unknown;
    try { decoded = JSON.parse(raw); } catch { return fail('filters is not valid JSON'); }
    if (!isRecord(decoded)) return fail('filters must be an object');

    const filters: QueueFilters = {};
    for (const [key, value] of Object.entries(decoded)) {
        const parseFilter = Object.prototype.hasOwnProperty.call(FILTER_PARSERS, key) ? FILTER_PARSERS[key] : undefined;
        if (!parseFilter) return fail(`Unknown filter: ${key.slice(0, 40)}`);
        const error = parseFilter(value, key, filters);
        if (error) return fail(error);
    }
    return { ok: true, value: filters };
}

function parsePositiveInt(input: unknown, fallback: number, max: number): number {
    const parsed = Number.parseInt(typeof input === 'string' ? input : '', 10);
    if (!Number.isFinite(parsed) || parsed < 1) return fallback;
    return Math.min(parsed, max);
}

/**
 * Turns the request's query string into a QueueQuery. A bad filter is an error (an ignored filter would show
 * rows the coach asked to hide); a bad sort, view, page or page size just falls back to its default, since
 * none of those can widen what a bulk action touches.
 */
export function parseQueueQuery(source: Record<string, unknown>): Parsed<QueueQuery> {
    const filters = parseQueueFilters(source.filters);
    if (!filters.ok) return filters;

    const search = typeof source.search === 'string' ? source.search.trim().slice(0, MAX_SEARCH_LENGTH) : '';
    const sortKey = (QUEUE_SORT_KEYS as readonly string[]).includes(source.sort as string) ? (source.sort as QueueSortKey) : null;
    const requestedPageSize = parsePositiveInt(source.pageSize, QUEUE_DEFAULT_PAGE_SIZE, 100);
    const pageSize = (QUEUE_PAGE_SIZES as readonly number[]).includes(requestedPageSize) ? requestedPageSize : QUEUE_DEFAULT_PAGE_SIZE;

    return {
        ok: true,
        value: {
            view: source.view === 'need-action' ? 'need-action' : 'all',
            search: search || null,
            filters: filters.value,
            sortKey,
            sortDirection: source.dir === 'desc' ? 'desc' : 'asc',
            page: parsePositiveInt(source.page, 1, MAX_PAGE),
            pageSize,
        },
    };
}

// ── SQL ───────────────────────────────────────────────────────────

const escapeLike = (text: string): string => text.replace(/[\\%_]/g, (character) => `\\${character}`);
const containsPattern = (text: string): string => `%${escapeLike(text)}%`;
const CLIENT_NAME_SQL = Prisma.raw(`btrim(concat_ws(' ', c.fname, c.lname))`);

/** The "need action" rule on its own, for the summary counts and the legacy ?view=need-action list. */
export const needActionSql = Prisma.raw(NEED_ACTION_SQL);

const inList = (values: string[]) => Prisma.sql`IN (${Prisma.join(values)})`;

function nullableInSql(column: Prisma.Sql, values: Array<string | null>): Prisma.Sql {
    const real = values.filter((value): value is string => value !== null);
    const wantsNull = values.includes(null);
    if (real.length > 0 && wantsNull) return Prisma.sql`(${column} ${inList(real)} OR ${column} IS NULL)`;
    if (wantsNull) return Prisma.sql`${column} IS NULL`;
    return Prisma.sql`${column} ${inList(real)}`;
}

function dateRangeSql(column: Prisma.Sql, range: DateRange): Prisma.Sql[] {
    const conditions: Prisma.Sql[] = [];
    if (range.from) conditions.push(Prisma.sql`${column} >= ${range.from}::date`);
    // Inclusive of the whole "to" day.
    if (range.to) conditions.push(Prisma.sql`${column} < (${range.to}::date + 1)`);
    return conditions;
}

const POST_ACTION_SQL = Prisma.raw(`CASE WHEN COALESCE(NULLIF(fr.post_action, ''), f.post_action) IN ('nutrition-plan', 'workout-plan')
    THEN COALESCE(NULLIF(fr.post_action, ''), f.post_action) ELSE 'nothing' END`);

/**
 * Whether any condition reads the client or form tables. When none does, counting matches needs only
 * form_requests — a large saving on the default list, where the count would otherwise join every row.
 */
export function conditionsNeedClientOrFormJoin({ search, filters }: QueueQuery): boolean {
    return !!(search || filters.clientCode || filters.clientName || filters.clientPackage || filters.formType || filters.postAction);
}

/** Every condition the query adds on top of workspace + archived scoping (which the caller owns). */
export function queueConditions(query: QueueQuery): Prisma.Sql[] {
    const { filters, search, view } = query;
    const conditions: Prisma.Sql[] = [];

    if (view === 'need-action') conditions.push(needActionSql);

    if (search) {
        const pattern = containsPattern(search);
        conditions.push(Prisma.sql`(${CLIENT_NAME_SQL} ILIKE ${pattern} OR c.email ILIKE ${pattern}
            OR c.client_code::text ILIKE ${pattern} OR f.title_en ILIKE ${pattern} OR f.title_ar ILIKE ${pattern})`);
    }
    if (filters.clientCode) conditions.push(Prisma.sql`c.client_code::text ILIKE ${containsPattern(filters.clientCode)}`);
    if (filters.clientName) conditions.push(Prisma.sql`${CLIENT_NAME_SQL} ILIKE ${containsPattern(filters.clientName)}`);
    if (filters.clientPackage) conditions.push(Prisma.sql`c.current_package ${inList(filters.clientPackage)}`);
    if (filters.formId) conditions.push(Prisma.sql`fr.form_id ${inList(filters.formId)}`);
    if (filters.formType) conditions.push(Prisma.sql`COALESCE(f.form_type, 'check-in') ${inList(filters.formType)}`);
    if (filters.postAction) conditions.push(Prisma.sql`${POST_ACTION_SQL} ${inList(filters.postAction)}`);
    if (filters.status) {
        conditions.push(Prisma.sql`(${Prisma.join(filters.status.map((status) => Prisma.raw(STATUS_FILTER_SQL[status])), ' OR ')})`);
    }
    if (filters.assignedTo) conditions.push(nullableInSql(Prisma.raw('fr.assigned_to'), filters.assignedTo));
    if (filters.label) conditions.push(nullableInSql(Prisma.raw('fr.label_id'), filters.label));
    if (filters.requestedAt) conditions.push(...dateRangeSql(Prisma.raw('fr.requested_at'), filters.requestedAt));
    if (filters.submittedAt) conditions.push(...dateRangeSql(Prisma.raw('fr.submitted_at'), filters.submittedAt));
    if (filters.actionTakenAt) conditions.push(...dateRangeSql(Prisma.raw('fr.action_taken_at'), filters.actionTakenAt));
    return conditions;
}

/** Newest-first by default. Ties (and the default) break on the row id so a page never repeats or skips a row. */
export function queueOrderBy(query: QueueQuery): Prisma.Sql {
    const tieBreak = Prisma.raw('fr.requested_at DESC NULLS LAST, fr.id DESC');
    if (!query.sortKey) return Prisma.sql`ORDER BY ${tieBreak}`;
    const direction = Prisma.raw(query.sortDirection === 'desc' ? 'DESC' : 'ASC');
    return Prisma.sql`ORDER BY ${Prisma.raw(SORT_EXPRESSIONS[query.sortKey])} ${direction} NULLS LAST, ${tieBreak}`;
}
