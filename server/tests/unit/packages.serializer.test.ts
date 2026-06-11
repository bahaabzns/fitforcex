import { serializePackage, serializePackages } from '../../src/modules/packages/packages.serializer';

describe('serializePackage', () => {
    test('exposes variations under "variations" and drops "package_variations"', () => {
        // ARRANGE — a package row shaped like Prisma returns it
        const row = { id: 'p1', name: 'Gold', package_variations: [{ id: 'v1' }, { id: 'v2' }] };

        // ACT
        const result = serializePackage(row);

        // ASSERT
        expect(result).toEqual({ id: 'p1', name: 'Gold', variations: [{ id: 'v1' }, { id: 'v2' }] });
        expect(result).not.toHaveProperty('package_variations');
    });

    test('defaults to an empty array when a package has no variations', () => {
        const row = { id: 'p1', name: 'Gold', package_variations: undefined };
        expect(serializePackage(row).variations).toEqual([]);
    });

    test('returns null when the package is null (not found)', () => {
        expect(serializePackage(null)).toBeNull();
    });
});

describe('serializePackages', () => {
    test('serializes every package in a list', () => {
        const rows = [
            { id: 'p1', package_variations: [{ id: 'v1' }] },
            { id: 'p2', package_variations: [] },
        ];
        const result = serializePackages(rows);
        expect(result).toEqual([
            { id: 'p1', variations: [{ id: 'v1' }] },
            { id: 'p2', variations: [] },
        ]);
    });
});
