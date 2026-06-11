// The database relation is named `package_variations`, but the API contract (request
// bodies and the client) uses `variations`. These helpers re-shape package rows at the
// response boundary so the relation is always exposed as `variations`.

/**
 * Renames a package row's `package_variations` relation to `variations`.
 * Returns null when given null (e.g. a not-found lookup).
 */
export function serializePackage<T extends { package_variations?: unknown }>(
    pkg: T | null,
): (Omit<T, 'package_variations'> & { variations: NonNullable<T['package_variations']> }) | null {
    if (!pkg) return null;
    const { package_variations, ...rest } = pkg;
    return {
        ...rest,
        variations: (package_variations ?? []) as NonNullable<T['package_variations']>,
    };
}

/** Serializes a list of package rows. */
export function serializePackages<T extends { package_variations?: unknown }>(pkgs: T[]) {
    return pkgs.map((pkg) => serializePackage(pkg)!);
}
