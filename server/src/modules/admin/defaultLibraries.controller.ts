import { Request, Response, NextFunction } from 'express';
import { createId } from '@paralleldrive/cuid2';
import { prisma } from '../../lib/prisma';

// Super-admin CRUD + bulk import + search for the global Default Libraries.
// One config-driven handler set serves all five master_* resources so every
// library behaves identically (FSMR: scalable, not five copy-pasted controllers).

type Row = Record<string, unknown>;

type ResourceConfig = {
    delegate: string;           // prisma model name (master_*)
    searchFields: string[];     // columns matched by ?search=
    // Build the writable column set from a request body. Throws on invalid input.
    normalize: (body: Row, partial: boolean) => Row;
};

const str = (v: unknown): string | null => {
    if (v == null) return null;
    const s = String(v).trim();
    return s === '' ? null : s;
};
const requiredStr = (v: unknown, field: string): string => {
    const s = str(v);
    if (!s) throw new ValidationError(`${field} is required`);
    return s;
};
const num = (v: unknown): number | null => {
    if (v == null || v === '') return null;
    const n = Number(v);
    if (Number.isNaN(n)) throw new ValidationError('Expected a number');
    return n;
};

class ValidationError extends Error {}

const RESOURCES: Record<string, ResourceConfig> = {
    'muscle-groups': {
        delegate: 'master_exercise_muscle_groups',
        searchFields: ['name_en', 'name_ar'],
        normalize: (b, partial) => ({
            ...(partial && b.name_en === undefined ? {} : { name_en: requiredStr(b.name_en, 'name_en') }),
            name_ar: str(b.name_ar),
        }),
    },
    'equipment': {
        delegate: 'master_exercise_equipments',
        searchFields: ['name_en', 'name_ar'],
        normalize: (b, partial) => ({
            ...(partial && b.name_en === undefined ? {} : { name_en: requiredStr(b.name_en, 'name_en') }),
            name_ar: str(b.name_ar),
        }),
    },
    'exercises': {
        delegate: 'master_exercise_library',
        searchFields: ['name_en', 'name_ar', 'muscle_group', 'equipment'],
        normalize: (b, partial) => ({
            ...(partial && b.name_en === undefined ? {} : { name_en: requiredStr(b.name_en, 'name_en') }),
            name_ar:         str(b.name_ar),
            muscle_group:    str(b.muscle_group),
            equipment:       str(b.equipment),
            youtube_url:     str(b.youtube_url),
            thumbnail_path:  str(b.thumbnail_path),
            instructions_en: str(b.instructions_en),
            instructions_ar: str(b.instructions_ar),
        }),
    },
    'food-categories': {
        delegate: 'master_food_categories',
        searchFields: ['name_en', 'name_ar'],
        normalize: (b, partial) => ({
            ...(partial && b.name_en === undefined ? {} : { name_en: requiredStr(b.name_en, 'name_en') }),
            name_ar: str(b.name_ar),
        }),
    },
    'food-items': {
        delegate: 'master_food_items',
        searchFields: ['name_en', 'name_ar', 'food_category'],
        normalize: (b, partial) => ({
            ...(partial && b.name_en === undefined ? {} : { name_en: requiredStr(b.name_en, 'name_en') }),
            name_ar:              str(b.name_ar),
            food_category:        str(b.food_category),
            serving_size:         num(b.serving_size),
            serving_unit:         str(b.serving_unit),
            ...(partial && b.calories_per_serving === undefined ? {} : { calories_per_serving: num(b.calories_per_serving) ?? 0 }),
            ...(partial && b.protein_per_serving  === undefined ? {} : { protein_per_serving:  num(b.protein_per_serving)  ?? 0 }),
            ...(partial && b.carbs_per_serving    === undefined ? {} : { carbs_per_serving:    num(b.carbs_per_serving)    ?? 0 }),
            ...(partial && b.fats_per_serving     === undefined ? {} : { fats_per_serving:     num(b.fats_per_serving)     ?? 0 }),
        }),
    },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function model(cfg: ResourceConfig): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (prisma as any)[cfg.delegate];
}

function resolve(req: Request, res: Response): ResourceConfig | null {
    const cfg = RESOURCES[req.params.resource as string];
    if (!cfg) { res.status(404).json({ message: 'Unknown library resource' }); return null; }
    return cfg;
}

export async function listRecords(req: Request, res: Response, next: NextFunction) {
    const cfg = resolve(req, res);
    if (!cfg) return;
    try {
        const search = str(req.query.search);
        const take   = Math.min(Number(req.query.limit) || 100, 500);
        const skip   = Number(req.query.offset) || 0;
        const where  = search
            ? { OR: cfg.searchFields.map((f) => ({ [f]: { contains: search, mode: 'insensitive' } })) }
            : {};

        const [records, total] = await Promise.all([
            model(cfg).findMany({ where, orderBy: { name_en: 'asc' }, take, skip }),
            model(cfg).count({ where }),
        ]);
        res.json({ records, total });
    } catch (err) { next(err); }
}

export async function createRecord(req: Request, res: Response, next: NextFunction) {
    const cfg = resolve(req, res);
    if (!cfg) return;
    try {
        const data = cfg.normalize(req.body as Row, false);
        const created = await model(cfg).create({ data: { id: createId(), ...data } });
        res.status(201).json(created);
    } catch (err) {
        if (err instanceof ValidationError) return res.status(400).json({ message: err.message });
        next(err);
    }
}

export async function updateRecord(req: Request, res: Response, next: NextFunction) {
    const cfg = resolve(req, res);
    if (!cfg) return;
    try {
        const data = cfg.normalize(req.body as Row, true);
        const updated = await model(cfg).update({
            where: { id: req.params.id as string },
            data:  { ...data, updated_at: new Date() },
        });
        res.json(updated);
    } catch (err) {
        if (err instanceof ValidationError) return res.status(400).json({ message: err.message });
        next(err);
    }
}

export async function deleteRecord(req: Request, res: Response, next: NextFunction) {
    const cfg = resolve(req, res);
    if (!cfg) return;
    try {
        await model(cfg).delete({ where: { id: req.params.id as string } });
        res.status(204).end();
    } catch (err) { next(err); }
}

// Bulk import: accepts { records: [...] }. Invalid rows are skipped and reported
// so a single bad row never aborts the whole upload.
export async function importRecords(req: Request, res: Response, next: NextFunction) {
    const cfg = resolve(req, res);
    if (!cfg) return;
    try {
        const incoming = (req.body as Row).records;
        if (!Array.isArray(incoming)) return res.status(400).json({ message: 'Expected a "records" array' });

        const valid: Row[] = [];
        const errors: { index: number; message: string }[] = [];
        incoming.forEach((row, index) => {
            try {
                valid.push({ id: createId(), ...cfg.normalize(row as Row, false) });
            } catch (err) {
                errors.push({ index, message: err instanceof ValidationError ? err.message : 'Invalid row' });
            }
        });

        let imported = 0;
        if (valid.length) {
            const result = await model(cfg).createMany({ data: valid, skipDuplicates: true });
            imported = result.count;
        }
        res.json({ imported, skipped: incoming.length - imported, errors });
    } catch (err) { next(err); }
}
