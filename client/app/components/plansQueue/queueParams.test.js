import { describe, test, expect } from 'vitest';
import { toQueueParams } from './queueParams';

describe('toQueueParams', () => {
    test('sends only the view when nothing else is set', () => {
        expect(toQueueParams({ view: 'all' })).toEqual({ view: 'all' });
    });

    test('carries the page, page size and search', () => {
        expect(toQueueParams({ view: 'need-action', page: 3, pageSize: 50, search: 'sara' }))
            .toEqual({ view: 'need-action', page: 3, pageSize: 50, search: 'sara' });
    });

    test('leaves the search out when it is empty', () => {
        expect(toQueueParams({ view: 'all', page: 1, pageSize: 25, search: '' })).not.toHaveProperty('search');
    });

    test('packs the table\'s filter rules into one JSON object keyed by column', () => {
        const params = toQueueParams({
            view: 'all',
            filters: [
                { id: 'a', colKey: 'clientPackage', value: ['Gold'] },
                { id: 'b', colKey: 'assignedTo', value: ['u1', null] },
                { id: 'c', colKey: 'requestedAt', value: { from: '2026-01-01', to: '' } },
            ],
        });

        expect(JSON.parse(params.filters)).toEqual({
            clientPackage: ['Gold'], assignedTo: ['u1', null], requestedAt: { from: '2026-01-01', to: '' },
        });
    });

    test('renames the form column to the API\'s form id filter', () => {
        const params = toQueueParams({ view: 'all', filters: [{ id: 'a', colKey: 'formTitle_en', value: ['f1'] }] });

        expect(JSON.parse(params.filters)).toEqual({ formId: ['f1'] });
    });

    test('keeps the visible Action column and the hidden post-action column as separate filters', () => {
        const params = toQueueParams({
            view: 'all',
            filters: [{ id: 'a', colKey: 'actions', value: ['nothing'] }, { id: 'b', colKey: 'postAction', value: ['workout-plan'] }],
        });

        expect(JSON.parse(params.filters)).toEqual({ actions: ['nothing'], postAction: ['workout-plan'] });
    });

    test('sends no filters parameter when there are no rules', () => {
        expect(toQueueParams({ view: 'all', filters: [] })).not.toHaveProperty('filters');
    });

    const sortCases = [
        ['clientName', 'desc', { sort: 'clientName', dir: 'desc' }],
        ['formTitle_en', 'asc', { sort: 'formTitle', dir: 'asc' }],
        ['assignedTo', 'anything-else', { sort: 'assignedTo', dir: 'asc' }],
    ];
    for (const [sortKey, sortDirection, expected] of sortCases) {
        test(`maps sort column ${sortKey} ${sortDirection}`, () => {
            expect(toQueueParams({ view: 'all', sortKey, sortDirection })).toMatchObject(expected);
        });
    }

    test('sends no sort when the table has none', () => {
        const params = toQueueParams({ view: 'all', sortKey: null, sortDirection: 'asc' });

        expect(params).not.toHaveProperty('sort');
        expect(params).not.toHaveProperty('dir');
    });

    test('includes the just-finished row id when given', () => {
        expect(toQueueParams({ view: 'need-action', page: 1, includeId: 'req1' })).toMatchObject({ includeId: 'req1' });
    });
});
