import {
    parseQueueFilters, parseQueueQuery, queueConditions, queueOrderBy, QUEUE_DEFAULT_PAGE_SIZE, QueueQuery,
} from '../../src/modules/forms/queueQuery';

const json = (value: unknown) => JSON.stringify(value);
const okFilters = (raw: unknown) => {
    const parsed = parseQueueFilters(raw);
    if (!parsed.ok) throw new Error(`expected ok, got: ${parsed.error}`);
    return parsed.value;
};
const errorOf = (raw: unknown) => {
    const parsed = parseQueueFilters(raw);
    if (parsed.ok) throw new Error('expected an error');
    return parsed.error;
};
const baseQuery = (overrides: Partial<QueueQuery> = {}): QueueQuery => ({
    view: 'all', search: null, filters: {}, sortKey: null, sortDirection: 'asc', page: 1, pageSize: 25, ...overrides,
});

describe('parseQueueFilters', () => {
    test('no filters parameter means no filters', () => {
        expect(okFilters(undefined)).toEqual({});
        expect(okFilters('')).toEqual({});
        expect(okFilters('{}')).toEqual({});
    });

    test('accepts one filter of each kind', () => {
        const filters = okFilters(json({
            clientName: ' sara ', clientPackage: ['Gold'], formId: ['f1'], status: ['need-action', 'awaiting'],
            assignedTo: ['u1', null], label: [null], requestedAt: { from: '2026-01-01', to: '2026-01-31' },
        }));

        expect(filters).toEqual({
            clientName: 'sara', clientPackage: ['Gold'], formId: ['f1'], status: ['need-action', 'awaiting'],
            assignedTo: ['u1', null], label: [null], requestedAt: { from: '2026-01-01', to: '2026-01-31' },
        });
    });

    test('drops empty filters instead of keeping them', () => {
        expect(okFilters(json({ clientName: '  ', clientPackage: [], requestedAt: { from: '', to: '' } }))).toEqual({});
    });

    test('merges the postAction and actions columns into one filter', () => {
        const filters = okFilters(json({ postAction: ['nothing'], actions: ['workout-plan'] }));

        expect(filters.postAction).toEqual(['nothing', 'workout-plan']);
    });

    test.each([
        ['malformed JSON', '{nope', 'filters is not valid JSON'],
        ['a non-object', '[1]', 'filters must be an object'],
        ['an unknown column', json({ password: ['x'] }), 'Unknown filter: password'],
        ['a prototype key', '{"__proto__": ["x"]}', 'Unknown filter: __proto__'],
        ['an inherited key', json({ constructor: ['x'] }), 'Unknown filter: constructor'],
        ['text where a list is expected', json({ clientPackage: 'Gold' }), 'clientPackage must be a list'],
        ['a list where text is expected', json({ clientName: ['a'] }), 'clientName must be text'],
        ['null in a list that cannot hold it', json({ clientPackage: [null] }), 'clientPackage has an invalid value'],
        ['an unknown status', json({ status: ['done'] }), 'status has an invalid value'],
        ['an impossible date', json({ requestedAt: { from: '2026-02-31' } }), 'requestedAt has an invalid date'],
        ['a non-ISO date', json({ requestedAt: { to: '01/02/2026' } }), 'requestedAt has an invalid date'],
        ['a number as a date range', json({ requestedAt: 5 }), 'requestedAt must be a date range'],
        ['an oversized value', json({ label: ['x'.repeat(201)] }), 'label has an invalid value'],
        ['too many values', json({ formId: Array.from({ length: 201 }, (_, i) => `f${i}`) }), 'formId has too many values'],
    ])('rejects %s', (_name, raw, message) => {
        expect(errorOf(raw)).toBe(message);
    });

    test('rejects a non-string or oversized parameter', () => {
        expect(errorOf({ a: 1 })).toBe('filters is not valid');
        expect(errorOf(json({ clientName: 'x'.repeat(30_000) }))).toBe('filters is not valid');
    });
});

describe('parseQueueQuery', () => {
    test('defaults: all rows, first page, default size, newest first', () => {
        const parsed = parseQueueQuery({});
        if (!parsed.ok) throw new Error(parsed.error);

        expect(parsed.value).toEqual({
            view: 'all', search: null, filters: {}, sortKey: null, sortDirection: 'asc', page: 1, pageSize: QUEUE_DEFAULT_PAGE_SIZE,
        });
    });

    test('reads view, search, sort, direction, page and page size', () => {
        const parsed = parseQueueQuery({ view: 'need-action', search: ' sara ', sort: 'clientName', dir: 'desc', page: '3', pageSize: '50' });
        if (!parsed.ok) throw new Error(parsed.error);

        expect(parsed.value).toMatchObject({ view: 'need-action', search: 'sara', sortKey: 'clientName', sortDirection: 'desc', page: 3, pageSize: 50 });
    });

    test.each([
        ['an unknown sort key', { sort: 'password' }, { sortKey: null }],
        ['a sort key that is only inherited', { sort: 'constructor' }, { sortKey: null }],
        ['a page size that is not offered', { pageSize: '30' }, { pageSize: 25 }],
        ['a huge page size (capped at the largest offered size)', { pageSize: '100000' }, { pageSize: 100 }],
        ['a zero page', { page: '0' }, { page: 1 }],
        ['a non-numeric page', { page: 'abc' }, { page: 1 }],
        ['an unknown view', { view: 'everything' }, { view: 'all' }],
        ['a repeated (array) parameter', { page: ['1', '2'], sort: ['clientName'] }, { page: 1, sortKey: null }],
    ])('falls back to the default for %s', (_name, source, expected) => {
        const parsed = parseQueueQuery(source);
        if (!parsed.ok) throw new Error(parsed.error);

        expect(parsed.value).toMatchObject(expected);
    });

    test('caps the page number and the search length', () => {
        const parsed = parseQueueQuery({ page: '99999999', search: 'x'.repeat(500) });
        if (!parsed.ok) throw new Error(parsed.error);

        expect(parsed.value.page).toBe(100_000);
        expect(parsed.value.search).toHaveLength(100);
    });

    test('reports a bad filter as an error, not a fallback', () => {
        const parsed = parseQueueQuery({ filters: json({ nope: [1] }) });

        expect(parsed).toEqual({ ok: false, error: 'Unknown filter: nope' });
    });
});

describe('queueConditions / queueOrderBy', () => {
    const textOf = (fragment: { sql: string }) => fragment.sql.replace(/\s+/g, ' ');

    test('no filters add no conditions on the all view; the need-action view adds the need-action rule', () => {
        expect(queueConditions(baseQuery())).toEqual([]);
        expect(textOf(queueConditions(baseQuery({ view: 'need-action' }))[0])).toContain("fr.status NOT IN ('pending', 'scheduled', 'sent', 'reviewed')");
    });

    test('user text only ever reaches SQL as a bound value', () => {
        const hostile = "'; DROP TABLE clients; --";
        const conditions = queueConditions(baseQuery({
            search: hostile,
            filters: { clientName: hostile, clientCode: hostile, clientPackage: [hostile], formId: [hostile], assignedTo: [hostile, null], label: [hostile] },
        }));

        for (const condition of conditions) {
            expect(condition.sql).not.toContain('DROP TABLE');
            expect(condition.sql).not.toContain(hostile);
        }
        expect(conditions.flatMap((condition) => condition.values)).toContain(hostile);
    });

    test('LIKE wildcards in the search are escaped so they match literally', () => {
        const [condition] = queueConditions(baseQuery({ search: '100%_off' }));

        expect(condition.values).toContain('%100\\%\\_off%');
    });

    test('an assignee filter that includes "unassigned" also matches rows with no assignee', () => {
        const [condition] = queueConditions(baseQuery({ filters: { assignedTo: ['u1', null] } }));

        expect(textOf(condition)).toContain('fr.assigned_to IN');
        expect(textOf(condition)).toContain('fr.assigned_to IS NULL');
    });

    test('a date range includes the whole "to" day', () => {
        const conditions = queueConditions(baseQuery({ filters: { requestedAt: { from: '2026-01-01', to: '2026-01-31' } } }));

        expect(conditions.map(textOf)).toEqual(['fr.requested_at >= ?::date', 'fr.requested_at < (?::date + 1)']);
        expect(conditions[1].values).toEqual(['2026-01-31']);
    });

    test('sorting uses a whitelisted expression with the id as the final tie-break', () => {
        const order = textOf(queueOrderBy(baseQuery({ sortKey: 'clientName', sortDirection: 'desc' })));

        expect(order).toBe("ORDER BY lower(btrim(concat_ws(' ', c.fname, c.lname))) DESC NULLS LAST, fr.requested_at DESC NULLS LAST, fr.id DESC");
    });

    test('with no sort the order is newest first, ties broken by id', () => {
        expect(textOf(queueOrderBy(baseQuery()))).toBe('ORDER BY fr.requested_at DESC NULLS LAST, fr.id DESC');
    });
});
