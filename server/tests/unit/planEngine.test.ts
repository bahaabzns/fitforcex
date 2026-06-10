import {
    normalizeOrderedList,
    serializePlanRow,
    serializePlanRows,
    withTransaction,
} from '../../src/lib/planEngine';
import { Pool } from 'pg';
import { getTestPool } from '../helpers/testDb';

describe('normalizeOrderedList', () => {
    test('assigns order key starting at 1', () => {
        const result = normalizeOrderedList(
            [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
            'order_index'
        );
        expect(result.map(r => (r as Record<string, unknown>).order_index)).toEqual([1, 2, 3]);
    });

    test('returns empty array for null input', () => {
        expect(normalizeOrderedList(null as any, 'order')).toEqual([]);
    });

    test('returns empty array for empty input', () => {
        expect(normalizeOrderedList([], 'order')).toEqual([]);
    });

    test('does not mutate the original array', () => {
        const items = [{ name: 'A' }];
        normalizeOrderedList(items, 'order_index');
        expect((items[0] as any).order_index).toBeUndefined();
    });
});

describe('serializePlanRow', () => {
    test('converts Date to ISO string', () => {
        const row = {
            id:         'abc',
            created_at: new Date('2026-01-15T10:00:00.000Z'),
            updated_at: new Date('2026-01-16T10:00:00.000Z'),
        };
        const result = serializePlanRow(row);
        expect(result!.created_at).toBe('2026-01-15T10:00:00.000Z');
        expect(result!.updated_at).toBe('2026-01-16T10:00:00.000Z');
    });

    test('returns null for null input', () => {
        expect(serializePlanRow(null)).toBeNull();
    });

    test('handles null date fields', () => {
        const row = { id: '1', created_at: null, updated_at: null };
        const result = serializePlanRow(row);
        expect(result!.created_at).toBeNull();
    });

    test('handles invalid date strings gracefully', () => {
        const row = { id: '1', created_at: 'not-a-date', updated_at: null };
        const result = serializePlanRow(row);
        expect(result!.created_at).toBeNull();
    });
});

describe('serializePlanRows', () => {
    test('maps all rows', () => {
        const rows = [
            { id: '1', created_at: new Date('2026-01-01'), updated_at: null },
            { id: '2', created_at: new Date('2026-01-02'), updated_at: null },
        ];
        const result = serializePlanRows(rows);
        expect(result).toHaveLength(2);
        expect(result[0].created_at).toBe('2026-01-01T00:00:00.000Z');
    });

    test('returns empty array for null', () => {
        expect(serializePlanRows(null as any)).toEqual([]);
    });
});

describe('withTransaction', () => {
    let pool: Pool;

    beforeAll(() => { pool = getTestPool(); });

    test('commits on success and returns value', async () => {
        const result = await withTransaction(pool, async (_client) => 'committed');
        expect(result).toBe('committed');
    });

    test('rolls back on thrown error', async () => {
        await expect(
            withTransaction(pool, async () => { throw new Error('fail'); })
        ).rejects.toThrow('fail');
    });
});
