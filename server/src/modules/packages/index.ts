import { Router } from 'express';
import { createId } from '@paralleldrive/cuid2';
import authMiddleware from '../../middleware/auth';
import requirePermission from '../../middleware/requirePermission';
import pool from '../../db';

const router = Router();

router.use(authMiddleware);
router.use((req, res, next) => {
    const action = req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('finance', action)(req, res, next);
});

async function getPackageWithVariations(id: string, workspaceId: string) {
    const pkg = await pool.query('SELECT * FROM packages WHERE id = $1 AND workspace_id = $2', [id, workspaceId]);
    if (!pkg.rows.length) return null;
    const vars = await pool.query('SELECT * FROM package_variations WHERE package_id = $1 ORDER BY id ASC', [id]);
    return { ...pkg.rows[0], variations: vars.rows };
}

router.get('/', async (req, res, next) => {
    try {
        const pkgs = await pool.query('SELECT * FROM packages WHERE workspace_id = $1 ORDER BY name ASC', [req.user!.workspaceId]);
        const result = await Promise.all((pkgs.rows as Record<string, unknown>[]).map(async (pkg) => {
            const vars = await pool.query('SELECT * FROM package_variations WHERE package_id = $1 ORDER BY id ASC', [pkg.id]);
            return { ...pkg, variations: vars.rows };
        }));
        res.json(result);
    } catch (err) { next(err); }
});

router.post('/', async (req, res, next) => {
    const { name, variations } = req.body as { name?: string; variations?: Record<string, unknown>[] };
    if (!name?.trim()) return res.status(400).json({ error: 'Package name is required' });
    if (!Array.isArray(variations) || variations.length === 0) return res.status(400).json({ error: 'At least one variation is required' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const pkgRes = await client.query(
            'INSERT INTO packages (workspace_id, name, id) VALUES ($1, $2, $3) RETURNING *',
            [req.user!.workspaceId, name.trim(), createId()]
        );
        const pkg = pkgRes.rows[0] as Record<string, unknown>;
        const insertedVars = [];

        for (const v of variations) {
            const dur   = Number(v.duration);
            const price = Number(v.price);
            if (!(v.name as string)?.trim()) throw new Error('Variation name is required');
            if (!Number.isFinite(dur)   || dur   <= 0) throw new Error('Duration must be a positive number');
            if (!Number.isFinite(price) || price <= 0) throw new Error('Price must be a positive number');
            if (!(v.currency as string)?.trim())       throw new Error('Currency is required');

            const vRes = await client.query(
                `INSERT INTO package_variations (package_id, name, description, duration, price, currency, id)
                 VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
                [pkg.id, (v.name as string).trim(), (v.description as string | undefined)?.trim() || null,
                 dur, price, (v.currency as string).trim(), createId()]
            );
            insertedVars.push(vRes.rows[0]);
        }

        await client.query('COMMIT');
        res.status(201).json({ ...pkg, variations: insertedVars });
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
});

router.put('/', async (req, res, next) => {
    const { id, name, active, variations } = req.body as {
        id?: string; name?: string; active?: boolean; variations?: Record<string, unknown>[];
    };
    if (!id) return res.status(400).json({ error: 'Package id is required' });

    const existing = await pool.query('SELECT * FROM packages WHERE id = $1 AND workspace_id = $2', [id, req.user!.workspaceId]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Package not found' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (name !== undefined || active !== undefined) {
            const cur     = existing.rows[0] as Record<string, unknown>;
            const newName   = name   !== undefined ? name.trim() : cur.name;
            const newActive = active !== undefined ? active       : cur.active;
            await client.query('UPDATE packages SET name = $1, active = $2, updated_at = NOW() WHERE id = $3', [newName, newActive, id]);
        }

        if (Array.isArray(variations)) {
            await client.query('DELETE FROM package_variations WHERE package_id = $1', [id]);
            for (const v of variations) {
                const dur   = Number(v.duration);
                const price = Number(v.price);
                if (!(v.name as string)?.trim()) throw new Error('Variation name is required');
                if (!Number.isFinite(dur)   || dur   <= 0) throw new Error('Duration must be a positive number');
                if (!Number.isFinite(price) || price <= 0) throw new Error('Price must be a positive number');
                if (!(v.currency as string)?.trim())       throw new Error('Currency is required');

                await client.query(
                    `INSERT INTO package_variations (package_id, name, description, duration, price, currency, active, id)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
                    [id, (v.name as string).trim(), (v.description as string | undefined)?.trim() || null,
                     dur, price, (v.currency as string).trim(), v.active ?? true, createId()]
                );
            }
        }

        await client.query('COMMIT');
        res.json(await getPackageWithVariations(id, req.user!.workspaceId));
    } catch (err) {
        await client.query('ROLLBACK');
        next(err);
    } finally {
        client.release();
    }
});

router.delete('/', async (req, res, next) => {
    const { packageId, variationId } = req.body as { packageId?: string; variationId?: string };
    if (!packageId || !variationId) return res.status(400).json({ error: 'packageId and variationId are required' });

    const pkg = await pool.query('SELECT * FROM packages WHERE id = $1 AND workspace_id = $2', [packageId, req.user!.workspaceId]);
    if (!pkg.rows.length) return res.status(404).json({ error: 'Package not found' });

    await pool.query('DELETE FROM package_variations WHERE id = $1 AND package_id = $2', [variationId, packageId]);

    const remaining = await pool.query('SELECT id FROM package_variations WHERE package_id = $1', [packageId]);
    if (remaining.rows.length === 0) {
        await pool.query('DELETE FROM packages WHERE id = $1', [packageId]);
        return res.json({ deleted: 'package', id: packageId });
    }

    res.json(await getPackageWithVariations(packageId, req.user!.workspaceId));
});

export default router;
