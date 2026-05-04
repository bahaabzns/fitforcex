const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const requirePermission = require('../middleware/requirePermission');

router.use(authMiddleware);
router.use((req, res, next) => {
    const action = req.method === 'GET' ? 'read' : req.method === 'DELETE' ? 'delete' : 'write';
    requirePermission('finance', action)(req, res, next);
});

// Bootstrap tables on first load
;(async () => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS packages (
                id          SERIAL PRIMARY KEY,
                workspace_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name        TEXT NOT NULL,
                active      BOOLEAN NOT NULL DEFAULT true,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
        await pool.query(`
            CREATE TABLE IF NOT EXISTS package_variations (
                id          SERIAL PRIMARY KEY,
                package_id  INTEGER NOT NULL REFERENCES packages(id) ON DELETE CASCADE,
                name        TEXT NOT NULL,
                description TEXT,
                duration    INTEGER NOT NULL,
                price       NUMERIC(12,2) NOT NULL,
                currency    TEXT NOT NULL DEFAULT 'USD',
                active      BOOLEAN NOT NULL DEFAULT true,
                created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        `);
    } catch (err) {
        console.error('packages bootstrap error:', err.message);
    }
})();

// --- helpers ---
async function getPackageWithVariations(id, coachId) {
    const pkg = await pool.query(
        'SELECT * FROM packages WHERE id = $1 AND workspace_id = $2',
        [id, coachId]
    );
    if (!pkg.rows.length) return null;
    const vars = await pool.query(
        'SELECT * FROM package_variations WHERE package_id = $1 ORDER BY id ASC',
        [id]
    );
    return { ...pkg.rows[0], variations: vars.rows };
}

// GET /api/packages  — all packages with variations
router.get('/', async (req, res) => {
    try {
        const pkgs = await pool.query(
            'SELECT * FROM packages WHERE workspace_id = $1 ORDER BY name ASC',
            [req.user.workspaceId]
        );
        const result = await Promise.all(pkgs.rows.map(async (pkg) => {
            const vars = await pool.query(
                'SELECT * FROM package_variations WHERE package_id = $1 ORDER BY id ASC',
                [pkg.id]
            );
            return { ...pkg, variations: vars.rows };
        }));
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/packages  — create a new package with at least one variation
router.post('/', async (req, res) => {
    const { name, variations } = req.body;
    if (!name?.trim()) return res.status(400).json({ error: 'Package name is required' });
    if (!Array.isArray(variations) || variations.length === 0)
        return res.status(400).json({ error: 'At least one variation is required' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const pkgRes = await client.query(
            'INSERT INTO packages (workspace_id, name) VALUES ($1, $2) RETURNING *',
            [req.user.workspaceId, name.trim()]
        );
        const pkg = pkgRes.rows[0];

        const insertedVars = [];
        for (const v of variations) {
            const dur = Number(v.duration);
            const price = Number(v.price);
            if (!v.name?.trim()) throw new Error('Variation name is required');
            if (!Number.isFinite(dur) || dur <= 0) throw new Error('Duration must be a positive number');
            if (!Number.isFinite(price) || price <= 0) throw new Error('Price must be a positive number');
            if (!v.currency?.trim()) throw new Error('Currency is required');

            const vRes = await client.query(
                `INSERT INTO package_variations (package_id, name, description, duration, price, currency)
                 VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
                [pkg.id, v.name.trim(), v.description?.trim() || null, dur, price, v.currency.trim()]
            );
            insertedVars.push(vRes.rows[0]);
        }

        await client.query('COMMIT');
        res.status(201).json({ ...pkg, variations: insertedVars });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(400).json({ error: err.message || 'Failed to create package' });
    } finally {
        client.release();
    }
});

// PUT /api/packages  — update package fields and/or replace its variations list
router.put('/', async (req, res) => {
    const { id, name, active, variations } = req.body;
    if (!id) return res.status(400).json({ error: 'Package id is required' });

    const existing = await pool.query(
        'SELECT * FROM packages WHERE id = $1 AND workspace_id = $2',
        [id, req.user.workspaceId]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Package not found' });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Update package-level fields if provided
        if (name !== undefined || active !== undefined) {
            const newName   = name   !== undefined ? name.trim()  : existing.rows[0].name;
            const newActive = active !== undefined ? active        : existing.rows[0].active;
            await client.query(
                'UPDATE packages SET name = $1, active = $2, updated_at = NOW() WHERE id = $3',
                [newName, newActive, id]
            );
        }

        // Replace variations if provided
        if (Array.isArray(variations)) {
            // Delete all current variations then re-insert
            await client.query('DELETE FROM package_variations WHERE package_id = $1', [id]);

            for (const v of variations) {
                const dur   = Number(v.duration);
                const price = Number(v.price);
                if (!v.name?.trim()) throw new Error('Variation name is required');
                if (!Number.isFinite(dur) || dur <= 0) throw new Error('Duration must be a positive number');
                if (!Number.isFinite(price) || price <= 0) throw new Error('Price must be a positive number');
                if (!v.currency?.trim()) throw new Error('Currency is required');

                await client.query(
                    `INSERT INTO package_variations (package_id, name, description, duration, price, currency, active)
                     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                    [id, v.name.trim(), v.description?.trim() || null, dur, price, v.currency.trim(), v.active ?? true]
                );
            }
        }

        await client.query('COMMIT');
        res.json(await getPackageWithVariations(id, req.user.workspaceId));
    } catch (err) {
        await client.query('ROLLBACK');
        console.error(err);
        res.status(400).json({ error: err.message || 'Failed to update package' });
    } finally {
        client.release();
    }
});

// DELETE /api/packages  — delete one variation; deletes the whole package if it was the last one
router.delete('/', async (req, res) => {
    const { packageId, variationId } = req.body;
    if (!packageId || !variationId)
        return res.status(400).json({ error: 'packageId and variationId are required' });

    const pkg = await pool.query(
        'SELECT * FROM packages WHERE id = $1 AND workspace_id = $2',
        [packageId, req.user.workspaceId]
    );
    if (!pkg.rows.length) return res.status(404).json({ error: 'Package not found' });

    await pool.query('DELETE FROM package_variations WHERE id = $1 AND package_id = $2', [variationId, packageId]);

    const remaining = await pool.query(
        'SELECT id FROM package_variations WHERE package_id = $1',
        [packageId]
    );

    if (remaining.rows.length === 0) {
        await pool.query('DELETE FROM packages WHERE id = $1', [packageId]);
        return res.json({ deleted: 'package', id: packageId });
    }

    res.json(await getPackageWithVariations(packageId, req.user.workspaceId));
});

module.exports = router;
